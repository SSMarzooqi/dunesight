// Builds the data object the redesigned UI (ui.js) renders, for one site, from that site's published files only (no site ids, no sample numbers).
import { isNasa } from '../hud/credits.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const angleApart = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const WORDS16 = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast', 'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
export const compassWords = (deg) => (isNum(deg) ? WORDS16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] : null);
const CONFIRM = { confirmed: 'confirmed', partly_confirmed: 'partly', not_confirmed: 'not' };

/**
 * The site's own heading of dune motion, as the pipeline states it. summary.json carries it only inside
 * wind_agreement_note ("the field-median heading 28.8 deg ..."); station_wind.json repeats it as dune_heading_deg
 * where published. Falls back to the vector mean of the arrows (labelled as such) if neither is present.
 */
export function fieldHeading(b) {
  const m = String(b.summary?.wind_agreement_note || '').match(/field-median heading\s+([\d.]+)\s*deg/);
  if (m) return { deg: +m[1], source: 'pipeline', label: 'field median of the 480 m windows with detected motion' };
  if (isNum(b.station?.dune_heading_deg)) return { deg: b.station.dune_heading_deg, source: 'pipeline', label: 'field median of the 480 m windows with detected motion' };
  if (isNum(b.derived?.fieldHeading)) return { deg: b.derived.fieldHeading, source: 'arrows', label: `vector mean of the ${b.derived.nVectors} arrows on the map` };
  return null;
}

/** Class cut-offs as stated in dunes.geojson's note: "slow < 0.65, active < 1.15, fast >= 1.15 m/yr". */
export function classCutoffs(note) {
  const s = String(note || '');
  const slow = s.match(/slow\s*<\s*([\d.]+)/);
  const active = s.match(/active\s*<\s*([\d.]+)/);
  const fast = s.match(/fast\s*>=?\s*([\d.]+)/);
  return slow && active ? { slow: +slow[1], active: +active[1], fast: fast ? +fast[1] : +active[1] } : null;
}

/** Station result from station_wind.json, or null when absent, unusable or flagged not representative. */
export function stationOf(st) {
  if (!st || st.has_usable_station === false || st.representative === false) return null;
  const v = [st.station?.RDD_deg, st.station_result?.RDD_deg, st.RDD_deg].find(isNum);
  if (!isNum(v)) return null;
  const s = st.station || {};
  return {
    rdd: v,
    name: s.name || st.station_name || 'ground station',
    dist: isNum(s.distance_km) ? s.distance_km : isNum(st.distance_km) ? st.distance_km : null,
    bearing: isNum(s.bearing_from_site_deg) ? s.bearing_from_site_deg : null,
    dp: isNum(s.DP) ? s.DP : null,
    dpClass: s.dp_class || null,
    period: st.period || null,
    pctMin: isNum(s.hours_reported_pct_min) ? s.hours_reported_pct_min : null,
    pctMax: isNum(s.hours_reported_pct_max) ? s.hours_reported_pct_max : null,
    note: st.note || null,
    limits: Array.isArray(st.limits) ? st.limits : [],
    source: st.source || 'NOAA ISD',
  };
}

const POINTS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const point = (deg) => POINTS16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
const fmtDate = (iso) => {
  const m = typeof iso === 'string' && iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso || null;
  return `${+m[3]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1]} ${m[1]}`;
};

/** Short dataset names for the one-line footer (full names are in the dossier). */
export function shortSourceName(name) {
  const n = String(name);
  if (/^Landsat 7/i.test(n)) return 'Landsat 7 ETM+';
  if (/^Landsat 8-9/i.test(n)) return 'Landsat 8-9 OLI';
  if (/HLSS30/.test(n)) return 'HLS S30';
  if (/HLSL30/.test(n)) return 'HLS L30';
  if (/^MERRA-2/i.test(n)) return /aer/i.test(n) ? 'MERRA-2 aerosol' : 'MERRA-2 wind';
  if (/^NASA POWER/i.test(n)) return 'NASA POWER';
  if (/^NASADEM/i.test(n)) return 'NASADEM';
  if (/^NOAA Integrated Surface/i.test(n)) return 'NOAA ISD station wind';
  return n.split(' (')[0];
}

export const END_YEAR = 2050;

