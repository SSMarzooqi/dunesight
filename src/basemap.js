// Creates the Cesium viewer: ion terrain + imagery when a token works, otherwise Esri imagery on a flat globe, and a dark globe with a note when the basemap is offline.
import * as Cesium from 'cesium';

const ESRI_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

function esriLayer() {
  return new Cesium.ImageryLayer(
    new Cesium.UrlTemplateImageryProvider({
      url: ESRI_URL,
      credit: new Cesium.Credit('Basemap imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community', true),
      maximumLevel: 18,
    }),
  );
}

/**
 * @param {HTMLElement} container
 * @param {{onStatus: (s: {basemap: string, terrain: string, offline: boolean, note: string}) => void}} opts
 */
export function createViewer(container, { onStatus }) {
  const token = (import.meta.env.VITE_CESIUM_TOKEN || '').trim();
  const useIon = token.length > 0;
  if (useIon) Cesium.Ion.defaultAccessToken = token;

  const status = { basemap: useIon ? 'Cesium ion (Bing Maps Aerial)' : 'Esri World Imagery', terrain: useIon ? 'Cesium World Terrain' : 'none (flat ellipsoid)', offline: false, note: '' };
  const report = () => onStatus?.({ ...status });

  const viewer = new Cesium.Viewer(container, {
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
    creditContainer: document.getElementById('cesium-credits'),
    creditViewport: document.getElementById('cesium-credits-lightbox') || undefined,
    baseLayer: useIon ? Cesium.ImageryLayer.fromWorldImagery() : esriLayer(),
    terrain: useIon ? Cesium.Terrain.fromWorldTerrain() : undefined,
    terrainProvider: useIon ? undefined : new Cesium.EllipsoidTerrainProvider(),
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    msaaSamples: 1,
  });

  const scene = viewer.scene;
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a1118');
  scene.globe.enableLighting = false;
  scene.globe.showGroundAtmosphere = true;
  scene.fog.enabled = false;
  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.tileCacheSize = 300;
  scene.screenSpaceCameraController.minimumZoomDistance = 300;
  viewer.cesiumWidget.creditContainer.classList.add('ds-credits');

  // --- ion failure -> Esri + flat terrain -------------------------------------------------------
  let fellBack = false;
  function fallBackFromIon(reason) {
    if (fellBack) return;
    fellBack = true;
    console.warn(`[basemap] Cesium ion unavailable (${reason}); using Esri World Imagery and flat terrain.`);
    try {
      const layers = viewer.imageryLayers;
      const base = layers.get(0);
      const esri = esriLayer();
      layers.add(esri, 0);
      if (base) layers.remove(base, true);
      watchLayer(esri);
    } catch (err) {
      console.warn('[basemap] could not add Esri layer', err);
    }
    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    status.basemap = 'Esri World Imagery (Cesium ion unavailable)';
    status.terrain = 'none (flat ellipsoid)';
    status.note = `ion unavailable: ${reason}`;
    report();
    scene.requestRender();
  }

  if (useIon) {
    const terrain = scene.terrain || null;
    terrain?.errorEvent?.addEventListener((err) => fallBackFromIon(`terrain: ${err?.message || err}`));
    const base = viewer.imageryLayers.get(0);
    base?.errorEvent?.addEventListener((err) => fallBackFromIon(`imagery: ${err?.message || err}`));
    base?.readyEvent?.addEventListener(() => watchLayer(base));
  } else {
    watchLayer(viewer.imageryLayers.get(0));
  }

  // --- tile errors -> "basemap offline" note ---------------------------------------------------
  let tileErrors = 0;
  function watchLayer(layer) {
    const provider = layer?.imageryProvider;
    if (!provider?.errorEvent) return;
    provider.errorEvent.addEventListener((e) => {
      if (e) e.retry = false;
      tileErrors += 1;
      if (tileErrors >= 6 && !status.offline) {
        status.offline = true;
        report();
      }
    });
  }
  window.addEventListener('offline', () => {
    status.offline = true;
    report();
  });
  window.addEventListener('online', () => {
    tileErrors = 0;
    status.offline = false;
    report();
  });

  report();
  return viewer;
}
