// Boots DuneSight: creates the globe, loads the site index, mounts the UI (src/ui/ui.js) with each site's data, runs the fly-in, builds each site's layers on first visit and wires the UI's callbacks to layers, timeline, picking, camera and the dossier.
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './ui/tokens.css';
import './ui/ui.css';
import './style.css';

import { state, set } from './state.js';
import { loadIndex, loadSite, shortName } from './data.js';
import { createViewer } from './basemap.js';
import { createFramesLayer } from './layers/frames.js';
import { createVectorsLayer, arrowOutline, ARROW_YEARS, defaultArrowFactor } from './layers/vectors.js';
import { createTargetsLayer, CLASSES } from './layers/targets.js';
import { createDunesLayer } from './layers/dunes.js';
import { lineInstance, linePrimitive, dashedLinePrimitive, whenReady, destroyPrimitive, C, CASING } from './layers/util.js';
import { buildStops } from './timeline.js';
import { mountDuneSightUI, MAP_STYLE } from './ui/ui.js';
import { buildSiteData } from './ui/site-data.js';
import { duneCard, targetCard, arrowCard } from './hud/card.js';
import { renderDossier } from './hud/dossier.js';
import { CREDIT_LINE } from './hud/credits.js';
import { polygonsOf, bboxOf } from './geo.js';
import { esc } from './format.js';

const $ = (sel) => document.querySelector(sel);
const marks = {};
const mark = (k) => (marks[k] = Math.round(performance.now())); // ms since navigation start

// ---------------------------------------------------------------------------------------------
// Viewer and basemap status
let basemap = {};
let ui = null;
const viewer = createViewer($('#globe'), {
  onStatus(s) {
    basemap = s;
    const note = $('#basemap-note');
    const msgs = [];
    if (s.offline) msgs.push('Basemap offline: site layers are drawn from local data over a plain globe.');
    else if (s.note) msgs.push(`Cesium ion unavailable: using ${s.basemap} and flat terrain.`);
    note.hidden = msgs.length === 0;
    note.textContent = msgs.join(' ');
    ui?.setBasemap(s.basemap);
  },
});
const scene = viewer.scene;
const camera = viewer.camera;
camera.setView({ destination: Cesium.Cartesian3.fromDegrees(54.4, 22.5, 2.3e7) });

// ---------------------------------------------------------------------------------------------
// Sites and layers
const siteLayers = new Map(); // id -> layers
const siteData = new Map(); // id -> UI data object
let index = null;
let flying = false;

function boxRing(b) {
  return [
    [b.west, b.south],
    [b.east, b.south],
    [b.east, b.north],
    [b.west, b.north],
    [b.west, b.south],
  ];
}

function buildLayers(bundle) {
  const latestObservedYear = bundle.derived.latestObserved?.year;
  const frames = createFramesLayer(viewer, bundle);
  const ring = boxRing(bundle.bbox);
  const [boxHex, boxW] = MAP_STYLE.box;
  const [pHex, pW, pDash] = MAP_STYLE.boxProjected;
  const boxCasing = linePrimitive([lineInstance(`boxc:${bundle.id}`, ring, Math.max(boxW, pW) + 2, C(CASING))]);
  const box = linePrimitive([lineInstance(`box:${bundle.id}`, ring, boxW, C(boxHex))]);
  const boxProjected = dashedLinePrimitive([lineInstance(`boxp:${bundle.id}`, ring, pW, Cesium.Color.WHITE)], C(pHex), pDash);
  boxProjected.show = false;
  for (const p of [boxCasing, box, boxProjected]) scene.primitives.add(p);
  const targets = createTargetsLayer(viewer, bundle, { latestObservedYear });
  const dunes = createDunesLayer(viewer, bundle);
  const vectors = createVectorsLayer(viewer, bundle);
  const boxReady = whenReady(scene, box).then(() => mark(`box:${bundle.id}`));
  const ready = Promise.all([boxReady, targets.readyPromise, dunes.readyPromise, vectors.readyPromise]);
  const model = buildStops(bundle.manifest);
  // threat-mode emphasis: arrows within reach of a hit target
  const threatPoints = [];
  for (const f of bundle.targets?.features || []) {
    const p = f.properties;
    if (Number.isFinite(p?.hit_year_min) && Array.isArray(p.approach?.window_lonlat)) threatPoints.push(p.approach.window_lonlat);
  }
  return { frames, box, boxCasing, boxProjected, targets, dunes, vectors, ready, model, threatPoints, boxOn: true };
}

