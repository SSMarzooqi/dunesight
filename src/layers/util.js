// Shared helpers for the batched ground primitives: colour attributes, readiness, line/polygon instances and colour ramps.
import * as Cesium from 'cesium';

export const C = (css, alpha = 1) => Cesium.Color.fromCssColorString(css).withAlpha(alpha);

/** Resolves when a primitive has finished building (GroundPrimitive / GroundPolylinePrimitive build asynchronously). */
export function whenReady(scene, primitive) {
  return new Promise((resolve) => {
    if (primitive.ready) return resolve(primitive);
    const remove = scene.postRender.addEventListener(() => {
      if (primitive.isDestroyed?.()) {
        remove();
        return;
      }
      if (primitive.ready) {
        remove();
        resolve(primitive);
      }
    });
    scene.requestRender();
  });
}

const scratch = new Uint8Array(4);
/** Set an instance's colour on a ready primitive (no rebuild). */
export function setInstanceColor(primitive, id, color) {
  if (!primitive || !primitive.ready || primitive.isDestroyed?.()) return;
  const attrs = primitive.getGeometryInstanceAttributes(id);
  if (!attrs) return;
  attrs.color = Cesium.ColorGeometryInstanceAttribute.toValue(color, scratch);
}

export function setInstanceShow(primitive, id, show) {
  if (!primitive || !primitive.ready || primitive.isDestroyed?.()) return;
  const attrs = primitive.getGeometryInstanceAttributes(id);
  if (attrs && attrs.show) attrs.show = Cesium.ShowGeometryInstanceAttribute.toValue(show, attrs.show);
}

export function lineInstance(id, coords, width, color) {
  return new Cesium.GeometryInstance({
    id,
    geometry: new Cesium.GroundPolylineGeometry({
      positions: Cesium.Cartesian3.fromDegreesArray(coords.flat()),
      width,
    }),
    attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
  });
}

export function polygonInstance(id, ring, color, holes = []) {
  return new Cesium.GeometryInstance({
    id,
    geometry: new Cesium.PolygonGeometry({
      polygonHierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArray(ring.flat()),
        holes.map((h) => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(h.flat()))),
      ),
    }),
    attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
  });
}

export function linePrimitive(instances, { translucent = true } = {}) {
  return new Cesium.GroundPolylinePrimitive({
    geometryInstances: instances,
    appearance: new Cesium.PolylineColorAppearance({ translucent }),
    asynchronous: true,
    releaseGeometryInstances: false,
  });
}

export function dashedLinePrimitive(instances, color, dashLength = 16) {
  return new Cesium.GroundPolylinePrimitive({
    geometryInstances: instances,
    appearance: new Cesium.PolylineMaterialAppearance({
      material: Cesium.Material.fromType('PolylineDash', { color, gapColor: Cesium.Color.TRANSPARENT, dashLength }),
    }),
    asynchronous: true,
  });
}

export function fillPrimitive(instances) {
  return new Cesium.GroundPrimitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
    asynchronous: true,
    releaseGeometryInstances: false,
    classificationType: Cesium.ClassificationType.TERRAIN,
  });
}

// Perceptually ordered cool ramp for speed (lightness rises monotonically), chosen so it never
// looks like the warm threat colours of the target layer.
// Fixed domain for all sites so colours compare across sites; values above the top clamp to it.
export const SPEED_DOMAIN = [0, 4];
export const SPEED_STOPS = [
  [0.0, '#2b3f99'],
  [0.5, '#2563c9'],
  [1.0, '#1b8fe0'],
  [1.5, '#1fb8d6'],
  [2.0, '#43d9b8'],
  [3.0, '#94ef9c'],
  [4.0, '#eefcc0'],
];

/** Opacity from match quality (0-1): weak matches are fainter but never invisible. */
export function qualityAlpha(q) {
  if (!Number.isFinite(q)) return 0.6;
  return 0.45 + 0.55 * Math.max(0, Math.min(1, (q - 0.2) / 0.5));
}

export function speedColor(v, alpha = 1) {
  const x = Math.max(SPEED_DOMAIN[0], Math.min(SPEED_DOMAIN[1], v));
  for (let i = 1; i < SPEED_STOPS.length; i++) {
    const [x1, c1] = SPEED_STOPS[i];
    const [x0, c0] = SPEED_STOPS[i - 1];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0 || 1);
      const a = Cesium.Color.fromCssColorString(c0);
      const b = Cesium.Color.fromCssColorString(c1);
      return Cesium.Color.lerp(a, b, t, new Cesium.Color()).withAlpha(alpha);
    }
  }
  return C(SPEED_STOPS[SPEED_STOPS.length - 1][1], alpha);
}

export const STATUS_COLORS = {
  sand_at_edge_now: '#f85149',
  reached_by_2050: '#f0883e',
  reached_2051_2100: '#d29922',
  possible_within_direction_uncertainty: '#a371f7',
  not_reached_by_2100: '#4b6a88',
};

export const CLASS_COLORS = {
  stable: '#3fb950',
  slow: '#d29922',
  active: '#f0883e',
  fast: '#f85149',
};

export function destroyPrimitive(collection, p) {
  if (p && !p.isDestroyed?.()) collection.remove(p);
}
