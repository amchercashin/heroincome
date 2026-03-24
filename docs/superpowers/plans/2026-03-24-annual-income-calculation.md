# Annual Income Calculation Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace sliding-window `paymentPerUnit × frequencyPerYear` with "last N payments" approach — `annualIncomePerUnit × quantity`.

**Architecture:** New `calcAnnualIncomePerUnit` returns `{ annualIncome, usedPayments[] }`. Income formula simplifies from 3 args to 2. DB migration converts existing manual values from per-payment to annual. UI shows breakdown of payments used in fact calculation.

**Tech Stack:** TypeScript, Vitest, React, Dexie (IndexedDB)

**Spec:** `docs/superpowers/specs/2026-03-24-annual-income-calculation-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/services/income-calculator.ts` | New `calcAnnualIncomePerUnit`, simplify income functions to 2-arg |
| Modify | `tests/services/income-calculator.test.ts` | Rewrite tests for new signatures |
| Modify | `src/db/database.ts` | V6 migration: manual paymentPerUnit × freq |
| Modify | `src/hooks/use-portfolio-stats.ts` | Use `calcAnnualIncomePerUnit`, drop freq from formula |
| Modify | `src/pages/category-page.tsx` | Same — annual income, rename prop |
| Modify | `src/components/category/asset-row.tsx` | Rename prop, simplify income calc, fix isManual |
| Modify | `src/services/import-applier.ts` | Convert per-payment → annual on store |
| Modify | `src/pages/asset-detail-page.tsx` | New label, breakdown rows, remove freq field |
| Modify | `src/components/shared/payment-history-chart.tsx` | Drop frequencyPerYear prop, fix fallback |
| Modify | `src/components/asset-detail/expected-payment.tsx` | Derive per-payment from annual |

---

### Task 1: Core algorithm — tests

**Files:**
- Modify: `tests/services/income-calculator.test.ts`

- [ ] **Step 1: Rewrite `calcAnnualIncomePerUnit` tests (replacing `calcFactPaymentPerUnit`)**

Replace entire `calcFactPaymentPerUnit` describe block and related edge cases with:

