import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from './lib/prisma';
import { parsePropertyText } from './services/scraper';
import { importListing, type ImportAttempt } from './services/listingImport';
import { calculateScore } from './utils/scoring';
import { buildDecisionResult } from './utils/decision';
import { getLatestRates } from './services/mortgage';
import { isTestMode, setupTestMode, testAccounts } from './testMode';

import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const importRequests = new Map<string, number[]>();

function canImport(userId: string): boolean {
  const cutoff = Date.now() - 60_000;
  const recent = (importRequests.get(userId) || []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= 10) return false;
  recent.push(Date.now());
  importRequests.set(userId, recent);
  return true;
}

app.use(cors());
app.use(express.json());

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // The "catchall" handler: for any request that doesn't
  // match one above, send back React's index.html file.
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const slug = email.split('@')[0] + '-' + Math.random().toString(36).substring(2, 7);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: role || 'primary_buyer',
        profileSlug: slug,
      },
    });

    if (user.role === 'primary_buyer') {
      const group = await prisma.buyerGroup.create({
        data: {
          name: `${name}'s Home Search`,
          primaryBuyerId: user.id,
          memberships: {
            create: {
              userId: user.id,
              role: 'buyer',
              status: 'accepted',
            },
          },
        },
      });

      // Initialize search criteria for the group
      await prisma.searchCriteria.create({
        data: {
          groupId: group.id
        }
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/auth/test-users', async (req, res) => {
  if (!isTestMode()) return res.status(404).json({ error: 'Not found' });
  const users = await prisma.user.findMany({
    where: { email: { in: testAccounts.map(account => account.email) } },
    select: { id: true, name: true, email: true, role: true },
  });
  const byEmail = new Map(users.map(user => [user.email, user]));
  res.json(testAccounts.map(account => byEmail.get(account.email)).filter(Boolean));
});

app.post('/api/auth/test-login', async (req, res) => {
  if (!isTestMode()) return res.status(404).json({ error: 'Not found' });
  const account = testAccounts.find(candidate => candidate.email === req.body.email);
  if (!account) return res.status(400).json({ error: 'Unknown test account' });
  const user = await prisma.user.findUnique({ where: { email: account.email } });
  if (!user) return res.status(503).json({ error: 'Test accounts are not set up' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Middleware to authenticate
const ensureGuestUser = async () => {
  let guest = await prisma.user.findUnique({ where: { email: 'guest@example.com' } });
  if (!guest) {
    guest = await prisma.user.create({
      data: {
        name: 'Guest User',
        email: 'guest@example.com',
        passwordHash: await bcrypt.hash('guest', 10),
        role: 'primary_buyer',
        profileSlug: 'guest',
      }
    });
    const group = await prisma.buyerGroup.create({
      data: {
        name: 'Guest Home Search',
        primaryBuyerId: guest.id,
        memberships: {
          create: {
            userId: guest.id,
            role: 'buyer',
            status: 'accepted',
          }
        }
      }
    });
    await prisma.searchCriteria.create({
      data: {
        groupId: group.id
      }
    });
  }
  return guest;
};

const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token || token === 'undefined' || token === 'null') {
    const guest = await ensureGuestUser();
    req.userId = guest.id;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (err) {
    const guest = await ensureGuestUser();
    req.userId = guest.id;
    next();
  }
};

const findMembership = (userId: string, groupId?: string) => prisma.groupMembership.findFirst({
  where: { userId, status: 'accepted', ...(groupId && { groupId }) }
});

const getRequestedSearchId = (req: any): string | undefined => {
  const value = req.query.searchId ?? req.body?.searchId;
  return typeof value === 'string' && value ? value : undefined;
};

const findAccessibleProperty = async (propertyId: string, userId: string) => {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return null;
  const membership = await findMembership(userId, property.groupId);
  return membership ? { property, membership } : null;
};

app.get('/api/me', authenticate, async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { memberships: { include: { group: { include: { properties: true } } } } },
  });
  res.json(user);
});

app.get('/api/searches', authenticate, async (req: any, res) => {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId: req.userId, status: 'accepted' },
    include: {
      group: {
        include: {
          memberships: {
            where: { status: 'accepted' },
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
            orderBy: { role: 'asc' }
          },
          _count: { select: { properties: true } }
        }
      }
    },
    orderBy: { group: { createdAt: 'asc' } }
  });

  res.json(memberships.map(({ group, role }) => ({
    id: group.id,
    name: group.name,
    role,
    propertyCount: group._count.properties,
    contributors: group.memberships.map(member => ({ ...member.user, role: member.role }))
  })));
});

