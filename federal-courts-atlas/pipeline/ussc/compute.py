"""Compute district x fiscal-year statistics from one USSC Individual Offender datafile.

All definitions follow the USSC's own published tables (Statistical Information Packets
and Sourcebook) for the fiscal year in question; see docs/lanes/ussc.md section 3 and
``ERA_NOTES`` below. Each function returns tidy component counts so that every
published percentage can be re-derived and audited (``components.parquet``).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .crosswalk import CODE_TO_ID

# Columns read from every year's datafile (those absent in a year are skipped).
COLUMNS = [
    "DISTRICT", "OFFTYPE2", "OFFTYPSB", "OFFGUIDE", "BOOKERCD", "BOOKER2", "SENTRNGE",
    "DEPART", "DEPART_A", "DEPART_S", "DEPART_D", "BOOKPOST", "BLAKPOST", "SENTIMP", "PRISDUM",
    "SENTTOT", "SENTTOT0", "SENSPLT", "SENSPLT0", "SENTTCAP", "SENSPCAP", "TOTPRISN", "DISPOSIT",
    "NOCOMP", "CIRCDIST",
]

FIRST_FY, LAST_FY = 2002, 2025


# ---------------------------------------------------------------- offense type ----------
def offense_scheme(fy: int) -> tuple[str, dict[str, list[int]]]:
    """(datafile variable, {category: codes}) for the primary-offense variable USSC used that year.

    OFFTYPE2: Sourcebook FY1999-FY2009 (statute of conviction with highest statutory maximum).
    OFFTYPSB: Sourcebook FY2010-FY2017 (same basis; child pornography split out, code 28).
    OFFGUIDE: Sourcebook FY2018+ (primary guideline applied; fraud/theft/embezzlement merged).
    """
    if fy <= 2009:
        return "OFFTYPE2", {"drug_trafficking": [10], "firearms": [13], "fraud": [18], "immigration": [27]}
    if fy <= 2017:
        return "OFFTYPSB", {"drug_trafficking": [10], "firearms": [13], "fraud": [18], "immigration": [27],
                            "child_pornography": [28]}
    return "OFFGUIDE", {"drug_trafficking": [10], "firearms": [13], "fraud_theft_embezzlement": [16],
                        "immigration": [17], "child_pornography": [7]}


OFFENSE_CATEGORIES = ["drug_trafficking", "immigration", "firearms", "fraud", "fraud_theft_embezzlement",
                      "child_pornography", "other"]


# ---------------------------------------------------------- guideline range ----------
# Category keys used in components.parquet, per scheme:
#   depart02 (FY2002, DEPART):       within, sa_5k1, other_downward, upward
#   depart03 (FY2003, DEPART_S/_D):  within, sa_5k1, govt_initiated, other_downward, upward
#   departA  (FY2004, FY2005 pre-Booker, DEPART_A): within, sa_5k1, govt_initiated (5K3.1 + other gov't),
#                                    other_downward, upward  (EDP is DEPART_A=3, kept as edp_5k3 too)
#   booker   (FY2005 post-Booker, FY2006-FY2017, BOOKERCD 0-11): 12 categories, see BOOKERCD_KEYS
#   sentrnge (FY2018+, SENTRNGE 0-8): 9 categories, see SENTRNGE_KEYS
BOOKERCD_KEYS = {0: "within", 1: "upward_departure", 2: "upward_departure_booker", 3: "above_booker",
                 4: "remaining_above", 5: "sa_5k1", 6: "edp_5k3", 7: "other_govt_below",
                 8: "downward_departure", 9: "downward_departure_booker", 10: "below_booker",
                 11: "remaining_below"}
SENTRNGE_KEYS = {0: "within", 1: "upward_departure", 2: "sa_5k1", 3: "edp_5k3", 4: "other_govt_departure",
                 5: "non_govt_departure", 6: "upward_variance", 7: "govt_variance", 8: "non_govt_variance"}


def range_categories(fy: int, df: pd.DataFrame) -> list[tuple[str, str, pd.Series]]:
    """[(period, scheme, category Series)] for a year; period is 'full' or a half-year label.

    The category Series holds a string key per case, NaN where USSC excludes the case
    (missing/indeterminable guideline information, or no applicable guideline).
    """
    out = []
    if fy == 2002:
        m = {0: "within", 1: "upward", 2: "other_downward", 3: "sa_5k1", 5: "sa_5k1", 7: "sa_5k1",
             9: "sa_5k1", 4: "other_downward", 6: "other_downward"}
        out.append(("full", "depart02", df["DEPART"].map(m)))
    elif fy == 2003:
        cat = pd.Series(np.nan, index=df.index, dtype=object)
        cat[df["DEPART_S"] == 0] = "within"
        cat[df["DEPART_S"] == 1] = "upward"
        cat[(df["DEPART_S"] == 2) & (df["DEPART_D"] == 0)] = "sa_5k1"
        cat[(df["DEPART_S"] == 2) & (df["DEPART_D"] == 1)] = "govt_initiated"
        cat[(df["DEPART_S"] == 2) & (df["DEPART_D"] == 2)] = "other_downward"
        out.append(("full", "depart03", cat))
    elif fy == 2004:
        cat = df["DEPART_A"].map({0: "within", 1: "upward", 2: "sa_5k1", 3: "edp_5k3", 4: "other_govt",
                                  5: "other_downward"})
        out.append(("pre_blakely", "departA", cat.where(df["BLAKPOST"] == 0)))
        out.append(("post_blakely", "departA", cat.where(df["BLAKPOST"] == 1)))
        out.append(("full", "departA", cat))
    elif fy == 2005:
        pre = df["DEPART_A"].map({0: "within", 1: "upward", 2: "sa_5k1", 3: "edp_5k3", 4: "other_govt",
                                  5: "other_downward"}).where(df["BOOKPOST"] == 0)
        post = df["BOOKERCD"].map(BOOKERCD_KEYS).where(df["BOOKPOST"] == 1)
        out.append(("pre_booker", "departA", pre))
        out.append(("post_booker", "booker", post))
        out.append(("full", "mixed2005", pre.fillna(post)))
    elif fy <= 2017:
        out.append(("full", "booker", df["BOOKERCD"].map(BOOKERCD_KEYS)))
    else:
        out.append(("full", "sentrnge", df["SENTRNGE"].map(SENTRNGE_KEYS)))
    return out


# Groupings of scheme categories into the published/emitted measures.
GROUPS = {
    "booker": {
        "within": ["within"],
        "above": ["upward_departure", "upward_departure_booker", "above_booker", "remaining_above"],
        "govt_below": ["sa_5k1", "edp_5k3", "other_govt_below"],
        "non_govt_below": ["downward_departure", "downward_departure_booker", "below_booker", "remaining_below"],
        "sa_5k1": ["sa_5k1"], "edp_5k3": ["edp_5k3"],
    },
    "sentrnge": {
        "within": ["within"], "sa_5k1": ["sa_5k1"], "edp_5k3": ["edp_5k3"],
        "above": ["upward_departure", "upward_variance"],
        "govt_below": ["sa_5k1", "edp_5k3", "other_govt_departure", "govt_variance"],
        "non_govt_below": ["non_govt_departure", "non_govt_variance"],
        "upward_departure": ["upward_departure"], "other_govt_departure": ["other_govt_departure"],
        "non_govt_departure": ["non_govt_departure"], "upward_variance": ["upward_variance"],
        "govt_variance": ["govt_variance"], "non_govt_variance": ["non_govt_variance"],
        "variance": ["upward_variance", "govt_variance", "non_govt_variance"],
        "downward_departure_other": ["other_govt_departure", "non_govt_departure"],
    },
    "depart02": {"within": ["within"], "sa_5k1": ["sa_5k1"]},
    "depart03": {"within": ["within"], "sa_5k1": ["sa_5k1"]},
    "departA": {"within": ["within"], "sa_5k1": ["sa_5k1"], "govt_initiated": ["edp_5k3", "other_govt"]},
    "mixed2005": {"within": ["within"], "sa_5k1": ["sa_5k1"]},
}


# ------------------------------------------------------------------- helpers ----------
def with_district(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["district_id"] = df["DISTRICT"].round().astype("Int64").map(CODE_TO_ID)
    return df


def _by(df: pd.DataFrame, mask: pd.Series | None = None) -> pd.core.groupby.SeriesGroupBy:
    d = df if mask is None else df[mask]
    return d.groupby("district_id")


def sentence_2018(fy: int, df: pd.DataFrame) -> pd.Series:
    """FY2018+ USSC 'sentence length' convention: months of imprisonment plus alternative
    confinement, probation-only (and fine-only) = 0, terms over 470 months = 469.99, life = 470.
    SENSPCAP from FY2018; for earlier years the identical rule applied to SENSPLT0.

    A missing SENSPLT0 stays missing (the case is left out of the mean, median and N, as a
    missing SENSPCAP is from FY2018). ``Series.mask`` is used deliberately: ``s.where(s <= 470,
    469.99)`` would also replace NaN (``NaN <= 470`` is False) and count every case with no
    sentence information as 469.99 months. With ``mask`` the rule reproduces SENSPCAP record for
    record, missing values included, in every year where both variables exist."""
    if fy >= 2018:
        return df["SENSPCAP"]
    s = df["SENSPLT0"]
    return s.mask(s > 470, 469.99)


def prison_term_pre2018(fy: int, df: pd.DataFrame, offense_known: pd.Series) -> pd.Series:
    """Pre-FY2018 USSC 'length of imprisonment' convention (packet Table 7, FY2002-FY2017):
    SENTTOT (months of imprisonment, alternatives excluded) for cases with a prison term > 0 and
    a known primary offense; terms over 470 months are NOT capped (life is coded 470)."""
    s = df["SENTTOT"]
    return s.where((s > 0) & offense_known)


def disposit_known(fy: int, df: pd.DataFrame) -> pd.Series:
    """Cases counted in packet Table 2 (guilty pleas and trials). FY2002-FY2004 count DISPOSIT
    codes 1-4; from FY2005 the packets also count code 5 (guilty plea and trial, >1 count) as a
    trial. Established by matching every district's Table 2 total. Used for validation only."""
    codes = [1, 2, 3, 4] if fy <= 2004 else [1, 2, 3, 4, 5]
    return df["DISPOSIT"].isin(codes)


