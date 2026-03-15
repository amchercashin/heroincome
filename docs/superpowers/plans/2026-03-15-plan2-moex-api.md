# Plan 2: MOEX API — Dividends, Coupons, Prices

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch current prices, dividends, and coupon data from MOEX ISS API for exchange-traded assets and sync them into the portfolio.

**Architecture:** Pure service `moex-api.ts` handles MOEX ISS API communication — response parsing, URL construction, error handling. Separate `moex-sync.ts` orchestrates DB updates from API data. React hook `use-moex-sync.ts` exposes sync state. Existing ⟳ placeholder on main page becomes a working refresh button.

**Tech Stack:** MOEX ISS API (JSON, no auth, CORS enabled), native `fetch()`, Vitest + `vi.stubGlobal` for fetch mocking

**Spec:** `docs/superpowers/specs/2026-03-15-passive-income-tracker-design.md` (sections 3.3, 4.5, 5.2)

**Design decisions:**
- `/iss/cci/corp-actions/` endpoints require MOEX subscription → use public alternatives:
  - Dividends: `/iss/securities/{ticker}/dividends.json` (all historical + announced)
  - Bond coupons: securities endpoint already returns `COUPONVALUE`, `NEXTCOUPON`, `COUPONPERIOD` — no separate fetch needed
  - Prices: `/iss/engines/stock/markets/{market}/boards/{board}/securities/{ticker}.json`
