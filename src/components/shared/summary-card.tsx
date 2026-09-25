import type { ReactNode } from 'react';
import { Card, Stat } from '@/components/ds/surface';
import { NetOfTaxBadge } from '@/components/ds/badge';
import { formatCurrency, formatCurrencyFull, formatPercent } from '@/lib/utils';

interface SummaryCardProps {
  incomePerMonth: number | null;
  totalValue: number | null;
  yieldPercent: number | null;
  portfolioSharePercent: number | null;
  /** Extra badges next to "после НДФЛ" (e.g. source of the income figure). */
  badges?: ReactNode;
}

/** Income-first summary: monthly income large, then year / value / yield / share. */
export function SummaryCard({ incomePerMonth, totalValue, yieldPercent, portfolioSharePercent, badges }: SummaryCardProps) {
  return (
    <Card glow className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="hi-eyebrow">Доход в месяц</div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <NetOfTaxBadge />
          {badges}
        </div>
      </div>
      <div className="mt-2 text-[clamp(28px,8.5vw,34px)] font-semibold leading-none tracking-tight text-[var(--hi-gold)]">
        {formatCurrencyFull(incomePerMonth)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[var(--hi-line)] pt-4">
        <Stat label="В год" value={formatCurrency(incomePerMonth != null ? incomePerMonth * 12 : null)} />
        <Stat label="Доходность" value={formatPercent(yieldPercent)} accent />
        <Stat label="Стоимость" value={formatCurrency(totalValue)} />
        <Stat label="Доля портфеля" value={formatPercent(portfolioSharePercent)} />
      </div>
    </Card>
  );
}
