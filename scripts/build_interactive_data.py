#!/usr/bin/env python3
"""Build the compact JSON payload used by the project-page plots."""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data"
OUT_PATH = REPO_ROOT / "assets/interactive_data.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def as_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    return parsed if math.isfinite(parsed) else None


def as_bool(value: str | None) -> bool:
    return str(value).strip().lower() == "true"


def require_fields(rows: list[dict], fields: list[str], name: str) -> None:
    missing = [
        (idx, field)
        for idx, row in enumerate(rows)
        for field in fields
        if row.get(field) is None
    ]
    if missing:
        sample = ", ".join(f"row {idx} field {field}" for idx, field in missing[:5])
        raise ValueError(f"{name} has missing critical plotting fields: {sample}")


def linear_fit(points: list[dict], x_key: str, y_key: str, *, log_y: bool = False) -> dict:
    clean = []
    for point in points:
        x = point[x_key]
        y = point[y_key]
        if x is None or y is None:
            continue
        if log_y:
            if y <= 0:
                continue
            y = math.log10(y)
        clean.append((x, y))

    n = len(clean)
    if n < 2:
        return {"points": [], "slope": None, "intercept": None}

    x_mean = sum(x for x, _ in clean) / n
    y_mean = sum(y for _, y in clean) / n
    denom = sum((x - x_mean) ** 2 for x, _ in clean)
    slope = sum((x - x_mean) * (y - y_mean) for x, y in clean) / denom
    intercept = y_mean - slope * x_mean
    x_min = min(x for x, _ in clean)
    x_max = max(x for x, _ in clean)

    y0 = intercept + slope * x_min
    y1 = intercept + slope * x_max
    if log_y:
        y0 = 10**y0
        y1 = 10**y1

    return {
        "points": [{"x": x_min, "y": y0}, {"x": x_max, "y": y1}],
        "slope": slope,
        "intercept": intercept,
    }


def build_national_exposure() -> list[dict]:
    rows = read_csv(DATA_DIR / "aggregates/national_exposure_map_data.csv")
    points = []
    for row in rows:
        point = {
            "countryCode": row["country_code"],
            "countryName": row["country_name"],
            "exposure": as_float(row["weighted_exposure"]),
            "employmentK": as_float(row["total_employment_k"]),
            "region": row["region"],
            "incomeGroup": row["income_group"],
            "population2024": as_float(row["population_2024"]),
        }
        points.append(point)
    require_fields(points, ["countryCode", "countryName", "exposure"], "nationalExposure")
    return points


def build_labor_composition() -> dict:
    rows = read_csv(DATA_DIR / "paper_tables/cross_country_labor_composition.csv")
    categories = [
        "Office and knowledge work (ISCO 1--4)",
        "Services and sales (ISCO 5)",
        "Agriculture (ISCO 6)",
        "Production, operators, and elementary work (ISCO 7--9)",
    ]
    countries = []
    for row in rows:
        countries.append(
            {
                "countryCode": row["ref_area"],
                "countryName": row["Country"],
                "shares": {category: as_float(row[category]) for category in categories},
            }
        )
    return {"categories": categories, "countries": countries}


def build_white_collar(national_lookup: dict[str, dict]) -> dict:
    rows = read_csv(DATA_DIR / "core/nation_exposure_enriched.csv")
    points = []
    for row in rows:
        extra = national_lookup.get(row["country_code"], {})
        point = {
            "countryCode": row["country_code"],
            "countryName": row["country_name"],
            "exposure": as_float(row["weighted_exposure"]),
            "wcSharePct": (as_float(row["wc_share"]) or 0) * 100,
            "region": extra.get("region"),
            "incomeGroup": extra.get("incomeGroup"),
            "employmentK": as_float(row["total_employment_k"]),
        }
        points.append(point)
    require_fields(points, ["countryCode", "countryName", "exposure", "wcSharePct"], "whiteCollar")

    metrics_rows = read_csv(DATA_DIR / "paper_tables/structural_baseline_metrics.csv")
    metrics = {
        row["specification"]: {"rSquared": as_float(row["r_squared"]), "note": row["note"]}
        for row in metrics_rows
    }
    return {"points": points, "metrics": metrics, "fit": linear_fit(points, "wcSharePct", "exposure")}


