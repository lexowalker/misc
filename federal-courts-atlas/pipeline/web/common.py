"""Shared helpers for the web lane: paths, cached lane tables, merged sources, deterministic JSON."""
from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path

import pandas as pd

from pipeline.common.http import PROJECT_ROOT

ROOT = PROJECT_ROOT
PROC = ROOT / "data" / "processed"
SRC = ROOT / "data" / "sources"
GAPS = ROOT / "data" / "gaps"
PUB = ROOT / "public" / "data"

LANE = "web"
SMALL_BASE = 30          # cells resting on fewer cases/people than this carry a note
FACT_MIN_BASE = 50       # profile facts are never drawn from cells resting on fewer than this

# Districts whose county-sum population double-counts a statutory carve-out (data/gaps/boundaries.json
# split_counties_whole_in_county_tables).
APPROX_POP_DISTRICTS = ("mtd", "idd", "wyd", "ncmd", "nced")
APPROX_POP_NOTE = ("Population is approximate here: some counties are split by statute (Yellowstone National Park, "
                   "Fort Bragg and Camp MacKall, FCI Butner), and Census publishes no figures for the parts, so each "
                   "split county is counted whole in one district.")

EM_DASH = "\u2014"


def clean_text(s):
    """Remove em-dashes from copied text (client rule). A spaced em-dash becomes ', '; a bare one becomes '-'."""
    if not isinstance(s, str):
        return s
    s = s.replace(f" {EM_DASH} ", ", ").replace(EM_DASH, "-")
    return s


def deep_clean(obj):
    if isinstance(obj, str):
        return clean_text(obj)
    if isinstance(obj, list):
        return [deep_clean(x) for x in obj]
    if isinstance(obj, dict):
        return {clean_text(k) if isinstance(k, str) else k: deep_clean(v) for k, v in obj.items()}
    return obj


def num(x):
    """JSON-friendly number exactly as given: integral floats become ints, NaN becomes None."""
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    if f.is_integer() and abs(f) < 2**53:
        return int(f)
    return f


def dumps(obj, *, indent: int | None = None) -> str:
    obj = deep_clean(obj)
    if indent is None:
        return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=indent, allow_nan=False) + "\n"


def write_json(path: Path, obj, *, indent: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = dumps(obj, indent=indent)
    if path.exists() and path.read_text() == text:
        return
    path.write_text(text)


def read_json(path: Path):
    return json.loads(path.read_text())


@lru_cache(maxsize=None)
def table(lane: str, name: str) -> pd.DataFrame:
    """A lane's processed table (parquet preferred, csv fallback)."""
    pq = PROC / lane / f"{name}.parquet"
    if pq.exists():
        return pd.read_parquet(pq)
    return pd.read_csv(PROC / lane / f"{name}.csv", keep_default_na=False, na_values=[""])


@lru_cache(maxsize=None)
def lane_variables(lane: str) -> dict[str, dict]:
    p = PROC / lane / "variables.json"
    if not p.exists():
        return {}
    data = read_json(p)
    if isinstance(data, dict):
        data = data.get("variables", [])
    return {v["id"]: v for v in data}


@lru_cache(maxsize=None)
def lane_sources() -> dict[str, dict]:
    """All registered sources across lanes (data/sources/*.json), excluding the web lane's own series records."""
    out: dict[str, dict] = {}
    for p in sorted(SRC.glob("*.json")):
        if p.stem == LANE:
            continue
        for sid, rec in read_json(p).items():
            out[sid] = rec
    return out


def provenance_record(rec: dict) -> dict:
    return {k: rec.get(k) for k in ("dataset", "publisher", "url", "vintage", "retrieved_at")}


ORDINAL_WORDS = {1: "", 2: "second-", 3: "third-"}
CIRCUIT_NAMES = {
    "1": "First Circuit", "2": "Second Circuit", "3": "Third Circuit", "4": "Fourth Circuit",
    "5": "Fifth Circuit", "6": "Sixth Circuit", "7": "Seventh Circuit", "8": "Eighth Circuit",
    "9": "Ninth Circuit", "10": "Tenth Circuit", "11": "Eleventh Circuit", "DC": "D.C. Circuit",
}

_DEC = re.compile(r"\.(\d+)")


def decimals(fmt: str | None) -> int:
    m = _DEC.search(fmt or "")
    return int(m.group(1)) if m else 0


def fmt_number(value: float, fmt: str | None) -> str:
    d = decimals(fmt)
    # Never round away a published fraction (shared judgeships are halves: 3.5 must not print as 4).
    # Matches src/lib/format.ts formatValue.
    if d == 0 and value != int(value):
        d = 1
    return f"{value:,.{d}f}"


UNIT_WORDS = {
    "months": ("month", "months"), "cases": ("case", "cases"), "per_judgeship": ("per judgeship", "per judgeship"),
    "per_100k": ("per 100,000 residents", "per 100,000 residents"), "judges": ("judge", "judges"),
    "judgeships": ("judgeship", "judgeships"), "persons": ("person", "people"),
}


def fmt_value(value: float, unit: str, fmt: str | None, *, with_unit: bool = True) -> str:
    """Matches src/lib/format.ts formatValue for the units this lane emits."""
    n = fmt_number(value, fmt)
    if unit == "percent":
        return f"{n}%"
    if not with_unit:
        return n
    words = UNIT_WORDS.get(unit)
    if words:
        return f"{n} {words[0] if value == 1 else words[1]}"
    return n
