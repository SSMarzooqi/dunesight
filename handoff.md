# HANDOFF: Planning, Science and Data Lead for DuneSight

You are the planning, science and data lead for **DuneSight**. You also set up the project's local working environment and GitHub repo. When the data and plan are done, you produce a build spec that will be used to write the app.

You may be working **directly on my laptop** (VS Code). If so, run commands, execute the pipeline, read the errors and fix them yourself. Ask me only for browser logins and decisions.

---

## 0. Your role
You own **the setup, correctness and the plan**:
- Set up the local environment and the GitHub repo (§5).
- Verify the facts.
- Design, write and run the Python pipeline that measures the dunes.
- Interpret the outputs.
- Lock the data file formats.
- Produce a precise **build spec for the app**.

You don't write the web app at this stage; it is built later from the build spec. You do scaffold its empty shell (§5.3) so it runs from day one.

## 1. The project
**DuneSight — a "spy satellite for sand dunes."**
- A **locally run** 3D globe app, built the same way as God's Eye View: Vite + vanilla JavaScript + CesiumJS, started with `npm run dev`, opening at `http://localhost:5173`, with a dark "satellite intelligence" interface. It is also deployed to GitHub Pages for a public link.
- It flies from orbit down to a UAE dune field where **every dune is outlined, labeled and tracked**: height, speed ± uncertainty, heading, confidence, and threat to roads/farms.
- A **weather-radar-style timeline** plays the real Landsat years (OBSERVED 2001→2025), then fades into **PROJECTED** frames to 2050, like a weather app's cloud forecast. Roads and farms turn red in the year sand is projected to reach them.
- **User:** municipal/road planners (Al Ain City Municipality, Abu Dhabi DMT) and farm owners, deciding **where and when to build windbreaks**.
- **Real-world context:** Al Ain recently completed a 14 km ghaf-tree windbreak along Tahnoon bin Mohammed Road (1,807 trees); studies cited for it claim a 70–90% reduction in encroachment behind windbreaks.
- **The tool answers:** *where should the next windbreak go, and how soon?*

**Target area (recommended, needs your verification): Sieh Al Hama dune field, west of Al Ain.**
- A 2025 UAEU MSc thesis (Fareaa, "Monitoring Sand Migration in Al Ain City Utilizing Remote Sensing Techniques") used Sentinel-2 + COSI-Corr there for 2018–2020. It reported interannual variability, with migration peaking in 2019 (average 3.32 m) and seasonal changes. Use it as the **published validation reference**, and be careful about its units and time base.
- Liwa = optional contrast view only (its megadunes barely move).

## 2. How I want it done
- **NASA data at the center** of every measurement: Landsat, HLS, MERRA-2 / NASA POWER, NASADEM. It must not be decoration on top of other data. Other data is fine alongside it: OpenStreetMap for roads/farms, Cesium/Esri basemaps for visuals.
- **Scientifically defensible.** Specifically:
  - **Say which dataset, which dates and which place** for every number, with links (dataset page / DOI).
  - **Know what one pixel means:** its ground size (Landsat pan 15 m, multispectral 30 m, HLS 30 m, NASADEM 30 m, MERRA-2 ~0.5° × 0.625°) and the exact acquisition date of each scene.
  - **Show how clouds, missing data and bad pixels were handled:** cloud/shadow masking via the QA band, Landsat 7 SLC-off exclusion, no-data, low-correlation rejection. Log what was dropped and why.
  - **Check results against something known:** (a) the published UAEU 2025 study, and (b) a **second, independent dataset**: repeat the tracking on **HLS (HLSL30/HLSS30) 2016–2025** and compare the speeds/headings with the Landsat-pan result.
  - **Be honest about limits.** Narrow, true statements ("valid for this dune field, 2000–2025, dunes > ~90 m across") are preferred over broad claims.
  - Use **ranges, not single numbers**, and report uncertainty. If the data doesn't support a claim, say so and propose the honest version.
