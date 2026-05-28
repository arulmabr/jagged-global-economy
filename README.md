# The Jagged Global Economy

This repository hosts the project page and release tables for:

**The Jagged Global Economy: Frontier AI Unevenly Exposes National Economies**

Site: https://arulmurugan.me/jagged-global-economy/

## Contents

- `index.html`, `styles.css`, and `assets/site.js`: static GitHub Pages site.
- `assets/paper.pdf`: paper PDF.
- `assets/dataset_release.zip`: downloadable dataset release archive.
- `data/country_exposure_adoption_snapshot.csv`: quick-start country table for
  GitHub preview, combining exposure, employment, white-collar structure,
  income/region metadata, observed adoption measures, and remittance fields
  where available.
- `data/README.md`: short guide for navigating the released data folders.
- `data/`: derived CSV tables used by the site and paper.
- `code/`: release notebooks, reproduction scripts, metadata, and requirements.
- `metadata/`: checksum and expected-output metadata used by the reproduction scripts.
- `scripts/build_country_snapshot.py`: rebuilds the quick-start country table
  linked from the website's `Data` button.
- `scripts/build_interactive_data.py`: rebuilds the website's `assets/interactive_data.json` from `data/`.
- `DATA_GUIDE.md`: data construction, merge keys, and file-role guide.
- `DATA_CARD.md`, `DATASET_README.md`, `TABLES.md`, `manifest.csv`, `data_dictionary.csv`, and `source_data_manifest.csv`: release documentation and source metadata.

## Rebuild

Use Python 3.11 from the repository root:

```bash
python3.11 -m pip install -r code/requirements.txt
python3.11 scripts/build_country_snapshot.py
python3.11 scripts/build_interactive_data.py
python3.11 -m http.server 8765 --bind 127.0.0.1
```

To reproduce paper-facing release outputs:

```bash
cd code
pip install -r requirements.txt
make validate
make reproduce
make notebooks
```

The website builder uses country-level Anthropic, OpenAI Signals, and Microsoft AI Diffusion validation rows where available. See `DATA_GUIDE.md` and `source_data_manifest.csv` for source and merge details.

## Citation

```bibtex
@article{murugan2026jagged,
  title={The Jagged Global Economy: Frontier AI Unevenly Exposes National Economies},
  author={Murugan, Arul and Aguirre, Tomás and Nagaraj, Abhishek and Bommasani, Rishi},
  year={2026},
  note={Preprint}
}
```

## License And Terms

See `LICENSE` and `source_data_manifest.csv`. Upstream datasets remain governed by their original licenses and terms.
