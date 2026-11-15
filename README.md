# DuneSight

A "spy satellite for sand dunes": a 3D globe app that flies from orbit to a UAE dune field west of Al Ain, where every dune is outlined, labelled and tracked (height, speed ± uncertainty, heading, confidence, and threat to roads and farms). A weather-radar-style timeline plays the observed Landsat years and then fades into projected frames to 2050, to help planners decide where and when to build windbreaks.

> **Status:** scaffold. The data in `public/data/` is **PLACEHOLDER** (fake values for app development), and the area of interest in `pipeline/aoi.json` is an unverified placeholder box.

*[Screenshot placeholder: added once the app is built, as `docs/screenshot.png`.]*

**Live:** https://ssmarzooqi.github.io/dunesight/ (not deployed yet)

## Run the app locally

Needs Node.js (LTS or newer).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/ (base path /dunesight/)
```

Optional: copy `.env.example` to `.env` and set `VITE_CESIUM_TOKEN` to a Cesium ion token (allowed URLs: the Pages URL and `http://localhost:5173`). Without a token the globe uses Esri World Imagery and a flat ellipsoid.

## Run the pipeline

Needs Python 3.11+ (tested on 3.14).

```bash
python3 -m venv pipeline/.venv
pipeline/.venv/bin/pip install -r pipeline/requirements.txt
npm run placeholders   # regenerate PLACEHOLDER files in public/data/ from pipeline/aoi.json
npm run pipeline       # execute the three notebooks headless, outputs saved in place
```

The area of interest lives only in `pipeline/aoi.json`. Earth Engine (`EE_PROJECT`) and NASA Earthdata (`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`) credentials go in `.env`, which is never committed. Downloaded rasters go in `pipeline/raw/` (ignored by git).

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
