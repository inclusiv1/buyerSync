import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  getSearchProfile,
  getVisiblePropertyDecision,
  importListingForGroup,
  listChecklistRequirements,
  rankSavedProperties,
  resolveAcceptedMembership,
  updateSearchProfile,
} from '../services/assistant/domain';
import { citationSchema } from '../services/assistant/contracts';
import { getLatestRates } from '../services/mortgage';
import { normalizeProviderPayload } from '../services/listingImport';
import { toolInputSchemas, type ToolName } from './schemas';

export const MCP_TOOL_NAMES = Object.freeze(Object.keys(toolInputSchemas) as ToolName[]);

export type McpExecutionContext = {
  db: PrismaClient;
  userId: string;
  groupId: string;
  threadId: string;
  messageId?: string;
  turnId: string;
};

type SearchInput = z.output<(typeof toolInputSchemas)['search_listings']>;
type RateSnapshot = { rateType: string; rate: number; date: Date | string; source?: string | null };

export type McpRegistryOptions = {
  writeBudget?: number;
  searchListings?: (input: SearchInput) => Promise<unknown[]>;
  getMarketRates?: () => Promise<RateSnapshot[]>;
};

export type ToolExecutionResult = {
  toolRunId: string;
  data: unknown;
  citations?: z.output<typeof citationSchema>[];
  idempotent?: boolean;
};

type ToolSpec = {
  description: string;
  isWrite: boolean;
  execute: (input: any, context: McpExecutionContext) => Promise<{ data: unknown; citations?: z.output<typeof citationSchema>[] }>;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function idempotencyKey(turnId: string, toolName: ToolName, input: unknown): string {
  const digest = createHash('sha256').update(JSON.stringify(stableValue(input))).digest('hex').slice(0, 24);
  return `mcp:${turnId.slice(0, 80)}:${toolName}:${digest}`;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Tool execution failed';
  return message.replace(/https?:\/\/\S+/gi, '[url]').replace(/[\w.+-]+@[\w.-]+/g, '[email]').slice(0, 300);
}

function category(error: unknown): string {
  if (error instanceof z.ZodError) return 'validation';
  const status = (error as { status?: unknown })?.status;
  if (status === 403) return 'authorization';
  if (status === 404) return 'not_found';
  return 'execution';
}

function summarizeInput(input: Record<string, unknown>): string {
  return JSON.stringify({ fields: Object.keys(input).sort(), itemCount: Array.isArray(input.items) ? input.items.length : undefined });
}

function summarizeOutput(data: unknown): string {
  if (Array.isArray(data)) return JSON.stringify({ kind: 'array', count: data.length });
  if (data && typeof data === 'object') return JSON.stringify({ kind: 'object', fields: Object.keys(data as object).sort() });
  return JSON.stringify({ kind: typeof data });
}

async function defaultSearchListings(input: SearchInput): Promise<unknown[]> {
  const baseUrl = process.env.HOMEHARVEST_SERVICE_URL;
  if (!baseUrl) throw new Error('Listing search service is not configured');
  const serviceUrl = new URL(process.env.HOMEHARVEST_SEARCH_PATH || '/search', baseUrl);
  if (!['http:', 'https:'].includes(serviceUrl.protocol)) throw new Error('Listing search service must use HTTP or HTTPS');
  const response = await fetch(serviceUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      location: input.location,
      listing_type: 'for_sale',
      limit: input.limit,
      min_price: input.minPrice,
      max_price: input.maxPrice,
      min_beds: input.minBeds,
      min_baths: input.minBaths,
      property_type: input.propertyType,
    }),
    signal: AbortSignal.timeout(Number(process.env.HOMEHARVEST_TIMEOUT_MS || 30_000)),
  });
  if (!response.ok) throw new Error(`Listing search service returned ${response.status}`);
  const payload = await response.json() as unknown;
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const results = Array.isArray(payload) ? payload : (record.data ?? record.results ?? record.listings);
  if (!Array.isArray(results)) throw new Error('Listing search service returned an invalid response');
  return results.slice(0, input.limit).map((listing) => normalizeProviderPayload(listing));
}

function normalizedMarketContext(rates: RateSnapshot[]) {
  const retrievedAt = new Date().toISOString();
  const normalizedRates = rates.slice(0, 10).map((rate) => ({
    rateType: rate.rateType,
    rate: rate.rate,
    observationDate: new Date(rate.date).toISOString().slice(0, 10),
    source: rate.source || 'Freddie Mac PMMS via FRED',
  }));
  const citations = normalizedRates.map((rate) => citationSchema.parse({
    sourceName: rate.source,
    title: `${rate.rateType} mortgage rate`,
    url: `https://fred.stlouisfed.org/series/${rate.rateType === '15yr' ? 'MORTGAGE15US' : 'MORTGAGE30US'}`,
    observationDate: rate.observationDate,
    retrievedAt,
    claim: `${rate.rateType} rate: ${rate.rate}%`,
    uncertainty: 'low',
  }));
  return { data: { rates: normalizedRates, retrievedAt }, citations };
}

