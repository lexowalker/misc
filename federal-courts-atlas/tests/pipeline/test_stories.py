"""Stories lane: every number a story shows is recomputed here, independently, from data/processed.

The expected values below are written from scratch with pandas against the lane tables (this file does not
import the stories pipeline's helpers), then compared with public/data/stories/<slug>.json. A meta-test makes
sure no number in a story file escapes this check. Further tests check the chart series and map layers, the
prose templates in src/content/stories.ts (every placeholder exists, no stray digits), the source records,
determinism and the client's no-em-dash rule.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from functools import lru_cache
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed"
OUT = ROOT / "public" / "data" / "stories"
CONTENT = ROOT / "src" / "content" / "stories.ts"
EM_DASH = chr(0x2014)  # written this way so this file contains no em-dash
SLUGS = ["rocket-docket", "patent-capital", "border-districts", "after-booker", "where-trials-went"]
B = ["casd", "azd", "nmd", "txwd", "txsd"]
TX = ["txed", "txwd", "txnd", "txsd"]

# ----------------------------------------------------------------------------- independent readers


@lru_cache(maxsize=None)
def pq(rel: str) -> pd.DataFrame:
    return pd.read_parquet(PROC / rel)


@lru_cache(maxsize=None)
def csv(rel: str) -> pd.DataFrame:
    return pd.read_csv(PROC / rel)


def dist(rel: str, var: str) -> pd.DataFrame:
    df = pq(rel)
    return df[(df["variable"] == var) & (df["district_id"] != "_national")]


def W(rel: str, var: str, col: str = "value") -> pd.DataFrame:
    """period x district matrix."""
    return dist(rel, var).pivot(index="period", columns="district_id", values=col)


def nat_fcms(var: str, current: bool = False) -> pd.Series:
    df = csv("fcms/national_current_method.csv" if current else "fcms/national.csv")
    return df[df["variable"] == var].set_index("period")["value"]


def nat_idb(var: str, col: str = "value") -> pd.Series:
    df = pq("idb/national.parquet")
    return df[df["variable"] == var].set_index("period")[col]


def nat_ussc(var: str, col: str = "value") -> pd.Series:
    df = csv("ussc/national.csv")
    return df[df["variable"] == var].set_index("period")[col]


FCMS = "fcms/observations.parquet"
FCMS_CM = "fcms/observations_current_method.parquet"
FCMS_R = "fcms/observations_ranks.parquet"
IDB = "idb/observations.parquet"
USSC = "ussc/observations.parquet"

NAMES = {}


def name(did: str) -> str:
    """The registry's full name, read from the registry module the whole pipeline shares."""
    if not NAMES:
        from pipeline.common.districts import BY_ID

        NAMES.update({k: v.name for k, v in BY_ID.items()})
    return NAMES[did]


# ----------------------------------------------------------------------------- expected values


