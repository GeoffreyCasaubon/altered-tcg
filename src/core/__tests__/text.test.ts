import { describe, it, expect } from 'vitest';
import { tokenizeMixed, htmlToRuns } from '../text';

describe('tokenizeMixed', () => {
  it('returns a single normal segment for plain text', () => {
    const segs = tokenizeMixed('hello');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ text: 'hello', isIcon: false, isCircled: false });
  });

  it('splits icon chars from normal text', () => {
    const icon = String.fromCodePoint(0xE001);
    const segs = tokenizeMixed('A' + icon + 'B');
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ isIcon: false });
    expect(segs[1]).toMatchObject({ isIcon: true });
    expect(segs[2]).toMatchObject({ isIcon: false });
  });

  it('marks circled number segments', () => {
    const circled = String.fromCodePoint(0x2460);
    const segs = tokenizeMixed(circled);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ isCircled: true, isIcon: false });
  });

  it('returns empty array for empty string', () => {
    expect(tokenizeMixed('')).toHaveLength(0);
  });

  it('groups consecutive icons together', () => {
    const icon1 = String.fromCodePoint(0xE001);
    const icon2 = String.fromCodePoint(0xE002);
    const segs = tokenizeMixed(icon1 + icon2);
    expect(segs).toHaveLength(1);
    expect(segs[0].isIcon).toBe(true);
  });
});

describe('htmlToRuns', () => {
  it('returns empty array for empty input', () => {
    expect(htmlToRuns('')).toHaveLength(0);
    expect(htmlToRuns(null as unknown as string)).toHaveLength(0);
  });

  it('returns a single run for plain text', () => {
    const runs = htmlToRuns('hello');
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe('hello');
    expect(runs[0].bold).toBe(false);
    expect(runs[0].italic).toBe(false);
  });

  it('marks bold runs', () => {
    const runs = htmlToRuns('<b>bold</b>');
    const boldRun = runs.find(r => r.bold);
    expect(boldRun).toBeDefined();
    expect(boldRun?.text).toBe('bold');
  });

  it('marks italic runs', () => {
    const runs = htmlToRuns('<em>italic</em>');
    const italicRun = runs.find(r => r.italic);
    expect(italicRun).toBeDefined();
    expect(italicRun?.text).toBe('italic');
  });

  it('marks underline runs', () => {
    const runs = htmlToRuns('<u>under</u>');
    const uRun = runs.find(r => r.underline);
    expect(uRun).toBeDefined();
    expect(uRun?.text).toBe('under');
  });

  it('inserts newline for <br>', () => {
    const runs = htmlToRuns('line1<br>line2');
    const allText = runs.map(r => r.text).join('');
    expect(allText).toContain('\n');
  });

  it('extracts color from inline style', () => {
    const runs = htmlToRuns('<span style="color:#ff0000">red</span>');
    const colorRun = runs.find(r => r.color);
    expect(colorRun?.color).toBeTruthy();
  });

  it('applies fontScale from inline em size', () => {
    const runs = htmlToRuns('<span style="font-size:1.5em">big</span>');
    const scaled = runs.find(r => r.fontScale !== 1.0);
    expect(scaled?.fontScale).toBeCloseTo(1.5);
  });
});
