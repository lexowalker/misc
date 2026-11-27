"""District profiles (public/data/profiles/<district>.json).

The "distinctive" paragraph is produced by a deterministic template engine (no language model) from outlier
statistics only. Each sentence stores the claims it rests on, so tests (and the copy audit) can re-verify every
number against the values files.
"""
from __future__ import annotations

import pandas as pd

from pipeline.common.districts import BY_ID, DISTRICTS, IDS

from .catalog import BY_ID as CAT, CATALOG, FACT_PRIORITY, FALLBACK_SIZE_VARIABLE
from .common import CIRCUIT_NAMES, FACT_MIN_BASE, PROC, display_round, fmt_number, fmt_value, table
from .values import Cell

POS_PREFIX = {1: "", 2: "second-", 3: "third-"}
MAX_FACTS = 3
MIN_FACTS_BEFORE_CIRCUIT = 2
MAX_TIE = 2          # a value shared by more than two districts is not an outlier
IDB_PRELIM_FROM = 2026  # IDB fiscal years with no published AO cross-check yet (catalog IDB_2026 caveat)


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
    # Ties and positions are judged on the value as displayed (same rule as the ranks), so two districts
    # that show the same number are a tie (data audit 2026-11-27).
    shown = {x: display_round(val, spec["format"]) for x, val in yv.items()}
    sv = shown[d]
    if sv == 0:
        return []  # "0.0% of ..." is not a distinctive pattern worth a sentence
    n = vf["ranked_of"][str(y)]
    tie = sum(1 for x in shown.values() if x == sv)
    if tie > MAX_TIE or n < 10:
        return []
    rank_hi = vf["ranks"][d][str(y)]
    rank_lo = 1 + sum(1 for x in shown.values() if x < sv)
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
        peers = {x: shown[x] for x in shown if BY_ID[x].circuit == circ}
        if len(peers) >= 3 and circ != "DC":
            hi, lo = max(peers.values()), min(peers.values())
            if sv == hi and sum(1 for x in peers.values() if x == hi) == 1:
                out.append({**base, "direction": "high", "position": 1, "scope": "circuit", "circuit": circ,
                            "circuit_of": len(peers), "tied": False})
            elif sv == lo and fact.get("low") and sum(1 for x in peers.values() if x == lo) == 1:
                out.append({**base, "direction": "low", "position": 1, "scope": "circuit", "circuit": circ,
                            "circuit_of": len(peers), "tied": False})
    return out


def fact_period(c: dict, period_type: str) -> str:
    """Period label for a profile sentence; IDB years without an AO cross-check are called preliminary."""
    label = period_label(c["year"], period_type)
    lane = CAT[c["variable"]]["input"].get("lane")
    return f"{label} (preliminary)" if lane == "idb" and c["year"] >= IDB_PRELIM_FROM else label


def render_fact(c: dict, period_type: str) -> str:
    spec = CAT[c["variable"]]
    fact = spec["fact"]
    word = fact["high"] if c["direction"] == "high" else fact["low"]
    circuit = CIRCUIT_NAMES[c["circuit"]] if c["scope"] == "circuit" else None
    rp = _rank_phrase(word, c["position"], c["tied"], c["ranked_of"], circuit)
    return f"In {fact_period(c, period_type)}, {_phrase(fact['text'], c['value'], spec)}, {rp}."


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
                          "lead": fact_period(c, vf["period_type"])})
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
                   "lowest in its circuit. Zero values, values shared by more than two districts, cells with a data note and "
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
            # districts sharing this rank (1 = untied), so pages can say "tied" (data audit 2026-11-27)
            "rank_ties": (sum(1 for r in vf["ranks"].values() if r.get(str(y)) == vf["ranks"][d][str(y)])
                          if v is not None else None),
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
    if civ:
        nn = national_mdl_note(civ["year"], "filed")
        if nn:
            out["civil_nature_of_suit"]["national_note"] = nn
    civ_disp = disposition_block(table("idb", "civil_disposition_mix"), d, CIVIL_DISP_GROUPS)
    if civ_disp:
        for blk in [civ_disp, *civ_disp.get("other_years", [])]:
            nn = national_mdl_note(blk["year"], "terminated")
            if nn:
                blk["national_note"] = nn
        out["civil_disposition"] = {**civ_disp, **CIVIL_DISP_META}
    cri_disp = disposition_block(table("idb", "criminal_disposition_mix"), d, CRIM_DISP_GROUPS)
    if cri_disp:
        out["criminal_disposition"] = {**cri_disp, **CRIM_DISP_META}
    off = sentenced_offenses(d)
    if off:
        out["sentenced_offense"] = off
    return out