```typescript
import {
  calcAssetIncomePerYear,
  calcAssetIncomePerMonth,
  calcPortfolioIncome,
  calcYieldPercent,
  calcCAGR,
  calcAnnualIncomePerUnit,
} from '@/services/income-calculator';

// ... keep calcYieldPercent and calcCAGR tests unchanged ...

describe('calcAnnualIncomePerUnit', () => {
  it('Lukoil (freq=2): sums last 2 payments', () => {
    const history = [
      { amount: 514, date: new Date('2025-07-15') },
      { amount: 793, date: new Date('2024-12-20') },
      { amount: 447, date: new Date('2024-07-10') },
    ];
    const result = calcAnnualIncomePerUnit(history, 2, new Date('2026-03-16'));
    expect(result.annualIncome).toBe(1307);
    expect(result.usedPayments).toHaveLength(2);
    expect(result.usedPayments[0].amount).toBe(514);
    expect(result.usedPayments[1].amount).toBe(793);
  });

  it('bond (freq=4): sums last 4 coupons', () => {
    const history = [
      { amount: 30, date: new Date('2026-01-15') },
      { amount: 30, date: new Date('2025-10-15') },
      { amount: 30, date: new Date('2025-07-15') },
      { amount: 30, date: new Date('2025-04-15') },
      { amount: 30, date: new Date('2025-01-15') },
    ];
    const result = calcAnnualIncomePerUnit(history, 4, new Date('2026-03-16'));
    expect(result.annualIncome).toBe(120);
    expect(result.usedPayments).toHaveLength(4);
  });

  it('annual stock (freq=1): takes last 1 payment', () => {
    const history = [
      { amount: 186, date: new Date('2025-07-15') },
      { amount: 150, date: new Date('2024-07-15') },
    ];
    const result = calcAnnualIncomePerUnit(history, 1, new Date('2026-03-16'));
    expect(result.annualIncome).toBe(186);
    expect(result.usedPayments).toHaveLength(1);
  });

  it('monthly rent (freq=12): sums last 12 payments', () => {
    const history = Array.from({ length: 14 }, (_, i) => ({
      amount: 45000 + i * 100,
      date: new Date(2025, 1 + i, 1),
    }));
    const result = calcAnnualIncomePerUnit(history, 12, new Date('2026-03-16'));
    expect(result.annualIncome).toBeGreaterThan(0);
    expect(result.usedPayments).toHaveLength(12);
  });

  it('returns 0 for empty history', () => {
    const result = calcAnnualIncomePerUnit([], 2, new Date('2026-03-16'));
    expect(result.annualIncome).toBe(0);
    expect(result.usedPayments).toHaveLength(0);
  });

  it('returns 0 when stale (>18 months ago)', () => {
    const history = [{ amount: 500, date: new Date('2024-01-01') }];
    const result = calcAnnualIncomePerUnit(history, 1, new Date('2026-03-16'));
    expect(result.annualIncome).toBe(0);
    expect(result.usedPayments).toHaveLength(0);
  });

  it('returns 0 for freq=0 (Валюта/Прочее)', () => {
    const history = [{ amount: 100, date: new Date('2025-09-01') }];
    const result = calcAnnualIncomePerUnit(history, 0, new Date('2026-03-16'));
    expect(result.annualIncome).toBe(0);
    expect(result.usedPayments).toHaveLength(0);
  });

  it('returns 0 for negative frequency', () => {
    const history = [{ amount: 100, date: new Date('2025-09-01') }];
    const result = calcAnnualIncomePerUnit(history, -1, new Date('2026-03-16'));
    expect(result.annualIncome).toBe(0);
    expect(result.usedPayments).toHaveLength(0);
  });

  it('fewer payments than freq: takes what is available', () => {
    const history = [{ amount: 500, date: new Date('2025-07-15') }];
    const result = calcAnnualIncomePerUnit(history, 2, new Date('2026-03-16'));
    expect(result.annualIncome).toBe(500);
    expect(result.usedPayments).toHaveLength(1);
  });

  it('boundary: exactly 18 months ago is NOT stale', () => {
    const now = new Date('2026-03-16');
    const exactly18MonthsAgo = new Date(now);
    exactly18MonthsAgo.setMonth(exactly18MonthsAgo.getMonth() - 18);
    const history = [{ amount: 500, date: exactly18MonthsAgo }];
    const result = calcAnnualIncomePerUnit(history, 1, now);
    expect(result.annualIncome).toBe(500);
  });

  it('usedPayments sorted by date descending (newest first)', () => {
    const history = [
      { amount: 30, date: new Date('2025-04-15') },
      { amount: 30, date: new Date('2025-10-15') },
      { amount: 30, date: new Date('2025-07-15') },
    ];
    const result = calcAnnualIncomePerUnit(history, 4, new Date('2026-03-16'));
    expect(result.usedPayments[0].date.getTime()).toBeGreaterThan(result.usedPayments[1].date.getTime());
  });
});
```

- [ ] **Step 2: Update `calcAssetIncomePerYear` and `calcAssetIncomePerMonth` tests to 2-arg**

```typescript
describe('calcAssetIncomePerYear', () => {
  it('calculates annual income: quantity × annualIncomePerUnit', () => {
    expect(calcAssetIncomePerYear(800, 186)).toBe(148800);
  });
  it('returns 0 for NaN inputs', () => {
    expect(calcAssetIncomePerYear(800, NaN)).toBe(0);
    expect(calcAssetIncomePerYear(NaN, 186)).toBe(0);
    expect(calcAssetIncomePerYear(Infinity, 186)).toBe(0);
  });
});

describe('calcAssetIncomePerMonth', () => {
  it('divides annual by 12', () => {
    expect(calcAssetIncomePerMonth(800, 186)).toBeCloseTo(12400, 0);
  });
  it('returns 0 for NaN inputs', () => {
    expect(calcAssetIncomePerMonth(NaN, 186)).toBe(0);
  });
});

describe('calcPortfolioIncome', () => {
  it('sums annual income across assets', () => {
    const items = [
      { quantity: 800, annualIncome: 186 },
      { quantity: 500, annualIncome: 73.8 },
      { quantity: 1, annualIncome: 540000 },
    ];
    const result = calcPortfolioIncome(items);
    expect(result.perYear).toBeCloseTo(800*186 + 500*73.8 + 540000, 0);
    expect(result.perMonth).toBeCloseTo(result.perYear / 12, 0);
  });
  it('returns zero for empty portfolio', () => {
    const result = calcPortfolioIncome([]);
    expect(result.perYear).toBe(0);
    expect(result.perMonth).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests — all new tests should FAIL**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: FAIL — `calcAnnualIncomePerUnit` not exported, `calcAssetIncomePerYear` wrong arg count

- [ ] **Step 4: Commit test file**

```bash
git add tests/services/income-calculator.test.ts
git commit -m "test: rewrite income-calculator tests for annual income approach"
```

---

### Task 2: Core algorithm — implementation

**Files:**
- Modify: `src/services/income-calculator.ts`

- [ ] **Step 1: Replace `calcFactPaymentPerUnit` with `calcAnnualIncomePerUnit`**

Replace the entire function (lines 70-98) with:

```typescript
export interface AnnualIncomeResult {
  annualIncome: number;
  usedPayments: PaymentRecord[];
}

