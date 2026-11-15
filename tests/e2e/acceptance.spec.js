// Acceptance tests from docs/build-spec.md section 8 (the automatable ones) plus the redesigned-UI checks, run against the real data files.
import { test, expect, boot, switchSite, hudText, BAD_TEXT, clickFeature, siteIds, siteData, sitesIndex, fx, panelText, token, fieldHeading, apart } from './helpers.js';

const SITES = siteIds();
const DEFAULT_SITE = sitesIndex().default_site;
const CREDIT = 'Supported by the Michigan Space Grant Consortium, NASA grant 80NSSC20M0124.';
const HOW = '.ds-header [data-action="howWeKnow"]';
const CARD = '.ds-panel--card';
const SPEED = '.ds-panel--speed';
const WIND = '.ds-panel--wind';

test.afterEach(async ({ errors }, testInfo) => {
  expect(errors, `console errors during "${testInfo.title}"`).toEqual([]);
});

const setMode = (page, m) => page.click(`.ds-header [data-mode="${m}"]`);
const shown = (page) => page.evaluate(() => window.__ds.shown());
/** Display-only frames (Landsat 7 with scan-line gaps, image only) and the years left with no frame at all. */
const displayOnly = (m) => (m.observed_display_only || []).slice().sort((a, b) => a.year - b.year);
const frameGaps = (m) => {
  const ys = [...m.observed.map((o) => o.year), ...displayOnly(m).map((o) => o.year)].sort((a, b) => a - b);
  const gaps = [];
  for (let k = 1; k < ys.length; k++) if (ys[k] - ys[k - 1] > 1) gaps.push([ys[k - 1] + 1, ys[k] - 1]);
  return gaps;
};
/** Years named in a label such as "No scene: 2002, 2004, 2006–07, 2009–10, 2018". */
const namedYears = (text) => {
  const out = [];
  for (const [, a, b] of String(text).matchAll(/(\d{4})(?:–(\d{2,4}))?/g)) {
    const end = b ? (b.length === 2 ? Math.floor(+a / 100) * 100 + +b : +b) : +a;
    for (let y = +a; y <= end; y++) out.push(y);
  }
  return out;
};

