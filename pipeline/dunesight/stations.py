"""Surface weather-station winds from NOAA's Integrated Surface Database (ISD) / Global Hourly.

Used by notebook 01b to check the MERRA-2 drift potential against observed winds. The drift maths is
NOT here: hourly station winds are turned into U, V in m/s and passed to dunesight.wind, so every
Fryberger definition (12 kt threshold, V^2 (V - Vt), t = 100 / N valid hours per year, 16 sectors)
is identical to the MERRA-2 analysis.

Source and format (checked 2026-11-14):
  * Station list: https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv
  * Data: one CSV per station-year. NCEI's documented URL
        https://www.ncei.noaa.gov/data/global-hourly/access/<year>/<USAF><WBAN>.csv
    now answers 301 to NOAA's Open Data bucket, which serves the same files at
        https://noaa-global-hourly-pds.s3.amazonaws.com/<year>/<USAF><WBAN>.csv
  * Format: NCEI, "Federal Climate Complex Data Documentation for Integrated Surface Data (ISD)",
    https://www.ncei.noaa.gov/data/global-hourly/doc/isd-format-document.pdf. The mandatory wind
    group WND is "ddd,q,T,ssss,q": direction (deg, 999 = missing or variable), its quality code,
    the type code (N normal, C calm, V variable, 9 missing, ...), speed in m/s x 10 (9999 = missing)
    and its quality code. Quality codes 2, 3, 6, 7 mean suspect or erroneous and are rejected.
  * REPORT_TYPE: FM-15 METAR, FM-16 SPECI (special, event-triggered), FM-12 SYNOP, SY-MT merged
    SYNOP+METAR, SAO, AUTO. METAR and SYNOP winds are WMO 10-minute means (WMO-No. 8); ISD does not
    record the averaging time or anemometer height.

Speeds in UAE/Oman METARs and SYNOPs are reported in whole knots and stored by ISD in m/s to 0.1, so
the default is to recover the reported knot value with round(ms / 0.514444).
"""

from pathlib import Path

import numpy as np
import pandas as pd
import requests

from . import wind

KT = 0.514444
ISD_HISTORY_URL = "https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv"
NCEI_ACCESS_URL = "https://www.ncei.noaa.gov/data/global-hourly/access/{year}/{sid}.csv"
S3_URL = "https://noaa-global-hourly-pds.s3.amazonaws.com/{year}/{sid}.csv"
BAD_QC = set("2367")
COLS = ["STATION", "DATE", "SOURCE", "REPORT_TYPE", "CALL_SIGN", "QUALITY_CONTROL",
        "LATITUDE", "LONGITUDE", "ELEVATION", "NAME", "WND"]
# when several reports fall in the same clock hour: routine reports first, SPECI last
REPORT_PRIORITY = {"FM-15": 0, "SY-MT": 1, "FM-12": 2, "SAO": 3, "AUTO": 4, "FM-16": 9}


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0088
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp, dl = p2 - p1, np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(a))


def bearing_deg(lat1, lon1, lat2, lon2):
    """Initial compass bearing from point 1 to point 2."""
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dl = np.radians(lon2 - lon1)
    x = np.sin(dl) * np.cos(p2)
    y = np.cos(p1) * np.sin(p2) - np.sin(p1) * np.cos(p2) * np.cos(dl)
    return float(np.mod(np.degrees(np.arctan2(x, y)), 360.0))


def load_isd_history(path, refresh=False):
    """isd-history.csv (downloaded once into `path`), with numeric lat/lon/elev and dates."""
    path = Path(path)
    if refresh or not path.exists():
        r = requests.get(ISD_HISTORY_URL, timeout=120)
        r.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(r.content)
    h = pd.read_csv(path, dtype=str)
    h["id"] = h.USAF + h.WBAN
    for c, n in (("LAT", "lat"), ("LON", "lon"), ("ELEV(M)", "elev_m")):
        h[n] = pd.to_numeric(h[c], errors="coerce")
    h["begin"] = pd.to_datetime(h.BEGIN, format="%Y%m%d", errors="coerce")
    h["end"] = pd.to_datetime(h.END, format="%Y%m%d", errors="coerce")
    return h[(h.lat.abs() > 0) | (h.lon.abs() > 0)]


def stations_near(history, lat, lon, max_km=150):
    h = history.copy()
    h["distance_km"] = haversine_km(lat, lon, h.lat.values, h.lon.values)
    return h[h.distance_km <= max_km].sort_values("distance_km")


def download_year(sid, year, dest_dir, refresh=False):
    """Download one station-year CSV into dest_dir/<sid>/<year>.csv. Returns the path, or None if the
    file does not exist (HTTP 404). Tries NOAA's Open Data bucket, which NCEI's URL redirects to."""
    out = Path(dest_dir) / sid / f"{year}.csv"
    if out.exists() and out.stat().st_size > 0 and not refresh:
        return out
    out.parent.mkdir(parents=True, exist_ok=True)
    for url in (S3_URL, NCEI_ACCESS_URL):
        r = requests.get(url.format(year=year, sid=sid), timeout=180)
        if r.status_code == 404:
            continue
        r.raise_for_status()
        if r.content.lstrip().startswith(b'"STATION"'):
            out.write_bytes(r.content)
            return out
    return None


