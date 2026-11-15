// Acceptance tests from docs/build-spec.md section 8 (the automatable ones), run against the real data files.
import { test, expect, boot, switchSite, hudText, BAD_TEXT, clickFeature, siteIds, siteData, sitesIndex, fx } from './helpers.js';

const SITES = siteIds();
const DEFAULT_SITE = sitesIndex().default_site;
const CREDIT = 'Supported by the Michigan Space Grant Consortium, NASA grant 80NSSC20M0124.';

test.afterEach(async ({ errors }, testInfo) => {
  expect(errors, `console errors during "${testInfo.title}"`).toEqual([]);
});

// 1 + 2 ---------------------------------------------------------------------------------------
test('1/2 · loads cleanly; HUD and site box within 5 s', async ({ page, errors }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('DuneSight');
  await page.waitForFunction(() => window.__ds?.marks && Object.keys(window.__ds.marks).some((k) => k.startsWith('box:')), null, { timeout: 60_000 });
  const marks = await page.evaluate(() => window.__ds.marks);
  console.log(`    timings (ms since navigation): ${JSON.stringify(marks)}`);
  await expect(page.locator('.brand')).toContainText('DuneSight');
  for (const id of SITES) await expect(page.locator(`[data-site="${id}"]`)).toBeVisible();
  expect(marks.hud).toBeLessThan(5000);
  expect(marks[`box:${DEFAULT_SITE}`]).toBeLessThan(5000);
});

// 3 -------------------------------------------------------------------------------------------
test('3 · fly-in lands on the default site; switching swaps all data', async ({ page }) => {
  await boot(page, { skipFlyIn: false });
  await page.waitForFunction(() => window.__ds.marks['flyin-done'], null, { timeout: 30_000 });
  const centre = await page.evaluate(() => window.__ds.centreGround());
  const b = sitesIndex().sites.find((s) => s.id === DEFAULT_SITE).bbox;
  expect(centre[0]).toBeGreaterThan(b.west - 0.05);
  expect(centre[0]).toBeLessThan(b.east + 0.05);
  expect(centre[1]).toBeGreaterThan(b.south - 0.05);
  expect(centre[1]).toBeLessThan(b.north + 0.05);

  for (const id of SITES) {
    await switchSite(page, id);
    const d = siteData(id);
    await expect(page.locator(`[data-site="${id}"]`)).toHaveClass(/on/);
    await expect(page.locator('#panel-headline .kpi-num')).toContainText(fx(d.summary.speed_median_myr));
    const counts = await page.evaluate(() => {
      const L = window.__ds.layers();
      return { targets: L.targets.count, dunes: L.dunes.count, arrows: L.vectors.count, stops: window.__ds.timeline.model.stops.length };
    });
    expect(counts.targets).toBe(d.targets.features.length);
    expect(counts.dunes).toBe(d.dunes.features.length);
    expect(counts.arrows).toBe(d.vectors.features.length);
    const latest = d.manifest.observed.at(-1).year;
    expect(counts.stops).toBe(d.manifest.observed.length + (2050 - latest));
    await expect(page.locator('.compass .petal')).toHaveCount(d.wind.sand_rose.length);
    const ticks = await page.locator('.tl-tick.observed').count();
    expect(ticks).toBe(d.manifest.observed.length);
  }
});

