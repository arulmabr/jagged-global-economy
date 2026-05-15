#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def run(root: Path, args: list[str]) -> None:
    subprocess.run([sys.executable, *args], cwd=root, check=True)


def nonempty(path: Path) -> bool:
    return path.exists() and path.stat().st_size > 100


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("package_root")
    args = parser.parse_args()
    root = Path(args.package_root).resolve()

    try:
        required = [
            "README.md",
            "PROVENANCE.md",
            "requirements.txt",
            "Makefile",
            "data/core/nation_exposure_enriched.csv",
            "metadata/manifest.csv",
            "metadata/data_dictionary.csv",
            "metadata/source_data_manifest.csv",
            "metadata/expected_outputs.json",
            "scripts/validate_dataset.py",
            "scripts/build_tables_from_release.py",
            "scripts/build_figures_from_release.py",
            "scripts/reproduce_summary.py",
            "notebooks/01_dataset_tour.ipynb",
            "notebooks/02_reproduce_main_results.ipynb",
        ]
        missing = [rel for rel in required if not (root / rel).exists()]
        if missing:
            raise SystemExit("Missing required package files:\n" + "\n".join(missing))

        run(root, ["scripts/validate_dataset.py", "--data-dir", "data"])
        run(root, ["scripts/reproduce_summary.py", "--data-dir", "data", "--out-dir", "outputs/check_summary"])
        run(root, ["scripts/build_tables_from_release.py", "--data-dir", "data", "--out-dir", "outputs/check_tables"])
        run(root, ["scripts/build_figures_from_release.py", "--data-dir", "data", "--out-dir", "outputs/check_figures"])
        run(root, ["scripts/run_notebooks.py", "--notebooks-dir", "notebooks", "--data-dir", "data", "--out-dir", "outputs/check_notebooks"])

        expected = json.loads((root / "metadata" / "expected_outputs.json").read_text(encoding="utf-8"))
        for rel in expected["generated_files"]:
            path = root / "outputs" / "check_figures" / rel
            if not nonempty(path):
                raise SystemExit(f"Expected generated figure is missing or empty: {path}")
        for rel in expected["generated_tables"]:
            path = root / "outputs" / "check_tables" / rel
            if not nonempty(path):
                raise SystemExit(f"Expected generated table is missing or empty: {path}")
        for rel in ["01_dataset_tour.ipynb", "02_reproduce_main_results.ipynb"]:
            path = root / "outputs" / "check_notebooks" / rel
            if not nonempty(path):
                raise SystemExit(f"Expected executed notebook is missing or empty: {path}")

        print("Upload readiness check passed.")
    finally:
        shutil.rmtree(root / "outputs", ignore_errors=True)


if __name__ == "__main__":
    main()
