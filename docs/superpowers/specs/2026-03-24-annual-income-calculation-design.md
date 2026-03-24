# Annual Income Per Unit: Fact-Based Calculation Redesign

## Problem

Current formula `paymentPerUnit × frequencyPerYear` breaks when the 12-month sliding window doesn't contain exactly `frequencyPerYear` payments. Example: Lukoil pays 2×/year, but only 1 payment falls in the window → income is halved.

## Solution

Replace the sliding-window approach with a "last N payments" approach. Eliminate frequency from the income formula entirely.

### New formula

```
incomePerYear = quantity × annualIncomePerUnit
incomePerMonth = incomePerYear / 12
```

`annualIncomePerUnit` is either:
- **fact**: sum of the last N per-unit payments from `PaymentHistory` (N = frequencyPerYear)
- **manual**: user-entered annual amount per unit

### Fact calculation algorithm

```
calcAnnualIncomePerUnit(history, frequencyPerYear, now):
  1. If history is empty → { annualIncome: 0, usedPayments: [] }
  2. Sort by date descending
  3. If most recent payment > 18 months ago → { annualIncome: 0, usedPayments: [] }
  4. N = min(frequencyPerYear, history.length)
     — if frequencyPerYear <= 0 (e.g. "Валюта", "Прочее"), N = 0 → return 0
  5. Take last N payments
  6. Return { annualIncome: sum of N amounts, usedPayments: those N records }
```

Returns both the annual figure and the per-unit payment records used — for UI transparency.

### Return type

```typescript
interface AnnualIncomeResult {
  annualIncome: number;
  usedPayments: PaymentRecord[];  // reuse existing type from income-calculator.ts
}
```

### Why "last N" works

| Scenario | freq | Payments taken | Annual | Correct? |
|---|---|---|---|---|
| Lukoil: 514₽ (Jul 25), 793₽ (Dec 24) | 2 | both | 1307₽ | yes |
| Bond: 30₽ × 4 coupons | 4 | last 4 | 120₽ | yes |
| New stock (freq=1): 500₽ | 1 | 1 payment | 500₽ | yes |
| Stale (>18 months) | any | — | 0₽ | yes |
| Rent (freq=12): 12 payments | 12 | last 12 | sum | yes |
| Валюта/Прочее (freq=0) | 0 | none | 0₽ | yes |

Frequency self-corrects: a new stock with 1 payment gets freq=1 from `calcDividendFrequency`. After the second payment, freq recalculates to 2, and "last 2" captures the full cycle.

### Staleness guard

If the most recent per-unit payment is older than 18 months → return 0. This covers:
- Annual payers: 6 months past expected next payment
- Semi-annual: 12 months past expected
- Monthly: clearly stale

### Known limitation

The "last N" approach depends on `frequencyPerYear` being accurate. If MOEX returns a wrong frequency (e.g. company changes dividend policy), the result will be incorrect until frequency recalculates on next sync. This is acceptable — the user can always set a manual override.

## Data model changes

### Asset type

- `paymentPerUnit` — semantics change from "per single payment" to "annual per unit"
- `paymentPerUnitSource: 'fact' | 'manual'` — unchanged
- `frequencyPerYear` — stays as internal field (used by fact calculation, MOEX sync)
- `frequencySource`, `moexFrequency` — stay (internal, not shown in UI)

### DB migration

For existing manual overrides, convert stored value from per-payment to annual:

```
for each asset where paymentPerUnitSource === 'manual' && paymentPerUnit != null:
  if frequencyPerYear > 0:
    asset.paymentPerUnit = asset.paymentPerUnit * asset.frequencyPerYear
  // if frequencyPerYear === 0 (Валюта, Прочее): leave paymentPerUnit unchanged
  //   — these types have no income, value stays as-is for safety
```

Fact-based assets store `paymentPerUnit: undefined` — no migration needed.

## UI changes

### Asset detail page

**Field label:** "Выплата на шт." → **"Выплата на шт. / год"**

**Fact source — with payment breakdown:**

```
Выплата на шт. / год                [ф]
₽ 1 307

  15.07.2025    514₽   ›
  20.12.2024    793₽   ›
```

Each payment row is tappable — navigates to Payments page with `{ state: { highlightAssetId } }` (same as current behavior). Displayed in `--way-text-caption` size.

**Manual source:**

```
Выплата на шт. / год                [р]
₽ 1 500
                         [Вернуть факт]
```

No breakdown, no payments link.

**Removed:** "Выплат в год" editable field — removed from detail page. Frequency is internal only.

**Removed:** "история выплат →" link — replaced by tappable payment rows in the breakdown.

### Manual input

