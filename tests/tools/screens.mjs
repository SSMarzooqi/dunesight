// Dev helper: retake the README/docs screenshots in docs/screenshots/ from a running server (GPU WebGL), one scripted view each.
// Usage: node tests/tools/screens.mjs [baseUrl] [outDir] [name ...]   (default http://localhost:5173/, docs/screenshots, all views)
import { chromium } from '@playwright/test';

const [base = 'http://localhost:5173/', outDir = 'docs/screenshots', ...only] = process.argv.slice(2);

async function ready(page, site) {
  await page.waitForFunction(() => window.__ds?.state.siteId, null, { timeout: 60000 });
  await page.evaluate(() => window.__ds.ready);
  await page.keyboard.press('Shift'); // skip the fly-in
  if (site) {
    await page.click(`[data-site="${site}"]`);
    await page.waitForFunction((s) => window.__ds.state.siteId === s, site);
  }
  await page.evaluate(() => window.__ds.siteReady());
}
const settle = async (page, ms = 6000) => {
  await page.waitForTimeout(ms);
  await page.waitForFunction(() => window.__ds.viewer.scene.globe.tilesLoaded, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
};

const VIEWS = {
  'seih-motion-1080p': { w: 1920, h: 1080, async run(p) { await ready(p); await p.click('[data-mode="motion"]'); await settle(p, 8000); } },
  'seih-true-view-then-now': {
    w: 1920, h: 1080,
    async run(p) { await ready(p); await p.click('[data-mode="true"]'); await p.locator('[data-toggle="thenNow"]').check(); await settle(p, 8000); },
  },
  'seih-threat-2035-1366x768': {
    w: 1366, h: 768,
    async run(p) { await ready(p); await p.click('[data-mode="threat"]'); await p.evaluate(() => window.__ds.goYear(2035)); await settle(p, 8000); },
  },
  'liwa-projected-2050-changed-pixels': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p, 'liwa');
      await p.click('[data-mode="motion"]');
      await p.evaluate(() => window.__ds.goYear(2050));
      await p.check('[data-opt="showChange"]');
      await settle(p, 9000);
    },
  },
  'sweihan-threat-target-card': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p, 'sweihan');
      await p.click('[data-mode="threat"]');
      await p.waitForTimeout(1500);
      await p.locator('.threat-list [data-target]').first().click();
      await settle(p, 8000);
    },
  },
  'seih-station-wind-dossier': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p);
      await settle(p, 5000);
      await p.locator('#panel-wind [data-dossier="station"]').first().click();
      await p.waitForTimeout(1500);
    },
  },
  'liwa-crosschecks': {
    w: 1920, h: 1080,
    async run(p) {
      await ready(p, 'liwa');
      await settle(p, 6000);
      await p.locator('#panel-headline [data-dossier="crosschecks"]').click();
      await p.waitForTimeout(1500);
    },
  },
};

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [name, v] of Object.entries(VIEWS)) {
  if (only.length && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
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
