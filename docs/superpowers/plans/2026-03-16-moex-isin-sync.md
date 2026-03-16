# MOEX Sync by ISIN with Cached secid — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable MOEX sync to resolve securities by ISIN (fallback from ticker) and cache the resolved secid on Asset to avoid re-resolving on subsequent syncs.

**Architecture:** Add `moexSecid` field to Asset. Change `resolveSecurityInfo` to accept any query (ticker or ISIN). Change `syncSingleAsset` to try cached secid → ticker → ISIN. Pass resolved secid to `syncStock`/`syncBond` instead of `asset.ticker`.

**Tech Stack:** Dexie.js, MOEX ISS API, Vitest

**Spec:** `docs/superpowers/specs/2026-03-16-moex-isin-sync-design.md`

**Design decisions:**
- `resolveSecurityInfo` matching: currently requires `secid === query`. For ISIN search, secid in response differs from query. Fix: try exact match first, fall back to first `is_traded === 1` result.
- `syncStock`/`syncBond` signatures change: add `secid` parameter, use it instead of `asset.ticker!`.
- No skip condition change: assets still need at least one of `ticker`, `isin`, or `moexSecid` to attempt sync. The skip condition broadens from `!asset.ticker` to `!asset.ticker && !asset.isin && !asset.moexSecid`.

---

## File Structure

```
src/models/types.ts            # Add moexSecid to Asset
src/services/moex-api.ts       # Fix resolveSecurityInfo matching for ISIN
src/services/moex-sync.ts      # Resolution chain + secid param threading
tests/services/moex-api.test.ts    # Test ISIN resolution
tests/services/moex-sync.test.ts   # Test ISIN fallback, cached secid
```

---

## Chunk 1: Model + API changes

### Task 1: Add moexSecid to Asset model

**Files:**
- Modify: `src/models/types.ts`

- [ ] **Step 1: Add moexSecid field to Asset interface**

In `src/models/types.ts`, add `moexSecid?: string` to the Asset interface, after `isin`:

```typescript
export interface Asset {
  id?: number;
  type: AssetType;
  ticker?: string;
  isin?: string;
  moexSecid?: string;
  name: string;
  // ... rest unchanged
}
```

- [ ] **Step 2: Run all tests → PASS (no behavior change)**

Run: `cd ~/passive-income-tracker && npx vitest run`

- [ ] **Step 3: Commit**

```bash
cd ~/passive-income-tracker
git add src/models/types.ts
git commit -m "feat: add moexSecid field to Asset for MOEX resolution cache"
```

---

### Task 2: Fix resolveSecurityInfo for ISIN queries

**Files:**
- Modify: `src/services/moex-api.ts`
- Modify: `tests/services/moex-api.test.ts`

- [ ] **Step 1: Write failing test for ISIN resolution**

Add to `tests/services/moex-api.test.ts`, inside the `resolveSecurityInfo` describe block:

```typescript
it('resolves by ISIN when secid differs from query', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      securities: {
        columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
        data: [['RU000A1068X9', 'TQTF', 'stock_ppif', 1]],
      },
    }),
  });

  const result = await resolveSecurityInfo('RU000A1068X9');
  expect(result).toEqual({
    secid: 'RU000A1068X9',
    primaryBoardId: 'TQTF',
    market: 'shares',
  });
});
```

- [ ] **Step 2: Run test → FAIL**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/moex-api.test.ts`
Expected: FAIL — current code requires exact `secid === ticker` match, but here secid happens to match. Actually let me adjust: the real ISIN scenario is when you search "RU000A0JV4Q1" (ISIN) and get back secid "SU29010RMFS4" (bond code). Let me fix the test:

Replace the test above with:

```typescript
it('resolves by ISIN when secid differs from query', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      securities: {
        columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
        data: [['SU29010RMFS4', 'TQOB', 'government_bond', 1]],
      },
    }),
  });

  const result = await resolveSecurityInfo('RU000A0JV4Q1');
  expect(result).toEqual({
    secid: 'SU29010RMFS4',
    primaryBoardId: 'TQOB',
    market: 'bonds',
  });
});
```

- [ ] **Step 3: Run test → FAIL**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/moex-api.test.ts`
Expected: FAIL — `resolveSecurityInfo` returns null because `secid ('SU29010RMFS4') !== query ('RU000A0JV4Q1')`

- [ ] **Step 4: Fix resolveSecurityInfo matching logic**

In `src/services/moex-api.ts`, replace the matching in `resolveSecurityInfo`:

