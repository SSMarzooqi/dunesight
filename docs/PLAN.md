# DuneSight — Project Plan

Source of truth for requirements: `handoff.md` (sections cited as §N). This file is the execution plan.

## Roles
- **Planning and review:** the plan, a brief for each phase, a review of every phase's output against the gate, and the science review.
- **Phase work:** setup, pipeline notebooks, docs, and the app.
- **Sultan:** browser logins, secrets into `.env`, decisions (AOI, scene list, class cutoffs).

## Starting state (checked 2026-11-14)
| Item | State |
|---|---|
| macOS 27 arm64, 210 GB free | ok |
| Git 2.52, GitHub CLI logged in as `SSMarzooqi` (repo + workflow scopes) | ok |
| Node 24.18 / npm 11.16 | ok |
| Python 3.14 (python.org and Homebrew) | ok; fall back to 3.12 only if a geo wheel is missing |
| Repo `SSMarzooqi/dunesight` | does not exist yet |
| Earth Engine credentials | none (`~/.config/earthengine` absent) |
| NASA Earthdata Login | none configured |
| Cesium ion token | none configured |
| NASA POWER API | reachable, no key |

Repo root is this folder (`~/DuneSight`); GitHub name `dunesight`.

## Phases and gates

Each phase ends at a gate. Nothing moves on until the gate has been checked, and where marked **(Sultan)**, until Sultan has confirmed.

### Phase 0 — Environment and repo scaffold (§5) · no accounts needed
- `git init` (main), full tree from §5.3, MIT license, `.gitignore`, `.env.example`, empty `.env`.
- Vite vanilla + `cesium` + `vite-plugin-cesium`; placeholder page with a globe that loads `data/summary.json`; works with no ion token (non-ion basemap fallback).
- `pipeline/.venv` + `requirements.txt` (pinned to what installed); three notebook stubs; `npm run pipeline`.
- `pipeline/aoi.json` (single place the AOI lives) and `pipeline/make_placeholders.py` → all §4 files in `public/data/`, marked placeholder.
- `.github/workflows/deploy.yml` (Pages via Actions, `VITE_CESIUM_TOKEN` secret).
- **Gate:** `npm run build` passes; dev server serves the page and `data/summary.json`; venv imports every package; first local commit.
- Then **(Sultan)**: create the public GitHub repo, push, enable Pages, confirm the live URL.

### Phase 1 — Target-area verification (§6.1) · no accounts needed · runs alongside Phase 0
- Locate Sieh Al Hama from citable sources (OSM/GeoNames, the Fareaa 2025 UAEU thesis). No invented coordinates.
- Propose an AOI box (5×5 up to 10×10 km) with dunes plus adjacent roads/farms; UTM zone; WRS-2 path/row.
- Step 0 visual check: Worldview share links + saved GIBS snapshots, looked at, not just downloaded.
- Thesis numbers: what "3.32 m" is (per what time base, which sensor, which area).
- Preliminary Landsat candidate list from the public USGS STAC catalogue.
- Output: `docs/research/aoi-verification.md`.
- **Gate (Sultan):** confirm the AOI box. Placeholders are regenerated on the confirmed box.

### Phase 2 — Notebook 01: scenes and wind (§3 Steps 1, 4) · needs Earth Engine
- Access tests: Earth Engine (print one Landsat scene ID over the AOI) and earthaccess (find one HLS granule).
- Candidate scene table: L7 2000–2002 (pre SLC-off), L8/9 2013–2025, same month, same path/row; date, sun elevation/azimuth, scene cloud cover, in-AOI cloud % from `QA_PIXEL`, thumbnails. Rejections logged with the reason.
- MERRA-2 hourly U10M/V10M 2000–2024 at the AOI centroid → Fryberger DP/RDP/RDD, yearly table, 16-sector sand rose → `wind_summary.json`. NASA POWER run as a cross-check.
- **Gate (Sultan):** confirm the scene list. The review checks the wind maths (units in knots, FROM vs downwind direction, DP class).

### Phase 3 — Notebook 02: tracking and dunes (§3 Steps 2, 2b, 3, 5) · needs Earth Engine + Earthdata
- Download clipped B8 GeoTIFFs to `pipeline/raw/` on one 15 m UTM grid.
- Phase-correlation tracking (32 px windows, 8 px step, subpixel), long baseline + yearly pairs 2013–2025.
- QC: stable-ground offset removal, uncertainty from stable-ground residuals (NMAD), low-quality rejection with % and reasons, plausibility check.
- HLS repeat ~2016→2025 with Fmask; compare speed and heading over the overlapping period.
- NASADEM detrend → prominence peaks → watershed polygons; per-dune stats; shift 2000→2025; height-model gap fill; classes from the real distribution.
- Outputs: `dunes.geojson`, `dunes_2000.geojson`, `vectors.geojson`.
- **Gate:** science review of sign conventions, the detection limit vs measured speeds, HLS agreement, heading vs RDD. If the signal is below the noise floor, we say so and narrow the claim.