- Board/market resolved via `/iss/securities.json?q={ticker}` search → `primary_boardid` + `group`
- Board-to-market map: `TQBR`/`TQTF`/`TQPI` → `shares`, `TQOB`/`TQCB` → `bonds`; group-based fallback for unknown boards
- Dividend frequency calculated from historical intervals between payment dates
- Sync never overwrites `PaymentSchedule` with `dataSource: 'manual'` (user overrides are sacred)
- `Asset.currentPrice` always updated from MOEX (market data is authoritative for price)
- `Asset.dataSource` NOT changed by price-only sync (preserves user's manual/import flag for quantity etc.)
- No DB schema migration needed — existing v1 schema has all required fields
- Sequential sync per asset (adequate for portfolios of 10–50 positions)

---

## File Structure

```
src/services/
├── moex-api.ts           # MOEX ISS API: types, response parsing, fetch functions
└── moex-sync.ts          # Sync orchestrator: MOEX data → IndexedDB

src/hooks/
└── use-moex-sync.ts      # Hook: syncing state, lastSyncAt, sync(), error

tests/services/
├── moex-api.test.ts      # Pure function tests + fetch tests (mocked globalThis.fetch)
└── moex-sync.test.ts     # Integration tests (mocked moex-api, real fake-indexeddb)
```

Modified files:
- `src/pages/main-page.tsx` — wire ⟳ button to `useMoexSync()`, add last-sync label

---

## Chunk 1: MOEX API Client

### Task 1: Types, ISS response parser, dividend parsing

**Files:**
- Create: `src/services/moex-api.ts`
- Create: `tests/services/moex-api.test.ts`

- [ ] **Step 1: Write failing tests for pure parsing functions**

Create `tests/services/moex-api.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseISSBlock,
  calcDividendFrequency,
  parseDividendHistory,
} from '@/services/moex-api';

describe('parseISSBlock', () => {
  it('converts ISS columns+data to array of objects', () => {
    const block = {
      columns: ['secid', 'value', 'date'],
      data: [
        ['SBER', 33.3, '2024-07-11'],
        ['SBER', 34.84, '2025-07-18'],
      ],
    };
    expect(parseISSBlock(block)).toEqual([
      { secid: 'SBER', value: 33.3, date: '2024-07-11' },
      { secid: 'SBER', value: 34.84, date: '2025-07-18' },
    ]);
  });

  it('returns empty array for empty data', () => {
    expect(parseISSBlock({ columns: ['a'], data: [] })).toEqual([]);
  });
});

describe('calcDividendFrequency', () => {
  it('detects annual frequency (~365 day intervals)', () => {
    const dates = [
      new Date('2022-07-01'),
      new Date('2023-06-28'),
      new Date('2024-07-03'),
    ];
    expect(calcDividendFrequency(dates)).toBe(1);
  });

  it('detects semi-annual frequency (~180 day intervals)', () => {
    const dates = [
      new Date('2024-01-15'),
      new Date('2024-07-10'),
      new Date('2025-01-12'),
      new Date('2025-07-14'),
    ];
    expect(calcDividendFrequency(dates)).toBe(2);
  });

  it('detects quarterly frequency (~90 day intervals)', () => {
    const dates = [
      new Date('2024-01-15'),
      new Date('2024-04-12'),
      new Date('2024-07-15'),
      new Date('2024-10-14'),
    ];
    expect(calcDividendFrequency(dates)).toBe(4);
  });

  it('returns 1 for single payment date', () => {
    expect(calcDividendFrequency([new Date('2024-07-01')])).toBe(1);
  });
});

describe('parseDividendHistory', () => {
  const today = new Date('2026-03-15');

  it('extracts last payment and annual frequency', () => {
    const rows = [
      { registryclosedate: '2023-05-11', value: 25.0 },
      { registryclosedate: '2024-07-11', value: 33.3 },
      { registryclosedate: '2025-07-18', value: 34.84 },
    ];
    const result = parseDividendHistory(rows, today);
    expect(result).not.toBeNull();
    expect(result!.lastPaymentAmount).toBe(34.84);
    expect(result!.lastPaymentDate).toEqual(new Date('2025-07-18'));
    expect(result!.frequencyPerYear).toBe(1);
    expect(result!.nextExpectedCutoffDate).toBeNull();
  });

  it('detects announced future dividend as nextExpectedCutoffDate', () => {
    const rows = [
      { registryclosedate: '2024-07-11', value: 33.3 },
      { registryclosedate: '2025-07-18', value: 34.84 },
      { registryclosedate: '2026-07-20', value: 36.0 },
    ];
    const result = parseDividendHistory(rows, today);
    expect(result!.lastPaymentAmount).toBe(34.84);
    expect(result!.nextExpectedCutoffDate).toEqual(new Date('2026-07-20'));
  });

  it('returns null for empty history', () => {
    expect(parseDividendHistory([], today)).toBeNull();
  });

  it('returns null when no past payments exist', () => {
    const rows = [{ registryclosedate: '2027-01-01', value: 10.0 }];
    expect(parseDividendHistory(rows, today)).toBeNull();
  });

  it('skips rows with null value', () => {
    const rows = [
      { registryclosedate: '2024-07-11', value: null },
      { registryclosedate: '2025-07-18', value: 34.84 },
    ];
    const result = parseDividendHistory(rows, today);
    expect(result!.lastPaymentAmount).toBe(34.84);
    expect(result!.frequencyPerYear).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/moex-api.test.ts`
Expected: FAIL — module `@/services/moex-api` does not exist

- [ ] **Step 3: Implement types and pure parsing functions**

Create `src/services/moex-api.ts`:

```typescript
const MOEX_BASE_URL = 'https://iss.moex.com/iss';

// ============ Types ============

export interface ISSBlock {
  columns: string[];
  data: (string | number | null)[][];
}

interface ISSResponse {
  [blockName: string]: ISSBlock;
}

export interface SecurityInfo {
  secid: string;
  primaryBoardId: string;
  market: 'shares' | 'bonds';
}

export interface StockPriceResult {
  currentPrice: number | null;
  prevPrice: number | null;
}

export interface BondDataResult {
  /** Price as percentage of face value (e.g. 61.5 means 61.5% of nominal) */
  currentPrice: number | null;
  prevPrice: number | null;
  faceValue: number;
  couponValue: number;
  nextCouponDate: string | null;
  couponPeriod: number;
}

export interface DividendInfo {
  lastPaymentAmount: number;
  lastPaymentDate: Date;
  frequencyPerYear: number;
  nextExpectedCutoffDate: Date | null;
}

// ============ Board → Market mapping ============

const BOARD_TO_MARKET: Record<string, 'shares' | 'bonds'> = {
  TQBR: 'shares',
  TQTF: 'shares',
  TQPI: 'shares',
  TQOB: 'bonds',
  TQCB: 'bonds',
};

function resolveMarket(
  boardId: string,
  group: string,
): 'shares' | 'bonds' | null {
  if (BOARD_TO_MARKET[boardId]) return BOARD_TO_MARKET[boardId];
  if (group.includes('bond')) return 'bonds';
  if (group.includes('share') || group.includes('ppif')) return 'shares';
  return null;
}

// ============ Pure Functions ============

export function parseISSBlock(
  block: ISSBlock,
): Record<string, string | number | null>[] {
  return block.data.map((row) => {
    const obj: Record<string, string | number | null> = {};
    block.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

export function calcDividendFrequency(dates: Date[]): number {
  if (dates.length < 2) return 1;

  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const days =
      (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    intervals.push(days);
  }

  const avgDays = intervals.reduce((s, d) => s + d, 0) / intervals.length;

  if (avgDays < 45) return 12;
  if (avgDays < 120) return 4;
  if (avgDays < 270) return 2;
  return 1;
}

export function parseDividendHistory(
  rows: Record<string, string | number | null>[],
  today: Date = new Date(),
): DividendInfo | null {
  const todayMs = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();

  const valid = rows.filter(
    (r) => r.registryclosedate != null && r.value != null,
  );
  if (valid.length === 0) return null;

  const sorted = [...valid].sort(
    (a, b) =>
      new Date(a.registryclosedate as string).getTime() -
      new Date(b.registryclosedate as string).getTime(),
  );

  const past = sorted.filter(
    (r) => new Date(r.registryclosedate as string).getTime() <= todayMs,
  );
  const future = sorted.filter(
    (r) => new Date(r.registryclosedate as string).getTime() > todayMs,
  );

  if (past.length === 0) return null;

  const last = past[past.length - 1];
  const frequency = calcDividendFrequency(
    past.map((r) => new Date(r.registryclosedate as string)),
  );

  return {
    lastPaymentAmount: last.value as number,
    lastPaymentDate: new Date(last.registryclosedate as string),
    frequencyPerYear: frequency,
    nextExpectedCutoffDate:
      future.length > 0
        ? new Date(future[0].registryclosedate as string)
        : null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/moex-api.test.ts`
Expected: ALL PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/passive-income-tracker
git add src/services/moex-api.ts tests/services/moex-api.test.ts
git commit -m "feat: add MOEX ISS API types and dividend parsing"
```

---

### Task 2: Fetch functions (security lookup, prices, dividends, bonds)

**Files:**
- Modify: `src/services/moex-api.ts`
- Modify: `tests/services/moex-api.test.ts`

- [ ] **Step 1: Write failing tests for fetch functions**

Add these imports at the top of `tests/services/moex-api.test.ts` (merge with existing `import { describe, it, expect }`):

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
```

Add these imports below the existing ones:

```typescript
import {
  resolveSecurityInfo,
  fetchStockPrice,
  fetchBondData,
  fetchDividends,
} from '@/services/moex-api';
```

Append these test suites at the end of the file:

```typescript
// ============ Fetch function tests ============

function mockFetch(body: object) {
  return vi
    .fn()
    .mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
}

describe('resolveSecurityInfo', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves stock ticker to TQBR/shares', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        securities: {
          columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
          data: [
            ['FIXSBER', 'INPF', 'stock_index', 1],
            ['SBER', 'TQBR', 'stock_shares', 1],
          ],
        },
      }),
    );
    const result = await resolveSecurityInfo('SBER');
    expect(result).toEqual({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
  });

  it('resolves bond ticker to TQOB/bonds', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        securities: {
          columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
          data: [['SU26238RMFS4', 'TQOB', 'stock_bonds', 1]],
        },
      }),
    );
    const result = await resolveSecurityInfo('SU26238RMFS4');
    expect(result).toEqual({
      secid: 'SU26238RMFS4',
      primaryBoardId: 'TQOB',
      market: 'bonds',
    });
  });

  it('returns null for unknown ticker', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        securities: {
          columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
          data: [],
        },
      }),
    );
    expect(await resolveSecurityInfo('XXXXX')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );
    expect(await resolveSecurityInfo('SBER')).toBeNull();
  });

  it('returns null for unsupported board', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        securities: {
          columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
          data: [['THING', 'XXXX', 'currency_metal', 1]],
        },
      }),
    );
    expect(await resolveSecurityInfo('THING')).toBeNull();
  });
});

describe('fetchStockPrice', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns LAST price when available', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        securities: {
          columns: ['SECID', 'PREVPRICE'],
          data: [['SBER', 316.65]],
        },
        marketdata: {
          columns: ['SECID', 'LAST', 'LCURRENTPRICE'],
          data: [['SBER', 317.63, 317.54]],
        },
      }),
    );
    const result = await fetchStockPrice('SBER', 'TQBR');
    expect(result).toEqual({ currentPrice: 317.63, prevPrice: 316.65 });
  });

  it('falls back to LCURRENTPRICE when LAST is null', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        securities: {
          columns: ['SECID', 'PREVPRICE'],
          data: [['SBER', 316.65]],
        },
        marketdata: {
          columns: ['SECID', 'LAST', 'LCURRENTPRICE'],
          data: [['SBER', null, 317.54]],
        },
      }),
    );
    const result = await fetchStockPrice('SBER', 'TQBR');
    expect(result!.currentPrice).toBe(317.54);
  });

  it('returns null on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('fail')),
    );
    expect(await fetchStockPrice('SBER', 'TQBR')).toBeNull();
  });
});

describe('fetchBondData', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns bond price and coupon info', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        securities: {
          columns: [
            'SECID', 'PREVPRICE', 'FACEVALUE',
            'COUPONVALUE', 'NEXTCOUPON', 'COUPONPERIOD',
          ],
          data: [
            ['SU26238RMFS4', 61.107, 1000, 35.4, '2026-06-03', 182],
          ],
        },
        marketdata: {
          columns: ['SECID', 'LAST', 'LCURRENTPRICE'],
          data: [['SU26238RMFS4', 61.5, null]],
        },
      }),
    );
    const result = await fetchBondData('SU26238RMFS4', 'TQOB');
    expect(result).toEqual({
      currentPrice: 61.5,
      prevPrice: 61.107,
      faceValue: 1000,
      couponValue: 35.4,
      nextCouponDate: '2026-06-03',
      couponPeriod: 182,
    });
  });

  it('returns null on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('fail')),
    );
    expect(await fetchBondData('SU26238RMFS4', 'TQOB')).toBeNull();
  });
});

describe('fetchDividends', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fetches and parses dividend history', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        dividends: {
          columns: [
            'secid', 'isin', 'registryclosedate', 'value', 'currencyid',
          ],
          data: [
            ['SBER', 'RU0009029540', '2024-07-11', 33.3, 'RUB'],
            ['SBER', 'RU0009029540', '2025-07-18', 34.84, 'RUB'],
          ],
        },
      }),
    );
    const result = await fetchDividends('SBER');
    expect(result).not.toBeNull();
    expect(result!.lastPaymentAmount).toBe(34.84);
    expect(result!.frequencyPerYear).toBe(1);
  });

  it('returns null for empty dividend list', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        dividends: {
          columns: ['secid', 'registryclosedate', 'value', 'currencyid'],
          data: [],
        },
      }),
    );
    expect(await fetchDividends('SBER')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('fail')),
    );
    expect(await fetchDividends('SBER')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/moex-api.test.ts`
Expected: FAIL — `resolveSecurityInfo`, `fetchStockPrice`, `fetchBondData`, `fetchDividends` are not exported

- [ ] **Step 3: Implement fetch functions**

Append to `src/services/moex-api.ts` (after the pure functions):

```typescript
// ============ ISS Fetch Helper ============

async function fetchISS(
  path: string,
  params?: Record<string, string>,
): Promise<ISSResponse | null> {
  const url = new URL(`${MOEX_BASE_URL}${path}`);
  url.searchParams.set('iss.meta', 'off');
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }
  }
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ============ Fetch Functions ============

export async function resolveSecurityInfo(
  ticker: string,
): Promise<SecurityInfo | null> {
  const data = await fetchISS('/securities.json', {
    q: ticker,
    'securities.columns': 'secid,primary_boardid,group,is_traded',
  });
  if (!data?.securities) return null;

  const rows = parseISSBlock(data.securities);
  const match = rows.find(
    (r) => r.secid === ticker && r.is_traded === 1,
  );
  if (!match) return null;

  const boardId = match.primary_boardid as string;
  const group = match.group as string;
  const market = resolveMarket(boardId, group);
  if (!market) return null;

  return { secid: ticker, primaryBoardId: boardId, market };
}

export async function fetchStockPrice(
  ticker: string,
  boardId: string,
): Promise<StockPriceResult | null> {
  const data = await fetchISS(
    `/engines/stock/markets/shares/boards/${boardId}/securities/${ticker}.json`,
    {
      'marketdata.columns': 'SECID,LAST,LCURRENTPRICE',
      'securities.columns': 'SECID,PREVPRICE',
    },
  );
  if (!data?.marketdata || !data?.securities) return null;

  const md = parseISSBlock(data.marketdata)[0];
  const sec = parseISSBlock(data.securities)[0];
  if (!md && !sec) return null;

  return {
    currentPrice: (md?.LAST ?? md?.LCURRENTPRICE ?? null) as number | null,
    prevPrice: (sec?.PREVPRICE ?? null) as number | null,
  };
}

export async function fetchBondData(
  ticker: string,
  boardId: string,
): Promise<BondDataResult | null> {
  const data = await fetchISS(
    `/engines/stock/markets/bonds/boards/${boardId}/securities/${ticker}.json`,
    {
      'marketdata.columns': 'SECID,LAST,LCURRENTPRICE',
      'securities.columns':
        'SECID,PREVPRICE,FACEVALUE,COUPONVALUE,NEXTCOUPON,COUPONPERIOD',
    },
  );
  if (!data?.securities) return null;

  const md = data.marketdata ? parseISSBlock(data.marketdata)[0] : null;
  const sec = parseISSBlock(data.securities)[0];
  if (!sec) return null;

  return {
    currentPrice: (md?.LAST ?? md?.LCURRENTPRICE ?? null) as number | null,
    prevPrice: (sec?.PREVPRICE ?? null) as number | null,
    faceValue: sec.FACEVALUE as number,
    couponValue: sec.COUPONVALUE as number,
    nextCouponDate: (sec.NEXTCOUPON as string) ?? null,
    couponPeriod: sec.COUPONPERIOD as number,
  };
}

export async function fetchDividends(
  ticker: string,
): Promise<DividendInfo | null> {
  const data = await fetchISS(`/securities/${ticker}/dividends.json`);
  if (!data?.dividends) return null;

  const rows = parseISSBlock(data.dividends);
  if (rows.length === 0) return null;

  return parseDividendHistory(rows);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/moex-api.test.ts`
Expected: ALL PASS (22 tests)

- [ ] **Step 5: Commit**

```bash
cd ~/passive-income-tracker
git add src/services/moex-api.ts tests/services/moex-api.test.ts
git commit -m "feat: add MOEX ISS API fetch functions (security lookup, prices, dividends, bonds)"
```

---

## Chunk 2: Sync Orchestrator + UI

### Task 3: Sync orchestrator

**Files:**
- Create: `src/services/moex-sync.ts`
- Create: `tests/services/moex-sync.test.ts`

- [ ] **Step 1: Write failing tests for sync**

Create `tests/services/moex-sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { db } from '@/db/database';

vi.mock('@/services/moex-api', () => ({
  resolveSecurityInfo: vi.fn(),
  fetchStockPrice: vi.fn(),
  fetchBondData: vi.fn(),
  fetchDividends: vi.fn(),
}));

import {
  resolveSecurityInfo,
  fetchStockPrice,
  fetchBondData,
  fetchDividends,
} from '@/services/moex-api';
import { syncAllAssets, getLastSyncAt } from '@/services/moex-sync';

describe('syncAllAssets', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete();
    await db.open();
  });

  it('syncs stock: updates price and creates payment schedule', async () => {
    const assetId = (await db.assets.add({
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchStockPrice as Mock).mockResolvedValue({
      currentPrice: 317.63,
      prevPrice: 316.65,
    });
    (fetchDividends as Mock).mockResolvedValue({
      lastPaymentAmount: 34.84,
      lastPaymentDate: new Date('2025-07-18'),
      frequencyPerYear: 1,
      nextExpectedCutoffDate: null,
    });

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(317.63);

    const schedule = await db.paymentSchedules
      .where('assetId')
      .equals(assetId)
      .first();
    expect(schedule).toBeDefined();
    expect(schedule!.lastPaymentAmount).toBe(34.84);
    expect(schedule!.frequencyPerYear).toBe(1);
    expect(schedule!.dataSource).toBe('moex');
  });

  it('syncs bond: converts price from % to ₽, updates coupon', async () => {
    const assetId = (await db.assets.add({
      type: 'bond',
      ticker: 'SU26238RMFS4',
      name: 'ОФЗ 26238',
      quantity: 50,
      faceValue: 1000,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SU26238RMFS4',
      primaryBoardId: 'TQOB',
      market: 'bonds',
    });
    (fetchBondData as Mock).mockResolvedValue({
      currentPrice: 61.5,
      prevPrice: 61.107,
      faceValue: 1000,
      couponValue: 35.4,
      nextCouponDate: '2026-06-03',
      couponPeriod: 182,
    });

    const result = await syncAllAssets();

    expect(result.synced).toBe(1);

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(615); // 1000 * 61.5 / 100
    expect(asset!.faceValue).toBe(1000);

    const schedule = await db.paymentSchedules
      .where('assetId')
      .equals(assetId)
      .first();
    expect(schedule!.lastPaymentAmount).toBe(35.4);
    expect(schedule!.frequencyPerYear).toBe(2); // 365/182 ≈ 2
    expect(schedule!.dataSource).toBe('moex');
  });

  it('skips non-exchange assets (realestate, deposit, other)', async () => {
    await db.assets.add({
      type: 'realestate',
      name: 'Квартира',
      quantity: 1,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await syncAllAssets();

    expect(result.skipped).toBe(1);
    expect(result.synced).toBe(0);
    expect(resolveSecurityInfo).not.toHaveBeenCalled();
  });

  it('skips assets without ticker', async () => {
    await db.assets.add({
      type: 'stock',
      name: 'Какая-то акция',
      quantity: 100,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await syncAllAssets();
    expect(result.skipped).toBe(1);
  });

  it('does not overwrite manual payment schedule', async () => {
    const assetId = (await db.assets.add({
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    await db.paymentSchedules.add({
      assetId,
      frequencyPerYear: 2,
      lastPaymentAmount: 99.99,
      dataSource: 'manual',
    });

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchStockPrice as Mock).mockResolvedValue({
      currentPrice: 317.63,
      prevPrice: 316.65,
    });
    (fetchDividends as Mock).mockResolvedValue({
      lastPaymentAmount: 34.84,
      lastPaymentDate: new Date('2025-07-18'),
      frequencyPerYear: 1,
      nextExpectedCutoffDate: null,
    });

    await syncAllAssets();

    const schedule = await db.paymentSchedules
      .where('assetId')
      .equals(assetId)
      .first();
    expect(schedule!.lastPaymentAmount).toBe(99.99);
    expect(schedule!.dataSource).toBe('manual');
  });

  it('updates price but keeps dividends when price OK and divs fail', async () => {
    const assetId = (await db.assets.add({
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchStockPrice as Mock).mockResolvedValue({
      currentPrice: 317.63,
      prevPrice: 316.65,
    });
    (fetchDividends as Mock).mockResolvedValue(null);

    await syncAllAssets();

    const asset = await db.assets.get(assetId);
    expect(asset!.currentPrice).toBe(317.63);

    const schedule = await db.paymentSchedules
      .where('assetId')
      .equals(assetId)
      .first();
    expect(schedule).toBeUndefined();
  });

  it('updates existing moex schedule with fresh data', async () => {
    const assetId = (await db.assets.add({
      type: 'stock',
      ticker: 'SBER',
      name: 'Сбербанк',
      quantity: 800,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    await db.paymentSchedules.add({
      assetId,
      frequencyPerYear: 1,
      lastPaymentAmount: 25.0,
      dataSource: 'moex',
    });

    (resolveSecurityInfo as Mock).mockResolvedValue({
      secid: 'SBER',
      primaryBoardId: 'TQBR',
      market: 'shares',
    });
    (fetchStockPrice as Mock).mockResolvedValue({
      currentPrice: 317.63,
      prevPrice: 316.65,
    });
    (fetchDividends as Mock).mockResolvedValue({
      lastPaymentAmount: 34.84,
      lastPaymentDate: new Date('2025-07-18'),
      frequencyPerYear: 1,
      nextExpectedCutoffDate: null,
    });

    await syncAllAssets();

    const schedules = await db.paymentSchedules
      .where('assetId')
      .equals(assetId)
      .toArray();
    expect(schedules).toHaveLength(1);
    expect(schedules[0].lastPaymentAmount).toBe(34.84);
    expect(schedules[0].dataSource).toBe('moex');
  });

  it('reports failed asset when API returns null', async () => {
    await db.assets.add({
      type: 'stock',
      ticker: 'UNKNOWN',
      name: 'Unknown Stock',
      quantity: 10,
      dataSource: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    (resolveSecurityInfo as Mock).mockResolvedValue(null);

    const result = await syncAllAssets();
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('saves lastSyncAt timestamp', async () => {
    const result = await syncAllAssets();
    const lastSync = await getLastSyncAt();
    expect(lastSync).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/moex-sync.test.ts`
Expected: FAIL — module `@/services/moex-sync` does not exist

- [ ] **Step 3: Implement sync orchestrator**

Create `src/services/moex-sync.ts`:

```typescript
import { db } from '@/db/database';
import type { Asset, PaymentSchedule } from '@/models/types';
import {
  resolveSecurityInfo,
  fetchStockPrice,
  fetchBondData,
  fetchDividends,
} from './moex-api';

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export async function syncAllAssets(): Promise<SyncResult> {
  const assets = await db.assets.toArray();
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [] };

  for (const asset of assets) {
    if (!asset.ticker || !['stock', 'bond', 'fund'].includes(asset.type)) {
      result.skipped++;
      continue;
    }

    try {
      await syncSingleAsset(asset);
      result.synced++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${asset.ticker}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await db
    .table('settings')
    .put({ key: 'lastSyncAt', value: new Date().toISOString() });

  return result;
}

export async function getLastSyncAt(): Promise<Date | null> {
  const setting = await db.table('settings').get('lastSyncAt');
  return setting ? new Date(setting.value) : null;
}

async function syncSingleAsset(asset: Asset): Promise<void> {
  const info = await resolveSecurityInfo(asset.ticker!);
  if (!info) throw new Error('Не найден на MOEX');

  if (info.market === 'bonds') {
    await syncBond(asset, info.primaryBoardId);
  } else {
    await syncStock(asset, info.primaryBoardId);
  }
}

async function syncStock(asset: Asset, boardId: string): Promise<void> {
  const price = await fetchStockPrice(asset.ticker!, boardId);
  if (price) {
    const currentPrice = price.currentPrice ?? price.prevPrice;
    if (currentPrice != null) {
      await db.assets.update(asset.id!, {
        currentPrice,
        updatedAt: new Date(),
      });
    }
  }

  const divInfo = await fetchDividends(asset.ticker!);
  if (divInfo) {
    await upsertMoexSchedule(asset.id!, {
      frequencyPerYear: divInfo.frequencyPerYear,
      lastPaymentAmount: divInfo.lastPaymentAmount,
      lastPaymentDate: divInfo.lastPaymentDate,
      nextExpectedCutoffDate: divInfo.nextExpectedCutoffDate ?? undefined,
    });
  }
}

async function syncBond(asset: Asset, boardId: string): Promise<void> {
  const bondData = await fetchBondData(asset.ticker!, boardId);
  if (!bondData) return;

  const pricePercent = bondData.currentPrice ?? bondData.prevPrice;
  if (pricePercent != null) {
    await db.assets.update(asset.id!, {
      currentPrice: bondData.faceValue * (pricePercent / 100),
      faceValue: bondData.faceValue,
      updatedAt: new Date(),
    });
  }

  const frequencyPerYear =
    bondData.couponPeriod > 0
      ? Math.round(365 / bondData.couponPeriod)
      : 2;

  await upsertMoexSchedule(asset.id!, {
    frequencyPerYear,
    lastPaymentAmount: bondData.couponValue,
    nextExpectedDate: bondData.nextCouponDate
      ? new Date(bondData.nextCouponDate)
      : undefined,
  });
}

async function upsertMoexSchedule(
  assetId: number,
  data: {
    frequencyPerYear: number;
    lastPaymentAmount: number;
    lastPaymentDate?: Date;
    nextExpectedDate?: Date;
    nextExpectedCutoffDate?: Date;
  },
): Promise<void> {
  const existing = await db.paymentSchedules
    .where('assetId')
    .equals(assetId)
    .first();

  if (existing?.dataSource === 'manual') return;

  const scheduleData: Partial<PaymentSchedule> = {
    frequencyPerYear: data.frequencyPerYear,
    lastPaymentAmount: data.lastPaymentAmount,
    lastPaymentDate: data.lastPaymentDate,
    nextExpectedDate: data.nextExpectedDate,
    nextExpectedCutoffDate: data.nextExpectedCutoffDate,
    dataSource: 'moex',
  };

  if (existing) {
    await db.paymentSchedules.update(existing.id!, scheduleData);
  } else {
    await db.paymentSchedules.add({
      assetId,
      ...scheduleData,
    } as PaymentSchedule);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/moex-sync.test.ts`
Expected: ALL PASS (9 tests)

- [ ] **Step 5: Run all tests**

Run: `cd ~/passive-income-tracker && npx vitest run`
Expected: ALL PASS (all existing tests + new tests)

- [ ] **Step 6: Commit**

```bash
cd ~/passive-income-tracker
git add src/services/moex-sync.ts tests/services/moex-sync.test.ts
git commit -m "feat: add MOEX sync orchestrator (stock prices, dividends, bond coupons)"
```

---

### Task 4: React hook for sync

**Files:**
- Create: `src/hooks/use-moex-sync.ts`

- [ ] **Step 1: Implement useMoexSync hook**

Create `src/hooks/use-moex-sync.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { syncAllAssets, getLastSyncAt, type SyncResult } from '@/services/moex-sync';

export function useMoexSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLastSyncAt().then(setLastSyncAt);
  }, []);

  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (syncing) return null;
    setSyncing(true);
    setError(null);
    try {
      const result = await syncAllAssets();
      setLastSyncAt(new Date());
      if (result.failed > 0) {
        setError(`Ошибки: ${result.errors.join(', ')}`);
      }
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  return { syncing, lastSyncAt, error, sync };
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/passive-income-tracker
git add src/hooks/use-moex-sync.ts
git commit -m "feat: add useMoexSync hook for MOEX data refresh"
```

---

### Task 5: UI — wire refresh button and show sync status

**Files:**
- Modify: `src/pages/main-page.tsx`

- [ ] **Step 1: Wire ⟳ button to sync, add spinning animation and last-sync label**

Replace the full content of `src/pages/main-page.tsx`:

```tsx
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { HeroIncome } from '@/components/main/hero-income';
import { CategoryCard } from '@/components/main/category-card';
import { IncomeChart } from '@/components/shared/income-chart';
import { usePortfolioStats } from '@/hooks/use-portfolio-stats';
import { useMoexSync } from '@/hooks/use-moex-sync';

function formatSyncTime(date: Date): string {
  const d = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const t = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${d}, ${t}`;
}