def expected_rocket() -> dict:
    e = {}
    t = W(FCMS, "fcms_median_months_civil_filing_to_trial")
    tn = nat_fcms("fcms_median_months_civil_filing_to_trial")
    rk = W(FCMS_R, "fcms_rank_us_median_months_civil_filing_to_trial")
    v = t["vaed"].dropna()
    e["fy_first"], e["fy_latest"] = int(tn.index.min()), int(tn.index.max())
    L = e["fy_latest"]
    e["vaed_trial_latest"], e["us_trial_latest"] = v[L], tn[L]
    e["n_trial_latest"] = int(t.loc[L].notna().sum())
    e["rank_latest"] = rk.loc[L, "vaed"]
    e["ratio_latest"] = v[L] / tn[L]
    yrs = [y for y in tn.index if y in v.index]
    e["n_below_half"] = sum(v[y] / tn[y] < 0.5 for y in yrs)
    e["n_years_trial"] = len(yrs)
    e["vaed_trial_min"], e["vaed_trial_min_year"] = v.min(), int(v.idxmin())
    e["vaed_trial_max"], e["vaed_trial_max_year"] = v.max(), int(v.idxmax())
    r = rk["vaed"].dropna()
    firsts = [int(y) for y in r.index if r[y] == 1]
    e["fy_rank_first"] = int(r.index.min())
    e["n_first"], e["n_rank_years"] = len(firsts), len(r)
    # Runs of consecutive first places (the two longest, in time order).
    runs, cur = [], [firsts[0], firsts[0]]
    for y in firsts[1:]:
        if y == cur[1] + 1:
            cur[1] = y
        else:
            runs.append(cur)
            cur = [y, y]
    runs.append(cur)
    runs = sorted(sorted([r_ for r_ in runs if r_[1] > r_[0]], key=lambda r_: r_[0] - r_[1])[:2])
    for i, (a, z) in enumerate(runs, 1):
        e[f"run{i}_start"], e[f"run{i}_end"] = a, z
    leader = {int(y): rk.loc[y][rk.loc[y] == 1].index[0] for y in rk.index}
    groups = []
    for y in sorted(leader):
        if leader[y] == "vaed":
            continue
        if groups and groups[-1][0] == leader[y] and groups[-1][2] == y - 1:
            groups[-1][2] = y
        else:
            groups.append([leader[y], y, y])
    for i, (d, a, z) in enumerate(groups, 1):
        e[f"other{i}"] = d
        e[f"other{i}_start"] = a
        if z > a:
            e[f"other{i}_end"] = z
        e[f"other{i}_vaed_rank"] = rk.loc[a, "vaed"]
    e["fy_worst"] = int(r.idxmax())
    e["rank_worst"] = r.max()
    e["vaed_trial_worst"] = v[e["fy_worst"]]
    for y in (2019, 2020):
        e[f"n_trial_{y}"] = int(t.loc[y].notna().sum())
    d = W(FCMS, "fcms_median_months_civil_filing_to_disposition")["vaed"]
    dn = nat_fcms("fcms_median_months_civil_filing_to_disposition")
    e["n_disp_below"] = sum(d[y] < dn[y] for y in dn.index)
    e["n_disp_years"] = len(dn)
    e["vaed_disp_latest"], e["us_disp_latest"] = d[L], dn[L]
    rd = W(FCMS_R, "fcms_rank_us_median_months_civil_filing_to_disposition")["vaed"].dropna()
    e["n_disp_top5"], e["n_disp_rank_years"] = int((rd <= 5).sum()), len(rd)
    c = W(FCMS_CM, "fcms_median_months_criminal_felony_filing_to_disposition")
    cn = nat_fcms("fcms_median_months_criminal_felony_filing_to_disposition", current=True)
    e["fy_crim_first"] = int(cn.index.min())
    e["n_crim_below"] = sum(c.loc[y, "vaed"] < cn[y] for y in cn.index)
    e["n_crim_years"] = len(cn)
    rc = W(FCMS_R, "fcms_rank_us_median_months_criminal_felony_filing_to_disposition")
    rcv = rc.loc[cn.index, "vaed"]
    e["crim_rank_best"], e["crim_rank_worst"] = rcv.min(), rcv.max()
    e["vaed_crim_latest"], e["us_crim_latest"] = c.loc[L, "vaed"], cn[L]
    top = rc.loc[L][rc.loc[L] == 1].index[0]
    e["fastest_crim_latest"], e["fastest_crim_value"] = top, c.loc[L, top]
    tr = W(FCMS, "fcms_trials_completed_per_judgeship")["vaed"]
    trn = nat_fcms("fcms_trials_completed_per_judgeship")
    e["n_trials_more"] = sum(tr[y] > trn[y] for y in trn.index)
    e["n_trials_years"] = len(trn)
    eq = [int(y) for y in trn.index if tr[y] == trn[y]]
    assert len(eq) == 1
    e["fy_trials_equal"] = eq[0]
    first = int(trn.index.min())
    e["vaed_trials_latest"], e["us_trials_latest"] = tr[L], trn[L]
    e["vaed_trials_first"], e["us_trials_first"] = tr[first], trn[first]
    return e


def quarters() -> pd.DataFrame:
    return csv("idb/patent_quarterly.csv")


def expected_patent() -> dict:
    e = {}
    p = W(IDB, "idb_patent_filed")
    pn = nat_idb("idb_patent_filed")
    sh = W(IDB, "idb_patent_share_of_national")
    e["fy_first"], e["fy_prelim"] = int(pn.index.min()), int(pn.index.max())
    full = pn[pn.index < e["fy_prelim"]]
    e["us_first"] = pn[e["fy_first"]]
    e["us_peak"], e["us_peak_year"] = full.max(), int(full.idxmax())
    e["us_2025"], e["us_2015"] = pn[2025], pn[2015]
    e["txed_2015"], e["txed_share_2015"] = p.loc[2015, "txed"], sh.loc[2015, "txed"]
    lead = p.idxmax(axis=1)
    assert (p.eq(p.max(axis=1), axis=0).sum(axis=1) == 1).all()
    tx_years = [int(y) for y in lead.index if lead[y] == "txed"]
    e["txed_lead_first"] = tx_years[0]
    # E.D. Tex.'s first era: through FY 2017, the last E.D. Tex. year before two other leaders in a row.
    y = tx_years[0]
    last = y
    while y + 1 in lead.index:
        if lead[y + 1] == "txed":
            last = y + 1
        elif lead.get(y + 2) != "txed":
            break
        y += 1
    e["txed_lead_last"] = last
    exc = [yy for yy in range(tx_years[0], last + 1) if lead[yy] != "txed"]
    e["txed_lead_exceptions"] = len(exc)
    for i, yy in enumerate(exc, 1):
        e[f"lead_exc{i}"], e[f"lead_exc{i}_district"] = yy, lead[yy]
    q = quarters()
    before = q[q["quarter"].isin(["2016Q2", "2016Q3", "2016Q4", "2017Q1"])].groupby("district_id")["nos830_835"].sum()
    after = q[q["quarter"].isin(["2017Q3", "2017Q4", "2018Q1", "2018Q2"])].groupby("district_id")["nos830_835"].sum()
    e["us_before"], e["us_after"] = before["_national"], after["_national"]
    for d in ("txed", "ded", "cacd", "cand", "njd"):
        e[f"{d}_before"], e[f"{d}_after"] = before[d], after[d]
        e[f"{d}_before_share"] = 100 * before[d] / before["_national"]
        e[f"{d}_after_share"] = 100 * after[d] / after["_national"]
    for yy in (2017, 2021):
        e[f"txwd_{yy}"], e[f"txwd_share_{yy}"] = p.loc[yy, "txwd"], sh.loc[yy, "txwd"]
    wd = [int(yy) for yy in lead.index if lead[yy] == "txwd"]
    e["txwd_lead_first"], e["txwd_lead_last"] = wd[0], wd[-1]
    post = p.loc[(p.index >= 2018) & (p.index < e["fy_prelim"]), "txed"]
    e["txed_low"], e["txed_low_year"] = post.min(), int(post.idxmin())
    e["txed_2025"], e["txed_share_2025"] = p.loc[2025, "txed"], sh.loc[2025, "txed"]
    e["txed_back_first"] = min(int(yy) for yy in lead.index if yy > wd[-1] and lead[yy] == "txed")
    txs = p[TX].sum(axis=1)
    share = 100 * txs / pn
    e["tx_2025"], e["tx_share_2025"], e["tx_share_2015"] = txs[2025], share[2025], share[2015]
    e["tx_pre_cut"] = 2005
    e["tx_share_max_pre2005"] = share[share.index < 2005].max()
    return e