def read_years(sid, years, dest_dir):
    """Concatenate the station-year CSVs that exist (download them if missing)."""
    frames = []
    for y in years:
        p = download_year(sid, y, dest_dir)
        if p is not None:
            frames.append(pd.read_csv(p, dtype=str, usecols=lambda c: c in COLS))
    if not frames:
        return pd.DataFrame(columns=COLS)
    return pd.concat(frames, ignore_index=True)


def decode_wind(raw, round_to_knots=True):
    """Parse ISD rows into one row per report with decoded wind.

    Columns added: time (UTC), dir_deg (NaN when missing/variable/calm), type_code, spd_ms (ISD m/s),
    kt (whole knots if round_to_knots), calm, vrb_nodir (variable with no mean direction), qc_bad,
    valid (speed usable: present, not flagged, and either a direction, a calm, or a variable wind).
    """
    d = raw.copy()
    d["REPORT_TYPE"] = d.REPORT_TYPE.str.strip()
    d["time"] = pd.to_datetime(d.DATE, utc=True)
    w = d.WND.str.split(",", expand=True)
    w.columns = ["dir", "dir_q", "type_code", "spd", "spd_q"]
    d = pd.concat([d, w], axis=1)
    d["dir_deg"] = pd.to_numeric(d.dir, errors="coerce").where(lambda s: s <= 360)
    d.loc[d.dir_deg == 360, "dir_deg"] = 0.0
    sp = pd.to_numeric(d.spd, errors="coerce")
    d["spd_ms"] = (sp.where(sp < 9999) / 10.0)
    d["kt_raw"] = d.spd_ms / KT
    d["kt"] = np.round(d.kt_raw) if round_to_knots else d.kt_raw
    d["calm"] = (d.type_code == "C") | (d.spd_ms == 0)
    d["qc_bad"] = d.spd_q.isin(BAD_QC) | (d.dir_q.isin(BAD_QC) & ~d.calm)
    d["vrb_nodir"] = ~d.calm & d.dir_deg.isna() & d.spd_ms.notna() & (d.type_code == "V")
    has_dir = d.dir_deg.notna()
    d["valid"] = d.spd_ms.notna() & ~d.qc_bad & (has_dir | d.calm | d.vrb_nodir)
    d.loc[d.calm, "kt"] = 0.0
    d["priority"] = d.REPORT_TYPE.map(REPORT_PRIORITY).fillna(5)
    return d


def hourly(dec, window_min=10, include_speci=False, synoptic_only=False):
    """One report per UTC clock hour: the valid report nearest the top of the hour within
    +/- window_min minutes, ties broken by report type (METAR, SY-MT, SYNOP, ...). SPECIs are excluded
    unless include_speci (they are event-triggered, often by wind changes, so a biased sample)."""
    d = dec[dec.valid].copy()
    if not include_speci:
        d = d[d.REPORT_TYPE != "FM-16"]
    hr = d.time.dt.round("h")
    d["off_min"] = (d.time - hr).dt.total_seconds().abs() / 60.0
    d["hour"] = hr
    d = d[d.off_min <= window_min]
    if synoptic_only:
        d = d[d.hour.dt.hour % 3 == 0]
    d = d.sort_values(["hour", "off_min", "priority"]).drop_duplicates("hour")
    return d.set_index("hour").sort_index()


def split_directions(kt, dir_from_deg, resolution_deg=10.0, n=10):
    """Spread each report evenly over its reported direction bin (+/- resolution/2).

    Station directions come in whole tens of degrees, and 22.5-degree sectors hold either two or three of
    those values (e.g. the 180 sector, 168.75-191.25, holds 170/180/190 but the 157.5 sector only
    150/160), which distorts a 16-sector rose by up to 50 %. Replicating every report n times at offsets
    spread across its 10-degree bin removes that aliasing. Every report is replicated the same number of
    times, so t = 100 / N and therefore DP are unchanged. Calms and direction-less winds are replicated
    unchanged. Returns (kt, dir) arrays of length n * len(kt)."""
    kt = np.repeat(np.asarray(kt, float), n)
    d = np.asarray(dir_from_deg, float)
    off = (np.arange(n) + 0.5) / n * resolution_deg - resolution_deg / 2
    dd = (d[:, None] + off[None, :]).ravel()
    dd = np.where(np.isfinite(np.repeat(d, n)), np.mod(dd, 360.0), np.nan)
    return kt, dd


def to_uv(kt, dir_from_deg):
    """U, V (m/s, toward east / north) from speed in knots and the FROM direction.

    Calms and direction-less variable winds get direction 0: at or below 12 kt this has no effect on DP
    or RDP (their weight is zero) but the hour still counts as observed time. Callers decide what to do
    with direction-less hours above the threshold (none occur at the stations used here, see notebook).
    """
    sp = np.asarray(kt, float) * KT
    th = np.radians(np.nan_to_num(np.asarray(dir_from_deg, float), nan=0.0))
    return -sp * np.sin(th), -sp * np.cos(th)


