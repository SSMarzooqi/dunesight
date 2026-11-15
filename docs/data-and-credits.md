# Data and credits

Every dataset DuneSight actually uses, as recorded in `public/data/<site>/sources.json` by notebook 03 (read 2026-11-15). The app's dossier lists the same entries per site, with the full scene and granule dates. Links and DOIs were opened on 2026-11-15; what each one returned is noted.

## Places

| Site | Box (WGS84 degrees) | Landsat WRS-2 | HLS tile |
|---|---|---|---|
| Seih Al Hama, SW of Al Ain | W 55.475, S 24.015, E 55.575, N 24.105 | path 160, row 43 | T40QCM |
| Sweihan dune field, NW of Al Ain | W 55.29, S 24.42, E 55.39, N 24.51 | path 160, row 43 | T40RCN |
| Liwa, eastern crescent (Wadhil / Mawsil) | W 54.08, S 23.00, E 54.18, N 23.09 | path 160, row 44 | T40QBL |

All processing is on one 15 m grid in UTM zone 40N (EPSG:32640) per site.

## NASA data (the measurements)

| Dataset | Provider, version | Used for | Dates used | Pixel | Link / DOI |
|---|---|---|---|---|---|
| Landsat 7 ETM+ Collection 2 Level-1 (Tier 1) | NASA / USGS, Collection 2 | long-baseline motion check and the first timeline frames (B8 pan); vegetation mask (B3/B4); display-only timeline images 2002-2012 (B8, scan-line gaps left as no data; off-month where November had no usable scene; not used for any measurement) | measurement check: 2000-11-27, 2001-11-30 (all three sites; before the 31 May 2003 SLC failure). Display only, November: 2003-11-04 (Seih Al Hama), 2003-11-20 (Liwa), 2005-11-09, 2008-11-17, 2011-11-10, 2012-11-12. Display only, off-month: 2002-09-30 (Seih Al Hama, Sweihan), 2002-10-16 (Liwa), 2003-12-22 (Sweihan), 2004-10-21, 2006-10-11, 2007-10-14, 2009-10-19, 2010-10-06 (all three sites) | 15 m (B8), 30 m (QA_PIXEL, B3/B4) | https://doi.org/10.5066/P9TU80IG (resolves to the USGS EROS Landsat 7 ETM+ C2 L1 page) |
| Landsat 8-9 OLI/TIRS Collection 2 Level-1 (Tier 1) | NASA / USGS, Collection 2 | dune motion (B8 pan, all pairs of 12 November scenes), timeline and projected frames, illumination test, vegetation mask | 12 November scenes 2013-11-07 to 2025-11-08 at each site (no usable November scene in 2018 at Seih Al Hama and Sweihan, in 2016 at Liwa); 23-24 extra October/December scenes per site for the illumination test | 15 m (B8), 30 m (QA_PIXEL, B4/B5) | https://doi.org/10.5066/P975CC9B (resolves to the USGS EROS Landsat 8-9 OLI/TIRS C2 L1 page); https://www.usgs.gov/landsat-missions/landsat-collection-2-level-1-data |
| HLS Sentinel-2 MSI Surface Reflectance (HLSS30) | NASA LP DAAC, v2.0 | the independent second-dataset motion check (B4 red, Fmask); farm NDVI over the last year | 10 November granules 2016-11-15 to 2025-11-08 (Seih Al Hama), to 2025-11-13 (Sweihan), to 2025-11-11 (Liwa); farm composite 2024-11-01 to 2025-12-01 | 30 m | https://doi.org/10.5067/HLS/HLSS30.002 (resolves to the Earthdata catalogue page) |
| HLS Landsat OLI Surface Reflectance and TOA Brightness (HLSL30) | NASA LP DAAC, v2.0 | same-instrument motion check (context only); farm NDVI | 12 (13 at Liwa) November granules 2013-11-07 to 2025-11-08; farm composite as above | 30 m | https://doi.org/10.5067/HLS/HLSL30.002 (resolves to the Earthdata catalogue page) |
| MERRA-2 tavg1_2d_slv_Nx (M2T1NXSLV), U10M and V10M | NASA GMAO / GES DISC, 5.12.4 | sand drift potential (Fryberger DP, RDP, RDD) and the year-to-year wind check | hourly, 2000-01-01 to 2024-12-31 | 0.5° × 0.625° (one grid cell per site) | https://doi.org/10.5067/VJAFPLI1CSIV (resolves); https://disc.gsfc.nasa.gov/datasets/M2T1NXSLV_5.12.4/summary |
| MERRA-2 tavg1_2d_aer_Nx (M2T1NXAER), TOTEXTTAU and DUEXTTAU | NASA GMAO / GES DISC, 5.12.4 | haze screen of candidate scenes | the acquisition hours of the candidate scenes, 2000-2025 | 0.5° × 0.625° | https://doi.org/10.5067/KLICLTZ8EM9D (resolves); https://disc.gsfc.nasa.gov/datasets/M2T1NXAER_5.12.4/summary |
| NASA POWER hourly (MERRA-2 based), WS10M/WD10M and U10M/V10M | NASA Langley Research Center, POWER API v2 as served 2026-11 | processing cross-check of the MERRA-2 wind numbers | 2001-01-01 to 2024-12-31 | 0.5° × 0.625° (MERRA-2 source) | https://power.larc.nasa.gov/ (no dataset DOI) |
| NASADEM Merged DEM Global 1 arc second (NASADEM_HGT) | NASA JPL / LP DAAC, V001 | dune outlines and heights | SRTM radar, 2000-02-11 to 2000-02-22 | 1 arc-second (about 30 m) | https://doi.org/10.5067/MEaSUREs/NASADEM/NASADEM_HGT.001 (resolves to the Earthdata catalogue page) |

