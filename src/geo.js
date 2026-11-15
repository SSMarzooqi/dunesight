// Small geodesy helpers: metre offsets on the ground around a lon/lat, polygon rings, centroids and point-in-polygon.

const R = 6378137;
const D2R = Math.PI / 180;

/** Move (lon, lat) by east/north metres; accurate to well under a metre over a few km. */
export function offset(lon, lat, east, north) {
  const dLat = north / R;
  const dLon = east / (R * Math.cos(lat * D2R));
  return [lon + dLon / D2R, lat + dLat / D2R];
}

/** Unit east/north for a heading in degrees clockwise from north. */
export function dir(headingDeg) {
  const h = headingDeg * D2R;
  return [Math.sin(h), Math.cos(h)];
}

/** Outer rings of a Polygon or MultiPolygon geometry (each ring = [[lon, lat], ...]). */
export function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

export function ringCentroid(ring) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-15) return ring[0];
  return [cx / (3 * a), cy / (3 * a)];
}

export function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A point guaranteed inside the polygon's first outer ring (centroid if inside, else a scanline midpoint). */
export function interiorPoint(geometry) {
  const polys = polygonsOf(geometry);
  if (!polys.length) return null;
  const ring = polys[0][0];
  const c = ringCentroid(ring);
  if (pointInRing(c, ring)) return c;
  const ys = ring.map((p) => p[1]);
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xs = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
  }
  xs.sort((a, b) => a - b);
  return xs.length >= 2 ? [(xs[0] + xs[1]) / 2, y] : ring[0];
}

/** Representative point of any target/dune geometry (line midpoint vertex or polygon interior). */
export function representativePoint(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'LineString') {
    const c = geometry.coordinates;
    if (c.length === 2) return [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2];
    return c[Math.floor(c.length / 2)];
  }
  if (geometry.type === 'MultiLineString') return representativePoint({ type: 'LineString', coordinates: geometry.coordinates[0] });
  if (geometry.type === 'Point') return geometry.coordinates;
  return interiorPoint(geometry);
}

/** Bounding box [w, s, e, n] of any geometry. */
export function bboxOf(geometry) {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  const visit = (c) => {
    if (typeof c[0] === 'number') {
      w = Math.min(w, c[0]);
      e = Math.max(e, c[0]);
      s = Math.min(s, c[1]);
      n = Math.max(n, c[1]);
    } else c.forEach(visit);
  };
  visit(geometry.coordinates);
  return [w, s, e, n];
}

export function distanceM([lon1, lat1], [lon2, lat2]) {
  const x = (lon2 - lon1) * D2R * Math.cos(((lat1 + lat2) / 2) * D2R);
  const y = (lat2 - lat1) * D2R;
  return Math.hypot(x, y) * R;
}
