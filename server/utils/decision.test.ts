import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDecisionResult } from './decision.ts';

const buyers = [
  { userId: 'buyer-1', userName: 'Alex', role: 'primary_buyer' },
  { userId: 'buyer-2', userName: 'Sam', role: 'co_buyer' },
];
const criteria = [
  { id: 'location', label: 'Location', weight: 3, scaleMax: 5 as const, isDealbreaker: false },
  { id: 'condition', label: 'Condition', weight: 1, scaleMax: 10 as const, isDealbreaker: false },
  { id: 'flood', label: 'Flood zone', weight: 1, scaleMax: 10 as const, isDealbreaker: true },
];
const ratings = [
  { userId: 'buyer-1', criterionId: 'location', value: 5, dealbreakerTriggered: false },
  { userId: 'buyer-1', criterionId: 'condition', value: 5, dealbreakerTriggered: true },
  { userId: 'buyer-1', criterionId: 'flood', value: 0, dealbreakerTriggered: true },
  { userId: 'buyer-2', criterionId: 'location', value: 3, dealbreakerTriggered: false },
  { userId: 'buyer-2', criterionId: 'condition', value: 9, dealbreakerTriggered: false },
  { userId: 'buyer-2', criterionId: 'flood', value: 0, dealbreakerTriggered: false },
];

test('keeps collaborative results blind until every buyer submits', () => {
  const result = buildDecisionResult(buyers, ['buyer-1'], ratings, criteria);

  assert.equal(result.compositeScore, null);
  assert.equal(result.blind, true);
  assert.equal(result.revealed, false);
  assert.equal(result.hasVeto, false);
  assert.deepEqual(result.raterScores, []);
  assert.deepEqual(result.criterionDivergence, {});
  assert.deepEqual(result.vetoes, []);
});

test('normalizes mixed scales and applies weights to 0-100 scores', () => {
  const result = buildDecisionResult(buyers, ['buyer-1', 'buyer-2'], [
    ...ratings,
    { userId: 'former-buyer', criterionId: 'location', value: 1, dealbreakerTriggered: true },
  ], criteria);

  assert.equal(result.compositeScore, 77.5);
  assert.equal(result.divergence, 10);
  assert.equal(result.maxDivergence, 20);
  assert.deepEqual(result.criterionDivergence, { location: 40, condition: 40 });
  assert.equal(result.hasVeto, true);
  assert.deepEqual(result.raterScores, [
    { userId: 'buyer-1', userName: 'Alex', role: 'primary_buyer', score: 87.5 },
    { userId: 'buyer-2', userName: 'Sam', role: 'co_buyer', score: 67.5 },
  ]);
});

test('only dealbreaker criteria can trigger a veto', () => {
  const result = buildDecisionResult(buyers, ['buyer-1', 'buyer-2'], ratings, criteria);

  assert.deepEqual(result.vetoes, [{
    criterionId: 'flood',
    label: 'Flood zone',
    userId: 'buyer-1',
    userName: 'Alex',
  }]);
});