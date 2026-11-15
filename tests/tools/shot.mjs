// Dev helper: load a URL in headless Chromium (software WebGL), run optional steps, save a screenshot, print console errors.
// Usage: node tests/tools/shot.mjs <url> <out.png> [waitMs] [width] [height] [jsToEvalAfterWait]
import { chromium } from '@playwright/test';

const [url, out, wait = '8000', w = '1920', h = '1080', js = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 300));
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto(url);
await page.waitForTimeout(+wait);
if (js) {
  const r = await page.evaluate(js);
  if (r !== undefined) console.log('[eval]', JSON.stringify(r).slice(0, 2000));
  await page.waitForTimeout(2500);
}
await page.screenshot({ path: out });
console.log('done', Date.now() - t0, 'ms');
await browser.close();
