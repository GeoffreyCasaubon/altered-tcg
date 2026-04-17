/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo';

  if (isDemo) {
    return {
      plugins: [vue()],
      root: 'demo',
      server: {
        open: true,
        proxy: {
          '/altered-api': {
            target: 'https://altered-core-cards-api.toxicity.be',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/altered-api/, ''),
          },
        },
      },
    };
  }

  return {
    plugins: [
      vue(),
      dts({ include: ['src'], insertTypesEntry: true }),
    ],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'AlteredTcg',
        fileName: 'altered-tcg',
      },
      rollupOptions: {
        external: ['vue'],
        output: {
          globals: { vue: 'Vue' },
          exports: 'named',
        },
      },
    },
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.ts'],
    },
  };
});
