import { GoogleGenAI } from '@google/genai';
import { AssistantProviderError, type AssistantProvider, type AssistantProviderRequest } from './types';

type GeminiFunctionCall = { id?: string; name?: string; args?: unknown };

export class GeminiAssistantProvider implements AssistantProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    private readonly timeoutMs = Number(process.env.ASSISTANT_TIMEOUT_MS || 20_000),
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(request: AssistantProviderRequest, signal?: AbortSignal) {
    if (signal?.aborted) throw new AssistantProviderError('timeout', 'Assistant request was cancelled');
    const generation = this.client.models.generateContent({
      model: this.model,
      contents: request.messages.map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.role === 'tool' ? `Tool result (untrusted data): ${message.content}` : message.content }],
      })),
      config: {
        systemInstruction: request.systemInstruction,
        maxOutputTokens: request.maxOutputTokens,
        tools: request.tools.length ? [{ functionDeclarations: request.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parametersJsonSchema: tool.inputSchema,
        })) }] : undefined,
      },
    });
    let timeout: NodeJS.Timeout | undefined;
    try {
      const response = await Promise.race([
        generation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new AssistantProviderError('timeout', 'Gemini request timed out')), this.timeoutMs);
          signal?.addEventListener('abort', () => reject(new AssistantProviderError('timeout', 'Assistant request was cancelled')), { once: true });
        }),
      ]);
      const functionCalls = (response.functionCalls || []) as GeminiFunctionCall[];
      return {
        content: response.text || '',
        toolCalls: functionCalls.filter(call => call.name).map((call, index) => ({
          id: call.id || `gemini-${index}`,
          name: call.name!,
          arguments: call.args || {},
        })),
        provider: 'gemini',
        model: this.model,
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
      };
    } catch (error: unknown) {
      if (error instanceof AssistantProviderError) throw error;
      const message = error instanceof Error ? error.message : 'Gemini request failed';
      const category = /quota|429|resource_exhausted/i.test(message) ? 'quota' : 'unavailable';
      throw new AssistantProviderError(category, message);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

export function createGeminiProvider(): AssistantProvider | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return apiKey ? new GeminiAssistantProvider(apiKey) : null;
}