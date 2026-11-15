// Dev helper: load the app, go offline, change year/mode/camera, and print console errors with their source location and message.
import { chromium } from '@playwright/test';

const [url = 'http://localhost:5173/'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
page.on('console', async (m) => {
  if (m.type() !== 'error') return;
  const args = await Promise.all(m.args().map((a) => a.evaluate((v) => (v instanceof Error ? `${v.name}: ${v.message}\n${v.stack}` : String(v))).catch(() => '?')));
  console.log('[error]', JSON.stringify(m.location()), args.join(' | ').slice(0, 1500));
});
await page.goto(url);
await page.waitForFunction(() => window.__ds?.state.siteId);
await page.evaluate(() => window.__ds.ready);
await page.evaluate(() => window.__ds.layers().frames.preload);
await page.keyboard.press('Shift');
await page.waitForTimeout(+(process.env.PAUSE || 0));
console.log('--- offline');
await context.setOffline(true);
await page.evaluate(() => window.__ds.goYear(2040));
await page.evaluate(() => window.__ds.setMode('threat'));
await page.click('[data-act="home"]');
await page.waitForTimeout(4000);
await browser.close();
