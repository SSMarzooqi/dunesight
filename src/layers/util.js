// Shared helpers for the batched ground primitives: colour and show attributes, readiness, line/polygon instances, dash patterns and the map colours (from the UI's MAP_STYLE, so map and legend match).
import * as Cesium from 'cesium';
import { MAP_STYLE, STATUS_KEY } from '../ui/ui.js';

export const C = (css, alpha = 1) => {
  const c = Cesium.Color.fromCssColorString(css);
  return c.withAlpha(c.alpha * alpha);
};

/** Status value -> [colour, width, dash?] from MAP_STYLE.threat. */
export const statusStyle = (status) => MAP_STYLE.threat[STATUS_KEY[status] || 'none'];
/** Dune class -> [colour, width] from MAP_STYLE.dune. */
export const classStyle = (cls) => MAP_STYLE.dune[cls] || MAP_STYLE.dune.stable;
export const CASING = MAP_STYLE.casing;

/**
 * 16-bit Cesium dash pattern and dash length (px) for an SVG-style dasharray "on off" in pixels, so the map uses
 * the same dash as the legend sample. One period is repeated to fill 16 pixels.
 */
export function dashFor(dash) {
  const [on, off] = String(dash).split(/\s+/).map(Number);
  const period = on + off;
  let bits = 0;
  for (let i = 0; i < 16; i++) if (i % period < on) bits |= 1 << (15 - i);
  return { dashLength: 16, dashPattern: bits };
}

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
    attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color), show: new Cesium.ShowGeometryInstanceAttribute(true) },
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
    attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color), show: new Cesium.ShowGeometryInstanceAttribute(true) },
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

/** Ground polylines drawn with one dashed material (single colour for the whole primitive). */
export function dashedLinePrimitive(instances, color, dash = '8 8') {
  const { dashLength, dashPattern } = dashFor(dash);
  return new Cesium.GroundPolylinePrimitive({
    geometryInstances: instances,
    appearance: new Cesium.PolylineMaterialAppearance({
      material: Cesium.Material.fromType('PolylineDash', { color, gapColor: Cesium.Color.TRANSPARENT, dashLength, dashPattern }),
    }),
    asynchronous: true,
    releaseGeometryInstances: false,
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

/** Opacity from match quality (0-1): weak matches are fainter but never invisible. */
export function qualityAlpha(q) {
  if (!Number.isFinite(q)) return 0.6;
  return 0.45 + 0.55 * Math.max(0, Math.min(1, (q - 0.2) / 0.5));
}

export function destroyPrimitive(collection, p) {
  if (p && !p.isDestroyed?.()) collection.remove(p);
}
