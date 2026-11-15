import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

// base: '/' in dev, '/dunesight/' for production builds (GitHub Pages project site).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/dunesight/' : '/',
  plugins: [cesium()],
  server: {
    port: 5173,
    strictPort: true,
    // Optional local proxy for secret-key APIs (see server/README.md), e.g.:
    // proxy: { '/api': 'http://localhost:8787' },
  },
}));
