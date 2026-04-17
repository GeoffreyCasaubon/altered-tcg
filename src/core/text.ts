import { isPUA, isCircledNumber, normalizeColor } from './utils';
import type { FontNames, TextRun, TextSegment, Zone2 } from './types';

const _iconLabelCache = new WeakMap<Record<string, unknown>, Record<number, string>>();

export function iconLabel(cfg: Record<string, unknown> | null | undefined, cp: number): string {
  if (!cfg) return cp.toString(16);
  let map = _iconLabelCache.get(cfg);
  if (!map) {
    map = {};
    for (const [label, hex] of Object.entries((cfg.alteredIconsTokens as Record<string, string>) ?? {})) {
      if (!label.startsWith('_')) map[parseInt(hex, 16)] = label;
    }
    _iconLabelCache.set(cfg, map);
  }
  return map[cp] ?? cp.toString(16);
}

export function circledScale(cfg: Record<string, unknown> | null | undefined, text: string): number {
  const base = (cfg?.circledNumberScale as number) ?? 1.0;
  if (text?.codePointAt(0) === 0x24FF) return base * 0.64;
  return base;
}

export function segFont(
  cfg: Record<string, unknown> | null | undefined,
  fontNames: FontNames | null | undefined,
  isIcon: boolean,
  baseFont: string,
  isCircled = false,
  text = '',
): string {
  if (isIcon) {
    const key      = iconLabel(cfg, text.codePointAt(0)!);
    const perScale = (cfg?.alteredIconsSizes as Record<string, number> | undefined)?.[key] ?? 1.0;
    const newSize  = Math.round(parseFloat(baseFont) * ((cfg?.alteredIconsScale as number) ?? 1.0) * perScale);
    return `${newSize}px "Font Awesome Kit"`;
  }
  if (isCircled) {
    const scale   = circledScale(cfg, text);
    const newSize = Math.round(parseFloat(baseFont) * scale);
    if (fontNames?.circled) return `${newSize}px "${fontNames.circled}"`;
    return baseFont.replace(/^[\d.]+px/, `${newSize}px`);
  }
  return baseFont;
}

export function tokenizeMixed(text: string): TextSegment[] {
  const segs: TextSegment[] = [];
  let buf = '', bufIcon = false, bufCircled = false;
  for (const ch of text) {
    const cp        = ch.codePointAt(0)!;
    const isIcon    = isPUA(cp);
    const isCircled = !isIcon && isCircledNumber(cp);
    if (isIcon !== bufIcon || isCircled !== bufCircled) {
      if (buf) segs.push({ text: buf, isIcon: bufIcon, isCircled: bufCircled });
      buf = ch; bufIcon = isIcon; bufCircled = isCircled;
    } else {
      buf += ch;
    }
  }
  if (buf) segs.push({ text: buf, isIcon: bufIcon, isCircled: bufCircled });
  return segs;
}

export function measureMixed(
  ctx: CanvasRenderingContext2D,
  cfg: Record<string, unknown> | null | undefined,
  fontNames: FontNames | null | undefined,
  text: string,
  baseFont: string,
): number {
  let w = 0;
  for (const s of tokenizeMixed(text)) {
    ctx.font = segFont(cfg, fontNames, s.isIcon, baseFont, s.isCircled, s.text);
    w += ctx.measureText(s.text).width;
  }
  return w;
}

export function drawMixedLine(
  ctx: CanvasRenderingContext2D,
  cfg: Record<string, unknown> | null | undefined,
  fontNames: FontNames | null | undefined,
  text: string,
  x: number,
  y: number,
  baseFont: string,
): void {
  let cx = x;
  for (const s of tokenizeMixed(text)) {
    ctx.font = segFont(cfg, fontNames, s.isIcon, baseFont, s.isCircled, s.text);
    ctx.fillText(s.text, cx, y);
    cx += ctx.measureText(s.text).width;
  }
}

