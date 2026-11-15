# How we know

This file has three parts: the panel text that opens the app's "How we know" dossier (the app reads it from this file, between the markers, so the two cannot drift apart); the limits and data handling for each site; and where every number comes from.

## Panel text (shown in the app)

<!-- panel:start -->
DuneSight measures how far sand patterns moved between November Landsat 8/9 panchromatic images (15 m pixels, 2013 to 2025), comparing every pair of years in overlapping 480 m windows.

Ground that should not move (roads, bare ground away from trees) sets the uncertainty. Motion counts only where it is clearly larger; slower places are shown as "below detection limit", never as zero.

Each speed is checked against Landsat 7 images from 2000-2001 and Sentinel-2 images processed by NASA's HLS project. The line under the headline speed says which checks agree.

Large dunes are outlined from NASA's NASADEM elevation model (February 2000). Wind drift comes from NASA's MERRA-2 reanalysis, with a weather-station check where one is close enough.

The projection carries the measured motion forward to 2050. It does not model dunes changing shape, windbreaks, levelling or climate change. Results hold only for these three boxes and this period.
<!-- panel:end -->

(148 words.)

## Reading the numbers

- **Speeds are of the moving windows only.** "Median 0.67 m/yr" means: of the 480 m windows whose motion is above the detection limit, half move faster and half slower. Windows below the limit are counted separately and have no direction.
- **Ranges, not single values.** Every speed is given with its 10-90 % spread across the field and a 1σ uncertainty per window. Reach years are a fast-case to slow-case range (speed ± 1σ, distance ± the sand-edge and outline uncertainty).
- **Cross-checks.** `summary.json` → `confirmation` states for speed and for heading whether an independent check agrees, by a fixed rule: speeds within 15 % and headings within 20° count as agreement. Sentinel-2 (HLS S30) is the independent check; the Landsat 7 long baseline is only partly independent (another instrument and more years, but the same Landsat processing and registration); HLS L30 uses the same Landsat 8/9 instruments and is context only. The tolerances were set while writing this check, after the QC numbers were known; the numbers themselves are shown next to every status so a reader can apply a different tolerance.

## Per site

All numbers below were read from `public/data/<site>/summary.json`, `wind_summary.json`, `station_wind.json` (Seih Al Hama only) and `pipeline/outputs/<site>/02_qc_summary.json` on 2026-11-15. Motion period for every site: Landsat 8/9 scenes 2013-11-07 to 2025-11-08 (12.0 years); Landsat 7 scenes 2000-11-27 and 2001-11-30 for the long-baseline check.

### Seih Al Hama (SW of Al Ain; box W 55.475, S 24.015, E 55.575, N 24.105)

**What it shows.** Where motion is detected (58.3 % of 2,391 valid dune windows), sand moves a median **0.67 m/yr** (10-90 %: 0.44-1.14; fastest window 2.86 m/yr), about 15-30 m in 25 years. The detection limit is 0.45 m/yr (median; 0.30-0.83 across windows, 5-95 %) and the per-window uncertainty a median ± 0.19 m/yr (1σ per component). The field heading is NNE (field median 29°), with the northern part moving N to NE and the southern belt E.

**How sure.**
- Speed: partly confirmed. The Landsat 7 long baseline (2000-2025, 1,260 windows) gives 0.68 m/yr against 0.65 m/yr for 2013-2025 in the same windows (+5 %). Sentinel-2 (HLS S30, 2016-2025) gives 0.52 × the Landsat speed (0.22 vs 0.41 m/yr field median), with a detection limit at 30 m (0.85 m/yr) above most measured speeds.
- Heading: partly confirmed. Sentinel-2's field heading is 41° from Landsat's; the Landsat 7 long baseline correlates with 2013-2025 window by window (r 0.88 east, 0.91 north). HLS L30 (same instruments) is within 1° but is not independent.
- Wind: MERRA-2 (2000-2024) gives a resultant drift toward 100°, 71° from the dunes. The station check (Al Ain International, 24 km NNE, 2000-2024, 89-100 % of hours reported) gives a drift toward 9°, 20° from the dunes, because southerly winds supply 55 % of its drift potential against 30 % in MERRA-2. A second station (Buraimi, 32 km) agrees on the direction. The station's own drift potential is 132 VU/yr, still low; a 5 % anemometer speed error moves it by -27 % / +34 %. It does not explain the southern belt moving east. The station is evidence about the regional wind, not a measurement in the dune field.

