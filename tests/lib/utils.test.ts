import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyFull, formatPercent } from '@/lib/utils';

describe('formatCurrency', () => {
  it('returns dash for null', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });

  it('formats zero as ₽ 0', () => {
    expect(formatCurrency(0)).toBe('₽ 0');
  });

  it('formats positive number', () => {
    expect(formatCurrency(500)).toBe('₽ 500');
  });

  it('formats thousands with K suffix', () => {
    expect(formatCurrency(12400)).toBe('₽ 12K');
  });

  it('formats millions with M suffix', () => {
    expect(formatCurrency(1500000)).toBe('₽ 1.5M');
  });
});

describe('formatCurrencyFull', () => {
  it('returns dash for null', () => {
    expect(formatCurrencyFull(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatCurrencyFull(undefined)).toBe('—');
  });

  it('formats zero as ₽ 0', () => {
    expect(formatCurrencyFull(0)).toMatch(/₽\s+0/);
  });
});

describe('formatPercent', () => {
  it('returns dash for null', () => {
    expect(formatPercent(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatPercent(undefined)).toBe('—');
  });

  it('formats zero as 0.0%', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formats positive percent', () => {
    expect(formatPercent(8.85)).toBe('8.9%');
  });
});