/**
 * Estimates annual income per unit from payment history.
 * Takes the last N payments (N = frequencyPerYear) and sums them.
 * Returns 0 if data is stale (>18 months) or frequency <= 0.
 */
export function calcAnnualIncomePerUnit(
  history: PaymentRecord[],
  frequencyPerYear: number,
  now: Date = new Date(),
): AnnualIncomeResult {
  const empty = { annualIncome: 0, usedPayments: [] as PaymentRecord[] };
  if (history.length === 0 || frequencyPerYear <= 0) return empty;

  const sorted = [...history].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Staleness guard: most recent payment > 18 months ago
  const eighteenMonthsAgo = new Date(now);
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
  if (sorted[0].date < eighteenMonthsAgo) return empty;

  const n = Math.min(frequencyPerYear, sorted.length);
  const usedPayments = sorted.slice(0, n);
  const annualIncome = usedPayments.reduce((sum, p) => sum + p.amount, 0);

  return { annualIncome, usedPayments };
}
```

- [ ] **Step 2: Simplify `calcAssetIncomePerYear` to 2 args**

```typescript
export function calcAssetIncomePerYear(
  quantity: number,
  annualIncomePerUnit: number,
): number {
  const result = quantity * annualIncomePerUnit;
  return isFinite(result) ? result : 0;
}
```

- [ ] **Step 3: Simplify `calcAssetIncomePerMonth` to 2 args**

```typescript
export function calcAssetIncomePerMonth(
  quantity: number,
  annualIncomePerUnit: number,
): number {
  return calcAssetIncomePerYear(quantity, annualIncomePerUnit) / 12;
}
```

- [ ] **Step 4: Update `IncomeItem` and `calcPortfolioIncome`**

```typescript
interface IncomeItem {
  quantity: number;
  annualIncome: number;
}

export function calcPortfolioIncome(items: IncomeItem[]): {
  perYear: number;
  perMonth: number;
} {
  const perYear = items.reduce(
    (sum, item) => sum + calcAssetIncomePerYear(item.quantity, item.annualIncome),
    0,
  );
  return { perYear, perMonth: perYear / 12 };
}
```

- [ ] **Step 5: Run tests — should pass**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/income-calculator.ts
git commit -m "feat: replace sliding-window with last-N annual income calculation"
```

---

### Task 3: DB migration

**Files:**
- Modify: `src/db/database.ts`

- [ ] **Step 1: Add version 6 migration**

After the `.version(5)` block (after line 98), add:

```typescript
this.version(6)
  .stores({
    accounts: '++id',
    assets: '++id, type, ticker, isin',
    holdings: '++id, accountId, assetId, &[accountId+assetId]',
    paymentHistory: '++id, [assetId+date]',
    importRecords: '++id, date',
    settings: 'key',
  })
  .upgrade(async (tx) => {
    // paymentPerUnit semantics change: per-payment → annual
    // Multiply manual values by frequencyPerYear
    await tx.table('assets').toCollection().modify((asset: Record<string, unknown>) => {
      if (
        asset.paymentPerUnitSource === 'manual' &&
        asset.paymentPerUnit != null &&
        typeof asset.frequencyPerYear === 'number' &&
        asset.frequencyPerYear > 0
      ) {
        asset.paymentPerUnit = (asset.paymentPerUnit as number) * (asset.frequencyPerYear as number);
      }
    });
  });
```

- [ ] **Step 2: Run build to check for TS errors**

Run: `npm run build`
Expected: Build may fail due to consumers still using old 3-arg signatures — that's expected at this stage

- [ ] **Step 3: Commit**

