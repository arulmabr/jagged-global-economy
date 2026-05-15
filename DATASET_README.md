# National AI Exposure Derived Tables

This anonymized dataset release contains derived aggregate tables supporting a
NeurIPS 2026 Evaluations & Datasets submission on national structural AI
exposure. It contains measured derived outputs only. No synthetic data
are included. Imputed country exposure estimates, raw provider files/API
mirrors, and non-release drafting material are also excluded.

## Contents

- `data/`: derived CSV tables used for the paper's core exposure,
  mechanism, validation, robustness, remittance, and aggregate analyses.
- `manifest.csv`: table-level inventory.
- `data_dictionary.csv`: inferred column-level data dictionary.
- `source_data_manifest.csv`: upstream source inventory.
- `croissant.json`: Croissant metadata with core and Responsible AI fields.
- `DATA_CARD.md`: human-readable documentation and limitations.

## Intended Use

Use these tables to reproduce descriptive claims about cross-country structural
exposure, gender differences, observed adoption correlations, release-supported
robustness checks, and indirect remittance exposure. Do not treat exposure as a
direct forecast of job loss, wages, welfare, or harm.

## Hosting

This release is intended for anonymous distribution at:

`https://huggingface.co/datasets/anonymous-ai-exposure/jagged-global-economy`

For author rebuild instructions if that URL changes, see
`RELEASE_NOTES.md`.
