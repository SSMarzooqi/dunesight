"""Multi-temporal displacement network: from many image pairs to per-window positions and a velocity.

For one window and epochs k = 0..K-1 (times t_k), every valid pair (i, j) gives a registration-corrected
displacement y_ij (metres, east and north treated separately). The model is

    y_ij = P_j - P_i + e_ij           (positions P_k, P_0 := 0)

solved by least squares with iterative down-weighting of pairs whose residual exceeds 3 robust sigmas
(those pairs are counted as network outliers: a wrong match, e.g. a jump to the neighbouring dune, shows
up here because it cannot close with the other pairs). The closure residual RMS is a direct check that
A->B plus B->C equals A->C. Then the positions are fitted with a straight line

    P_k = a + v t_k  [+ b (el_k - el_ref)]

whose slope v is the velocity; its standard error comes from the scatter of the positions about the line
(so year-to-year noise and real non-linearity both widen it). The optional term b absorbs an apparent
displacement proportional to sun elevation (illumination bias), estimated from extra short-interval
scenes with very different sun elevation.
"""

import numpy as np


def design(pairs, n_epochs):
    """Pair-to-epoch incidence matrix (n_pairs x n_epochs-1), epoch 0 fixed at 0."""
    A = np.zeros((len(pairs), n_epochs))
    for r, (i, j) in enumerate(pairs):
        A[r, j] += 1.0
        A[r, i] -= 1.0
    return A[:, 1:]


def invert(Y, valid, pairs, n_epochs, n_iter=4, k_sigma=3.0, min_sigma=0.5):
    """Y: (n_windows, n_pairs) observations for ONE component (m); valid: bool same shape.
    Returns positions (n_windows, n_epochs) [NaN where the epoch is not connected], closure RMS,
    outlier mask (n_windows, n_pairs), number of pairs used."""
    nw, npairs = Y.shape
    A_full = design(pairs, n_epochs)
    P = np.full((nw, n_epochs), np.nan)
    rms = np.full(nw, np.nan)
    outl = np.zeros((nw, npairs), bool)
    nused = np.zeros(nw, int)
    for w in range(nw):
        v = valid[w].copy()
        if v.sum() < 3:
            continue
        wts = np.ones(npairs)
        for it in range(n_iter):
            m = v & (wts > 0)
            A = A_full[m]
            conn = np.abs(A).sum(axis=0) > 0
            if conn.sum() == 0:
                break
            sol, *_ = np.linalg.lstsq(A[:, conn], Y[w, m], rcond=None)
            x = np.zeros(n_epochs - 1); x[conn] = sol
            res = Y[w] - A_full @ x
            s = max(1.4826 * np.median(np.abs(res[m])), min_sigma)
            new = (np.abs(res) <= k_sigma * s).astype(float)
            if np.array_equal(new * v, wts * v):
                break
            wts = new
        m = v & (wts > 0)
        conn_all = np.abs(A_full[m]).sum(axis=0) > 0
        P[w, 0] = 0.0
        P[w, 1:] = np.where(conn_all, x, np.nan)
        rms[w] = np.sqrt(np.mean(res[m] ** 2)) if m.sum() > n_epochs - 1 else np.nan
        outl[w] = v & ~(wts > 0)
        nused[w] = int(m.sum())
    return P, rms, outl, nused


def line_fit(t, P, extra=None, min_epochs=4):
    """Fit P_k = a + v t_k (+ b extra_k) per row of P (NaN = missing). Returns v, se_v, b, se_b, n, resid_sd."""
    nw = P.shape[0]
    v = np.full(nw, np.nan); se = np.full(nw, np.nan); b = np.full(nw, np.nan); seb = np.full(nw, np.nan)
    n = np.zeros(nw, int); sd = np.full(nw, np.nan)
    for w in range(nw):
        ok = np.isfinite(P[w])
        if ok.sum() < min_epochs:
            continue
        cols = [np.ones(ok.sum()), t[ok]]
        if extra is not None:
            cols.append(extra[ok])
        X = np.column_stack(cols)
        y = P[w, ok]
        beta, *_ = np.linalg.lstsq(X, y, rcond=None)
        r = y - X @ beta
        dof = ok.sum() - X.shape[1]
        if dof < 1:
            continue
        s2 = (r @ r) / dof
        cov = s2 * np.linalg.inv(X.T @ X)
        v[w], se[w] = beta[1], np.sqrt(cov[1, 1])
        if extra is not None:
            b[w], seb[w] = beta[2], np.sqrt(cov[2, 2])
        n[w] = ok.sum(); sd[w] = np.sqrt(s2)
    return v, se, b, seb, n, sd


def epoch_offsets(pair_off, pairs, n_epochs):
    """Per-epoch registration offsets from per-pair stable-ground offsets (one component), epoch 0 := 0.
    Returns offsets and the pair closure residuals."""
    A = design(pairs, n_epochs)
    x, *_ = np.linalg.lstsq(A, pair_off, rcond=None)
    G = np.concatenate([[0.0], x])
    return G, pair_off - A @ x
