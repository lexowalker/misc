"""IDB lane: output integrity and source-total reconciliation tests.

Run after ``python -m pipeline.idb.build``. Tolerances are set from the definitional differences documented in
docs/lanes/idb.md; each is loose enough for those differences and tight enough that a parsing or counting bug
(wrong column, wrong fiscal-year rule, a lost district, a broken de-duplication) fails it.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from pipeline.common.districts import IDS
from pipeline.common.manifest import OBS_COLUMNS

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "idb"

pytestmark = pytest.mark.skipif(not (OUT / "observations.parquet").exists(), reason="idb build not run")


@pytest.fixture(scope="module")
def obs():
    return pd.read_parquet(OUT / "observations.parquet")


@pytest.fixture(scope="module")
def nat():
    return pd.read_parquet(OUT / "national.parquet")


@pytest.fixture(scope="module")
def rec():
    return pd.read_csv(OUT / "reconciliation.csv")


@pytest.fixture(scope="module")
def variables():
    return json.loads((OUT / "variables.json").read_text())


COUNT_VARS = ["idb_civil_filed", "idb_civil_terminated", "idb_patent_filed", "idb_patent_incl_anda_filed",
              "idb_crim_defendants_filed", "idb_crim_felony_defendants_filed", "idb_crim_defendants_terminated"]


def _series(obs, var):
    return obs[obs["variable"] == var].set_index(["district_id", "period"])["value"]


# ----------------------------------------------------------------------------- structure
def test_observation_schema(obs):
    assert list(obs.columns[:8]) == OBS_COLUMNS
    assert set(obs["period_type"]) == {"FY_SEP30"}
    assert set(obs["district_id"]) == set(IDS)
    assert not obs.duplicated(["district_id", "period", "variable"]).any()
    assert obs["value"].notna().all()


def test_variables_json_matches_observations(obs, variables):
    ids = [v["id"] for v in variables]
    assert len(ids) == len(set(ids))
    assert set(ids) == set(obs["variable"])
    srcs = json.loads((ROOT / "data" / "sources" / "idb.json").read_text())
    for v in variables:
        for k in ["id", "label", "unit", "period_type", "description", "source_ids", "caveats", "higher_means"]:
            assert v.get(k) not in (None, ""), (v["id"], k)
        assert set(v["source_ids"]) <= set(srcs), v["id"]
        if v["unit"] == "percent":
            assert v["derived"] and v["formula"], v["id"]


def test_sources_registered_with_hashes():
    srcs = json.loads((ROOT / "data" / "sources" / "idb.json").read_text())
    for sid in ["idb_civil_cv88on", "idb_criminal_cr96on", "idb_civil_codebook", "idb_criminal_codebook",
                "idb_research_guide", "ao_js44", "ao_nos_descriptions", "idb_criminal_d2_labels"]:
        m = srcs[sid]
        assert m["url"].startswith("https://") and len(m["sha256"]) == 64 and m["retrieved_at"], sid


@pytest.mark.parametrize("var", COUNT_VARS)
def test_count_variables_cover_every_district_every_year(obs, var):
    s = obs[obs["variable"] == var]
    years = sorted(s["period"].unique())
    assert len(s) == 94 * len(years)
    assert (s["value"] >= 0).all() and (s["value"] == s["value"].round()).all()
    first = 1988 if "civil" in var or "patent" in var else 1996
    assert years[0] == first and years[-1] >= 2025 and years == list(range(first, years[-1] + 1))


def test_percent_values_in_range(obs):
    p = obs[obs["unit"] == "percent"]
    assert ((p["value"] >= 0) & (p["value"] <= 100)).all()
    assert (p["denominator"] > 0).all()
    np.testing.assert_allclose(p["value"], 100 * p["numerator"] / p["denominator"], rtol=1e-9)


@pytest.mark.parametrize("var", COUNT_VARS)
def test_districts_sum_to_national(obs, nat, var):
    d = obs[obs["variable"] == var].groupby("period")["value"].sum()
    n = nat[nat["variable"] == var].set_index("period")["value"]
    pd.testing.assert_series_equal(d.sort_index(), n.sort_index(), check_names=False)


def test_patent_share_sums_to_100(obs):
    s = obs[obs["variable"] == "idb_patent_share_of_national"].groupby("period")["value"].sum()
    assert np.allclose(s, 100.0)


def test_pro_se_series_rules(obs):
    s = obs[obs["variable"] == "idb_civil_pct_pro_se"]
    assert s["period"].min() == 1999
    assert s.groupby("period")["district_id"].nunique().loc[2000:].min() >= 90
    pl = _series(obs, "idb_civil_pct_pro_se_plaintiff")
    anyp = _series(obs, "idb_civil_pct_pro_se")
    assert (pl.reindex(anyp.index) <= anyp + 1e-9).all()


def test_criminal_shares_partition(obs):
    t = sum(_series(obs, v) for v in ["idb_crim_trial_rate", "idb_crim_pct_guilty_plea", "idb_crim_pct_dismissed"])
    # trial + plea + dismissed = 100% of terminated defendants (acquittals are inside trials)
    assert np.allclose(t.dropna(), 100.0)
    assert (_series(obs, "idb_crim_pct_acquitted") <= _series(obs, "idb_crim_trial_rate") + 1e-9).all()


# ----------------------------------------------------------------------------- detail tables
def test_nos_mix_sums(obs):
    m = pd.read_parquet(OUT / "civil_nos_mix.parquet")
    d = m[m["district_id"] != "_national"].groupby(["district_id", "period"])["count"].sum()
    f = _series(obs, "idb_civil_filed")
    assert (d.reindex(f.index).fillna(0) == f).all()
    assert np.allclose(m.groupby(["district_id", "period"])["share"].sum(), 100.0)
    # unlisted (legacy) codes are a tiny share of all filings
    u = m[(m["district_id"] == "_national") & (m["nos_group"] == "unlisted_code")]["count"].sum()
    assert u / m[m["district_id"] == "_national"]["count"].sum() < 0.002


def test_disposition_mix_sums(obs):
    m = pd.read_parquet(OUT / "civil_disposition_mix.parquet")
    d = m[m["district_id"] != "_national"].groupby(["district_id", "period"])["count"].sum()
    t = _series(obs, "idb_civil_terminated")
    assert (d.reindex(t.index).fillna(0) == t).all()
    c = pd.read_parquet(OUT / "criminal_disposition_mix.parquet")
    d = c[c["district_id"] != "_national"].groupby(["district_id", "period"])["count"].sum()
    t = _series(obs, "idb_crim_defendants_terminated")
    assert (d.reindex(t.index).fillna(0) == t).all()
    assert set(c["disp_group"]) <= {"dismissed", "acquitted_bench", "acquitted_jury", "plea", "convicted_bench",
                                    "convicted_jury"}


def test_offense_mix_sums(obs):
    m = pd.read_parquet(OUT / "criminal_offense_mix.parquet")
    d = m[m["district_id"] != "_national"].groupby(["district_id", "period"])["count"].sum()
    f = _series(obs, "idb_crim_defendants_filed")
    assert (d.reindex(f.index) == f).all()
    fel = m[m["district_id"] != "_national"].groupby(["district_id", "period"])["count_felony"].sum()
    assert (fel.reindex(f.index) == _series(obs, "idb_crim_felony_defendants_filed")).all()
    assert m[m["offense_category"] == "unknown"]["count"].sum() / m["count"].sum() < 0.001


def test_patent_quarterly_matches_annual(obs, nat):
    q = pd.read_csv(OUT / "patent_quarterly.csv")
    for did in ["txed", "txwd", "ded", "cacd", "njd", "ilnd", "_national"]:
        assert did in set(q["district_id"])
    a = q.groupby(["district_id", "fiscal_year"])[["nos830", "nos830_835"]].sum()
    p = _series(obs, "idb_patent_filed")
    assert (a["nos830"].reindex(p.index.rename(["district_id", "fiscal_year"])).values == p.values).all()
    pn = nat[nat["variable"] == "idb_patent_filed"].set_index("period")["value"]
    assert (a.loc["_national", "nos830"].reindex(pn.index).values == pn.values).all()
    assert q["quarter"].min() == "1987Q4" and q.groupby("district_id").size().nunique() == 1


def test_crosswalk_file():
    cw = pd.read_csv(OUT / "district_crosswalk.csv", dtype=str)
    assert len(cw) == 94 and set(cw["district_id"]) == set(IDS) and cw["idb_district_code"].is_unique


def test_build_meta_file_structure_checks():
    m = json.loads((OUT / "build_meta.json").read_text())
    c = m["civil"]
    assert c["tdateuse_fy_ne_tapeyear_fy1993_on"] == 0          # TDATEUSE fiscal year == tape year, FY1993+
    assert 0 < c["duplicate_records_dropped"] / c["records"] < 0.01
    assert c["nos835_first_filing"] >= "2016-10-01"            # NOS 835 starts in FY2017


# ----------------------------------------------------------------------------- independent spot checks
# Values counted independently from the raw text files with awk (see docs/lanes/idb.md, "Verification").
@pytest.mark.parametrize("var,did,fy,val", [
    ("idb_patent_filed", "txed", 2015, 2184),
    ("idb_patent_filed", "txed", 2019, 393),
    ("idb_crim_defendants_filed", "txsd", 2024, 6044),
    ("idb_crim_defendants_terminated", "txsd", 2024, 6442),
    ("idb_crim_defendants_filed", "azd", 2024, 10825),
    ("idb_crim_defendants_terminated", "azd", 2024, 10269),
])
def test_spot_values(obs, var, did, fy, val):
    assert _series(obs, var).loc[(did, fy)] == val


# ----------------------------------------------------------------------------- reconciliation tolerances
def _chk(rec, check, level=None):
    r = rec[rec["check"] == check]
    if level:
        r = r[r["level"] == level]
    assert len(r), check
    return r


def test_civil_filed_national_within_2pct_of_ao_c1_every_year(rec):
    r = _chk(rec, "civil_filed_vs_ao_c1", "national")
    assert r["period"].min() <= 1997 and r["period"].max() >= 2025
    assert (r["pct_diff"].abs() <= 2.0).all(), r.loc[r["pct_diff"].abs() > 2.0]
    # since FY2011 the reconstruction is within 0.5%
    assert (r[r["period"] >= 2011]["pct_diff"].abs() <= 0.5).all()


def test_civil_filed_district_agreement(rec):
    for check in ["civil_filed_vs_ao_c1", "civil_filed_vs_fcms"]:
        r = _chk(rec, check, "district")
        assert r["idb_value"].corr(r["reference_value"]) > 0.995
        assert r["pct_diff"].abs().median() < 0.5
        assert (r["pct_diff"].abs() <= 5).mean() > 0.95


def test_civil_terminated_matches_ao_c1(rec):
    n = _chk(rec, "civil_terminated_vs_ao_c1", "national")
    assert (n["pct_diff"].abs() <= 0.1).all()
    d = _chk(rec, "civil_terminated_vs_ao_c1", "district")
    assert (d["diff"] == 0).mean() > 0.99


def test_civil_reached_trial_close_to_ao_c4(rec):
    r = _chk(rec, "civil_reached_trial_vs_ao_c4")
    assert (r["pct_diff"].abs() <= 10).all() and (r[r["period"] >= 2011]["pct_diff"].abs() <= 1.5).all()


def test_criminal_d1_matches(rec):
    for check in ["crim_filed_incl_transfers_vs_ao_d1", "crim_terminated_incl_transfers_vs_ao_d1"]:
        n = _chk(rec, check, "national")
        assert (n["pct_diff"].abs() <= 0.1).all(), check
        d = _chk(rec, check, "district")
        assert (d["diff"] == 0).mean() > 0.95, check


def test_criminal_d2_total_and_mapping(rec):
    r = _chk(rec, "crim_filed_vs_ao_d2")
    assert (r["pct_diff"].abs() <= 0.01).all()
    for cat in ["immigration", "firearms_explosives", "sex", "traffic"]:
        assert (_chk(rec, f"crim_offense_{cat}_vs_ao_d2")["diff"] == 0).all(), cat
    for cat in ["drugs", "violent", "property_other", "justice_system", "fraud"]:
        assert (_chk(rec, f"crim_offense_{cat}_vs_ao_d2")["pct_diff"].abs() <= 1.0).all(), cat
    for cat in ["general", "regulatory"]:
        r = _chk(rec, f"crim_offense_{cat}_vs_ao_d2")
        assert (r["pct_diff"].abs() <= 5.0).all() and (r[r["period"] >= 2012]["pct_diff"].abs() <= 1.0).all(), cat


def test_criminal_d4_dispositions(rec):
    r = rec[rec["check"].str.endswith("_vs_ao_d4")]
    assert set(r["period"]) >= set(range(1997, 2026))
    late = r[r["period"] >= 2005]
    assert (late["diff"] == 0).all(), late[late["diff"] != 0]
    early = r[(r["period"] < 2005) & (r["check"] == "crim_terminated_vs_ao_d4")]
    assert (early["pct_diff"].between(0, 3)).all()


def test_criminal_felony_matches_fcms_in_defendant_years(rec):
    r = _chk(rec, "crim_felony_filed_vs_fcms")
    d = r[r["note"].str.contains("crim_defendants")]
    assert len(d) >= 94 * 15 and (d["diff"] == 0).all()
