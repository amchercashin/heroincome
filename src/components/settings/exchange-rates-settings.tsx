import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { normalizeCurrency, updateExchangeRate } from '@/services/exchange-rates';
import { Card, Section } from '@/components/ds/surface';

export function ExchangeRatesSettings() {
  const assets = useLiveQuery(() => db.assets.toArray(), [], []);
  const rates = useExchangeRates();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const currencies = new Set<string>();
  for (const asset of assets) {
    const currency = normalizeCurrency(asset.currency);
    if (currency !== 'RUB') currencies.add(currency);
  }
  for (const rate of rates) {
    const currency = normalizeCurrency(rate.currency);
    if (currency !== 'RUB') currencies.add(currency);
  }

  const rateByCurrency = new Map(rates.map((rate) => [normalizeCurrency(rate.currency), rate]));
  const sortedCurrencies = [...currencies].sort();

  const commit = async (currency: string) => {
    const raw = drafts[currency] ?? String(rateByCurrency.get(currency)?.rateToRub ?? '');
    const parsed = Number(raw.replace(',', '.'));
    if (isFinite(parsed) && parsed > 0) {
      await updateExchangeRate(currency, parsed);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[currency];
        return next;
      });
    }
  };

  return (
    <Section title="Курсы валют" description="Для пересчёта валютных активов и выплат в рубли.">
      <Card className="overflow-hidden px-4">
        {sortedCurrencies.length === 0 && (
          <div className="py-4 text-[length:var(--hi-text-caption)] leading-snug text-[var(--hi-text-3)]">
            Валютных активов нет. Курс появится здесь, когда вы добавите актив в долларах, евро или юанях.
          </div>
        )}
        {sortedCurrencies.map((currency) => {
          const rate = rateByCurrency.get(currency);
          const value = drafts[currency] ?? (rate ? String(rate.rateToRub) : '');
          return (
            <div key={currency} className="flex items-center justify-between gap-3 border-b border-[var(--hi-line)] py-3 last:border-b-0">
              <div>
                <div className="text-[length:var(--hi-text-body)] font-semibold text-[var(--hi-text)]">{currency}</div>
                {rate?.updatedAt && (
                  <div className="text-[length:var(--hi-text-micro)] text-[var(--hi-text-3)]">
                    обновлён {rate.updatedAt.toLocaleDateString('ru-RU')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [currency]: e.target.value.replace(/[^0-9.,]/g, '') }))}
                  onBlur={() => commit(currency)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commit(currency);
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="курс"
                  aria-label={`Курс ${currency} к рублю`}
                  className="h-10 w-24 rounded-xl border border-[var(--hi-line)] bg-[var(--hi-void)] px-3 text-right text-base text-[var(--hi-text)] outline-none placeholder:text-[var(--hi-text-3)] focus:border-[var(--hi-gold-deep)]"
                />
                <span className="text-[length:var(--hi-text-caption)] text-[var(--hi-text-3)]">₽</span>
              </div>
            </div>
          );
        })}
      </Card>
    </Section>
  );
}