```typescript
export async function resolveSecurityInfo(
  query: string,
): Promise<SecurityInfo | null> {
  const data = await fetchISS('/securities.json', {
    q: query,
    'securities.columns': 'secid,primary_boardid,group,is_traded',
  });
  if (!data?.securities) return null;

  const rows = parseISSBlock(data.securities);

  // Exact secid match first (for ticker queries)
  const exactMatch = rows.find(
    (r) => r.secid === query && r.is_traded === 1,
  );
  // Fallback: first traded result (for ISIN queries where secid differs)
  const match = exactMatch ?? rows.find((r) => r.is_traded === 1);
  if (!match) return null;

  const secid = match.secid as string;
  const boardId = match.primary_boardid as string;
  const group = match.group as string;
  const market = resolveMarket(boardId, group);
  if (!market) return null;

  return { secid, primaryBoardId: boardId, market };
}
```

- [ ] **Step 5: Run all tests → PASS**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/moex-api.test.ts`

- [ ] **Step 6: Commit**

```bash
cd ~/passive-income-tracker
git add src/services/moex-api.ts tests/services/moex-api.test.ts
git commit -m "feat: support ISIN resolution in resolveSecurityInfo"
```

---

## Chunk 2: Sync orchestrator changes

### Task 3: Update sync to use resolution chain and secid threading

**Files:**
- Modify: `src/services/moex-sync.ts`
- Modify: `tests/services/moex-sync.test.ts`

- [ ] **Step 1: Write failing test for ISIN fallback**

Add to `tests/services/moex-sync.test.ts`:

```typescript
it('resolves by ISIN when ticker resolution fails', async () => {
  const assetId = (await db.assets.add({
    type: 'fund',
    ticker: 'RU000A1068X9',
    isin: 'RU000A1068X9',
    name: 'ПАРУС-ДВН',
    quantity: 186,
    currentPrice: 1100,
    dataSource: 'import',
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as number;

  // First call (by ticker) fails, second call (by ISIN) succeeds
  (resolveSecurityInfo as Mock)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      secid: 'RU000A1068X9',
      primaryBoardId: 'TQTF',
      market: 'shares',
    });
  (fetchStockPrice as Mock).mockResolvedValue({
    currentPrice: 1150,
    prevPrice: 1100,
  });
  (fetchDividends as Mock).mockResolvedValue(null);

  const result = await syncAllAssets();

  expect(result.synced).toBe(1);
  expect(resolveSecurityInfo).toHaveBeenCalledTimes(2);

  const asset = await db.assets.get(assetId);
  expect(asset!.currentPrice).toBe(1150);
  expect(asset!.moexSecid).toBe('RU000A1068X9');
});
```

- [ ] **Step 2: Write failing test for cached moexSecid**

Add to `tests/services/moex-sync.test.ts`:

```typescript
it('uses cached moexSecid and skips resolution', async () => {
  await db.assets.add({
    type: 'stock',
    ticker: 'SBER',
    moexSecid: 'SBER',
    name: 'Сбербанк',
    quantity: 800,
    dataSource: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  (fetchStockPrice as Mock).mockResolvedValue({
    currentPrice: 320.0,
    prevPrice: 318.0,
  });
  (fetchDividends as Mock).mockResolvedValue(null);

  const result = await syncAllAssets();

  expect(result.synced).toBe(1);
  expect(resolveSecurityInfo).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Write failing test for asset with only ISIN (no ticker)**

Add to `tests/services/moex-sync.test.ts`:

```typescript
it('syncs asset with ISIN but no ticker', async () => {
  const assetId = (await db.assets.add({
    type: 'bond',
    isin: 'RU000A0JV4Q1',
    name: 'ОФЗ 29010',
    quantity: 100,
    dataSource: 'import',
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as number;

  (resolveSecurityInfo as Mock).mockResolvedValue({
    secid: 'SU29010RMFS4',
    primaryBoardId: 'TQOB',
    market: 'bonds',
  });
  (fetchBondData as Mock).mockResolvedValue({
    currentPrice: 105.5,
    prevPrice: 105.0,
    faceValue: 1000,
    couponValue: 44.88,
    nextCouponDate: '2026-06-18',
    couponPeriod: 182,
  });

  const result = await syncAllAssets();

  expect(result.synced).toBe(1);

  const asset = await db.assets.get(assetId);
  expect(asset!.currentPrice).toBe(1055);
  expect(asset!.moexSecid).toBe('SU29010RMFS4');
});
```

- [ ] **Step 4: Run tests → FAIL**

Run: `cd ~/passive-income-tracker && npx vitest run tests/services/moex-sync.test.ts`
Expected: 3 new tests FAIL

- [ ] **Step 5: Rewrite syncSingleAsset with resolution chain**

Replace `syncSingleAsset`, `syncStock`, and `syncBond` in `src/services/moex-sync.ts`:

```typescript
async function syncSingleAsset(asset: Asset): Promise<void> {
  let secid = asset.moexSecid;
  let boardId: string;
  let market: 'shares' | 'bonds';

  if (secid) {
    // Cached secid — still need board/market, resolve by secid
    const info = await resolveSecurityInfo(secid);
    if (!info) throw new Error('Не найден на MOEX');
    boardId = info.primaryBoardId;
    market = info.market;
  } else {
    // Resolution chain: ticker → ISIN
    let info = asset.ticker
      ? await resolveSecurityInfo(asset.ticker)
      : null;
    if (!info && asset.isin) {
      info = await resolveSecurityInfo(asset.isin);
    }
    if (!info) throw new Error('Не найден на MOEX');

    secid = info.secid;
    boardId = info.primaryBoardId;
    market = info.market;

    // Cache for next time
    await db.assets.update(asset.id!, { moexSecid: secid });
  }

  if (market === 'bonds') {
    await syncBond(secid, asset, boardId);
  } else {
    await syncStock(secid, asset, boardId);
  }
}

async function syncStock(secid: string, asset: Asset, boardId: string): Promise<void> {
  const price = await fetchStockPrice(secid, boardId);
  if (price) {
    const currentPrice = price.currentPrice ?? price.prevPrice;
    if (currentPrice != null) {
      await db.assets.update(asset.id!, {
        currentPrice,
        updatedAt: new Date(),
      });
    }
  }

  const divInfo = await fetchDividends(secid);
  if (divInfo) {
    await upsertMoexSchedule(asset.id!, {
      frequencyPerYear: divInfo.frequencyPerYear,
      lastPaymentAmount: divInfo.lastPaymentAmount,
      lastPaymentDate: divInfo.lastPaymentDate,
      nextExpectedCutoffDate: divInfo.nextExpectedCutoffDate ?? undefined,
    });
  }
}

async function syncBond(secid: string, asset: Asset, boardId: string): Promise<void> {
  const bondData = await fetchBondData(secid, boardId);
  if (!bondData) throw new Error('Нет данных на MOEX');

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
```

- [ ] **Step 6: Update skip condition in syncAllAssets**

In `syncAllAssets`, change:

```typescript
if (!asset.ticker || !['stock', 'bond', 'fund'].includes(asset.type)) {
```

to:

```typescript
if ((!asset.ticker && !asset.isin && !asset.moexSecid) || !['stock', 'bond', 'fund'].includes(asset.type)) {
```

- [ ] **Step 7: Run all tests → PASS**

Run: `cd ~/passive-income-tracker && npx vitest run`

- [ ] **Step 8: Commit**

```bash
cd ~/passive-income-tracker
git add src/services/moex-sync.ts tests/services/moex-sync.test.ts
git commit -m "feat: MOEX sync with ISIN fallback and cached secid"
```

---

### Task 4: Handle cached secid optimization (skip re-resolution)

The implementation in Task 3 Step 5 still calls `resolveSecurityInfo(secid)` even for cached secid, because we need boardId and market. To truly skip the network call, we'd need to cache those too. This is acceptable for now — one resolution call is fast and ensures we always have fresh board info. Mark this as a known trade-off.

**Note:** If we want to fully skip resolution for cached assets in the future, we'd add `moexBoardId` and `moexMarket` fields to Asset. This is not needed for MVP.

- [ ] **Step 1: Verify the "cached secid skips resolution" test expectation**

The test in Task 3 Step 2 asserts `resolveSecurityInfo` was NOT called. But our implementation still calls it with the cached secid. Update the test to match actual behavior:

In the test `'uses cached moexSecid and skips resolution'`, change:

```typescript
expect(resolveSecurityInfo).not.toHaveBeenCalled();
```

to:

```typescript
// Uses cached secid for resolution (1 call instead of trying ticker then ISIN)
expect(resolveSecurityInfo).toHaveBeenCalledTimes(1);
expect(resolveSecurityInfo).toHaveBeenCalledWith('SBER');
```

And add the mock setup before the `syncAllAssets()` call:

```typescript
(resolveSecurityInfo as Mock).mockResolvedValue({
  secid: 'SBER',
  primaryBoardId: 'TQBR',
  market: 'shares',
});
```

- [ ] **Step 2: Run all tests → PASS**

Run: `cd ~/passive-income-tracker && npx vitest run`

- [ ] **Step 3: Commit**

```bash
cd ~/passive-income-tracker
git add tests/services/moex-sync.test.ts
git commit -m "fix: align cached secid test with actual resolution behavior"
```
