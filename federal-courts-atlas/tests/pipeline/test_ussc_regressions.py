"""USSC lane: regression tests for the statistics audit (docs/audits/stats_audit.md).

* Blocker 1: FY2002-FY2017 sentence length counted a missing SENSPLT0 as 469.99 months.
* Major 2: W.D. La. FY1998 offense mix was M.D. La.'s (LAW98.pdf is M.D. La.'s packet).
* Minor 3: rows computed by the lane are flagged ``derived`` (per row and ``derived_years``).
* Minor 4: FY1995-FY1999 packet sums vs national figures are written out and logged.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from pipeline.common.districts import IDS
from pipeline.ussc.compute import COLUMNS, sentence_2018, with_district
from pipeline.ussc.crosswalk import district_from_header
from pipeline.ussc.fallback import column_header, header_problem
from pipeline.ussc.packets import Table
from pipeline.ussc.variables import DERIVED_BASES, PUBLISHED_BASES, is_derived

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "ussc"
HAVE_OUT = (OUT / "observations.parquet").exists()
needs_build = pytest.mark.skipif(not HAVE_OUT, reason="run python -m pipeline.ussc.build first")


# ------------------------------------------------------------------ unit: sentence rule ----------
def test_sentence_rule_keeps_missing_missing():
    df = pd.DataFrame({"SENSPLT0": [np.nan, 0.0, 12.0, 470.0, 480.0, 2271.0]})
    got = sentence_2018(2002, df)
    assert np.isnan(got.iloc[0]), "a missing SENSPLT0 must stay missing, not become 469.99"
    assert got.iloc[1:].tolist() == [0.0, 12.0, 470.0, 469.99, 469.99]
    assert got.notna().sum() == 5


def test_sentence_rule_fy2018_uses_senspcap_unchanged():
    df = pd.DataFrame({"SENSPCAP": [np.nan, 5.0, 470.0], "SENSPLT0": [1.0, 2.0, 3.0]})
    got = sentence_2018(2018, df)
    assert np.isnan(got.iloc[0]) and got.iloc[1:].tolist() == [5.0, 470.0]


# ------------------------------------------------------------- unit: packet column header ----------
@pytest.mark.parametrize("header,did", [
    ("Middle Louisiana", "lamd"), ("Louisiana, Western", "lawd"), ("Louisiana, West", "lawd"),
    ("Mississippi South", "mssd"), ("North Carolina, Eastern", "nced"), ("West Virginia, Southern", "wvsd"),
    ("Eastern Michigan", "mied"), ("Western New York", "nywd"), ("Pennsylvania, Western", "pawd"),
    ("Illinois, Central", "ilcd"), ("Guam", "gud"), ("Alaska", "akd"), ("Rhode Isl and", "rid"),
    ("Northern Mariana Island", "nmid"), ("Northern Mariana Islands", "nmid"), ("District of Columbia", "dcd"),
    ("Virgin Islands", "vid"), ("Virginia, Eastern", "vaed"), ("Kansas", "ksd"),
    ("Georgia", None), ("State of California", None), ("Arkansas", None),
])
def test_district_from_header(header, did):
    assert district_from_header(header) == did


def _table(header_line: str, note: str = "") -> Table:
    return Table(1, "full", ["                Table 1", "    DISTRIBUTION OF GUIDELINE DEFENDANTS",
                             f"                        National           {header_line}",
                             "                    Number   Percent    Number   Percent",
                             "TOTAL               50,605    100.0       117    100.0", note])


def test_header_problem_rejects_a_table_for_another_district():
    t = _table("Middle Louisiana")       # LAW98.pdf: note names no district, header names M.D. La.
    assert column_header(t) == "Middle Louisiana"
    assert header_problem(t, "lamd") is None
    assert "Middle Louisiana" in header_problem(t, "lawd")
    assert header_problem(_table("Louisiana, Western"), "lawd") is None
    assert header_problem(Table(1, "full", ["Table 1", "TOTAL 1 2 3 4"]), "lawd") is not None


# ------------------------------------------------------------------ outputs ----------
@pytest.fixture(scope="module")
def obs() -> pd.DataFrame:
    return pd.read_parquet(OUT / "observations.parquet")


@pytest.fixture(scope="module")
def nat() -> pd.DataFrame:
    return pd.read_csv(OUT / "national.csv")


def _row(df, did, fy, var):
    s = df[(df["district_id"] == did) & (df["period"] == fy) & (df["variable"] == var)]
    assert len(s) == 1, (did, fy, var, len(s))
    return s.iloc[0]


# Independent recompute in the statistics audit (opafyYYnid.dat, SENSPLT0 capped, missing excluded).
SENTENCE_PINS = [
    ("laed", 2002, "ussc_mean_sentence_months", 51.3, 369),
    ("laed", 2002, "ussc_median_sentence_months", 33.0, 369),
    ("prd", 2004, "ussc_mean_sentence_months", 62.1, 602),
    ("cacd", 2007, "ussc_mean_sentence_months", 45.9, 1625),
    ("ncwd", 2002, "ussc_median_sentence_months", 50.0, 554),
]


@needs_build
@pytest.mark.parametrize("did,fy,var,value,n", SENTENCE_PINS)
def test_sentence_length_excludes_missing(obs, did, fy, var, value, n):
    r = _row(obs, did, fy, var)
    assert abs(r["value"] - value) < 0.051, (did, fy, var, r["value"])
    assert int(r["n_basis"]) == n


@needs_build
@pytest.mark.parametrize("fy,value", [(2002, 46.6), (2003, 47.2), (2004, 48.4)])
def test_national_mean_sentence_not_inflated(nat, fy, value):
    assert abs(_row(nat, "US", fy, "ussc_mean_sentence_months")["value"] - value) < 0.051


@needs_build
def test_sentence_n_basis_never_exceeds_cases(obs):
    p = obs[obs["period"] >= 2002].pivot_table(index=["district_id", "period"], columns="variable",
                                               values="n_basis", aggfunc="first")
    tot = obs[obs["variable"] == "ussc_cases_total"].set_index(["district_id", "period"])["value"]
    n = p["ussc_mean_sentence_months"]
    assert (n <= tot.reindex(n.index)).all()
    # FY2002 has 746 missing SENSPLT0 nationally: N must be below the case count somewhere
    assert (n.xs(2002, level="period") < tot.xs(2002, level="period").reindex(n.xs(2002, level="period").index)).any()


def _datafile(fy: int) -> Path | None:
    src = ROOT / "data" / "sources" / "ussc.json"
    if not src.exists():
        return None
    m = json.loads(src.read_text()).get(f"ussc_opafy{fy}")
    if not m or not m.get("local_path") or not (ROOT / m["local_path"]).exists():
        return None
    return ROOT / m["local_path"]


def _raw(fy: int) -> pd.DataFrame:
    from pipeline.ussc.datafile import read_columns
    z = _datafile(fy)
    if z is None:
        pytest.skip(f"FY{fy} datafile not cached; run python -m pipeline.ussc.build")
    return with_district(read_columns(z, COLUMNS))


@needs_build
@pytest.mark.parametrize("fy", [2002, 2007, 2017])
def test_sentence_n_basis_equals_non_null_count(obs, fy):
    df = _raw(fy)
    want = df[df["SENSPLT0"].notna()].groupby("district_id").size()
    got = obs[(obs["period"] == fy) & (obs["variable"] == "ussc_mean_sentence_months")].set_index("district_id")
    assert (got["n_basis"].astype(int).sort_index() == want.reindex(got.index).sort_index()).all()
    cap = df["SENSPLT0"].mask(df["SENSPLT0"] > 470, 469.99)
    mean = cap.groupby(df["district_id"]).mean()
    assert ((got["value"] - mean.reindex(got.index)).abs() < 0.051).all()


@pytest.mark.parametrize("fy", [2018, 2021, 2025])
def test_senspl0_rule_equals_senspcap_including_missing(fy):
    """The FY2002-FY2017 rule applied to SENSPLT0 must reproduce SENSPCAP, missing values included
    (the FY2021 record with SENSPCAP missing has SENSPLT0 missing too)."""
    df = _raw(fy)
    rule = sentence_2018(2017, df)            # the pre-FY2018 branch, applied to a year that has SENSPCAP
    sp = df["SENSPCAP"]
    assert (rule.isna() == sp.isna()).all()
    both = rule.notna()
    assert np.allclose(rule[both], sp[both])


# ------------------------------------------------------------ W.D. La. FY1998 / duplicates ----------
OFFENSE_VECTOR = ["ussc_cases_offense_known", "ussc_count_offense_drug_trafficking", "ussc_count_offense_immigration",
                  "ussc_count_offense_firearms", "ussc_count_offense_fraud", "ussc_count_offense_fraud_theft_embezzlement",
                  "ussc_count_offense_child_pornography", "ussc_count_offense_other"]


@needs_build
def test_lawd_fy1998_offense_mix_not_lamd(obs):
    sub = obs[(obs["district_id"] == "lawd") & (obs["period"] == 1998)]
    assert not sub["variable"].str.contains("offense").any(), sub["variable"].tolist()
    gaps = json.loads((ROOT / "data" / "gaps" / "ussc.json").read_text())
    g = gaps["ussc_packet_fallback_skipped_offense_mix_table_1"]
    assert "lawd" in g["districts"] and 1998 in g["periods"] and "Middle Louisiana" in g["reason"]


@needs_build
def test_no_two_districts_share_an_offense_mix_vector(obs):
    p = obs[obs["variable"].isin(OFFENSE_VECTOR)].pivot_table(index=["period", "district_id"], columns="variable",
                                                              values="value")
    for fy, g in p.groupby(level="period"):
        g = g.dropna(subset=["ussc_cases_offense_known"]).fillna(-1)
        dup = g[g.duplicated(keep=False)]
        assert dup.empty, f"FY{fy}: identical offense-mix vectors\n{dup}"


# ------------------------------------------------------------------ derived flags ----------
def test_basis_classification_is_total():
    assert not PUBLISHED_BASES & DERIVED_BASES
    assert is_derived("computed_ussc_definition") and not is_derived("reproduces_published")
    with pytest.raises(ValueError):
        is_derived("something_new")


@needs_build
def test_derived_flag_per_row(obs, nat):
    for df in (obs, nat):
        assert df["derived"].dtype == bool
        assert (df["derived"] == df["basis"].isin(DERIVED_BASES)).all()
        assert df["basis"].isin(PUBLISHED_BASES | DERIVED_BASES).all()


@needs_build
def test_derived_years_in_variables_json(obs):
    vj = {v["id"]: v for v in json.loads((OUT / "variables.json").read_text())}
    for vid, v in vj.items():
        sub = obs[obs["variable"] == vid]
        assert v["derived_years"] == sorted(int(x) for x in sub[sub["derived"]]["period"].unique()), vid
        assert set(v["derived_formula_by_basis"]) == set(sub[sub["derived"]]["basis"]), vid
        assert all(f for f in v["derived_formula_by_basis"].values())
        if v["derived"]:
            assert sub["derived"].all(), vid
    assert vj["ussc_pct_prison"]["derived_years"] == list(range(2002, 2018))
    assert vj["ussc_mean_sentence_months"]["derived_years"] == list(range(2002, 2018))
    assert vj["ussc_median_sentence_months"]["derived_years"] == list(range(2002, 2018))
    assert vj["ussc_count_offense_other"]["derived_years"] == list(range(1995, 2002))
    assert vj["ussc_pct_offense_other"]["derived_years"] == list(range(1995, 2002))
    assert vj["ussc_mean_prison_months"]["derived_years"] == [2004, 2005] + list(range(2018, 2026))
    assert vj["ussc_pct_within_range"]["derived_years"] == [2004, 2005]
    assert vj["ussc_pct_upward_variance"]["derived_years"] == list(range(2014, 2018))
    assert vj["ussc_cases_total"]["derived_years"] == []


# ---------------------------------------------------------- FY1995-FY1999 reconciliation ----------
@needs_build
def test_packet_reconciliation_written_and_logged():
    r = pd.read_csv(OUT / "packet_reconciliation.csv")
    assert set(r["fy"]) == set(range(1995, 2002))
    assert r[r["fy"] >= 2000]["reconciles"].all()
    pt = r[(r["fy"] == 1999) & (r["variable"] == "ussc_cases_prison_term")].iloc[0]
    assert pt["n_districts"] == 94 and pt["difference"] == 57
    # range denominators come from one all-district table and always reconcile
    assert r[r["variable"] == "ussc_cases_range_known"]["reconciles"].all()
    gaps = json.loads((ROOT / "data" / "gaps" / "ussc.json").read_text())
    g = gaps["ussc_fy1995_1999_packets_do_not_sum_to_national"]
    assert "ussc_cases_prison_term" in g["variables"] and 1999 in g["periods"]
    assert max(g["periods"]) <= 1999