function layers() {
  return siteLayers.get(state.siteId) || null;
}

function setSiteVisible(id, v) {
  const L = siteLayers.get(id);
  if (!L) return;
  L.frames.setVisible(v);
  if (v) return; // applyLayers() and applyStop() decide what of the active site is drawn
  L.box.show = false;
  L.boxCasing.show = false;
  L.boxProjected.show = false;
  L.targets.setVisible(false);
  L.targets.setExposed(false);
  L.dunes.setVisible(false);
  L.dunes.setThen(false);
  L.vectors.setVisible(false);
}

// The PROJECTED tag on the map, at the north-west corner of the site box.
const mapTags = new Cesium.LabelCollection({ scene });
scene.primitives.add(mapTags);
const projectedTag = mapTags.add({
  text: 'PROJECTED',
  font: '600 13px "IBM Plex Sans", system-ui, sans-serif',
  fillColor: C(MAP_STYLE.projected),
  showBackground: true,
  backgroundColor: C('#15130F', 0.82),
  backgroundPadding: new Cesium.Cartesian2(7, 4),
  horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
  verticalOrigin: Cesium.VerticalOrigin.TOP,
  pixelOffset: new Cesium.Cartesian2(6, 6),
  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
  disableDepthTestDistance: Number.POSITIVE_INFINITY,
  show: false,
});

let switchToken = 0;
async function activateSite(id, { fly = true } = {}) {
  const entry = index.sites.find((s) => s.id === id);
  if (!entry) return;
  const my = ++switchToken;
  ui?.setLoading(id, true);
  let bundle;
  try {
    bundle = await loadSite(entry);
  } catch (err) {
    showError(`Could not load ${entry.name}: ${err.message}`);
    ui?.setLoading(id, false);
    return;
  }
  ui?.setLoading(id, false);
  if (my !== switchToken) return;
  mark(`data:${id}`);
  clearSelection();
  for (const other of siteLayers.keys()) if (other !== id) setSiteVisible(other, false);
  if (!siteLayers.has(id)) siteLayers.set(id, buildLayers(bundle));
  state.site = bundle;
  state.arrowFactor = defaultArrowFactor(bundle);
  if (!siteData.has(id)) siteData.set(id, buildSiteData(bundle, { arrowFactor: state.arrowFactor, arrowYears: ARROW_YEARS }));
  const data = siteData.get(id);
  set('siteId', id);
  if (!ui) mountUI(data);
  else ui.setData(data);
  ui.setBasemap(basemap.basemap);
  setSiteVisible(id, true);
  projectedTag.position = Cesium.Cartesian3.fromDegrees(bundle.bbox.west, bundle.bbox.north);
  if (!$('#dossier').hidden) openDossier();
  applyLayers();
  applyYear(ui.getState().year);
  if (fly && !flying) flyHome(2.2);
  siteLayers.get(id).ready.then(() => mark(`layers:${id}`));
}

// ---------------------------------------------------------------------------------------------
// Layers, modes and the timeline (all driven by the UI's state)
function applyLayers() {
  const L = layers();
  if (!L || !ui) return;
  const { mode, layers: on, settings } = ui.getState();
  state.mode = mode;
  document.body.dataset.mode = mode;
  L.frames.setVisible(true);
  // arrows
  L.vectors.setVisible(!!on.vectors);
  L.vectors.setDim(1);
  L.vectors.emphasiseNear(mode === 'threat' ? L.threatPoints : null, 250);
  if (settings.arrowFactor !== state.arrowFactor) set('arrowFactor', settings.arrowFactor);
  L.vectors.setFactor(state.arrowFactor);
  // dunes
  L.dunes.setVisible(!!on.dunes);
  L.dunes.setDim(mode === 'threat' ? 0.55 : 1);
  L.dunes.setThen(!!on.dunes2000);
  // targets: per status class in Threat, all together in True view, none in Motion
  if (mode === 'threat') {
    L.targets.setVisible(true);
    for (const k of CLASSES) L.targets.setClassVisible(k, !!on[`t_${k}`]);
    L.targets.setDim(1);
  } else if (mode === 'true') {
    L.targets.setVisible(!!on.targets);
    for (const k of CLASSES) L.targets.setClassVisible(k, true);
    L.targets.setDim(0.7);
  } else {
    L.targets.setVisible(false);
  }
  L.targets.setExposed(!!on.exposed);
  // study box and projected imagery
  L.boxOn = on.box !== false;
  state.projectedOn = on.projected !== false;
  L.vectors.setTracksVisible(state.projectedOn);
  applyStop(state.stop);
}

