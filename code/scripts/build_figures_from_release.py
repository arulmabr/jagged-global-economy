#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.patheffects as pe
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


BLUE = "#2f6f8f"
ORANGE = "#b45f3d"
GRAY = "#b8bec3"
TEXT = "#2d3748"


def save(fig: plt.Figure, out_dir: Path, name: str) -> None:
    for ext in ("png", "pdf"):
        fig.savefig(out_dir / f"{name}.{ext}", bbox_inches="tight", dpi=220)
    plt.close(fig)


def add_fit(ax: plt.Axes, x: pd.Series, y: pd.Series, y_transform=None) -> None:
    ok = x.notna() & y.notna()
    coef = np.polyfit(x[ok], y[ok], deg=1)
    xx = np.linspace(x[ok].min(), x[ok].max(), 100)
    yy = coef[0] * xx + coef[1]
    if y_transform is not None:
        yy = y_transform(yy)
    ax.plot(xx, yy, color="#4a5568", lw=1.4, alpha=0.8)


def corr_value(x: pd.Series, y: pd.Series, method: str) -> float:
    if method == "spearman":
        return x.rank().corr(y.rank(), method="pearson")
    return x.corr(y, method="pearson")


def distribution(data_dir: Path, out_dir: Path) -> None:
    df = pd.read_csv(data_dir / "core/nation_exposure_enriched.csv").sort_values("weighted_exposure")
    fig, ax = plt.subplots(figsize=(8.0, 4.0))
    ax.hist(df["weighted_exposure"], bins=12, color=GRAY, edgecolor="white")
    ax.set_xlabel("National AI exposure")
    ax.set_ylabel("Countries")
    ax.set_title("National AI exposure distribution", color=TEXT)
    for _, row in pd.concat([df.head(3), df.tail(3)]).iterrows():
        ax.axvline(row["weighted_exposure"], color=ORANGE if row.name in df.head(3).index else BLUE, lw=0.9, alpha=0.55)
    save(fig, out_dir, "national_exposure_distribution_labels")


def white_collar(data_dir: Path, out_dir: Path) -> None:
    df = pd.read_csv(data_dir / "core/nation_exposure_enriched.csv")
    fig, ax = plt.subplots(figsize=(5.5, 4.2))
    ax.scatter(df["wc_share"], df["weighted_exposure"], s=24, color=BLUE, alpha=0.76)
    add_fit(ax, df["wc_share"], df["weighted_exposure"])
    r2 = df[["wc_share", "weighted_exposure"]].corr().iloc[0, 1] ** 2
    ax.text(0.03, 0.95, f"$R^2$ = {r2:.2f}", transform=ax.transAxes, va="top", color=TEXT)
    ax.set_xlabel("White-collar share")
    ax.set_ylabel("National AI exposure")
    ax.set_title("Labor composition predicts national exposure", color=TEXT)
    save(fig, out_dir, "white_collar_vs_exposure")


