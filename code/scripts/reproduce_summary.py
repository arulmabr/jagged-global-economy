#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


def percentile_rank(series: pd.Series, value: float) -> float:
    return float((series <= value).mean() * 100)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()
    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    exposure = pd.read_csv(data_dir / "core/nation_exposure_enriched.csv")
    gender = pd.read_csv(data_dir / "mechanisms/gender_gap.csv")
    reliable_gender = gender[gender["reliable"].astype(bool)].copy()
    adoption = pd.read_csv(data_dir / "validation/adoption_predictor_grid.csv")
    remittance = pd.read_csv(data_dir / "indirect/remittance_weighted_exposure.csv")
    corridors = pd.read_csv(data_dir / "indirect/remittance_corridor_evidence.csv")
    gender_decomp = pd.read_csv(data_dir / "mechanisms/gender_decomposition_summary.csv")
    openai_quintiles = pd.read_csv(data_dir / "validation/openai_rank_quintile_summary.csv")
    region = pd.read_csv(data_dir / "aggregates/region_exposure_marginals.csv")
    income = pd.read_csv(data_dir / "aggregates/income_exposure_marginals.csv")

    full = adoption[adoption["predictor_set"] == "WC + log GNI + Exposure"]
    baseline = adoption[adoption["predictor_set"] == "WC + log GNI"]
    exposure_only = adoption[adoption["predictor_set"] == "Exposure"]
    margins = full.set_index("outcome_key")["r2"] - baseline.set_index("outcome_key")["r2"]

    tjk = remittance[remittance["country_code"] == "TJK"].iloc[0].to_dict()
    rus = exposure[exposure["country_code"] == "RUS"].iloc[0].to_dict()

    summary = {
        "national_exposure": {
            "n_countries": int(len(exposure)),
            "min": float(exposure["weighted_exposure"].min()),
            "max": float(exposure["weighted_exposure"].max()),
            "lowest_country": str(exposure.sort_values("weighted_exposure").iloc[0]["country_name"]),
            "highest_country": str(exposure.sort_values("weighted_exposure", ascending=False).iloc[0]["country_name"]),
        },
        "gender": {
            "rows": int(len(gender)),
            "reliable_rows": int(len(reliable_gender)),
            "female_exposure_higher_reliable": int((reliable_gender["female_exposure"] > reliable_gender["male_exposure"]).sum()),
            "share_reliable_rows_female_exposure_higher": float((reliable_gender["female_exposure"] > reliable_gender["male_exposure"]).mean()),
            "median_relative_gap_reliable": float(reliable_gender["relative_gender_gap"].median()),
            "decomposition_r2": {
                row["component_set"]: float(row["r2"])
                for _, row in gender_decomp.iterrows()
            },
        },
        "adoption_r2": {
            row["outcome_key"]: {
                "exposure_only": float(exposure_only[exposure_only["outcome_key"] == row["outcome_key"]]["r2"].iloc[0]),
                "wc_log_gni": float(baseline[baseline["outcome_key"] == row["outcome_key"]]["r2"].iloc[0]),
                "full": float(row["r2"]),
                "added_exposure_margin": float(margins.loc[row["outcome_key"]]),
            }
            for _, row in full.iterrows()
        },
        "remittance": {
            "countries_over_10pct_gdp": int((remittance["remittance_pct_gdp"] >= 10).sum()),
            "tajikistan_direct_exposure": float(tjk["domestic_exposure"]),
            "tajikistan_remittance_accounted_exposure": float(tjk["remit_weighted_exposure"]),
            "tajikistan_direct_percentile": percentile_rank(exposure["weighted_exposure"], float(tjk["domestic_exposure"])),
            "tajikistan_remittance_accounted_percentile": percentile_rank(exposure["weighted_exposure"], float(tjk["remit_weighted_exposure"])),
            "russia_direct_exposure": float(rus["weighted_exposure"]),
            "russia_direct_percentile": percentile_rank(exposure["weighted_exposure"], float(rus["weighted_exposure"])),
            "central_america_us_corridors": {
                row["receiver_code"]: {
                    "receiver_remittance_pct_gdp": float(row["receiver_remittance_pct_gdp"]),
                    "sender_share_inflow": float(row["sender_share_inflow"]),
                    "sender_direct_exposure": float(row["sender_direct_exposure"]),
                }
                for _, row in corridors[corridors["receiver_code"].isin(["HND", "GTM", "SLV"])].iterrows()
            },
        },
        "openai_rank_quintiles": {
            row["group"]: {
                "n_countries": int(row["n_countries"]),
                "mean_openai_rank_percentile_zero_top": float(row["mean_openai_rank_percentile_zero_top"]),
                "worst_openai_rank_in_group": int(row["worst_openai_rank_in_group"]),
            }
            for _, row in openai_quintiles.iterrows()
        },
        "aggregates": {
            "highest_labor_weighted_region": str(region.sort_values("labor_force_weighted_exposure", ascending=False).iloc[0]["region"]),
            "lowest_labor_weighted_income_group": str(income.sort_values("labor_force_weighted_exposure").iloc[0]["income_group"]),
        },
    }

    (out_dir / "release_summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    lines = [
        "# Reproduced Headline Summary",
        "",
        f"- National exposure panel: {summary['national_exposure']['n_countries']} countries.",
        f"- Exposure range: {summary['national_exposure']['min']:.3f} to {summary['national_exposure']['max']:.3f}.",
        f"- Reliable gender comparison: {summary['gender']['female_exposure_higher_reliable']} / {summary['gender']['reliable_rows']} countries have higher female exposure.",
        "- Gender decomposition R2 values: " + ", ".join(
            f"{k}={v:.3f}" for k, v in summary["gender"]["decomposition_r2"].items()
        ) + ".",
        f"- Adoption full-model R2 values: " + ", ".join(
            f"{k}={v['full']:.3f}" for k, v in summary["adoption_r2"].items()
        ) + ".",
        f"- Tajikistan remittance-accounted exposure: {summary['remittance']['tajikistan_remittance_accounted_exposure']:.3f}.",
        "- Central America US remittance corridor shares: " + ", ".join(
            f"{k}={v['sender_share_inflow']:.3f}" for k, v in summary["remittance"]["central_america_us_corridors"].items()
        ) + ".",
        "- OpenAI top exposure quintile mean matched-sample rank percentile: "
        f"{summary['openai_rank_quintiles']['top_exposure_quintile']['mean_openai_rank_percentile_zero_top']:.1f} (0=highest).",
    ]
    (out_dir / "release_summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
