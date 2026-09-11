import { citationSchema, type Citation } from './contracts';

export function normalizeCitations(value: unknown, retrievedAt = new Date()): Citation[] {
  if (!Array.isArray(value)) return [];
  const normalized: Citation[] = [];
  const seen = new Set<string>();
  for (const item of value.slice(0, 25)) {
    const candidate = item && typeof item === 'object' ? { ...item as Record<string, unknown> } : null;
    if (!candidate) continue;
    candidate.retrievedAt ||= retrievedAt.toISOString();
    const parsed = citationSchema.safeParse(candidate);
    if (!parsed.success || seen.has(parsed.data.url)) continue;
    seen.add(parsed.data.url);
    normalized.push(parsed.data);
  }
  return normalized;
}

export function citedClaimsOnly(content: string, citations: Citation[]): string {
  const mentionsMarketFact = /\b(market|median|average|rate|trend|comparable|appreciat|inventory)\b/i.test(content);
  if (!mentionsMarketFact || citations.length > 0) return content;
  return 'I cannot support that market claim with an approved, dated source, so I have omitted it.';
}