def expected_border() -> dict:
    e = {}
    m = pq("idb/criminal_offense_mix.parquet")
    imm = m[m["offense_category"] == "immigration"].pivot(index="period", columns="district_id", values="count_felony")
    felmix = m.pivot_table(index="period", columns="district_id", values="count_felony", aggfunc="sum")
    L, P = 2025, int(imm.index.max())
    e["fy_latest"], e["fy_prelim"], e["fy_first"] = L, P, int(imm.index.min())
    e["n_border"] = 5
    s5 = imm[B].sum(axis=1)
    shr = 100 * s5 / imm["_national"]
    e["imm5_latest"], e["imm_us_latest"], e["imm5_share_latest"] = s5[L], imm.loc[L, "_national"], shr[L]
    e["imm5_share_first"] = shr[e["fy_first"]]
    full = shr[shr.index < P]
    e["imm5_share_peak"], e["imm5_share_peak_year"] = full.max(), int(full.idxmax())
    f = W(IDB, "idb_crim_felony_defendants_filed")
    fn = nat_idb("idb_crim_felony_defendants_filed")
    for yy in (1996, L):
        e[f"fel5_{yy}"] = f.loc[yy, B].sum()
        e[f"fel_us_{yy}"] = fn[yy]
        e[f"fel5_share_{yy}"] = 100 * f.loc[yy, B].sum() / fn[yy]
    for d in B:
        e[f"{d}_imm_pct"] = 100 * imm.loc[L, d] / felmix.loc[L, d]
    e["us_imm_pct"] = 100 * imm.loc[L, "_national"] / felmix.loc[L, "_national"]
    pct = {d: e[f"{d}_imm_pct"] for d in B}
    lo, hi = min(pct, key=pct.get), max(pct, key=pct.get)
    e["imm_pct_lo"], e["imm_pct_hi"], e["imm_pct_lo_value"], e["imm_pct_hi_value"] = lo, hi, pct[lo], pct[hi]
    rk = W(FCMS_R, "fcms_rank_us_filings_per_judgeship_criminal_felony")
    sets = {int(yy): set(rk.loc[yy][rk.loc[yy] <= 5].index) for yy in rk.index}
    e["n_top5"] = sum(v == set(B) for v in sets.values())
    e["n_top5_years"], e["top5_first"] = len(sets), min(sets)
    for i, yy in enumerate(sorted(y_ for y_, v in sets.items() if v != set(B)), 1):
        e[f"top5_exc{i}"] = yy
    fp = W(FCMS_CM, "fcms_filings_per_judgeship_criminal_felony")
    top = fp.loc[L, B].idxmax()
    e["fpj_top"], e["fpj_top_value"] = top, fp.loc[L, top]
    e["us_fpj_latest"] = nat_fcms("fcms_filings_per_judgeship_criminal_felony", current=True)[L]
    c = W(FCMS_CM, "fcms_median_months_criminal_felony_filing_to_disposition")
    cn = nat_fcms("fcms_median_months_criminal_felony_filing_to_disposition", current=True)
    e["n_disp_below"] = int(sum((c.loc[yy, d] < cn[yy]) for yy in cn.index for d in B))
    e["n_disp_cells"] = 5 * len(cn)
    e["disp_first"], e["n_disp_years"] = int(cn.index.min()), len(cn)
    rc = W(FCMS_R, "fcms_rank_us_median_months_criminal_felony_filing_to_disposition")
    e["n_nmd_first"] = int((rc.loc[cn.index, "nmd"] == 1).sum())
    e["nmd_disp_latest"], e["us_disp_latest"] = c.loc[L, "nmd"], cn[L]
    g = dist(IDB, "idb_crim_pct_guilty_plea")
    t = dist(IDB, "idb_crim_trial_rate")
    g25 = g[g["period"] == L].set_index("district_id")
    t25 = t[t["period"] == L].set_index("district_id")
    big = g25[g25["denominator"] >= 500].index
    e["plea_base"], e["n_big"] = 500, len(big)
    order = t25.loc[big, "value"].sort_values()
    assert set(order.index[:5]) == set(B)
    e["trial_lo"], e["trial_hi5"] = order.index[0], order.index[4]
    e["trial_lo_value"], e["trial_hi5_value"] = order.iloc[0], order.iloc[4]
    plea_order = list(g25.loc[big, "value"].sort_values(ascending=False).index)
    k = 0
    while plea_order[k] in B:
        k += 1
    e["n_top_plea"] = k
    for d in B:
        e[f"{d}_trial"], e[f"{d}_plea"] = t25.loc[d, "value"], g25.loc[d, "value"]
    e["us_trial"] = nat_idb("idb_crim_trial_rate")[L]
    e["us_plea"] = nat_idb("idb_crim_pct_guilty_plea")[L]
    kn = W(USSC, "ussc_pct_early_disposition_5k3", "numerator")
    knn = nat_ussc("ussc_pct_early_disposition_5k3", "numerator")
    ks = 100 * kn[B].sum(axis=1) / knn
    e["k3_5_share_latest"], e["k3_5_latest"], e["k3_us_latest"] = ks[L], kn.loc[L, B].sum(), knn[L]
    e["k3_5_min"], e["k3_first"] = ks.min(), int(knn.index.min())
    kv = W(USSC, "ussc_pct_early_disposition_5k3")
    for d in B:
        e[f"{d}_k3"] = kv.loc[L, d]
    e["us_k3"] = nat_ussc("ussc_pct_early_disposition_5k3")[L]
    e["txwd_k3_max"] = kv["txwd"].max()
    ct = W(USSC, "ussc_cases_total")
    ctn = nat_ussc("ussc_cases_total")
    for yy in (2002, L):
        e[f"sent5_share_{yy}"] = 100 * ct.loc[yy, B].sum() / ctn[yy]
    e["sent_first"] = 2002
    return e


