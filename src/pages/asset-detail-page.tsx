import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CalendarClock, ChevronRight, History, PencilLine, RotateCcw } from 'lucide-react';
import { withViewTransition } from '@/lib/view-transition';
import { AppShell } from '@/components/layout/app-shell';
import { SummaryCard } from '@/components/shared/summary-card';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';
import { EditValueSheet } from '@/components/shared/edit-value-sheet';
import { Card, ListRow, Section, EmptyState } from '@/components/ds/surface';
import { SourceBadge } from '@/components/ds/badge';
import { BottomSheet } from '@/components/ds/bottom-sheet';
import { Button } from '@/components/ds/button';
import { Hint } from '@/components/ds/hint';
import { useAsset, updateAsset } from '@/hooks/use-assets';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { usePaymentHistory } from '@/hooks/use-payment-history';
import { useHoldingsByAsset } from '@/hooks/use-holdings';
import { useAccounts } from '@/hooks/use-accounts';
import { calcAssetAnnualIncomePerUnit } from '@/services/income-calculator';
import { incomeSpreadOf, isExchangeTraded } from '@/models/asset-kind';
import {
  cn, formatCurrency, formatCurrencyFull, formatFrequency, formatLongDate, formatMoney, formatNumber, formatNumericDate, formatPrice,
} from '@/lib/utils';

