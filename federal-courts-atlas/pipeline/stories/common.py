"""Shared helpers for the stories lane.

Every number a story shows is registered with :meth:`Story.num` (or :meth:`Story.year`,
:meth:`Story.district`). Each entry carries its value, the exact display text, the source ids of
the rows it was computed from, a plain-English note on how it was computed and, for derived
values, a formula. Charts and map layers carry their own source ids and derived flags.

Nothing here fetches data or calls a model. Inputs are the processed lane tables and the
source manifests in data/sources/*.json.
"""
from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path

import pandas as pd

from pipeline.common.districts import BY_ID, IDS
from pipeline.common.http import PROJECT_ROOT

ROOT = PROJECT_ROOT
PROC = ROOT / "data" / "processed"
SRC = ROOT / "data" / "sources"
PUB = ROOT / "public" / "data"
OUT = PUB / "stories"

LANE = "stories"
EM_DASH = chr(0x2014)
NATIONAL = "_national"


# ---------------------------------------------------------------- tables

@lru_cache(maxsize=None)
def _parquet(rel: str) -> pd.DataFrame:
    return pd.read_parquet(PROC / rel)


@lru_cache(maxsize=None)
def _csv(rel: str) -> pd.DataFrame:
    return pd.read_csv(PROC / rel, keep_default_na=False, na_values=[""])


def obs(lane: str, variable: str, table: str = "observations") -> pd.DataFrame:
    """District rows of one variable: district_id, period, value, source_id (+ numerator/denominator/n_basis
    where the lane publishes them). Sorted by district, period."""
    df = _parquet(f"{lane}/{table}.parquet")
    df = df[df["variable"] == variable].copy()
    df = df[df["district_id"].isin(IDS)]
    if df.duplicated(["district_id", "period"]).any():
        raise ValueError(f"duplicate district-years in {lane}/{table} {variable}")
    return df.sort_values(["district_id", "period"]).reset_index(drop=True)


def national(lane: str, variable: str, current_method: bool = False) -> pd.DataFrame:
    """National rows of one variable: period, value, source_id (+ numerator/denominator/n_basis)."""
    if lane == "fcms":
        df = _csv("fcms/national_current_method.csv" if current_method else "fcms/national.csv")
    elif lane == "idb":
        df = _parquet("idb/national.parquet")
    elif lane == "ussc":
        df = _csv("ussc/national.csv")
    else:
        raise ValueError(lane)
    df = df[df["variable"] == variable].copy()
    if df.duplicated(["period"]).any():
        raise ValueError(f"duplicate national years in {lane} {variable}")
    return df.sort_values("period").reset_index(drop=True)


def cell(df: pd.DataFrame, district: str | None, period: int) -> pd.Series:
    """Exactly one row (district may be None for a national frame)."""
    sel = df[df["period"] == period]
    if district is not None:
        sel = sel[sel["district_id"] == district]
    if len(sel) != 1:
        raise KeyError(f"expected one row for {district} {period}, got {len(sel)}")
    return sel.iloc[0]


def wide(df: pd.DataFrame) -> pd.DataFrame:
    """period x district_id matrix of values."""
    return df.pivot(index="period", columns="district_id", values="value").sort_index()


def ids_of(df: pd.DataFrame) -> list[str]:
    return sorted(set(df["source_id"].astype(str)))


@lru_cache(maxsize=None)
def all_sources() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for p in sorted(SRC.glob("*.json")):
        for sid, rec in json.loads(p.read_text()).items():
            out.setdefault(sid, rec)
    return out


# ---------------------------------------------------------------- formatting

def num_json(x):
    """JSON-friendly number: integral floats become ints, NaN becomes None, others kept exact."""
    if x is None:
        return None
    if isinstance(x, (bool,)):
        return x
    f = float(x)
    if math.isnan(f) or math.isinf(f):
        return None
    if f.is_integer() and abs(f) < 2**53:
        return int(f)
    return f


