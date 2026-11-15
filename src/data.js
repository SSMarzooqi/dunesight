// Fetches and caches the static site data under public/data/ (base-path aware) and derives a few values the HUD needs.

const BASE = `${import.meta.env.BASE_URL}data/`;

/** URL of a file under public/data/ (follows Vite's base: '/' in dev and on dunesight.us, '/dunesight/' for a project-site build). */
export function dataUrl(path) {
  return BASE + path;
}

async function getJson(path, { optional = false } = {}) {
  let res;
  try {
    res = await fetch(dataUrl(path));
  } catch (err) {
    if (optional) return null;
    throw new Error(`${path}: network error (${err.message})`);
  }
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`${path}: HTTP ${res.status}`);
  }
  // A missing optional file on a static host can come back as an HTML page with status 200.
  const type = res.headers.get('content-type') || '';
  if (optional && type.includes('text/html')) return null;
  try {
    return await res.json();
  } catch (err) {
    if (optional) return null;
    throw new Error(`${path}: invalid JSON`);
  }
}

let indexPromise = null;
export function loadIndex() {
  if (!indexPromise) indexPromise = getJson('sites.json');
  return indexPromise;
}

const cache = new Map();

/** Load (once) and return the bundle for a site entry from sites.json. */
export function loadSite(entry) {
  if (!cache.has(entry.id)) {
    const p = loadSiteUncached(entry).catch((err) => {
      cache.delete(entry.id); // allow a retry after a failure
      throw err;
    });
    cache.set(entry.id, p);
  }
  return cache.get(entry.id);
}

async function loadSiteUncached(entry) {
  const dir = entry.data_dir || `${entry.id}/`;
  const t0 = performance.now();
  const [summary, dunes, dunes2000, vectors, targets, wind, sources, manifest] = await Promise.all([
    getJson(`${dir}summary.json`),
    getJson(`${dir}dunes.geojson`),
    getJson(`${dir}dunes_2000.geojson`),
    getJson(`${dir}vectors.geojson`),
    getJson(`${dir}targets.geojson`),
    getJson(`${dir}wind_summary.json`),
    getJson(`${dir}sources.json`),
    getJson(`${dir}frames/manifest.json`),
  ]);
  // station_wind.json is optional. Request it only when the site's data refers to it, so a missing
  // file never produces a 404 (which browsers always log as a console error on static hosts).
  const mentionsStation =
    Object.prototype.hasOwnProperty.call(entry.files || {}, 'station_wind.json') ||
    JSON.stringify(summary).includes('station_wind') ||
    JSON.stringify(wind).includes('station_wind');
  const station = mentionsStation ? await getJson(`${dir}station_wind.json`, { optional: true }) : null;
  const files = entry.files || {};
  const placeholderFiles = Object.keys(files).filter((f) => files[f] !== 'real');
  const bundle = {
    id: entry.id,
    entry,
    dir,
    name: entry.name || summary.aoi_name || entry.id,
    shortName: shortName(entry.name || entry.id),
    bbox: entry.bbox || summary.aoi_bounds,
    placeholder: entry.status !== 'real' || placeholderFiles.length > 0 || summary.placeholder === true,
    placeholderFiles,
    summary,
    dunes,
    dunes2000,
    vectors,
    targets,
    wind,
    sources: Array.isArray(sources) ? sources : sources?.sources || [],
    manifest,
    station: station && typeof station === 'object' ? station : null,
    loadMs: 0,
  };
  bundle.derived = derive(bundle);
  bundle.loadMs = Math.round(performance.now() - t0);
  return bundle;
}

export function shortName(name) {
  return String(name).split(/[,(]/)[0].replace(/\s+dune field$/i, '').trim();
}

function derive(b) {
  const vfeat = b.vectors?.features || [];
  // Vector mean of the detected motion (east, north components), i.e. the measured field heading.
  let e = 0;
  let n = 0;
  let count = 0;
  for (const f of vfeat) {
    const p = f.properties || {};
    if (Number.isFinite(p.east_myr) && Number.isFinite(p.north_myr)) {
      e += p.east_myr;
      n += p.north_myr;
      count += 1;
    }
  }
  const fieldHeading = count ? ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360 : null;
  const fieldMeanSpeed = count ? Math.hypot(e, n) / count : null;

  // Share of dune windows with detected motion, as worded in summary.speed_note ("(86.2 % of 2045 valid)").
  let detectedPct = null;
  let detectedN = null;
  let validN = null;
  const m = String(b.summary?.speed_note || '').match(/([\d,]+) dune windows.*?detected motion \(([\d.]+)\s*%\s*of\s*([\d,]+)\s*valid\)/);
  if (m) {
    detectedN = +m[1].replace(/,/g, '');
    detectedPct = +m[2];
    validN = +m[3].replace(/,/g, '');
  }

  // Class cut-offs as stated in dunes.geojson's note.
  const cm = String(b.dunes?.note || '').match(/Classes are relative to this field: (.*?m\/yr)/);
  const classRule = cm ? cm[1] : null;

  // Hit targets ranked: earliest hit_year_min, then smallest gap.
  const tfeat = b.targets?.features || [];
  const ranked = tfeat
    .filter((f) => Number.isFinite(f.properties?.hit_year_min))
    .sort((a, c) => {
      const pa = a.properties;
      const pc = c.properties;
      if (pa.hit_year_min !== pc.hit_year_min) return pa.hit_year_min - pc.hit_year_min;
      const ga = Number.isFinite(pa.gap_m) ? pa.gap_m : Infinity;
      const gc = Number.isFinite(pc.gap_m) ? pc.gap_m : Infinity;
      return ga - gc;
    })
    .map((f) => f.properties.id);

  const statusCounts = {};
  for (const f of tfeat) {
    const s = f.properties?.threat_status || 'unknown';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  const obs = b.manifest?.observed || [];
  const latestObserved = obs.length ? obs[obs.length - 1] : null;

  return { fieldHeading, fieldMeanSpeed, nVectors: count, detectedPct, detectedN, validN, classRule, ranked, statusCounts, latestObserved };
}
