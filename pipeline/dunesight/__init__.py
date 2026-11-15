"""Shared helpers for the DuneSight pipeline notebooks and scripts.

Modules:
    config      site list (pipeline/sites.json), the current site (DUNESIGHT_SITE), project paths
    site_index  the data-contract file list and public/data/sites.json (per-file real/placeholder status)
    wind        Fryberger drift-potential maths (numpy)
    landsat     Landsat Collection 2 QA_PIXEL bit definitions and Earth Engine helpers
    merra2      MERRA-2 native grid and the Earth Engine georeferencing offset
    rasters     the 15 m tracking grid (Landsat pan phase), cached Earth Engine GeoTIFF downloads   (notebook 02)
    masks       QA, vegetation, WorldCover, OpenStreetMap and hand-drawn non-dune masks          (notebook 02)
    tracking    batched sub-pixel phase correlation of image windows, sign conventions          (notebook 02)
    network     pair network -> per-date positions -> velocity, with closure and outlier tests  (notebook 02)
    motion      glue: track all pairs, stable-ground registration, held-out null calibration   (notebook 02)
    dunes       NASADEM hillshade check, crest segmentation, polygons                           (notebook 02)
    targets     OSM roads/built-up via Overpass, road segments, HLS-NDVI farm polygons         (notebook 03)
    threat      source sand -> window motion, ray casting to targets, reach years             (notebook 03)
    frames      observed-frame stretch, exact-bounds WGS84 resampling, semi-Lagrangian advection (notebook 03)

`config` and `site_index` use only the standard library, so make_placeholders.py and run_pipeline.py
work without the venv. `wind` needs numpy; `landsat` needs earthengine-api; the notebook-02 modules need
numpy, scipy, scikit-image, rasterio, shapely and pyproj.
"""
