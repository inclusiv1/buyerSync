import { AlertCircle, Loader2, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AssistantLoading({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{label}</div>;
}

export function AssistantEmpty() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><MessageSquareText aria-hidden="true" /></span>
      <h3 className="text-2xl">Plan your search together</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Ask about your criteria, checklist, saved homes, or supported listings. Any automatic changes will be summarized here.</p>
    </div>
  );
}

export function AssistantError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-4 flex items-start gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1"><p>{message}</p>{onRetry && <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>Try again</Button>}</div>
    </div>
  );
}