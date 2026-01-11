import { defineConfig } from 'vite';
import { resolve } from 'path';
import { htmlTransformPlugin } from './src/build/vite-plugin-html-transform';

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [htmlTransformPlugin({ platform: 'electron' })],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'script-editor': resolve(__dirname, 'src/features/script-editor/desktop/window.html'),
        'search-select': resolve(__dirname, 'src/features/search-select/desktop/window.html'),

        'image-manager': resolve(__dirname, 'src/features/image-manager/desktop/window.html'),
        'material-manager': resolve(__dirname, 'src/features/material-manager/desktop/window.html'),
        'sound-manager': resolve(__dirname, 'src/features/sound-manager/desktop/window.html'),
        'render-probe-manager': resolve(__dirname, 'src/features/render-probe-manager/desktop/window.html'),
        'dimensions-manager-window': resolve(__dirname, 'src/features/dimensions-manager/desktop/window.html'),
        'collection-manager-window': resolve(__dirname, 'src/features/collection-manager/desktop/window.html'),

        'about-window': resolve(__dirname, 'src/features/about/desktop/window.html'),
        'collection-editor-window': resolve(__dirname, 'src/features/collection-manager/desktop/editor-window.html'),
        'material-editor-window': resolve(__dirname, 'src/features/material-manager/desktop/editor-window.html'),
        'generic-prompt-window': resolve(__dirname, 'src/features/prompt/desktop/window.html'),
        'mesh-import-window': resolve(__dirname, 'src/features/mesh-import/desktop/window.html'),

        'settings-window': resolve(__dirname, 'src/features/settings/desktop/window.html'),
        'transform-window': resolve(__dirname, 'src/features/transform/desktop/window.html'),
        'table-info-window': resolve(__dirname, 'src/features/table-info/desktop/window.html'),
        'drawing-order-window': resolve(__dirname, 'src/features/drawing-order/desktop/window.html'),
      },
    },
  },
});