export function createMcpToolRegistry(options: McpRegistryOptions = {}) {
  const searchListings = options.searchListings || defaultSearchListings;
  const getMarketRates = options.getMarketRates || getLatestRates;
  const writeBudget = options.writeBudget ?? 2;
  const turnQueues = new Map<string, Promise<void>>();
  if (!Number.isInteger(writeBudget) || writeBudget < 0 || writeBudget > 20) throw new Error('writeBudget must be an integer from 0 to 20');

  const specs: Record<ToolName, ToolSpec> = {
    get_search_profile: {
      description: 'Get the current group search profile.', isWrite: false,
      execute: async (_, context) => ({ data: await getSearchProfile(context.db, context.userId, context.groupId) }),
    },
    update_search_criteria: {
      description: 'Update the current buyer group search criteria.', isWrite: true,
      execute: async (input, context) => ({ data: await updateSearchProfile(context.db, context.userId, input, context.groupId) }),
    },
    list_checklist_requirements: {
      description: 'List checklist requirements and the current user weights.', isWrite: false,
      execute: async (_, context) => ({ data: await listChecklistRequirements(context.db, context.userId, context.groupId) }),
    },
    search_listings: {
      description: 'Search public for-sale listings using the configured listing search service.', isWrite: false,
      execute: async (input, context) => {
        await resolveAcceptedMembership(context.db, context.userId, context.groupId);
        const listings = await searchListings(input);
        return { data: { listings: listings.slice(0, input.limit) } };
      },
    },
    import_listing: {
      description: 'Import an allowlisted listing URL into the current buyer group.', isWrite: true,
      execute: async (input, context) => ({ data: await importListingForGroup(context.db, context.userId, input.url, context.groupId) }),
    },
    rank_saved_properties: {
      description: 'Rank saved properties using checklist and visible collaborative scores.', isWrite: false,
      execute: async (input, context) => {
        const result = await rankSavedProperties(context.db, context.userId, context.groupId);
        return { data: { ...result, properties: result.properties.slice(0, input.limit) } };
      },
    },
    get_public_market_context: {
      description: 'Get current public mortgage-rate context with citations.', isWrite: false,
      execute: async (_, context) => {
        await resolveAcceptedMembership(context.db, context.userId, context.groupId);
        return normalizedMarketContext(await getMarketRates());
      },
    },
    get_visible_property_decision: {
      description: 'Get only the collaborative property decision currently visible to the user.', isWrite: false,
      execute: async (input, context) => ({ data: await getVisiblePropertyDecision(context.db, context.userId, input.propertyId) }),
    },
  };

  return {
    names: MCP_TOOL_NAMES,
    definitions: MCP_TOOL_NAMES.map((name) => ({
      name,
      description: specs[name].description,
      inputSchema: toolInputSchemas[name],
      isWrite: specs[name].isWrite,
    })),
    async execute(name: ToolName, rawInput: unknown, context: McpExecutionContext): Promise<ToolExecutionResult> {
      const spec = specs[name];
      if (!spec) throw new Error(`Unknown MCP tool: ${String(name)}`);
      const input = toolInputSchemas[name].parse(rawInput ?? {}) as Record<string, unknown>;
      const key = idempotencyKey(context.turnId, name, input);
      const db = context.db;

      const queueKey = `${context.groupId}:${context.userId}:${context.threadId}:${context.turnId}`;
      const previous = turnQueues.get(queueKey) || Promise.resolve();
      let release!: () => void;
      const wait = new Promise<void>((resolve) => { release = resolve; });
      const tail = previous.then(() => wait);
      turnQueues.set(queueKey, tail);
      await previous;

      try {

        const thread = await db.assistantThread.findFirst({ where: { id: context.threadId, groupId: context.groupId } });
        if (!thread) throw new Error('Assistant thread does not belong to the execution group');
        if (context.messageId) {
          const message = await db.assistantMessage.findFirst({ where: { id: context.messageId, threadId: context.threadId, groupId: context.groupId } });
          if (!message) throw new Error('Assistant message does not belong to the execution thread');
        }

        const existing = await db.assistantToolRun.findFirst({ where: { groupId: context.groupId, idempotencyKey: key } });
        if (existing) return { toolRunId: existing.id, data: { status: existing.status }, idempotent: true };
        if (spec.isWrite) {
          const used = await db.assistantToolRun.count({
            where: {
              groupId: context.groupId,
              threadId: context.threadId,
              invokedById: context.userId,
              isWrite: true,
              idempotencyKey: { startsWith: `mcp:${context.turnId.slice(0, 80)}:` },
            },
          });
          if (used >= writeBudget) throw new Error('Per-turn write budget exceeded');
        }

        const run = await db.assistantToolRun.create({ data: {
          groupId: context.groupId,
          threadId: context.threadId,
          messageId: context.messageId,
          invokedById: context.userId,
          toolName: name,
          isWrite: spec.isWrite,
          status: 'running',
          idempotencyKey: key,
          inputSummary: summarizeInput(input),
        } });
        try {
          const result = await spec.execute(input, context);
          await db.assistantToolRun.update({ where: { id: run.id }, data: {
            status: 'succeeded', completedAt: new Date(), outputSummary: summarizeOutput(result.data),
          } });
          return { toolRunId: run.id, ...result };
        } catch (error) {
          await db.assistantToolRun.update({ where: { id: run.id }, data: {
            status: 'failed', completedAt: new Date(), errorCategory: category(error), errorMessage: safeError(error),
          } });
          throw error;
        }
      } finally {
        release();
        if (turnQueues.get(queueKey) === tail) turnQueues.delete(queueKey);
      }
    },
  };
}

export type McpToolRegistry = ReturnType<typeof createMcpToolRegistry>;
