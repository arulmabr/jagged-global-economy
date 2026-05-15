#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd


def read_csv(path: Path) -> pd.DataFrame:
    try:
        return pd.read_csv(path)
    except Exception as exc:  # pragma: no cover - exact pandas exception varies
        raise SystemExit(f"Could not parse CSV {path}: {exc}") from exc


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def close(a: float, b: float, tol: float = 5e-6) -> bool:
    if pd.isna(a) and pd.isna(b):
        return True
    return abs(float(a) - float(b)) <= tol


def verify_weighted_row(row: pd.Series, country_df: pd.DataFrame, group_name: str) -> None:
    codes = row.get("included_country_codes")
    if pd.isna(codes) or str(codes).strip() == "":
        if int(row["n_countries"]) != 0:
            raise SystemExit(f"{group_name}: missing country codes for non-empty row")
        return
    code_list = [code for code in str(codes).split(";") if code]
    sub = country_df[country_df["country_code"].isin(code_list)]
    if len(sub) != len(code_list):
        missing = sorted(set(code_list) - set(sub["country_code"]))
        raise SystemExit(f"{group_name}: included codes missing from map data: {missing}")
    macro = sub["weighted_exposure"].mean()
    weighted = np.average(sub["weighted_exposure"], weights=sub["total_employment_k"])
    total_emp = sub["total_employment_k"].sum()
    if not close(row["macro_exposure"], macro):
        raise SystemExit(f"{group_name}: macro exposure does not match included countries")
    if not close(row["labor_force_weighted_exposure"], weighted):
        raise SystemExit(f"{group_name}: labor-force weighted exposure does not match included countries")
    if not close(row["total_employment_k"], total_emp, tol=1e-3):
        raise SystemExit(f"{group_name}: total employment does not match included countries")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True)
    args = parser.parse_args()
    data_dir = Path(args.data_dir)
    root = data_dir.parent
    expected_path = root / "metadata" / "expected_outputs.json"
    if not data_dir.exists():
        raise SystemExit(f"Missing data directory: {data_dir}")
    if not expected_path.exists():
        raise SystemExit(f"Missing expected output inventory: {expected_path}")

    expected = json.loads(expected_path.read_text(encoding="utf-8"))
    for rel_path, spec in expected["data_tables"].items():
        path = data_dir / rel_path
        if not path.exists():
            raise SystemExit(f"Missing expected table: {rel_path}")
        df = read_csv(path)
        if len(df) != spec["rows"]:
            raise SystemExit(f"{rel_path}: expected {spec['rows']} rows, found {len(df)}")
        if len(df.columns) != spec["columns"]:
            raise SystemExit(f"{rel_path}: expected {spec['columns']} columns, found {len(df.columns)}")
        expected_hash = spec.get("sha256")
        if expected_hash and sha256(path) != expected_hash:
            raise SystemExit(f"{rel_path}: SHA-256 checksum does not match expected_outputs.json")

    for path in sorted(data_dir.rglob("*.csv")):
        read_csv(path)

    exposure = read_csv(data_dir / "core/nation_exposure_enriched.csv")
    if len(exposure) != 141:
        raise SystemExit("Core national exposure panel must contain 141 countries")
    if exposure["country_code"].duplicated().any():
        raise SystemExit("Duplicate country codes in core national exposure panel")
    if exposure["weighted_exposure"].isna().any():
        raise SystemExit("weighted_exposure contains missing values")
    if not exposure["weighted_exposure"].between(0, 1).all():
        raise SystemExit("weighted_exposure values must be in [0, 1]")

    occ = read_csv(data_dir / "mechanisms/occupation_contributions.csv")
    if "obs_value" in occ.columns:
        raise SystemExit("Reviewer-safe occupation contribution table must not include obs_value")

    grid = read_csv(data_dir / "validation/adoption_predictor_grid.csv")
    if len(grid) != 24:
        raise SystemExit("Adoption predictor grid must have 24 rows")
    if grid.groupby("outcome_key").size().to_dict() != {"anthropic": 8, "microsoft": 8, "openai": 8}:
        raise SystemExit("Adoption predictor grid must have 8 rows for each outcome")
    if not grid["r2"].between(0, 1).all():
        raise SystemExit("Adoption predictor grid R2 values must be in [0, 1]")

    region_income = read_csv(data_dir / "aggregates/region_income_exposure_grid.csv")
    if len(region_income[["region", "income_group"]].drop_duplicates()) != 28:
        raise SystemExit("World Bank region-income grid must have 28 unique cells")
    map_data = read_csv(data_dir / "aggregates/national_exposure_map_data.csv")
    if len(map_data) != 141:
        raise SystemExit("National exposure map data must contain 141 countries")
    if "MYS" in set(map_data["country_code"]):
        raise SystemExit("MYS should be absent because it is absent from the measured exposure panel")
    if "SGP" not in set(map_data["country_code"]):
        raise SystemExit("SGP should be present in the measured exposure panel")

    for _, row in region_income.iterrows():
        verify_weighted_row(row, map_data, f"{row['region']} / {row['income_group']}")
    regions = read_csv(data_dir / "aggregates/region_exposure_marginals.csv")
    for _, row in regions.iterrows():
        verify_weighted_row(row, map_data, f"region {row['region']}")
    income = read_csv(data_dir / "aggregates/income_exposure_marginals.csv")
    for _, row in income.iterrows():
        verify_weighted_row(row, map_data, f"income {row['income_group']}")

    print("Dataset validation passed.")


if __name__ == "__main__":
    main()
