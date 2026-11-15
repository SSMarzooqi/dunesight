## Liwa: which ground is stable? (registration reference, 2026-11-15)

The previous run registered every image on date-palm farms (621 stable windows, 561 of them mostly vegetated). Their per-image offsets drift 0.50 m/yr toward 335°, close to the anti-sun direction (333°). Subtracting that drift adds ~0.5 m/yr toward the SSE to every dune window. This note records how the reference was chosen. The tests and decision rules were written down **before** any new dune speed was computed. The dune speed under each reference follows mechanically from the references' offsets, so references were judged on their offsets.

### Plan, as fixed before the results
- **Quantity compared:** the linear trend of each reference's per-image offsets over the 12 Landsat 8/9 epochs.
- **Candidates and their validation:**
  - **Hard surfaces** (paved roads, buildings; vegetation removed). New masked matcher: bias ≤ 0.05 px on known shifts. At Sweihan and Seih Al Hama: trend within 0.05 m/yr of the existing stable ground, per-date NMAD ≤ 0.5 m.
  - **Megadune bodies**, assuming they move ≤ 0.1 m/yr.
  - **Transfer from Sweihan** (same pass, row 043). Requires the per-date offsets to be shared, and the row 044 − row 043 geolocation difference on the same ground and date to have no trend (≤ 0.05 m/yr).
  - **The 8 unvegetated stable windows** (too few to decide alone).
- **Palm-shadow tests and their predictions:**
  - Drift of farm windows against vegetation fraction and NDVI change.
  - Canopy against bare ground inside the same farms (shadows predict canopy drifts, bare ground does not).
  - On the illumination-test pairs (weeks apart), canopy should move toward the anti-sun direction as the sun gets lower; hard or bare ground should not.
- **Decision (tolerance τ = 0.1 m/yr):**
  - **(a) Adopt** a reference if it passes its validation, has ≥ 20 points in more than one cluster, has split-halves ≤ 0.05 m/yr, and agrees within τ with a physically independent candidate.
  - **(b) Otherwise bracket.** The speeds span the candidates that passed their own validation and were not shown to be biased. The detection limit is raised by half their spread.

### What the tests showed
**Hard-surface matcher.**
- Plain masking (the mask fixed on the map while the image moves) recovered only ~80 % of a known shift. That is a 20 % pull toward zero, so the first version failed its own test.
- Moving the later image's weight and window with the pair's offset estimate (three passes) brings the bias to ≤ 0.03 px for shifts up to 3 px, clean or degraded.
- Validation:
  - Sweihan: trend within 0.047 m/yr of its stable ground (bootstrap SE ~0.012), per-date NMAD 0.20 m.
  - Seih Al Hama: within 0.048 m/yr, per-date NMAD 0.11-0.23 m.
  - Passes, narrowly.

**Liwa references** (trend of per-image offsets, m/yr; all toward the NNW unless stated):

| reference | windows | trend | toward |
|---|---|---|---|
| farm stable ground (previous) | 621 | 0.50 | 335° |
| hard surfaces, all | 401 | 0.40 | 333° |
| hard surfaces inside the farm/settlement polygons (exploratory run) | 302 | 0.43 | 331° |
| hard surfaces outside the farm polygons | 99 (9 clusters) | 0.23 | 338° |
| bare ground inside farms (≥ 30 m from vegetation) | 2391 | 0.11 | 274° |
| canopy inside farms (diagnostic) | 2717 | 0.49 | 336° |
| the 8 unvegetated stable windows | 8 | 0.54 | 330° |

Against expectation, hard surfaces as a whole drift almost as much as the farms. The hard windows that do so lie inside the farm zones: roads and buildings between walled plots and tree lines. Away from the farms the drift halves.

**Palm-canopy tests.**
- **Canopy against bare ground in the same farms:** canopy drifts 0.45 m/yr toward ~348° relative to the bare ground, close to the anti-sun direction (333°).
- **Illumination-test pairs (weeks apart):**
  - Canopy moves along the anti-sun direction by −0.066 m per degree of sun elevation (95 % CI −0.079 to −0.053). It moves away from the sun as the sun gets lower and shadows lengthen.
  - The farm stable windows move −0.052 m/deg.
  - Bare ground in the same farms does not move (−0.006, CI −0.016 to +0.005).
  - So the canopy's apparent position depends on illumination, as shadows predict.
- **Against expectation:**
  - Within the 621 farm windows, the drift does **not** grow with vegetation fraction or with NDVI change (Spearman ρ ≈ 0.1; tercile medians 0.25-0.29 m/yr).
  - The farms did not get greener from 2013 to 2025 (median NDVI change −0.02).
  - The sun-elevation sensitivity explains only ~0.1 m/yr of drift if tree growth were the only change.
  - So canopy is shown to be an unstable reference that drifts toward the anti-sun direction, but the exact mechanism (shadow lengthening, crown growth, replanting) is not pinned down.
