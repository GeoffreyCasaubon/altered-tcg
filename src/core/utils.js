/** Recursively deep-merge source into target (returns new object). */
export function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const [k, v] of Object.entries(source)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) &&
        out[k] !== null && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Find all patterns in cardsData matching ref, merge least→most specific,
 * return combined override or null.
 */
export function matchCardsData(ref, cardsData) {
  if (!cardsData || !ref) return null;
  const matches = [];
  for (const [pattern, data] of Object.entries(cardsData)) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (ref.startsWith(prefix)) matches.push({ specificity: prefix.length, data });
    } else if (pattern === ref) {
      matches.push({ specificity: Infinity, data });
    }
  }
  if (!matches.length) return null;
  matches.sort((a, b) => a.specificity - b.specificity);
  let merged = {};
  for (const { data } of matches) merged = deepMerge(merged, data);
  return merged;
}

/** Resolve a relative path against a base URL. Already-absolute paths pass through. */
export function resolveUrl(path, base) {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('http://') ||
      path.startsWith('https://') || path.startsWith('//') || path.startsWith('/')) {
    return path;
  }
  const b = base ? base.replace(/\/?$/, '/') : '';
  return b + path;
}

/** Normalize any CSS color string to #rrggbb (or null if invalid/transparent). */
export function normalizeColor(raw) {
  if (!raw) return null;
  raw = raw.trim();
  if (!raw) return null;
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/i.test(raw)) return '#' + raw[1]+raw[1]+raw[2]+raw[2]+raw[3]+raw[3];
  const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  try {
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = 1;
    const c = tmp.getContext('2d');
    c.fillStyle = raw; c.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
    if (a === 0) return null;
    return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

/**
 * Resolve a field that is a plain value (locale API) or localized object { fr, en }.
 * Returns the localized string or the value as-is.
 */
export function localize(v, lang) {
  if (v == null) return null;
  if (typeof v === 'object') return v[lang] ?? v.en ?? null;
  return v;
}

/** True if the codepoint falls in the Private Use Area (alteredicons font). */
export function isPUA(cp) {
  return cp >= 0xE000 && cp <= 0xF8FF;
}

/** True if the codepoint is a circled/enclosed number character. */
export function isCircledNumber(cp) {
  return (cp >= 0x2460 && cp <= 0x249B) ||
         (cp >= 0x24EA && cp <= 0x24FF) ||
         (cp >= 0x2776 && cp <= 0x2793);
}
