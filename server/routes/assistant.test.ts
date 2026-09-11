import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { findAuthorizedThread } from './assistant';

test('rejects missing assistant threads without querying membership', async () => {
  let membershipQueried = false;
  const db = {
    assistantThread: { findUnique: async () => null },
    groupMembership: { findFirst: async () => { membershipQueried = true; return null; } },
  } as unknown as PrismaClient;
  await assert.rejects(() => findAuthorizedThread(db, 'user-1', 'thread-1'), (error: unknown) => (
    error instanceof Error && (error as Error & { status?: number }).status === 404
  ));
  assert.equal(membershipQueried, false);
});

test('requires accepted membership in the thread group', async () => {
  let membershipWhere: unknown;
  const db = {
    assistantThread: { findUnique: async () => ({ id: 'thread-1', groupId: 'group-2' }) },
    groupMembership: {
      findFirst: async ({ where }: { where: unknown }) => {
        membershipWhere = where;
        return null;
      },
    },
  } as unknown as PrismaClient;
  await assert.rejects(() => findAuthorizedThread(db, 'user-1', 'thread-1'), /accepted group membership/);
  assert.deepEqual(membershipWhere, { userId: 'user-1', groupId: 'group-2', status: 'accepted' });
});