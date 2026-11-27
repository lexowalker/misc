"""Compare datafile computations with the USSC's published Statistical Information Packets.

For every fiscal year the E.D. Va. packet is parsed for its two all-district tables
(Table 2 "pleas and trials by circuit and district" and the departure / guideline-range
table by circuit and district), which checks every district's record counts and its
guideline-range categories. District-level tables (offense mix, sentence type, sentence
length, sentence relative to the guideline range, case totals) are checked for E.D. Va.
in every year and for a fixed sample of other districts across eras. Every comparison is
written to ``data/processed/ussc/validation.csv``.
"""
from __future__ import annotations

import re

import pandas as pd

from .compute import GROUPS
from .packets import (Table, all_district_rows, find_table, labelled_rows, norm_label, packet_text,
                      split_tables)

PCT_TOL = 0.05 + 1e-9     # published percentages carry one decimal


def range_scheme(fy: int, period: str) -> str:
    if fy == 2002:
        return "depart02"
    if fy == 2003:
        return "depart03"
    if fy == 2004:
        return "departA"
    if fy == 2005:
        return {"pre_booker": "departA", "post_booker": "booker"}.get(period, "mixed2005")
    return "booker" if fy <= 2017 else "sentrnge"


def periods_for(fy: int) -> list[str]:
    return {2004: ["pre_blakely", "post_blakely"], 2005: ["pre_booker", "post_booker"]}.get(fy, ["full"])


class Comps:
    def __init__(self, comps_fy: pd.DataFrame):
        self.d = {(r.district_id, r.period, r.scheme, r.component): r.value
                  for r in comps_fy.itertuples(index=False)}

    def get(self, did, period, scheme, comp, default=0.0):
        return self.d.get((did, period, scheme, comp), default)


def _rec(out, fy, did, source_id, table, period, measure, published, computed, kind):
    if published is None:
        return
    if kind == "count":
        tol = 0.0
    elif kind == "pct":
        tol = PCT_TOL
    elif kind == "mean_int":
        tol = 0.5 + 1e-9
    else:  # one-decimal mean/median
        tol = 0.05 + 1e-9
    ok = computed is not None and not pd.isna(computed) and abs(computed - published) <= tol
    out.append({"fy": fy, "district_id": did, "source_id": source_id, "table": table, "period": period,
                "measure": measure, "published": published, "computed": computed,
                "abs_diff": None if computed is None else abs(computed - published), "match": bool(ok),
                "note": ""})


def _pct(n, d):
    return None if not d else 100.0 * n / d


# ---------------------------------------------------------------- all-district tables -------
def validate_all_district_tables(fy: int, text: str, comps: Comps, source_id: str) -> list[dict]:
    out: list[dict] = []
    tables = split_tables(text)
    for period in periods_for(fy):
        t2 = find_table(tables, 2, period)
        if t2 is not None:
            for row in all_district_rows(t2):
                if not row.numbers or row.numbers[0] is None:
                    continue
                comp = comps.get(row.district_id, period, "disposit", "plea_trial_total")
                _rec(out, fy, row.district_id, source_id, "Table 2 (pleas/trials by district): TOTAL", period,
                     "plea_trial_total", row.numbers[0], comp, "count")
        out += _validate_range_by_district(fy, period, tables, comps, source_id)
    return out


def _range_cols(fy: int, period: str, nnums: int) -> list[str] | None:
    """Category keys of the (N, %) pairs in a by-district range table row, given its width."""
    if fy == 2002:
        return ["within", "sa_5k1", "other_downward", "upward"] if nnums == 9 else None
    if fy in (2003, 2004) or (fy == 2005 and period == "pre_booker"):
        return ["within", "sa_5k1", "govt_initiated", "other_downward", "upward"] if nnums == 11 else None
    if fy <= 2017:  # booker scheme, table split in two halves
        if nnums == 11:
            return ["TOTAL", "within", "upward_departure", "upward_departure_booker", "above_booker",
                    "remaining_above"]
        if nnums == 14:
            return ["sa_5k1", "edp_5k3", "other_govt_below", "downward_departure", "downward_departure_booker",
                    "below_booker", "remaining_below"]
        return None
    return ["within", "upward_departure", "sa_5k1", "edp_5k3", "downward_departure_other", "variance"] \
        if nnums == 13 else None


