# altered-tcg

Vue 3 component and framework-agnostic renderer for [Altered TCG](https://altered.gg) cards.

## Features

- **`<AlteredCard>` Vue component** — drop-in, reactive, slot-based
- **`useAlteredCard` composable** — fine-grained control within any Vue component
- **`createAlteredCard` core** — zero framework dependency, works in vanilla JS, React, Svelte, etc.
- Renders cards from a ref string, raw API JSON, or forge card JSON
- Full lifecycle management (loading, error states, cleanup)

## Install

Not yet published to npm. Install directly from GitHub:

```bash
npm install github:GeoffreyCasaubon/altered-tcg
```

Or clone and link locally:

```bash
git clone https://github.com/GeoffreyCasaubon/altered-tcg.git
cd altered-tcg && npm install && npm run build
npm link

# In your project:
npm link altered-tcg
```

Vue 3 is a peer dependency — install it separately if you haven't already.

## Quick start — Vue component

```vue
<template>
  <AlteredCard card-ref="ALT_COREKS_B_AX_01_C" locale="en" width="300px" />
</template>

<script setup>
import { AlteredCard } from 'altered-tcg';
</script>
```

### Register globally (plugin)

```js
import { createApp }        from 'vue';
import AlteredVuePlugin     from 'altered-tcg';

createApp(App).use(AlteredVuePlugin).mount('#app');
```

## Props

| Prop            | Type              | Default      | Description                                    |
|-----------------|-------------------|--------------|------------------------------------------------|
| `card-ref`      | `string`          | `null`       | Card reference, e.g. `"ALT_COREKS_B_AX_01_C"` |
| `locale`        | `string`          | `"en"`       | Language: `en` / `fr` / `es` / `de` / `it`    |
| `collection`    | `string`          | `"official"` | Forge collection key                           |
| `card-json`     | `object`          | `null`       | Forge card JSON (alternative to `card-ref`)    |
| `api-json`      | `object`          | `null`       | Raw Altered API JSON (alternative to `card-ref`) |
| `api-mapping`   | `object`          | `null`       | Custom field mapping for `api-json` mode       |
| `config-base-url`| `string`         | `null`       | Override CDN base URL for forge assets         |
| `card-api-url`  | `string`          | `null`       | Override card API URL template                 |
| `proxy-url`     | `string\|false`   | `false`      | CORS proxy URL, or `false` to call API directly|
| `width`         | `string`          | `"300px"`    | CSS width of the card container                |

## Events

| Event   | Payload                       | Description                        |
|---------|-------------------------------|------------------------------------|
| `load`  | `{ canvas, state, redraw }`   | Card rendered successfully         |
| `error` | `Error`                       | Rendering failed                   |

## Slots

| Slot      | Props         | Description                            |
|-----------|---------------|----------------------------------------|
| `loading` | —             | Shown while the card loads             |
| `error`   | `{ error }`   | Shown when rendering fails             |

## Composable

```js
import { ref } from 'vue';
import { useAlteredCard } from 'altered-tcg';

const containerRef = ref(null);
const { isLoading, error, canvas, redraw } = useAlteredCard(containerRef, {
  cardRef: 'ALT_COREKS_B_AX_01_C',
  locale: 'fr',
});
```

The second argument accepts the same fields as the component props. It can be a plain reactive object or a `computed` ref — changes trigger a re-render automatically.

## Framework-agnostic core

Use `createAlteredCard` in any context (vanilla JS, React, Svelte, etc.):

```js
import { createAlteredCard } from 'altered-tcg';

const card = createAlteredCard(document.getElementById('card-container'), {
  configBaseUrl: 'https://cdn.alteredcore.org/forge/',
  proxyUrl: false,
});

card.on('load', ({ canvas }) => console.log('rendered', canvas));
card.on('error', (err)       => console.error('failed', err));

await card.renderFromRef('ALT_COREKS_B_AX_01_C', 'en');

// Later — change card without recreating
await card.renderFromRef('ALT_COREKS_B_BR_01_C', 'fr');

// Clean up
card.destroy();
```

### Methods

| Method                              | Description                                               |
|-------------------------------------|-----------------------------------------------------------|
| `renderFromRef(ref, locale?, collection?)` | Fetch from API and render by card reference        |
| `renderFromApiJson(apiJson, mapping?)` | Render from already-fetched API JSON               |
| `renderFromCardJson(cardJson)`      | Render from forge card JSON                              |
| `redraw()`                          | Force re-render (after manually patching state)          |
| `on(event, fn)` → unsubscribe fn   | Subscribe to `load` / `error` / `stateChange` events    |
| `off(event, fn)`                   | Unsubscribe                                               |
| `getMountResult()`                  | Returns `{ canvas, state, redraw }` from the last render |
| `destroy()`                         | Remove canvas and clean up all listeners                 |

## License

MIT © Geoffrey Casaubon
