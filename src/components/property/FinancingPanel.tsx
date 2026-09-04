import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Banknote, ExternalLink, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { buildFinancingScenarios, debtToIncome, monthlyPrincipalAndInterest } from '../../../server/utils/financing';

type Rate = { id: string; date: string; rateType: string; rate: number; source: string };

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const FinancingPanel = ({ price, hoa = 0, state = '' }: { price: number; hoa?: number | null; state?: string }) => {
  const [creditScore, setCreditScore] = useState(760);
  const [annualIncome, setAnnualIncome] = useState(0);
  const [monthlyDebts, setMonthlyDebts] = useState(0);
  const { data: rates = [], isLoading, isError } = useQuery<Rate[]>({
    queryKey: ['rates'],
    queryFn: async () => (await api.get('/rates')).data,
    staleTime: 60 * 60 * 1000,
  });
  const thirtyYear = rates.find(rate => rate.rateType === '30yr');
  const fifteenYear = rates.find(rate => rate.rateType === '15yr');
  const asOf = rates.reduce((latest, rate) => rate.date > latest ? rate.date : latest, '');
  const scenarios = thirtyYear && fifteenYear
    ? buildFinancingScenarios(thirtyYear.rate, fifteenYear.rate, Math.min(850, Math.max(300, creditScore || 300)))
    : [];
  const stateProgramsUrl = 'https://www.hud.gov/findacounselor';

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="bg-primary/5">
        <div className="flex items-start gap-3">
          <Banknote className="mt-1 h-5 w-5 text-primary" />
          <div>
            <CardTitle>Financing examples</CardTitle>
            <CardDescription className="mt-1">Explore illustrative payments for this home. Nothing entered here is saved.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5 md:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
            Credit score
            <Input type="number" min="300" max="850" value={creditScore} onChange={event => setCreditScore(Number(event.target.value))} />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
            Gross annual income
            <Input type="number" min="0" step="1000" value={annualIncome || ''} placeholder="$120,000" onChange={event => setAnnualIncome(Math.max(0, Number(event.target.value)))} />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
            Other monthly debts
            <Input type="number" min="0" step="50" value={monthlyDebts || ''} placeholder="$500" onChange={event => setMonthlyDebts(Math.max(0, Number(event.target.value)))} />
          </label>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading the latest available benchmarks…</p>}
        {isError && <p className="text-sm text-red-600">Current rate benchmarks are temporarily unavailable. Try again before relying on an estimate.</p>}
        {scenarios.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                <tr><th className="pb-3">Example</th><th className="pb-3">Down payment</th><th className="pb-3">Illustrative rate</th><th className="pb-3">Principal & interest</th><th className="pb-3">Est. DTI</th></tr>
              </thead>
              <tbody className="divide-y">
                {scenarios.map(scenario => {
                  const downPayment = price * scenario.downPaymentPercent / 100;
                  const payment = monthlyPrincipalAndInterest(price - downPayment, scenario.rate, scenario.termYears);
                  const dti = debtToIncome(payment + (hoa || 0), annualIncome / 12, monthlyDebts);
                  return (
                    <tr key={`${scenario.loanType}-${scenario.termYears}-${scenario.downPaymentPercent}`}>
                      <td className="py-3 font-medium">{scenario.loanType} · {scenario.termYears} years</td>
                      <td className="py-3">{scenario.downPaymentPercent}% <span className="text-muted-foreground">({money.format(downPayment)})</span></td>
                      <td className="py-3">{scenario.rate.toFixed(3)}%</td>
                      <td className="py-3 font-semibold text-primary">{money.format(payment)}/mo</td>
                      <td className="py-3">{dti === null ? 'Add income' : `${dti.toFixed(1)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['VA home loans', 'For eligible veterans, service members, and surviving spouses; often allows 0% down.', 'https://www.va.gov/housing-assistance/home-loans/', ShieldCheck],
            ['FHA loans', 'Lower down-payment options with mortgage insurance and property requirements.', 'https://www.hud.gov/buying/loans', HomeProgramIcon],
            ['USDA rural loans', 'Income and location eligibility may allow 0% down in qualifying rural areas.', 'https://eligibility.sc.egov.usda.gov/eligibility/welcomeAction.do', HomeProgramIcon],
            [`${state.toUpperCase() || 'State'} programs`, `Use HUD's location search to ask an approved counselor about ${state.toUpperCase() || 'state'} down-payment and first-time-buyer assistance.`, stateProgramsUrl, HomeProgramIcon],
          ].map(([title, description, href, Icon]) => (
            <a key={String(title)} href={String(href)} target="_blank" rel="noopener noreferrer" className="flex gap-3 border p-4 transition hover:border-primary/50 hover:bg-primary/5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span><span className="flex items-center gap-1 font-semibold">{String(title)} <ExternalLink className="h-3 w-3" /></span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{String(description)}</span></span>
            </a>
          ))}
        </div>

        <div className="flex gap-3 border border-amber-300/60 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>Estimate only—not a loan offer.</strong> Benchmarks are the latest information available{asOf ? ` as of ${new Date(asOf).toLocaleDateString()}` : ''} and may change at any time. Actual eligibility, rate, and payment depend on lender pricing, credit history and score, income, debts, property, location, occupancy, loan limits, points, fees, and program rules. Payments shown include principal and interest only; HOA is used only for DTI. Taxes, homeowners insurance, mortgage insurance, VA funding fees, FHA premiums, closing costs, and other charges are not included. VA rates are illustrative because the VA does not set lender interest rates. Contact a licensed lender and verify regional-program eligibility.</p>
        </div>
        {thirtyYear && <p className="text-[0.68rem] text-muted-foreground">Base benchmarks: {thirtyYear.source}. Credit tiers and the VA adjustment are educational assumptions, not personalized pricing.</p>}
      </CardContent>
    </Card>
  );
};

const HomeProgramIcon = ({ className }: { className?: string }) => <Banknote className={className} />;