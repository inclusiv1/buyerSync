import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import {
  AssistantDomainError,
  getVisiblePropertyDecision,
  requireBuyer,
  resolveAcceptedMembership,
  updateSearchProfile,
  propertyInputSchema,
} from './domain';

const membership = {
  id: 'membership-1',
  groupId: 'group-1',
  userId: 'buyer-1',
  role: 'buyer',
  status: 'accepted',
};

test('rejects non-buyer writes', () => {
  assert.throws(
    () => requireBuyer({ ...membership, role: 'agent' }),
    (error: unknown) => error instanceof AssistantDomainError && error.status === 403,
  );
});

test('preserves blank manual property fields as unset values', () => {
  const parsed = propertyInputSchema.parse({ price: '', beds: '', yearBuilt: '', latitude: '', sourceUrl: '' });
  assert.equal(parsed.price, null);
  assert.equal(parsed.beds, null);
  assert.equal(parsed.yearBuilt, null);
  assert.equal(parsed.latitude, null);
  assert.equal(parsed.sourceUrl, null);
});

test('resolves membership using both authenticated user and requested group', async () => {
  let receivedWhere: unknown;
  const db = {
    groupMembership: {
      findFirst: async ({ where }: { where: unknown }) => {
        receivedWhere = where;
        return null;
      },
    },
  } as unknown as PrismaClient;

  await assert.rejects(() => resolveAcceptedMembership(db, 'buyer-1', 'group-2'), /accepted group membership/);
  assert.deepEqual(receivedWhere, { userId: 'buyer-1', status: 'accepted', groupId: 'group-2' });
});

test('strictly validates criteria patches before writing', async () => {
  let upserted = false;
  const db = {
    groupMembership: { findFirst: async () => membership },
    searchCriteria: { upsert: async () => { upserted = true; } },
  } as unknown as PrismaClient;

  await assert.rejects(
    () => updateSearchProfile(db, 'buyer-1', { maxPrice: 500_000, groupId: 'group-2' }, 'group-1'),
  );
  assert.equal(upserted, false);
});

test('persists the additional Zillow-style home search criteria', async () => {
  let savedData: Record<string, unknown> | undefined;
  const db = {
    groupMembership: { findFirst: async () => membership },
    searchCriteria: {
      upsert: async ({ update }: { update: Record<string, unknown> }) => {
        savedData = update;
        return update;
      },
    },
  } as unknown as PrismaClient;

  const result = await updateSearchProfile(db, 'buyer-1', {
    maxBeds: 4,
    keywords: 'updated kitchen',
    listingTypes: ['By Owner', 'New Construction'],
    homeFeatures: ['Pool', 'Waterfront'],
  }, 'group-1');

  assert.deepEqual(savedData, {
    maxBeds: 4,
    keywords: 'updated kitchen',
    listingTypes: JSON.stringify(['By Owner', 'New Construction']),
    homeFeatures: JSON.stringify(['Pool', 'Waterfront']),
  });
  assert.deepEqual(result.criteria.listingTypes, ['By Owner', 'New Construction']);
  assert.deepEqual(result.criteria.homeFeatures, ['Pool', 'Waterfront']);
});

test('keeps collaborative ratings hidden until all buyers submit', async () => {
  const db = {
    property: { findUnique: async () => ({ id: 'property-1', groupId: 'group-1', address: '1 Main St' }) },
    groupMembership: {
      findFirst: async () => membership,
      findMany: async () => [
        { userId: 'buyer-1', role: 'buyer', user: { id: 'buyer-1', name: 'Alex' } },
        { userId: 'buyer-2', role: 'co_buyer', user: { id: 'buyer-2', name: 'Sam' } },
      ],
    },
    decisionSubmission: { findMany: async () => [{ propertyId: 'property-1', userId: 'buyer-1' }] },
    criterionRating: {
      findMany: async () => [
        { propertyId: 'property-1', userId: 'buyer-1', criterionId: 'criterion-1', value: 10, dealbreakerTriggered: false },
        { propertyId: 'property-1', userId: 'buyer-2', criterionId: 'criterion-1', value: 1, dealbreakerTriggered: false },
      ],
    },
    decisionCriterion: {
      findMany: async () => [{ id: 'criterion-1', name: 'Fit', weight: 1, scaleMax: 10, isDealbreaker: false }],
    },
  } as unknown as PrismaClient;

  const result = await getVisiblePropertyDecision(db, 'buyer-1', 'property-1');
  assert.equal(result.scoreResult.revealed, false);
  assert.equal(result.scoreResult.compositeScore, null);
  assert.deepEqual(result.scoreResult.raterScores, []);
  assert.deepEqual(result.scoreResult.vetoes, []);
});