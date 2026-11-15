// Large-dune layer: NASADEM-resolved dune outlines (2025 positions) coloured by class with id labels (decluttered on screen), threat pulse, and the year-2000 outlines dotted for then-vs-now.
import * as Cesium from 'cesium';
import { polygonsOf, interiorPoint } from '../geo.js';
import { C, CLASS_COLORS, whenReady, setInstanceColor, lineInstance, polygonInstance, linePrimitive, fillPrimitive, dashedLinePrimitive, destroyPrimitive } from './util.js';

const LABEL_MAX_DIST = 45000;
const LABEL_FONT_PX = 13;
const LABEL_PAD = 3;

export function createDunesLayer(viewer, bundle) {
  const scene = viewer.scene;
  const prims = scene.primitives;
  const feats = (bundle.dunes?.features || []).filter((f) => f.properties?.id);
  const byId = new Map();
  const lineIds = new Map();
  const fillIds = new Map();
  const lineInst = [];
  const fillInst = [];

  const labels = new Cesium.LabelCollection({ scene });
  const labelList = []; // { label, text, carto, priority, box }

  for (const f of feats) {
    const p = f.properties;
    const did = p.id;
    const color = CLASS_COLORS[p.class] || '#c9d6df';
    const pt = interiorPoint(f.geometry);
    byId.set(did, { kind: 'dune', id: did, props: p, geometry: f.geometry, lonlat: pt });
    const lids = [];
    const fids = [];
    polygonsOf(f.geometry).forEach((rings, k) => {
      const fid = `d:${did}#f${k}`;
      fillInst.push(polygonInstance(fid, rings[0], C(color, 0.12), rings.slice(1)));
      fids.push(fid);
      rings.forEach((ring, r) => {
        const id = `d:${did}#r${k}_${r}`;
        lineInst.push(lineInstance(id, ring, 3, C(color, 1)));
        lids.push(id);
      });
    });
    lineIds.set(did, lids);
    fillIds.set(did, fids);
    if (pt) {
      const label = labels.add({
        id: `d:${did}#label`,
        position: Cesium.Cartesian3.fromDegrees(pt[0], pt[1]),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        text: did,
        font: '600 13px ui-monospace, Menlo, Consolas, monospace',
        fillColor: C(color, 1),
        outlineColor: C('#000000', 0.9),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, LABEL_MAX_DIST),
      });
      // Priority when labels collide on screen: threatened dunes first, then the taller ones.
      labelList.push({ label, text: did, carto: Cesium.Cartographic.fromDegrees(pt[0], pt[1]), priority: (p.threat === true ? 1e4 : 0) + (Number(p.height_m) || 0), box: null });
    }
  }

  // Year-2000 outlines (same ids), dotted.
  const thenInst = [];
  for (const f of bundle.dunes2000?.features || []) {
    const did = f.properties?.id;
    if (!did) continue;
    polygonsOf(f.geometry).forEach((rings, k) =>
      rings.forEach((ring, r) => thenInst.push(lineInstance(`d0:${did}#r${k}_${r}`, ring, 2.5, Cesium.Color.WHITE))),
    );
  }

  const fills = fillInst.length ? fillPrimitive(fillInst) : null;
  const then = thenInst.length ? dashedLinePrimitive(thenInst, C('#e6edf3', 0.95), 10) : null;
  const lines = lineInst.length ? linePrimitive(lineInst) : null;
  if (fills) prims.add(fills);
  if (then) {
    then.show = false;
    prims.add(then);
  }
  if (lines) prims.add(lines);
  prims.add(labels);

  let visible = true;
  let thin = false;
  let dim = 1;
  let thenNow = 'now';
  let ready = false;
  let pulseTimer = null;
  let phase = 0;
  const threatIds = [...byId.values()].filter((d) => d.props.threat === true).map((d) => d.id);

  function paint(did, pulse = 1) {
    const d = byId.get(did);
    const color = CLASS_COLORS[d.props.class] || '#c9d6df';
    let a = dim * (thin ? 0.7 : 1);
    if (d.props.threat === true) a *= 0.5 + 0.5 * pulse;
    for (const id of lineIds.get(did)) setInstanceColor(lines, id, C(color, a));
    for (const id of fillIds.get(did)) setInstanceColor(fills, id, C(color, (thin ? 0.05 : 0.14) * dim));
  }
  function repaint() {
    if (!ready) return;
    for (const did of byId.keys()) paint(did);
    scene.requestRender();
  }

  const readyPromise = Promise.all([lines && whenReady(scene, lines), fills && whenReady(scene, fills)]).then(() => {
    ready = true;
    repaint();
    if (threatIds.length) {
      pulseTimer = setInterval(() => {
        if (!visible) return;
        phase += 0.35;
        const pulse = 0.5 + 0.5 * Math.sin(phase);
        for (const did of threatIds) paint(did, pulse);
        scene.requestRender();
      }, 110);
    }
  });

  // Label declutter: where dunes cluster (e.g. several outlines within a few hundred metres) their id labels would
  // overlap. After each camera move, labels are placed greedily by priority in screen space and any label whose box
  // would overlap an already placed one is hidden until the view is close enough for it to fit.
  const camera = viewer.camera;
  let lastView = null;
  let lastRun = 0;
  function declutter(force = false) {
    if (!visible || labels.isDestroyed()) return;
    const now = performance.now();
    const view = [camera.positionWC.x, camera.positionWC.y, camera.positionWC.z, camera.directionWC.x, camera.directionWC.y, camera.directionWC.z];
    const moved = !lastView || view.some((v, i) => Math.abs(v - lastView[i]) > (i < 3 ? 0.5 : 1e-6));
    if (!force && (!moved || now - lastRun < 120)) return;
    lastView = view;
    lastRun = now;
    const placed = [];
    const charW = LABEL_FONT_PX * 0.62;
    for (const L of [...labelList].sort((a, b) => b.priority - a.priority)) {
      const h = scene.globe.getHeight(L.carto) ?? 0;
      const world = Cesium.Cartesian3.fromRadians(L.carto.longitude, L.carto.latitude, h);
      const w = Cesium.SceneTransforms.worldToWindowCoordinates(scene, world);
      const dist = Cesium.Cartesian3.distance(camera.positionWC, world);
      if (!w || dist > LABEL_MAX_DIST) {
        L.box = null;
        L.label.show = true; // the distance condition hides it; keep it eligible
        continue;
      }
      const half = (L.text.length * charW) / 2 + LABEL_PAD;
      const box = { x0: w.x - half, x1: w.x + half, y0: w.y - 6 - LABEL_FONT_PX - 2 * LABEL_PAD, y1: w.y - 6 + LABEL_PAD };
      const hit = placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0);
      L.label.show = !hit;
      L.box = hit ? null : box;
      if (!hit) placed.push(box);
    }
    scene.requestRender();
  }
  const removePostRender = scene.postRender.addEventListener(() => declutter());

  function applyShow() {
    if (lines) lines.show = visible;
    if (fills) fills.show = visible;
    labels.show = visible;
    if (then) then.show = visible && thenNow === 'overlay';
    scene.requestRender();
  }

  return {
    kind: 'dune',
    readyPromise,
    get ready() {
      return ready;
    },
    get count() {
      return byId.size;
    },
    owns: (id) => typeof id === 'string' && (id.startsWith('d:') || id.startsWith('d0:')),
    getFeature(id) {
      if (typeof id !== 'string') return null;
      const m = id.match(/^d0?:(.*?)#/);
      return byId.get(m ? m[1] : id) || null;
    },
    get: (did) => byId.get(did) || null,
    setVisible(v) {
      visible = v;
      applyShow();
    },
    setThin(v) {
      thin = v;
      repaint();
    },
    setDim(d) {
      dim = d;
      repaint();
    },
    setThenNow(v) {
      thenNow = v;
      applyShow();
    },
    /** Screen boxes of the dune labels currently shown (after declutter), for tests. */
    labelBoxes() {
      declutter(true);
      return labelList.filter((L) => L.box && L.label.show).map((L) => ({ id: L.text, ...L.box }));
    },
    dispose() {
      if (pulseTimer) clearInterval(pulseTimer);
      removePostRender();
      destroyPrimitive(prims, lines);
      destroyPrimitive(prims, fills);
      destroyPrimitive(prims, then);
      if (!labels.isDestroyed()) prims.remove(labels);
    },
  };
}
