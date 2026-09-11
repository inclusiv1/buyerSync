import { citedClaimsOnly, normalizeCitations } from './citations';
import { deterministicFallback, type AssistantToolExecutor } from './fallback';
import { ASSISTANT_SYSTEM_INSTRUCTION, enforceResponsePolicy, untrustedData } from './policy';
import type { AssistantMessageInput, AssistantProvider, AssistantTurnResult } from './types';

export type OrchestratorOptions = {
  maxToolCalls: number;
  maxWrites: number;
  maxOutputTokens: number;
};

const defaults: OrchestratorOptions = {
  maxToolCalls: Number(process.env.ASSISTANT_MAX_TOOL_CALLS || 6),
  maxWrites: Number(process.env.ASSISTANT_MAX_WRITES_PER_TURN || 2),
  maxOutputTokens: Number(process.env.ASSISTANT_MAX_OUTPUT_TOKENS || 1_024),
};

export async function runAssistantTurn(
  content: string,
  history: AssistantMessageInput[],
  provider: AssistantProvider | null,
  executor: AssistantToolExecutor,
  options: Partial<OrchestratorOptions> = {},
  signal?: AbortSignal,
): Promise<AssistantTurnResult> {
  const limits = { ...defaults, ...options };
  if (!provider) return deterministicFallback(content, executor, limits.maxWrites > 0);
  const messages = [...history.slice(-20), { role: 'user' as const, content: untrustedData(content, 12_000) }];
  const summaries: AssistantTurnResult['toolSummaries'] = [];
  const citations = [];
  let calls = 0;
  let writes = 0;
  let lastResponse;
  try {
    while (calls <= limits.maxToolCalls) {
      lastResponse = await provider.generate({
        systemInstruction: ASSISTANT_SYSTEM_INSTRUCTION,
        messages,
        tools: executor.definitions(),
        maxOutputTokens: limits.maxOutputTokens,
      }, signal);
      if (!lastResponse.toolCalls.length) break;
      for (const call of lastResponse.toolCalls) {
        if (++calls > limits.maxToolCalls) throw new Error('Assistant tool-call limit reached');
        const definition = executor.definitions().find(tool => tool.name === call.name);
        if (!definition) throw new Error(`Unknown assistant tool: ${call.name}`);
        if (definition.isWrite && ++writes > limits.maxWrites) throw new Error('Assistant automatic-write limit reached');
        try {
          const result = await executor.execute(call.name, call.arguments);
          summaries.push({ toolName: call.name, status: 'succeeded', isWrite: definition.isWrite, summary: result.summary });
          citations.push(...normalizeCitations(result.citations));
          messages.push({ role: 'tool', content: `${call.name}: ${untrustedData(result.data)}` });
        } catch (error: unknown) {
          const summary = error instanceof Error ? error.message : 'Tool failed';
          summaries.push({ toolName: call.name, status: 'failed', isWrite: definition.isWrite, summary });
          messages.push({ role: 'tool', content: `${call.name} failed: ${untrustedData(summary)}` });
        }
      }
    }
    const safeContent = enforceResponsePolicy(lastResponse?.content || 'I completed the available search actions.');
    return {
      content: citedClaimsOnly(safeContent, citations),
      citations,
      toolSummaries: summaries,
      reducedCapability: false,
      provider: lastResponse?.provider,
      model: lastResponse?.model,
      inputTokens: lastResponse?.inputTokens,
      outputTokens: lastResponse?.outputTokens,
    };
  } catch {
    return deterministicFallback(content, executor, writes < limits.maxWrites);
  }
}