function applySettings(key, value) {
  if (key === 'reachCase') {
    state.hitRule = value === 'median' ? 'med' : 'min';
    layers()?.targets.setRule(state.hitRule);
    if (state.selection) showCard(state.selection);
  } else if (key === 'fastCaseFrame') {
    state.showFast = !!value;
    applyStop(state.stop);
  } else if (key === 'changedPixels') {
    state.showChange = !!value;
    applyStop(state.stop);
  } else if (key === 'arrowFactor') {
    set('arrowFactor', value);
    layers()?.vectors.setFactor(value);
    if (state.selection?.kind === 'arrow') highlight(state.selection);
  }
}

function applyYear(year) {
  const L = layers();
  if (!L) return;
  const stop = L.model.stops.find((s) => s.year === year) || L.model.stops.find((s) => s.year === L.model.latest?.year);
  set('stop', stop);
  applyStop(stop);
}

function applyStop(stop) {
  const L = layers();
  if (!L || !stop) return;
  const projected = stop.kind === 'projected';
  const showProjected = projected && state.projectedOn !== false;
  if (!projected) {
    L.frames.show({ base: stop.frame, med: null, fast: null, change: false });
  } else if (!showProjected) {
    L.frames.show({ base: stop.base, med: null, fast: null, change: false });
  } else {
    L.frames.show({
      base: stop.base,
      med: stop.med,
      medAlpha: stop.medAlpha,
      fast: state.showFast ? stop.fast : null,
      fastAlpha: 0.2,
      change: state.showChange,
    });
  }
  L.box.show = L.boxOn && !projected;
  L.boxProjected.show = L.boxOn && projected;
  L.boxCasing.show = L.boxOn;
  projectedTag.show = showProjected;
  projectedTag.text = `PROJECTED ${stop.year}${stop.med ? ` · median case, ${stop.med.year} frame` : ''}`;
  L.targets.setYear(stop.year);
  L.vectors.setTrackYears(projected ? stop.yearsSince : 0);
  document.body.dataset.timekind = stop.kind;
  if (state.selection) showCard(state.selection);
  scene.requestRender();
}

// ---------------------------------------------------------------------------------------------
// Camera
function siteSphere(b) {
  const r = Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north);
  const c = Cesium.Rectangle.center(r);
  const center = Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, 0);
  const corner = Cesium.Cartesian3.fromDegrees(b.west, b.south, 0);
  return new Cesium.BoundingSphere(center, Cesium.Cartesian3.distance(center, corner));
}

function flyHome(duration = 2, done) {
  const b = state.site?.bbox;
  if (!b) return;
  // On a phone the bottom sheet covers the lower half of the globe: aim south of the box so it sits in the visible top part.
  const phone = window.innerWidth <= 760 && window.innerHeight > window.innerWidth;
  const aim = phone ? { ...b, south: b.south - (b.north - b.south) * 0.9, north: b.north - (b.north - b.south) * 0.9 } : b;
  const sphere = siteSphere(aim);
  const topDown = state.topDown;
  const pitch = Cesium.Math.toRadians(topDown ? -90 : -52);
  const range = sphere.radius * (topDown ? 2.45 : 2.55) * (phone ? 1.6 : 1);
  camera.flyToBoundingSphere(sphere, {
    offset: new Cesium.HeadingPitchRange(0, pitch, range),
    duration,
    complete: done,
    cancel: done,
  });
}

