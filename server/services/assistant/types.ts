import type { Citation } from './contracts';

export type AssistantMessageInput = {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: AssistantToolCall[];
  toolResponses?: Array<{
    id: string;
    name: string;
    output: string;
  }>;
};

export type AssistantToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  isWrite: boolean;
};

export type AssistantToolCall = {
  id: string;
  name: string;
  arguments: unknown;
  thoughtSignature?: string;
};

export type AssistantProviderRequest = {
  systemInstruction: string;
  messages: AssistantMessageInput[];
  tools: AssistantToolDefinition[];
  maxOutputTokens: number;
};

export type AssistantProviderResponse = {
  content: string;
  toolCalls: AssistantToolCall[];
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
};

export interface AssistantProvider {
  generate(request: AssistantProviderRequest, signal?: AbortSignal): Promise<AssistantProviderResponse>;
}

export type AssistantTurnResult = {
  content: string;
  citations: Citation[];
  toolSummaries: Array<{
    toolName: string;
    status: 'succeeded' | 'failed';
    isWrite: boolean;
    summary: string;
  }>;
  reducedCapability: boolean;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
};

export class AssistantProviderError extends Error {
  constructor(readonly category: 'unavailable' | 'timeout' | 'quota' | 'invalid_response', message: string) {
    super(message);
  }
}