// Boots DuneSight: creates the globe, loads the site index, runs the fly-in, builds each site's layers on first visit and wires state, timeline, picking and HUD together.
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';

import { state, set, on } from './state.js';
import { loadIndex, loadSite } from './data.js';
import { createViewer } from './basemap.js';
import { createFramesLayer } from './layers/frames.js';
import { createVectorsLayer, arrowOutline, ARROW_YEARS, defaultArrowFactor } from './layers/vectors.js';
import { createTargetsLayer } from './layers/targets.js';
import { createDunesLayer } from './layers/dunes.js';
import { lineInstance, linePrimitive, dashedLinePrimitive, whenReady, destroyPrimitive, C } from './layers/util.js';
import { createTimeline } from './timeline.js';
import { createHeader } from './hud/header.js';
import { panelFrame, renderHeadline, renderThreatList } from './hud/panels.js';
import { duneCard, targetCard, arrowCard, renderCard } from './hud/card.js';
import { renderCompass } from './hud/compass.js';
import { renderLegend } from './hud/legend.js';
import { renderDossier } from './hud/dossier.js';
import { renderCredits } from './hud/credits.js';
import { polygonsOf, bboxOf } from './geo.js';
import { esc } from './format.js';

const $ = (sel) => document.querySelector(sel);
const marks = {};
const mark = (k) => (marks[k] = Math.round(performance.now())); // ms since navigation start

// ---------------------------------------------------------------------------------------------
// Viewer and basemap status
let basemap = {};
const viewer = createViewer($('#globe'), {
  onStatus(s) {
    basemap = s;
    const note = $('#basemap-note');
    const msgs = [];
    if (s.offline) msgs.push('Basemap offline: site layers are drawn from local data over a plain globe.');
    else if (s.note) msgs.push(`Cesium ion unavailable: using ${s.basemap} and flat terrain.`);
    note.hidden = msgs.length === 0;
    note.textContent = msgs.join(' ');
    if (state.site) renderCredits($('#credits'), state.site.sources, basemap);
  },
});
const scene = viewer.scene;
const camera = viewer.camera;
camera.setView({ destination: Cesium.Cartesian3.fromDegrees(54.4, 22.5, 2.3e7) });

// ---------------------------------------------------------------------------------------------
// HUD panels
const headlineBody = panelFrame($('#panel-headline'), 'headline', 'Site measurement', { source: true });
const threatsBody = panelFrame($('#panel-threats'), 'threats', 'Reached targets · earliest first');
const legendBody = panelFrame($('#legend'), 'legend', 'Legend');
const windBody = panelFrame($('#panel-wind'), 'wind', 'Wind vs dune motion', { source: true });
const cardBody = panelFrame($('#panel-card'), 'card', 'Selection');
$('#panel-card .panel-head').insertAdjacentHTML('beforeend', '<button class="collapse card-close" aria-label="Clear selection" title="Clear selection (Esc)">✕</button>');
$('#panel-card .card-close').addEventListener('click', () => clearSelection());

const timeline = createTimeline($('#timeline'), { onStop: (s) => set('stop', s) });

// ---------------------------------------------------------------------------------------------
// Sites and layers
const siteLayers = new Map(); // id -> layers
let index = null;
let header = null;
let flying = false;

function buildLayers(bundle) {
  const latestObservedYear = bundle.derived.latestObserved?.year;
  const frames = createFramesLayer(viewer, bundle);
  const b = bundle.bbox;
  const boxRing = [
    [b.west, b.south],
    [b.east, b.south],
    [b.east, b.north],
    [b.west, b.north],
    [b.west, b.south],
  ];
  const box = linePrimitive([lineInstance(`box:${bundle.id}`, boxRing, 2, C('#39d0ff', 0.9))]);
  scene.primitives.add(box);
  const targets = createTargetsLayer(viewer, bundle, { latestObservedYear });
  const dunes = createDunesLayer(viewer, bundle);
  const vectors = createVectorsLayer(viewer, bundle);
  const boxReady = whenReady(scene, box).then(() => mark(`box:${bundle.id}`));
  const ready = Promise.all([boxReady, targets.readyPromise, dunes.readyPromise]);
  return { frames, box, targets, dunes, vectors, ready };
}

function layers() {
  return siteLayers.get(state.siteId) || null;
}

function setSiteVisible(id, v) {
  const L = siteLayers.get(id);
  if (!L) return;
  L.frames.setVisible(v);
  L.box.show = v;
  L.targets.setVisible(v);
  L.dunes.setVisible(v);
  L.vectors.setVisible(v);
}

