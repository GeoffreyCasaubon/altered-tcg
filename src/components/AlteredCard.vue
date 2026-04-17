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

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAlteredCard } from '../composables/useAlteredCard';
import type { CardJson, MappingDef } from '../core/types';
import type { MountResult } from '../core/renderer';

interface Props {
  cardRef?: string | null;
  locale?: string;
  collection?: string;
  cardJson?: CardJson | null;
  apiJson?: Record<string, unknown> | null;
  apiMapping?: MappingDef | null;
  configBaseUrl?: string | null;
  cardApiUrl?: string | null;
  proxyUrl?: string | false;
  width?: string;
}

const props = withDefaults(defineProps<Props>(), {
  cardRef: null,
  locale: 'en',
  collection: 'official',
  cardJson: null,
  apiJson: null,
  apiMapping: null,
  configBaseUrl: null,
  cardApiUrl: null,
  proxyUrl: false,
  width: '300px',
});

const emit = defineEmits<{
  load: [result: MountResult | null];
  error: [error: Error];
}>();

const containerRef = ref<HTMLElement | null>(null);

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