- **Look before computing:** confirm in **NASA Worldview** (and with GIBS snapshots) that the dunes and their surroundings are visible in the chosen area before writing analysis code.
- **Classical remote sensing + physics at the core, not an AI forecaster.**
  - Reason: there's no labeled training data for UAE dune motion, and too little history to train or validate a forecaster.
  - AI is welcome as an independent cross-check: Segment Anything, RAFT optical flow, or a Prithvi-EO-2.0 base-model experiment if it adds value (cite arXiv:2412.02732 if used). Note that the ready-made Prithvi models cover floods, burn scars and crops, not dunes.
- **Don't invent coordinates, dates or scene IDs.** Verify via search or Earth Engine / earthaccess queries.
- **Pipeline as notebooks:**
  - Jupyter notebooks in `pipeline/`, run locally. Each cell starts with a `# WHAT THIS DOES:` comment.
  - Execute them yourself if you can (e.g., `jupyter nbconvert --execute`), and keep the outputs saved in the notebooks so they double as documentation.
  - Google Colab is only a fallback (e.g., if a GPU is needed for Segment Anything).
- If you'd do any step differently, propose it with a reason.

## 3. Science and method
**Physics background**
- Wind moves sand up the stoss side; it avalanches down the slip face; the dune migrates downwind.
- Migration speed ≈ sand flux ÷ height (c ≈ Q/H), so small dunes are faster.
- The dominant wind is the NW *shamal*, with seasonal and interannual variability.

**Step 0 — Visual check (before any analysis code)**
- In NASA Worldview, view the AOI with Landsat/HLS and MODIS true-color layers on a few dates. Confirm that dunes, roads and farms are distinguishable at 15–30 m.
- Save a share link and a snapshot for the record.
- Use GIBS snapshot URLs for any display-only imagery. Measurements always come from the real data files, never from snapshots.

**Step 1 — Imagery (Landsat panchromatic B8, 15 m)**
- Landsat 7 ETM+ **2000–2002**, and Landsat 8/9 OLI **2013–2025**: one scene per year, **same month** (sun angle/shadows), same WRS-2 path/row, cloud-free over the area of interest (AOI).
- **Exclude Landsat 7 after 31 May 2003** (SLC-off stripes).
- **Cloud/shadow handling:** use `QA_PIXEL` to mask clouds and shadows. Reject scenes with > ~1% cloud inside the AOI. Log it.
- **Access, primary:** Google Earth Engine (`LANDSAT/LE07/C02/T1`, `LANDSAT/LC08/C02/T1`, `LANDSAT/LC09/C02/T1`, band `B8`).
  - The AOI is small, so download clipped GeoTIFFs **directly to the laptop** (`getDownloadURL` / `geemap.ee_export_image`). No Google Drive needed.
- **Access, fallback:** USGS EarthExplorer (original Collection 2 Level-1 scenes), or `earthaccess` + Earthdata Login.
- Record each scene's `DATE_ACQUIRED` / `system:time_start`, `SUN_ELEVATION`, `SUN_AZIMUTH`, `CLOUD_COVER`, and its ID. List the candidates for me to confirm.

**Step 2 — Motion field (feature tracking)**
- Clip to the AOI (start ~5 × 5 km; up to ~10 × 10 km if the field is larger). Export to a common 15 m grid in one UTM zone (likely EPSG:32640, UTM 40N; verify).
- Baseline: earliest L7 scene → latest L8/9 scene (~23–25 yrs).
- Windows ~32 × 32 px, step ~8 px. `skimage.registration.phase_cross_correlation(..., upsample_factor=10)` → (dy, dx) px plus an error metric.
- Velocity = shift × 15 m ÷ Δt (years, from real dates). Mind the sign conventions (image row vs northing).
- Optional: pairwise yearly fields for 2013–2025 to show the interannual range.

**Step 2b — Second-dataset check (HLS)**
- Pull **HLS L30/S30** (NASA, 30 m) for the same AOI and month: one scene from ~2016 and one from ~2025.
  - `earthaccess.search_data(short_name="HLSL30" or "HLSS30", bounding_box=..., temporal=...)` after `earthaccess.login()`
  - or Earth Engine `NASA/HLS/HLSL30/v002`
