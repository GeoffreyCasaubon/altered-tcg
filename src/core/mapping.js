import {
  API_TEXT_TOKENS, API_TEXT_TRANSFORMS, BIOME_VARIANT_AUTO, API_QR_CODE,
  DEFAULT_COLLECTION, FACTION_COLLECTION, RARITY_ASSET_INDEX, FRAME_AUTO_SELECT,
} from './constants.js';
import { isPUA, isCircledNumber, localize } from './utils.js';
import { store } from './loader.js';

export function resolve(ref, data, lang) {
  if (typeof ref === 'function') return ref(data, lang);
  if (typeof ref === 'string') {
    const path = lang ? ref.replace(/\{lang\}/g, lang) : ref;
    let cur = data;
    for (const key of path.split('.')) {
      if (cur == null) return null;
      cur = cur[key];
    }
    return cur ?? null;
  }
  return ref ?? null;
}

export function applyTokens(text, cfg = null, isRich = false) {
  if (!text) return text;
  let out = text;
  for (const [token, val] of Object.entries(API_TEXT_TOKENS)) {
    const char = typeof val === 'string' ? val : val.char;
    let replacement = char;
    if (isRich && char) {
      const cp = char.codePointAt(0);
      if (isPUA(cp)) {
        const key      = cfg?.alteredIconsTokens
          ? Object.entries(cfg.alteredIconsTokens).find(([, h]) => parseInt(h, 16) === cp)?.[0]
          : null;
        const perScale = (key && !key.startsWith('_') && cfg?.alteredIconsSizes?.[key]) ?? 1.0;
        const scale    = (cfg?.alteredIconsScale ?? 1.0) * perScale;
        replacement = `<span style="font-size:${scale}em">${char}</span>`;
      } else if (isCircledNumber(cp)) {
        const scale = cfg?.circledNumberScale ?? 1.0;
        replacement = `<span style="font-size:${scale}em">${char}</span>`;
      }
    }
    out = out.split(token).join(replacement);
  }
  return out;
}