# ---- How cases end (IDB disposition mix) ---------------------------------------------------------------------
# Reader labels for the IDB lane's disposition groups (pipeline/idb/codes.py), in reading order.
CIVIL_DISP_GROUPS = [
    ("dismissed_settled", "Dismissed: settled"),
    ("dismissed_voluntary", "Dismissed: withdrawn by the plaintiff"),
    ("dismissed_other", "Dismissed: other reasons"),
    ("judgment_motion_before_trial", "Judgment on a motion before trial"),
    ("judgment_default_consent", "Default or consent judgment"),
    ("trial_jury", "Judgment after a jury trial"),
    ("trial_court", "Judgment after a bench trial"),
    ("judgment_other", "Other judgment"),
    ("transferred_remanded", "Transferred or remanded"),
    ("statistical_closing", "Statistical closing"),
    ("missing", "Not reported"),
]
CRIM_DISP_GROUPS = [
    ("plea", "Convicted: guilty plea"),
    ("convicted_jury", "Convicted after a jury trial"),
    ("convicted_bench", "Convicted after a bench trial"),
    ("dismissed", "Not convicted: dismissed"),
    ("acquitted_jury", "Not convicted: acquitted by a jury"),
    ("acquitted_bench", "Not convicted: acquitted by a judge"),
    ("missing", "Not reported"),
]
CIVIL_DISP_META = {
    "source": "FJC Integrated Database (IDB), civil cases",
    "basis": ("Civil cases closed in the fiscal year (IDB termination records), grouped by how each case ended, "
              "using the disposition codes in the FJC civil codebook."),
    "definitions": ("Settled means the case was dismissed after the parties settled out of court. A case withdrawn by "
                    "the plaintiff is a voluntary dismissal. Other dismissals include want of prosecution and lack of "
                    "jurisdiction. Judgments on a motion before trial include orders dismissing prisoner petitions. "
                    "Jury trials include directed verdicts. Other judgments include arbitration awards, stays for "
                    "bankruptcy and judgments the court coded as other. Transferred or remanded covers transfers to "
                    "another district or to a multidistrict litigation court, and remands to state court or a federal "
                    "agency. A statistical closing ends a case open more than three years with no activity for a year."),
    "derived": True,
    "formula": "share = 100 × civil cases closed this way ÷ all civil cases closed in the district that year, rounded to 1 decimal",
    "order": "fixed",
}
CRIM_DISP_META = {
    "source": "FJC Integrated Database (IDB), criminal defendants",
    "basis": ("Criminal defendants whose cases closed in the fiscal year (excluding transfers to another district), "
              "by the disposition of the most serious charge, grouped as in the AO's Judicial Business Table D-4."),
    "definitions": ("Guilty pleas include pleas of no contest. Dismissed includes dismissals with or without "
                    "prejudice, nolle prosequi, pretrial diversion, mistrials and statistical closings. A bench trial "
                    "is decided by a judge, a jury trial by a jury."),
    "derived": True,
    "formula": "share = 100 × defendants whose cases ended this way ÷ all defendants whose cases closed in the district that year, rounded to 1 decimal",
    "order": "fixed",
}


