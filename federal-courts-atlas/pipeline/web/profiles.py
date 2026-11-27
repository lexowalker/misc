"""District profiles (public/data/profiles/<district>.json).

The "distinctive" paragraph is produced by a deterministic template engine (no language model) from outlier
statistics only. Each sentence stores the claims it rests on, so tests (and the copy audit) can re-verify every
number against the values files.
"""
from __future__ import annotations

from pipeline.common.districts import BY_ID, DISTRICTS, IDS

from .catalog import BY_ID as CAT, CATALOG, FACT_PRIORITY, FALLBACK_SIZE_VARIABLE
from .common import CIRCUIT_NAMES, FACT_MIN_BASE, fmt_number, fmt_value, table
from .values import Cell

POS_PREFIX = {1: "", 2: "second-", 3: "third-"}
MAX_FACTS = 3
MIN_FACTS_BEFORE_CIRCUIT = 2
MAX_TIE = 2          # a value shared by more than two districts is not an outlier


def period_label(year: int, period_type: str) -> str:
    if period_type == "FY_SEP30":
        return f"FY {year}"
    if period_type == "SNAPSHOT_SEP30":
        return f"September 30, {year}"
    return str(year)


def cell_sources(vf: dict, d: str, y: int) -> list[str]:
    cs = vf.get("cell_sources", {}).get(d, {}).get(str(y))
    return list(cs) if cs else list(vf["source_by_year"][str(y)])


def cell_is_derived(vf: dict, d: str, y: int) -> bool:
    if vf.get("derived"):
        return True
    if y in vf.get("derived_years", []):
        return True
    return str(y) in vf.get("derived_cells", {}).get(d, [])


def _year_values(vf: dict, y: int) -> dict[str, float]:
    ys = str(y)
    return {d: row[ys] for d, row in vf["values"].items() if ys in row}


def _phrase(text: str, value: float, spec: dict) -> str:
    return text.format(value=fmt_value(value, spec["unit"], spec["format"]),
                       number=fmt_number(value, spec["format"]))


def _rank_phrase(word: str, position: int, tied: bool, n: int | None, circuit: str | None) -> str:
    core = f"{POS_PREFIX[position]}{word}"
    lead = f"tied for the {core}" if tied else f"the {core}"
    if circuit:
        return f"{lead} in the {circuit}"
    return f"{lead} of {n} districts" if n == 94 else f"{lead} of the {n} districts with data"


def outlier_candidates(d: str, spec: dict, vf: dict, cells: dict[tuple[str, int], Cell]) -> list[dict]:
    fact = spec.get("fact")
    if not fact:
        return []
    y = vf["years"][-1]
    yv = _year_values(vf, y)
    if d not in yv:
        return []
    cell = cells[(d, y)]
    if cell.notes or (cell.n is not None and cell.n < FACT_MIN_BASE):
        return []
    v = yv[d]
    if v == 0:
        return []  # "0.0% of ..." is not a distinctive pattern worth a sentence
    n = vf["ranked_of"][str(y)]
    tie = sum(1 for x in yv.values() if x == v)
    if tie > MAX_TIE or n < 10:
        return []
    rank_hi = vf["ranks"][d][str(y)]
    rank_lo = 1 + sum(1 for x in yv.values() if x < v)
    out = []
    base = {"variable": spec["id"], "year": y, "value": v, "rank": rank_hi, "ranked_of": n, "tied": tie > 1,
            "source_ids": cell_sources(vf, d, y), "derived": cell_is_derived(vf, d, y)}
    if rank_hi <= 3:
        out.append({**base, "direction": "high", "position": rank_hi, "scope": "national"})
    elif rank_lo <= 3 and fact.get("low"):
        out.append({**base, "direction": "low", "position": rank_lo, "scope": "national"})
    else:
        # circuit extreme: unique highest or lowest among the circuit's districts with data (circuits of 3+)
        circ = BY_ID[d].circuit
        peers = {x: yv[x] for x in yv if BY_ID[x].circuit == circ}
        if len(peers) >= 3 and circ != "DC":
            hi, lo = max(peers.values()), min(peers.values())
            if v == hi and sum(1 for x in peers.values() if x == hi) == 1:
                out.append({**base, "direction": "high", "position": 1, "scope": "circuit", "circuit": circ,
                            "circuit_of": len(peers), "tied": False})
            elif v == lo and fact.get("low") and sum(1 for x in peers.values() if x == lo) == 1:
                out.append({**base, "direction": "low", "position": 1, "scope": "circuit", "circuit": circ,
                            "circuit_of": len(peers), "tied": False})
    return out


