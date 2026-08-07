/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

import manifest from './src/manifest.json';

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    crx({ manifest }),
    {
      name: 'tesseract-browser-compat',
      resolveId(id, importer) {
        if (importer?.includes('tesseract.js/src/createWorker') && (id === './worker/node' || id.endsWith('/worker/node'))) {
          return this.resolve('./worker/browser', importer);
        }
        return null;
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@services': resolve(__dirname, 'src/services'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@compat': resolve(__dirname, 'src/compat'),
      '@type': resolve(__dirname, 'src/types'),
      '@styles': resolve(__dirname, 'src/styles'),
      '@shared': resolve(__dirname, 'src/shared'),
      // Only the WASM backend is used (CodeOCR). Avoid bundling the webgpu/webgl
      // backends + their ~27MB .jsep.wasm asset, and the duplicate full glue.
      'onnxruntime-web': resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.wasm.min.mjs'),
    },
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        offscreen: resolve(__dirname, 'src/offscreen/index.html'),
        pdfWindow: resolve(__dirname, 'src/pdf/window.html'),
      },
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