def _disp_year(df: pd.DataFrame, d: str, y: int, groups: list[tuple[str, str]]) -> dict | None:
    cur = df[(df["district_id"] == d) & (df["period"] == y)]
    if cur.empty:
        return None
    nat = df[(df["district_id"] == "_national") & (df["period"] == y)]
    total = int(cur["terminated_total"].iloc[0])
    ntotal = int(nat["terminated_total"].iloc[0]) if not nat.empty else None
    counts = cur.groupby("disp_group")["count"].sum().to_dict()
    ncounts = nat.groupby("disp_group")["count"].sum().to_dict()
    unknown = set(counts) - {g for g, _ in groups}
    if unknown:
        raise ValueError(f"{d} FY{y}: disposition groups without a label: {sorted(unknown)}")
    out = []
    for gid, label in groups:
        c, nc = int(counts.get(gid, 0)), int(ncounts.get(gid, 0))
        if c == 0 and nc == 0:
            continue
        g = {"id": gid, "label": label, "count": c, "share": round(100 * c / total, 1) if total else None}
        if ntotal:
            g["national_count"] = nc
            g["national_share"] = round(100 * nc / ntotal, 1)
        out.append(g)
    return {"year": y, "period_type": str(cur["period_type"].iloc[0]), "total": total, "national_total": ntotal,
            "groups": out, "source_ids": sorted(set(cur["source_id"])), "preliminary": y >= IDB_PRELIM_FROM}


def disposition_block(df: pd.DataFrame, d: str, groups: list[tuple[str, str]]) -> dict | None:
    """Latest IDB year, plus the latest year with a published AO cross-check when the latest is preliminary."""
    mine = df[df["district_id"] == d]
    if mine.empty:
        return None
    y = int(mine["period"].max())
    latest = _disp_year(df, d, y, groups)
    if latest is None:
        return None
    if latest["preliminary"]:
        checked = sorted(int(x) for x in mine["period"].unique() if int(x) < IDB_PRELIM_FROM)
        prev = _disp_year(df, d, checked[-1], groups) if checked else None
        if prev:
            latest["other_years"] = [prev]
    return latest


# ---- Offenses of people sentenced (USSC) -----------------------------------------------------------------------
# USSC offense types as the USSC lane publishes them (docs/lanes/ussc.md section 3). Labels keep the USSC's names.
USSC_OFFENSES = [
    ("drug_trafficking", "Drug trafficking"),
    ("immigration", "Immigration"),
    ("firearms", "Firearms"),
    ("fraud_theft_embezzlement", "Fraud/theft/embezzlement"),
    ("fraud", "Fraud"),
    ("child_pornography", "Child pornography"),
    ("other", "All other offense types"),
]
USSC_OTHER_FORMULA = ("100 × people whose primary offense falls in any other USSC offense type ÷ people sentenced with "
                      "a known primary offense type (the USSC lists these types separately; the atlas combines them)")


def _ussc_rows(df: pd.DataFrame, d: str) -> dict[tuple[str, int], pd.Series]:
    sub = df[df["district_id"] == d]
    return {(r.variable, int(r.period)): r for r in sub.itertuples(index=False)}


def sentenced_offenses(d: str) -> dict | None:
    obs = table("ussc", "observations")
    obs = obs[obs["variable"].str.startswith(("ussc_pct_offense_", "ussc_count_offense_", "ussc_cases_offense_known"))]
    mine = _ussc_rows(obs, d)
    years = sorted({y for (v, y) in mine if v == "ussc_cases_offense_known"})
    if not years:
        return None
    y = years[-1]
    nat_df = table("ussc", "national")
    nat_df = nat_df[(nat_df["district_id"] == "US") & (nat_df["period"] == y)]
    nat = {r.variable: r for r in nat_df.itertuples(index=False)}
    n = mine[("ussc_cases_offense_known", y)]
    groups, srcs = [], {str(n.source_id)}
    for key, label in USSC_OFFENSES:
        pr = mine.get((f"ussc_pct_offense_{key}", y))
        cr = mine.get((f"ussc_count_offense_{key}", y))
        if pr is None or cr is None:
            continue
        g = {"id": key, "label": label, "count": int(cr.value), "share": float(pr.value),
             "derived": key == "other" or bool(pr.derived)}
        if g["derived"]:
            g["formula"] = USSC_OTHER_FORMULA if key == "other" else None
        np_, nc = nat.get(f"ussc_pct_offense_{key}"), nat.get(f"ussc_count_offense_{key}")
        if np_ is not None and nc is not None:
            g["national_share"] = float(np_.value)
            g["national_count"] = int(nc.value)
        groups.append(g)
        srcs |= {str(pr.source_id), str(cr.source_id)}
    nk = nat.get("ussc_cases_offense_known")
    return {
        "year": y, "period_type": str(n.period_type), "total": int(n.value),
        "national_total": int(nk.value) if nk is not None else None,
        "groups": groups, "source_ids": sorted(srcs), "order": "fixed",
        "source": "U.S. Sentencing Commission, individual offender datafiles",
        "basis": ("People sentenced in the fiscal year whose primary offense type is known, by the USSC's offense "
                  "type. Since FY 2018 the USSC assigns the type from the main sentencing guideline applied."),
        "definitions": ("Shares are as the USSC publishes them, so they may not add to exactly 100. They count people "
                        "sentenced, not charges filed, so they can differ from the criminal charge mix above. \"All "
                        "other offense types\" combines the remaining USSC types, which the USSC lists one by one."),
        "derived": False,
        "formula": None,
    }