def fmt_fixed(v: float, d: int) -> str:
    """Round half away from zero (as published tables do), with thousands separators."""
    q = 10 ** d
    r = math.floor(abs(v) * q + 0.5 + 1e-9) / q
    r = -r if v < 0 else r
    return f"{r:,.{d}f}"


def fmt(value, unit: str, decimals: int | None = None) -> tuple[str, str]:
    """(text, bare) for a number. Units: months, percent, points, count, cases, defendants, per_judgeship,
    ratio, int, rank, fy, quarter."""
    if unit == "fy":
        return f"FY {int(value)}", str(int(value))
    if unit == "rank":
        n = int(value)
        suf = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
        return f"{n}{suf}", f"{n}{suf}"
    if unit == "months":
        b = fmt_fixed(value, 1 if decimals is None else decimals)
        return f"{b} months", b
    if unit == "percent":
        b = fmt_fixed(value, 1 if decimals is None else decimals)
        return f"{b}%", b
    if unit == "points":
        b = fmt_fixed(value, 1 if decimals is None else decimals)
        return f"{b} percentage points", b
    if unit in ("count", "cases", "defendants", "people", "int", "districts", "years", "quarters", "per_judgeship"):
        b = fmt_fixed(value, 0 if decimals is None else decimals)
        return b, b
    if unit == "ratio":
        b = fmt_fixed(value, 2 if decimals is None else decimals)
        return b, b
    raise ValueError(unit)


def quarter_text(q: str) -> str:
    """'2017Q2' -> 'April to June 2017' (calendar quarter)."""
    y, n = q.split("Q")
    months = {"1": "January to March", "2": "April to June", "3": "July to September", "4": "October to December"}
    return f"{months[n]} {y}"


def bluebook_short(short: str) -> str:
    """Close up adjacent single-capital abbreviations, as court citations do: 'D. N.M.' -> 'D.N.M.',
    'W.D. N.Y.' -> 'W.D.N.Y.'; 'N.D. W. Va.' and 'E.D. Va.' are unchanged."""
    return re.sub(r"(?<=[A-Z]\.) (?=[A-Z]\.[A-Z]\.)", "", short)


def district_name(did: str, style: str = "short") -> str:
    if did == NATIONAL:
        return "All districts"
    d = BY_ID[did]
    return bluebook_short(d.short) if style == "short" else d.name


def the_name(did: str) -> str:
    """'the Eastern District of Virginia'."""
    return f"the {BY_ID[did].name}"


# ---------------------------------------------------------------- story container

