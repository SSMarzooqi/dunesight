# DuneSight — Environment & Accounts

Do NOT put passwords here. Real secrets go only in the local `.env` file (gitignored).

## Laptop toolchain (runs everything locally)
- VS Code: ✅ / ❌
- Git: ✅ / ❌ · GitHub CLI (`gh auth login` done): ✅ / ❌
- Node.js LTS: ✅ / ❌ (runs the app: `npm run dev` → http://localhost:5173)
- Python 3.11+: ✅ / ❌ (runs the pipeline in `pipeline/.venv`)
- OS: Mac / Windows

## Data accounts
- Earth Engine Cloud **Project ID**: `____________` (`.env` → `EE_PROJECT`)
- Earth Engine registered as noncommercial / academic: ✅ / ❌ · `earthengine authenticate` done: ✅ / ❌
- NASA Earthdata Login: ✅ / ❌ (`.env` → `EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`)
- USGS EarthExplorer: ✅ / ❌ (backup only)
- NASA POWER, OpenStreetMap Overpass: no key needed
- Google Drive / Colab: not required (Colab only as a GPU fallback)

## App
- GitHub repo: `https://github.com/____________/dunesight` (public)
- GitHub Pages URL (deployed by GitHub Actions): `https://____________.github.io/dunesight/`
- Cesium ion token (allowed URLs: Pages URL + http://localhost:5173): in `.env` → `VITE_CESIUM_TOKEN`, and as a GitHub repo secret with the same name
- Local run: `npm install` once, then `npm run dev`

## Team
- Data lead: `________`
- App lead: `________`
- Design/story lead: `________`
- Target area: Sieh Al Hama dune field, west of Al Ain (confirm ✅ / ❌)
