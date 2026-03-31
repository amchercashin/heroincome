# MOEX Sync Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make global sync fetch dividends (not just prices), surface dividend fetch failures as warnings, show amber badge in payments section on sync failure.

**Architecture:** Add `warnings[]` to `SyncResult`, change `enrichStock`/`enrichBond` to return warnings, remove `pricesOnly` from `triggerSync`, add `syncFailed` state to payment section components.

**Tech Stack:** TypeScript, React

**Spec:** `docs/superpowers/specs/2026-03-31-moex-sync-fix-design.md`

---

### Task 1: Add warnings to SyncResult and enrich functions

**Files:**
- Modify: `src/services/moex-sync.ts`

- [ ] **Step 1: Add `warnings` to `SyncResult` interface**

In `src/services/moex-sync.ts`, line 42–47, change:

```typescript
export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}
```

to:

```typescript
export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}
```

- [ ] **Step 2: Change `enrichAsset`, `enrichStock`, `enrichBond` return type to `string[]`**

Change `enrichAsset` (line 243–253):

```typescript
async function enrichAsset(
  ra: ResolvedAsset,
  priceData: StockPriceResult | BondDataResult | undefined,
  options?: { pricesOnly?: boolean },
): Promise<string[]> {
  if (ra.market === 'bonds') {
    return enrichBond(ra, priceData as BondDataResult | undefined, options);
  } else {
    return enrichStock(ra, priceData as StockPriceResult | undefined, options);
  }
}
```

Change `enrichStock` (line 255–296) — add return type, warning on failed dividend fetch:

```typescript
async function enrichStock(
  ra: ResolvedAsset,
  priceData: StockPriceResult | undefined,
  options?: { pricesOnly?: boolean },
): Promise<string[]> {
  const warnings: string[] = [];

  // Write price from Phase 2 batch data
  if (priceData) {
    const currentPrice = priceData.currentPrice ?? priceData.prevPrice;
    if (currentPrice != null) {
      await db.assets.update(ra.asset.id!, {
        currentPrice,
        updatedAt: new Date(),
      });
    }
  }

  if (options?.pricesOnly) return warnings;

  // Fetch dividends (not batchable)
  const divInfo = await fetchDividends(ra.secid);
  if (divInfo) {
    await writePaymentHistory(ra.asset.id!, divInfo.history, 'dividend');

    // Recalculate frequency from non-excluded DB records
    const dbRecords = await db.paymentHistory
      .where('[assetId+date]')
      .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
      .toArray();
    const activeDates = dbRecords
      .filter(r => !r.excluded)
      .map(r => r.date)
      .sort((a, b) => a.getTime() - b.getTime());
    const frequencyPerYear = activeDates.length >= 2
      ? calcDividendFrequency(activeDates)
      : divInfo.summary.frequencyPerYear;

    await updateMoexAssetFields(ra.asset, {
      frequencyPerYear,
      nextExpectedCutoffDate: divInfo.summary.nextExpectedCutoffDate ?? undefined,
    });
  } else {
    // Dividend fetch failed — warn if no existing payments
    const existing = await db.paymentHistory
      .where('[assetId+date]')
      .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
      .count();
    if (existing === 0) {
      const ticker = ra.asset.ticker ?? ra.secid;
      warnings.push(`${ticker}: дивиденды не загружены`);
    }
  }

  return warnings;
}
```

Change `enrichBond` (line 298–336) — add return type, warning on failed coupon fetch:

```typescript
async function enrichBond(
  ra: ResolvedAsset,
  priceData: BondDataResult | undefined,
  options?: { pricesOnly?: boolean },
): Promise<string[]> {
  const warnings: string[] = [];

  // If no batch data, try individual fetch as fallback
  const bondData = priceData ?? await fetchBondData(ra.secid, ra.boardId);
  if (!bondData) throw new Error('Нет данных на MOEX');

  const pricePercent = bondData.currentPrice ?? bondData.prevPrice;
  if (pricePercent != null) {
    await db.assets.update(ra.asset.id!, {
      currentPrice: bondData.faceValue * (pricePercent / 100),
      faceValue: bondData.faceValue,
      accruedInterest: bondData.accruedInterest,
      updatedAt: new Date(),
    });
  }

  if (options?.pricesOnly) return warnings;

  const frequencyPerYear =
    bondData.couponPeriod > 0
      ? Math.min(Math.round(365 / bondData.couponPeriod), 52)
      : 2;

  await updateMoexAssetFields(ra.asset, {
    frequencyPerYear,
    nextExpectedDate: bondData.nextCouponDate
      ? new Date(bondData.nextCouponDate)
      : undefined,
  });

  // Fetch coupon history (not batchable)
  const couponHistory = await fetchCouponHistory(ra.secid);
  if (couponHistory.length > 0) {
    await writePaymentHistory(ra.asset.id!, couponHistory, 'coupon');
  } else {
    // Coupon fetch returned empty — warn if no existing coupons
    const existing = await db.paymentHistory
      .where('[assetId+date]')
      .between([ra.asset.id!, Dexie.minKey], [ra.asset.id!, Dexie.maxKey])
      .count();
    if (existing === 0) {
      const ticker = ra.asset.ticker ?? ra.secid;
      warnings.push(`${ticker}: купоны не загружены`);
    }
  }

  return warnings;
}
```

- [ ] **Step 3: Collect warnings in `syncAllAssets`**

In `syncAllAssets`, line 63, change the result initialization:

```typescript
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, errors: [], warnings: [] };
```

In the enrichResults loop (lines 106–116), change:

```typescript
  for (let i = 0; i < enrichResults.length; i++) {
    const r = enrichResults[i];
    if (r.status === 'fulfilled') {
      result.synced++;
      result.warnings.push(...r.value);
    } else {
      result.failed++;
      const ticker = resolved[i].asset.ticker ?? resolved[i].secid;
      const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
      result.errors.push(`${ticker}: ${reason}`);
    }
  }
```

- [ ] **Step 4: Run TypeScript check**

Run: `npm run build`

Expected: Build succeeds (sync-context.tsx references `SyncResult` but doesn't use `warnings` yet — that's fine, extra field).

- [ ] **Step 5: Commit**

```bash
git add src/services/moex-sync.ts
git commit -m "feat: add warnings to SyncResult, surface dividend fetch failures"
```

---

### Task 2: Remove pricesOnly + add warning state to sync context

**Files:**
- Modify: `src/contexts/sync-context.tsx`

- [ ] **Step 1: Add `warning` to context interface and state**

In `src/contexts/sync-context.tsx`, change the interface (line 4–10):

```typescript
interface SyncContextValue {
  syncing: boolean;
  lastSyncAt: Date | null;
  error: string | null;
  warning: string | null;
  triggerSync: () => Promise<SyncResult | null>;
  syncAsset: (assetId: number) => Promise<void>;
}
```

Add state (after line 17):

```typescript
  const [warning, setWarning] = useState<string | null>(null);
```

- [ ] **Step 2: Remove `pricesOnly` and handle warnings in `triggerSync`**

Replace the `triggerSync` callback (lines 20–41):

```typescript
  const triggerSync = useCallback(async (): Promise<SyncResult | null> => {
    if (syncingRef.current) return null;
    syncingRef.current = true;
    setSyncing(true);
    setError(null);
    setWarning(null);
    try {
      const result = await syncAllAssets();
      if (result.synced > 0) {
        setLastSyncAt(new Date());
      }
      if (result.failed > 0) {
        setError(`Ошибки: ${result.errors.join(', ')}`);
      }
      if (result.warnings.length > 0) {
        setWarning(`${result.warnings.join(', ')}`);
      }
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);
```

- [ ] **Step 3: Expose warning in Provider**

Change the Provider value (line 56):

