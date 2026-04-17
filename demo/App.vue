<template>
  <div style="padding: 2rem; font-family: sans-serif; background: #111; min-height: 100vh; color: #eee;">
    <h1>Altered Vue — Demo</h1>

    <section style="margin-bottom: 2rem;">
      <h2>Via <code>cardRef</code> prop</h2>
      <label>
        Card ref:
        <input v-model="cardRef" placeholder="ALT_COREKS_B_AX_01_C" style="margin-left: 8px; padding: 4px; width: 300px;" />
      </label>
      <label style="margin-left: 16px;">
        Locale:
        <select v-model="locale" style="margin-left: 4px;">
          <option>en</option>
          <option>fr</option>
          <option>es</option>
          <option>de</option>
          <option>it</option>
        </select>
      </label>
      <div style="margin-top: 1rem; display: flex; gap: 1rem; flex-wrap: wrap;">
        <AlteredCard
          :card-ref="cardRef"
          :locale="locale"
          :card-api-url="cardApiUrl"
          width="280px"
          @load="onLoad"
          @error="onError"
        >
          <template #loading>
            <div style="background: rgba(255,255,255,0.05); border-radius: 4px; height: 390px; display: flex; align-items: center; justify-content: center;">
              Loading…
            </div>
          </template>
        </AlteredCard>
      </div>
      <p v-if="loadMsg" style="color: #6f6;">{{ loadMsg }}</p>
      <p v-if="errorMsg" style="color: #f66;">{{ errorMsg }}</p>
    </section>

    <section>
      <h2>Via <code>useAlteredCard</code> composable</h2>
      <div ref="containerRef" style="width: 280px;" />
      <p v-if="isLoading" style="color: #aaa;">Loading…</p>
      <p v-if="composableError" style="color: #f66;">{{ composableError }}</p>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { AlteredCard } from '../src/components/index.js';
import { useAlteredCard } from '../src/composables/useAlteredCard.js';

const CARD_API_URL = '/altered-api/api/cards/reference/{ref}?locale={locale}';

const cardRef    = ref('ALT_COREKS_B_AX_01_C');
const locale     = ref('en');
const cardApiUrl = ref(CARD_API_URL);
const loadMsg    = ref('');
const errorMsg   = ref('');

function onLoad()     { loadMsg.value  = 'Card rendered successfully'; }
function onError(err) { errorMsg.value = err.message; }

// Composable usage demo
const containerRef = ref(null);
const { isLoading, error: composableError } = useAlteredCard(containerRef, {
  cardRef: 'ALT_COREKS_B_BR_01_C',
  locale: 'fr',
  cardApiUrl: CARD_API_URL,
});
</script>
