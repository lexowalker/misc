"""Source-total reconciliation of the IDB aggregates.

Every row of ``reconciliation.csv`` compares one IDB number with one published number:

| check | IDB side | published side | expected |
|---|---|---|---|
| ``civil_filed_vs_ao_c1`` | idb_civil_filed | AO Table C-1 "commenced"/"filed" | close, not exact: IDB filings are rebuilt from closed + pending records; AO counts each year's filing extract |
| ``civil_terminated_vs_ao_c1`` | idb_civil_terminated | C-1 "terminated" | exact or near-exact (same extract) |
| ``civil_filed_vs_fcms`` | idb_civil_filed | FCMS "Total Civil" (case-mix table) | close (FCMS = AO count) |
| ``civil_reached_trial_vs_ao_c4`` | terminations with PROCPROG 6-9 | C-4 "during or after trial" | close (C-4 excludes a few hundred records) |
| ``crim_filed_incl_transfers_vs_ao_d1`` | CTFILTRN count | D-1 "total commenced" | exact or near-exact |
| ``crim_terminated_incl_transfers_vs_ao_d1`` | CTTRTRN count | D-1 "total terminated" | exact or near-exact |
| ``crim_filed_vs_ao_d2`` | idb_crim_defendants_filed | D-2 total | exact or near-exact |
| ``crim_offense_<cat>_vs_ao_d2`` | defendants filed in category | D-2 category total | mapping check |
| ``crim_<disposition>_vs_ao_d4`` | terminated defendants by disposition group | D-4 columns | exact or near-exact |
| ``crim_felony_filed_vs_fcms`` | idb_crim_felony_defendants_filed | FCMS "Total Criminal" (FY2010, FY2012+, defendants) | exact |
| ``crim_felony_filed_vs_fcms_case_years`` | same | FCMS "Total Criminal" in FY2004-09, FY2011 (felony *cases*) | not comparable; shown to quantify the unit difference |
"""
from __future__ import annotations

import numpy as np
import pandas as pd

D4_FIELDS = ["terminated", "dismissed", "acquitted_bench", "acquitted_jury", "plea", "convicted_bench",
             "convicted_jury"]


def _rows(check, level, did, period, idb, ref, ref_src, note=""):
    return {"check": check, "level": level, "district_id": did, "period": int(period),
            "idb_value": float(idb) if idb is not None else np.nan,
            "reference_value": float(ref) if ref is not None else np.nan, "reference_source": ref_src,
            "note": note}


