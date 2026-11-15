"""Glue between window matching (tracking.py) and the multi-temporal network (network.py), used for both
the Landsat 15 m pan stack and the HLS 30 m stacks in notebook 02.

Pair results are stored as D[(i, j)] = array (4, n_windows): d_row, d_col (pixels, j relative to i), peak, ratio,
with i, j indices into one epoch table (time order i < j).
"""

import numpy as np

from . import network as nw
from . import tracking as tk


def track_all(imgs, pairs, rr, cc, win, **kw):
    """imgs: list of 2-D arrays (NaN = masked) indexed like the epoch table; pairs: list of (i, j)."""
    D = {}
    for i, j in pairs:
        o = tk.track_pair(imgs[i], imgs[j], rr, cc, win=win, **kw)
        D[(i, j)] = np.stack([o["d_row"], o["d_col"], o["peak"], o["ratio"]]).astype(np.float32)
    return D


def null_peaks(imgs, pairs, rr, cc, win, offset_px, **kw):
    """Peak heights when every window is matched against an UNRELATED window (offset by offset_px rows and
    -offset_px columns): the distribution of the quality metric when there is no true match."""
    out = []
    for i, j in pairs:
        o = tk.track_pair(imgs[i], imgs[j], rr, cc, win=win, guide_r=np.full(rr.size, offset_px),
                          guide_c=np.full(rr.size, -offset_px), **kw)
        out.append(o["peak"])
    x = np.concatenate(out)
    return x[np.isfinite(x)]


def valid_obs(Dij, peak_min, max_disp_px):
    dr, dc, pk, _ = Dij
    return np.isfinite(pk) & (pk >= peak_min) & (np.hypot(dr, dc) <= max_disp_px)


def coherence(D, pairs, peak_min, max_disp_px):
    """Per window: median peak and fraction of valid pairs over `pairs`."""
    pk = np.stack([D[p][2] for p in pairs])
    va = np.stack([valid_obs(D[p], peak_min, max_disp_px) for p in pairs])
    return np.nanmedian(pk, axis=0), va.mean(axis=0)


def pair_offsets(D, pairs, sel_idx, peak_min, max_disp_px, res):
    """Per pair: median (E, N) displacement in metres of the stable windows `sel_idx` that are valid in that
    pair, their NMAD, 95th percentile of the radial residual, count. Returns list of dicts."""
    rows = []
    for (i, j) in pairs:
        dr, dc, pk, _ = D[(i, j)]
        ok = np.zeros(dr.size, bool)
        ok[sel_idx] = True
        ok &= valid_obs(D[(i, j)], peak_min, max_disp_px)
        E, N = dc[ok] * res, -dr[ok] * res
        if ok.sum() < 5:
            rows.append(dict(i=i, j=j, n=int(ok.sum()), E=np.nan, N=np.nan, nmadE=np.nan, nmadN=np.nan, p95=np.nan))
            continue
        mE, mN = float(np.median(E)), float(np.median(N))
        rows.append(dict(i=i, j=j, n=int(ok.sum()), E=mE, N=mN, nmadE=float(tk.nmad(E)), nmadN=float(tk.nmad(N)),
                         p95=float(np.percentile(np.hypot(E - mE, N - mN), 95))))
    return rows


def epoch_registration(offs, n_epochs):
    """Per-epoch offsets (E, N) from per-pair stable offsets by least squares (epoch 0 := 0), plus the
    closure residual of every pair. Pairs with no estimate are skipped."""
    ok = [r for r in offs if np.isfinite(r["E"])]
    pairs = [(r["i"], r["j"]) for r in ok]
    GE, resE = nw.epoch_offsets(np.array([r["E"] for r in ok]), pairs, n_epochs)
    GN, resN = nw.epoch_offsets(np.array([r["N"] for r in ok]), pairs, n_epochs)
    return GE, GN, pairs, resE, resN


