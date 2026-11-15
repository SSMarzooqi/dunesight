"""Fryberger & Dean (1979) sand drift potential from hourly 10 m wind components.

Definitions used (and unit-tested in notebook 01):
  * V is wind speed in knots at 10 m; the threshold Vt is 12 kt.
  * Meteorological FROM direction (where the wind blows from, 0 = N, clockwise):
        theta_from = atan2(-U, -V)  (degrees, mod 360)
    Sand moves downwind:  theta_to = theta_from + 180  (= atan2(U, V)).
  * Drift potential, in vector units (VU):
        DP = sum over speed/direction classes of  V^2 (V - Vt) / 100 * t
    where t is the percentage of time the wind is in that class. With hourly data every hour is its
    own class, so for one year  t_h = 100 / N  (N = number of valid hours in that year), i.e.
        DP_year = sum_h V_h^2 (V_h - Vt) / 100 * (100 / N) = mean over hours of V^2 (V - Vt)_+
    Only hours with V > Vt contribute. The 200 / 400 VU class limits (low < 200 <= intermediate
    < 400 <= high) are defined for DP in exactly these units (per year).
  * Each hour's drift is a vector of length q_h = V^2 (V - Vt) / 100 * t_h pointing downwind.
    RDP is the length of the vector sum and RDD (the resultant drift direction, the direction sand
    moves TO) is its compass bearing. RDP/DP is the directional variability index.
  * Missing hours (NaN) are dropped and t_h uses the valid count N, i.e. the valid hours are taken
    to represent the whole year. The caller reports how many hours were missing.
"""

import calendar

import numpy as np

MS_TO_KT = 1.0 / 0.514444  # 1 kt = 0.514444 m/s exactly (1852 m / 3600 s)
VT_KT = 12.0
N_SECTORS = 16
SECTOR_WIDTH = 360.0 / N_SECTORS


def from_dir_deg(u, v):
    """Meteorological direction the wind blows FROM, degrees clockwise from north, in [0, 360)."""
    return np.mod(np.degrees(np.arctan2(-np.asarray(u, float), -np.asarray(v, float))), 360.0)


def downwind_deg(u, v):
    """Direction the wind (and sand) moves TO, degrees clockwise from north, in [0, 360)."""
    return np.mod(from_dir_deg(u, v) + 180.0, 360.0)


def speed_kt(u, v):
    return np.hypot(np.asarray(u, float), np.asarray(v, float)) * MS_TO_KT


def weighting(v_kt, vt=VT_KT):
    """V^2 (V - Vt) for V > Vt, else 0 (knots)."""
    v_kt = np.asarray(v_kt, float)
    return np.where(v_kt > vt, v_kt ** 2 * (v_kt - vt), 0.0)


def sector_index(theta_deg):
    """16-sector index with sector k centred on k * 22.5 deg (sector 0 spans 348.75-11.25)."""
    return (np.floor(np.mod(np.asarray(theta_deg, float) + SECTOR_WIDTH / 2, 360.0) / SECTOR_WIDTH)).astype(int) % N_SECTORS


def dp_class(dp):
    return "low" if dp < 200 else ("intermediate" if dp < 400 else "high")


def fryberger(u_ms, v_ms, vt=VT_KT):
    """Drift statistics for ONE period (normally one calendar year) of hourly U, V in m/s.

    Returns dict with DP, RDP, RDD_deg, RDP_DP, the resultant components (east, north) in VU,
    the 16-sector rose by FROM direction (VU), the number of valid hours and the % of hours above Vt.
    """
    u = np.asarray(u_ms, float)
    v = np.asarray(v_ms, float)
    ok = np.isfinite(u) & np.isfinite(v)
    u, v = u[ok], v[ok]
    n = int(u.size)
    if n == 0:
        raise ValueError("no valid hours")
    t_pct = 100.0 / n                       # each hour's share of the period, in percent
    q = weighting(speed_kt(u, v), vt) / 100.0 * t_pct
    to = np.radians(downwind_deg(u, v))
    east, north = float(np.sum(q * np.sin(to))), float(np.sum(q * np.cos(to)))
    dp = float(np.sum(q))
    rdp = float(np.hypot(east, north))
    rose = np.bincount(sector_index(from_dir_deg(u, v)), weights=q, minlength=N_SECTORS)
    return {
        "DP": dp,
        "RDP": rdp,
        "RDD_deg": float(np.mod(np.degrees(np.arctan2(east, north)), 360.0)) if rdp > 0 else float("nan"),
        "RDP_DP": rdp / dp if dp > 0 else float("nan"),
        "east": east,
        "north": north,
        "rose_from": rose,
        "n_valid": n,
        "pct_hours_above_vt": float(np.mean(speed_kt(u, v) > vt) * 100.0),
    }


def hours_in_year(year):
    return 8784 if calendar.isleap(year) else 8760


def fryberger_by_year(years, u_ms, v_ms, vt=VT_KT):
    """Per-calendar-year Fryberger statistics. `years` is an int array aligned with u, v.

    Returns (rows, period) where rows is a list of per-year dicts (with expected/valid/missing hour
    counts) and period holds the whole-period values: DP = mean annual DP, the resultant = mean of the
    yearly resultant vectors (so every year has equal weight), the rose = mean annual rose.
    """
    years = np.asarray(years)
    rows = []
    for y in np.unique(years):
        m = years == y
        r = fryberger(np.asarray(u_ms)[m], np.asarray(v_ms)[m], vt)
        r["year"] = int(y)
        r["n_expected"] = hours_in_year(int(y))
        r["n_missing"] = r["n_expected"] - r["n_valid"]
        rows.append(r)
    dp = float(np.mean([r["DP"] for r in rows]))
    east = float(np.mean([r["east"] for r in rows]))
    north = float(np.mean([r["north"] for r in rows]))
    rdp = float(np.hypot(east, north))
    period = {
        "DP": dp,
        "RDP": rdp,
        "RDD_deg": float(np.mod(np.degrees(np.arctan2(east, north)), 360.0)),
        "RDP_DP": rdp / dp if dp > 0 else float("nan"),
        "rose_from": np.mean([r["rose_from"] for r in rows], axis=0),
        "dp_class": dp_class(dp),
        "n_years": len(rows),
    }
    return rows, period


def angle_diff(a, b):
    """Smallest absolute difference between two bearings, degrees."""
    d = np.abs(np.mod(np.asarray(a, float) - np.asarray(b, float), 360.0))
    return np.minimum(d, 360.0 - d)