def expected_booker() -> dict:
    e = {}
    wn = nat_ussc("ussc_pct_within_range")
    L = 2025
    e["fy_first"], e["fy_latest"], e["pre_last"], e["post_first"] = int(wn.index.min()), L, 2004, 2006
    pre = wn.loc[1995:2004]
    e["pre_min"], e["pre_max"] = pre.min(), pre.max()
    post = wn.loc[2006:]
    e["post_max"], e["post_max_year"] = post.max(), int(post.idxmax())
    e["post_min"], e["post_min_year"] = post.min(), int(post.idxmin())
    e["within_latest"], e["within_first"] = wn[L], wn[1995]
    k = nat_ussc("ussc_pct_substantial_assistance_5k1")
    e["k1_1995"], e["k1_2025"] = k[1995], k[2025]
    for old, key in (("ussc_pct_above_range", "above"), ("ussc_pct_govt_sponsored_below_range", "govt"),
                     ("ussc_pct_non_govt_sponsored_below_range", "nongovt")):
        e[f"{key}_2006"] = nat_ussc(old)[2006]
        e[f"{key}_2025"] = nat_ussc(old + "_2018scheme")[2025]
    ng = pd.concat([nat_ussc("ussc_pct_non_govt_sponsored_below_range").loc[:2017],
                    nat_ussc("ussc_pct_non_govt_sponsored_below_range_2018scheme").loc[2018:]])
    e["nongovt_peak"], e["nongovt_peak_year"] = ng.max(), int(ng.idxmax())
    w = W(USSC, "ussc_pct_within_range")
    for yy in (2004, 2023, 2025):
        e[f"n_major_{yy}"] = int((w.loc[yy] > 50).sum())
    e["n_districts"] = int(w.loc[L].notna().sum())
    e["eighty"] = 80
    e["n_80_2004"] = int((w.loc[2004] >= 80).sum())
    zero = [int(yy) for yy in w.index if (w.loc[yy] >= 80).sum() == 0]
    since = L
    while since - 1 in zero:
        since -= 1
    e["zero80_since"] = since
    for yy in (2004, L):
        row = w.loc[yy].dropna()
        e[f"iqr_{yy}"] = row.quantile(0.75) - row.quantile(0.25)
        e[f"median_{yy}"] = row.median()
    nb = dist(USSC, "ussc_pct_non_govt_sponsored_below_range_2018scheme")
    big = nb[(nb["period"] == L) & (nb["n_basis"] >= 200)].set_index("district_id")["value"]
    e["min_base"], e["n_big"] = 200, len(big)
    e["ng_lo"], e["ng_lo_value"] = big.idxmin(), big.min()
    e["ng_hi"], e["ng_hi_value"] = big.idxmax(), big.max()
    e["ng_median_big"] = big.median()
    return e


