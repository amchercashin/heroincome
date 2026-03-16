import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseISSBlock,
  calcDividendFrequency,
  parseDividendHistory,
  resolveSecurityInfo,
  fetchStockPrice,
  fetchBondData,
  fetchDividends,
  fetchCouponHistory,
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

function mockFetch(body: object) {
  return vi
    .fn()
    .mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
}

describe('resolveSecurityInfo', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves stock ticker to TQBR/shares', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: {
        columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
        data: [
          ['FIXSBER', 'INPF', 'stock_index', 1],
          ['SBER', 'TQBR', 'stock_shares', 1],
        ],
      },
    }));
    const result = await resolveSecurityInfo('SBER');
    expect(result).toEqual({ secid: 'SBER', primaryBoardId: 'TQBR', market: 'shares' });
  });

  it('resolves bond ticker to TQOB/bonds', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: {
        columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
        data: [['SU26238RMFS4', 'TQOB', 'stock_bonds', 1]],
      },
    }));
    const result = await resolveSecurityInfo('SU26238RMFS4');
    expect(result).toEqual({ secid: 'SU26238RMFS4', primaryBoardId: 'TQOB', market: 'bonds' });
  });

  it('returns null for unknown ticker', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: { columns: ['secid', 'primary_boardid', 'group', 'is_traded'], data: [] },
    }));
    expect(await resolveSecurityInfo('XXXXX')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    expect(await resolveSecurityInfo('SBER')).toBeNull();
  });

  it('returns null for unsupported board', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: {
        columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
        data: [['THING', 'XXXX', 'currency_metal', 1]],
      },
    }));
    expect(await resolveSecurityInfo('THING')).toBeNull();
  });

  it('resolves by ISIN when secid differs from query', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: {
        columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
        data: [['SU29010RMFS4', 'TQOB', 'government_bond', 1]],
      },
    }));
    const result = await resolveSecurityInfo('RU000A0JV4Q1');
    expect(result).toEqual({
      secid: 'SU29010RMFS4',
      primaryBoardId: 'TQOB',
      market: 'bonds',
    });
  });

  it('prefers exact secid match over first traded result', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: {
        columns: ['secid', 'primary_boardid', 'group', 'is_traded'],
        data: [
          ['WRONG', 'TQBR', 'stock_shares', 1],
          ['SBER', 'TQBR', 'stock_shares', 1],
        ],
      },
    }));
    const result = await resolveSecurityInfo('SBER');
    expect(result!.secid).toBe('SBER');
  });
});

describe('fetchStockPrice', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns LAST price when available', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: { columns: ['SECID', 'PREVPRICE'], data: [['SBER', 316.65]] },
      marketdata: { columns: ['SECID', 'LAST', 'LCURRENTPRICE'], data: [['SBER', 317.63, 317.54]] },
    }));
    const result = await fetchStockPrice('SBER', 'TQBR');
    expect(result).toEqual({ currentPrice: 317.63, prevPrice: 316.65 });
  });

  it('falls back to LCURRENTPRICE when LAST is null', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: { columns: ['SECID', 'PREVPRICE'], data: [['SBER', 316.65]] },
      marketdata: { columns: ['SECID', 'LAST', 'LCURRENTPRICE'], data: [['SBER', null, 317.54]] },
    }));
    const result = await fetchStockPrice('SBER', 'TQBR');
    expect(result!.currentPrice).toBe(317.54);
  });

  it('returns null on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    expect(await fetchStockPrice('SBER', 'TQBR')).toBeNull();
  });
});

describe('fetchBondData', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns bond price and coupon info', async () => {
    vi.stubGlobal('fetch', mockFetch({
      securities: {
        columns: ['SECID', 'PREVPRICE', 'FACEVALUE', 'COUPONVALUE', 'NEXTCOUPON', 'COUPONPERIOD'],
        data: [['SU26238RMFS4', 61.107, 1000, 35.4, '2026-06-03', 182]],
      },
      marketdata: {
        columns: ['SECID', 'LAST', 'LCURRENTPRICE'],
        data: [['SU26238RMFS4', 61.5, null]],
      },
    }));
    const result = await fetchBondData('SU26238RMFS4', 'TQOB');
    expect(result).toEqual({
      currentPrice: 61.5, prevPrice: 61.107,
      faceValue: 1000, couponValue: 35.4,
      nextCouponDate: '2026-06-03', couponPeriod: 182,
    });
  });

  it('returns null on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    expect(await fetchBondData('SU26238RMFS4', 'TQOB')).toBeNull();
  });
});

describe('fetchDividends', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fetches and parses dividend history', async () => {
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
    expect(result!.summary.frequencyPerYear).toBe(1);
  });

  it('returns null for empty dividend list', async () => {
    vi.stubGlobal('fetch', mockFetch({
      dividends: { columns: ['secid', 'registryclosedate', 'value', 'currencyid'], data: [] },
    }));
    expect(await fetchDividends('SBER')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    expect(await fetchDividends('SBER')).toBeNull();
  });
});

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

describe('fetchCouponHistory', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns coupon payment history from bondization endpoint', async () => {
    vi.stubGlobal('fetch', mockFetch({
      coupons: {
        columns: ['isin', 'coupondate', 'value_rub', 'value'],
        data: [
          ['RU000A0JV4Q1', '2025-06-03', 35.4, 35.4],
          ['RU000A0JV4Q1', '2025-12-03', 35.4, 35.4],
          ['RU000A0JV4Q1', '2026-06-03', null, null],
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
