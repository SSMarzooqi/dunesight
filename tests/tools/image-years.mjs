// Dev helper: screenshot an image-only (display-only Landsat 7) year at each site, at desktop and phone size, and print
// the header chip, readout and gap label, plus any console errors.
// Usage: node tests/tools/image-years.mjs <baseUrl> <outDir> [year] [sites comma-separated]
import { chromium } from '@playwright/test';

const [base, outDir, yearArg = '', sitesArg = 'seih_al_hama,sweihan,liwa'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chromium', args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
for (const [w, h] of [[1920, 1080], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('dunesight-guide-seen', '1'));
  await page.goto(base);
  await page.waitForFunction(() => window.__ds && window.__ds.state.siteId, null, { timeout: 60_000 });
  await page.evaluate(() => window.__ds.siteReady());
  await page.keyboard.press('Shift');
  await page.waitForFunction(() => !window.__ds.isFlying());
  for (const id of sitesArg.split(',')) {
    await page.evaluate((sid) => window.__ds.setSite(sid), id);
    await page.waitForFunction((sid) => window.__ds.state.siteId === sid, id);
    await page.evaluate(() => window.__ds.siteReady());
    await page.keyboard.press('Shift');
    await page.waitForFunction(() => !window.__ds.isFlying());
    const years = await page.evaluate(() => window.__ds.timeline.model.stops.filter((s) => s.kind === 'display').map((s) => s.year));
    const y = yearArg ? +yearArg : years[Math.floor(years.length / 2)];
    await page.evaluate((yy) => window.__ds.goYear(yy), y);
    if (w < 700) await page.click('[role="tab"][data-tab="time"]');
    await page.waitForTimeout(4000);
    const info = await page.evaluate(() => ({
      when: document.querySelector('[data-when]').innerText,
      readout: document.querySelector('[data-readout]').innerText,
      gapnote: document.querySelector('[data-gapnote]')?.innerText || document.querySelector('[data-tl-key]')?.innerText || null,
      shown: window.__ds.shown(),
    }));
    console.log(JSON.stringify({ id, w, y, years, ...info, shown: { vectors: info.shown.vectors, dunes: info.shown.dunes, imageTag: info.shown.imageTag, base: info.shown.frames.base } }));
    await page.screenshot({ path: `${outDir}/${id}-${y}-${w}x${h}.png` });
  }
  console.log('errors', w, errors);
  await page.close();
}
await browser.close();