def expected_trials() -> dict:
    e = {}
    num = nat_idb("idb_civil_trial_rate", "numerator")
    den = nat_idb("idb_civil_trial_rate", "denominator")
    rate = nat_idb("idb_civil_trial_rate")
    L = 2025
    e["fy_first"], e["fy_latest"], e["fy_prelim"] = int(num.index.min()), L, int(num.index.max())
    F = e["fy_first"]
    e["civ_first"], e["civ_latest"] = num[F], num[L]
    e["civ_drop"] = 100 * (num[F] - num[L]) / num[F]
    c = dist(IDB, "idb_civil_trial_rate").set_index(["district_id", "period"])
    e["civ_spike"] = num[2007]
    e["spike_trials"], e["spike_terms"] = c.loc[("lamd", 2007), "numerator"], c.loc[("lamd", 2007), "denominator"]
    e["civ_spike_ex"] = num[2007] - e["spike_trials"]
    e["rate_first"], e["rate_latest"] = rate[F], rate[L]
    fl = c.loc["flnd"]
    e["rate_ex_latest"] = 100 * (num[L] - fl.loc[L, "numerator"]) / (den[L] - fl.loc[L, "denominator"])
    for yy in (2024, L):
        e[f"mass_terms_{yy}"] = fl.loc[yy, "denominator"]
        e[f"mass_share_{yy}"] = 100 * fl.loc[yy, "denominator"] / den[yy]
    tr = nat_idb("idb_crim_trial_rate")
    trn = nat_idb("idb_crim_trial_rate", "numerator")
    trd = nat_idb("idb_crim_trial_rate", "denominator")
    pl = nat_idb("idb_crim_pct_guilty_plea")
    e["fy_crim_first"] = cf = int(tr.index.min())
    for yy in (cf, L):
        e[f"crim_rate_{yy}"], e[f"crim_trials_{yy}"], e[f"crim_terms_{yy}"], e[f"plea_{yy}"] = tr[yy], trn[yy], trd[yy], pl[yy]
    e["crim_drop"] = 100 * (trn[cf] - trn[L]) / trn[cf]
    dw = W(IDB, "idb_crim_trial_rate")
    e["high_rate"] = 10
    for yy in (cf, L):
        e[f"n_high_{yy}"] = int((dw.loc[yy] >= 10).sum())
        e[f"median_{yy}"] = dw.loc[yy].dropna().median()
    d = dist(IDB, "idb_crim_trial_rate")
    big = d[(d["period"] == L) & (d["denominator"] >= 500)].set_index("district_id")["value"]
    e["base"], e["n_big"] = 500, len(big)
    e["big_lo"], e["big_lo_value"], e["big_hi"], e["big_hi_value"] = big.idxmin(), big.min(), big.idxmax(), big.max()
    dis = W(IDB, "idb_crim_pct_dismissed")
    e["hi_dismissed_2024"], e["hi_dismissed_2025"] = dis.loc[2024, big.idxmax()], dis.loc[2025, big.idxmax()]
    tp = nat_fcms("fcms_trials_completed_per_judgeship")
    e["fy_tpj_first"] = int(tp.index.min())
    e["tpj_first"], e["tpj_latest"] = tp[e["fy_tpj_first"]], tp[L]
    e["tpj_low"], e["tpj_low_year"] = tp.min(), int(tp.idxmin())
    return e


EXPECTED = {
    "rocket-docket": expected_rocket,
    "patent-capital": expected_patent,
    "border-districts": expected_border,
    "after-booker": expected_booker,
    "where-trials-went": expected_trials,
}


@lru_cache(maxsize=None)
def story(slug: str) -> dict:
    return json.loads((OUT / f"{slug}.json").read_text())


@lru_cache(maxsize=None)
def expected(slug: str) -> dict:
    return EXPECTED[slug]()


def close(a, b) -> bool:
    if isinstance(a, str) or isinstance(b, str):
        return a == b
    return math.isclose(float(a), float(b), rel_tol=1e-9, abs_tol=1e-9)


# ----------------------------------------------------------------------------- formatting (re-implemented)


def round_half_up(v: float, d: int) -> str:
    """Half away from zero, as the published tables round. Inputs are decimals that went through float
    arithmetic (e.g. 82.425 - 65.875 = 16.549999999999997), so values within 1e-9 of a half count as halves."""
    from decimal import ROUND_HALF_UP, Decimal

    q = Decimal(1).scaleb(-d)
    r = Decimal(repr(float(v) + (1e-9 if v >= 0 else -1e-9))).quantize(q, rounding=ROUND_HALF_UP)
    return f"{r:,.{d}f}"


def expected_text(n: dict) -> str:
    u, v, d = n["unit"], n["value"], n["decimals"]
    if u == "fy":
        return f"FY {v}"
    if u == "rank":
        suf = "th" if 10 <= v % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(v % 10, "th")
        return f"{v}{suf}"
    if u == "district":
        return f"the {name(v)}" if n["text"].startswith("the ") else n["text"]
    if u == "quarter":
        return n["text"]
    if u == "months":
        return f"{round_half_up(v, 1 if d is None else d)} months"
    if u == "percent":
        return f"{round_half_up(v, 1 if d is None else d)}%"
    if u == "points":
        return f"{round_half_up(v, 1 if d is None else d)} percentage points"
    if u == "ratio":
        return round_half_up(v, 2 if d is None else d)
    return round_half_up(v, 0 if d is None else d)


# ----------------------------------------------------------------------------- tests


@pytest.mark.parametrize("slug", SLUGS)
def test_every_number_recomputed_from_processed_tables(slug):
    got = story(slug)["numbers"]
    exp = expected(slug)
    assert set(got) == set(exp), f"unchecked: {sorted(set(got) - set(exp))}; missing: {sorted(set(exp) - set(got))}"
    bad = [(k, got[k]["value"], exp[k]) for k in sorted(got) if not close(got[k]["value"], exp[k])]
    assert not bad, bad


@pytest.mark.parametrize("slug", SLUGS)
def test_display_text_matches_value(slug):
    for key, n in story(slug)["numbers"].items():
        assert n["text"] == expected_text(n), (key, n["text"], expected_text(n))
        assert n["source_ids"], key
        assert n["how"] and EM_DASH not in n["how"], key
        if n["derived"]:
            assert n.get("formula"), f"derived number {key} has no formula"
        if n["unit"] == "district":
            from pipeline.common.districts import BY_ID

            assert n["value"] in BY_ID


