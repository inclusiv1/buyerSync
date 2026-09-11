import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MCP_TOOL_NAMES, createMcpToolRegistry, toolInputSchemas, type McpExecutionContext } from './index';
import { createMcpServer } from './server';

const membership = { id: 'member-1', groupId: 'group-1', userId: 'user-1', role: 'buyer', status: 'accepted' };

function fakeContext() {
  const runs: any[] = [];
  const db = {
    assistantThread: { findFirst: async () => ({ id: 'thread-1', groupId: 'group-1' }) },
    assistantMessage: { findFirst: async () => ({ id: 'message-1', groupId: 'group-1', threadId: 'thread-1' }) },
    assistantToolRun: {
      findFirst: async ({ where }: any) => runs.find((run) => run.groupId === where.groupId && run.idempotencyKey === where.idempotencyKey) || null,
      count: async ({ where }: any) => runs.filter((run) => run.isWrite && run.idempotencyKey.startsWith(where.idempotencyKey.startsWith)).length,
      create: async ({ data }: any) => { const run = { id: `run-${runs.length + 1}`, ...data }; runs.push(run); return run; },
      update: async ({ where, data }: any) => Object.assign(runs.find((run) => run.id === where.id), data),
    },
    groupMembership: { findFirst: async () => membership },
    searchCriteria: {
      findUnique: async () => ({ groupId: 'group-1', maxPrice: 500_000 }),
      upsert: async ({ update }: any) => ({ groupId: 'group-1', ...update }),
    },
  } as unknown as PrismaClient;
  const context: McpExecutionContext = {
    db, userId: 'user-1', groupId: 'group-1', threadId: 'thread-1', messageId: 'message-1', turnId: 'turn-1',
  };
  return { context, runs };
}

test('exposes exactly the required MCP tools', () => {
  assert.deepEqual(MCP_TOOL_NAMES, [
    'get_search_profile', 'update_search_criteria', 'list_checklist_requirements', 'search_listings',
    'import_listing', 'rank_saved_properties', 'get_public_market_context', 'get_visible_property_decision',
  ]);
});

test('registers the same exact registry through the official MCP SDK', async () => {
  const { context } = fakeContext();
  const registry = createMcpToolRegistry();
  const server = createMcpServer(registry, () => context);
  const client = new Client({ name: 'registry-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const result = await client.listTools();
    assert.deepEqual(result.tools.map((tool) => tool.name), MCP_TOOL_NAMES);
  } finally {
    await client.close();
    await server.close();
  }
});

test('all schemas reject identity and unknown fields and enforce bounds', () => {
  for (const schema of Object.values(toolInputSchemas)) {
    assert.equal(schema.safeParse({ userId: 'other-user' }).success, false);
    assert.equal(schema.safeParse({ groupId: 'other-group' }).success, false);
  }
  assert.equal(toolInputSchemas.search_listings.safeParse({ location: 'Austin, TX', limit: 26 }).success, false);
  assert.equal(toolInputSchemas.import_listing.safeParse({ url: 'file:///etc/passwd' }).success, false);
  assert.equal(toolInputSchemas.rank_saved_properties.safeParse({ limit: 101 }).success, false);
});

test('audits execution safely and makes retries idempotent within a turn', async () => {
  const { context, runs } = fakeContext();
  const registry = createMcpToolRegistry();
  const first = await registry.execute('update_search_criteria', { maxPrice: 450_000 }, context);
  const second = await registry.execute('update_search_criteria', { maxPrice: 450_000 }, context);

  assert.equal(first.toolRunId, 'run-1');
  assert.equal(second.toolRunId, 'run-1');
  assert.equal(second.idempotent, true);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, 'succeeded');
  assert.deepEqual(JSON.parse(runs[0].inputSummary), { fields: ['maxPrice'] });
});

test('enforces the per-turn write budget', async () => {
  const { context } = fakeContext();
  const registry = createMcpToolRegistry({ writeBudget: 1 });
  await registry.execute('update_search_criteria', { maxPrice: 450_000 }, context);
  await assert.rejects(
    registry.execute('update_search_criteria', { minPrice: 200_000 }, context),
    /write budget exceeded/,
  );
});

test('serializes concurrent writes before enforcing the budget', async () => {
  const { context, runs } = fakeContext();
  const registry = createMcpToolRegistry({ writeBudget: 1 });
  const results = await Promise.allSettled([
    registry.execute('update_search_criteria', { maxPrice: 450_000 }, context),
    registry.execute('update_search_criteria', { minPrice: 200_000 }, context),
  ]);

  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'rejected']);
  assert.equal(runs.length, 1);
});

test('bounds injected listing results and normalizes market citations', async () => {
  const { context } = fakeContext();
  const registry = createMcpToolRegistry({
    searchListings: async () => [{ address: '1 Main St' }, { address: '2 Main St' }],
    getMarketRates: async () => [{ rateType: '30yr', rate: 6.5, date: '2026-09-03', source: 'Freddie Mac PMMS via FRED' }],
  });
  const listings = await registry.execute('search_listings', { location: 'Austin, TX', limit: 1 }, context);
  const market = await registry.execute('get_public_market_context', {}, context);

  assert.deepEqual(listings.data, { listings: [{ address: '1 Main St' }] });
  assert.equal(market.citations?.length, 1);
  assert.match(market.citations?.[0].url || '', /^https:\/\/fred\.stlouisfed\.org\//);
});
