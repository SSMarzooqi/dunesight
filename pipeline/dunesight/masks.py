"""Masks for notebook 02: what is NOT free dune sand, and Landsat QA.

Layers (all boolean arrays on the tracking grid, True = flagged):
  qa          QA_PIXEL fill, dilated cloud, cirrus, cloud or cloud shadow (bits 0-4), dilated by `dilate_px`
  vegetated   ever vegetated: max NDVI over the confirmed November scenes (TOA, 30 m) exceeds the box median
              of that same max-NDVI image by `ndvi_margin` (relative rule, because bare red sand already has
              TOA NDVI ~0.15 here and the absolute level differs between sites)
  worldcover  ESA WorldCover v200 (2021, 10 m) classes tree cover (10), cropland (40), built-up (50),
              permanent water (80)
  osm         OpenStreetMap roads (buffered by a per-class half width), buildings and land-use polygons
  manual      per-site polygons drawn by eye from the 2000 and 2025 pan images, each with a stated reason
              (pipeline/site_config/<site>/manual_masks.geojson); optional
The union of vegetated | worldcover | osm | manual is the "non-dune" mask: excluded from dune-motion
statistics. The same mask, restricted per pair to windows that correlate strongly, is where stable-ground
(co-registration and noise) candidates come from.
"""

import json

import numpy as np
from scipy import ndimage

QA_REJECT_BITS = (0, 1, 2, 3, 4)
WORLDCOVER_NON_DUNE = {10: "tree cover", 40: "cropland", 50: "built-up", 80: "permanent water"}
# half widths (m) used to buffer OSM road centre lines (a road plus its shoulders / verges)
OSM_ROAD_HALF_WIDTH_M = {"motorway": 30, "trunk": 30, "primary": 25, "primary_link": 15, "secondary": 20,
                         "tertiary": 15, "unclassified": 10, "residential": 10, "service": 8, "track": 6,
                         "construction": 15}
OSM_ROAD_DEFAULT_M = 8


def qa_mask(qa, dilate_px=1):
    bad = np.zeros(qa.shape, bool)
    for b in QA_REJECT_BITS:
        bad |= ((qa >> b) & 1).astype(bool)
    if dilate_px:
        bad = ndimage.binary_dilation(bad, iterations=dilate_px)
    return bad


def _rasterize(shapes, grid):
    from rasterio.features import rasterize
    shapes = [s for s in shapes if s is not None and not s.is_empty]
    if not shapes:
        return np.zeros((grid.height, grid.width), bool)
    return rasterize([(s, 1) for s in shapes], out_shape=(grid.height, grid.width), transform=grid.affine(),
                     fill=0, all_touched=True, dtype="uint8").astype(bool)


def osm_mask(osm_json, grid):
    """Rasterise OSM roads (buffered), buildings and land-use/amenity/leisure areas. Returns (mask, counts)."""
    from pyproj import Transformer
    from shapely.geometry import LineString, Polygon
    from .rasters import reproject_geom as stransform
    tr = Transformer.from_crs("EPSG:4326", grid.crs, always_xy=True).transform
    shapes, counts = [], {}
    for e in osm_json.get("elements", []):
        tags = e.get("tags", {})
        geom = e.get("geometry")
        if e["type"] != "way" or not geom or len(geom) < 2:
            continue
        pts = [(g["lon"], g["lat"]) for g in geom]
        if "highway" in tags:
            hw = tags["highway"]
            line = stransform(tr, LineString(pts))
            shapes.append(line.buffer(OSM_ROAD_HALF_WIDTH_M.get(hw, OSM_ROAD_DEFAULT_M)))
            counts["highway"] = counts.get("highway", 0) + 1
        elif any(k in tags for k in ("building", "landuse", "amenity", "leisure", "man_made", "sport")) and pts[0] == pts[-1] and len(pts) >= 4:
            shapes.append(stransform(tr, Polygon(pts)).buffer(15))
            key = next(k for k in ("building", "landuse", "amenity", "leisure", "man_made", "sport") if k in tags)
            counts[key] = counts.get(key, 0) + 1
    return _rasterize(shapes, grid), counts


def manual_mask(geojson_path, grid):
    """Rasterise per-site manual polygons (WGS84 GeoJSON). Returns (mask, list of (id, reason))."""
    from pyproj import Transformer
    from shapely.geometry import shape
    from .rasters import reproject_geom as stransform
    if geojson_path is None or not geojson_path.exists():
        return np.zeros((grid.height, grid.width), bool), []
    fc = json.loads(geojson_path.read_text())
    tr = Transformer.from_crs("EPSG:4326", grid.crs, always_xy=True).transform
    shapes, info = [], []
    for f in fc["features"]:
        shapes.append(stransform(tr, shape(f["geometry"])))
        info.append((f["properties"].get("id"), f["properties"].get("reason")))
    return _rasterize(shapes, grid), info


def vegetated_mask(ndvi_max, inbox, ndvi_margin=0.07, dilate_px=1):
    thr = float(np.nanmedian(ndvi_max[inbox])) + ndvi_margin
    m = ndvi_max > thr
    m = ndimage.binary_opening(m, iterations=1)   # drop isolated single pixels (sensor noise)
    if dilate_px:
        m = ndimage.binary_dilation(m, iterations=dilate_px)
    return m, thr


def worldcover_mask(wc, dilate_px=1):
    m = np.isin(wc, list(WORLDCOVER_NON_DUNE))
    m = ndimage.binary_opening(m, iterations=1) | (wc == 50)   # keep thin built-up (roads) as is
    if dilate_px:
        m = ndimage.binary_dilation(m, iterations=dilate_px)
    return m