export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  cfg: Record<string, unknown> | null | undefined,
  fontNames: FontNames | null | undefined,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  baseFont: string,
  zone2: Zone2 | null = null,
): void {
  const paragraphs = text.split('\n');
  let curY = y, lineCount = 0;
  let curX = x, curMaxWidth = maxWidth;

  for (const para of paragraphs) {
    if (!para.trim()) { curY += lineHeight * 0.5; continue; }

    const rawSegs = tokenizeMixed(para);
    type Token = { text: string; isIcon: boolean; isCircled: boolean; w: number };
    const tokens: Token[] = [];
    for (const seg of rawSegs) {
      if (seg.isIcon) {
        for (const ch of seg.text) {
          ctx.font = segFont(cfg, fontNames, true, baseFont, false);
          tokens.push({ text: ch, isIcon: true, isCircled: false, w: ctx.measureText(ch).width });
        }
      } else if (seg.isCircled) {
        for (const ch of seg.text) {
          ctx.font = segFont(cfg, fontNames, false, baseFont, true, ch);
          tokens.push({ text: ch, isIcon: false, isCircled: true, w: ctx.measureText(ch).width });
        }
      } else {
        for (const p of seg.text.split(/(\s+)/)) {
          if (!p) continue;
          ctx.font = segFont(cfg, fontNames, false, baseFont, false);
          tokens.push({ text: p, isIcon: false, isCircled: false, w: ctx.measureText(p).width });
        }
      }
    }

    let lineToks: Token[] = [], lineW = 0;

    const flushLine = () => {
      while (lineToks.length && !lineToks[0].isIcon && !lineToks[0].text.trim()) lineToks.shift();
      while (lineToks.length && !lineToks[lineToks.length - 1].isIcon && !lineToks[lineToks.length - 1].text.trim()) lineToks.pop();
      const iconOffsetY = (cfg?.alteredIconsOffsetY as number) ?? 0;
      let cx = curX;
      for (const t of lineToks) {
        ctx.font = segFont(cfg, fontNames, t.isIcon, baseFont, t.isCircled, t.text);
        ctx.fillText(t.text, cx, curY + (t.isIcon ? iconOffsetY : 0));
        cx += t.w;
      }
      lineCount++;
      curY += lineHeight;
      lineToks = []; lineW = 0;
      if (zone2 && lineCount === zone2.fromLine) { curX = zone2.x; curMaxWidth = zone2.maxWidth; }
    };

    for (const tok of tokens) {
      if (lineW + tok.w > curMaxWidth && lineW > 0) flushLine();
      lineToks.push(tok); lineW += tok.w;
    }
    if (lineToks.length) flushLine();
  }
}

export function htmlToRuns(html: string): TextRun[] {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  const runs: TextRun[] = [];
  let firstBlock = true;

  function mergeOrPush(text: string, bold: boolean, italic: boolean, underline: boolean, strike: boolean, isIcon: boolean, color: string | null, fontScale: number) {
    const last = runs[runs.length - 1];
    if (!isIcon && last && !last.isIcon &&
        last.bold === bold && last.italic === italic &&
        last.underline === underline && last.strike === strike &&
        last.color === color && last.fontScale === fontScale) {
      last.text += text;
    } else {
      runs.push({ text, bold, italic, underline, strike, isIcon, color, fontScale });
    }
  }

  function walk(node: Node, bold: boolean, italic: boolean, underline: boolean, strike: boolean, color: string | null, fontScale: number) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!text) return;
      for (const ch of text) {
        const isIcon = isPUA(ch.codePointAt(0)!);
        mergeOrPush(ch, bold, italic, underline, strike, isIcon, color, fontScale);
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const el  = node as Element;
    const tag = el.tagName.toUpperCase();

    if (el.classList?.contains('altered-icon-span')) {
      const hex = (el as HTMLElement).dataset?.unicode;
      if (hex) runs.push({ text: String.fromCodePoint(parseInt(hex, 16)), bold, italic, underline, strike, isIcon: true, color, fontScale });
      return;
    }

    if (['DIV', 'P'].includes(tag)) {
      if (!firstBlock && runs.length > 0) {
        const last = runs[runs.length - 1];
        if (last && !last.text.endsWith('\n')) {
          if (last.isIcon) runs.push({ text: '\n', bold, italic, underline, strike, isIcon: false, color, fontScale });
          else last.text += '\n';
        }
      }
      firstBlock = false;
    }

    if (tag === 'BR') {
      const last = runs[runs.length - 1];
      if (last && !last.isIcon) last.text += '\n';
      else runs.push({ text: '\n', bold, italic, underline, strike, isIcon: false, color, fontScale });
      return;
    }

    let b = bold, it = italic, u = underline, s = strike, c = color, fs = fontScale;
    if (tag === 'B' || tag === 'STRONG') b  = true;
    if (tag === 'I' || tag === 'EM')     it = true;
    if (tag === 'U')                     u  = true;
    if (['S', 'STRIKE', 'DEL'].includes(tag)) s = true;
    if (tag === 'FONT' && (el as HTMLFontElement).color) c = normalizeColor((el as HTMLFontElement).color) || c;
    const htmlEl = el as HTMLElement;
    if (htmlEl.style) {
      if (htmlEl.style.fontWeight === 'bold')   b  = true;
      if (htmlEl.style.fontStyle  === 'italic') it = true;
      const td = htmlEl.style.textDecorationLine || htmlEl.style.textDecoration;
      if (td?.includes('underline'))    u = true;
      if (td?.includes('line-through')) s = true;
      if (htmlEl.style.color) c = normalizeColor(htmlEl.style.color) || c;
      if (htmlEl.style.fontSize) {
        const m = htmlEl.style.fontSize.match(/^([0-9.]+)em$/);
        if (m) fs = fontScale * parseFloat(m[1]);
      }
    }
    for (const child of node.childNodes) walk(child, b, it, u, s, c, fs);
  }

  walk(div, false, false, false, false, null, 1.0);
  return runs.filter(r => r.text !== '');
}

