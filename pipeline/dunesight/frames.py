"""Timeline frames for notebook 03: observed Landsat pan images and projected (advected) images.

Observed frames
    B8 digital numbers -> top-of-atmosphere reflectance corrected for sun elevation,
        rho = (REFLECTANCE_MULT_BAND_8 * DN + REFLECTANCE_ADD_BAND_8) / sin(SUN_ELEVATION)
    so ETM+ (8-bit) and OLI (16-bit) scenes share one physical scale; then ONE linear stretch for every year (the
    `lo`/`hi` reflectances, from pooled percentiles over all scenes inside the box) and one gamma. QA-masked pixels
    (fill, cloud, dilated cloud, cirrus, shadow) are written as no-data.

Reprojection to the globe
    Each frame is resampled from the site's UTM grid to a regular lon/lat grid whose OUTER EDGES are exactly the site box
    (west, south, east, north), so a viewer can drape it with those bounds. Pixel size ~15 m (the box in degrees divided
    into width x height pixels chosen from the 15 m ground spacing). Resampling: bilinear.

Projected frames (semi-Lagrangian advection)
    I_Y(x) = I_t0(x - u(x) * (Y - t0)): every output pixel takes the value found upstream along the motion field u
    (inverse map, cubic interpolation, values clipped to the input range). u is the measured window velocity field:
    detected windows only (below-detection-limit, invalid and non-dune windows = 0), median-filtered (3 x 3 windows, NaN
    aware) against isolated outliers, Gaussian-smoothed (normalised convolution, sigma = 1 window step), interpolated to the
    pixel grid, multiplied by a feathered mask that is 1 on free sand covered by a detected window and 0 elsewhere.
"""

import numpy as np
from scipy import ndimage


def toa_reflectance(dn, meta):
    m = float(meta["REFLECTANCE_MULT_BAND_8"]); a = float(meta["REFLECTANCE_ADD_BAND_8"])
    return (m * dn.astype(np.float64) + a) / np.sin(np.radians(float(meta["SUN_ELEVATION"])))


def to_uint8(rho, lo, hi, gamma=1.0):
    x = np.clip((rho - lo) / (hi - lo), 0, 1) ** (1.0 / gamma)
    return np.round(x * 254 + 1).astype(np.uint8)    # 1..255; 0 is reserved for no-data


def wgs84_grid(bbox, res_m=15.0):
    """(transform, width, height) of a lon/lat grid whose outer edges are exactly the box."""
    from rasterio.transform import from_bounds
    lat_c = np.radians((bbox["south"] + bbox["north"]) / 2)
    w = int(round((bbox["east"] - bbox["west"]) * 111320.0 * np.cos(lat_c) / res_m))
    h = int(round((bbox["north"] - bbox["south"]) * 110574.0 / res_m))
    return from_bounds(bbox["west"], bbox["south"], bbox["east"], bbox["north"], w, h), w, h


def to_wgs84(arr, grid, bbox, res_m=15.0, nodata=np.nan, resampling="bilinear"):
    """Resample a float array on `grid` (projected) onto the exact-bounds lon/lat grid. NaN = no-data."""
    from rasterio.warp import reproject, Resampling
    tr, w, h = wgs84_grid(bbox, res_m)
    out = np.full((h, w), np.nan, np.float64)
    reproject(source=np.asarray(arr, np.float64), destination=out, src_transform=grid.affine(), src_crs=grid.crs,
              src_nodata=np.nan, dst_transform=tr, dst_crs="EPSG:4326", dst_nodata=np.nan,
              resampling=getattr(Resampling, resampling))
    return out, tr


def window_field(win_row, win_col, east, north, use, step, shape_px, sigma_win=1.0, median_win=3):
    """Velocity components on the window lattice (NaN where not used), filtered, then on the pixel grid.
    win_row/win_col: window-centre pixel indices; use: bool (detected); returns (uE, uN) in m/yr at pixel resolution.
    Gaussian smoothing is a normalised convolution over the used windows only, so zero-motion windows do not dilute it;
    lattice nodes with no used window within reach get 0."""
    r0, c0 = win_row.min() % step, win_col.min() % step
    R = (win_row - r0) // step; C = (win_col - c0) // step
    nr, nc = R.max() + 3, C.max() + 3
    E = np.full((nr, nc), np.nan); N = np.full((nr, nc), np.nan)
    E[R[use], C[use]] = east[use]; N[R[use], C[use]] = north[use]
    if median_win:
        E = ndimage.generic_filter(E, np.nanmedian, size=median_win, mode="constant", cval=np.nan) * np.isfinite(E) / np.isfinite(E)
        N = ndimage.generic_filter(N, np.nanmedian, size=median_win, mode="constant", cval=np.nan) * np.isfinite(N) / np.isfinite(N)
    ok = np.isfinite(E).astype(float)
    wsum = ndimage.gaussian_filter(ok, sigma_win, mode="constant")
    Es = ndimage.gaussian_filter(np.nan_to_num(E), sigma_win, mode="constant") / np.maximum(wsum, 1e-9)
    Ns = ndimage.gaussian_filter(np.nan_to_num(N), sigma_win, mode="constant") / np.maximum(wsum, 1e-9)
    Es[wsum < 1e-3] = 0; Ns[wsum < 1e-3] = 0
    # lattice node (i, j) sits at pixel (r0 + i*step, c0 + j*step); bilinear interpolation to every pixel
    rr, cc = np.mgrid[0:shape_px[0], 0:shape_px[1]]
    fi, fj = (rr - r0) / step, (cc - c0) / step
    uE = ndimage.map_coordinates(Es, [fi, fj], order=1, mode="constant", cval=0.0)
    uN = ndimage.map_coordinates(Ns, [fi, fj], order=1, mode="constant", cval=0.0)
    return uE, uN


def advect(img, uE, uN, dt_years, res, order=3):
    """Semi-Lagrangian warp: output(x) = img(x - u * dt). +col = east, +row = south (north = -row)."""
    from skimage.transform import warp
    h, w = img.shape
    rr, cc = np.mgrid[0:h, 0:w].astype(np.float64)
    src_r = rr + uN * dt_years / res        # source lies upstream: north displacement d -> source row = row + d/res
    src_c = cc - uE * dt_years / res
    fill = np.nanmedian(img)
    valid = np.isfinite(img)
    out = warp(np.where(valid, img, fill), np.array([src_r, src_c]), order=order, mode="edge", preserve_range=True)
    vmask = warp(valid.astype(float), np.array([src_r, src_c]), order=0, mode="edge", preserve_range=True) > 0.5
    lo, hi = np.nanmin(img), np.nanmax(img)
    out = np.clip(out, lo, hi)
    out[~vmask] = np.nan
    return out


def centroid(img, thr):
    m = img > thr
    r, c = np.nonzero(m)
    w = img[m]
    return float(np.sum(r * w) / w.sum()), float(np.sum(c * w) / w.sum())
