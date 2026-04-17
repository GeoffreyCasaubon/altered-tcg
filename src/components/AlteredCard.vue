<template>
  <div
    ref="containerRef"
    class="altered-card"
    :class="{ 'altered-card--loading': isLoading, 'altered-card--error': !!error }"
    :style="containerStyle"
  >
    <slot v-if="isLoading" name="loading">
      <div class="altered-card__loading" />
    </slot>
    <slot v-if="error" name="error" :error="error">
      <div class="altered-card__error">{{ error }}</div>
    </slot>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAlteredCard } from '../composables/useAlteredCard.js';

const props = defineProps({
  /** Card reference, e.g. "ALT_CORE_B_AX_01_C_1" */
  cardRef: {
    type: String,
    default: null,
  },
  /** Language code: "en" | "fr" | "es" | "de" | "it" */
  locale: {
    type: String,
    default: 'en',
  },
  /** Forge collection key */
  collection: {
    type: String,
    default: 'official',
  },
  /** Forge card JSON (alternative to cardRef) */
  cardJson: {
    type: Object,
    default: null,
  },
  /** Raw Altered API JSON (alternative to cardRef) */
  apiJson: {
    type: Object,
    default: null,
  },
  /** Custom field mapping for apiJson mode */
  apiMapping: {
    type: Object,
    default: null,
  },
  /** CDN base URL for forge assets */
  configBaseUrl: {
    type: String,
    default: null,
  },
  /** Card API URL template */
  cardApiUrl: {
    type: String,
    default: null,
  },
  /** CORS proxy URL — false to disable */
  proxyUrl: {
    type: [String, Boolean],
    default: false,
  },
  /** Card display width (any CSS value, e.g. "300px", "100%") */
  width: {
    type: String,
    default: '300px',
  },
});

const emit = defineEmits({
  /** Emitted when the card renders successfully. Payload: { canvas, state, redraw } */
  load: null,
  /** Emitted when rendering fails. Payload: Error */
  error: null,
});

const containerRef = ref(null);

const containerStyle = computed(() => ({
  width: props.width,
  display: 'block',
}));

const propsRef = computed(() => ({
  cardRef:       props.cardRef,
  locale:        props.locale,
  collection:    props.collection,
  cardJson:      props.cardJson,
  apiJson:       props.apiJson,
  apiMapping:    props.apiMapping,
  configBaseUrl: props.configBaseUrl,
  cardApiUrl:    props.cardApiUrl,
  proxyUrl:      props.proxyUrl,
}));

const { isLoading, error, canvas, redraw, renderer } = useAlteredCard(containerRef, propsRef);

watch(canvas, (c) => {
  if (c) emit('load', renderer?.getMountResult());
});

watch(error, (e) => {
  if (e) emit('error', new Error(e));
});

defineExpose({ isLoading, error, canvas, redraw, renderer: computed(() => renderer) });
</script>

<style scoped>
.altered-card {
  position: relative;
  display: inline-block;
}

.altered-card :deep(canvas) {
  display: block;
  width: 100% !important;
  height: auto !important;
}

.altered-card__loading,
.altered-card__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.altered-card__loading {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.altered-card__error {
  background: rgba(180, 40, 40, 0.15);
  color: #e06060;
  font-size: 0.75rem;
  padding: 8px;
  text-align: center;
}
</style>
