"""Targets for notebook 03: roads and built-up areas from OpenStreetMap, farms/plantations from NASA HLS NDVI.

Roads (OSM highway=*):
    * classes kept as targets: ROAD_CLASSES (tracks, paths and footways are not treated as roads);
    * ways of one road (same class and same ref/name) are merged with shapely linemerge, clipped to the site box and
      split into equal pieces no longer than `seg_len_m`, so a hit can be located;
    * footprint = centre line buffered by the class half width of masks.OSM_ROAD_HALF_WIDTH_M (carriageway plus
      shoulders/verges, the same widths notebook 02 masks as non-dune).
Built-up (OSM building=* and landuse residential/industrial/commercial/retail/construction areas): one target per
    polygon, clipped to the box. Individual buildings are hardly mapped in OSM here; the count is reported as it is.
Farms: pixels whose median HLS NDVI over the last year is >= `ndvi_min` (default: box median + 0.07, the same relative
    rule notebook 02 uses for its vegetation mask), closed by one 30 m pixel so the tree rows of one plantation join, holes
    filled, components >= `min_area_ha`, polygonised. OSM landuse=farmland/farmyard/orchard/plant_nursery polygons, if any,
    are added (merged where they overlap an NDVI farm).

Ids are deterministic: roads sorted by class rank, name and smallest OSM way id; farms and built-up areas north to south.
"""

import json
import math
import time

import numpy as np

from .masks import OSM_ROAD_HALF_WIDTH_M, OSM_ROAD_DEFAULT_M

ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "motorway_link", "trunk_link", "primary_link",
                "secondary_link", "tertiary_link", "unclassified", "residential", "living_street", "service", "construction"]
BUILT_LANDUSE = {"residential", "industrial", "commercial", "retail", "construction"}
FARM_LANDUSE = {"farmland", "farmyard", "orchard", "plant_nursery", "greenhouse_horticulture"}
OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def overpass_query(bbox, margin_deg=0.005):
    b = bbox
    bb = f"{b['south'] - margin_deg},{b['west'] - margin_deg},{b['north'] + margin_deg},{b['east'] + margin_deg}"
    return (f'[out:json][timeout:180];( way["highway"]({bb}); nwr["building"]({bb}); '
            f'nwr["landuse"]({bb}); ); out tags geom;')


def fetch_overpass(query, path, tries=4):
    """POST the query to Overpass and cache the JSON at `path` (skipped if cached). Returns (json, retrieved_utc)."""
    import requests
    meta = path.with_suffix(".meta.json")
    if path.exists() and meta.exists():
        return json.loads(path.read_text()), json.loads(meta.read_text())["retrieved_utc"]
    for k in range(tries):
        try:
            r = requests.post(OVERPASS_URL, data={"data": query}, timeout=300,
                              headers={"User-Agent": "DuneSight-pipeline/0.1 (open-source research)"})
            r.raise_for_status()
            break
        except Exception:
            if k == tries - 1:
                raise
            time.sleep(10 * (k + 1))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(r.text)
    retrieved = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    meta.write_text(json.dumps({"retrieved_utc": retrieved, "url": OVERPASS_URL, "query": query}, indent=1))
    return json.loads(r.text), retrieved


def _way_line(e):
    from shapely.geometry import LineString
    pts = [(g["lon"], g["lat"]) for g in e.get("geometry", []) if g]
    return LineString(pts) if len(pts) >= 2 else None


def _way_polygon(e):
    from shapely.geometry import Polygon
    pts = [(g["lon"], g["lat"]) for g in e.get("geometry", []) if g]
    if len(pts) >= 4 and pts[0] == pts[-1]:
        p = Polygon(pts)
        return p if p.is_valid else p.buffer(0)
    return None


def _relation_polygon(e):
    """Multipolygon relation with outer/inner member ways (Overpass 'out geom')."""
    from shapely.geometry import LineString
    from shapely.ops import polygonize, unary_union
    outer, inner = [], []
    for m in e.get("members", []):
        if m.get("type") != "way" or not m.get("geometry"):
            continue
        pts = [(g["lon"], g["lat"]) for g in m["geometry"] if g]
        if len(pts) >= 2:
            (inner if m.get("role") == "inner" else outer).append(LineString(pts))
    if not outer:
        return None
    po = unary_union(list(polygonize(unary_union(outer))))
    if inner:
        po = po.difference(unary_union(list(polygonize(unary_union(inner)))))
    return None if po.is_empty else po


def road_name(tags):
    ref, en, ar = tags.get("ref"), tags.get("name:en"), tags.get("name")
    nm = en or ar
    if ref and nm:
        return f"{ref} {nm}"
    return ref or nm


def split_line(line, max_len):
    """Split a projected LineString into n equal pieces with n = ceil(length / max_len)."""
    from shapely.ops import substring
    n = max(1, int(math.ceil(line.length / max_len)))
    return [substring(line, line.length * k / n, line.length * (k + 1) / n) for k in range(n)]


