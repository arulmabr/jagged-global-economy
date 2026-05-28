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
MICROSOFT_ADOPTION_PATH = DATA_DIR / "validation/microsoft_ai_diffusion_country_adoption.csv"
OUT_PATH = REPO_ROOT / "assets/interactive_data.json"

EXCLUSION_COUNTRY_CODES = {
    "Grenada": "GRD",
    "Liberia": "LBR",
    "Nigeria": "NGA",
    "Nauru": "NRU",
    "Senegal": "SEN",
    "Seychelles": "SYC",
    "Armenia": "ARM",
    "Malta": "MLT",
    "Malaysia": "MYS",
    "Namibia": "NAM",
    "Nicaragua": "NIC",
    "Trinidad and Tobago": "TTO",
    "Ukraine": "UKR",
    "Yemen": "YEM",
    "South Africa": "ZAF",
    "Canada": "CAN",
    "China": "CHN",
    "Algeria": "DZA",
    "Kazakhstan": "KAZ",
    "Republic of Korea": "KOR",
    "Morocco": "MAR",
    "New Zealand": "NZL",
    "Saudi Arabia": "SAU",
    "Uzbekistan": "UZB",
    "Iceland": "ISL",
    "Slovakia": "SVK",
}

EXCLUSION_EXPLANATIONS = {
    "Low reliability": "Available occupation data did not meet the release reliability threshold.",
    "ISCO-88 only": "Available employment data use ISCO-88 rather than the ISCO-08 occupation system used here.",
    "Major-group only": "Available employment data are too aggregated for the occupation-level exposure measure.",
    "TOTAL/NEC only": "Available employment data do not include usable occupation detail.",
}


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


def mean(values: list[float]) -> float | None:
    clean = [value for value in values if value is not None and math.isfinite(value)]
    if not clean:
        return None
    return sum(clean) / len(clean)


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


def r_squared(points: list[dict], x_key: str, y_key: str) -> float | None:
    clean = [
        (point[x_key], point[y_key])
        for point in points
        if point.get(x_key) is not None and point.get(y_key) is not None
    ]
    if len(clean) < 2:
        return None
    x_mean = sum(x for x, _ in clean) / len(clean)
    y_mean = sum(y for _, y in clean) / len(clean)
    x_ss = sum((x - x_mean) ** 2 for x, _ in clean)
    y_ss = sum((y - y_mean) ** 2 for _, y in clean)
    if x_ss == 0 or y_ss == 0:
        return None
    xy = sum((x - x_mean) * (y - y_mean) for x, y in clean)
    return (xy**2) / (x_ss * y_ss)


def build_national_exposure() -> list[dict]:
    rows = read_csv(DATA_DIR / "aggregates/national_exposure_map_data.csv")
    points = []
    for row in rows:
        point = {
            "countryCode": row["country_code"],
            "countryName": row["country_name"],
            "exposure": as_float(row["weighted_exposure"]),
            "employmentK": as_float(row["total_employment_k"]),
            "region": row["region"] or "Not classified",
            "incomeGroup": row["income_group"] or "Not classified",
            "population2024": as_float(row["population_2024"]),
        }
        points.append(point)
    require_fields(points, ["countryCode", "countryName", "exposure"], "nationalExposure")
    return points


def build_missing_countries(measured_codes: set[str]) -> list[dict]:
    rows = read_csv(DATA_DIR / "coverage/country_exclusion_lists.csv")
    countries = []
    for row in rows:
        reason = row["reason"]
        for country_name in row["countries"].split(";"):
            country_name = country_name.strip()
            country_code = EXCLUSION_COUNTRY_CODES.get(country_name)
            if not country_code or country_code in measured_codes:
                continue
            countries.append(
                {
                    "countryCode": country_code,
                    "countryName": country_name,
                    "reason": reason,
                    "explanation": EXCLUSION_EXPLANATIONS.get(
                        reason,
                        "This country is not in the released national exposure sample.",
                    ),
                }
            )
    require_fields(countries, ["countryCode", "countryName", "reason", "explanation"], "missingCountries")
    return sorted(countries, key=lambda country: country["countryName"])


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


