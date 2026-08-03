import { describe, it, expect } from 'vitest';
import {
  pesosToCentavos,
  centavosToPesos,
  formatCentavos,
  addCentavos,
  subtractCentavos,
  parseMoneyInput,
} from '@/lib/utils/currency';

describe('Currency Utility (Integer Centavos)', () => {
  it('converts pesos to centavos correctly', () => {
    expect(pesosToCentavos(1500.5)).toBe(150050);
    expect(pesosToCentavos('12000.00')).toBe(1200000);
    expect(pesosToCentavos(0)).toBe(0);
  });

  it('converts centavos back to pesos correctly', () => {
    expect(centavosToPesos(150050)).toBe(1500.5);
    expect(centavosToPesos(1200000)).toBe(12000);
  });

  it('formats centavos as Philippine Pesos (PHP ₱)', () => {
    const formatted = formatCentavos(1200000);
    expect(formatted).toContain('12,000.00');
  });

  it('adds and subtracts centavos safely', () => {
    expect(addCentavos(1200000, 200000)).toBe(1400000);
    expect(subtractCentavos(1400000, 1000000)).toBe(400000);
  });

  it('parses valid user money input string into centavos', () => {
    expect(parseMoneyInput('14000')).toBe(1400000);
    expect(parseMoneyInput('₱14,000.00')).toBe(1400000);
    expect(parseMoneyInput('1500.50')).toBe(150050);
  });

  it('throws error for invalid or negative monetary inputs', () => {
    expect(() => parseMoneyInput('-100')).toThrow();
    expect(() => parseMoneyInput('invalid')).toThrow();
  });
});