def render_fact(c: dict, period_type: str) -> str:
    spec = CAT[c["variable"]]
    fact = spec["fact"]
    word = fact["high"] if c["direction"] == "high" else fact["low"]
    circuit = CIRCUIT_NAMES[c["circuit"]] if c["scope"] == "circuit" else None
    rp = _rank_phrase(word, c["position"], c["tied"], c["ranked_of"], circuit)
    return f"In {period_label(c['year'], period_type)}, {_phrase(fact['text'], c['value'], spec)}, {rp}."


def select_facts(cands: list[dict]) -> list[dict]:
    prio = {v: i for i, v in enumerate(FACT_PRIORITY)}
    fam = {v["id"]: v["family"] for v in CATALOG}
    nat = sorted((c for c in cands if c["scope"] == "national"),
                 key=lambda c: (c["position"], c["tied"], prio[c["variable"]]))
    picked: list[dict] = []
    for limit in (1, 2):
        for c in nat:
            if len(picked) >= MAX_FACTS:
                break
            if c in picked:
                continue
            if sum(1 for p in picked if fam[p["variable"]] == fam[c["variable"]]) >= limit:
                continue
            picked.append(c)
    if len(picked) < MIN_FACTS_BEFORE_CIRCUIT:
        circ = sorted((c for c in cands if c["scope"] == "circuit"), key=lambda c: prio[c["variable"]])
        for c in circ:
            if len(picked) >= MIN_FACTS_BEFORE_CIRCUIT:
                break
            if any(fam[p["variable"]] == fam[c["variable"]] for p in picked):
                continue
            picked.append(c)
    return picked


def size_sentence(d: str, vfs: dict[str, dict]) -> tuple[str, list[dict]]:
    dist = BY_ID[d]
    peers = [x for x in DISTRICTS if x.circuit == dist.circuit]
    circuit = CIRCUIT_NAMES[dist.circuit]
    if len(peers) == 1:
        first = f"The U.S. District Court for the {dist.name} is the only district court in the {circuit}."
    else:
        first = f"The U.S. District Court for the {dist.name} is one of {len(peers)} district courts in the {circuit}."
    vf = vfs[FALLBACK_SIZE_VARIABLE]
    spec = CAT[FALLBACK_SIZE_VARIABLE]
    y = vf["years"][-1]
    v = vf["values"].get(d, {}).get(str(y))
    if v is None:
        return first, []
    word = "judgeship" if v == 1 else "judgeships"
    text = f"{first} In {period_label(y, vf['period_type'])}, it had {fmt_number(v, spec['format'])} authorized {word}."
    claim = {"variable": FALLBACK_SIZE_VARIABLE, "year": y, "value": v, "rank": vf["ranks"][d][str(y)],
             "ranked_of": vf["ranked_of"][str(y)], "source_ids": cell_sources(vf, d, y),
             "derived": cell_is_derived(vf, d, y), "direction": None, "position": None, "scope": "size", "tied": False}
    return text, [claim]


