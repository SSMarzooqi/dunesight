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
    expect(counts.stops).toBe(d.manifest.observed.length + (2050 - latest));
    await expect(page.locator('.ds-compass .ds-petal')).toHaveCount(d.wind.sand_rose.length);
    // timeline scene ticks are exactly the manifest's observed years (Liwa has 2018 and no 2016; the others the reverse)
    const scenes = await page.locator('.ds-track__scene').evaluateAll((els) => els.map((e) => +e.dataset.scene));
    expect(scenes).toEqual(d.manifest.observed.map((o) => o.year));
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
    // every gap between observed scenes is drawn as a gap, the long one labelled
    const years = m.observed.map((o) => o.year);
    const gaps = [];
    for (let k = 1; k < years.length; k++) if (years[k] - years[k - 1] > 1) gaps.push([years[k - 1] + 1, years[k] - 1]);
    await expect(page.locator('.ds-track__gap')).toHaveCount(gaps.length);
    for (const [a, b] of gaps) {
      if (b - a >= 2) await expect(page.locator('.ds-track__gap', { hasText: `no scenes ${a}–${b}` })).toHaveCount(1);
      else await expect(page.locator('.ds-track__gap--short', { hasText: `no scene ${a}` })).toHaveCount(1);
    }
    await expect(page.locator('.ds-track__scene')).toHaveCount(years.length);

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
    for (const s of d.sources.filter((x) => /not NASA/.test(x.provider || ''))) expect(credits).toMatch(new RegExp(`Also: [^·]*${s.name.split(' ')[0]}[^·]*\\(not NASA\\)`));
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
    await page.locator('.ds-rlist [data-target]').first().click(); // opens a target card too
    await expect(page.locator(CARD)).toBeVisible();
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
    for (const y of [2000, 2013, 2027, 2030, 2050]) {
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