```bash
git add src/db/database.ts
git commit -m "feat: v6 migration — convert manual paymentPerUnit to annual"
```

---

### Task 4: Data consumers — use-portfolio-stats.ts

**Files:**
- Modify: `src/hooks/use-portfolio-stats.ts`

- [ ] **Step 1: Update imports and resolver**

Replace full file content. Key changes:
- Import `calcAnnualIncomePerUnit` instead of `calcFactPaymentPerUnit`
- `resolveAnnualIncome` returns `number` (annual figure)
- `calcAssetIncomePerMonth` takes 2 args

```typescript
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { PortfolioStats, CategoryStats } from '@/models/types';
import { calcAnnualIncomePerUnit, calcAssetIncomePerMonth, calcYieldPercent, type PaymentRecord } from '@/services/income-calculator';
import { useAllPaymentHistory } from './use-payment-history';

export function usePortfolioStats(): {
  portfolio: PortfolioStats;
  categories: CategoryStats[];
} {
  const assets = useLiveQuery(() => db.assets.toArray(), [], []);
  const holdings = useLiveQuery(() => db.holdings.toArray(), [], []);
  const allHistory = useAllPaymentHistory();

  const { portfolio, categories } = useMemo(() => {
    const now = new Date();

    const quantityByAsset = new Map<number, number>();
    for (const h of holdings) {
      quantityByAsset.set(h.assetId, (quantityByAsset.get(h.assetId) ?? 0) + h.quantity);
    }

    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      if (h.excluded) continue;
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }

    const resolveAnnualIncome = (asset: (typeof assets)[number]): number => {
      if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
        return asset.paymentPerUnit; // already annual after migration
      }
      const history = historyByAsset.get(asset.id!) ?? [];
      return calcAnnualIncomePerUnit(history, asset.frequencyPerYear, now).annualIncome;
    };

    let totalValue = 0;
    let totalIncomePerMonth = 0;
    const categoryMap = new Map<string, { value: number; incomePerMonth: number; count: number }>();

    for (const asset of assets) {
      const totalQuantity = quantityByAsset.get(asset.id!) ?? 0;
      const price = asset.currentPrice ?? 0;
      const assetValue = price * totalQuantity;
      totalValue += assetValue;

      const annualIncome = resolveAnnualIncome(asset);
      const assetIncomePerMonth = calcAssetIncomePerMonth(totalQuantity, annualIncome);
      totalIncomePerMonth += assetIncomePerMonth;

      const cat = categoryMap.get(asset.type);
      if (cat) {
        cat.value += assetValue;
        cat.incomePerMonth += assetIncomePerMonth;
        cat.count += 1;
      } else {
        categoryMap.set(asset.type, { value: assetValue, incomePerMonth: assetIncomePerMonth, count: 1 });
      }
    }

    const totalIncomePerYear = totalIncomePerMonth * 12;
    const yieldPercent = totalValue > 0 ? calcYieldPercent(totalIncomePerYear, totalValue) : 0;

    const portfolio: PortfolioStats = { totalIncomePerMonth, totalIncomePerYear, totalValue, yieldPercent };

    const categories: CategoryStats[] = [];
    for (const [type, cat] of categoryMap) {
      const catIncomePerYear = cat.incomePerMonth * 12;
      categories.push({
        type, assetCount: cat.count,
        totalIncomePerMonth: cat.incomePerMonth, totalIncomePerYear: catIncomePerYear,
        totalValue: cat.value,
        yieldPercent: cat.value > 0 ? calcYieldPercent(catIncomePerYear, cat.value) : 0,
        portfolioSharePercent: totalValue > 0 ? (cat.value / totalValue) * 100 : 0,
      });
    }
    categories.sort((a, b) => b.totalIncomePerMonth - a.totalIncomePerMonth);

    return { portfolio, categories };
  }, [assets, holdings, allHistory]);

  return { portfolio, categories };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-portfolio-stats.ts
git commit -m "refactor: use-portfolio-stats — annual income, drop freq from formula"
```

---

### Task 5: Data consumers — asset-row.tsx and category-page.tsx

**Files:**
- Modify: `src/components/category/asset-row.tsx`
- Modify: `src/pages/category-page.tsx`

- [ ] **Step 1: Update `asset-row.tsx` — rename prop, simplify calc, fix isManual**