def distinctive(d: str, vfs: dict[str, dict], cells: dict[str, dict]) -> dict:
    cands: list[dict] = []
    for spec in CATALOG:
        cands += outlier_candidates(d, spec, vfs[spec["id"]], cells[spec["id"]])
    picked = select_facts(cands)
    # Group by year (stable within a year) so the paragraph can say "That year," instead of repeating it.
    order = {id(c): i for i, c in enumerate(picked)}
    picked = sorted(picked, key=lambda c: (c["year"], order[id(c)]))
    sentences = []
    for c in picked:
        vf = vfs[c["variable"]]
        claim = {k: c[k] for k in ("variable", "year", "value", "rank", "ranked_of", "source_ids", "derived",
                                   "direction", "position", "scope", "tied")}
        if c["scope"] == "circuit":
            claim["circuit"] = c["circuit"]
            claim["circuit_of"] = c["circuit_of"]
        if claim["derived"]:
            claim["formula"] = vf.get("formula") or _basis_formula(vf, c["year"])
        sentences.append({"text": render_fact(c, vf["period_type"]), "claims": [claim],
                          "lead": period_label(c["year"], vf["period_type"])})
    size_text, size_claims = size_sentence(d, vfs)
    if not sentences:
        sentences = [{"text": size_text, "claims": size_claims}]
        kind = "size_and_circuit"
    else:
        kind = "outliers"
    return {
        "kind": kind,
        "paragraph": join_paragraph(sentences),
        "sentences": sentences,
        "context": {"text": size_text, "claims": size_claims},
        "method": ("Generated by a fixed template from the district's outlier statistics: measures where it ranks in "
                   "the top or bottom three of all districts with data in the latest year, or is the single highest or "
                   "lowest in its circuit. Values shared by more than two districts, cells with a data note and "
                   f"shares or medians based on fewer than {FACT_MIN_BASE} cases are skipped. No language model is used."),
    }


def join_paragraph(sentences: list[dict]) -> str:
    """Join sentences; a sentence in the same period as the one before starts "That year," (then "Also in ...")."""
    parts, prev, run = [], None, 0
    for s in sentences:
        text = s["text"]
        lead = s.get("lead")
        run = run + 1 if (lead and lead == prev) else 0
        if run and text.startswith(f"In {lead}, "):
            rest = text[len(f"In {lead}, "):]
            text = f"That year, {rest}" if run == 1 else f"Also in {lead}, {rest}"
        parts.append(text)
        prev = lead
    return " ".join(parts)


def _basis_formula(vf: dict, y: int) -> str | None:
    bases = vf.get("basis_by_year", {}).get(str(y), [])
    fb = vf.get("formula_by_basis", {})
    for b in bases:
        if b in fb:
            return fb[b]
    return None


def key_stats(d: str, vfs: dict[str, dict]) -> list[dict]:
    rows = []
    for spec in CATALOG:
        vf = vfs[spec["id"]]
        y = vf["years"][-1]
        series = vf["values"].get(d, {})
        v = series.get(str(y))
        row = {
            "variable": spec["id"], "family": spec["family"], "featured": bool(spec.get("featured")),
            "year": y, "period_type": vf["period_type"], "value": v,
            "rank": vf["ranks"].get(d, {}).get(str(y)) if v is not None else None,
            "ranked_of": vf["ranked_of"].get(str(y)),
            "national": vf.get("national", {}).get(str(y)),
            "series": series,
            "derived": cell_is_derived(vf, d, y) if v is not None else bool(vf.get("derived")),
        }
        if v is not None:
            row["source_ids"] = cell_sources(vf, d, y)
        note = vf.get("cell_notes", {}).get(d, {}).get(str(y))
        if note:
            row["note"] = note
        if v is None:
            last = max((int(k) for k in series), default=None)
            row["latest_year_with_data"] = last
        rows.append(row)
    return rows


def _mix(df, d: str, key: str, label: str) -> dict | None:
    mine = df[df["district_id"] == d]
    if mine.empty:
        return None
    y = int(mine["period"].max())
    cur = mine[mine["period"] == y]
    nat = df[(df["district_id"] == "_national") & (df["period"] == y)]
    total = int(cur["filed_total"].iloc[0])
    ntotal = int(nat["filed_total"].iloc[0]) if not nat.empty else None
    natmap = {r[key]: int(r["count"]) for _, r in nat.iterrows()}
    groups = []
    for _, r in cur.sort_values(["count", key], ascending=[False, True]).iterrows():
        c = int(r["count"])
        if c == 0 and natmap.get(r[key], 0) == 0:
            continue
        g = {"id": str(r[key]), "label": str(r[label]), "count": c,
             "share": round(100 * c / total, 1) if total else None}
        if ntotal:
            g["national_count"] = natmap.get(r[key], 0)
            g["national_share"] = round(100 * g["national_count"] / ntotal, 1)
        groups.append(g)
    return {"year": y, "period_type": str(cur["period_type"].iloc[0]), "total": total, "national_total": ntotal,
            "groups": groups, "source_ids": sorted(set(cur["source_id"]))}


