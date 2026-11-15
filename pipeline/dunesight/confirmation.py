"""How well is each site's headline speed and heading confirmed by an independent check?

Built by notebook 03 from notebook 02's QC summary (02_qc_summary.json), so nothing here is typed by hand.
The result is written to summary.json as `confirmation` and drives the one-line status in the app's headline
panel and the table in the dossier.

Checks, from most to least independent:
  hls_s30   HLS S30 (Sentinel-2 MSI): another satellite, sensor and geolocation; 30 m red band; same years as
            the Landsat 8/9 network from 2016. The only fully independent check.
  landsat7  Landsat 7 ETM+ long baseline (2000/2001 -> 2025): another instrument and 12-13 more years, but the
            same Landsat processing, the same registration reference and the same end scenes. Partly independent:
            it cannot reveal a bias of the registration reference.
  hls_l30   HLS L30: the same Landsat 8/9 instruments (red band, 30 m, HLS processing). Not independent; shown
            for context only and never counted as confirmation.

Rules (fixed tolerances, stated in the output):
  speed agrees    the check's field-median speed is within SPEED_TOL (15 %) of Landsat's over the same windows/years
  heading agrees  the field-median headings differ by at most HEADING_TOL_DEG (20 deg)
  Landsat 7 carries no field heading, so for heading it counts only through its per-window correlation of the
  east and north components (both >= L7_CORR_MIN, 0.8).

Status per quantity:
  confirmed            the independent check (HLS S30) agrees
  partly_confirmed     HLS S30 does not agree, the partly independent Landsat 7 check does
  not_confirmed        neither agrees
Standard library only.
"""

SPEED_TOL = 0.15
HEADING_TOL_DEG = 20.0
L7_CORR_MIN = 0.8

RULE = (f"speed agrees if a check's field-median speed is within {SPEED_TOL:.0%} of Landsat's over the same windows and years; "
        f"heading agrees if the field-median headings differ by <= {HEADING_TOL_DEG:.0f} deg (Landsat 7: per-window east and north "
        f"correlations both >= {L7_CORR_MIN}). confirmed = the independent Sentinel-2 check (HLS S30) agrees; partly_confirmed = only "
        "the partly independent Landsat 7 long baseline agrees; not_confirmed = neither. HLS L30 uses the same Landsat 8/9 "
        "instruments and is shown for context only.")


def _angle(a, b):
    d = abs((a - b) % 360.0)
    return min(d, 360.0 - d)


def _r(x, n=3):
    return None if x is None else round(float(x), n)


def build(qc):
    hls = qc.get("hls_second_dataset") or {}
    l7 = qc.get("landsat7_long_baseline") or {}
    checks = []

    def hls_check(key, cid, name, independence):
        h = hls.get(key)
        if not h:
            return None
        sp_c, sp_l = h.get("field_median_speed_hls_myr"), h.get("field_median_speed_landsat_myr")
        hd_c, hd_l = h.get("field_median_heading_hls_deg"), h.get("field_median_heading_landsat_deg")
        ratio = sp_c / sp_l if sp_c is not None and sp_l else None
        hdiff = _angle(hd_c, hd_l) if hd_c is not None and hd_l is not None else None
        return {"id": cid, "name": name, "independence": independence, "period": h.get("years"),
                "speed_check_myr": _r(sp_c), "speed_landsat_myr": _r(sp_l), "speed_ratio": _r(ratio),
                "heading_check_deg": _r(hd_c, 1), "heading_landsat_deg": _r(hd_l, 1), "heading_diff_deg": _r(hdiff, 1),
                "corr_E": h.get("corr_E"), "corr_N": h.get("corr_N"),
                "detection_limit_myr": h.get("hls_detection_limit_median_myr"), "pct_windows_detected": h.get("hls_pct_valid_windows_detected"),
                "speed_agrees": None if ratio is None else abs(ratio - 1) <= SPEED_TOL,
                "heading_agrees": None if hdiff is None else hdiff <= HEADING_TOL_DEG}

    s30 = hls_check("HLSS30", "hls_s30", "HLS S30 (Sentinel-2 MSI, 30 m red)", "independent: another satellite, sensor and geolocation")
    if s30:
        checks.append(s30)
    l7c = None
    if l7.get("median_speed_2000_2025_detected_myr") is not None:
        sp_c, sp_l = l7["median_speed_2000_2025_detected_myr"], l7["median_speed_2013_2025_same_windows_myr"]
        ratio = sp_c / sp_l if sp_l else None
        cE, cN = (l7.get("corr_2000_2025_vs_2013_2025_E_N") or [None, None])[:2]
        corr_ok = cE is not None and cN is not None and cE >= L7_CORR_MIN and cN >= L7_CORR_MIN
        l7c = {"id": "landsat7", "name": "Landsat 7 ETM+ long baseline (2000/2001 to 2025)",
               "independence": "partly independent: another instrument and 12-13 more years, but the same Landsat processing, registration reference and end scenes",
               "period": "2000-11 to 2025-11 vs 2013-11 to 2025-11, same windows",
               "speed_check_myr": _r(sp_c), "speed_landsat_myr": _r(sp_l), "speed_ratio": _r(ratio),
               "heading_check_deg": None, "heading_landsat_deg": None, "heading_diff_deg": None,
               "corr_E": cE, "corr_N": cN, "median_diff_E_N_myr": l7.get("median_diff_E_N_myr"),
               "n_windows": l7.get("detected_windows_with_2000_position"),
               "speed_agrees": None if ratio is None else abs(ratio - 1) <= SPEED_TOL,
               "heading_agrees": corr_ok}
        checks.append(l7c)
    l30 = hls_check("HLSL30", "hls_l30", "HLS L30 (Landsat 8/9 OLI, 30 m red)", "not independent: the same Landsat 8/9 instruments")
    if l30:
        l30["context_only"] = True
        checks.append(l30)

    def status(qty):
        k = f"{qty}_agrees"
        if s30 and s30[k]:
            return "confirmed"
        if l7c and l7c[k]:
            return "partly_confirmed"
        return "not_confirmed"

    def pct(r):
        return f"{(r - 1) * 100:+.0f} %"

    # Short lines for the headline panel (numbers only from the checks above).
    sp = []
    if l7c and l7c["speed_ratio"] is not None:
        sp.append(f"Landsat 7 2000-2025 {'agrees' if l7c['speed_agrees'] else 'differs'} ({pct(l7c['speed_ratio'])})")
    if s30 and s30["speed_ratio"] is not None:
        sp.append(f"Sentinel-2 {'agrees' if s30['speed_agrees'] else 'gives'} {s30['speed_ratio']:.2f}×")
    hd = []
    if s30 and s30["heading_diff_deg"] is not None:
        hd.append(f"Sentinel-2 {'within' if s30['heading_agrees'] else ''} {s30['heading_diff_deg']:.0f}°{'' if s30['heading_agrees'] else ' off'}".replace("  ", " "))
    if l7c and not (s30 and s30["heading_agrees"]):
        hd.append(f"Landsat 7 per-window r {l7c['corr_E']:.2f} E / {l7c['corr_N']:.2f} N")
    return {
        "rule": RULE,
        "speed": {"status": status("speed"), "short": "; ".join(sp)},
        "heading": {"status": status("heading"), "short": "; ".join(hd)},
        "checks": checks,
        "generated_from": "notebook 02 QC summary: hls_second_dataset, landsat7_long_baseline",
    }
