import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { buildDecisionResult } from '../../utils/decision';
import { calculateScore } from '../../utils/scoring';
import { importListing, type ListingImportResult } from '../listingImport';
import { searchCriteriaPatchSchema, type SearchCriteriaPatch } from './contracts';

type Database = PrismaClient;

export class AssistantDomainError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const emptyAsNull = (value: unknown) => value === '' ? null : value;
const nullableNumber = (schema: z.ZodNumber) => z.preprocess(emptyAsNull, schema.nullable().optional());

export const propertyInputSchema = z.object({
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(80).optional(),
  zip: z.string().trim().max(20).optional(),
  price: nullableNumber(z.coerce.number().nonnegative()),
  beds: nullableNumber(z.coerce.number().int().nonnegative()),
  baths: nullableNumber(z.coerce.number().nonnegative()),
  sqft: nullableNumber(z.coerce.number().nonnegative()),
  yearBuilt: nullableNumber(z.coerce.number().int().min(1000).max(3000)),
  daysOld: nullableNumber(z.coerce.number().int().nonnegative()),
  lotSize: nullableNumber(z.coerce.number().nonnegative()),
  propertyType: z.string().trim().max(100).nullable().optional(),
  listingTypes: z.array(z.string().trim().min(1).max(100)).max(50).nullable().optional(),
  homeFeatures: z.array(z.string().trim().min(1).max(100)).max(50).nullable().optional(),
  hoa: nullableNumber(z.coerce.number().nonnegative()),
  mlsId: z.string().trim().max(100).nullable().optional(),
  photos: z.union([z.array(z.string().url()).max(50), z.string().max(20_000)]).nullable().optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  sourceUrl: z.preprocess(emptyAsNull, z.string().url().max(2_000).nullable().optional()),
  latitude: nullableNumber(z.coerce.number().min(-90).max(90)),
  longitude: nullableNumber(z.coerce.number().min(-180).max(180)),
  pros: z.array(z.string().trim().min(1).max(500)).max(25).optional(),
  cons: z.array(z.string().trim().min(1).max(500)).max(25).optional(),
});

export type AuthorizedMembership = {
  id: string;
  groupId: string;
  userId: string;
  role: string;
  status: string;
};

export async function resolveAcceptedMembership(db: Database, userId: string, groupId?: string): Promise<AuthorizedMembership> {
  const membership = await db.groupMembership.findFirst({
    where: { userId, status: 'accepted', ...(groupId ? { groupId } : {}) },
  });
  if (!membership) throw new AssistantDomainError('No accepted group membership found', 403);
  return membership;
}

export function requireBuyer(membership: AuthorizedMembership): void {
  if (!['buyer', 'co_buyer'].includes(membership.role)) {
    throw new AssistantDomainError('Only buyers can change search criteria or import listings', 403);
  }
}

export async function getSearchProfile(db: Database, userId: string, groupId?: string) {
  const membership = await resolveAcceptedMembership(db, userId, groupId);
  const criteria = await db.searchCriteria.findUnique({ where: { groupId: membership.groupId } });
  return { membership, criteria: normalizeSearchCriteria(criteria || {}) };
}

function normalizeSearchCriteria<T extends object>(criteria: T) {
  const normalized = { ...criteria } as Record<string, unknown>;
  for (const field of ['propertyTypes', 'listingTypes', 'homeFeatures'] as const) {
    const value = normalized[field];
    if (typeof value === 'string') {
      try {
        normalized[field] = JSON.parse(value);
      } catch {
        normalized[field] = [];
      }
    }
  }
  return normalized;
}

export async function updateSearchProfile(db: Database, userId: string, patch: unknown, groupId?: string) {
  const membership = await resolveAcceptedMembership(db, userId, groupId);
  requireBuyer(membership);
  const parsed: SearchCriteriaPatch = searchCriteriaPatchSchema.parse(patch);
  const { propertyTypes, listingTypes, homeFeatures, ...values } = parsed;
  const data = {
    ...values,
    ...(propertyTypes !== undefined && { propertyTypes: propertyTypes === null ? null : JSON.stringify(propertyTypes) }),
    ...(listingTypes !== undefined && { listingTypes: listingTypes === null ? null : JSON.stringify(listingTypes) }),
    ...(homeFeatures !== undefined && { homeFeatures: homeFeatures === null ? null : JSON.stringify(homeFeatures) }),
  };
  const criteria = await db.searchCriteria.upsert({
    where: { groupId: membership.groupId },
    update: data,
    create: { ...data, groupId: membership.groupId },
  });
  return { membership, criteria: normalizeSearchCriteria(criteria) };
}

function serializeList(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(Array.isArray(value) ? value : []);
}

