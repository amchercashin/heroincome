import { describe, it, expect } from 'vitest';
import { getTypeColor, getDefaultFrequency, getTypeSuggestions } from '@/models/account';

describe('getTypeColor', () => {
  it('returns predefined color for known types', () => {
    expect(getTypeColor('Акции')).toBe('#c8b48c');
    expect(getTypeColor('Облигации')).toBe('#8b7355');
  });
  it('returns consistent hash color for custom types', () => {
    const color1 = getTypeColor('Мой тип');
    const color2 = getTypeColor('Мой тип');
    expect(color1).toBe(color2);
    expect(color1).toMatch(/^hsl\(/);
  });
});

describe('getDefaultFrequency', () => {
  it('returns frequency for known types', () => {
    expect(getDefaultFrequency('Акции')).toBe(1);
    expect(getDefaultFrequency('Облигации')).toBe(2);
  });
  it('returns undefined for custom types', () => {
    expect(getDefaultFrequency('Мой тип')).toBeUndefined();
  });
});

describe('getTypeSuggestions', () => {
  it('includes known types + existing', () => {
    const result = getTypeSuggestions(['Мой тип']);
    expect(result).toContain('Акции');
    expect(result).toContain('Мой тип');
  });
  it('deduplicates', () => {
    const result = getTypeSuggestions(['Акции']);
    expect(result.filter(t => t === 'Акции')).toHaveLength(1);
  });
});