// 1 + 2 ---------------------------------------------------------------------------------------
test('1/2 · loads cleanly; HUD and site box within 5 s', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('DuneSight');
  await page.waitForFunction(() => window.__ds?.marks && Object.keys(window.__ds.marks).some((k) => k.startsWith('box:')), null, { timeout: 60_000 });
  const marks = await page.evaluate(() => window.__ds.marks);
  console.log(`    timings (ms since navigation): ${JSON.stringify(marks)}`);
  await expect(page.locator('.ds-brand')).toContainText('DuneSight');
  for (const id of SITES) await expect(page.locator(`.ds-header [data-site="${id}"]`)).toBeVisible();
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
    await expect(page.locator(`.ds-header [data-site="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${SPEED} .ds-lead`)).toContainText(`${fx(d.summary.speed_median_myr)} m a year`);
    const counts = await page.evaluate(() => {
      const L = window.__ds.layers();
      return { targets: L.targets.count, dunes: L.dunes.count, arrows: L.vectors.count, stops: window.__ds.timeline.model.stops.length };
    });
    expect(counts.targets).toBe(d.targets.features.length);
    expect(counts.dunes).toBe(d.dunes.features.length);
    expect(counts.arrows).toBe(d.vectors.features.length);
    const latest = d.manifest.observed.at(-1).year;
    expect(counts.stops).toBe(d.manifest.observed.length + displayOnly(d.manifest).length + (2050 - latest));
    await expect(page.locator('.ds-compass .ds-petal')).toHaveCount(d.wind.sand_rose.length);
    // timeline scene ticks are exactly the manifest's observed years (Liwa has 2018 and no 2016; the others the reverse)
    const scenes = await page.locator('.ds-track__scene').evaluateAll((els) => els.map((e) => +e.dataset.scene));
    expect(scenes).toEqual(d.manifest.observed.map((o) => o.year));
    // display-only images have their own ticks, never the measured style
    const images = await page.locator('.ds-track__image').evaluateAll((els) => els.map((e) => +e.dataset.image));
    expect(images).toEqual(displayOnly(d.manifest).map((o) => o.year));
    const frames = await page.locator('.ds-track__frame').evaluateAll((els) => els.map((e) => +e.dataset.frame));
    expect(frames).toEqual(d.manifest.projected_median.map((p) => p.year));
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
      const card = page.locator(CARD);
      await expect(card).toContainText(`Dune ${p.id}`);
      for (const label of ['Speed', 'Heading', 'Uncertainty', 'Confidence', 'Height', 'Area', 'Wind agreement', 'Nearest target', 'Reach years', 'Threat']) {
        await expect(card.locator('dt', { hasText: label }).first()).toBeVisible();
      }
      await expect(card).toContainText('NASADEM, Feb 2000');
      await expect(card).toContainText('Source:');
      const text = await card.innerText();
      if (p.below_detection_limit) {
        expect(text).toContain(`< ${fx(p.detection_limit_myr)} m/yr`);
        expect(text).toContain('below detection limit');
        expect(text).not.toMatch(/(^|[^.\d])0(\.0+)? m\/yr/);
        expect(text).toContain('not measurable');
      } else {
        expect(text).toContain(`${fx(p.speed_med_myr)} (${fx(p.speed_lo_myr)}–${fx(p.speed_hi_myr)}) m/yr`);
      }
      // motion around a large dune is not presented as the motion of its body
      expect(text.toLowerCase()).toContain('not only the dune body');
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
    await setMode(page, 'threat');
    await clickFeature(page, 'target', hit.properties.id);
    const card = page.locator(CARD);
    await expect(card.locator('h2')).toContainText(hit.properties.name.slice(0, 20));
    for (const label of ['Type', 'Status', 'Reach years', 'Gap', 'Free sand']) await expect(card.locator('dt', { hasText: label }).first()).toBeVisible();
    await expect(card).toContainText(String(hit.properties.hit_year_min));
    await expect(card).toContainText('Fast case');
    await expect(card).toContainText('Source:');
    expect(await hudText(page)).not.toMatch(BAD_TEXT);

    await setMode(page, 'motion');
    await clickFeature(page, 'arrow', 'v:0');
    const v = d.vectors.features[0].properties;
    await expect(card).toContainText('Motion window');
    await expect(card).toContainText(`${fx(v.speed_myr)} ± ${fx(v.uncertainty_myr)} m/yr`);
    await expect(card).toContainText(`${fx(v.detection_limit_myr)} m/yr at this window`);
    await expect(card).toContainText(`${Math.round(v.heading_deg) % 360}°`);
    await expect(card).toContainText('Quality');
    await expect(card).toContainText('PROJECTED');
    expect(await hudText(page)).not.toMatch(BAD_TEXT);

    await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    // the close button clears it too
    await page.evaluate(() => window.__ds.select('arrow', 'v:0'));
    await page.click(`${CARD} [data-action="clearSelection"]`);
    await expect(card).toHaveCount(0);
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
  test(`6 · timeline end to end: frame labels, PROJECTED tag, displacement, gaps (${id})`, async ({ page }) => {
    await boot(page);
    await switchSite(page, id);
    const d = siteData(id);
    const m = d.manifest;
    // every year with no frame at all (measured or image-only) is drawn as a gap, a long one labelled
    const gaps = frameGaps(m);
    await expect(page.locator('.ds-track__gap')).toHaveCount(gaps.length);
    for (const [a, b] of gaps) {
      if (b - a >= 2) await expect(page.locator('.ds-track__gap', { hasText: `no scenes ${a}–${b}` })).toHaveCount(1);
      else await expect(page.locator('.ds-track__gap--short', { hasText: `no scene ${a}` })).toHaveCount(1);
    }
    // the gap label names exactly the empty years, computed from the data
    if (displayOnly(m).length) {
      const note = await page.locator('[data-gapnote]').innerText();
      expect(namedYears(note.replace(/^[^N]*(?=No scene)/, ''))).toEqual(gaps.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)));
      if (!gaps.length) expect(note).not.toContain('No scene');
    }
    const years = [...m.observed.map((o) => o.year), ...displayOnly(m).map((o) => o.year)].sort((a, b) => a - b);
    await expect(page.locator('.ds-track__scene')).toHaveCount(m.observed.length);
    await expect(page.locator('.ds-track__image')).toHaveCount(displayOnly(m).length);

    // step through every stop from the first
    await page.evaluate((y) => window.__ds.goYear(y), years[0]);
    const n = await page.evaluate(() => window.__ds.timeline.model.stops.length);
    for (let k = 0; k < n; k++) {
      const stop = await page.evaluate(() => {
        const s = window.__ds.timeline.stop;
        return { year: s.year, kind: s.kind, frameYear: s.med?.year ?? null };
      });
      const label = await page.locator('[data-readout]').innerText();
      const when = await page.locator('[data-when]').innerText();
      expect(label).not.toMatch(BAD_TEXT);
      expect(label).toContain(String(stop.year));
      if (stop.kind === 'observed') {
        const o = m.observed.find((x) => x.year === stop.year);
        expect(when).toContain('MEASURED');
        expect(label).toContain('MEASURED');
        expect(label).toContain(o.sensor);
        expect(label).toContain(`${o.pixel_m} m pixel`);
        expect(label).toMatch(new RegExp(`\\b\\d{1,2} [A-Z][a-z]{2} ${o.date.slice(0, 4)}\\b`));
        expect(label).toContain(o.scene_id);
        // the full line is on screen, not cut off
        expect(await page.locator('[data-readout]').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
        expect(when).not.toContain('IMAGE ONLY');
        const sh = await shown(page);
        expect(sh.imageTag).toBe(false);
        expect(sh.vectors).toBe(true); // motion view: arrows on every measured year, as before
        expect(sh.frames.base).toBe(`raw:${o.file}`);
      } else if (stop.kind === 'display') {
        // image only: plainly not a measurement, with date, sensor, pixel size, scene id, and what the stripes are
        const o = displayOnly(m).find((x) => x.year === stop.year);
        expect(o.use).toBe('display_only');
        expect(when).toContain('IMAGE ONLY');
        expect(when).toContain('not used for measurement');
        expect(when).toContain('Landsat 7');
        expect(when).not.toContain('MEASURED');
        expect(label).toContain('IMAGE ONLY');
        expect(label).toContain('not used for measurement');
        expect(label).not.toContain('MEASURED');
        expect(label).toContain(o.sensor);
        expect(label).toContain(`${o.pixel_m} m pixel`);
        expect(label).toMatch(new RegExp(`\\b\\d{1,2} [A-Z][a-z]{2} ${o.date.slice(0, 4)}\\b`));
        expect(label).toContain(o.scene_id);
        // stripes are mentioned only for a frame that has them (read from its own data, not from its year)
        expect(label.includes('missing data') && label.includes('31 May 2003')).toBe(o.has_scan_line_gaps);
        expect(when.includes('striped gaps')).toBe(o.has_scan_line_gaps);
        // an off-month frame says its month and its sun against the November range; a November frame says neither
        expect(label.includes(`(${o.month}, not November)`)).toBe(o.off_month);
        expect(when.includes(`${o.month} image, not November`)).toBe(o.off_month);
        if (o.off_month) {
          const [a, b] = o.november_sun_elevation_range_deg;
          expect(label).toContain(`sun ${o.sun_elevation_deg.toFixed(1)}° high, against ${a.toFixed(1)}–${b.toFixed(1)}° in the November images`);
          expect(label).toContain('not sand movement');
          await expect(page.locator('[data-offmonth-legend]')).toContainText(`Taken in ${o.month}, not November`);
        } else {
          expect(label).not.toContain('not November');
          await expect(page.locator('[data-offmonth-legend]')).toHaveCount(0);
        }
        expect(await page.locator('[data-readout]').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
        const sh = await shown(page);
        expect(sh.imageTag).toBe(true);
        expect(sh.projectedTag).toBe(false);
        expect(sh.vectors).toBe(false); // the 2013-2025 arrows and outlines are not drawn on these images
        expect(sh.dunes).toBe(false);
        expect(sh.frames.base).toBe(`nodata:${o.file}`); // stripes painted as the no-data hatch
        if (o.has_scan_line_gaps) await expect(page.locator('[data-image-legend]')).toContainText('Hatched stripes: no data');
        else await expect(page.locator('[data-image-legend]')).not.toContainText('Hatched stripes');
      } else {
        expect(when).toContain('PROJECTED');
        expect(label).toContain('PROJECTED');
        if (stop.frameYear) {
          const pm = m.projected_median.find((x) => x.year === stop.frameYear);
          expect(label).toContain('moving sand shifts a median');
          expect(label).toContain(`${pm.displacement.median_m.toFixed(1)} m`);
        }
        expect(await page.evaluate(() => window.__ds.shown().projectedTag)).toBe(true);
      }
      if (k < n - 1) await page.click('[data-step="1"]');
    }
    // and it plays to the end on its own
    await page.evaluate(() => window.__ds.goYear(2045));
    await page.click('[data-play]');
    await page.waitForFunction(() => window.__ds.timeline.stop.year === 2050 && !window.__ds.timeline.playing, null, { timeout: 20_000 });
    await expect(page.locator('[data-when]')).toContainText('PROJECTED');
    // keyboard: arrows step, Space plays
    await page.locator('.ds-brand').click();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => page.evaluate(() => window.__ds.timeline.stop.year)).toBe(2049);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__ds.timeline.stop.year === 2050 && !window.__ds.timeline.playing, null, { timeout: 20_000 });
  });
}