def build_adoption() -> dict:
    rows = read_csv(DATA_DIR / "validation/observed_outcomes_vs_exposure.csv")
    stats = {
        row["source_key"]: {
            "source": row["source"],
            "metricLabel": row["metric_label"],
            "nCountries": as_float(row["n_countries"]),
            "spearmanRho": as_float(row["spearman_rho"]),
        }
        for row in read_csv(DATA_DIR / "validation/observed_outcomes_vs_exposure_stats.csv")
    }

    series: dict[str, dict] = {}
    for source_key in ["anthropic", "signals"]:
        source_rows = [row for row in rows if row["source_key"] == source_key]
        points = [
            {
                "countryCode": row["country_code"],
                "countryName": row["country_name"],
                "exposure": as_float(row["weighted_exposure"]),
                "value": as_float(row["outcome_value"]),
            }
            for row in source_rows
        ]
        require_fields(points, ["countryCode", "countryName", "exposure", "value"], f"adoption.{source_key}")
        is_log_scale = as_bool(source_rows[0]["is_log_scale"]) if source_rows else False
        series[source_key] = {
            **stats.get(source_key, {}),
            "points": points,
            "isLogScale": is_log_scale,
            "fit": linear_fit(points, "exposure", "value", log_y=is_log_scale),
        }

    series["microsoft"] = {
        **stats.get("microsoft", {}),
        "points": [],
        "isLogScale": False,
        "fit": {"points": [], "slope": None, "intercept": None},
        "note": "Microsoft country-level adoption points are not redistributed in this public release.",
    }
    return series


def ensure_release_safe(payload: dict) -> None:
    microsoft_points = payload.get("adoption", {}).get("microsoft", {}).get("points", [])
    if microsoft_points:
        raise ValueError(
            "Release-safe guard failed: public interactive_data.json must not "
            "include Microsoft country-level adoption rows."
        )


def build_remittance() -> dict:
    rows = read_csv(DATA_DIR / "indirect/remittance_weighted_exposure.csv")
    points = []
    for row in rows:
        remittance_pct = as_float(row["remittance_pct_gdp"])
        if remittance_pct is None or remittance_pct < 10:
            continue
        point = {
            "countryCode": row["country_code"],
            "countryName": row["country_name"],
            "domesticExposure": as_float(row["domestic_exposure"]),
            "remittanceExposure": as_float(row["remit_weighted_exposure"]),
            "remittancePctGdp": remittance_pct,
            "sourceShareCovered": as_float(row["source_share_covered"]),
            "totalInflowM": as_float(row["total_inflow_m"]),
        }
        points.append(point)
    require_fields(points, ["countryCode", "countryName", "domesticExposure", "remittanceExposure", "remittancePctGdp"], "remittance")
    return {"points": points}


def main() -> None:
    national = build_national_exposure()
    national_lookup = {row["countryCode"]: row for row in national}
    payload = {
        "nationalExposure": national,
        "laborComposition": build_labor_composition(),
        "whiteCollar": build_white_collar(national_lookup),
        "adoption": build_adoption(),
        "remittance": build_remittance(),
    }
    ensure_release_safe(payload)
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH.relative_to(REPO_ROOT)}")
    print(
        "Counts:",
        f"national={len(payload['nationalExposure'])}",
        f"white_collar={len(payload['whiteCollar']['points'])}",
        f"anthropic={len(payload['adoption']['anthropic']['points'])}",
        f"openai={len(payload['adoption']['signals']['points'])}",
        f"microsoft={len(payload['adoption']['microsoft']['points'])}",
        f"remittance={len(payload['remittance']['points'])}",
    )


if __name__ == "__main__":
    main()
