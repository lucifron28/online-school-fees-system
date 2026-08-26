import { describe, expect, it } from 'vitest';
import {
  addCentavos,
  centavosToPesos,
  formatCentavos,
  formatCentavosForPdf,
  parseMoneyInput,
  parsePesoStringToCentavos,
  pesosToCentavos,
  subtractCentavos,
} from '@/lib/utils/currency';

describe('Exact Money Parsing (No Floating Point)', () => {
  it('parses zero correctly', () => {
    expect(parsePesoStringToCentavos('0')).toBe(0);
    expect(parsePesoStringToCentavos('0.0')).toBe(0);
    expect(parsePesoStringToCentavos('0.00')).toBe(0);
    expect(parsePesoStringToCentavos(0)).toBe(0);
    expect(pesosToCentavos('0')).toBe(0);
    expect(parseMoneyInput('0')).toBe(0);
  });

  it('parses one centavo correctly', () => {
    expect(parsePesoStringToCentavos('0.01')).toBe(1);
    expect(pesosToCentavos('0.01')).toBe(1);
    expect(parseMoneyInput('0.01')).toBe(1);
  });

  it('parses whole pesos correctly', () => {
    expect(parsePesoStringToCentavos('1')).toBe(100);
    expect(parsePesoStringToCentavos('10')).toBe(1000);
    expect(parsePesoStringToCentavos('1500')).toBe(150000);
    expect(parsePesoStringToCentavos(1500)).toBe(150000);
  });

  it('parses one decimal digit correctly (e.g. .5 -> 50 centavos)', () => {
    expect(parsePesoStringToCentavos('10.5')).toBe(1050);
    expect(parsePesoStringToCentavos('0.5')).toBe(50);
    expect(pesosToCentavos('10.5')).toBe(1050);
  });

  it('parses two decimal digits correctly', () => {
    expect(parsePesoStringToCentavos('10.50')).toBe(1050);
    expect(parsePesoStringToCentavos('1234.56')).toBe(123456);
    expect(pesosToCentavos('1234.56')).toBe(123456);
  });

  it('parses amounts with thousands commas correctly', () => {
    expect(parsePesoStringToCentavos('1,234.56')).toBe(123456);
    expect(parsePesoStringToCentavos('10,000,000.00')).toBe(1000000000);
    expect(parseMoneyInput('1,234.56')).toBe(123456);
  });

  it('parses amounts with currency prefix (₱ or PHP)', () => {
    expect(parsePesoStringToCentavos('₱1,234.56')).toBe(123456);
    expect(parsePesoStringToCentavos('PHP 1,234.56')).toBe(123456);
    expect(parsePesoStringToCentavos('PHP1234.56')).toBe(123456);
    expect(parseMoneyInput('₱1,500.00')).toBe(150000);
  });

  it('handles whitespace cleanly', () => {
    expect(parsePesoStringToCentavos('  1234.56  ')).toBe(123456);
    expect(parsePesoStringToCentavos('  ₱ 1,234.56  ')).toBe(123456);
  });

  it('rejects excessive decimal places (>2 digits)', () => {
    expect(() => parsePesoStringToCentavos('10.555')).toThrow(/excessive decimal places/i);
    expect(() => parsePesoStringToCentavos('0.001')).toThrow(/excessive decimal places/i);
    expect(() => parsePesoStringToCentavos('1234.5678')).toThrow(/excessive decimal places/i);
  });

  it('rejects negative values', () => {
    expect(() => parsePesoStringToCentavos('-10')).toThrow(/negative values are not allowed/i);
    expect(() => parsePesoStringToCentavos('-0.01')).toThrow(/negative values are not allowed/i);
    expect(() => parsePesoStringToCentavos('-1234.56')).toThrow(/negative values are not allowed/i);
  });

  it('rejects malformed text and non-numeric inputs', () => {
    expect(() => parsePesoStringToCentavos('')).toThrow(/empty input/i);
    expect(() => parsePesoStringToCentavos('   ')).toThrow(/empty input/i);
    expect(() => parsePesoStringToCentavos('abc')).toThrow(/Invalid peso amount/i);
    expect(() => parsePesoStringToCentavos('12a.34')).toThrow(/Invalid peso amount/i);
    expect(() => parsePesoStringToCentavos('12.34.56')).toThrow(/Invalid peso amount/i);
    expect(() => parsePesoStringToCentavos('NaN')).toThrow(/Invalid peso amount/i);
    expect(() => parsePesoStringToCentavos('Infinity')).toThrow(/Invalid peso amount/i);
    expect(() => parsePesoStringToCentavos('1e5')).toThrow(/Invalid peso amount/i);
  });

  it('handles large values within PostgreSQL integer range', () => {
    // 21_474_836.47 pesos = 2_147_483_647 centavos (max 32-bit signed int)
    expect(parsePesoStringToCentavos('21474836.47')).toBe(2147483647);
    expect(parsePesoStringToCentavos('21,474,836.47')).toBe(2147483647);
  });

  it('rejects values exceeding PostgreSQL 32-bit signed integer range', () => {
    expect(() => parsePesoStringToCentavos('21474836.48')).toThrow(/exceeds allowed range/i);
    expect(() => parsePesoStringToCentavos('100000000.00')).toThrow(/exceeds allowed range/i);
  });

  it('calculates and formats centavos with precision', () => {
    expect(centavosToPesos(150050)).toBe(1500.5);
    expect(formatCentavos(150050)).toContain('1,500.50');
    expect(formatCentavosForPdf(150050)).toBe('PHP 1,500.50');
    expect(addCentavos(100, 250)).toBe(350);
    expect(subtractCentavos(350, 100)).toBe(250);
  });
});