- **The farm-vs-hard drift appears in all three sensors:** Landsat pan, HLS L30 (0.24 m/yr toward ~340°, 30 m red) and HLS S30 (~0.20 m/yr, independent Sentinel-2 geolocation). It is a property of the ground, not of one sensor's geolocation.

**Transfer from Sweihan: not supported.**
- Sweihan and Seih Al Hama (same scene) track each other date by date: detrended r 0.96 (E) and 0.77 (N) on hard surfaces, differences 0.14-0.32 m RMS.
- Liwa's per-date offsets do not track Sweihan's: detrended r between −0.21 and +0.20, even after adding the measured row difference.
- On the same date and ground, row 044 − row 043 in the overlap strip is small (≤ ~2 m) but has a trend at its west end (54.3° E): −0.085 ± 0.022 (E), +0.129 ± 0.040 (N) m/yr. In the centre and east it is ≤ 0.07 m/yr.
- Adjacent-row scenes are registered separately and do not share their per-date geolocation error here, so the transfer fails the rule.

**Megadune bodies: cannot be a reference, and are not measured.**
- On images low-passed to the body scale, the body matcher recovers only 7-14 % of a known 0.3-0.5 px shift (≈ 0 % at a heavier low-pass). Normalised cross-correlation is better but still biased by 0.1-0.2 px.
- As a "reference", the bodies therefore return the image frame (trend ≈ 0.07 m/yr), not the ground.
- As "motion", they return the registration offsets mirrored. That is the earlier "0.68-0.83 m/yr toward ~138°, whatever the size": mostly the Landsat 7 offset of +12.8 m E / −6.6 m N.

### Decision: outcome (b), a bracket
- **Which references were checked:**
  - Physically independent pairs agreeing within τ: none among the references that passed their own tests.
  - Hard surfaces outside the farms and bare ground inside the farms are both canopy-free and both pass the matcher tests, but differ by 0.21 m/yr.
  - Sweihan's hard surfaces plus the measured row difference (0.21 toward 323°) lands near the first of them, but the transfer failed its own test.
- **What is used:**
  - The registration is the **mean of "hard surfaces outside the farm polygons" and "bare ground inside the farms"**.
  - Half their difference (~0.10 m/yr per component) is added as a systematic uncertainty, together with the larger of their split-halves terms (0.029 m/yr).
  - This replaces the previous 0.35 m/yr unchecked-trend term.
- **Not used:** the farm canopy (shown to drift), hard surfaces inside the farm zones (drift like the canopy), the bodies (matcher fails) and the Sweihan transfer (not supported).
- **What remains uncertain:**
  - Which of the two canopy-free references is closer to the truth.
  - Bare plots inside walled farms may hold some loose sand.
  - The roads outside the farms are few (99 windows) and border live sand.
  - The true reference drift is therefore known only to lie roughly between 0.11 and 0.23 m/yr (the trends of these two). Under either reference the dune speeds come out ~0.25-0.45 m/yr lower than on the farms.

### Resulting dune field (final run)
| reference | detected | median speed (m/yr) | 10-90 % | field heading |
|---|---|---|---|---|
| hard surfaces outside farms | 3,566 | 1.50 | 0.85-2.35 | 167° |
| bare ground in farms | 3,464 | 1.33 | 0.74-2.17 | 164° |
| **mean of both (used)** | 3,521 | **1.41** | 0.79-2.25 | 166° |
| farm stable ground (previous, not used) | 3,651 | 1.74 | 1.06-2.60 | 165° |

The "detected" counts in this table use the bracket detection limit (median 0.49 m/yr); the previous run's own limit was 0.97 m/yr, with a median of 1.79 m/yr.

**Known-shift test of the hard-surface matcher in the final runs.** Clean shifts are recovered to ≤ 0.02 px at all three sites. Under strong degradation one case exceeds the 0.05 px criterion: 0.08 px for a 0.5 px shift here, and 0.07 px for a 1.3 px shift at Seih Al Hama. If that is a proportional bias (≤ 16 %) on a reference trend of ≤ 0.23 m/yr, it is ≤ 0.04 m/yr, inside the 0.10 m/yr bracket term. It is reported, not hidden: strictly, the matcher meets its criterion only for clean or mildly degraded images.

**Second dataset (HLS), registered on the same two references at 30 m.** S30 gives 0.47 m/yr and L30 0.57 m/yr, against Landsat 1.31-1.38 over the same years. The headings agree (3.6-7.5°). On the farms the gap was ~0.6 m/yr; it is now ~0.8 m/yr. The magnitude is therefore not independently confirmed at Liwa (see `02_tracking.md`).

Figures and numbers: `02_registration_references.png`, `registration_reference` in `02_qc_summary.json`, `02_row_overlap_offsets.csv`.
