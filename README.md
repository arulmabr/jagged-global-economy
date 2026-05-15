# The Jagged Global Economy

This repository hosts the project page and release tables for:

**The Jagged Global Economy: Frontier AI Unevenly Exposes National Economies**

Site: https://arulmabr.github.io/jagged-global-economy/

## Contents

- `index.html`, `styles.css`, and `assets/site.js`: static GitHub Pages site.
- `assets/paper.pdf`: paper PDF.
- `assets/dataset_release.zip`: downloadable dataset release archive.
- `data/`: release-safe derived CSV tables used by the site and paper.
- `scripts/build_interactive_data.py`: rebuilds `assets/interactive_data.json` from `data/`.
- `DATA_CARD.md`, `DATASET_README.md`, `TABLES.md`, `manifest.csv`, `data_dictionary.csv`, and `source_data_manifest.csv`: release documentation and source metadata.

## Rebuild

Use Python 3.11 from the repository root:

```bash
python3.11 scripts/build_interactive_data.py
python3.11 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/`.

The builder intentionally excludes Microsoft country-level adoption rows because the release documentation does not identify a standalone redistribution license for those row-level values. The public site keeps Microsoft as a static paper reference panel while Anthropic and OpenAI country-level panels are interactive.

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