def case_mix(d: str, vfs: dict[str, dict]) -> dict:
    civ = _mix(table("idb", "civil_nos_mix"), d, "nos_group", "nos_group_label")
    cri = _mix(table("idb", "criminal_offense_mix"), d, "offense_category", "offense_label")
    out = {}
    if civ:
        out["civil_nature_of_suit"] = {
            **civ, "source": "FJC Integrated Database (IDB), civil cases",
            "basis": ("Civil cases filed in the fiscal year (IDB filing cohort), grouped by the nature-of-suit "
                      "categories on the AO civil cover sheet (JS 44)."),
            "derived": True,
            "formula": "share = 100 × cases in the category ÷ all civil cases filed in the district that year, rounded to 1 decimal",
        }
    if cri:
        out["criminal_offense"] = {
            **cri, "source": "FJC Integrated Database (IDB), criminal defendants",
            "basis": ("Criminal defendants filed in the fiscal year (all offense levels, excluding transfers), grouped "
                      "by the most serious filing charge into the AO's top-level offense headings."),
            "derived": True,
            "formula": "share = 100 × defendants in the category ÷ all defendants filed in the district that year, rounded to 1 decimal",
        }
    out["sentencing_composition"] = sentencing_composition(d, vfs)
    return out


SCHEMES = [
    {"id": "booker_2006_2017", "label": "USSC grouping printed for FY 2006 to 2017",
     "derived": False,
     "vars": {"within": "within_range_pct", "above": "above_range_pct_2006",
              "govt_below": "govt_below_range_pct_2006", "nongovt_below": "nongovt_below_range_pct_2006"}},
    {"id": "sentrnge_2014_2025", "label": "Same grouping rebuilt from the USSC's FY 2018 method, FY 2014 to 2025",
     "derived": True,
     "vars": {"within": "within_range_pct", "above": "above_range_pct",
              "govt_below": "govt_below_range_pct", "nongovt_below": "nongovt_below_range_pct"}},
]


def sentencing_composition(d: str, VFS: dict[str, dict]) -> dict:
    series = []
    for sch in SCHEMES:
        years = sorted(set(VFS[sch["vars"]["above"]]["years"]))
        by_year = {}
        for y in years:
            row = {}
            srcs: set[str] = set()
            for k, vid in sch["vars"].items():
                vf = VFS[vid]
                v = vf["values"].get(d, {}).get(str(y))
                row[k] = v
                if v is not None:
                    srcs |= set(cell_sources(vf, d, y))
            if all(row[k] is None for k in sch["vars"]):
                continue
            row["n"] = VFS[sch["vars"]["above"]].get("n_basis", {}).get(d, {}).get(str(y))
            row["source_ids"] = sorted(srcs)
            row["derived"] = any(cell_is_derived(VFS[vid], d, y) for vid in sch["vars"].values()
                                 if VFS[vid]["values"].get(d, {}).get(str(y)) is not None)
            by_year[str(y)] = row
        series.append({"scheme": sch["id"], "label": sch["label"], "variables": sch["vars"], "years": by_year})
    return {
        "series": series,
        "note": ("The USSC changed its sentence categories in FY 2018. The two series are kept apart. Where they "
                 "overlap (FY 2014 to 2017) the USSC lane found the four shares identical for every district. "
                 "Shares may not add to exactly 100 because each is rounded to one decimal."),
    }


def build_profile(d: str, vfs: dict[str, dict], cells: dict[str, dict]) -> dict:
    dist = BY_ID[d]
    return {
        "district_id": d,
        "name": dist.name,
        "short": dist.short,
        "circuit": dist.circuit,
        "distinctive": distinctive(d, vfs, cells),
        "key_stats": key_stats(d, vfs),
        "case_mix": case_mix(d, vfs),
    }


def all_profiles(vfs: dict[str, dict], cells: dict[str, dict]) -> dict[str, dict]:
    return {d: build_profile(d, vfs, cells) for d in IDS}