export function drawRichText(
  ctx: CanvasRenderingContext2D,
  cfg: Record<string, unknown> | null | undefined,
  runs: TextRun[],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  fontSize: number,
  color: string,
  fontNames: FontNames,
  zone2: Zone2 | null = null,
): void {
  const getFontName = (bold: boolean, italic: boolean): string => {
    if (bold)   return fontNames.bold   || fontNames.regular;
    if (italic) return fontNames.italic || fontNames.regular;
    return fontNames.regular;
  };

  const _iconScale = (ch: string): number => {
    const key = iconLabel(cfg, ch.codePointAt(0)!);
    return (cfg?.alteredIconsSizes as Record<string, number> | undefined)?.[key] ?? 1.0;
  };

  type RichToken = TextRun & { isCircled: boolean; isNewline?: boolean };
  const tokens: RichToken[] = [];
  for (const run of runs) {
    const fs = run.fontScale ?? 1.0;
    if (run.isIcon) { tokens.push({ ...run, isCircled: false, fontScale: fs }); continue; }
    for (const part of run.text.split(/(\n)/)) {
      if (part === '\n') {
        tokens.push({ text: '\n', bold: run.bold, italic: run.italic, underline: run.underline,
                      strike: run.strike, color: run.color, isIcon: false, isCircled: false, isNewline: true, fontScale: fs });
      } else if (part) {
        for (const seg of tokenizeMixed(part)) {
          if (seg.isCircled) {
            for (const ch of seg.text) {
              tokens.push({ text: ch, bold: run.bold, italic: run.italic, underline: run.underline,
                            strike: run.strike, color: run.color, isIcon: false, isCircled: true, isNewline: false, fontScale: fs });
            }
          } else {
            for (const sub of seg.text.split(/(\s+)/)) {
              if (sub) tokens.push({ text: sub, bold: run.bold, italic: run.italic, underline: run.underline,
                                     strike: run.strike, color: run.color, isIcon: false, isCircled: false, isNewline: false, fontScale: fs });
            }
          }
        }
      }
    }
  }

  const measureTok = (tok: RichToken): number => {
    if (tok.isNewline) return 0;
    const fn   = tok.isIcon ? 'Font Awesome Kit' : getFontName(tok.bold, tok.italic);
    const fs   = tok.fontScale ?? 1.0;
    const size = tok.isIcon    ? Math.round(fontSize * fs * ((cfg?.alteredIconsScale as number) ?? 1.0) * _iconScale(tok.text))
               : tok.isCircled ? Math.round(fontSize * fs * circledScale(cfg, tok.text))
               : Math.round(fontSize * fs);
    ctx.font = `${size}px "${fn}"`;
    return ctx.measureText(tok.text).width;
  };

  let lineTokens: RichToken[] = [], lineWidth = 0, curY = y;
  let lineCount = 0, curX = x, curMaxWidth = maxWidth;

  const flushLine = () => {
    while (lineTokens.length && !lineTokens[lineTokens.length - 1].isIcon && lineTokens[lineTokens.length - 1].text.trim() === '') lineTokens.pop();
    let cx = curX;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const iconOffsetY = (cfg?.alteredIconsOffsetY as number) ?? 0;
    for (const tok of lineTokens) {
      if (tok.isNewline) continue;
      const fn   = tok.isIcon ? 'Font Awesome Kit' : getFontName(tok.bold, tok.italic);
      const fs   = tok.fontScale ?? 1.0;
      const size = tok.isIcon    ? Math.round(fontSize * fs * ((cfg?.alteredIconsScale as number) ?? 1.0) * _iconScale(tok.text))
                 : tok.isCircled ? Math.round(fontSize * fs * circledScale(cfg, tok.text))
                 : Math.round(fontSize * fs);
      ctx.font      = `${size}px "${fn}"`;
      ctx.fillStyle = tok.color || color;
      ctx.fillText(tok.text, cx, curY + (tok.isIcon ? iconOffsetY : 0));
      const tw = ctx.measureText(tok.text).width;
      if (tok.underline || tok.strike) {
        ctx.save();
        ctx.strokeStyle = tok.color || color;
        ctx.lineWidth   = Math.max(1, fontSize * 0.06);
        ctx.beginPath();
        if (tok.underline) { ctx.moveTo(cx, curY + fontSize * 0.4);  ctx.lineTo(cx + tw, curY + fontSize * 0.4); }
        if (tok.strike)    { ctx.moveTo(cx, curY - fontSize * 0.05); ctx.lineTo(cx + tw, curY - fontSize * 0.05); }
        ctx.stroke(); ctx.restore();
      }
      cx += tw;
    }
    lineCount++;
    curY += lineHeight; lineTokens = []; lineWidth = 0;
    if (zone2 && lineCount === zone2.fromLine) { curX = zone2.x; curMaxWidth = zone2.maxWidth; }
  };

  for (const tok of tokens) {
    if (tok.isNewline) { flushLine(); continue; }
    const tw = measureTok(tok);
    if (lineWidth + tw > curMaxWidth && lineWidth > 0 && tok.text.trim() !== '') flushLine();
    lineTokens.push(tok); lineWidth += tw;
  }
  if (lineTokens.length) flushLine();
}

export function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);       ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);   ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);       ctx.arcTo(x,     y + h, x,   y + h - r,   r);
  ctx.lineTo(x, y + r);           ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}
