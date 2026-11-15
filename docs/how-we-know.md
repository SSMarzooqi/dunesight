# How we know (stub)

Not written yet. Written in Phase 5 (science review), after the pipeline has produced real results. It will contain:

- the ≤ 150-word panel text shown in the app's "How we know" dossier;
- a bullet list of limits (advection-only projection, no dune deformation/merging, 2000 NASADEM shapes shifted to 2025, coarse MERRA-2, valid for this dune field and period only);
- data handling: cloud/shadow masking (QA_PIXEL, Fmask), Landsat 7 SLC-off exclusion, no-data, low-correlation rejection, and what was dropped and why;
- uncertainty and validation (Fareaa 2025 UAEU thesis; NASA HLS second-dataset check).

Most data currently in `public/data/<site_id>/` is PLACEHOLDER and supports none of these claims; `public/data/sites.json` lists which files are real (so far only `seih_al_hama/wind_summary.json`).