### Phase 4 — Notebook 03: threats and frames (§3 Step 6)
- OSM roads/farms/buildings via Overpass → `targets.geojson`.
- Ray-cast reach years per dune (speed range → min/max year, null past 2100).
- Observed frames + projected frames 2026–2050 (median and fast case, method documented), transparent PNGs with exact WGS84 bounds, `frames/manifest.json`.
- Sand-front hits on buffered targets; `summary.json`, `sources.json`.
- **Gate:** all §4 files validate against the contract; `public/data/` under 30 MB; numbers consistent across files.

### Phase 5 — Science review and docs (§6.5–6.6)
- Every headline number checked against physics, the thesis, and HLS.
- `docs/how-we-know.md` (≤150-word panel text, limits, data handling), `docs/data-and-credits.md` (every dataset with version, dates, place, pixel, link/DOI, plus the §7 credit line).

### Phase 6 — Build spec and app (§8)
- `docs/build-spec.md` with real values.
- Build the app to the spec: modules per §8.1, fly-in, dune layer + info card, modes, timeline (observed vs projected), HUD, "How we know" dossier, then-vs-now, credits footer, Leaflet fallback only if Cesium can't render the data.
- **Gate:** the §8.6 acceptance tests, run in a real browser.

### Phase 7 — Deploy and done (§9)
- Push, Pages build green, live URL loads, README screenshot, `environment.md` filled in.

## Scope change (2026-11-14): three sites

Sultan asked for the same analysis at three deserts, not one:

| Site id | Place | Status |
|---|---|---|
| `seih_al_hama` | Seih Al Hama, SW of Al Ain | Box chosen: S 24.015, W 55.475, N 24.105, E 55.575 (see `docs/research/aoi-verification.md`). Runs first. |
| `sweihan` | Sweihan dune field, NW of Al Ain | Box to be located and verified (Phase 1b). |
| `liwa` | Liwa, southern Abu Dhabi | Box to be located and verified (Phase 1b). Megadunes are expected to move below the detection limit; if so the app says exactly that. |

How this changes the plan:
- **One box per site, about 10 × 10 km, placed where dunes meet roads, farms and buildings**, because the tool's question is where the next windbreak goes. A whole desert is not tracked; the box is a config value and can be enlarged later.
- **Config:** `pipeline/sites.json` replaces `pipeline/aoi.json`. Every notebook takes a site id and is run once per verified site.
- **Data layout:** `public/data/sites.json` lists the sites; each site has the full §4 file set under `public/data/<site_id>/`. The §4 formats are unchanged inside each folder.
- **Executed notebooks** are saved per site under `pipeline/runs/<site_id>/`.
- **App:** adds a site switcher; the fly-in goes to the chosen site.
- **Order:** Seih Al Hama goes through Phases 2–4 first. Sweihan and Liwa follow through the same notebooks once their boxes are verified. Each site gets its own validation notes and limits.
- **Size budget:** `public/data/` under 30 MB in total across all three sites.

Thesis (decided by Sultan 2026-11-14): the Fareaa 2025 thesis is supporting context only, not something we replicate. Because its abstract gives no time base for "3.32 m", we cite it as "a UAEU study measured dune migration here with Sentinel-2 in 2018–2020" and make no numeric comparison. The independent quantitative check is the HLS repeat. If a numeric comparison is wanted later, Sultan will supply the PDF (into `docs/research/papers/`, gitignored).

## Standing rules for every phase
- NASA data is the measurement source; snapshots are display only.
- No invented coordinates, dates or scene IDs; every number carries dataset, date, place and link.
- Ranges and uncertainty, not single numbers. Log what was dropped and why.
- Notebooks: each cell starts `# WHAT THIS DOES:`; executed headless with outputs saved.
- Secrets only in `.env` (gitignored). Never in chat, code, or anything `VITE_` except the URL-restricted Cesium token.
- Commit after each milestone; raw rasters stay in `pipeline/raw/` (ignored).

## What blocks on Sultan
1. Earth Engine: a registered Cloud project ID, then one browser login (`earthengine authenticate`). Blocks Phases 2–4.
2. NASA Earthdata Login in `.env`. Blocks the HLS check in Phase 3.
3. Cesium ion token in `.env`. Needed for ion terrain/imagery; the scaffold runs without it.
4. Go-ahead to create the public repo and push.
5. Confirmations at the gates: AOI box, scene list, class cutoffs.