function setTopDown(v) {
  set('topDown', v);
  ui?.setTopDown(v);
  flyHome(1.2);
}

function flyToFeature(f, { duration = 1.6 } = {}) {
  const g = f.geometry;
  let w, s, e, n;
  if (g) [w, s, e, n] = bboxOf(g);
  else [w, s, e, n] = [f.lonlat[0], f.lonlat[1], f.lonlat[0], f.lonlat[1]];
  const sphere = siteSphere({ west: w, south: s, east: e, north: n });
  sphere.radius = Math.max(sphere.radius, 350);
  const pitch = Cesium.Math.toRadians(state.topDown ? -90 : -58);
  camera.flyToBoundingSphere(sphere, { offset: new Cesium.HeadingPitchRange(0, pitch, sphere.radius * 4.2), duration });
}

function runFlyIn() {
  const b = state.site?.bbox;
  flying = true;
  const finish = () => {
    flying = false;
    window.removeEventListener('pointerdown', skip, true);
    window.removeEventListener('keydown', skip, true);
    window.removeEventListener('wheel', skip, true);
    mark('flyin-done');
  };
  const skip = () => {
    if (!flying) return;
    camera.cancelFlight();
    flyHome(0);
    finish();
  };
  window.addEventListener('pointerdown', skip, true);
  window.addEventListener('keydown', skip, true);
  window.addEventListener('wheel', skip, true);
  const cx = b ? (b.west + b.east) / 2 : 54.5;
  const cy = b ? (b.south + b.north) / 2 : 24;
  camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(cx, cy - 1.2, 9.0e5),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(-75), roll: 0 },
    duration: 2.2,
    complete: () => {
      if (!flying) return;
      flyHome(2.6, finish);
    },
    cancel: () => {},
  });
}

// ---------------------------------------------------------------------------------------------
// Picking, selection, reticle
const reticles = new Cesium.BillboardCollection({ scene });
scene.primitives.add(reticles);
const reticleImage = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const corners = [
    [4, 4, 1, 1],
    [60, 4, -1, 1],
    [4, 60, 1, -1],
    [60, 60, -1, -1],
  ];
  for (const [color, width] of [
    ['rgba(21,19,15,0.75)', 5],
    [MAP_STYLE.text, 2.5],
  ]) {
    g.strokeStyle = color;
    g.lineWidth = width;
    for (const [x, y, dx, dy] of corners) {
      g.beginPath();
      g.moveTo(x, y + dy * 14);
      g.lineTo(x, y);
      g.lineTo(x + dx * 14, y);
      g.stroke();
    }
  }
  g.strokeStyle = MAP_STYLE.text;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(32, 22);
  g.lineTo(32, 28);
  g.moveTo(32, 36);
  g.lineTo(32, 42);
  g.moveTo(22, 32);
  g.lineTo(28, 32);
  g.moveTo(36, 32);
  g.lineTo(42, 32);
  g.stroke();
  return c;
})();
let highlightPrims = [];

