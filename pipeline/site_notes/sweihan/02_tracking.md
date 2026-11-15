## Sweihan: what the tracking shows (written after looking at this run)

**Result.** The dunes move, clearly and coherently. Motion is detected in 1,762 of 2,045 valid 480 m windows (86 %). The median detection limit is 0.365 m/yr (0.36 in summary.json). Detected speeds have a median of 1.15 m/yr (10-90 %: 0.55-1.82; max 3.9). The field moves toward **83°, i.e. east**, with a circular SD of 18°. No published rate exists for Sweihan, so this is the first number for this field. Treat it as 2013-2025 bedform migration, not a long-term rate for the large ridges.

**Masks.** The masked share of the box is 63 %: hand-drawn 53 %, OSM 40 %, NDVI 10 %, WorldCover 11 %, with overlaps. The 13 hand-drawn polygons, each with its reason, are in `site_config/sweihan/manual_masks.geojson`. They cover:
- the NW settlement and the realigned E20;
- the levelled enclosure north of the E16;
- the graded strip inside the northern belt;
- the housing grid west of the junction;
- the military compound and its new plots, and a new NE-corner compound;
- the farm corridor east of the town;
- the abandoned SE farm grid (a sand-encroachment target for notebook 03, not a tracking area);
- a water-tank site and two southern compounds;
- the graded flat at the SW belt's toe (M13).

M13 was added after the first runs. Windows centred on that flat moved 2-8 m/yr toward the NE with low match quality (0.2-0.3), while the rest of the belt moved ~1 m/yr toward the east. The 2025 image shows new bright graded patches there. One per-scene mask (`scene_masks.geojson`) removes a cluster of small cumulus shadows over the northern belt on 2022-11-08 (3.3 % of the box in that scene only). A few arrows at the town's southern edge point north, where dunes meet farm fences. I left them unmasked: masking would remove ~1 km² of real, encroaching dunes.

**Noise and registration.** There are 316 coherent stable-ground windows: farms, the town strip and compounds. The pair residual NMAD is 1.26 m (E) and 1.03 m (N). Held-out stable ground "moves" 0.12 m/yr at the median and 0.34 m/yr at the 95th percentile. The error inflation factor is 2.38. The registration-trend check passed: 271 unvegetated stable windows give the same trend as all 316 (difference 0.011 m/yr), so nothing was added.

**Is it real?**
- Displacement grows linearly with time separation: 1.11 m/yr × dt, intercept +0.41 m. Stable ground stays flat (−0.02 m/yr).
- Short- and long-baseline velocities agree (r = 0.87 E, 0.92 N).
- The largest 12-year displacement (32 m) is a third of the dominant spacing (73-99 m), and 0.02 % of long-pair residuals exceed half the small-dune spacing. There is no sign of aliasing.
- Illumination bias is negligible: 0.003 m/yr at field level, 0.008 m/yr for the 95th-percentile window.
- **Landsat 7 (2000/2001) long baseline:** 2000-2025 velocities agree with 2013-2025 (r = 0.87 E, 0.89 N). The median speed is 1.18 vs 1.15 m/yr. So the motion has been steady for 25 years.

**Wind.** The field heading of 83° is within 4° of the MERRA-2 resultant drift direction, 87°. 96 % of detected windows lie within 45° of it. The regime is bimodal (RDP/DP 0.43), but the dunes follow the resultant rather than either mode (the NW mode points toward 112°, the southerly mode toward 0°). Year-to-year field-median rates range 0.36-1.84 m/yr but are not above the dune-specific noise (p = 0.19). The correlation with MERRA-2 drift is r = 0.49, which is not significant.

**Second datasets.**
- **HLS S30 (Sentinel-2, independent):** the heading agrees (field median 86° vs 80°, 6° apart). The speed is about half of Landsat's (0.56 vs 1.01 m/yr), and per-window agreement is weak (r = 0.43 E, 0.37 N). Its own detection limit is 0.91 m/yr, so it detects motion in only 31 % of windows.
- **HLS L30 (same Landsat instruments, not independent):** 0.94 vs 1.08 m/yr, headings 4.5° apart, r = 0.74 E, 0.55 N.
- The pattern matches Seih Al Hama: the coarser 30 m data agree on direction and give lower speeds.

**NASADEM.** Noise is 2.3 m. 12 of 113 crest candidates are resolved, 13-45 m high, with outlines of 1.6-7.9 ha. They are the larger ridges of the two belts. Classes: 7 slow, 3 active, 2 stable (below the detection limit). Speeds come from windows around each outline, so they describe the small bedforms on and around each ridge. The speed-versus-height model is not supported (ρ = −0.36, p = 0.31), so there is no gap fill.

**Large bodies (section 15b).** 13 large bodies are outlined (21-77 m above a 1.5 km base). Their motion is **not measured**. A known-shift test added on 2026-11-15 showed that the body-scale matcher, run on images low-passed to the body scale, does not recover known shifts: it returns close to zero shift. The earlier body speeds (0.19-0.28 m/yr toward ~90-103°, four marginally detected) were therefore not body motion. They were the per-image registration offsets mirrored, mainly the Landsat 7 offset of ~+3.6 m east over the 13 years to 2013. That earlier "large ridges move about a fifth as fast as their bedforms" reading is withdrawn. The bedforms on those outlines still move 0.6-1.25 m/yr; how fast the ridges themselves move is not known from these data.

**Limits.** The tracking box is 63 % masked, so roughly a third of it is measured. The masks are drawn by hand from three dates and may miss small changes. The figures are 480 m-window velocities over 2013-2025.

**Independent registration references (section 6b, added 2026-11-15).** 271 of the 316 stable windows are mostly unvegetated. Hard surfaces (880 windows) drift 0.04 m/yr and those outside the hand-drawn polygons (261) 0.07 m/yr, against 0.09 m/yr for the stable ground: differences of 0.047 and 0.035 m/yr, far below the detection limit (0.37 m/yr). The registration is unchanged.
