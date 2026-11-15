"""Run the pipeline notebooks headless for every verified site (this is `npm run pipeline`).

WHAT THIS DOES:
    For each site with verified=true in pipeline/sites.json, executes 01 -> 02 -> 03 in order with
    DUNESIGHT_SITE set to the site id. Each executed copy, with its outputs, is saved as
    pipeline/runs/<site_id>/<notebook>.ipynb; the source notebooks in pipeline/ are never modified.
    Stops at the first failing notebook.

Usage (from the repo root):
    pipeline/.venv/bin/python pipeline/run_pipeline.py                      # all verified sites, all notebooks
    pipeline/.venv/bin/python pipeline/run_pipeline.py --site seih_al_hama  # one site
    pipeline/.venv/bin/python pipeline/run_pipeline.py --only 01            # notebooks whose name starts with 01
Standard library only (it calls the venv's jupyter).
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dunesight import config  # noqa: E402

NOTEBOOKS = ["01_scenes_and_wind.ipynb", "02_tracking_and_dunes.ipynb", "03_threats_and_frames.ipynb"]
JUPYTER = config.PIPELINE / ".venv" / "bin" / "jupyter"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", action="append", help="site id (repeatable); default: every verified site")
    ap.add_argument("--only", action="append", help="run only notebooks whose name starts with this (repeatable)")
    args = ap.parse_args()

    sites = [config.get_site(s) for s in args.site] if args.site else config.verified_sites()
    notebooks = [n for n in NOTEBOOKS if not args.only or any(n.startswith(o) for o in args.only)]
    skipped = [s["id"] for s in config.load_sites() if not s.get("verified")]
    if skipped and not args.site:
        print(f"skipping unverified sites: {skipped}")

    for site in sites:
        out = config.runs_dir(site["id"])
        out.mkdir(parents=True, exist_ok=True)
        env = {**os.environ, config.ENV_VAR: site["id"]}
        for nb in notebooks:
            print(f"[{site['id']}] executing {nb} -> {out.relative_to(config.ROOT)}/{nb}", flush=True)
            cmd = [str(JUPYTER), "nbconvert", "--to", "notebook", "--execute", nb,
                   "--output-dir", str(out), "--output", nb, "--ExecutePreprocessor.timeout=7200"]
            r = subprocess.run(cmd, cwd=config.PIPELINE, env=env)
            if r.returncode != 0:
                sys.exit(f"[{site['id']}] {nb} failed (exit {r.returncode})")
    print("pipeline done")


if __name__ == "__main__":
    main()
