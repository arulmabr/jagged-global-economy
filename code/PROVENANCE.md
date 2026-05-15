# Provenance and Reproducibility Scope

This reviewer package reproduces paper-facing values, regression tables, and
release-supported figures from released derived measured CSV tables where
redistribution permits. It does not redistribute raw third-party source files
and does not rebuild the private raw-source pipeline.

The upstream sources are listed in `metadata/source_data_manifest.csv` with
URLs, source roles, and redistribution notes. Raw files are omitted because
provider terms are mixed, the Microsoft adoption source is a documented
extraction from public report tables rather than a standalone open-data file,
the Hosseini Maasoum and Lichtinger source has no verified standalone open-data
redistribution license for transformed score vectors, and the raw research
workspace contains local paths and non-anonymized draft material.

This package is therefore scoped to reviewer verification: validate released
tables, recompute headline quantities, and regenerate value-equivalent paper
tables and supported figures from anonymized derived measured data. Microsoft
AI Diffusion country-level extracted rows are not redistributed; Microsoft
paper claims are supported through aggregate regression summaries and
source-linked documentation. Hosseini Maasoum and Lichtinger robustness claims
are supported through aggregate summary statistics and source-linked
documentation rather than redistributed transformed score vectors.
