import type { ResourceOptions, PlaceholderConfig } from './types';

// ── Card canvas dimensions ──────────────────────────────────────
export const CARD_W = 744;
export const CARD_H = 1039;

// ── Default resource locations ──────────────────────────────────
export const RESOURCES: ResourceOptions = {
  configBaseUrl:             'https://cdn.alteredcore.org/forge/',
  configIndex:               'config/index.json',
  alteredIconsCss:           'assets/fonts/alteredicons.css',
  qrcodeLib:                 'assets/vendor/qrcodejs/qrcode.min.js',
  cardApiUrl:                'https://altered-core-cards-api.toxicity.be/api/cards/reference/{ref}?locale={locale}',
  proxyUrl:                  false,
  useApiBackground:          false,
  backgroundUrl:             'https://cdn.alteredcore.org/cards/assets/{set}/{id}.webp',
  backgroundUrlIdTransform:  [['_U_\\d+$', '_U']],
  embeddedConfig:            null,
};

// ── Collection / faction defaults ───────────────────────────────
export const DEFAULT_COLLECTION  = 'official';
export const FACTION_COLLECTION  = {};
export const RARITY_ASSET_INDEX  = { COMMON: 0, RARE: 1, UNIQUE: 2 };

// ── Placeholder / error display ─────────────────────────────────
export const LOADING: PlaceholderConfig = { text: 'Loading…\n{ref}', x: 50, y: 70, color: 'rgb(255,255,255)', fontSize: 5.5 };
export const ERROR: PlaceholderConfig   = { text: 'Error\n{msg}\n{ref}', x: 50, y: 50, color: '#e06060',     fontSize: 5.5 };

// ── Biome variant auto-detection ─────────────────────────────────
// Maps biome element IDs to the API field holding the numeric value.
// 0 → "zero", max → "best", otherwise → "normal".
export const BIOME_VARIANT_AUTO = {
  forestValue:   'forestPower',
  mountainValue: 'mountainPower',
  oceanValue:    'oceanPower',
};

// ── QR code config ───────────────────────────────────────────────
export const API_QR_CODE = {
  visible: true,
  url:     'https://altered.gg/{locale}/cards/{reference}',
  vars: {
    reference: 'reference',
    locale:    (_d: unknown, lang: string) => ({ en: 'en-us', fr: 'fr-fr', es: 'es-es', it: 'it-it', de: 'de-de' }[lang] ?? 'en-us'),
  },
};

// ── Icon token → PUA character map ──────────────────────────────
export const API_TEXT_TOKENS = {
  '{R}': '\ue024', '{J}': '\ue026', '{H}': '\ue023', '{T}': '\ue027',
  '{D}': '\ue029', '{O}': '\ue02d', '{M}': '\ue025', '{V}': '\ue037', '{I}': '\ue02f',
  '{r}': '\ue024', '{j}': '\ue026', '{h}': '\ue023', '{t}': '\ue027', '{d}': '\ue029',
  '{0}': '\u24ea', '{1}': '\u2776', '{2}': '\u2777', '{3}': '\u2778', '{4}': '\u2779',
  '{5}': '\u277a', '{6}': '\u277b', '{7}': '\u277c', '{8}': '\u277d', '{9}': '\u277e',
};

// ── Richtext transformations applied to API text ─────────────────
export const API_TEXT_TRANSFORMS = [
  { pattern: /#(.*?)#/g,       replacement: '<span style="color:#C37424">$1</span>' },
  { pattern: /\{X\}/g,         replacement: '<strong>X</strong>' },
  { pattern: /\(([^)]+)\)/g,   replacement: '(<em>$1</em>)' },
  { pattern: /\[\[(.*?)\]\]/g, replacement: '<strong><u>$1</u></strong>' },
  { pattern: /—/g,             replacement: '-' },
  { pattern: /  /g,            replacement: '\n' },
  { pattern: /\[\]/g,          replacement: ' ' },
  { pattern: /\[(.*?)\]/g,     replacement: '<strong>$1</strong>' },
];

// ── Frame auto-selection helpers ─────────────────────────────────
// Private — used only inside FRAME_AUTO_SELECT below.
const loc = (v: unknown, lang: string): string | null =>
  v == null ? null
    : typeof v === 'object'
      ? ((v as Record<string, string | null>)[lang] ?? (v as Record<string, string | null>).en ?? null)
      : (v as string);