let switchToken = 0;
async function activateSite(id, { fly = true } = {}) {
  const entry = index.sites.find((s) => s.id === id);
  if (!entry) return;
  const my = ++switchToken;
  header.setLoading(id, true);
  let bundle;
  try {
    bundle = await loadSite(entry);
  } catch (err) {
    showError(`Could not load ${entry.name}: ${err.message}`);
    header.setLoading(id, false);
    return;
  }
  header.setLoading(id, false);
  if (my !== switchToken) return;
  mark(`data:${id}`);
  clearSelection();
  for (const other of siteLayers.keys()) if (other !== id) setSiteVisible(other, false);
  if (!siteLayers.has(id)) siteLayers.set(id, buildLayers(bundle));
  state.site = bundle;
  state.arrowFactor = defaultArrowFactor(bundle);
  set('siteId', id);
  setSiteVisible(id, true);
  header.setPlaceholder(bundle);

  const s1 = renderHeadline(headlineBody, bundle);
  $('#panel-headline .panel-src').innerHTML = `Source: ${s1}`;
  const s2 = renderCompass(windBody, bundle);
  $('#panel-wind .panel-src').innerHTML = `Source: ${s2}`;
  renderThreatList(threatsBody, bundle, { onPick: (tid) => selectById('target', tid, { fly: true }) });
  renderCredits($('#credits'), bundle.sources, basemap);
  if (!$('#dossier').hidden) openDossier();

  timeline.setSite(bundle);
  applyMode();
  if (fly && !flying) flyHome(2.2);
  siteLayers.get(id).ready.then(() => mark(`layers:${id}`));
}

// ---------------------------------------------------------------------------------------------
// Modes and timeline
function threatPoints(bundle) {
  const pts = [];
  for (const f of bundle.targets?.features || []) {
    const p = f.properties;
    if (Number.isFinite(p?.hit_year_min) && Array.isArray(p.approach?.window_lonlat)) pts.push(p.approach.window_lonlat);
  }
  return pts;
}

function applyMode() {
  const L = layers();
  const b = state.site;
  if (!L || !b) return;
  const mode = state.mode;
  L.frames.setVisible(true);
  if (mode === 'true') {
    L.vectors.setVisible(false);
    L.vectors.emphasiseNear(null);
    L.dunes.setThin(false);
    L.dunes.setDim(1);
    L.targets.setDim(0.5);
  } else if (mode === 'motion') {
    L.vectors.setVisible(true);
    L.vectors.setDim(1);
    L.vectors.emphasiseNear(null);
    L.dunes.setThin(true);
    L.dunes.setDim(0.8);
    L.targets.setDim(0.4);
  } else {
    L.vectors.setVisible(true);
    L.vectors.setDim(1);
    L.vectors.emphasiseNear(threatPoints(b), 250);
    L.dunes.setThin(false);
    L.dunes.setDim(0.75);
    L.targets.setDim(1);
  }
  $('#panel-threats').hidden = mode !== 'threat';
  document.body.dataset.mode = mode;
  L.targets.setExposed(state.exposed);
  L.dunes.setThenNow(state.thenNow);
  L.vectors.setFactor(state.arrowFactor);
  L.targets.setRule(state.hitRule);
  renderLegend(legendBody, b, { projected: state.stop?.kind === 'projected' });
}

function applyStop(stop) {
  const L = layers();
  if (!L || !stop) return;
  header.setStop(stop);
  if (stop.kind === 'observed') {
    L.frames.show({ base: stop.frame, med: null, fast: null, change: false });
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
  L.targets.setYear(stop.year);
  L.vectors.setTrackYears(stop.kind === 'projected' ? stop.yearsSince : 0);
  document.body.dataset.timekind = stop.kind;
  renderLegend(legendBody, state.site, { projected: stop.kind === 'projected' });
  if (state.selection) showCard(state.selection);
}

on('mode', applyMode);
on('stop', applyStop);
on('hitRule', (r) => {
  layers()?.targets.setRule(r);
  if (state.selection) showCard(state.selection);
});
on('showFast', () => applyStop(state.stop));
on('showChange', () => applyStop(state.stop));
on('exposed', (v) => layers()?.targets.setExposed(v));
on('thenNow', (v) => layers()?.dunes.setThenNow(v));
on('arrowFactor', (f) => {
  layers()?.vectors.setFactor(f);
  renderLegend(legendBody, state.site, { projected: state.stop?.kind === 'projected' });
  if (state.selection?.kind === 'arrow') highlight(state.selection);
});

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
  const sphere = siteSphere(b);
  const topDown = state.topDown;
  const pitch = Cesium.Math.toRadians(topDown ? -90 : -52);
  const range = sphere.radius * (topDown ? 2.45 : 2.55);
  camera.flyToBoundingSphere(sphere, {
    offset: new Cesium.HeadingPitchRange(0, pitch, range),
    duration,
    complete: done,
    cancel: done,
  });
}

