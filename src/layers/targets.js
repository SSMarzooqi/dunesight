// Target layer: road segments, farms and built-up areas from targets.geojson, batched into a few ground primitives and coloured by threat status at the timeline year.
import * as Cesium from 'cesium';
import { polygonsOf, representativePoint } from '../geo.js';
import { isNum } from '../format.js';
import { C, STATUS_COLORS, whenReady, setInstanceColor, lineInstance, polygonInstance, linePrimitive, fillPrimitive, dashedLinePrimitive, destroyPrimitive } from './util.js';

const HIT_CAPABLE = new Set(['sand_at_edge_now', 'reached_by_2050', 'reached_2051_2100']);

/**
 * Display state of a target at a timeline year.
 * 'hit'     - the year has reached the target's hit year (hit_year_min, or hit_year_med with rule 'med');
 *             sand_at_edge_now targets are hit from the latest observed frame on.
 * 'pending' - the target is reached later than the year shown.
 * 'possible'- possible within direction uncertainty (no year).
 * 'none'    - not reached by 2100.
 */
export function targetState(p, year, rule, latestObservedYear) {
  const status = p?.threat_status;
  if (status === 'possible_within_direction_uncertainty') return 'possible';
  if (!HIT_CAPABLE.has(status)) return 'none';
  let hy = rule === 'med' ? p.hit_year_med : p.hit_year_min;
  if (status === 'sand_at_edge_now' && isNum(latestObservedYear)) hy = isNum(hy) ? Math.min(hy, latestObservedYear) : latestObservedYear;
  if (!isNum(hy) || !isNum(year)) return 'pending';
  return year >= hy ? 'hit' : 'pending';
}

