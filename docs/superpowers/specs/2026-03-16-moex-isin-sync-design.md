# MOEX Sync by ISIN with Cached secid — Design Spec

## Problem

Current MOEX sync resolves securities by `ticker` only. Funds imported from Sber (e.g., ПАРУС) have ISIN codes as tickers (RU000A1068X9), which may not resolve correctly. Also, each sync re-resolves the security, wasting HTTP requests.

## Solution

1. Add `moexSecid` field to Asset — cached MOEX security identifier
2. Resolution chain: cached secid → ticker → ISIN (fallback)
3. Once resolved, store secid on Asset so subsequent syncs skip resolution
4. Use resolved secid (not stored ticker) for all price/dividend API calls

## Data Model Change

```typescript
// Asset — add field:
moexSecid?: string;  // Cached secid from MOEX (e.g., "GAZP", "SU29010RMFS4")
```

No new Dexie index needed (no queries by moexSecid).

## Sync Flow (updated)

```
syncSingleAsset(asset):
  1. if asset.moexSecid → use it, skip resolution
  2. else → resolveSecurityInfo(asset.ticker)
  3. if not found && asset.isin → resolveSecurityInfo(asset.isin)
  4. if found → save secid to asset.moexSecid in DB
  5. pass resolved secid + boardId to syncStock/syncBond
```

## Changes Required

### moex-sync.ts
- `syncSingleAsset`: implement resolution chain with ISIN fallback
- `syncSingleAsset`: save `moexSecid` on first successful resolution
- `syncStock(secid, asset, boardId)`: use secid param instead of asset.ticker
- `syncBond(secid, asset, boardId)`: use secid param instead of asset.ticker

### moex-api.ts
- `resolveSecurityInfo(query)`: ensure ISIN search works (the `/securities.json?q=` endpoint accepts ISIN, but the result matching logic must handle that the returned `secid` differs from the ISIN query)

### models/types.ts
- Add `moexSecid?: string` to Asset interface

### Tests
- Test ISIN fallback resolution
- Test cached secid skip
- Test that secid is saved after first resolution
- Test syncStock/syncBond use secid, not ticker

## Data Priority

| Field | Sber Import | MOEX API | Manual |
|-------|:-----------:|:--------:|:------:|
| quantity | **source of truth** | — | overwrites |
| averagePrice | initial | — | overwrites |
| currentPrice | until first sync | **source of truth** | overwrites |
| faceValue | initial | **source of truth** | overwrites |
| name | initial | no update | overwrites |
| isin | **source of truth** | — | overwrites |
| dividends/coupons | — | **source of truth** | overwrites |

## What Doesn't Change
- UI components
- Import pipeline
- useMoexSync hook interface
- moex-api.ts function signatures (resolveSecurityInfo already takes string)
