import { useMemo, useState } from 'react';
import { AlertTriangle, SlidersHorizontal, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { calculateCapExTotal, calculateMonthlyCost, calculateTrueTotalInvestment } from '@/domain/financials';
import { calculateCollaborativeScore } from '@/domain/scoring';
import type { Criterion, Listing, ScoreSubmission } from '@/domain/models';

export interface ComparisonEntry {
  listing: Listing;
  submissions: ScoreSubmission[];
}

export interface ComparativeDecisionMatrixProps {
  entries: ComparisonEntry[];
  criteria: Criterion[];
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function ComparativeDecisionMatrix({ entries, criteria }: ComparativeDecisionMatrixProps) {
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(criteria.map((criterion) => [criterion.id, criterion.weight])));
  const weightedCriteria = useMemo(
    () => criteria.map((criterion) => ({ ...criterion, weight: weights[criterion.id] ?? criterion.weight })),
    [criteria, weights],
  );
  const ranked = useMemo(() => entries.map((entry) => ({
    ...entry,
    scenarioResult: entry.submissions.length
      ? calculateCollaborativeScore(weightedCriteria, entry.submissions, { blind: entry.listing.scoreResult.blind })
      : entry.listing.scoreResult,
  })).sort((a, b) => (b.scenarioResult.compositeScore ?? -1) - (a.scenarioResult.compositeScore ?? -1)), [entries, weightedCriteria]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><SlidersHorizontal className="h-5 w-5" /> Weight sensitivity</CardTitle>
          <CardDescription>Adjust priorities to test a scenario. Rankings update instantly without changing saved team weights.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          {criteria.filter((criterion) => !criterion.isDealbreaker).map((criterion) => (
            <label key={criterion.id} className="space-y-2">
              <span className="flex justify-between text-sm"><span className="font-medium">{criterion.label}</span><output>{weights[criterion.id] ?? criterion.weight}</output></span>
              <Slider
                aria-label={`${criterion.label} scenario weight`}
                min={0}
                max={10}
                step={1}
                value={[weights[criterion.id] ?? criterion.weight]}
                onValueChange={([value]) => setWeights((current) => ({ ...current, [criterion.id]: value }))}
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <section aria-labelledby="matrix-title" className="overflow-hidden border border-foreground/10 bg-background shadow-[0_16px_45px_-35px_rgba(44,39,34,0.45)]">
        <div className="border-b p-5">
          <h2 id="matrix-title" className="text-xl font-bold">Side-by-side decision matrix</h2>
          <p className="text-sm text-slate-500">Comparing {ranked.length} shortlisted homes from strongest scenario fit.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-accent/50">
                <th scope="col" className="sticky left-0 z-[1] w-44 border-r bg-accent p-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">Measure</th>
                {ranked.map(({ listing }, index) => (
                  <th scope="col" key={listing.id} className="min-w-56 border-r p-4 align-top last:border-r-0">
                    <div className="mb-1 flex items-center gap-2">{index === 0 && <Trophy className="h-4 w-4 text-amber-500" />}<span className="text-xs text-slate-500">#{index + 1}</span></div>
                    <div className="font-serif text-xl font-medium text-foreground">{listing.address}</div>
                    <div className="font-normal text-muted-foreground">{[listing.city, listing.state].filter(Boolean).join(', ')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <MatrixRow label="Composite score">{ranked.map(({ listing, scenarioResult }) => (
                <MatrixCell key={listing.id}><strong className="text-2xl">{scenarioResult.compositeScore === null ? 'Hidden' : `${scenarioResult.compositeScore}%`}</strong></MatrixCell>
              ))}</MatrixRow>
              <MatrixRow label="Buyer alignment">{ranked.map(({ listing, scenarioResult }) => (
                <MatrixCell key={listing.id}><span className={scenarioResult.maxDivergence >= 20 ? 'font-semibold text-amber-700' : 'text-emerald-700'}>{scenarioResult.revealed ? `${scenarioResult.maxDivergence} pt gap` : 'Awaiting scores'}</span></MatrixCell>
              ))}</MatrixRow>
              <MatrixRow label="Dealbreakers">{ranked.map(({ listing, scenarioResult }) => (
                <MatrixCell key={listing.id}>{scenarioResult.hasVeto ? <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> VETO</Badge> : <span className="text-emerald-700">None flagged</span>}</MatrixCell>
              ))}</MatrixRow>
              <MatrixRow label="True monthly cost">{ranked.map(({ listing }) => (
                <MatrixCell key={listing.id}><strong>{currency.format(calculateMonthlyCost(listing.financials).total)}</strong><span className="block text-xs text-slate-500">PITI + HOA + utilities</span></MatrixCell>
              ))}</MatrixRow>
              <MatrixRow label="Immediate CapEx">{ranked.map(({ listing }) => (
                <MatrixCell key={listing.id}>{currency.format(calculateCapExTotal(listing.capExItems))}</MatrixCell>
              ))}</MatrixRow>
              <MatrixRow label="True investment">{ranked.map(({ listing }) => (
                <MatrixCell key={listing.id}>{currency.format(calculateTrueTotalInvestment(listing.financials, listing.capExItems))}</MatrixCell>
              ))}</MatrixRow>
              <MatrixRow label="Pros">{ranked.map(({ listing }) => (
                <MatrixCell key={listing.id}>{listing.pros.length ? <ul className="list-disc space-y-1 pl-4">{listing.pros.map((item) => <li key={item}>{item}</li>)}</ul> : <span className="text-slate-400">None added</span>}</MatrixCell>
              ))}</MatrixRow>
              <MatrixRow label="Cons">{ranked.map(({ listing }) => (
                <MatrixCell key={listing.id}>{listing.cons.length ? <ul className="list-disc space-y-1 pl-4">{listing.cons.map((item) => <li key={item}>{item}</li>)}</ul> : <span className="text-slate-400">None added</span>}</MatrixCell>
              ))}</MatrixRow>
              <MatrixRow label="Team notes">{ranked.map(({ listing }) => (
                <MatrixCell key={listing.id}>{listing.notes.length ? (
                  <ul className="space-y-3">{listing.notes.map((note) => (
                    <li key={note.id} className="border-l-2 border-primary/30 pl-3">
                      <p>{note.body}</p>
                      <span className="mt-1 block text-xs text-muted-foreground">{note.author.name}</span>
                    </li>
                  ))}</ul>
                ) : <span className="text-slate-400">No notes yet</span>}</MatrixCell>
              ))}</MatrixRow>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MatrixRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <tr className="border-t border-foreground/10"><th scope="row" className="sticky left-0 z-[1] border-r bg-background p-4 align-top font-medium">{label}</th>{children}</tr>;
}

function MatrixCell({ children }: { children: React.ReactNode }) {
  return <td className="border-r p-4 align-top last:border-r-0">{children}</td>;
}