def roads(osm, to_proj, box_proj, seg_len_m=500.0, min_len_m=30.0):
    """Road segments (projected CRS) from Overpass JSON. Returns list of dicts with geometry (projected line), class,
    name, osm way ids, half width, segment index/count."""
    import shapely
    from shapely.ops import linemerge, unary_union
    from .rasters import reproject_geom
    rank = {c: k for k, c in enumerate(ROAD_CLASSES)}
    groups = {}
    for e in osm.get("elements", []):
        t = e.get("tags", {})
        if e.get("type") != "way" or t.get("highway") not in rank:
            continue
        ln = _way_line(e)
        if ln is None:
            continue
        cls = t["highway"]
        nm = road_name(t)
        key = (cls, nm) if nm else (cls, f"way{e['id']}")
        g = groups.setdefault(key, {"cls": cls, "name": nm, "ways": [], "lines": [], "tags": t})
        g["ways"].append(int(e["id"]))
        g["lines"].append(reproject_geom(to_proj, ln))
    # unnamed ways of one class that join end to end (degree-2 nodes) form one road
    merged = []
    by_cls_unnamed = {}
    for key, g in groups.items():
        if g["name"] is None:
            by_cls_unnamed.setdefault(g["cls"], []).append(g)
        else:
            merged.append(g)
    for cls, gs in by_cls_unnamed.items():
        lines = [ln for g in gs for ln in g["lines"]]
        ways = {id(ln): g["ways"][0] for g in gs for ln in g["lines"]}
        m = linemerge(unary_union(lines))
        parts = list(m.geoms) if hasattr(m, "geoms") else [m]
        for p in parts:
            hit = [ways[id(ln)] for ln in lines if ln.distance(p) < 0.5 and ln.intersection(p).length > 0.5]
            merged.append({"cls": cls, "name": None, "ways": sorted(hit) or [0], "lines": [p], "tags": {}})
    out = []
    for g in merged:
        geom = linemerge(unary_union(g["lines"])) if len(g["lines"]) > 1 else g["lines"][0]
        geom = geom.intersection(box_proj)
        if geom.is_empty:
            continue
        parts = [geom] if geom.geom_type == "LineString" else [q for q in getattr(geom, "geoms", []) if q.geom_type == "LineString"]
        parts = [p for p in parts if p.length >= min_len_m]
        if not parts:
            continue
        segs = [s for p in sorted(parts, key=lambda q: (-q.length)) for s in split_line(p, seg_len_m)]
        out.append({"cls": g["cls"], "name": g["name"], "ways": sorted(g["ways"]), "segments": segs,
                    "half_width_m": OSM_ROAD_HALF_WIDTH_M.get(g["cls"], OSM_ROAD_DEFAULT_M)})
    out.sort(key=lambda g: (rank[g["cls"]], g["name"] is None, g["name"] or "", g["ways"][0]))
    return out


def built_areas(osm, to_proj, box_proj, min_area_m2=100.0):
    """OSM buildings and built-up land-use polygons (projected), clipped to the box."""
    out = []
    for e in osm.get("elements", []):
        t = e.get("tags", {})
        kind = None
        if "building" in t:
            kind = f"building={t['building']}"
        elif t.get("landuse") in BUILT_LANDUSE:
            kind = f"landuse={t['landuse']}"
        if kind is None:
            continue
        g = _way_polygon(e) if e["type"] == "way" else (_relation_polygon(e) if e["type"] == "relation" else None)
        if g is None:
            continue
        from .rasters import reproject_geom
        gp = reproject_geom(to_proj, g).intersection(box_proj)
        if gp.is_empty or gp.area < min_area_m2:
            continue
        out.append({"kind": kind, "name": t.get("name:en") or t.get("name"), "osm": f"{e['type']}/{e['id']}", "geometry": gp})
    return out


def osm_farms(osm, to_proj, box_proj):
    from .rasters import reproject_geom
    out = []
    for e in osm.get("elements", []):
        t = e.get("tags", {})
        if t.get("landuse") not in FARM_LANDUSE:
            continue
        g = _way_polygon(e) if e["type"] == "way" else (_relation_polygon(e) if e["type"] == "relation" else None)
        if g is None:
            continue
        gp = reproject_geom(to_proj, g).intersection(box_proj)
        if not gp.is_empty:
            out.append({"kind": f"landuse={t['landuse']}", "osm": f"{e['type']}/{e['id']}", "geometry": gp})
    return out


def farm_mask(ndvi_p50, inbox, ndvi_min=None, margin=0.07, close_px=1, min_area_ha=0.5, res=30.0):
    """Boolean farm/plantation mask on the NDVI grid, the threshold used and the component labels."""
    from scipy import ndimage
    from skimage.morphology import disk
    thr = float(np.nanmedian(ndvi_p50[inbox]) + margin) if ndvi_min is None else float(ndvi_min)
    m = np.nan_to_num(ndvi_p50, nan=0.0) >= thr
    if close_px:
        m = ndimage.binary_closing(m, structure=disk(close_px))
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m)
    min_px = min_area_ha * 1e4 / res ** 2
    sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    keep = np.isin(lab, 1 + np.where(sizes >= min_px)[0])
    return keep, thr


def polygons_from_mask(mask, grid, simplify_m=10.0):
    """Polygons (projected) of the connected components of a boolean mask on `grid`."""
    from rasterio.features import shapes
    from shapely.geometry import shape
    out = []
    for geom, val in shapes(mask.astype(np.uint8), mask=mask, transform=grid.affine()):
        p = shape(geom)
        if simplify_m:
            p = p.simplify(simplify_m, preserve_topology=True)
        if p.is_valid and not p.is_empty:
            out.append(p)
    return out
