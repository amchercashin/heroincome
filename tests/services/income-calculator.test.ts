import { describe, it, expect } from 'vitest';
import {
  calcAssetIncomePerYear,
  calcAssetIncomePerMonth,
  calcPortfolioIncome,
  calcYieldPercent,
  calcCAGR,
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

  describe('calcCAGR', () => {
    it('calculates CAGR over multiple years', () => {
      const annualIncomes = [100000, 120000, 150000, 180000];
      const result = calcCAGR(annualIncomes);
      expect(result).toBeCloseTo(21.54, 0);
    });

    it('returns null for less than 2 periods', () => {
      expect(calcCAGR([100000])).toBeNull();
      expect(calcCAGR([])).toBeNull();
    });

    it('returns null when first year is 0', () => {
      expect(calcCAGR([0, 100000])).toBeNull();
    });
  });
});
