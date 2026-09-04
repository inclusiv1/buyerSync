export type FinancingScenario = {
  loanType: 'Conventional' | 'FHA' | 'VA';
  termYears: number;
  downPaymentPercent: number;
  rate: number;
};

export function monthlyPrincipalAndInterest(principal: number, annualRate: number, termYears: number) {
  if (principal <= 0 || termYears <= 0) return 0;
  const payments = termYears * 12;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / payments;
  return principal * monthlyRate * Math.pow(1 + monthlyRate, payments) / (Math.pow(1 + monthlyRate, payments) - 1);
}

export function creditRateAdjustment(score: number) {
  if (score >= 760) return 0;
  if (score >= 720) return 0.25;
  if (score >= 680) return 0.5;
  if (score >= 640) return 0.875;
  return 1.5;
}

export function debtToIncome(monthlyHousing: number, monthlyIncome: number, monthlyDebts = 0) {
  if (monthlyIncome <= 0) return null;
  return ((monthlyHousing + Math.max(0, monthlyDebts)) / monthlyIncome) * 100;
}

export function buildFinancingScenarios(thirtyYearRate: number, fifteenYearRate: number, creditScore: number): FinancingScenario[] {
  const adjustment = creditRateAdjustment(creditScore);
  return [
    { loanType: 'Conventional', termYears: 30, downPaymentPercent: 5, rate: thirtyYearRate + adjustment },
    { loanType: 'Conventional', termYears: 30, downPaymentPercent: 20, rate: thirtyYearRate + adjustment },
    { loanType: 'Conventional', termYears: 15, downPaymentPercent: 20, rate: fifteenYearRate + adjustment },
    { loanType: 'FHA', termYears: 30, downPaymentPercent: 3.5, rate: thirtyYearRate + adjustment },
    { loanType: 'VA', termYears: 30, downPaymentPercent: 0, rate: Math.max(0, thirtyYearRate - 0.25 + adjustment) },
  ];
}