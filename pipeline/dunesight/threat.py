"""Reach of migrating dune sand onto targets (notebook 03), by forward ray casting along the measured motion.

Definitions (stated in the notebook and in summary.json):
  * SOURCE: a 15 m pixel of free dune sand (inside the box, outside notebook 02's non-dune mask and outside every target
    footprint) that inherits the motion of the nearest valid dune window whose 480 m footprint contains it (centre within
    `max_offset_m` in both E and N). Only windows with DETECTED motion (speed > detection limit) make sources; a window below
    the detection limit has no measured direction and produces nothing.
  * RAY: from the source pixel centre along the measured heading, up to the distance the fast case covers by `horizon`.
    The first target footprint the ray enters is the one the sand reaches; the distance d is measured to that entry point.
  * DISTANCE: the sand edge lies inside the source pixel, so the nominal gap is d_nom = max(0, d - res/2); its uncertainty
    is +- (res/2 + the target's outline uncertainty), giving d_lo and d_hi.
  * SPEEDS: median = the window speed v; fast = v + sigma; slow = v - sigma (sigma = calibrated per-component 1-sigma, so
    fast/slow are the 84th/16th percentiles of the speed); slow > 0 always because detection needs v > 2.45 sigma.
  * YEARS: t0 = date of the latest image; year_min = floor(t0 + d_lo / fast), year_med = round(t0 + d_nom / v),
    year_max = ceil(t0 + d_hi / slow). Per target: the minimum over all sources of each (the first sand to arrive in that
    scenario). A target is reached if year_min <= horizon.
  * HEADING FAN: rays are also cast at heading +- sigma_theta (sigma_theta = sigma / v radians) to report whether a target
    could be reached within the direction uncertainty; this never sets the reach years.
"""

import numpy as np


def assign_windows(grid, wx, wy, valid, max_offset_m=240.0):
    """For every pixel of `grid`: index (into the window table) of the nearest VALID window whose square footprint
    (half width max_offset_m) contains the pixel centre, else -1."""
    from scipy.spatial import cKDTree
    idx_valid = np.where(valid)[0]
    tree = cKDTree(np.column_stack([wx[idx_valid], wy[idx_valid]]))
    rr, cc = np.mgrid[0:grid.height, 0:grid.width]
    x, y = grid.xy(rr.ravel(), cc.ravel())
    d, k = tree.query(np.column_stack([x, y]), k=1)
    w = idx_valid[k]
    inside = (np.abs(wx[w] - x) <= max_offset_m) & (np.abs(wy[w] - y) <= max_offset_m)
    out = np.where(inside, w, -1).reshape(grid.height, grid.width)
    return out


def cast(src_x, src_y, vE, vN, sigma, targets, t0, horizon=2100, res=15.0, fan=0.0):
    """Cast one ray per source. `targets`: list of (shapely geometry projected, outline_uncertainty_m).
    `fan`: heading offset in units of sigma_theta (0 = central ray). Returns dict of arrays per source:
    target index (-1 = none), d (m to entry), year_min/med/max (float, NaN if none)."""
    import shapely
    n = src_x.size
    v = np.hypot(vE, vN)
    fast, slow = v + sigma, v - sigma
    ux, uy = vE / v, vN / v
    if fan:
        th = np.arctan2(ux, uy) + fan * sigma / v          # bearing from north, clockwise
        ux, uy = np.sin(th), np.cos(th)
    dmax = fast * (horizon - t0) + res
    starts = shapely.points(src_x, src_y)
    rays = shapely.linestrings(np.stack([np.column_stack([src_x, src_y]),
                                         np.column_stack([src_x + ux * dmax, src_y + uy * dmax])], axis=1))
    geoms = np.array([g for g, _ in targets], dtype=object)
    unc = np.array([u for _, u in targets], float)
    tree = shapely.STRtree(geoms)
    ir, it = tree.query(rays, predicate="intersects")
    tgt = np.full(n, -1)
    dist = np.full(n, np.inf)
    if ir.size:
        inter = shapely.intersection(rays[ir], geoms[it])
        dd = shapely.distance(starts[ir], inter)
        order = np.lexsort((dd, ir))
        ir_o, it_o, dd_o = ir[order], it[order], dd[order]
        first = np.r_[True, ir_o[1:] != ir_o[:-1]]
        tgt[ir_o[first]] = it_o[first]
        dist[ir_o[first]] = dd_o[first]
    hit = tgt >= 0
    d_nom = np.where(hit, np.maximum(0.0, dist - res / 2), np.nan)
    du = np.where(hit, res / 2 + unc[np.maximum(tgt, 0)], np.nan)
    d_lo, d_hi = np.maximum(0.0, d_nom - du), d_nom + du
    y_min = t0 + d_lo / fast
    y_med = t0 + d_nom / v
    y_max = t0 + d_hi / slow
    reached = hit & (y_min <= horizon)
    for a in (y_min, y_med, y_max):
        a[~reached] = np.nan
    tgt[~reached] = -1
    d_ok = np.where(reached, dist, np.nan)
    return {"target": tgt, "d": d_ok, "hit_x": src_x + ux * d_ok, "hit_y": src_y + uy * d_ok, "d_nom": np.where(reached, d_nom, np.nan),
            "d_lo": np.where(reached, d_lo, np.nan), "d_hi": np.where(reached, d_hi, np.nan),
            "year_min": y_min, "year_med": y_med, "year_max": y_max, "speed": v, "fast": fast, "slow": slow}


def per_target(res_, n_targets):
    """Aggregate source rays by target: earliest year in each scenario, the sources involved and the closest gap."""
    out = []
    t = res_["target"]
    for k in range(n_targets):
        m = t == k
        if not m.any():
            out.append(None)
            continue
        i_min = np.where(m)[0][np.nanargmin(res_["year_min"][m])]
        out.append({"n_sources": int(m.sum()),
                    "year_min": float(np.nanmin(res_["year_min"][m])), "year_med": float(np.nanmin(res_["year_med"][m])),
                    "year_max": float(np.nanmin(res_["year_max"][m])),
                    "gap_m": float(np.nanmin(res_["d_nom"][m])), "src_first": int(i_min)})
    return out
