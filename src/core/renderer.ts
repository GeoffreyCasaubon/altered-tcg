import { CARD_W, CARD_H, LOADING, ERROR } from './constants';
import { deepMerge, matchCardsData } from './utils';
import { store, ensureConfig, ensureBiomeImages } from './loader';
import { buildStateFromJson } from './state';
import { loadCardAssets } from './assets';
import { apiToCardJson, API_MAPPING } from './mapping';
import {
  htmlToRuns, drawRichText, drawWrappedText,
  drawMixedLine, measureMixed, drawRoundedRect,
} from './text';
import type { CardState, CardJson, ResourceOptions, ForgeConfig } from './types';


// ── Responsive canvas ─────────────────────────────────────────

function createResponsiveCanvas(container: HTMLElement): HTMLCanvasElement {
  container.innerHTML = '';
  container.style.position = 'relative';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:relative',
    `padding-bottom:${((CARD_H / CARD_W) * 100).toFixed(4)}%`,
    'width:100%',
    'overflow:hidden',
  ].join(';');

  const canvas = document.createElement('canvas');
  canvas.width  = CARD_W;
  canvas.height = CARD_H;
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';

  wrapper.appendChild(canvas);
  container.appendChild(wrapper);
  return canvas;
}


// ── Placeholder / error background helpers ────────────────────

function drawCardBg(ctx: CanvasRenderingContext2D, W: number, H: number, placeholderImg: HTMLImageElement | null): void {
  if (placeholderImg) {
    const sc = Math.max(W / placeholderImg.naturalWidth, H / placeholderImg.naturalHeight);
    const dw = placeholderImg.naturalWidth  * sc;
    const dh = placeholderImg.naturalHeight * sc;
    ctx.drawImage(placeholderImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0,   '#1a1a3a');
    grad.addColorStop(0.5, '#0e1428');
    grad.addColorStop(1,   '#080810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.font = 'bold 80px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🃏', W / 2, H / 2);
  }
}

function drawCardLabel(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  template: string | undefined,
  x: number, y: number,
  color: string,
  fontSizePct: number,
  ref?: string,
  msg?: string,
): void {
  if (!template) return;
  const text     = template.replace(/\{ref\}/g, ref || '').replace(/\{msg\}/g, msg || '');
  const lines    = text.split('\n');
  const fontSize = Math.round(W * fontSizePct / 100);
  const lineH    = fontSize * 1.3;
  const tx       = W * x / 100;
  const blockTop = H * y / 100 - (lines.length - 1) * lineH / 2;
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = `bold ${fontSize}px sans-serif`;
  for (let i = 0; i < lines.length; i++) {
    const ty = blockTop + i * lineH;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(lines[i], tx + 2, ty + 2);
    ctx.fillStyle = color;
    ctx.fillText(lines[i], tx, ty);
  }
  ctx.restore();
}

function drawPlaceholderBg(ctx: CanvasRenderingContext2D, W: number, H: number, ref?: string): void {
  drawCardBg(ctx, W, H, store.placeholderImg);
  drawCardLabel(ctx, W, H, LOADING.text, LOADING.x, LOADING.y, LOADING.color, LOADING.fontSize, ref);
}

function drawErrorBg(ctx: CanvasRenderingContext2D, W: number, H: number, ref?: string, msg?: string): void {
  drawCardBg(ctx, W, H, store.placeholderImg);
  drawCardLabel(ctx, W, H, ERROR.text, ERROR.x, ERROR.y, ERROR.color, ERROR.fontSize, ref, msg);
}


// ── Render steps ──────────────────────────────────────────────

function renderBackground(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  if (state.images.bg) {
    const img  = state.images.bg;
    const zoom = (state.bg.zoom || 100) / 100;
    const ox   = (state.bg.x   ?? 50) / 100;
    const oy   = (state.bg.y   ?? 50) / 100;
    const sc   = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
    const dw   = img.naturalWidth  * sc;
    const dh   = img.naturalHeight * sc;
    const dx   = (W - dw) * ox;
    const dy   = (H - dh) * oy;
    if (state.bg.flipX) {
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, W - dx - dw, dy, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(img, dx, dy, dw, dh);
    }
  } else {
    drawPlaceholderBg(ctx, W, H, state._ref);
  }
}

function renderBlackBleedBorder(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  const isBlackBleed = (state.activeTypeCfg as Record<string, unknown>)?.blackBleed ||
    (state.config.frameTypes?.[state.activeFrameTypeId ?? ''] as Record<string, unknown> | undefined)?.blackBleed;
  if (!isBlackBleed) return;
  const INSET = 2;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, INSET);
  ctx.fillRect(0, H - INSET, W, INSET);
  ctx.fillRect(0, INSET, INSET, H - 2 * INSET);
  ctx.fillRect(W - INSET, INSET, INSET, H - 2 * INSET);
}

