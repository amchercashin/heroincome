import type { Asset, PaymentHistory } from '@/models/types';
import { incomeSpreadOf } from '@/models/asset-kind';
import { calcAssetAnnualIncomePerUnit, type PaymentRecord } from './income-calculator';
import type { CalculatedAssetStats } from './portfolio-calculator';

/**
 * Income over time.
 *
 * Monthly income follows the "pockets" model (see calcAssetAnnualIncomePerUnit):
 * exchange securities spread each payment over 12 months, self-recorded income
 * (rent, deposits) spreads a payment over its own period.
 *
 * The future is built from what is known, in this order:
 *   1. announced forecasts (e.g. dohod.ru dividend forecasts, `isForecast`);
 *   2. otherwise the last year repeats: each payment of the trailing 12 months
 *      recurs one year later ('year' spread) or the latest payout recurs every
 *      period ('period' spread);
 *   3. manual per-unit income is spread evenly over the frequency.
 * Quantities are the current ones — the history answers "what would my current
 * portfolio have paid", not "what did I receive".
 */

export interface ProjectedPayment {
  assetId: number;
  date: Date;
  /** Net amount in RUB for the whole position (after NDFL and FX). */
  amount: number;
  /** Gross amount per unit in the asset's own currency. */
  perUnit: number;
  /** true when the date is a guess (manual income without a known schedule). */
  estimated: boolean;
  /** true when the payment comes from an announced forecast. */
  announced: boolean;
}

export interface MonthBucket {
  /** 0–11, calendar month */
  month: number;
  year: number;
  total: number;
  payments: ProjectedPayment[];
}

export interface TimelinePoint {
  date: Date;
  /** Net monthly income, RUB */
  value: number;
  future: boolean;
}

export interface ProjectionInput {
  assets: Asset[];
  paymentHistory: PaymentHistory[];
  assetsById: Map<number, CalculatedAssetStats>;
  ndflRates: Map<string, number>;
  now?: Date;
}

