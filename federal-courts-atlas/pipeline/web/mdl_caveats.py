"""National multidistrict litigation (MDL) caveats for the catalog (public/data/variables.json).

When one MDL docket is more than a quarter of all districts' civil cases filed or closed in some year (in this
vintage only MDL 2885, N.D. Fla., FY 2020 filings and FY 2024 to 2025 closings), the measures built on civil filings,
closings or pending cases carry a caveat that names the docket, its home court and the years, with counts copied from
the IDB lane's MDL docket table (``data/processed/idb/civil_mdl_dockets``). Nothing here is estimated: years are those
in which the docket was more than half of the home court's cohort, and the counts are the table's rows for the year
with the most cases.

Which measures (checked in the polish pass, 2026-11-27):
  filings     civil_filings_per_judgeship, filings_per_judgeship, weighted_filings_per_judgeship,
              civil_filings_per_100k (no national figure: values and rank only), pro_se_pct, prisoner_petitions_pct
  closings    terminations_per_judgeship, civil_disposition_months, civil_trial_rate_pct
  pending     pending_per_judgeship, civil_over_3yrs_pct
Not affected: patent_share_pct and patent_filings (no MDL 2885 case has nature of suit 830 or 835),
civil_trial_months and trials_per_judgeship (19 MDL 2885 cases ended in a trial disposition, FY 2021 to 2022).
The profile's "How cases end" blocks have their own all-district note (profiles.national_mdl_note).
"""
from __future__ import annotations

import pandas as pd

from pipeline.common.districts import BY_ID

from .common import PROC

NATIONAL_SHARE = 25.0   # a docket above this share of all districts' civil filings or closings in a year
HOME_SHARE = 50.0       # years named: the docket was most of its home court's civil filings (or closings)
SOURCE_ID = "idb_civil_cv88on"

FILED_VARS = {"civil_filings_per_judgeship", "filings_per_judgeship", "weighted_filings_per_judgeship",
              "civil_filings_per_100k", "pro_se_pct", "prisoner_petitions_pct"}
CLOSED_VARS = {"terminations_per_judgeship", "civil_disposition_months", "civil_trial_rate_pct"}
PENDING_VARS = {"pending_per_judgeship", "civil_over_3yrs_pct"}
# Older, general caveats that the specific one replaces (so the same point is not made twice).
REPLACES = {
    "pending_per_judgeship": "One large multidistrict litigation (MDL) docket can dominate this measure.",
    "civil_over_3yrs_pct": "One multidistrict litigation (MDL) docket can hold thousands of old cases and dominate a district's share.",
    "pro_se_pct": ("Mass-tort waves can carry pro se codes in bulk: N.D. Fla. received hundreds of thousands of "
                   "mass-tort filings in FY 2020 to 2024, many of them coded pro se."),
}


def _runs(years: list[int]) -> str:
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
    parts = [f"FY {a}" if a == b else f"FY {a} to {b}" for a, b in runs]
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]


def _facts() -> dict | None:
    pq = PROC / "idb" / "civil_mdl_dockets.parquet"
    if not pq.exists():
        return None
    t = pd.read_parquet(pq)
    nat = t[t["district_id"] == "_national"]
    big = nat[nat["share"] > NATIONAL_SHARE]
    if big.empty:
        return None
    dk = str(big.sort_values("share", ascending=False).iloc[0]["mdl_docket"])
    rows = t[(t["mdl_docket"] == dk) & (t["district_id"] != "_national")]
    home = rows.groupby("district_id")["count"].sum().sort_values(ascending=False).index[0]
    out = {"docket": dk, "label": f"MDL {int(dk)}", "home": home, "short": BY_ID[home].short, "cohorts": {}}
    for cohort in ("filed", "terminated"):
        h = rows[(rows["district_id"] == home) & (rows["cohort"] == cohort) & (rows["share"] > HOME_SHARE)]
        if h.empty:
            continue
        pk = h.sort_values(["count", "period"], ascending=[False, False]).iloc[0]
        n = nat[(nat["mdl_docket"] == dk) & (nat["cohort"] == cohort) & (nat["period"] == pk["period"])].iloc[0]
        out["cohorts"][cohort] = {
            "years": sorted(int(y) for y in h["period"]), "peak_year": int(pk["period"]),
            "count": int(pk["count"]), "total": int(pk["total"]),
            "national_count": int(n["count"]), "national_total": int(n["total"]),
        }
    return out if out["cohorts"] else None


