// Shared e2e helpers: read the real data files, boot the app and wait for a site, collect console errors.
import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DATA = path.resolve('public/data');
export const readJson = (p) => JSON.parse(fs.readFileSync(path.join(DATA, p), 'utf8'));
export const sitesIndex = () => readJson('sites.json');
export const siteIds = () => sitesIndex().sites.filter((s) => s.data_dir).map((s) => s.id);
export const siteData = (id) => {
  const dir = sitesIndex().sites.find((s) => s.id === id).data_dir;
  return {
    summary: readJson(`${dir}summary.json`),
    dunes: readJson(`${dir}dunes.geojson`),
    vectors: readJson(`${dir}vectors.geojson`),
    targets: readJson(`${dir}targets.geojson`),
    manifest: readJson(`${dir}frames/manifest.json`),
    sources: readJson(`${dir}sources.json`),
    wind: readJson(`${dir}wind_summary.json`),
  };
};

/** Test fixture that records console errors and page errors; each test asserts none occurred. */
export const test = base.extend({
  errors: async ({ page }, use) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await use(errors);
  },
});
export { expect };

/** Load the app, skip the fly-in, and wait until the default site's layers are built. */
export async function boot(page, { url = './', skipFlyIn = true } = {}) {
  await page.goto(url);
  await page.waitForFunction(() => window.__ds && window.__ds.state.siteId, null, { timeout: 60_000 });
  await page.evaluate(() => window.__ds.ready);
  await page.evaluate(() => window.__ds.siteReady());
  if (skipFlyIn) {
    await page.keyboard.press('Shift'); // any key skips the fly-in
    await page.waitForFunction(() => !window.__ds.isFlying());
  }
}

export async function switchSite(page, id) {
  await page.click(`[data-site="${id}"]`);
  await page.waitForFunction((sid) => window.__ds.state.siteId === sid, id, { timeout: 60_000 });
  await page.evaluate(() => window.__ds.siteReady());
}

/** All visible text of the HUD (excluding the Cesium canvas). */
export async function hudText(page) {
  return page.evaluate(() => document.body.innerText);
}

export const BAD_TEXT = /\b(null|undefined|NaN)\b/;

/** Click a feature for real: frame it top-down, then click its window position. */
export async function clickFeature(page, kind, id) {
  const pos = await page.evaluate(([k, i]) => window.__ds.frameFeature(k, i), [kind, id]);
  expect(pos, `${kind} ${id} should be on screen`).toBeTruthy();
  await page.mouse.click(pos.x, pos.y);
  try {
    await expect(page.locator('#panel-card')).toBeVisible({ timeout: 4000 });
  } catch (err) {
    const dbg = await page.evaluate(([x, y]) => {
      const C = window.__ds.Cesium;
      const s = window.__ds.viewer.scene;
      return {
        picks: s.drillPick(new C.Cartesian2(x, y)).map((p) => (typeof p.id === 'string' ? p.id : p.primitive?.constructor?.name)),
        flying: window.__ds.isFlying(),
        cam: C.Cartographic.fromCartesian(window.__ds.viewer.camera.position),
        sel: window.__ds.state.selectionId,
      };
    }, [pos.x, pos.y]);
    throw new Error(`click on ${kind} ${id} at ${pos.x},${pos.y} did not select: ${JSON.stringify(dbg)}`);
  }
}

/** Format like the app: fixed decimals. */
export const fx = (v, d = 2) => Number(v).toFixed(d);