def compute_components(fy: int, raw: pd.DataFrame) -> pd.DataFrame:
    """Long table of component counts and statistics per district (+ 'US') for one year.

    Columns: district_id, period, scheme, component, value.
    """
    df = with_district(raw)
    if df["district_id"].isna().any():
        bad = sorted(df.loc[df["district_id"].isna(), "DISTRICT"].unique().tolist())
        raise ValueError(f"FY{fy}: unmapped USSC DISTRICT codes {bad}")
    rows: list[dict] = []

    def emit(series: pd.Series, period: str, scheme: str, comp: str, national):
        for did, v in series.items():
            rows.append({"district_id": did, "period": period, "scheme": scheme, "component": comp,
                         "value": float(v)})
        rows.append({"district_id": "US", "period": period, "scheme": scheme, "component": comp,
                     "value": float(national)})

    ids = sorted(CODE_TO_ID.values())
    present = sorted(df["district_id"].unique())

    def counts(mask: pd.Series) -> tuple[pd.Series, int]:
        s = df[mask].groupby("district_id").size().reindex(present, fill_value=0)
        return s, int(mask.sum())

    # totals
    s, n = counts(pd.Series(True, index=df.index))
    emit(s, "full", "all", "cases_total", n)

    # periods within FY2004/FY2005 (for validation against split packet tables)
    halves = []
    if fy == 2004:
        halves = [("pre_blakely", df["BLAKPOST"] == 0), ("post_blakely", df["BLAKPOST"] == 1)]
    elif fy == 2005:
        halves = [("pre_booker", df["BOOKPOST"] == 0), ("post_booker", df["BOOKPOST"] == 1)]
    periods = [("full", pd.Series(True, index=df.index))] + halves
    for pname, pmask in periods:
        if pname != "full":
            s, n = counts(pmask)
            emit(s, pname, "all", "cases_total", n)
        s, n = counts(pmask & disposit_known(fy, df))
        emit(s, pname, "disposit", "plea_trial_total", n)

    # offense
    ovar, omap = offense_scheme(fy)
    known = df[ovar].notna()
    for pname, pmask in periods:
        s, n = counts(pmask & known)
        emit(s, pname, ovar, "offense_known", n)
        used = pd.Series(False, index=df.index)
        for cat, codes in omap.items():
            m = df[ovar].isin(codes)
            used |= m
            s, n = counts(pmask & m)
            emit(s, pname, ovar, f"offense_{cat}", n)
        s, n = counts(pmask & known & ~used)
        emit(s, pname, ovar, "offense_other", n)

    # sentence type (SENTIMP): 0 fine only, 1 prison only, 2 prison + alternatives/split,
    # 3 probation + alternatives/confinement, 4 probation only
    for pname, pmask in periods:
        for code, key in [(0, "fine_only"), (1, "prison_only"), (2, "prison_alt"), (3, "probation_alt"),
                          (4, "probation_only")]:
            s, n = counts(pmask & (df["SENTIMP"] == code))
            emit(s, pname, "SENTIMP", f"senttype_{key}", n)
            # pre-2010 packet Table 5 excludes cases with missing primary offense
            s, n = counts(pmask & (df["SENTIMP"] == code) & known)
            emit(s, pname, "SENTIMP", f"senttype_{key}_offknown", n)
        s, n = counts(pmask & df["SENTIMP"].notna())
        emit(s, pname, "SENTIMP", "senttype_known", n)

    # sentence length, both conventions
    s18 = sentence_2018(fy, df)
    spt = prison_term_pre2018(fy, df, known)
    for pname, pmask in periods:
        for conv, ser in [("sent2018", s18), ("prison_pre2018", spt)]:
            sub = df.loc[pmask & ser.notna(), ["district_id"]].assign(v=ser[pmask & ser.notna()])
            g = sub.groupby("district_id")["v"]
            emit(g.mean().reindex(present), pname, conv, "mean", sub["v"].mean())
            emit(g.median().reindex(present), pname, conv, "median", sub["v"].median())
            emit(g.size().reindex(present, fill_value=0), pname, conv, "n", len(sub))

    # guideline range
    for pname, scheme, cat in range_categories(fy, df):
        s, n = counts(cat.notna())
        emit(s, pname, scheme, "range_known", n)
        for key in sorted(cat.dropna().unique()):
            s, n = counts(cat == key)
            emit(s, pname, scheme, f"cat_{key}", n)
        for gname, keys in GROUPS.get(scheme, {}).items():
            s, n = counts(cat.isin(keys))
            emit(s, pname, scheme, f"grp_{gname}", n)

    out = pd.DataFrame(rows)
    out.insert(0, "fy", fy)
    # districts absent from a year's file (none observed FY2002-FY2025) are simply missing
    assert set(present) <= set(ids)
    out["value"] = out["value"].astype(float)
    return out