// 4 -------------------------------------------------------------------------------------------
for (const id of SITES) {
  test(`4 · dune cards complete; below-limit reads "< X m/yr" (${id})`, async ({ page }) => {
    await boot(page);
    await switchSite(page, id);
    const d = siteData(id);
    const detected = d.dunes.features.find((f) => !f.properties.below_detection_limit);
    const below = d.dunes.features.find((f) => f.properties.below_detection_limit);
    for (const f of [detected, below].filter(Boolean)) {
      const p = f.properties;
      await clickFeature(page, 'dune', p.id);
      const card = page.locator('#panel-card');
      await expect(card).toContainText(`Dune ${p.id}`);
      for (const label of ['Speed', 'Heading', 'Uncertainty', 'Confidence', 'Height', 'Area', 'Wind agreement', 'Nearest target', 'Reach years', 'Threat']) {
        await expect(card.locator('dt', { hasText: label }).first()).toBeVisible();
      }
      await expect(card).toContainText('NASADEM, Feb 2000');
      const text = await card.innerText();
      if (p.below_detection_limit) {
        expect(text).toContain(`< ${fx(p.detection_limit_myr)} m/yr`);
        expect(text).toContain('below detection limit');
        expect(text).not.toMatch(/(^|[^.\d])0(\.0+)? m\/yr/);
        expect(text).toContain('not measurable');
      } else {
        expect(text).toContain(`${fx(p.speed_med_myr)} (${fx(p.speed_lo_myr)}–${fx(p.speed_hi_myr)}) m/yr`);
      }
      expect(await hudText(page)).not.toMatch(BAD_TEXT);
    }
  });
}

// 5 -------------------------------------------------------------------------------------------
for (const id of SITES) {
  test(`5 · target and arrow cards complete (${id})`, async ({ page }) => {
    await boot(page);
    await switchSite(page, id);
    const d = siteData(id);
    const hit = d.targets.features.find((f) => Number.isFinite(f.properties.hit_year_min) && f.properties.approach);
    await clickFeature(page, 'target', hit.properties.id);
    const card = page.locator('#panel-card');
    await expect(card.locator('h3')).toContainText(hit.properties.name.slice(0, 20));
    for (const label of ['Type', 'Status', 'Reach years', 'Gap', 'Free sand']) await expect(card.locator('dt', { hasText: label }).first()).toBeVisible();
    await expect(card).toContainText(String(hit.properties.hit_year_min));
    await expect(card).toContainText('Fast case');
    await expect(card).toContainText('Source:');
    expect(await hudText(page)).not.toMatch(BAD_TEXT);

    await clickFeature(page, 'arrow', 'v:0');
    const v = d.vectors.features[0].properties;
    await expect(card).toContainText('Motion window');
    await expect(card).toContainText(`${fx(v.speed_myr)} ± ${fx(v.uncertainty_myr)} m/yr`);
    await expect(card).toContainText(`${fx(v.detection_limit_myr)} m/yr at this window`);
    await expect(card).toContainText(`${Math.round(v.heading_deg) % 360}°`);
    await expect(card).toContainText('Quality');
    expect(await hudText(page)).not.toMatch(BAD_TEXT);

    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
  });
}

// arrow geometry ----------------------------------------------------------------------------------
test('arrows point along heading_deg (heading 90 points east on screen, north up)', async ({ page }) => {
  await boot(page);
  for (const id of SITES) {
    await switchSite(page, id);
    const feats = siteData(id).vectors.features;
    const i = feats.reduce((best, f, k) => (Math.abs(f.properties.heading_deg - 90) < Math.abs(feats[best].properties.heading_deg - 90) ? k : best), 0);
    await page.evaluate((vid) => window.__ds.frameFeature('arrow', vid), `v:${i}`);
    const ends = await page.evaluate((vid) => window.__ds.arrowEnds(vid), `v:${i}`);
    const dx = ends.tip.x - ends.tail.x;
    const dy = ends.tip.y - ends.tail.y;
    const screenHeading = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    expect(Math.abs(screenHeading - ends.heading)).toBeLessThan(3);
  }
});

