#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import nbformat
from nbclient import NotebookClient


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--notebooks-dir", required=True)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()

    notebooks_dir = Path(args.notebooks_dir).resolve()
    data_dir = Path(args.data_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    os.environ["NEURIPS_DATA_DIR"] = str(data_dir)
    package_root = notebooks_dir.parent
    kernel_name = "neurips-reviewer-current-python"
    kernel_root = out_dir / "_kernel"
    kernel_dir = kernel_root / "kernels" / kernel_name
    kernel_dir.mkdir(parents=True, exist_ok=True)
    (kernel_dir / "kernel.json").write_text(
        json.dumps(
            {
                "argv": [sys.executable, "-m", "ipykernel_launcher", "-f", "{connection_file}"],
                "display_name": "Current Python",
                "language": "python",
            }
        ),
        encoding="utf-8",
    )
    os.environ["JUPYTER_PATH"] = str(kernel_root) + os.pathsep + os.environ.get("JUPYTER_PATH", "")

    for notebook_path in sorted(notebooks_dir.glob("*.ipynb")):
        nb = nbformat.read(notebook_path, as_version=4)
        client = NotebookClient(nb, timeout=180, kernel_name=kernel_name)
        client.execute(cwd=package_root)
        out_path = out_dir / notebook_path.name
        nbformat.write(nb, out_path)
        print(f"Executed {notebook_path} -> {out_path}")


if __name__ == "__main__":
    main()
