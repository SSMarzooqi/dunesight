## Liwa: what the tracking shows (written after looking at this run)

**Headline.**
- **Megadune bodies: below the detection limit.** There are 53 large bodies, the largest 60-110 m of relief above a 1.5 km base, including the SW megadunes. 37 could be tracked at body scale. None moves above its detection limit of ~0.95 m/yr. Their point estimates are a uniform 0.68-0.83 m/yr toward ~138°, whatever their size, and real body motion would scale roughly with 1/height. That uniformity says the estimate is the common registration offset described below, not body motion. The published ~0.1 m/yr (Lorenz et al.) is far below what this method can resolve here. The honest statement is "below the detection limit (< ~0.95 m/yr)".
- **Small dunes and bedforms move clearly.** That covers the northern small-dune field, the medium dunes and the bedforms on the megadune flanks. Motion is detected in 3,392 of 3,782 valid windows (90 %). The median is 1.79 m/yr (10-90 %: 1.22-2.62, max 5.8) toward **165° (SSE)**, circular SD 8°. On the megadune outlines themselves, the small bedforms are detected at 1.4-2.6 m/yr. This matches the published picture: the small dunes "migrate southward more rapidly than the draa" (Pugh et al. 1993).

**Caveat on the speeds: the registration may add up to ~0.5 m/yr toward SSE.** The only stable ground here is the walled date-palm farms: 621 coherent windows, 561 of them mostly vegetated, and only 8 with little vegetation. Their per-image offsets drift by 0.50 m/yr toward 335°, which is the anti-sun direction (sun azimuth ~153°). That is what lengthening palm shadows would do. Two independent checks support this reading:
- At Seih Al Hama and Sweihan, vegetated and unvegetated stable windows give the same small trend (≤ 0.1 m/yr).
- Liwa is imaged on the same orbit pass and the same dates as Sweihan. Its offsets drift relative to Sweihan's by +0.38 m/yr N and −0.15 m/yr E, while Sweihan and Seih Al Hama agree to ≤ 0.05 m/yr.

The drift cannot be checked or removed with Liwa's own data (too few unvegetated stable windows). So, by the notebook's rule, it is added as a systematic uncertainty (0.35 m/yr per component). That raises the detection limit from ~0.45 to **0.97 m/yr**. The dune speeds are left as measured, but **they may be overstated by up to ~0.5 m/yr toward SSE**. The heading (165°) is barely affected, because the possible bias points almost the same way. A first run used a 185 km² OSM nature reserve as "stable ground". It covered live dunes and drove the per-image offsets 10 m south over 12 years. That run was discarded, and OSM nature reserves are no longer treated as non-dune at any site.

**Masks.** 41 % of the box is masked: hand-drawn 40 %, NDVI 14 %, OSM 19 %, WorldCover 6 %, with overlaps. The 13 hand-drawn polygons cover every farm cluster as the union of its 2000, 2013 and 2025 extent, including the ~3 × 1.5 km block built on dunes between 2001 and 2013 (M9), plus two structures added after 2013. Ten established farm polygons may still serve as stable ground (`stable_ground: allowed`). Megadunes, sabkha flats and the small-dune field are not masked. No implausible motion shows at the mask edges.

**Is it real?**
- Displacement grows with time: 1.61 m/yr × dt, intercept +1.5 m. Stable ground stays flat (−0.02 m/yr).
- Short- and long-baseline velocities agree less well than at the other sites (r = 0.69 E, 0.75 N). The long pairs give 0.32 m/yr more southward motion, which is consistent with a registration trend.
- No aliasing: the 12-year p99 displacement is 46 m against a spacing of 85-115 m.
- Illumination bias is negligible (0.006 m/yr).
- Year-to-year field-median rates (0.76-2.92 m/yr) are above the dune noise (p = 0.003). They correlate with MERRA-2 drift along the dune direction (r = 0.80, p = 0.005), the strongest wind link of the three sites.
- **Landsat 7 long baseline:** 2000-2025 vs 2013-2025, r = 0.62 E and 0.75 N; median speed 1.56 vs 1.72 m/yr.

**Wind.** The field heading of 165° is 20° from the resultant drift direction (145°) and 8° from the strongest sand-moving mode (toward 158°). The regime is close to unimodal (RDP/DP 0.59), and 99.6 % of windows lie within 45° of the resultant. This matches the published south-south-eastward migration.

**Second datasets.**
- **HLS S30 (Sentinel-2, independent):** 1.01 vs 1.66 m/yr, headings 8° apart (170° vs 163°), r = 0.42 E, 0.73 N; motion detected in 73 % of windows. HLS registers on the same farms, so S30 shares the possible palm-shadow bias and is not an independent check of it.
- **HLS L30 (same instruments):** 1.16 vs 1.74 m/yr, heading 1.4° apart, r = 0.44 E, 0.72 N.

**HLS tile and UTM zone.** The box (54.08-54.18° E) is inside UTM zone 40. It is processed in EPSG:32640, and HLS comes from tile T40QBL in its native zone-40 grid, with no reprojection. Every HLS scene used covered the box fully: more than 99.9 % valid pixels and less than 1 % Fmask cloud. The T39QZF tile, which also covers the box but in zone 39, is excluded by the tile filter.

**NASADEM.** Noise is 2.5 m. At bedform scale (300 m base), 17 of 84 candidates are resolved, 13-31 m high, 2-22 ha. These are medium dunes, mostly in the northern field, not megadunes. All 17 are detected: 9 slow and 8 active, at 1.2-2.4 m/yr toward 158-172°. Those numbers are bedform speeds around each outline and carry the registration caveat. The megadunes appear only at draa scale (section 15b), where they are below the detection limit. The speed-versus-height model is not supported (ρ = −0.11), so there is no gap fill.
