import { normalizeCitations } from './citations';
import type { AssistantToolDefinition, AssistantTurnResult } from './types';

export interface AssistantToolExecutor {
  definitions(): AssistantToolDefinition[];
  execute(name: string, input: unknown): Promise<{ data: unknown; summary: string; citations?: unknown[] }>;
}

export function parseCriteria(content: string): Record<string, number> {
  const patch: Record<string, number> = {};
  const money = content.match(/(?:under|below|max(?:imum)?|up to)\s*\$?([\d,.]+)\s*(k|m)?/i);
  if (money) {
    const multiplier = money[2]?.toLowerCase() === 'm' ? 1_000_000 : money[2]?.toLowerCase() === 'k' ? 1_000 : 1;
    patch.maxPrice = Number(money[1].replace(/,/g, '')) * multiplier;
  }
  const beds = content.match(/(\d+)\+?\s*(?:bed|bedroom)/i);
  const baths = content.match(/(\d+(?:\.\d+)?)\+?\s*(?:bath|bathroom)/i);
  const sqft = content.match(/(?:at least|min(?:imum)?)\s*([\d,]+)\s*(?:sq\.?\s*ft|square feet)/i);
  if (beds) patch.minBeds = Number(beds[1]);
  if (baths) patch.minBaths = Number(baths[1]);
  if (sqft) patch.minSqft = Number(sqft[1].replace(/,/g, ''));
  return patch;
}

export async function deterministicFallback(
  content: string,
  executor: AssistantToolExecutor,
  allowWrite = true,
): Promise<AssistantTurnResult> {
  const summaries: AssistantTurnResult['toolSummaries'] = [];
  const citations = [];
  const patch = parseCriteria(content);
  if (allowWrite && Object.keys(patch).length) {
    try {
      const result = await executor.execute('update_search_criteria', patch);
      summaries.push({ toolName: 'update_search_criteria', status: 'succeeded', isWrite: true, summary: result.summary });
    } catch (error: unknown) {
      summaries.push({ toolName: 'update_search_criteria', status: 'failed', isWrite: true, summary: error instanceof Error ? error.message : 'Criteria update failed' });
    }
  }
  const sections: string[] = [];
  for (const [name, label] of [
    ['get_search_profile', 'Current criteria'],
    ['list_checklist_requirements', 'Checklist requirements'],
    ['rank_saved_properties', 'Matching saved homes'],
    ['get_public_market_context', 'Public source context'],
  ] as const) {
    try {
      const result = await executor.execute(name, {});
      summaries.push({ toolName: name, status: 'succeeded', isWrite: false, summary: result.summary });
      sections.push(`${label}: ${JSON.stringify(result.data).slice(0, 4_000)}`);
      citations.push(...normalizeCitations(result.citations));
    } catch {
      sections.push(`${label}: unavailable`);
    }
  }
  return {
    content: `Reduced capability: Gemini is unavailable, so this response uses deterministic filtering without generated interpretation.\n\n${sections.join('\n\n')}`,
    citations,
    toolSummaries: summaries,
    reducedCapability: true,
  };
}