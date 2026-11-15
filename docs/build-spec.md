# Build Spec — DuneSight

Written 2026-11-15 by the planning lead, after the data for all three sites became real. Requirements source: `handoff.md` §8 (and §1, §7). Where this spec and the handoff differ, this spec wins, because the handoff was written before the measurements existed. Section 2 explains what changed and why.

## 1. What you are building

DuneSight: a locally run 3D globe app ("a spy satellite for sand dunes") for municipal and road planners and farm owners in Abu Dhabi emirate. It shows where dune sand is measurably moving at three sites, how fast, in which direction, how sure we are, and which road, farm and built-up edges that moving sand reaches and when. The question it answers: **where should the next windbreak go, and how soon?**

Stack (fixed): Vite + vanilla JavaScript + CesiumJS (`cesium` + `vite-plugin-cesium`), no framework. `npm run dev` at `http://localhost:5173`; `npm run build` deploys to GitHub Pages under `/dunesight/` through the existing workflow. The scaffold in `index.html`, `src/main.js`, `src/style.css`, `vite.config.js`, `package.json` already runs and deploys; replace the placeholder page, keep the build setup (including the `postbuild` Cesium asset move, which is needed for Pages).

## 2. What the data turned out to be (read before designing anything)

The handoff imagined fast dunes, every dune outlined, and a dramatic forecast. The measurements say otherwise, and the app must show what is true:

| | Seih Al Hama | Sweihan | Liwa (eastern crescent) |
|---|---|---|---|
| Detected speed, median (p10–p90), m/yr | 0.67 (0.44–1.14) | 1.15 (0.55–1.82) | 1.41 (0.79–2.25) |
| Share of dune windows with detected motion | 58% | 86% | 93% |
| Heading of motion (field median) | 29°: N to NE in the north, E in the south | 83° (E) | 166° (SSE) |
| Detection limit (median), m/yr | 0.45 | 0.36 | 0.49 |
| Per-window uncertainty (median 1σ), m/yr | 0.19 | 0.15 | 0.20 |
| Speed cross-check (`summary.confirmation`) | partly confirmed: Landsat 7 +5 %, Sentinel-2 0.52× | partly confirmed: Landsat 7 +3 %, Sentinel-2 0.56× | not confirmed: Landsat 7 −19 %, Sentinel-2 0.35× |
| Heading cross-check | partly confirmed: Sentinel-2 41° off, Landsat 7 r 0.88/0.91 | confirmed: Sentinel-2 within 6° | confirmed: Sentinel-2 within 8° |
| Large dunes outlined (NASADEM) | 21 | 12 | 17 |
| Targets (roads/farms/built-up) | 1,158 | 873 | 754 |
| Sand at a target edge now / reached by 2050 | 76 / 97 | 18 / 24 | 14 / 35 |
| Median shift of moving sand by 2050 | ~14 m | ~27 m | ~34 m |
| Ground-station wind file | `station_wind.json` (Al Ain Intl, 24 km) | none (stations disagree) | none (no station within 100 km) |

Values read from `public/data/<site>/summary.json` and `pipeline/outputs/<site>/02_qc_summary.json` on 2026-11-15. Read every number from the data files at run time; never hard-code values from this table. Liwa was re-measured on 2026-11-15 against canopy-free registration references (`pipeline/site_notes/liwa/02_registration_reference.md`); its speed magnitude is not independently confirmed. The motion of large dune bodies (megadunes, ridges) is not measured at any site.

Consequences for the design:

1. **The motion field is the main layer, not dune polygons.** Motion is measured on a 120 m grid of 480 m windows (`vectors.geojson`, thinned to 240 m, detected windows only). NASADEM resolves only large dunes (roughly ≥ 13 m high), so each site has one or two dozen outlines. They are labelled landmarks with a full info card, not the whole story.
2. **Targets carry the threat story.** `targets.geojson` has a status per road segment, farm and built-up area. Most hits are edges where moving sand already touches the target. Present that as the answer to "where should the windbreak go".
3. **The forecast is subtle and must be labelled as such.** Projected frames differ from the 2025 image by a pixel or two. Each manifest entry carries displacement statistics; show them ("By 2050: moving sand shifts a median 27 m") so nobody thinks the animation is broken, and never exaggerate motion in imagery. An exaggeration control is allowed only for the arrow layer, and only if it is labelled with its factor (see 4.4).
4. **"Below detection limit" is a first-class state.** Dunes and areas that move slower than the limit show "< 0.45 m/yr" (the limit from the data), no heading, no arrow. Never display 0 m/yr as a measurement.
5. **Wind and dunes disagree at Seih Al Hama, and the app says why.** NASA MERRA-2 gives the net drift direction; a ground-station check (NOAA ISD, Al Ain airport) shows MERRA-2 underestimates the southerly winds there. Show MERRA-2 as the NASA wind product and the station result as the explanation, in the wind panel and the dossier.
6. **The independent cross-check is only partial.** Sentinel-2 (HLS S30) agrees on heading at Sweihan and Liwa but not at Seih Al Hama, and gives a third to a half of the Landsat speed everywhere. `summary.confirmation` states the status for speed and heading; the dossier states the detail exactly as `summary.json` words it.

