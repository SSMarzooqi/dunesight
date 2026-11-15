# Explain it: what each app module does

One line per module, copied from the comment at the top of each file.

| Module | What it does |
|---|---|
| `src/main.js` | Boots DuneSight: creates the globe, loads the site index, runs the fly-in, builds each site's layers on first visit and wires state, timeline, picking and HUD together. |
| `src/basemap.js` | Creates the Cesium viewer: ion terrain + imagery when a token works, otherwise Esri imagery on a flat globe, and a dark globe with a note when the basemap is offline. |
| `src/data.js` | Fetches and caches the static site data under public/data/ (base-path aware) and derives a few values the HUD needs. |
| `src/state.js` | App state (site, mode, timeline position, selection, toggles) plus a tiny event emitter that modules subscribe to. |
| `src/format.js` | Number, unit, range, compass-point, date and year formatting in one place, so nothing prints "null", "undefined" or "NaN". |
| `src/geo.js` | Small geodesy helpers: metre offsets on the ground around a lon/lat, polygon rings, centroids and point-in-polygon. |
| `src/timeline.js` | Timeline model and control: weather-radar style bar from the first observed scene to 2050 with real gaps, observed/projected division, play/step/scrub and the label of the frame on screen. |
| `src/layers/frames.js` | Imagery-frame layer: drapes the manifest's observed Landsat frames and amber-tinted projected frames on the globe inside the exact frame bounds, with cross-fades and an optional changed-pixel overlay. |
| `src/layers/vectors.js` | Motion-vector layer: one ground-clamped arrow per detected 480 m window, pointing along heading_deg, coloured by speed, length on a stated time scale, plus true-scale displacement tracks in projected years. |
| `src/layers/targets.js` | Target layer: road segments, farms and built-up areas from targets.geojson, batched into a few ground primitives and coloured by threat status at the timeline year. |
| `src/layers/dunes.js` | Large-dune layer: NASADEM-resolved dune outlines (2025 positions) coloured by class with id labels, threat pulse, and the year-2000 outlines dotted for then-vs-now. |
| `src/layers/util.js` | Shared helpers for the batched ground primitives: colour attributes, readiness, line/polygon instances and colour ramps. |
| `src/hud/header.js` | HUD header: DuneSight brand, site switcher, mode buttons, OBSERVED/PROJECTED badge with year, view buttons and the dossier button. |
| `src/hud/panels.js` | HUD panels: collapsible panel frame (state kept per session), the headline numbers from summary.json, and the ranked list of reached targets in Threat mode. |
| `src/hud/card.js` | Info cards for a picked dune, target or motion arrow: every number with units and its range where the data gives one, plus the data source. |
| `src/hud/compass.js` | Wind compass: 16-sector MERRA-2 sand rose (wind FROM), the resultant drift direction (sand moves TOWARD), the measured dune heading, and the optional station result. |
| `src/hud/legend.js` | Map legend for the current mode: speed ramp and arrow scale (with its scale factor), target status colours, dune classes and their toggles. |
| `src/hud/dossier.js` | "How we know" dossier for the current site, composed from the data files: method, datasets with links/DOIs, data handling, uncertainty, validation, threat definition, limits and repo links. |
| `src/hud/credits.js` | Credits footer: the exact grant line, NASA datasets named from sources.json, OpenStreetMap and basemap credits, and the Cesium credit display. |
| `src/style.css` | DuneSight HUD: dark satellite-intelligence styling, layout of panels around the globe, timeline and credits. |
| `tests/e2e/acceptance.spec.js` | Acceptance tests from docs/build-spec.md section 8 (the automatable ones), run against the real data files. |
| `tests/e2e/helpers.js` | Shared e2e helpers: read the real data files, boot the app and wait for a site, collect console errors. |
| `playwright.config.js` | Playwright e2e config: dev server or production build under /dunesight/, plus a token-less dev server for the fallback test. |

## Design choices the spec left open

- **Arrow scale.** Arrow length is a stated time scale: ×1 = 100 years of motion at the measured speed (1 m/yr → 100 m). Sites whose median speed is under 1.5 m/yr open at ×2 (200 years) so the arrows are readable; the legend always prints the scale in use, and ×1/×2/×4 can be chosen. Arrows start at the window centre (tail = where it was measured).
- **Speed colours.** One cool ramp (dark blue → cyan → pale green) with a fixed 0–4 m/yr domain for all sites, so colours compare across sites and never look like the warm threat colours of the targets. Opacity encodes match quality. Arrows have a thin dark outline so they read on bright sand.
- **Timeline stops.** Every observed frame, then every year from the latest scene to 2050 (so a target's reach year can be shown exactly). Between projected frames the most recent projected frame stays on screen and the label says which frame it is; 2026–2029 show the latest observed image and say so. Observation gaps are hatched and labelled, never interpolated.
- **Target colouring.** A target with a reach year is faint in its status colour before that year and bright (pulsing) from it on, under the fast-case rule (hit_year_min) or the median rule (hit_year_med). “Sand at edge now” targets are bright from the latest observed frame on. “Possible within direction uncertainty” has no year and is always purple; “not reached by 2100” is slate.
- **Reach ray.** A selected target shows the reach ray from the migrating sand edge to the footprint (solid amber), with a faint dashed link to the 480 m window whose motion was used.
- **Changed pixels.** An optional overlay marks pixels of the median projection that differ from the latest observed frame by more than 10 grey levels (the manifest's own change statistic), keeping only pixels with at least three such neighbours so JPEG noise in the observed frame is not shown as change.
- **Optional station file.** `station_wind.json` is requested only when the site's data refers to it (listed in `sites.json` files, or mentioned in `summary.json`/`wind_summary.json`), so a missing file never logs a 404.
