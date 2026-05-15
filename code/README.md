# Reproducibility Code

This folder contains the lightweight notebooks and scripts for inspecting the
released tables and reproducing the paper-facing derived outputs that can be
rebuilt from redistributable data.

The public data live in the repository-level `data/` folder. The Makefile is
configured to use `../data` by default.

## Quickstart

From this `code/` folder:

```bash
python3.11 -m venv /tmp/jagged-economy-venv
source /tmp/jagged-economy-venv/bin/activate
pip install -r requirements.txt

make validate
make reproduce
make notebooks
```

Outputs are written to `code/outputs/`.

## Contents

- `notebooks/01_dataset_tour.ipynb`: release table inventory and quick inspection.
- `notebooks/02_reproduce_main_results.ipynb`: compact main-result reproduction notebook.
- `scripts/validate_dataset.py`: validates table structure and internal consistency.
- `scripts/reproduce_summary.py`: writes summary values from the release tables.
- `scripts/build_tables_from_release.py`: rebuilds release-supported table artifacts.
- `scripts/build_figures_from_release.py`: rebuilds release-supported figure artifacts.
- `scripts/run_notebooks.py`: executes the notebooks with the current Python environment.
- `metadata/`: manifest, data dictionary, source manifest, and expected-output inventory.

## Scope

This is a derived-data reproduction package, not a raw-source rebuild. Raw
third-party files and API mirrors are documented in `../source_data_manifest.csv`
but are not redistributed here. Microsoft country-level adoption rows are also
not redistributed; only release-safe aggregate Microsoft validation summaries are
included.