User enters annual income per unit (not per-payment). The edit flow stays the same — inline edit on the field value.

### `isManual` badge

Currently true when `paymentPerUnitSource === 'manual' || frequencySource === 'manual'`. Since frequency is no longer shown, simplify to `paymentPerUnitSource === 'manual'` only.

## Code changes summary

### `income-calculator.ts`
- Replace `calcFactPaymentPerUnit` with `calcAnnualIncomePerUnit` returning `AnnualIncomeResult`
- Simplify `calcAssetIncomePerYear` to `quantity × annualIncomePerUnit` (2 args, no freq)
- Simplify `calcAssetIncomePerMonth` to `quantity × annualIncomePerUnit / 12` (2 args)
- Update `IncomeItem` interface: replace `paymentAmount + frequencyPerYear` with single `annualIncome`
- Keep `calcCAGR`, `calcYieldPercent` unchanged

### `use-portfolio-stats.ts`
- `resolvePaymentPerUnit` → `resolveAnnualIncome` returning `number` (only `.annualIncome`, discard `usedPayments`)
- Remove freq from income calculation call

### `category-page.tsx`
- Same pattern: use `calcAnnualIncomePerUnit`, extract `.annualIncome` only (discard `usedPayments`)
- Pass annual figure to `AssetRow` — rename prop from `paymentPerUnit` to `annualIncome`

### `asset-detail-page.tsx`
- Call `calcAnnualIncomePerUnit` in the `computed` useMemo, destructure both `annualIncome` and `usedPayments`
- `usedPayments` → rendered as tappable breakdown rows (fact source only)
- `annualIncome` → used for income calculation and display
- Update label to "Выплата на шт. / год"
- Remove "Выплат в год" field block entirely
- Remove "история выплат →" link
- Payment rows navigate to /payments with `{ state: { highlightAssetId } }`
- Simplify `isManual` to only check `paymentPerUnitSource`

### `asset-row.tsx`
- Rename prop `paymentPerUnit` → `annualIncome`
- Update income calculation: `calcAssetIncomePerMonth(totalQuantity, annualIncome)` (no freq)
- Simplify `isManual` to only check `paymentPerUnitSource` (same as detail page)

### `payment-history-chart.tsx`
- Remove `frequencyPerYear` prop — no longer needed
- Fallback (no-history): use `paymentPerUnit` directly as annual figure (it IS annual now)
- Fallback panel text: change `"Расчётно: {ppu} ₽ × {freq}/год"` → `"Расчётно: {ppu} ₽ / год"`

### `expected-payment.tsx`
- Derive per-payment amount: `annualIncomePerUnit / frequencyPerYear`
- Label stays "Выплата на единицу" (this shows the expected NEXT payment, not annual)
- Receives both `annualIncomePerUnit` and `frequencyPerYear` as props

### `add-asset-sheet.tsx`
- No changes needed — new assets start with `paymentPerUnitSource: 'fact'` and `paymentPerUnit: undefined`; the annual figure is calculated on-the-fly from payment history

### `import-applier.ts`
- `createAsset`: if import provides `lastPaymentAmount`, store as manual with annual conversion:
  `paymentPerUnit = lastPaymentAmount * freq` where `freq = row.frequencyPerYear ?? getDefaultFrequency(row.type) ?? 12`
- `updateAssetFields`: if `row.lastPaymentAmount != null`, read existing asset from DB to get its current `frequencyPerYear`, then store `paymentPerUnit = lastPaymentAmount * asset.frequencyPerYear`. This ensures MOEX-synced frequency (most accurate) is used for conversion. Falls back to `row.frequencyPerYear ?? getDefaultFrequency(row.type) ?? 12` if asset not found.
- `ImportAssetRow.lastPaymentAmount` retains its per-payment semantics (parser unchanged)

### `database.ts`
- New version migration: multiply manual `paymentPerUnit` by `frequencyPerYear` (with freq > 0 guard)

### `tests/services/income-calculator.test.ts`
- Rewrite `calcFactPaymentPerUnit` tests → `calcAnnualIncomePerUnit` tests
- Update `calcAssetIncomePerYear` / `calcAssetIncomePerMonth` tests (2 args, no freq)
- Update `calcPortfolioIncome` tests (new `IncomeItem` shape)
- Add staleness guard tests (>18 months → 0)
- Add freq=0 edge case test

## Not changed

- `frequencyPerYear` field — stays on Asset, still synced from MOEX
- `calcDividendFrequency` — unchanged
- MOEX sync flow — unchanged (still writes frequency)
- Payment history model — unchanged
- Payments page — unchanged
- Import parser (`import-parser.ts`) — unchanged, still produces per-payment amounts
