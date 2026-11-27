"""Civil IDB (cv88on): case cohorts and district x fiscal-year aggregates.

File structure (FJC civil codebook and the IDB Research Guide): the cumulative civil file is the AO's
termination extract of every statistical year SY1988-FY2026 (TAPEYEAR = year of termination) plus the cases
pending on September 30, 2026 (TAPEYEAR = 2099, STATUSCD = "S"). A case is in it once per termination
record, so the file holds every case filed since October 1987: closed cases under the year they closed,
open cases as pending records.

Two cohorts are built:

* **Termination records** (``terminations``): every record with TAPEYEAR != 2099, assigned to the
  federal fiscal year (Oct 1-Sep 30) of TDATEUSE, the "termination date used by AO". No de-duplication:
  the AO counts a case terminated twice (e.g. a termination later vacated and the case closed again) as a
  termination in each year, and so does this lane. For FY1993+ the TDATEUSE fiscal year equals TAPEYEAR on
  every record (checked in tests). FY1988 is the first complete fiscal year: SY1988 starts July 1, 1987.
* **Filed cases** (``filings``): one record per case, assigned to the fiscal year of FDATEUSE, the "filing
  date used by AO" (the codebook says cohorts built on it match published counts). De-duplication key:
  DISTRICT + OFFICE + DOCKET + ORIGIN + FILEDATE. The IDB guide says district, office and docket make the
  case identifier; ORIGIN and FILEDATE are added because a reopened, remanded or transferred-back case keeps
  its docket number but is a new filing (ORIGIN 3, 4, 8-12), which the AO counts again. About 35,600 cases
  (0.3% of records, mostly tape years 2016-2019) appear twice under that key with different termination
  dates; the record with the latest TAPEYEAR (pending 2099 counts as latest; ties by file order) is kept,
  so a case's nature of suit, pro se and class-action codes are the most recent ones reported.
  FY1988 is the first complete filing year: every case filed from October 1, 1987 on either closed in or
  after SY1988 or is still pending.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .codes import (CIVIL_BENCH_DISP, CIVIL_DISP, CIVIL_JURY_DISP, CIVIL_REACHED_TRIAL_PROCPROG,
                    CIVIL_TRIAL_DISP, NOS_GROUP_UNLISTED, NOS_TO_GROUP, PATENT_ANDA_NOS, PATENT_NOS,
                    PRISONER_NOS, PROSE_ANY, PROSE_PLAINTIFF, PROSE_VALID)
from .crosswalk import to_district_id

FIRST_FY = 1988
DEDUP_KEY = ["DISTRICT", "OFFICE", "DOCKET", "ORIGIN", "FILEDATE"]
PROSE_FIRST_FY = 1999          # PROSE is blank on every record of tape years 1988-1995 and 1998
PROSE_MIN_COVERAGE = 0.95      # share of a district-year's filings with a reported PROSE code

LOAD_COLS = ["DISTRICT", "OFFICE", "DOCKET", "ORIGIN", "FILEDATE", "FDATEUSE", "TDATEUSE", "NOS", "PROSE",
             "CLASSACT", "DISP", "PROCPROG", "TAPEYEAR", "ROWNO"]


def fiscal_year(d: pd.Series) -> pd.Series:
    """Federal fiscal year (Oct 1 - Sep 30) of a datetime series."""
    return (d.dt.year + (d.dt.month >= 10).astype("int64")).astype("Int64")


def load(extract: Path) -> pd.DataFrame:
    df = pd.read_parquet(extract, columns=LOAD_COLS)
    codes = df["DISTRICT"].astype("category")
    df["district_id"] = codes.map({c: to_district_id(c) for c in codes.cat.categories}).astype(object)
    df["FFY"] = fiscal_year(df["FDATEUSE"])
    df["TFY"] = fiscal_year(df["TDATEUSE"])
    return df


def last_fy(df: pd.DataFrame) -> int:
    return int(df.loc[df["TAPEYEAR"] != 2099, "TAPEYEAR"].max())


def filings(df: pd.DataFrame) -> pd.DataFrame:
    """One record per filed case (see module docstring), FY1988 onward."""
    order = df["TAPEYEAR"].where(df["TAPEYEAR"] != 2099, 9999)
    d = df.assign(_ord=order).sort_values(["_ord", "ROWNO"], kind="stable")
    d = d.drop_duplicates(DEDUP_KEY, keep="last").drop(columns="_ord")
    lf = last_fy(df)
    return d[(d["FFY"] >= FIRST_FY) & (d["FFY"] <= lf)].copy()


def terminations(df: pd.DataFrame) -> pd.DataFrame:
    d = df[df["TAPEYEAR"] != 2099]
    lf = last_fy(df)
    return d[(d["TFY"] >= FIRST_FY) & (d["TFY"] <= lf)].copy()


def dedup_stats(df: pd.DataFrame) -> dict:
    dup = df.duplicated(DEDUP_KEY, keep="first")
    return {"records": int(len(df)), "duplicate_records_dropped": int(dup.sum()),
            "cases": int(len(df) - dup.sum())}


# ----------------------------------------------------------------------------------------- aggregates
def _grid(ids, years) -> pd.MultiIndex:
    return pd.MultiIndex.from_product([sorted(ids), list(years)], names=["district_id", "period"])


def count_by(d: pd.DataFrame, fy_col: str, mask=None, ids=None, years=None) -> pd.Series:
    x = d if mask is None else d[mask]
    s = x.groupby(["district_id", fy_col]).size()
    s.index = s.index.set_names(["district_id", "period"])
    if ids is not None:
        s = s.reindex(_grid(ids, years), fill_value=0)
    return s.astype("int64")


def national_count(d: pd.DataFrame, fy_col: str, mask=None, years=None) -> pd.Series:
    x = d if mask is None else d[mask]
    s = x.groupby(fy_col).size()
    s.index = s.index.set_names("period")
    if years is not None:
        s = s.reindex(list(years), fill_value=0)
    return s.astype("int64")


def civil_components(fil: pd.DataFrame, term: pd.DataFrame, ids, years) -> dict[str, pd.Series]:
    """Numerators and denominators per district-year (and '_national') for every civil variable."""
    comps: dict[str, pd.Series] = {}

    def both(name, d, fy, mask=None):
        dist = count_by(d, fy, mask, ids, years)
        nat = national_count(d, fy, mask, years)
        nat.index = pd.MultiIndex.from_arrays([["_national"] * len(nat), nat.index],
                                              names=["district_id", "period"])
        comps[name] = pd.concat([dist, nat])

    both("filed", fil, "FFY")
    both("patent830", fil, "FFY", fil["NOS"] == PATENT_NOS)
    both("patent835", fil, "FFY", fil["NOS"] == PATENT_ANDA_NOS)
    both("prisoner", fil, "FFY", fil["NOS"].isin(PRISONER_NOS))
    both("class_action", fil, "FFY", fil["CLASSACT"] == 1)
    both("prose_valid", fil, "FFY", fil["PROSE"].isin(PROSE_VALID))
    both("prose_any", fil, "FFY", fil["PROSE"].isin(PROSE_ANY))
    both("prose_plaintiff", fil, "FFY", fil["PROSE"].isin(PROSE_PLAINTIFF))
    both("terminated", term, "TFY")
    both("trial_disp", term, "TFY", term["DISP"].isin(CIVIL_TRIAL_DISP))
    both("trial_disp_jury", term, "TFY", term["DISP"].isin(CIVIL_JURY_DISP))
    both("trial_disp_bench", term, "TFY", term["DISP"].isin(CIVIL_BENCH_DISP))
    both("reached_trial", term, "TFY", term["PROCPROG"].isin(CIVIL_REACHED_TRIAL_PROCPROG))
    return comps


def nos_mix(fil: pd.DataFrame, ids, years) -> tuple[pd.DataFrame, pd.DataFrame]:
    """(group table, code table) of filings by NOS group / NOS code per district-year, with national rows."""
    grp = fil["NOS"].map(NOS_TO_GROUP).fillna(NOS_GROUP_UNLISTED)
    g = fil.assign(nos_group=grp)
    rows = []
    for level, d in [("district", g), ("national", g.assign(district_id="_national"))]:
        c = d.groupby(["district_id", "FFY", "nos_group"]).size().rename("count").reset_index()
        rows.append(c)
    t = pd.concat(rows).rename(columns={"FFY": "period"})
    tot = t.groupby(["district_id", "period"])["count"].transform("sum")
    t["share"] = 100.0 * t["count"] / tot
    t["filed_total"] = tot
    code = pd.concat([
        fil.groupby(["district_id", "FFY", "NOS"]).size().rename("count").reset_index(),
        fil.assign(district_id="_national").groupby(["district_id", "FFY", "NOS"]).size().rename("count").reset_index(),
    ]).rename(columns={"FFY": "period", "NOS": "nos"})
    code["nos_group"] = code["nos"].map(NOS_TO_GROUP).fillna(NOS_GROUP_UNLISTED)
    return t, code


def disposition_mix(term: pd.DataFrame) -> pd.DataFrame:
    d = term.assign(disp=term["DISP"].fillna(-8).astype("int64"))
    rows = []
    for dd in [d, d.assign(district_id="_national")]:
        rows.append(dd.groupby(["district_id", "TFY", "disp"]).size().rename("count").reset_index())
    t = pd.concat(rows).rename(columns={"TFY": "period"})
    t["disp_label"] = t["disp"].map(lambda c: CIVIL_DISP.get(c, ("Not reported", "missing"))[0])
    t["disp_group"] = t["disp"].map(lambda c: CIVIL_DISP.get(c, ("Not reported", "missing"))[1])
    tot = t.groupby(["district_id", "period"])["count"].transform("sum")
    t["share"] = 100.0 * t["count"] / tot
    t["terminated_total"] = tot
    return t


def patent_quarterly(fil: pd.DataFrame, ids) -> pd.DataFrame:
    """Patent filings (NOS 830, NOS 835) per calendar quarter of FDATEUSE, per district and national."""
    p = fil[fil["NOS"].isin([PATENT_NOS, PATENT_ANDA_NOS])]
    q = p["FDATEUSE"].dt.to_period("Q")
    p = p.assign(quarter=q)
    # complete filing range only: FY1988 Q1 (Oct-Dec 1987) through the last fiscal year's Q4 (Jul-Sep)
    all_q = pd.period_range("1987Q4", f"{int(fil['FFY'].max())}Q3", freq="Q")
    out = []
    groups = dict(list(p.groupby("district_id")))
    for did, d in [(i, groups.get(i, p.iloc[0:0])) for i in sorted(ids)] + [("_national", p)]:
        c830 = d[d["NOS"] == PATENT_NOS].groupby("quarter").size().reindex(all_q, fill_value=0)
        c835 = d[d["NOS"] == PATENT_ANDA_NOS].groupby("quarter").size().reindex(all_q, fill_value=0)
        out.append(pd.DataFrame({"district_id": did, "quarter": all_q.astype(str), "nos830": c830.values,
                                 "nos835": c835.values}))
    t = pd.concat(out, ignore_index=True)
    t["nos830_835"] = t["nos830"] + t["nos835"]
    qp = pd.PeriodIndex(t["quarter"], freq="Q")
    t["quarter_start"] = qp.start_time.strftime("%Y-%m-%d")
    t["calendar_year"] = qp.year
    t["calendar_quarter"] = qp.quarter
    t["fiscal_year"] = qp.year + (qp.quarter == 4)
    t["fiscal_quarter"] = ((qp.quarter % 4) + 1)
    return t
