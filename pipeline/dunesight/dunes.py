"""Dune outlines from NASADEM and the checks that decide whether NASADEM resolves a dune.

Steps (notebook 02 §DEM):
  1. light smoothing of the 30 m DEM (Gaussian, sigma = 1 px) against SRTM speckle;
  2. DEM noise sigma_z = standard deviation of the high-passed DEM over a flat, texture-free reference area;
  3. candidate dune crests = regional maxima with prominence >= k * sigma_z (skimage h-maxima);
  4. watershed of the inverted DEM from those crests, limited to the dune area, gives one basin per crest;
     each basin is cut at the elevation half-way between its crest and its local base (a local-minimum
     surface: morphological opening of the DEM with a disk wider than the dunes), so the polygon is the
     upper part of the dune body rather than the whole interdune;
  5. image check: the DEM is turned into a hillshade with the sun of a Landsat scene close in time to the
     DEM (February 2000 SRTM vs the November 2000 ETM+ scene) and correlated locally with that image. A dune
     whose local correlation exceeds the 95th percentile of the same statistic under a null (image shifted
     by an unrelated offset) is "resolved": the DEM relief there has the shape the image shows.
Height = crest elevation - local base. Only resolved dunes get a NASADEM height.
"""

import numpy as np
from scipy import ndimage


def hillshade(z, az_deg, el_deg, res):
    """cos(incidence) of a north-up DEM (rows = south) for a sun at azimuth/elevation (degrees)."""
    gy, gx = np.gradient(z, res)
    dzdx, dzdy = gx, -gy
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(-dzdx, -dzdy)   # bearing of steepest descent
    azr, elr = np.radians(az_deg), np.radians(el_deg)
    return np.sin(elr) * np.cos(slope) + np.cos(elr) * np.sin(slope) * np.cos(azr - aspect)


def local_corr(a, b, size):
    ma, mb = ndimage.uniform_filter(a, size), ndimage.uniform_filter(b, size)
    cov = ndimage.uniform_filter(a * b, size) - ma * mb
    va = ndimage.uniform_filter(a * a, size) - ma ** 2
    vb = ndimage.uniform_filter(b * b, size) - mb ** 2
    return cov / np.sqrt(np.maximum(va * vb, 1e-12))


def highpass(x, sigma):
    return x - ndimage.gaussian_filter(x, sigma)


def base_surface(z_s, radius_px):
    """Local-minimum base: morphological opening of the DEM with a disk of `radius_px` (removes every bump narrower
    than the disk), lightly smoothed. Dune height = DEM - base."""
    from skimage.morphology import disk
    b = ndimage.grey_opening(z_s, footprint=disk(int(radius_px)))
    return ndimage.gaussian_filter(b, radius_px / 2.0)


def segment(z_s, area, h_min, base=None, min_px=4):
    """Crest markers (h-maxima >= h_min inside `area`) and their watershed basins cut at mid-height between the
    crest and the local base (from `base`, a base surface, at the crest; if None, the 10th percentile of the
    basin outline). Returns (labels, list of dicts with crest/base elevations and pixel counts)."""
    from skimage.morphology import h_maxima
    from skimage.segmentation import watershed
    markers, n = ndimage.label(h_maxima(z_s, h_min) & area)
    basins = watershed(-z_s, markers, mask=area)
    out = np.zeros_like(basins)
    info = []
    k = 0
    for lab in range(1, n + 1):
        m = basins == lab
        if m.sum() < min_px:
            continue
        mk = markers == lab
        crest = float(z_s[mk].max())
        if base is None:
            edge = m & ~ndimage.binary_erosion(m)
            b0 = float(np.percentile(z_s[edge], 10))
        else:
            b0 = float(base[mk][np.argmax(z_s[mk])])
        base_ = max(b0, float(z_s[m].min()))
        cut = m & (z_s >= base_ + 0.5 * (crest - base_))
        cut = ndimage.binary_fill_holes(cut)
        # keep the connected part containing the crest
        cl, _ = ndimage.label(cut)
        keep = np.unique(cl[(markers == lab) & cut])
        keep = keep[keep > 0]
        if keep.size == 0:
            continue
        cut = np.isin(cl, keep)
        if cut.sum() < min_px:
            continue
        k += 1
        out[cut] = k
        info.append({"label": k, "crest_m": crest, "base_m": base_, "height_m": crest - base_, "n_px": int(cut.sum()),
                     "basin_px": int(m.sum())})
    return out, info


def polygons(labels, grid, simplify_m=None):
    """{label: shapely Polygon in grid CRS} from a label image on `grid`."""
    from rasterio.features import shapes
    from shapely.geometry import shape
    from shapely.ops import unary_union
    polys = {}
    for geom, val in shapes(labels.astype(np.int32), mask=labels > 0, transform=grid.affine()):
        p = shape(geom)
        polys.setdefault(int(val), []).append(p)
    out = {}
    for k, ps in polys.items():
        g = unary_union(ps)
        if g.geom_type == "MultiPolygon":
            g = max(g.geoms, key=lambda q: q.area)
        if simplify_m:
            g = g.simplify(simplify_m, preserve_topology=True)
        out[k] = g
    return out
