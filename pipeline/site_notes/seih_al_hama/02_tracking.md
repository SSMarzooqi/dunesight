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
- **Large bodies (section 15b).** 24 bodies are outlined, 25-58 m above a 1.5 km base. Eight could be tracked at body scale. All are below the detection limit (~0.21 m/yr), with point estimates of 0.04-0.17 m/yr. The small bedforms on the same outlines move 0.55-1.07 m/yr. As at Sweihan, the large dune bodies move several times more slowly than the bedforms riding over them.
