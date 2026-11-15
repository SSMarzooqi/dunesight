# DuneSight — Environment & Accounts

Do NOT put passwords here. Real secrets go only in the local `.env` file (gitignored).

Status checked 2026-11-14.

## Laptop toolchain (runs everything locally)
- VS Code: ✅
- Git: ✅ (2.52) · GitHub CLI (`gh auth login` done): ✅ (account `SSMarzooqi`)
- Node.js LTS: ✅ (v24.18; runs the app: `npm run dev` → http://localhost:5173)
- Python 3.11+: ✅ (3.14.7; runs the pipeline in `pipeline/.venv`). Python's "Install Certificates" step has been run (needed for HTTPS on the python.org build).
- OS: Mac (macOS 27, Apple silicon)

## Data accounts
- Earth Engine Cloud **Project ID**: `dunesite` (`.env` → `EE_PROJECT`)
- Earth Engine registered as noncommercial / academic: ✅ · `earthengine authenticate` done: ✅ (test query returned `LC08_160043_20240106`)
- NASA Earthdata Login: ✅ (`.env` → `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`; test search returned `HLS.L30.T40RCN.2024126T064546.v2.0`)
- USGS EarthExplorer: not confirmed (backup only)
- NASA POWER, OpenStreetMap Overpass: no key needed
- Google Drive / Colab: not required (Colab only as a GPU fallback)

## App
- GitHub repo: `https://github.com/SSMarzooqi/dunesight` (public)
- GitHub Pages URL (deployed by GitHub Actions): `https://ssmarzooqi.github.io/dunesight/`
- Cesium ion token (allowed URLs: Pages URL + http://localhost:5173): in `.env` → `VITE_CESIUM_TOKEN`, and as a GitHub repo secret with the same name ✅ (allowed-URL restriction not yet confirmed)
- Local run: `npm install` once, then `npm run dev`

## Team
- Data lead: `________`
- App lead: `________`
- Design/story lead: `________`
- Target area: Sieh Al Hama dune field, west of Al Ain (verification in progress, see `docs/research/aoi-verification.md`)
