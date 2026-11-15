"""MERRA-2 grid helpers (standard library only).

Native MERRA-2 2-D grid (GMAO, Bosilovich et al. 2016, MERRA-2 File Specification, GMAO Office Note 9):
    361 latitudes, centres  lat_j = -90 + 0.5 * j      (j = 0..360)
    576 longitudes, centres lon_i = -180 + 0.625 * i   (i = 0..575)
so a cell spans lat_j +/- 0.25 deg and lon_i +/- 0.3125 deg.

Earth Engine's NASA/GSFC/MERRA/slv/2 and /aer/2 assets (checked 2026-11-14) declare the transform
[0.625, 0, -180.5, 0, 0.5, -90.5], i.e. pixel (i, j) spans lon -180.5 + 0.625 i ... and
lat -90.5 + 0.5 j ..., which is 0.1875 deg west and 0.25 deg south of the native cell with the same
index. Notebook 01 shows (against NASA POWER, which uses the native grid) that EE pixel (i, j) holds
native cell (i, j). So to read the native cell containing a point we sample the EE pixel with the same
index, at its centre in EE's own coordinates. Sampling EE at the point's true lat/lon can return a
neighbouring cell.
"""

import math

NATIVE_DLAT = 0.5
NATIVE_DLON = 0.625


def native_cell(lat, lon):
    """Native MERRA-2 cell containing (lat, lon): indices, centre and bounds."""
    j = int(math.floor((lat + 90.0) / NATIVE_DLAT + 0.5))
    i = int(math.floor((lon + 180.0) / NATIVE_DLON + 0.5)) % 576
    lat_c, lon_c = -90.0 + NATIVE_DLAT * j, -180.0 + NATIVE_DLON * i
    return {
        "i": i, "j": j, "lat_c": lat_c, "lon_c": lon_c,
        "south": lat_c - NATIVE_DLAT / 2, "north": lat_c + NATIVE_DLAT / 2,
        "west": lon_c - NATIVE_DLON / 2, "east": lon_c + NATIVE_DLON / 2,
    }


def ee_pixel_centre(transform, i, j):
    """Centre, in Earth Engine's declared coordinates, of EE pixel (i, j) for an affine transform
    [sx, 0, x0, 0, sy, y0] with sy > 0 (row 0 at the south)."""
    sx, _, x0, _, sy, y0 = transform
    return x0 + sx * (i + 0.5), y0 + sy * (j + 0.5)


def ee_pixel_at(transform, lat, lon):
    """EE pixel index (i, j) that EE would sample at the true point (lat, lon)."""
    sx, _, x0, _, sy, y0 = transform
    return int(math.floor((lon - x0) / sx)), int(math.floor((lat - y0) / sy))
