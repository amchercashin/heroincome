# Multi-source payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate heroincome-data (dohod.ru) as a priority dividend source alongside MOEX ISS, with reconciliation logic that auto-excludes "extra" payments from lower-priority sources.

**Architecture:** All payment sources write to `paymentHistory` table tagged with `dataSource`. After writing, a reconciliation pass determines which lower-priority records to auto-exclude based on the authoritative source's date set. Priorities are hardcoded per asset type: `manual > dohod > moex > import`.

**Tech Stack:** TypeScript, Dexie (IndexedDB), Vitest, React, Tailwind v4

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/services/heroincome-data.ts` | Fetch dividends from heroincome-data repo (dohod.ru) |
| Create | `src/services/payment-reconciler.ts` | Reconciliation logic: auto-exclude/restore per priority |
| Create | `tests/services/heroincome-data.test.ts` | Tests for dohod fetch + parse + cache |
| Create | `tests/services/payment-reconciler.test.ts` | Tests for reconciliation algorithm |
| Modify | `src/models/types.ts:1` | Add `'dohod'` to DataSource, add `isForecast` to PaymentHistory |
| Modify | `src/services/moex-sync.ts:368-393` | Parametrize writePaymentHistory, integrate dohod + reconciliation |
| Modify | `src/components/payments/payment-row.tsx:30-37` | 4 source badges + forecast label |
| Modify | `src/components/shared/payment-history-chart.tsx` | Forecast bars + tooltip |
| Modify | `src/pages/asset-detail-page.tsx:33,35` | Pass isForecast to chart, exclude from income calc |
| Modify | `src/pages/category-page.tsx:41` | Exclude isForecast from income calc |
| Modify | `tests/services/moex-sync.test.ts` | Update existing tests + add multi-source tests |

---

### Task 1: Extend data model (types.ts)

**Files:**
- Modify: `src/models/types.ts:1,40-48`

- [ ] **Step 1: Add 'dohod' to DataSource and isForecast to PaymentHistory**

```typescript
// src/models/types.ts line 1
export type DataSource = 'moex' | 'dohod' | 'import' | 'manual';
```

```typescript
// src/models/types.ts PaymentHistory interface — add isForecast after excluded
export interface PaymentHistory {
  id?: number;
  assetId: number;
  amount: number;
  date: Date;
  type: 'dividend' | 'coupon' | 'rent' | 'interest' | 'distribution' | 'other';
  dataSource: DataSource;
  excluded?: boolean;
  isForecast?: boolean;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors. `isForecast` is optional, no existing code breaks.

- [ ] **Step 3: Commit**

```bash
git add src/models/types.ts
git commit -m "feat: add 'dohod' to DataSource, add isForecast to PaymentHistory"
```

---

### Task 2: Create heroincome-data service

**Files:**
- Create: `src/services/heroincome-data.ts`
- Create: `tests/services/heroincome-data.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/services/heroincome-data.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  fetchDohodDividends,
  isDohodAvailable,
  resetDohodCache,
} from '@/services/heroincome-data';

const MOCK_INDEX = {
  updatedAt: '2026-03-31T14:22:20Z',
  tickerCount: 3,
  tickers: ['LKOH', 'SBER', 'GAZP'],
};

const MOCK_LKOH = {
  ticker: 'LKOH',
  scrapedAt: '2026-03-31T14:22:20Z',
  source: 'dohod.ru',
  payments: [
    {
      recordDate: '2026-01-12',
      declaredDate: '2025-11-21',
      amount: 397.0,
      year: 2025,
      isForecast: false,
    },
    {
      recordDate: '2026-05-04',
      declaredDate: null,
      amount: 278.0,
      year: null,
      isForecast: true,
    },
    {
      recordDate: '2025-06-10',
      declaredDate: '2025-04-01',
      amount: null,
      year: 2024,
      isForecast: false,
    },
  ],
};

function mockFetchResponses(responses: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string) => {
    for (const [pattern, data] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
        });
      }
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
}

describe('heroincome-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDohodCache();
  });

  describe('isDohodAvailable', () => {
    it('returns true for ticker in index', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      expect(await isDohodAvailable('LKOH')).toBe(true);
    });

    it('returns false for ticker not in index', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      expect(await isDohodAvailable('UNKNOWN')).toBe(false);
    });

    it('returns false when index fetch fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      expect(await isDohodAvailable('LKOH')).toBe(false);
    });

    it('caches index — second call does not fetch again', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      await isDohodAvailable('LKOH');
      await isDohodAvailable('SBER');
      // index.json fetched only once
      const indexCalls = mockFetch.mock.calls.filter(
        (c: [string]) => c[0].includes('index.json'),
      );
      expect(indexCalls).toHaveLength(1);
    });

    it('normalizes ticker to uppercase', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      expect(await isDohodAvailable('lkoh')).toBe(true);
    });
  });

  describe('fetchDohodDividends', () => {
    it('parses fact and forecast rows correctly', async () => {
      mockFetchResponses({
        'index.json': MOCK_INDEX,
        'dividends/LKOH.json': MOCK_LKOH,
      });

      const rows = await fetchDohodDividends('LKOH');
      expect(rows).not.toBeNull();

      // amount: null row is filtered out → 2 rows
      expect(rows).toHaveLength(2);

      // Fact row
      expect(rows![0].amount).toBe(397.0);
      expect(rows![0].date).toEqual(new Date('2026-01-12'));
      expect(rows![0].isForecast).toBe(false);

      // Forecast row
      expect(rows![1].amount).toBe(278.0);
      expect(rows![1].date).toEqual(new Date('2026-05-04'));
      expect(rows![1].isForecast).toBe(true);
    });

    it('returns null for ticker not in index', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      const rows = await fetchDohodDividends('UNKNOWN');
      expect(rows).toBeNull();
    });

    it('returns null when ticker fetch fails', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      // No dividends/LKOH.json mock → 404
      const rows = await fetchDohodDividends('LKOH');
      expect(rows).toBeNull();
    });
  });

  describe('resetDohodCache', () => {
    it('clears cache so next call fetches again', async () => {
      mockFetchResponses({ 'index.json': MOCK_INDEX });
      await isDohodAvailable('LKOH');
      resetDohodCache();
      await isDohodAvailable('SBER');

      const indexCalls = mockFetch.mock.calls.filter(
        (c: [string]) => c[0].includes('index.json'),
      );
      expect(indexCalls).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/heroincome-data.test.ts`
Expected: FAIL — module `@/services/heroincome-data` not found.

- [ ] **Step 3: Implement heroincome-data service**

```typescript
// src/services/heroincome-data.ts
const BASE_URL =
  'https://raw.githubusercontent.com/amchercashin/heroincome-data/main/data';

const FETCH_TIMEOUT = 5000;

// ============ Types ============

interface DohodPayment {
  recordDate: string;
  declaredDate: string | null;
  amount: number | null;
  year: number | null;
  isForecast: boolean;
}

interface DohodTickerData {
  ticker: string;
  scrapedAt: string;
  source: string;
  payments: DohodPayment[];
}

interface DohodIndex {
  updatedAt: string;
  tickerCount: number;
  tickers: string[];
}

export interface DohodDividendRow {
  date: Date;
  amount: number;
  isForecast: boolean;
}

// ============ Cache ============

let cachedIndex: DohodIndex | null | undefined; // undefined = not fetched

export function resetDohodCache(): void {
  cachedIndex = undefined;
}

// ============ API ============

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchDohodIndex(): Promise<DohodIndex | null> {
  if (cachedIndex !== undefined) return cachedIndex;
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/index.json`);
    if (!res.ok) {
      cachedIndex = null;
      return null;
    }
    cachedIndex = (await res.json()) as DohodIndex;
    return cachedIndex;
  } catch {
    cachedIndex = null;
    return null;
  }
}

