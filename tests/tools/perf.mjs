// Dev helper: measure load timings and render frame times (pan/orbit, zoom, timeline play, site switch) per site.
// Usage: node tests/tools/perf.mjs [url] ; set PERF_SOFTWARE=1 for SwiftShader software WebGL.
import { chromium } from '@playwright/test';

const [url = 'http://localhost:5173/'] = process.argv.slice(2);
const software = process.env.PERF_SOFTWARE === '1';
const browser = await chromium.launch(
  software ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : { channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist'] },
);
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__ds?.state.siteId);
await page.evaluate(() => window.__ds.ready);
const nav = await page.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0];
  return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), marks: window.__ds.marks };
});
console.log('load', JSON.stringify(nav));
await page.keyboard.press('Shift');
await page.waitForTimeout(1500);

const stats = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { frames: s.length, median_ms: +q(0.5).toFixed(1), p95_ms: +q(0.95).toFixed(1), max_ms: +s[s.length - 1].toFixed(1) };
};

for (const id of ['seih_al_hama', 'sweihan', 'liwa']) {
  const t0 = Date.now();
  await page.evaluate((sid) => window.__ds.setSite(sid), id);
  await page.evaluate(() => window.__ds.siteReady());
  const switchMs = Date.now() - t0;
  await page.waitForTimeout(3000); // let the fly-home finish
  for (const mode of ['motion', 'threat']) {
    await page.evaluate((m) => window.__ds.setMode(m), mode);
    // orbit + zoom: drive the camera for 3 s and record the time between rendered frames
    const orbit = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const { viewer, Cesium } = window.__ds;
          const scene = viewer.scene;
          const times = [];
          let last = performance.now();
          const remove = scene.postRender.addEventListener(() => {
            const now = performance.now();
            times.push(now - last);
            last = now;
          });
          const t0 = performance.now();
          const step = () => {
            const t = performance.now() - t0;
            viewer.camera.rotateRight(0.004);
            viewer.camera.zoomIn(t < 1500 ? 15 : -15);
            scene.requestRender();
            if (t < 3000) requestAnimationFrame(step);
            else {
              remove();
              resolve(times.slice(2));
            }
          };
          last = performance.now();
          requestAnimationFrame(step);
          void Cesium;
        }),
    );
    console.log(`${id} ${mode} orbit`, JSON.stringify(stats(orbit)));
  }
  // timeline play from the first stop: how long each step takes to apply
  const play = await page.evaluate(async () => {
    const tl = window.__ds.timeline;
    const out = [];
    const ys = tl.model.stops.map((s) => s.year);
    for (const y of ys) {
      const t = performance.now();
      tl.goYear(y);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.push(performance.now() - t);
    }
    return out;
  });
  console.log(`${id} timeline step (2 frames incl.)`, JSON.stringify(stats(play)), `site switch ${switchMs} ms`);
}
await browser.close();