// 6 -------------------------------------------------------------------------------------------
for (const id of SITES) {
  test(`6 · timeline end to end: frame labels, PROJECTED badge, displacement, gap (${id})`, async ({ page }) => {
    await boot(page);
    await switchSite(page, id);
    const d = siteData(id);
    const m = d.manifest;
    // the observation gap is a gap, with no ticks inside it
    const years = m.observed.map((o) => o.year);
    const firstGap = years.findIndex((y, k) => k > 0 && y - years[k - 1] > 1);
    if (firstGap > 0) {
      const a = years[firstGap - 1] + 1;
      const b = years[firstGap] - 1;
      if (b - a >= 3) await expect(page.locator('.tl-gap').first()).toContainText(`no scenes ${a}–${b}`);
    }
    const tickYears = await page.locator('.tl-tick.observed').evaluateAll((els) => els.length);
    expect(tickYears).toBe(years.length);

    // step through every stop from the first
    await page.evaluate((y) => window.__ds.goYear(y), years[0]);
    const n = await page.evaluate(() => window.__ds.timeline.model.stops.length);
    for (let k = 0; k < n; k++) {
      const stop = await page.evaluate(() => {
        const s = window.__ds.timeline.stop;
        return { year: s.year, kind: s.kind, frameYear: s.med?.year ?? null };
      });
      const label = await page.locator('.tl-label').innerText();
      const badge = await page.locator('.badge').innerText();
      expect(label).not.toMatch(BAD_TEXT);
      if (stop.kind === 'observed') {
        const o = m.observed.find((x) => x.year === stop.year);
        expect(badge).toContain('OBSERVED');
        expect(label).toContain(o.sensor);
        expect(label).toContain(`${o.pixel_m} m pixel`);
        expect(label).toMatch(new RegExp(`\\b\\d{1,2} [A-Z][a-z]{2} ${o.date.slice(0, 4)}\\b`));
        expect(label).toContain(o.scene_id);
      } else {
        expect(badge).toContain('PROJECTED');
        if (stop.frameYear) {
          const pm = m.projected_median.find((x) => x.year === stop.frameYear);
          expect(label).toContain('moving sand shifts a median');
          expect(label).toContain(`${pm.displacement.median_m.toFixed(1)} m`);
        }
      }
      if (k < n - 1) await page.click('[data-act="fwd"]');
    }
    // and it plays to the end on its own
    await page.evaluate(() => window.__ds.goYear(2045));
    await page.click('[data-act="play"]');
    await page.waitForFunction(() => window.__ds.timeline.stop.year === 2050 && !window.__ds.timeline.playing, null, { timeout: 20_000 });
    await expect(page.locator('.badge')).toContainText('PROJECTED');
  });
}

// 7 -------------------------------------------------------------------------------------------
for (const id of SITES) {
  test(`7 · targets turn hit-coloured exactly at hit_year_min (${id})`, async ({ page }) => {
    await boot(page);
    await switchSite(page, id);
    const d = siteData(id);
    const stops = await page.evaluate(() => window.__ds.timeline.model.stops.map((s) => s.year));
    const latest = d.manifest.observed.at(-1).year;
    const feats = d.targets.features.map((f) => f.properties).filter((p) => Number.isFinite(p.hit_year_min) && p.hit_year_min <= 2050);
    const edge = feats.find((p) => p.threat_status === 'sand_at_edge_now' && p.hit_year_min === latest && stops.includes(latest - 1));
    const later = feats.find((p) => p.threat_status === 'reached_by_2050' && p.hit_year_min > latest && stops.includes(p.hit_year_min - 1));
    const picks = [edge, later].filter(Boolean);
    expect(picks.length).toBeGreaterThanOrEqual(2);
    await page.click('[data-mode="threat"]'); // full target intensity: hit alpha 0.55-1.0 (pulsing), pending 0.32
    const STATUS_RGB = { sand_at_edge_now: [0xf8, 0x51, 0x49], reached_by_2050: [0xf0, 0x88, 0x3e] };
    for (const p of picks) {
      const Y = p.hit_year_min;
      await page.evaluate((y) => window.__ds.goYear(y), Y - 1);
      expect(await page.evaluate((t) => window.__ds.targetState(t), p.id)).toBe('pending');
      const before = await page.evaluate((t) => window.__ds.targetColor(t), p.id);
      await page.evaluate((y) => window.__ds.goYear(y), Y);
      expect(await page.evaluate((t) => window.__ds.targetState(t), p.id)).toBe('hit');
      const after = await page.evaluate((t) => window.__ds.targetColor(t), p.id);
      const rgb = STATUS_RGB[p.threat_status];
      for (let c = 0; c < 3; c++) expect(Math.abs(after[c] - rgb[c])).toBeLessThanOrEqual(2);
      expect(after[3]).toBeGreaterThanOrEqual(138); // bright: pulses between 55 % and 100 %
      expect(before[3]).toBeLessThanOrEqual(84); // faint (32 %) before the hit year
    }
  });
}