def gender_exposure_gap(data_dir: Path, out_dir: Path) -> None:
    gap = pd.read_csv(data_dir / "mechanisms/gender_gap.csv")
    enriched = pd.read_csv(data_dir / "core/nation_exposure_enriched.csv")[
        ["country_code", "gni_ppp", "total_employment_k"]
    ]
    df = gap[gap["reliable"]].merge(enriched, on="country_code", how="inner").copy()
    gni_nonnull = df.loc[df["gni_ppp"].notna(), "gni_ppp"]
    quartiles = pd.qcut(gni_nonnull, 4, labels=["Q1", "Q2", "Q3", "Q4"])
    df.loc[gni_nonnull.index, "gni_quartile"] = quartiles.astype(str)
    df["gni_quartile"] = df["gni_quartile"].fillna("No GNI")
    df["rel_gap_pct"] = df["relative_gender_gap"] * 100
    df["bubble_s"] = 16 + 0.72 * np.sqrt(df["total_employment_k"])

    palette = {
        "Q1": "#C96F54",
        "Q2": "#E7B15E",
        "Q3": "#82B9CD",
        "Q4": "#346C8D",
        "No GNI": "#B8BEC5",
    }
    labels = {
        "AFG": ("Afghanistan", (8, 8), "left"),
        "PAK": ("Pakistan", (-10, 8), "right"),
        "IND": ("India", (-12, -6), "right"),
        "PHL": ("Philippines", (9, 7), "left"),
        "JAM": ("Jamaica", (8, 2), "left"),
        "USA": ("US", (7, -8), "left"),
        "DEU": ("Germany", (7, 8), "left"),
    }

    fig, ax = plt.subplots(figsize=(8.6, 5.65))
    for key in ["Q1", "Q2", "Q3", "Q4", "No GNI"]:
        sub = df[df["gni_quartile"] == key]
        ax.scatter(
            sub["rel_gap_pct"],
            sub["total_exposure"],
            s=sub["bubble_s"],
            c=palette[key],
            alpha=0.83,
            edgecolors="white",
            linewidths=0.65,
            label=key,
        )

    ax.axvline(0, color="#7E8792", lw=1.05, ls=(0, (4, 3)))
    ax.grid(True, color="#E7EDF5", lw=0.78)
    ax.set_axisbelow(True)
    ax.set_xlim(-32.5, 38.5)
    ax.set_ylim(0.14, 0.378)
    ax.set_xlabel("Female-minus-male exposure gap (% of national exposure)")
    ax.set_ylabel("National AI exposure")
    ax.text(0.25, 0.985, "Men more exposed", transform=ax.transAxes, ha="center", va="top",
            fontsize=9.2, color="#727A83", style="italic")
    ax.text(0.75, 0.985, "Women more exposed", transform=ax.transAxes, ha="center", va="top",
            fontsize=9.2, color="#727A83", style="italic")
    ax.text(0.984, 0.03, f"n = {len(df)} countries", transform=ax.transAxes, ha="right",
            va="bottom", fontsize=8.8, color="#596575")
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color("#B4C3D7")
    ax.spines["bottom"].set_color("#B4C3D7")
    ax.tick_params(labelsize=9.6, colors="#344255")

    for code, (label, offset, ha) in labels.items():
        match = df[df["country_code"] == code]
        if match.empty:
            continue
        row = match.iloc[0]
        txt = ax.annotate(
            label,
            xy=(row["rel_gap_pct"], row["total_exposure"]),
            xytext=offset,
            textcoords="offset points",
            ha=ha,
            va="center",
            fontsize=8.8,
            color="#263545",
        )
        txt.set_path_effects([pe.withStroke(linewidth=2.7, foreground="white")])

    leg = ax.legend(
        loc="upper left",
        bbox_to_anchor=(0.012, 0.982),
        frameon=True,
        framealpha=0.96,
        facecolor="white",
        edgecolor="#D8E0EA",
        fontsize=8.6,
        title="GNI quartile",
        title_fontsize=9.2,
        borderpad=0.55,
        labelspacing=0.32,
        handletextpad=0.35,
    )
    for txt in leg.get_texts():
        txt.set_color("#344255")
    leg.get_title().set_color("#344255")

    fig.subplots_adjust(left=0.105, right=0.985, bottom=0.125, top=0.985)
    save(fig, out_dir, "appendix_gender_exposure_gap")


def labor_composition(data_dir: Path, out_dir: Path) -> None:
    df = pd.read_csv(data_dir / "paper_tables/cross_country_labor_composition.csv")
    cols = [c for c in df.columns if c not in {"ref_area", "Country"}]
    colors = ["#3b7ea1", "#78a890", "#d7b55f", "#a6a6a6"]
    fig, ax = plt.subplots(figsize=(7.5, 3.7))
    left = np.zeros(len(df))
    y = np.arange(len(df))
    for col, color in zip(cols, colors):
        ax.barh(y, df[col], left=left, label=col, color=color)
        left += df[col].to_numpy()
    ax.set_yticks(y)
    ax.set_yticklabels(df["Country"])
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xlabel("Share of employment (%)")
    ax.legend(loc="lower center", bbox_to_anchor=(0.5, -0.42), ncol=2, frameon=False, fontsize=8)
    ax.set_title("Cross-country labor composition", color=TEXT)
    save(fig, out_dir, "cross_country_labor_composition")