export function MainPage() {
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const { portfolio, categories } = usePortfolioStats();
  const { syncing, lastSyncAt, sync } = useMoexSync();

  const income =
    mode === 'month'
      ? portfolio.totalIncomePerMonth
      : portfolio.totalIncomePerYear;

  const refreshButton = (
    <button
      onClick={() => sync()}
      disabled={syncing}
      className="text-gray-400 text-base disabled:opacity-50"
      aria-label="Обновить данные MOEX"
    >
      <span className={syncing ? 'inline-block animate-spin' : ''}>⟳</span>
    </button>
  );

  return (
    <AppShell rightAction={refreshButton}>
      <HeroIncome
        income={income}
        yieldPercent={portfolio.yieldPercent}
        totalValue={portfolio.totalValue}
        mode={mode}
        onToggle={() => setMode((m) => (m === 'month' ? 'year' : 'month'))}
      />

      {lastSyncAt && (
        <div className="text-center text-gray-600 text-[10px] -mt-2 mb-2">
          MOEX: {formatSyncTime(lastSyncAt)}
        </div>
      )}

      <div className="mt-4">
        {categories.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-12">
            Пока нет активов. Добавьте первый актив через меню ☰
          </div>
        )}
        {categories.map((cat) => (
          <CategoryCard
            key={cat.type}
            type={cat.type}
            assetCount={cat.assetCount}
            incomePerMonth={cat.totalIncomePerMonth}
            portfolioSharePercent={cat.portfolioSharePercent}
          />
        ))}
      </div>

      <IncomeChart cagr={null} />
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify visually**

Run: `cd ~/passive-income-tracker && npx vite --open`

Check:
1. ⟳ button is visible in the top-right corner
2. Clicking ⟳ starts spinning animation
3. After sync completes, spinning stops
4. If assets with tickers exist, their prices and payment schedules update
5. "MOEX: [date]" label appears below the hero income after first sync

- [ ] **Step 3: Run all tests**

Run: `cd ~/passive-income-tracker && npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
cd ~/passive-income-tracker
git add src/pages/main-page.tsx
git commit -m "feat: wire MOEX refresh button with sync status on main page"
```