```typescript
import { TransitionLink } from '@/components/ui/transition-link';
import type { Asset } from '@/models/types';
import { formatCurrency } from '@/lib/utils';
import { calcAssetIncomePerMonth } from '@/services/income-calculator';

interface AssetRowProps {
  asset: Asset;
  annualIncome: number;
  totalQuantity: number;
}

export function AssetRow({ asset, annualIncome, totalQuantity }: AssetRowProps) {
  const incomePerMonth = calcAssetIncomePerMonth(totalQuantity, annualIncome);
  const value = asset.currentPrice != null
    ? asset.currentPrice * totalQuantity
    : null;

  const isManual = asset.paymentPerUnitSource === 'manual';

  return (
    <TransitionLink
      to={`/asset/${asset.id}`}
      className="block py-3 border-b border-[rgba(200,180,140,0.04)] transition-colors active:bg-[var(--way-stone)]"
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[length:var(--way-text-body)] font-medium text-[var(--way-text)]">{asset.name}</div>
          {(asset.ticker || asset.isin) && (
            <div className="text-[length:var(--way-text-caption)] text-[var(--way-muted)] mt-0.5">
              {[asset.ticker, asset.isin].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[length:var(--way-text-body)] font-medium text-[var(--way-gold)]">{formatCurrency(incomePerMonth)}</span>
          <span className={`font-mono text-[length:var(--way-text-caption)] px-1.5 py-0.5 rounded ${
            isManual
              ? 'bg-[rgba(90,85,72,0.15)] text-[var(--way-ash)]'
              : 'bg-[rgba(200,180,140,0.1)] text-[var(--way-gold)]'
          }`}>
            {isManual ? 'ручной' : 'факт'}
          </span>
        </div>
      </div>
      <div className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)] mt-1">
        {totalQuantity} шт · {formatCurrency(value)}
      </div>
    </TransitionLink>
  );
}
```

- [ ] **Step 2: Update `category-page.tsx` — use `calcAnnualIncomePerUnit`, pass `annualIncome` prop**

```typescript
import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { withViewTransition } from '@/lib/view-transition';
import { useLiveQuery } from 'dexie-react-hooks';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { AssetRow } from '@/components/category/asset-row';
import { useAssetsByType } from '@/hooks/use-assets';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { useAllPaymentHistory } from '@/hooks/use-payment-history';
import { calcAnnualIncomePerUnit, type PaymentRecord } from '@/services/income-calculator';
import { db } from '@/db/database';

export function CategoryPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const decodedType = decodeURIComponent(type ?? '');
  const assets = useAssetsByType(decodedType);
  const { categories } = usePortfolioStats();
  const allHistory = useAllPaymentHistory();
  const holdings = useLiveQuery(() => db.holdings.toArray(), [], []);

  const catStats = categories.find((c) => c.type === decodedType);

  const quantityByAsset = useMemo(() => {
    const map = new Map<number, number>();
    for (const h of holdings) {
      map.set(h.assetId, (map.get(h.assetId) ?? 0) + h.quantity);
    }
    return map;
  }, [holdings]);

  const { historyByAsset, now } = useMemo(() => {
    const now = new Date();
    const historyByAsset = new Map<number, PaymentRecord[]>();
    for (const h of (allHistory ?? [])) {
      if (h.excluded) continue;
      const arr = historyByAsset.get(h.assetId) ?? [];
      arr.push({ amount: h.amount, date: new Date(h.date) });
      historyByAsset.set(h.assetId, arr);
    }
    return { historyByAsset, now };
  }, [allHistory]);

  const backButton = (
    <button onClick={() => withViewTransition(() => navigate(-1))} className="text-[var(--way-ash)] text-[length:var(--way-text-nav)] min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Назад">
      ‹
    </button>
  );

  return (
    <AppShell leftAction={backButton} title={decodedType}>
      {catStats && (
        <StatBlocks
          incomePerMonth={catStats.totalIncomePerMonth}
          totalValue={catStats.totalValue}
          yieldPercent={catStats.yieldPercent}
          portfolioSharePercent={catStats.portfolioSharePercent}
        />
      )}

      {assets.map((asset) => {
        let annualIncome: number;
        if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
          annualIncome = asset.paymentPerUnit;
        } else {
          const history = historyByAsset.get(asset.id!) ?? [];
          annualIncome = calcAnnualIncomePerUnit(history, asset.frequencyPerYear, now).annualIncome;
        }
        return <AssetRow key={asset.id} asset={asset} annualIncome={annualIncome} totalQuantity={quantityByAsset.get(asset.id!) ?? 0} />;
      })}
    </AppShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/category/asset-row.tsx src/pages/category-page.tsx
git commit -m "refactor: asset-row and category-page — annual income prop"
```