export async function createPropertyForGroup(db: Database, userId: string, input: unknown, groupId?: string) {
  const membership = await resolveAcceptedMembership(db, userId, groupId);
  const data = propertyInputSchema.parse(input);
  const sourceUrl = data.sourceUrl || null;
  const duplicateIdentifiers = [
    ...(sourceUrl ? [{ sourceUrl }] : []),
    ...(data.mlsId ? [{ mlsId: data.mlsId }] : []),
  ];
  if (duplicateIdentifiers.length) {
    const existing = await db.property.findFirst({
      where: { groupId: membership.groupId, OR: duplicateIdentifiers },
    });
    if (existing) return { property: existing, created: false, membership };
  }
  const property = await db.property.create({
    data: {
      groupId: membership.groupId,
      address: data.address || 'Unknown Address',
      city: data.city || '',
      state: data.state || '',
      zip: data.zip || '',
      lat: data.latitude ?? null,
      lng: data.longitude ?? null,
      price: data.price ?? null,
      beds: data.beds ?? null,
      baths: data.baths ?? null,
      sqft: data.sqft ?? null,
      yearBuilt: data.yearBuilt ?? null,
      daysOld: data.daysOld ?? null,
      lotSize: data.lotSize ?? null,
      propertyType: data.propertyType || null,
      listingTypes: data.listingTypes ? JSON.stringify(data.listingTypes) : null,
      homeFeatures: data.homeFeatures ? JSON.stringify(data.homeFeatures) : null,
      hoa: data.hoa ?? null,
      mlsId: data.mlsId || null,
      photos: data.photos ? serializeList(data.photos) : null,
      description: data.description || null,
      pros: serializeList(data.pros),
      cons: serializeList(data.cons),
      sourceUrl,
      addedById: userId,
    },
  });
  return { property, created: true, membership };
}

export async function importListingForGroup(
  db: Database,
  userId: string,
  url: string,
  groupId?: string,
  importer: (url: string) => Promise<ListingImportResult> = importListing,
) {
  const membership = await resolveAcceptedMembership(db, userId, groupId);
  requireBuyer(membership);
  const listing = await importer(url);
  const saved = await createPropertyForGroup(db, userId, listing, membership.groupId);
  return { ...saved, listing };
}

export async function importSearchListingsForGroup(
  db: Database,
  userId: string,
  listings: unknown[],
  groupId?: string,
) {
  const membership = await resolveAcceptedMembership(db, userId, groupId);
  requireBuyer(membership);
  const parsed = z.array(propertyInputSchema).min(1).max(100).parse(listings);
  const properties = [];
  let imported = 0;
  for (const listing of parsed) {
    const result = await createPropertyForGroup(db, userId, listing, membership.groupId);
    properties.push(result.property);
    if (result.created) imported += 1;
  }
  return { membership, imported, duplicates: parsed.length - imported, properties };
}

export async function listChecklistRequirements(db: Database, userId: string, groupId?: string) {
  const membership = await resolveAcceptedMembership(db, userId, groupId);
  const items = await db.checklistItem.findMany({
    where: { groupId: membership.groupId },
    include: { weights: { where: { userId } } },
  });
  return { membership, items };
}

async function decisionData(db: Database, groupId: string, propertyIds: string[]) {
  const [buyers, submissions, ratings, criteria] = await Promise.all([
    db.groupMembership.findMany({
      where: { groupId, status: 'accepted', role: { in: ['buyer', 'co_buyer'] } },
      include: { user: { select: { id: true, name: true } } },
    }),
    db.decisionSubmission.findMany({ where: { propertyId: { in: propertyIds } } }),
    db.criterionRating.findMany({ where: { propertyId: { in: propertyIds } } }),
    db.decisionCriterion.findMany({ where: { groupId } }),
  ]);
  return { buyers, submissions, ratings, criteria };
}

function visibleDecision(data: Awaited<ReturnType<typeof decisionData>>, propertyId: string) {
  return buildDecisionResult(
    data.buyers.map(buyer => ({
      userId: buyer.userId,
      userName: buyer.user.name,
      role: buyer.role === 'buyer' ? 'primary_buyer' : 'co_buyer',
    })),
    data.submissions.filter(item => item.propertyId === propertyId).map(item => item.userId),
    data.ratings.filter(item => item.propertyId === propertyId),
    data.criteria.map(item => ({ ...item, label: item.name, scaleMax: item.scaleMax as 5 | 10 })),
  );
}

export async function getVisiblePropertyDecision(db: Database, userId: string, propertyId: string) {
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new AssistantDomainError('Property not found', 404);
  const membership = await resolveAcceptedMembership(db, userId, property.groupId);
  const data = await decisionData(db, membership.groupId, [propertyId]);
  return { membership, property, scoreResult: visibleDecision(data, propertyId) };
}

export async function rankSavedProperties(db: Database, userId: string, groupId?: string) {
  const membership = await resolveAcceptedMembership(db, userId, groupId);
  const [properties, criteria, checklist, weights, statuses] = await Promise.all([
    db.property.findMany({ where: { groupId: membership.groupId } }),
    db.searchCriteria.findUnique({ where: { groupId: membership.groupId } }),
    db.checklistItem.findMany({ where: { groupId: membership.groupId } }),
    db.userItemWeight.findMany({ where: { userId, item: { groupId: membership.groupId } } }),
    db.propertyItemStatus.findMany({ where: { checkedByUserId: userId, property: { groupId: membership.groupId } } }),
  ]);
  const decisions = await decisionData(db, membership.groupId, properties.map(property => property.id));
  const ranked = properties.map(property => {
    const checklistScore = calculateScore(
      checklist,
      weights,
      statuses.filter(status => status.propertyId === property.id),
      criteria,
      property,
    );
    const scoreResult = visibleDecision(decisions, property.id);
    return {
      id: property.id,
      address: property.address,
      city: property.city,
      state: property.state,
      price: property.price,
      beds: property.beds,
      baths: property.baths,
      sqft: property.sqft,
      sourceUrl: property.sourceUrl,
      checklistScore: checklistScore.score,
      mustHaveGaps: checklistScore.mustHaveGaps,
      scoreResult,
    };
  }).sort((left, right) => (
    (right.scoreResult.compositeScore ?? right.checklistScore) - (left.scoreResult.compositeScore ?? left.checklistScore)
  ));
  return { membership, properties: ranked };
}