function highlight(sel) {
  for (const p of highlightPrims) destroyPrimitive(scene.primitives, p);
  highlightPrims = [];
  reticles.removeAll();
  if (!sel) {
    scene.requestRender();
    return;
  }
  const casing = [];
  const inst = [];
  const g = sel.geometry;
  const hl = C(MAP_STYLE.text);
  if (sel.kind === 'arrow') {
    const p = sel.props;
    const ring = arrowOutline(sel.lonlat[0], sel.lonlat[1], p.heading_deg, p.speed_myr * ARROW_YEARS * state.arrowFactor);
    casing.push(lineInstance('hlc:a', [...ring, ring[0]], 5, C(CASING)));
    inst.push(lineInstance('hl:a', [...ring, ring[0]], 3, hl));
  } else if (g) {
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    lines.forEach((c, i) => {
      casing.push(lineInstance(`hlc:l${i}`, c, 11, C(CASING)));
      inst.push(lineInstance(`hl:l${i}`, c, 9, C(MAP_STYLE.text, 0.85)));
    });
    polygonsOf(g).forEach((rings, k) =>
      rings.forEach((r, i) => {
        casing.push(lineInstance(`hlc:r${k}_${i}`, r, 6, C(CASING)));
        inst.push(lineInstance(`hl:r${k}_${i}`, r, 4, hl));
      }),
    );
  }
  for (const set2 of [casing, inst]) {
    if (!set2.length) continue;
    const p = linePrimitive(set2);
    scene.primitives.add(p);
    highlightPrims.push(p);
  }
  const a = sel.props?.approach;
  if (sel.kind === 'target' && Array.isArray(a?.hit_point_lonlat)) {
    // Reach ray: from the migrating sand edge along the measured heading to the target footprint (stone: a projection),
    // plus a faint dashed link back to the 480 m window where the motion was measured.
    if (Array.isArray(a.window_lonlat) && Array.isArray(a.sand_edge_lonlat)) {
      const link = dashedLinePrimitive([lineInstance('hl:window', [a.window_lonlat, a.sand_edge_lonlat], 2, Cesium.Color.WHITE)], C(MAP_STYLE.text, 0.7), '4 4');
      scene.primitives.add(link);
      highlightPrims.push(link);
    }
    if (Array.isArray(a.sand_edge_lonlat)) {
      const rc = linePrimitive([lineInstance('hlc:ray', [a.sand_edge_lonlat, a.hit_point_lonlat], 7, C(CASING))]);
      const ray = linePrimitive([lineInstance('hl:ray', [a.sand_edge_lonlat, a.hit_point_lonlat], 5, C(MAP_STYLE.projected))]);
      scene.primitives.add(rc);
      scene.primitives.add(ray);
      highlightPrims.push(rc, ray);
    }
  }
  const pos = sel.kind === 'target' && Array.isArray(a?.hit_point_lonlat) ? a.hit_point_lonlat : sel.lonlat;
  if (pos) {
    reticles.add({
      position: Cesium.Cartesian3.fromDegrees(pos[0], pos[1]),
      image: reticleImage,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      width: 46,
      height: 46,
    });
  }
  scene.requestRender();
}

function showCard(sel) {
  const b = state.site;
  let card;
  if (sel.kind === 'dune') card = duneCard(sel, b);
  else if (sel.kind === 'target') {
    const L = layers();
    card = targetCard(sel, b, { state: L?.targets.stateOf(sel.id), year: state.stop?.year, rule: state.hitRule });
  } else card = arrowCard(sel, b);
  ui.setCard({ ...card, kind: sel.kind });
}

function select(sel) {
  state.selection = sel;
  showCard(sel);
  highlight(sel);
  set('selectionId', `${sel.kind}:${sel.id}`);
}

function clearSelection() {
  if (!state.selection) return;
  state.selection = null;
  ui?.setCard(null);
  highlight(null);
  set('selectionId', null);
}

function selectById(kind, id, { fly = false } = {}) {
  const L = layers();
  if (!L) return null;
  const f = kind === 'target' ? L.targets.get(id) : kind === 'dune' ? L.dunes.get(id) : L.vectors.getFeature(id);
  if (!f) return null;
  select(f);
  if (fly) flyToFeature(f);
  return f;
}

const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
handler.setInputAction((click) => {
  const L = layers();
  if (!L) return;
  const picked = scene.pick(click.position);
  const id = typeof picked?.id === 'string' ? picked.id : null;
  if (!id) return clearSelection();
  for (const layer of [L.targets, L.dunes, L.vectors]) {
    if (layer.owns(id)) {
      const f = layer.getFeature(id);
      if (f) return select(f);
    }
  }
  clearSelection();
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
handler.setInputAction((move) => {
  const picked = scene.pick(move.endPosition);
  const id = typeof picked?.id === 'string' ? picked.id : '';
  scene.canvas.style.cursor = /^(t|tx|tc|d|dc|v|vh|vt|vtc):/.test(id) ? 'pointer' : '';
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// ---------------------------------------------------------------------------------------------
// Dossier, errors, keyboard
function openDossier(anchor) {
  const el = $('#dossier');
  if (!state.site) return;
  renderDossier(el, state.site, { basemap });
  el.hidden = false;
  el.querySelector('[data-close]').addEventListener('click', closeDossier);
  el.querySelector('[data-guide]')?.addEventListener('click', () => {
    closeDossier();
    ui?.showGuide();
  });
  el.querySelectorAll('[data-jump]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      el.querySelector(`#ds-${a.dataset.jump}`)?.scrollIntoView({ block: 'start' });
    }),
  );
  if (anchor) el.querySelector(`#ds-${anchor}`)?.scrollIntoView({ block: 'start' });
  el.querySelector('[data-close]').focus();
}
function closeDossier() {
  $('#dossier').hidden = true;
}
$('#dossier').addEventListener('click', (e) => {
  if (e.target.id === 'dossier') closeDossier();
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-dossier]');
  if (!a) return;
  e.preventDefault();
  openDossier(a.dataset.dossier);
});

function showError(msg) {
  const el = $('#error-note');
  el.textContent = msg;
  el.hidden = false;
  console.error(`[DuneSight] ${msg}`);
}

// Space and the arrow keys are handled by the UI (timeline); Escape closes the dossier or clears the selection.
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if (e.key === 'Escape') {
    if (!$('#dossier').hidden) closeDossier();
    else clearSelection();
  }
});