---

### Task 6: Import applier — annual conversion

**Files:**
- Modify: `src/services/import-applier.ts`

- [ ] **Step 1: Update `createAsset` — multiply lastPaymentAmount by freq**

In `createAsset` function, change line 94:

```typescript
// Old:
paymentPerUnit: row.lastPaymentAmount ?? undefined,

// New:
paymentPerUnit: row.lastPaymentAmount != null ? row.lastPaymentAmount * freq : undefined,
```

- [ ] **Step 2: Update `updateAssetFields` — read asset freq from DB**

Replace lines 112-115:

```typescript
// Old:
if (row.lastPaymentAmount != null) {
  updates.paymentPerUnit = row.lastPaymentAmount;
  updates.paymentPerUnitSource = 'manual';
}

// New:
if (row.lastPaymentAmount != null) {
  const existingAsset = await db.assets.get(assetId);
  const freq = existingAsset?.frequencyPerYear ?? row.frequencyPerYear ?? getDefaultFrequency(row.type) ?? 12;
  updates.paymentPerUnit = row.lastPaymentAmount * freq;
  updates.paymentPerUnitSource = 'manual';
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/import-applier.ts
git commit -m "refactor: import-applier — convert per-payment to annual on store"
```

---

### Task 7: Asset detail page — new UI

**Files:**
- Modify: `src/pages/asset-detail-page.tsx`

- [ ] **Step 1: Rewrite the page**

Key changes:
- Import `calcAnnualIncomePerUnit` instead of `calcFactPaymentPerUnit`
- Destructure `annualIncome` + `usedPayments` in computed memo
- New label "Выплата на шт. / год"
- Remove "Выплат в год" field
- Remove `handleSaveFrequency`
- Remove "история выплат →" link
- Add tappable payment breakdown rows for fact source
- Simplify `isManual`
- `calcAssetIncomePerMonth` takes 2 args

