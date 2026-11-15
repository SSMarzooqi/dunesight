"""Window-based sub-pixel image matching (phase correlation), batched with numpy.

Sign convention (tested in notebook 02): for a reference image A and a later image B,
    a feature at array position p in A is found at p + d in B,  d = (d_row, d_col) in pixels.
On a north-up grid +row is SOUTH, so the ground displacement is
    east = d_col * res,   north = -d_row * res.
Heading (direction of motion) = atan2(east, north), degrees clockwise from north.

Method, per window pair (A_w, B_w), size W x W:
  1. remove the window mean, divide by the window standard deviation (so a gain/offset change of the
     whole window has no effect), multiply by a 2-D Hann taper;
  2. normalised cross-power spectrum  R = F(B) conj(F(A)) / |F(B) conj(F(A))|  (phase correlation),
     multiplied by a radial low-pass weight that suppresses the noisiest highest frequencies;
  3. integer peak of the inverse FFT, then sub-pixel refinement by evaluating the same correlation
     surface on a 1/upsample grid around the peak with a matrix DFT (Guizar-Sicairos et al. 2008,
     Opt. Lett. 33:156), as skimage.registration.phase_cross_correlation does, but for many windows at once;
  4. quality: `peak` = height of the phase-correlation peak (1 = perfect match, ~0 = no match) and
     `ratio` = peak / highest secondary peak more than 2 px away (ambiguity: near 1 means two equally
     good matches, e.g. a periodic dune pattern).
Masked pixels (NaN) get zero weight, feathered over 2 px so a mask edge is not a sharp static pattern; a
window is rejected if more than `max_nan_frac` of it is masked. Window extraction can be "guided": the B window is cut at the A position plus an integer offset, so a
predicted displacement can be removed before matching; the offset is added back to the result.
"""

import numpy as np


def window_centres(shape, win, step, margin=0):
    """Centres (row, col) of a regular grid of windows that fit inside an image of `shape`, keeping
    `margin` extra pixels from every edge (room for guided offsets)."""
    h, w = shape
    half = win // 2
    r = np.arange(half + margin, h - half - margin + 1, step)
    c = np.arange(half + margin, w - half - margin + 1, step)
    R, C = np.meshgrid(r, c, indexing="ij")
    return R, C


def extract(img, rows, cols, win, off_r=None, off_c=None):
    """Stack of W x W windows centred at (rows + off_r, cols + off_c) (integers). Windows that would
    leave the image are filled with NaN."""
    rows = np.asarray(rows).ravel().astype(int)
    cols = np.asarray(cols).ravel().astype(int)
    if off_r is not None:
        rows = rows + np.asarray(off_r).ravel().astype(int)
        cols = cols + np.asarray(off_c).ravel().astype(int)
    half = win // 2
    h, w = img.shape
    out = np.full((rows.size, win, win), np.nan, dtype=np.float32)
    ok = (rows - half >= 0) & (cols - half >= 0) & (rows - half + win <= h) & (cols - half + win <= w)
    ii = np.arange(win)
    idx_r = (rows[ok] - half)[:, None] + ii[None, :]
    idx_c = (cols[ok] - half)[:, None] + ii[None, :]
    out[ok] = img[idx_r[:, :, None], idx_c[:, None, :]]
    return out


_TAPERS = {}


def _taper(win):
    if win not in _TAPERS:
        h = np.hanning(win + 2)[1:-1]
        _TAPERS[win] = np.outer(h, h).astype(np.float64)
    return _TAPERS[win]


def _lowpass(win, cutoff=0.8):
    """Radial weight on the FFT grid: 1 up to `cutoff` x Nyquist, raised-cosine roll-off to 0 at Nyquist*1.0."""
    f = np.fft.fftfreq(win)
    fr = np.hypot(f[:, None], f[None, :]) / 0.5
    w = np.ones_like(fr)
    m = fr > cutoff
    w[m] = 0.5 * (1 + np.cos(np.pi * np.clip((fr[m] - cutoff) / (1.0 - cutoff), 0, 1)))
    return w


def _prep(stack, feather_px=2.0):
    """Normalise each window (zero mean, unit std over valid pixels); masked (NaN) pixels get weight 0 and the
    weight is feathered (Gaussian, `feather_px`) so a mask edge does not create a sharp static pattern."""
    from scipy import ndimage
    s = stack.astype(np.float64)
    valid = np.isfinite(s)
    mu = np.nanmean(s, axis=(1, 2), keepdims=True)
    sd = np.nanstd(s, axis=(1, 2), keepdims=True)
    sd[~np.isfinite(sd) | (sd == 0)] = 1.0
    s = np.nan_to_num((s - mu) / sd, nan=0.0)
    if not valid.all():
        w = ndimage.gaussian_filter(valid.astype(np.float64), sigma=(0, feather_px, feather_px)) * valid
        s = s * w
    return s * _taper(s.shape[1])


