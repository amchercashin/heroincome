# Income History & Forecast Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace simple income extrapolation with a two-layer model (fact + forecast) backed by payment history, with per-asset metric selection and yearly payment charts with CAGR.

**Architecture:** Populate `paymentHistory` table from MOEX API during sync. Add forecast fields to `PaymentSchedule`. New `income-calculator` functions compute fact (trailing 12 months), decay average, CAGR, and main number. Expandable stat block on asset detail page lets users switch between fact and forecast. New SVG bar chart replaces old `IncomeChart` on all pages.

**Tech Stack:** React 19, TypeScript, Dexie.js (IndexedDB), Vitest, Tailwind CSS, custom SVG charts.

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/db/database.ts` | Schema version 3 + compound index | Modify |
| `src/models/types.ts` | Add forecast fields to PaymentSchedule | Modify |
| `src/services/moex-api.ts` | Return raw dividend rows; add `fetchCouponHistory` | Modify |
| `src/services/moex-sync.ts` | Write payment history on sync | Modify |
| `src/services/income-calculator.ts` | Add `calcFactPerMonth`, `calcDecayAverage`, `calcMainNumber`; update `calcCAGR` | Modify |
| `src/hooks/use-payment-history.ts` | Hook for querying payment history | Create |
| `src/hooks/use-portfolio-stats.ts` | Use main number instead of schedule-based income | Modify |
| `src/hooks/use-payment-schedules.ts` | Add forecast field update helpers | Modify |
| `src/services/backup.ts` | Apply defaults for missing forecast fields on restore | Modify |
| `src/components/shared/payment-history-chart.tsx` | SVG bar chart with CAGR badge | Create |
| `src/components/asset-detail/income-metric-panel.tsx` | Expandable fact/forecast panel | Create |
| `src/components/shared/stat-blocks.tsx` | Add ф/п indicators and tap handler to income block | Modify |
| `src/pages/asset-detail-page.tsx` | Wire metric panel, new chart, forecast editing | Modify |
| `src/pages/main-page.tsx` | Use new chart with aggregated history | Modify |
| `src/pages/category-page.tsx` | Use new chart with category history | Modify |
| `src/components/shared/income-chart.tsx` | Delete (replaced by payment-history-chart) | Delete |

---

## Chunk 1: Data Layer & Calculations

### Task 1: Schema Migration & Types

**Files:**
- Modify: `src/models/types.ts:43-53`
- Modify: `src/db/database.ts:4-23`

- [ ] **Step 1: Write failing test for new PaymentSchedule fields**

```typescript
// tests/db/database.test.ts — add to existing file
import { db } from '@/db/database';