// 8 -------------------------------------------------------------------------------------------
test('8 · numbers carry units and every panel has a reachable source', async ({ page }) => {
  await boot(page);
  for (const sel of ['#panel-headline', '#panel-wind']) {
    await expect(page.locator(`${sel} .panel-src`)).toContainText('Source:');
    await expect(page.locator(`${sel} .panel-src [data-dossier]`)).toHaveCount(1);
  }
  // headline numbers: every decimal number is followed by a unit, %, or is a count in a labelled table
  const kpi = await page.locator('#panel-headline .kpi').innerText();
  expect(kpi).toMatch(/\d\.\d{2}\s*m\/yr/);
  // every decimal number in the fact rows is followed by its unit (the class-cutoff sentence, which
  // ends in "m/yr", is checked as a whole)
  const facts = await page.locator('#panel-headline .facts').evaluate((el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll('.fine').forEach((f) => f.remove());
    return c.innerText;
  });
  for (const m of facts.matchAll(/(\d+\.\d+)(\s*)(\S*)/g)) expect(`${m[1]}${m[2]}${m[3]}`).toMatch(/(m\/yr|yr\)?|%|m|°)/);
  const rule = await page.locator('#panel-headline .facts .fine').innerText();
  expect(rule.trim()).toMatch(/m\/yr$/);
  // the timeline label is the source line for the frame on screen
  await expect(page.locator('.tl-label')).toContainText('Landsat');
  // a source link opens the dossier on the right section
  await page.locator('#panel-headline .panel-src [data-dossier]').click();
  await expect(page.locator('#dossier')).toBeVisible();
  await expect(page.locator('#ds-uncertainty')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#dossier')).toBeHidden();
});

// 9 -------------------------------------------------------------------------------------------
test('9 · wind compass: sand rose, RDD, measured heading; without station_wind.json', async ({ page }) => {
  await boot(page);
  for (const id of SITES) {
    await switchSite(page, id);
    const d = siteData(id);
    await expect(page.locator('.compass .petal')).toHaveCount(d.wind.sand_rose.length);
    await expect(page.locator('.compass .arr-rdd')).toHaveCount(1);
    await expect(page.locator('.compass .arr-field')).toHaveCount(1);
    await expect(page.locator('.compass .arr-station')).toHaveCount(0);
    await expect(page.locator('#panel-wind')).toContainText(`${Math.round(d.wind.RDD_deg)}°`);
  }
});

test('9 · wind compass with a station_wind.json present', async ({ page }) => {
  const station = {
    has_usable_station: true,
    station: { name: 'TEST STATION', id: '00000099999', distance_km: 24, DP: 120.5, RDP: 60.1, RDD_deg: 12.5, RDP_DP: 0.5 },
    period: '2000-2024',
    merra2: { RDD_deg: 99.9 },
    note: 'Fixture for the e2e test: station RDD differs from MERRA-2.',
  };
  await page.route('**/data/sites.json', async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    for (const s of json.sites) s.files = { ...(s.files || {}), 'station_wind.json': 'real' };
    await route.fulfill({ response: res, json });
  });
  await page.route('**/station_wind.json', (route) => route.fulfill({ json: station }));
  await boot(page);
  await expect(page.locator('.compass .arr-station')).toHaveCount(1);
  await expect(page.locator('#panel-wind')).toContainText('TEST STATION');
  await expect(page.locator('#panel-wind')).toContainText('13° (NNE)');
});