@pytest.mark.parametrize("slug", SLUGS)
def test_sources_are_registered_and_cited(slug):
    from pipeline.stories.common import all_sources

    reg = all_sources()
    doc = story(slug)
    ids = set()
    for n in doc["numbers"].values():
        ids.update(n["source_ids"])
    for c in doc["charts"].values():
        ids.update(c["source_ids"])
    for lay in doc["layers"].values():
        ids.update(lay["source_ids"])
    assert ids == set(doc["sources"]), "sources block lists exactly the ids used"
    for i in ids:
        assert i in reg, i
        assert doc["sources"][i]["url"], i
    assert "local_path" not in json.dumps(doc["sources"])


def _series(chart: dict, sid: str) -> list:
    return next(s for s in chart["series"] if s["id"] == sid)["values"]


def _aligned(s: pd.Series, xs) -> list:
    return [None if (x not in s.index or pd.isna(s[x])) else float(s[x]) for x in xs]


def _eq_list(a, b):
    assert len(a) == len(b)
    for x, y in zip(a, b):
        if x is None or y is None:
            assert x is None and y is None, (a, b)
        else:
            assert close(x, y), (x, y)


def test_chart_series_rocket_docket():
    ch = story("rocket-docket")["charts"]
    t = W(FCMS, "fcms_median_months_civil_filing_to_trial")
    x = ch["trial_line"]["x"]
    _eq_list(_series(ch["trial_line"], "vaed"), _aligned(t["vaed"], x))
    _eq_list(_series(ch["trial_line"], "_national"), _aligned(nat_fcms("fcms_median_months_civil_filing_to_trial"), x))
    _eq_list(ch["trial_line"]["band"]["lo"], [float(t.loc[y].min()) for y in x])
    _eq_list(ch["trial_line"]["band"]["hi"], [float(t.loc[y].max()) for y in x])
    rk = W(FCMS_R, "fcms_rank_us_median_months_civil_filing_to_trial")
    assert ch["trial_rank"]["ranks"] == [int(rk.loc[y, "vaed"]) for y in ch["trial_rank"]["x"]]
    assert ch["trial_rank"]["of"] == [int(rk.loc[y].notna().sum()) for y in ch["trial_rank"]["x"]]
    d = W(FCMS, "fcms_median_months_civil_filing_to_disposition")
    _eq_list(_series(ch["disp_line"], "vaed"), _aligned(d["vaed"], ch["disp_line"]["x"]))
    c = W(FCMS_CM, "fcms_median_months_criminal_felony_filing_to_disposition")
    _eq_list(_series(ch["crim_line"], "vaed"), _aligned(c["vaed"], ch["crim_line"]["x"]))
    _eq_list(_series(ch["crim_line"], "_national"), _aligned(nat_fcms("fcms_median_months_criminal_felony_filing_to_disposition", True), ch["crim_line"]["x"]))
    tr = W(FCMS, "fcms_trials_completed_per_judgeship")
    _eq_list(_series(ch["trials_line"], "vaed"), _aligned(tr["vaed"], ch["trials_line"]["x"]))


def test_chart_series_patent_capital():
    ch = story("patent-capital")["charts"]
    p = W(IDB, "idb_patent_filed")
    pn = nat_idb("idb_patent_filed")
    _eq_list(_series(ch["national_line"], "_national"), _aligned(pn, ch["national_line"]["x"]))
    x = ch["annual_lines"]["x"]
    for d in ("txed", "ded", "txwd"):
        _eq_list(_series(ch["annual_lines"], d), _aligned(p[d], x))
    _eq_list(_series(ch["annual_lines"], "_other"), _aligned(pn - p[["txed", "ded", "txwd"]].sum(axis=1), x))
    q = quarters().pivot(index="quarter", columns="district_id", values="nos830_835")
    qx = ch["quarterly"]["x"]
    for d in ("txed", "ded", "txwd"):
        _eq_list(_series(ch["quarterly"], d), _aligned(q[d], qx))
    share = 100 * p[TX].sum(axis=1) / pn
    _eq_list(_series(ch["texas_share"], "_texas"), [round(float(share[y]), 6) for y in ch["texas_share"]["x"]])
    exp = expected("patent-capital")
    for it in ch["window_slope"]["items"]:
        if it["id"] != "_other":
            assert close(it["before"], round(exp[f"{it['id']}_before_share"], 6))
            assert close(it["after"], round(exp[f"{it['id']}_after_share"], 6))
    lead = p.idxmax(axis=1)
    assert ch["leaders"]["leaders"] == [lead[y] for y in ch["leaders"]["x"]]