describe('schema v3', () => {
  it('stores and retrieves forecast fields on PaymentSchedule', async () => {
    const id = await db.paymentSchedules.add({
      assetId: 1,
      frequencyPerYear: 1,
      lastPaymentAmount: 50,
      forecastMethod: 'manual',
      forecastAmount: 100,
      activeMetric: 'forecast',
      dataSource: 'manual',
    });
    const record = await db.paymentSchedules.get(id);
    expect(record!.forecastMethod).toBe('manual');
    expect(record!.forecastAmount).toBe(100);
    expect(record!.activeMetric).toBe('forecast');
  });

  it('queries paymentHistory by compound index [assetId+date]', async () => {
    const cutoff = new Date('2025-03-01');
    await db.paymentHistory.bulkAdd([
      { assetId: 1, amount: 10, date: new Date('2025-01-15'), type: 'dividend', dataSource: 'moex' },
      { assetId: 1, amount: 20, date: new Date('2025-06-15'), type: 'dividend', dataSource: 'moex' },
      { assetId: 2, amount: 30, date: new Date('2025-02-01'), type: 'coupon', dataSource: 'moex' },
    ]);
    const results = await db.paymentHistory
      .where('[assetId+date]')
      .between([1, cutoff], [1, Dexie.maxKey])
      .toArray();
    expect(results).toHaveLength(1);
    expect(results[0].amount).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/database.test.ts`
Expected: FAIL — `forecastMethod` not in schema, compound index query fails.

- [ ] **Step 3: Update types**

In `src/models/types.ts`, add to `PaymentSchedule` interface (after line 53):

```typescript
export interface PaymentSchedule {
  // ... existing fields ...
  forecastMethod?: 'none' | 'manual' | 'decay';
  forecastAmount?: number | null;
  activeMetric?: 'fact' | 'forecast';
}
```

Fields are optional (`?`) because existing DB records won't have them after migration (Dexie doesn't backfill). All consuming code must use `?? 'fact'` / `?? null` / `?? 'none'` fallbacks.

- [ ] **Step 4: Update database schema to version 3**

In `src/db/database.ts`, add version 3 after the existing version 2 block (after line 21):

```typescript
this.version(3).stores({
  assets: '++id, type, ticker, isin',
  paymentSchedules: '++id, assetId',
  paymentHistory: '++id, [assetId+date]',
  importRecords: '++id, date',
  settings: 'key',
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/db/database.test.ts`
Expected: PASS

- [ ] **Step 6: Run all tests to check no regressions**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/models/types.ts src/db/database.ts tests/db/database.test.ts
git commit -m "feat: schema v3 — forecast fields on PaymentSchedule, compound index on paymentHistory"
```

---

### Task 2: New Income Calculation Functions

**Files:**
- Modify: `src/services/income-calculator.ts:1-48`
- Modify: `tests/services/income-calculator.test.ts`

- [ ] **Step 1: Write failing tests for calcFactPerMonth**

```typescript
// tests/services/income-calculator.test.ts — add describe block
describe('calcFactPerMonth', () => {
  it('sums payments in last 12 months and divides by 12', () => {
    const history = [
      { amount: 10, date: new Date('2025-06-15') },
      { amount: 15, date: new Date('2025-12-15') },
      { amount: 5, date: new Date('2024-01-01') }, // outside 12-month window
    ];
    const now = new Date('2026-03-16');
    // Window: 2025-03-16 to 2026-03-16 → includes 10 + 15 = 25
    const result = calcFactPerMonth(history, 100, now);
    // 25 * 100 / 12 ≈ 208.33
    expect(result).toBeCloseTo(208.33, 0);
  });

  it('returns 0 for empty history', () => {
    expect(calcFactPerMonth([], 100, new Date())).toBe(0);
  });

  it('returns 0 when no payments in last 12 months', () => {
    const history = [{ amount: 50, date: new Date('2020-01-01') }];
    expect(calcFactPerMonth(history, 100, new Date('2026-03-16'))).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: FAIL — `calcFactPerMonth` not defined.

- [ ] **Step 3: Implement calcFactPerMonth**

Add to `src/services/income-calculator.ts`:

```typescript
export interface PaymentRecord {
  amount: number;
  date: Date;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for calcDecayAverage**

```typescript
describe('calcDecayAverage', () => {
  it('computes decay average from 12-month window around last payment', () => {
    const history = [
      { amount: 10, date: new Date('2021-08-01') },
      { amount: 51, date: new Date('2022-09-15') },
    ];
    const now = new Date('2026-03-16');
    // Last payment: 2022-09-15
    // Window: 2021-09-15 to 2022-09-15. Filter: date > windowStart && date <= lastPaymentDate
    // 2021-08-01 is before windowStart → excluded. 2022-09-15 included → sum = 51
    // Months elapsed: (2026-2022)*12 + (2-8) = 42
    // Decay = 51 / (12 + 42) = 51 / 54 ≈ 0.94
    const result = calcDecayAverage(history, now);
    expect(result).toBeCloseTo(0.94, 1);
  });

  it('includes multiple payments within the 12-month window', () => {
    const history = [
      { amount: 10, date: new Date('2022-03-01') },
      { amount: 51, date: new Date('2022-09-15') },
    ];
    const now = new Date('2026-03-16');
    // Window: 2021-09-15 to 2022-09-15. Both payments inside → sum = 61
    // Months elapsed: 42
    // Decay = 61 / 54 ≈ 1.13
    const result = calcDecayAverage(history, now);
    expect(result).toBeCloseTo(1.13, 1);
  });

  it('returns null for empty history', () => {
    expect(calcDecayAverage([], new Date())).toBeNull();
  });

  it('handles single payment (no prior payments in window)', () => {
    const history = [{ amount: 100, date: new Date('2025-06-01') }];
    const now = new Date('2026-03-16');
    // Window: 2024-06-01 to 2025-06-01 → includes 100
    // Months elapsed: June 2025 → March 2026 ≈ 9 months
    // Decay = 100 / (12 + 9) = 100 / 21 ≈ 4.76
    const result = calcDecayAverage(history, now);
    expect(result).toBeCloseTo(4.76, 1);
  });
});
```

- [ ] **Step 6: Implement calcDecayAverage**

```typescript
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: PASS

- [ ] **Step 8: Write failing tests for calcMainNumber**

```typescript
describe('calcMainNumber', () => {
  it('returns forecast when activeMetric is forecast and forecastAmount set', () => {
    const result = calcMainNumber({
      activeMetric: 'forecast',
      forecastAmount: 50,
      frequencyPerYear: 2,
      quantity: 100,
      factPerMonth: 0,
    });
    // 50 * 2 * 100 / 12 ≈ 833.33
    expect(result).toBeCloseTo(833.33, 0);
  });

  it('falls back to fact when activeMetric is forecast but forecastAmount is null', () => {
    const result = calcMainNumber({
      activeMetric: 'forecast',
      forecastAmount: null,
      frequencyPerYear: 1,
      quantity: 100,
      factPerMonth: 500,
    });
    expect(result).toBe(500);
  });

  it('returns fact when activeMetric is fact', () => {
    const result = calcMainNumber({
      activeMetric: 'fact',
      forecastAmount: 50,
      frequencyPerYear: 2,
      quantity: 100,
      factPerMonth: 200,
    });
    expect(result).toBe(200);
  });
});
```

- [ ] **Step 9: Implement calcMainNumber**

```typescript
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
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: PASS

- [ ] **Step 11: Write failing tests for updated calcCAGR**

```typescript
describe('calcCAGR (calendar-year)', () => {
  it('calculates CAGR from first to last full calendar year', () => {
    const history = [
      { amount: 10, date: new Date('2021-07-01') },
      { amount: 12, date: new Date('2022-07-01') },
      { amount: 15, date: new Date('2023-07-01') },
    ];
    const now = new Date('2026-03-16');
    // Years with payments: 2021, 2022, 2023
    // Last completed: 2023 (not current year 2026)
    // first=2021 (sum=10), last=2023 (sum=15), span=2
    // CAGR = (15/10)^(1/2) - 1 ≈ 22.47%
    const result = calcCAGR(history, now);
    expect(result).toBeCloseTo(22.47, 0);
  });

  it('returns null for payments in only one year', () => {
    const history = [
      { amount: 10, date: new Date('2023-01-01') },
      { amount: 20, date: new Date('2023-06-01') },
    ];
    expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
  });

  it('returns null when first year income is 0', () => {
    const history = [
      { amount: 0, date: new Date('2021-07-01') },
      { amount: 15, date: new Date('2023-07-01') },
    ];
    expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
  });

  it('excludes current year from last_full_year', () => {
    const history = [
      { amount: 10, date: new Date('2025-07-01') },
      { amount: 20, date: new Date('2026-01-15') }, // current year
    ];
    const now = new Date('2026-03-16');
    // Only one completed year (2025) → null
    expect(calcCAGR(history, now)).toBeNull();
  });

  it('handles gaps between years', () => {
    const history = [
      { amount: 10, date: new Date('2020-06-01') },
      { amount: 20, date: new Date('2024-06-01') },
    ];
    const now = new Date('2026-03-16');
    // first=2020 (10), last=2024 (20), span=4
    // CAGR = (20/10)^(1/4) - 1 ≈ 18.92%
    const result = calcCAGR(history, now);
    expect(result).toBeCloseTo(18.92, 0);
  });
});
```

- [ ] **Step 12: Replace existing calcCAGR with calendar-year version**

Replace the existing `calcCAGR` function in `src/services/income-calculator.ts`:

```typescript
export function calcCAGR(
  history: PaymentRecord[],
  now: Date = new Date(),
): number | null {
  if (history.length === 0) return null;

  const currentYear = now.getFullYear();

  // Group payments by calendar year, excluding current year
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
```

Note: The old `calcCAGR(annualIncomes: number[])` signature changes to `calcCAGR(history: PaymentRecord[], now?: Date)`. Update old tests: remove the old `describe('calcCAGR', ...)` block (lines 66-81) since the new tests above replace it.

- [ ] **Step 13: Run all tests to verify**

Run: `npx vitest run tests/services/income-calculator.test.ts`
Expected: All pass.

- [ ] **Step 14: Commit**

```bash
git add src/services/income-calculator.ts tests/services/income-calculator.test.ts
git commit -m "feat: add calcFactPerMonth, calcDecayAverage, calcMainNumber; rewrite calcCAGR for calendar years"
```

---

### Task 3: MOEX API — Return Raw Dividend Rows & Add Coupon History

**Files:**
- Modify: `src/services/moex-api.ts:35-40, 94-138, 243-253`
- Create: `tests/services/moex-api.test.ts` (add tests to existing file)

- [ ] **Step 1: Write failing test for fetchDividends returning raw rows**

```typescript
// tests/services/moex-api.test.ts — add to existing fetchDividends describe
describe('fetchDividends (with raw rows)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns both summary and raw history rows', async () => {
    vi.stubGlobal('fetch', mockFetch({
      dividends: {
        columns: ['secid', 'isin', 'registryclosedate', 'value', 'currencyid'],
        data: [
          ['SBER', 'RU0009029540', '2024-07-11', 33.3, 'RUB'],
          ['SBER', 'RU0009029540', '2025-07-18', 34.84, 'RUB'],
        ],
      },
    }));
    const result = await fetchDividends('SBER');
    expect(result).not.toBeNull();
    expect(result!.summary.lastPaymentAmount).toBe(34.84);
    expect(result!.history).toHaveLength(2);
    expect(result!.history[0]).toEqual({ date: new Date('2024-07-11'), amount: 33.3 });
    expect(result!.history[1]).toEqual({ date: new Date('2025-07-18'), amount: 34.84 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/moex-api.test.ts`
Expected: FAIL — `result.summary` / `result.history` not present.

- [ ] **Step 3: Update DividendInfo and fetchDividends**

In `src/services/moex-api.ts`:

Add new return type:
```typescript
export interface DividendHistoryRow {
  date: Date;
  amount: number;
}

export interface DividendResult {
  summary: DividendInfo;
  history: DividendHistoryRow[];
}
```

Update `fetchDividends` (line 243-253) to return `DividendResult | null`:
```typescript
export async function fetchDividends(secid: string): Promise<DividendResult | null> {
  try {
    const data = await fetchISS(`/securities/${secid}/dividends.json`);
    if (!data?.dividends) return null;
    const rows = parseISSBlock(data.dividends);
    const summary = parseDividendHistory(rows);
    if (!summary) return null;

    const history: DividendHistoryRow[] = rows
      .filter((r: Record<string, unknown>) => r.registryclosedate && r.value != null)
      .map((r: Record<string, unknown>) => ({
        date: new Date(r.registryclosedate as string),
        amount: r.value as number,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return { summary, history };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Update existing fetchDividends tests and moex-sync test mocks**

Update the existing `describe('fetchDividends', ...)` tests in `moex-api.test.ts` to use `result!.summary.lastPaymentAmount` instead of `result!.lastPaymentAmount`.

Also update ALL `fetchDividends` mocks in `tests/services/moex-sync.test.ts`. The existing mocks return the old `DividendInfo` shape directly. Change them to return `DividendResult` with `.summary` and `.history`:

```typescript
// Old mock shape:
(fetchDividends as Mock).mockResolvedValue({
  lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'),
  frequencyPerYear: 1, nextExpectedCutoffDate: null,
});

// New mock shape:
(fetchDividends as Mock).mockResolvedValue({
  summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
  history: [{ date: new Date('2025-07-18'), amount: 34.84 }],
});
```

Apply this transformation to every `fetchDividends` mock in moex-sync.test.ts. Also add `fetchCouponHistory` to the `vi.mock('@/services/moex-api', ...)` factory at the top of the file:

```typescript
fetchCouponHistory: vi.fn().mockResolvedValue([]),
```

- [ ] **Step 5: Run test to verify all fetchDividends tests pass**

Run: `npx vitest run tests/services/moex-api.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing test for fetchCouponHistory**

```typescript
describe('fetchCouponHistory', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns coupon payment history from bondization endpoint', async () => {
    vi.stubGlobal('fetch', mockFetch({
      coupons: {
        columns: ['isin', 'coupondate', 'value_rub', 'value'],
        data: [
          ['RU000A0JV4Q1', '2025-06-03', 35.4, 35.4],
          ['RU000A0JV4Q1', '2025-12-03', 35.4, 35.4],
          ['RU000A0JV4Q1', '2026-06-03', null, null],  // future, no value yet
        ],
      },
    }));
    const result = await fetchCouponHistory('SU26238RMFS4');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: new Date('2025-06-03'), amount: 35.4 });
  });

  it('returns empty array on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    expect(await fetchCouponHistory('SU26238RMFS4')).toEqual([]);
  });
});
```

- [ ] **Step 7: Implement fetchCouponHistory**

Add to `src/services/moex-api.ts`:

```typescript
export async function fetchCouponHistory(secid: string): Promise<DividendHistoryRow[]> {
  try {
    const data = await fetchISS(`/securities/${secid}/bondization.json`);
    if (!data?.coupons) return [];
    const rows = parseISSBlock(data.coupons);
    return rows
      .filter((r: Record<string, unknown>) => r.coupondate && r.value_rub != null)
      .map((r: Record<string, unknown>) => ({
        date: new Date(r.coupondate as string),
        amount: r.value_rub as number,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  } catch {
    return [];
  }
}
```

- [ ] **Step 8: Run all moex-api tests**

Run: `npx vitest run tests/services/moex-api.test.ts`
Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add src/services/moex-api.ts tests/services/moex-api.test.ts
git commit -m "feat: fetchDividends returns raw history rows; add fetchCouponHistory"
```

---

### Task 4: MOEX Sync — Write Payment History

**Files:**
- Modify: `src/services/moex-sync.ts:84-105, 107-132`
- Modify: `tests/services/moex-sync.test.ts`

- [ ] **Step 1: Write failing test for sync writing payment history**

```typescript
// tests/services/moex-sync.test.ts — add describe block
import { db } from '@/db/database';

describe('payment history population', () => {
  afterEach(async () => {
    await db.paymentHistory.clear();
    await db.assets.clear();
    await db.paymentSchedules.clear();
    vi.restoreAllMocks();
  });

  it('writes dividend rows to paymentHistory on stock sync', async () => {
    const assetId = await db.assets.add({
      type: 'stock', name: 'Sber', ticker: 'SBER', moexSecid: 'SBER',
      quantity: 100, dataSource: 'moex', createdAt: new Date(), updatedAt: new Date(),
    });

    // Use existing vi.mock pattern (fetchDividends etc. are already mocked at module level)
    (resolveSecurityInfo as Mock).mockResolvedValue({ secid: 'SBER', primaryBoardId: 'TQBR', market: 'shares' });
    (fetchStockPrice as Mock).mockResolvedValue({ currentPrice: 300, prevPrice: 298 });
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
      history: [
        { date: new Date('2024-07-11'), amount: 33.3 },
        { date: new Date('2025-07-18'), amount: 34.84 },
      ],
    });

    await syncAllAssets();

    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    expect(records).toHaveLength(2);
    expect(records[0].amount).toBe(33.3);
    expect(records[0].type).toBe('dividend');
    expect(records[0].dataSource).toBe('moex');
  });

  it('deduplicates on re-sync', async () => {
    const assetId = await db.assets.add({
      type: 'stock', name: 'Sber', ticker: 'SBER', moexSecid: 'SBER',
      quantity: 100, dataSource: 'moex', createdAt: new Date(), updatedAt: new Date(),
    });

    // Pre-populate one record
    await db.paymentHistory.add({
      assetId, amount: 33.3, date: new Date('2024-07-11'),
      type: 'dividend', dataSource: 'moex',
    });

    // Same mocks as above (using existing vi.mock pattern)
    (resolveSecurityInfo as Mock).mockResolvedValue({ secid: 'SBER', primaryBoardId: 'TQBR', market: 'shares' });
    (fetchStockPrice as Mock).mockResolvedValue({ currentPrice: 300, prevPrice: 298 });
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 34.84, lastPaymentDate: new Date('2025-07-18'), frequencyPerYear: 1, nextExpectedCutoffDate: null },
      history: [
        { date: new Date('2024-07-11'), amount: 33.3 },
        { date: new Date('2025-07-18'), amount: 34.84 },
      ],
    });

    await syncAllAssets();

    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    expect(records).toHaveLength(2); // not 3
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/moex-sync.test.ts`
Expected: FAIL — no records written to paymentHistory.

- [ ] **Step 3: Add writePaymentHistory helper to moex-sync.ts**

Add to `src/services/moex-sync.ts`:

```typescript
import { DividendHistoryRow } from './moex-api';
import type { PaymentHistory } from '@/models/types';

async function writePaymentHistory(
  assetId: number,
  rows: DividendHistoryRow[],
  type: PaymentHistory['type'],
): Promise<void> {
  const existing = await db.paymentHistory
    .where('[assetId+date]')
    .between([assetId, Dexie.minKey], [assetId, Dexie.maxKey])
    .toArray();

  const existingDates = new Set(existing.map((r) => r.date.getTime()));

  const newRecords = rows
    .filter((r) => !existingDates.has(r.date.getTime()))
    .map((r) => ({
      assetId,
      amount: r.amount,
      date: r.date,
      type,
      dataSource: 'moex' as const,
    }));

  if (newRecords.length > 0) {
    await db.paymentHistory.bulkAdd(newRecords);
  }
}
```

- [ ] **Step 4: Call writePaymentHistory in syncStock**

In `syncStock` (around line 96-104), after fetching dividends:

```typescript
if (divInfo) {
  await writePaymentHistory(asset.id!, divInfo.history, 'dividend');
  upsertMoexSchedule(asset.id!, { /* ... existing code ... */ });
}
```

Update `divInfo` usage to use `.summary` for schedule fields: `divInfo.summary.lastPaymentAmount`, etc.

- [ ] **Step 5: Call writePaymentHistory in syncBond**

In `syncBond`, after fetching bond data, add coupon history fetch:

```typescript
const couponHistory = await fetchCouponHistory(secid);
if (couponHistory.length > 0) {
  await writePaymentHistory(asset.id!, couponHistory, 'coupon');
}
```

- [ ] **Step 6: Run tests to verify**

Run: `npx vitest run tests/services/moex-sync.test.ts`
Expected: All pass.

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add src/services/moex-sync.ts tests/services/moex-sync.test.ts
git commit -m "feat: moex-sync writes payment history with deduplication"
```

---

### Task 5: Payment History Hook & Backup Fix

**Files:**
- Create: `src/hooks/use-payment-history.ts`
- Modify: `src/services/backup.ts:16-33`
- Modify: `tests/services/backup.test.ts`

- [ ] **Step 1: Create use-payment-history hook**

```typescript
// src/hooks/use-payment-history.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';

export function usePaymentHistory(assetId: number) {
  return useLiveQuery(
    () => db.paymentHistory.where('[assetId+date]')
      .between([assetId, Dexie.minKey], [assetId, Dexie.maxKey])
      .toArray(),
    [assetId],
    [],
  );
}

export function useAllPaymentHistory() {
  return useLiveQuery(() => db.paymentHistory.toArray(), [], []);
}
```

- [ ] **Step 2: Fix backup restore to apply defaults for new fields**

In `src/services/backup.ts`, in `importAllData`, before `bulkAdd` for paymentSchedules:

```typescript
const schedulesWithDefaults = (data.paymentSchedules ?? []).map((s: Record<string, unknown>) => ({
  ...s,
  forecastMethod: s.forecastMethod ?? 'none',
  forecastAmount: s.forecastAmount ?? null,
  activeMetric: s.activeMetric ?? 'fact',
}));
// Use schedulesWithDefaults instead of data.paymentSchedules in bulkAdd
```

- [ ] **Step 3: Write test for backup restore with old format**

```typescript
// tests/services/backup.test.ts — add test
it('applies default forecast fields when restoring old backup', async () => {
  const oldBackup = {
    assets: [],
    paymentSchedules: [{
      id: 1, assetId: 1, frequencyPerYear: 1,
      lastPaymentAmount: 50, dataSource: 'moex',
      // no forecastMethod, forecastAmount, activeMetric
    }],
    paymentHistory: [],
    importRecords: [],
    settings: [],
  };
  await importAllData(JSON.stringify(oldBackup));
  const schedule = await db.paymentSchedules.get(1);
  expect(schedule!.forecastMethod).toBe('none');
  expect(schedule!.forecastAmount).toBeNull();
  expect(schedule!.activeMetric).toBe('fact');
});
```

- [ ] **Step 4: Run backup tests**

Run: `npx vitest run tests/services/backup.test.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-payment-history.ts src/services/backup.ts tests/services/backup.test.ts
git commit -m "feat: payment history hook; backup restore applies forecast field defaults"
```

---

### Task 6: Update Portfolio Stats to Use Main Number

**Files:**
- Modify: `src/hooks/use-portfolio-stats.ts:7-84`
- Modify: `src/hooks/use-payment-schedules.ts`

- [ ] **Step 1: Add forecast update helper to use-payment-schedules**

Add to `src/hooks/use-payment-schedules.ts`:

```typescript
export async function updateForecast(
  assetId: number,
  fields: {
    forecastMethod?: 'none' | 'manual' | 'decay';
    forecastAmount?: number | null;
    activeMetric?: 'fact' | 'forecast';
  },
): Promise<void> {
  const existing = await db.paymentSchedules.where('assetId').equals(assetId).first();
  if (existing) {
    await db.paymentSchedules.update(existing.id!, fields);
  }
}
```

- [ ] **Step 2: Rewrite usePortfolioStats to use main number**

Replace the core logic in `src/hooks/use-portfolio-stats.ts` to:

1. Load `allPaymentHistory` alongside assets and schedules
2. Compute `factPerMonth` for each asset from payment history
3. Use `calcMainNumber` to determine each asset's income contribution
4. Aggregate using main numbers instead of schedule-based calculation

Key change: replace lines 33-45 with:

```typescript
import { calcFactPerMonth, calcMainNumber, calcYieldPercent } from '@/services/income-calculator';
import { useAllPaymentHistory } from './use-payment-history';

// Inside the hook:
const allHistory = useAllPaymentHistory();

// In the useMemo:
const now = new Date();
const historyByAsset = new Map<number, PaymentRecord[]>();
for (const h of (allHistory ?? [])) {
  const arr = historyByAsset.get(h.assetId) ?? [];
  arr.push({ amount: h.amount, date: new Date(h.date) });
  historyByAsset.set(h.assetId, arr);
}

let totalIncomePerMonth = 0;
for (const asset of assets) {
  const schedule = scheduleByAssetId.get(asset.id!);
  const history = historyByAsset.get(asset.id!) ?? [];
  const factPerMonth = calcFactPerMonth(history, asset.quantity, now);
  const mainNumber = calcMainNumber({
    activeMetric: schedule?.activeMetric ?? 'fact',
    forecastAmount: schedule?.forecastAmount ?? null,
    frequencyPerYear: schedule?.frequencyPerYear ?? 1,
    quantity: asset.quantity,
    factPerMonth,
  });
  totalIncomePerMonth += mainNumber;
}
```

For category-level aggregation, replace the existing category income calculation loop (lines 54-78) with the same `historyByAsset` + `calcMainNumber` pattern:

```typescript
// Category aggregation (inside useMemo, after portfolio calculation):
const categoriesResult: CategoryStats[] = [];
for (const [type, categoryAssets] of categoryMap) {
  let catValue = 0;
  let catIncomePerMonth = 0;
  for (const asset of categoryAssets) {
    const price = asset.currentPrice ?? asset.averagePrice ?? 0;
    const assetValue = price * asset.quantity;
    catValue += assetValue;

    const schedule = scheduleByAssetId.get(asset.id!);
    const history = historyByAsset.get(asset.id!) ?? [];
    const factPerMonth = calcFactPerMonth(history, asset.quantity, now);
    catIncomePerMonth += calcMainNumber({
      activeMetric: schedule?.activeMetric ?? 'fact',
      forecastAmount: schedule?.forecastAmount ?? null,
      frequencyPerYear: schedule?.frequencyPerYear ?? 1,
      quantity: asset.quantity,
      factPerMonth,
    });
  }
  const catIncomePerYear = catIncomePerMonth * 12;
  categoriesResult.push({
    type,
    assetCount: categoryAssets.length,
    totalIncomePerMonth: catIncomePerMonth,
    totalIncomePerYear: catIncomePerYear,
    totalValue: catValue,
    yieldPercent: catValue > 0 ? calcYieldPercent(catIncomePerYear, catValue) : 0,
    portfolioSharePercent: totalValue > 0 ? (catValue / totalValue) * 100 : 0,
  });
}
categoriesResult.sort((a, b) => b.totalIncomePerMonth - a.totalIncomePerMonth);
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All pass. Existing portfolio stats tests may need updates if they assumed schedule-based income.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-portfolio-stats.ts src/hooks/use-payment-schedules.ts
git commit -m "feat: portfolio stats uses main number (fact/forecast) per asset"
```

---

## Chunk 2: UI Components & Page Integration

### Task 7: Payment History Chart Component

**Files:**
- Create: `src/components/shared/payment-history-chart.tsx`
- Delete: `src/components/shared/income-chart.tsx`

- [ ] **Step 1: Create PaymentHistoryChart component**

```typescript
// src/components/shared/payment-history-chart.tsx
import { formatCurrency } from '@/lib/utils';
import type { PaymentRecord } from '@/services/income-calculator';
import { calcCAGR } from '@/services/income-calculator';

interface PaymentHistoryChartProps {
  history: PaymentRecord[];
  quantity: number;
}

export function PaymentHistoryChart({ history, quantity }: PaymentHistoryChartProps) {
  if (history.length === 0) {
    return (
      <div className="bg-[#1a1a2e] rounded-xl p-4 mt-4 text-center text-gray-600 text-xs">
        Нет данных о выплатах
      </div>
    );
  }

  const now = new Date();
  const cagr = calcCAGR(history, now);

  // Group by calendar year
  const byYear = new Map<number, number>();
  for (const p of history) {
    const year = p.date.getFullYear();
    byYear.set(year, (byYear.get(year) ?? 0) + p.amount * quantity);
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const values = years.map((y) => byYear.get(y)!);
  const maxValue = Math.max(...values, 1);

  return (
    <div className="bg-[#1a1a2e] rounded-xl p-4 mt-4">
      {cagr != null && (
        <div className="text-xs text-[#4ecca3] font-semibold mb-3">
          CAGR {cagr > 0 ? '+' : ''}{cagr.toFixed(1)}%
        </div>
      )}
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {years.map((year, i) => {
          const height = Math.max((values[i] / maxValue) * 100, 2);
          return (
            <div key={year} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-[#4ecca3] rounded-t"
                style={{ height: `${height}%` }}
                title={formatCurrency(values[i])}
              />
              <span className="text-[9px] text-gray-500">
                '{String(year).slice(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete old income-chart.tsx**

Remove `src/components/shared/income-chart.tsx`.

- [ ] **Step 3: Update all imports from income-chart to payment-history-chart**

Search all files importing `IncomeChart` and replace with `PaymentHistoryChart`. Files: `asset-detail-page.tsx`, `main-page.tsx`, `category-page.tsx`.

For now, pass empty history arrays — actual wiring happens in Tasks 9-11.

- [ ] **Step 4: Verify app builds**

Run: `npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git rm src/components/shared/income-chart.tsx
git add src/components/shared/payment-history-chart.tsx src/pages/asset-detail-page.tsx src/pages/main-page.tsx src/pages/category-page.tsx
git commit -m "feat: replace IncomeChart with PaymentHistoryChart (SVG bars + CAGR)"
```

---

### Task 8: Income Metric Panel Component

**Files:**
- Create: `src/components/asset-detail/income-metric-panel.tsx`

- [ ] **Step 1: Create IncomeMetricPanel component**

```typescript
// src/components/asset-detail/income-metric-panel.tsx
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

interface IncomeMetricPanelProps {
  factPerMonth: number;
  forecastPerMonth: number | null;
  activeMetric: 'fact' | 'forecast';
  decayAverage: number | null;
  forecastAmount: number | null;
  onSelectMetric: (metric: 'fact' | 'forecast') => void;
  onSetForecastAmount: (amount: number) => void;
  onApplyDecayAverage?: () => void;
}

export function IncomeMetricPanel({
  factPerMonth,
  forecastPerMonth,
  activeMetric,
  decayAverage,
  forecastAmount,
  onSelectMetric,
  onSetForecastAmount,
  onApplyDecayAverage,
}: IncomeMetricPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEditing = () => {
    setDraft(forecastAmount != null ? String(forecastAmount) : '');
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    const num = parseFloat(draft.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!isNaN(num) && num >= 0) {
      onSetForecastAmount(num);
      if (activeMetric !== 'forecast') onSelectMetric('forecast');
    }
  };

  return (
    <div className="bg-[#1a1a2e] border border-[#4ecca344] rounded-b-xl p-2.5 mb-2">
      {/* Fact card */}
      <div
        className={`p-2 rounded-lg text-center cursor-pointer mb-1.5 ${
          activeMetric === 'fact' ? 'bg-[#252540] border border-[#4ecca3]' : 'bg-[#252540]'
        }`}
        onClick={() => onSelectMetric('fact')}
      >
        <div className={`text-[9px] uppercase ${activeMetric === 'fact' ? 'text-[#4ecca3]' : 'text-gray-500'}`}>
          Факт 12 мес {activeMetric === 'fact' && '✓'}
        </div>
        <div className={`text-sm font-semibold mt-0.5 ${activeMetric === 'fact' ? 'text-[#4ecca3]' : 'text-gray-400'}`}>
          {formatCurrency(factPerMonth)}
        </div>
      </div>

      {/* Forecast card */}
      <div
        className={`p-2 rounded-lg text-center cursor-pointer ${
          activeMetric === 'forecast' ? 'bg-[#252540] border border-[#4ecca3]' : 'bg-[#252540]'
        }`}
        onClick={() => forecastAmount != null && onSelectMetric('forecast')}
      >
        <div className={`text-[9px] uppercase ${activeMetric === 'forecast' ? 'text-[#4ecca3]' : 'text-gray-500'}`}>
          Прогноз {activeMetric === 'forecast' && '✓'}
        </div>
        {editing ? (
          <input
            className="w-full bg-[#0d1117] border border-[#4ecca3] rounded-lg px-2 py-1 text-sm text-white text-center outline-none mt-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            placeholder="Сумма на ед."
          />
        ) : (
          <div
            className={`text-sm font-semibold mt-0.5 cursor-pointer ${
              activeMetric === 'forecast' ? 'text-[#4ecca3]' : 'text-gray-400'
            } ${forecastAmount != null ? 'underline decoration-dashed decoration-[#4ecca366] underline-offset-2' : ''}`}
            onClick={(e) => { e.stopPropagation(); startEditing(); }}
          >
            {forecastPerMonth != null ? formatCurrency(forecastPerMonth) : '— Укажите'}
          </div>
        )}
      </div>

      {/* Decay average helper */}
      {decayAverage != null && (
        <div className="mt-2">
          <button
            className="text-[10px] text-gray-300 bg-[#0d1117] px-2 py-1 rounded-md border border-[#333] w-full text-left"
            onClick={() => onApplyDecayAverage?.()}
          >
            ⟳ Подставить среднее: <span className="text-[#4ecca3] font-semibold">{formatCurrency(decayAverage)}</span>
          </button>
          <div className="text-[8px] text-gray-600 mt-1">
            Последние годовые ÷ всё прошедшее время.
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/asset-detail/income-metric-panel.tsx
git commit -m "feat: IncomeMetricPanel component with fact/forecast switching and decay helper"
```

---

### Task 9: Update StatBlocks with ф/п Indicators

**Files:**
- Modify: `src/components/shared/stat-blocks.tsx`

- [ ] **Step 1: Add income tap handler and indicators**

Update `StatBlocksProps` to accept optional metric indicator:

```typescript
interface StatBlocksProps {
  incomePerMonth: number | null;
  totalValue: number | null;
  yieldPercent: number | null;
  portfolioSharePercent: number | null;
  activeMetric?: 'fact' | 'forecast';
  onIncomeTap?: () => void;
}
```

The existing `stats.map()` loop renders all 4 blocks uniformly. Add a conditional inside the map to special-case the income block:

```tsx
{stats.map((stat, index) => (
  <div
    key={stat.label}
    className={`bg-[#1a1a2e] rounded-xl p-3 text-center ${index === 0 && onIncomeTap ? 'cursor-pointer' : ''}`}
    onClick={index === 0 ? onIncomeTap : undefined}
  >
    <div className="text-[10px] uppercase tracking-wider text-gray-500">{stat.label}</div>
    <div className={`text-[15px] font-semibold mt-1 ${stat.color}`}>
      {stat.value}
    </div>
    {index === 0 && activeMetric && (
      <div className="flex justify-center gap-1 mt-1">
        <span className={`text-[9px] w-3.5 h-3.5 leading-[14px] rounded-full text-center font-semibold ${
          activeMetric === 'fact' ? 'bg-[#4ecca3] text-[#0d1117]' : 'bg-[#333] text-gray-600'
        }`}>ф</span>
        <span className={`text-[9px] w-3.5 h-3.5 leading-[14px] rounded-full text-center font-semibold ${
          activeMetric === 'forecast' ? 'bg-[#4ecca3] text-[#0d1117]' : 'bg-[#333] text-gray-600'
        }`}>п</span>
      </div>
    )}
  </div>
))}
```

`index === 0` corresponds to "Доход/мес" (always first in the stats array). Non-asset pages don't pass `activeMetric` or `onIncomeTap` → no indicators, no click handler — backward-compatible.

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/stat-blocks.tsx
git commit -m "feat: stat-blocks ф/п indicators and income tap handler"
```

---

### Task 10: Wire Asset Detail Page

**Files:**
- Modify: `src/pages/asset-detail-page.tsx`

- [ ] **Step 1: Rewrite asset-detail-page to use new model**

```typescript
// Key changes to asset-detail-page.tsx:

import { usePaymentHistory } from '@/hooks/use-payment-history';
import { calcFactPerMonth, calcDecayAverage, calcMainNumber } from '@/services/income-calculator';
import { updateForecast } from '@/hooks/use-payment-schedules';
import { IncomeMetricPanel } from '@/components/asset-detail/income-metric-panel';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';

// Inside component:
const history = usePaymentHistory(assetId);
const [panelOpen, setPanelOpen] = useState(false);

const now = new Date();
const historyRecords = history.map((h) => ({ amount: h.amount, date: new Date(h.date) }));
const factPerMonth = calcFactPerMonth(historyRecords, asset.quantity, now);
const decayAverage = calcDecayAverage(historyRecords, now);

const activeMetric = schedule?.activeMetric ?? 'fact';
const forecastAmount = schedule?.forecastAmount ?? null;

const incomePerMonth = calcMainNumber({
  activeMetric,
  forecastAmount,
  frequencyPerYear: schedule?.frequencyPerYear ?? 1,
  quantity: asset.quantity,
  factPerMonth,
});

const forecastPerMonth = forecastAmount != null && schedule
  ? (forecastAmount * schedule.frequencyPerYear * asset.quantity) / 12
  : null;

// In JSX:
<StatBlocks
  incomePerMonth={incomePerMonth}
  totalValue={value}
  yieldPercent={yieldPct}
  portfolioSharePercent={sharePercent}
  activeMetric={activeMetric}
  onIncomeTap={() => setPanelOpen(!panelOpen)}
/>

{panelOpen && (
  <IncomeMetricPanel
    factPerMonth={factPerMonth}
    forecastPerMonth={forecastPerMonth}
    activeMetric={activeMetric}
    decayAverage={decayAverage}
    forecastAmount={forecastAmount}
    onSelectMetric={(m) => updateForecast(assetId, { activeMetric: m })}
    onSetForecastAmount={(amount) => updateForecast(assetId, {
      forecastAmount: amount,
      forecastMethod: 'manual',
    })}
    onApplyDecayAverage={() => {
      if (decayAverage != null) {
        updateForecast(assetId, {
          forecastAmount: decayAverage,
          forecastMethod: 'decay',
          activeMetric: 'forecast',
        });
      }
    }}
  />
)}

// Replace old IncomeChart:
<PaymentHistoryChart history={historyRecords} quantity={asset.quantity} />
```

- [ ] **Step 2: Verify build and manual test**

Run: `npx vite build`
Then: `npx vite preview` — open an asset page, verify stat block shows ф/п, tap works, chart renders.

- [ ] **Step 3: Commit**

```bash
git add src/pages/asset-detail-page.tsx
git commit -m "feat: asset detail page with income metric panel and payment history chart"
```

---

### Task 11: Wire Main Page & Category Page

**Files:**
- Modify: `src/pages/main-page.tsx`
- Modify: `src/pages/category-page.tsx`

- [ ] **Step 1: Update main-page to use PaymentHistoryChart**

```typescript
// src/pages/main-page.tsx
import { useAllPaymentHistory } from '@/hooks/use-payment-history';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';

// Inside component (assets already loaded from usePortfolioStats):
const allHistory = useAllPaymentHistory();

// Multiply per-unit amounts by asset quantity to get total payments
const assetMap = new Map(assets.map((a: Asset) => [a.id!, a.quantity]));
const portfolioHistory = (allHistory ?? []).map((h) => ({
  amount: h.amount * (assetMap.get(h.assetId) ?? 1),
  date: new Date(h.date),
}));

// Replace IncomeChart with (quantity=1 since amounts are already total):
<PaymentHistoryChart history={portfolioHistory} quantity={1} />
```

- [ ] **Step 2: Update category-page similarly**

```typescript
// src/pages/category-page.tsx
import { useAllPaymentHistory } from '@/hooks/use-payment-history';
import { PaymentHistoryChart } from '@/components/shared/payment-history-chart';

// Inside component:
const allHistory = useAllPaymentHistory();
const categoryAssetIds = new Set(assets.map((a) => a.id!));
const assetMap = new Map(assets.map((a) => [a.id!, a.quantity]));
const categoryHistory = (allHistory ?? [])
  .filter((h) => categoryAssetIds.has(h.assetId))
  .map((h) => ({
    amount: h.amount * (assetMap.get(h.assetId) ?? 1),
    date: new Date(h.date),
  }));

// Replace IncomeChart with:
<PaymentHistoryChart history={categoryHistory} quantity={1} />
```

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/main-page.tsx src/pages/category-page.tsx
git commit -m "feat: main and category pages use PaymentHistoryChart with aggregated history"
```

---

### Task 12: Final Cleanup & Verification

**Files:**
- Various — remove dead code, verify all imports

- [ ] **Step 1: Remove dead IncomeChart references**

Search for any remaining imports of `income-chart` or `IncomeChart`. Remove them.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Run build**

Run: `npx vite build`
Expected: Clean build, no warnings about unused imports.

- [ ] **Step 4: Manual smoke test**

Run: `npx vite preview`
Verify:
- Main page: hero income shows, chart shows if history exists
- Category page: category stats, chart
- Asset detail: stat block with ф/п, tap expands panel, fact/forecast switching, decay average button, payment history chart with CAGR
- Sync: trigger sync, verify paymentHistory gets populated

- [ ] **Step 5: Commit (if any changes)**

```bash
git add -u
git commit -m "chore: cleanup dead IncomeChart references"
```

Note: `git add -u` stages only tracked files that were modified — safe for cleanup commits.