function renderBiomeBadges(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  for (const el of state.elements.filter(e => e.isBiome)) {
    const s = state.settings[el.id];
    if (!s.visible || !s.bgVariant || s.bgVariant === 'none') continue;
    const biomeKey = (el.biomeKey || el.id) as keyof typeof state.biomeImages;
    const img      = state.biomeImages?.[biomeKey]?.[s.bgVariant];
    if (!img) continue;
    const cx = ((s.bgX ?? s.x) / 100) * W;
    const cy = ((s.bgY ?? s.y) / 100) * H;
    let dw: number, dh: number;
    if (s.bgW > 0 && s.bgH > 0) {
      dw = (s.bgW / 100) * W;
      dh = (s.bgH / 100) * H;
    } else {
      const asp = img.naturalWidth / img.naturalHeight;
      dw = ((s.bgSize ?? 8) / 100) * W;
      dh = dw / asp;
    }
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }
}

function renderFrame(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  if (state.images.frame) ctx.drawImage(state.images.frame, 0, 0, W, H);
}

function renderFrameParts(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  const parts = (state.config.frameParts || []).slice().sort((a, b) => ((a as Record<string, unknown>).order as number ?? 0) - ((b as Record<string, unknown>).order as number ?? 0));
  for (const part of parts) {
    const s   = state.overlaySettings[part.id];
    const img = state.images.frameParts[part.id];
    if (!img || !s || s.visible === false) continue;
    const cx  = (s.x    / 100) * W;
    const cy  = (s.y    / 100) * H;
    const sz  = (s.size / 100) * W;
    const asp = img.naturalWidth / img.naturalHeight;
    ctx.drawImage(img, cx - sz / 2, cy - (sz / asp) / 2, sz, sz / asp);
  }
}

function renderSetLogo(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  if (!state.images.logo || !state.settings.setLogo?.visible) return;
  const s    = state.settings.setLogo;
  const img  = state.images.logo;
  const cx   = (s.x / 100) * W;
  const cy   = (s.y / 100) * H;
  const boxW = ((s.w ?? s.size ?? 5) / 100) * W;
  const boxH = ((s.h ?? s.size ?? 5) / 100) * H;
  const imgW = img.naturalWidth  || 1;
  const imgH = img.naturalHeight || 1;
  const scaleW = boxW / imgW;
  const scaleH = boxH / imgH;
  const scale  = scaleW * imgH > boxH ? scaleH : scaleW;
  const drawW  = imgW * scale;
  const drawH  = imgH * scale;
  const off    = document.createElement('canvas');
  off.width    = imgW; off.height = imgH;
  const oCtx   = off.getContext('2d')!;
  oCtx.drawImage(img, 0, 0, imgW, imgH);
  oCtx.globalCompositeOperation = 'source-atop';
  oCtx.fillStyle = s.color || '#ffffff';
  oCtx.fillRect(0, 0, imgW, imgH);
  ctx.drawImage(off, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
}

function renderQR(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  if (!state.qrSource || !state.settings.qrCode?.visible) return;
  const s    = state.settings.qrCode;
  const size = (s.size / 100) * W;
  const x    = (s.x   / 100) * W;
  const y    = (s.y   / 100) * H;
  try {
    ctx.drawImage(state.qrSource as CanvasImageSource, x - size / 2, y - size / 2, size, size);
    const qrCfg  = (state.config.qrLogo || {}) as { enabled?: boolean; logoRatio?: number };
    const qrLogo = state._qrLogoOverride || (qrCfg.enabled ? state.images.qrLogo : null);
    if (qrLogo) {
      const logoRatio = Math.min(qrCfg.logoRatio ?? 0.22, 0.25);
      const lSize     = size * logoRatio;
      const lPad      = lSize * 0.12;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - lSize / 2 - lPad, y - lSize / 2 - lPad, lSize + lPad * 2, lSize + lPad * 2);
      ctx.drawImage(qrLogo, x - lSize / 2, y - lSize / 2, lSize, lSize);
      ctx.restore();
    }
  } catch { /* source not ready */ }
}

