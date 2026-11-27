"""FCMS lane: regression tests for the statistics audit (docs/audits/stats_audit.md, items 5-8)."""
from __future__ import annotations

import fnmatch
import json

import pandas as pd
import pytest

from pipeline.common.districts import IDS
from pipeline.common.http import PROJECT_ROOT

OUT = PROJECT_ROOT / "data" / "processed" / "fcms"
TABLES = ["observations", "observations_ranks", "observations_casemix"]
pytestmark = pytest.mark.skipif(not (OUT / "observations.parquet").exists(), reason="fcms build not run")


@pytest.fixture(scope="module")
def obs():
    return pd.concat([pd.read_parquet(OUT / f"{n}.parquet") for n in TABLES], ignore_index=True)


@pytest.fixture(scope="module")
def gaps():
    return json.loads((PROJECT_ROOT / "data" / "gaps" / "fcms.json").read_text())


def _one(obs, did, fy, var):
    r = obs[(obs.district_id == did) & (obs.period == fy) & (obs.variable == var)]
    return r


# ------------------------------------------------------------------ item 5 ----------
def test_fy2003_vacant_months_note_shows_every_vintage():
    rec = pd.read_csv(OUT / "reconciliation.csv")
    r = rec[(rec.variable == "fcms_vacant_judgeship_months") & (rec.period == 2003)].iloc[0]
    assert r.diff_sum_minus_national == 9.0 and not r.within_rounding
    for P in range(2004, 2009):    # FY2003 is printed by the FY2004-FY2008 profiles, identically
        assert f"FY{P} profile: districts 453.8 vs national 444.8" in r.note


# ------------------------------------------------------------------ item 6 ----------
def test_implausible_cells_flagged_not_changed(obs):
    r = _one(obs, "flsd", 2023, "fcms_median_months_civil_filing_to_disposition")
    assert len(r) == 1 and r.value.iloc[0] == 0.0 and "0.0 months" in r.caveat.iloc[0]
    rk = _one(obs, "flsd", 2023, "fcms_rank_us_median_months_civil_filing_to_disposition")
    assert rk.value.iloc[0] == 1 and rk.caveat.iloc[0].startswith("Published rank of a flagged value")
    for y in (2004, 2005, 2006):
        r = _one(obs, "paed", y, "fcms_median_months_civil_filing_to_disposition")
        assert r.value.iloc[0] == 1.0 and "one eighth" in r.caveat.iloc[0]
    # unflagged cells carry an empty caveat
    assert (_one(obs, "dcd", 2025, "fcms_filings_total").caveat == "").all()
    cav = pd.read_csv(OUT / "cell_caveats.csv")
    assert {"printed_zero_median", "extreme_low_median", "no_jury_selections"} <= set(cav.code)
    flagged = cav[cav.action == "kept, flagged"]
    for t in flagged.itertuples():
        assert t.value == 0 or t.value < t.us_value / 8


def test_no_jury_selection_zeros_are_not_measurements(obs, gaps):
    for var in ("fcms_jurors_avg_present", "fcms_jurors_pct_not_selected"):
        assert _one(obs, "nmid", 2024, var).empty
        g = [x for k, x in gaps.items() if k.startswith(f"cells:{var}:") and "no jury selection" in x["reason"]]
        assert len(g) == 1 and g[0]["districts"] == ["nmid"] and g[0]["periods"] == [2024]
    # a real 0% not selected with jurors present stays (D.N.M.I. FY2017)
    assert _one(obs, "nmid", 2017, "fcms_jurors_pct_not_selected").value.iloc[0] == 0.0
    assert _one(obs, "nmid", 2017, "fcms_jurors_avg_present").value.iloc[0] > 0


# ------------------------------------------------------------------ item 7 ----------
def _covers(g, var, did, fy) -> bool:
    pats = [v.replace("all ", "").replace(" variables", "") for v in g["variables"]]
    if not any(fnmatch.fnmatch(var, p) for p in pats):
        return False
    d = g["districts"]
    if not (d == "all" or (isinstance(d, list) and did in d)):
        return False
    p = g["periods"]
    if p == "all":
        return True
    if isinstance(p, list):
        return fy in p
    return str(fy) in p


def test_every_missing_cell_in_span_is_logged(obs, gaps):
    """The auditor's machine check: every district x FY1999-2025 x variable cell is an observation or is
    covered by a gap record (wildcards and 'all' honoured)."""
    have = set(zip(obs.variable, obs.district_id, obs.period))
    recs = list(gaps.values())
    lo, hi = int(obs.period.min()), int(obs.period.max())
    uncovered = [(v, d, y) for v in sorted(obs.variable.unique()) for d in IDS for y in range(lo, hi + 1)
                 if (v, d, y) not in have and not any(_covers(g, v, d, y) for g in recs)]
    assert not uncovered, (len(uncovered), uncovered[:20])


def test_by_design_gap_records(gaps):
    a = gaps["casemix_letter_i_relabel:fcms_civil_type_copyright_patent_trademark"]
    assert a["periods"] == list(range(2021, 2026))
    b = gaps["casemix_letter_i_relabel:fcms_civil_type_intellectual_property_rights"]
    assert b["periods"] == list(range(2010, 2021))
    for scope in ("us", "circuit"):
        g = gaps[f"rank_5yr_change_not_printed:{scope}"]
        assert g["periods"] == [2010] + list(range(2012, 2026))
    for scope in ("us", "circuit"):
        k = [x for x in gaps if x.startswith(f"cells:fcms_rank_{scope}_trials_completed_per_judgeship:rank_cell_blank")]
        assert k and "nmid" in gaps[k[0]]["districts"] and 2024 in gaps[k[0]]["periods"]


# ------------------------------------------------------------------ item 8 ----------
def test_variables_json_points_time_series_to_current_method():
    vj = {v["id"]: v for v in json.loads((OUT / "variables.json").read_text())}
    cm = pd.read_parquet(OUT / "observations_current_method.parquet")
    for vid in cm.variable.unique():
        assert vj[vid]["method_sensitive"] and vj[vid]["time_series_table"] == "observations_current_method", vid
        assert vj[vid]["current_method_first_period"] == cm[cm.variable == vid].period.min()
    assert vj["fcms_filings_total"]["current_method_first_period"] == 2005
    assert vj["fcms_weighted_filings_per_judgeship"]["current_method_first_period"] == 2010
    assert vj["fcms_filings_per_judgeship_civil"]["time_series_table"] == "observations"
    assert not vj["fcms_filings_per_judgeship_civil"]["method_sensitive"]
    # the current-method series is consistent where the default table zig-zags (FY2009-FY2012 national)
    nat = pd.read_csv(OUT / "national_current_method.csv")
    f = nat[nat.variable == "fcms_filings_total"].set_index("period").value
    assert [f[y] for y in (2009, 2010, 2011, 2012)] == [384902, 394345, 402885, 386664]