```typescript
    <SyncContext.Provider value={{ syncing, lastSyncAt, error, warning, triggerSync, syncAsset }}>
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: Build succeeds with no TS errors.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/sync-context.tsx
git commit -m "feat: remove pricesOnly from global sync, expose warnings in context"
```

---

### Task 3: Amber badge on sync failure in payments section

**Files:**
- Modify: `src/components/payments/asset-payments.tsx`
- Modify: `src/components/payments/type-section.tsx`

- [ ] **Step 1: Add `syncFailed` state and update `handleSync` in `asset-payments.tsx`**

In `src/components/payments/asset-payments.tsx`, after the existing `syncing` state (line 28), add:

```typescript
  const [syncFailed, setSyncFailed] = useState(false);
```

Replace the `handleSync` function (lines 47–63):

```typescript
  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (syncing) return;

    if (hasManual) {
      const ok = window.confirm(`Ручные выплаты (${manualCount} шт.) будут удалены при синхронизации с MOEX. Продолжить?`);
      if (!ok) return;
      await deleteManualPayments(asset.id!);
    }

    setSyncing(true);
    setSyncFailed(false);
    try {
      const result = await syncAssetPayments(asset.id!);
      if (!result.success) {
        setSyncFailed(true);
      }
    } catch {
      setSyncFailed(true);
    } finally {
      setSyncing(false);
    }
  };
```

- [ ] **Step 2: Update badge rendering in `asset-payments.tsx`**

Replace the badge span (lines 87–95):

```typescript
              {syncable && payments.length > 0 && (
                <span className={`text-[length:var(--hi-text-micro)] px-1 py-0.5 rounded flex-shrink-0 ${
                  syncFailed
                    ? 'bg-[#5a4a2d] text-[#d4a846]'
                    : allMoex
                      ? 'bg-[#2d5a2d] text-[#6bba6b]'
                      : 'bg-[#5a4a2d] text-[#d4a846]'
                }`}>
                  {syncFailed ? 'moex ⚠' : allMoex ? 'moex' : 'ручной'}
                </span>
              )}
```

- [ ] **Step 3: Add `syncFailed` state and update `handleSync` in `type-section.tsx`**

In `src/components/payments/type-section.tsx`, after the existing `syncing` state (line 18), add:

```typescript
  const [syncFailed, setSyncFailed] = useState(false);
```

Replace the `handleSync` function (lines 34–53):

```typescript
  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (syncing) return;

    if (hasManual) {
      const ok = window.confirm(`Ручные выплаты (${manualCount} шт.) будут удалены при синхронизации с MOEX. Продолжить?`);
      if (!ok) return;
    }

    setSyncing(true);
    setSyncFailed(false);
    try {
      const syncableAssets = assets.filter(isSyncable);
      let anyFailed = false;
      for (const asset of syncableAssets) {
        if (hasManual) await deleteManualPayments(asset.id!);
        const result = await syncAssetPayments(asset.id!);
        if (!result.success) anyFailed = true;
      }
      if (anyFailed) setSyncFailed(true);
    } catch {
      setSyncFailed(true);
    } finally {
      setSyncing(false);
    }
  };
```

- [ ] **Step 4: Update badge rendering in `type-section.tsx`**

Replace the badge span (lines 66–74):

```typescript
          {showSync && allPayments.length > 0 && (
            <span className={`text-[length:var(--hi-text-micro)] px-1 py-0.5 rounded ${
              syncFailed
                ? 'bg-[#5a4a2d] text-[#d4a846]'
                : allMoex
                  ? 'bg-[#2d5a2d] text-[#6bba6b]'
                  : 'bg-[#5a4a2d] text-[#d4a846]'
            }`}>
              {syncFailed ? 'moex ⚠' : allMoex ? 'moex' : 'ручной'}
            </span>
          )}
```

- [ ] **Step 5: Run build**

Run: `npm run build`

Expected: Build succeeds with no TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/payments/asset-payments.tsx src/components/payments/type-section.tsx
git commit -m "feat: show amber badge in payments section on sync failure"
```