function effectLength(data: Record<string, unknown>, lang: string): number {
  const raw = loc(data.mainEffect, lang) ?? '';
  return raw
    .replace(/\{[A-Za-z0-9]\}/g, 'X')
    .replace(/\[\]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim()
    .length;
}

const hasEcho    = (d: Record<string, unknown>): boolean => { const e = d.echoEffect; return Array.isArray(e) ? e.length > 0 : !!e; };
const typeRef    = (d: Record<string, unknown>): string => (d.cardType as { reference?: string } | null)?.reference ?? '';
const hasSubtype = (d: Record<string, unknown>, ref: string): boolean => ((d.cardSubTypes as { reference: string }[]) ?? []).some(s => s.reference === ref);

type FrameTestFn = (d: Record<string, unknown>, lang: string) => boolean;

// ── Frame auto-selection table ────────────────────────────────────
// Evaluated in order; first matching rule wins.
export const FRAME_AUTO_SELECT: Record<string, { frameType: string; test: FrameTestFn }[]> = {
  COMMON: [
    { frameType: 'tok_c_1',     test: d     => typeRef(d) === 'TOKEN' },
    { frameType: 'hero_c_1',    test: d     => typeRef(d) === 'HERO'  },
    { frameType: 'expperm_c_1', test: (d,l) => typeRef(d) === 'PERMANENT' && hasSubtype(d, 'EXPEDITION') &&  hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'expperm_c_2', test: (d,l) => typeRef(d) === 'PERMANENT' && hasSubtype(d, 'EXPEDITION') &&  hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'expperm_c_3', test: (d,l) => typeRef(d) === 'PERMANENT' && hasSubtype(d, 'EXPEDITION') && !hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'expperm_c_4', test: (d,l) => typeRef(d) === 'PERMANENT' && hasSubtype(d, 'EXPEDITION') && !hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'perm_c_1',    test: (d,l) => typeRef(d) === 'PERMANENT' &&  hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'perm_c_2',    test: (d,l) => typeRef(d) === 'PERMANENT' &&  hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'perm_c_3',    test: (d,l) => typeRef(d) === 'PERMANENT' && !hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'perm_c_4',    test: (d,l) => typeRef(d) === 'PERMANENT' && !hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'spell_c_1',   test: (d,l) => typeRef(d) === 'SPELL' &&  hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'spell_c_2',   test: (d,l) => typeRef(d) === 'SPELL' &&  hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'spell_c_3',   test: (d,l) => typeRef(d) === 'SPELL' && !hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'spell_c_4',   test: (d,l) => typeRef(d) === 'SPELL' && !hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'char_c_1',    test: (d,l) =>  hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'char_c_2',    test: (d,l) =>  hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'char_c_3',    test: (d,l) => !hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'char_c_4',    test: (d,l) => !hasEcho(d) && effectLength(d, l) >= 200 },
  ],
  RARE: [
    { frameType: 'expperm_r_1', test: (d,l) => typeRef(d) === 'PERMANENT' && hasSubtype(d, 'EXPEDITION') &&  hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'expperm_r_2', test: (d,l) => typeRef(d) === 'PERMANENT' && hasSubtype(d, 'EXPEDITION') &&  hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'expperm_r_3', test: (d,l) => typeRef(d) === 'PERMANENT' && hasSubtype(d, 'EXPEDITION') && !hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'expperm_r_4', test: (d,l) => typeRef(d) === 'PERMANENT' && hasSubtype(d, 'EXPEDITION') && !hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'perm_r_1',    test: (d,l) => typeRef(d) === 'PERMANENT' &&  hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'perm_r_2',    test: (d,l) => typeRef(d) === 'PERMANENT' &&  hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'perm_r_3',    test: (d,l) => typeRef(d) === 'PERMANENT' && !hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'perm_r_4',    test: (d,l) => typeRef(d) === 'PERMANENT' && !hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'spell_r_1',   test: (d,l) => typeRef(d) === 'SPELL' &&  hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'spell_r_2',   test: (d,l) => typeRef(d) === 'SPELL' &&  hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'spell_r_3',   test: (d,l) => typeRef(d) === 'SPELL' && !hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'spell_r_4',   test: (d,l) => typeRef(d) === 'SPELL' && !hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'char_r_1',    test: (d,l) =>  hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'char_r_2',    test: (d,l) =>  hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'char_r_3',    test: (d,l) => !hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'char_r_4',    test: (d,l) => !hasEcho(d) && effectLength(d, l) >= 200 },
  ],
  EXALTED: [
    { frameType: 'char_e_1', test: () => true },
  ],
  UNIQUE: [
    { frameType: 'char_u_1', test: (d,l) =>  hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'char_u_2', test: (d,l) =>  hasEcho(d) && effectLength(d, l) >= 200 },
    { frameType: 'char_u_3', test: (d,l) => !hasEcho(d) && effectLength(d, l) <  200 },
    { frameType: 'char_u_4', test: (d,l) => !hasEcho(d) && effectLength(d, l) >= 200 },
  ],
};