app.post('/api/searches', authenticate, async (req: any, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80) return res.status(400).json({ error: 'Search name must be between 1 and 80 characters' });

    const duplicate = await prisma.buyerGroup.findFirst({
      where: { primaryBuyerId: req.userId, name: { equals: name } }
    });
    if (duplicate) return res.status(409).json({ error: 'You already have a search with this name' });

    const group = await prisma.buyerGroup.create({
      data: {
        name,
        primaryBuyerId: req.userId,
        memberships: { create: { userId: req.userId, role: 'buyer', status: 'accepted' } },
        searchCriteria: { create: {} }
      },
      include: {
        memberships: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } }
      }
    });
    res.status(201).json({
      id: group.id,
      name: group.name,
      role: 'buyer',
      propertyCount: 0,
      contributors: group.memberships.map(member => ({ ...member.user, role: member.role }))
    });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'You already have a search with this name' });
    res.status(400).json({ error: error.message });
  }
});

// Invitation Routes
app.post('/api/invites', authenticate, async (req: any, res) => {
  try {
    const { email, role, searchId } = req.body;
    const membership = await prisma.groupMembership.findFirst({
      where: { userId: req.userId, role: 'buyer', ...(searchId && { groupId: searchId }) }
    });

    if (!membership) return res.status(403).json({ error: 'Only primary buyers can invite' });
    const invitedRole = role === 'agent' ? 'agent' : 'co_buyer';

    const token = crypto.randomBytes(32).toString('hex');
    const invite = await prisma.invitation.create({
      data: {
        groupId: membership.groupId,
        invitedEmail: email,
        invitedRole,
        token,
        channel: 'email',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        invitedByUserId: req.userId,
      },
    });

    // In dev, we just return the link
    const inviteLink = `http://localhost:5173/invite/${token}`;
    res.json({ invite, inviteLink });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/invites/:token', async (req, res) => {
  const invite = await prisma.invitation.findUnique({
    where: { token: req.params.token },
    include: { group: true }
  });
  if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return res.status(404).json({ error: 'Invalid or expired invitation' });
  }
  res.json(invite);
});

