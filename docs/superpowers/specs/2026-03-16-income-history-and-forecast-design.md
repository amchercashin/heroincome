# Income History & Forecast Model

## Problem

Current income calculation takes `lastPaymentAmount × frequencyPerYear` — a simple extrapolation that breaks for:
- Assets that stopped paying (Gazprom: last dividend in 2022, app still shows income)
- Assets paying irregularly or multiple times per year
- Extraordinary one-time payments (3x dividends covering several years)

No payment history is stored, so there's no data for charts, CAGR, or trend analysis.

## Solution: Two-Layer Income Model

Two metrics per asset:
1. **Fact** — sum of actual payments received in the last 12 months ÷ 12
2. **Forecast** — user-defined projection, optionally assisted by calculation methods

**Main number** = forecast if explicitly set, otherwise fact. Default is fact.

Each asset stores which metric is active (`activeMetric`). Aggregated views (portfolio, category) sum each asset's main number — no mixed-state indicators.

## Data Model

### PaymentHistory (existing table, now actively used)

```typescript
interface PaymentHistory {
  id?: number;
  assetId: number;
  amount: number;          // per unit (per share, per bond)
  date: Date;
  type: 'dividend' | 'coupon' | 'rent' | 'interest' | 'distribution' | 'other';
  dataSource: 'moex' | 'import' | 'manual';
}
```

Index: `[assetId, date]` for fast range queries.

### PaymentSchedule — new fields

```typescript
// Added to existing PaymentSchedule
forecastMethod: 'none' | 'manual' | 'decay';  // default: 'none'
forecastAmount: number | null;                  // per unit, default: null
activeMetric: 'fact' | 'forecast';             // default: 'fact'
```

Existing fields (`lastPaymentAmount`, `frequencyPerYear`, `nextExpected*`) remain unchanged.

### Dexie Migration

Schema version +1. New fields with defaults. Index `paymentHistory` on `[assetId, date]`.

## Calculations

### Fact (12-month trailing)

```
factPerMonth = sum(paymentHistory where date > now - 12 months) × quantity / 12
```

### Forecast

```
forecastPerMonth = forecastAmount × frequencyPerYear × quantity / 12
```

`forecastAmount` is set by user (direct input) or by a helper method (decay average).

### Decay Average (helper, not stored)

Takes the 12-month window ending at the last payment date, sums all payments in that window, divides by (12 + months from last payment to today):

```
window_start = lastPaymentDate - 12 months
window_end = lastPaymentDate
payments_in_window = sum(paymentHistory where date in [window_start, window_end])
months_elapsed = monthsDiff(lastPaymentDate, today)
decayAverage = payments_in_window / (12 + months_elapsed)
```

This value decays over time — it never reaches zero but continuously decreases if no new payments arrive.

### Main Number

```
if activeMetric === 'forecast' && forecastAmount != null:
  mainNumber = forecastPerMonth
else:
  mainNumber = factPerMonth
```

### CAGR

Calculated from the two most distant full 12-month periods available in payment history:

```
period1 = oldest full 12-month period total
period2 = most recent full 12-month period total
years = distance between periods in years
CAGR = (period2 / period1)^(1/years) - 1
```

## UI: Asset Detail Page

### Stat Block "Доход/мес"

Normal state:
- Shows main number value
- Two letter indicators at bottom: **ф** (fact) and **п** (forecast)
- Active indicator highlighted in `#4ecca3`, inactive in `#333`
- Tap → expands panel below

### Expanded Panel

Drops down from the stat block:

```
┌─────────────────────┐
│   Факт 12 мес       │  ← tap to select as active
│      ₽ 0            │
├─────────────────────┤
│   Прогноз  ✓        │  ← tap to select as active
│      ₽ 425          │  ← tap number to edit (dashed underline hint)
├─────────────────────┤
│ ⟳ Подставить        │  ← helper button, shows calculated value
│   среднее: ₽ 943    │
│                     │
│ Последние годовые   │  ← description in small gray text
│ ÷ всё прошедшее     │
│ время.              │
└─────────────────────┘
```

Interactions:
1. Tap "Факт"/"Прогноз" card → switches `activeMetric`, updates stat block and portfolio
2. Tap forecast number (dashed underline) → inline editing
3. Tap "⟳ Подставить среднее: ₽X" → sets `forecastAmount` to decay average, `forecastMethod` to `'decay'`
4. After any helper, user can tap number again to adjust
5. Tap stat block again or outside → collapses panel

### Other Fields

"Количество", "Последняя выплата", "Частота (раз/год)" — unchanged.

### Payment History Chart

- Bar chart, payments aggregated by calendar year
- X-axis: years with short labels ('21, '22, '23...)
- Y-axis: total payments in ₽ (abbreviated: 10K, 1.2M)
- Above chart: "CAGR +12.3%" from two most distant full 12-month periods
- Data source: `paymentHistory` table

## UI: Aggregated Pages

### Main Page (hero-income)

- "Доход/мес" = sum of all assets' main numbers
- No ф/п indicator, no expandable panel
- Chart: all portfolio payments by year, CAGR above

### Category Page

- "Доход/мес" = sum of main numbers for assets in category
- No ф/п indicator
- Chart: category payments by year, CAGR above

### Asset Row (in category list)

- Shows asset's main number
- No ф/п indicator (only on detail page)

### Yield & Value

Recalculated from main number at every level. If asset uses forecast → yield based on forecast.

## MOEX Sync Changes

### Payment History Population

`fetchDividends()` already returns historical dividends. On sync:
- Write all records to `paymentHistory` with `dataSource: 'moex'`
- Deduplicate by `(assetId, date)` — no duplicates on re-sync
- Bond coupons from `fetchBondData()` → also to `paymentHistory` if MOEX provides coupon history

### Backward Compatibility

- `PaymentSchedule` retains all existing fields
- New fields added with safe defaults: `forecastMethod: 'none'`, `forecastAmount: null`, `activeMetric: 'fact'`
- Assets without `paymentHistory` but with schedule → fact = ₽0/month (no history = no fact)