def build(comps_civ: dict, comps_crim: dict, jb_tables: dict, d2: pd.DataFrame, fcms_obs: pd.DataFrame | None,
          fcms_src: dict | None = None) -> pd.DataFrame:
    out = []
    # ---- C-1 / D-1 by district and national
    for fy, t in sorted(jb_tables.get("c-1", {}).items()):
        df, sid = t
        for _, r in df.iterrows():
            did = r["district_id"]
            lvl = "national" if did == "_national" else "district"
            key = (did, fy)
            out.append(_rows("civil_filed_vs_ao_c1", lvl, did, fy, comps_civ["filed"].get(key), r["filed"], sid))
            out.append(_rows("civil_terminated_vs_ao_c1", lvl, did, fy, comps_civ["terminated"].get(key),
                             r["terminated"], sid))
    for fy, t in sorted(jb_tables.get("d-1", {}).items()):
        df, sid = t
        for _, r in df.iterrows():
            did = r["district_id"]
            lvl = "national" if did == "_national" else "district"
            key = (did, fy)
            out.append(_rows("crim_filed_incl_transfers_vs_ao_d1", lvl, did, fy,
                             comps_crim["filed_incl_transfers"].get(key), r["commenced_incl_transfers"], sid))
            out.append(_rows("crim_terminated_incl_transfers_vs_ao_d1", lvl, did, fy,
                             comps_crim["terminated_incl_transfers"].get(key), r["terminated_incl_transfers"], sid))
    for fy, t in sorted(jb_tables.get("d-4", {}).items()):
        d, sid = t
        key = ("_national", fy)
        idb = {
            "terminated": comps_crim["terminated"].get(key),
            "dismissed": comps_crim["dismissed"].get(key),
            "plea": comps_crim["plea"].get(key),
        }
        for f in ["acquitted_bench", "acquitted_jury", "convicted_bench", "convicted_jury"]:
            idb[f] = comps_crim[f"disp_{f}"].get(key)
        for f in D4_FIELDS:
            out.append(_rows(f"crim_{f}_vs_ao_d4", "national", "_national", fy, idb[f], d[f], sid))
    for fy, t in sorted(jb_tables.get("c-4", {}).items()):
        d, sid = t
        key = ("_national", fy)
        out.append(_rows("civil_reached_trial_vs_ao_c4", "national", "_national", fy,
                         comps_civ["reached_trial"].get(key), d["trials"], sid))
        out.append(_rows("civil_terminated_vs_ao_c4", "national", "_national", fy,
                         comps_civ["terminated"].get(key), d["terminated"], sid,
                         "C-4 total omits a few hundred terminations that C-1 counts"))
    # ---- D-2 national totals and offense categories (one value per FY: the latest table that prints it)
    if d2 is not None and len(d2):
        latest = d2.sort_values("table_fy").drop_duplicates(["period", "category"], keep="last")
        for _, r in latest.iterrows():
            fy, cat = int(r["period"]), r["category"]
            key = ("_national", fy)
            sid = r["source_id"]
            if cat == "total":
                out.append(_rows("crim_filed_vs_ao_d2", "national", "_national", fy, comps_crim["filed"].get(key),
                                 r["count"], sid))
            else:
                out.append(_rows(f"crim_offense_{cat}_vs_ao_d2", "national", "_national", fy,
                                 comps_crim[f"offense_{cat}"].get(key), r["count"], sid,
                                 "category mapping of D2 codes is this lane's (codes.py)"))
    # ---- FCMS (district level)
    if fcms_obs is not None and len(fcms_obs):
        f = fcms_obs[fcms_obs["variable"] == "fcms_filings_civil"]
        for _, r in f.iterrows():
            key = (r["district_id"], int(r["period"]))
            out.append(_rows("civil_filed_vs_fcms", "district", r["district_id"], r["period"],
                             comps_civ["filed"].get(key), r["value"], f"fcms:{r['source_id']}"))
        f = fcms_obs[fcms_obs["variable"] == "fcms_filings_criminal_felony"]
        for _, r in f.iterrows():
            key = (r["district_id"], int(r["period"]))
            meth = r.get("method", "")
            check = "crim_felony_filed_vs_fcms" if meth == "crim_defendants" else "crim_felony_filed_vs_fcms_case_years"
            out.append(_rows(check, "district", r["district_id"], r["period"],
                             comps_crim["filed_felony"].get(key), r["value"], f"fcms:{r['source_id']}",
                             f"FCMS counting unit: {meth}"))
    rec = pd.DataFrame(out)
    rec["diff"] = rec["idb_value"] - rec["reference_value"]
    rec["pct_diff"] = 100.0 * rec["diff"] / rec["reference_value"].where(rec["reference_value"] != 0)
    return rec


def summarize(rec: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (check, level), g in rec.groupby(["check", "level"]):
        g = g.dropna(subset=["idb_value", "reference_value"])
        if not len(g):
            continue
        ad = g["pct_diff"].abs()
        corr = g["idb_value"].corr(g["reference_value"]) if len(g) > 2 else np.nan
        rows.append({
            "check": check, "level": level, "n": len(g), "first_period": int(g["period"].min()),
            "last_period": int(g["period"].max()), "exact_matches": int((g["diff"] == 0).sum()),
            "median_abs_pct_diff": float(ad.median()), "p95_abs_pct_diff": float(ad.quantile(0.95)),
            "max_abs_pct_diff": float(ad.max()), "sum_idb": float(g["idb_value"].sum()),
            "sum_reference": float(g["reference_value"].sum()), "pearson_r": float(corr),
        })
    return pd.DataFrame(rows)