app.post('/api/invites/accept', async (req, res) => {
  try {
    const { token, name, password } = req.body;
    const invite = await prisma.invitation.findUnique({ where: { token } });
    if (!invite || invite.status !== 'pending') return res.status(404).json({ error: 'Invalid invitation' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const slug = invite.invitedEmail.split('@')[0] + '-' + Math.random().toString(36).substring(2, 7);

    const user = await prisma.user.upsert({
      where: { email: invite.invitedEmail },
      update: {},
      create: {
        name,
        email: invite.invitedEmail,
        passwordHash: hashedPassword,
        role: invite.invitedRole,
        profileSlug: slug,
      }
    });

    await prisma.groupMembership.upsert({
      where: {
        groupId_userId: {
          groupId: invite.groupId,
          userId: user.id,
        }
      },
      update: {
        status: 'accepted',
        role: invite.invitedRole
      },
      create: {
        groupId: invite.groupId,
        userId: user.id,
        role: invite.invitedRole,
        status: 'accepted',
      }
    });

    await prisma.invitation.update({
      where: { id: invite.id },
      data: { status: 'accepted' }
    });

    const authToken = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token: authToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/properties/import', authenticate, async (req: any, res) => {
  try {
    if (!canImport(req.userId)) return res.status(429).json({ error: 'Too many imports. Please wait a minute and try again.' });
    const { url } = req.body;
    const data = await importListing(url);
    res.json(data);
  } catch (error: any) {
    res.status(422).json({ error: error.message, attempts: (error as Error & { attempts?: ImportAttempt[] }).attempts });
  }
});

app.post('/api/properties/parse-text', authenticate, async (req: any, res) => {
  try {
    const { text } = req.body;
    const data = parsePropertyText(text);
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Property Routes
app.post('/api/properties', authenticate, async (req: any, res) => {
  try {
    const {
      address, city, state, zip, price, beds, baths, sqft,
      yearBuilt, lotSize, propertyType, hoa, mlsId,
      photos, description, sourceUrl, latitude, longitude, pros, cons
    } = req.body;
    const membership = await findMembership(req.userId, getRequestedSearchId(req));
    if (!membership) return res.status(403).json({ error: 'No group membership found' });

    let photosJson: string | null = null;
    if (photos) {
      if (typeof photos === 'string') {
        photosJson = photos;
      } else if (Array.isArray(photos)) {
        photosJson = JSON.stringify(photos);
      }
    }

    const serializeList = (value: unknown) => JSON.stringify(
      Array.isArray(value) ? value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean) : []
    );

    const parseNum = (val: any) => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const property = await prisma.property.create({
      data: {
        groupId: membership.groupId,
        address: address || 'Unknown Address',
        city: city || '',
        state: state || '',
        zip: zip || '',
        lat: parseNum(latitude),
        lng: parseNum(longitude),
        price: parseNum(price),
        beds: parseNum(beds) !== null ? Math.round(Number(beds)) : null,
        baths: parseNum(baths),
        sqft: parseNum(sqft),
        yearBuilt: parseNum(yearBuilt) !== null ? Math.round(Number(yearBuilt)) : null,
        lotSize: parseNum(lotSize),
        propertyType: propertyType || null,
        hoa: parseNum(hoa),
        mlsId: mlsId || null,
        photos: photosJson,
        description: description || null,
        pros: serializeList(pros),
        cons: serializeList(cons),
        sourceUrl: sourceUrl || null,
        addedById: req.userId,
      }
    });
    res.json({ ...property, pros: JSON.parse(property.pros), cons: JSON.parse(property.cons) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/properties/:id', authenticate, async (req: any, res) => {
  try {
    const access = await findAccessibleProperty(req.params.id, req.userId);
    if (!access) return res.status(404).json({ error: 'Property not found' });
    const { property: existingProperty } = access;

    const {
      address, city, state, zip, price, beds, baths, sqft,
      yearBuilt, lotSize, propertyType, hoa, mlsId,
      photos, description, sourceUrl, latitude, longitude, pros, cons
    } = req.body;
    const parseNum = (val: any) => {
      if (val === undefined || val === null || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };
    let photosJson: string | null | undefined;
    if (photos !== undefined) {
      photosJson = Array.isArray(photos) ? JSON.stringify(photos) : photos || null;
    }
    const serializeList = (value: unknown) => {
      if (!Array.isArray(value)) throw new Error('Pros and cons must be arrays of text');
      return JSON.stringify(value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean));
    };

    const property = await prisma.property.update({
      where: { id: existingProperty.id },
      data: {
        ...(address !== undefined && { address: address || 'Unknown Address' }),
        ...(city !== undefined && { city: city || '' }),
        ...(state !== undefined && { state: state || '' }),
        ...(zip !== undefined && { zip: zip || '' }),
        ...(latitude !== undefined && { lat: parseNum(latitude) }),
        ...(longitude !== undefined && { lng: parseNum(longitude) }),
        ...(price !== undefined && { price: parseNum(price) }),
        ...(beds !== undefined && { beds: parseNum(beds) !== null ? Math.round(Number(beds)) : null }),
        ...(baths !== undefined && { baths: parseNum(baths) }),
        ...(sqft !== undefined && { sqft: parseNum(sqft) }),
        ...(yearBuilt !== undefined && { yearBuilt: parseNum(yearBuilt) !== null ? Math.round(Number(yearBuilt)) : null }),
        ...(lotSize !== undefined && { lotSize: parseNum(lotSize) }),
        ...(propertyType !== undefined && { propertyType: propertyType || null }),
        ...(hoa !== undefined && { hoa: parseNum(hoa) }),
        ...(mlsId !== undefined && { mlsId: mlsId || null }),
        ...(photos !== undefined && { photos: photosJson }),
        ...(description !== undefined && { description: description || null }),
        ...(pros !== undefined && { pros: serializeList(pros) }),
        ...(cons !== undefined && { cons: serializeList(cons) }),
        ...(sourceUrl !== undefined && { sourceUrl: sourceUrl || null })
      }
    });
    res.json({ ...property, pros: JSON.parse(property.pros), cons: JSON.parse(property.cons) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/properties/:id', authenticate, async (req: any, res) => {
  try {
    const access = await findAccessibleProperty(req.params.id, req.userId);
    if (!access) return res.status(404).json({ error: 'Property not found' });
    const { property } = access;

    await prisma.$transaction([
      prisma.note.deleteMany({ where: { propertyId: property.id } }),
      prisma.propertyItemStatus.deleteMany({ where: { propertyId: property.id } }),
      prisma.propertyScore.deleteMany({ where: { propertyId: property.id } }),
      prisma.criterionRating.deleteMany({ where: { propertyId: property.id } }),
      prisma.decisionSubmission.deleteMany({ where: { propertyId: property.id } }),
      prisma.capExItem.deleteMany({ where: { propertyId: property.id } }),
      prisma.walkthroughInspection.deleteMany({ where: { propertyId: property.id } }),
      prisma.agentComment.deleteMany({ where: { propertyId: property.id } }),
      prisma.property.delete({ where: { id: property.id } })
    ]);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/properties/:id/notes', authenticate, async (req: any, res) => {
  const notes = await prisma.note.findMany({
    where: { propertyId: req.params.id },
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(notes);
});

app.get('/api/properties/:id/statuses', authenticate, async (req: any, res) => {
  const statuses = await prisma.propertyItemStatus.findMany({
    where: { propertyId: req.params.id, checkedByUserId: req.userId }
  });
  res.json(statuses);
});

app.post('/api/properties/:id/notes', authenticate, async (req: any, res) => {
  try {
    const { body, visitDate } = req.body;
    const note = await prisma.note.create({
      data: {
        propertyId: req.params.id,
        authorId: req.userId,
        body,
        visitDate: visitDate ? new Date(visitDate) : null,
      },
      include: { author: { select: { id: true, name: true, role: true } } }
    });
    res.json(note);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/properties', authenticate, async (req: any, res) => {
  const membership = await findMembership(req.userId, getRequestedSearchId(req));
  if (!membership) return res.json([]);

  const properties = await prisma.property.findMany({
    where: { groupId: membership.groupId },
    include: {
      notes: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' }
      },
      scores: true
    }
  });

  const propertyIds = properties.map(property => property.id);
  const [buyers, submissions, ratings, decisionCriteria] = await Promise.all([
    prisma.groupMembership.findMany({
      where: { groupId: membership.groupId, status: 'accepted', role: { in: ['buyer', 'co_buyer'] } },
      include: { user: true }
    }),
    prisma.decisionSubmission.findMany({ where: { propertyId: { in: propertyIds } } }),
    prisma.criterionRating.findMany({ where: { propertyId: { in: propertyIds } } }),
    prisma.decisionCriterion.findMany({ where: { groupId: membership.groupId } })
  ]);
  const raterDetails = buyers.map(buyer => ({
    userId: buyer.userId,
    userName: buyer.user.name,
    role: buyer.role === 'buyer' ? 'primary_buyer' : 'co_buyer',
  }));
  const normalizedCriteria = decisionCriteria.map(criterion => ({
    ...criterion,
    label: criterion.name,
    scaleMax: criterion.scaleMax as 5 | 10,
  }));
  const propertiesWithScores = properties.map(property => {
    const scoreResult = buildDecisionResult(
      raterDetails,
      submissions.filter(submission => submission.propertyId === property.id).map(submission => submission.userId),
      ratings.filter(rating => rating.propertyId === property.id),
      normalizedCriteria,
    );
    const parseList = (value: string) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
      } catch {
        return [];
      }
    };
    return {
      ...property,
      pros: parseList(property.pros),
      cons: parseList(property.cons),
      score: scoreResult.compositeScore,
      hasVeto: scoreResult.hasVeto,
      scoreResult
    };
  });

  res.json(propertiesWithScores);
});

app.get('/api/properties/:id', authenticate, async (req: any, res) => {
  const access = await findAccessibleProperty(req.params.id, req.userId);
  if (!access) return res.status(404).json({ error: 'Property not found' });

  const parseList = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
    } catch {
      return [];
    }
  };
  res.json({
    ...access.property,
    pros: parseList(access.property.pros),
    cons: parseList(access.property.cons)
  });
});

// Checklist Routes
app.get('/api/checklist-items', authenticate, async (req: any, res) => {
  const membership = await prisma.groupMembership.findFirst({
    where: { userId: req.userId }
  });
  if (!membership) return res.json([]);

  const items = await prisma.checklistItem.findMany({
    where: { groupId: membership.groupId },
    include: { weights: true }
  });
  res.json(items);
});

app.post('/api/checklist-items', authenticate, async (req: any, res) => {
  try {
    const { label, category, weight } = req.body;
    const membership = await prisma.groupMembership.findFirst({
      where: { userId: req.userId, role: { in: ['buyer', 'co_buyer'] } }
    });
    if (!membership) return res.status(403).json({ error: 'Only buyers can add checklist items' });

    const item = await prisma.checklistItem.create({
      data: {
        groupId: membership.groupId,
        label,
        category,
        createdById: req.userId,
        weights: weight ? {
          create: {
            userId: req.userId,
            weight: weight,
          }
        } : undefined
      },
      include: {
        weights: true
      }
    });
    res.json(item);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/checklist-items/:id', authenticate, async (req: any, res) => {
  const membership = await prisma.groupMembership.findFirst({
    where: { userId: req.userId, status: 'accepted', role: { in: ['buyer', 'co_buyer'] } }
  });
  if (!membership) return res.status(403).json({ error: 'Only buyers can remove checklist items' });

  const item = await prisma.checklistItem.findFirst({
    where: { id: req.params.id, groupId: membership.groupId }
  });
  if (!item) return res.status(404).json({ error: 'Checklist item not found' });

  await prisma.$transaction([
    prisma.propertyItemStatus.deleteMany({ where: { checklistItemId: item.id } }),
    prisma.userItemWeight.deleteMany({ where: { checklistItemId: item.id } }),
    prisma.checklistItem.delete({ where: { id: item.id } })
  ]);
  res.status(204).send();
});

app.post('/api/weights', authenticate, async (req: any, res) => {
  try {
    const { checklistItemId, weight } = req.body;
    const userWeight = await prisma.userItemWeight.upsert({
      where: {
        userId_checklistItemId: {
          userId: req.userId,
          checklistItemId,
        }
      },
      update: { weight },
      create: {
        userId: req.userId,
        checklistItemId,
        weight,
      }
    });
    res.json(userWeight);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/property-status', authenticate, async (req: any, res) => {
  try {
    const { propertyId, checklistItemId, isMet } = req.body;
    const status = await prisma.propertyItemStatus.upsert({
      where: {
        propertyId_checklistItemId_checkedByUserId: {
          propertyId,
          checklistItemId,
          checkedByUserId: req.userId,
        }
      },
      update: { isMet },
      create: {
        propertyId,
        checklistItemId,
        checkedByUserId: req.userId,
        isMet,
      }
    });
    res.json(status);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Collaborative decision routes
const serializeCriterion = (criterion: any) => ({
  ...criterion,
  label: criterion.name,
});

const serializeCapExItem = (item: any) => ({
  id: item.id,
  listingId: item.propertyId,
  label: item.name,
  estimatedCost: item.amount,
  priority: item.category || 'future',
  notes: item.notes || undefined,
});

const serializeInspection = (inspection: any, agentComment?: string) => ({
  id: inspection.id,
  listingId: inspection.propertyId,
  section: inspection.area,
  inspectedBy: {
    id: inspection.author.id,
    name: inspection.author.name,
    role: inspection.author.role,
  },
  inspectedAt: inspection.inspectedAt,
  ...(agentComment && { agentComment }),
  items: inspection.items ? JSON.parse(inspection.items) : [{
    id: inspection.id,
    label: inspection.area,
    condition: inspection.condition,
    issueFlags: [],
    notes: inspection.notes || undefined,
    media: inspection.media ? JSON.parse(inspection.media) : [],
  }],
});

app.get('/api/decision/criteria', authenticate, async (req: any, res) => {
  const membership = await findMembership(req.userId);
  if (!membership) return res.status(403).json({ error: 'No group found' });
  const criteria = await prisma.decisionCriterion.findMany({
    where: { groupId: membership.groupId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });
  res.json(criteria.map(serializeCriterion));
});

app.post('/api/decision/criteria', authenticate, async (req: any, res) => {
  try {
    const membership = await prisma.groupMembership.findFirst({
      where: { userId: req.userId, status: 'accepted', role: { in: ['buyer', 'co_buyer'] } }
    });
    if (!membership) return res.status(403).json({ error: 'Only buyers can add decision criteria' });
    const rawLabel = req.body.label ?? req.body.name;
    const name = typeof rawLabel === 'string' ? rawLabel.trim() : '';
    const weight = req.body.weight === undefined ? 1 : Number(req.body.weight);
    const scaleMax = req.body.scaleMax === undefined ? 10 : Number(req.body.scaleMax);
    const sortOrder = req.body.sortOrder === undefined ? 0 : Number(req.body.sortOrder);
    const isDealbreaker = req.body.isDealbreaker === true;
    if (!name || !Number.isFinite(weight) || weight <= 0 || ![5, 10].includes(scaleMax) || !Number.isInteger(sortOrder)) {
      return res.status(400).json({ error: 'label, positive weight, scaleMax of 5 or 10, and integer sortOrder are required' });
    }
    const criterion = await prisma.decisionCriterion.create({
      data: {
        groupId: membership.groupId,
        name,
        description: typeof req.body.description === 'string' ? req.body.description.trim() || null : null,
        category: typeof req.body.category === 'string' ? req.body.category.trim() || 'custom' : 'custom',
        weight,
        scaleMax,
        isDealbreaker,
        sortOrder
      }
    });
    res.status(201).json(serializeCriterion(criterion));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/decision/criteria/:id', authenticate, async (req: any, res) => {
  const membership = await prisma.groupMembership.findFirst({
    where: { userId: req.userId, status: 'accepted', role: { in: ['buyer', 'co_buyer'] } }
  });
  if (!membership) return res.status(403).json({ error: 'Only buyers can remove decision criteria' });

  const criterion = await prisma.decisionCriterion.findFirst({
    where: { id: req.params.id, groupId: membership.groupId }
  });
  if (!criterion) return res.status(404).json({ error: 'Decision criterion not found' });

  await prisma.$transaction([
    prisma.criterionRating.deleteMany({ where: { criterionId: criterion.id } }),
    prisma.decisionCriterion.delete({ where: { id: criterion.id } })
  ]);
  res.status(204).send();
});

const getDecision = async (propertyId: string, userId: string) => {
  const access = await findAccessibleProperty(propertyId, userId);
  if (!access) return null;
  const [buyers, submissions, ratings, criteria, capExItems, inspections, agentComments] = await Promise.all([
    prisma.groupMembership.findMany({
      where: { groupId: access.property.groupId, status: 'accepted', role: { in: ['buyer', 'co_buyer'] } },
      include: { user: true }
    }),
    prisma.decisionSubmission.findMany({ where: { propertyId }, orderBy: { submittedAt: 'asc' } }),
    prisma.criterionRating.findMany({ where: { propertyId } }),
    prisma.decisionCriterion.findMany({ where: { groupId: access.property.groupId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    prisma.capExItem.findMany({ where: { propertyId }, orderBy: { createdAt: 'asc' } }),
    prisma.walkthroughInspection.findMany({ where: { propertyId }, include: { author: true }, orderBy: { inspectedAt: 'desc' } }),
    prisma.agentComment.findMany({ where: { propertyId }, orderBy: { createdAt: 'desc' } }),
  ]);
  const raterDetails = buyers.map(buyer => ({
    userId: buyer.userId,
    userName: buyer.user.name,
    role: buyer.role === 'buyer' ? 'primary_buyer' : 'co_buyer',
  }));
  const scoreResult = buildDecisionResult(
    raterDetails,
    submissions.map(submission => submission.userId),
    ratings,
    criteria.map(criterion => ({ ...criterion, label: criterion.name, scaleMax: criterion.scaleMax as 5 | 10 })),
  );
  const criterionById = new Map(criteria.map(criterion => [criterion.id, criterion]));
  const raterIds = new Set(raterDetails.map(rater => rater.userId));
  return {
    scoreResult,
    submissions: submissions.filter(submission => raterIds.has(submission.userId)).map(submission => {
      const rater = raterDetails.find(buyer => buyer.userId === submission.userId)!;
      const visible = scoreResult.revealed || submission.userId === userId;
      const submissionRatings = ratings.filter(rating => rating.userId === submission.userId);
      return {
        id: submission.id,
        listingId: propertyId,
        user: { id: rater.userId, name: rater.userName, role: rater.role },
        scores: visible ? submissionRatings
          .filter(rating => !criterionById.get(rating.criterionId)?.isDealbreaker)
          .map(rating => ({ criterionId: rating.criterionId, value: rating.value })) : [],
        dealbreakers: visible ? submissionRatings
          .filter(rating => criterionById.get(rating.criterionId)?.isDealbreaker)
          .map(rating => ({ criterionId: rating.criterionId, triggered: rating.dealbreakerTriggered })) : [],
        submittedAt: submission.submittedAt,
        isSubmitted: true,
      };
    }),
    capExItems: capExItems.map(serializeCapExItem),
    inspections: inspections.map(inspection => serializeInspection(
      inspection,
      agentComments.find(comment => comment.inspectionId === inspection.id)?.body,
    )),
  };
};

app.get('/api/properties/:id/decision', authenticate, async (req: any, res) => {
  const result = await getDecision(req.params.id, req.userId);
  if (!result) return res.status(404).json({ error: 'Property not found' });
  res.json(result);
});

app.post('/api/properties/:id/scores', authenticate, async (req: any, res) => {
  try {
    const access = await findAccessibleProperty(req.params.id, req.userId);
    if (!access) return res.status(404).json({ error: 'Property not found' });
    if (!['buyer', 'co_buyer'].includes(access.membership.role)) {
      return res.status(403).json({ error: 'Only buyers can submit scores' });
    }
    const scores = Array.isArray(req.body.scores) ? req.body.scores : [];
    const dealbreakers = Array.isArray(req.body.dealbreakers) ? req.body.dealbreakers : [];
    const criteria = await prisma.decisionCriterion.findMany({ where: { groupId: access.property.groupId } });
    const scoringCriteria = criteria.filter(criterion => !criterion.isDealbreaker);
    const dealbreakerCriteria = criteria.filter(criterion => criterion.isDealbreaker);
    const scoringById = new Map(scoringCriteria.map(criterion => [criterion.id, criterion]));
    const dealbreakerIds = new Set(dealbreakerCriteria.map(criterion => criterion.id));
    const submittedScoreIds = scores.map((score: any) => score.criterionId);
    const submittedDealbreakerIds = dealbreakers.map((item: any) => item.criterionId);
    if (
      criteria.length === 0 ||
      submittedScoreIds.length !== scoringCriteria.length ||
      new Set(submittedScoreIds).size !== submittedScoreIds.length ||
      submittedScoreIds.some((id: unknown) => typeof id !== 'string' || !scoringById.has(id as string)) ||
      scores.some((score: any) => {
        const criterion = scoringById.get(score.criterionId);
        return !criterion || !Number.isFinite(score.value) || score.value < 1 || score.value > criterion.scaleMax;
      }) ||
      submittedDealbreakerIds.length !== dealbreakerCriteria.length ||
      new Set(submittedDealbreakerIds).size !== submittedDealbreakerIds.length ||
      dealbreakers.some((item: any) => typeof item.criterionId !== 'string' || !dealbreakerIds.has(item.criterionId) || typeof item.triggered !== 'boolean')
    ) {
      return res.status(400).json({ error: 'Submit one in-scale numeric rating per scoring criterion and one boolean per dealbreaker criterion' });
    }
    await prisma.$transaction([
      prisma.criterionRating.deleteMany({ where: { propertyId: req.params.id, userId: req.userId } }),
      prisma.criterionRating.createMany({
        data: [
          ...scores.map((score: any) => ({
            propertyId: req.params.id,
            criterionId: score.criterionId,
            userId: req.userId,
            value: score.value,
            dealbreakerTriggered: false,
          })),
          ...dealbreakers.map((item: any) => ({
            propertyId: req.params.id,
            criterionId: item.criterionId,
            userId: req.userId,
            value: 0,
            dealbreakerTriggered: item.triggered,
          })),
        ]
      }),
      prisma.decisionSubmission.upsert({
        where: { propertyId_userId: { propertyId: req.params.id, userId: req.userId } },
        update: { submittedAt: new Date() },
        create: { propertyId: req.params.id, userId: req.userId }
      })
    ]);
    res.json(await getDecision(req.params.id, req.userId));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/properties/:id/capex', authenticate, async (req: any, res) => {
  const access = await findAccessibleProperty(req.params.id, req.userId);
  if (!access) return res.status(404).json({ error: 'Property not found' });
  const items = await prisma.capExItem.findMany({ where: { propertyId: req.params.id }, orderBy: { createdAt: 'asc' } });
  res.json({ items: items.map(serializeCapExItem), total: items.reduce((sum, item) => sum + item.amount, 0) });
});

app.post('/api/properties/:id/capex', authenticate, async (req: any, res) => {
  try {
    const access = await findAccessibleProperty(req.params.id, req.userId);
    if (!access) return res.status(404).json({ error: 'Property not found' });
    const rawLabel = req.body.label ?? req.body.name;
    const name = typeof rawLabel === 'string' ? rawLabel.trim() : '';
    const amount = Number(req.body.estimatedCost ?? req.body.amount);
    if (!name || !Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'name and a non-negative amount are required' });
    }
    const data = {
      name,
      amount,
      category: typeof (req.body.priority ?? req.body.category) === 'string' ? (req.body.priority ?? req.body.category).trim() || null : null,
      notes: typeof req.body.notes === 'string' ? req.body.notes.trim() || null : null
    };
    let item;
    if (typeof req.body.id === 'string') {
      const existing = await prisma.capExItem.findFirst({ where: { id: req.body.id, propertyId: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'CapEx item not found' });
      item = await prisma.capExItem.update({ where: { id: existing.id }, data });
    } else {
      item = await prisma.capExItem.create({ data: { ...data, propertyId: req.params.id } });
    }
    res.status(typeof req.body.id === 'string' ? 200 : 201).json(serializeCapExItem(item));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/capex/:id', authenticate, async (req: any, res) => {
  const item = await prisma.capExItem.findUnique({ where: { id: req.params.id }, include: { property: true } });
  if (!item || !await findMembership(req.userId, item.property.groupId)) {
    return res.status(404).json({ error: 'CapEx item not found' });
  }
  await prisma.capExItem.delete({ where: { id: item.id } });
  res.status(204).send();
});

app.get('/api/properties/:id/inspections', authenticate, async (req: any, res) => {
  const access = await findAccessibleProperty(req.params.id, req.userId);
  if (!access) return res.status(404).json({ error: 'Property not found' });
  const [inspections, agentComments] = await Promise.all([
    prisma.walkthroughInspection.findMany({ where: { propertyId: req.params.id }, include: { author: true }, orderBy: { inspectedAt: 'desc' } }),
    prisma.agentComment.findMany({ where: { propertyId: req.params.id }, include: { author: true }, orderBy: { createdAt: 'desc' } })
  ]);
  res.json({
    inspections: inspections.map(inspection => serializeInspection(
      inspection,
      agentComments.find(comment => comment.inspectionId === inspection.id)?.body,
    )),
    agentComments,
  });
});

app.post('/api/properties/:id/inspections', authenticate, async (req: any, res) => {
  try {
    const access = await findAccessibleProperty(req.params.id, req.userId);
    if (!access) return res.status(404).json({ error: 'Property not found' });
    const rawSection = req.body.section ?? req.body.area;
    const area = typeof rawSection === 'string' ? rawSection.trim() : '';
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    const condition = typeof req.body.condition === 'string' ? req.body.condition.trim() : items?.[0]?.condition;
    const rawNotes = req.body.notes ?? items?.[0]?.notes;
    if (!area || typeof condition !== 'string' || !condition || (req.body.media !== undefined && !Array.isArray(req.body.media))) {
      return res.status(400).json({ error: 'section and structured items (or condition and optional media) are required' });
    }
    const inspection = await prisma.walkthroughInspection.create({
      data: {
        propertyId: req.params.id,
        authorId: req.userId,
        area,
        condition,
        notes: typeof rawNotes === 'string' ? rawNotes.trim() || null : null,
        media: req.body.media ? JSON.stringify(req.body.media) : null,
        items: items ? JSON.stringify(items) : null,
        inspectedAt: req.body.inspectedAt ? new Date(req.body.inspectedAt) : new Date()
      },
      include: { author: true }
    });
    res.status(201).json(serializeInspection(inspection));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/properties/:id/agent-comments', authenticate, async (req: any, res) => {
  try {
    const access = await findAccessibleProperty(req.params.id, req.userId);
    if (!access) return res.status(404).json({ error: 'Property not found' });
    if (access.membership.role !== 'agent') {
      return res.status(403).json({ error: 'Only agents can add agent commentary' });
    }
    const rawComment = req.body.comment ?? req.body.body;
    const body = typeof rawComment === 'string' ? rawComment.trim() : '';
    if (!body) return res.status(400).json({ error: 'body is required' });
    const inspectionId = typeof req.body.inspectionId === 'string' ? req.body.inspectionId : null;
    if (inspectionId && !await prisma.walkthroughInspection.findFirst({ where: { id: inspectionId, propertyId: req.params.id } })) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    const comment = await prisma.agentComment.create({
      data: { propertyId: req.params.id, inspectionId, authorId: req.userId, body },
      include: { author: true }
    });
    res.status(201).json(comment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/rates', async (req, res) => {
  const rates = await getLatestRates();
  res.json(rates);
});

app.get('/api/properties/:id/score', authenticate, async (req: any, res) => {
  const { id } = req.params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: { group: { include: { checklistItems: true } } }
  });

  if (!property) return res.status(404).json({ error: 'Property not found' });

  const items = property.group.checklistItems;
  const weights = await prisma.userItemWeight.findMany({
    where: { userId: req.userId, item: { groupId: property.groupId } }
  });
  const statuses = await prisma.propertyItemStatus.findMany({
    where: { propertyId: id, checkedByUserId: req.userId }
  });
  const criteria = await prisma.searchCriteria.findUnique({
    where: { groupId: property.groupId }
  });

  const scoreData = calculateScore(items, weights, statuses, criteria, property);
  res.json(scoreData);
});

app.get('/api/search-criteria', authenticate, async (req: any, res) => {
  const membership = await prisma.groupMembership.findFirst({
    where: { userId: req.userId }
  });
  if (!membership) return res.status(403).json({ error: 'No group found' });

  const criteria = await prisma.searchCriteria.findUnique({
    where: { groupId: membership.groupId }
  });
  res.json(criteria || {});
});

app.post('/api/search-criteria', authenticate, async (req: any, res) => {
  try {
    const membership = await prisma.groupMembership.findFirst({
      where: { userId: req.userId, role: { in: ['buyer', 'co_buyer'] } }
    });
    if (!membership) return res.status(403).json({ error: 'Only buyers can update criteria' });

    const criteria = await prisma.searchCriteria.upsert({
      where: { groupId: membership.groupId },
      update: req.body,
      create: { ...req.body, groupId: membership.groupId }
    });
    res.json(criteria);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

const startServer = async () => {
  if (isTestMode()) {
    await setupTestMode();
    console.log('Test mode enabled with three collaborative users');
  }
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Unable to start server', error);
  process.exit(1);
});
