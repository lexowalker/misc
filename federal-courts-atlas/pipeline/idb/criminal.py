"""Criminal IDB (cr96on): defendant counts and district x fiscal-year aggregates.

File structure (FJC "Criminal Code Book 1996 Forward", Introduction): the cumulative file is a stack of
fiscal-year *snapshots* (FISCALYR = 1996 ... 2026). Each snapshot holds one record per defendant filed,
terminated, or pending during that fiscal year, so a defendant pending for five years appears in five
snapshots. The AO's count flags (CTFIL, CTTR, ...; computed back to FY1996 by the FJC) say whether the
record counts as a filing or termination *in that snapshot's year*. Counting therefore never crosses
snapshots: a defendant filed in FY X is a record with FISCALYR == X and CTFIL == 1; a defendant terminated in
FY X has FISCALYR == X and CTTR == 1. No cross-snapshot de-duplication is needed or applied (the codebook's
own instruction for matching published tables: "select cases using the fields FISCAL YEAR and COUNT
FILINGS ..."). These selections reproduce AO Judicial Business Tables D-1, D-2 and D-4 exactly (see
reconciliation).

* Filed: CTFIL == 1 -- defendants whose proceedings commenced in the year (PROCDATE in the FY, per the
  codebook), excluding inter-district (Rule 20/21) transfers, so no defendant is counted in two districts.
  All offense levels (felony, Class A misdemeanor, petty offenses assigned to district judges).
* Terminated: CTTR == 1 -- defendants whose case closed in the year (TERMDATE in the FY), excluding
  Rule 20/21 transfers out (DISP1 = 0).
* Offense: D2FOFFCD1, the D2 offense code of the most serious filing offense (FTITLE1).
* Disposition: DISP1, the disposition of the most serious offense at termination, which "the AOUSC uses
  ... when reporting a defendant's final disposition" (codebook).
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from .codes import CRIM_ACQUIT_GROUPS, CRIM_DISP, CRIM_TRIAL_GROUPS, OFFENSE_CATEGORIES, d2_category
from .crosswalk import to_district_id

FIRST_FY = 1996
LOAD_COLS = ["FISCALYR", "DISTRICT", "CTFIL", "CTFILTRN", "CTTR", "CTTRTRN", "DISP1", "D2FOFFCD1",
             "FOFFLVL1", "PROCCD"]


def load(extract: Path) -> pd.DataFrame:
    df = pd.read_parquet(extract, columns=LOAD_COLS)
    codes = df["DISTRICT"].astype("category")
    df["district_id"] = codes.map({c: to_district_id(c) for c in codes.cat.categories}).astype(object)
    d2 = df["D2FOFFCD1"].astype("category")
    df["offense"] = d2.map({c: d2_category(c) for c in d2.cat.categories}).astype(object).fillna("unknown")
    disp = df["DISP1"].fillna(-8).astype("int64")
    df["disp_group"] = disp.map(lambda c: CRIM_DISP.get(c, ("", "missing"))[1])
    return df


def last_fy(df: pd.DataFrame) -> int:
    return int(df["FISCALYR"].max())


def filed(df: pd.DataFrame) -> pd.DataFrame:
    return df[(df["CTFIL"] == 1) & (df["FISCALYR"] >= FIRST_FY)]


def terminated(df: pd.DataFrame) -> pd.DataFrame:
    return df[(df["CTTR"] == 1) & (df["FISCALYR"] >= FIRST_FY)]


def _grid(ids, years):
    return pd.MultiIndex.from_product([sorted(ids), list(years)], names=["district_id", "period"])


def _count(d: pd.DataFrame, ids, years, mask=None) -> pd.Series:
    x = d if mask is None else d[mask]
    s = x.groupby(["district_id", "FISCALYR"]).size()
    s.index = s.index.set_names(["district_id", "period"])
    s = s.reindex(_grid(ids, years), fill_value=0)
    n = x.groupby("FISCALYR").size().reindex(list(years), fill_value=0)
    n.index = pd.MultiIndex.from_arrays([["_national"] * len(n), list(years)], names=["district_id", "period"])
    return pd.concat([s, n]).astype("int64")


def criminal_components(df: pd.DataFrame, ids, years) -> dict[str, pd.Series]:
    f = filed(df)
    t = terminated(df)
    comps = {
        "filed": _count(f, ids, years),
        "filed_felony": _count(f, ids, years, f["FOFFLVL1"] == 4),
        "filed_incl_transfers": _count(df[df["CTFILTRN"] == 1], ids, years),
        "terminated": _count(t, ids, years),
        "terminated_incl_transfers": _count(df[df["CTTRTRN"] == 1], ids, years),
        "trial": _count(t, ids, years, t["disp_group"].isin(CRIM_TRIAL_GROUPS)),
        "jury_trial": _count(t, ids, years, t["disp_group"].isin(["acquitted_jury", "convicted_jury"])),
        "plea": _count(t, ids, years, t["disp_group"] == "plea"),
        "dismissed": _count(t, ids, years, t["disp_group"] == "dismissed"),
        "acquitted": _count(t, ids, years, t["disp_group"].isin(CRIM_ACQUIT_GROUPS)),
    }
    for g in ["acquitted_bench", "acquitted_jury", "convicted_bench", "convicted_jury"]:
        comps[f"disp_{g}"] = _count(t, ids, years, t["disp_group"] == g)
    for cat in OFFENSE_CATEGORIES:
        comps[f"offense_{cat}"] = _count(f, ids, years, f["offense"] == cat)
    return comps


def offense_mix(df: pd.DataFrame, ids, years) -> pd.DataFrame:
    f = filed(df)
    rows = []
    for d in [f, f.assign(district_id="_national")]:
        rows.append(d.groupby(["district_id", "FISCALYR", "offense"]).size().rename("count").reset_index())
    t = pd.concat(rows).rename(columns={"FISCALYR": "period", "offense": "offense_category"})
    # complete grid (zero counts are real zeros: the category had no defendants that year)
    full = pd.MultiIndex.from_product([sorted(ids) + ["_national"], list(years), list(OFFENSE_CATEGORIES)],
                                      names=["district_id", "period", "offense_category"])
    t = t.set_index(["district_id", "period", "offense_category"])["count"].reindex(full, fill_value=0).reset_index()
    tot = t.groupby(["district_id", "period"])["count"].transform("sum")
    t["filed_total"] = tot
    t["share"] = (100.0 * t["count"] / tot).where(tot > 0)
    t["offense_label"] = t["offense_category"].map(OFFENSE_CATEGORIES)
    # felony-only counts alongside (the FCMS case-mix counts felony defendants)
    fel = f[f["FOFFLVL1"] == 4]
    fr = []
    for d in [fel, fel.assign(district_id="_national")]:
        fr.append(d.groupby(["district_id", "FISCALYR", "offense"]).size().rename("count_felony").reset_index())
    fr = pd.concat(fr).rename(columns={"FISCALYR": "period", "offense": "offense_category"})
    t = t.merge(fr, on=["district_id", "period", "offense_category"], how="left")
    t["count_felony"] = t["count_felony"].fillna(0).astype("int64")
    return t


def disposition_mix(df: pd.DataFrame) -> pd.DataFrame:
    t = terminated(df)
    rows = []
    for d in [t, t.assign(district_id="_national")]:
        rows.append(d.assign(disp=d["DISP1"].fillna(-8).astype("int64"))
                    .groupby(["district_id", "FISCALYR", "disp"]).size().rename("count").reset_index())
    m = pd.concat(rows).rename(columns={"FISCALYR": "period"})
    m["disp_label"] = m["disp"].map(lambda c: CRIM_DISP.get(c, ("Not reported", "missing"))[0])
    m["disp_group"] = m["disp"].map(lambda c: CRIM_DISP.get(c, ("Not reported", "missing"))[1])
    tot = m.groupby(["district_id", "period"])["count"].transform("sum")
    m["share"] = 100.0 * m["count"] / tot
    m["terminated_total"] = tot
    return m


def d2_code_counts(df: pd.DataFrame) -> pd.DataFrame:
    """National defendants filed by D2 code and FY (for the offense-mapping audit)."""
    f = filed(df)
    c = f.groupby(["FISCALYR", "D2FOFFCD1"]).size().rename("count").reset_index()
    c["offense_category"] = c["D2FOFFCD1"].map(d2_category)
    return c.rename(columns={"FISCALYR": "period", "D2FOFFCD1": "d2_code"})
