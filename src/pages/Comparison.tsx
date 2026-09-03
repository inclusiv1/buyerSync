import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, GitCompareArrows } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ComparativeDecisionMatrix, type ComparisonEntry } from '@/components/decision/ComparativeDecisionMatrix';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Listing, ScoreResult } from '@/domain/models';
import api from '@/lib/api';
import { decisionApi } from '@/services/decisionApi';

interface ApiProperty {
  id: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  hoa?: number;
  score?: number;
  pros?: string[];
  cons?: string[];
  notes?: Listing['notes'];
}

const emptyResult: ScoreResult = { compositeScore: null, divergence: 0, maxDivergence: 0, hasVeto: false, vetoes: [], blind: true, revealed: false, raterScores: [], criterionDivergence: {} };

export default function Comparison() {
  const [searchParams] = useSearchParams();
  const selectedIds = searchParams.get('ids')?.split(',').filter(Boolean).slice(0, 4) ?? [];
  const criteriaQuery = useQuery({ queryKey: ['decision-criteria'], queryFn: decisionApi.getCriteria });
  const comparisonQuery = useQuery({
    queryKey: ['comparison', selectedIds],
    enabled: selectedIds.length >= 2,
    queryFn: async (): Promise<ComparisonEntry[]> => {
      const properties = (await api.get<ApiProperty[]>('/properties')).data.filter((property) => selectedIds.includes(property.id));
      return Promise.all(properties.map(async (property) => {
        const decision = await decisionApi.getPropertyDecision(property.id);
        const price = property.price ?? 0;
        const listing: Listing = {
          ...property,
          price,
          pros: property.pros ?? [],
          cons: property.cons ?? [],
          notes: property.notes ?? [],
          financials: {
            purchasePrice: price,
            downPaymentPercent: 20,
            annualInterestRate: 6.5,
            loanTermYears: 30,
            annualPropertyTaxes: price * 0.012,
            annualHomeownersInsurance: price * 0.0035,
            monthlyHoa: property.hoa ?? 0,
            monthlyUtilities: 350,
          },
          capExItems: decision.capExItems ?? [],
          scoreResult: decision.scoreResult ?? emptyResult,
        };
        return { listing, submissions: decision.submissions ?? [] };
      }));
    },
  });

  return (
    <div className="editorial-shell pb-16">
      <nav className="editorial-nav"><div className="editorial-container flex h-20 items-center"><Button variant="ghost" asChild><Link to="/"><ChevronLeft /> Back to search</Link></Button></div></nav>
      <main className="editorial-container space-y-8 py-10 md:py-16">
        <header className="border-b border-foreground/10 pb-10"><p className="eyebrow mb-4 flex items-center gap-2"><GitCompareArrows className="h-4 w-4" /> Shared perspective</p><h1 className="display-title">Compare shortlist</h1><p className="mt-4 text-muted-foreground">Model costs and test how changing priorities affects your shared ranking.</p></header>
        {selectedIds.length < 2 ? (
          <Card className="p-10 text-center"><p className="font-semibold">Choose 2–4 homes from the dashboard to compare.</p><Button className="mt-4" asChild><Link to="/">Choose homes</Link></Button></Card>
        ) : comparisonQuery.isLoading || criteriaQuery.isLoading ? (
          <Card className="h-72 animate-pulse bg-slate-200" />
        ) : comparisonQuery.isError || criteriaQuery.isError ? (
          <Card className="border-red-200 p-8 text-center text-red-700">The comparison data could not be loaded. Please return to the dashboard and try again.</Card>
        ) : (
          <ComparativeDecisionMatrix entries={comparisonQuery.data ?? []} criteria={criteriaQuery.data ?? []} />
        )}
      </main>
    </div>
  );
}