# ---------------------------------------------------------------------------------------------------
# Summaries built on dunesight.wind (same definitions as the MERRA-2 analysis)

# The two modes named in the MERRA-2 notes (pipeline/site_notes/*/01_wind.md), by FROM-sector centre.
MODE_SECTORS = {"S (157.5-202.5)": [7, 8, 9], "NW (292.5-315)": [13, 14]}


def mode_shares(rose_from):
    """Share of DP (0-1) from each named mode, and the S / NW ratio."""
    rose_from = np.asarray(rose_from, float)
    tot = rose_from.sum()
    out = {k: float(rose_from[v].sum() / tot) if tot > 0 else float("nan") for k, v in MODE_SECTORS.items()}
    s, nw = out["S (157.5-202.5)"], out["NW (292.5-315)"]
    out["S_over_NW"] = s / nw if nw > 0 else float("nan")
    return out


def summarize(times, u_ms, v_ms, vt=wind.VT_KT):
    """Whole-period Fryberger summary (mean annual, as notebook 01) plus speed and mode statistics."""
    times = pd.DatetimeIndex(times)
    u, v = np.asarray(u_ms, float), np.asarray(v_ms, float)
    rows, per = wind.fryberger_by_year(times.year, u, v, vt)
    kt = wind.speed_kt(u, v)
    out = {k: per[k] for k in ("DP", "RDP", "RDD_deg", "RDP_DP", "dp_class", "n_years")}
    out.update({"pct_hours_above_vt": float(np.mean([r["pct_hours_above_vt"] for r in rows])),
                "mean_kt": float(np.mean(kt)), "p90_kt": float(np.percentile(kt, 90)),
                "p99_kt": float(np.percentile(kt, 99)), "n_hours": int(len(u))})
    out.update(mode_shares(per["rose_from"]))
    out["rose_from"] = per["rose_from"]
    out["yearly"] = rows
    return out


def stratified_by_year(times, u_ms, v_ms, vt=wind.VT_KT):
    """Gap-weighted variant: within each year, DP and the resultant are built from (month, hour-of-day)
    strata, each weighted by its share of that year's calendar hours, so missing hours cannot shift
    weight between seasons or times of day. A stratum with no report in a year takes the all-years
    value of that (month, hour). Returns DP, RDP, RDD and RDP/DP of the mean annual values."""
    times = pd.DatetimeIndex(times)
    df = pd.DataFrame({"y": times.year, "m": times.month, "h": times.hour,
                       "u": np.asarray(u_ms, float), "v": np.asarray(v_ms, float)})
    pooled = {k: wind.fryberger(g.u.values, g.v.values, vt) for k, g in df.groupby(["m", "h"])}
    years = []
    for y, gy in df.groupby("y"):
        cal = pd.date_range(f"{y}-01-01", f"{y + 1}-01-01", freq="h", inclusive="left", tz="UTC")
        share = pd.Series(1.0, index=pd.MultiIndex.from_arrays([cal.month, cal.hour])).groupby(level=[0, 1]).sum() / len(cal)
        have = {k: g for k, g in gy.groupby(["m", "h"])}
        dp = e = n = 0.0
        for k, s in share.items():
            r = wind.fryberger(have[k].u.values, have[k].v.values, vt) if k in have else pooled.get(k)
            if r is None:
                continue
            dp += s * r["DP"]; e += s * r["east"]; n += s * r["north"]
        years.append((dp, e, n))
    dp, e, n = np.mean(years, axis=0)
    rdp = float(np.hypot(e, n))
    return {"DP": float(dp), "RDP": rdp, "RDD_deg": float(np.mod(np.degrees(np.arctan2(e, n)), 360)),
            "RDP_DP": rdp / dp}


def group_contrib(times, u_ms, v_ms, key, vt=wind.VT_KT):
    """Contribution of each group (e.g. month or hour of day) to the mean annual DP, with the group's RDD,
    RDP/DP, % of hours above threshold and mean speed (as in notebook 01's month / hour breakdown)."""
    df = pd.DataFrame({"k": np.asarray(key), "u": np.asarray(u_ms, float), "v": np.asarray(v_ms, float)})
    n_all = len(df)
    rows = []
    for k, g in df.groupby("k"):
        r = wind.fryberger(g.u.values, g.v.values, vt)
        rows.append({"group": k, "DP_contrib": r["DP"] * len(g) / n_all, "RDD_deg": r["RDD_deg"],
                     "RDP_DP": r["RDP_DP"], "pct_hours_above_12kt": r["pct_hours_above_vt"],
                     "mean_kt": float(np.mean(wind.speed_kt(g.u.values, g.v.values))), "n_hours": len(g)})
    return pd.DataFrame(rows).set_index("group")
