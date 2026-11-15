"""Shared helpers for the DuneSight pipeline notebooks and scripts.

Modules:
    config      site list (pipeline/sites.json), the current site (DUNESIGHT_SITE), project paths
    site_index  the data-contract file list and public/data/sites.json (per-file real/placeholder status)
    wind        Fryberger drift-potential maths (numpy)
    landsat     Landsat Collection 2 QA_PIXEL bit definitions and Earth Engine helpers
    merra2      MERRA-2 native grid and the Earth Engine georeferencing offset

`config` and `site_index` use only the standard library, so make_placeholders.py and run_pipeline.py
work without the venv. `wind` needs numpy; `landsat` needs earthengine-api.
"""
