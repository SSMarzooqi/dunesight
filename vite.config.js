import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

// base: '/' in dev, '/dunesight/' for production builds (GitHub Pages project site) and for
// `vite preview` of that build (preview runs with command 'serve', so it needs isPreview).
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/dunesight/' : '/',
  plugins: [cesium()],
  server: {
    port: 5173,
    strictPort: true,
    // Optional local proxy for secret-key APIs (see server/README.md), e.g.:
    // proxy: { '/api': 'http://localhost:8787' },
  },
}));
