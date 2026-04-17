import { store } from './loader.js';
import { resolveUrl } from './utils.js';

const imgCache = new Map();
let _qrcodePromise = null;

export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => { imgCache.delete(src); resolve(null); };
    img.src = src;
  });
  imgCache.set(src, p);
  return p;
}

export async function loadCardAssets(state, cardJson) {
  const imgs = cardJson._images    || {};
  const urls = cardJson._urls      || {};
  const sel  = cardJson._selection || {};
  const base = store.opts.configBaseUrl;

  const jobs = [];

  // Background
  jobs.push(
    loadImage(imgs.bg || urls.bg || null)
      .then(img => { state.images.bg = img; })
  );

  // Frame: embedded > explicit URL > config lookup
  let frameUrl = imgs.frame || urls.frame || null;
  if (!frameUrl) {
    const fc = state.activeTypeCfg?.frameFile;
    if (fc) frameUrl = resolveUrl(fc, base);
  }
  jobs.push(loadImage(frameUrl).then(img => { state.images.frame = img; }));

  // Set logo: embedded > explicit URL > set code match
  let logoUrl = imgs.logo || urls.logo || null;
  if (!logoUrl && sel.setCode) {
    const entry = (state.config.setLogos || []).find(l => l.code === sel.setCode);
    if (entry?.file) logoUrl = resolveUrl(entry.file, base);
  }
  jobs.push(loadImage(logoUrl).then(img => { state.images.logo = img; }));

  // QR logo
  const qrCfg = state.config.qrLogo || {};
  if (qrCfg.enabled && qrCfg.file) {
    jobs.push(
      loadImage(resolveUrl(qrCfg.file, base))
        .then(img => { state.images.qrLogo = img; })
    );
  }

  // Frame parts for this frame type
  const ftId = state.activeFrameTypeId;
  if (ftId) {
    const ft   = state.config.frameTypes?.[ftId] || {};
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

  // Stamp elements
  for (const el of state.elements.filter(e => e.inputType === 'stamp')) {
    const src = imgs[el.id] || urls[el.id] || null;
    if (src) jobs.push(loadImage(src).then(img => { state.images[el.id] = img; }));
  }

  // Static SVG/image elements
  for (const el of state.elements.filter(e => e.inputType === 'svgimage')) {
    const g   = (state.config.globalDefaults || {})[el.id] || {};
    const src = g.file ? resolveUrl(g.file, base) : null;
    if (src) jobs.push(loadImage(src).then(img => { state.images[el.id] = img; }));
  }

  await Promise.all(jobs);

  // QR code generation
  const qrEl = state.elements.find(e => e.inputType === 'qr');
  if (qrEl) {
    const qrUrl = state.values[qrEl.id] || state.settings[qrEl.id]?.defaultValue || '';
    if (qrUrl) state.qrSource = await generateQRImage(qrUrl);
  }
}

async function loadQRCodeLib() {
  if (window.QRCode) return;
  if (_qrcodePromise) return _qrcodePromise;
  _qrcodePromise = new Promise((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = resolveUrl(store.opts.qrcodeLib, store.opts.configBaseUrl);
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`AlteredRender: cannot load QRCode lib from ${s.src}`));
    document.head.appendChild(s);
  });
  return _qrcodePromise;
}

export async function generateQRImage(url) {
  try {
    await loadQRCodeLib();
    if (!window.QRCode) return null;
  } catch { return null; }

  return new Promise(resolve => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1px;overflow:hidden;visibility:hidden';
    document.body.appendChild(div);

    try {
      // eslint-disable-next-line no-undef
      const qr = new QRCode(div, {
        text:         url,
        width:        256,
        height:       256,
        colorDark:    '#000000',
        colorLight:   '#ffffff',
        // eslint-disable-next-line no-undef
        correctLevel: QRCode.CorrectLevel.H,
      });

      const model   = qr._oQRCode;
      const cleanup = () => { try { document.body.removeChild(div); } catch {} };

      if (model) {
        const n     = model.getModuleCount();
        const rects = [];
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
          setTimeout(() => { cleanup(); resolve(div.querySelector('canvas') || null); }, 80);
        };
        img.src = blobUrl;
      } else {
        setTimeout(() => { cleanup(); resolve(div.querySelector('canvas') || null); }, 80);
      }
    } catch {
      try { document.body.removeChild(div); } catch {}
      resolve(null);
    }
  });
}