# ---- Multidistrict litigation context -------------------------------------------------------------------------
MDL_SHARE = 25.0   # a docket above this share of a district's civil cases in a year shown gets a note
MDL_INTRO = ("A multidistrict litigation (MDL) docket brings similar civil cases from many districts before one "
             "court for pretrial proceedings. In each year listed here, a single docket made up more than a quarter "
             "of the civil cases this court received or closed.")
MDL_FORMULA = ("share = 100 × civil cases carrying the MDL docket number ÷ all civil cases filed (or closed) in the "
               "district that fiscal year, counted from FJC case records; a note appears when one docket is above 25%")


def _fy(y: int) -> str:
    return f"FY {y} (preliminary)" if y >= IDB_PRELIM_FROM else f"FY {y}"


def _year_runs(years: list[int]) -> str:
    runs, start, prev = [], None, None
    for y in sorted(years):
        if start is None:
            start = prev = y
        elif y == prev + 1:
            prev = y
        else:
            runs.append((start, prev))
            start = prev = y
    if start is not None:
        runs.append((start, prev))
    parts = [_fy(a) if a == b else f"FY {a} to {b}{' (preliminary)' if b >= IDB_PRELIM_FROM else ''}" for a, b in runs]
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]


def _mdl_tables() -> tuple[pd.DataFrame, pd.DataFrame] | None:
    pq = PROC / "idb" / "civil_mdl_dockets.parquet"
    if not pq.exists():
        return None
    t = pd.read_parquet(pq)
    names_csv = PROC / "idb" / "civil_mdl_docket_names.csv"
    names = pd.read_csv(names_csv, dtype=str) if names_csv.exists() else pd.DataFrame(
        columns=["mdl_docket", "district_id", "case_number", "title", "source_id"])
    return t, names


def national_mdl_note(year: int, cohort: str) -> dict | None:
    """When one MDL docket is more than a quarter of all districts' civil cases filed (or closed) in a year, the
    all-district comparison ticks for that year include those cases; say so next to them."""
    got = _mdl_tables()
    if got is None:
        return None
    t, names = got
    n = t[(t["district_id"] == "_national") & (t["period"] == year) & (t["cohort"] == cohort) & (t["share"] > MDL_SHARE)]
    if n.empty:
        return None
    r = n.sort_values("share", ascending=False).iloc[0]
    dk = str(r["mdl_docket"])
    home = t[(t["district_id"] != "_national") & (t["period"] == year) & (t["cohort"] == cohort) & (t["mdl_docket"] == dk)]
    top = home.sort_values("count", ascending=False).iloc[0] if not home.empty else None
    where = f" in {BY_ID[top['district_id']].short}" if top is not None and top["count"] / r["count"] > 0.9 else ""
    what = "civil cases filed" if cohort == "filed" else "civil cases closed"
    return {
        "text": (f"{int(r['count']):,} of the {int(r['total']):,} {what} in all districts in {_fy(year)} were part of "
                 f"MDL {dk}{where}, one multidistrict litigation docket. The all-district shares for that year include "
                 "them."),
        "year": year, "cohort": cohort, "docket": dk, "count": int(r["count"]), "total": int(r["total"]),
        "share": float(r["share"]), "source_ids": ["idb_civil_cv88on"],
    }