def build_exposure_drivers(national_lookup: dict[str, dict]) -> dict:
    rows = read_csv(DATA_DIR / "validation/exposure_predictor_country_panel.csv")
    points = []
    for row in rows:
        extra = national_lookup.get(row["country_code"], {})
        wc_share = as_float(row["wc_share"])
        point = {
            "countryCode": row["country_code"],
            "countryName": row["country_name"],
            "exposure": as_float(row["weighted_exposure"]),
            "wcSharePct": wc_share * 100 if wc_share is not None else None,
            "internetPct": as_float(row["internet_pct"]),
            "logGni": as_float(row["log_gni"]),
            "cmpNational": as_float(row["cmp_national"]),
            "region": extra.get("region"),
            "incomeGroup": extra.get("incomeGroup"),
        }
        points.append(point)

    predictors = {
        "wcSharePct": {
            "label": "White-collar share",
            "xTitle": "White-collar employment share (%)",
            "tickSuffix": "%",
            "xMin": 0,
            "note": "Share of workers in ISCO 1-4 occupations.",
        },
        "internetPct": {
            "label": "Internet access",
            "xTitle": "Individuals using the internet (%)",
            "tickSuffix": "%",
            "xMin": 0,
            "note": "Country-level internet use from the release predictor panel.",
        },
        "logGni": {
            "label": "Income",
            "xTitle": "log GNI per capita, PPP",
            "tickSuffix": "",
            "xMin": None,
            "note": "Logged GNI per capita, PPP.",
        },
        "cmpNational": {
            "label": "Task mix",
            "xTitle": "Task mix",
            "tickSuffix": "",
            "xMin": 0,
            "note": "National cognitive-minus-physical task-structure score aggregated from O*NET/ISCO occupational properties.",
        },
    }
    metrics = {}
    for key in predictors:
        valid = [point for point in points if point[key] is not None and point["exposure"] is not None]
        metrics[key] = {
            "nCountries": len(valid),
            "rSquared": r_squared(valid, key, "exposure"),
            "fit": linear_fit(valid, key, "exposure"),
        }
    require_fields(points, ["countryCode", "countryName", "exposure"], "exposureDrivers")
    return {"points": points, "predictors": predictors, "metrics": metrics}