## 3. Data contract

All data is static, under `public/data/`, fetched with paths built from `import.meta.env.BASE_URL`. Coordinates are WGS84 lon/lat.

- `data/sites.json` — `default_site`, and `sites[]` with `id`, `name`, `bbox {west,south,east,north}`, `status` (`real` expected for all three), `data_dir`, `files` (per-file status). If any file is not `real`, show a visible "placeholder data" badge for that site.
- Per site, under `data/<site_id>/`:
  - `summary.json` — headline numbers, `detection_limit_myr`, `counts_by_class`, `baseline`, `speed_note`, `wind_agreement_note`, `threat` (definition text and counts by type), `validation.published`, `validation.second_dataset`, `data_handling`, `limits[]`, `frames`.
  - `dunes.geojson` (2025 positions) and `dunes_2000.geojson` (same ids, year-2000 positions) — Polygons. Handoff §4 fields plus: `below_detection_limit`, `detection_limit_myr`, `speed_estimate_myr`, `n_windows`, `motion_scale_note`, `height_source`, `outline_source`, `position_date`, `threat_basis`, `threat_definition`. When `below_detection_limit` is true: `heading_deg` and `wind_agreement_deg` are null, `speed_med_myr` and `speed_lo_myr` are 0 and `speed_hi_myr` is the detection limit. Render that as "< limit", not as zero.
  - `vectors.geojson` — Points with `speed_myr`, `heading_deg` (direction of motion, 0 = north, clockwise), `quality` (0–1), `uncertainty_myr`, `detection_limit_myr`, `east_myr`, `north_myr`. Detected windows only.
  - `targets.geojson` — LineStrings (road segments) and Polygons (farms, built-up). `id`, `name`, `type` (`road` | `farm` | `building`), `hit_year_min`, `hit_year_med`, `hit_year_max` (ints or null), `threat_status` (`sand_at_edge_now` | `reached_by_2050` | `reached_2051_2100`-style value | `possible_within_direction_uncertainty` | `not_reached_by_2100`; read the actual set of values from the files), `gap_m`, `borders_free_sand`, `class`, `length_m`, `source`. Top-level `note` and `osm` (query, timestamp).
  - `frames/manifest.json` — `bounds`, `observed[]` (`year`, `date`, `scene_id`, `sensor`, `pixel_m`, `file`, sun angles), `projected_median[]` and `projected_fast[]` (`year`, `file`, `displacement {median_m, p90_m, max_m, share_of_box_moving_pct, …}`), `stretch`, `projection_reading_note`. Observed frames are JPEG, projected frames are PNG with alpha; always take file names from the manifest. Observed years have gaps (no scenes 2002–2012, and one or two missing years after); projected frames are 2030–2050 in 5-year steps.
  - `wind_summary.json` — handoff §4 fields; `sand_rose[].sector_deg` is the direction the wind blows FROM, `RDD_deg` is the direction sand moves TOWARD (see its `note`).
  - `sources.json` — array of datasets with `name`, `provider`, `version`, `used_for`, `dates`, `place`, `pixel`, `link`, `doi`.
  - `station_wind.json` — **optional** (may not exist yet): a compact station-versus-MERRA-2 comparison. If the fetch fails, the wind panel simply omits the station part. Expected fields when present: `has_usable_station`, `station {name, id, distance_km}`, `period`, `station {DP, RDP, RDD_deg, RDP_DP}`, `merra2 {…}`, `note`. Code defensively against missing keys.

