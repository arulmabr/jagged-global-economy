# Data Construction Guide

This repository is a public release built from measured source data. It is not
a raw-source rebuild of the private research workspace. The files under
`data/` are the released tables used by the website, paper figures, and
lightweight reproduction scripts.

## Core Merge Logic

The national exposure measure starts from three linked objects:

1. Occupational AI exposure scores from Gmyrek et al. (2025), mapped to ISCO-08
   occupations.
2. ILOSTAT country employment by sex and ISCO-08 2-digit occupation.
3. Country metadata and enrichment variables from World Bank and ILO sources.

For each country, occupational employment rows are converted to employment
shares. National exposure is then:

```text
national_exposure = sum(occupation_employment_share * occupation_exposure_score)
```

The same calculation is also applied separately by sex where sex-disaggregated
employment data are available. Not-elsewhere-classified occupational rows are
excluded rather than redistributed. Countries without measured 2-digit ISCO-08
occupation data are not imputed.

## Join Keys

The main country join key is `country_code`, an ISO-3 country or economy code.
Most country tables also keep `country_name` for readability. Occupational
tables use ISCO-08 occupation identifiers; the public release mainly exposes
2-digit ISCO outputs, because those are the level used for cross-country
employment aggregation.

The validation tables join observed AI usage or adoption measures to national
exposure through `country_code`. The remittance tables join receiver countries
and sender countries through ISO-3 codes, then weight sender-country exposure by
bilateral remittance inflow shares.

## Data Folders

- `data/core/`: canonical exposure tables. These include country exposure,
  exposure by sex, and ISCO-08 2-digit occupation exposure scores.
- `data/mechanisms/`: decomposition and mechanism tables, including gender
  gaps, white-collar shares, wage-weighted exposure, labor-share enrichment, and
  country-occupation exposure contributions.
- `data/validation/`: observed AI adoption and usage validation tables. This
  includes Anthropic, OpenAI Signals, Microsoft AI Diffusion, regression grids,
  and appendix predictor panels.
- `data/indirect/`: remittance-weighted exposure tables and selected bilateral
  corridor evidence.
- `data/aggregates/`: map-ready and group-summary tables by country, region,
  and income group.
- `data/robustness/`: alternative exposure measures and white-collar boundary
  checks.
- `data/coverage/`: sample accounting and excluded-country categories.
- `data/paper_tables/`: compact tables used directly by the paper or website.

## Main Tables

- `data/country_exposure_adoption_snapshot.csv` is the quick-start
  GitHub-previewable country table linked from the website's Data button. It
  combines the national exposure score, rank, employment, reliability,
  region/income metadata, white-collar structure, observed adoption measures
  from Anthropic, OpenAI, and Microsoft where available, and remittance exposure
  fields.
- `data/core/nation_exposure_enriched.csv` is the central 141-country exposure
  panel. It combines measured national exposure with reliability, employment,
  income, labor-share, wage-weighted, and white-collar variables.
- `data/core/nation_exposure_by_sex.csv` gives country exposure estimates by
  sex and total workforce where measured.
- `data/core/isco2_exposure_scores.csv` gives the ISCO-08 2-digit occupational
  exposure scores used in national aggregation.
- `data/mechanisms/occupation_contributions.csv` decomposes country exposure
  into country-occupation contributions.
- `data/validation/observed_outcomes_vs_exposure.csv` contains the
  release-supported Anthropic, OpenAI, and Microsoft country-level validation
  rows.
- `data/validation/microsoft_ai_diffusion_country_adoption.csv` contains the
  official Microsoft AI Diffusion GitHub Q1 2026 update, matched to ISO alpha-3
  country codes. The `adoption_rate` alias is the Q1 2026 value; H1 2025 and H2
  2025 columns are retained for audit and historical comparisons.
- `data/validation/observed_outcomes_vs_exposure_stats.csv` stores compact
  source-level validation statistics for Anthropic, OpenAI, and Microsoft.
- `data/indirect/remittance_weighted_exposure.csv` compares direct national
  exposure with remittance-accounted exposure for countries with remittance
  data.

For a full file inventory with row counts, descriptions, and checksums, see
`manifest.csv`. For column-level descriptions, units, and missingness notes, see
`data_dictionary.csv`. For source URLs, terms, and source-to-table mappings, see
`source_data_manifest.csv`.

## What Is Not Included

Raw ILOSTAT snapshots, World Bank API mirrors, KNOMAD workbooks, original
Gmyrek source workbooks, and private workspace notebooks are not included here.
The public `code/` folder instead validates the released tables and rebuilds
paper-facing summaries from those released CSVs.

Hosseini Maasoum and Lichtinger transformed occupational score vectors are not
redistributed because this release does not include a verified standalone
open-data redistribution permission for those transformed vectors. The release
keeps aggregate robustness statistics and source links for that comparison.

## Rebuilding Website Plot Data

The website plots are generated from the released tables:

```bash
python3.11 -m pip install -r code/requirements.txt
python3.11 scripts/build_country_snapshot.py
python3.11 scripts/build_interactive_data.py
```

The snapshot script writes `data/country_exposure_adoption_snapshot.csv` for
reader-friendly GitHub preview. The plotting script writes
`assets/interactive_data.json`, a compact payload containing only the fields
needed by the static GitHub Pages site.