# ------------------------------------------------- FY2014-FY2017 supplemental files ----------
SUP_FIRST, SUP_LAST = 2014, 2017


def compute_supplemental_components(fy: int, ids: pd.DataFrame, sup: pd.DataFrame) -> pd.DataFrame:
    """SENTRNGE (FY2018 methodology) components for FY2014-FY2017.

    The USSC released supplemental files holding the FY2018-methodology variables (SENTRNGE,
    OFFGUIDE, SENSPCAP, ...) for FY2014-FY2017, keyed by USSCIDN, "to allow researchers ... to
    utilize these new variables on four prior years of data" (supplemental codebook). ``ids``
    holds USSCIDN and DISTRICT from the main datafile of the same year.
    """
    if ids["USSCIDN"].duplicated().any() or sup["USSCIDN"].duplicated().any():
        raise ValueError(f"FY{fy}: USSCIDN not unique")
    m = with_district(ids).merge(sup[["USSCIDN", "SENTRNGE"]], on="USSCIDN", how="left", validate="one_to_one")
    rows: list[dict] = []
    present = sorted(m["district_id"].unique())
    cat = m["SENTRNGE"].map(SENTRNGE_KEYS)

    def emit(mask, comp):
        s = m[mask].groupby("district_id").size().reindex(present, fill_value=0)
        for did, v in s.items():
            rows.append({"district_id": did, "period": "full", "scheme": "sentrnge_sup", "component": comp,
                         "value": float(v)})
        rows.append({"district_id": "US", "period": "full", "scheme": "sentrnge_sup", "component": comp,
                     "value": float(mask.sum())})

    emit(pd.Series(True, index=m.index), "join_records")
    emit(m["USSCIDN"].isin(sup["USSCIDN"]), "join_matched")
    emit(cat.notna(), "range_known")
    for key in SENTRNGE_KEYS.values():
        emit(cat == key, f"cat_{key}")
    for gname, keys in GROUPS["sentrnge"].items():
        emit(cat.isin(keys), f"grp_{gname}")
    out = pd.DataFrame(rows)
    out.insert(0, "fy", fy)
    return out