interface FuturePayment extends PaymentRecord {
  estimated: boolean;
  announced: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A forecast within this distance replaces the repeated payment. */
const MATCH_WINDOW_DAYS = 75;

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function monthsAgo(now: Date, months: number): Date {
  // Same arithmetic as calcAnnualIncomePerUnit's window.
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

function splitHistory(history: PaymentHistory[]) {
  const real: PaymentRecord[] = [];
  const forecasts: PaymentRecord[] = [];
  for (const p of history) {
    const rec = { amount: p.amount, date: new Date(p.date) };
    (p.isForecast ? forecasts : real).push(rec);
  }
  real.sort((a, b) => a.date.getTime() - b.date.getTime());
  forecasts.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { real, forecasts };
}

/** Gross per-unit payments expected after `now` up to `horizon`. */
function futurePaymentsFor(asset: Asset, history: PaymentHistory[], now: Date, horizon: Date, annualIncomePerUnit: number): FuturePayment[] {
  const spread = incomeSpreadOf(asset);
  const { real, forecasts } = splitHistory(history);
  const out: FuturePayment[] = [];

  // Manual per-unit income: even schedule by frequency.
  if (asset.paymentPerUnitSource === 'manual' && asset.paymentPerUnit != null) {
    if (annualIncomePerUnit <= 0) return out;
    const frequency = asset.frequencyPerYear > 0 ? Math.round(asset.frequencyPerYear) : 12;
    const perUnit = annualIncomePerUnit / frequency;
    const known = asset.nextExpectedDate ? new Date(asset.nextExpectedDate) : null;
    const hasKnownDate = !!known && known > now && known <= addMonths(now, 12);
    const first = hasKnownDate ? known! : addMonths(now, 1);
    for (let k = 0; ; k++) {
      const date = addMonths(first, Math.round((k * 12) / frequency));
      if (date > horizon) break;
      out.push({ amount: perUnit, date, estimated: !hasKnownDate, announced: false });
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Real payments already dated in the future (rare, e.g. typed in by hand).
  for (const p of real) {
    if (p.date > now && p.date <= horizon) out.push({ ...p, estimated: false, announced: true });
  }
  // A zero-amount forecast means "no payment expected": it cancels the repeated
  // payment but is not a payment itself.
  const announcedDates: Date[] = [];
  for (const p of forecasts) {
    if (p.date <= now || p.date > horizon) continue;
    announcedDates.push(p.date);
    if (p.amount > 0) out.push({ ...p, estimated: false, announced: true });
  }
  for (const q of out) announcedDates.push(q.date);
  const isCovered = (date: Date) =>
    announcedDates.some((d) => Math.abs(d.getTime() - date.getTime()) <= MATCH_WINDOW_DAYS * DAY_MS);

  const past = real.filter((p) => p.date <= now);
  if (spread === 'year') {
    // Each payment of the trailing year recurs every 12 months.
    const window = past.filter((p) => p.date >= monthsAgo(now, 12));
    for (const p of window) {
      for (let years = 1; ; years++) {
        const date = addMonths(p.date, 12 * years);
        if (date > horizon) break;
        if (date <= now) continue;
        if (!isCovered(date)) out.push({ amount: p.amount, date, estimated: false, announced: false });
      }
    }
  } else {
    // The latest payout recurs every period while the pocket is alive.
    const current = calcAssetAnnualIncomePerUnit(asset, 'period', past, now);
    if (current.annualIncome > 0 && current.usedPayments.length > 0) {
      const step = 12 / asset.frequencyPerYear;
      const perPayout = current.annualIncome / asset.frequencyPerYear;
      const last = current.usedPayments[0].date;
      for (let k = 1; ; k++) {
        const date = addMonths(last, Math.round(k * step));
        if (date > horizon) break;
        if (date <= now) continue;
        if (!isCovered(date)) out.push({ amount: perPayout, date, estimated: false, announced: false });
      }
    }
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function groupHistory(history: PaymentHistory[]): Map<number, PaymentHistory[]> {
  const byAsset = new Map<number, PaymentHistory[]>();
  for (const p of history) {
    const arr = byAsset.get(p.assetId) ?? [];
    arr.push(p);
    byAsset.set(p.assetId, arr);
  }
  return byAsset;
}

function netFactor(asset: Asset, stats: CalculatedAssetStats, ndflRates: Map<string, number>): number {
  const taxMultiplier = 1 - (ndflRates.get(asset.type) ?? 0) / 100;
  return stats.totalQuantity * taxMultiplier * stats.rateToRub;
}

/** Expected net payments over the next 12 months, soonest first. */
export function projectIncome(input: ProjectionInput): ProjectedPayment[] {
  const now = input.now ?? new Date();
  const horizon = addMonths(now, 12);
  const byAsset = groupHistory(input.paymentHistory);
  const result: ProjectedPayment[] = [];

  for (const asset of input.assets) {
    if (asset.id == null) continue;
    const stats = input.assetsById.get(asset.id);
    if (!stats || stats.totalQuantity <= 0) continue;
    const factor = netFactor(asset, stats, input.ndflRates);
    for (const p of futurePaymentsFor(asset, byAsset.get(asset.id) ?? [], now, horizon, stats.annualIncomePerUnit)) {
      result.push({
        assetId: asset.id,
        date: p.date,
        amount: p.amount * factor,
        perUnit: p.amount,
        estimated: p.estimated,
        announced: p.announced,
      });
    }
  }

  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Net monthly income of the current portfolio month by month:
 * `monthsBack` points of history, the current month, and `monthsAhead` points of forecast.
 */
export function incomeTimeline(input: ProjectionInput & { monthsBack?: number; monthsAhead?: number }): TimelinePoint[] {
  const now = input.now ?? new Date();
  const monthsBack = input.monthsBack ?? 24;
  const monthsAhead = input.monthsAhead ?? 12;
  const horizon = addMonths(now, monthsAhead);
  const byAsset = groupHistory(input.paymentHistory);

  const prepared: { asset: Asset; factor: number; records: PaymentRecord[] }[] = [];
  for (const asset of input.assets) {
    if (asset.id == null) continue;
    const stats = input.assetsById.get(asset.id);
    if (!stats || stats.totalQuantity <= 0) continue;
    const history = byAsset.get(asset.id) ?? [];
    const { real } = splitHistory(history);
    const future = futurePaymentsFor(asset, history, now, horizon, stats.annualIncomePerUnit);
    const records = [...real.filter((p) => p.date <= now), ...future.map(({ amount, date }) => ({ amount, date }))];
    prepared.push({ asset, factor: netFactor(asset, stats, input.ndflRates), records });
  }

  const points: TimelinePoint[] = [];
  for (let offset = -monthsBack; offset <= monthsAhead; offset++) {
    const date = offset === 0 ? now : addMonths(now, offset);
    let annual = 0;
    for (const { asset, factor, records } of prepared) {
      const visible = records.filter((p) => p.date <= date);
      annual += calcAssetAnnualIncomePerUnit(asset, incomeSpreadOf(asset), visible, date).annualIncome * factor;
    }
    points.push({ date, value: annual / 12, future: offset > 0 });
  }
  return points;
}

/**
 * Twelve calendar-month buckets starting from the current month — a "typical year"
 * of cash flow. Payments landing in the current month next year fold into the
 * current month's bucket.
 */
export function bucketByMonth(projection: ProjectedPayment[], now: Date = new Date()): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    buckets.push({ month: d.getMonth(), year: d.getFullYear(), total: 0, payments: [] });
  }
  const indexByMonth = new Map(buckets.map((b, i) => [b.month, i]));
  for (const p of projection) {
    const bucket = buckets[indexByMonth.get(p.date.getMonth())!];
    bucket.total += p.amount;
    bucket.payments.push(p);
  }
  return buckets;
}

/** Next payments with known (non-estimated) dates, soonest first. */
export function upcomingPayments(projection: ProjectedPayment[], now: Date = new Date(), limit = 5): ProjectedPayment[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return projection.filter((p) => !p.estimated && p.date >= today).slice(0, limit);
}