```typescript
import { useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { withViewTransition } from '@/lib/view-transition';
import { AppShell } from '@/components/layout/app-shell';
import { StatBlocks } from '@/components/shared/stat-blocks';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';
import { AssetField } from '@/components/asset-detail/asset-field';
import { ExpectedPayment } from '@/components/asset-detail/expected-payment';
import { useAsset, updateAsset } from '@/hooks/use-assets';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { usePaymentHistory } from '@/hooks/use-payment-history';
import { useHoldingsByAsset } from '@/hooks/use-holdings';
import { useAccounts } from '@/hooks/use-accounts';
import { calcAnnualIncomePerUnit, calcAssetIncomePerMonth, calcYieldPercent, type PaymentRecord } from '@/services/income-calculator';

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const assetId = Number(id);
  const asset = useAsset(assetId);
  const { portfolio } = usePortfolioStats();
  const history = usePaymentHistory(assetId);
  const holdings = useHoldingsByAsset(assetId);
  const accounts = useAccounts();

  const computed = useMemo(() => {
    if (!asset) return null;
    const now = new Date();
    const activeHistory = history.filter((h) => !h.excluded);
    const historyRecords = activeHistory.map((h) => ({ amount: h.amount, date: new Date(h.date) }));
    const allHistoryRecords = history.map((h) => ({ amount: h.amount, date: new Date(h.date), excluded: h.excluded }));

    let annualIncome: number;
    let usedPayments: PaymentRecord[] = [];
    if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
      annualIncome = asset.paymentPerUnit;
    } else {
      const result = calcAnnualIncomePerUnit(historyRecords, asset.frequencyPerYear, now);
      annualIncome = result.annualIncome;
      usedPayments = result.usedPayments;
    }

    const totalQuantity = holdings.reduce((sum, h) => sum + h.quantity, 0);
    const weightedAvgPrice = totalQuantity > 0
      ? holdings.reduce((sum, h) => sum + (h.averagePrice ?? 0) * h.quantity, 0) / totalQuantity
      : undefined;

    const incomePerMonth = calcAssetIncomePerMonth(totalQuantity, annualIncome);

    const price = asset.currentPrice ?? weightedAvgPrice ?? 0;
    const value = price * totalQuantity;
    const yieldPct = value > 0 ? calcYieldPercent(incomePerMonth * 12, value) : null;
    const sharePercent = (value > 0 && portfolio.totalValue > 0)
      ? (value / portfolio.totalValue) * 100 : null;

    const isManual = asset.paymentPerUnitSource === 'manual';

    return { annualIncome, usedPayments, incomePerMonth, value, yieldPct, sharePercent, isManual, allHistoryRecords, totalQuantity };
  }, [asset, history, holdings, portfolio.totalValue]);

  const handleSavePaymentPerUnit = useCallback((v: string) => {
    const num = parseFloat(v.replace(',', '.').replace(/[^\d.]/g, ''));
    if (isNaN(num) || num < 0) return;
    updateAsset(assetId, { paymentPerUnit: num, paymentPerUnitSource: 'manual' });
  }, [assetId]);

  if (!asset || !computed) {
    return <AppShell title="Загрузка..."><div /></AppShell>;
  }

  const { annualIncome, usedPayments, incomePerMonth, value, yieldPct, sharePercent, isManual, allHistoryRecords, totalQuantity } = computed;

  const title = asset.ticker ? `${asset.ticker} · ${asset.name}` : asset.name;

  const backButton = (
    <button onClick={() => withViewTransition(() => navigate(-1))} className="text-[var(--way-ash)] text-[length:var(--way-text-nav)] min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Назад">‹</button>
  );

  const formatShortDate = (date: Date) =>
    date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <AppShell leftAction={backButton} title={title}>
      <StatBlocks
        incomePerMonth={incomePerMonth}
        totalValue={value}
        yieldPercent={yieldPct}
        portfolioSharePercent={sharePercent}
        isManualIncome={isManual}
      />

      <div
        className="bg-[var(--way-stone)] rounded-lg p-3 mb-2 cursor-pointer hover:border-[var(--way-gold)] border border-transparent transition-colors"
        onClick={() => withViewTransition(() => navigate('/data', {
          state: holdings.length > 0
            ? { highlightAccountId: holdings[0].accountId, highlightAssetId: assetId }
            : undefined
        }))}
      >
        <div className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-ash)] mb-1">Количество</div>
        <div className="font-mono text-[length:var(--way-text-heading)] text-[var(--way-text)]">
          {totalQuantity} шт.
        </div>
        {holdings.length > 1 && (
          <div className="mt-1.5 space-y-0.5">
            {holdings.map((h) => {
              const account = accounts.find(a => a.id === h.accountId);
              return (
                <div key={h.id} className="flex justify-between text-[length:var(--way-text-body)]">
                  <span className="text-[var(--way-muted)]">{account?.name ?? 'Счёт'}</span>
                  <span className="text-[var(--way-ash)] tabular-nums">{h.quantity} шт.</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AssetField
        label="Выплата на шт. / год"
        value={annualIncome > 0 ? `₽ ${annualIncome.toLocaleString('ru-RU')}` : '— Укажите'}
        sourceLabel={asset.paymentPerUnitSource === 'fact' ? 'факт' : 'ручной'}
        isManualSource={isManual}
        subtitle={
          asset.paymentPerUnitSource === 'fact' && usedPayments.length > 0 ? (
            <div className="space-y-0.5 mt-1">
              {usedPayments.map((p, i) => (
                <button
                  key={i}
                  onClick={() => withViewTransition(() => navigate('/payments', { state: { highlightAssetId: assetId } }))}
                  className="flex justify-between w-full text-[length:var(--way-text-caption)] text-[var(--way-muted)] hover:text-[var(--way-gold)] transition-colors"
                >
                  <span>{formatShortDate(p.date)}</span>
                  <span className="flex items-center gap-1">
                    {p.amount.toLocaleString('ru-RU')} ₽
                    <span className="text-[var(--way-ash)]">›</span>
                  </span>
                </button>
              ))}
            </div>
          ) : undefined
        }
        onSave={handleSavePaymentPerUnit}
        resetLabel={isManual ? 'Вернуть факт' : undefined}
        onReset={isManual ? () => updateAsset(assetId, {
          paymentPerUnitSource: 'fact',
          paymentPerUnit: undefined,
        }) : undefined}
      />

      <PaymentHistoryChart
        history={allHistoryRecords}
        paymentPerUnit={annualIncome}
      />

      <ExpectedPayment
        annualIncomePerUnit={annualIncome}
        frequencyPerYear={asset.frequencyPerYear}
        nextExpectedDate={asset.nextExpectedDate}
      />
    </AppShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/asset-detail-page.tsx
git commit -m "feat: asset-detail — annual label, payment breakdown, remove freq field"
```