// 10 ------------------------------------------------------------------------------------------
test('10 · dossier lists every source with links and the full limits; credits line; no NASA logos', async ({ page }) => {
  await boot(page);
  for (const id of SITES) {
    await switchSite(page, id);
    const d = siteData(id);
    await page.click('[data-act="dossier"]');
    const rows = page.locator('#ds-sources tbody tr');
    await expect(rows).toHaveCount(d.sources.length);
    for (let k = 0; k < d.sources.length; k++) {
      const s = d.sources[k];
      const row = rows.nth(k);
      await expect(row).toContainText(s.name);
      if (s.link) await expect(row.locator(`a[href="${s.link}"]`)).toHaveCount(1);
      if (s.doi) await expect(row.locator(`a[href="${s.doi}"]`)).toHaveCount(1);
    }
    await expect(page.locator('#ds-limits li')).toHaveCount(d.summary.limits.length);
    for (const l of d.summary.limits) await expect(page.locator('#ds-limits')).toContainText(l.slice(0, 60));
    for (const href of await page.locator('#dossier a[href^="http"]').evaluateAll((as) => as.map((a) => a.href))) expect(href).toMatch(/^https:\/\//);
    await page.click('#dossier [data-close]');
  }
  await expect(page.locator('#credits .credit-line')).toHaveText(CREDIT);
  const logos = await page.evaluate(() => [...document.querySelectorAll('img, svg image, [style*="background-image"]')].map((el) => el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('alt') || el.style.backgroundImage || ''));
  for (const l of logos) expect(l.toLowerCase()).not.toMatch(/nasa|meatball|insignia/);
});

test('10 · dossier source links resolve (network)', async ({ request }) => {
  const urls = new Set();
  for (const id of SITES) for (const s of siteData(id).sources) for (const u of [s.link, s.doi]) if (u) urls.add(u);
  const bad = [];
  for (const u of urls) {
    try {
      const r = await request.get(u, { timeout: 30_000, maxRedirects: 10, failOnStatusCode: false });
      if (r.status() >= 400 && r.status() !== 403) bad.push(`${r.status()} ${u}`);
    } catch (err) {
      bad.push(`ERR ${u} ${err.message.split('\n')[0]}`);
    }
  }
  expect(bad).toEqual([]);
});

// 11 ------------------------------------------------------------------------------------------
test('11 · no Cesium token: fallback basemap, all layers draw', async ({ page }) => {
  await boot(page, { url: 'http://localhost:5174/' });
  const bm = await page.evaluate(() => window.__ds.basemap());
  expect(bm.basemap).toContain('Esri');
  const counts = await page.evaluate(() => ({ t: window.__ds.layers().targets.ready, d: window.__ds.layers().dunes.ready, v: window.__ds.layers().vectors.ready }));
  expect(counts).toEqual({ t: true, d: true, v: true });
  await expect(page.locator('#credits')).toContainText('Esri');
});

test('11 · network blocked after load: local layers and frames still draw', async ({ page, context, errors }) => {
  await boot(page);
  await page.evaluate(() => window.__ds.layers().frames.preload);
  await context.setOffline(true);
  await page.evaluate(() => window.__ds.goYear(2040));
  await page.evaluate(() => window.__ds.setMode('threat'));
  await page.click('[data-act="home"]');
  await page.waitForTimeout(2500);
  const ok = await page.evaluate(() => {
    const L = window.__ds.layers();
    const layers = window.__ds.viewer.imageryLayers;
    const shown = [];
    for (let i = 0; i < layers.length; i++) {
      const l = layers.get(i);
      if (l.show && l.alpha > 0 && l.imageryProvider instanceof window.__ds.Cesium.SingleTileImageryProvider) shown.push(l.ready);
    }
    return { targets: L.targets.ready, dunes: L.dunes.ready, arrows: L.vectors.ready, frames: shown };
  });
  expect(ok.targets && ok.dunes && ok.arrows).toBe(true);
  expect(ok.frames.length).toBeGreaterThanOrEqual(2); // latest observed + tinted projection
  expect(ok.frames.every(Boolean)).toBe(true);
  await expect(page.locator('#basemap-note')).toBeVisible();
  await context.setOffline(false);
  // While offline the browser logs every failed basemap/terrain tile request; those are expected,
  // anything else is still an error.
  const expected = /ERR_INTERNET_DISCONNECTED|Failed to load resource/;
  errors.splice(0, errors.length, ...errors.filter((e) => !expected.test(e)));
});

// 12 ------------------------------------------------------------------------------------------
for (const [w, h] of [
  [1920, 1080],
  [1366, 768],
]) {
  test(`12 · layout at ${w}×${h}: panels inside the window and not overlapping`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    await page.evaluate(() => window.__ds.setMode('threat'));
    await page.locator('.threat-list [data-target]').first().click(); // opens a target card too
    await page.waitForTimeout(500);
    const rects = await page.evaluate(() =>
      ['#hud-header', '#panel-headline', '#panel-threats', '#panel-card', '#panel-wind', '#legend', '#timeline', '#credits']
        .map((s) => [s, document.querySelector(s)])
        .filter(([, el]) => el && !el.hidden && el.offsetParent !== null)
        .map(([s, el]) => {
          const r = el.getBoundingClientRect();
          return { s, x: r.x, y: r.y, r: r.right, b: r.bottom, h: r.height };
        }),
    );
    for (const a of rects) {
      expect(a.x, a.s).toBeGreaterThanOrEqual(0);
      expect(a.y, a.s).toBeGreaterThanOrEqual(0);
      expect(a.r, a.s).toBeLessThanOrEqual(w + 0.5);
      expect(a.b, a.s).toBeLessThanOrEqual(h + 0.5);
      expect(a.h, `${a.s} has some height`).toBeGreaterThan(20);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = Math.min(a.r, b.r) - Math.max(a.x, b.x) > 1 && Math.min(a.b, b.b) - Math.max(a.y, b.y) > 1;
        expect(overlap, `${a.s} overlaps ${b.s}`).toBe(false);
      }
    }
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    expect(scroll[0]).toBeLessThanOrEqual(w);
    expect(scroll[1]).toBeLessThanOrEqual(h);
    expect(await hudText(page)).not.toMatch(BAD_TEXT);
    await page.screenshot({ path: `test-results/layout-${w}x${h}.png` });
  });
}

