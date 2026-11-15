// Dev helper: load a URL in headless Chromium (software WebGL), run optional page JS, optionally click where it says, save a screenshot, print console errors.
// Usage: node tests/tools/shot.mjs <url> <out.png> [waitMs] [width] [height] [jsToEvalAfterWait] [click]
// If the last arg is "click" and the JS returns {x, y}, the mouse clicks there before the screenshot.
import { chromium } from '@playwright/test';

const [url, out, wait = '8000', w = '1920', h = '1080', js = '', click = ''] = process.argv.slice(2);
const gpu = process.env.SHOT_GPU === '1';
const browser = await chromium.launch(
  gpu ? { channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
);
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => {
  if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver Message/.test(m.text())) console.log('[console]', m.type(), m.text().slice(0, 300));
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto(url);
await page.waitForTimeout(+wait);
if (js) {
  const r = await page.evaluate(js);
  if (r !== undefined) console.log('[eval]', JSON.stringify(r).slice(0, 3000));
  if (click === 'click' && r && Number.isFinite(r.x)) {
    await page.mouse.click(r.x, r.y);
    console.log('[click]', r.x, r.y);
  }
  await page.waitForTimeout(2500);
}
await page.screenshot({ path: out });
console.log('done', Date.now() - t0, 'ms');
await browser.close();
