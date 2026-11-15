"""Raster grids and cached Earth Engine downloads (needs numpy, rasterio, pyproj, requests, earthengine-api).

Grid convention used everywhere in notebook 02:
    * one projected CRS per site (sites.json `epsg`), north-up, square pixels;
    * the 15 m tracking grid is snapped to the phase of the Landsat Collection 2 panchromatic grid
      (pixel corners at 7.5 m mod 15 m in UTM, checked per scene), so Earth Engine copies B8 pixels
      one-to-one with no resampling;
    * array row r, column c has its centre at  x = x0 + (c + 0.5) * res,  y = y0 - (r + 0.5) * res,
      so +column is east and +row is SOUTH. A displacement (d_row, d_col) in pixels is
      (east, north) = (d_col * res, -d_row * res) in metres.
"""

import io
import json
import time
import zipfile
from dataclasses import dataclass, asdict

import numpy as np


@dataclass
class Grid:
    crs: str
    x0: float      # west edge of column 0 (projected metres)
    y0: float      # north edge of row 0
    res: float
    width: int
    height: int

    @property
    def transform(self):
        return [self.res, 0.0, self.x0, 0.0, -self.res, self.y0]

    def affine(self):
        from rasterio.transform import Affine
        return Affine(self.res, 0.0, self.x0, 0.0, -self.res, self.y0)

    def xy(self, row, col):
        """Projected coordinates of pixel centres (arrays ok)."""
        return self.x0 + (np.asarray(col) + 0.5) * self.res, self.y0 - (np.asarray(row) + 0.5) * self.res

    def rowcol(self, x, y):
        """Fractional (row, col) of projected points, pixel-centre convention (centre of pixel 0 = 0.0)."""
        return (self.y0 - np.asarray(y)) / self.res - 0.5, (np.asarray(x) - self.x0) / self.res - 0.5

    def to_dict(self):
        return asdict(self)

    def coarsen(self, factor):
        return Grid(self.crs, self.x0, self.y0, self.res * factor, self.width // factor, self.height // factor)


def site_grid(bbox, epsg, margin_m=1500.0, res=15.0, phase=7.5):
    """Grid covering the WGS84 bbox (dict west/south/east/north) plus a margin, in EPSG:epsg, with pixel
    corners snapped to `phase` (mod res). The width/height are made even so a 2x coarsening is exact."""
    from pyproj import Transformer
    tr = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    lons = np.linspace(bbox["west"], bbox["east"], 21)
    lats = np.linspace(bbox["south"], bbox["north"], 21)
    LO, LA = np.meshgrid(lons, lats)
    X, Y = tr.transform(LO.ravel(), LA.ravel())
    xmin, xmax = X.min() - margin_m, X.max() + margin_m
    ymin, ymax = Y.min() - margin_m, Y.max() + margin_m
    x0 = np.floor((xmin - phase) / res) * res + phase
    y0 = np.ceil((ymax - phase) / res) * res + phase
    w = int(np.ceil((xmax - x0) / res)); h = int(np.ceil((y0 - ymin) / res))
    w += w % 2; h += h % 2
    return Grid(f"EPSG:{epsg}", float(x0), float(y0), float(res), w, h)


def box_mask(grid, bbox):
    """Boolean array, True for pixel centres inside the WGS84 bbox."""
    from pyproj import Transformer
    rr, cc = np.mgrid[0:grid.height, 0:grid.width]
    x, y = grid.xy(rr, cc)
    tr = Transformer.from_crs(grid.crs, "EPSG:4326", always_xy=True)
    lon, lat = tr.transform(x.ravel(), y.ravel())
    lon = np.asarray(lon).reshape(x.shape); lat = np.asarray(lat).reshape(x.shape)
    return (lon >= bbox["west"]) & (lon <= bbox["east"]) & (lat >= bbox["south"]) & (lat <= bbox["north"])


def reproject_geom(func, geom):
    """Apply a coordinate function func(x, y) -> (x', y') (e.g. pyproj Transformer.transform) to a shapely geometry."""
    import shapely

    def f(c):
        x, y = func(c[:, 0], c[:, 1])
        return np.column_stack([np.asarray(x), np.asarray(y)])
    return shapely.transform(geom, f)


def _fetch(url, tries=5):
    import requests
    for k in range(tries):
        try:
            r = requests.get(url, timeout=300)
            r.raise_for_status()
            return r.content
        except Exception:
            if k == tries - 1:
                raise
            time.sleep(4 * (k + 1))


def ee_download(image, grid, path, bands, meta=None):
    """Download `bands` of an ee.Image on `grid` as one multi-band GeoTIFF at `path` (cached: skipped if the
    file exists). Earth Engine resamples only if the grid does not match the source grid (default nearest
    neighbour). `meta` (dict) is written next to it as <path>.json."""
    import rasterio
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        url = image.select(bands).getDownloadURL({
            "crs": grid.crs, "crs_transform": grid.transform,
            "dimensions": f"{grid.width}x{grid.height}", "format": "GEO_TIFF",
        })
        data = _fetch(url)
        if data[:2] == b"PK":  # some EE versions zip single files
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                data = z.read(z.namelist()[0])
        tmp = path.with_suffix(".part")
        tmp.write_bytes(data)
        with rasterio.open(tmp) as src:
            assert src.width == grid.width and src.height == grid.height, (src.width, src.height)
            t = src.transform
            assert abs(t.a - grid.res) < 1e-6 and abs(t.c - grid.x0) < 1e-3 and abs(t.f - grid.y0) < 1e-3, t
        tmp.rename(path)
    if meta is not None:
        path.with_suffix(".json").write_text(json.dumps(meta, indent=1, default=str))
    return path


def read(path):
    """(array [bands, rows, cols], profile)."""
    import rasterio
    with rasterio.open(path) as src:
        return src.read(), src.profile


def write(path, arr, grid, nodata=None, dtype=None):
    import rasterio
    arr = np.asarray(arr)
    if arr.ndim == 2:
        arr = arr[None]
    dtype = dtype or arr.dtype
    with rasterio.open(path, "w", driver="GTiff", width=grid.width, height=grid.height, count=arr.shape[0],
                       dtype=dtype, crs=grid.crs, transform=grid.affine(), nodata=nodata, compress="deflate") as dst:
        dst.write(arr.astype(dtype))
