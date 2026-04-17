import { ref, watch, onMounted, onBeforeUnmount, isRef } from 'vue';
import { createAlteredCard } from '../core/index.js';

/**
 * Vue composable for rendering an Altered TCG card.
 *
 * @param {Ref<HTMLElement|null>} containerRef  A template ref pointing to the container element.
 * @param {object|Ref<object>}   propsOrRef     Reactive or plain options object.
 *
 * Options:
 *   cardRef       {string}  Card reference (e.g. "ALT_CORE_B_AX_01_C_1")
 *   locale        {string}  Language code ("en" | "fr" | "es" | "de" | "it"). Default: "en"
 *   collection    {string}  Forge collection key. Default: "official"
 *   cardJson      {object}  Forge card JSON (alternative to cardRef)
 *   apiJson       {object}  Raw API JSON (alternative to cardRef)
 *   apiMapping    {object}  Custom field mapping for apiJson mode
 *   configBaseUrl {string}  CDN base URL for forge assets
 *   cardApiUrl    {string}  Card API URL template
 *   proxyUrl      {string|false} CORS proxy URL
 *
 * Returns:
 *   isLoading     {Ref<boolean>}
 *   error         {Ref<string|null>}
 *   canvas        {Ref<HTMLCanvasElement|null>}
 *   redraw        {function}  Force a re-render
 *   renderer      {object}    The underlying createAlteredCard instance
 *
 * @example
 * const containerRef = ref(null);
 * const { isLoading, error } = useAlteredCard(containerRef, {
 *   cardRef: 'ALT_CORE_B_AX_01_C_1',
 *   locale: 'en',
 * });
 */
export function useAlteredCard(containerRef, propsOrRef = {}) {
  const isLoading = ref(false);
  const error = ref(null);
  const canvas = ref(null);

  let renderer = null;

  function getProps() {
    return isRef(propsOrRef) ? propsOrRef.value : propsOrRef;
  }

  function initRenderer() {
    const el = isRef(containerRef) ? containerRef.value : containerRef;
    if (!el) return;

    if (renderer) renderer.destroy();

    const {
      configBaseUrl,
      cardApiUrl,
      proxyUrl,
    } = getProps();

    renderer = createAlteredCard(el, {
      ...(configBaseUrl ? { configBaseUrl } : {}),
      ...(cardApiUrl    ? { cardApiUrl }    : {}),
      proxyUrl: proxyUrl ?? false,
    });

    renderer.on('stateChange', ({ loading, error: err }) => {
      isLoading.value = loading;
      error.value = err ?? null;
    });

    renderer.on('load', ({ canvas: c }) => {
      canvas.value = c ?? null;
    });

    render();
  }

  function render() {
    if (!renderer) return;
    const props = getProps();

    if (props.cardRef) {
      renderer.renderFromRef(props.cardRef, props.locale ?? 'en', props.collection ?? 'official');
    } else if (props.apiJson) {
      renderer.renderFromApiJson(props.apiJson, props.apiMapping);
    } else if (props.cardJson) {
      renderer.renderFromCardJson(props.cardJson);
    }
  }

  onMounted(() => {
    initRenderer();
  });

  onBeforeUnmount(() => {
    renderer?.destroy();
    renderer = null;
  });

  // Re-render when props change
  const propsToWatch = isRef(propsOrRef) ? propsOrRef : () => getProps();
  watch(
    propsToWatch,
    (newVal, oldVal) => {
      if (!renderer) return;
      const prev = oldVal ?? {};
      const next = newVal ?? {};
      if (
        prev.configBaseUrl !== next.configBaseUrl ||
        prev.cardApiUrl    !== next.cardApiUrl    ||
        prev.proxyUrl      !== next.proxyUrl
      ) {
        initRenderer();
        return;
      }
      render();
    },
    { deep: true },
  );

  return {
    isLoading,
    error,
    canvas,
    redraw: () => renderer?.redraw(),
    get renderer() { return renderer; },
  };
}