class Story:
    def __init__(self, slug: str):
        self.slug = slug
        self.numbers: dict[str, dict] = {}
        self.charts: dict[str, dict] = {}
        self.layers: dict[str, dict] = {}
        self.thumb: dict | None = None

    # numbers ------------------------------------------------------------
    def num(self, key: str, value, unit: str, *, source_ids, how: str, derived: bool = False,
            formula: str | None = None, decimals: int | None = None, headline: bool = False,
            year: int | None = None, text: str | None = None) -> float:
        if key in self.numbers:
            raise KeyError(f"{self.slug}: duplicate number {key}")
        if value is None or (isinstance(value, float) and math.isnan(value)):
            raise ValueError(f"{self.slug}: {key} has no value; a story must not show a missing number")
        if derived and not formula:
            raise ValueError(f"{self.slug}: derived number {key} needs a formula")
        t, bare = fmt(value, unit, decimals)
        entry = {
            "value": num_json(value),
            "unit": unit,
            "text": text or t,
            "bare": bare,
            "decimals": decimals,
            "source_ids": sorted(set(source_ids)),
            "how": how,
            "derived": bool(derived),
        }
        if formula:
            entry["formula"] = formula
        if year is not None:
            entry["year"] = int(year)
        if headline:
            entry["headline"] = True
        self.numbers[key] = entry
        return value

    def year(self, key: str, y: int, *, source_ids, how: str, headline: bool = False) -> int:
        return self.num(key, int(y), "fy", source_ids=source_ids, how=how, headline=headline)

    def quarter(self, key: str, q: str, *, source_ids, how: str) -> str:
        if key in self.numbers:
            raise KeyError(key)
        self.numbers[key] = {"value": q, "unit": "quarter", "text": quarter_text(q), "bare": q, "decimals": None,
                             "source_ids": sorted(set(source_ids)), "how": how, "derived": False}
        return q

    def district(self, key: str, did: str, *, source_ids, how: str, style: str = "name",
                 derived: bool = False, formula: str | None = None) -> str:
        if key in self.numbers:
            raise KeyError(key)
        if did not in BY_ID:
            raise KeyError(did)
        text = the_name(did) if style == "name" else district_name(did)
        entry = {"value": did, "unit": "district", "text": text, "bare": district_name(did), "decimals": None,
                 "source_ids": sorted(set(source_ids)), "how": how, "derived": bool(derived)}
        if formula:
            entry["formula"] = formula
        self.numbers[key] = entry
        return did

    # charts and layers ----------------------------------------------------
    def chart(self, key: str, spec: dict) -> None:
        if key in self.charts:
            raise KeyError(key)
        if spec.get("derived") and not spec.get("formula"):
            raise ValueError(f"{self.slug}: derived chart {key} needs a formula")
        spec.setdefault("source_ids", [])
        spec["source_ids"] = sorted(set(spec["source_ids"]))
        self.charts[key] = spec

    def layer(self, key: str, df: pd.DataFrame, *, label: str, unit: str, fmt_spec: str, years: list[int] | None = None,
              derived: bool = False, formula: str | None = None, how: str, higher_means: str | None = None,
              note: str | None = None) -> None:
        """A map layer in the shape of a web values file (values: {district: {year: value}})."""
        if derived and not formula:
            raise ValueError(f"{self.slug}: derived layer {key} needs a formula")
        d = df if years is None else df[df["period"].isin(years)]
        values: dict[str, dict[str, float]] = {}
        for r in d.itertuples(index=False):
            v = num_json(r.value)
            if v is None:
                continue
            values.setdefault(r.district_id, {})[str(int(r.period))] = v
        yrs = sorted({int(p) for p in d["period"]})
        layer = {
            "label": label, "unit": unit, "format": fmt_spec, "period_type": "FY_SEP30", "years": yrs,
            "values": values, "source_ids": ids_of(d), "how": how, "derived": bool(derived),
        }
        if formula:
            layer["formula"] = formula
        if higher_means:
            layer["higher_means"] = higher_means
        if note:
            layer["note"] = note
        self.layers[key] = layer

    # output ---------------------------------------------------------------
    def source_ids(self) -> list[str]:
        ids: set[str] = set()
        for n in self.numbers.values():
            ids.update(n["source_ids"])
        for c in self.charts.values():
            ids.update(c["source_ids"])
        for l in self.layers.values():
            ids.update(l["source_ids"])
        return sorted(ids)

    def to_json(self) -> dict:
        srcs = all_sources()
        ids = self.source_ids()
        missing = [i for i in ids if i not in srcs]
        if missing:
            raise KeyError(f"{self.slug}: unregistered source ids {missing}")
        prov = {i: {k: srcs[i].get(k) for k in ("dataset", "publisher", "url", "vintage", "retrieved_at")} for i in ids}
        build_date = max((p["retrieved_at"] or "")[:10] for p in prov.values())
        return {
            "slug": self.slug,
            "build_date": build_date,
            "numbers": self.numbers,
            "charts": self.charts,
            "layers": self.layers,
            "sources": prov,
        }


def series(df: pd.DataFrame, district: str | None, years: list[int]) -> list:
    """Values aligned to years (None where missing). district None = national frame."""
    d = df if district is None else df[df["district_id"] == district]
    m = {int(p): num_json(v) for p, v in zip(d["period"], d["value"])}
    return [m.get(y) for y in years]


def dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = dumps(obj)
    if EM_DASH in text:
        raise ValueError(f"{path.name}: em-dash in output")
    if path.exists() and path.read_text() == text:
        return
    path.write_text(text)