// display-only frames ---------------------------------------------------------------------------
test('display-only Landsat 7 frames: tagged in the data, never a measured year, listed as their own stops at every site', async ({ page }) => {
  await boot(page);
  for (const id of SITES) {
    const d = siteData(id);
    const m = d.manifest;
    for (const o of m.observed) expect(['measurement', 'long_baseline_check']).toContain(o.use);
    expect(m.observed.filter((o) => o.use === 'measurement').every((o) => !/Landsat 7/.test(o.sensor))).toBe(true);
    const disp = displayOnly(m);
    expect(disp.length, `${id} has display-only frames`).toBeGreaterThan(0);
    const measuredYears = new Set(m.observed.map((o) => o.year));
    for (const o of disp) {
      expect(o.use).toBe('display_only');
      expect(o.used_for_measurement).toBe(false);
      expect(measuredYears.has(o.year)).toBe(false);
      expect(o.sensor).toMatch(/^Landsat 7/);
      // stripes: from the frame's own data; a scene before the scan-line-corrector failure has none
      if (o.date < '2003-05-31') expect(o.has_scan_line_gaps).toBe(false);
      expect(o.has_scan_line_gaps).toBe(o.nodata_scan_line_gaps_pct >= 0.5);
      expect(/stripes with no data/.test(o.note)).toBe(o.has_scan_line_gaps);
      // off-month: from the date; it carries its month, days from 15 November and the sun note
      expect(o.off_month).toBe(o.date.slice(5, 7) !== '11');
      expect(o.month).toBe(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+o.date.slice(5, 7) - 1]);
      expect(o.days_from_15_november).toBe(Math.round((Date.parse(o.date) - Date.parse(`${o.date.slice(0, 4)}-11-15`)) / 86400000));
      if (o.off_month) {
        expect(o.sun_note).toContain(`${o.sun_elevation_deg.toFixed(1)} deg`);
        expect(o.sun_note).toContain('not sand movement');
        const nov = [...m.observed, ...disp].filter((x) => x.date.slice(5, 7) === '11').map((x) => x.sun_elevation_deg);
        // rounded to 0.1 deg by the pipeline (ties may round either way)
        expect(Math.abs(o.november_sun_elevation_range_deg[0] - Math.min(...nov))).toBeLessThanOrEqual(0.051);
        expect(Math.abs(o.november_sun_elevation_range_deg[1] - Math.max(...nov))).toBeLessThanOrEqual(0.051);
      } else expect(o.sun_note).toBeUndefined();
    }
    expect(d.summary.frames.n_display_only).toBe(disp.length);
    expect(d.summary.frames.display_only_off_month_years).toEqual(disp.filter((o) => o.off_month).map((o) => o.year));
    expect(d.summary.frames.n_observed).toBe(m.observed.length);
    // the Landsat 7 source entry says what the display-only dates are for
    const l7 = d.sources.find((x) => /^Landsat 7/.test(x.name));
    expect(l7.dates_by_use.display_only_frames).toEqual(disp.map((o) => o.date));
    expect(l7.dates_by_use.display_only_off_month_frames).toEqual(disp.filter((o) => o.off_month).map((o) => o.date));
    expect(l7.used_for).toMatch(/display-only/);
    await switchSite(page, id);
    const stops = await page.evaluate(() => window.__ds.timeline.model.stops.map((st) => [st.year, st.kind]));
    expect(stops.filter(([, k]) => k === 'display').map(([y]) => y)).toEqual(disp.map((o) => o.year));
    expect(await page.locator('.ds-track__image--off').evaluateAll((els) => els.map((e) => +e.dataset.image))).toEqual(disp.filter((o) => o.off_month).map((o) => o.year));
    expect(stops.filter(([, k]) => k === 'observed').map(([y]) => y)).toEqual(m.observed.map((o) => o.year));
    // a measured year after an image-only year shows the arrows again
    await page.evaluate((y) => window.__ds.goYear(y), disp[0].year);
    expect((await shown(page)).vectors).toBe(false);
    await page.evaluate((y) => window.__ds.goYear(y), m.observed.at(-1).year);
    expect((await shown(page)).vectors).toBe(true);
    expect((await shown(page)).dunes).toBe(true);
  }
});

// 7 -------------------------------------------------------------------------------------------
for (const id of SITES) {
  test(`7 · targets turn hit-coloured exactly at their reach year, fast and median case (${id})`, async ({ page }) => {
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
    await setMode(page, 'threat'); // full target intensity: hit alpha 0.55-1.0 (pulsing), pending 0.32
    const STATUS_RGB = { sand_at_edge_now: token('ds-threat-now'), reached_by_2050: token('ds-threat-2050') };
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
      expect(before[3]).toBeLessThanOrEqual(84); // faint (32 %) before the reach year
    }
    // median case: a target whose median reach year is a projected stop turns at that year instead
    const med = d.targets.features.map((f) => f.properties).find((p) => p.threat_status === 'reached_by_2050' && Number.isFinite(p.hit_year_med) && p.hit_year_med > p.hit_year_min && p.hit_year_med > latest && p.hit_year_med <= 2050 && stops.includes(p.hit_year_med - 1));
    if (med) {
      await page.click('[data-gear]');
      await page.selectOption('[data-setting="reachCase"]', 'median');
      await page.evaluate((y) => window.__ds.goYear(y), med.hit_year_med - 1);
      expect(await page.evaluate((t) => window.__ds.targetState(t), med.id)).toBe('pending');
      await page.evaluate((y) => window.__ds.goYear(y), med.hit_year_med);
      expect(await page.evaluate((t) => window.__ds.targetState(t), med.id)).toBe('hit');
      await expect(page.locator('.ds-panel--legend')).toContainText('median reach year');
    } else console.log(`    ${id}: no reached_by_2050 target with a later projected median year; median case not exercised here`);
  });
}

// 8 -------------------------------------------------------------------------------------------
test('8 · numbers carry units and every panel has a reachable source', async ({ page }) => {
  await boot(page);
  for (const sel of [SPEED, WIND]) {
    await expect(page.locator(`${sel} .ds-src`)).toContainText('Source:');
    await expect(page.locator(`${sel} .ds-src [data-dossier]`)).toHaveCount(1);
  }
  const lead = await page.locator(`${SPEED} .ds-lead`).innerText();
  expect(lead).toMatch(/\d\.\d{2} m a year/);
  // every decimal number in the speed panel's range key and details carries a unit
  await page.click(`${SPEED} [data-details="speed"]`);
  for (const part of [`${SPEED} .ds-range__key`, `${SPEED} .ds-dl`, `${WIND} .ds-lead`]) {
    // a range "0.44–1.14 m/yr" carries its unit after the second number
    const txt = (await page.locator(part).innerText()).replace(/(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?)/g, '$2');
    for (const mm of txt.matchAll(/(\d+\.\d+)(\s*)(\S*)/g)) expect(`${mm[1]}${mm[2]}${mm[3]}`, part).toMatch(/(m\/yr|yr\)?|%|m\b|°|×)/);
  }
  // the timeline readout is the source line for the frame on screen
  await expect(page.locator('[data-readout]')).toContainText('Landsat');
  // a source link opens the dossier on the right section
  await page.locator(`${SPEED} .ds-src [data-dossier]`).click();
  await expect(page.locator('#dossier')).toBeVisible();
  await expect(page.locator('#ds-uncertainty')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#dossier')).toBeHidden();
});

