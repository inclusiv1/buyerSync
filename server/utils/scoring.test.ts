import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateScore } from './scoring.ts';

test('scores configured property facts and explains requirement gaps', () => {
  const result = calculateScore([], [], [], {
    maxPrice: 500_000,
    minBeds: 4,
    minBaths: 2,
    minSqft: 2_000,
    yearBuiltMin: 1990,
    hoaMax: 200,
  }, {
    price: 480_000,
    beds: 3,
    baths: 2.5,
    sqft: 2_200,
    yearBuilt: 1980,
    hoa: 250,
  });

  assert.equal(result.mustHaveGaps, 3);
  assert.equal(result.assessments.length, 6);
  assert.deepEqual(result.assessments.filter((assessment) => !assessment.met).map((assessment) => assessment.key), [
    'minBeds',
    'yearBuiltMin',
    'hoaMax',
  ]);
  assert.match(result.assessments.find((assessment) => assessment.key === 'minBeds')!.message, /3 bedrooms.*4 required/);
  assert.ok(result.score > 0 && result.score < 100);
});

test('uses saved checklist weights together with automatic property criteria', () => {
  const result = calculateScore(
    [
      { id: 'light', label: 'Natural light', category: 'nice-to-have' },
      { id: 'garage', label: 'Two-car garage', category: 'must-have' },
    ],
    [
      { checklistItemId: 'light', weight: 8 },
      { checklistItemId: 'garage', weight: 2 },
    ],
    [
      { checklistItemId: 'light', isMet: 'yes' },
      { checklistItemId: 'garage', isMet: 'no' },
    ],
    { minBeds: 4 },
    { beds: 4 },
  );

  assert.equal(result.mustHaveGaps, 1);
  assert.equal(result.score, 90);
});

test('flags missing property information instead of treating it as a pass', () => {
  const result = calculateScore([], [], [], { minBeds: 4 }, { beds: null });

  assert.equal(result.mustHaveGaps, 1);
  assert.equal(result.score, 0);
  assert.equal(result.assessments[0].status, 'unknown');
});

test('does not score empty nullable search criteria', () => {
  const result = calculateScore([], [], [], { minBeds: null, maxPrice: null }, { beds: 3, price: 400_000 });

  assert.equal(result.hasCriteria, false);
  assert.equal(result.mustHaveGaps, 0);
  assert.deepEqual(result.assessments, []);
});

test('scores upper bounds for beds, square footage, lot size, and listing age', () => {
  const result = calculateScore([], [], [], {
    maxBeds: 4,
    maxSqft: 2_000,
    lotSizeMax: 1,
    daysOld: 30,
  }, {
    beds: 5,
    sqft: 2_200,
    lotSize: 2,
    daysOld: 45,
  });

  assert.equal(result.mustHaveGaps, 4);
  assert.deepEqual(result.assessments.map((assessment) => assessment.key), [
    'maxBeds',
    'maxSqft',
    'lotSizeMax',
    'daysOld',
  ]);
  assert.ok(result.assessments.every((assessment) => assessment.status === 'gap'));
});