- Use HLS's Fmask for clouds.
- Run the same tracking (on the red or NIR band), and compare median speed and heading with Step 2 over the overlapping period. Report the agreement.

**Step 3 — Quality control**
- **Stable-ground correction:** identify non-moving pixels (roads, rock, buildings, vegetated farms) using OSM features or bright/low-texture masks, verified visually. Their median shift = co-registration offset; subtract it.
- **Uncertainty:** the residual spread on stable ground (e.g., NMAD or 95th percentile) → ± m/yr.
- Reject low-quality matches, median-filter outliers, then smooth (Gaussian) for advection. Report the % of windows rejected and why.
- Sanity check against plausible barchan speeds (a few m/yr to a few tens of m/yr). Flag anything outside that.

**Step 4 — Wind (Fryberger drift potential)**
- **MERRA-2** hourly `U10M`, `V10M` at the AOI centroid, 2000–2024. Sources: Earth Engine `NASA/GSFC/MERRA/slv/2`, or Earthdata / earthaccess. **NASA POWER** (MERRA-2-based, no key) is the fallback.
- Speed in knots. Meteorological FROM direction = atan2(−U, −V). Sand transport is **downwind** (FROM + 180°).
- For each hour with U > Ut = 12 kt: DP = U²(U − Ut).
- Totals: DP = Σ DP. RDP and RDD come from the vector sum of the downwind components. Also report RDP/DP.
- Classes: DP < 200 low, 200–399 intermediate, ≥ 400 high (vector units).
- Produce yearly DP/RDD, the overall values, and a 16-sector sand-rose table.
- MERRA-2 is a ~0.5° reanalysis, so absolute DP is approximate. RDD is the more robust comparison.
- **Agreement check:** compare dune headings to RDD. Report the angle difference and explain discrepancies (topography, bimodal winds, vegetation, human activity).

**Step 5 — Label every dune**
- **NASADEM** 30 m (`NASA/NASADEM_HGT/001`, band `elevation`). It reflects **Feb 2000** (SRTM).
- Detrend: subtract a heavily smoothed regional surface, or use a local-minimum base. Find local maxima with a minimum prominence (start ~3–5 m; tune) → watershed segmentation → one polygon per dune.
- Per dune:
  - `height_m` = peak − local base
  - `area_km2`
  - motion stats within the polygon: median speed, heading, uncertainty, fraction of valid vectors → `confidence`
- **Time fix:** the polygons are year-2000 positions. Translate each by its median motion × (2025 − 2000) to get the 2025 position. Keep both.
- **Gap fill:** fit speed = k ÷ height on high-confidence dunes. Apply it where tracking is poor, flagged `speed_source = "height_model"`.
- **Classes** (set the final cutoffs from the real distribution; placeholders):
  - stable < 1 m/yr (or below the detection limit)
  - slow 1–3
  - active 3–8
  - fast > 8
  - plus `threat = true` if heading toward a road/farm within the projection window
- **Resolution limit:** state the minimum resolvable dune (~90 m across / a few m tall).
- **Optional AI cross-check:** Segment Anything (`segment-geospatial`) on the 2025 pan image; report IoU with the elevation-based polygons.

**Step 6 — Threat + forecast frames**
- **Roads/farms:** OSM via Overpass for the AOI (highway=*, landuse=farmland/farmyard, buildings) → GeoJSON.
- **Per dune:** ray from the dune's leading edge along its heading. Distance to the first road/farm intersection ÷ speed range → `reach_year_min` / `reach_year_max` (fast case → median). Use `null` if nothing is hit before 2100.
- **Forecast frames 2026–2050** (yearly, or every 5 years): warp the 2025 pan image forward by the smoothed motion × (year − 2025) with `skimage.transform.warp`, at median and fast-case speed (e.g., the per-pixel 84th percentile, or median + uncertainty; document which).
- This is the radar-nowcasting approach: optical flow + semi-Lagrangian advection.
- **Sand-front hits:** sand pixel mask (pan brightness threshold; validate visually) ∩ 30 m road/farm buffer → first hit year per segment.
- Export frames as transparent PNGs with exact WGS84 bounds.

