const MOEX_BASE_URL = 'https://iss.moex.com/iss';

// ============ Types ============

export interface ISSBlock {
  columns: string[];
  data: (string | number | null)[][];
}

export interface ISSResponse {
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

// Export base URL for use in fetch functions (Task 2)
export { MOEX_BASE_URL };

// Export resolveMarket for use in security lookup (Task 2)
export { resolveMarket };