const FREQUENCIES = [12, 4, 2, 1];

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assetId = Number(id);
  const asset = useAsset(assetId);
  const { assetsById, projection } = usePortfolioStats();
  const history = usePaymentHistory(assetId);
  const holdings = useHoldingsByAsset(assetId);
  const accounts = useAccounts();
  const [editIncome, setEditIncome] = useState(false);
  const [editFrequency, setEditFrequency] = useState(false);

  const computed = useMemo(() => {
    if (!asset) return null;
    const records = history.filter((h) => !h.isForecast).map((h) => ({ amount: h.amount, date: new Date(h.date) }));
    const spread = incomeSpreadOf(asset);
    const calculated = calcAssetAnnualIncomePerUnit({ ...asset, paymentPerUnitSource: 'fact' }, spread, records, new Date());
    const annualIncome = asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null ? asset.paymentPerUnit : calculated.annualIncome;
    const totalQuantity = holdings.reduce((sum, h) => sum + h.quantity, 0);
    const costBasis = holdings.reduce((sum, h) => sum + (h.averagePrice ?? 0) * h.quantity, 0);
    const next = projection.find((p) => p.assetId === assetId);
    return {
      spread,
      calculated,
      annualIncome,
      totalQuantity,
      costBasis,
      next,
      stats: assetsById.get(assetId),
      chartHistory: history
        .filter((h) => !(h.isForecast && h.amount <= 0))
        .map((h) => ({ amount: h.amount, date: new Date(h.date), isForecast: h.isForecast })),
    };
  }, [asset, history, holdings, assetsById, projection, assetId]);

  if (!asset || !computed) {
    return (
      <AppShell back="/">
        {asset === undefined ? <div className="hi-skeleton mt-4 h-48 rounded-[22px]" /> : <EmptyState title="Актив не найден" />}
      </AppShell>
    );
  }

  const { spread, calculated, annualIncome, totalQuantity, costBasis, next, stats } = computed;
  const isManual = asset.paymentPerUnitSource === 'manual';
  const currency = asset.currency ?? 'RUB';
  const exchange = isExchangeTraded(asset);
  const price = asset.currentPrice;
  const identifiers = [asset.ticker, asset.isin && asset.isin !== asset.ticker ? asset.isin : null, asset.type].filter(Boolean).join(' · ');

  const openData = () =>
    withViewTransition(() => navigate('/data', {
      state: holdings.length > 0 ? { highlightAccountId: holdings[0].accountId, highlightAssetId: assetId } : undefined,
    }));
  const openPayments = () => withViewTransition(() => navigate('/payments', { state: { highlightAssetId: assetId } }));

  const incomeExplanation = isManual
    ? 'Указано вручную'
    : spread === 'period'
      ? `Последняя выплата × ${asset.frequencyPerYear} (${formatFrequency(asset.frequencyPerYear)})`
      : calculated.usedPayments.length > 0
        ? `Сумма ${calculated.usedPayments.length} ${calculated.usedPayments.length === 1 ? 'выплаты' : 'выплат'} за 12 месяцев`
        : 'За последние 12 месяцев выплат не было';

  return (
    <AppShell back={`/category/${encodeURIComponent(asset.type)}`} title={asset.name} subtitle={identifiers}>
      <SummaryCard
        incomePerMonth={stats?.incomePerMonth ?? 0}
        totalValue={stats?.value ?? 0}
        yieldPercent={stats?.yieldPercent ?? null}
        portfolioSharePercent={stats?.portfolioSharePercent ?? null}
        badges={<SourceBadge source={isManual ? 'manual' : 'fact'} />}
      />

      <Section title="Доход на 1 бумагу" className="mt-8">
        <Card className="overflow-hidden">
          <button
            type="button"
            onClick={() => setEditIncome(true)}
            className="hi-pressable flex w-full items-start gap-3 px-4 py-4 text-left active:bg-[var(--hi-raised)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-semibold text-[var(--hi-text)]">
                  {annualIncome > 0 ? formatPrice(annualIncome, currency) : '—'}
                </span>
                <span className="text-[length:var(--hi-text-caption)] text-[var(--hi-text-3)]">в год до НДФЛ</span>
              </div>
              <div className="mt-1 text-[length:var(--hi-text-caption)] text-[var(--hi-text-3)]">{incomeExplanation}</div>
            </div>
            <span className="mt-1 inline-flex items-center gap-1 text-[length:var(--hi-text-caption)] font-semibold text-[var(--hi-gold)]">
              <PencilLine className="size-3.5" /> Изменить
            </span>
          </button>

          {!isManual && calculated.usedPayments.length > 0 && (
            <div className="border-t border-[var(--hi-line)] px-4 py-3">
              {calculated.usedPayments.map((p, i) => (
                <div key={i} className="flex justify-between py-0.5 text-[length:var(--hi-text-caption)]">
                  <span className="text-[var(--hi-text-3)]">{formatNumericDate(p.date)}</span>
                  <span className="text-[var(--hi-text-2)]">{formatPrice(p.amount, currency)}</span>
                </div>
              ))}
            </div>
          )}

          {isManual && (
            <button
              type="button"
              onClick={() => updateAsset(assetId, { paymentPerUnitSource: 'fact', paymentPerUnit: undefined })}
              className="hi-pressable flex w-full items-center gap-2 border-t border-[var(--hi-line)] px-4 py-3 text-left text-[length:var(--hi-text-caption)] font-semibold text-[var(--hi-gold)] active:bg-[var(--hi-raised)]"
            >
              <RotateCcw className="size-3.5" /> Вернуть расчёт по фактическим выплатам
              {calculated.annualIncome > 0 && (
                <span className="ml-auto font-medium text-[var(--hi-text-3)]">{formatPrice(calculated.annualIncome, currency)}</span>
              )}
            </button>
          )}

          <ListRow
            title="Периодичность выплат"
            subtitle={
              exchange
                ? 'По данным биржи'
                : spread === 'period'
                  ? 'Выплата покрывает свой период'
                  : 'Выплата делится на 12 месяцев'
            }
            trailing={
              <span className="text-[length:var(--hi-text-caption)] font-semibold text-[var(--hi-text-2)]">
                {formatFrequency(asset.frequencyPerYear)}
              </span>
            }
            chevron={!exchange}
            onClick={exchange ? undefined : () => setEditFrequency(true)}
            className="border-t border-[var(--hi-line)]"
          />
        </Card>
      </Section>

      <Hint id="asset-income" className="mt-4">
        {exchange
          ? 'Доход бумаги — сумма выплат за последние 12 месяцев. Если знаете точнее (например, объявлен новый дивиденд), укажите годовой доход вручную.'
          : 'Записывайте поступления во вкладке «Выплаты» — каждое покрывает свой период, и месячный доход сразу будет полным. Или просто укажите доход в год.'}
      </Hint>

      {next && (
        <Section title="Следующая выплата" className="mt-8">
          <Card glow className="flex items-center gap-4 px-4 py-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(217,192,142,0.3)] bg-[var(--hi-gold-tint)] text-[var(--hi-gold)]">
              <CalendarClock className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[length:var(--hi-text-body)] font-semibold text-[var(--hi-text)]">{formatLongDate(next.date)}</div>
              <div className="mt-0.5 text-[length:var(--hi-text-caption)] text-[var(--hi-text-3)]">
                {formatPrice(next.perUnit, currency)} на бумагу · {next.announced ? 'объявлено' : next.estimated ? 'оценка' : 'ожидается'}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[length:var(--hi-text-body)] font-semibold text-[var(--hi-positive)]">+{formatCurrencyFull(next.amount)}</div>
              <div className="mt-0.5 text-[length:var(--hi-text-micro)] text-[var(--hi-text-3)]">после НДФЛ</div>
            </div>
          </Card>
        </Section>
      )}

      <Section title="Позиция" className="mt-8">
        <Card className="overflow-hidden">
          <ListRow
            title="Количество"
            subtitle={holdings.length > 1 ? holdings.map((h) => `${accounts.find((a) => a.id === h.accountId)?.name ?? 'Счёт'}: ${formatNumber(h.quantity)}`).join(' · ') : undefined}
            trailing={<span className="font-semibold text-[var(--hi-text)]">{formatNumber(totalQuantity)} шт</span>}
            chevron
            onClick={openData}
          />
          <ListRow
            title="Текущая цена"
            subtitle={exchange && price != null ? 'Мосбиржа' : undefined}
            trailing={<span className="font-semibold text-[var(--hi-text)]">{formatPrice(price, currency)}</span>}
          />
          <ListRow
            title="Стоимость"
            trailing={<span className="font-semibold text-[var(--hi-text)]">{formatCurrency(stats?.value ?? null)}</span>}
          />
          {costBasis > 0 && (
            <ListRow
              title="Куплено за"
              subtitle={stats && stats.value > 0 ? `Доход на вложенное: ${((annualIncome * totalQuantity) / costBasis * 100).toFixed(1).replace('.', ',')}% годовых` : undefined}
              trailing={<span className="font-semibold text-[var(--hi-text)]">{formatMoney(costBasis, currency)}</span>}
            />
          )}
        </Card>
      </Section>

      <Section title="История" className="mt-8">
        <PaymentHistoryChart history={computed.chartHistory} currency={currency} />
        <Button variant="secondary" block className="mt-3" icon={<History />} onClick={openPayments}>
          Все выплаты <ChevronRight className="ml-auto text-[var(--hi-text-3)]" />
        </Button>
      </Section>

      <EditValueSheet
        open={editIncome}
        onOpenChange={setEditIncome}
        title="Доход на 1 бумагу"
        description="Сумма всех выплат за год на одну бумагу (или на объект), до НДФЛ."
        label={`В год, ${currency === 'RUB' ? '₽' : currency}`}
        suffix={currency === 'RUB' ? '₽' : currency}
        initialValue={annualIncome || null}
        hint={!isManual && calculated.annualIncome > 0 ? `По факту: ${formatPrice(calculated.annualIncome, currency)}` : undefined}
        onSave={(v) => {
          if (v == null) return;
          return updateAsset(assetId, { paymentPerUnit: v, paymentPerUnitSource: 'manual' });
        }}
        resetLabel={isManual ? 'Вернуть расчёт по факту' : undefined}
        onReset={isManual ? () => updateAsset(assetId, { paymentPerUnitSource: 'fact', paymentPerUnit: undefined }) : undefined}
      />

      <BottomSheet
        open={editFrequency}
        onOpenChange={setEditFrequency}
        title="Периодичность"
        description="Как часто приходят выплаты. Каждая выплата учитывается в доходе на свой период — например, месячная аренда сразу даёт полный месячный доход."
      >
        <Card className="overflow-hidden">
          {FREQUENCIES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={async () => {
                await updateAsset(assetId, { frequencyPerYear: f, frequencySource: 'manual' });
                setEditFrequency(false);
              }}
              className={cn(
                'hi-pressable relative flex w-full items-center justify-between px-4 py-4 text-left text-[length:var(--hi-text-body)] active:bg-[var(--hi-raised)]',
                'after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-[var(--hi-line)] last:after:hidden',
                asset.frequencyPerYear === f ? 'text-[var(--hi-gold)] font-semibold' : 'text-[var(--hi-text)]',
              )}
            >
              <span className="first-letter:uppercase">{formatFrequency(f)}</span>
              {asset.frequencyPerYear === f && <span className="size-2 rounded-full bg-[var(--hi-gold)]" />}
            </button>
          ))}
        </Card>
      </BottomSheet>
    </AppShell>
  );
}
