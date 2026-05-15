PYTHON ?= python3
DATA_DIR ?= ../data
OUT_DIR ?= outputs

.PHONY: validate reproduce notebooks clean

validate:
	$(PYTHON) scripts/validate_dataset.py --data-dir $(DATA_DIR)

reproduce:
	$(PYTHON) scripts/reproduce_summary.py --data-dir $(DATA_DIR) --out-dir $(OUT_DIR)/summary
	$(PYTHON) scripts/build_tables_from_release.py --data-dir $(DATA_DIR) --out-dir $(OUT_DIR)/tables
	$(PYTHON) scripts/build_figures_from_release.py --data-dir $(DATA_DIR) --out-dir $(OUT_DIR)/figures

notebooks:
	$(PYTHON) scripts/run_notebooks.py --notebooks-dir notebooks --data-dir $(DATA_DIR) --out-dir $(OUT_DIR)/notebooks

clean:
	rm -rf $(OUT_DIR)
