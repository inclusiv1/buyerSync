import type { CapExItem, FinancialAssumptions, MonthlyCostBreakdown } from './models';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateMonthlyCost(input: FinancialAssumptions): MonthlyCostBreakdown {
  const principal = Math.max(0, input.purchasePrice * (1 - input.downPaymentPercent / 100));
  const payments = Math.max(1, input.loanTermYears * 12);
  const monthlyRate = Math.max(0, input.annualInterestRate) / 100 / 12;
  const principalAndInterest = monthlyRate === 0
    ? principal / payments
    : principal * (monthlyRate * (1 + monthlyRate) ** payments) / ((1 + monthlyRate) ** payments - 1);
  const propertyTaxes = Math.max(0, input.annualPropertyTaxes) / 12;
  const homeownersInsurance = Math.max(0, input.annualHomeownersInsurance) / 12;
  const hoa = Math.max(0, input.monthlyHoa);
  const utilities = Math.max(0, input.monthlyUtilities);

  return {
    principalAndInterest: money(principalAndInterest),
    propertyTaxes: money(propertyTaxes),
    homeownersInsurance: money(homeownersInsurance),
    hoa: money(hoa),
    utilities: money(utilities),
    total: money(principalAndInterest + propertyTaxes + homeownersInsurance + hoa + utilities),
  };
}

export const calculateCapExTotal = (items: CapExItem[]) => money(items.reduce((total, item) => total + Math.max(0, item.estimatedCost), 0));

export const calculateTrueTotalInvestment = (financials: FinancialAssumptions, items: CapExItem[]) =>
  money(financials.purchasePrice + calculateCapExTotal(items));