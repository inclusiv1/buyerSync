import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import type { CriterionCategory } from '@/domain/models';
import { decisionApi, type NewCriterion } from '@/services/decisionApi';

const categories: Array<{ value: CriterionCategory; label: string }> = [
  { value: 'location', label: 'Location' },
  { value: 'layout-size', label: 'Layout / Size' },
  { value: 'condition', label: 'Condition' },
  { value: 'aesthetics', label: 'Aesthetics' },
  { value: 'financial', label: 'Financial' },
  { value: 'custom', label: 'Custom' },
];

const initialCriterion: NewCriterion = { label: '', description: '', category: 'custom', weight: 5, scaleMax: 10, isDealbreaker: false };

export function DecisionCriteriaManager() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NewCriterion>(initialCriterion);
  const criteriaQuery = useQuery({ queryKey: ['decision-criteria'], queryFn: decisionApi.getCriteria });
  const addMutation = useMutation({
    mutationFn: decisionApi.addCriterion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decision-criteria'] });
      setDraft(initialCriterion);
    },
  });
  const removeMutation = useMutation({
    mutationFn: decisionApi.removeCriterion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decision-criteria'] });
      queryClient.invalidateQueries({ queryKey: ['property-decision'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collaborative criteria</CardTitle>
        <CardDescription>Add nice-to-haves as weighted scores or must-haves as binary dealbreakers. The same criteria power every property score and the decision matrix.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="grid gap-4 rounded-lg border bg-slate-50 p-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); addMutation.mutate(draft); }}>
          <label className="space-y-1"><span className="text-xs font-semibold uppercase text-slate-500">Criterion</span><Input required value={draft.label} placeholder="Natural light" onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} /></label>
          <label className="space-y-1"><span className="text-xs font-semibold uppercase text-slate-500">Category</span><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as CriterionCategory }))}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
          {!draft.isDealbreaker && (
            <>
              <label className="space-y-2"><span className="flex justify-between text-xs font-semibold uppercase text-slate-500"><span>Weight</span><output>{draft.weight}</output></span><Slider min={1} max={10} value={[draft.weight]} onValueChange={([weight]) => setDraft((current) => ({ ...current, weight }))} /></label>
              <label className="space-y-1"><span className="text-xs font-semibold uppercase text-slate-500">Rating scale</span><select className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" value={draft.scaleMax} onChange={(event) => setDraft((current) => ({ ...current, scaleMax: Number(event.target.value) as 5 | 10 }))}><option value={5}>1–5</option><option value={10}>1–10</option></select></label>
            </>
          )}
          <label className="flex items-center gap-3 text-sm md:col-span-2"><input type="checkbox" className="h-4 w-4 accent-red-600" checked={draft.isDealbreaker} onChange={(event) => setDraft((current) => ({ ...current, isDealbreaker: event.target.checked }))} /><AlertTriangle className="h-4 w-4 text-red-600" /> Must-have / dealbreaker — any violation vetoes a listing</label>
          {addMutation.isError && <p className="text-sm text-red-600 md:col-span-2">The criterion could not be saved.</p>}
          <Button type="submit" className="md:col-span-2" disabled={addMutation.isPending || !draft.label.trim()}><Plus /> {addMutation.isPending ? 'Adding…' : 'Add criterion'}</Button>
        </form>
        <div className="grid gap-3 sm:grid-cols-2">
          {criteriaQuery.data?.map((criterion) => (
            <div key={criterion.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div><div className="font-semibold">{criterion.label}</div><div className="text-xs capitalize text-slate-500">{criterion.category.replace('-', ' / ')}</div></div>
              <div className="flex items-center gap-2">
                {criterion.isDealbreaker ? <Badge variant="destructive">Must-have</Badge> : <Badge variant="secondary">Nice-to-have · Weight {criterion.weight} · 1–{criterion.scaleMax}</Badge>}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${criterion.label}`}
                  title={`Remove ${criterion.label}`}
                  disabled={removeMutation.isPending && removeMutation.variables === criterion.id}
                  onClick={() => {
                    if (window.confirm(`Remove “${criterion.label}”? Existing ratings for this criterion will also be removed.`)) {
                      removeMutation.mutate(criterion.id);
                    }
                  }}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {removeMutation.isError && <p className="text-sm text-red-600 sm:col-span-2">The criterion could not be removed.</p>}
          {!criteriaQuery.isLoading && !criteriaQuery.data?.length && <p className="text-sm text-slate-500">No collaborative criteria yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}