def _validate_range_by_district(fy, period, tables, comps, source_id) -> list[dict]:
    out: list[dict] = []
    tnum = 8 if fy <= 2005 else 9
    t = find_table(tables, tnum, period)
    if t is None:
        return out
    scheme = range_scheme(fy, period)
    label = f"Table {tnum} (guideline range by district)"
    for row in all_district_rows(t):
        nums = row.numbers
        cols = _range_cols(fy, period, len(nums))
        if cols is None:
            continue
        did = row.district_id
        if cols[0] == "TOTAL":      # first half of a split booker table
            total = nums[0]
            _rec(out, fy, did, source_id, label, period, "range_known", total,
                 comps.get(did, period, scheme, "range_known"), "count")
            pairs = nums[1:]
            cols = cols[1:]
        elif fy <= 2017 and fy >= 2005 and not (fy == 2005 and period == "pre_booker"):
            pairs = nums           # second half: no TOTAL column
        else:
            total = nums[0]
            _rec(out, fy, did, source_id, label, period, "range_known", total,
                 comps.get(did, period, scheme, "range_known"), "count")
            pairs = nums[1:]
        for k, key in enumerate(cols):
            n_pub, p_pub = pairs[2 * k], pairs[2 * k + 1]
            n_comp = comps.get(did, period, scheme, f"grp_{key}", None)
            if n_comp is None:
                n_comp = comps.get(did, period, scheme, f"cat_{key}")
            _rec(out, fy, did, source_id, label, period, f"{key}_n", n_pub, n_comp, "count")
            den = comps.get(did, period, scheme, "range_known")
            _rec(out, fy, did, source_id, label, period, f"{key}_pct", p_pub, _pct(n_comp, den), "pct")
    return out


# ------------------------------------------------------------------ district tables ----------
OFFENSE_LABELS = {
    "drugstrafficking": "drug_trafficking", "drugtrafficking": "drug_trafficking",
    "firearms": "firearms", "fraud": "fraud", "immigration": "immigration",
    "childpornography": "child_pornography", "fraud/theft/embezzlement": "fraud_theft_embezzlement",
    "fraudtheftembezzlement": "fraud_theft_embezzlement",
}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z/]", "", re.sub(r"(?<=[A-Za-z])\d+\b", "", s).lower())