def national_mdl_caveats() -> dict[str, dict]:
    """{variable id: {text, replaces, docket, district_id, cohorts, years, source_ids}} for the affected measures."""
    f = _facts()
    if not f:
        return {}
    short, label = f["short"], f["label"]
    fil, clo = f["cohorts"].get("filed"), f["cohorts"].get("terminated")
    out: dict[str, dict] = {}

    def add(var: str, text: str, cohorts: list[str]) -> None:
        out[var] = {"text": text, "replaces": REPLACES.get(var), "docket": f["docket"], "district_id": f["home"],
                    "cohorts": cohorts, "years": sorted({y for c in cohorts for y in f["cohorts"][c]["years"]}),
                    "source_ids": [SOURCE_ID]}

    if fil:
        base = (f"Most civil cases filed in {short} in {_runs(fil['years'])} were part of one multidistrict "
                f"litigation docket, {label}: {fil['count']:,} of {fil['total']:,} in FY {fil['peak_year']}, and "
                f"{fil['national_count']:,} of the {fil['national_total']:,} filed in all districts that year "
                "(FJC case records).")
        tails = {
            "civil_filings_per_judgeship": f"They count in {short}'s values, its rank and the national figure for those years.",
            "filings_per_judgeship": f"They count in {short}'s values, its rank and the national figure for those years.",
            "weighted_filings_per_judgeship": f"They count in {short}'s values, its rank and the national figure for those years.",
            "civil_filings_per_100k": f"They count in {short}'s values and its rank for those years.",
            "pro_se_pct": f"Many are coded pro se, and they count in {short}'s share and the national share for those years.",
            "prisoner_petitions_pct": f"They are in the denominator of {short}'s share and of the national share for those years.",
        }
        for var in FILED_VARS:
            lead = "Mass-tort cases can carry pro se codes in bulk. " if var == "pro_se_pct" else ""
            add(var, f"{lead}{base} {tails[var]}", ["filed"])
    if clo:
        base = (f"Most civil cases closed in {short} in {_runs(clo['years'])} were part of one multidistrict "
                f"litigation docket, {label}: {clo['count']:,} of {clo['total']:,} in FY {clo['peak_year']}, and "
                f"{clo['national_count']:,} of the {clo['national_total']:,} closed in all districts that year "
                "(FJC case records).")
        tails = {
            "terminations_per_judgeship": f"They count in {short}'s values, its rank and the national figure for those years.",
            "civil_disposition_months": f"They are among the cases behind {short}'s median and the national median for those years.",
            "civil_trial_rate_pct": f"They are in the denominator of {short}'s rate and of the national rate for those years.",
        }
        for var in CLOSED_VARS:
            add(var, f"{base} {tails[var]}", ["terminated"])
    if fil and clo:
        base = (f"Most civil cases filed in {short} in {_runs(fil['years'])} were part of one multidistrict "
                f"litigation docket, {label} ({fil['count']:,} of {fil['total']:,} in FY {fil['peak_year']}), and so "
                f"were most of those it closed in {_runs(clo['years'])} (FJC case records).")
        tails = {
            "pending_per_judgeship": f"While open, they count in {short}'s pending cases, its rank and the national figure.",
            "civil_over_3yrs_pct": f"Those still open three years after filing count in {short}'s share and the national share.",
        }
        for var in PENDING_VARS:
            add(var, f"{base} {tails[var]}", ["filed", "terminated"])
    return out


def apply(entry: dict, caveats: dict[str, dict]) -> dict:
    """Put the variable's MDL caveat in place of the general one it replaces, or just before the rank caveat."""
    c = caveats.get(entry["id"])
    if not c:
        return entry
    cav = list(entry.get("caveats") or [])
    if c["replaces"] and c["replaces"] in cav:
        cav[cav.index(c["replaces"])] = c["text"]
    else:
        at = next((i for i, x in enumerate(cav) if x.startswith("Ranks are derived")), len(cav))
        cav.insert(at, c["text"])
    entry["caveats"] = cav
    entry["mdl_caveat"] = {k: v for k, v in c.items() if k not in ("replaces",)}
    return entry
