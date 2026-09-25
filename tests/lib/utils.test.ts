import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyFull,
  formatPercent,
  formatCompact,
  formatMoney,
  formatPrice,
  formatRelativeTime,
  formatFrequency,
  plural,
} from '@/lib/utils';

/** Replace non-breaking spaces with regular ones for readable assertions. */
const s = (value: string) => value.replace(/ /g, ' ');

describe('formatCurrency', () => {
  it('returns dash for null / undefined / NaN', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency(NaN)).toBe('—');
  });

  it('puts the ruble sign after the number', () => {
    expect(s(formatCurrency(0))).toBe('0 ₽');
    expect(s(formatCurrency(500))).toBe('500 ₽');
  });

  it('formats thousands in Russian short form', () => {
    expect(s(formatCurrency(1200))).toBe('1,2 тыс ₽');
    expect(s(formatCurrency(12400))).toBe('12 тыс ₽');
    expect(s(formatCurrency(301_000))).toBe('301 тыс ₽');
  });

  it('formats millions and billions', () => {
    expect(s(formatCurrency(1_500_000))).toBe('1,5 млн ₽');
    expect(s(formatCurrency(7_000_000))).toBe('7 млн ₽');
    expect(s(formatCurrency(2_100_000_000))).toBe('2,1 млрд ₽');
  });

  it('keeps the sign for negatives', () => {
    expect(s(formatCurrency(-12400))).toBe('−12 тыс ₽');
  });
});

describe('formatCurrencyFull', () => {
  it('returns dash for null', () => {
    expect(formatCurrencyFull(null)).toBe('—');
    expect(formatCurrencyFull(undefined)).toBe('—');
  });

  it('groups digits and rounds', () => {
    expect(s(formatCurrencyFull(0))).toBe('0 ₽');
    expect(s(formatCurrencyFull(47054.4))).toBe('47 054 ₽');
  });
});

describe('formatMoney / formatPrice', () => {
  it('uses ₽ for rubles and the code for other currencies', () => {
    expect(s(formatMoney(312.4))).toBe('312 ₽');
    expect(s(formatMoney(100, 'usd'))).toBe('100 USD');
  });

  it('keeps kopecks for prices under 1000', () => {
    expect(s(formatPrice(312.4))).toBe('312,4 ₽');
    expect(s(formatPrice(6980.5))).toBe('6 981 ₽');
  });
});

describe('formatPercent', () => {
  it('returns dash for null', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
  });

  it('uses a decimal comma', () => {
    expect(formatPercent(0)).toBe('0,0%');
    expect(formatPercent(8.85)).toBe('8,9%');
  });
});

describe('formatCompact', () => {
  it('returns integer string for values under 1000', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(52)).toBe('52');
    expect(formatCompact(999)).toBe('999');
  });

  it('formats thousands', () => {
    expect(s(formatCompact(1000))).toBe('1 тыс');
    expect(s(formatCompact(1050))).toBe('1,1 тыс');
    expect(s(formatCompact(85000))).toBe('85 тыс');
  });
});

describe('plural', () => {
  const forms: [string, string, string] = ['позиция', 'позиции', 'позиций'];
  it.each([
    [1, 'позиция'], [2, 'позиции'], [4, 'позиции'], [5, 'позиций'],
    [11, 'позиций'], [12, 'позиций'], [21, 'позиция'], [22, 'позиции'], [111, 'позиций'],
  ])('%i → %s', (n, expected) => {
    expect(plural(n, forms)).toBe(expected);
  });
});

describe('formatFrequency', () => {
  it('describes common schedules in words', () => {
    expect(formatFrequency(12)).toBe('ежемесячно');
    expect(formatFrequency(4)).toBe('ежеквартально');
    expect(formatFrequency(1)).toBe('раз в год');
    expect(formatFrequency(3)).toBe('3 раза в год');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-25T12:00:00');
  it('formats recent times', () => {
    expect(formatRelativeTime(new Date('2026-09-25T11:59:40'), now)).toBe('только что');
    expect(s(formatRelativeTime(new Date('2026-09-25T11:55:00'), now))).toBe('5 мин назад');
    expect(s(formatRelativeTime(new Date('2026-09-25T09:00:00'), now))).toBe('3 ч назад');
  });
});
