import { describe, it, expect } from 'vitest';
import {
  calcAssetIncomePerYear,
  calcAssetIncomePerMonth,
  calcPortfolioIncome,
  calcYieldPercent,
  calcCAGR,
  calcFactPerMonth,
  calcDecayAverage,
  calcMainNumber,
} from '@/services/income-calculator';

describe('income-calculator', () => {
  describe('calcAssetIncomePerYear', () => {
    it('calculates annual income for stock with 1x/year dividend', () => {
      const result = calcAssetIncomePerYear(800, 186, 1);
      expect(result).toBe(148800);
    });

    it('calculates annual income for bond with 2x/year coupon', () => {
      const result = calcAssetIncomePerYear(500, 36.9, 2);
      expect(result).toBe(36900);
    });

    it('calculates annual income for monthly rent (quantity=1)', () => {
      const result = calcAssetIncomePerYear(1, 45000, 12);
      expect(result).toBe(540000);
    });
  });

  describe('calcAssetIncomePerMonth', () => {
    it('normalizes yearly dividend to monthly', () => {
      const result = calcAssetIncomePerMonth(800, 186, 1);
      expect(result).toBeCloseTo(12400, 0);
    });
  });

  describe('calcPortfolioIncome', () => {
    it('sums normalized income across multiple assets', () => {
      const items = [
        { quantity: 800, paymentAmount: 186, frequencyPerYear: 1 },
        { quantity: 500, paymentAmount: 36.9, frequencyPerYear: 2 },
        { quantity: 1, paymentAmount: 45000, frequencyPerYear: 12 },
      ];
      const result = calcPortfolioIncome(items);
      expect(result.perYear).toBeCloseTo(725700, 0);
      expect(result.perMonth).toBeCloseTo(60475, 0);
    });

    it('returns zero for empty portfolio', () => {
      const result = calcPortfolioIncome([]);
      expect(result.perYear).toBe(0);
      expect(result.perMonth).toBe(0);
    });
  });

  describe('calcYieldPercent', () => {
    it('calculates yield from income and portfolio value', () => {
      const result = calcYieldPercent(725700, 8200000);
      expect(result).toBeCloseTo(8.85, 1);
    });

    it('returns 0 when portfolio value is 0', () => {
      const result = calcYieldPercent(100000, 0);
      expect(result).toBe(0);
    });
  });

  describe('calcCAGR (calendar-year)', () => {
    it('calculates CAGR from first to last full calendar year', () => {
      const history = [
        { amount: 10, date: new Date('2021-07-01') },
        { amount: 12, date: new Date('2022-07-01') },
        { amount: 15, date: new Date('2023-07-01') },
      ];
      const now = new Date('2026-03-16');
      const result = calcCAGR(history, now);
      expect(result).toBeCloseTo(22.47, 0);
    });
    it('returns null for payments in only one year', () => {
      const history = [
        { amount: 10, date: new Date('2023-01-01') },
        { amount: 20, date: new Date('2023-06-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });
    it('returns null when first year income is 0', () => {
      const history = [
        { amount: 0, date: new Date('2021-07-01') },
        { amount: 15, date: new Date('2023-07-01') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });
    it('excludes current year from last_full_year', () => {
      const history = [
        { amount: 10, date: new Date('2025-07-01') },
        { amount: 20, date: new Date('2026-01-15') },
      ];
      expect(calcCAGR(history, new Date('2026-03-16'))).toBeNull();
    });
    it('handles gaps between years', () => {
      const history = [
        { amount: 10, date: new Date('2020-06-01') },
        { amount: 20, date: new Date('2024-06-01') },
      ];
      const result = calcCAGR(history, new Date('2026-03-16'));
      expect(result).toBeCloseTo(18.92, 0);
    });
  });

  describe('calcFactPerMonth', () => {
    it('sums payments in last 12 months and divides by 12', () => {
      const history = [
        { amount: 10, date: new Date('2025-06-15') },
        { amount: 15, date: new Date('2025-12-15') },
        { amount: 5, date: new Date('2024-01-01') },
      ];
      const now = new Date('2026-03-16');
      const result = calcFactPerMonth(history, 100, now);
      expect(result).toBeCloseTo(208.33, 0);
    });
    it('returns 0 for empty history', () => {
      expect(calcFactPerMonth([], 100, new Date())).toBe(0);
    });
    it('returns 0 when no payments in last 12 months', () => {
      const history = [{ amount: 50, date: new Date('2020-01-01') }];
      expect(calcFactPerMonth(history, 100, new Date('2026-03-16'))).toBe(0);
    });
  });

  describe('calcDecayAverage', () => {
    it('computes decay average from 12-month window around last payment', () => {
      const history = [
        { amount: 10, date: new Date('2021-08-01') },
        { amount: 51, date: new Date('2022-09-15') },
      ];
      const now = new Date('2026-03-16');
      const result = calcDecayAverage(history, now);
      expect(result).toBeCloseTo(0.94, 1);
    });
    it('includes multiple payments within the 12-month window', () => {
      const history = [
        { amount: 10, date: new Date('2022-03-01') },
        { amount: 51, date: new Date('2022-09-15') },
      ];
      const now = new Date('2026-03-16');
      const result = calcDecayAverage(history, now);
      expect(result).toBeCloseTo(1.13, 1);
    });
    it('returns null for empty history', () => {
      expect(calcDecayAverage([], new Date())).toBeNull();
    });
    it('handles single payment (no prior payments in window)', () => {
      const history = [{ amount: 100, date: new Date('2025-06-01') }];
      const now = new Date('2026-03-16');
      const result = calcDecayAverage(history, now);
      expect(result).toBeCloseTo(4.76, 1);
    });
  });

  describe('calcMainNumber', () => {
    it('returns forecast when activeMetric is forecast and forecastAmount set', () => {
      const result = calcMainNumber({
        activeMetric: 'forecast', forecastAmount: 50, frequencyPerYear: 2, quantity: 100, factPerMonth: 0,
      });
      expect(result).toBeCloseTo(833.33, 0);
    });
    it('falls back to fact when forecastAmount is null', () => {
      const result = calcMainNumber({
        activeMetric: 'forecast', forecastAmount: null, frequencyPerYear: 1, quantity: 100, factPerMonth: 500,
      });
      expect(result).toBe(500);
    });
    it('returns fact when activeMetric is fact', () => {
      const result = calcMainNumber({
        activeMetric: 'fact', forecastAmount: 50, frequencyPerYear: 2, quantity: 100, factPerMonth: 200,
      });
      expect(result).toBe(200);
    });
  });
});