def validate_district_tables(fy: int, did: str, text: str, comps: Comps, source_id: str) -> list[dict]:
    out: list[dict] = []
    tables = split_tables(text)
    ovar = "OFFTYPE2" if fy <= 2009 else ("OFFTYPSB" if fy <= 2017 else "OFFGUIDE")

    # cases total (note under Figure A / Table 1)
    if fy >= 2018:
        ms = re.findall(r"figure includes the ([\d,]+) cases", text)
        if len(ms) >= 2:
            _rec(out, fy, "US", source_id, "Figure A note", "full", "cases_total", float(ms[0].replace(",", "")),
                 comps.get("US", "full", "all", "cases_total"), "count")
            _rec(out, fy, did, source_id, "Figure A note", "full", "cases_total", float(ms[1].replace(",", "")),
                 comps.get(did, "full", "all", "cases_total"), "count")
    t1 = find_table(tables, 1, "full")
    if t1 is not None:
        ms = re.findall(r"Of the ([\d,]+) (?:guideline )?cases", t1.text)
        if fy < 2018 and len(ms) >= 2:
            _rec(out, fy, "US", source_id, "Table 1 note", "full", "cases_total", float(ms[0].replace(",", "")),
                 comps.get("US", "full", "all", "cases_total"), "count")
            _rec(out, fy, did, source_id, "Table 1 note", "full", "cases_total", float(ms[1].replace(",", "")),
                 comps.get(did, "full", "all", "cases_total"), "count")
        for label, nums in labelled_rows(t1):
            key = _norm(label)
            if key == "total" and len(nums) >= 4:
                for who, n in (("US", nums[0]), (did, nums[2])):
                    _rec(out, fy, who, source_id, "Table 1 (offense mix)", "full", "offense_known", n,
                         comps.get(who, "full", ovar, "offense_known"), "count")
            elif key in OFFENSE_LABELS and len(nums) >= 4:
                cat = OFFENSE_LABELS[key]
                for who, n, p in (("US", nums[0], nums[1]), (did, nums[2], nums[3])):
                    c = comps.get(who, "full", ovar, f"offense_{cat}", None)
                    if c is None:
                        continue
                    _rec(out, fy, who, source_id, "Table 1 (offense mix)", "full", f"offense_{cat}_n", n, c, "count")
                    den = comps.get(who, "full", ovar, "offense_known")
                    _rec(out, fy, who, source_id, "Table 1 (offense mix)", "full", f"offense_{cat}_pct", p,
                         _pct(c, den), "pct")

    for period in periods_for(fy):
        # sentence type: Table 4 national, Table 5 district
        for tnum, who in ((4, "US"), (5, did)):
            t = find_table(tables, tnum, period)
            if t is None:
                continue
            total_rows = [nums for label, nums in labelled_rows(t) if _norm(label) == "total"]
            if not total_rows:
                continue
            nums = total_rows[0]
            sfx = "_offknown" if fy <= 2009 else ""
            if fy <= 2017 and len(nums) >= 9:
                keys = ["prison_only", "prison_alt", "probation_alt", "probation_only"]
                comp = {k: comps.get(who, period, "SENTIMP", f"senttype_{k}{sfx}") for k in keys}
                den = sum(comp.values())
                _rec(out, fy, who, source_id, f"Table {tnum} (sentence type)", period, "senttype_total_excl_fine",
                     nums[0], den, "count")
                for k_i, k in enumerate(keys):
                    _rec(out, fy, who, source_id, f"Table {tnum} (sentence type)", period, f"{k}_n",
                         nums[1 + 2 * k_i], comp[k], "count")
                    _rec(out, fy, who, source_id, f"Table {tnum} (sentence type)", period, f"{k}_pct",
                         nums[2 + 2 * k_i], _pct(comp[k], den), "pct")
            elif fy >= 2018 and len(nums) >= 11:
                keys = ["prison_only", "prison_alt", "probation_alt", "probation_only", "fine_only"]
                den = comps.get(who, period, "SENTIMP", "senttype_known")
                _rec(out, fy, who, source_id, f"Table {tnum} (sentence type)", period, "senttype_known",
                     nums[0], den, "count")
                for k_i, k in enumerate(keys):
                    c = comps.get(who, period, "SENTIMP", f"senttype_{k}")
                    _rec(out, fy, who, source_id, f"Table {tnum} (sentence type)", period, f"{k}_n",
                         nums[1 + 2 * k_i], c, "count")
                    if k_i < 4:  # fine-only percent column is clipped in the PDF layout
                        _rec(out, fy, who, source_id, f"Table {tnum} (sentence type)", period, f"{k}_pct",
                             nums[2 + 2 * k_i], _pct(c, den), "pct")
        # sentence length: Table 7
        t7 = find_table(tables, 7, period)
        if t7 is not None:
            tot = [nums for label, nums in labelled_rows(t7) if _norm(label) == "total"]
            if tot and len(tot[0]) >= 6:
                nums = tot[0]
                conv = "prison_pre2018" if fy <= 2017 else "sent2018"
                kind = "mean_int" if fy >= 2011 else "dec1"   # printed as integers from FY2011
                for who, (mn, md, n) in (("US", nums[0:3]), (did, nums[3:6])):
                    if n is None or n == 0 or mn is None:
                        continue
                    _rec(out, fy, who, source_id, "Table 7 (sentence length)", period, f"{conv}_mean", mn,
                         comps.get(who, period, conv, "mean", None), kind)
                    _rec(out, fy, who, source_id, "Table 7 (sentence length)", period, f"{conv}_median", md,
                         comps.get(who, period, conv, "median", None), kind)
                    _rec(out, fy, who, source_id, "Table 7 (sentence length)", period, f"{conv}_n", n,
                         comps.get(who, period, conv, "n"), "count")
        # sentence relative to guideline range: Table 8 (FY2006+ district + national)
        if fy >= 2006:
            out += _validate_table8(fy, did, tables, comps, source_id)
    return out


T8_BOOKER = {
    "totalcases": "range_known", "casessentencedwithinguidelinerange": "grp_within",
    "casessentencedaboveguidelinerange": "grp_above", "governmentsponsoredbelowrange": "grp_govt_below",
    "nongovernmentsponsoredbelowrange": "grp_non_govt_below",
    "§kssubstantialassistancedeparture": "grp_sa_5k1", "kssubstantialassistancedeparture": "grp_sa_5k1",
    "§ksearlydispositionprogramdeparture": "grp_edp_5k3", "ksearlydispositionprogramdeparture": "grp_edp_5k3",
}
T8_SENTRNGE = {
    "totalcases": "range_known", "withinguidelinerange": "cat_within", "upwarddeparture": "cat_upward_departure",
    "kssubstantialassistance": "cat_sa_5k1", "ksearlydispositionprogram": "cat_edp_5k3",
    "othergovernmentmotion": "cat_other_govt_departure", "nongovernmentdeparture": "cat_non_govt_departure",
    "upwardvariance": "cat_upward_variance", "governmentmotion": "cat_govt_variance",
    "nongovernmentvariance": "cat_non_govt_variance",
}


