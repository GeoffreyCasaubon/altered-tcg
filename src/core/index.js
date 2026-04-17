import { AlteredRender } from './renderer.js';

const DEFAULT_CARD_API_URL =
  'https://altered-core-cards-api.toxicity.be/api/cards/reference/{ref}?locale={locale}';

/**
 * Framework-agnostic Altered card renderer.
 *
 * Usage:
 *   const card = createAlteredCard(containerEl, { configBaseUrl: '...' });
 *   await card.renderFromRef('ALT_CORE_B_AX_01_C_1', 'en');
 *   card.on('load', ({ canvas }) => console.log('rendered'));
 *   card.destroy();
 */
export function createAlteredCard(container, options = {}) {
  let mountResult = null;
  let destroyed = false;

  const opts = {
    configBaseUrl: 'https://cdn.alteredcore.org/forge/',
    cardApiUrl: DEFAULT_CARD_API_URL,
    proxyUrl: false,
    ...options,
  };

  const listeners = { load: [], error: [], stateChange: [] };

  function on(event, fn) {
    if (listeners[event]) listeners[event].push(fn);
    return () => off(event, fn);
  }

  function off(event, fn) {
    if (listeners[event]) listeners[event] = listeners[event].filter(f => f !== fn);
  }

  function emit(event, data) {
    (listeners[event] ?? []).forEach(fn => fn(data));
  }

  async function _fetchCard(ref, locale) {
    const { cardApiUrl, proxyUrl } = opts;
    let url;
    if (!proxyUrl) {
      url = cardApiUrl
        .replace('{ref}', encodeURIComponent(ref))
        .replace('{locale}', locale);
    } else {
      url = `${proxyUrl}?ref=${encodeURIComponent(ref)}&locale=${locale}&api=${encodeURIComponent(cardApiUrl)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function _run(fn) {
    if (destroyed) return;
    emit('stateChange', { loading: true, error: null });
    try {
      await AlteredRender.init(opts);
      mountResult = await fn();
      emit('load', mountResult);
      emit('stateChange', { loading: false, error: null });
    } catch (err) {
      emit('error', err);
      emit('stateChange', { loading: false, error: err.message });
    }
  }

  /**
   * Fetch a card by reference from the Altered API and render it.
   * @param {string} ref        Card reference, e.g. "ALT_CORE_B_AX_01_C_1"
   * @param {string} [locale]   Language code: "en" | "fr" | "es" | "de" | "it"
   * @param {string} [collection] Forge collection key (default: "official")
   */
  async function renderFromRef(ref, locale = 'en', collection = 'official') {
    return _run(async () => {
      const apiJson = await _fetchCard(ref, locale);
      apiJson.forge = { collection, lang: locale };
      return AlteredRender.mountFromApi(container, apiJson, undefined, opts);
    });
  }

  /**
   * Render a card from a raw Altered API JSON object (already fetched).
   * @param {object} apiJson      Raw JSON from the Altered API
   * @param {object} [mapping]    Optional custom field mapping
   */
  async function renderFromApiJson(apiJson, mapping) {
    return _run(() => AlteredRender.mountFromApi(container, apiJson, mapping, opts));
  }

  /**
   * Render a card from a forge card JSON (as exported from the Altered forge editor).
   * @param {object} cardJson   Forge card JSON
   */
  async function renderFromCardJson(cardJson) {
    return _run(() => AlteredRender.mount(container, cardJson, opts));
  }

  /** Re-render the current card (after manually patching mountResult.state). */
  function redraw() {
    mountResult?.redraw();
  }

  /** Remove the canvas and clean up listeners. */
  function destroy() {
    destroyed = true;
    if (container) container.innerHTML = '';
    Object.keys(listeners).forEach(k => { listeners[k] = []; });
    mountResult = null;
  }

  /** Return the current mount result ({ canvas, state, redraw }), or null. */
  function getMountResult() {
    return mountResult;
  }

  return {
    renderFromRef,
    renderFromApiJson,
    renderFromCardJson,
    redraw,
    destroy,
    on,
    off,
    getMountResult,
  };
}

export { AlteredRender };
