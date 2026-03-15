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
