"""Sites and paths. Standard library only.

The site list lives in pipeline/sites.json. A notebook picks its site from the DUNESIGHT_SITE
environment variable (default "seih_al_hama"), so the same notebook runs once per verified site.
"""

import json
import os
from pathlib import Path

PIPELINE = Path(__file__).resolve().parent.parent
ROOT = PIPELINE.parent
SITES_PATH = PIPELINE / "sites.json"
PUBLIC_DATA = ROOT / "public" / "data"
DEFAULT_SITE = "seih_al_hama"
ENV_VAR = "DUNESIGHT_SITE"


def load_sites():
    """All sites from pipeline/sites.json, in file order."""
    return json.loads(SITES_PATH.read_text())["sites"]


def verified_sites():
    return [s for s in load_sites() if s.get("verified")]


def site_id_from_env():
    return os.environ.get(ENV_VAR, "").strip() or DEFAULT_SITE


def get_site(site_id=None, require_verified=True):
    """Return the site dict for site_id (default: from DUNESIGHT_SITE). Refuses unverified sites."""
    site_id = site_id or site_id_from_env()
    by_id = {s["id"]: s for s in load_sites()}
    if site_id not in by_id:
        raise KeyError(f"Unknown site id {site_id!r}; known: {sorted(by_id)}")
    site = by_id[site_id]
    if require_verified and not site.get("verified"):
        raise ValueError(f"Site {site_id!r} is not verified (no confirmed box); refusing to run on it.")
    return site


def bbox_list(site):
    """[west, south, east, north] in degrees."""
    b = site["bbox"]
    return [b["west"], b["south"], b["east"], b["north"]]


def centroid(site):
    """(lat, lon) of the box centre, in degrees."""
    b = site["bbox"]
    return (b["south"] + b["north"]) / 2, (b["west"] + b["east"]) / 2


def public_dir(site_id):
    """public/data/<site_id>/ : the app-facing data-contract files (handoff §4)."""
    return PUBLIC_DATA / site_id


def outputs_dir(site_id):
    """pipeline/outputs/<site_id>/ : small committed working outputs (tables, logs, figures)."""
    return PIPELINE / "outputs" / site_id


def raw_dir(site_id):
    """pipeline/raw/<site_id>/ : downloads and caches (gitignored)."""
    return PIPELINE / "raw" / site_id


def runs_dir(site_id):
    """pipeline/runs/<site_id>/ : executed notebook copies with outputs."""
    return PIPELINE / "runs" / site_id
