export function calcAssetIncomePerYear(
  quantity: number,
  paymentAmount: number,
  frequencyPerYear: number,
): number {
  return quantity * paymentAmount * frequencyPerYear;
}

export function calcAssetIncomePerMonth(
  quantity: number,
  paymentAmount: number,
  frequencyPerYear: number,
): number {
  return calcAssetIncomePerYear(quantity, paymentAmount, frequencyPerYear) / 12;
}

interface IncomeItem {
  quantity: number;
  paymentAmount: number;
  frequencyPerYear: number;
}

export function calcPortfolioIncome(items: IncomeItem[]): {
  perYear: number;
  perMonth: number;
} {
  const perYear = items.reduce(
    (sum, item) =>
      sum + calcAssetIncomePerYear(item.quantity, item.paymentAmount, item.frequencyPerYear),
    0,
  );
  return { perYear, perMonth: perYear / 12 };
}

export function calcYieldPercent(annualIncome: number, portfolioValue: number): number {
  if (portfolioValue === 0) return 0;
  return (annualIncome / portfolioValue) * 100;
}

export function calcCAGR(annualIncomes: number[]): number | null {
  if (annualIncomes.length < 2) return null;
  const first = annualIncomes[0];
  const last = annualIncomes[annualIncomes.length - 1];
  if (first <= 0) return null;
  const years = annualIncomes.length - 1;
  const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;
  return cagr;
}
