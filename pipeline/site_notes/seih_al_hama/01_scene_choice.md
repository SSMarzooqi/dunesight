## Recommendation: November (a proposal; the user confirms the list)

These are the numbers from the cells above for this box (WRS-2 160/043, Collection 2 Tier 1):

| | May (target 20 May) | November (target 10 Nov) |
|---|---|---|
| Target years with an accepted scene | **15/16**: 2002 is lost because its only May scene (2002-05-09) fails visual QA. 2003-05-28 is an optional extra. | **14/16**: 2002 has no Landsat 7 acquisition in November. 2018's two scenes are cloudy inside the box (9.9 %, mostly cirrus, and 41 %). |
| Sun elevation across the picks | 66.5-69.0° (spread 2.6°) | 38.6-46.5° (spread 7.9°). The two ETM+ scenes are late November (38.6-39.3°); OLI is 42.1-46.5°. |
| Sun azimuth spread | 8.8° | 2.9° |
| Texture index, median of picks | ETM+ 0.030, OLI 0.051 | ETM+ 0.070, OLI 0.072 |
| Same-year texture, Nov / May | | median **1.52×** (range 1.19-2.27). November is higher in all 14 paired years. |
| MERRA-2 AOD 550 nm at acquisition, picks | median 0.28 (dust 0.22), max 0.66 | median 0.19 (dust 0.11), max 0.51 |
| Rejected as hazy | 2018-05-13 (AOD 1.29, texture 0.010) | none |

**Why November:**
1. **Relief and texture for feature tracking.** Phase correlation needs 15 m-scale contrast. November's low sun casts slip-face shading that May's near-overhead sun does not. Its texture index is about 1.5× higher every year, and 2.3× higher for the Landsat 7 scenes that anchor the 25-year baseline (0.070 vs 0.030). The May ETM+ scenes have the weakest texture in the whole set.
2. **Less dust.** November's MERRA-2 aerosol optical depth at acquisition is about two-thirds of May's, and its dust share is half. A May pick (2018-05-13) had to be rejected for dust that `QA_PIXEL` did not flag.
3. **The baseline is intact.** It runs from 2000-11-27 to 2025-11-08 (24.95 years), with 2001-11-30 as a second early epoch. Losing 2002 and 2018 removes one early epoch and turns 2017→2019 into a two-year pair, which is fine for yearly-rate estimates.

**What it costs, and how notebook 02 has to handle it:**
- **Sun-angle spread is larger** (7.9° vs 2.6°), mostly between the late-November ETM+ scenes and the mid-November OLI scenes. Shadow length scales with cot(elevation): about 1.25 at 38.6° and 1.0 at 45°, so the ETM+ shadows are about 25 % longer. A shading edge can shift slightly with sun angle even when the dune does not move. Because the azimuth is nearly constant (2.9° spread), any such bias has a consistent direction. Notebook 02 must measure it on stable ground and in the residuals of same-sensor OLI pairs, and report it.
- **Two years are missing.** For 2018, the cells above list off-month options; the cleanest close one is 2018-12-07 (0 % in-box cloud, sun 38.6°, inside November's elevation range). It is **not** in the list unless you accept it.

**May remains a valid alternative.** It has one more year and a more uniform sun, but weaker relief and more dust. Both lists are written to `scenes_selected.json`.

**Things this step found that differ from the Phase 1 notes** (which used scene-level STAC cloud):
- November 2018: the scene STAC rated at 0.32 % cloud has **9.9 %** cloud/cirrus/shadow inside the box. November therefore covers 14/16 years, not 15/16.
- May 2002: `QA_PIXEL` (ETM+ CFMask) flags 0 %, but the scene has dark, cool patches over the SW of the box. It is rejected by visual QA, so May covers 15/16 years, not 16/16.
- The scene-level pick for May 2018 (2018-05-29 in Phase 1) is what this rule also picks. The closer-to-target 2018-05-13 is rejected for dust.
- Earth Engine has 5 Landsat 9 scenes that the STAC query did not return. None of them changes a pick: the two from November 2023 are rejected for cloud (2023-11-11, 16.9 %) or lie further from the target date (2023-11-27).
- **Surface change:** the area of the race track looks very different before 2003 (a large dark flat) and from 2013 onwards (the built track and a settlement). Tracking across 2000→2025 there will measure construction, not sand. Notebook 02 has to mask it.
