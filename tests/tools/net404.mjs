// Dev helper: list failed requests (HTTP status >= 400, or network failures) while loading a URL.
import { chromium } from '@playwright/test';

const [url, wait = '6000'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('response', (r) => {
  if (r.status() >= 400) console.log(r.status(), r.url());
});
page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()?.errorText));
await page.goto(url);
await page.waitForTimeout(+wait);
await browser.close();
