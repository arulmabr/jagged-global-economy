#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
from pathlib import Path

import pandas as pd


def esc(value: object) -> str:
    text = "" if pd.isna(value) else str(value)
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text


def fmt(value: object, digits: int = 3) -> str:
    if pd.isna(value):
        return ""
    try:
        return f"{float(value):.{digits}f}"
    except Exception:
        return esc(value)


def coef_cell(row: pd.Series, prefix: str) -> str:
    coef = row.get(f"{prefix}_coef")
    se = row.get(f"{prefix}_se_hc1")
    if pd.isna(coef):
        return ""
    return f"{float(coef):.3f} ({float(se):.3f})"


def write_simple_table(path: Path, caption: str, label: str, headers: list[str], rows: list[list[str]]) -> None:
    align = "l" + "r" * (len(headers) - 1)
    body = "\n".join(" & ".join(row) + r" \\" for row in rows)
    text = rf"""\begin{{table}}[htbp]
\centering
\caption{{{esc(caption)}}}
\label{{{label}}}
\small
\begin{{tabular}}{{{align}}}
\toprule
{" & ".join(headers)} \\
\midrule
{body}
\bottomrule
\end{{tabular}}
\end{{table}}
"""
    path.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()
    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)
    tex_dir = out_dir / "tex"
    csv_dir = out_dir / "csv"
    tex_dir.mkdir(parents=True, exist_ok=True)
    csv_dir.mkdir(parents=True, exist_ok=True)

    coverage = pd.read_csv(data_dir / "coverage/sample_coverage_summary.csv")
    write_simple_table(
        tex_dir / "countries_coverage.tex",
        "Country coverage in the measured exposure sample.",
        "tab:countries_coverage",
        ["Status", "$n$"],
        [[esc(r["status"]), str(int(r["n_countries"]))] for _, r in coverage.iterrows()],
    )
    coverage.to_csv(csv_dir / "countries_coverage.csv", index=False)

    national = pd.read_csv(data_dir / "aggregates/national_exposure_map_data.csv")
    national = national.sort_values("country_name")
    national_rows = [
        [
            esc(r["country_name"]),
            esc(r["country_code"]),
            fmt(r["weighted_exposure"]),
            esc(r["region"]),
            esc(r["income_group"]),
        ]
        for _, r in national.iterrows()
    ]
    write_simple_table(
        tex_dir / "national_exposure_scores.tex",
        "National AI exposure scores for all measured countries.",
        "tab:national_exposure_scores",
        ["Country", "ISO-3", "Exposure", "Region", "Income group"],
        national_rows,
    )
    national.to_csv(csv_dir / "national_exposure_scores.csv", index=False)

    hierarchy = pd.read_csv(data_dir / "paper_tables/gmyrek_hierarchy_summary.csv")
    write_simple_table(
        tex_dir / "gmyrek_hierarchy_summary.tex",
        "Exposure-score aggregation hierarchy.",
        "tab:gmyrek_hierarchy_summary",
        ["Level", "$n$", "Construction", "Used for"],
        [[esc(r["level"]), str(int(r["n_estimates"])), esc(r["construction"]), esc(r["used_for"])] for _, r in hierarchy.iterrows()],
    )
    hierarchy.to_csv(csv_dir / "gmyrek_hierarchy_summary.csv", index=False)

    grid = pd.read_csv(data_dir / "validation/adoption_predictor_grid.csv")
    rows = []
    for outcome, group in grid.groupby("outcome_label", sort=False):
        n = int(group["n_countries"].iloc[0])
        vals = group.set_index("predictor_set")["r2"]
        rows.append([
            esc(outcome),
            str(n),
            fmt(vals["Exposure"]),
            fmt(vals["WC + log GNI"]),
            fmt(vals["WC + log GNI + Exposure"]),
            fmt(vals["WC + log GNI + Exposure"] - vals["WC + log GNI"]),
        ])
    write_simple_table(
        tex_dir / "section6_adoption_predictor_grid.tex",
        "National AI exposure predicts adoption, but adds little beyond labor composition and income.",
        "tab:section6_adoption_predictor_grid",
        ["Outcome", "$n$", "Exposure only $R^2$", "WC + log GNI $R^2$", "Full $R^2$", "Added exposure"],
        rows,
    )
    grid.to_csv(csv_dir / "section6_adoption_predictor_grid.csv", index=False)

    gender_summary = pd.read_csv(data_dir / "mechanisms/gender_decomposition_summary.csv")
    write_simple_table(
        tex_dir / "gender_decomposition_summary.tex",
        "Gender exposure-gap decomposition summary.",
        "tab:gender_decomposition_summary",
        ["Component set", "$n$", "$R^2$", "Source table"],
        [
            [esc(r["label"]), str(int(r["n_countries"])), fmt(r["r2"]), esc(r["source_table"])]
            for _, r in gender_summary.iterrows()
        ],
    )
    gender_summary.to_csv(csv_dir / "gender_decomposition_summary.csv", index=False)

    openai_summary = pd.read_csv(data_dir / "validation/openai_rank_quintile_summary.csv")
    write_simple_table(
        tex_dir / "openai_rank_quintile_summary.tex",
        "OpenAI Signals rank summary by exposure quintile.",
        "tab:openai_rank_quintile_summary",
        ["Exposure group", "$n$", "Mean exposure pct.", "Mean OpenAI pct.", "Worst OpenAI rank"],
        [
            [
                esc(r["group"]),
                str(int(r["n_countries"])),
                fmt(r["mean_exposure_rank_percentile_zero_top"], 1),
                fmt(r["mean_openai_rank_percentile_zero_top"], 1),
                str(int(r["worst_openai_rank_in_group"])),
            ]
            for _, r in openai_summary.iterrows()
        ],
    )
    openai_summary.to_csv(csv_dir / "openai_rank_quintile_summary.csv", index=False)

    def regression_long_table(src: str, out_name: str, caption: str, label: str) -> None:
        df = pd.read_csv(data_dir / src)
        rows = []
        for _, r in df.iterrows():
            rows.append([
                esc(r["outcome_label"]),
                esc(r["predictor_set"]),
                str(int(r["n"])),
                fmt(r["r2"]),
                coef_cell(r, "wc_share"),
                coef_cell(r, "log_gni"),
                coef_cell(r, "internet_share"),
                coef_cell(r, "cmp_national"),
                coef_cell(r, "weighted_exposure"),
            ])
        write_simple_table(
            tex_dir / f"{out_name}.tex",
            caption,
            label,
            ["Outcome", "Specification", "$n$", "$R^2$", "WC", "log GNI", "Internet", "CMP", "Exposure"],
            rows,
        )
        df.to_csv(csv_dir / f"{out_name}.csv", index=False)

    regression_long_table(
        "validation/appendix_predicting_exposure_regressions.csv",
        "appendix_predicting_exposure_regressions",
        "Predicting national AI exposure: full regression specifications.",
        "tab:appendix_predicting_exposure_regressions",
    )
    regression_long_table(
        "validation/appendix_predicting_adoption_regressions.csv",
        "appendix_predicting_adoption_regressions",
        "Predicting national AI adoption: full regression specifications.",
        "tab:appendix_predicting_adoption_regressions",
    )
    print(f"Wrote tables to {out_dir}")


if __name__ == "__main__":
    main()