function renderTextElements(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  const cfg  = state.config as unknown as Record<string, unknown>;
  const fns  = state.fontNames;
  const textEls = state.elements.filter(el =>
    (el.inputType === 'text' || el.inputType === 'textarea' || el.inputType === 'richtext')
    && !(el as Record<string, unknown>).isAdmin && !(el as Record<string, unknown>).infoLinePart
  );

  for (const el of textEls) {
    const s   = state.settings[el.id];
    const val = state.values[el.id] || s.defaultValue || '';
    if (!s.visible || !val) continue;

    const x        = (s.x / 100) * W;
    const y        = (s.y / 100) * H;
    const fontSize = Math.round(s.fontSize);
    const style    = s.fontStyle || 'regular';
    const fontName = (fns as Record<string, string | null>)[style] || fns.regular;

    ctx.save();
    ctx.fillStyle    = s.color || '#ffffff';
    ctx.textBaseline = 'middle';

    if (s.textShadow) {
      const ts = s.textShadow as unknown as Record<string, unknown>;
      ctx.shadowColor   = (ts.color   as string) ?? 'transparent';
      ctx.shadowBlur    = (ts.blur    as number) ?? 0;
      ctx.shadowOffsetX = (ts.offsetX as number) ?? 0;
      ctx.shadowOffsetY = (ts.offsetY as number) ?? 0;
    }

    if (el.inputType === 'richtext') {
      const runs  = htmlToRuns(val);
      const maxPx = (s.maxWidth / 100) * W;
      const lineH = fontSize * (s.lineHeight || 1.4);
      const zone2 = (s.maxLines > 0 && s.x2 != null && s.maxWidth2 != null)
        ? { fromLine: s.maxLines, x: (s.x2 / 100) * W, maxWidth: (s.maxWidth2 / 100) * W }
        : null;
      drawRichText(ctx, cfg, runs, x, y, maxPx, lineH, fontSize, s.color || '#ffffff', fns, zone2);
    } else {
      ctx.textAlign  = 'left';
      const baseFont = `${fontSize}px "${fontName}"`;
      if ((el as Record<string, unknown>).hasMaxWidth) {
        const maxPx = (s.maxWidth / 100) * W;
        const lineH = fontSize * (s.lineHeight || 1.4);
        const zone2 = (s.maxLines > 0 && s.x2 != null && s.maxWidth2 != null)
          ? { fromLine: s.maxLines, x: (s.x2 / 100) * W, maxWidth: (s.maxWidth2 / 100) * W }
          : null;
        drawWrappedText(ctx, cfg, fns, val, x, y, maxPx, lineH, baseFont, zone2);
      } else if (s.align === 'center') {
        drawMixedLine(ctx, cfg, fns, val, x - measureMixed(ctx, cfg, fns, val, baseFont) / 2, y, baseFont);
      } else if (s.align === 'right') {
        drawMixedLine(ctx, cfg, fns, val, x - measureMixed(ctx, cfg, fns, val, baseFont), y, baseFont);
      } else {
        drawMixedLine(ctx, cfg, fns, val, x, y, baseFont);
      }
    }
    ctx.restore();
  }
}

function renderInfoLines(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  const cfg = state.config as unknown as Record<string, unknown>;
  const fns = state.fontNames;

  for (const el of state.elements.filter(e => e.inputType === 'infoLine')) {
    const s = state.settings[el.id];
    if (!s.visible) continue;
    const x        = (s.x / 100) * W;
    const y        = (s.y / 100) * H;
    const fontSize = Math.round(s.fontSize);
    const style    = s.fontStyle || 'regular';
    const fontName = (fns as Record<string, string | null>)[style] || fns.regular;
    const baseFont = `${fontSize}px "${fontName}"`;

    const parts: string[] = [];
    for (const f of ((el as Record<string, unknown>).fields as Array<{ ref: string; prefix?: string; suffix?: string }> || [])) {
      const fS  = state.settings[f.ref];
      if (fS?.visible === false) continue;
      const val = state.values[f.ref] || fS?.defaultValue || '';
      if (val) parts.push((f.prefix || '') + val + (f.suffix || ''));
    }
    const fullText = parts.join('');
    if (!fullText) continue;

    ctx.save();
    ctx.fillStyle    = s.color || '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'left';
    if (s.textShadow) {
      const ts = s.textShadow as unknown as Record<string, unknown>;
      ctx.shadowColor   = (ts.color   as string) ?? 'transparent';
      ctx.shadowBlur    = (ts.blur    as number) ?? 0;
      ctx.shadowOffsetX = (ts.offsetX as number) ?? 0;
      ctx.shadowOffsetY = (ts.offsetY as number) ?? 0;
    }
    if (s.align === 'center') {
      drawMixedLine(ctx, cfg, fns, fullText, x - measureMixed(ctx, cfg, fns, fullText, baseFont) / 2, y, baseFont);
    } else if (s.align === 'right') {
      drawMixedLine(ctx, cfg, fns, fullText, x - measureMixed(ctx, cfg, fns, fullText, baseFont), y, baseFont);
    } else {
      drawMixedLine(ctx, cfg, fns, fullText, x, y, baseFont);
    }
    ctx.restore();
  }
}

