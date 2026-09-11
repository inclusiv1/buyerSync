import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export type AssistantCitation = {
  sourceName: string;
  url: string;
  title?: string;
  observationDate?: string | null;
  retrievedAt: string;
  claim?: string;
  uncertainty?: 'low' | 'medium' | 'high' | 'unknown';
};

export type AssistantToolSummary = {
  toolName: string;
  status: 'succeeded' | 'failed';
  isWrite: boolean;
  summary: string;
};

export type AssistantThread = {
  id: string;
  groupId: string;
  title?: string | null;
  status: 'active' | 'archived';
  lastMessageAt: string;
  createdAt: string;
};

export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  citations: AssistantCitation[];
  toolSummaries: AssistantToolSummary[];
  provider?: string | null;
  model?: string | null;
  createdAt: string;
};

type Page<T> = { items: T[]; nextCursor: string | null };
type SendTurnInput = { threadId: string; content: string; idempotencyKey: string };
type SendTurnResponse = {
  userMessage: AssistantMessage;
  assistantMessage: AssistantMessage | null;
  reducedCapability?: boolean;
  idempotent?: boolean;
};

const searchParams = (searchId?: string, cursor?: string | null) => ({
  ...(searchId ? { searchId } : {}),
  ...(cursor ? { cursor } : {}),
});

export const assistantApi = {
  listThreads: async (searchId?: string, cursor?: string | null): Promise<Page<AssistantThread>> =>
    (await api.get('/assistant/threads', { params: searchParams(searchId, cursor) })).data,
  createThread: async (searchId?: string, title?: string): Promise<AssistantThread> =>
    (await api.post('/assistant/threads', { ...(title ? { title } : {}) }, { params: searchParams(searchId) })).data,
  listMessages: async (threadId: string, cursor?: string | null): Promise<Page<AssistantMessage>> =>
    (await api.get(`/assistant/threads/${threadId}/messages`, { params: searchParams(undefined, cursor) })).data,
  sendTurn: async ({ threadId, ...input }: SendTurnInput): Promise<SendTurnResponse> =>
    (await api.post(`/assistant/threads/${threadId}/messages`, input)).data,
};

export function useAssistantThreads(searchId?: string) {
  return useInfiniteQuery({
    queryKey: ['assistant', 'threads', searchId],
    queryFn: ({ pageParam }) => assistantApi.listThreads(searchId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor || undefined,
    enabled: Boolean(searchId),
  });
}

export function useAssistantMessages(threadId?: string) {
  return useInfiniteQuery({
    queryKey: ['assistant', 'messages', threadId],
    queryFn: ({ pageParam }) => assistantApi.listMessages(threadId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor || undefined,
    enabled: Boolean(threadId),
  });
}

export function useCreateAssistantThread(searchId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title }: { title?: string }) => assistantApi.createThread(searchId, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assistant', 'threads', searchId] }),
  });
}

export function useSendAssistantTurn(searchId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assistantApi.sendTurn,
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['assistant', 'messages', input.threadId] });
      queryClient.invalidateQueries({ queryKey: ['assistant', 'threads', searchId] });
      queryClient.invalidateQueries({ queryKey: ['properties', searchId] });
      queryClient.invalidateQueries({ queryKey: ['search-criteria'] });
      queryClient.invalidateQueries({ queryKey: ['searches'] });
    },
  });
}