def test_chart_series_border_districts():
    ch = story("border-districts")["charts"]
    e = expected("border-districts")
    bars = {i["id"]: i["value"] for i in ch["imm_bars"]["items"]}
    for d in B:
        assert close(bars[d], round(e[f"{d}_imm_pct"], 6))
    fp = W(FCMS_CM, "fcms_filings_per_judgeship_criminal_felony")
    items = ch["fpj_bars"]["items"]
    assert len(items) == int(fp.loc[2025].notna().sum())
    for it in items:
        assert close(it["value"], fp.loc[2025, it["id"]])
        assert (it["role"] == "focus") == (it["id"] in B)
    assert [i["value"] for i in items] == sorted((i["value"] for i in items), reverse=True)
    kv = W(USSC, "ussc_pct_early_disposition_5k3")
    for panel in ch["k3_multiples"]["panels"]:
        _eq_list(panel["values"], _aligned(kv[panel["id"]], ch["k3_multiples"]["x"]))
    c = W(FCMS_CM, "fcms_median_months_criminal_felony_filing_to_disposition")
    for d in B:
        _eq_list(_series(ch["disp_lines"], d), _aligned(c[d], ch["disp_lines"]["x"]))
    dots = {i["id"]: i for i in ch["plea_dots"]["items"]}
    assert len(dots) == e["n_big"]
    for d in B:
        assert close(dots[d]["x"], round(e[f"{d}_trial"], 6)) and close(dots[d]["y"], round(e[f"{d}_plea"], 6))


def test_chart_series_after_booker():
    ch = story("after-booker")["charts"]
    wn = nat_ussc("ussc_pct_within_range")
    _eq_list(_series(ch["within_line"], "_within"), _aligned(wn, ch["within_line"]["x"]))
    stack = {l_["id"]: l_["values"] for l_ in ch["split_stack"]["layers"]}
    xs = ch["split_stack"]["x"]
    for old in ("ussc_pct_above_range", "ussc_pct_govt_sponsored_below_range", "ussc_pct_non_govt_sponsored_below_range"):
        s = pd.concat([nat_ussc(old).loc[:2017], nat_ussc(old + "_2018scheme").loc[2018:]])
        _eq_list(stack[old], _aligned(s, xs))
    # The four groups add up to 100 (published rounding allows a small difference).
    for i in range(len(xs)):
        tot = sum(v[i] for v in stack.values())
        assert abs(tot - 100) <= 0.31, (xs[i], tot)
    w = W(USSC, "ussc_pct_within_range")
    rb = ch["ribbon"]
    _eq_list(_series(rb, "_median"), [round(float(w.loc[y].median()), 6) for y in rb["x"]])
    _eq_list(rb["band"]["lo"], [round(float(w.loc[y].quantile(0.25)), 6) for y in rb["x"]])
    _eq_list(rb["band2"]["hi"], [float(w.loc[y].max()) for y in rb["x"]])


def test_chart_series_where_trials_went():
    ch = story("where-trials-went")["charts"]
    num = nat_idb("idb_civil_trial_rate", "numerator")
    _eq_list(_series(ch["civil_count"], "_national"), _aligned(num, ch["civil_count"]["x"]))
    _eq_list(_series(ch["crim_rate"], "_national"), [round(float(v), 6) for v in _aligned(nat_idb("idb_crim_trial_rate"), ch["crim_rate"]["x"])])
    _eq_list(_series(ch["tpj_line"], "_national"), _aligned(nat_fcms("fcms_trials_completed_per_judgeship"), ch["tpj_line"]["x"]))
    e = expected("where-trials-went")
    ex = _series(ch["civil_rate"], "_ex")
    assert close(ex[ch["civil_rate"]["x"].index(2025)], round(e["rate_ex_latest"], 6))


@pytest.mark.parametrize("slug", SLUGS)
def test_map_layers_match_tables(slug):
    sources = {
        ("rocket-docket", "civil_trial"): (FCMS, "fcms_median_months_civil_filing_to_trial"),
        ("patent-capital", "patent_share"): (IDB, "idb_patent_share_of_national"),
        ("patent-capital", "patent_filings"): (IDB, "idb_patent_filed"),
        ("after-booker", "within"): (USSC, "ussc_pct_within_range"),
        ("after-booker", "nongovt"): (USSC, "ussc_pct_non_govt_sponsored_below_range_2018scheme"),
        ("where-trials-went", "crim_trial"): (IDB, "idb_crim_trial_rate"),
    }
    for key, lay in story(slug)["layers"].items():
        if (slug, key) == ("border-districts", "imm_share"):
            m = pq("idb/criminal_offense_mix.parquet")
            imm = m[m["offense_category"] == "immigration"].pivot(index="period", columns="district_id", values="count_felony")
            fel = m.pivot_table(index="period", columns="district_id", values="count_felony", aggfunc="sum")
            exp = (100 * imm / fel).drop(columns="_national")
            n = 0
            for d, ys in lay["values"].items():
                for y, v in ys.items():
                    assert close(v, exp.loc[int(y), d]), (d, y)
                    n += 1
            assert n == int(((fel.drop(columns="_national") > 0)).sum().sum())
            continue
        rel, var = sources[(slug, key)]
        w = W(rel, var)
        n = 0
        for d, ys in lay["values"].items():
            for y, v in ys.items():
                assert close(v, w.loc[int(y), d]), (key, d, y)
                n += 1
        yrs = [int(y) for y in lay["years"]]
        assert n == int(w.loc[yrs].notna().sum().sum()), f"{key}: every published cell, no filled cells"


# ----------------------------------------------------------------------------- prose templates


def content_blocks() -> dict[str, str]:
    text = CONTENT.read_text()
    starts = [(m.start(), m.group(1)) for m in re.finditer(r"\n  \{\n    slug: '([a-z-]+)'", text)]
    out = {}
    for i, (pos, slug) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else text.index("\n];", pos)
        out[slug] = text[pos:end]
    return out


PH = re.compile(r"\{([a-z0-9_]+):?([a-zA-Z0-9_-]*)\}")


