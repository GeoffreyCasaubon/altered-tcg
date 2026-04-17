import { RESOURCES } from './constants.js';
import { resolveUrl } from './utils.js';

// Shared module state — all other modules import this object and read/write its properties
export const store = {
  opts:           { ...RESOURCES },
  cfg:            null,
  fontNames:      { regular: 'serif', bold: 'serif', italic: 'serif', circled: null },
  biomeImages:    null,
  placeholderImg: null,
  loadedIndex:    null,
};

let _cfgPromise   = null;
let _biomePromise = null;
let _iconCssInjected = false;

export async function ensureConfig() {
  if (store.cfg) return store.cfg;
  if (!_cfgPromise) _cfgPromise = loadConfig();
  store.cfg = await _cfgPromise;
  await injectIconCss();
  await loadFonts(store.cfg.font);
  const ph = store.cfg.placeholderBg;
  if (ph?.enabled && ph.file) {
    store.placeholderImg = await new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = resolveUrl(ph.file, store.opts.configBaseUrl);
    });
  }
  return store.cfg;
}

export async function loadConfig() {
  if (store.opts.embeddedConfig) {
    const config = store.opts.embeddedConfig;
    if (config.cardApiUrl) store.opts.cardApiUrl = config.cardApiUrl;
    return config;
  }

  const base     = store.opts.configBaseUrl;
  const indexUrl = resolveUrl(store.opts.configIndex, base);

  let index;
  try {
    const r = await fetch(indexUrl);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    index = await r.json();
    store.loadedIndex = index;
  } catch (err) {
    throw new Error(`AlteredRender: cannot load config index (${indexUrl}): ${err.message}`);
  }

  const allFiles = [
    ...(index.core     || []),
    ...(index.layout   || []),
    ...(index.factions || []),
  ];

  const results = await Promise.all(
    allFiles.map(async fname => {
      const url  = resolveUrl(`config/${fname}`, base);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Config ${fname}: HTTP ${resp.status}`);
      return resp.json();
    })
  );

  const config = {};
  for (const part of results) {
    for (const [key, val] of Object.entries(part)) {
      if (key.startsWith('_')) continue;
      if (key === 'factions') {
        if (!config.factions) config.factions = {};
        for (const [factionName, factionData] of Object.entries(val)) {
          if (!config.factions[factionName]) {
            config.factions[factionName] = { ...factionData, types: {} };
          }
          for (const [typeName, typeData] of Object.entries(factionData.types || {})) {
            if (!typeData.collection) continue;
            const key2 = `${typeData.collection}::${typeName}`;
            config.factions[factionName].types[key2] = typeData;
          }
        }
      } else {
        config[key] = val;
      }
    }
  }

  if (config.cardApiUrl) store.opts.cardApiUrl = config.cardApiUrl;

  const cardsFiles = index.cards || [];
  if (cardsFiles.length) {
    const cardsResults = await Promise.all(
      cardsFiles.map(async fname => {
        const url  = resolveUrl(`config/${fname}`, base);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Config ${fname}: HTTP ${resp.status}`);
        return resp.json();
      })
    );
    config.cardsData = {};
    for (const part of cardsResults) {
      for (const [key, val] of Object.entries(part)) {
        if (!key.startsWith('_')) config.cardsData[key] = val;
      }
    }
  }

  return config;
}

export async function loadFonts(fontCfg) {
  if (!fontCfg) return;
  const base     = store.opts.configBaseUrl;
  const fallback = fontCfg.fallback || 'serif';
  const isLegacy = !!fontCfg.file;

  if (isLegacy) {
    const name = await loadOneFontFace(fontCfg.name, resolveUrl(fontCfg.file, base), fallback);
    store.fontNames.regular = store.fontNames.bold = store.fontNames.italic = name;
    return;
  }

  await Promise.all(['regular', 'bold', 'italic', 'circled'].map(async variant => {
    const vcfg = fontCfg[variant];
    if (vcfg?.file) {
      store.fontNames[variant] = await loadOneFontFace(vcfg.name, resolveUrl(vcfg.file, base), fallback);
    } else if (variant !== 'circled') {
      store.fontNames[variant] = store.fontNames.regular || fallback;
    }
  }));
}

export async function loadOneFontFace(name, url, fallback) {
  try {
    const face = new FontFace(name, `url("${url}")`);
    await face.load();
    document.fonts.add(face);
    return name;
  } catch {
    console.warn(`AlteredRender: font "${name}" not found at ${url}, using ${fallback}`);
    return fallback;
  }
}

export async function injectIconCss() {
  if (_iconCssInjected) return;
  _iconCssInjected = true;
  const href = resolveUrl(store.opts.alteredIconsCss, store.opts.configBaseUrl);
  if (!document.querySelector(`link[href="${href}"]`)) {
    await new Promise(resolve => {
      const link  = document.createElement('link');
      link.rel    = 'stylesheet';
      link.href   = href;
      link.onload  = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }
  try {
    await document.fonts.load('1em "Font Awesome Kit"', '\ue024');
  } catch { /* ignore */ }
}

export async function ensureBiomeImages() {
  if (store.biomeImages) return store.biomeImages;
  if (!_biomePromise) _biomePromise = loadBiomeImages(store.cfg?.biomeBackgrounds);
  return (store.biomeImages = await _biomePromise);
}

export async function loadBiomeImages(bgs) {
  const result = { forest: {}, mountain: {}, ocean: {} };
  if (!bgs) return result;

  const isPerBiome = bgs.forest || bgs.mountain || bgs.ocean;
  const base       = store.opts.configBaseUrl;

  const loadImg = (biomeKey, variant, file) => {
    if (!file) return Promise.resolve();
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { result[biomeKey][variant] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = resolveUrl(file, base);
    });
  };

  const jobs = [];
  if (isPerBiome) {
    for (const biomeKey of ['forest', 'mountain', 'ocean']) {
      const biomeCfg = bgs[biomeKey];
      if (!biomeCfg) continue;
      for (const [variant, val] of Object.entries(biomeCfg)) {
        const file = typeof val === 'string' ? val : val?.file;
        if (file) jobs.push(loadImg(biomeKey, variant, file));
      }
    }
  } else {
    for (const biomeKey of ['forest', 'mountain', 'ocean']) {
      for (const [variant, file] of Object.entries(bgs)) {
        if (typeof file === 'string') jobs.push(loadImg(biomeKey, variant, file));
      }
    }
  }

  await Promise.all(jobs);
  return result;
}