---

### Task 8: Supporting components — chart and expected payment

**Files:**
- Modify: `src/components/shared/payment-history-chart.tsx`
- Modify: `src/components/asset-detail/expected-payment.tsx`

- [ ] **Step 1: Update `payment-history-chart.tsx` — drop frequencyPerYear prop**

In the interface (line 10-14), remove `frequencyPerYear`:

```typescript
interface PaymentHistoryChartProps {
  history: ChartPaymentRecord[];
  paymentPerUnit?: number; // now annual income per unit
}
```

Update the component signature (line 20-24):

```typescript
export function PaymentHistoryChart({
  history,
  paymentPerUnit,
}: PaymentHistoryChartProps) {
```

Update fallback logic (lines 64-69):

```typescript
const isNoHistory = history.length === 0;
const fallbackAnnual =
  isNoHistory && paymentPerUnit != null
    ? paymentPerUnit
    : null;
```

Update fallback panel (lines 134-147) — remove `frequencyPerYear` check:

```typescript
if (isNoHistory && paymentPerUnit != null) {
  return (
    <div className="bg-[#252220] border border-[rgba(200,180,140,0.1)] rounded-lg px-3 py-2.5 mt-2.5 animate-[way-panel-in_0.2s_ease]">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-gold)] font-medium">{selectedYear}</span>
        <span className="font-mono text-[length:var(--way-text-caption)] text-[#b0a898]">{formatCompact(fallbackAnnual!)} ₽ / ед.</span>
      </div>
      <div className="font-mono text-[length:var(--way-text-micro)] text-[#3a3530] italic">
        Расчётно: {formatCompact(paymentPerUnit)} ₽ / год
      </div>
    </div>
  );
}
```

Remove the `frequencyLabel` function (line 16-18) — no longer used.

- [ ] **Step 2: Update `expected-payment.tsx` — derive per-payment from annual**

```typescript
interface ExpectedPaymentProps {
  annualIncomePerUnit: number;
  frequencyPerYear: number;
  nextExpectedDate?: Date;
}

export function ExpectedPayment({
  annualIncomePerUnit,
  frequencyPerYear,
  nextExpectedDate,
}: ExpectedPaymentProps) {
  if (!nextExpectedDate || frequencyPerYear <= 0) return null;

  const perPayment = annualIncomePerUnit / frequencyPerYear;

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="border border-[rgba(200,180,140,0.08)] rounded-lg p-3.5 mt-3">
      <div className="font-mono text-[length:var(--way-text-caption)] uppercase tracking-wider text-[var(--way-gold)] mb-2">Ожидаемая выплата</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)]">Выплата на единицу</span>
          <span className="font-mono text-[length:var(--way-text-body)] text-[var(--way-text)]">
            {perPayment.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[length:var(--way-text-caption)] text-[var(--way-muted)]">Дата (ожид.)</span>
          <span className="font-mono text-[length:var(--way-text-body)] text-[var(--way-text)]">{formatDate(nextExpectedDate)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/payment-history-chart.tsx src/components/asset-detail/expected-payment.tsx
git commit -m "refactor: chart and expected-payment — annual income semantics"
```

---

### Task 9: Build verification and cleanup

- [ ] **Step 1: Run TypeScript build**

Run: `npm run build`
Expected: PASS — no type errors. If errors exist, fix unused imports (e.g. `formatFrequency` in asset-detail-page).

- [ ] **Step 2: Run all tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 3: Remove dead import `formatFrequency` if unused**

Check if `formatFrequency` from `@/lib/utils` is still used anywhere. If only used in the deleted frequency field, remove the import from `asset-detail-page.tsx`. The function itself in `utils.ts` stays (may be used elsewhere).

- [ ] **Step 4: Final commit if any cleanup was needed**

Stage only the specific files that were cleaned up, then commit:

```bash
git commit -m "chore: cleanup unused imports after annual income refactor"
```