// 9 -------------------------------------------------------------------------------------------
test('9 · wind compass: 16 real sectors, RDD, measured heading; station arrow only where station_wind.json is published', async ({ page }) => {
  await boot(page);
  const withStation = SITES.filter((id) => siteData(id).station);
  const without = SITES.filter((id) => !siteData(id).station);
  expect(without.length, 'at least one site without a station file').toBeGreaterThan(0);
  for (const id of SITES) {
    await switchSite(page, id);
    const d = siteData(id);
    const entry = sitesIndex().sites.find((s) => s.id === id);
    expect(Object.prototype.hasOwnProperty.call(entry.files, 'station_wind.json')).toBe(!!d.station);
    // petals are the published sectors (FROM direction), in order, with their drift potential
    const titles = await page.locator('.ds-compass .ds-petal title').allTextContents();
    expect(titles).toEqual(d.wind.sand_rose.map((s) => `Wind from ${s.sector_deg.toFixed(1)}°: drift potential ${s.dp.toFixed(2)} VU/yr`));
    await expect(page.locator('.ds-compass .ds-arr-rdd')).toHaveCount(1);
    await expect(page.locator('.ds-compass .ds-arr-dune')).toHaveCount(1);
    await expect(page.locator(WIND)).toContainText(`${Math.round(d.wind.RDD_deg)}°`);
    await expect(page.locator('.ds-compass .ds-arr-station')).toHaveCount(d.station ? 1 : 0);
    await page.click(`${WIND} [data-details="wind"]`);
    if (d.station) {
      const st = d.station.station;
      const wind = page.locator(WIND);
      await expect(wind).toContainText(st.name);
      await expect(wind).toContainText(`toward ${Math.round(st.RDD_deg)}°`);
      await expect(wind).toContainText(`${Math.round(st.distance_km)} km`);
      await expect(wind).toContainText(`its DP ${Math.round(st.DP)} VU/yr (${st.dp_class})`);
      await expect(wind).toContainText(d.station.period);
      await expect(wind).toContainText('MERRA-2 stays the main wind figure');
      await expect(page.locator(`${WIND} .ds-src`)).toContainText('NOAA');
      const noaa = d.sources.find((x) => /NOAA Integrated Surface Database/.test(x.name));
      expect(noaa?.link).toMatch(/^https:\/\/www\.ncei\.noaa\.gov\//);
      expect(noaa.provider).toMatch(/not NASA/);
      await expect(page.locator('.ds-credit-data')).toContainText('NOAA ISD');
      expect(await page.locator('.ds-credit-data').innerText()).not.toMatch(/NASA \([^)]*NOAA/);
      await page.click(HOW);
      await expect(page.locator('#ds-station')).toContainText(d.station.note.slice(0, 60));
      for (const l of d.station.limits) await expect(page.locator('#ds-station')).toContainText(l.slice(0, 50));
      await page.click('#dossier [data-close]');
    } else {
      expect(d.sources.some((x) => /NOAA/.test(x.name))).toBe(false);
      await expect(page.locator(WIND)).not.toContainText('ground station');
      await page.click(HOW);
      await expect(page.locator('#ds-station')).toContainText('No ground-station wind comparison is published for this site');
      await page.click('#dossier [data-close]');
    }
  }
  expect(withStation.length + without.length).toBe(SITES.length);
});

test('9 · station fixture with the published shape; a not-representative flag hides the arrow', async ({ page }) => {
  const real = siteData(SITES.find((id) => siteData(id).station) || SITES[0]).station;
  test.skip(!real, 'no published station file to take the shape from');
  const station = JSON.parse(JSON.stringify(real));
  station.station.name = 'TEST STATION';
  station.station.RDD_deg = 12.5;
  station.note = 'Fixture for the e2e test: station RDD differs from MERRA-2.';
  let flagged = false;
  await page.route('**/data/sites.json', async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    for (const s of json.sites) s.files = { ...(s.files || {}), 'station_wind.json': 'real' };
    await route.fulfill({ response: res, json });
  });
  await page.route('**/station_wind.json', (route) => route.fulfill({ json: flagged ? { ...station, representative: false } : station }));
  await boot(page);
  await expect(page.locator('.ds-compass .ds-arr-station')).toHaveCount(1);
  await expect(page.locator(WIND)).toContainText('TEST STATION');
  await expect(page.locator(WIND)).toContainText('13° NNE');
  flagged = true;
  const other = SITES.find((id) => id !== DEFAULT_SITE);
  await switchSite(page, other);
  await expect(page.locator('.ds-compass .ds-arr-station')).toHaveCount(0);
  await expect(page.locator(WIND)).not.toContainText('TEST STATION');
});

// the wind sentence and the heading come from each site's data ----------------------------------------
test('wind: the lead sentence follows each site\'s data (agree / close / disagree), one heading per site', async ({ page }) => {
  await boot(page);
  const leads = new Set();
  for (const id of SITES) {
    await switchSite(page, id);
    const d = siteData(id);
    const h = fieldHeading(d);
    expect(h, `${id}: field heading published in summary.wind_agreement_note`).not.toBeNull();
    const rdd = d.wind.RDD_deg;
    const a = Math.round(apart(h, rdd));
    const lead = page.locator(`${WIND} [data-wind-lead]`);
    await expect(lead).toContainText(`${a}° apart`);
    const text = await lead.innerText();
    leads.add(text);
    if (a <= 20) expect(text).toContain('the dunes move the same way');
    else if (a <= 45) expect(text).toContain('close, but not the same');
    else expect(text).toContain('but the dunes are moving');
    // the same heading everywhere it is shown: speed lead, compass, wind lead, station note (where published)
    const H = Math.round(h);
    await expect(page.locator(`${SPEED} .ds-lead`)).toContainText(`(${H}°)`);
    await expect(page.locator('.ds-compass')).toContainText(`toward ${H}°`);
    if (a > 20) await expect(lead).toContainText(/north|south|east|west/);
    if (d.station?.dune_heading_deg != null) expect(Math.round(d.station.dune_heading_deg)).toBe(H);
    // the arrows' own vector mean is a different average; where shown it is labelled as such
    await page.click(`${WIND} [data-details="wind"]`);
    const det = await page.locator(`${WIND} .ds-dl`).innerText();
    expect(det).toContain(`${H}°: field median`);
    if (/arrows drawn on the map/.test(det)) expect(det).toMatch(/average \d+°, a different average of the same field/);
  }
  expect(leads.size).toBe(SITES.length);
});

