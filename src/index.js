export { AlteredCard } from './components/index.js';
export { useAlteredCard } from './composables/useAlteredCard.js';
export { createAlteredCard, AlteredRender } from './core/index.js';

import AlteredCard from './components/AlteredCard.vue';

/** Vue plugin — registers <AlteredCard> globally. */
export const AlteredVuePlugin = {
  install(app) {
    app.component('AlteredCard', AlteredCard);
  },
};

export default AlteredVuePlugin;
