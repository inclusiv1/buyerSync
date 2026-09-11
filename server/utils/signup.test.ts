import assert from 'node:assert/strict';
import test from 'node:test';
import { isUniqueSignupConflict, parseBuyerSignupInput, SignupInputError } from './signup';

test('normalizes valid buyer signup details', () => {
  assert.deepEqual(parseBuyerSignupInput({
    name: '  Jamie Buyer  ',
    email: '  JAMIE@Example.COM ',
    password: 'password123',
  }), {
    name: 'Jamie Buyer',
    email: 'jamie@example.com',
    password: 'password123',
  });
});

test('rejects invalid buyer signup details', () => {
  for (const payload of [
    null,
    { name: 'J', email: 'jamie@example.com', password: 'password123' },
    { name: 'Jamie', email: 'not-an-email', password: 'password123' },
    { name: 'Jamie', email: 'jamie@example.com', password: 'short' },
  ]) {
    assert.throws(() => parseBuyerSignupInput(payload), SignupInputError);
  }
});

test('recognizes Prisma unique conflicts without treating other errors as duplicates', () => {
  assert.equal(isUniqueSignupConflict({ code: 'P2002' }), true);
  assert.equal(isUniqueSignupConflict(new Error('database unavailable')), false);
});