def test_content_lists_every_story():
    assert sorted(content_blocks()) == sorted(SLUGS)
    idx = json.loads((OUT / "index.json").read_text())
    assert idx["order"] == SLUGS


@pytest.mark.parametrize("slug", SLUGS)
def test_every_placeholder_resolves(slug):
    block = content_blocks()[slug]
    nums = story(slug)["numbers"]
    seen = set()
    for m in PH.finditer(block):
        key, mod = m.group(1), m.group(2)
        if key in ("ev", "evy"):
            assert mod in ("booker", "tc-heartland", "first-step-act", "covid"), mod
            continue
        assert key in nums, f"{slug}: {{{key}}} is not in the data file"
        seen.add(key)
        if mod == "year":
            assert "year" in nums[key], key
        elif mod in ("word", "Word"):
            assert isinstance(nums[key]["value"], int) and 0 <= nums[key]["value"] <= 10, key
        else:
            assert mod in ("", "bare"), mod
    # Dek placeholders must be headline numbers (they are what the stories index loads).
    dek = re.search(r"\n    dek: '(.*?)',\n", block).group(1)
    idx = json.loads((OUT / "index.json").read_text())["stories"][slug]["numbers"]
    for m in PH.finditer(dek):
        if m.group(1) not in ("ev", "evy"):
            assert m.group(1) in idx, f"dek uses {m.group(1)}, which is not a headline number"


@pytest.mark.parametrize("slug", SLUGS)
def test_graphics_reference_existing_charts_and_layers(slug):
    block = content_blocks()[slug]
    doc = story(slug)
    for c in re.findall(r"chart: '([a-z0-9_]+)'", block):
        assert c in doc["charts"], c
    for lay, yr in re.findall(r"layer: '([a-z0-9_]+)', year: (\d{4})", block):
        assert lay in doc["layers"], lay
        assert int(yr) in doc["layers"][lay]["years"], (lay, yr)
    steps = re.findall(r"\n      \{\n        text: '", block)
    assert 5 <= len(steps) <= 9, len(steps)


def _prose_strings(block: str) -> list[str]:
    """Step texts and the dek (single-quoted string literals after text: / dek:)."""
    out = re.findall(r"\n\s+(?:text|dek): '((?:[^'\\]|\\.)*)'", block)
    return out


@pytest.mark.parametrize("slug", SLUGS)
def test_step_text_has_no_hard_coded_numbers(slug):
    for s in _prose_strings(content_blocks()[slug]):
        stripped = PH.sub("", s)
        stripped = re.sub(r"\[\[[a-z0-9-]+(\|[^\]]*)?\]\]", "", stripped)
        stripped = stripped.replace("COVID-19", "")
        assert not re.search(r"\d", stripped), f"{slug}: digit outside a placeholder: {s[:90]}"


def test_no_em_dash_anywhere_in_the_lane():
    files = [CONTENT, ROOT / "src" / "pages" / "story.ts", ROOT / "src" / "pages" / "stories.ts",
             ROOT / "src" / "styles" / "stories.css", ROOT / "tests" / "e2e" / "stories.spec.ts", Path(__file__)]
    files += sorted((ROOT / "src" / "pages" / "story").glob("*.ts"))
    files += sorted((ROOT / "pipeline" / "stories").glob("*.py"))
    files += sorted(OUT.glob("*.json"))
    doc = ROOT / "docs" / "lanes" / "stories.md"
    if doc.exists():
        files.append(doc)
    for f in files:
        assert EM_DASH not in f.read_text(), f


def test_no_judge_names_in_story_prose():
    judges = json.loads((ROOT / "public" / "data" / "judges.json").read_text())
    text = CONTENT.read_text()
    hits = set()
    for did, recs in judges.items():
        if did.startswith("_"):
            continue
        for r in recs:
            nm = (r.get("name") or "").strip()
            if nm and len(nm) > 8 and nm in text:
                hits.add(nm)
    assert not hits, hits


def test_build_is_deterministic_and_published_files_are_current():
    from pipeline.stories.build import main

    def digest():
        return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.glob("*.json"))}

    before = digest()
    main()
    after_one = digest()
    main()
    assert digest() == after_one
    assert before == after_one, "public/data/stories is stale: run python -m pipeline.stories.build"


def test_gap_record_is_current():
    """data/gaps/stories.json is rewritten on every run. The mass-tort story was not written, but the MDL docket counts
    it would use are processed (idb civil_mdl_dockets) and shown on district profiles, so no record may say they are
    missing from the processed tables."""
    from pipeline.stories.build import main
    main()
    gaps = json.loads((ROOT / "data" / "gaps" / "stories.json").read_text())
    assert set(gaps) == {"mass_tort_story_not_written"}
    assert (PROC / "idb" / "civil_mdl_dockets.parquet").exists()
    g = gaps["mass_tort_story_not_written"]
    assert "was not written" in g["description"] and "district profiles show them" in g["description"]
    first = json.loads((PROC / "idb" / "civil_mdl_meta.json").read_text())["first_coded_fy"]
    assert f"from FY {first} on" in g["description"]
    assert len(json.loads((OUT / "index.json").read_text())["order"]) == 5 and "five stories" in g["description"]
    text = json.dumps(gaps)
    assert "not_processed" not in text and "does not publish" not in text and EM_DASH not in text