// cross-check status next to the headline speed -------------------------------------------------
test('confirmation: speed panel shows how speed and heading are cross-checked, from summary.confirmation', async ({ page }) => {
  await boot(page);
  const words = { confirmed: 'confirmed', partly_confirmed: 'partly confirmed', not_confirmed: 'not confirmed' };
  const seen = new Set();
  for (const id of SITES) {
    await switchSite(page, id);
    const c = siteData(id).summary.confirmation;
    expect(c, `${id} summary.confirmation`).toBeTruthy();
    for (const [label, q] of [['speed', c.speed], ['heading', c.heading]]) {
      expect(Object.keys(words)).toContain(q.status);
      seen.add(q.status);
      const row = page.locator(`${SPEED} [data-confirm="${label}"]`);
      await expect(row).toHaveAttribute('data-status', q.status);
      await expect(row).toContainText(`${label[0].toUpperCase()}${label.slice(1)}: ${words[q.status]}.`);
      await expect(row).toContainText(q.short);
    }
    const s30 = c.checks.find((k) => k.id === 'hls_s30');
    if (s30) await expect(page.locator(`${SPEED} .ds-conf`)).toContainText(`${s30.speed_ratio.toFixed(2)}×`);
    await page.locator(`${SPEED} .ds-conf [data-dossier="crosschecks"]`).click();
    await expect(page.locator('#ds-crosschecks')).toBeVisible();
    await expect(page.locator('#ds-crosschecks tbody tr')).toHaveCount(c.checks.length);
    for (const k of c.checks) await expect(page.locator(`#ds-crosschecks tr[data-check="${k.id}"]`)).toContainText(k.name);
    await expect(page.locator('#ds-crosschecks')).toContainText(c.rule.slice(0, 60));
    await page.keyboard.press('Escape');
    expect(await hudText(page)).not.toMatch(BAD_TEXT);
  }
  expect(seen.size).toBeGreaterThan(1);
});

// the dossier opens with the docs/how-we-know.md panel text ------------------------------------
test('dossier opening text is the docs/how-we-know.md panel text (<= 150 words)', async ({ page }) => {
  const paras = panelText();
  expect(paras.length).toBeGreaterThan(0);
  expect(paras.join(' ').split(/\s+/).length).toBeLessThanOrEqual(150);
  await boot(page);
  for (const id of SITES) {
    await switchSite(page, id);
    await page.click(HOW);
    const shownParas = await page.locator('#ds-method .panel-text p').allInnerTexts();
    expect(shownParas.map((t) => t.replace(/\s+/g, ' ').trim())).toEqual(paras);
    await page.click('#dossier [data-close]');
  }
});

// dune labels do not overlap where dunes cluster --------------------------------------------------
test('dune labels are decluttered: no two visible labels overlap', async ({ page }) => {
  await boot(page);
  for (const id of SITES) {
    await switchSite(page, id);
    for (const top of [false, true]) {
      if (top) await page.click('[data-action="topDown"]');
      await page.click('[data-action="home"]');
      await page.waitForTimeout(2500);
      const boxes = await page.evaluate(() => window.__ds.layers().dunes.labelBoxes());
      expect(boxes.length, `${id}: some labels shown`).toBeGreaterThan(0);
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
          expect(overlap, `${id}: labels ${a.id} and ${b.id} overlap`).toBe(false);
        }
      if (top) {
        await expect(page.locator('[data-action="topDown"]')).toHaveAttribute('aria-pressed', 'true');
        await page.click('[data-action="topDown"]');
      }
    }
  }
});

// 10 ------------------------------------------------------------------------------------------
test('10 · dossier lists every source with links and the full limits; credits line; no NASA logos', async ({ page }) => {
  await boot(page);
  for (const id of SITES) {
    await switchSite(page, id);
    const d = siteData(id);
    await page.click(HOW);
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
    await expect(page.locator('#ds-credits')).toContainText('SIL Open Font License');
    expect(await page.locator('#dossier').innerText()).not.toMatch(BAD_TEXT);
    await page.click('#dossier [data-close]');
    // the footer names NASA data as NASA and nothing else as NASA
    const credits = await page.locator('.ds-credit-data').innerText();
    const nasaPart = (credits.match(/NASA \(([^)]*)\)/) || [])[1] || '';
    expect(nasaPart).not.toMatch(/WorldCover|NOAA|OpenStreetMap|ESA/);
    for (const s of d.sources.filter((x) => /not NASA/.test(x.provider || ''))) expect(credits).toMatch(new RegExp(`Not NASA: [^·]*${s.name.split(' ')[0]}`));
    expect(credits).not.toMatch(/\)\s*\(/); // no doubled brackets
  }
  await expect(page.locator('.ds-credit-line')).toHaveText(CREDIT);
  await page.click('.ds-footer [data-dossier="credits"]');
  await expect(page.locator('#ds-credits')).toBeVisible();
  await page.keyboard.press('Escape');
  const logos = await page.evaluate(() => [...document.querySelectorAll('img, svg image, [style*="background-image"]')].map((el) => el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('alt') || el.style.backgroundImage || ''));
  for (const l of logos) expect(l.toLowerCase()).not.toMatch(/nasa|meatball|insignia/);
});

/**
 * Each DOI must resolve (doi.org's own handle record) to the publisher page of that dataset, and each page must
 * answer. Some publishers (usgs.gov) refuse automated requests with 403 or 5xx: when that answer comes from the
 * expected publisher host it counts as a pass with a logged note, since the target URL itself was checked.
 */
test('10 · dossier source links resolve: each DOI to its publisher page (network)', async ({ request }) => {
  const PUBLISHER = { '10.5066': /(^|\.)usgs\.gov$/, '10.5067': /(^|\.)nasa\.gov$/, '10.5281': /(^|\.)zenodo\.org$/ };
  const token = (s) => {
    const m = `${s.name} ${s.doi || ''}`.match(/HLS[SL]30|M2T1NX[A-Z]{3}|NASADEM_HGT|Landsat \d(-\d)?|zenodo\.(\d+)/i);
    if (!m) return null;
    if (/^zenodo/i.test(m[0])) return m[2];
    return m[0].toLowerCase().replace(/[\s_]+/g, '-');
  };
  const sources = new Map();
  for (const id of SITES) for (const s of siteData(id).sources) sources.set(s.name, s);
  const bad = [];
  const notes = [];
  const get = async (u) => {
    const opts = { timeout: 30_000, maxRedirects: 10, failOnStatusCode: false, headers: { 'User-Agent': 'Mozilla/5.0 (DuneSight link check)' } };
    try {
      return await request.get(u, opts);
    } catch (err) {
      notes.push(`retried ${u} after: ${err.message.split('\n')[0]}`); // one retry for a timeout or reset; a second failure fails the test
      return request.get(u, opts);
    }
  };
  const fetchPage = async (u, expectHost) => {
    try {
      const r = await get(u);
      const host = new URL(r.url()).host;
      if (r.status() < 400) return;
      const blocked = r.status() === 403 || r.status() === 429 || r.status() >= 500;
      if (blocked && expectHost.test(host)) notes.push(`${r.status()} from ${host} for ${u} (bot block by the publisher; the URL is the expected page)`);
      else bad.push(`${r.status()} ${u} -> ${r.url()}`);
    } catch (err) {
      bad.push(`ERR ${u} ${err.message.split('\n')[0]}`);
    }
  };
  for (const s of sources.values()) {
    if (s.doi) {
      const doi = s.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
      const prefix = doi.split('/')[0];
      const res = await request.get(`https://doi.org/api/handles/${doi}?type=URL`, { timeout: 30_000, failOnStatusCode: false });
      const json = res.ok() ? await res.json() : null;
      const target = json?.values?.find((v) => v.type === 'URL')?.data?.value;
      if (!target) {
        bad.push(`DOI ${doi} has no URL record (HTTP ${res.status()})`);
        continue;
      }
      const host = new URL(target).host;
      if (!PUBLISHER[prefix]?.test(host)) bad.push(`DOI ${doi} points to ${host}, not its publisher`);
      const tk = token(s);
      if (!tk) bad.push(`no product token for ${s.name}`);
      else if (!target.toLowerCase().includes(tk)) bad.push(`DOI ${doi} -> ${target} is not the page of ${s.name} (expected "${tk}")`);
      console.log(`    DOI ${doi} -> ${target}`);
      await fetchPage(target, PUBLISHER[prefix] || /^$/);
    }
    if (s.link) {
      const host = new URL(s.link).host.replace(/^www\./, '');
      await fetchPage(s.link, new RegExp(`(^|\\.)${host.replace(/\./g, '\\.')}$`));
    }
  }
  for (const n of notes) console.log(`    note: ${n}`);
  expect(bad).toEqual([]);
});

