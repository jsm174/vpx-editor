import { defineConfig } from 'vite';
import { resolve } from 'path';
import packageJson from './package.json';
import versionInfo from './src/shared/version.json';
import { htmlTransformPlugin } from './src/build/vite-plugin-html-transform';

function getVersionString(): string {
  if (versionInfo.sha === 'dev') {
    return `${packageJson.version} (dev)`;
  }
  return `${packageJson.version}-${versionInfo.revision}-${versionInfo.sha}`;
}

export default defineConfig({
  root: '.',
  base: process.env.BASE_URL || './',
  publicDir: 'public',
  build: {
    outDir: 'dist-web',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
    target: 'esnext',
  },
  server: {
    port: 3000,
    open: '/',
  },
  plugins: [htmlTransformPlugin({ platform: 'web' })],
  optimizeDeps: {
    exclude: ['@jsm174/vpin-wasm'],
  },
  resolve: {
    alias: {
      '@platform': resolve(__dirname, 'src/platform/web'),
    },
  },
  define: {
    'import.meta.env.PLATFORM': JSON.stringify('web'),
    __APP_VERSION__: JSON.stringify(getVersionString()),
  },
});