export function applyTransforms(text) {
  if (!text) return text;
  let out = text;
  for (const { pattern, replacement } of API_TEXT_TRANSFORMS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export const API_MAPPING = {
  lang:         'forge.lang',
  langFallback: 'en',

  selection: (d, lang) => {
    const faction    = d.faction?.name ?? '';
    const forgeCol   = d.forge?.collection;
    const collection = (forgeCol && forgeCol !== DEFAULT_COLLECTION)
      ? forgeCol
      : (FACTION_COLLECTION[faction] || DEFAULT_COLLECTION);
    let frameType = d.forge?.frameType ?? null;

    if (!frameType) {
      const rarity = d.cardRarity?.reference ?? d.rarity?.reference ?? '';
      const rules  = FRAME_AUTO_SELECT[rarity] || [];
      const match  = rules.find(r => r.test(d, lang));
      frameType    = match?.frameType ?? null;
    }

    return {
      faction,
      type: frameType ? `${collection}::${frameType}` : '',
    };
  },

  background: (d, lang) => {
    if (Array.isArray(d.assets) && d.assets.length) {
      const rarity = d.cardRarity?.reference ?? d.cardGroup?.rarity?.reference ?? '';
      const idx    = RARITY_ASSET_INDEX[rarity] ?? 0;
      return d.assets[idx] ?? d.assets[0] ?? null;
    }
    const ip = d.imagePath;
    return (ip && typeof ip === 'object') ? (ip[lang] ?? ip.en ?? null) : (ip ?? null);
  },

  setCode: 'set.reference',

  bgTransform: d => ({
    zoom:  d.forge?.bgTransform?.zoom  ?? 130,
    x:     d.forge?.bgTransform?.x     ?? 50,
    y:     d.forge?.bgTransform?.y     ?? 50,
    flipX: d.forge?.bgTransform?.flipX ?? false,
  }),

  values: {
    cardName:      (d, lang) => localize(d.name, lang) ?? '',
    handCost:      'mainCost',
    reserveCost:   'recallCost',
    forestValue:   'forestPower',
    mountainValue: 'mountainPower',
    oceanValue:    'oceanPower',
    effects:       (d, lang) => localize(d.mainEffect, lang) ?? '',
    discardEffects: (d, lang) => {
      const e = d.echoEffect;
      if (!e || (Array.isArray(e) && e.length === 0)) return null;
      return Array.isArray(e)
        ? e.map(s => localize(s, lang)).filter(Boolean).join('\n')
        : (localize(e, lang) || null);
    },
    cardId: d => {
      const parts     = (d.reference ?? '').split('_');
      const collector = parts.length >= 6 ? parts.slice(3).join('-') : (d.reference ?? '');
      const setCode   = d.set?.code ?? '';
      return setCode ? `${setCode}-${collector}` : collector;
    },
    cardType: (d, lang) => {
      const type = localize(d.cardType?.name, lang) ?? '';
      const subs = (d.cardSubTypes || []).map(s => localize(s.name, lang) ?? '').filter(Boolean).join(', ');
      return subs ? `${type} - ${subs}` : type;
    },
    artistName: d => d.artists?.[0]?.name ?? null,
  },
};

export function apiToCardJson(apiJson, mapping) {
  const fallback = mapping.langFallback || 'en';
  const lang = mapping.lang != null
    ? (resolve(mapping.lang, apiJson) || fallback)
    : fallback;

  const sel  = resolve(mapping.selection, apiJson, lang) || {};
  const type = sel.type || '';
  const internalType = type.includes('::')
    ? type
    : sel.collection && sel.typeName
      ? `${sel.collection}::${sel.typeName}`
      : type;

  const opts = store.opts;
  let bgUrl;
  if (opts.useApiBackground === false && opts.backgroundUrl) {
    const rarityRef   = apiJson.cardRarity?.reference ?? apiJson.rarity?.reference ?? '';
    const rarityShort = { COMMON: 'C', RARE: 'R', UNIQUE: 'U', EXALTED: 'E' }[rarityRef] ?? rarityRef;
    const factionCode = apiJson.faction?.code ?? '';
    let cardId = apiJson.reference ?? '';
    if (opts.backgroundUrlIdTransform) {
      for (const [pat, rep] of opts.backgroundUrlIdTransform) {
        cardId = cardId.replace(new RegExp(pat), rep);
      }
    }
    let rawUrl = opts.backgroundUrl
      .replace('{ref}',     apiJson.reference ?? '')
      .replace('{locale}',  lang)
      .replace('{faction}', factionCode)
      .replace('{rarity}',  rarityShort)
      .replace('{id}',      cardId)
      .replace('{set}',     apiJson.set?.reference ?? '');
    const proxy = opts._resolvedProxy;
    bgUrl = (proxy && rawUrl) ? proxy + '?img=' + encodeURIComponent(rawUrl) : rawUrl;
  } else {
    bgUrl = mapping.background != null
      ? resolve(mapping.background, apiJson, lang)
      : null;
  }

  const setCode = mapping.setCode != null
    ? (resolve(mapping.setCode, apiJson, lang) ?? null)
    : null;

  const bgTransform = mapping.bgTransform
    ? resolve(mapping.bgTransform, apiJson, lang)
    : { zoom: 100, x: 50, y: 50 };

  const elements      = store.cfg?.elements || [];
  const globalDefaults = {};

  for (const [elementId, ref] of Object.entries(mapping.values || {})) {
    const raw = resolve(ref, apiJson, lang);
    const el  = elements.find(e => e.id === elementId);
    if (raw == null) {
      globalDefaults[elementId] = { visible: false };
    } else {
      const val    = String(raw);
      const isRich = el?.inputType === 'richtext';
      globalDefaults[elementId] = el?.inputType === 'qr'
        ? { url: val }
        : { value: isRich ? applyTransforms(applyTokens(val, store.cfg, true)) : applyTokens(val) };
    }
  }

  if (BIOME_VARIANT_AUTO) {
    const nums = {};
    for (const [elId, path] of Object.entries(BIOME_VARIANT_AUTO)) {
      if (!path) continue;
      const raw = resolve(path, apiJson, lang);
      nums[elId] = raw != null ? Number(raw) : null;
    }
    const defined = Object.values(nums).filter(v => v != null);
    const maxVal  = defined.length ? Math.max(...defined) : null;
    for (const [elId, val] of Object.entries(nums)) {
      if (val == null) continue;
      const variant = val === 0 ? 'zero' : (val === maxVal ? 'best' : 'normal');
      if (globalDefaults[elId]) {
        globalDefaults[elId].bgVariant = variant;
      } else {
        globalDefaults[elId] = { bgVariant: variant };
      }
    }
  }

  if (API_QR_CODE) {
    const qrEntry = globalDefaults.qrCode || {};
    if (API_QR_CODE.url != null) {
      const vars = {};
      for (const [k, path] of Object.entries(API_QR_CODE.vars || {})) {
        const v = resolve(path, apiJson, lang);
        vars[k] = v != null ? String(v) : '';
      }
      qrEntry.url = API_QR_CODE.url.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    }
    if (API_QR_CODE.visible != null) qrEntry.visible = Boolean(API_QR_CODE.visible);
    globalDefaults.qrCode = qrEntry;
  }

  const cardJson = {
    _type: 'card-config',
    _ref:  apiJson.reference || '',
    _selection: {
      faction:    sel.faction    || '',
      collection: sel.collection || 'official',
      type:       internalType,
      setCode,
      bgTransform,
    },
    globalDefaults,
  };

  if (bgUrl) cardJson._urls = { bg: bgUrl };

  return cardJson;
}