function setTopDown(v) {
  set('topDown', v);
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
  g.strokeStyle = '#39d0ff';
  g.lineWidth = 2.5;
  const L = 14;
  for (const [x, y, dx, dy] of [
    [4, 4, 1, 1],
    [60, 4, -1, 1],
    [4, 60, 1, -1],
    [60, 60, -1, -1],
  ]) {
    g.beginPath();
    g.moveTo(x, y + dy * L);
    g.lineTo(x, y);
    g.lineTo(x + dx * L, y);
    g.stroke();
  }
  g.strokeStyle = '#ffffff';
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
  const inst = [];
  const g = sel.geometry;
  if (sel.kind === 'arrow') {
    const p = sel.props;
    const ring = arrowOutline(sel.lonlat[0], sel.lonlat[1], p.heading_deg, p.speed_myr * ARROW_YEARS * state.arrowFactor);
    inst.push(lineInstance('hl:a', [...ring, ring[0]], 3, C('#ffffff', 1)));
  } else if (g) {
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    lines.forEach((c, i) => inst.push(lineInstance(`hl:l${i}`, c, 9, C('#ffffff', 0.85))));
    polygonsOf(g).forEach((rings, k) => rings.forEach((r, i) => inst.push(lineInstance(`hl:r${k}_${i}`, r, 5, C('#ffffff', 0.95)))));
  }
  if (inst.length) {
    const p = linePrimitive(inst);
    scene.primitives.add(p);
    highlightPrims.push(p);
  }
  const a = sel.props?.approach;
  if (sel.kind === 'target' && Array.isArray(a?.window_lonlat) && Array.isArray(a?.hit_point_lonlat)) {
    const p = dashedLinePrimitive([lineInstance('hl:approach', [a.window_lonlat, a.hit_point_lonlat], 4, Cesium.Color.WHITE)], C('#ffd166', 1), 12);
    scene.primitives.add(p);
    highlightPrims.push(p);
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
  renderCard(cardBody, card);
  const panel = $('#panel-card');
  panel.hidden = false;
  panel.classList.remove('collapsed');
  panel.dataset.kind = sel.kind;
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
  $('#panel-card').hidden = true;
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
  scene.canvas.style.cursor = /^(t|tx|d|v|vt):/.test(id) ? 'pointer' : '';
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// ---------------------------------------------------------------------------------------------
// Dossier, errors, keyboard
function openDossier(anchor) {
  const el = $('#dossier');
  if (!state.site) return;
  renderDossier(el, state.site, { basemap });
  el.hidden = false;
  el.querySelector('[data-close]').addEventListener('click', closeDossier);
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

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if (e.key === 'Escape') {
    if (!$('#dossier').hidden) closeDossier();
    else clearSelection();
  } else if (e.key === ' ' && !e.target.closest('button')) {
    e.preventDefault();
    timeline.toggle();
  } else if (e.key === 'ArrowLeft' && !e.target.closest('.tl-bar')) timeline.step(-1);
  else if (e.key === 'ArrowRight' && !e.target.closest('.tl-bar')) timeline.step(1);
});

// ---------------------------------------------------------------------------------------------
// Boot
async function boot() {
  try {
    index = await loadIndex();
  } catch (err) {
    $('#boot').remove();
    showError(`Could not load data/sites.json: ${err.message}`);
    return;
  }
  const sites = (index.sites || []).filter((s) => s.data_dir);
  index.sites = sites;
  header = createHeader($('#hud-header'), {
    sites,
    onSite: (id) => activateSite(id),
    onHome: () => flyHome(1.4),
    onTopDown: setTopDown,
    onDossier: () => openDossier(),
  });
  mark('hud');
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
  timeline,
  setSite: (id) => activateSite(id),
  siteReady: () => layers()?.ready,
  setMode: (m) => set('mode', m),
  goYear: (y) => timeline.goYear(y),
  targetState: (tid) => layers()?.targets.stateOf(tid),
  select: (kind, id) => !!selectById(kind, id),
  clear: () => clearSelection(),
  isFlying: () => flying,
  basemap: () => ({ ...basemap }),
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
    await new Promise((r) => setTimeout(r, 400));
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
