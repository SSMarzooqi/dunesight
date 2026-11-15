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
- Live URL (GitHub Pages custom domain, deployed by GitHub Actions, HTTPS enforced): `https://dunesight.us/` (`https://www.dunesight.us/` and the old project-site address redirect there; see README, Deployment); repository variable `DS_BASE` = `/`
- Cesium ion token (regenerated 2026-11-15; allowed URLs: `https://dunesight.us`, `https://www.dunesight.us`, `http://localhost:5173`; read-only public scopes): in `.env` → `VITE_CESIUM_TOKEN`, and as a GitHub repo secret with the same name ✅
- Local run: `npm install` once, then `npm run dev` (must stay on `http://localhost:5173` for the token to work; elsewhere the app uses the Esri fallback)

## Team
- Data lead: `________`
- App lead: `________`
- Design/story lead: `________`
- Target areas (three sites, boxes in `pipeline/sites.json`, verified and confirmed 2026-11-14):
  - Seih Al Hama, SW of Al Ain: W 55.475, S 24.015, E 55.575, N 24.105 (`docs/research/aoi-verification.md`)
  - Sweihan dune field, NW of Al Ain: W 55.29, S 24.42, E 55.39, N 24.51 (`docs/research/aoi-sweihan-liwa.md`)
  - Liwa, eastern crescent (Wadhil / Mawsil): W 54.08, S 23.00, E 54.18, N 23.09 (`docs/research/aoi-sweihan-liwa.md`)