All NASA data were accessed through Google Earth Engine (`LANDSAT/LE07/C02/T1`, `LANDSAT/LC08/C02/T1`, `LANDSAT/LC09/C02/T1`, `NASA/HLS/HLSS30/v002`, `NASA/HLS/HLSL30/v002`, `NASA/GSFC/MERRA/slv/2`, `NASA/GSFC/MERRA/aer/2`, `NASA/NASADEM_HGT/001`), except NASA POWER (its own API). Scene IDs, sun angles and acquisition times are in each site's `sources.json` and `frames/manifest.json`.

## Other data

| Dataset | Provider, version | Used for | Dates | Pixel | Link / DOI |
|---|---|---|---|---|---|
| NOAA Integrated Surface Database (ISD, Global Hourly) | NOAA National Centers for Environmental Information, as served by the NOAA Open Data bucket `noaa-global-hourly-pds` (retrieved 2026-11) | ground-station check of the wind direction, Seih Al Hama only (Al Ain International, ISD 41218099999, 24 km NNE of the box; Buraimi, ISD 41244099999, 32 km, as a second station). The station results for Sweihan and Liwa were checked but are not published (see `docs/how-we-know.md`) | 2000-01-01 to 2024-12-31, hourly reports | one point per station | https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database (opened). No dataset DOI is given there; the page lists the reference paper Smith, Lott and Vose (2011), Bull. Amer. Meteor. Soc. 92, 704-708, https://doi.org/10.1175/2011BAMS3015.1 (resolves to journals.ametsoc.org) |
| ESA WorldCover 10 m 2021 | European Space Agency, v200 | non-dune mask and the farm cross-check | 2021 | 10 m | https://doi.org/10.5281/zenodo.7254221 (resolves to Zenodo); https://esa-worldcover.org/ |
| OpenStreetMap | OpenStreetMap contributors, ODbL 1.0 | roads and built-up areas (targets); non-dune mask | database timestamps 2026-11-15T03:35:51Z (Seih Al Hama) and 2026-11-15T04:10:14Z (Sweihan, Liwa); Overpass queries recorded in `targets.geojson` | vector | https://www.openstreetmap.org/copyright |

Display only (not measurements): Cesium ion imagery (Bing Maps Aerial) and Cesium World Terrain when a token is set, otherwise Esri World Imagery; CesiumJS for the globe.

## Software and typeface

| Item | Licence | Used for |
|---|---|---|
| CesiumJS | Apache 2.0 | the 3D globe |
| IBM Plex Sans (400, 500, 600) and IBM Plex Mono (400), © IBM Corp., packaged as `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` | SIL Open Font License 1.1 (https://openfontlicense.org; the licence text ships in `node_modules/@fontsource/ibm-plex-sans/LICENSE`) | all interface text. The font files are bundled with the app and served from the same origin, so the app makes no third-party font request and keeps its typeface when the network drops after load. |

## Credits

Supported by the Michigan Space Grant Consortium, NASA grant 80NSSC20M0124.

Data and imagery courtesy of NASA (Landsat 7 ETM+, Landsat 8-9 OLI, HLS S30, HLS L30, MERRA-2, NASA POWER, NASADEM) and the U.S. Geological Survey. Station wind data: NOAA NCEI. Land cover: ESA WorldCover. Roads and buildings © OpenStreetMap contributors. Typeface: IBM Plex (SIL Open Font License 1.1). This project is not endorsed by NASA, and it uses no NASA logos. No Prithvi model is used.

## Link check (2026-11-15)

Opened with `curl -L`: the Earthdata, GES DISC, NASA POWER, NCEI, Zenodo, ESA WorldCover and OpenStreetMap links returned HTTP 200. The two Landsat DOIs redirect from doi.org to the USGS EROS pages, which answered with a gateway timeout (504) at the time of the check; they are listed as resolving targets, not as pages read today. The AMS DOI redirects to journals.ametsoc.org, which refused the automated request (403).
