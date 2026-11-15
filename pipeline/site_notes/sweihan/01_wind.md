## What the wind numbers can and cannot support

**Result (MERRA-2, native cell centred 24.5 N 55.625 E, 2000–2024, no missing hours):** DP ≈ 70 VU/yr, **low** in Fryberger's classes. RDP ≈ 30 VU/yr, **RDD ≈ 87°** (sand moves toward the east), **RDP/DP ≈ 0.43**. Yearly DP ranges 48–103 VU, yearly RDD 38–173°. Exact values are in the tables above and in `wind_summary.json`.

**Which cell, and why it matters here.** The box centroid (24.465 N, 55.340 E) lies only **2.8 km inside the western edge** of its native cell (55.3125 E). About 77.5 % of the box is in this cell and 22.5 % in the cell to the west (centre 24.5 N, 55.0 E). The cell was confirmed hour-for-hour against NASA POWER at the centroid. At this site the pixel Earth Engine returns at the centroid's own coordinates happens to be the same cell, so the half-cell georeferencing error does not bite here; the western neighbour is the relevant alternative. For 2020–2024 it gives DP 57 vs 63 VU and RDD 98° vs 92°, so the grid choice moves RDD by about 6° and DP by about 9 % at this site.

**Cross-site check:** this is the same native cell that the Seih Al Hama notebook used for its grid sensitivity test (it is the cell north of Seih Al Hama's). Its 2020–2024 values here (DP 62.9, RDD 91.5°, RDP/DP 0.357) are identical to the numbers that test printed, so the two runs read the same data the same way.

**Is the direction plausible?** The regime is **bimodal**, like Seih Al Hama's: about 58 % of DP comes from W–NNW (mostly 292.5°, WNW, 37 %), the daytime north-westerly that peaks 08–13 UTC and drives sand toward 90–125°; about 30 % comes from SSE–SSW (mostly 180°, 14 %), concentrated in the early morning (03–05 UTC) and driving sand north (335–017°). Their vector sum points east. By month, May–June is the most unimodal (RDD 113–118°, RDP/DP 0.74–0.82); February–March drifts toward the NE (50–60°). The yearly RDD swings widely (38–173°; 2007 and 2021 have RDP/DP ≤ 0.14), so only the multi-year value means anything.

**How far to trust it:** the same caveats as at Seih Al Hama. A ~55 × 63 km reanalysis of hourly means damps gusts, so absolute DP is likely biased low and the "low" class is approximate; RDD and RDP/DP are the more robust outputs, with roughly ±10° from the grid alone. The cell extends east to Al Ain city and the box sits at its western edge.

**NASA POWER** (2001–2024, same MERRA-2 source, so a processing check only): DP agrees to 0.002 % and RDD to 0.001° over the period; the worst year differs by 0.02 % / 0.04°. One hour (2004-09-05 17 UTC) differs, the same hour as at Seih Al Hama; it is below threshold in both series.

**For Phase 3:** compare dune headings with RDD (~87°) and with the WNW-mode downwind direction (~110–120°). In a bimodal regime the heading tells us which mode moves the sand; a 20–30° disagreement with RDD would not by itself mean the tracking is wrong.
