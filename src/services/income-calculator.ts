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

export interface PaymentRecord {
  amount: number;
  date: Date;
}

export function calcCAGR(
  history: PaymentRecord[],
  now: Date = new Date(),
): number | null {
  if (history.length === 0) return null;
  const currentYear = now.getFullYear();
  const byYear = new Map<number, number>();
  for (const p of history) {
    const year = p.date.getFullYear();
    if (year >= currentYear) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + p.amount);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  if (years.length < 2) return null;
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const incomeFirst = byYear.get(firstYear)!;
  const incomeLast = byYear.get(lastYear)!;
  if (incomeFirst <= 0) return null;
  const span = lastYear - firstYear;
  return (Math.pow(incomeLast / incomeFirst, 1 / span) - 1) * 100;
}

export function calcFactPerMonth(
  history: PaymentRecord[],
  quantity: number,
  now: Date = new Date(),
): number {
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const sum = history
    .filter((p) => p.date > twelveMonthsAgo && p.date <= now)
    .reduce((acc, p) => acc + p.amount, 0);
  return (sum * quantity) / 12;
}

export function calcDecayAverage(
  history: PaymentRecord[],
  now: Date = new Date(),
): number | null {
  if (history.length === 0) return null;
  const sorted = [...history].sort((a, b) => b.date.getTime() - a.date.getTime());
  const lastPaymentDate = sorted[0].date;
  const windowStart = new Date(lastPaymentDate);
  windowStart.setMonth(windowStart.getMonth() - 12);
  const paymentsInWindow = sorted
    .filter((p) => p.date > windowStart && p.date <= lastPaymentDate)
    .reduce((acc, p) => acc + p.amount, 0);
  const monthsElapsed =
    (now.getFullYear() - lastPaymentDate.getFullYear()) * 12 +
    (now.getMonth() - lastPaymentDate.getMonth());
  return paymentsInWindow / (12 + Math.max(0, monthsElapsed));
}

export interface MainNumberInput {
  activeMetric: 'fact' | 'forecast';
  forecastAmount: number | null;
  frequencyPerYear: number;
  quantity: number;
  factPerMonth: number;
}

export function calcMainNumber(input: MainNumberInput): number {
  if (input.activeMetric === 'forecast' && input.forecastAmount != null) {
    return (input.forecastAmount * input.frequencyPerYear * input.quantity) / 12;
  }
  return input.factPerMonth;
}