**Limits.** The full list is `limits` in `summary.json` and is shown in the dossier. In short: speeds are slow, so a 15 m pixel is about 20 years of motion and reach years for targets close to sand carry a ± 7.5 m edge uncertainty; reach is dune migration, not blowing sand; the projection is advection only; 21 large dunes (14-72 m high) are outlined from NASADEM, the rest of the motion is in small dunes (spacing about 73-85 m) represented by the 480 m windows; the motion of large dune bodies is not measured; the published UAEU thesis value (3.32 m, no stated time base) is context only.

**Targets.** 1,158 targets (1,085 road segments, 66 farms, 7 built-up areas): 76 have migrating sand at the edge now, 97 are reached by 2050 in the fast case (including those 76), 117 by 2100. By 2050 the moving sand shifts a median 13.6 m (90th percentile 23.4 m) in the median case.

**Data handling.** 9 November candidate scenes rejected (cloud, shadow, haze, coverage). 1.08 % of dune windows had too few valid pairs; 3.32 % of window-pair observations were rejected (weak match, displacement beyond the reliable range, network outliers). Registration on stable ground (990 windows); its unvegetated subset differs by 0.018 m/yr, so no systematic term was added.

### Sweihan (NW of Al Ain; box W 55.29, S 24.42, E 55.39, N 24.51)

**What it shows.** Where motion is detected (86.2 % of 2,045 valid dune windows), sand moves a median **1.15 m/yr** (10-90 %: 0.55-1.82; fastest 3.87 m/yr) toward the east (field median 83°). Detection limit 0.36 m/yr (0.24-0.61 across windows); uncertainty ± 0.15 m/yr (1σ).

**How sure.**
- Speed: partly confirmed. Landsat 7 long baseline 1.18 vs 1.15 m/yr in the same windows (+3 %). Sentinel-2 gives 0.56 × (0.56 vs 1.01 m/yr), with a 30 m detection limit (0.91 m/yr) close to most measured speeds.
- Heading: confirmed. Sentinel-2's field heading is within 6° of Landsat's.
- Wind: MERRA-2's resultant drift (87°) is 4° from the dune heading, so there is no difference to explain. No station result is published for Sweihan: the nearest hourly station (Al Ain International, 35 km SE) drives sand toward the north, while Al Maktoum International (50 km NNW, near the coast) gives MERRA-2's direction; the two disagree by 97° at shared hours, so neither stands for the site. Both stations do show about twice MERRA-2's drift potential, so MERRA-2's absolute DP (70.2 VU/yr, low) is probably biased low here too.

**Limits.** 12 large dunes (13-45 m high) are outlined; the motion of the large ridge bodies is not measured; about 63 % of the box is masked as non-dune or changed ground; no published migration rate exists for Sweihan; "built-up" includes large zoned residential areas.

**Targets.** 873 targets (735 road segments, 59 farms, 79 built-up areas): 18 sand at edge now, 24 reached by 2050, 24 by 2100. By 2050 moving sand shifts a median 27.0 m (90th percentile 39.7 m).

**Data handling.** 8 candidate scenes rejected; 2.53 % of dune windows too few valid pairs; 5.76 % of window-pair observations rejected. Registration on stable ground (316 windows); its unvegetated subset differs by 0.011 m/yr, so no systematic term was added.

### Liwa (eastern crescent, Wadhil / Mawsil; box W 54.08, S 23.00, E 54.18, N 23.09)

