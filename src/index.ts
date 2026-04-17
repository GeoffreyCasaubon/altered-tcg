export { AlteredCard } from './components/index';
export { useAlteredCard } from './composables/useAlteredCard';
export { createAlteredCard, AlteredRender } from './core/index';
export type { AlteredCardController } from './core/index';

import type { App } from 'vue';
import AlteredCard from './components/AlteredCard.vue';

export const AlteredVuePlugin = {
  install(app: App): void {
    app.component('AlteredCard', AlteredCard);
  },
};

export default AlteredVuePlugin;