// 11 ------------------------------------------------------------------------------------------
test('11 · no Cesium token: fallback basemap, all layers draw', async ({ page }) => {
  await boot(page, { url: process.env.E2E_NOTOKEN_URL || 'http://localhost:5174/' });
  const bm = await page.evaluate(() => window.__ds.basemap());
  expect(bm.basemap).toContain('Esri');
  const counts = await page.evaluate(() => ({ t: window.__ds.layers().targets.ready, d: window.__ds.layers().dunes.ready, v: window.__ds.layers().vectors.ready }));
  expect(counts).toEqual({ t: true, d: true, v: true });
  await expect(page.locator('.ds-footer')).toContainText('Esri');
});

test('11 · network blocked after load: local layers, frames and fonts still draw', async ({ page, context, errors }) => {
  await boot(page);
  await page.evaluate(() => window.__ds.layers().frames.preload);
  await context.setOffline(true);
  await page.evaluate(() => window.__ds.goYear(2040));
  await setMode(page, 'threat');
  await page.click('[data-action="home"]');
  await page.waitForTimeout(2500);
  const ok = await page.evaluate(() => {
    const L = window.__ds.layers();
    const layers = window.__ds.viewer.imageryLayers;
    const drawn = [];
    for (let i = 0; i < layers.length; i++) {
      const l = layers.get(i);
      if (l.show && l.alpha > 0 && l.imageryProvider instanceof window.__ds.Cesium.SingleTileImageryProvider) drawn.push(l.ready);
    }
    return { targets: L.targets.ready, dunes: L.dunes.ready, arrows: L.vectors.ready, frames: drawn };
  });
  expect(ok.targets && ok.dunes && ok.arrows).toBe(true);
  expect(ok.frames.length).toBeGreaterThanOrEqual(2); // latest observed + tinted projection
  expect(ok.frames.every(Boolean)).toBe(true);
  await expect(page.locator('#basemap-note')).toBeVisible();
  // the self-hosted typeface is still the one in use
  expect(await page.evaluate(() => ['400', '500', '600'].every((w) => document.fonts.check(`${w} 14px "IBM Plex Sans"`)))).toBe(true);
  expect(await page.locator(`${SPEED} .ds-lead`).evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/IBM Plex Sans/);
  await context.setOffline(false);
  const expected = /ERR_INTERNET_DISCONNECTED|Failed to load resource/;
  errors.splice(0, errors.length, ...errors.filter((e) => !expected.test(e)));
});

// map-provider credits -----------------------------------------------------------------------------
const creditBox = (page) =>
  page.evaluate(() => {
    const vis = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const inView = r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
      const hit = inView && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { w: r.width, h: r.height, inView, onTop: !!hit && (hit === el || el.contains(hit) || hit.contains(el)) };
    };
    const c = document.querySelector('#cesium-credits');
    const logo = [...c.querySelectorAll('img')].find((i) => /ion/i.test(i.src + i.title)) || null;
    return { box: vis(c), logo: logo && { ...vis(logo), loaded: logo.complete && logo.naturalWidth > 0 }, text: c.innerText, link: vis(c.querySelector('.cesium-credit-expand-link')) };
  });
