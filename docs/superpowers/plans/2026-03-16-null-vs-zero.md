# Null vs Zero Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distinguish "no data" (null/undefined, shown as "—") from "known zero" (0, shown as "₽ 0") across the app, and always show manual income entry fields on asset detail page.

**Architecture:** Bottom-up — start with formatters and shared components (no behavioral change yet), then update data flow in hooks, then update pages. Each task produces independently testable, committable changes.

**Tech Stack:** React, TypeScript, Vitest, Tailwind CSS, Dexie (IndexedDB)

**Spec:** `docs/superpowers/specs/2026-03-16-null-vs-zero-and-manual-input-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/utils.ts` | Modify | formatCurrency, formatCurrencyFull, formatPercent — add null support |
| `tests/lib/utils.test.ts` | Create | Unit tests for formatters |
| `src/components/shared/data-source-tag.tsx` | Modify | Make `source` optional, return null when undefined |
| `src/components/asset-detail/asset-field.tsx` | Modify | Make `source` optional, conditionally render DataSourceTag |
| `src/components/shared/stat-blocks.tsx` | Modify | Props accept `number \| null`, render "—" for null |
| `src/components/main/hero-income.tsx` | Modify | Props accept `number \| null` |
| `src/components/main/category-card.tsx` | Modify | `incomePerMonth` accepts `number \| null` |
| `src/components/category/asset-row.tsx` | Modify | Null-propagation for income and value |
| `src/hooks/use-portfolio-stats.ts` | Modify | Filter out no-schedule assets from income sums |
| `src/pages/asset-detail-page.tsx` | Modify | Null-propagation, always-visible income fields, onSave for new schedule |

---

## Chunk 1: Formatters and Shared Components

### Task 1: Formatters accept null

**Files:**
- Modify: `src/lib/utils.ts:8-24`
- Create: `tests/lib/utils.test.ts`

- [ ] **Step 1: Write failing tests for null handling**

Create `tests/lib/utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyFull, formatPercent } from '@/lib/utils';

describe('formatCurrency', () => {
  it('returns dash for null', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });

  it('formats zero as ₽ 0', () => {
    expect(formatCurrency(0)).toBe('₽ 0');
  });

  it('formats positive number', () => {
    expect(formatCurrency(500)).toBe('₽ 500');
  });

  it('formats thousands with K suffix', () => {
    expect(formatCurrency(12400)).toBe('₽ 12K');
  });

  it('formats millions with M suffix', () => {
    expect(formatCurrency(1500000)).toBe('₽ 1.5M');
  });
});

describe('formatCurrencyFull', () => {
  it('returns dash for null', () => {
    expect(formatCurrencyFull(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatCurrencyFull(undefined)).toBe('—');
  });

  it('formats zero as ₽ 0', () => {
    expect(formatCurrencyFull(0)).toMatch(/₽\s+0/);
  });
});

describe('formatPercent', () => {
  it('returns dash for null', () => {
    expect(formatPercent(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatPercent(undefined)).toBe('—');
  });

  it('formats zero as 0.0%', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formats positive percent', () => {
    expect(formatPercent(8.85)).toBe('8.9%');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/utils.test.ts`
Expected: FAIL — TypeScript errors because formatters don't accept null/undefined.

- [ ] **Step 3: Update formatters to accept null**

In `src/lib/utils.ts`, change the three function signatures and add early returns:

```ts
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  // ... rest unchanged
}

export function formatCurrencyFull(value: number | null | undefined): string {
  if (value == null) return '—';
  return `₽ ${Math.round(value).toLocaleString('ru-RU')}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/utils.test.ts`
Expected: all PASS

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: all PASS (existing code passes number, which still works)

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils.ts tests/lib/utils.test.ts
git commit -m "feat: formatters accept null, return dash for missing data"
```

---

### Task 2: DataSourceTag and AssetField accept optional source

**Files:**
- Modify: `src/components/shared/data-source-tag.tsx:9`
- Modify: `src/components/asset-detail/asset-field.tsx:8,49`

- [ ] **Step 1: Update DataSourceTag to handle undefined source**

In `src/components/shared/data-source-tag.tsx`, change:

```ts
export function DataSourceTag({ source }: { source?: DataSource }) {
  if (!source) return null;
  const style = TAG_STYLES[source];
  // ... rest unchanged
}
```

- [ ] **Step 2: Update AssetField to make source optional**

In `src/components/asset-detail/asset-field.tsx`, change the interface:

```ts
interface AssetFieldProps {
  label: string;
  value: string;
  source?: DataSource;
  editable?: boolean;
  onSave?: (newValue: string) => void;
}
```

