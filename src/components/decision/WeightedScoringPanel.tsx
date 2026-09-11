import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, EyeOff, Plus, Scale, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  const [newCriterionLabel, setNewCriterionLabel] = useState('');
  const [newCriterionWeight, setNewCriterionWeight] = useState(5);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-decision', listingId] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
  const addCriterionMutation = useMutation({
    mutationFn: () => decisionApi.addCriterion({
      label: newCriterionLabel.trim(),
      description: '',
      category: 'custom',
      weight: newCriterionWeight,
      scaleMax: 10,
      isDealbreaker: false,
    }),
    onSuccess: () => {
      setNewCriterionLabel('');
      queryClient.invalidateQueries({ queryKey: ['decision-criteria'] });
      queryClient.invalidateQueries({ queryKey: ['property-decision', listingId] });
    },
  });
  const result = decisionQuery.data?.scoreResult;
  const automaticAssessment = decisionQuery.data?.automaticAssessment;
  const personalScore = useMemo(() => {
    const weighted = criteria.filter((criterion) => !criterion.isDealbreaker && criterion.weight > 0);
    const totalWeight = weighted.reduce((sum, criterion) => sum + criterion.weight, 0);
    if (!totalWeight || weighted.some((criterion) => ratings[criterion.id] === undefined)) return null;
    const total = weighted.reduce((sum, criterion) => sum + (ratings[criterion.id] / criterion.scaleMax) * criterion.weight, 0);
    return Math.round((total / totalWeight) * 100);
  }, [criteria, ratings]);

  return (
    <Card id="scoring" className="scroll-mt-28" aria-labelledby={`scoring-${listingId}`}>
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
        {automaticAssessment && automaticAssessment.assessments.length > 0 && (
          <div className="rounded-xl border border-violet-300/15 bg-violet-400/[0.06] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-300" /> Initial property assessment</div>
              <strong className="text-xl text-violet-200">{Math.round(automaticAssessment.score)}%</strong>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Calculated from the listing facts and your saved search requirements.</p>
            <div className="mt-3 space-y-2">
              {automaticAssessment.assessments.map((assessment) => (
                <div key={assessment.key} className="flex items-start gap-2 text-xs">
                  {assessment.met
                    ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    : <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${assessment.status === 'unknown' ? 'text-amber-300' : 'text-red-300'}`} />}
                  <span className={assessment.met ? 'text-muted-foreground' : 'text-foreground'}>{assessment.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {result?.blind && !result.revealed && (
          <div className="flex gap-3 border border-primary/20 bg-primary/5 p-3 text-sm text-foreground" role="status">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Your ratings are saved{personalScore === null ? '' : ` at ${personalScore}%`}. Team results remain hidden until every buyer submits.</span>
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
              <div className="space-y-3">
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
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${criterion.scaleMax}, minmax(0, 1fr))` }}>
                  {Array.from({ length: criterion.scaleMax }, (_, index) => index + 1).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`h-8 border text-xs font-semibold transition ${ratings[criterion.id] === value ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/10 bg-foreground/[0.03] hover:border-primary/50 hover:text-primary'}`}
                      aria-label={`Rate ${criterion.label} ${value} out of ${criterion.scaleMax}`}
                      aria-pressed={ratings[criterion.id] === value}
                      onClick={() => setRatings((current) => ({ ...current, [criterion.id]: value }))}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
        ))}
        {criteriaQuery.isError && <p className="text-sm text-red-600">Scoring criteria could not be loaded.</p>}
        {criteria.length === 0 && !criteriaQuery.isLoading && (
          <form
            className="space-y-4 border border-primary/20 bg-primary/[0.05] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (newCriterionLabel.trim()) addCriterionMutation.mutate();
            }}
          >
            <div>
              <p className="text-sm font-semibold">Create your first editable score</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Your property facts are assessed above. Add a weighted judgment such as location, condition, layout, or overall fit to enter your own rating.</p>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What do you want to rate?</span>
              <Input value={newCriterionLabel} placeholder="Overall fit" onChange={(event) => setNewCriterionLabel(event.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weight (1–10)</span>
              <Input type="number" min={1} max={10} value={newCriterionWeight} onChange={(event) => setNewCriterionWeight(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} />
            </label>
            {addCriterionMutation.isError && <p className="text-sm text-red-300" role="alert">The scoring criterion could not be created.</p>}
            <Button type="submit" className="w-full" disabled={!newCriterionLabel.trim() || addCriterionMutation.isPending}>
              <Plus className="h-4 w-4" /> {addCriterionMutation.isPending ? 'Creating…' : 'Add rating row'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" asChild><Link to="/checklist">Manage all criteria &amp; weights</Link></Button>
          </form>
        )}
        {submitMutation.isError && <p className="text-sm text-red-600">Your scores could not be submitted. Please try again.</p>}
        {submitMutation.isSuccess && <p className="text-sm text-emerald-300" role="status">Your score was saved.</p>}
        <Button className="w-full" disabled={!criteria.length || submitMutation.isPending} onClick={() => submitMutation.mutate()}>
          {submitMutation.isPending ? 'Submitting…' : 'Submit my score'}
        </Button>
      </CardContent>
    </Card>
  );
}