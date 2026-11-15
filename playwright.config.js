// Playwright e2e config: runs the acceptance suite against the dev server (E2E_TARGET=dev, default)
// or the production build served under its base path, DS_BASE (default /dunesight/; E2E_TARGET=prod, run `npm run build`
// first with the same DS_BASE).
// A second dev server without a Cesium token (port 5174) backs the fallback-basemap test.
import { defineConfig } from '@playwright/test';
import { prodBase } from './scripts/base.mjs';

const target = process.env.E2E_TARGET || 'dev';
// Ports can be moved (E2E_DEV_PORT, E2E_NOTOKEN_PORT, E2E_PROD_PORT) when the defaults are taken by another server;
// servers already listening on the chosen ports are reused, so make sure they serve this checkout.
const DEV_PORT = Number(process.env.E2E_DEV_PORT || 5173);
const NOTOKEN_PORT = Number(process.env.E2E_NOTOKEN_PORT || 5174);
const PROD_PORT = Number(process.env.E2E_PROD_PORT || 4173);
process.env.E2E_NOTOKEN_URL = `http://localhost:${NOTOKEN_PORT}/`;
const PROD_URL = `http://localhost:${PROD_PORT}${prodBase()}`;
const baseURL = target === 'prod' ? PROD_URL : `http://localhost:${DEV_PORT}/`;
const software = process.env.E2E_SWIFTSHADER === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 150_000,
  expect: { timeout: 20_000 },
  workers: 1, // WebGL scenes are heavy; run one browser at a time
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL,
    viewport: { width: 1920, height: 1080 },
    // New headless Chromium; uses the GPU where available, or SwiftShader software WebGL with E2E_SWIFTSHADER=1.
    channel: 'chromium',
    launchOptions: {
      args: software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist', '--enable-gpu'],
    },
    screenshot: 'only-on-failure',
  },
  metadata: { target },
  webServer: [
    target === 'prod'
      ? { command: `npx vite preview --port ${PROD_PORT} --strictPort`, url: PROD_URL, reuseExistingServer: true, timeout: 60_000 }
      : { command: `npx vite --port ${DEV_PORT} --strictPort`, url: `http://localhost:${DEV_PORT}/`, reuseExistingServer: true, timeout: 60_000 },
    {
      command: `npx vite --port ${NOTOKEN_PORT} --strictPort`,
      url: `http://localhost:${NOTOKEN_PORT}/`,
      reuseExistingServer: true,
      timeout: 60_000,
      env: { VITE_CESIUM_TOKEN: '' },
    },
  ],
});