export function createTargetsLayer(viewer, bundle, { latestObservedYear }) {
  const scene = viewer.scene;
  const prims = scene.primitives;
  const feats = (bundle.targets?.features || []).filter((f) => f.geometry && f.properties?.id);
  const byId = new Map();
  const lineIds = new Map(); // target id -> [instance ids in the line primitive]
  const fillIds = new Map(); // target id -> [instance ids in the fill primitive]

  const lineInstances = [];
  const fillInstances = [];
  const exposedInstances = [];
  for (const f of feats) {
    const p = f.properties;
    const tid = p.id;
    byId.set(tid, { kind: 'target', id: tid, props: p, geometry: f.geometry, lonlat: representativePoint(f.geometry) });
    const width = HIT_CAPABLE.has(p.threat_status) || p.threat_status === 'possible_within_direction_uncertainty' ? 4 : 2;
    const lids = [];
    const fids = [];
    const g = f.geometry;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    lines.forEach((coords, k) => {
      if (coords.length < 2) return;
      const id = `t:${tid}#l${k}`;
      lineInstances.push(lineInstance(id, coords, width, Cesium.Color.WHITE));
      lids.push(id);
      if (p.borders_free_sand) exposedInstances.push(lineInstance(`tx:${tid}#l${k}`, coords, width + 7, Cesium.Color.WHITE));
    });
    polygonsOf(g).forEach((rings, k) => {
      const fid = `t:${tid}#f${k}`;
      fillInstances.push(polygonInstance(fid, rings[0], Cesium.Color.WHITE, rings.slice(1)));
      fids.push(fid);
      rings.forEach((ring, r) => {
        const id = `t:${tid}#r${k}_${r}`;
        lineInstances.push(lineInstance(id, ring, width === 4 ? 3 : 2, Cesium.Color.WHITE));
        lids.push(id);
        if (p.borders_free_sand) exposedInstances.push(lineInstance(`tx:${tid}#r${k}_${r}`, ring, 9, Cesium.Color.WHITE));
      });
    });
    lineIds.set(tid, lids);
    fillIds.set(tid, fids);
  }

  // Order matters for ground polylines: the exposed halo goes underneath the status lines.
  const exposed = exposedInstances.length ? dashedLinePrimitive(exposedInstances, C('#e8f4ff', 0.75), 14) : null;
  if (exposed) {
    exposed.show = false;
    prims.add(exposed);
  }
  const fills = fillInstances.length ? fillPrimitive(fillInstances) : null;
  const lines = lineInstances.length ? linePrimitive(lineInstances) : null;
  if (fills) prims.add(fills);
  if (lines) prims.add(lines);

  let visible = true;
  let modeDim = 1;
  let year = latestObservedYear;
  let rule = 'min';
  let ready = false;
  const states = new Map();
  let pulseTimer = null;
  let pulsePhase = 0;

  function baseColor(p, st, pulse = 1) {
    switch (st) {
      case 'hit':
        return [STATUS_COLORS[p.threat_status] || '#f85149', (0.55 + 0.45 * pulse) * Math.max(modeDim, 0.5)];
      case 'pending':
        return [STATUS_COLORS[p.threat_status] || '#f0883e', 0.32 * modeDim];
      case 'possible':
        return [STATUS_COLORS.possible_within_direction_uncertainty, 0.85 * modeDim];
      default:
        return [STATUS_COLORS.not_reached_by_2100, 0.6 * modeDim];
    }
  }

  function paint(tid, pulse = 1) {
    const t = byId.get(tid);
    const st = states.get(tid);
    const [css, a] = baseColor(t.props, st, pulse);
    const lineColor = C(css, Math.min(1, a));
    const fillColor = C(css, Math.min(1, a) * (st === 'hit' ? 0.2 : 0.1));
    for (const id of lineIds.get(tid)) setInstanceColor(lines, id, lineColor);
    for (const id of fillIds.get(tid)) setInstanceColor(fills, id, fillColor);
  }

  function recompute() {
    for (const [tid, t] of byId) states.set(tid, targetState(t.props, year, rule, latestObservedYear));
    if (!ready) return;
    for (const tid of byId.keys()) paint(tid);
    scene.requestRender();
    syncPulse();
  }

  function syncPulse() {
    const anyHit = [...states.values()].some((s) => s === 'hit');
    const want = visible && anyHit && ready;
    if (want && !pulseTimer) {
      pulseTimer = setInterval(() => {
        pulsePhase += 0.35;
        const pulse = 0.5 + 0.5 * Math.sin(pulsePhase);
        for (const [tid, st] of states) if (st === 'hit') paint(tid, pulse);
        scene.requestRender();
      }, 110);
    } else if (!want && pulseTimer) {
      clearInterval(pulseTimer);
      pulseTimer = null;
    }
  }

  const readyPromise = Promise.all([lines && whenReady(scene, lines), fills && whenReady(scene, fills)]).then(() => {
    ready = true;
    recompute();
  });

  const resolve = (id) => {
    if (typeof id !== 'string') return null;
    const m = id.match(/^tx?:(.*?)#/);
    return m ? byId.get(m[1]) || null : byId.get(id) || null;
  };

  return {
    kind: 'target',
    readyPromise,
    get ready() {
      return ready;
    },
    get count() {
      return byId.size;
    },
    owns: (id) => typeof id === 'string' && (id.startsWith('t:') || id.startsWith('tx:')),
    getFeature: resolve,
    get: (tid) => byId.get(tid) || null,
    stateOf: (tid) => states.get(tid) || null,
    setYear(y) {
      year = y;
      recompute();
    },
    setRule(r) {
      rule = r;
      recompute();
    },
    setDim(d) {
      modeDim = d;
      if (ready) recompute();
    },
    setExposed(v) {
      if (exposed) exposed.show = v && visible;
      scene.requestRender();
    },
    setVisible(v) {
      visible = v;
      if (lines) lines.show = v;
      if (fills) fills.show = v;
      if (!v && exposed) exposed.show = false;
      syncPulse();
      scene.requestRender();
    },
    counts() {
      const c = { hit: 0, pending: 0, possible: 0, none: 0 };
      for (const s of states.values()) c[s] += 1;
      return c;
    },
    dispose() {
      if (pulseTimer) clearInterval(pulseTimer);
      destroyPrimitive(prims, lines);
      destroyPrimitive(prims, fills);
      destroyPrimitive(prims, exposed);
    },
  };
}
