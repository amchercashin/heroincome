import { formatCurrencyFull, formatPercent, formatCurrency } from '@/lib/utils';
import { useCountUp } from '@/hooks/use-count-up';

interface HeroIncomeProps {
  income: number | null;
  yieldPercent: number | null;
  totalValue: number | null;
  mode: 'month' | 'year';
  onToggle: () => void;
  onSync: () => void;
  syncing: boolean;
  lastSyncAt: Date | null;
  animate?: boolean;
}

function formatSyncTime(date: Date): string {
  const d = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const t = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${d}, ${t}`;
}

export function HeroIncome({ income, yieldPercent, totalValue, mode, onToggle, onSync, syncing, lastSyncAt, animate = true }: HeroIncomeProps) {
  const animatedIncome = useCountUp(income, animate);

  const a = (value: string) => animate ? { style: { animation: value } } : {};

  return (
    <div className="text-center mb-4" {...a('way-fade-slide-up 0.7s ease-out 0.2s both')}>
      <div className="font-serif text-[length:var(--way-text-display)] font-light text-[var(--way-gold)] tracking-tight"
           {...a('way-fade-scale-in 0.8s ease-out 0.3s both')}>
        {formatCurrencyFull(animatedIncome)}
      </div>
      <div className="font-mono text-[length:var(--way-text-caption)] uppercase tracking-[0.3em] text-[var(--way-ash)] mt-1"
           {...a('way-fade-in 0.5s ease-out 0.4s both')}>
        расчётный пассивный доход
      </div>
      <div className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)] mt-0.5 flex items-center justify-center gap-1.5"
           {...a('way-fade-in 0.5s ease-out 0.6s both')}>
        <span>доходность {formatPercent(yieldPercent)} · портфель {formatCurrency(totalValue)}</span>
        <button
          onClick={onSync}
          disabled={syncing}
          className="text-[var(--way-ash)] text-[length:var(--way-text-caption)] hover:text-[var(--way-gold)] transition-colors disabled:opacity-50"
          aria-label="Обновить цены MOEX"
          title={lastSyncAt ? `MOEX: ${formatSyncTime(lastSyncAt)}` : 'Синхронизировать цены'}
        >
          <span className={syncing ? 'inline-block animate-spin' : ''}>⟳</span>
        </button>
      </div>
      <div {...a('way-fade-in 0.5s ease-out 0.7s both')}>
        <button
          onClick={onToggle}
          className="mt-3 inline-flex border border-[rgba(200,180,140,0.12)] rounded overflow-hidden"
        >
          <span className={`px-4 py-2 font-mono text-[length:var(--way-text-caption)] tracking-[0.15em] transition-colors ${
            mode === 'month'
              ? 'bg-[rgba(200,180,140,0.08)] text-[var(--way-gold)]'
              : 'text-[var(--way-ash)]'
          }`}>
            МЕС
          </span>
          <span className={`px-4 py-2 font-mono text-[length:var(--way-text-caption)] tracking-[0.15em] transition-colors ${
            mode === 'year'
              ? 'bg-[rgba(200,180,140,0.08)] text-[var(--way-gold)]'
              : 'text-[var(--way-ash)]'
          }`}>
            ГОД
          </span>
        </button>
      </div>
    </div>
  );
}