def build_country_explorer(national_lookup: dict[str, dict]) -> dict:
    enriched_rows = read_csv(DATA_DIR / "core/nation_exposure_enriched.csv")
    contribution_rows = read_csv(DATA_DIR / "mechanisms/occupation_contributions.csv")
    gender_rows = read_csv(DATA_DIR / "mechanisms/gender_gap.csv")
    adoption_rows = read_csv(DATA_DIR / "validation/observed_outcomes_vs_exposure.csv")
    remittance_rows = read_csv(DATA_DIR / "indirect/remittance_weighted_exposure.csv")
    corridor_rows = read_csv(DATA_DIR / "indirect/remittance_corridor_evidence.csv")
    occupations_by_country: dict[str, list[dict]] = {}

    for row in contribution_rows:
        country_code = row["country_code"]
        occupation = {
            "iscoCode": row["isco08_2d"],
            "label": row["description_2d"],
            "macroSector": row["macro_sector"],
            "isWhiteCollar": as_bool(row["is_white_collar"]),
            "employmentSharePct": (as_float(row["employment_share"]) or 0) * 100,
            "exposureScore": as_float(row["exposure_score"]),
            "contribution": as_float(row["contribution"]),
            "contributionPct": as_float(row["contribution_pct"]),
        }
        occupations_by_country.setdefault(country_code, []).append(occupation)

    exposure_points = [
        {
            "countryCode": row["country_code"],
            "exposure": as_float(row["weighted_exposure"]),
            "region": national_lookup.get(row["country_code"], {}).get("region"),
            "incomeGroup": national_lookup.get(row["country_code"], {}).get("incomeGroup"),
        }
        for row in enriched_rows
    ]
    exposure_points = [point for point in exposure_points if point["exposure"] is not None]
    n_countries = len(exposure_points)
    sorted_by_exposure = sorted(exposure_points, key=lambda point: point["exposure"], reverse=True)
    rank_lookup = {
        point["countryCode"]: {
            "rank": rank,
            "percentile": ((n_countries - rank) / (n_countries - 1) * 100) if n_countries > 1 else None,
            "nCountries": n_countries,
        }
        for rank, point in enumerate(sorted_by_exposure, start=1)
    }

    region_average_lookup = {
        region: mean([point["exposure"] for point in exposure_points if point["region"] == region])
        for region in {point["region"] for point in exposure_points}
    }
    income_average_lookup = {
        income_group: mean([point["exposure"] for point in exposure_points if point["incomeGroup"] == income_group])
        for income_group in {point["incomeGroup"] for point in exposure_points}
    }

    gender_lookup = {}
    for row in gender_rows:
        if not as_bool(row.get("reliable")):
            continue
        gender_lookup[row["country_code"]] = {
            "maleExposure": as_float(row["male_exposure"]),
            "femaleExposure": as_float(row["female_exposure"]),
            "gap": as_float(row["gender_gap"]),
            "relativeGapPct": (
                as_float(row["relative_gender_gap"]) * 100
                if as_float(row["relative_gender_gap"]) is not None
                else None
            ),
        }

    adoption_lookup: dict[str, dict[str, dict]] = {}
    for row in adoption_rows:
        country_code = row["country_code"]
        source_key = row["source_key"]
        adoption_lookup.setdefault(country_code, {})[source_key] = {
            "source": row["source"],
            "metricLabel": row["metric_label"],
            "value": as_float(row["outcome_value"]),
            "isLogScale": as_bool(row["is_log_scale"]),
        }

    remittance_lookup = {
        row["country_code"]: {
            "domesticExposure": as_float(row["domestic_exposure"]),
            "remittanceExposure": as_float(row["remit_weighted_exposure"]),
            "remittancePctGdp": as_float(row["remittance_pct_gdp"]),
            "sourceShareCovered": as_float(row["source_share_covered"]),
            "totalInflowM": as_float(row["total_inflow_m"]),
        }
        for row in remittance_rows
    }
    corridors_by_receiver: dict[str, list[dict]] = {}
    for row in corridor_rows:
        corridors_by_receiver.setdefault(row["receiver_code"], []).append(
            {
                "senderCode": row["sender_code"],
                "senderName": row["sender_name"],
                "senderShareInflowPct": (as_float(row["sender_share_inflow"]) or 0) * 100,
                "senderExposure": as_float(row["sender_direct_exposure"]),
                "matrixYear": as_float(row["matrix_year"]),
            }
        )

    explorer = {}
    for row in enriched_rows:
        country_code = row["country_code"]
        extra = national_lookup.get(country_code, {})
        exposure = as_float(row["weighted_exposure"])
        region_average = region_average_lookup.get(extra.get("region"))
        income_average = income_average_lookup.get(extra.get("incomeGroup"))
        all_occupations = occupations_by_country.get(country_code, [])
        top_occupations_by_employment = sorted(
            all_occupations,
            key=lambda occupation: occupation["employmentSharePct"],
            reverse=True,
        )[:5]
        top_occupations_by_contribution = sorted(
            occupations_by_country.get(country_code, []),
            key=lambda occupation: occupation["contributionPct"] if occupation["contributionPct"] is not None else -1,
            reverse=True,
        )[:5]
        explorer[country_code] = {
            "countryCode": country_code,
            "countryName": row["country_name"],
            "region": extra.get("region"),
            "incomeGroup": extra.get("incomeGroup"),
            "reliability": row["reliability"],
            "exposure": exposure,
            "exposureRank": rank_lookup.get(country_code, {}).get("rank"),
            "exposurePercentile": rank_lookup.get(country_code, {}).get("percentile"),
            "nCountries": rank_lookup.get(country_code, {}).get("nCountries"),
            "regionAverageExposure": region_average,
            "regionExposureDelta": exposure - region_average if exposure is not None and region_average is not None else None,
            "incomeAverageExposure": income_average,
            "incomeExposureDelta": exposure - income_average if exposure is not None and income_average is not None else None,
            "totalEmploymentK": as_float(row["total_employment_k"]),
            "laborStructure": {
                "whiteCollarSharePct": as_float(row["wc_share"]) * 100
                if as_float(row["wc_share"]) is not None
                else None,
                "whiteCollarExposure": as_float(row["wc_exposure"]),
                "blueCollarExposure": as_float(row["bc_exposure"]),
            },
            "gender": gender_lookup.get(country_code),
            "adoption": adoption_lookup.get(country_code, {}),
            "remittance": remittance_lookup.get(country_code),
            "remittanceCorridors": sorted(
                corridors_by_receiver.get(country_code, []),
                key=lambda corridor: corridor["senderShareInflowPct"],
                reverse=True,
            ),
            "topOccupations": top_occupations_by_employment,
            "topOccupationsByEmployment": top_occupations_by_employment,
            "topOccupationsByContribution": top_occupations_by_contribution,
        }

    critical_country_fields = [
        "countryCode",
        "countryName",
        "region",
        "incomeGroup",
        "reliability",
        "exposure",
        "exposureRank",
        "nCountries",
        "regionAverageExposure",
        "incomeAverageExposure",
        "totalEmploymentK",
    ]
    missing = [
        (country_code, field)
        for country_code, country in explorer.items()
        for field in critical_country_fields
        if country.get(field) is None or country.get(field) == ""
    ]
    if missing:
        sample = ", ".join(f"{country_code}.{field}" for country_code, field in missing[:5])
        raise ValueError(f"countryExplorer has missing critical country fields: {sample}")

    occupation_fields = ["iscoCode", "label", "employmentSharePct", "exposureScore", "contributionPct"]
    occupation_missing = [
        (country_code, idx, field)
        for country_code, country in explorer.items()
        for idx, occupation in enumerate(country["topOccupationsByEmployment"] + country["topOccupationsByContribution"])
        for field in occupation_fields
        if occupation.get(field) is None or occupation.get(field) == ""
    ]
    if occupation_missing:
        sample = ", ".join(
            f"{country_code}.topOccupations[{idx}].{field}"
            for country_code, idx, field in occupation_missing[:5]
        )
        raise ValueError(f"countryExplorer has missing critical occupation fields: {sample}")

    return explorer