def remittance(data_dir: Path, out_dir: Path) -> None:
    df = pd.read_csv(data_dir / "indirect/remittance_weighted_exposure.csv")
    df = df[df["remittance_pct_gdp"] >= 10].copy()
    fig, ax = plt.subplots(figsize=(5.4, 4.6))
    ax.scatter(df["domestic_exposure"], df["remit_weighted_exposure"], color=BLUE, s=40, alpha=0.82)
    lo = min(df["domestic_exposure"].min(), df["remit_weighted_exposure"].min()) - 0.005
    hi = max(df["domestic_exposure"].max(), df["remit_weighted_exposure"].max()) + 0.005
    ax.plot([lo, hi], [lo, hi], ls="--", color="#9aa3aa", lw=1.3)
    df["delta"] = df["remit_weighted_exposure"] - df["domestic_exposure"]
    for _, row in df.sort_values("delta", ascending=False).head(4).iterrows():
        ax.annotate(row["country_name"], (row["domestic_exposure"], row["remit_weighted_exposure"]),
                    xytext=(4, 5), textcoords="offset points", fontsize=8, color=TEXT)
    ax.set_xlim(lo, hi)
    ax.set_ylim(lo, hi)
    ax.set_xlabel("Direct national AI exposure")
    ax.set_ylabel("Remittance-accounted national AI exposure")
    ax.set_title("Indirect exposure through remittances", color=TEXT)
    save(fig, out_dir, "remittance_bilateral")


def observed_outcomes(data_dir: Path, out_dir: Path) -> None:
    df = pd.read_csv(data_dir / "validation/observed_outcomes_vs_exposure.csv")
    name_map = {"anthropic": "anthropic", "signals": "openai", "microsoft": "microsoft"}
    for source_key, group in df.groupby("source_key", sort=False):
        fig, ax = plt.subplots(figsize=(4.8, 3.8))
        ax.scatter(group["weighted_exposure"], group["outcome_value"], color=BLUE, s=22, alpha=0.78)
        x = group["weighted_exposure"]
        y = group["outcome_value"]
        if bool(group["is_log_scale"].iloc[0]) and (y > 0).all():
            ax.set_yscale("log")
            add_fit(ax, x, np.log10(y), y_transform=lambda values: np.power(10.0, values))
        else:
            add_fit(ax, x, y)
        ax.set_xlabel("National AI exposure")
        ax.set_ylabel(group["metric_label"].iloc[0])
        ax.set_title(group["source"].iloc[0], color=TEXT)
        save(fig, out_dir, f"observed_outcomes_{name_map[source_key]}")


def alternative_exposure(data_dir: Path, out_dir: Path) -> None:
    occ = pd.read_csv(data_dir / "robustness/alternative_exposure_occupation.csv")
    nat = pd.read_csv(data_dir / "robustness/alternative_exposure_national.csv")
    panels = [
        (occ["exposure_score"], occ["dv_rating_beta"], "Occupation: Gmyrek vs Eloundou", "Gmyrek", "Eloundou"),
        (nat["gmyrek"], nat["eloundou"], "National: Gmyrek vs Eloundou", "Gmyrek", "Eloundou"),
    ]
    fig, axes = plt.subplots(1, 2, figsize=(8.0, 3.4))
    for ax, (x, y, title, xlabel, ylabel) in zip(axes.ravel(), panels):
        ax.scatter(x, y, color=BLUE, s=26, alpha=0.78)
        add_fit(ax, x, y)
        corr = corr_value(x, y, "spearman" if title.startswith("National") else "pearson")
        symbol = "rho" if title.startswith("National") else "r"
        ax.text(0.05, 0.93, f"{symbol} = {corr:.3f}", transform=ax.transAxes, va="top", color=TEXT)
        ax.set_title(title, fontsize=10, color=TEXT)
        ax.set_xlabel(xlabel)
        ax.set_ylabel(ylabel)
    fig.tight_layout()
    save(fig, out_dir, "alternative_exposure_estimates")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()
    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    distribution(data_dir, out_dir)
    white_collar(data_dir, out_dir)
    gender_exposure_gap(data_dir, out_dir)
    labor_composition(data_dir, out_dir)
    remittance(data_dir, out_dir)
    observed_outcomes(data_dir, out_dir)
    alternative_exposure(data_dir, out_dir)
    print(f"Wrote figures to {out_dir}")


if __name__ == "__main__":
    main()