**Honest limits** (shown in the app's "How we know" panel):
- The projection is advection along measured motion, assuming 2000–2024 conditions continue.
- It does not model dune deformation, merging or splitting.
- Vegetation, windbreaks, leveling and climate change alter the outcome.
- NASADEM shapes are from 2000 and shifted to 2025.
- MERRA-2 is coarse.
- Results are valid for this dune field and period only.

## 4. Data contract (the app is built against these)
All app data lives in **`public/data/`**. Vite serves it at **`/data/...`**, so the app fetches `data/dunes.geojson` etc. The pipeline writes straight into this folder. Coordinates are WGS84 (EPSG:4326) unless noted.

**`data/dunes.geojson`** — FeatureCollection of Polygons (2025 positions). Properties:
```
id (string, "D047"), height_m (number), area_km2 (number),
speed_med_myr (number), speed_lo_myr (number), speed_hi_myr (number),
heading_deg (number, direction of motion, 0=N clockwise),
uncertainty_myr (number), confidence ("high"|"medium"|"low"),
speed_source ("tracked"|"height_model"),
class ("stable"|"slow"|"active"|"fast"), threat (boolean),
nearest_target (string|null, e.g. "Road E22 segment 3"),
distance_to_target_m (number|null),
reach_year_min (int|null), reach_year_max (int|null),
wind_agreement_deg (number, |heading - RDD|)
```

**`data/dunes_2000.geojson`** — the same IDs, year-2000 positions (for the "then vs now" toggle).

**`data/vectors.geojson`** — Points (thinned grid) with `speed_myr`, `heading_deg`, `quality` (0–1).

**`data/targets.geojson`** — roads/farms with `id`, `name`, `type` ("road"|"farm"|"building"), `hit_year_min`, `hit_year_max` (int|null).

**`data/frames/manifest.json`**
```json
{
  "bounds": {"west": 0, "south": 0, "east": 0, "north": 0},
  "observed": [{"year": 2001, "date": "2001-05-12", "scene_id": "...", "sensor": "Landsat 7 ETM+ B8", "pixel_m": 15, "file": "frames/obs_2001.png"}],
  "projected_median": [{"year": 2030, "file": "frames/prj_med_2030.png"}],
  "projected_fast": [{"year": 2030, "file": "frames/prj_fast_2030.png"}]
}
```

**`data/wind_summary.json`**
```json
{
  "location": {"lat": 0, "lon": 0}, "period": "2000-2024", "source": "NASA MERRA-2 U10M/V10M hourly",
  "threshold_kt": 12, "DP": 0, "RDP": 0, "RDD_deg": 0, "RDP_DP": 0, "dp_class": "low|intermediate|high",
  "yearly": [{"year": 2000, "DP": 0, "RDP": 0, "RDD_deg": 0}],
  "sand_rose": [{"sector_deg": 0, "dp": 0}]
}
```

**`data/summary.json`** — headline numbers:
```json
{
  "aoi_name": "Sieh Al Hama, west of Al Ain", "aoi_bounds": {},
  "baseline": {"start_date": "", "end_date": "", "years": 0},
  "n_dunes": 0, "counts_by_class": {"stable": 0, "slow": 0, "active": 0, "fast": 0}, "n_threat": 0,
  "speed_median_myr": 0, "speed_p10_myr": 0, "speed_p90_myr": 0,
  "uncertainty_myr": 0, "mean_wind_agreement_deg": 0,
  "validation": {
    "published": {"reference": "Fareaa 2025 UAEU thesis", "their_value": "", "our_value": "", "note": ""},
    "second_dataset": {"dataset": "NASA HLS L30/S30", "period": "", "their_value": "", "our_value": "", "note": ""}
  },
  "data_handling": {"scenes_rejected": 0, "cloud_masking": "QA_PIXEL / Fmask", "windows_rejected_pct": 0, "notes": ""},
  "limits": ["..."]
}
```

**`data/sources.json`** — the data-citation list the app displays:
```json
[{"name": "Landsat 8-9 OLI/TIRS Collection 2 Level-1", "provider": "NASA / USGS", "used_for": "dune motion (B8, 15 m)",
  "dates": ["2025-05-03"], "place": "Sieh Al Hama AOI", "pixel": "15 m", "link": "...", "doi": "..."}]
```

**First data output:** placeholder versions of all these files with realistic fake values, written to `public/data/`, so the app can be built in parallel.

## 5. Local environment and GitHub repo setup (do this first)
The whole project runs **locally on my laptop**, like God's Eye View:
- one repo
- a Python pipeline that writes data files
- a Vite + CesiumJS app started with one command

If you're working on my laptop, run the commands yourself. Otherwise give me exact steps plus the full contents of every file. My account status is in `environment.md`; ask me for anything missing.

**5.1 Toolchain (check what's installed; give install steps for what's missing; Mac or Windows)**
- **Git** + **GitHub CLI** (`gh`) → `gh auth login` (browser login)
- **Node.js LTS** (for the Vite app)
- **Python 3.11+** with a virtual environment in `pipeline/.venv`
  - packages: `earthengine-api`, `earthaccess`, `geemap`, `scikit-image`, `rasterio`, `geopandas`, `shapely`, `pyproj`, `scipy`, `numpy`, `matplotlib`, `requests`, `jupyter`, `python-dotenv`, plus `segment-geospatial` only if used
  - save them to `pipeline/requirements.txt`
- **VS Code**

**5.2 Accounts and access (verify each with a test)**
- **Google Earth Engine:**
  - noncommercial registration tied to a Google Cloud project, with the Earth Engine API enabled
  - `earthengine authenticate` (browser login) → `ee.Initialize(project=EE_PROJECT)`
  - test: print one Landsat scene ID over the AOI
- **NASA Earthdata Login** (earthaccess / HLS):
  - username and password in `.env` (`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`), loaded with `python-dotenv`
  - `earthaccess.login(strategy="environment")`
  - test: find one HLS granule over the AOI
- **USGS EarthExplorer:** backup only; confirm the account exists.
- **Cesium ion:**
  - access token with allowed URLs = the GitHub Pages URL + `http://localhost:5173`
  - stored in `.env` as `VITE_CESIUM_TOKEN`
  - Cesium client tokens are public by design, so restricting by URL is the protection
- **Google Drive / Colab:** not required. Colab is only a fallback if a GPU is needed.

**5.3 Repo `dunesight` (public, `main` branch, MIT license, teammates as collaborators)**
Create it with `gh repo create dunesight --public` (or give me click steps).
```
dunesight/
├── index.html               ← Vite entry (placeholder: "DuneSight — coming online")
├── src/                     ← app code (written later; scaffold main.js + style.css)
├── public/
│   └── data/                ← placeholder files from §4, replaced by pipeline outputs
│       └── frames/
├── server/                  ← OPTIONAL local proxy (Node/Express) for any secret-key API, God's Eye View–style
├── pipeline/
│   ├── 01_scenes_and_wind.ipynb
│   ├── 02_tracking_and_dunes.ipynb
│   ├── 03_threats_and_frames.ipynb
│   ├── requirements.txt
│   └── raw/                 ← downloaded GeoTIFFs (gitignored)
├── docs/
│   ├── how-we-know.md
│   ├── data-and-credits.md
│   └── build-spec.md
├── .github/workflows/deploy.yml   ← builds with Vite and deploys to GitHub Pages
├── .env.example             ← variable names only, no values
├── .gitignore
├── package.json
├── vite.config.js
├── README.md
└── LICENSE
```
- **App scaffold:**
  - Vite vanilla template + `cesium` + `vite-plugin-cesium`
  - `npm run dev` → `http://localhost:5173`; `npm run build` → `dist/`
  - In `vite.config.js`, set `base: '/dunesight/'` for production so it works on GitHub Pages.
  - The placeholder page shows a Cesium globe and loads `data/summary.json`, proving the data path works.
- **Optional local proxy:** only if a secret-key API is added later (e.g., Gemini or api.nasa.gov). The pattern is a small Node server in `server/` that holds the keys from `.env`, plus a Vite dev-server `proxy` entry. Secret keys never go in `src/` or anything prefixed `VITE_`.
- **One-command start:**
  - `npm run dev` for the app
  - optionally `npm run pipeline` (or a `start.sh` / `start.bat`) to re-run the notebooks headless and refresh `public/data/`
- **`.gitignore`:**
  - `.env`, `node_modules/`, `dist/`
  - `pipeline/.venv/`, `pipeline/raw/`, `__pycache__/`, `.ipynb_checkpoints/`
  - `*.tif`, `*.tiff`, `*.nc`, `*.hdf`, `*.h5`
  - `.DS_Store`
- **`.env.example`:** `EE_PROJECT=`, `EARTHDATA_USERNAME=`, `EARTHDATA_PASSWORD=`, `VITE_CESIUM_TOKEN=`
- **`README.md`:**
  - what DuneSight is, with a screenshot placeholder
  - live link
  - how to run locally (`npm install`, `npm run dev`)
  - how to run the pipeline
  - NASA datasets used
  - the credit line from §7
- **File-size rule:** GitHub rejects files > 100 MB and warns > 50 MB. Raw rasters stay in `pipeline/raw/` (ignored). Keep `public/data/` small (aim < 30 MB) so the app loads fast.
- **Deploy:**
  - `.github/workflows/deploy.yml` builds with Vite and publishes `dist/` to GitHub Pages on every push to `main`
  - Settings → Pages → Source: **GitHub Actions**
  - the Cesium token comes from a repo secret, `VITE_CESIUM_TOKEN`, during the build
- **Verification checklist** (tick through end to end):
  - Earth Engine test ✓
  - earthaccess test ✓
  - `npm run dev` shows the globe and loads `summary.json` ✓
  - first commit pushed ✓
  - GitHub Pages URL live ✓

## 6. Deliverables, in order
0. **Local environment + repo setup (§5)**, including the scaffold, README, .gitignore, .env.example, deploy workflow, LICENSE, and the verification checklist.
1. **Project setup:**
   - Verify the target area: coordinates, a proposed AOI bounding box, that roads/farms are adjacent, and the WRS-2 path/row.
   - Do the Worldview visual check (Step 0) and give me the links to open.
   - Confirm the validation numbers from the UAEU thesis (units and time base).
   - Write the placeholder data files (§4) into `public/data/` and commit.
2. **`pipeline/01_scenes_and_wind.ipynb`:**
   - Earth Engine init (+ earthaccess fallback)
   - AOI
   - Landsat candidate scene table with thumbnails and cloud stats
   - MERRA-2 wind → `wind_summary.json`
3. **`pipeline/02_tracking_and_dunes.ipynb`:**
   - Download of the chosen scenes with cloud masking
   - Feature tracking, QC, uncertainty
   - HLS second-dataset check
   - NASADEM dune labeling → `dunes.geojson`, `dunes_2000.geojson`, `vectors.geojson`
4. **`pipeline/03_threats_and_frames.ipynb`:**
   - OSM targets, threat years
   - Forecast frames + manifest
   - `summary.json`, `sources.json`
5. **Science review:**
   - Review the outputs.
   - Sanity-check every headline number against physics, the UAEU reference and the HLS check.
   - Write `docs/how-we-know.md` (≤ 150-word panel text + a bullet list of limits + data handling).
6. **`docs/data-and-credits.md`:** every dataset used (name, provider, version, dates, place, pixel size, link/DOI) plus the credit text in §7.
7. **`docs/build-spec.md`** (§8), with the final values filled in.

All notebooks write their outputs straight into `public/data/`. Commit after each milestone.

## 7. Credits (must appear in the app and the project write-up)
- Exact line: **"Supported by the Michigan Space Grant Consortium, NASA grant 80NSSC20M0124."**
- Credit NASA as the source of the data and imagery, **naming each dataset** (from `sources.json`).
- **No NASA logos**, and nothing suggesting NASA endorses the project.
- If any Prithvi model is used, cite its paper (Prithvi-EO-2.0: arXiv:2412.02732).
- Credit OpenStreetMap contributors and any basemap provider.

## 8. The build spec (your final hand-off document)
Title it **"Build Spec — DuneSight"** and save it as `docs/build-spec.md`. Include:
1. **Stack (God's Eye View–style, our own code):**
   - **Vite + vanilla JavaScript + CesiumJS** (`cesium` + `vite-plugin-cesium`), no framework.
   - Runs locally with `npm run dev` at `http://localhost:5173`, and deploys to GitHub Pages via the Actions workflow.
   - Code split into modules: `src/main.js` (viewer + fly-in), `src/layers/dunes.js`, `src/layers/vectors.js`, `src/layers/targets.js`, `src/timeline.js`, `src/hud/` (panels, card, compass, dossier), `src/style.css`.
   - Token from `import.meta.env.VITE_CESIUM_TOKEN`.
   - Optional `server/` proxy only for secret-key APIs.
   - **Fallback:** a Leaflet 2D mode with the same UI if Cesium can't render the data reliably.
2. **Screens & interactions:**
   - **Brand:** app name **DuneSight** in the HUD header and the page title.
   - **Fly-in:** globe → UAE → AOI.
   - **Dune polygons colored by class:**
     - stable `#3fb950`, slow `#d29922`, active `#f0883e`, fast `#f85149`
     - threat = pulsing outline
   - **Click → lock-on reticle + info card** with all `dunes.geojson` fields, formatted with units and ± ranges.
   - **Mode buttons:** True color / Motion heat (vectors colored by speed) / Threat (only `threat=true` + targets).
   - **Timeline:**
     - Cesium clock 2001→2050, OBSERVED vs PROJECTED badge
     - observed frames at 100% opacity, each labeled with its **acquisition date, sensor and pixel size**
     - projected median frames fading from 55% to 30% opacity, tinted
     - fast case faint on top
     - targets turn red at `hit_year_min`
     - play/pause, 1 year per ~0.6 s
   - **HUD panels:** wind compass (RDD + RDP/DP), counts by class, headline stats from `summary.json`, data source line.
   - **"How we know" dossier panel:**
     - method
     - NASA datasets with dates and links (from `sources.json`)
     - pixel sizes, cloud/missing-data handling
     - uncertainty
     - validation (UAEU study + HLS second dataset)
     - limits
     - pipeline notebook links
   - **Credits footer:** the exact §7 line, NASA dataset credits, OSM/basemap credits, no NASA logos.
   - **Then-vs-now toggle** (`dunes_2000` vs `dunes`).
   - **Optional:** Landsat 8/9 orbit track from CelesTrak TLEs (satellite.js); animated wind streaks along RDD.
3. **Style:**
   - Dark "satellite intelligence" HUD, inspired by God's Eye View: monospace font, thin cyan/amber lines, subtle scanlines, corner brackets.
   - Large type for key numbers.
4. **Data contract:** §4 verbatim, plus the real values.
5. **Offline-capable:** all data local in `public/data/`, plus a basemap fallback if the network drops.
6. **Acceptance tests:**
   - `npm run dev` starts cleanly
   - loads in under 5 s
   - fly-in works
   - clicking any dune shows a full card
   - timeline plays end to end
   - targets turn red in the correct year
   - every number on screen has units + source
   - every observed frame shows its date
   - credits footer present
   - production build works on GitHub Pages
   - works at 1080p
7. **Explain-it notes:** a one-line plain-English description of what each module does.

## 9. Definition of done
- `npm run dev` runs DuneSight locally, and the `dunesight` repo deploys to GitHub Pages.
- The `public/data/` files are real, validated (against the published study and HLS), internally consistent, with units, dates, pixel sizes and sources.
- `docs/how-we-know.md`, `docs/data-and-credits.md` and `docs/build-spec.md` are delivered.
- Every claim on screen is defensible to a remote-sensing expert.