// ---------------------------------------------------------------------------------------------
// UI
function mountUI(data) {
  ui = mountDuneSightUI($('#app'), {
    data,
    sites: index.sites.map((s) => ({ id: s.id, name: shortName(s.name || s.id) })),
    siteId: data.id,
    mode: state.mode,
    credit: CREDIT_LINE,
    creditNode: $('#cesium-credits'),
    keyGuard: () => !$('#dossier').hidden,
    onSiteChange: (id) => activateSite(id),
    onModeChange: () => applyLayers(),
    onLayerToggle: () => applyLayers(),
    onTimeChange: (year) => applyYear(year),
    onSettingChange: applySettings,
    onHome: () => flyHome(1.4),
    onTopDown: () => setTopDown(!state.topDown),
    onHowWeKnow: () => openDossier(),
    onMethod: () => openDossier('method'),
    onReadingNote: () => openDossier('frames'),
    onCredits: () => openDossier('credits'),
    onPickTarget: (tid) => selectById('target', tid, { fly: true }),
    onClearSelection: () => clearSelection(),
  });
  mark('hud');
}

/** Wait (briefly) for the self-hosted IBM Plex faces, so canvas labels and the first paint use them and they are cached before any network loss. */
function fontsReady() {
  if (!document.fonts?.load) return Promise.resolve();
  const sample = 'DuneSight 0123456789 m/yr ° σ – · → ≥ ×';
  const loads = ['400', '500', '600'].map((w) => document.fonts.load(`${w} 14px "IBM Plex Sans"`, sample));
  loads.push(document.fonts.load('400 12px "IBM Plex Mono"', 'LC08_L1TP_0123456789'));
  return Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
}

// ---------------------------------------------------------------------------------------------
// Boot
async function boot() {
  try {
    [index] = await Promise.all([loadIndex(), fontsReady()]);
  } catch (err) {
    $('#boot').remove();
    showError(`Could not load data/sites.json: ${err.message}`);
    return;
  }
  const sites = (index.sites || []).filter((s) => s.data_dir);
  index.sites = sites;
  const first = sites.find((s) => s.id === index.default_site) || sites[0];
  await activateSite(first.id, { fly: false });
  $('#boot').classList.add('gone');
  setTimeout(() => $('#boot')?.remove(), 600);
  runFlyIn();
  await layers().ready;
  mark('first-view');
}

const readyPromise = boot();

