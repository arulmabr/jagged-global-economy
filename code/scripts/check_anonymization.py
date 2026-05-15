#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path


BAD_PATTERNS = [
    "/" + "Users" + "/",
    "\\" + "Users" + "\\",
    "\\\\" + "Users" + "\\\\",
    "Desktop" + "/my_repos",
    "/home/",
    "overleaf" + "_scratch",
    "wild" + "_ideas",
    "grain" + ".com",
    ".git/",
    "__pycache__",
]

RAW_SUFFIXES = {".xlsx", ".xls", ".dta", ".sav", ".rds", ".parquet", ".feather", ".pkl", ".pickle"}
RAW_FILENAMES = {
    "wb_knomad.xlsx",
    "final_scores_isco08_gmyrek_et_al_2025.xlsx",
    "ms_ai_" + "adoption.csv",
    "ilo_employment_isco2.csv",
    "ilo_earnings_by_occupation.csv",
    "ilo_labor_share_sdg1041.csv",
}
SKIP_PARTS = {
    ".venv",
    "venv",
    "env",
    "outputs",
    ".ipynb_checkpoints",
    "__pycache__",
}
ALLOWED_SYNTHETIC_PHRASES = {
    "no synthetic data",
    "no synthetic exposure values",
    "synthetic data are included",
    "hasSyntheticData",
}

TEXT_SUFFIXES = {".py", ".md", ".txt", ".csv", ".json", ".tex", ".yml", ".yaml", ".cff", ".ipynb", ".html", ".Makefile", ""}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("package_root")
    args = parser.parse_args()
    root = Path(args.package_root).resolve()
    problems: list[str] = []

    for path in root.rglob("*"):
        rel = path.relative_to(root)
        rel_text = str(rel)
        if any(part in SKIP_PARTS for part in rel.parts):
            continue
        if path.name == "texput.log":
            problems.append(f"temporary LaTeX log present: {rel_text}")
        if path.name == ".DS" + "_Store":
            problems.append(f"macOS metadata file present: {rel_text}")
        if ".git" in path.parts:
            problems.append(f"git metadata present: {rel_text}")
        if path.is_file() and path.suffix.lower() in RAW_SUFFIXES:
            problems.append(f"raw/source-like file extension present: {rel_text}")
        if path.is_file() and path.name.lower() in RAW_FILENAMES:
            problems.append(f"known raw source filename present: {rel_text}")
        if any(pattern in rel_text for pattern in BAD_PATTERNS):
            problems.append(f"blocked path pattern in {rel_text}")
        if not path.is_file():
            continue
        if path.resolve() == Path(__file__).resolve():
            continue
        if path.suffix not in TEXT_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        lower = text.lower()
        for pattern in BAD_PATTERNS:
            if pattern.lower() in lower:
                problems.append(f"blocked text pattern {pattern!r} in {rel_text}")
        if "proxy_data" in lower or "proxy_score" in lower:
            problems.append(f"blocked scratch proxy reference in {rel_text}")
        if "synthetic" in lower and not any(phrase.lower() in lower for phrase in ALLOWED_SYNTHETIC_PHRASES):
            problems.append(f"blocked synthetic-data reference in {rel_text}")

    if problems:
        raise SystemExit("Anonymization check failed:\n" + "\n".join(sorted(problems)))
    print("Anonymization check passed.")


if __name__ == "__main__":
    main()
