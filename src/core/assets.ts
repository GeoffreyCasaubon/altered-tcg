import { store } from './loader';
import { resolveUrl } from './utils';
import type { CardState, CardJson } from './types';

const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
let _qrcodePromise: Promise<void> | null = null;

export function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  if (imgCache.has(src)) return imgCache.get(src)!;
  const p = new Promise<HTMLImageElement | null>(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => { imgCache.delete(src); resolve(null); };
    img.src = src;
  });
  imgCache.set(src, p);
  return p;
}

export async function loadCardAssets(state: CardState, cardJson: CardJson): Promise<void> {
  const imgs = (cardJson._images    || {}) as Record<string, string>;
  const urls = (cardJson._urls      || {}) as Record<string, string>;
  const sel  = (cardJson._selection || {}) as { setCode?: string | null };
  const base = store.opts.configBaseUrl;

  const jobs: Promise<void>[] = [];

  jobs.push(
    loadImage(imgs.bg || urls.bg || null)
      .then(img => { state.images.bg = img; })
  );

  let frameUrl: string | null = imgs.frame || urls.frame || null;
  if (!frameUrl) {
    const fc = state.activeTypeCfg?.frameFile;
    if (fc) frameUrl = resolveUrl(fc, base);
  }
  jobs.push(loadImage(frameUrl).then(img => { state.images.frame = img; }));

  let logoUrl: string | null = imgs.logo || urls.logo || null;
  if (!logoUrl && sel.setCode) {
    const entry = (state.config.setLogos || []).find(l => l.code === sel.setCode);
    if (entry?.file) logoUrl = resolveUrl(entry.file, base);
  }
  jobs.push(loadImage(logoUrl).then(img => { state.images.logo = img; }));

  const qrCfg = (state.config.qrLogo || {}) as { enabled?: boolean; file?: string };
  if (qrCfg.enabled && qrCfg.file) {
    jobs.push(
      loadImage(resolveUrl(qrCfg.file, base))
        .then(img => { state.images.qrLogo = img; })
    );
  }

  const ftId = state.activeFrameTypeId;
  if (ftId) {
    const ft   = (state.config.frameTypes?.[ftId] || {}) as { frameParts?: Record<string, { visible?: boolean }> };
    const used = ft.frameParts || {};
    for (const [partId, partCfg] of Object.entries(used)) {
      if (partCfg.visible === false) continue;
      const def = (state.config.frameParts || []).find(p => p.id === partId);
      if (def?.file) {
        const pUrl = resolveUrl(def.file, base);
        jobs.push(loadImage(pUrl).then(img => { if (img) state.images.frameParts[partId] = img; }));
      }
    }
  }

  for (const el of state.elements.filter(e => e.inputType === 'stamp')) {
    const src = imgs[el.id] || urls[el.id] || null;
    if (src) jobs.push(loadImage(src).then(img => { state.images[el.id] = img; }));
  }

  for (const el of state.elements.filter(e => e.inputType === 'svgimage')) {
    const g   = ((state.config.globalDefaults || {})[el.id] || {}) as { file?: string };
    const src = g.file ? resolveUrl(g.file, base) : null;
    if (src) jobs.push(loadImage(src).then(img => { state.images[el.id] = img; }));
  }

  await Promise.all(jobs);

  const qrEl = state.elements.find(e => e.inputType === 'qr');
  if (qrEl) {
    const qrUrl = state.values[qrEl.id] || state.settings[qrEl.id]?.defaultValue || '';
    if (qrUrl) state.qrSource = await generateQRImage(qrUrl);
  }
}

async function loadQRCodeLib(): Promise<void> {
  if ((window as Window & { QRCode?: unknown }).QRCode) return;
  if (_qrcodePromise) return _qrcodePromise;
  _qrcodePromise = new Promise<void>((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = resolveUrl(store.opts.qrcodeLib, store.opts.configBaseUrl);
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(`AlteredRender: cannot load QRCode lib from ${s.src}`));
    document.head.appendChild(s);
  });
  return _qrcodePromise;
}

export async function generateQRImage(url: string): Promise<HTMLImageElement | HTMLCanvasElement | null> {
  try {
    await loadQRCodeLib();
    if (!(window as Window & { QRCode?: unknown }).QRCode) return null;
  } catch { return null; }

  return new Promise(resolve => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1px;overflow:hidden;visibility:hidden';
    document.body.appendChild(div);

    try {
      const W = (window as unknown) as Window & { QRCode: new (el: HTMLElement, opts: Record<string, unknown>) => { _oQRCode: { getModuleCount(): number; isDark(r: number, c: number): boolean } } & { CorrectLevel: { H: number } } };
      const qr = new W.QRCode(div, {
        text:         url,
        width:        256,
        height:       256,
        colorDark:    '#000000',
        colorLight:   '#ffffff',
        correctLevel: (W.QRCode as unknown as { CorrectLevel: { H: number } }).CorrectLevel.H,
      });

      const model   = qr._oQRCode;
      const cleanup = () => { try { document.body.removeChild(div); } catch { /* ignore */ } };

      if (model) {
        const n     = model.getModuleCount();
        const rects: string[] = [];
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++)
            if (model.isDark(r, c)) rects.push(`<rect x="${c}" y="${r}" width="1" height="1"/>`);

        const svg     = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}">` +
                        `<rect width="${n}" height="${n}" fill="#fff"/>` +
                        `<g fill="#000">${rects.join('')}</g></svg>`;
        const blob    = new Blob([svg], { type: 'image/svg+xml' });
        const blobUrl = URL.createObjectURL(blob);
        const img     = new Image();
        img.onload  = () => { URL.revokeObjectURL(blobUrl); cleanup(); resolve(img); };
        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          setTimeout(() => { cleanup(); resolve(div.querySelector('canvas')); }, 80);
        };
        img.src = blobUrl;
      } else {
        setTimeout(() => { cleanup(); resolve(div.querySelector('canvas')); }, 80);
      }
    } catch {
      try { document.body.removeChild(div); } catch { /* ignore */ }
      resolve(null);
    }
  });
}
