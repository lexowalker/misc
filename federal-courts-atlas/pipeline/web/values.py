"""Build public/data/values/<variable>.json for every catalog variable.

Values are copied exactly as they appear in the lane observation tables (no rounding, no filling). The only
numbers computed here are the per-capita rates (catalog `derived: true`, formula in the catalog) and ranks
(derived; 1 = highest value, ties share the lowest rank number).
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

import pandas as pd

from pipeline.common.districts import BY_ID, IDS

from .common import (APPROX_POP_DISTRICTS, APPROX_POP_NOTE, SMALL_BASE, clean_text, lane_sources,
                     lane_variables, num, provenance_record, table)

# Plain-English labels for the USSC lane's per-row `basis` codes.
USSC_BASIS_LABEL = {
    "reproduces_published": "Reproduces the figure the USSC published for that year.",
    "published_packet": "Printed in the USSC's statistical information packet for that year.",
    "pooled_published_halves": ("Derived: the full fiscal year pooled from the two half-year tables the USSC printed "
                                "(100 × (count in first half + count in second half) ÷ (cases in first half + cases in second half))."),
    "computed_ussc_definition": ("Derived: computed by the atlas's USSC lane from the USSC's case-level datafile, using the "
                                 "USSC's own definition, for a year in which the USSC did not print this figure."),
    "sum_of_published_components": "Derived: the sum of components the USSC published for that year.",
    "computed_ussc_supplemental": ("Derived: computed from the USSC's FY 2014 to 2017 supplemental datafile, which codes "
                                   "those years with the FY 2018 method."),
    "derived_from_published_counts": "Derived: the published total minus the published named categories.",
}

NATIONAL_TABLE = {
    ("fcms", "observations"): ("fcms", "national"),
    ("fcms", "observations_current_method"): ("fcms", "national_current_method"),
    ("ussc", "observations"): ("ussc", "national"),
    ("idb", "observations"): ("idb", "national"),
}
NATIONAL_NOTE = {
    "fcms": "National figure as printed on the AO's \"all district courts\" profile page.",
    "ussc": "National figure from the USSC (all districts), as reproduced by the atlas's USSC lane.",
    "idb": "All districts combined, computed by the atlas's IDB lane from the same FJC case-level file as the district values.",
}
NO_NATIONAL = {"idb_patent_share_of_national"}  # the national share is 100 by definition


@dataclass
class Cell:
    value: float | int
    sources: tuple[str, ...]
    derived: bool = False
    basis: str | None = None
    notes: list[str] = field(default_factory=list)
    n: int | None = None
    inputs: dict | None = None   # for derived cells: the inputs used, for audit


def _base_noun(spec: dict) -> str:
    var = spec["input"].get("variable", "")
    if var.startswith("ussc_"):
        return "people"
    if var.startswith("idb_crim"):
        return "defendants"
    return "cases"


def _fcms_caveats() -> dict[tuple[str, str, int], tuple[float, str]]:
    c = table("fcms", "cell_caveats")
    out = {}
    for r in c.itertuples(index=False):
        if str(r.action).startswith("kept"):
            out[(r.variable, r.district_id, int(r.period))] = (float(r.value), clean_text(str(r.caveat)))
    return out


def lane_cells(spec: dict) -> dict[tuple[str, int], Cell]:
    inp = spec["input"]
    if "per100k" in inp:
        return per100k_cells(spec)
    lane, tbl, var = inp["lane"], inp["table"], inp["variable"]
    df = table(lane, tbl)
    df = df[df["variable"] == var]
    if df.empty:
        raise ValueError(f"{spec['id']}: no rows for {lane}/{tbl}/{var}")
    caveats = _fcms_caveats() if lane == "fcms" else {}
    base_col = spec.get("base")
    noun = _base_noun(spec)
    cat_derived = bool(spec.get("derived"))
    out: dict[tuple[str, int], Cell] = {}
    for r in df.itertuples(index=False):
        v = num(r.value)
        if v is None:
            continue
        d, y = r.district_id, int(r.period)
        derived = cat_derived
        basis = None
        if lane == "ussc":
            basis = str(r.basis)
            derived = derived or bool(r.derived)
        cell = Cell(value=v, sources=(str(r.source_id),), derived=derived, basis=basis)
        if lane == "fcms":
            cav = str(getattr(r, "caveat", "") or "")
            if cav and cav != "nan":
                cell.notes.append(clean_text(cav))
            else:
                hit = caveats.get((var, d, y))
                if hit and abs(hit[0] - float(v)) < 1e-9:
                    cell.notes.append(hit[1])
        if base_col:
            n = num(getattr(r, base_col))
            if n is not None:
                cell.n = int(n)
                if n < SMALL_BASE:
                    cell.notes.append(f"Based on only {int(n):,} {noun}, so this figure can swing widely from year to year.")
        out[(d, y)] = cell
    return out


def per100k_cells(spec: dict) -> dict[tuple[str, int], Cell]:
    ni = spec["input"]["per100k"]
    num_df = table(ni["lane"], ni["table"])
    num_df = num_df[num_df["variable"] == ni["variable"]]
    pop = table("population", "observations")
    pop = pop[(pop["variable"] == "population_estimate") & (pop["period_type"] == "JUL1_EST")]
    popmap = {(r.district_id, int(r.period)): (float(r.value), str(r.source_id)) for r in pop.itertuples(index=False)}
    out: dict[tuple[str, int], Cell] = {}
    for r in num_df.itertuples(index=False):
        d, y = r.district_id, int(r.period)
        if (d, y) not in popmap:
            continue
        p, psid = popmap[(d, y)]
        if p <= 0:
            continue
        n = float(r.value)
        value = round(n / p * 100000, 1)
        cell = Cell(value=num(value), sources=(str(r.source_id), psid), derived=True,
                    inputs={"numerator": num(n), "population": num(p)})
        if d in APPROX_POP_DISTRICTS:
            cell.notes.append(APPROX_POP_NOTE)
        out[(d, y)] = cell
    return out


def rank_cells(cells: dict[tuple[str, int], Cell]) -> tuple[dict, dict]:
    """Competition ranks per year: 1 = highest value; tied values share the lowest rank number."""
    ranks: dict[str, dict[str, int]] = {}
    ranked_of: dict[str, int] = {}
    by_year: dict[int, list[tuple[str, float]]] = {}
    for (d, y), c in cells.items():
        by_year.setdefault(y, []).append((d, float(c.value)))
    for y, items in by_year.items():
        s = pd.Series({d: v for d, v in items})
        r = s.rank(method="min", ascending=False).astype(int)
        ranked_of[str(y)] = int(len(s))
        for d, rk in r.items():
            ranks.setdefault(d, {})[str(y)] = int(rk)
    return ranks, ranked_of


def national_series(spec: dict) -> tuple[dict, dict, list[int]]:
    inp = spec["input"]
    if "per100k" in inp or inp["variable"] in NO_NATIONAL:
        return {}, {}, []
    key = (inp["lane"], inp["table"])
    if key not in NATIONAL_TABLE:
        return {}, {}, []
    df = table(*NATIONAL_TABLE[key])
    df = df[df["variable"] == inp["variable"]]
    if "district_id" in df.columns:
        df = df[df["district_id"].isin(["US", "_national"])]
    vals, srcs, derived_years = {}, {}, []
    for r in df.itertuples(index=False):
        v = num(r.value)
        if v is None:
            continue
        y = int(r.period)
        vals[str(y)] = v
        srcs[str(y)] = str(r.source_id)
        if inp["lane"] == "ussc" and bool(getattr(r, "derived", False)):
            derived_years.append(y)
    return vals, srcs, sorted(derived_years)


def build_values_file(spec: dict) -> tuple[dict, dict[tuple[str, int], Cell]]:
    cells = lane_cells(spec)
    years = sorted({y for (_, y) in cells})
    values: dict[str, dict[str, float]] = {}
    for d in IDS:
        row = {str(y): cells[(d, y)].value for y in years if (d, y) in cells}
        if row:
            values[d] = row
    ranks, ranked_of = rank_cells(cells)

    # Sources: a default source tuple per year (the most common one) plus per-cell exceptions.
    source_by_year: dict[str, list[str]] = {}
    cell_sources: dict[str, dict[str, list[str]]] = {}
    for y in years:
        tuples = Counter(cells[(d, y)].sources for d in IDS if (d, y) in cells)
        default = sorted(tuples.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
        source_by_year[str(y)] = list(default)
        for d in IDS:
            c = cells.get((d, y))
            if c and c.sources != default:
                cell_sources.setdefault(d, {})[str(y)] = list(c.sources)

    national, national_src, national_derived = national_series(spec)
    used = {s for c in cells.values() for s in c.sources} | set(national_src.values())
    srcs = lane_sources()
    missing = sorted(s for s in used if s not in srcs)
    if missing:
        raise ValueError(f"{spec['id']}: unregistered source ids {missing[:5]}")
    provenance = {s: provenance_record(srcs[s]) for s in sorted(used)}

    cell_notes: dict[str, dict[str, str]] = {}
    n_basis: dict[str, dict[str, int]] = {}
    for (d, y), c in sorted(cells.items()):
        if c.notes:
            cell_notes.setdefault(d, {})[str(y)] = " ".join(dict.fromkeys(c.notes))
        if c.n is not None:
            n_basis.setdefault(d, {})[str(y)] = c.n

    derived_all = all(c.derived for c in cells.values())
    derived_years = sorted({y for (d, y), c in cells.items() if c.derived})
    # Derived status is uniform within a year for every lane used here; record cells otherwise.
    derived_cells: dict[str, list[str]] = {}
    for y in list(derived_years):
        ds = [d for d in IDS if (d, y) in cells]
        flags = {cells[(d, y)].derived for d in ds}
        if len(flags) > 1:
            for d in ds:
                if cells[(d, y)].derived:
                    derived_cells.setdefault(d, []).append(str(y))
            derived_years.remove(y)

    out = {
        "variable": spec["id"],
        "period_type": _period_type(spec),
        "unit": spec["unit"],
        "years": years,
        "values": values,
        "ranks": ranks,
        "ranked_of": ranked_of,
        "rank_method": "Derived by the atlas: 1 = highest value among districts with data that year; tied values share the lowest rank number (1, 2, 2, 4).",
        "provenance": provenance,
        "source_by_year": source_by_year,
        "derived": derived_all,
    }
    if cell_sources:
        out["cell_sources"] = cell_sources
    if cell_notes:
        out["cell_notes"] = cell_notes
    if n_basis:
        out["n_basis"] = n_basis
    if national:
        out["national"] = national
        out["national_source_by_year"] = national_src
        out["national_note"] = NATIONAL_NOTE[spec["input"]["lane"]]
        if national_derived:
            out["national_derived_years"] = national_derived
    if spec.get("formula"):
        out["formula"] = spec["formula"]
    if not derived_all and derived_years:
        out["derived_years"] = derived_years
    if derived_cells:
        out["derived_cells"] = derived_cells
    if spec["input"].get("lane") == "ussc":
        basis_by_year = {}
        for y in years:
            bs = sorted({cells[(d, y)].basis for d in IDS if (d, y) in cells and cells[(d, y)].basis})
            basis_by_year[str(y)] = bs
        out["basis_by_year"] = basis_by_year
        fb = {b: USSC_BASIS_LABEL[b] for b in sorted({b for bs in basis_by_year.values() for b in bs})
              if b not in ("reproduces_published", "published_packet")}
        if fb:
            out["formula_by_basis"] = fb
    return out, cells


def _period_type(spec: dict) -> str:
    inp = spec["input"]
    if "per100k" in inp:
        return "FY_SEP30"
    df = table(inp["lane"], inp["table"])
    pts = sorted(set(df.loc[df["variable"] == inp["variable"], "period_type"]))
    if len(pts) != 1:
        raise ValueError(f"{spec['id']}: expected one period type, got {pts}")
    return pts[0]


def lane_variable_meta(spec: dict) -> dict:
    inp = spec["input"]
    if "per100k" in inp:
        return {}
    return lane_variables(inp["lane"]).get(inp["variable"], {})


def registry_name(d: str) -> str:
    return BY_ID[d].name