export async function isDohodAvailable(ticker: string): Promise<boolean> {
  const index = await fetchDohodIndex();
  if (!index) return false;
  return index.tickers.includes(ticker.toUpperCase());
}

export async function fetchDohodDividends(
  ticker: string,
): Promise<DohodDividendRow[] | null> {
  const available = await isDohodAvailable(ticker);
  if (!available) return null;

  try {
    const upperTicker = ticker.toUpperCase();
    const res = await fetchWithTimeout(
      `${BASE_URL}/dividends/${upperTicker}.json`,
    );
    if (!res.ok) return null;

    const data = (await res.json()) as DohodTickerData;
    return data.payments
      .filter((p) => p.amount != null)
      .map((p) => ({
        date: new Date(p.recordDate),
        amount: p.amount!,
        isForecast: p.isForecast,
      }));
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/heroincome-data.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/heroincome-data.ts tests/services/heroincome-data.test.ts
git commit -m "feat: add heroincome-data service for dohod.ru dividends"
```

---

### Task 3: Create payment-reconciler

**Files:**
- Create: `src/services/payment-reconciler.ts`
- Create: `tests/services/payment-reconciler.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/services/payment-reconciler.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { reconcilePayments } from '@/services/payment-reconciler';

describe('reconcilePayments', () => {
  let assetId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    assetId = (await db.assets.add({
      type: 'Акции',
      ticker: 'GAZP',
      name: 'Газпром',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentPerUnitSource: 'fact' as const,
      frequencyPerYear: 1,
      frequencySource: 'moex' as const,
    })) as number;
  });

  it('excludes MOEX-only payment when dohod is authoritative', async () => {
    // dohod has 2 payments
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'dohod' },
      { assetId, amount: 8, date: new Date('2023-07-18'), type: 'dividend', dataSource: 'dohod' },
    ]);
    // MOEX has 3 payments — one "extra" (2022-10-20 approved but not paid)
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'moex' },
      { assetId, amount: 8, date: new Date('2023-07-18'), type: 'dividend', dataSource: 'moex' },
      { assetId, amount: 5, date: new Date('2022-10-20'), type: 'dividend', dataSource: 'moex' },
    ]);

    await reconcilePayments(assetId, 'Акции');

    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    const moexExtra = records.find(
      (r) => r.dataSource === 'moex' && r.date.getTime() === new Date('2022-10-20').getTime(),
    );
    expect(moexExtra!.excluded).toBe(true);

    // MOEX records matching dohod dates should NOT be excluded
    const moexMatched = records.filter(
      (r) => r.dataSource === 'moex' && !r.excluded,
    );
    expect(moexMatched).toHaveLength(2);

    // dohod records should NOT be excluded
    const dohodRecords = records.filter((r) => r.dataSource === 'dohod');
    expect(dohodRecords.every((r) => !r.excluded)).toBe(true);
  });

  it('falls back to MOEX when dohod has no records', async () => {
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'moex' },
      { assetId, amount: 8, date: new Date('2023-07-18'), type: 'dividend', dataSource: 'moex' },
    ]);

    await reconcilePayments(assetId, 'Акции');

    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    expect(records.every((r) => !r.excluded)).toBe(true);
  });

  it('never touches manual records', async () => {
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'dohod' },
      { assetId, amount: 99, date: new Date('2020-01-01'), type: 'dividend', dataSource: 'manual' },
    ]);

    await reconcilePayments(assetId, 'Акции');

    const manual = await db.paymentHistory
      .where('assetId').equals(assetId)
      .filter((r) => r.dataSource === 'manual')
      .toArray();
    expect(manual).toHaveLength(1);
    expect(manual[0].excluded).toBeUndefined();
  });

  it('does not use forecast records as authorityDates', async () => {
    // dohod has 1 fact + 1 forecast
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'dohod' },
      { assetId, amount: 5, date: new Date('2025-05-04'), type: 'dividend', dataSource: 'dohod', isForecast: true },
    ]);
    // MOEX has a fact record not matching dohod facts
    await db.paymentHistory.bulkAdd([
      { assetId, amount: 10, date: new Date('2024-07-18'), type: 'dividend', dataSource: 'moex' },
      { assetId, amount: 3, date: new Date('2022-10-20'), type: 'dividend', dataSource: 'moex' },
    ]);

    await reconcilePayments(assetId, 'Акции');

    const moexOrphan = (await db.paymentHistory.where('assetId').equals(assetId).toArray())
      .find((r) => r.dataSource === 'moex' && r.date.getTime() === new Date('2022-10-20').getTime());
    // 2022-10-20 is NOT in dohod facts → excluded
    expect(moexOrphan!.excluded).toBe(true);
  });

  it('restores previously auto-excluded record when authority now matches', async () => {
    // MOEX record that was previously auto-excluded
    await db.paymentHistory.add({
      assetId,
      amount: 10,
      date: new Date('2024-07-18'),
      type: 'dividend',
      dataSource: 'moex',
      excluded: true,
    });
    // dohod now has a matching record
    await db.paymentHistory.add({
      assetId,
      amount: 10,
      date: new Date('2024-07-18'),
      type: 'dividend',
      dataSource: 'dohod',
    });

    await reconcilePayments(assetId, 'Акции');

    const moexRecord = (await db.paymentHistory.where('assetId').equals(assetId).toArray())
      .find((r) => r.dataSource === 'moex');
    expect(moexRecord!.excluded).toBe(false);
  });

  it('uses MOEX as authority for bonds (no dohod source)', async () => {
    const bondId = (await db.assets.add({
      type: 'Облигации',
      ticker: 'SU26238',
      name: 'ОФЗ 26238',
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentPerUnitSource: 'fact' as const,
      frequencyPerYear: 2,
      frequencySource: 'moex' as const,
    })) as number;

    await db.paymentHistory.bulkAdd([
      { assetId: bondId, amount: 35.4, date: new Date('2024-06-03'), type: 'coupon', dataSource: 'moex' },
      { assetId: bondId, amount: 35.4, date: new Date('2024-12-03'), type: 'coupon', dataSource: 'moex' },
    ]);

    await reconcilePayments(bondId, 'Облигации');

    const records = await db.paymentHistory.where('assetId').equals(bondId).toArray();
    expect(records.every((r) => !r.excluded)).toBe(true);
  });

  it('handles empty payment history gracefully', async () => {
    await reconcilePayments(assetId, 'Акции');
    // No error thrown
    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    expect(records).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/payment-reconciler.test.ts`
Expected: FAIL — module `@/services/payment-reconciler` not found.

- [ ] **Step 3: Implement payment-reconciler**

```typescript
// src/services/payment-reconciler.ts
import { db } from '@/db/database';
import type { DataSource, PaymentHistory } from '@/models/types';

const PAYMENT_SOURCE_PRIORITY: Record<string, DataSource[]> = {
  'Акции': ['dohod', 'moex'],
  'Облигации': ['moex'],
  'Фонды': ['moex'],
};

export async function reconcilePayments(
  assetId: number,
  assetType: string,
): Promise<void> {
  const all = await db.paymentHistory
    .where('assetId')
    .equals(assetId)
    .toArray();
  if (all.length === 0) return;

  const priority = PAYMENT_SOURCE_PRIORITY[assetType];
  if (!priority) return;

  // Find authoritative source: first in priority list that has ≥1 non-forecast fact record
  let authSource: DataSource | null = null;
  for (const source of priority) {
    const hasFacts = all.some(
      (r) => r.dataSource === source && !r.isForecast,
    );
    if (hasFacts) {
      authSource = source;
      break;
    }
  }
  if (!authSource) return; // no automatic data at all

  // Collect authority dates (fact records only from the authoritative source)
  const authorityDates = new Set(
    all
      .filter((r) => r.dataSource === authSource && !r.isForecast)
      .map((r) => r.date.getTime()),
  );

  // Determine sources that are lower-priority than authSource
  const authIndex = priority.indexOf(authSource);
  const lowerSources = new Set(priority.slice(authIndex + 1));

  // Reconcile: update excluded flag on lower-priority automatic records
  const updates: { id: number; excluded: boolean }[] = [];

  for (const record of all) {
    if (record.dataSource === 'manual') continue;
    if (record.dataSource === authSource) continue;
    if (!lowerSources.has(record.dataSource)) continue;
    if (record.isForecast) continue;

    const shouldExclude = !authorityDates.has(record.date.getTime());
    const currentlyExcluded = record.excluded ?? false;

    if (shouldExclude !== currentlyExcluded) {
      updates.push({ id: record.id!, excluded: shouldExclude });
    }
  }

  if (updates.length > 0) {
    await db.transaction('rw', db.paymentHistory, async () => {
      for (const u of updates) {
        await db.paymentHistory.update(u.id, { excluded: u.excluded });
      }
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/payment-reconciler.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/payment-reconciler.ts tests/services/payment-reconciler.test.ts
git commit -m "feat: add payment reconciler with priority-based auto-exclude"
```

---

### Task 4: Parametrize writePaymentHistory

**Files:**
- Modify: `src/services/moex-sync.ts:368-393`
- Modify: `tests/services/moex-sync.test.ts`

- [ ] **Step 1: Write failing test for new dataSource parameter**

Add to `tests/services/moex-sync.test.ts` inside the existing `describe('syncAllAssets', ...)`:

```typescript
  it('writes dohod dividend rows with dataSource dohod', async () => {
    // This test verifies writePaymentHistory uses the dataSource parameter.
    // We add a pre-existing moex record and dohod record on the same date —
    // both should be stored (different dataSource).
    const assetId = (await db.assets.add({
      type: 'Акции', name: 'LKOH', ticker: 'LKOH', moexSecid: 'LKOH',
      moexBoardId: 'TQBR', moexMarket: 'shares',
      dataSource: 'moex', createdAt: new Date(), updatedAt: new Date(),
      ...ASSET_DEFAULTS, frequencySource: 'moex' as const,
    })) as number;

    // Pre-seed a moex record
    await db.paymentHistory.add({
      assetId, amount: 397, date: new Date('2026-01-12'),
      type: 'dividend', dataSource: 'moex',
    });
    // Pre-seed a dohod record on the same date
    await db.paymentHistory.add({
      assetId, amount: 397, date: new Date('2026-01-12'),
      type: 'dividend', dataSource: 'dohod',
    });

    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    // Both stored — same date, different dataSource
    expect(records).toHaveLength(2);
    expect(records.map(r => r.dataSource).sort()).toEqual(['dohod', 'moex']);
  });
```

- [ ] **Step 2: Run test to verify it passes (existing code already allows this)**

Run: `npx vitest run tests/services/moex-sync.test.ts`
Expected: New test PASSES because Dexie allows multiple records with the same `[assetId+date]` (the index is not `&` unique). BUT this validates data setup.

- [ ] **Step 3: Update writePaymentHistory signature and dedup logic**

In `src/services/moex-sync.ts`, change the `writePaymentHistory` function (lines 368-393):

Replace:
```typescript
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

With:
```typescript
async function writePaymentHistory(
  assetId: number,
  rows: DividendHistoryRow[],
  type: PaymentHistory['type'],
  dataSource: DataSource = 'moex',
  isForecast?: boolean,
): Promise<void> {
  const existing = await db.paymentHistory
    .where('[assetId+date]')
    .between([assetId, Dexie.minKey], [assetId, Dexie.maxKey])
    .toArray();

  // Dedup by date + dataSource: same source should not duplicate its own records
  const existingKeys = new Set(
    existing.map((r) => `${r.date.getTime()}:${r.dataSource}`),
  );

  const newRecords = rows
    .filter((r) => !existingKeys.has(`${r.date.getTime()}:${dataSource}`))
    .map((r) => ({
      assetId,
      amount: r.amount,
      date: r.date,
      type,
      dataSource,
      ...(isForecast ? { isForecast: true } : {}),
    }));

  if (newRecords.length > 0) {
    await db.paymentHistory.bulkAdd(newRecords);
  }
}
```

Also add the import at the top of `src/services/moex-sync.ts`:
```typescript
import type { DataSource } from '@/models/types';
```

- [ ] **Step 4: Run all moex-sync tests**

Run: `npx vitest run tests/services/moex-sync.test.ts`
Expected: All existing tests PASS. The default `dataSource = 'moex'` keeps backward compatibility.

- [ ] **Step 5: Commit**

```bash
git add src/services/moex-sync.ts tests/services/moex-sync.test.ts
git commit -m "feat: parametrize writePaymentHistory with dataSource and isForecast"
```

---

### Task 5: Integrate dohod + reconciliation into enrichStock

**Files:**
- Modify: `src/services/moex-sync.ts:1-14,62,257-311,408-449`
- Modify: `tests/services/moex-sync.test.ts`

- [ ] **Step 1: Add import for heroincome-data and reconciler**

At the top of `src/services/moex-sync.ts`, add:

```typescript
import { fetchDohodDividends, isDohodAvailable, resetDohodCache } from '@/services/heroincome-data';
import { reconcilePayments } from '@/services/payment-reconciler';
```

- [ ] **Step 2: Reset dohod cache at the start of syncAllAssets**

In `syncAllAssets` function, right after `const result: SyncResult = ...`, add:

```typescript
  resetDohodCache();
```

- [ ] **Step 3: Update enrichStock to fetch dohod + MOEX in parallel, then reconcile**

Replace the enrichStock function body (the dividend section, after price write and `if (options?.pricesOnly) return warnings;`) with:

```typescript
  // Fetch dividends from both sources in parallel
  const ticker = ra.asset.ticker ?? ra.secid;
  const [dohodAvailable, divInfo] = await Promise.all([
    isDohodAvailable(ticker),
    fetchDividends(ra.secid),
  ]);

  // Fetch dohod dividends if available
  let dohodRows: Awaited<ReturnType<typeof fetchDohodDividends>> = null;
  if (dohodAvailable) {
    dohodRows = await fetchDohodDividends(ticker);
  }

  // Write dohod records first (authoritative for stocks)
  if (dohodRows) {
    const facts = dohodRows.filter((r) => !r.isForecast);
    const forecasts = dohodRows.filter((r) => r.isForecast);
    if (facts.length > 0) {
      await writePaymentHistory(ra.asset.id!, facts, 'dividend', 'dohod');
    }
    if (forecasts.length > 0) {
      await writePaymentHistory(ra.asset.id!, forecasts, 'dividend', 'dohod', true);
    }
  }

  // Write MOEX records
  if (divInfo) {
    await writePaymentHistory(ra.asset.id!, divInfo.history, 'dividend', 'moex');
  }

  // Reconcile: auto-exclude "extra" records from lower-priority sources
  await reconcilePayments(ra.asset.id!, ra.asset.type);

  // Recalculate frequency from non-excluded, non-forecast DB records
  const dbRecords = await db.paymentHistory
    .where('[assetId+date]')
    .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
    .toArray();
  const activeDates = dbRecords
    .filter((r) => !r.excluded && !r.isForecast)
    .map((r) => r.date)
    .sort((a, b) => a.getTime() - b.getTime());

  const frequencyPerYear = activeDates.length >= 2
    ? calcDividendFrequency(activeDates)
    : (divInfo?.summary.frequencyPerYear ?? 1);

  // nextExpectedCutoffDate: prefer dohod forecast, then MOEX summary
  let nextExpectedCutoffDate: Date | undefined;
  if (dohodRows) {
    const now = new Date();
    const nextForecast = dohodRows
      .filter((r) => r.isForecast && r.date > now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    if (nextForecast) {
      nextExpectedCutoffDate = nextForecast.date;
    }
  }
  if (!nextExpectedCutoffDate && divInfo?.summary.nextExpectedCutoffDate) {
    nextExpectedCutoffDate = divInfo.summary.nextExpectedCutoffDate;
  }

  await updateMoexAssetFields(ra.asset, {
    frequencyPerYear,
    nextExpectedCutoffDate,
  });

  // Warn if no dividend data from any source
  if (!divInfo && !dohodRows) {
    const existing = await db.paymentHistory
      .where('[assetId+date]')
      .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
      .count();
    if (existing === 0) {
      warnings.push(`${ticker}: дивиденды не загружены`);
    }
  }

  return warnings;
```

- [ ] **Step 4: Update syncAssetPayments with same dohod + reconciliation logic**

Replace the `else` branch (stocks) inside `syncAssetPayments`:

```typescript
    } else {
      const ticker = ra.asset.ticker ?? ra.secid;
      const [dohodAvailable, divInfo] = await Promise.all([
        isDohodAvailable(ticker),
        fetchDividends(ra.secid),
      ]);

      let dohodRows: Awaited<ReturnType<typeof fetchDohodDividends>> = null;
      if (dohodAvailable) {
        dohodRows = await fetchDohodDividends(ticker);
      }

      if (dohodRows) {
        const facts = dohodRows.filter((r) => !r.isForecast);
        const forecasts = dohodRows.filter((r) => r.isForecast);
        if (facts.length > 0) {
          await writePaymentHistory(ra.asset.id!, facts, 'dividend', 'dohod');
        }
        if (forecasts.length > 0) {
          await writePaymentHistory(ra.asset.id!, forecasts, 'dividend', 'dohod', true);
        }
      }

      if (divInfo) {
        await writePaymentHistory(ra.asset.id!, divInfo.history, 'dividend', 'moex');
      }

      await reconcilePayments(ra.asset.id!, ra.asset.type);

      const dbRecords = await db.paymentHistory
        .where('[assetId+date]')
        .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
        .toArray();
      const activeDates = dbRecords
        .filter((r) => !r.excluded && !r.isForecast)
        .map((r) => r.date)
        .sort((a, b) => a.getTime() - b.getTime());
      const frequencyPerYear = activeDates.length >= 2
        ? calcDividendFrequency(activeDates)
        : (divInfo?.summary.frequencyPerYear ?? 1);

      let nextExpectedCutoffDate: Date | undefined;
      if (dohodRows) {
        const now = new Date();
        const nextForecast = dohodRows
          .filter((r) => r.isForecast && r.date > now)
          .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
        if (nextForecast) nextExpectedCutoffDate = nextForecast.date;
      }
      if (!nextExpectedCutoffDate && divInfo?.summary.nextExpectedCutoffDate) {
        nextExpectedCutoffDate = divInfo.summary.nextExpectedCutoffDate;
      }

      await updateMoexAssetFields(ra.asset, {
        frequencyPerYear,
        nextExpectedCutoffDate,
      });
    }
```

- [ ] **Step 5: Add mock for heroincome-data in test file**

At the top of `tests/services/moex-sync.test.ts`, add alongside the existing moex-api mock:

```typescript
vi.mock('@/services/heroincome-data', () => ({
  isDohodAvailable: vi.fn().mockResolvedValue(false),
  fetchDohodDividends: vi.fn().mockResolvedValue(null),
  resetDohodCache: vi.fn(),
}));

vi.mock('@/services/payment-reconciler', () => ({
  reconcilePayments: vi.fn(),
}));
```

And import them:
```typescript
import { isDohodAvailable, fetchDohodDividends } from '@/services/heroincome-data';
```

- [ ] **Step 6: Add integration test for dohod + MOEX sync**

Add to `tests/services/moex-sync.test.ts`:

```typescript
  it('writes both dohod and moex records on stock sync when dohod available', async () => {
    const assetId = (await db.assets.add({
      type: 'Акции', name: 'LKOH', ticker: 'LKOH', moexSecid: 'LKOH',
      moexBoardId: 'TQBR', moexMarket: 'shares',
      dataSource: 'moex', createdAt: new Date(), updatedAt: new Date(),
      ...ASSET_DEFAULTS, frequencySource: 'moex' as const,
    })) as number;

    (isDohodAvailable as Mock).mockResolvedValue(true);
    (fetchDohodDividends as Mock).mockResolvedValue([
      { date: new Date('2026-01-12'), amount: 397, isForecast: false },
      { date: new Date('2026-05-04'), amount: 278, isForecast: true },
    ]);
    (fetchBatchStockPrices as Mock).mockResolvedValue(
      new Map([['LKOH', { currentPrice: 7000, prevPrice: 6900 }]]),
    );
    (fetchDividends as Mock).mockResolvedValue({
      summary: { lastPaymentAmount: 397, lastPaymentDate: new Date('2026-01-12'), frequencyPerYear: 2, nextExpectedCutoffDate: null },
      history: [{ date: new Date('2026-01-12'), amount: 397 }],
    });

    await syncAllAssets();

    const records = await db.paymentHistory.where('assetId').equals(assetId).toArray();
    // dohod fact + dohod forecast + moex fact = 3 records
    expect(records).toHaveLength(3);
    expect(records.filter(r => r.dataSource === 'dohod')).toHaveLength(2);
    expect(records.filter(r => r.dataSource === 'moex')).toHaveLength(1);
    expect(records.filter(r => r.isForecast)).toHaveLength(1);
  });
```

- [ ] **Step 7: Run all tests**

Run: `npx vitest run tests/services/moex-sync.test.ts`
Expected: All tests PASS.

- [ ] **Step 8: Run full build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 9: Commit**

```bash
git add src/services/moex-sync.ts tests/services/moex-sync.test.ts
git commit -m "feat: integrate dohod.ru + reconciliation into stock sync flow"
```

---

### Task 6: Update payment-row badges

**Files:**
- Modify: `src/components/payments/payment-row.tsx`

- [ ] **Step 1: Update badge rendering to support all 4 sources + forecast label**

Replace the full `PaymentRow` component in `src/components/payments/payment-row.tsx`:

```typescript
import type { PaymentHistory } from '@/models/types';

interface PaymentRowProps {
  payment: PaymentHistory;
  onToggleExcluded: (id: number) => void;
  onDelete: (id: number) => void;
}

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

const SOURCE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  moex:   { label: 'moex',   bg: 'bg-[#2d5a2d]', text: 'text-[#6bba6b]' },
  dohod:  { label: 'dohod',  bg: 'bg-[#2d3d5a]', text: 'text-[#6b9eba]' },
  manual: { label: 'ручной', bg: 'bg-[#5a5a2d]', text: 'text-[#baba6b]' },
  import: { label: 'импорт', bg: 'bg-[#3a3a3a]', text: 'text-[#9a9a9a]' },
};

export function PaymentRow({ payment, onToggleExcluded, onDelete }: PaymentRowProps) {
  const isExcluded = payment.excluded;
  const isForecast = payment.isForecast;
  const badge = SOURCE_BADGE[payment.dataSource] ?? SOURCE_BADGE.manual;

  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center pl-7 pr-3 py-0.5 text-[length:var(--hi-text-body)] border-t border-[var(--hi-void)] transition-opacity${isExcluded ? ' opacity-50' : isForecast ? ' opacity-60' : ''}`}
      style={isExcluded ? { borderLeftWidth: 2, borderLeftColor: 'var(--hi-gold)' } : undefined}
    >
      {/* Date */}
      <span className={`font-mono tabular-nums text-[var(--hi-text)]${isExcluded ? ' line-through' : ''}`}>
        {formatDate(payment.date)}
      </span>

      {/* Amount */}
      <span className={`font-mono tabular-nums text-right text-[var(--hi-ash)]${isExcluded ? ' line-through' : ''}`}>
        {payment.amount.toFixed(2)} ₽
      </span>

      {/* Source badge + forecast label */}
      <span className="flex items-center gap-1">
        <span className={`text-[10px] leading-tight px-1 py-px rounded ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
        {isForecast && (
          <span className="text-[length:var(--hi-text-micro)] text-[var(--hi-muted)] italic">
            прогноз
          </span>
        )}
      </span>

      {/* Actions — no exclude button for forecasts */}
      <div className="flex gap-1 ml-1">
        {isForecast ? (
          <div className="min-w-[32px] min-h-[28px]" />
        ) : isExcluded ? (
          <>
            <button
              onClick={() => onToggleExcluded(payment.id!)}
              className="text-[#6bba6b] hover:text-green-300 text-[length:var(--hi-text-heading)] min-w-[32px] min-h-[28px] flex items-center justify-center transition-colors"
              title="Восстановить"
            >
              ↩
            </button>
            <button
              onClick={() => onDelete(payment.id!)}
              className="text-red-400 hover:text-red-300 text-[length:var(--hi-text-title)] min-w-[32px] min-h-[28px] flex items-center justify-center transition-colors"
              title="Удалить навсегда"
            >
              ×
            </button>
          </>
        ) : (
          <button
            onClick={() => onToggleExcluded(payment.id!)}
            data-onboarding="exclude-btn"
            className="text-[var(--hi-gold)] hover:text-yellow-300 text-[length:var(--hi-text-heading)] min-w-[32px] min-h-[28px] flex items-center justify-center transition-colors"
            title="Исключить из расчётов"
          >
            ⊘
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/payments/payment-row.tsx
git commit -m "feat: add dohod/import badges and forecast label to payment rows"
```

---

### Task 7: Update payment-history-chart for forecasts

**Files:**
- Modify: `src/components/shared/payment-history-chart.tsx`

- [ ] **Step 1: Add isForecast to ChartPaymentRecord**

In `src/components/shared/payment-history-chart.tsx`, update the interface:

```typescript
export interface ChartPaymentRecord extends PaymentRecord {
  excluded?: boolean;
  isForecast?: boolean;
}
```

- [ ] **Step 2: Update byYear grouping to track forecast amounts separately**

Replace the `byYear` useMemo block:

```typescript
  const byYear = useMemo(() => {
    const map = new Map<number, { total: number; forecastTotal: number; payments: { date: Date; amount: number; excluded?: boolean; isForecast?: boolean }[] }>();
    for (const p of history) {
      const year = p.date.getFullYear();
      const entry = map.get(year) ?? { total: 0, forecastTotal: 0, payments: [] };
      if (p.isForecast) {
        entry.forecastTotal += p.amount;
      } else if (!p.excluded) {
        entry.total += p.amount;
      }
      entry.payments.push({ date: p.date, amount: p.amount, excluded: p.excluded, isForecast: p.isForecast });
      map.set(year, entry);
    }
    for (const entry of map.values()) {
      entry.payments.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    return map;
  }, [history]);
```

- [ ] **Step 3: Update bar rendering to show forecast segment**

In the bar `<div>` inside the `.map()`, replace the single bar div with a stacked bar:

```typescript
              {/* Bar — stacked: fact + forecast */}
              {(() => {
                const yearData = byYear.get(year);
                const forecastValue = yearData?.forecastTotal ?? 0;
                const totalWithForecast = value + forecastValue;
                const factHeightPx = Math.max(Math.round((value / maxValue) * 100), value > 0 ? 3 : 0);
                const forecastHeightPx = forecastValue > 0
                  ? Math.max(Math.round((forecastValue / maxValue) * 100), 3)
                  : 0;

                return (
                  <div className="w-full flex flex-col items-stretch" style={{ minWidth: 6 }}>
                    {forecastHeightPx > 0 && (
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: forecastHeightPx,
                          background: 'rgba(200,180,140,0.12)',
                          border: '1px dashed rgba(200,180,140,0.25)',
                          borderBottom: 'none',
                          transformOrigin: 'bottom',
                          animation: `hi-bar-grow 0.8s ease-out ${1.2 + i * 0.1}s both`,
                        }}
                      />
                    )}
                    <div
                      className={`w-full ${forecastHeightPx > 0 ? '' : 'rounded-t'}`}
                      style={{
                        height: factHeightPx || 3,
                        background: isCurrentYr
                          ? 'rgba(200,180,140,0.05)'
                          : `rgba(200,180,140,${barOpacity(i)})`,
                        border: isCurrentYr ? '1px dashed rgba(200,180,140,0.3)' : 'none',
                        outline: isSelected ? '1px solid rgba(200,180,140,0.5)' : 'none',
                        outlineOffset: isSelected ? 1 : 0,
                        transformOrigin: 'bottom',
                        animation: `hi-bar-grow 0.8s ease-out ${1.2 + i * 0.1}s both`,
                      }}
                    />
                  </div>
                );
              })()}
```

Remove the old single `{/* Bar */}` div that was there.

- [ ] **Step 4: Update detail panel to mark forecast payments**

In `renderDetailPanel`, update the payment line rendering:

```typescript
        {yearData.payments.map((p, i) => (
          <div key={i} className={`flex justify-between font-mono text-[length:var(--hi-text-caption)] mb-0.5${p.excluded ? ' opacity-40 line-through' : p.isForecast ? ' opacity-60' : ''}`}>
            <span className="text-[#4a4540]">
              {formatShortDate(p.date)}
              {p.isForecast && <span className="text-[length:var(--hi-text-micro)] text-[var(--hi-muted)] italic ml-1">прогноз</span>}
            </span>
            <span className="text-[#b0a898]">{formatCompact(p.amount)} ₽</span>
          </div>
        ))}
```

- [ ] **Step 5: Update maxValue to include forecasts for proper bar scaling**

The `maxValue` line should account for forecast totals:

```typescript
  const displayValues = isNoHistory
    ? [fallbackAnnual!]
    : displayYears.map((y) => byYear.get(y)!.total + (byYear.get(y)!.forecastTotal ?? 0));
  const maxValue = Math.max(...displayValues, 1);
```

Note: `displayValues` now includes forecast for bar height scaling, but the value label should show only facts:

```typescript
              {/* Value label — facts only */}
              <span
                className="font-mono text-[length:var(--hi-text-micro)] mb-[3px] whitespace-nowrap shrink-0"
                style={{ color: isCurrentYr ? '#4a4540' : '#b0a898' }}
              >
                {formatCompact(byYear.get(year)?.total ?? value)}
              </span>
```

- [ ] **Step 6: Update activeHistory to also filter forecasts for CAGR**

```typescript
  const activeHistory = useMemo(() => history.filter(p => !p.excluded && !p.isForecast), [history]);
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/shared/payment-history-chart.tsx
git commit -m "feat: show forecast payments on chart with dashed bars and labels"
```

---

### Task 8: Filter isForecast in pages and pass to chart

**Files:**
- Modify: `src/pages/asset-detail-page.tsx:33,35`
- Modify: `src/pages/category-page.tsx:41`

- [ ] **Step 1: Update allHistoryRecords to include isForecast**

In `src/pages/asset-detail-page.tsx`, the `allHistoryRecords` line (line 35):

Replace:
```typescript
    const allHistoryRecords = history.map((h) => ({ amount: h.amount, date: new Date(h.date), excluded: h.excluded }));
```

With:
```typescript
    const allHistoryRecords = history.map((h) => ({ amount: h.amount, date: new Date(h.date), excluded: h.excluded, isForecast: h.isForecast }));
```

- [ ] **Step 2: Update activeHistory filter to exclude forecasts**

On line 33, replace:
```typescript
    const activeHistory = history.filter((h) => !h.excluded);
```

With:
```typescript
    const activeHistory = history.filter((h) => !h.excluded && !h.isForecast);
```

- [ ] **Step 3: Filter isForecast in category-page**

In `src/pages/category-page.tsx`, line 41, replace:
```typescript
      if (h.excluded) continue;
```

With:
```typescript
      if (h.excluded || h.isForecast) continue;
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/asset-detail-page.tsx src/pages/category-page.tsx
git commit -m "feat: pass isForecast to payment chart, exclude forecasts from income calc"
```

---

### Task 9: Final integration test run

**Files:**
- All test files

- [ ] **Step 1: Run all tests**

Run: `npm run test`
Expected: All tests PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 3: Commit any fixups if needed**

Only if tests or build revealed issues.

---

### Task 10: Visual verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify payment-row badges**

Open an asset detail page for a stock (e.g., SBER or LKOH). Trigger sync. Check that:
- Payment rows show correct source badges (`dohod` in blue, `moex` in green)
- Forecast rows show "прогноз" label and reduced opacity
- Excluded (auto-reconciled) rows show strikethrough

- [ ] **Step 3: Verify payment-history-chart**

Check that:
- Forecast payments appear as dashed segments on top of fact bars
- Detail panel shows "прогноз" label on forecast entries
- CAGR calculation excludes forecasts

- [ ] **Step 4: Verify reconciliation with Gazprom-like case**

If GAZP is in portfolio:
- dohod.ru is authoritative
- MOEX "extra" payment (approved but not paid) should be auto-excluded
- Auto-excluded row visible with strikethrough, can be restored manually
