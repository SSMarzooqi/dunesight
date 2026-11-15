## Recommendation: November (a proposal; the user confirms the list)

Sweihan box S1 (WRS-2 160/043, the same Landsat scenes as Seih Al Hama, but a different 10 km box ~45 km further north). The numbers are in the table above.

**November, 14 of 16 target years**, on **exactly the same 14 dates as Seih Al Hama**: 2000-11-27, 2001-11-30, 2013-11-07, 2014-11-10, 2015-11-13, 2016-11-15, 2017-11-02, 2019-11-08, 2020-11-10, 2021-11-13, 2022-11-08, 2023-11-19, 2024-11-13, 2025-11-08. In-box cloud/shadow is ≤ 0.24 % on every pick (the two ETM+ scenes 0.19 % and 0.24 %, all OLI ≤ 0.09 %).
- **2002**: no Landsat 7 acquisition in November (same as every path-160 site).
- **2018**: the only scene that passes the numeric tests, 2018-11-05 (0 % in-box QA cloud), is **rejected by visual QA**: a diffuse darker patch over the northern dune belt in B8 and cool patches in the thermal band over the northern belt and much of the SW belt, which other November scenes do not have (thin cloud shadow or rain-wetted sand). The same scene has 9.9 % QA cloud/cirrus over Seih Al Hama, so the weather that day was not clean. 2018-11-21 has 77 % in-box cloud. So 2018 is missing here too, which keeps the three-site design on identical dates. Off-month options (not in the list unless confirmed): **2018-12-07** (0.09 % in-box, sun 38.6°, inside November's elevation range, and the same fill-in date as Seih Al Hama; looked at, clean) or 2018-10-20 (0 %, but sun 50.3°, outside the range).

**Same picture as at Seih Al Hama on the month choice:** November's texture index is higher in all 14 paired years (median 1.36×, ETM+ 0.075 vs 0.043 in May), and MERRA-2 AOD at acquisition is lower (median 0.19 vs 0.28; dust 0.09 vs 0.21). The sun-elevation spread is the same 7.9° (38.6–46.5°) because the dates are the same.

**May, 16 of 16 target years** (plus 2003-05-28 as an optional extra). It differs from Seih Al Hama's May list in two years:
- **2002-05-09 is accepted here.** At Seih Al Hama it was rejected visually for dark, cool patches in the SW of that box; those patches do not reach the Sweihan box (looked at in B8, true colour and thermal: clean).
- **2023: 2023-05-27 instead of 2023-05-19.** The 2023-05-19 scene (Seih Al Hama's pick) fails the haze test here: B8 texture 0.021, below half the May OLI median (0.061). 2023-05-27 is clean.
- 2022-05-16 passes but is the flattest OLI May pick (texture 0.037); it looks washed out but usable.

**Visual QA, all picks looked at** (thumbnail sheet above; larger B8 / true colour / thermal views for 2002-05-09, 2018-11-05, 2019-11-08, 2022-05-16, 2022-11-08, 2018-10-20 and 2018-12-07):
- Rejected: 2018-11-05 (above).
- Kept with a note: **2022-11-08** has one small dark blob (~300 m) in the northern dune belt near the top centre of the box, also slightly cool in thermal: most likely the shadow of a small cumulus (QA flags 0.001 %). It covers well under 1 % of the box. Notebook 02 should mask it (or the user can swap in 2022-11-16, which passed but breaks the common date).

**Surface change to mask in notebook 02** (visible in the thumbnails, as described in the Phase 1b note): the SE farm grid is active in 2000–2003 and faded/sand-covered from 2013; the housing grid west of the junction is absent in 2013–2017, a levelled plot in 2018 and a street grid from 2019 onwards; a levelled rectangle north of the E16 (bright in the 2024 zoom) and further building in the military compound.

**Recommendation:** November, for the same reasons as at Seih Al Hama, and because it gives identical dates at both 160/043 sites.
