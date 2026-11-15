// Dev helper: check a deployed URL: basemap/terrain status (ion or fallback), each site loads and draws, console errors, screenshots.
import { chromium } from '@playwright/test';

const [url = 'https://ssmarzooqi.github.io/dunesight/', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
const ionStatus = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 200));
});
page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
page.on('response', (r) => {
  if (/api\.cesium\.com\/v1\/assets\/\d+\/endpoint/.test(r.url())) ionStatus.push(`${r.status()} ${r.url().replace(/\?.*/, '')}`);
});
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ds?.state.siteId, null, { timeout: 60000 });
await page.evaluate(() => window.__ds.ready);
console.log('marks', JSON.stringify(await page.evaluate(() => window.__ds.marks)));
await page.waitForTimeout(9000); // fly-in
console.log('basemap', JSON.stringify(await page.evaluate(() => window.__ds.basemap())));
console.log('ion endpoint responses', JSON.stringify(ionStatus));
const terrain = await page.evaluate(() => {
  const { viewer, Cesium } = window.__ds;
  const tp = viewer.terrainProvider;
  const h = viewer.scene.globe.getHeight(Cesium.Cartographic.fromDegrees(55.525, 24.06));
  return { ellipsoid: tp instanceof Cesium.EllipsoidTerrainProvider, groundHeightAtSeih_m: h };
});
console.log('terrain', JSON.stringify(terrain));
await page.screenshot({ path: `${outDir}/live-seih_al_hama.png` });
for (const id of ['sweihan', 'liwa']) {
  await page.click(`[data-site="${id}"]`);
  await page.waitForFunction((sid) => window.__ds.state.siteId === sid, id);
  await page.evaluate(() => window.__ds.siteReady());
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const L = window.__ds.layers();
    return { kpi: document.querySelector('.kpi-num')?.innerText, targets: L.targets.count, arrows: L.vectors.count, dunes: L.dunes.count };
  });
  console.log(id, JSON.stringify(info));
  await page.screenshot({ path: `${outDir}/live-${id}.png` });
}
console.log('console errors', JSON.stringify(errors));
await browser.close();
