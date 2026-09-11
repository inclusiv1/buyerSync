import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deterministicFallback, parseSearchLocation, type AssistantToolExecutor } from './fallback';

test('parses a city/state or ZIP location mentioned in the message', () => {
  assert.equal(parseSearchLocation('search for homes in Smyrna, GA'), 'Smyrna, GA');
  assert.equal(parseSearchLocation('find listings near 30080'), '30080');
  assert.equal(parseSearchLocation('find me a home'), undefined);
});

test('falls back to the saved search-criteria location when the message has none', async () => {
  const calls: Array<{ name: string; input: unknown }> = [];
  const executor: AssistantToolExecutor = {
    definitions: () => [],
    execute: async (name, input) => {
      calls.push({ name, input });
      if (name === 'get_search_profile') {
        return { data: { criteria: { location: 'Smyrna, GA' } }, summary: 'ok' };
      }
      if (name === 'search_listings') {
        return { data: { listings: [] }, summary: 'search_listings completed' };
      }
      return { data: {}, summary: 'ok' };
    },
  };

  await deterministicFallback('find me homes with 3 bedrooms', executor, false);

  const searchCall = calls.find((call) => call.name === 'search_listings');
  assert.ok(searchCall, 'search_listings should have been called using the saved location');
  assert.equal((searchCall!.input as { location: string }).location, 'Smyrna, GA');
});

test('prefers a location explicitly mentioned in the message over saved criteria', async () => {
  const calls: Array<{ name: string; input: unknown }> = [];
  const executor: AssistantToolExecutor = {
    definitions: () => [],
    execute: async (name, input) => {
      calls.push({ name, input });
      if (name === 'get_search_profile') {
        return { data: { criteria: { location: 'Smyrna, GA' } }, summary: 'ok' };
      }
      if (name === 'search_listings') {
        return { data: { listings: [] }, summary: 'search_listings completed' };
      }
      return { data: {}, summary: 'ok' };
    },
  };

  await deterministicFallback('find me homes in Austin, TX', executor, false);

  const searchCall = calls.find((call) => call.name === 'search_listings');
  assert.equal((searchCall!.input as { location: string }).location, 'Austin, TX');
});
