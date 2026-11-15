// DuneSight placeholder shell: a Cesium globe plus a proof that public/data/ is reachable.
// The real app (layers, timeline, HUD) is written later from docs/build-spec.md.
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';

const token = import.meta.env.VITE_CESIUM_TOKEN || '';
const hasToken = token.trim().length > 0;
if (hasToken) Cesium.Ion.defaultAccessToken = token;

// Without a token, use a non-ion basemap (Esri World Imagery) and a flat ellipsoid,
// so the globe renders with no Cesium ion account.
const viewerOptions = {
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  fullscreenButton: false,
  infoBox: false,
  selectionIndicator: false,
};

if (!hasToken) {
  viewerOptions.baseLayer = new Cesium.ImageryLayer(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      credit: new Cesium.Credit('Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community', true),
      maximumLevel: 18,
    }),
  );
  viewerOptions.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  document.getElementById('basemap-credit').textContent = ' · Basemap: Esri World Imagery';
}

const viewer = new Cesium.Viewer('globe', viewerOptions);
viewer.scene.globe.enableLighting = false;

// Base-aware paths: '/' in dev, '/dunesight/' on GitHub Pages.
// Layout: data/sites.json lists the sites; each site's §4 files live in data/<site_id>/.
const base = `${import.meta.env.BASE_URL}data/`;

async function getJson(path) {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function loadData() {
  const statusEl = document.getElementById('data-status');
  const fieldsEl = document.getElementById('data-fields');
  try {
    const index = await getJson('sites.json');
    const site = index.sites.find((s) => s.id === index.default_site) || index.sites.find((s) => s.data_dir);
    if (!site) throw new Error('sites.json lists no site with data');
    const s = await getJson(`${site.data_dir}summary.json`);
    const files = site.files || {};
    const realFiles = Object.keys(files).filter((f) => files[f] === 'real');
    statusEl.textContent = `${site.id}/summary.json loaded (${s.placeholder ? 'PLACEHOLDER values, not results' : 'real'})`;
    const rows = [
      ['Sites', index.sites.map((x) => `${x.id} (${x.status})`).join(', ')],
      ['AOI', s.aoi_name],
      ['Real files', realFiles.length ? realFiles.join(', ') : 'none yet'],
      ['Dunes', s.n_dunes],
      ['Median speed', `${s.speed_median_myr} m/yr (p10–p90 ${s.speed_p10_myr}–${s.speed_p90_myr})`],
      ['Threat dunes', s.n_threat],
    ];
    fieldsEl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

    const b = site.bbox || s.aoi_bounds;
    if (b && Number.isFinite(b.west)) {
      const rect = Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north);
      viewer.entities.add({
        rectangle: {
          coordinates: rect,
          fill: false,
          outline: true,
          outlineColor: Cesium.Color.CYAN,
          height: 0,
        },
      });
      viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(b.west - 0.3, b.south - 0.3, b.east + 0.3, b.north + 0.3), duration: 3 });
    }
  } catch (err) {
    statusEl.textContent = `Could not load data: ${err.message}`;
  }
}

loadData();