**What it shows.** Where motion is detected (93.1 % of 3,782 valid dune windows), the small dunes and bedforms move a median **1.41 m/yr** (10-90 %: 0.79-2.25; fastest 5.40 m/yr) toward the south-south-east (field median 166°). Detection limit 0.49 m/yr (0.38-0.75 across windows); uncertainty ± 0.20 m/yr (1σ). The 50-80 m megadunes themselves are **not measured**: the body-scale matcher failed its known-shift test, so no body speed is given.

**How sure.**
- Speed: **not confirmed.** Sentinel-2 gives 0.35 × the Landsat speed (0.47 vs 1.31 m/yr), and HLS L30 (same instruments) 0.41 × (0.57 vs 1.38 m/yr), although at the other two sites L30 agrees with Landsat within about 0.1 m/yr. The Landsat 7 long baseline gives 1.08 vs 1.34 m/yr in the same windows (-19 %), and it shares the registration reference, so it cannot test that reference. The cause of the gap is not known.
- Heading: confirmed. Sentinel-2's field heading is within 8° of Landsat's.
- Registration: the date-palm canopy used before drifts with the sun angle and is no longer used. Speeds are measured against the mean of two canopy-free references (roads and buildings outside the farms; bare ground inside the farms), which give 1.50 and 1.33 m/yr; half their difference (0.10 m/yr per component) is in the uncertainty and the detection limit. See `pipeline/site_notes/liwa/02_registration_reference.md`.
- Wind: MERRA-2's drift (145°) is 21° from the dune heading. No usable weather station lies within 100 km, so MERRA-2 is unchecked here.

**Limits.** 17 dunes (13-31 m high) are outlined at bedform scale, not megadunes; the published ~0.1 m/yr for the megadunes is far below what this method resolves; many farm edges are walled; the box is the eastern Liwa crescent, not Liwa town.

**Targets.** 754 targets (533 road segments, 89 farms, 132 built-up areas): 14 sand at edge now, 35 reached by 2050, 45 by 2100. By 2050 moving sand shifts a median 34.2 m (90th percentile 47.6 m). Because the speed magnitude is not confirmed, these reach years carry an extra, unquantified uncertainty: if the lower Sentinel-2 speed were right, sand would arrive later.

**Data handling.** 4 candidate scenes rejected; 0.63 % of dune windows too few valid pairs; 4.14 % of window-pair observations rejected.

## Data handling common to all sites

- **Clouds and shadows:** Landsat `QA_PIXEL` bits 0-4 (fill, dilated cloud, cirrus, cloud, shadow), dilated by one pixel; HLS Fmask bits 1-3. Scenes with more than 1 % cloud or shadow inside the box were rejected in notebook 01 and logged in `pipeline/outputs/<site>/scene_rejections.csv`.
- **Landsat 7** is used only before the 31 May 2003 scan-line-corrector failure (scenes of 2000 and 2001), and only for the long-baseline check and the timeline frames.
- **No-data:** a window-pair is dropped when more than 40 % of the window is masked.
- **Low-correlation rejection:** a match is kept only if its correlation peak beats the 99th percentile of matches between unrelated windows; displacements beyond the reliable range and network outliers are also dropped. The percentages are given per site above.
- **Non-dune ground** (vegetation, ESA WorldCover classes, OpenStreetMap features, hand-drawn change areas with reasons in `pipeline/site_config/<site>/`) is excluded from the dune statistics.

## Where the numbers come from

| Number | File and field |
|---|---|
| Speeds, detection limit, uncertainty, share detected | `public/data/<site>/summary.json`: `speed_*`, `detection_limit_myr`, `uncertainty_myr`, `speed_note` |
| Spread of the detection limit, fastest window, heading | `pipeline/outputs/<site>/02_qc_summary.json`: `noise_and_detection`, `velocity_summary`, `physics` |
| Cross-checks | `summary.json`: `confirmation` (from `02_qc_summary.json`: `hls_second_dataset`, `landsat7_long_baseline`) |
| Wind | `wind_summary.json`; station: `public/data/seih_al_hama/station_wind.json`, `pipeline/outputs/<site>/station_wind_check.json` |
| Targets and 2050 shift | `summary.json`: `threat`, `frames` |
| Data handling | `summary.json`: `data_handling` |
