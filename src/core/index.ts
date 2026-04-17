import { AlteredRender } from './renderer';
import type { MountResult, ResourceOptions } from './renderer';
import type { CardJson, MappingDef } from './types';

const DEFAULT_CARD_API_URL =
  'https://altered-core-cards-api.toxicity.be/api/cards/reference/{ref}?locale={locale}';

interface CardRendererOptions extends Partial<ResourceOptions> {
  cardApiUrl?: string;
  proxyUrl?: string | false;
}

type EventMap = {
  load: MountResult;
  error: Error;
  stateChange: { loading: boolean; error: string | null };
};

export interface AlteredCardController {
  renderFromRef(ref: string, locale?: string, collection?: string): Promise<void>;
  renderFromApiJson(apiJson: Record<string, unknown>, mapping?: MappingDef): Promise<void>;
  renderFromCardJson(cardJson: CardJson): Promise<void>;
  redraw(): void;
  destroy(): void;
  on<E extends keyof EventMap>(event: E, fn: (data: EventMap[E]) => void): () => void;
  off<E extends keyof EventMap>(event: E, fn: (data: EventMap[E]) => void): void;
  getMountResult(): MountResult | null;
}

export function createAlteredCard(
  container: HTMLElement,
  options: CardRendererOptions = {},
): AlteredCardController {
  let mountResult: MountResult | null = null;
  let destroyed = false;

  const opts: CardRendererOptions = {
    configBaseUrl: 'https://cdn.alteredcore.org/forge/',
    cardApiUrl: DEFAULT_CARD_API_URL,
    proxyUrl: false,
    ...options,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listeners: Record<string, ((data: any) => void)[]> = {
    load: [], error: [], stateChange: [],
  };

  function on<E extends keyof EventMap>(event: E, fn: (data: EventMap[E]) => void): () => void {
    listeners[event].push(fn);
    return () => off(event, fn);
  }

  function off<E extends keyof EventMap>(event: E, fn: (data: EventMap[E]) => void): void {
    listeners[event] = listeners[event].filter(f => f !== fn);
  }

  function emit<E extends keyof EventMap>(event: E, data: EventMap[E]): void {
    (listeners[event] ?? []).forEach(fn => fn(data));
  }

  async function _fetchCard(ref: string, locale: string): Promise<Record<string, unknown>> {
    const { cardApiUrl = DEFAULT_CARD_API_URL, proxyUrl } = opts;
    const url = proxyUrl
      ? `${proxyUrl}?ref=${encodeURIComponent(ref)}&locale=${locale}&api=${encodeURIComponent(cardApiUrl)}`
      : cardApiUrl
          .replace('{ref}', encodeURIComponent(ref))
          .replace('{locale}', locale);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  async function _run(fn: () => Promise<MountResult>): Promise<void> {
    if (destroyed) return;
    emit('stateChange', { loading: true, error: null });
    try {
      await AlteredRender.init(opts);
      mountResult = await fn();
      emit('load', mountResult);
      emit('stateChange', { loading: false, error: null });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      emit('error', err);
      emit('stateChange', { loading: false, error: err.message });
    }
  }

  async function renderFromRef(ref: string, locale = 'en', collection = 'official'): Promise<void> {
    return _run(async () => {
      const apiJson = await _fetchCard(ref, locale);
      apiJson.forge = { collection, lang: locale };
      return AlteredRender.mountFromApi(container, apiJson, undefined, opts);
    });
  }

  async function renderFromApiJson(apiJson: Record<string, unknown>, mapping?: MappingDef): Promise<void> {
    return _run(() => AlteredRender.mountFromApi(container, apiJson, mapping, opts));
  }

  async function renderFromCardJson(cardJson: CardJson): Promise<void> {
    return _run(() => AlteredRender.mount(container, cardJson, opts));
  }

  function redraw(): void {
    mountResult?.redraw();
  }

  function destroy(): void {
    destroyed = true;
    if (container) container.innerHTML = '';
    (Object.keys(listeners) as (keyof EventMap)[]).forEach(k => { listeners[k] = []; });
    mountResult = null;
  }

  function getMountResult(): MountResult | null {
    return mountResult;
  }

  return { renderFromRef, renderFromApiJson, renderFromCardJson, redraw, destroy, on, off, getMountResult };
}

export { AlteredRender };
