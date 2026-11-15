## Recommendation: November (a proposal; the user confirms the list)

Liwa box L1, the eastern Liwa crescent (Wadhil / Mawsil), **not Liwa town**: it was placed east of 54° E so that it lies on WRS-2 path 160 (row 044), is imaged in the same pass and on the same dates as Seih Al Hama and Sweihan, and is in UTM zone 40. The numbers are in the table above.

**November, 14 of 16 target years**: 2000-11-27, 2001-11-30, 2013-11-07, 2014-11-10, 2015-11-13, 2017-11-02, **2018-11-05**, 2019-11-08, 2020-11-10, 2021-11-13, 2022-11-08, 2023-11-19, 2024-11-13, 2025-11-08. In-box cloud/shadow is 0 % on every OLI pick; the two ETM+ scenes have 0.69 % and 0.47 % (below the 1 % limit; nothing cloud-like is visible, so these are probably CFMask false positives on bright sabkha and slip faces).

Compared with Seih Al Hama's 14 dates: **13 are the same.**
- **2016: missing here.** The common date 2016-11-15 passes every numeric test (0 % QA cloud) but is **rejected by visual QA**: thin, unflagged cloud or haze wisps, bluish-white in true colour, wash out the dune relief over roughly 1.5 × 1.5 km of the small-dune field north of the large farm block (around 23.048 N, 54.149 E). It is the only November 2016 scene on 160/044. Off-month options (not in the list unless confirmed; both looked at, clean): **2016-12-01** (0 % in-box, sun 40.8°, inside November's elevation range; recommended) or 2016-10-30 (0 %, 11 days from target but sun 48.4°, just above the range).
- **2018: an extra year here.** 2018-11-05, which fails at Seih Al Hama (9.9 % QA cloud) and visually at Sweihan, is clean over this box (0 % QA; looked at in B8, true colour and thermal).
- **2021 and 2023 use the common dates** (2021-11-13, 2023-11-19). Without the common-date preference the rule would have taken Landsat 9 scenes closer to 10 November that cannot be used at the row-043 sites (2021-11-08 does not fully cover those boxes; 2023-11-11 is 17–95 % cloudy over them); both passed here, but the shared date was preferred.
- 2002: no Landsat 7 November acquisition. Option: 2002-10-16 (0 %, sun 50.9°, outside the range).

**May, 14 of 16 target years** (plus 2003-05-28 as an optional extra), on Seih Al Hama's dates where both exist.
- **2000**: there is no Landsat 7 scene of 160/044 in May 2000 (as the Phase 1b research found). Option: 2000-06-04 (0 %, 15 days from target).
- **2002-05-09 is rejected by visual QA**: a dark plume about 1.5 km wide runs from the north edge into the NE quarter of the box, dark in B8 and true colour and cold in the thermal band (cloud shadow or a rain/smoke streak). QA_PIXEL flags 0.001 %. It is the only May 2002 scene, and no clean scene lies within 35 days.

**Month comparison:** November's texture is higher in all 13 paired years (median 1.62×; ETM+ 0.080 vs 0.028 in May, the largest gap of the three sites, because the high May sun flattens the small-dune field almost completely; see the zoom). MERRA-2 AOD at acquisition: median 0.22 in November vs 0.32 in May (dust 0.14 vs 0.24). One November pick, 2025-11-08, has a high AOD (0.74) and the lowest November texture (0.065, against a 0.045 haze cut-off); it looks clean by eye, so it is kept.

**Visual QA, all picks looked at** (thumbnail sheet above; larger B8 / true colour / thermal views for 2000-11-27, 2002-05-09, 2016-11-15 (and a 3 km zoom against 2015-11-13 and 2018-11-05), 2018-11-05, 2019-11-08, 2025-11-08, 2016-10-30 and 2016-12-01).

**Surface change to mask in notebook 02:** the large farm block centre-right (~3 × 1.5 km, on former dune ground) is absent on 2000-11-27 and 2001-11-30, its first plots along the E90 are visible on 2002-05-09 and 2003-05-28, and it is at full extent by 2013-11-07. This narrows the Phase 1b dating (2000–2013) to "started between 2001-11-30 and 2002-05-09", from the thumbnails only. More plots are added in the north after 2013.

**Expected tracking result (unchanged from Phase 1b):** the megadunes in the SW are reported to move ~0.1 m/yr (Lorenz et al.), about 2.5 m in 25 years, which is below the detection limit; the small dunes of the NE half are said to move faster, with no published number.

**Recommendation:** November, the common month, with the 2016-12-01 fill-in if the user accepts an off-month scene.