// Test and debugging hooks (read-only views plus a few navigation helpers).
window.__ds = {
  Cesium,
  viewer,
  state,
  marks,
  ready: readyPromise,
  layers,
  get ui() {
    return ui;
  },
  timeline: {
    get stop() {
      return state.stop;
    },
    get playing() {
      return !!ui?.getState().playing;
    },
    get model() {
      return layers()?.model;
    },
  },
  siteData: () => siteData.get(state.siteId),
  setSite: (id) => activateSite(id),
  siteReady: () => layers()?.ready,
  setMode: (m) => ui.root.querySelector(`[data-mode="${m}"]`).click(),
  goYear: (y) => ui.goYear(y),
  targetState: (tid) => layers()?.targets.stateOf(tid),
  select: (kind, id) => !!selectById(kind, id),
  clear: () => clearSelection(),
  isFlying: () => flying,
  basemap: () => ({ ...basemap }),
  /** Colour actually painted on a target's first line instance, as [r, g, b, a] 0-255. */
  targetColor: (tid) => layers()?.targets.paintedColor(tid) || null,
  /** What the map is drawing right now, per legend layer id. */
  shown() {
    const L = layers();
    if (!L) return null;
    const anyOf = (cls) => {
      for (const f of state.site.targets.features) if (L.targets.classOf(f.properties.id) === cls) return L.targets.isShown(f.properties.id);
      return null;
    };
    const roles = L.frames.roles();
    return {
      vectors: L.vectors.visible,
      dunes: L.dunes.visible,
      dunes2000: L.dunes.thenShown,
      box: L.box.show || L.boxProjected.show,
      boxProjected: L.boxProjected.show,
      projected: !!roles.med || L.vectors.tracksShown,
      projectedTag: projectedTag.show,
      t_now: anyOf('now'),
      t_by2050: anyOf('by2050'),
      t_by2100: anyOf('by2100'),
      t_possible: anyOf('possible'),
      t_none: anyOf('none'),
      exposed: L.targets.exposedShown(),
      frames: roles,
    };
  },
  /** Window coordinates of an arrow's tail (window centre) and tip at the current camera. */
  arrowEnds(id) {
    const f = layers()?.vectors.getFeature(id);
    if (!f) return null;
    const p = f.props;
    const ring = arrowOutline(f.lonlat[0], f.lonlat[1], p.heading_deg, p.speed_myr * ARROW_YEARS * state.arrowFactor);
    const toWin = ([lon, lat]) => {
      const h = scene.globe.getHeight(Cesium.Cartographic.fromDegrees(lon, lat)) || 0;
      const w = Cesium.SceneTransforms.worldToWindowCoordinates(scene, Cesium.Cartesian3.fromDegrees(lon, lat, h));
      return w ? { x: w.x, y: w.y } : null;
    };
    return { tail: toWin(f.lonlat), tip: toWin(ring[3]), heading: p.heading_deg };
  },
  /** Ground point at the centre of the canvas (lon, lat in degrees), or null. */
  centreGround() {
    const c = new Cesium.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
    const ray = camera.getPickRay(c);
    const pos = ray && scene.globe.pick(ray, scene);
    if (!pos) return null;
    const g = Cesium.Cartographic.fromCartesian(pos);
    return [Cesium.Math.toDegrees(g.longitude), Cesium.Math.toDegrees(g.latitude)];
  },
  /** Instantly frame a feature top-down and return its window coordinates for a real click. */
  async frameFeature(kind, id) {
    const L = layers();
    const f = kind === 'target' ? L.targets.get(id) : kind === 'dune' ? L.dunes.get(id) : L.vectors.getFeature(id);
    if (!f) return null;
    camera.cancelFlight();
    flying = false;
    const [lon, lat] = f.lonlat;
    camera.setView({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, 2200), orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 } });
    scene.requestRender();
    // wait until the terrain/imagery tiles for this view are in, so a click picks what is drawn
    const t0 = performance.now();
    await new Promise((resolve) => {
      const check = () => {
        scene.requestRender();
        if ((scene.globe.tilesLoaded && performance.now() - t0 > 300) || performance.now() - t0 > 8000) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
    let target = f.lonlat;
    if (kind === 'arrow') {
      const p = f.props;
      const ring = arrowOutline(lon, lat, p.heading_deg, p.speed_myr * ARROW_YEARS * state.arrowFactor);
      target = [(ring[0][0] + ring[1][0] + ring[5][0] + ring[6][0]) / 4, (ring[0][1] + ring[1][1] + ring[5][1] + ring[6][1]) / 4];
    }
    const carto = Cesium.Cartographic.fromDegrees(target[0], target[1]);
    const h = scene.globe.getHeight(carto) || 0;
    const win = Cesium.SceneTransforms.worldToWindowCoordinates(scene, Cesium.Cartesian3.fromDegrees(target[0], target[1], h));
    return win ? { x: win.x, y: win.y } : null;
  },
  esc,
};
