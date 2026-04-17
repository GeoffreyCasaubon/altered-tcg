import { describe, it, expect } from 'vitest';
import { resolve, applyTokens, applyTransforms } from '../mapping';

describe('resolve', () => {
  const data = { a: { b: { c: 42 } }, name: 'Axian' };

  it('resolves a dot-separated string path', () => {
    expect(resolve('a.b.c', data)).toBe(42);
  });

  it('returns null for missing path', () => {
    expect(resolve('a.x.y', data)).toBeNull();
  });

  it('calls function refs with data and lang', () => {
    const fn = (d: unknown, lang: string) => (d as typeof data).name + ':' + lang;
    expect(resolve(fn, data, 'en')).toBe('Axian:en');
  });

  it('returns literal value for non-string non-function refs', () => {
    expect(resolve(99, data)).toBe(99);
    expect(resolve(null, data)).toBeNull();
  });

  it('replaces {lang} placeholder in path', () => {
    const locData = { name_en: 'Hello', name_fr: 'Bonjour' };
    expect(resolve('name_{lang}', locData, 'en')).toBe('Hello');
    expect(resolve('name_{lang}', locData, 'fr')).toBe('Bonjour');
  });
});

describe('applyTokens', () => {
  it('returns empty string for falsy input', () => {
    expect(applyTokens('')).toBe('');
    expect(applyTokens(null)).toBe('');
    expect(applyTokens(undefined)).toBe('');
  });

  it('passes through text with no tokens', () => {
    expect(applyTokens('hello world')).toBe('hello world');
  });
});

describe('applyTransforms', () => {
  it('returns empty string for falsy input', () => {
    expect(applyTransforms('')).toBe('');
    expect(applyTransforms(null)).toBe('');
    expect(applyTransforms(undefined)).toBe('');
  });

  it('passes through text with no matching transforms', () => {
    expect(applyTransforms('plain text')).toBe('plain text');
  });
});
