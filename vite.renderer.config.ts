import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'script-editor': resolve(__dirname, 'src/windows/script-editor/script-editor.html'),
        'search-select': resolve(__dirname, 'src/windows/search-select/search-select.html'),

        'image-manager': resolve(__dirname, 'src/windows/managers/image-manager.html'),
        'material-manager': resolve(__dirname, 'src/windows/managers/material-manager.html'),
        'sound-manager': resolve(__dirname, 'src/windows/managers/sound-manager.html'),
        'render-probe-manager': resolve(__dirname, 'src/windows/managers/render-probe-manager.html'),
        'dimensions-manager-window': resolve(__dirname, 'src/windows/managers/dimensions-manager-window.html'),
        'collection-manager-window': resolve(__dirname, 'src/windows/managers/collection-manager-window.html'),

        'prompt-window': resolve(__dirname, 'src/windows/dialogs/prompt-window.html'),
        'confirm-window': resolve(__dirname, 'src/windows/dialogs/confirm-window.html'),
        'info-window': resolve(__dirname, 'src/windows/dialogs/info-window.html'),
        'about-window': resolve(__dirname, 'src/windows/dialogs/about-window.html'),
        'work-folder-window': resolve(__dirname, 'src/windows/dialogs/work-folder-window.html'),
        'collection-editor-window': resolve(__dirname, 'src/windows/dialogs/collection-editor-window.html'),
        'collection-prompt-window': resolve(__dirname, 'src/windows/dialogs/collection-prompt-window.html'),
        'rename-prompt-window': resolve(__dirname, 'src/windows/dialogs/rename-prompt-window.html'),
        'mesh-import-window': resolve(__dirname, 'src/windows/dialogs/mesh-import-window.html'),

        'settings-window': resolve(__dirname, 'src/windows/settings/settings-window.html'),
        'transform-window': resolve(__dirname, 'src/windows/settings/transform-window.html'),
        'table-info-window': resolve(__dirname, 'src/windows/settings/table-info-window.html'),
        'drawing-order-window': resolve(__dirname, 'src/windows/settings/drawing-order-window.html'),
      },
    },
  },
});
