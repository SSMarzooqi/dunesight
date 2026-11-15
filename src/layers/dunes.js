// Large-dune layer: NASADEM-resolved dune outlines (Nov 2025 positions) styled by class like the legend (colour, width, dark casing) with id labels (decluttered on screen), threat pulse, and the Feb 2000 outlines dotted for then-vs-now.
import * as Cesium from 'cesium';
import { polygonsOf, interiorPoint } from '../geo.js';
import { MAP_STYLE } from '../ui/ui.js';
import { C, CASING, classStyle, whenReady, setInstanceColor, lineInstance, polygonInstance, linePrimitive, fillPrimitive, dashedLinePrimitive, destroyPrimitive } from './util.js';

const LABEL_MAX_DIST = 45000;
const LABEL_FONT_PX = 13;
const LABEL_PAD = 3;

export function createDunesLayer(viewer, bundle) {
  const scene = viewer.scene;
  const prims = scene.primitives;
  const feats = (bundle.dunes?.features || []).filter((f) => f.properties?.id);
  const byId = new Map();
  const lineIds = new Map();
  const casingIds = new Map();
  const fillIds = new Map();
  const lineInst = [];
  const casingInst = [];
  const fillInst = [];

  const labels = new Cesium.LabelCollection({ scene });
  const labelList = []; // { label, text, carto, priority, box }

  for (const f of feats) {
    const p = f.properties;
    const did = p.id;
    const [color, width] = classStyle(p.class);
    const pt = interiorPoint(f.geometry);
    byId.set(did, { kind: 'dune', id: did, props: p, geometry: f.geometry, lonlat: pt });
    const lids = [];
    const cids = [];
    const fids = [];
    polygonsOf(f.geometry).forEach((rings, k) => {
      const fid = `d:${did}#f${k}`;
      fillInst.push(polygonInstance(fid, rings[0], C(color, 0.1), rings.slice(1)));
      fids.push(fid);
      rings.forEach((ring, r) => {
        const id = `d:${did}#r${k}_${r}`;
        casingInst.push(lineInstance(`dc:${did}#r${k}_${r}`, ring, width + 2, C(CASING)));
        cids.push(`dc:${did}#r${k}_${r}`);
        lineInst.push(lineInstance(id, ring, width, C(color)));
        lids.push(id);
      });
    });
    lineIds.set(did, lids);
    casingIds.set(did, cids);
    fillIds.set(did, fids);
    if (pt) {
      const label = labels.add({
        id: `d:${did}#label`,
        position: Cesium.Cartesian3.fromDegrees(pt[0], pt[1]),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        text: did,
        font: `600 ${LABEL_FONT_PX}px "IBM Plex Sans", system-ui, sans-serif`,
        fillColor: C(color),
        outlineColor: C('#15130F', 0.9),
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

  // Feb 2000 outlines (same ids), dotted like the legend sample, over a dark casing.
  const [thenColor, thenWidth, thenDash] = MAP_STYLE.dune2000;
  const thenInst = [];
  const thenCasingInst = [];
  for (const f of bundle.dunes2000?.features || []) {
    const did = f.properties?.id;
    if (!did) continue;
    polygonsOf(f.geometry).forEach((rings, k) =>
      rings.forEach((ring, r) => {
        thenInst.push(lineInstance(`d0:${did}#r${k}_${r}`, ring, thenWidth, Cesium.Color.WHITE));
        thenCasingInst.push(lineInstance(`d0c:${did}#r${k}_${r}`, ring, thenWidth + 2, C(CASING)));
      }),
    );
  }

  const fills = fillInst.length ? fillPrimitive(fillInst) : null;
  const casing = casingInst.length ? linePrimitive(casingInst) : null;
  const lines = lineInst.length ? linePrimitive(lineInst) : null;
  const thenCasing = thenCasingInst.length ? linePrimitive(thenCasingInst) : null;
  const then = thenInst.length ? dashedLinePrimitive(thenInst, C(thenColor), thenDash) : null;
  for (const p of [fills, casing, lines, thenCasing, then]) if (p) prims.add(p);
  if (then) then.show = false;
  if (thenCasing) thenCasing.show = false;
  prims.add(labels);

  let visible = true;
  let dim = 1;
  let thenOn = false;
  let ready = false;
  let pulseTimer = null;
  let phase = 0;
  const threatIds = [...byId.values()].filter((d) => d.props.threat === true).map((d) => d.id);

  function paint(did, pulse = 1) {
    const d = byId.get(did);
    const [color] = classStyle(d.props.class);
    let a = dim;
    if (d.props.threat === true) a *= 0.5 + 0.5 * pulse;
    for (const id of lineIds.get(did)) setInstanceColor(lines, id, C(color, a));
    for (const id of casingIds.get(did)) setInstanceColor(casing, id, C(CASING, Math.min(1, 0.3 + 0.7 * a)));
    for (const id of fillIds.get(did)) setInstanceColor(fills, id, C(color, 0.1 * dim));
  }
  function repaint() {
    if (!ready) return;
    for (const did of byId.keys()) paint(did);
    for (const L of labelList) L.label.fillColor = C(classStyle(byId.get(L.text).props.class)[0], Math.max(0.6, dim));
    scene.requestRender();
  }

  const readyPromise = Promise.all([lines, fills, casing].filter(Boolean).map((p) => whenReady(scene, p))).then(() => {
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
    for (const p of [lines, fills, casing]) if (p) p.show = visible;
    labels.show = visible;
    if (then) then.show = thenOn;
    if (thenCasing) thenCasing.show = thenOn;
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
    owns: (id) => typeof id === 'string' && /^d(0?c?):/.test(id),
    getFeature(id) {
      if (typeof id !== 'string') return null;
      const m = id.match(/^d0?c?:(.*?)#/);
      return byId.get(m ? m[1] : id) || null;
    },
    get: (did) => byId.get(did) || null,
    get visible() {
      return visible && !!lines?.show;
    },
    get thenShown() {
      return !!then?.show;
    },
    setVisible(v) {
      visible = v;
      applyShow();
    },
    setDim(d) {
      dim = d;
      repaint();
    },
    /** Show or hide the Feb 2000 outlines (dotted), independently of the 2025 outlines. */
    setThen(v) {
      thenOn = v;
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
      for (const p of [lines, fills, casing, then, thenCasing]) destroyPrimitive(prims, p);
      if (!labels.isDestroyed()) prims.remove(labels);
    },
  };
}
