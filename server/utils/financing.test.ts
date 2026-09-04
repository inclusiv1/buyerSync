import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinancingScenarios, creditRateAdjustment, debtToIncome, monthlyPrincipalAndInterest } from './financing.ts';

test('calculates fixed-rate principal and interest payments', () => {
  assert.equal(Math.round(monthlyPrincipalAndInterest(400_000, 6.5, 30)), 2528);
  assert.equal(Math.round(monthlyPrincipalAndInterest(120_000, 0, 10)), 1000);
});

test('makes the illustrative credit adjustment explicit and monotonic', () => {
  assert.equal(creditRateAdjustment(780), 0);
  assert.equal(creditRateAdjustment(700), 0.5);
  assert.equal(creditRateAdjustment(620), 1.5);
});

test('builds conventional, FHA, and VA examples with multiple terms and down payments', () => {
  const scenarios = buildFinancingScenarios(6.7, 6, 760);
  assert.deepEqual(scenarios.map(({ loanType, termYears, downPaymentPercent }) => [loanType, termYears, downPaymentPercent]), [
    ['Conventional', 30, 5],
    ['Conventional', 30, 20],
    ['Conventional', 15, 20],
    ['FHA', 30, 3.5],
    ['VA', 30, 0],
  ]);
  assert.equal(scenarios.at(-1)?.rate, 6.45);
});

test('calculates debt-to-income only when income is provided', () => {
  assert.equal(debtToIncome(2_000, 8_000, 400), 30);
  assert.equal(debtToIncome(2_000, 0, 400), null);
});