// 13 ------------------------------------------------------------------------------------------
test('13 · full run-through of each site without console errors', async ({ page }) => {
  await boot(page, { skipFlyIn: false });
  await page.waitForFunction(() => window.__ds.marks['flyin-done'], null, { timeout: 30_000 });
  for (const id of SITES) {
    await switchSite(page, id);
    for (const mode of ['true', 'motion', 'threat']) {
      await page.click(`[data-mode="${mode}"]`);
      expect(await hudText(page)).not.toMatch(BAD_TEXT);
    }
    await page.click('[data-act="topdown"]');
    for (const y of [2000, 2013, 2027, 2030, 2050]) {
      await page.evaluate((yy) => window.__ds.goYear(yy), y);
      expect(await hudText(page)).not.toMatch(BAD_TEXT);
    }
    await page.check('[data-opt="showChange"]');
    await page.selectOption('[data-opt="hitRule"]', 'med');
    await page.locator('.threat-list [data-target]').first().click();
    await expect(page.locator('#panel-card')).toBeVisible();
    await page.locator('[data-toggle="exposed"]').check();
    await page.click('[data-mode="motion"]');
    await page.locator('[data-factor="4"]').click();
    await page.locator('[data-toggle="thenNow"]').check();
    await page.click('[data-act="dossier"]');
    await page.keyboard.press('Escape');
    await page.uncheck('[data-opt="showChange"]');
    await page.selectOption('[data-opt="hitRule"]', 'min');
    await page.click('[data-act="topdown"]');
    expect(await hudText(page)).not.toMatch(BAD_TEXT);
  }
});
