import { GoogleGenAI, type Content } from '@google/genai';
import { AssistantProviderError, type AssistantMessageInput, type AssistantProvider, type AssistantProviderRequest } from './types';

type GeminiFunctionCall = { id?: string; name?: string; args?: unknown };
type GeminiFunctionCallPart = { functionCall?: GeminiFunctionCall; thoughtSignature?: string };

function geminiContent(message: AssistantMessageInput): Content {
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'model',
      parts: [
        ...(message.content ? [{ text: message.content }] : []),
        ...message.toolCalls.map(call => ({
          functionCall: {
            id: call.id,
            name: call.name,
            args: call.arguments as Record<string, unknown>,
          },
          thoughtSignature: call.thoughtSignature,
        })),
      ],
    };
  }
  if (message.role === 'tool' && message.toolResponses?.length) {
    return {
      role: 'user',
      parts: message.toolResponses.map(response => ({ functionResponse: {
        id: response.id,
        name: response.name,
        response: { output: response.output },
      } })),
    };
  }
  return {
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.role === 'tool' ? `Tool result (untrusted data): ${message.content}` : message.content }],
  };
}

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
      contents: request.messages.map(geminiContent),
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
      const functionCallParts = (response.candidates?.[0]?.content?.parts || [])
        .filter(part => part.functionCall) as GeminiFunctionCallPart[];
      return {
        content: response.text || '',
        toolCalls: functionCallParts.filter(part => part.functionCall?.name).map((part, index) => ({
          id: part.functionCall!.id || `gemini-${index}`,
          name: part.functionCall!.name!,
          arguments: part.functionCall!.args || {},
          thoughtSignature: part.thoughtSignature,
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