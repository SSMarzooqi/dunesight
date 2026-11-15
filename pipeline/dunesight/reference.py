"""Hard-surface registration reference (notebook 02, section 6b): co-registration from paved roads and buildings only.

Why: the default stable ground (480 m windows that look alike in every image) can be dominated by farm canopy. Growing
trees and their shadows change slowly in the same way everywhere, which shifts every image's offset steadily and is
then subtracted from every dune velocity. This reference uses only hard man-made surfaces, with vegetation removed.

Method
  * Surface mask: OpenStreetMap paved roads (highway classes in PAVED, not tagged unpaved) buffered by their half
    width, and building footprints, each plus EDGE_M of their surroundings so the surface edge (the contrast that is
    matched) is inside; minus every pixel within `veg_clear_px` pixels of the vegetation mask (canopy and its shadow).
  * Windows: `win` px (default 16 = 240 m) every win/4 px, kept if >= `min_keep` of the window is surface, the kept
    content has two-dimensional structure (gradient structure-tensor coherence <= `max_coherence`; a single straight
    road edge constrains only the across-road direction) and vegetation covers <= 25 %.
  * Matching: every pixel outside the surface mask has zero weight. The weight is smooth (Gaussian-feathered mask),
    each window is normalised by its weighted mean and spread, tapered, and phase-correlated
    (tracking.phase_correlate with prep=False).
  * A weight mask that stays fixed on the map while the image content moves pulls the match toward zero shift
    (measured with plain NaN masking: ~20 % of the shift), and so does the window taper. So, per image pair, the later
    image's window is cut at the integer part of the current estimate of that pair's offset (median over all windows)
    and its weight is moved by the full estimate, and the pair is matched again (`n_iter` passes). Synthetic
    known-shift tests are in notebook 02.
  * Pair offset = median over the windows that are coherent in every OLI pair; per-image offsets by least squares,
    exactly as for the default stable ground (motion.pair_offsets / motion.epoch_registration).
"""

import numpy as np
from scipy import ndimage

from . import tracking as tk

PAVED = {"motorway", "trunk", "primary", "secondary", "tertiary", "motorway_link", "trunk_link", "primary_link",
         "secondary_link", "tertiary_link", "residential", "unclassified", "service"}
UNPAVED_SURFACES = {"unpaved", "sand", "dirt", "ground", "gravel", "compacted", "earth", "fine_gravel"}
EDGE_M = 22.5


def surface_mask(osm_json, grid, veg, veg_clear_px=2, edge_m=EDGE_M):
    """Boolean mask of hard man-made surface (paved roads, buildings) minus vegetation (dilated by veg_clear_px).
    Returns (keep, counts)."""
    from pyproj import Transformer
    from shapely.geometry import LineString, Polygon
    from .masks import OSM_ROAD_HALF_WIDTH_M, _rasterize
    from .rasters import reproject_geom
    tr = Transformer.from_crs("EPSG:4326", grid.crs, always_xy=True).transform
    shapes, counts = [], {"paved_road_ways": 0, "buildings": 0}
    for e in osm_json.get("elements", []):
        t = e.get("tags", {})
        geom = e.get("geometry")
        if e["type"] != "way" or not geom or len(geom) < 2:
            continue
        pts = [(p["lon"], p["lat"]) for p in geom]
        if t.get("highway") in PAVED and t.get("surface", "paved") not in UNPAVED_SURFACES:
            shapes.append(reproject_geom(tr, LineString(pts)).buffer(OSM_ROAD_HALF_WIDTH_M.get(t["highway"], 8) + edge_m))
            counts["paved_road_ways"] += 1
        elif "building" in t and pts[0] == pts[-1] and len(pts) >= 4:
            shapes.append(reproject_geom(tr, Polygon(pts)).buffer(edge_m))
            counts["buildings"] += 1
    hard = _rasterize(shapes, grid)
    keep = hard & ~ndimage.binary_dilation(veg, iterations=veg_clear_px)
    return keep, counts


def structure_coherence(img, keep, rr, cc, win):
    """Per window: coherence of the gradient structure tensor over the kept pixels (0 = gradients in every direction,
    1 = one straight edge)."""
    img = np.nan_to_num(img, nan=float(np.nanmedian(img)))
    gy, gx = np.gradient(ndimage.gaussian_filter(img, 0.7))
    sxx, syy, sxy = [tk.window_stat(np.where(keep, a, 0.0), rr, cc, win) for a in (gx * gx, gy * gy, gx * gy)]
    return np.sqrt((sxx - syy) ** 2 + 4 * sxy ** 2) / np.maximum(sxx + syy, 1e-12)


def select_windows(img, keep, veg, rr, cc, win, min_keep=0.15, max_coherence=0.6, max_veg=0.25):
    """Indices of windows with enough surface, 2-D structure and little vegetation."""
    fk = tk.window_stat(keep, rr, cc, win)
    fv = tk.window_stat(veg, rr, cc, win)
    coh = structure_coherence(img, keep, rr, cc, win)
    return np.where((fk >= min_keep) & (coh <= max_coherence) & (fv <= max_veg))[0], dict(keep_frac=fk, coherence=coh, veg_frac=fv)


def weight_image(keep, feather_px=1.5):
    """Smooth weight: the surface mask blurred with a Gaussian (so it can be shifted by a fraction of a pixel)."""
    return ndimage.gaussian_filter(keep.astype(np.float64), feather_px)


