## Liwa: what the tracking shows (rewritten 2026-11-15 for the registration-reference test)

**Headline.**
- **Small dunes and bedforms move toward the SSE; the speed is known to about ±0.1 m/yr from the reference.**
  - Motion is detected in 3,521 of 3,782 valid 480 m windows (93 %). The median detection limit is 0.49 m/yr.
  - Detected speeds have a median of **1.41 m/yr** (10-90 %: 0.79-2.25, max 5.4) toward **166°**, with a circular SD of 11°.
  - The speeds are relative to the mean of two canopy-free references (below). Against either one alone, the median is **1.33 m/yr** (bare ground in farms) or **1.50 m/yr** (roads and buildings outside the farms). The heading is 164-167° under either.
  - The previous run registered on the date-palm farms and gave 1.79 m/yr. That reference is shown to drift and is not used.
- **Megadune bodies are not measured.**
  - The body-scale matcher (960 m windows on images low-passed to the body scale) failed a known-shift test. It returns about zero shift whatever the true shift (0.02-0.19 px recovered for shifts of 0.3-1.0 px).
  - The previous "uniform 0.68-0.83 m/yr toward ~138°" was therefore the registration offsets mirrored, mostly the Landsat 7 offset, not the bodies.
  - With the reference itself uncertain by ±0.10 m/yr, the published ~0.1 m/yr (Lorenz et al.) is below what this method can resolve here.

**Registration reference** (details and the plan written before the results: `02_registration_reference.md`).
- **The farms drift.**
  - The farm stable ground drifts 0.50 m/yr toward 335°, and the canopy within it 0.49 m/yr.
  - Against bare ground in the same farms, the canopy drifts 0.45 m/yr toward 348°, near the anti-sun direction (333°).
  - On the weeks-apart illumination pairs, the canopy shifts toward the anti-sun direction as the sun gets lower, by −0.066 m/deg (95 % CI −0.079 to −0.053). Bare ground does not shift (−0.006, CI −0.016 to +0.005).
- **Against expectation:**
  - Within the farm windows the drift does not depend on vegetation fraction or NDVI change (ρ ≈ 0.1, flat terciles).
  - The farms did not green from 2013 to 2025 (median NDVI change −0.02).
  - Hard surfaces as a whole (401 windows, three quarters of them inside the farm zones) drift almost like the canopy (0.40 m/yr).
  - The canopy is an unstable reference, but the mechanism is not pinned down.
- **The two canopy-free references:**
  - Hard surfaces outside the farm polygons: 99 windows in 9 clusters, 0.23 m/yr toward 338°.
  - Bare ground in the farms: 2,391 windows, 0.11 m/yr toward 274°.
  - They differ by 0.21 m/yr, more than the 0.1 m/yr tolerance set in advance. So no reference was shown stable, and the result is reported as a bracket. The registration is their mean, and half their difference (0.104 m/yr per component) plus their split-halves term (0.029) is the systematic part of the uncertainty. It was 0.35 m/yr before.
- **Transfer from Sweihan is not supported.**
  - Sweihan and Seih Al Hama (same scene) track each other date by date (detrended r 0.93 E / 0.75 N on hard surfaces).
  - Liwa does not track Sweihan (r −0.29 to +0.18).
  - The row 044 − row 043 difference in the overlap has a trend at its west end (−0.085 ± 0.022 E, +0.129 ± 0.040 N m/yr).
- **Hard-surface matcher.** Clean known shifts are recovered to ≤ 0.02 px. Under strong degradation one case reaches 0.08 px (0.5 px shift) here and one 0.07 px (1.3 px shift) at Seih Al Hama, beyond the 0.05 px criterion. As a proportional bias on a reference trend of ≤ 0.23 m/yr, that is ≤ 0.04 m/yr, inside the bracket term.

**Is it real?**
- **Displacement grows with time:** 1.23 m/yr × dt along the motion. The farm stable ground now shows −0.38 m/yr along the dune direction: that is the farm drift, seen from the new reference.
- **Short versus long baselines:** r = 0.68 (E), 0.77 (N). The long pairs give 0.34 m/yr more southward motion than the short ones, as before. This is not explained by the reference, which is common to both.
- **Aliasing and illumination:** no aliasing (12-year displacements are below half the 85-115 m spacing), and the illumination bias is negligible.
- **Year to year:** field-median rates (0.43-2.27 m/yr) are above the dune noise (p < 0.001). Their correlation with MERRA-2 drift is now r = 0.43, down from 0.80 on the farms. The canopy-free reference has fewer, noisier windows per date (99 road windows), so single-year rates are noisier, while the 12-year trend is less biased.
- **Landsat 7 long baseline:**
  - 2000-2025 against 2013-2025: r = 0.63 (E) and 0.78 (N); median speed 1.08 against 1.34 m/yr; the 2000 positions sit ~6 m north of the OLI line.
  - The Landsat 7 registration on these references is weak: the bare-farm polygons include the M9 block, which was dune in 2000, and the roads were fewer then. So this check is indicative only.

**Wind.**
- The field heading of 166° is 21° from the resultant drift direction (145°) and 8° from the strongest sand-moving mode (toward 158°).
- 97.7 % of detected windows lie within 45° of the resultant drift direction.

**Second datasets: the direction is confirmed, the speed is not.**
- Both HLS stacks are registered on the same two canopy-free references on their own 30 m grids.
- **HLS S30 (Sentinel-2, independent):** 0.47 against 1.31 m/yr over 2016-2025, headings 7.5° apart, r = 0.42 (E), 0.73 (N). Motion is detected in only 38 % of windows.
- **HLS L30 (same instruments):** 0.57 against 1.38 m/yr, headings 3.6° apart. Motion detected in 56 % of windows.
- On the farm reference the gap was already ~0.6 m/yr (1.0-1.16 against 1.66-1.74). With the canopy-free references it widens to ~0.8 m/yr.
- At the other two sites L30 agrees with pan within ~0.1 m/yr. So at Liwa the 30 m red-band stacks measure much slower motion than the 15 m pan. A plausible cause, untested: at 30 m the 85-115 m bedforms are barely resolved, and the 720 m windows follow larger, slower forms.
- Until this is understood, the pan speeds' magnitude has no independent confirmation here. Only their direction does.

**Masks.** These are unchanged from the previous run: 41 % of the box is masked, with 13 hand-drawn farm/settlement polygons (10 allowed as stable ground). Megadunes, sabkha flats and the small-dune field are not masked.

**NASADEM.** 17 of 84 candidates are resolved at bedform scale: medium dunes, 13-31 m high, mostly in the northern field. All 17 have detected motion (7 slow, 10 active). Those speeds are of the bedforms around each outline. The speed-versus-height model is not supported, so there is no gap fill.
