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
  const rgb = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
  // Relative luminance, the quantity that has to move monotonically for a
  // sequential ramp to survive greyscale printing and colour-vision deficiency.
  const luminance = (s: string) => {
    const [r, g, b] = rgb(s).map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it('clamps outside the 0-100 range instead of extrapolating', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(indexColor(-5, mode)).toBe(indexColor(0, mode));
      expect(indexColor(150, mode)).toBe(indexColor(100, mode));
    }
  });

  it('returns a parseable colour at every step, in both steppings', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (let s = 0; s <= 100; s += 5) expect(rgb(indexColor(s, mode))).toHaveLength(3);
    }
  });

  it('moves monotonically away from its own surface', () => {
    // Asserted as a property rather than pinned hex. On paper more similarity
    // means more ink; on charcoal it means more light. Either way the ramp is
    // monotonic, so the ordering is never ambiguous.
    for (let s = 5; s <= 100; s += 5) {
      expect(luminance(indexColor(s, 'light'))).toBeLessThan(luminance(indexColor(s - 5, 'light')));
      expect(luminance(indexColor(s, 'dark'))).toBeGreaterThan(luminance(indexColor(s - 5, 'dark')));
    }
  });

  it('keeps both ends distinguishable in each stepping', () => {
    expect(luminance(indexColor(0, 'light')) - luminance(indexColor(100, 'light'))).toBeGreaterThan(0.3);
    expect(luminance(indexColor(100, 'dark')) - luminance(indexColor(0, 'dark'))).toBeGreaterThan(0.3);
  });

  it('defaults to the dark stepping, which the result rows and meters use', () => {
    expect(indexColor(80)).toBe(indexColor(80, 'dark'));
  });
});
