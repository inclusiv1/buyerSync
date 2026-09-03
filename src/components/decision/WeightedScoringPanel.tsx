import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, EyeOff, Scale } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { decisionApi } from '@/services/decisionApi';
import type { CriterionRating, DealbreakerRating } from '@/domain/models';
import { useAuthStore } from '@/store/useAuthStore';

export interface WeightedScoringPanelProps {
  listingId: string;
  listingLabel: string;
}

export function WeightedScoringPanel({ listingId, listingLabel }: WeightedScoringPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [dealbreakers, setDealbreakers] = useState<Record<string, boolean>>({});
  const criteriaQuery = useQuery({ queryKey: ['decision-criteria'], queryFn: decisionApi.getCriteria });
  const decisionQuery = useQuery({
    queryKey: ['property-decision', listingId],
    queryFn: () => decisionApi.getPropertyDecision(listingId),
  });
  const criteria = useMemo(() => criteriaQuery.data ?? [], [criteriaQuery.data]);

  useEffect(() => {
    const savedSubmission = decisionQuery.data?.submissions.find((submission) => submission.user.id === user?.id);
    setRatings((current) => {
      const next = { ...current };
      criteria.forEach((criterion) => {
        if (!criterion.isDealbreaker) {
          next[criterion.id] = savedSubmission?.scores.find((rating) => rating.criterionId === criterion.id)?.value
            ?? next[criterion.id]
            ?? Math.ceil(criterion.scaleMax / 2);
        }
      });
      return next;
    });
    setDealbreakers((current) => {
      const next = { ...current };
      criteria.forEach((criterion) => {
        if (criterion.isDealbreaker) {
          next[criterion.id] = savedSubmission?.dealbreakers.find((rating) => rating.criterionId === criterion.id)?.triggered
            ?? next[criterion.id]
            ?? false;
        }
      });
      return next;
    });
  }, [criteria, decisionQuery.data?.submissions, user?.id]);

  const submitMutation = useMutation({
    mutationFn: () => decisionApi.submitScores(listingId, {
      scores: Object.entries(ratings).map(([criterionId, value]): CriterionRating => ({ criterionId, value })),
      dealbreakers: Object.entries(dealbreakers).map(([criterionId, triggered]): DealbreakerRating => ({ criterionId, triggered })),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property-decision', listingId] }),
  });
  const result = decisionQuery.data?.scoreResult;

  return (
    <Card aria-labelledby={`scoring-${listingId}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle id={`scoring-${listingId}`} className="flex items-center gap-2 text-xl">
              <Scale className="h-5 w-5" /> Weighted score
            </CardTitle>
            <CardDescription>Rate {listingLabel} independently. Scores use each criterion’s weight.</CardDescription>
          </div>
          {result?.hasVeto && <Badge variant="destructive">VETO</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {result?.blind && !result.revealed && (
          <div className="flex gap-3 border border-primary/20 bg-primary/5 p-3 text-sm text-foreground" role="status">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Your ratings are saved. Team results remain hidden until both buyers submit.</span>
          </div>
        )}
        {result?.revealed && result.compositeScore !== null && (
          <div className="grid grid-cols-2 gap-3 bg-foreground p-4 text-background">
            <div><div className="eyebrow text-background/60">Composite</div><div className="font-serif text-4xl font-medium">{result.compositeScore}%</div></div>
            <div><div className="eyebrow text-background/60">Buyer gap</div><div className="font-serif text-4xl font-medium">{result.maxDivergence} pts</div></div>
          </div>
        )}
        {criteria.map((criterion) => (
          <fieldset key={criterion.id} className="border border-foreground/10 p-4">
            <legend className="px-1 text-sm font-semibold">{criterion.label}</legend>
            <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500">
              <Badge variant="secondary" className="capitalize">{criterion.category.replace('-', ' / ')}</Badge>
              <span>Weight {criterion.weight}</span>
            </div>
            {criterion.isDealbreaker ? (
              <label className="flex cursor-pointer items-center gap-3 rounded-md bg-red-50 p-3 text-sm text-red-900">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-red-600"
                  checked={dealbreakers[criterion.id] ?? false}
                  onChange={(event) => setDealbreakers((current) => ({ ...current, [criterion.id]: event.target.checked }))}
                />
                <AlertTriangle className="h-4 w-4" /> This listing violates this dealbreaker
              </label>
            ) : (
              <div className="flex items-center gap-4">
                <Slider
                  aria-label={`${criterion.label} rating`}
                  min={1}
                  max={criterion.scaleMax}
                  step={1}
                  value={[ratings[criterion.id] ?? 1]}
                  onValueChange={([value]) => setRatings((current) => ({ ...current, [criterion.id]: value }))}
                />
                <output className="w-14 text-right text-sm font-bold">{ratings[criterion.id] ?? 1}/{criterion.scaleMax}</output>
              </div>
            )}
          </fieldset>
        ))}
        {criteriaQuery.isError && <p className="text-sm text-red-600">Scoring criteria could not be loaded.</p>}
        {criteria.length === 0 && !criteriaQuery.isLoading && <p className="text-sm text-slate-500">Add decision criteria to begin scoring.</p>}
        {submitMutation.isError && <p className="text-sm text-red-600">Your scores could not be submitted. Please try again.</p>}
        <Button className="w-full" disabled={!criteria.length || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
          {submitMutation.isPending ? 'Submitting…' : 'Submit my score'}
        </Button>
      </CardContent>
    </Card>
  );
}