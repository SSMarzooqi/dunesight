// Target layer: road segments, farms and built-up areas from targets.geojson, batched into a few ground primitives, styled per threat status like the legend (dark casing, the "possible" class dashed), coloured by the timeline year and shown or hidden per status class.
import * as Cesium from 'cesium';
import { polygonsOf, representativePoint } from '../geo.js';
import { isNum } from '../format.js';
import { MAP_STYLE, STATUS_KEY } from '../ui/ui.js';
import { C, CASING, whenReady, setInstanceColor, setInstanceShow, lineInstance, polygonInstance, linePrimitive, fillPrimitive, dashedLinePrimitive, destroyPrimitive } from './util.js';

const HIT_CAPABLE = new Set(['sand_at_edge_now', 'reached_by_2050', 'reached_2051_2100']);
export const CLASSES = ['now', 'by2050', 'by2100', 'possible', 'none'];

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
  const ids = new Map(); // target id -> { cls, line: [], dash: [], casing: [], fill: [], exposed: [] }

  const lineInst = [];
  const dashInst = [];
  const casingInst = [];
  const fillInst = [];
  const exposedInst = [];
  const [exColor, exWidth, exDash] = MAP_STYLE.exposed;
  for (const f of feats) {
    const p = f.properties;
    const tid = p.id;
    const cls = STATUS_KEY[p.threat_status] || 'none';
    if (!STATUS_KEY[p.threat_status]) console.warn(`[targets] unknown threat_status "${p.threat_status}" on ${tid}: drawn as not reached`);
    const [hex, width] = MAP_STYLE.threat[cls];
    const dashed = cls === 'possible';
    byId.set(tid, { kind: 'target', id: tid, props: p, geometry: f.geometry, lonlat: representativePoint(f.geometry) });
    const rec = { cls, line: [], dash: [], casing: [], fill: [], exposed: [] };
    const g = f.geometry;
    const rings = [];
    (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []).forEach((c) => rings.push(c));
    polygonsOf(g).forEach((poly, k) => {
      const fid = `t:${tid}#f${k}`;
      fillInst.push(polygonInstance(fid, poly[0], C(hex, 0.12), poly.slice(1)));
      rec.fill.push(fid);
      poly.forEach((ring) => rings.push(ring));
    });
    rings.forEach((coords, k) => {
      if (coords.length < 2) return;
      const id = `t:${tid}#l${k}`;
      casingInst.push(lineInstance(`tc:${tid}#l${k}`, coords, width + 2, C(CASING)));
      rec.casing.push(`tc:${tid}#l${k}`);
      if (dashed) {
        dashInst.push(lineInstance(id, coords, width, Cesium.Color.WHITE));
        rec.dash.push(id);
      } else {
        lineInst.push(lineInstance(id, coords, width, C(hex)));
        rec.line.push(id);
      }
      if (p.borders_free_sand) {
        exposedInst.push(lineInstance(`tx:${tid}#l${k}`, coords, exWidth, Cesium.Color.WHITE));
        rec.exposed.push(`tx:${tid}#l${k}`);
      }
    });
    ids.set(tid, rec);
  }

  // Draw order for ground polylines follows the primitive order: exposed halo, fills, casing, then the coloured lines.
  const exposed = exposedInst.length ? dashedLinePrimitive(exposedInst, C(exColor, 0.8), exDash) : null;
  const fills = fillInst.length ? fillPrimitive(fillInst) : null;
  const casing = casingInst.length ? linePrimitive(casingInst) : null;
  const lines = lineInst.length ? linePrimitive(lineInst) : null;
  const possibleStyle = MAP_STYLE.threat.possible;
  const dashes = dashInst.length ? dashedLinePrimitive(dashInst, C(possibleStyle[0]), possibleStyle[2]) : null;
  for (const p of [exposed, fills, casing, lines, dashes]) if (p) prims.add(p);
  if (exposed) exposed.show = false;

  let visible = true;
  let modeDim = 1;
  let year = latestObservedYear;
  let rule = 'min';
  let ready = false;
  let exposedOn = false;
  const classOn = Object.fromEntries(CLASSES.map((k) => [k, true]));
  const states = new Map();
  let pulseTimer = null;
  let pulsePhase = 0;

  function alphaFor(st, pulse = 1) {
    switch (st) {
      case 'hit':
        return (0.55 + 0.45 * pulse) * Math.max(modeDim, 0.5);
      case 'pending':
        return 0.32 * modeDim;
      case 'possible':
        return 0.9 * modeDim;
      default:
        return 0.75 * modeDim;
    }
  }

  function paint(tid, pulse = 1) {
    const rec = ids.get(tid);
    const st = states.get(tid);
    const [hex] = MAP_STYLE.threat[rec.cls];
    const a = Math.min(1, alphaFor(st, pulse));
    const lineColor = C(hex, a);
    const casingColor = C(CASING, Math.min(1, 0.4 + a * 0.6));
    const fillColor = C(hex, a * (st === 'hit' ? 0.22 : 0.1));
    for (const id of rec.line) setInstanceColor(lines, id, lineColor);
    for (const id of rec.casing) setInstanceColor(casing, id, casingColor);
    for (const id of rec.fill) setInstanceColor(fills, id, fillColor);
  }

  function applyShow() {
    if (!ready) return;
    // per-instance flags follow the class toggles only; the primitives' own show follows the layer's visibility
    for (const rec of ids.values()) {
      const on = classOn[rec.cls];
      for (const id of rec.line) setInstanceShow(lines, id, on);
      for (const id of rec.dash) setInstanceShow(dashes, id, on);
      for (const id of rec.casing) setInstanceShow(casing, id, on);
      for (const id of rec.fill) setInstanceShow(fills, id, on);
      for (const id of rec.exposed) setInstanceShow(exposed, id, on);
    }
    if (exposed) exposed.show = exposedOn;
    if (dashes) dashes.appearance.material.uniforms.color = C(possibleStyle[0], Math.min(1, alphaFor('possible')));
    scene.requestRender();
    syncPulse();
  }

  function recompute() {
    for (const [tid, t] of byId) states.set(tid, targetState(t.props, year, rule, latestObservedYear));
    if (!ready) return;
    for (const tid of byId.keys()) paint(tid);
    if (dashes) dashes.appearance.material.uniforms.color = C(possibleStyle[0], Math.min(1, alphaFor('possible')));
    scene.requestRender();
    syncPulse();
  }

  function syncPulse() {
    const anyHit = [...states].some(([tid, s]) => s === 'hit' && classOn[ids.get(tid).cls]);
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

  const readyPromise = Promise.all([lines, fills, casing, dashes, exposed].filter(Boolean).map((p) => whenReady(scene, p))).then(() => {
    ready = true;
    recompute();
    applyShow();
  });

  const resolve = (id) => {
    if (typeof id !== 'string') return null;
    const m = id.match(/^t[xc]?:(.*?)#/);
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
    owns: (id) => typeof id === 'string' && /^t[xc]?:/.test(id),
    getFeature: resolve,
    get: (tid) => byId.get(tid) || null,
    stateOf: (tid) => states.get(tid) || null,
    classOf: (tid) => ids.get(tid)?.cls || null,
    /** Colour actually painted on a target's first line instance, as [r, g, b, a] 0-255 (dashed "possible" targets: the material colour). */
    paintedColor(tid) {
      const rec = ids.get(tid);
      if (!rec) return null;
      if (rec.dash.length) {
        const c = dashes?.appearance.material.uniforms.color;
        return c ? [c.red, c.green, c.blue, c.alpha].map((v) => Math.round(v * 255)) : null;
      }
      const id = rec.line[0];
      if (!id || !lines?.ready) return null;
      const c = lines.getGeometryInstanceAttributes(id)?.color;
      return c ? Array.from(c) : null;
    },
    /** Whether a target's lines are currently drawn (layer visible and its status class switched on). */
    isShown(tid) {
      const rec = ids.get(tid);
      if (!rec || !ready) return false;
      const prim = rec.dash.length ? dashes : lines;
      const id = rec.dash[0] || rec.line[0];
      const attrs = id && prim.getGeometryInstanceAttributes(id);
      return !!(visible && prim.show && attrs && attrs.show[0] === 1);
    },
    exposedShown: () => !!(exposed && exposed.show),
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
    /** Show or hide one status class ('now', 'by2050', 'by2100', 'possible', 'none'). */
    setClassVisible(cls, v) {
      if (classOn[cls] === v) return;
      classOn[cls] = v;
      applyShow();
    },
    setExposed(v) {
      exposedOn = v; // the halo can be shown without the status lines (True view: "exposed" without "targets")
      if (exposed) exposed.show = v;
      scene.requestRender();
    },
    setVisible(v) {
      visible = v;
      for (const p of [lines, fills, casing, dashes]) if (p) p.show = v;
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
      for (const p of [lines, fills, casing, dashes, exposed]) destroyPrimitive(prims, p);
    },
  };
}
