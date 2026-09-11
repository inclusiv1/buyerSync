import { AlertCircle, BookOpen, CheckCircle2, ExternalLink, Eye, Pencil, XCircle } from 'lucide-react';
import type { AssistantMessage } from '@/services/assistantApi';
import { cn } from '@/lib/utils';

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ActionSummary({ action }: { action: AssistantMessage['toolSummaries'][number] }) {
  const StatusIcon = action.status === 'succeeded'
    ? CheckCircle2
    : XCircle;

  return (
    <li className="flex gap-3 border border-foreground/10 bg-background/60 p-3 text-sm">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-muted" aria-hidden="true">
        {action.isWrite ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{action.isWrite ? 'Change' : 'Lookup'}</span>
          <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{action.toolName}</span>
          <span className={cn(
            'ml-auto inline-flex items-center gap-1 text-xs font-medium capitalize',
            action.status === 'failed' && 'text-destructive',
          )}>
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {action.status}
          </span>
        </div>
        <p className="mt-1 text-muted-foreground">{action.summary}</p>
      </div>
    </li>
  );
}

export function AssistantMessageItem({ message, reducedCapability = false }: { message: AssistantMessage; reducedCapability?: boolean }) {
  const isUser = message.role === 'user';
  const timestamp = formatDate(message.createdAt);
  const citations = (message.citations ?? []).flatMap((citation) => {
    const url = safeExternalUrl(citation.url);
    return url ? [{ ...citation, url }] : [];
  });

  return (
    <article className={cn('flex', isUser ? 'justify-end' : 'justify-start')} aria-label={`${isUser ? 'You' : 'Search Copilot'} message`}>
      <div className={cn(
        'max-w-[92%] border p-4 sm:max-w-[84%]',
        isUser ? 'border-foreground bg-foreground text-background' : 'border-foreground/10 bg-card',
      )}>
        <div className={cn('mb-2 flex items-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.18em]', isUser ? 'text-background/65' : 'text-muted-foreground')}>
          <span>{isUser ? 'You' : 'Search Copilot'}</span>
          {timestamp && <><span aria-hidden="true">·</span><time dateTime={message.createdAt}>{timestamp}</time></>}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>

        {(reducedCapability || message.provider?.toLowerCase().includes('fallback')) && (
          <div className="mt-4 flex gap-2 border border-amber-700/20 bg-amber-50 p-3 text-sm text-amber-950" role="status">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span><strong>Reduced capability.</strong> The AI provider was unavailable, so this response used supported deterministic search tools.</span>
          </div>
        )}

        {!!message.toolSummaries.length && (
          <section className="mt-4" aria-label="Actions performed">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]">Actions</h4>
            <ul className="space-y-2">{message.toolSummaries.map((action, index) => <ActionSummary key={`${action.toolName}-${index}`} action={action} />)}</ul>
          </section>
        )}

        {!!citations.length && (
          <section className="mt-4 border-t border-current/10 pt-3" aria-label="Sources">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em]"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Sources</h4>
            <ol className="space-y-2 text-sm">
              {citations.map((citation, index) => {
                const observed = formatDate(citation.observationDate);
                const retrieved = formatDate(citation.retrievedAt);
                return (
                  <li key={`${citation.url}-${index}`} className="leading-5">
                    <a className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4" href={citation.url} target="_blank" rel="noreferrer noopener">
                      {citation.title || citation.sourceName} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                    <span className="block text-xs text-muted-foreground">
                      {citation.sourceName}{observed ? ` · Observed ${observed}` : ''}{retrieved ? ` · Retrieved ${retrieved}` : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </article>
  );
}