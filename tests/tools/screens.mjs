// Dev helper: retake the README/docs screenshots in docs/screenshots/ from a running server (GPU WebGL), one scripted view each.
// Usage: node tests/tools/screens.mjs [baseUrl] [outDir] [name ...]   (default http://localhost:5173/, docs/screenshots, all views)
import { chromium } from '@playwright/test';

const [base = 'http://localhost:5173/', outDir = 'docs/screenshots', ...only] = process.argv.slice(2);

async function ready(page, site) {
  await page.waitForFunction(() => window.__ds?.state.siteId, null, { timeout: 60000 });
  await page.evaluate(() => window.__ds.ready);
  await page.keyboard.press('Shift'); // skip the fly-in
  if (site) {
    await page.click(`.ds-header [data-site="${site}"]`);
    await page.waitForFunction((s) => window.__ds.state.siteId === s, site);
  }
  await page.evaluate(() => window.__ds.siteReady());
}
const settle = async (page, ms = 6000) => {
  await page.waitForTimeout(ms);
  await page.waitForFunction(() => window.__ds.viewer.scene.globe.tilesLoaded, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
};
const mode = (p, m) => p.click(`.ds-header [data-mode="${m}"]`);
const gear = async (p, fn) => {
  await p.click('[data-gear]');
  await fn();
  await p.keyboard.press('Escape');
};

const VIEWS = {
  'seih-motion-1080p': { w: 1920, h: 1080, async run(p) { await ready(p); await mode(p, 'motion'); await settle(p, 8000); } },
  'seih-true-view-then-now': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p);
      await mode(p, 'true');
      await p.locator('[data-layer="dunes"]').check();
      await p.locator('[data-layer="dunes2000"]').check();
      await settle(p, 8000);
    },
  },
  'seih-threat-2035-1366x768': {
    w: 1366, h: 768,
    async run(p) { await ready(p); await mode(p, 'threat'); await p.evaluate(() => window.__ds.goYear(2035)); await settle(p, 8000); },
  },
  'liwa-projected-2050-changed-pixels': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p, 'liwa');
      await mode(p, 'motion');
      await p.evaluate(() => window.__ds.goYear(2050));
      await gear(p, () => p.check('[data-setting="changedPixels"]'));
      await settle(p, 9000);
    },
  },
  'sweihan-threat-target-card': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p, 'sweihan');
      await mode(p, 'threat');
      await p.waitForTimeout(1500);
      await p.locator('.ds-rlist [data-target]').first().click();
      await settle(p, 8000);
    },
  },
  'sweihan-motion-wind-agrees': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p, 'sweihan');
      await mode(p, 'motion');
      await p.click('.ds-panel--wind [data-details="wind"]');
      await settle(p, 8000);
    },
  },
  'sweihan-dune-below-detection-limit': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p, 'sweihan');
      await mode(p, 'motion');
      const pos = await p.evaluate(() => window.__ds.frameFeature('dune', 'D001'));
      await p.mouse.click(pos.x, pos.y);
      await settle(p, 5000);
    },
  },
  'seih-exposed-roads-frame-alignment': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p);
      await mode(p, 'threat');
      await p.locator('[data-layer="exposed"]').check();
      await p.evaluate(() => {
        const { viewer, Cesium } = window.__ds;
        viewer.camera.cancelFlight();
        // east edge of the Seih Al Hama box (55.575 E): the frame edge against the basemap shows the alignment
        viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(55.572, 24.036, 3600), orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 } });
      });
      await settle(p, 7000);
    },
  },
  'seih-station-wind-dossier': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p);
      await settle(p, 5000);
      await p.locator('.ds-panel--wind .ds-src [data-dossier="station"]').click();
      await p.waitForTimeout(1500);
    },
  },
  'liwa-crosschecks': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p, 'liwa');
      await settle(p, 6000);
      await p.locator('.ds-panel--speed [data-dossier="crosschecks"]').click();
      await p.waitForTimeout(1500);
    },
  },
  'seih-phone-390x844': { w: 390, h: 844, async run(p) { await ready(p); await mode(p, 'motion'); await settle(p, 8000); } },
};

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [name, v] of Object.entries(VIEWS)) {
  if (only.length && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.w < 500 ? 2 : 1 });
  await page.addInitScript(() => localStorage.setItem('dunesight-guide-seen', '1'));
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await v.run(page);
  await page.screenshot({ path: `${outDir}/${name}.jpg`, quality: 88, type: 'jpeg' });
  console.log(name, errors.length ? `errors: ${JSON.stringify(errors)}` : 'ok');
  await page.close();
}
await browser.close();