def build_adoption() -> dict:
    rows = read_csv(DATA_DIR / "validation/observed_outcomes_vs_exposure.csv")
    exposure_lookup = {
        row["country_code"]: {
            "countryName": row["country_name"],
            "exposure": as_float(row["weighted_exposure"]),
        }
        for row in read_csv(DATA_DIR / "core/nation_exposure_enriched.csv")
    }
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

    microsoft_points = []
    for row in read_csv(MICROSOFT_ADOPTION_PATH):
        exposure = exposure_lookup.get(row["country_code"])
        if not exposure:
            continue
        microsoft_points.append(
            {
                "countryCode": row["country_code"],
                "countryName": exposure["countryName"],
                "exposure": exposure["exposure"],
                "value": as_float(row.get("adoption_rate_q1_2026") or row["adoption_rate"]),
            }
        )
    require_fields(
        microsoft_points,
        ["countryCode", "countryName", "exposure", "value"],
        "adoption.microsoft",
    )
    expected_microsoft_n = stats.get("microsoft", {}).get("nCountries")
    if expected_microsoft_n and len(microsoft_points) != round(expected_microsoft_n):
        raise ValueError(
            "adoption.microsoft point count does not match "
            f"observed_outcomes_vs_exposure_stats.csv: {len(microsoft_points)} "
            f"!= {round(expected_microsoft_n)}"
        )
    series["microsoft"] = {
        **stats.get("microsoft", {}),
        "points": microsoft_points,
        "isLogScale": False,
        "fit": linear_fit(microsoft_points, "exposure", "value"),
    }
    return series


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
        "missingCountries": build_missing_countries(set(national_lookup)),
        "laborComposition": build_labor_composition(),
        "countryExplorer": build_country_explorer(national_lookup),
        "whiteCollar": build_white_collar(national_lookup),
        "exposureDrivers": build_exposure_drivers(national_lookup),
        "adoption": build_adoption(),
        "remittance": build_remittance(),
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH.relative_to(REPO_ROOT)}")
    print(
        "Counts:",
        f"national={len(payload['nationalExposure'])}",
        f"missing={len(payload['missingCountries'])}",
        f"country_explorer={len(payload['countryExplorer'])}",
        f"exposure_drivers={len(payload['exposureDrivers']['points'])}",
        f"white_collar={len(payload['whiteCollar']['points'])}",
        f"anthropic={len(payload['adoption']['anthropic']['points'])}",
        f"openai={len(payload['adoption']['signals']['points'])}",
        f"microsoft={len(payload['adoption']['microsoft']['points'])}",
        f"remittance={len(payload['remittance']['points'])}",
    )


if __name__ == "__main__":
    main()
