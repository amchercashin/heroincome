import { useCountUp } from '@/hooks/use-count-up';
import { Segmented } from '@/components/ds/segmented';
import { NBSP, formatCurrency, formatCurrencyFull, formatPercent } from '@/lib/utils';

export type IncomePeriod = 'month' | 'year';

interface IncomeHeroProps {
  /** Net income for the selected period, RUB */
  income: number | null;
  /** Net income per year — used for the per-day equivalent */
  incomePerYear: number | null;
  yieldPercent: number | null;
  totalValue: number | null;
  mode: IncomePeriod;
  onModeChange: (mode: IncomePeriod) => void;
  animate?: boolean;
}

function splitAmount(value: number | null): { digits: string; empty: boolean } {
  if (value == null) return { digits: '—', empty: true };
  return { digits: formatCurrencyFull(value).replace(`${NBSP}₽`, ''), empty: false };
}

export function IncomeHero({ income, incomePerYear, yieldPercent, totalValue, mode, onModeChange, animate = true }: IncomeHeroProps) {
  const animated = useCountUp(income, animate);
  const { digits } = splitAmount(animated);
  const perDay = incomePerYear != null && incomePerYear > 0 ? incomePerYear / 365 : null;
  const a = (css: string) => (animate ? { style: { animation: css } } : {});

  return (
    <section aria-label="Пассивный доход" className="relative pt-2 pb-2 text-center">
      {/* ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-6 h-48 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(217,192,142,0.16),transparent)] blur-2xl"
      />

      <div className="relative" {...a('hi-fade-in 0.6s ease-out 0.1s both')}>
        <Segmented
          size="sm"
          ariaLabel="Период"
          value={mode}
          onChange={onModeChange}
          options={[
            { value: 'month', label: 'В месяц' },
            { value: 'year', label: 'В год' },
          ]}
        />
      </div>

      <div className="relative mt-5 hi-eyebrow" {...a('hi-fade-in 0.6s ease-out 0.2s both')}>
        расчётный пассивный доход
      </div>

      <div
        className="relative mt-1 flex items-baseline justify-center gap-2"
        {...a('hi-fade-scale-in 0.9s var(--hi-ease-out) 0.25s both')}
      >
        <span
          data-testid="hero-amount"
          className="hi-numerals-oldstyle font-serif text-[length:var(--hi-text-display)] font-light leading-none tracking-tight bg-[linear-gradient(180deg,var(--hi-gold-bright)_10%,var(--hi-gold)_55%,var(--hi-gold-deep))] bg-clip-text text-transparent"
        >
          {digits}
        </span>
        <span className="text-[length:var(--hi-text-large)] font-light leading-none text-[var(--hi-gold-deep)]">₽</span>
      </div>

      <div
        className="relative mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[length:var(--hi-text-caption)] text-[var(--hi-text-3)]"
        {...a('hi-fade-in 0.6s ease-out 0.45s both')}
      >
        <span className="rounded-full border border-[var(--hi-line)] px-2 py-0.5 text-[length:var(--hi-text-micro)] font-semibold uppercase tracking-[0.12em] text-[var(--hi-text-2)]">
          после НДФЛ
        </span>
        {perDay != null && <span>≈{NBSP}{formatCurrencyFull(perDay)} в день</span>}
      </div>

      <div
        className="relative mx-auto mt-6 grid max-w-[340px] grid-cols-2 divide-x divide-[var(--hi-line)] rounded-2xl border border-[var(--hi-line)] bg-[color-mix(in_srgb,var(--hi-surface)_70%,transparent)] py-3"
        {...a('hi-fade-slide-up 0.6s var(--hi-ease-out) 0.55s both')}
      >
        <div>
          <div className="hi-eyebrow">Доходность</div>
          <div className="mt-1 text-[length:var(--hi-text-heading)] font-semibold text-[var(--hi-text)]">
            {formatPercent(yieldPercent)}
          </div>
        </div>
        <div>
          <div className="hi-eyebrow">Капитал</div>
          <div className="mt-1 text-[length:var(--hi-text-heading)] font-semibold text-[var(--hi-text)]">
            {formatCurrency(totalValue)}
          </div>
        </div>
      </div>
    </section>
  );
}
