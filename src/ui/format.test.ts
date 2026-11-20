import { describe, expect, it } from 'vitest';
import { fmt, fmtDuration, fmtParams } from './format';

describe('format', () => {
  it('formats numbers with suffixes and rounds across boundaries', () => {
    expect(fmt(999)).toBe('999');
    expect(fmt(1234)).toBe('1.23K');
    expect(fmt(999_999.9)).toBe('1.00M');
    expect(fmt(2.5e9)).toBe('2.50B');
    expect(fmt(Infinity)).toBe('∞');
  });

  it('formats durations up to the absurd', () => {
    expect(fmtDuration(42)).toBe('42s');
    expect(fmtDuration(3661)).toBe('1h 1m');
    expect(fmtDuration(1e20)).toBe('after the heat death of the universe');
  });

  it('formats model sizes', () => {
    expect(fmtParams(6)).toBe('1M');
    expect(fmtParams(9.5)).toBe('3.2B');
    expect(fmtParams(12)).toBe('1T');
  });
});
