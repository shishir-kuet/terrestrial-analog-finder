import { describe, expect, it } from 'vitest';
import { fmtCoord, fmtValue, indexColor, isValidCoord } from './format';

describe('coordinate validation', () => {
  it('accepts valid coordinates', () => {
    expect(isValidCoord(-89.9, 179.9)).toBe(true);
    expect(isValidCoord(0, 0)).toBe(true);
  });
  it('rejects invalid coordinates', () => {
    for (const [la, lo] of [[91, 0], [0, 181], [NaN, 0], [0, Infinity], ['1', 2], [null, 0]] as unknown[][])
      expect(isValidCoord(la, lo)).toBe(false);
  });
  it('formats hemispheres', () => {
    expect(fmtCoord(-1.5, -2.25)).toBe('1.500° S, 2.250° W');
  });
});

describe('value formatting', () => {
  it('never renders missing values as zero', () => {
    expect(fmtValue(null)).toBe('unavailable');
    expect(fmtValue(undefined)).toBe('unavailable');
    expect(fmtValue(NaN)).toBe('unavailable');
    expect(fmtValue(0, { unit: 'm', key: 'x' })).toBe('0.00 m');
  });
  it('uses units', () => {
    expect(fmtValue(12.34, { unit: 'degrees', key: 's' })).toBe('12.3°');
    expect(fmtValue(1234.4, { unit: 'm', key: 'r' })).toBe('1234 m');
  });
});

describe('index colour scale', () => {
  it('is defined across and beyond the range', () => {
    expect(indexColor(0)).toBe('rgb(49, 54, 149)');
    expect(indexColor(100)).toBe('rgb(253, 174, 97)');
    expect(indexColor(-5)).toBe(indexColor(0));
    expect(indexColor(150)).toBe(indexColor(100));
  });
});
