import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';
import { prodBase } from './scripts/base.mjs';

// base: '/' in dev; for production builds and for `vite preview` of that build (preview runs with command 'serve',
// so it needs isPreview) it is DS_BASE, default '/dunesight/' (GitHub Pages project site), '/' for a custom domain.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? prodBase() : '/',
  plugins: [cesium()],
  server: {
    port: 5173,
    strictPort: true,
    // Optional local proxy for secret-key APIs (see server/README.md), e.g.:
    // proxy: { '/api': 'http://localhost:8787' },
  },
}));
