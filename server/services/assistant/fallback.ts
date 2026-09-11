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

export function parseSearchLocation(content: string): string | undefined {
  const cityState = content.match(/(?:\bin|\bnear|\baround)\s+([A-Za-z][A-Za-z .'-]{1,80},\s*[A-Za-z]{2})\b/i);
  if (cityState) return cityState[1].trim();
  const zip = content.match(/(?:\bin|\bnear|\baround)\s+(\d{5}(?:-\d{4})?)\b/i);
  return zip?.[1];
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
  let savedCriteria: Record<string, unknown> = {};
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
      if (name === 'get_search_profile') {
        const criteria = (result.data as { criteria?: Record<string, unknown> } | undefined)?.criteria;
        if (criteria) savedCriteria = criteria;
      }
    } catch {
      sections.push(`${label}: unavailable`);
    }
  }
  const location = parseSearchLocation(content) || (typeof savedCriteria.location === 'string' ? savedCriteria.location : undefined);
  if (location) {
    try {
      const result = await executor.execute('search_listings', {
        location,
        limit: 50,
        ...(typeof savedCriteria.radius === 'number' && { radius: savedCriteria.radius }),
        ...(typeof savedCriteria.minPrice === 'number' && { minPrice: savedCriteria.minPrice }),
        ...(typeof savedCriteria.minSqft === 'number' && { minSqft: savedCriteria.minSqft }),
        ...(typeof savedCriteria.maxSqft === 'number' && { maxSqft: savedCriteria.maxSqft }),
        ...(typeof savedCriteria.lotSizeMin === 'number' && { lotSizeMin: savedCriteria.lotSizeMin }),
        ...(typeof savedCriteria.lotSizeMax === 'number' && { lotSizeMax: savedCriteria.lotSizeMax }),
        ...(typeof savedCriteria.yearBuiltMin === 'number' && { yearBuiltMin: savedCriteria.yearBuiltMin }),
        ...(typeof savedCriteria.yearBuiltMax === 'number' && { yearBuiltMax: savedCriteria.yearBuiltMax }),
        ...(typeof savedCriteria.daysOld === 'number' && { daysOld: savedCriteria.daysOld }),
        ...(typeof savedCriteria.status === 'string' && { status: savedCriteria.status }),
        ...(patch.maxPrice !== undefined && { maxPrice: patch.maxPrice }),
        ...(patch.minBeds !== undefined && { minBeds: patch.minBeds }),
        ...(patch.minBaths !== undefined && { minBaths: patch.minBaths }),
      });
      summaries.push({ toolName: 'search_listings', status: 'succeeded', isWrite: false, summary: result.summary });
      sections.push(`Live matching listings: ${JSON.stringify(result.data).slice(0, 12_000)}`);
    } catch {
      sections.push('Live matching listings: unavailable');
    }
  }
  return {
    content: `Reduced capability: AI-assisted interpretation could not complete, so this response uses deterministic filtering.\n\n${sections.join('\n\n')}`,
    citations,
    toolSummaries: summaries,
    reducedCapability: true,
  };
}