No other changes needed — `DataSourceTag` already handles undefined after step 1.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/data-source-tag.tsx src/components/asset-detail/asset-field.tsx
git commit -m "feat: make DataSourceTag and AssetField source optional"
```

---

### Task 3: StatBlocks, HeroIncome, CategoryCard accept null

**Files:**
- Modify: `src/components/shared/stat-blocks.tsx:3-8`
- Modify: `src/components/main/hero-income.tsx:3-9`
- Modify: `src/components/main/category-card.tsx:6-11`

- [ ] **Step 1: Update StatBlocks props to accept null**

In `src/components/shared/stat-blocks.tsx`, change:

```ts
interface StatBlocksProps {
  incomePerMonth: number | null;
  totalValue: number | null;
  yieldPercent: number | null;
  portfolioSharePercent: number | null;
}
```

Update the `green` styling to handle null — null values should be muted:

```ts
function statColor(raw: number | null, accent: boolean): string {
  if (raw == null) return 'text-gray-600';
  return accent ? 'text-[#4ecca3]' : 'text-white';
}

export function StatBlocks({ incomePerMonth, totalValue, yieldPercent, portfolioSharePercent }: StatBlocksProps) {
  const stats = [
    { label: 'Доход/мес', value: formatCurrency(incomePerMonth), color: statColor(incomePerMonth, true) },
    { label: 'Стоимость', value: formatCurrency(totalValue), color: statColor(totalValue, false) },
    { label: 'Доходность', value: formatPercent(yieldPercent), color: statColor(yieldPercent, true) },
    { label: 'Доля портф.', value: formatPercent(portfolioSharePercent), color: statColor(portfolioSharePercent, false) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-[#1a1a2e] rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">{stat.label}</div>
          <div className={`text-[15px] font-semibold mt-1 ${stat.color}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update HeroIncome props to accept null**

In `src/components/main/hero-income.tsx`, change the interface:

```ts
interface HeroIncomeProps {
  income: number | null;
  yieldPercent: number | null;
  totalValue: number | null;
  mode: 'month' | 'year';
  onToggle: () => void;
}
```

No JSX changes — `formatCurrencyFull`, `formatPercent`, `formatCurrency` already handle null after Task 1.

- [ ] **Step 3: Update CategoryCard props to accept null**

In `src/components/main/category-card.tsx`, change:

```ts
interface CategoryCardProps {
  type: AssetType;
  assetCount: number;
  incomePerMonth: number | null;
  portfolioSharePercent: number;
}
```

No JSX changes — `formatCurrency` handles null.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/stat-blocks.tsx src/components/main/hero-income.tsx src/components/main/category-card.tsx
git commit -m "feat: display components accept null props, show dash for missing data"
```

---

## Chunk 2: Data Flow and Pages

### Task 4: use-portfolio-stats filters no-schedule assets

**Files:**
- Modify: `src/hooks/use-portfolio-stats.ts:33-39,54-59`

- [ ] **Step 1: Update portfolio-level income aggregation**

In `src/hooks/use-portfolio-stats.ts`, replace lines 33-39:

```ts
// Before:
const incomeItems = assets.map((asset) => {
  const schedule = scheduleByAssetId.get(asset.id!);
  return {
    quantity: asset.quantity,
    paymentAmount: schedule?.lastPaymentAmount ?? 0,
    frequencyPerYear: schedule?.frequencyPerYear ?? 0,
  };
});

// After:
const incomeItems = assets
  .filter((asset) => scheduleByAssetId.has(asset.id!))
  .map((asset) => {
    const schedule = scheduleByAssetId.get(asset.id!)!;
    return {
      quantity: asset.quantity,
      paymentAmount: schedule.lastPaymentAmount,
      frequencyPerYear: schedule.frequencyPerYear,
    };
  });
```

- [ ] **Step 2: Update category-level income aggregation (identical change)**

Replace the `catIncomeItems` block (lines 54-59) with the same filter pattern:

```ts
const catIncomeItems = data.assets
  .filter((asset) => scheduleByAssetId.has(asset.id!))
  .map((asset) => {
    const schedule = scheduleByAssetId.get(asset.id!)!;
    return {
      quantity: asset.quantity,
      paymentAmount: schedule.lastPaymentAmount,
      frequencyPerYear: schedule.frequencyPerYear,
    };
  });
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all PASS (existing tests use mocked data with schedules present)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-portfolio-stats.ts
git commit -m "feat: exclude no-schedule assets from income aggregation"
```

---

### Task 5: AssetRow null-propagation

**Files:**
- Modify: `src/components/category/asset-row.tsx:12-16,30,34,36-44`

- [ ] **Step 1: Update income and value calculations**

In `src/components/category/asset-row.tsx`, replace lines 12-16:

```ts
const incomePerMonth = schedule
  ? calcAssetIncomePerMonth(asset.quantity, schedule.lastPaymentAmount, schedule.frequencyPerYear)
  : null;
const incomePerYear = incomePerMonth != null ? incomePerMonth * 12 : null;
const value = (asset.currentPrice ?? asset.averagePrice) != null
  ? (asset.currentPrice ?? asset.averagePrice)! * asset.quantity
  : null;
```

- [ ] **Step 2: Update JSX to use nullable values**

Replace line 30:
```tsx
<span className="text-sm font-semibold text-[#4ecca3]">{formatCurrency(incomePerMonth)}</span>
```
This already works — `formatCurrency` handles null after Task 1.

Replace lines 33-34:
```tsx
<span>
  {asset.quantity} шт · {formatCurrency(value)}
</span>
```
Already works.

Replace lines 36-44 (the schedule section):
```tsx
{schedule && (
  <span>
    <span className="bg-[#e9c46a22] text-[#e9c46a] px-1.5 py-0.5 rounded text-[10px]">
      {formatFrequency(schedule.frequencyPerYear)}
    </span>
    {' '}
    {formatCurrency(incomePerYear)}/год
  </span>
)}
```
No change needed here — the `schedule &&` guard is correct for the frequency badge.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/category/asset-row.tsx
git commit -m "feat: asset row shows dash for missing income/value data"
```

---

### Task 6: Asset detail page — null-propagation and always-visible income fields

**Files:**
- Modify: `src/pages/asset-detail-page.tsx`

- [ ] **Step 1: Update computed values with null-propagation**

Replace lines 25-30:

```ts
const incomePerMonth = schedule
  ? calcAssetIncomePerMonth(asset.quantity, schedule.lastPaymentAmount, schedule.frequencyPerYear)
  : null;
const value = (asset.currentPrice ?? asset.averagePrice) != null
  ? (asset.currentPrice ?? asset.averagePrice)! * asset.quantity
  : null;
const yieldPct = (incomePerMonth != null && value != null)
  ? calcYieldPercent(incomePerMonth * 12, value)
  : null;
const sharePercent = (value != null && portfolio.totalValue > 0)
  ? (value / portfolio.totalValue) * 100
  : null;
```

- [ ] **Step 2: Update StatBlocks to pass nullable values**

Replace the StatBlocks usage:

```tsx
<StatBlocks
  incomePerMonth={incomePerMonth}
  totalValue={value}
  yieldPercent={yieldPct}
  portfolioSharePercent={sharePercent}
/>
```

- [ ] **Step 3: Create save handlers that work with or without existing schedule**

Add two handler functions before the `return` statement:

```ts
const handleSavePayment = (v: string) => {
  const num = parseFloat(v.replace(/[^\d.]/g, ''));
  if (isNaN(num) || num < 0) return;
  upsertPaymentSchedule(assetId, {
    frequencyPerYear: schedule?.frequencyPerYear ?? 1,
    lastPaymentAmount: num,
    dataSource: 'manual',
  });
};

const handleSaveFrequency = (v: string) => {
  const num = parseInt(v);
  if (isNaN(num) || num < 1 || num > 12) return;
  upsertPaymentSchedule(assetId, {
    frequencyPerYear: num,
    lastPaymentAmount: schedule?.lastPaymentAmount ?? 0,
    dataSource: 'manual',
  });
};

const handleSaveQuantity = (v: string) => {
  const num = parseInt(v);
  if (num > 0) updateAsset(assetId, { quantity: num, dataSource: 'manual' });
};
```

- [ ] **Step 4: Make income fields always visible (remove `{schedule && ...}` guard)**

Replace the entire JSX block from `<AssetField label="Количество"` through `<ExpectedPayment>` with:

```tsx
<AssetField
  label="Количество"
  value={`${asset.quantity} шт`}
  source={asset.dataSource}
  onSave={handleSaveQuantity}
/>

<AssetField
  label="Последняя выплата"
  value={schedule ? `₽ ${schedule.lastPaymentAmount}` : '— Укажите'}
  source={schedule?.dataSource}
  onSave={handleSavePayment}
/>

<AssetField
  label="Частота (раз/год)"
  value={schedule ? formatFrequency(schedule.frequencyPerYear) : '— Укажите'}
  source={schedule?.dataSource}
  onSave={handleSaveFrequency}
/>

{schedule && (
  <ExpectedPayment schedule={schedule} quantity={asset.quantity} />
)}
```

Note: "Последний дивиденд" renamed to "Последняя выплата" — more generic, works for funds/bonds too. Label `/ акция` removed — it was incorrect for non-stock assets.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 6: Verify visually in the browser**

Run: `npx vite dev`
Check:
1. Open an asset that HAS a schedule (e.g. a synced stock) — should look the same as before
2. Open an asset that has NO schedule (e.g. a fund) — should show "— Укажите" in income fields
3. Click on "— Укажите" — inline editor opens
4. Enter a value and press Enter — PaymentSchedule is created, field shows the value
5. Enter "0" as payment — should save as ₽ 0, not be rejected

- [ ] **Step 7: Commit**

```bash
git add src/pages/asset-detail-page.tsx
git commit -m "feat: always show income fields, null-propagation on asset detail"
```

---

## Chunk 3: Final verification

### Task 7: End-to-end verification and cleanup

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Visual verification**

Run: `npx vite dev`

Check these scenarios:
1. **Main page** — income displays correctly for portfolio with mixed assets (some with schedules, some without)
2. **Category page** — fund category shows dash for assets without income data
3. **Asset detail (with schedule)** — all fields show values, sources tagged
4. **Asset detail (no schedule)** — shows "— Укажите" for payment and frequency, no source tag
5. **Manual entry flow** — click "— Укажите", type 186, press Enter → schedule created, income recalculated
6. **Zero entry** — enter 0 as payment → shows "₽ 0", not rejected, not dash

- [ ] **Step 4: Commit any fixes from verification**

Only if issues found during visual verification.
