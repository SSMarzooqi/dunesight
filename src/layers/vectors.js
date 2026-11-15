// Motion-vector layer: one ground-clamped arrow per detected 480 m window, pointing along heading_deg, coloured by speed, length on a stated time scale, plus true-scale displacement tracks in projected years.
import * as Cesium from 'cesium';
import { offset, dir, distanceM } from '../geo.js';
import { speedColor, qualityAlpha, whenReady, setInstanceColor, fillPrimitive, lineInstance, linePrimitive, destroyPrimitive, C } from './util.js';

/** Arrow length in metres per 1 m/yr of speed at factor 1: the arrow shows 100 years of motion. */
export const ARROW_YEARS = 100;

/** Default arrow-scale factor for a site: slow fields get ×2 (200 yr of motion) so arrows stay readable. */
export function defaultArrowFactor(bundle) {
  const med = bundle.summary?.speed_median_myr;
  return Number.isFinite(med) && med >= 1.5 ? 1 : 2;
}

export function arrowOutline(lon, lat, headingDeg, lengthM) {
  const [ux, uy] = dir(headingDeg);
  const [px, py] = [uy, -ux]; // right-hand perpendicular
  const half = Math.max(8, Math.min(15, lengthM * 0.07));
  const headLen = Math.min(lengthM * 0.42, 70);
  const headHalf = Math.max(half * 2.3, Math.min(40, lengthM * 0.25));
  const shaft = lengthM - headLen;
  const pts = [
    [-half * px, -half * py],
    [shaft * ux - half * px, shaft * uy - half * py],
    [shaft * ux - headHalf * px, shaft * uy - headHalf * py],
    [lengthM * ux, lengthM * uy],
    [shaft * ux + headHalf * px, shaft * uy + headHalf * py],
    [shaft * ux + half * px, shaft * uy + half * py],
    [half * px, half * py],
  ];
  return pts.map(([e, n]) => offset(lon, lat, e, n));
}

export function createVectorsLayer(viewer, bundle) {
  const scene = viewer.scene;
  const prims = scene.primitives;
  const feats = (bundle.vectors?.features || []).filter((f) => f.geometry?.type === 'Point' && Number.isFinite(f.properties?.heading_deg) && Number.isFinite(f.properties?.speed_myr));
  const byId = new Map();
  feats.forEach((f, i) => byId.set(`v:${i}`, { kind: 'arrow', id: `v:${i}`, index: i, props: f.properties, lonlat: f.geometry.coordinates }));

  let factor = 1;
  let arrows = null;
  let halo = null;
  let tracks = null;
  let visible = true;
  let dimAll = 1; // overall opacity multiplier set by the mode
  let emphasis = null; // Set of ids emphasised in threat mode (others dimmed)
  let ready = false;
  let trackYears = 0;

  function colorFor(id) {
    const { props } = byId.get(id);
    let a = qualityAlpha(props.quality) * dimAll;
    if (emphasis) a *= emphasis.has(id) ? 1 : 0.18;
    return speedColor(props.speed_myr, a);
  }

  function haloColor(id) {
    const a = colorFor(id).alpha;
    return C('#05080c', Math.min(0.75, a * a * 1.1)); // fades faster than the fill, so dimmed arrows leave no dark specks
  }

  async function build() {
    const haloInst = [];
    const instances = feats.map((f, i) => {
      const [lon, lat] = f.geometry.coordinates;
      const p = f.properties;
      const ring = arrowOutline(lon, lat, p.heading_deg, p.speed_myr * ARROW_YEARS * factor);
      haloInst.push(lineInstance(`vh:${i}`, [...ring, ring[0]], 1.6, haloColor(`v:${i}`)));
      return new Cesium.GeometryInstance({
        id: `v:${i}`,
        geometry: new Cesium.PolygonGeometry({ polygonHierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(ring.flat())) }),
        attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(colorFor(`v:${i}`)) },
      });
    });
    const next = fillPrimitive(instances);
    const nextHalo = linePrimitive(haloInst);
    next.show = visible;
    nextHalo.show = visible;
    prims.add(next);
    prims.add(nextHalo);
    await Promise.all([whenReady(scene, next), whenReady(scene, nextHalo)]);
    destroyPrimitive(prims, arrows);
    destroyPrimitive(prims, halo);
    arrows = next;
    halo = nextHalo;
    ready = true;
    recolor();
    scene.requestRender();
  }

  function recolor() {
    if (!arrows?.ready) return;
    for (const id of byId.keys()) {
      setInstanceColor(arrows, id, colorFor(id));
      setInstanceColor(halo, `vh:${id.slice(2)}`, haloColor(id));
    }
    scene.requestRender();
  }

  function buildTracks(years) {
    destroyPrimitive(prims, tracks);
    tracks = null;
    trackYears = years;
    if (!(years > 0)) return;
    const instances = [];
    for (const [id, { props, lonlat }] of byId) {
      const len = props.speed_myr * years;
      if (len < 0.5) continue;
      const [ux, uy] = dir(props.heading_deg);
      const end = offset(lonlat[0], lonlat[1], ux * len, uy * len);
      let a = dimAll;
      if (emphasis && !emphasis.has(id)) a *= 0.25;
      instances.push(lineInstance(`vt:${id.slice(2)}`, [lonlat, end], 4, C('#ffd166', Math.max(0.25, a))));
    }
    tracks = linePrimitive(instances);
    tracks.show = visible;
    prims.add(tracks);
  }

  build();

  return {
    kind: 'arrow',
    get ready() {
      return ready;
    },
    get count() {
      return feats.length;
    },
    getFeature: (id) => byId.get(/^v[th]:/.test(id) ? `v:${id.slice(3)}` : id) || null,
    owns: (id) => typeof id === 'string' && /^v[th]?:/.test(id),
    setVisible(v) {
      visible = v;
      if (arrows) arrows.show = v;
      if (halo) halo.show = v;
      if (tracks) tracks.show = v;
      scene.requestRender();
    },
    setFactor(f) {
      if (f === factor) return;
      factor = f;
      build();
    },
    setDim(d) {
      dimAll = d;
      recolor();
      if (trackYears > 0) buildTracks(trackYears);
    },
    /** Emphasise arrows within `radiusM` of any of the given lon/lat points (null = no emphasis). */
    emphasiseNear(points, radiusM = 250) {
      if (!points) emphasis = null;
      else {
        emphasis = new Set();
        for (const [id, { lonlat }] of byId) {
          if (points.some((p) => distanceM(p, lonlat) <= radiusM)) emphasis.add(id);
        }
      }
      recolor();
      if (trackYears > 0) buildTracks(trackYears);
      return emphasis ? emphasis.size : feats.length;
    },
    /** Years of displacement since the latest scene to draw as true-scale tracks (0 = none). */
    setTrackYears(years) {
      if (Math.abs(years - trackYears) < 1e-6) return;
      buildTracks(years);
      scene.requestRender();
    },
    screenPoint(id) {
      const f = byId.get(id);
      return f ? f.lonlat : null;
    },
    ids: () => [...byId.keys()],
    dispose() {
      destroyPrimitive(prims, arrows);
      destroyPrimitive(prims, halo);
      destroyPrimitive(prims, tracks);
    },
  };
}