function renderHeroStats(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  const cfg = state.config as unknown as Record<string, unknown>;
  const fns = state.fontNames;

  for (const el of state.elements.filter(e => e.inputType === 'herostat')) {
    const s   = state.settings[el.id];
    const val = state.values[el.id] || s.defaultValue || '';
    if (!s.visible) continue;

    const x        = (s.x / 100) * W;
    const y        = (s.y / 100) * H;
    const fontSize = Math.round(s.fontSize);
    const style    = s.fontStyle || 'regular';
    const fontName = (fns as Record<string, string | null>)[style] || fns.regular;
    const baseFont = `${fontSize}px "${fontName}"`;

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'left';
    let curX = x;
    if (val) {
      ctx.fillStyle = s.color || '#ffffff';
      drawMixedLine(ctx, cfg, fns, val, curX, y, baseFont);
      curX += measureMixed(ctx, cfg, fns, val, baseFont);
    }
    const count  = Math.round(s.rectCount || 0);
    const rW     = s.rectW     || 18;
    const rH     = s.rectH     || 14;
    const gap    = s.rectGap   || 5;
    const radius = s.rectRadius || 3;
    if (count > 0) {
      ctx.fillStyle = s.rectColor || '#ffffff';
      curX += gap;
      for (let i = 0; i < count; i++) {
        drawRoundedRect(ctx, curX, y - rH / 2, rW, rH, radius);
        ctx.fill();
        curX += rW + gap;
      }
    }
    ctx.restore();
  }
}

function renderSvgImages(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  for (const el of state.elements.filter(e => e.inputType === 'svgimage')) {
    const img = state.images[el.id] as HTMLImageElement | null;
    const s   = state.settings[el.id];
    if (!img || s?.visible === false) continue;
    const cx  = ((s?.x    ?? 50) / 100) * W;
    const cy  = ((s?.y    ?? 50) / 100) * H;
    const sz  = ((s?.size ?? 15) / 100) * W;
    const asp = img.naturalWidth / img.naturalHeight;
    ctx.drawImage(img, cx - sz / 2, cy - (sz / asp) / 2, sz, sz / asp);
  }
}

function renderStamps(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  for (const el of state.elements.filter(e => e.inputType === 'stamp')) {
    const img = state.images[el.id] as HTMLImageElement | null;
    const s   = state.settings[el.id];
    if (!img || s?.visible === false) continue;
    const cx  = ((s?.x    ?? 50) / 100) * W;
    const cy  = ((s?.y    ?? 50) / 100) * H;
    const sz  = ((s?.size ?? 30) / 100) * W;
    const asp = img.naturalWidth / img.naturalHeight;
    ctx.save();
    ctx.globalAlpha = s?.opacity ?? 1.0;
    ctx.drawImage(img, cx - sz / 2, cy - (sz / asp) / 2, sz, sz / asp);
    ctx.restore();
  }
}