def observations(D, pairs, idx, GE, GN, peak_min, max_disp_px, res):
    """Registration-corrected displacements (m) for windows `idx`: YE, YN (n_idx, n_pairs) and validity."""
    YE = np.zeros((idx.size, len(pairs)))
    YN = np.zeros_like(YE)
    V = np.zeros_like(YE, bool)
    for p, (i, j) in enumerate(pairs):
        dr, dc, pk, _ = D[(i, j)]
        YE[:, p] = dc[idx] * res - (GE[j] - GE[i])
        YN[:, p] = -dr[idx] * res - (GN[j] - GN[i])
        V[:, p] = valid_obs(D[(i, j)], peak_min, max_disp_px)[idx]
    return YE, YN, V


def velocities(YE, YN, V, pairs, t, epochs, extra=None):
    """Network inversion per component over the epochs `epochs` (global indices; the first is the reference),
    then a straight-line fit of positions against time. `pairs` use global indices, `t`/`extra` are global
    arrays. Positions are returned in the local epoch order."""
    loc = {g: k for k, g in enumerate(epochs)}
    lp = [(loc[i], loc[j]) for i, j in pairs]
    K = len(epochs)
    tl = np.asarray(t)[list(epochs)]
    xl = None if extra is None else np.asarray(extra)[list(epochs)]
    PE, rmsE, oE, nE = nw.invert(YE, V, lp, K)
    PN, rmsN, oN, nN = nw.invert(YN, V, lp, K)
    vE, sE, bE, sbE, nep, sdE = nw.line_fit(tl, PE, extra=xl)
    vN, sN, bN, sbN, _, sdN = nw.line_fit(tl, PN, extra=xl)
    return dict(PE=PE, PN=PN, rmsE=rmsE, rmsN=rmsN, outE=oE, outN=oN, n_used=np.minimum(nE, nN), t=tl,
                vE=vE, vN=vN, sE=sE, sN=sN, bE=bE, bN=bN, sbE=sbE, sbN=sbN, n_epochs=nep)


def held_out_null(D, net_pairs, reg_pairs, epochs, stable_idx, t, n_all, peak_min, max_disp_px, res, seed=0):
    """Null test on stable ground with no circularity: split the stable windows at random into two halves,
    estimate the registration from one half, and measure the 'velocity' of the other half (and vice versa).
    Returns dict with the held-out windows' vE, vN, sE, sN (concatenated), and the difference between the
    two halves' registration expressed as a velocity (a systematic-error estimate), per component."""
    rng = np.random.default_rng(seed)
    perm = rng.permutation(stable_idx)
    halves = [np.sort(perm[::2]), np.sort(perm[1::2])]
    res_ = {"idx": [], "vE": [], "vN": [], "sE": [], "sN": [], "n_epochs": []}
    G = []
    for a, b in ((0, 1), (1, 0)):
        GE, GN, *_ = epoch_registration(pair_offsets(D, reg_pairs, halves[a], peak_min, max_disp_px, res), n_all)
        G.append((GE, GN))
        YE, YN, V = observations(D, net_pairs, halves[b], GE, GN, peak_min, max_disp_px, res)
        vel = velocities(YE, YN, V, net_pairs, t, epochs)
        res_["idx"].append(halves[b])
        for k in ("vE", "vN", "sE", "sN", "n_epochs"):
            res_[k].append(vel[k])
    out = {k: np.concatenate(v) for k, v in res_.items()}
    tl = np.asarray(t)[list(epochs)]
    out["reg_velocity_diff_E"] = float(np.polyfit(tl, (G[0][0] - G[1][0])[list(epochs)], 1)[0])
    out["reg_velocity_diff_N"] = float(np.polyfit(tl, (G[0][1] - G[1][1])[list(epochs)], 1)[0])
    return out


CHI2_2DOF_95 = 2.4477   # sqrt of the 95 % quantile of chi-square with 2 dof: |v| / sigma for a 2-D null


def calibration_factor(vE, vN, sE, sN):
    """Robust std of v/se over windows that should not move (null): how much the formal standard errors
    must be inflated to describe the real scatter."""
    z = np.concatenate([vE / sE, vN / sN])
    z = z[np.isfinite(z)]
    return float(1.4826 * np.median(np.abs(z - np.median(z))))
