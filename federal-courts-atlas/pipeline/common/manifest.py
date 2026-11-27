"""Source manifest, data-gap log, and the shared observations table writer.

Each lane writes ONLY its own fragments:
  data/sources/<lane>.json:   every source file it used (URL, dataset, vintage, retrieval date, sha256)
  data/gaps/<lane>.json:      every value it could not source (shown as "No data" in the UI)
  data/processed/<lane>/observations.{parquet,csv}: tidy district-period-variable values

``python -m pipeline.build_docs`` assembles SOURCES.md and DATA_GAPS.md from the fragments.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from .districts import BY_ID
from .http import PROJECT_ROOT, CachedResponse, file_sha256

DATA = PROJECT_ROOT / "data"

OBS_COLUMNS = [
    "district_id",     # registry id, e.g. "vaed"
    "period",          # int year label (e.g. 2023)
    "period_type",     # see PERIOD_TYPES
    "variable",        # snake_case id, documented in the lane's variables list
    "value",           # float; NaN only if explicitly reported missing (prefer omitting the row + logging a gap)
    "unit",            # "months", "cases", "percent", "count", "per_judgeship", ...
    "source_id",       # key in data/sources/<lane>.json
    "source_locator",  # where in the source file: table/page/sheet/row/column, or the query/filter used
]
PERIOD_TYPES = {
    "FY_SEP30": "12-month period ending September 30 of `period` (federal fiscal year; USSC fiscal year)",
    "CY": "calendar year",
    "12M_JUN30": "12-month period ending June 30 of `period`",
    "12M_MAR31": "12-month period ending March 31 of `period`",
    "12M_DEC31": "12-month period ending December 31 of `period`",
    "SNAPSHOT_SEP30": "point-in-time count as of September 30 of `period`",
    "JUL1_EST": "Census population estimate as of July 1 of `period`",
    "APR1_CENSUS": "decennial census count as of April 1 of `period`",
}


def _load(path: Path) -> dict:
    return json.loads(path.read_text()) if path.exists() else {}


def register_source(lane: str, source_id: str, *, url: str, dataset: str, publisher: str,
                    vintage: str, retrieved_at: str | None = None, local_path: str | Path | None = None,
                    sha256: str | None = None, notes: str = "", cached: CachedResponse | None = None) -> None:
    """Record one source file. Pass ``cached`` (from http.fetch) to fill retrieval metadata automatically."""
    if cached is not None:
        retrieved_at = retrieved_at or cached.meta["retrieved_at"]
        local_path = local_path or cached.path
        sha256 = sha256 or cached.meta["sha256"]
    if local_path and not sha256 and Path(local_path).exists():
        sha256 = file_sha256(Path(local_path))
    path = DATA / "sources" / f"{lane}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    m = _load(path)
    m[source_id] = {
        "lane": lane, "url": url, "dataset": dataset, "publisher": publisher, "vintage": vintage,
        "retrieved_at": retrieved_at,
        "local_path": str(Path(local_path).relative_to(PROJECT_ROOT)) if local_path and Path(local_path).is_absolute() else (str(local_path) if local_path else None),
        "sha256": sha256, "notes": notes,
    }
    path.write_text(json.dumps(dict(sorted(m.items())), indent=1))


def record_gap(lane: str, gap_id: str, *, description: str, variables: list[str] | None = None,
               districts: list[str] | str | None = None, periods: list[int] | str | None = None,
               reason: str = "") -> None:
    """Record a value (or block of values) that could not be sourced."""
    path = DATA / "gaps" / f"{lane}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    g = _load(path)
    g[gap_id] = {"lane": lane, "description": description, "variables": variables or [],
                 "districts": districts or [], "periods": periods or [], "reason": reason}
    path.write_text(json.dumps(dict(sorted(g.items())), indent=1))


def write_observations(lane: str, df: pd.DataFrame, name: str = "observations") -> Path:
    """Validate and write a tidy observations table for ``lane``."""
    missing = [c for c in OBS_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"observations missing columns {missing}")
    df = df[OBS_COLUMNS + [c for c in df.columns if c not in OBS_COLUMNS]].copy()
    bad = sorted(set(df["district_id"]) - set(BY_ID))
    if bad:
        raise ValueError(f"unknown district ids: {bad}")
    badp = sorted(set(df["period_type"]) - set(PERIOD_TYPES))
    if badp:
        raise ValueError(f"unknown period types: {badp}")
    srcs = _load(DATA / "sources" / f"{lane}.json")
    unk = sorted(set(df["source_id"]) - set(srcs))
    if unk:
        raise ValueError(f"source_ids not registered in data/sources/{lane}.json: {unk[:10]}")
    dup = df.duplicated(["district_id", "period", "period_type", "variable"])
    if dup.any():
        raise ValueError(f"{dup.sum()} duplicate district/period/variable rows")
    df["period"] = df["period"].astype(int)
    df["value"] = pd.to_numeric(df["value"], errors="raise")
    out = DATA / "processed" / lane
    out.mkdir(parents=True, exist_ok=True)
    df = df.sort_values(["variable", "district_id", "period"]).reset_index(drop=True)
    df.to_parquet(out / f"{name}.parquet", index=False)
    df.to_csv(out / f"{name}.csv", index=False)
    return out / f"{name}.parquet"