def _t8key(label: str) -> str:
    s = re.sub(r"(?<=[A-Za-z])\d+\b", "", label)       # footnote digits glued to words
    s = s.replace("5K1.1", "K").replace("5K3.1", "K")
    return re.sub(r"[^a-z§]", "", s.lower()).replace("§", "")


def _validate_table8(fy, did, tables, comps, source_id) -> list[dict]:
    out: list[dict] = []
    t8 = find_table(tables, 8, "full")
    if t8 is None:
        return out
    mapping = T8_BOOKER if fy <= 2017 else T8_SENTRNGE
    mapping = {k.replace("§", ""): v for k, v in mapping.items()}
    scheme = "booker" if fy <= 2017 else "sentrnge"
    seen = set()
    for label, nums in labelled_rows(t8):
        key = _t8key(label)
        if len(nums) == 5:          # footnote marker printed apart from its label ("Motion 3  1,272 ...")
            nums = nums[1:]
        if key not in mapping or key in seen or len(nums) < 4:
            continue
        seen.add(key)
        comp = mapping[key]
        for who, n, p in (("US", nums[0], nums[1]), (did, nums[2], nums[3])):
            c = comps.get(who, "full", scheme, comp)
            _rec(out, fy, who, source_id, "Table 8 (sentence relative to guideline range)", "full",
                 f"{comp}_n", n, c, "count")
            if comp != "range_known":
                den = comps.get(who, "full", scheme, "range_known")
                _rec(out, fy, who, source_id, "Table 8 (sentence relative to guideline range)", "full",
                     f"{comp}_pct", p, _pct(c, den), "pct")
                # FY2006-FY2009 packets print a group's percent as the sum of its rounded
                # sub-category percents (e.g. 2.7+2.0+6.0+1.3 = 12.0 for 8,507/70,187 = 12.1%).
                if scheme == "booker" and comp.startswith("grp_") and not out[-1]["match"] and den:
                    keys = GROUPS["booker"][comp[4:]]
                    alt = sum(round(100.0 * comps.get(who, "full", scheme, f"cat_{k}") / den + 1e-9, 1)
                              for k in keys)
                    if abs(alt - p) <= 1e-6:
                        out[-1]["match"] = True
                        out[-1]["note"] = "published as sum of rounded sub-category percents; counts match"
    return out


# ---------------------------------------- FY2016-FY2017 national, FY2018 methodology ----------
# USSC Sourcebook FY2025, Figure 9 "Sentence imposed relative to the guideline range over time"
# (FY2016-FY2025, current methodology). Values transcribed from the PDF text layer; the
# §5K3.1 series is not present in the text layer and is not used.
SOURCEBOOK_FIG9_URL = ("https://www.ussc.gov/sites/default/files/pdf/research-and-publications/"
                       "annual-reports-and-sourcebooks/2025/Figure09.pdf")
SOURCEBOOK_FIG9 = {
    2016: {"cat_within": 48.6, "cat_upward_departure": 0.6, "cat_sa_5k1": 11.1,
           "grp_downward_departure_other": 5.3, "grp_variance": 25.5},
    2017: {"cat_within": 49.1, "cat_upward_departure": 0.7, "cat_sa_5k1": 10.8,
           "grp_downward_departure_other": 4.6, "grp_variance": 26.0},
}


def validate_supplemental_national(comps: pd.DataFrame, source_id: str) -> list[dict]:
    out: list[dict] = []
    for fy, vals in SOURCEBOOK_FIG9.items():
        c = Comps(comps[comps["fy"] == fy])
        den = c.get("US", "full", "sentrnge_sup", "range_known")
        for comp, pub in vals.items():
            _rec(out, fy, "US", source_id, "Sourcebook FY2025 Figure 9 (FY2018 methodology over time)", "full",
                 f"sup_{comp}_pct", pub, _pct(c.get("US", "full", "sentrnge_sup", comp), den), "pct")
    return out