Open the real files before coding against them; they are the contract. Treat unknown or missing optional fields gracefully (hide the row, don't print "undefined" or "null").

## 4. Screens and interactions

### 4.1 Frame and brand
- Full-window globe. HUD header with the name **DuneSight**, the current site name, and an OBSERVED / PROJECTED badge driven by the timeline. Page title "DuneSight".
- Style: dark "satellite intelligence" HUD. Monospace type, thin cyan and amber lines, corner brackets, subtle scanlines, large type for key numbers. It should look deliberate and legible at 1080p, not decorative at the cost of reading the numbers.
- No NASA logos or insignia anywhere, and nothing implying NASA endorsement.

### 4.2 Sites and fly-in
- On load: globe → UAE → the default site, a smooth fly-in of a few seconds (skippable by any click or key).
- Site switcher (three sites) in the HUD. Switching flies to the site and swaps every layer, panel and the timeline. Each site's data is fetched on first visit and cached in memory.
- A home view per site that frames its box (about 10 × 10 km) obliquely; a "top-down" toggle for map-like reading.

### 4.3 Layers
- **Imagery frames:** the current timeline frame draped on the terrain/globe inside the site's bounds, from the manifest.
- **Motion vectors:** one arrow per `vectors.geojson` point, pointing along `heading_deg`, coloured by `speed_myr` on a perceptually ordered ramp with a legend in m/yr. Arrow length encodes speed on a stated scale. Opacity or thickness can encode `quality`.
- **Targets:** coloured by `threat_status`. Suggested: sand at edge now `#f85149`; reached by 2050 `#f0883e`; reached 2051–2100 `#d29922`; possible within direction uncertainty `#a371f7`; not reached `#4b6a88` thin and dim. Targets with a hit pulse gently. A separate toggle highlights `borders_free_sand` targets as "exposed to blowing sand today (not forecast by this tool)".
- **Large dunes:** outlines coloured by `class` (stable `#3fb950`, slow `#d29922`, active `#f0883e`, fast `#f85149`), label = id. `threat = true` gets a pulsing outline. Then-vs-now toggle swaps or overlays `dunes_2000.geojson` (dotted) against `dunes.geojson`.
- **Site box** outline, thin.
- Performance: a site has roughly 750–1,200 target features and a few hundred arrows. Batch geometry by style (a handful of primitives or data sources, not one entity per feature with its own material) so pan/zoom stays smooth; picking must still resolve the individual feature.

### 4.4 Modes
Three mode buttons, each a preset of layer visibility:
- **True view:** imagery frame, large dunes, targets dim.
- **Motion:** arrows prominent, speed legend, large dunes thin. Optional control "exaggerate arrows ×N" that only rescales arrow length and shows its factor in the legend.
- **Threat:** targets prominent by status, only arrows within reach of a hit target emphasised (or all arrows dim), dunes with `threat = true` highlighted, a ranked list panel of hit targets (earliest `hit_year_min`, then smallest `gap_m`) that flies to a target on click.

### 4.5 Picking and info cards
- Clicking a dune, a target or an arrow shows a lock-on reticle and an info card. Every number has units and, where the data gives one, a range.
  - **Dune card:** id, class, height (with source "NASADEM, Feb 2000"), area, speed as `med (lo–hi) m/yr` or `< limit m/yr (below detection limit)`, heading as degrees and compass point (or "not measurable"), uncertainty, confidence, wind agreement, nearest target and distance, reach years or "not reached by 2100", and the `motion_scale_note` in small print.
  - **Target card:** name, type, status in words, reach years as `min – max (median)` with "fast case – slow case" explained in one line, gap in metres, whether it borders free sand, source (OpenStreetMap / HLS vegetation).
  - **Arrow card:** speed ± uncertainty, heading, quality, detection limit at that window.
- Escape or clicking empty ground clears the selection.

### 4.6 Timeline
- A weather-radar style bar spanning the first observed year to 2050, with a visible division between OBSERVED and PROJECTED, tick marks only where frames exist, and the gap in observations (2002–2012) shown as a gap, not interpolated.
- Play/pause, step back/forward, scrub. About 0.6 s per frame when playing. Cross-fade between frames.
- **Observed frames** at full opacity, each labelled with its **acquisition date, sensor and pixel size** and scene id (from the manifest).
- **Projected frames:** median case drawn tinted (amber) with opacity falling from about 55% at 2030 to 30% at 2050 over the latest observed frame; fast case faint on top, toggleable. The badge reads PROJECTED, and a line shows that frame's displacement statistics from the manifest, plus the manifest's reading note available on hover or in the dossier.
- Targets change to their hit colour when the timeline year reaches `hit_year_min` (fast case); a toggle switches the rule to `hit_year_med`. Targets with `sand_at_edge_now` are already marked at the latest observed frame.
- Arrow layer in projected years: optionally draw each arrow's true displacement to that year (speed × years since the latest scene) as a short track; this is the honest way to show motion that the imagery barely shows.

### 4.7 HUD panels
- **Headline panel** from `summary.json`: detected speed median and p10–p90 (m/yr), detection limit, share of windows detected (from `speed_note` or computed fields), counts by class of the outlined dunes, number of targets at edge now and reached by 2050 by type, baseline dates.
- **Wind compass:** 16-sector sand rose from `wind_summary.json` (FROM convention), an arrow for RDD (direction sand moves toward), RDP/DP, DP with its class, period and source. Overlay the measured field heading of the dunes (compute the vector mean of `east_myr`, `north_myr` from the vectors) so the agreement or disagreement is visible. If `station_wind.json` exists, show the station RDD as a second arrow with a one-line explanation.
- **Data source line:** dataset names and the date of the frame on screen.
- Panels collapse so the map can be seen; state persists per session.

### 4.8 "How we know" dossier
A panel or overlay, per site, generated from the data files (not hard-coded text): method in plain language; NASA datasets with dates, pixel sizes and links/DOIs (`sources.json`); cloud, haze and missing-data handling (`data_handling`); uncertainty and the detection limit; validation (the published study as context only, and the second-dataset result, both from `validation`); the threat definition and what it excludes (`threat`); the full `limits` list; links to the three pipeline notebooks and the docs in the GitHub repo (`https://github.com/SSMarzooqi/dunesight`). If `docs/how-we-know.md` panel text is available as data later it will be provided as a JSON field; until then compose from the fields above.

### 4.9 Credits footer (always visible or one click away)
- Exact line: **"Supported by the Michigan Space Grant Consortium, NASA grant 80NSSC20M0124."**
- NASA credited as the source of the data and imagery, naming each dataset from `sources.json`.
- "© OpenStreetMap contributors", the basemap/terrain provider credits (Cesium ion, Esri where used), ESA WorldCover and NOAA ISD if they appear in `sources.json`.
- No NASA logos.

## 5. Globe, token and offline behaviour
- Token from `import.meta.env.VITE_CESIUM_TOKEN`. With a token: Cesium World Terrain and ion imagery. Without a token, or if ion fails: Esri World Imagery tiles and ellipsoid terrain, with credit, and never an unhandled error.
- If the network drops entirely: the app still loads its local data and draws the site frames, vectors, targets and dunes over a plain dark globe, with a small "basemap offline" note.
- Clamp ground geometry to terrain; make sure draped frames and clamped outlines line up (the frames' bounds are exact pixel-corner bounds).
- A Leaflet 2D fallback is only needed if Cesium cannot render this data reliably; if you add it, it shares the same UI and data modules. Do not build it speculatively.

## 6. Code structure
- `src/main.js` — boot, viewer, fly-in, wiring.
- `src/data.js` — fetch and cache of site data, base-path handling, defensive accessors.
- `src/state.js` — current site, mode, timeline year, selection; a tiny event emitter.
- `src/layers/frames.js`, `src/layers/vectors.js`, `src/layers/targets.js`, `src/layers/dunes.js` — one module per layer with `load`, `setVisible`, `update(year)`, `dispose`.
- `src/timeline.js` — timeline model and control.
- `src/hud/` — `header.js`, `panels.js`, `card.js`, `compass.js`, `dossier.js`, `credits.js`, `legend.js`.
- `src/format.js` — number, unit, range, compass-point and year formatting in one place.
- `src/style.css` (split if it grows).
- Each module starts with a one-line plain-English comment saying what it does; collect those lines in `docs/explain-it.md`.
- No secrets in `src/`. No new runtime dependencies beyond `cesium` unless clearly justified (`satellite.js` only if the optional orbit track is built).

## 7. Optional, only after everything above passes
- Landsat 8/9 orbit track from CelesTrak TLEs.
- Animated wind streaks along RDD.
- A swipe comparison between the latest observed frame and the 2050 projection.

## 8. Acceptance tests
Automate what can be automated (Playwright with a headless Chromium is fine as a dev dependency; software WebGL is acceptable for these checks) and run the rest by hand in a real browser; report which were done which way.

1. `npm run dev` starts cleanly; `npm run build` passes; the production build works when served under `/dunesight/`.
2. First meaningful view (HUD and globe with the site box) in under 5 s on localhost.
3. Fly-in completes and lands on the default site; switching to each of the three sites works and swaps all data.
4. Clicking a dune shows a complete card; a below-detection-limit dune reads "< X m/yr", never "0 m/yr" and never "null"/"undefined"/"NaN" anywhere in the UI.
5. Clicking a target and an arrow shows complete cards.
6. The timeline plays end to end at every site; every observed frame shows its acquisition date, sensor and pixel size; projected frames show the PROJECTED badge and displacement statistics; the 2002–2012 gap is shown as a gap.
7. A target with `hit_year_min` = Y is not hit-coloured at Y−1 and is at Y (test at least two targets per site that have hits).
8. Every number on screen has units and a source reachable in the UI.
9. Wind compass draws the sand rose, RDD and the measured dune heading; works with and without `station_wind.json`.
10. Dossier lists every entry of `sources.json` with working links and the full `limits` list; credits footer contains the exact §4.9 line and no NASA logos.
11. With `VITE_CESIUM_TOKEN` unset the app still works on the fallback basemap; with the network blocked after load the local layers still draw.
12. Usable at 1920 × 1080 and not broken at 1366 × 768.
13. No console errors during a full run-through of each site.

## 9. What not to do
- Don't change anything under `pipeline/` or `public/data/`; if a data problem blocks you, report it.
- Don't present projections as observations, or motion below the detection limit as measured.
- Don't round away uncertainty: ranges stay ranges.

## As built (2026-11-15)

Where the app deliberately differs from this spec, and why:

- **Station wind file.** `station_wind.json` is richer than section 3 describes (`station {name, id, wmo, icao, lat, lon, elevation_m, distance_km, bearing_from_site_deg, years, hours_reported_pct_min/max, DP, RDP, RDD_deg, RDP_DP, dp_class, …}`, `merra2_site_cell`, `merra2_station_cell`, `secondary[]`, `limits[]`, `note`, `role`, `representative`). It is published only where notebook 01b's fixed rule says the station is a defensible comparison (Seih Al Hama) and is listed in `sites.json` `files` only there, so the app never requests a missing file. A `representative: false` flag, if ever published, hides the station arrow.
- **Cross-check line.** Not in the spec: the speed panel shows, under the speed, whether speed and heading are confirmed by an independent check (`summary.confirmation`, written by notebook 03 from notebook 02's QC), and the dossier has a "Cross-checks" table. Requested after the Liwa re-measurement.
- **Dossier opening.** The dossier opens with the panel text of `docs/how-we-know.md` (imported from that file at build time, so the two cannot drift), then a per-site plain-language method composed from the data, then cross-checks and the ground-station section.
- **Dune labels.** Labels are decluttered in screen space: where outlines cluster (e.g. Seih Al Hama D008–D011), the lower-priority label (non-threat, lower dune) is hidden until the view is close enough for it to fit.
- **Arrow scale.** Each site opens at the largest of ×1, ×2, ×4 (×1 = an arrow 100 m long per 1 m/yr) at which a 90th-percentile arrow, by speed among the arrows drawn, is no longer than the spacing between neighbouring arrows (240 m, from `vectors.geojson`'s note), and never below ×1. That gives ×2 at Seih Al Hama (p90 1.17 m/yr → 234 m) and ×1 at Sweihan (1.79) and Liwa (2.26). (It replaced a rule on the site median, which opened Liwa at ×2 with overlapping arrows.) The legend always states the scale in use, and ×1/×2/×4 can be chosen there.
- **Timeline.** Stops at every observed frame and every year from the latest scene to 2050 (so a reach year can be shown exactly); between projected frames the latest projected frame stays on screen and the label says which.
- **Image-only years 2003-2012 (2026-11-15).** The timeline gap 2002-2012 is filled, where the catalogue allows, with Landsat 7 images taken after its scan line corrector failed (31 May 2003), for display only (Sultan's decision of 2026-11-15). Pipeline: notebook 01 section 3b picks at most one November scene per year with the same in-box tests (stripes allowed) into `pipeline/outputs/<site>/display_only_scenes_slc_off.json`; notebook 03 section 3b writes `frames/obs_display_only_<year>.webp` (grey + alpha, gaps and masked cloud transparent, same grid, bounds and ETM+ stretch as the 2000/2001 frames, about 80-95 kB each) and lists them in the manifest under `observed_display_only`. Every observed frame now carries `use` (`measurement`, `long_baseline_check`, `display_only`). Nothing measured reads them; the published measured files are byte-identical to before. App: a `display` stop kind (`src/timeline.js`), an open-square tick and dotted track (neither the measured blue nor the projected stone), an IMAGE ONLY tag in the header chip, readout and on the map, the stripes painted as a neutral no-data hatch (`--ds-nodata`, `MAP_STYLE.nodata`), and the motion arrows and dune outlines hidden in those years. The remaining empty years are gaps computed from the data and named in one label under the early years (on a phone, under the readout). Years: Seih Al Hama and Liwa 2003, 2005, 2008, 2011, 2012; Sweihan 2005, 2008, 2011, 2012.
- **Credits.** The footer separates NASA datasets from others by provider (ESA WorldCover and NOAA ISD are not listed as NASA).
- **Redesigned interface (2026-11-15).** The dark cyan/amber HUD of section 4.1 was replaced by the user's "field survey instrument" design (`src/ui/`: warm charcoal, IBM Plex Sans, one plain-English sentence leading each panel, a first-visit guide, a phone bottom sheet). Its colour rule replaces the colours of sections 4.3 and 4.6: measured motion is one blue (arrow speed is shown by length and in the card, no longer by a colour ramp), projected is stone with a dashed edge or hatch (projected frames are tinted stone, not amber, the study-area edge turns dashed and a PROJECTED tag sits on the map), threat classes are a warm ramp (the "possible" class dashed), dune classes a cool ramp with widths, and every map line has a dark casing. Legend checkboxes switch each layer on and off per mode, including each threat class. Modes keep their meaning but follow the design's presets: True view opens with the image and the study box only (dunes, arrows, targets and the exposed marking are one click away), Motion hides the targets, Threat dims the dunes and keeps the arrows near reached targets. Where the design had no place for an existing feature it was added in the same style: the ranked list of reached targets replaces the wind panel in Threat mode; the selection card is its own column (a tab on a phone); the arrow-length scale, "exposed to blowing sand" and then-vs-now are legend rows; the hit-year rule, fast-case frame and changed pixels are in the timeline's settings; the observed/projected badge is a chip in the header; credits stay in the footer (on a phone as a two-line footer).
- **One heading per site.** The headline used to show the vector mean of the arrows drawn on the map (37° at Seih Al Hama) while the station text and the pipeline used the field median (29°). Every heading on screen is now the pipeline's field median, read from `summary.json` `wind_agreement_note` (the only place it is published; there is no numeric field) and checked against `station_wind.json` `dune_heading_deg` where present. The arrows' vector mean appears only in the wind panel's details and the dossier, labelled as a different average. The wind-versus-dunes angle on screen is therefore 71° at Seih Al Hama (was 62°), 4° at Sweihan, 21° at Liwa; no measured value changed.
- **Fonts.** IBM Plex is bundled (`@fontsource`, SIL OFL 1.1) instead of loaded from Google Fonts.
- **Map-provider credits.** Cesium's credit display (the Cesium ion logo, on-screen imagery credits such as Esri's, and the "Data attribution" link whose list opens above the UI) sits in the footer and never shrinks; the dataset list truncates instead. Before this, the app's own stylesheet hid Cesium's credit element, so neither the old HUD nor the first version of the redesign showed it.
- **Not built:** the Leaflet 2D fallback (Cesium renders the data reliably) and the optional items of section 7 (orbit track, wind streaks, swipe).
- **Tests.** Playwright e2e against the dev server and the production build under `/dunesight/`; ports can be moved with `E2E_DEV_PORT`, `E2E_NOTOKEN_PORT`, `E2E_PROD_PORT`. Besides section 8 they check every legend checkbox in every mode, the first-visit guide, the timeline settings, the data-driven wind sentence and the single heading at all sites, the phone layout (390 × 844), that no font is requested from a third party, and that each dataset DOI resolves to its publisher's page (a bot block from that publisher counts as a pass with a logged note).