def _prep_weighted(X, Wt, min_weight):
    """Normalise each window by its weighted mean and spread, multiply by the weight and the Hann taper.
    Windows whose mean weight is below min_weight (or with NaN under non-zero weight) become all-NaN."""
    Wt = np.where(np.isfinite(X), Wt, 0.0)
    X = np.nan_to_num(X.astype(np.float64))
    sw = Wt.sum(axis=(1, 2), keepdims=True)
    mu = (Wt * X).sum(axis=(1, 2), keepdims=True) / np.maximum(sw, 1e-12)
    sd = np.sqrt((Wt * (X - mu) ** 2).sum(axis=(1, 2), keepdims=True) / np.maximum(sw, 1e-12))
    sd[sd == 0] = 1.0
    out = (X - mu) / sd * Wt * tk._taper(X.shape[1])
    out[(sw[:, 0, 0] / X.shape[1] ** 2) < min_weight] = np.nan
    return out


def weighted_track_pair(imgA, imgB, wA, wB, rows, cols, win, upsample=100, min_weight=0.1, chunk=4000, guide=(0, 0), whiten=True):
    """Phase correlation of windows of imgA (weight wA) and imgB (weight wB), both full-size arrays. The B windows
    (image and weight) are cut at the A position plus the integer `guide` (rows, cols), which is added back."""
    n = np.asarray(rows).size
    gr, gc = int(guide[0]), int(guide[1])
    res = {k: np.full(n, np.nan) for k in ("d_row", "d_col", "peak", "ratio")}
    for s in range(0, n, chunk):
        sl = slice(s, s + chunk)
        A = _prep_weighted(tk.extract(imgA, rows[sl], cols[sl], win), tk.extract(wA, rows[sl], cols[sl], win), min_weight)
        B = _prep_weighted(tk.extract(imgB, rows[sl] + gr, cols[sl] + gc, win), tk.extract(wB, rows[sl] + gr, cols[sl] + gc, win), min_weight)
        o = tk.phase_correlate(A, B, upsample=upsample, prep=False, whiten=whiten)
        for k in res:
            res[k][sl] = o[k]
    res["d_row"] += gr
    res["d_col"] += gc
    return res


def shift_weight(w, d_row, d_col):
    """Weight image moved by (d_row, d_col) pixels (bilinear; outside = 0)."""
    return np.clip(ndimage.shift(w, (d_row, d_col), order=1, mode="constant", cval=0.0), 0.0, 1.0)


def track_all(imgs, pairs, w, rows, cols, win, n_iter=3, upsample=100, peak_min=0.0, max_disp_px=4.0, whiten=True):
    """Match every pair with the moving-weight iteration. Returns D[(i, j)] = (4, n) array as motion.track_all, and the
    per-pair weight shifts used in the last pass (pixels). whiten=False: normalised cross-correlation (smooth images)."""
    D, used_shift = {}, {}
    for i, j in pairs:
        dr0 = dc0 = 0.0
        for it in range(n_iter):
            o = weighted_track_pair(imgs[i], imgs[j], w, w if it == 0 else shift_weight(w, dr0, dc0), rows, cols, win, upsample=upsample,
                                    guide=(round(dr0), round(dc0)), whiten=whiten)
            ok = np.isfinite(o["peak"]) & (o["peak"] >= peak_min) & (np.hypot(o["d_row"], o["d_col"]) <= max_disp_px)
            if ok.sum() < 5:
                break
            used_shift[(i, j)] = (dr0, dc0)
            dr0, dc0 = float(np.median(o["d_row"][ok])), float(np.median(o["d_col"][ok]))
        D[(i, j)] = np.stack([o["d_row"], o["d_col"], o["peak"], o["ratio"]]).astype(np.float32)
    return D, used_shift


def null_peaks(imgs, pairs, w, rows, cols, win, offset_px, upsample=100):
    """Peak heights for windows matched against unrelated windows `offset_px` away (match-quality threshold)."""
    out = []
    for i, j in pairs:
        B = np.roll(imgs[j], (offset_px, -offset_px), axis=(0, 1))
        wB = np.roll(w, (offset_px, -offset_px), axis=(0, 1))
        out.append(weighted_track_pair(imgs[i], B, w, wB, rows, cols, win, upsample=upsample)["peak"])
    x = np.concatenate(out)
    return x[np.isfinite(x)]


def match_reference(imgs, pairs, net_pairs, keep, rows, cols, win, null_pairs, n_iter=3, max_disp_px=4.0,
                    min_med_peak=0.5, min_valid=0.9, null_pctl=99.0):
    """Match the windows (rows, cols) of one reference surface (mask `keep`) over `pairs` with the moving-weight
    iteration, set the match-quality threshold from unrelated windows, and keep the windows that are coherent in
    the network pairs `net_pairs`. Returns dict D, peak_min, coherent (indices into rows/cols)."""
    from . import motion
    w = weight_image(keep)
    D, _ = track_all(imgs, pairs, w, rows, cols, win, n_iter=n_iter, peak_min=0.3, max_disp_px=max_disp_px)
    pk = float(np.percentile(null_peaks(imgs, null_pairs, w, rows, cols, win, win + 8), null_pctl))
    mp, fv = motion.coherence(D, net_pairs, pk, max_disp_px)
    return dict(D=D, peak_min=pk, coherent=np.where((mp >= min_med_peak) & (fv >= min_valid))[0])


def registration(ref, pairs, idx, n_epochs, res, max_disp_px=4.0):
    """Per-image offsets (E, N) in metres from the windows `idx` of a matched reference (see match_reference)."""
    from . import motion
    return motion.epoch_registration(motion.pair_offsets(ref["D"], pairs, idx, ref["peak_min"], max_disp_px, res), n_epochs)[:2]


def trend(t, x):
    """Least-squares slope of x against t (NaN-aware)."""
    t, x = np.asarray(t, float), np.asarray(x, float)
    ok = np.isfinite(x)
    return float(np.polyfit(t[ok], x[ok], 1)[0]) if ok.sum() >= 3 else np.nan
