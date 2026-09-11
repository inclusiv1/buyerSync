import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Loader2, MessageSquarePlus, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { AssistantThread } from '@/services/assistantApi';
import {
  useAssistantMessages,
  useAssistantThreads,
  useCreateAssistantThread,
  useSendAssistantTurn,
} from '@/services/assistantApi';
import { cn } from '@/lib/utils';
import { AssistantMessageItem } from './AssistantMessageItem';
import { AssistantEmpty, AssistantError, AssistantLoading } from './AssistantStates';

export interface SearchCopilotProps {
  searchId?: string;
}

function makeIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mutationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function SearchCopilot({ searchId }: SearchCopilotProps) {
  const threadsQuery = useAssistantThreads(searchId);
  const createThread = useCreateAssistantThread(searchId);
  const sendTurn = useSendAssistantTurn(searchId);
  const threads = useMemo(() => threadsQuery.data?.pages.flatMap((page) => page.items) ?? [], [threadsQuery.data]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [reducedCapabilityMessageIds, setReducedCapabilityMessageIds] = useState<Set<string>>(() => new Set());
  const messageEndRef = useRef<HTMLDivElement>(null);
  const messagesQuery = useAssistantMessages(selectedThreadId);
  const messages = useMemo(() => [...(messagesQuery.data?.pages ?? [])].reverse().flatMap((page) => page.items), [messagesQuery.data]);

  useEffect(() => {
    if (!selectedThreadId && threads[0]) setSelectedThreadId(threads[0].id);
  }, [selectedThreadId, threads]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, sendTurn.isPending]);

  async function startThread() {
    try {
      const thread = await createThread.mutateAsync({});
      setSelectedThreadId(thread.id);
      setStatus('New conversation created.');
    } catch {
      setStatus('The conversation could not be created.');
    }
  }

  async function submitMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || sendTurn.isPending || createThread.isPending) return;
    setDraft('');
    setStatus('Sending your message.');
    try {
      let threadId = selectedThreadId;
      if (!threadId) {
        const thread = await createThread.mutateAsync({});
        threadId = thread.id;
        setSelectedThreadId(threadId);
      }
      const response = await sendTurn.mutateAsync({ threadId, content, idempotencyKey: makeIdempotencyKey() });
      if (response.reducedCapability && response.assistantMessage) {
        setReducedCapabilityMessageIds((current) => new Set(current).add(response.assistantMessage!.id));
      }
      setStatus('Search Copilot responded.');
    } catch (error) {
      setDraft(content);
      setStatus(mutationErrorMessage(error, 'Your message could not be sent. Please try again.'));
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  return (
    <Card aria-labelledby="search-copilot-title" className="overflow-hidden">
      <CardHeader className="border-b border-foreground/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Shared workspace</div>
            <CardTitle id="search-copilot-title" className="flex items-center gap-2"><MessageSquarePlus className="h-5 w-5" aria-hidden="true" /> Search Copilot</CardTitle>
            <CardDescription className="mt-2">Explore homes and refine your group’s search with an auditable assistant.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void startThread()} disabled={createThread.isPending}>
            {createThread.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />} New conversation
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid p-0 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-foreground/10 bg-background/40 p-3 md:border-b-0 md:border-r" aria-label="Copilot conversations">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Conversations</div>
          {threadsQuery.isLoading && <AssistantLoading label="Loading conversations…" />}
          {threadsQuery.isError && <AssistantError message="Conversations could not be loaded." onRetry={() => void threadsQuery.refetch()} />}
          {!threadsQuery.isLoading && !threadsQuery.isError && threads.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">No saved conversations yet.</p>}
          <nav className="space-y-1" aria-label="Saved conversations">
            {threads.map((thread: AssistantThread) => (
              <button
                key={thread.id}
                type="button"
                aria-current={selectedThreadId === thread.id ? 'page' : undefined}
                className={cn('w-full border-l-2 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', selectedThreadId === thread.id ? 'border-primary bg-primary/10 font-semibold' : 'border-transparent hover:bg-muted')}
                onClick={() => setSelectedThreadId(thread.id)}
              >
                <span className="block truncate">{thread.title || 'Untitled conversation'}</span>
              </button>
            ))}
          </nav>
          {threadsQuery.hasNextPage && (
            <Button className="mt-3 w-full" size="sm" variant="ghost" disabled={threadsQuery.isFetchingNextPage} onClick={() => void threadsQuery.fetchNextPage()}>
              {threadsQuery.isFetchingNextPage ? 'Loading…' : 'Load more conversations'}
            </Button>
          )}
        </aside>

        <div className="flex min-h-[34rem] min-w-0 flex-col">
          <div className="max-h-[38rem] flex-1 overflow-y-auto p-4 sm:p-6" aria-label="Conversation messages">
            {selectedThreadId && messagesQuery.isLoading && <AssistantLoading label="Loading conversation…" />}
            {selectedThreadId && messagesQuery.isError && <AssistantError message="This conversation could not be loaded." onRetry={() => void messagesQuery.refetch()} />}
            {messagesQuery.hasNextPage && (
              <div className="mb-5 text-center"><Button size="sm" variant="outline" disabled={messagesQuery.isFetchingNextPage} onClick={() => void messagesQuery.fetchNextPage()}>{messagesQuery.isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}</Button></div>
            )}
            {!messagesQuery.isLoading && !messagesQuery.isError && messages.length === 0 && <AssistantEmpty />}
            <div className="space-y-5">{messages.map((message) => <AssistantMessageItem key={message.id} message={message} reducedCapability={reducedCapabilityMessageIds.has(message.id) || (!message.provider && message.content.startsWith('Reduced capability:'))} />)}</div>
            {sendTurn.isPending && <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Search Copilot is working…</div>}
            <div ref={messageEndRef} />
          </div>

          <form className="border-t border-foreground/10 bg-background/60 p-4" onSubmit={(event) => void submitMessage(event)}>
            <label htmlFor="search-copilot-message" className="mb-2 block text-sm font-semibold">Message Search Copilot</label>
            <div className="flex items-end gap-2">
              <Textarea
                id="search-copilot-message"
                className="min-h-20 resize-y"
                value={draft}
                maxLength={4000}
                placeholder="Describe the homes you want to find…"
                disabled={sendTurn.isPending || createThread.isPending}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                aria-describedby="search-copilot-composer-help"
              />
              <Button type="submit" size="icon" aria-label="Send message" disabled={!draft.trim() || sendTurn.isPending || createThread.isPending}><Send aria-hidden="true" /></Button>
            </div>
            <p id="search-copilot-composer-help" className="mt-2 text-xs text-muted-foreground">Press Enter to send. Use Shift+Enter for a new line.</p>
            {sendTurn.isError && <p className="mt-2 text-sm text-destructive" role="alert">{mutationErrorMessage(sendTurn.error, 'Your message could not be sent.')}</p>}
          </form>
        </div>
      </CardContent>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{status}</p>
    </Card>
  );
}