def phase_correlate(A, B, upsample=100, lowpass=0.8, eps=1e-12, max_nan_frac=0.0):
    """Batched phase correlation of window stacks A, B (N, W, W). Returns dict of arrays (length N):
    d_row, d_col (pixels, B relative to A), peak, ratio. Windows whose share of NaN (masked) pixels exceeds
    `max_nan_frac` in either image return NaN; below that, masked pixels are given zero (feathered) weight."""
    N, W, _ = A.shape
    bad = (np.isnan(A).mean(axis=(1, 2)) > max_nan_frac) | (np.isnan(B).mean(axis=(1, 2)) > max_nan_frac)
    if max_nan_frac > 0:
        bad |= np.isnan(A).all(axis=(1, 2)) | np.isnan(B).all(axis=(1, 2))
    FA = np.fft.fft2(_prep(A))
    FB = np.fft.fft2(_prep(B))
    X = FB * np.conj(FA)
    R = X / (np.abs(X) + eps) * _lowpass(W, lowpass)
    wsum = _lowpass(W, lowpass).sum()
    r = np.fft.ifft2(R).real * (W * W) / wsum  # peak height normalised so a perfect match = 1
    flat = r.reshape(N, -1)
    k = np.argmax(flat, axis=1)
    pr, pc = np.unravel_index(k, (W, W))
    peak0 = flat[np.arange(N), k]
    # secondary peak: mask a 5x5 neighbourhood (wrapped) of the main peak
    rr = np.arange(W)
    dr = (rr[None, :] - pr[:, None] + W // 2) % W - W // 2
    dc = (rr[None, :] - pc[:, None] + W // 2) % W - W // 2
    near = (np.abs(dr)[:, :, None] <= 2) & (np.abs(dc)[:, None, :] <= 2)
    sec = np.where(near, -np.inf, r).reshape(N, -1).max(axis=1)
    # signed integer shifts
    pr_s = np.where(pr > W // 2, pr - W, pr).astype(float)
    pc_s = np.where(pc > W // 2, pc - W, pc).astype(float)
    # sub-pixel refinement by matrix-multiply DFT, in two stages: a 0.1 px grid spanning +-1 px around the
    # integer peak, then a 1/upsample grid spanning +-0.1 px around the best 0.1 px node
    f = np.fft.fftfreq(W)

    def dft_patch(cy, cx, off):
        ys = cy[:, None] + off[None, :]
        xs = cx[:, None] + off[None, :]
        Ey = np.exp(2j * np.pi * ys[:, :, None] * f[None, None, :])   # (N, K, W)
        Ex = np.exp(2j * np.pi * xs[:, :, None] * f[None, None, :])
        cc = np.matmul(np.matmul(Ey, R), np.transpose(Ex, (0, 2, 1))).real / wsum
        K = off.size
        kk = np.argmax(cc.reshape(N, -1), axis=1)
        ky, kx = np.unravel_index(kk, (K, K))
        return cy + off[ky], cx + off[kx], cc.reshape(N, -1)[np.arange(N), kk]

    off1 = np.arange(-10, 11) / 10.0
    y1, x1, _ = dft_patch(pr_s, pc_s, off1)
    n2 = int(round(0.1 * upsample))
    off2 = np.arange(-n2, n2 + 1) / upsample
    d_row, d_col, peak = dft_patch(y1, x1, off2)
    ratio = peak / np.maximum(sec, 1e-6)
    out = {"d_row": d_row, "d_col": d_col, "peak": peak, "ratio": ratio}
    for v in out.values():
        v[bad] = np.nan
    return out


def track_pair(imgA, imgB, rows, cols, win=32, guide_r=None, guide_c=None, upsample=100, lowpass=0.8, chunk=4000, max_nan_frac=0.0):
    """Match windows centred at (rows, cols) of imgA against imgB (optionally guided by integer offsets).
    NaN pixels are masked: a window is invalid if more than `max_nan_frac` of it is masked (default: any).
    Returns dict of flat arrays."""
    rows = np.asarray(rows).ravel(); cols = np.asarray(cols).ravel()
    n = rows.size
    gr = np.zeros(n, int) if guide_r is None else np.round(np.asarray(guide_r).ravel()).astype(int)
    gc = np.zeros(n, int) if guide_c is None else np.round(np.asarray(guide_c).ravel()).astype(int)
    res = {k: np.full(n, np.nan) for k in ("d_row", "d_col", "peak", "ratio")}
    for s in range(0, n, chunk):
        sl = slice(s, s + chunk)
        A = extract(imgA, rows[sl], cols[sl], win)
        B = extract(imgB, rows[sl], cols[sl], win, gr[sl], gc[sl])
        o = phase_correlate(A, B, upsample=upsample, lowpass=lowpass, max_nan_frac=max_nan_frac)
        res["d_row"][sl] = o["d_row"] + gr[sl]
        res["d_col"][sl] = o["d_col"] + gc[sl]
        res["peak"][sl] = o["peak"]; res["ratio"][sl] = o["ratio"]
    res["guide_r"] = gr; res["guide_c"] = gc
    return res


def window_stat(mask, rows, cols, win, func=np.mean):
    """Per-window statistic of a 2-D array (e.g. fraction of masked pixels)."""
    st = extract(mask.astype(np.float32), rows, cols, win)
    return func(st, axis=(1, 2))


def texture(img, rows, cols, win):
    """Relative texture of each window: std / mean of the pixel values (NaN-aware)."""
    st = extract(img, rows, cols, win)
    return np.nanstd(st, axis=(1, 2)) / np.abs(np.nanmean(st, axis=(1, 2)))


def heading_deg(east, north):
    """Compass bearing of a displacement (east, north): 0 = N, 90 = E, clockwise, in [0, 360)."""
    return np.mod(np.degrees(np.arctan2(east, north)), 360.0)


def nmad(x):
    x = np.asarray(x, float); x = x[np.isfinite(x)]
    return 1.4826 * np.median(np.abs(x - np.median(x))) if x.size else np.nan


def fourier_shift_image(img, d_row, d_col):
    """Shift a whole image by (d_row, d_col) pixels (sub-pixel, periodic boundary): content at p moves to p + d."""
    from scipy.ndimage import fourier_shift
    return np.fft.ifftn(fourier_shift(np.fft.fftn(img), (d_row, d_col))).real
