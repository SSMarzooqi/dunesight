# DuneSight

A "spy satellite for sand dunes": a 3D globe app that shows where dune sand is measurably moving at three UAE sites (Seih Al Hama and Sweihan near Al Ain, and the eastern Liwa crescent), how fast, in which direction and how sure we are, and which roads, farms and built-up areas that moving sand reaches and when. It is built for planners and farm owners deciding where the next windbreak should go.

The measured motion is slow (around a metre per year), so the app shows it honestly: a motion-vector field on a stated time scale, "below detection limit" instead of zero, ranges instead of single numbers, and projections clearly labelled as projections. A weather-radar-style timeline plays the observed November Landsat scenes (with the 2002–2012 gap shown as a gap) and then the projected frames to 2050.

![DuneSight: Seih Al Hama in Motion mode](docs/screenshots/seih-motion-1080p.png)

**Live:** https://ssmarzooqi.github.io/dunesight/

## Run the app locally

Needs Node.js (LTS or newer).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/ (base path /dunesight/)
```

Optional: copy `.env.example` to `.env` and set `VITE_CESIUM_TOKEN` to a Cesium ion token (allowed URLs: the Pages URL and `http://localhost:5173`). Without a token the globe uses Esri World Imagery and a flat ellipsoid.

**Using it.** Pick a site in the header; *True view*, *Motion* and *Threat* are presets of the layers. Click an arrow, a dune outline or a road/farm/built-up target for its card (Esc clears). The timeline plays with the button or the space bar; arrow keys step. *How we know* opens the method, sources, validation and limits for the site. Module-by-module notes and the design choices are in [docs/explain-it.md](docs/explain-it.md).

**Tests.** `npm run test:e2e` builds, then runs the Playwright acceptance suite (spec section 8) against the dev server and against the production build served under `/dunesight/` (first time: `npx playwright install chromium`). `npm run test:e2e:dev` runs only the dev pass. Set `E2E_SWIFTSHADER=1` to force software WebGL.

## Run the pipeline

Needs Python 3.11+ (tested on 3.14).

```bash
python3 -m venv pipeline/.venv
pipeline/.venv/bin/pip install -r pipeline/requirements.txt
npm run placeholders   # write PLACEHOLDER files for every verified site (never overwrites real results)
npm run pipeline       # run notebooks 01 -> 02 -> 03 headless for every verified site
```

**Sites.** Site boxes live only in `pipeline/sites.json` (id, name, bbox, EPSG, WRS-2 path/row, `verified`, source note). Each notebook reads its site from the `DUNESIGHT_SITE` environment variable (default `seih_al_hama`); `npm run pipeline` (`pipeline/run_pipeline.py`) loops over the verified sites, and `--site <id>` / `--only 01` narrow it. Shared code is in `pipeline/dunesight/`.

**Where things go.**
- `public/data/sites.json`: the site list for the app, with each site's status and which of its files are `real` or `placeholder`.
- `public/data/<site_id>/`: the handoff §4 data files for that site (`summary.json`, `dunes.geojson`, `dunes_2000.geojson`, `vectors.geojson`, `targets.geojson`, `wind_summary.json`, `sources.json`, `frames/`).
- `pipeline/runs/<site_id>/`: executed copies of the notebooks, with outputs, as documentation. The source notebooks in `pipeline/` are kept without outputs.
- `pipeline/outputs/<site_id>/`: small working outputs (candidate-scene tables, rejection logs, the proposed scene list, wind tables, figures).
- `pipeline/raw/<site_id>/`: downloads and caches (ignored by git). Set `DUNESIGHT_REFRESH=1` to re-query instead of using the cache.

Earth Engine (`EE_PROJECT`) and NASA Earthdata (`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`) credentials go in `.env`, which is never committed.

## NASA datasets

- Landsat 7 ETM+ and Landsat 8/9 OLI Collection 2 Level-1, panchromatic band B8 (15 m): dune motion
- Harmonized Landsat Sentinel-2 (HLSL30 / HLSS30) v2.0 (30 m): independent second-dataset check
- MERRA-2 hourly 10 m wind (U10M, V10M), with NASA POWER as a cross-check: sand drift potential
- NASADEM (30 m, February 2000): dune outlines and heights

Full citations (versions, dates, DOIs) will be in [docs/data-and-credits.md](docs/data-and-credits.md). Also used: OpenStreetMap (roads and farms, © OpenStreetMap contributors) and Esri / Cesium basemaps for display.

## Credits

Supported by the Michigan Space Grant Consortium, NASA grant 80NSSC20M0124.

Data and imagery courtesy of NASA and USGS (datasets listed above). This project is not endorsed by NASA.

## License

MIT, see [LICENSE](LICENSE).
