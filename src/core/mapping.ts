import {
  API_TEXT_TOKENS, API_TEXT_TRANSFORMS, BIOME_VARIANT_AUTO, API_QR_CODE,
  DEFAULT_COLLECTION, FACTION_COLLECTION, RARITY_ASSET_INDEX, FRAME_AUTO_SELECT,
} from './constants';
import { isPUA, isCircledNumber, localize } from './utils';
import { store } from './loader';
import type { MappingDef } from './types';

type ResolveRef = string | ((data: unknown, lang: string) => unknown) | unknown;

export function resolve(ref: ResolveRef, data: unknown, lang?: string): unknown {
  if (typeof ref === 'function') return ref(data, lang);
  if (typeof ref === 'string') {
    const path = lang ? ref.replace(/\{lang\}/g, lang) : ref;
    let cur: unknown = data;
    for (const key of path.split('.')) {
      if (cur == null) return null;
      cur = (cur as Record<string, unknown>)[key];
    }
    return cur ?? null;
  }
  return ref ?? null;
}

export function applyTokens(text: string | null | undefined, cfg: Record<string, unknown> | null = null, isRich = false): string {
  if (!text) return text ?? '';
  let out = text;
  for (const [token, val] of Object.entries(API_TEXT_TOKENS)) {
    const char = typeof val === 'string' ? val : (val as { char: string }).char;
    let replacement = char;
    if (isRich && char) {
      const cp = char.codePointAt(0)!;
      if (isPUA(cp)) {
        const key      = cfg?.alteredIconsTokens
          ? Object.entries(cfg.alteredIconsTokens as Record<string, string>).find(([, h]) => parseInt(h, 16) === cp)?.[0]
          : null;
        const perScale = (key && !key.startsWith('_') && (cfg?.alteredIconsSizes as Record<string, number> | undefined)?.[key]) ?? 1.0;
        const scale    = ((cfg?.alteredIconsScale as number) ?? 1.0) * (perScale as number);
        replacement = `<span style="font-size:${scale}em">${char}</span>`;
      } else if (isCircledNumber(cp)) {
        const scale = (cfg?.circledNumberScale as number) ?? 1.0;
        replacement = `<span style="font-size:${scale}em">${char}</span>`;
      }
    }
    out = out.split(token).join(replacement);
  }
  return out;
}

