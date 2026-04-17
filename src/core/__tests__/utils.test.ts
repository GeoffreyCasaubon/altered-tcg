import { describe, it, expect } from 'vitest';
import { deepMerge, resolveUrl, normalizeColor, localize, isPUA, isCircledNumber } from '../utils';

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('overrides source keys with target', () => {
    const result = deepMerge({ a: 1 }, { a: 2 });
    expect(result).toEqual({ a: 2 });
  });

  it('recursively merges nested objects', () => {
    const result = deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 99, z: 3 } });
    expect(result).toEqual({ a: { x: 1, y: 99, z: 3 } });
  });

  it('does not mutate source objects', () => {
    const base = { a: { x: 1 } };
    deepMerge(base, { a: { x: 2 } });
    expect(base.a.x).toBe(1);
  });

  it('handles empty source object', () => {
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
  });
});

describe('resolveUrl', () => {
  it('returns absolute URLs unchanged', () => {
    expect(resolveUrl('https://example.com/img.png', 'https://base.com/')).toBe('https://example.com/img.png');
  });

  it('joins relative path with base URL', () => {
    expect(resolveUrl('img.png', 'https://cdn.example.com/assets/')).toBe('https://cdn.example.com/assets/img.png');
  });

  it('handles missing base URL', () => {
    expect(resolveUrl('img.png', '')).toBe('img.png');
    expect(resolveUrl('img.png', undefined as unknown as string)).toBe('img.png');
  });

  it('returns empty string for null/undefined path', () => {
    expect(resolveUrl(null as unknown as string, 'https://base.com/')).toBeFalsy();
    expect(resolveUrl('', 'https://base.com/')).toBeFalsy();
  });
});

describe('normalizeColor', () => {
  it('returns null for empty input', () => {
    expect(normalizeColor('')).toBeNull();
    expect(normalizeColor(null as unknown as string)).toBeNull();
  });

  it('passes through 6-char hex and expands 3-char hex', () => {
    expect(normalizeColor('#ffffff')).toBe('#ffffff');
    expect(normalizeColor('#fff')).toBe('#ffffff');
    expect(normalizeColor('#abc')).toBe('#aabbcc');
  });

  it('converts rgb to hex', () => {
    expect(normalizeColor('rgb(255,0,0)')).toBe('#ff0000');
    expect(normalizeColor('rgb(0,128,255)')).toBe('#0080ff');
  });
});

describe('localize', () => {
  it('returns string directly', () => {
    expect(localize('hello', 'en')).toBe('hello');
  });

  it('returns localized value from object', () => {
    expect(localize({ en: 'hello', fr: 'bonjour' }, 'fr')).toBe('bonjour');
  });

  it('falls back to English', () => {
    expect(localize({ en: 'hello' }, 'de')).toBe('hello');
  });

  it('returns null for missing keys', () => {
    expect(localize({ fr: 'bonjour' }, 'de')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(localize(null as unknown as string, 'en')).toBeNull();
    expect(localize(undefined as unknown as string, 'en')).toBeNull();
  });
});

describe('isPUA', () => {
  it('returns true for BMP Private Use Area codepoints (U+E000–U+F8FF)', () => {
    expect(isPUA(0xE000)).toBe(true);
    expect(isPUA(0xF000)).toBe(true);
    expect(isPUA(0xF8FF)).toBe(true);
  });

  it('returns false for supplementary PUA (outside BMP range)', () => {
    expect(isPUA(0xF0000)).toBe(false);
  });

  it('returns false for normal codepoints', () => {
    expect(isPUA(65)).toBe(false);
    expect(isPUA(0x1F600)).toBe(false);
  });
});

describe('isCircledNumber', () => {
  it('returns true for circled digit codepoints', () => {
    expect(isCircledNumber(0x2460)).toBe(true);
    expect(isCircledNumber(0x24FF)).toBe(true);
  });

  it('returns false for regular digits', () => {
    expect(isCircledNumber(48)).toBe(false);
    expect(isCircledNumber(65)).toBe(false);
  });
});