def mdl_context(d: str, vfs: dict[str, dict]) -> dict | None:
    got = _mdl_tables()
    if got is None:
        return None
    t, names = got
    years = sorted({vfs["civil_filings_per_judgeship"]["years"][-1], vfs["civil_trial_rate_pct"]["years"][-1]})
    mine = t[(t["district_id"] == d) & (t["share"] > MDL_SHARE)]
    notes = mine[mine["period"].isin(years)]
    if notes.empty:
        return None
    short = BY_ID[d].short
    noun = {"filed": "civil cases filed in", "terminated": "civil cases closed in"}
    order = notes.groupby("mdl_docket")["share"].max().sort_values(ascending=False).index.tolist()
    dockets, all_srcs = [], {"idb_civil_cv88on", "idb_civil_codebook"}
    for dk in order:
        rows = notes[notes["mdl_docket"] == dk].sort_values(["period", "cohort"], ascending=[False, True])
        sentences = []
        for r in rows.itertuples(index=False):
            sentences.append({
                "text": (f"In {_fy(int(r.period))}, {int(r.count):,} of the {int(r.total):,} {noun[r.cohort]} "
                         f"{short} were part of MDL {dk}."),
                "year": int(r.period), "cohort": r.cohort, "count": int(r.count), "total": int(r.total),
                "share": float(r.share), "preliminary": int(r.period) >= IDB_PRELIM_FROM,
            })
        history = []
        for cohort in ("filed", "terminated"):
            shown = set(rows.loc[rows["cohort"] == cohort, "period"].astype(int))
            h = mine[(mine["mdl_docket"] == dk) & (mine["cohort"] == cohort) & ~mine["period"].isin(shown)]
            if h.empty:
                continue
            peak = h.sort_values(["count", "period"], ascending=[False, False]).iloc[0]
            what = "filed in" if cohort == "filed" else "closed in"
            hy = h["period"].astype(int).tolist()
            lead = f"It also made up more than a quarter of the civil cases {what} {short} in {_year_runs(hy)}"
            text = (f"{lead}: {int(peak['count']):,} of {int(peak['total']):,}." if len(hy) == 1 else
                    f"{lead}; the most was {int(peak['count']):,} of {int(peak['total']):,} in {_fy(int(peak['period']))}.")
            history.append({
                "text": text,
                "cohort": cohort, "years": sorted(int(x) for x in h["period"]), "peak_year": int(peak["period"]),
                "peak_count": int(peak["count"]), "peak_total": int(peak["total"]),
            })
        nm = names[names["mdl_docket"] == dk]
        item = {"docket": dk, "sentences": sentences, "history": history, "source_ids": ["idb_civil_cv88on"]}
        if not nm.empty:
            n0 = nm.iloc[0]
            item.update({"name": n0["title"], "case_number": n0["case_number"], "court": n0["district_id"],
                         "name_source_id": n0["source_id"]})
            item["source_ids"].append(n0["source_id"])
            all_srcs.add(n0["source_id"])
        dockets.append(item)
    return {
        "intro": MDL_INTRO, "dockets": dockets, "years": years, "threshold_pct": MDL_SHARE,
        "rule": (f"Shown when one MDL docket made up more than 25% of the court's civil cases filed or closed in "
                 f"{' or '.join(_fy(y) for y in years)}, counted from FJC case records. A docket is named only when a "
                 "court record on GovInfo confirms the name; otherwise it is shown by number."),
        "derived": True, "formula": MDL_FORMULA, "source_ids": sorted(all_srcs),
    }


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
                 "overlap (FY 2014 to 2017) the four shares are identical for every district under both schemes. "
                 "Shares may not add to exactly 100 because each is rounded to one decimal."),
    }


def build_profile(d: str, vfs: dict[str, dict], cells: dict[str, dict]) -> dict:
    dist = BY_ID[d]
    prof = {
        "district_id": d,
        "name": dist.name,
        "short": dist.short,
        "circuit": dist.circuit,
        "distinctive": distinctive(d, vfs, cells),
        "key_stats": key_stats(d, vfs),
        "case_mix": case_mix(d, vfs),
    }
    mdl = mdl_context(d, vfs)
    if mdl:
        prof["mdl_context"] = mdl
    return prof


def all_profiles(vfs: dict[str, dict], cells: dict[str, dict]) -> dict[str, dict]:
    return {d: build_profile(d, vfs, cells) for d in IDS}