export function applyTransforms(text: string | null | undefined): string {
  if (!text) return text ?? '';
  let out = text;
  for (const { pattern, replacement } of API_TEXT_TRANSFORMS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export const API_MAPPING: MappingDef & {
  selection: (d: Record<string, unknown>, lang: string) => { faction: string; type: string };
  background: (d: Record<string, unknown>, lang: string) => unknown;
  setCode: string;
  bgTransform: (d: Record<string, unknown>) => { zoom: number; x: number; y: number; flipX: boolean };
  values: Record<string, string | ((d: Record<string, unknown>, lang: string) => string | null)>;
} = {
  lang:         'forge.lang',
  langFallback: 'en',

  selection: (d: Record<string, unknown>, lang: string) => {
    const faction    = (d.faction as Record<string, string> | undefined)?.name ?? '';
    const forgeCol   = (d.forge as Record<string, unknown> | undefined)?.collection as string | undefined;
    const collection = (forgeCol && forgeCol !== DEFAULT_COLLECTION)
      ? forgeCol
      : ((FACTION_COLLECTION as Record<string, string>)[faction] || DEFAULT_COLLECTION);
    let frameType: string | null = (d.forge as Record<string, unknown> | undefined)?.frameType as string ?? null;

    if (!frameType) {
      const rarity = (d.cardRarity as Record<string, string> | undefined)?.reference ?? (d.rarity as Record<string, string> | undefined)?.reference ?? '';
      const rules  = (FRAME_AUTO_SELECT as Record<string, { frameType: string; test: (d: unknown, l: string) => boolean }[]>)[rarity] || [];
      const match  = rules.find(r => r.test(d, lang));
      frameType    = match?.frameType ?? null;
    }

    return {
      faction,
      type: frameType ? `${collection}::${frameType}` : '',
    };
  },

  background: (d: Record<string, unknown>, lang: string) => {
    if (Array.isArray(d.assets) && d.assets.length) {
      const rarity = (d.cardRarity as Record<string, string> | undefined)?.reference ?? (d.cardGroup as Record<string, Record<string, string>> | undefined)?.rarity?.reference ?? '';
      const idx    = (RARITY_ASSET_INDEX as Record<string, number>)[rarity] ?? 0;
      return d.assets[idx] ?? d.assets[0] ?? null;
    }
    const ip = d.imagePath;
    return (ip && typeof ip === 'object') ? ((ip as Record<string, string>)[lang] ?? (ip as Record<string, string>).en ?? null) : (ip ?? null);
  },

  setCode: 'set.reference',

  bgTransform: (d: Record<string, unknown>) => ({
    zoom:  (d.forge as Record<string, Record<string, number>> | undefined)?.bgTransform?.zoom  ?? 130,
    x:     (d.forge as Record<string, Record<string, number>> | undefined)?.bgTransform?.x     ?? 50,
    y:     (d.forge as Record<string, Record<string, number>> | undefined)?.bgTransform?.y     ?? 50,
    flipX: (d.forge as Record<string, Record<string, boolean>> | undefined)?.bgTransform?.flipX ?? false,
  }),

  values: {
    cardName:      (d: Record<string, unknown>, lang: string) => localize(d.name as string | Record<string, string>, lang) ?? '',
    handCost:      'mainCost',
    reserveCost:   'recallCost',
    forestValue:   'forestPower',
    mountainValue: 'mountainPower',
    oceanValue:    'oceanPower',
    effects:       (d: Record<string, unknown>, lang: string) => localize(d.mainEffect as string | Record<string, string>, lang) ?? '',
    discardEffects: (d: Record<string, unknown>, lang: string) => {
      const e = d.echoEffect;
      if (!e || (Array.isArray(e) && e.length === 0)) return null;
      return Array.isArray(e)
        ? e.map(s => localize(s as string | Record<string, string>, lang)).filter(Boolean).join('\n')
        : (localize(e as string | Record<string, string>, lang) || null);
    },
    cardId: (d: Record<string, unknown>) => {
      const parts     = ((d.reference as string) ?? '').split('_');
      const collector = parts.length >= 6 ? parts.slice(3).join('-') : ((d.reference as string) ?? '');
      const setCode   = (d.set as Record<string, string> | undefined)?.code ?? '';
      return setCode ? `${setCode}-${collector}` : collector;
    },
    cardType: (d: Record<string, unknown>, lang: string) => {
      const type = localize((d.cardType as Record<string, unknown> | undefined)?.name as string | Record<string, string>, lang) ?? '';
      const subs = ((d.cardSubTypes as Array<{ name: string | Record<string, string> }>) || []).map(s => localize(s.name, lang) ?? '').filter(Boolean).join(', ');
      return subs ? `${type} - ${subs}` : type;
    },
    artistName: (d: Record<string, unknown>) => (d.artists as Array<{ name: string }> | undefined)?.[0]?.name ?? null,
  },
};

export function apiToCardJson(apiJson: Record<string, unknown>, mapping: MappingDef): Record<string, unknown> {
  const fallback = mapping.langFallback || 'en';
  const lang = mapping.lang != null
    ? ((resolve(mapping.lang, apiJson) as string) || fallback)
    : fallback;

  const sel  = (resolve(mapping.selection, apiJson, lang) as Record<string, string>) || {};
  const type = sel.type || '';
  const internalType = type.includes('::')
    ? type
    : sel.collection && sel.typeName
      ? `${sel.collection}::${sel.typeName}`
      : type;

  const opts = store.opts;
  let bgUrl: string | null | undefined;
  if (opts.useApiBackground === false && opts.backgroundUrl) {
    const rarityRef   = (apiJson.cardRarity as Record<string, string> | undefined)?.reference ?? (apiJson.rarity as Record<string, string> | undefined)?.reference ?? '';
    const rarityShort = ({ COMMON: 'C', RARE: 'R', UNIQUE: 'U', EXALTED: 'E' } as Record<string, string>)[rarityRef] ?? rarityRef;
    const factionCode = (apiJson.faction as Record<string, string> | undefined)?.code ?? '';
    let cardId = (apiJson.reference as string) ?? '';
    if (opts.backgroundUrlIdTransform) {
      for (const [pat, rep] of opts.backgroundUrlIdTransform) {
        cardId = cardId.replace(new RegExp(pat), rep);
      }
    }
    let rawUrl = opts.backgroundUrl
      .replace('{ref}',     (apiJson.reference as string) ?? '')
      .replace('{locale}',  lang)
      .replace('{faction}', factionCode)
      .replace('{rarity}',  rarityShort)
      .replace('{id}',      cardId)
      .replace('{set}',     (apiJson.set as Record<string, string> | undefined)?.reference ?? '');
    const proxy = opts._resolvedProxy;
    bgUrl = (proxy && rawUrl) ? proxy + '?img=' + encodeURIComponent(rawUrl) : rawUrl;
  } else {
    bgUrl = mapping.background != null
      ? resolve(mapping.background, apiJson, lang) as string | null
      : null;
  }

  const setCode = mapping.setCode != null
    ? ((resolve(mapping.setCode, apiJson, lang) as string) ?? null)
    : null;

  const bgTransform = mapping.bgTransform
    ? resolve(mapping.bgTransform, apiJson, lang)
    : { zoom: 100, x: 50, y: 50 };

  const elements      = store.cfg?.elements || [];
  const globalDefaults: Record<string, Record<string, unknown>> = {};

  for (const [elementId, ref] of Object.entries(mapping.values || {})) {
    const raw = resolve(ref as ResolveRef, apiJson, lang);
    const el  = elements.find(e => e.id === elementId);
    if (raw == null) {
      globalDefaults[elementId] = { visible: false };
    } else {
      const val    = String(raw);
      const isRich = el?.inputType === 'richtext';
      globalDefaults[elementId] = el?.inputType === 'qr'
        ? { url: val }
        : { value: isRich ? applyTransforms(applyTokens(val, store.cfg as unknown as Record<string, unknown>, true)) : applyTokens(val) };
    }
  }

  if (BIOME_VARIANT_AUTO) {
    const nums: Record<string, number | null> = {};
    for (const [elId, path] of Object.entries(BIOME_VARIANT_AUTO)) {
      if (!path) continue;
      const raw = resolve(path, apiJson, lang);
      nums[elId] = raw != null ? Number(raw) : null;
    }
    const defined = Object.values(nums).filter((v): v is number => v != null);
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
    const qrEntry: Record<string, unknown> = globalDefaults.qrCode || {};
    if (API_QR_CODE.url != null) {
      const vars: Record<string, string> = {};
      for (const [k, path] of Object.entries(API_QR_CODE.vars || {})) {
        const v = resolve(path as ResolveRef, apiJson, lang);
        vars[k] = v != null ? String(v) : '';
      }
      qrEntry.url = API_QR_CODE.url.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
    }
    if (API_QR_CODE.visible != null) qrEntry.visible = Boolean(API_QR_CODE.visible);
    globalDefaults.qrCode = qrEntry;
  }

  const cardJson: Record<string, unknown> = {
    _type: 'card-config',
    _ref:  (apiJson.reference as string) || '',
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
