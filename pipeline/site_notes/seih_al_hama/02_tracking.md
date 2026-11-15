## Seih Al Hama: what the tracking shows

These are the results of the first run, unchanged when this notebook was made to run for all three sites. The velocity field, dunes, vectors and every table were re-run and found byte-identical.

**Result.**
- Motion is detected in 1,394 of 2,391 valid 480 m windows (58 %). The median detection limit is 0.45 m/yr. Detected speeds have a median of 0.67 m/yr (10-90 %: 0.44-1.14). The field-median heading is 29° (NNE).
- The regime is bimodal (RDP/DP 0.38). The dunes follow the southerly-wind (northward) mode more than the 100° resultant: the heading is 29° from that mode and 71° from the resultant.
- **Landsat 7 long baseline:** 2000-2025 vs 2013-2025, r = 0.88 E and 0.91 N.
- No aliasing, and illumination bias is negligible.
- **HLS S30:** weak agreement (r = 0.37 E, 0.30 N; about half the speed; headings 41° apart). **HLS L30:** better agreement, but it uses the same instruments.
- **NASADEM:** 21 of 124 crest candidates resolved (≥ 14 m high). Classes: 15 stable (below the detection limit), 3 slow, 3 active. No height model was fitted.

**Checks added when the notebook was generalised.**
- **Registration-trend check.** 219 mostly unvegetated stable windows give the same trend as all 990 (0.07 vs 0.06 m/yr toward ~350°, difference 0.018 m/yr), so nothing was added to the uncertainty.
- **Large bodies (section 15b).** 24 bodies are outlined, 25-58 m above a 1.5 km base. Their motion is **not measured**. A known-shift test added on 2026-11-15 showed that the body-scale matcher, on images low-passed to the body scale, returns close to zero shift whatever the true shift. So the earlier "all below the detection limit (point estimates 0.04-0.17 m/yr)" was not a measurement of the bodies and is withdrawn. The small bedforms on the same outlines move 0.55-1.07 m/yr.
- **Independent registration references (section 6b, added 2026-11-15).** 771 of the 990 stable windows are mostly vegetated, so the reference was checked against hard surfaces (paved roads and buildings, vegetation removed). Hard surfaces (1,567 windows) drift 0.10 m/yr toward 358°, the stable ground 0.06 m/yr toward 350°: a difference of 0.048 m/yr. Hard surfaces outside the hand-drawn polygons give 0.053 m/yr. Both are well below the detection limit (0.45 m/yr) and close to the 0.05 m/yr validation tolerance, so the registration is unchanged. In the matcher's known-shift test one degraded 1.3 px case shows 0.07 px bias, against ≤ 0.03 px for shifts ≤ 0.5 px; the real per-image offsets here are below 0.2 px.