function renderAdminElements(ctx: CanvasRenderingContext2D, state: CardState, W: number, H: number): void {
  const fns = state.fontNames;

  const wm  = state.images.adminWatermark;
  const wmS = state.settings.adminWatermark;
  if (wm && wmS?.visible !== false) {
    const wx  = ((wmS?.x    ?? 50) / 100) * W;
    const wy  = ((wmS?.y    ?? 95) / 100) * H;
    const wSz = ((wmS?.size ?? 10) / 100) * W;
    const asp = wm.naturalWidth / wm.naturalHeight;
    ctx.save();
    ctx.globalAlpha = wmS?.opacity ?? 0.5;
    ctx.drawImage(wm, wx - wSz / 2, wy - (wSz / asp) / 2, wSz, wSz / asp);
    ctx.restore();
  }

  const adminTextEl = state.elements.find(e => e.id === 'adminText');
  if (!(adminTextEl as Record<string, unknown> | undefined)?.infoLinePart) {
    const atS = state.settings.adminText;
    const atV = state.values.adminText || (state.config as Record<string, unknown> & { ui?: Record<string, string> }).ui?.adminTextDefault || '';
    if (atV && atS?.visible !== false) {
      const ax  = ((atS?.x ?? 50) / 100) * W;
      const ay  = ((atS?.y ?? 98) / 100) * H;
      const aFs = Math.round(atS?.fontSize ?? 11);
      ctx.save();
      ctx.font         = `${aFs}px "${fns.regular}"`;
      ctx.fillStyle    = atS?.color ?? '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.textAlign    = atS?.align === 'right' ? 'right'
                       : atS?.align === 'center' ? 'center' : 'left';
      ctx.fillText(atV, ax, ay);
      ctx.restore();
    }
  }
}


// ── Main render pipeline ──────────────────────────────────────

export function renderCard(state: CardState, _canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const W = CARD_W, H = CARD_H;
  ctx.clearRect(0, 0, W, H);
  renderBackground(ctx, state, W, H);
  renderBlackBleedBorder(ctx, state, W, H);
  renderBiomeBadges(ctx, state, W, H);
  renderFrame(ctx, state, W, H);
  renderFrameParts(ctx, state, W, H);
  renderSetLogo(ctx, state, W, H);
  renderQR(ctx, state, W, H);
  renderTextElements(ctx, state, W, H);
  renderInfoLines(ctx, state, W, H);
  renderHeroStats(ctx, state, W, H);
  renderSvgImages(ctx, state, W, H);
  renderStamps(ctx, state, W, H);
  renderAdminElements(ctx, state, W, H);
}

export interface MountResult {
  canvas: HTMLCanvasElement;
  state: CardState;
  redraw(): void;
}

// ── Public API ────────────────────────────────────────────────

export const AlteredRender = {

  async init(options: Partial<ResourceOptions> = {}): Promise<ForgeConfig> {
    Object.assign(store.opts, options);
    store.cfg         = await ensureConfig();
    store.biomeImages = await ensureBiomeImages();
    return store.cfg;
  },

  async mount(container: HTMLElement, cardJson: CardJson, options: Partial<ResourceOptions> = {}): Promise<MountResult> {
    if (Object.keys(options).length) Object.assign(store.opts, options);

    store.cfg         = await ensureConfig();
    store.biomeImages = await ensureBiomeImages();

    const canvas = createResponsiveCanvas(container);
    const ctx    = canvas.getContext('2d')!;

    const state = buildStateFromJson(store.cfg, cardJson);
    state.fontNames   = { ...store.fontNames };
    state.biomeImages = store.biomeImages!;

    drawPlaceholderBg(ctx, CARD_W, CARD_H, cardJson._ref);

    await loadCardAssets(state, cardJson);
    renderCard(state, canvas, ctx);

    return {
      canvas,
      state,
      redraw() { renderCard(state, canvas, ctx); },
    };
  },

  async mountFromApi(
    container: HTMLElement,
    apiJson: Record<string, unknown>,
    mapping = API_MAPPING,
    options: Partial<ResourceOptions> = {},
  ): Promise<MountResult> {
    if (Object.keys(options).length) Object.assign(store.opts, options);

    store.cfg         = await ensureConfig();
    store.biomeImages = await ensureBiomeImages();

    const cardsOverride = matchCardsData(apiJson.reference as string, store.cfg.cardsData as Record<string, Record<string, unknown>> | undefined);
    if (cardsOverride) {
      apiJson = { ...apiJson, forge: deepMerge((apiJson.forge || {}) as Record<string, unknown>, cardsOverride) };
    }

    const cardJson = apiToCardJson(apiJson, mapping) as CardJson;
    return this.mount(container, cardJson);
  },

  _renderCard(state: CardState, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    renderCard(state, canvas, ctx);
  },

  _drawPlaceholderBg(ctx: CanvasRenderingContext2D, W: number, H: number, ref?: string): void {
    drawPlaceholderBg(ctx, W, H, ref);
  },

  // silence unused param warning for drawErrorBg
  _drawErrorBg: drawErrorBg,

  get loadedIndex() { return store.loadedIndex; },
  get fontNames()   { return { ...store.fontNames }; },
  get biomeImages() { return store.biomeImages; },
};