for (const [w, h] of [[1920, 1080], [1366, 768], [390, 844]]) {
  test(`credits: Cesium ion logo and data attribution visible at ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    const bm = await page.evaluate(() => window.__ds.basemap());
    test.skip(!/ion/i.test(bm.basemap), 'no Cesium ion token in this environment');
    await expect.poll(async () => (await creditBox(page)).logo?.loaded, { message: 'ion logo loaded' }).toBe(true);
    // Cesium fills the credit block in steps (logo first, then the attribution link): wait until it is drawn in full
    await expect.poll(async () => { const b = await creditBox(page); return !!(b.link?.inView && b.link.onTop && b.logo?.inView); }, { message: 'credit block drawn' }).toBe(true);
    const c = await creditBox(page);
    console.log(`    credit area ${w}×${h}: ${Math.round(c.box.w)}×${Math.round(c.box.h)} px, logo ${Math.round(c.logo.w)}×${Math.round(c.logo.h)} px`);
    expect(c.box.inView && c.box.w > 0 && c.box.h > 0).toBe(true);
    expect(c.logo.inView && c.logo.onTop && c.logo.w > 20 && c.logo.h > 8).toBe(true);
    expect(c.link?.inView && c.link.onTop).toBe(true);
    // the provider attribution list opens above the UI
    await page.click('#cesium-credits .cesium-credit-expand-link');
    const overlay = page.locator('.cesium-credit-lightbox-overlay');
    await expect(overlay).toBeVisible();
    expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.cesium-credit-lightbox-overlay') != null)).toBe(true);
  });
}
test('credits: Esri attribution visible on the fallback basemap (no token), desktop and phone', async ({ page }) => {
  for (const [w, h] of [[1366, 768], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await boot(page, { url: process.env.E2E_NOTOKEN_URL || 'http://localhost:5174/' });
    await expect.poll(async () => (await creditBox(page)).text).toContain('Esri');
    const c = await creditBox(page);
    console.log(`    Esri credit ${w}×${h}: ${Math.round(c.box.w)}×${Math.round(c.box.h)} px`);
    expect(c.box.inView && c.box.onTop).toBe(true);
    // the whole attribution line is shown, not clipped
    expect(await page.locator('#cesium-credits').evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  }
});

// fonts -------------------------------------------------------------------------------------------
test('fonts: IBM Plex is self-hosted; no third-party font request', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await boot(page);
  await page.click(HOW); // the dossier uses the mono face too
  await page.waitForTimeout(500);
  const origin = new URL(page.url()).origin;
  const fontReqs = requests.filter((u) => /\.(woff2?|ttf|otf)(\?|$)/.test(u) || /fonts\.(googleapis|gstatic)\.com/.test(u));
  console.log(`    font requests: ${fontReqs.length}`);
  expect(fontReqs.length).toBeGreaterThan(0);
  for (const u of fontReqs) expect(u.startsWith(origin), u).toBe(true);
  expect(requests.filter((u) => /fonts\.(googleapis|gstatic)\.com|typekit|fonts\.com/.test(u))).toEqual([]);
  expect(await page.evaluate(() => document.fonts.check('600 14px "IBM Plex Sans"') && document.fonts.check('400 12px "IBM Plex Mono"'))).toBe(true);
});

// first-visit guide ------------------------------------------------------------------------------
test('guide: shows on the first visit only, and reopens from How we know', async ({ page }) => {
  await boot(page, { guide: true, skipFlyIn: false });
  const guide = page.locator('.ds-guide');
  await expect(guide).toBeVisible();
  for (const s of sitesIndex().sites) await expect(guide).toContainText(s.name.split(/[,(]/)[0].replace(/\s+dune field$/i, '').trim());
  await page.click('.ds-guide [data-guide-close].ds-primary');
  await expect(guide).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => window.__ds?.state.siteId, null, { timeout: 60_000 });
  await page.evaluate(() => window.__ds.ready);
  await expect(guide).toBeHidden();
  await page.click(HOW);
  await page.click('#dossier [data-guide]');
  await expect(page.locator('#dossier')).toBeHidden();
  await expect(guide).toBeVisible();
  await page.click('.ds-guide [aria-label="Close guide"]');
  await expect(guide).toBeHidden();
});

// legend checkboxes -------------------------------------------------------------------------------
test('legend: every checkbox shows and hides its layer, in every mode (incl. the five threat classes)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__ds.goYear(2040)); // projected year, so the PROJECTED row is in the legend too
  const expectedRows = {
    true: ['box', 'projected', 'dunes', 'dunes2000', 'vectors', 'targets', 'exposed'],
    motion: ['vectors', 'dunes', 'dunes2000', 'projected', 'box'],
    threat: ['t_now', 't_by2050', 't_by2100', 't_possible', 't_none', 'exposed', 'vectors', 'dunes', 'dunes2000', 'projected', 'box'],
  };
  const isOn = (s, id) => {
    if (id === 'targets') return ['t_now', 't_by2050', 't_by2100', 't_possible', 't_none'].every((k) => s[k]);
    return !!s[id];
  };
  for (const mode of ['true', 'motion', 'threat']) {
    await setMode(page, mode);
    const ids = await page.locator('.ds-panel--legend [data-layer]').evaluateAll((els) => els.map((e) => e.dataset.layer));
    expect(ids, mode).toEqual(expectedRows[mode]);
    for (const id of ids) {
      const box = page.locator(`.ds-panel--legend [data-layer="${id}"]`);
      const checked = await box.isChecked();
      expect(isOn(await shown(page), id), `${mode}/${id} drawn = checked`).toBe(checked);
      await box.click();
      await expect.poll(async () => isOn(await shown(page), id), { message: `${mode}/${id} toggled` }).toBe(!checked);
      if (id === 'projected') expect((await shown(page)).projectedTag).toBe(!checked);
      await box.click();
      await expect.poll(async () => isOn(await shown(page), id), { message: `${mode}/${id} restored` }).toBe(checked);
    }
    // threat classes are independent of each other
    if (mode === 'threat') {
      await page.locator('[data-layer="t_none"]').click();
      const s = await shown(page);
      expect([s.t_now, s.t_by2050, s.t_possible, s.t_none]).toEqual([true, true, true, false]);
      await page.locator('[data-layer="t_none"]').click();
    }
  }
  // arrow length scale: the legend states it and the arrows follow it
  await setMode(page, 'motion');
  await page.click('[data-factor="4"]');
  await expect(page.locator('.ds-panel--legend')).toContainText('length = 400 years of motion (1 m/yr → 400 m)');
  expect(await page.evaluate(() => window.__ds.state.arrowFactor)).toBe(4);
  await expect(page.locator('.ds-panel--legend')).toContainText('No arrow: below detection limit');
});

// timeline settings ------------------------------------------------------------------------------
test('timeline settings: reach case, fast-case frame and changed pixels', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__ds.goYear(2040));
  await page.click('[data-gear]');
  const pop = page.locator('.ds-pop');
  await expect(pop).toBeVisible();
  // defaults: fast-case reach year, fast-case frame on, changed pixels off
  await expect(page.locator('[data-setting="reachCase"]')).toHaveValue('fast');
  let f = (await shown(page)).frames;
  expect(f.fast).toMatch(/prj_fast_2040/);
  expect(f.change).toBeNull();
  await page.uncheck('[data-setting="fastCaseFrame"]');
  await expect.poll(async () => (await shown(page)).frames.fast).toBeNull();
  await expect(page.locator('[data-readout]')).not.toContainText('Fast case drawn faint');
  await page.check('[data-setting="changedPixels"]');
  await expect.poll(async () => (await shown(page)).frames.change).toMatch(/change:.*prj_med_2040/);
  await page.selectOption('[data-setting="reachCase"]', 'median');
  expect(await page.evaluate(() => window.__ds.state.hitRule)).toBe('med');
  // settings survive a site switch and a re-render of the popover
  await page.keyboard.press('Escape');
  await switchSite(page, SITES.find((id) => id !== DEFAULT_SITE));
  await page.click('[data-gear]');
  await expect(page.locator('[data-setting="reachCase"]')).toHaveValue('median');
  await expect(page.locator('[data-setting="fastCaseFrame"]')).not.toBeChecked();
  await expect(page.locator('[data-setting="changedPixels"]')).toBeChecked();
  // the reading note opens the dossier's frames section
  await page.click('.ds-pop [data-action="readingNote"]');
  await expect(page.locator('#ds-frames')).toBeVisible();
  await page.keyboard.press('Escape');
});

// 12 ------------------------------------------------------------------------------------------
for (const [w, h] of [
  [1920, 1080],
  [1366, 768],
]) {
  test(`12 · layout at ${w}×${h}: panels inside the window and not overlapping`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    await setMode(page, 'threat');
    await page.locator('.ds-rlist [data-target]').nth(2).click(); // opens a target card too
    await expect(page.locator(CARD)).toBeVisible();
    // the reached panel keeps its heading in view (only the list scrolls) and shows several rows
    const rp = await page.evaluate(() => {
      const p = document.querySelector('.ds-panel--reached').getBoundingClientRect();
      const hd = document.querySelector('.ds-panel--reached h2').getBoundingClientRect();
      const list = document.querySelector('.ds-panel--reached .ds-rlist').getBoundingClientRect();
      const rows = [...document.querySelectorAll('.ds-rlist li')].filter((li) => { const r = li.getBoundingClientRect(); return r.top >= list.top - 1 && r.bottom <= list.bottom + 1; }).length;
      return { headIn: hd.top >= p.top && hd.bottom <= p.bottom, rows };
    });
    expect(rp.headIn, 'reached panel heading visible').toBe(true);
    expect(rp.rows, 'rows fully visible in the reached list').toBeGreaterThanOrEqual(h >= 1000 ? 4 : 2);
    await page.waitForTimeout(500);
    const rects = await page.evaluate(() =>
      ['.ds-header', '.ds-panel--speed', '.ds-panel--reached', '.ds-panel--card', '.ds-panel--legend', '.ds-timeline', '.ds-footer']
        .map((s) => [s, document.querySelector(s)])
        .filter(([, el]) => el && el.offsetParent !== null)
        .map(([s, el]) => {
          const r = el.getBoundingClientRect();
          return { s, x: r.x, y: r.y, r: r.right, b: r.bottom, h: r.height };
        }),
    );
    expect(rects.map((r) => r.s)).toEqual(['.ds-header', '.ds-panel--speed', '.ds-panel--reached', '.ds-panel--card', '.ds-panel--legend', '.ds-timeline', '.ds-footer']);
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

test('12 · phone 390×844: bottom sheet with tabs, globe usable, nothing overflows sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  const noSideways = async () => {
    const sw = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
    expect(sw).toBeLessThanOrEqual(390);
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll('.ds-ui *')]
        .filter((el) => el.offsetParent !== null && !el.closest('svg'))
        .map((el) => [el.className && String(el.className), el.getBoundingClientRect()])
        .filter(([, r]) => r.width > 0 && (r.right > 391 || r.left < -1))
        .map(([c, r]) => `${c} ${Math.round(r.left)}..${Math.round(r.right)}`),
    );
    expect(wide).toEqual([]);
  };
  await expect(page.locator('.ds-sheet')).toBeVisible();
  await expect(page.locator('.ds-site-select')).toBeVisible();
  await expect(page.locator('.ds-seg--site')).toBeHidden();
  await expect(page.locator('.ds-credit-line')).toHaveText(CREDIT);
  // the globe is reachable above the sheet: a point there hits the Cesium canvas
  const sheetTop = await page.locator('.ds-sheet').evaluate((el) => el.getBoundingClientRect().top);
  expect(sheetTop).toBeGreaterThan(300);
  expect(await page.evaluate((y) => document.elementFromPoint(195, y)?.tagName, (sheetTop + 120) / 2)).toBe('CANVAS');
  for (const [tab, sel] of [['speed', SPEED], ['wind', WIND], ['key', '.ds-panel--legend'], ['time', '.ds-timeline']]) {
    await page.click(`.ds-tabs [data-tab="${tab}"]`);
    await expect(page.locator(sel)).toBeVisible();
    await noSideways();
    expect(await hudText(page)).not.toMatch(BAD_TEXT);
  }
  // threat mode swaps the wind tab for the ranked list; a selection gets its own tab
  await setMode(page, 'threat');
  await page.click('.ds-tabs [data-tab="reached"]');
  await expect(page.locator('.ds-panel--reached')).toBeVisible();
  await page.locator('.ds-rlist [data-target]').first().click();
  await expect(page.locator('.ds-tabs [data-tab="card"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(CARD)).toBeVisible();
  await noSideways();
  await page.keyboard.press('Escape');
  await expect(page.locator('.ds-tabs [data-tab="card"]')).toHaveCount(0);
  // the sheet can be lowered to free the globe, and a tab raises it again
  await page.click('[data-sheet-toggle]');
  const lowered = await page.locator('.ds-sheet').evaluate((el) => el.getBoundingClientRect().top);
  expect(lowered).toBeGreaterThan(sheetTop + 200);
  await page.click('.ds-tabs [data-tab="time"]');
  await expect(page.locator('.ds-timeline')).toBeVisible();
  // site switch from the phone's select
  const other = SITES.find((id) => id !== DEFAULT_SITE);
  await page.selectOption('[data-site-select]', other);
  await page.waitForFunction((sid) => window.__ds.state.siteId === sid, other, { timeout: 60_000 });
  await noSideways();
  // an image-only year on the phone: chip, readout and the key with the empty years, nothing sideways
  const firstImage = displayOnly(siteData(other).manifest)[0];
  await page.evaluate((y) => window.__ds.goYear(y), firstImage.year);
  await expect(page.locator('[data-when]')).toContainText('IMAGE ONLY');
  await expect(page.locator('[data-tl-key]')).toBeVisible();
  await expect(page.locator('[data-tl-key]')).toContainText('No scene');
  await expect(page.locator('[data-readout]')).toContainText(firstImage.scene_id);
  await noSideways();
  // the timeline settings button is fully on screen without scrolling and not under the footer
  const gear = await page.evaluate(() => {
    const g = document.querySelector('[data-gear]').getBoundingClientRect(), f = document.querySelector('.ds-footer').getBoundingClientRect();
    const hit = document.elementFromPoint(g.left + g.width / 2, g.top + g.height / 2);
    return { bottom: g.bottom, top: g.top, footerTop: f.top, onTop: !!hit && !!hit.closest('[data-gear]') };
  });
  expect(gear.bottom, 'settings button above the footer').toBeLessThanOrEqual(gear.footerTop);
  expect(gear.top).toBeGreaterThanOrEqual(0);
  expect(gear.onTop, 'settings button not covered').toBe(true);
  await page.click('[data-gear]');
  await expect(page.locator('.ds-pop')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/layout-390x844-image-only.png' });
  await page.screenshot({ path: 'test-results/layout-390x844.png' });
});

// 13 ------------------------------------------------------------------------------------------
test('13 · full run-through of each site without console errors', async ({ page }) => {
  await boot(page, { skipFlyIn: false });
  await page.waitForFunction(() => window.__ds.marks['flyin-done'], null, { timeout: 30_000 });
  for (const id of SITES) {
    await switchSite(page, id);
    for (const mode of ['true', 'motion', 'threat']) {
      await setMode(page, mode);
      expect(await hudText(page)).not.toMatch(BAD_TEXT);
    }
    await page.click('[data-action="topDown"]');
    for (const y of [2000, displayOnly(siteData(id).manifest)[0]?.year, 2013, 2027, 2030, 2050].filter(Boolean)) {
      await page.evaluate((yy) => window.__ds.goYear(yy), y);
      expect(await hudText(page)).not.toMatch(BAD_TEXT);
    }
    await page.click('[data-gear]');
    await page.check('[data-setting="changedPixels"]');
    await page.selectOption('[data-setting="reachCase"]', 'median');
    await page.keyboard.press('Escape');
    await page.locator('.ds-rlist [data-target]').first().click();
    await expect(page.locator(CARD)).toBeVisible();
    await page.locator('[data-layer="exposed"]').check();
    await setMode(page, 'motion');
    await page.locator('[data-factor="4"]').click();
    await page.locator('[data-layer="dunes2000"]').check();
    await page.click(HOW);
    await page.keyboard.press('Escape');
    await page.click('[data-gear]');
    await page.uncheck('[data-setting="changedPixels"]');
    await page.selectOption('[data-setting="reachCase"]', 'fast');
    await page.keyboard.press('Escape');
    await page.click('[data-action="topDown"]');
    expect(await hudText(page)).not.toMatch(BAD_TEXT);
  }
});
