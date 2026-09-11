import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { createMcpToolRegistry, type McpExecutionContext, type ToolName } from '../mcp';
import { assistantTurnRequestSchema, messagePaginationSchema, threadCreateSchema, threadPaginationSchema } from '../services/assistant/contracts';
import { resolveAcceptedMembership } from '../services/assistant/domain';
import { type AssistantToolExecutor } from '../services/assistant/fallback';
import { createGeminiProvider } from '../services/assistant/gemini';
import { runAssistantTurn } from '../services/assistant/orchestrator';
import type { AssistantProvider, AssistantToolDefinition } from '../services/assistant/types';

type AuthenticatedRequest = Request & { userId: string };
type RateEntry = { count: number; resetAt: number };
const rateEntries = new Map<string, RateEntry>();

function jsonValue(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function messageResponse(message: {
  id: string; role: string; content: string; status: string; citations: string; toolSummaries: string;
  provider: string | null; model: string | null; createdAt: Date;
}) {
  return { ...message, citations: jsonValue(message.citations), toolSummaries: jsonValue(message.toolSummaries) };
}

function enforceRateLimit(userId: string, groupId: string): void {
  const now = Date.now();
  const key = `${userId}:${groupId}`;
  const limit = Math.max(1, Number(process.env.ASSISTANT_RATE_LIMIT_PER_MINUTE || 10));
  const current = rateEntries.get(key);
  if (!current || current.resetAt <= now) {
    rateEntries.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= limit) throw Object.assign(new Error('Assistant rate limit exceeded'), { status: 429 });
  current.count += 1;
}

export async function findAuthorizedThread(db: PrismaClient, userId: string, threadId: string) {
  const thread = await db.assistantThread.findUnique({ where: { id: threadId } });
  if (!thread) throw Object.assign(new Error('Assistant thread not found'), { status: 404 });
  const membership = await resolveAcceptedMembership(db, userId, thread.groupId);
  return { thread, membership };
}

function requestedGroupId(req: Request): string | undefined {
  const value = req.query.searchId;
  return typeof value === 'string' && value.length <= 200 ? value : undefined;
}

function threadQuery(req: Request) {
  const query = { ...req.query };
  delete query.searchId;
  return query;
}

function requestError(res: Response, error: unknown) {
  const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
  const message = error instanceof z.ZodError ? 'Invalid assistant request' : error instanceof Error ? error.message : 'Assistant request failed';
  return res.status(status).json({ error: message });
}

export function createAssistantRouter(db: PrismaClient, provider: AssistantProvider | null = createGeminiProvider()) {
  const router = Router();
  const registry = createMcpToolRegistry({ writeBudget: Number(process.env.ASSISTANT_MAX_WRITES_PER_TURN || 2) });

  router.get('/threads', async (rawReq, res) => {
    const req = rawReq as AuthenticatedRequest;
    try {
      const query = threadPaginationSchema.parse(threadQuery(req));
      const membership = await resolveAcceptedMembership(db, req.userId, requestedGroupId(req));
      const threads = await db.assistantThread.findMany({
        where: { groupId: membership.groupId, ...(query.status ? { status: query.status } : {}) },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      const hasMore = threads.length > query.limit;
      const items = threads.slice(0, query.limit);
      res.json({ items, nextCursor: hasMore ? items.at(-1)?.id : null });
    } catch (error) { requestError(res, error); }
  });

  router.post('/threads', async (rawReq, res) => {
    const req = rawReq as AuthenticatedRequest;
    try {
      const input = threadCreateSchema.parse(req.body);
      const membership = await resolveAcceptedMembership(db, req.userId, requestedGroupId(req));
      const thread = await db.assistantThread.create({ data: {
        groupId: membership.groupId, createdById: req.userId, title: input.title,
      } });
      res.status(201).json(thread);
    } catch (error) { requestError(res, error); }
  });

  router.get('/threads/:threadId/messages', async (rawReq, res) => {
    const req = rawReq as AuthenticatedRequest;
    try {
      const query = messagePaginationSchema.parse(req.query);
      await findAuthorizedThread(db, req.userId, req.params.threadId);
      const messages = await db.assistantMessage.findMany({
        where: { threadId: req.params.threadId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      const hasMore = messages.length > query.limit;
      const items = messages.slice(0, query.limit);
      res.json({ items: items.map(messageResponse).reverse(), nextCursor: hasMore ? items.at(-1)?.id : null });
    } catch (error) { requestError(res, error); }
  });

  router.post('/threads/:threadId/messages', async (rawReq, res) => {
    const req = rawReq as AuthenticatedRequest;
    try {
      const input = assistantTurnRequestSchema.parse(req.body);
      const { thread, membership } = await findAuthorizedThread(db, req.userId, req.params.threadId);
      const existing = await db.assistantMessage.findFirst({
        where: { threadId: thread.id, requestKey: input.idempotencyKey, role: 'user' },
      });
      if (existing) {
        const assistant = await db.assistantMessage.findFirst({
          where: { threadId: thread.id, createdAt: { gte: existing.createdAt }, role: 'assistant' }, orderBy: { createdAt: 'asc' },
        });
        return res.json({ userMessage: messageResponse(existing), assistantMessage: assistant ? messageResponse(assistant) : null, idempotent: true });
      }
      enforceRateLimit(req.userId, membership.groupId);
      const historyRows = await db.assistantMessage.findMany({
        where: { threadId: thread.id, role: { in: ['user', 'assistant'] } }, orderBy: { createdAt: 'desc' }, take: 20,
      });
      const userMessage = await db.assistantMessage.create({ data: {
        groupId: thread.groupId, threadId: thread.id, authorId: req.userId, requestKey: input.idempotencyKey,
        role: 'user', content: input.content,
      } });
      const turnId = randomUUID();
      const context: McpExecutionContext = {
        db, userId: req.userId, groupId: thread.groupId, threadId: thread.id, messageId: userMessage.id, turnId,
      };
      const executor: AssistantToolExecutor = {
        definitions: () => registry.definitions.map(definition => ({
          name: definition.name,
          description: definition.description,
          inputSchema: z.toJSONSchema(definition.inputSchema) as Record<string, unknown>,
          isWrite: definition.isWrite,
        } satisfies AssistantToolDefinition)),
        execute: async (name, toolInput) => {
          const definition = registry.definitions.find(item => item.name === name);
          if (!definition) throw new Error(`Unknown assistant tool: ${name}`);
          const result = await registry.execute(name as ToolName, toolInput, context);
          const direction = definition.isWrite ? 'completed; review or edit it in the standard dashboard controls' : 'completed';
          return { data: result.data, citations: result.citations, summary: `${name} ${direction}` };
        },
      };
      const controller = new AbortController();
      res.once('close', () => {
        if (!res.writableFinished) controller.abort();
      });
      const result = await runAssistantTurn(
        input.content,
        historyRows.reverse().map(message => ({ role: message.role as 'user' | 'assistant', content: message.content })),
        provider,
        executor,
        {},
        controller.signal,
      );
      const assistantMessage = await db.assistantMessage.create({ data: {
        groupId: thread.groupId,
        threadId: thread.id,
        role: 'assistant',
        content: result.content,
        citations: JSON.stringify(result.citations),
        toolSummaries: JSON.stringify(result.toolSummaries),
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0) || null,
      } });
      await db.assistantThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date() } });
      res.status(201).json({ userMessage: messageResponse(userMessage), assistantMessage: messageResponse(assistantMessage), reducedCapability: result.reducedCapability });
    } catch (error) { requestError(res, error); }
  });

  return router;
}