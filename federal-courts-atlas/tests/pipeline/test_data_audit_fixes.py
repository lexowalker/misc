"""Regression tests for the second data audit (2026-11-27, auditors A and B) and the open items fixed with it.

* A #8: USSC FY2006-FY2009 range-group shares are the exact count share, while the USSC printed the sum of
  its rounded sub-category percentages (S.D. Fla. FY2008: atlas 10.0, packet 10.1). They are now derived.
* B #134/#135: USSC means and medians from FY2011 are printed in whole months; the atlas keeps one decimal
  (C.D. Cal. FY2025 median 29.5, packet 30; W.D. Tex. 6.6, packet 7). They are now derived.
* Ranks compare values as displayed, so districts showing the same number share a rank (IDB shares).
* Open item (a): the two FCMS juror measures are published; the D.N.M.I. FY2024 zeros stay absent.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from pipeline.ussc.variables import DERIVED_BASES, is_derived
from pipeline.web.common import display_round, fmt_number

ROOT = Path(__file__).resolve().parents[2]
USSC = ROOT / "data" / "processed" / "ussc"
PUB = ROOT / "public" / "data"
needs_ussc = pytest.mark.skipif(not (USSC / "observations.parquet").exists(), reason="run make ussc first")
needs_web = pytest.mark.skipif(not (PUB / "variables.json").exists(), reason="run make web first")

GROUPS = ["ussc_pct_above_range", "ussc_pct_govt_sponsored_below_range", "ussc_pct_non_govt_sponsored_below_range"]


def _vals(vid: str) -> dict:
    return json.loads((PUB / "values" / f"{vid}.json").read_text())


@pytest.fixture(scope="module")
def obs() -> pd.DataFrame:
    return pd.read_parquet(USSC / "observations.parquet")


@pytest.fixture(scope="module")
def validation() -> pd.DataFrame:
    return pd.read_csv(USSC / "validation.csv")


# ----------------------------------------------------------------------- A #8: FY2006-2009 groups
def test_new_bases_are_derived():
    assert {"exact_share_of_published_counts", "unrounded_published_statistic"} <= DERIVED_BASES
    assert is_derived("exact_share_of_published_counts") and is_derived("unrounded_published_statistic")


@needs_ussc
def test_group_shares_fy2006_2009_derived_fy2010_2017_published(obs):
    g = obs[obs["variable"].isin(GROUPS)]
    early = g[g["period"].between(2006, 2009)]
    late = g[g["period"].between(2010, 2017)]
    assert len(early) == 3 * 4 * 94 and len(late) == 3 * 8 * 94
    assert (early["basis"] == "exact_share_of_published_counts").all() and early["derived"].all()
    assert (late["basis"] == "reproduces_published").all() and not late["derived"].any()


@needs_ussc
def test_flsd_fy2008_is_exact_share_and_packet_prints_sum_of_rounded(obs, validation):
    row = obs[(obs.variable == "ussc_pct_govt_sponsored_below_range") & (obs.district_id == "flsd")
              & (obs.period == 2008)].iloc[0]
    assert row["numerator"] == 217 and row["n_basis"] == 2162
    assert row["value"] == 10.0 and row["derived"]
    # S.D. Fla. FY2008 packet (fls08) Table 8 prints 217 and 10.1 (= 9.2 + 0.0 + 0.9); counts match exactly.
    v = validation[(validation.fy == 2008) & (validation.district_id == "flsd")
                   & (validation.measure == "grp_govt_below_pct")]
    assert len(v) == 1 and v.iloc[0]["published"] == 10.1
    assert "sum of rounded" in v.iloc[0]["note"]
    vn = validation[(validation.fy == 2008) & (validation.district_id == "flsd")
                    & (validation.measure == "grp_govt_below_n")]
    assert vn.iloc[0]["published"] == 217


@needs_ussc
def test_packets_print_exact_group_shares_from_fy2010(validation):
    """The 'sum of rounded parts' convention stops in FY2009 (basis switches back to published in FY2010)."""
    t = validation[validation["table"].str.startswith("Table 8") & validation["measure"].str.match(r"grp_.*_pct")]
    off = (t["computed"].round(1) - t["published"]).abs() > 1e-6
    assert not off[t["fy"] >= 2010].any()
    assert off[t["fy"].between(2006, 2009)].any()


@needs_web
def test_web_group_variables_mark_fy2006_2009_derived():
    for vid in ("above_range_pct_2006", "govt_below_range_pct_2006", "nongovt_below_range_pct_2006"):
        vf = _vals(vid)
        assert vf["derived_years"] == [2006, 2007, 2008, 2009], vid
        assert "exact_share_of_published_counts" in vf["formula_by_basis"], vid
        assert "0.1" in vf["formula_by_basis"]["exact_share_of_published_counts"]
    v = {x["id"]: x for x in json.loads((PUB / "variables.json").read_text())}["govt_below_range_pct_2006"]
    assert not any("grouping the USSC printed" in c for c in v["caveats"])
    assert any("FY 2006 to 2009" in c and "derived" in c for c in v["caveats"])
    assert _vals("govt_below_range_pct_2006")["values"]["flsd"]["2008"] == 10.0


@needs_web
def test_after_booker_story_flags_fy2006_split_as_derived():
    nums = json.loads((PUB / "stories" / "after-booker.json").read_text())["numbers"]
    for key in ("above_2006", "govt_2006", "nongovt_2006"):
        assert nums[key]["derived"] and nums[key]["formula"], key
    assert nums["nongovt_2006"]["value"] == 12.1   # packet prints 12.0 = 2.7 + 2.0 + 6.0 + 1.3


# ------------------------------------------------------------------- B #134/#135: whole months
@needs_ussc
def test_means_and_medians_fy2011_on_are_derived(obs):
    for var, first in (("ussc_mean_sentence_months", 2018), ("ussc_median_sentence_months", 2018),
                       ("ussc_mean_prison_months", 2011), ("ussc_median_prison_months", 2011)):
        sub = obs[(obs.variable == var) & (obs.period >= 2011)]
        assert sub["derived"].all(), var
        pub = sub[sub.period >= first]
        assert (pub["basis"].isin({"unrounded_published_statistic", "computed_ussc_definition"})).all(), var
    old = obs[(obs.variable == "ussc_mean_prison_months") & obs.period.between(2006, 2010)]
    assert (old["basis"] == "reproduces_published").all()   # FY2010 and before print one decimal


@needs_ussc
def test_cacd_txwd_fy2025_median_vs_whole_month_packets(obs, validation):
    for d, val, printed in (("cacd", 29.5, 30), ("txwd", 6.6, 7)):
        row = obs[(obs.variable == "ussc_median_sentence_months") & (obs.district_id == d) & (obs.period == 2025)]
        assert row.iloc[0]["value"] == val and row.iloc[0]["derived"]
        v = validation[(validation.fy == 2025) & (validation.district_id == d)
                       & (validation.measure == "sent2018_median")]
        assert v.iloc[0]["published"] == printed
        # the printed whole month is the one-decimal value rounded half up (never more than half a month off)
        assert abs(printed - val) <= 0.5


@needs_web
def test_web_mean_median_are_derived_with_formula():
    for vid in ("mean_sentence_months", "median_sentence_months"):
        vf = _vals(vid)
        assert vf["derived"] is True and vf["formula"] and "whole months" in vf["formula"], vid
        assert 2025 in vf["national_derived_years"]
        v = {x["id"]: x for x in json.loads((PUB / "variables.json").read_text())}[vid]
        assert v["derived"] and v["formula"]
        assert not any("reproduce the published figures" in c for c in v["caveats"])
    assert _vals("median_sentence_months")["values"]["cacd"]["2025"] == 29.5
    assert _vals("mean_sentence_months")["national"]["2025"] == 47.5   # packet prints 47 (exact 47.499)


# --------------------------------------------------------------------------- display-precision ranks
def test_display_round_matches_intl_half_expand():
    assert display_round(12.25, ".1f") == 12.3      # Intl.NumberFormat rounds an exact tie away from zero
    assert display_round(4.0853, ".1f") == 4.1
    assert display_round(3.5, ",.0f") == 3.5        # a published half judgeship is never rounded away
    assert fmt_number(12.25, ".1f") == "12.3"
    assert fmt_number(1234.5, ",.0f") == "1,234.5"


@needs_web
def test_districts_showing_the_same_share_share_a_rank():
    vf = _vals("civil_trial_rate_pct")
    group = ["cod", "dcd", "ilsd", "mdd", "nynd", "pamd"]   # all show 4.1% in FY 1988 (auditor A)
    shown = {d: display_round(vf["values"][d]["1988"], ".1f") for d in group}
    assert set(shown.values()) == {4.1}
    assert len({vf["ranks"][d]["1988"] for d in group}) == 1


@needs_web
def test_no_two_districts_with_the_same_displayed_value_have_different_ranks():
    variables = json.loads((PUB / "variables.json").read_text())
    for v in variables:
        vf = _vals(v["id"])
        for y in vf["years"]:
            ys = str(y)
            by_shown: dict[float, set[int]] = {}
            for d, row in vf["values"].items():
                if ys in row:
                    by_shown.setdefault(display_round(row[ys], v["format"]), set()).add(vf["ranks"][d][ys])
            assert all(len(r) == 1 for r in by_shown.values()), (v["id"], y)


@needs_web
def test_profile_key_stats_carry_rank_ties():
    p = json.loads((PUB / "profiles" / "gasd.json").read_text())
    row = next(r for r in p["key_stats"] if r["variable"] == "vacant_judgeship_months")
    vf = _vals("vacant_judgeship_months")
    y = str(vf["years"][-1])
    assert row["rank_ties"] == sum(1 for r in vf["ranks"].values() if r.get(y) == row["rank"])
    if row["value"] == 0:
        assert row["rank_ties"] > 2   # auditor B: 66 districts share 0.0 in FY 2025


# ------------------------------------------------------------------------------ juror measures
@needs_web
def test_juror_measures_published_and_dnmi_fy2024_absent():
    cat = {x["id"]: x for x in json.loads((PUB / "variables.json").read_text())}
    fcms = pd.read_parquet(ROOT / "data" / "processed" / "fcms" / "observations.parquet")
    for vid, lane_var in (("jurors_avg_present", "fcms_jurors_avg_present"),
                          ("jurors_pct_not_selected", "fcms_jurors_pct_not_selected")):
        assert vid in cat and cat[vid]["family"] == "workload" and not cat[vid]["featured"]
        assert cat[vid]["lane_variable"] == lane_var and not cat[vid]["derived"]
        assert any("Northern Mariana Islands" in c and "No data" in c for c in cat[vid]["caveats"])
        vf = _vals(vid)
        assert "2024" not in vf["values"]["nmid"], "printed 0 with no jury selection held: a gap, not a value"
        assert vf["ranked_of"]["2024"] == 93
        lane = fcms[fcms.variable == lane_var]
        n = 0
        for r in lane.itertuples(index=False):
            assert vf["values"][r.district_id][str(int(r.period))] == r.value   # copied exactly
            n += 1
        assert n == sum(len(row) for row in vf["values"].values())
    assert _vals("jurors_pct_not_selected")["values"]["nmid"]["2017"] == 0   # a real 0% is kept


@needs_web
def test_prisoner_petition_caveat_explains_case_mix_difference():
    v = {x["id"]: x for x in json.loads((PUB / "variables.json").read_text())}["prisoner_petitions_pct"]
    assert any("case-mix chart" in c and "463" in c for c in v["caveats"])


@needs_web
def test_rocket_docket_standings_rank_the_series_shown():
    """Auditor B: FY 2005-2009 and FY 2011 profiles rank the old case-based felony median; the story's range of
    standings now uses only the years ranked on the defendant-based median that its chart and text show."""
    r = pd.read_parquet(ROOT / "data" / "processed" / "fcms" / "observations_ranks.parquet")
    s = r[(r.variable == "fcms_rank_us_median_months_criminal_felony_filing_to_disposition")
          & (r.district_id == "vaed") & (r.period >= 2005)]
    d = s[s["method"] == "crim_defendants"]
    assert sorted(int(y) for y in d.period) == [2010] + list(range(2012, 2026))
    nums = json.loads((PUB / "stories" / "rocket-docket.json").read_text())["numbers"]
    assert nums["crim_rank_best"]["value"] == d.value.min() == 4
    assert nums["crim_rank_worst"]["value"] == d.value.max() == 11
    for key in ("crim_rank_best", "crim_rank_worst"):
        ids = set(nums[key]["source_ids"])
        assert not ids & {"fcms_fy2005", "fcms_fy2006", "fcms_fy2007", "fcms_fy2008", "fcms_fy2009", "fcms_fy2011"}
        assert "case-based" in nums[key]["how"]
