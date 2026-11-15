// Playwright e2e config: runs the acceptance suite against the dev server (E2E_TARGET=dev, default)
// or the production build served under /dunesight/ (E2E_TARGET=prod, run `npm run build` first).
// A second dev server without a Cesium token (port 5174) backs the fallback-basemap test.
import { defineConfig } from '@playwright/test';

const target = process.env.E2E_TARGET || 'dev';
const baseURL = target === 'prod' ? 'http://localhost:4173/dunesight/' : 'http://localhost:5173/';
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
      ? { command: 'npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/dunesight/', reuseExistingServer: true, timeout: 60_000 }
      : { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173/', reuseExistingServer: true, timeout: 60_000 },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174/',
      reuseExistingServer: true,
      timeout: 60_000,
      env: { VITE_CESIUM_TOKEN: '' },
    },
  ],
});