export function buildSiteData(b, { arrowFactor, arrowYears }) {
  const s = b.summary || {};
  const t = s.threat || {};
  const by = t.targets_by_type || {};
  const d = b.derived || {};
  const w = b.wind || {};
  const m = b.manifest || {};
  const lim = isNum(s.detection_limit_myr) ? s.detection_limit_myr : null;
  const head = fieldHeading(b);
  const p90 = isNum(s.speed_p90_myr) ? s.speed_p90_myr : 1;
  // axis: the next half metre per year above the 90th percentile, with a little room
  const axisMax = Math.max(1, Math.ceil((p90 * 1.15) / 0.5) * 0.5);

  const conf = (q) => (q && CONFIRM[q.status] ? { status: CONFIRM[q.status], raw: q.status, text: q.short || '' } : null);
  const confidence = s.confirmation ? { speed: conf(s.confirmation.speed), heading: conf(s.confirmation.heading) } : null;

  const cls = s.counts_by_class || {};
  const cut = classCutoffs(b.dunes?.note);
  const nDunes = isNum(s.n_dunes) ? s.n_dunes : (b.dunes?.features || []).length;

  const row = (key) => ({
    all: key === 'sand_at_edge_now' ? t.n_sand_at_edge_now : t.n_reached_by_2050,
    roads: by.road?.[key] ?? null,
    farms: by.farm?.[key] ?? null,
    built: by.building?.[key] ?? null,
  });
  const sc = d.statusCounts || {};
  const disp = s.frames?.median_case_2050_displacement || null;
  const projYears = (m.projected_median || []).map((p) => p.year).filter(isNum).sort((a, c) => a - c);

  // timeline from the manifest: observed scenes, every gap between them, projected frames and their statistics
  const obs = (m.observed || []).filter((o) => isNum(o.year)).sort((a, c) => a.year - c.year);
  const scenes = obs.map((o) => o.year);
  const gaps = [];
  for (let i = 1; i < scenes.length; i++) if (scenes[i] - scenes[i - 1] > 1) gaps.push([scenes[i - 1] + 1, scenes[i] - 1]);
  const observed = {};
  for (const o of obs) observed[o.year] = { date: fmtDate(o.date), sensor: o.sensor || null, pixel: isNum(o.pixel_m) ? o.pixel_m : null, sceneId: o.scene_id || null, sunElev: isNum(o.sun_elevation_deg) ? o.sun_elevation_deg : null };
  const frameData = {};
  for (const p of m.projected_median || []) {
    const x = p.displacement || {};
    frameData[p.year] = {
      median: isNum(x.median_m) ? x.median_m : null,
      p90: isNum(x.p90_m) ? x.p90_m : null,
      max: isNum(x.max_m) ? x.max_m : null,
      areaPct: isNum(x.share_of_box_moving_pct) ? x.share_of_box_moving_pct : null,
      advected: isNum(p.years_advected) ? p.years_advected : null,
      fromDate: fmtDate(p.from_date) || null,
    };
  }
  const last = scenes[scenes.length - 1];

  // wind
  const st = stationOf(b.station);
  const rdd = isNum(w.RDD_deg) ? w.RDD_deg : null;
  const rose = Array.isArray(w.sand_rose) ? w.sand_rose.filter((x) => isNum(x.sector_deg) && isNum(x.dp)).map((x) => ({ deg: x.sector_deg, dp: x.dp })) : [];
  const apart = head && rdd !== null ? Math.round(angleApart(head.deg, rdd)) : null;

  // ranked list of reached targets
  const tf = new Map((b.targets?.features || []).map((f) => [f.properties.id, f.properties]));
  const reached = (d.ranked || []).map((id) => {
    const p = tf.get(id);
    return { id, name: p.name || id, type: p.type, status: p.threat_status, min: p.hit_year_min, med: isNum(p.hit_year_med) ? p.hit_year_med : null, max: isNum(p.hit_year_max) ? p.hit_year_max : null, gap: isNum(p.gap_m) ? p.gap_m : null };
  });

  const sources = b.sources || [];
  const windowSize = (String(b.vectors?.note || '').match(/(\d+)\s*m windows/) || [])[1];

  return {
    id: b.id,
    name: b.shortName || b.name,
    fullName: b.name,
    placeholder: !!b.placeholder,
    placeholderFiles: b.placeholderFiles || [],
    speed: {
      median: isNum(s.speed_median_myr) ? s.speed_median_myr : null,
      p10: isNum(s.speed_p10_myr) ? s.speed_p10_myr : null,
      p90: isNum(s.speed_p90_myr) ? s.speed_p90_myr : null,
      detectionLimit: lim,
      sigma: isNum(s.uncertainty_myr) ? s.uncertainty_myr : null,
      axisMax,
      headingDeg: head ? Math.round(head.deg) : null,
      headingName: head ? compassWords(head.deg) : null,
      headingLabel: head?.label || null,
    },
    confidence,
    dunes: { total: nDunes, stable: cls.stable ?? 0, slow: cls.slow ?? 0, active: cls.active ?? 0, fast: cls.fast ?? 0, thresholds: cut },
    targets: {
      total: t.n_targets ?? (b.targets?.features || []).length,
      exposed: (b.targets?.features || []).filter((f) => f.properties?.borders_free_sand === true).length,
      edgeNow: row('sand_at_edge_now'),
      by2050: row('reached_by_2050'),
      legend: {
        now: sc.sand_at_edge_now || 0,
        by2050: sc.reached_by_2050 || 0,
        by2100: sc.reached_2051_2100 || 0,
        possible: sc.possible_within_direction_uncertainty || 0,
        none: sc.not_reached_by_2100 || 0,
      },
    },
    projection2050: disp && isNum(disp.median_m) ? { year: projYears[projYears.length - 1] ?? END_YEAR, median: disp.median_m, p90: disp.p90_m, areaPct: disp.share_of_box_moving_pct } : null,
    details: {
      windowsPct: isNum(d.detectedPct) ? d.detectedPct : null,
      windows: isNum(d.validN) ? d.validN : null,
      windowSize: windowSize ? `${windowSize} m` : null,
      baseline: s.baseline ? `${fmtDate(s.baseline.start_date)} → ${fmtDate(s.baseline.end_date)}${isNum(s.baseline.years) ? ` (${s.baseline.years.toFixed(1)} yr)` : ''}` : null,
      outlines: 'NASADEM, Feb 2000',
      sources: 'Landsat 7 / 8-9 pan 15 m · NASADEM · OpenStreetMap · HLS',
    },
    arrows: { count: (b.vectors?.features || []).length, factor: arrowFactor, baseYears: arrowYears, detectionLimit: lim },
    wind: {
      rddDeg: rdd !== null ? Math.round(rdd) : null,
      rddName: rdd !== null ? compassWords(rdd) : null,
      duneDeg: head ? Math.round(head.deg) : null,
      duneName: head ? compassWords(head.deg) : null,
      duneLabel: head?.label || null,
      arrowMeanDeg: isNum(d.fieldHeading) ? Math.round(d.fieldHeading) : null,
      nArrows: d.nVectors || 0,
      apartDeg: apart,
      stationDeg: st ? Math.round(st.rdd) : null,
      stationApartDeg: st && head ? Math.round(angleApart(st.rdd, head.deg)) : null,
      dp: isNum(w.DP) ? w.DP : null,
      energy: w.dp_class || null,
      rdp: isNum(w.RDP) ? w.RDP : null,
      rdpRatio: isNum(w.RDP_DP) ? w.RDP_DP : null,
      rose,
      period: w.period || null,
      threshold: isNum(w.threshold_kt) ? w.threshold_kt : null,
      source: w.source || 'NASA MERRA-2',
      station: st
        ? [
            st.name,
            [isNum(st.dist) ? `${Math.round(st.dist)} km` : null, isNum(st.bearing) ? `${point(st.bearing)} of the box` : null].filter(Boolean).join(' '),
            st.period ? `${st.period}${isNum(st.pctMin) && isNum(st.pctMax) ? `, ${Math.round(st.pctMin)}–${Math.round(st.pctMax)}% of hours reported` : ''}` : null,
            isNum(st.dp) ? `its DP ${Math.round(st.dp)} VU/yr${st.dpClass ? ` (${st.dpClass})` : ''}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
      stationName: st?.name || null,
      stationNote: st?.note || null,
      note: s.wind_agreement_note || null,
      sources: `${w.source || 'NASA MERRA-2'}${w.period ? ` ${w.period}` : ''} (wind) · Landsat 8/9 (dune heading)${st ? ` · ${st.source} (station, not NASA)` : ''}`,
    },
    timeline: { start: scenes[0] ?? 2000, end: END_YEAR, lastObserved: last, scenes, gaps, frames: projYears, frameData, observed, readingNote: m.projection_reading_note || null },
    reached,
    possibleCount: sc.possible_within_direction_uncertainty || 0,
    credits: {
      nasa: sources.filter(isNasa).map((x) => shortSourceName(x.name)),
      other: sources.filter((x) => !isNasa(x) && !/openstreetmap/i.test(x.name || '')).map((x) => shortSourceName(x.name)),
      osm: sources.some((x) => /openstreetmap/i.test(x.name || '')),
      full: sources.map((x) => `${x.name} (${x.provider || ''})`).join('\n'),
    },
  };
}
