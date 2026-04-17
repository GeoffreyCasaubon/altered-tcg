import { ref, watch, onMounted, onBeforeUnmount, isRef, type Ref } from 'vue';
import { createAlteredCard } from '../core/index';
import type { AlteredCardController } from '../core/index';
import type { MappingDef, CardJson } from '../core/types';

interface AlteredCardProps {
  cardRef?: string;
  locale?: string;
  collection?: string;
  cardJson?: CardJson;
  apiJson?: Record<string, unknown>;
  apiMapping?: MappingDef;
  configBaseUrl?: string;
  cardApiUrl?: string;
  proxyUrl?: string | false;
}

export function useAlteredCard(
  containerRef: Ref<HTMLElement | null> | HTMLElement | null,
  propsOrRef: Ref<AlteredCardProps> | AlteredCardProps = {},
) {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const canvas = ref<HTMLCanvasElement | null>(null);

  let renderer: AlteredCardController | null = null;

  function getProps(): AlteredCardProps {
    return isRef(propsOrRef) ? propsOrRef.value : propsOrRef;
  }

  function initRenderer(): void {
    const el = isRef(containerRef) ? containerRef.value : containerRef;
    if (!el) return;

    renderer?.destroy();

    const { configBaseUrl, cardApiUrl, proxyUrl } = getProps();

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

  function render(): void {
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

  onMounted(() => { initRenderer(); });

  onBeforeUnmount(() => {
    renderer?.destroy();
    renderer = null;
  });

  const propsToWatch = isRef(propsOrRef) ? propsOrRef : () => getProps();
  watch(
    propsToWatch,
    (newVal, oldVal) => {
      if (!renderer) return;
      const prev = (oldVal ?? {}) as AlteredCardProps;
      const next = (newVal ?? {}) as AlteredCardProps;
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
