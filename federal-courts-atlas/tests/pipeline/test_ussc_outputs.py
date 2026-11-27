"""USSC lane: outputs, national totals, packet validation and hand-checked fixtures.

The fixtures below were read by eye from the USSC Statistical Information Packets (PDF,
www.ussc.gov/research/data-reports/geography/<FY>-federal-sentencing-statistics) and are
compared with the values this lane computes from the Individual Offender datafiles (FY2002+)
or takes from the packets (FY1995-FY2001).
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from pipeline.common.districts import IDS
from pipeline.common.manifest import OBS_COLUMNS

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "ussc"

pytestmark = pytest.mark.skipif(not (OUT / "observations.parquet").exists(),
                                reason="run python -m pipeline.ussc.build first")


@pytest.fixture(scope="module")
def obs() -> pd.DataFrame:
    return pd.read_parquet(OUT / "observations.parquet")


@pytest.fixture(scope="module")
def nat() -> pd.DataFrame:
    return pd.read_csv(OUT / "national.csv")


@pytest.fixture(scope="module")
def val() -> pd.DataFrame:
    return pd.read_csv(OUT / "validation.csv")


def value(df, did, fy, var):
    s = df[(df["district_id"] == did) & (df["period"] == fy) & (df["variable"] == var)]["value"]
    assert len(s) == 1, f"{did} FY{fy} {var}: {len(s)} rows"
    return float(s.iloc[0])


# ------------------------------------------------------------------ schema ---------------
def test_schema_and_ids(obs):
    assert list(obs.columns[: len(OBS_COLUMNS)]) == OBS_COLUMNS
    assert set(obs["district_id"]) == set(IDS)
    assert set(obs["period_type"]) == {"FY_SEP30"}
    assert not obs.duplicated(["district_id", "period", "period_type", "variable"]).any()
    sources = json.loads((ROOT / "data" / "sources" / "ussc.json").read_text())
    assert set(obs["source_id"]) <= set(sources)
    for f in OUT.glob("*"):
        assert f.stat().st_size < 20 * 1024 * 1024, f


def test_variables_json_matches_observations(obs):
    vj = json.loads((OUT / "variables.json").read_text())
    ids = {v["id"] for v in vj}
    assert ids == set(obs["variable"])
    for v in vj:
        for k in ("id", "label", "unit", "period_type", "description", "source_ids", "caveats", "higher_means"):
            assert k in v and v[k] not in (None, ""), (v["id"], k)
        sub = obs[obs["variable"] == v["id"]]
        assert v["first_period"] == sub["period"].min() and v["last_period"] == sub["period"].max()
    derived = {v["id"] for v in vj if v["derived"]}
    assert derived == {"ussc_pct_above_range_2018scheme", "ussc_pct_govt_sponsored_below_range_2018scheme",
                       "ussc_pct_non_govt_sponsored_below_range_2018scheme"}


def test_coverage_spans(obs):
    span = obs.groupby("variable")["period"].agg(["min", "max"])
    assert span.loc["ussc_cases_total", "min"] <= 1995 and span.loc["ussc_cases_total", "max"] >= 2025
    assert span.loc["ussc_pct_within_range", "min"] <= 1995
    assert tuple(span.loc["ussc_pct_above_range"]) == (2006, 2017)
    assert tuple(span.loc["ussc_pct_govt_sponsored_below_range"]) == (2006, 2017)
    assert span.loc["ussc_pct_above_range_2018scheme", "min"] == 2014
    assert span.loc["ussc_pct_variance", "min"] == 2014
    assert span.loc["ussc_pct_offense_child_pornography", "min"] == 2010
    assert span.loc["ussc_pct_offense_fraud", "max"] == 2017
    assert span.loc["ussc_pct_offense_fraud_theft_embezzlement", "min"] == 2018
    assert span.loc["ussc_pct_early_disposition_5k3", "min"] == 2006
    # every district has a full datafile-era series for the core variables
    for var in ["ussc_cases_total", "ussc_pct_within_range", "ussc_pct_prison", "ussc_mean_sentence_months",
                "ussc_pct_offense_drug_trafficking"]:
        sub = obs[(obs["variable"] == var) & obs["period"].between(2002, 2025)]
        assert sub.groupby("period")["district_id"].nunique().min() == 94, var


def test_partitions_sum_to_100(obs):
    p = obs.pivot_table(index=["district_id", "period"], columns="variable", values="value")
    four = p[["ussc_pct_within_range", "ussc_pct_above_range", "ussc_pct_govt_sponsored_below_range",
              "ussc_pct_non_govt_sponsored_below_range"]].dropna()
    assert len(four) == 94 * 12
    assert ((four.sum(axis=1) - 100).abs() <= 0.25).all()
    new = p[["ussc_pct_within_range", "ussc_pct_above_range_2018scheme",
             "ussc_pct_govt_sponsored_below_range_2018scheme",
             "ussc_pct_non_govt_sponsored_below_range_2018scheme"]].dropna()
    assert len(new) == 94 * 12          # FY2014-FY2017 from the supplemental files, FY2018+ from the datafiles
    assert ((new.sum(axis=1) - 100).abs() <= 0.25).all()
    off_cols = [c for c in p.columns if c.startswith("ussc_pct_offense_")]
    off = p.loc[p.index.get_level_values("period") >= 2002, off_cols]
    assert ((off.sum(axis=1, min_count=1) - 100).abs() <= 0.35).all()


def test_supplemental_scheme_equals_published_scheme():
    """FY2014-FY2017: the four-way grouping (and within, §5K1.1, §5K3.1, denominator) is identical under the
    published BOOKERCD scheme and the FY2018 SENTRNGE methodology for every district."""
    c = pd.read_parquet(OUT / "components.parquet")
    comps = ["cat_within", "range_known", "grp_above", "grp_govt_below", "grp_non_govt_below", "grp_sa_5k1",
             "grp_edp_5k3"]
    for fy in range(2014, 2018):
        a = c[(c.fy == fy) & (c.scheme == "booker") & (c.component.isin(comps))]
        b = c[(c.fy == fy) & (c.scheme == "sentrnge_sup") & (c.component.isin(comps))]
        ka = a.set_index(["district_id", "component"])["value"].sort_index()
        kb = b.set_index(["district_id", "component"])["value"].sort_index()
        assert ka.equals(kb), fy
        j = c[(c.fy == fy) & (c.scheme == "sentrnge_sup") & (c.component.isin(["join_records", "join_matched"]))]
        jj = j.pivot_table(index="district_id", columns="component", values="value")
        assert (jj["join_records"] == jj["join_matched"]).all()


def test_counts_consistent(obs):
    p = obs.pivot_table(index=["district_id", "period"], columns="variable", values="value")
    d = p[p.index.get_level_values("period") >= 2002]
    cnt = [c for c in p.columns if c.startswith("ussc_count_offense_")]
    assert (d[cnt].sum(axis=1) == d["ussc_cases_offense_known"]).all()
    assert (d["ussc_cases_offense_known"] <= d["ussc_cases_total"]).all()
    assert (d["ussc_cases_range_known"] <= d["ussc_cases_total"]).all()


# --------------------------------------------------------------- national totals --------
NATIONAL = {  # fiscal year: (individuals sentenced, packet/Sourcebook national figure)
    1995: 38500, 2001: 59897, 2002: 64366, 2004: 70068, 2006: 72585, 2010: 83946, 2012: 84173,
    2017: 66873, 2018: 69425, 2020: 64565, 2025: 66662,
}


@pytest.mark.parametrize("fy,n", sorted(NATIONAL.items()))
def test_national_case_totals_match_published(nat, fy, n):
    assert value(nat, "US", fy, "ussc_cases_total") == n


def test_national_figures_reproduce_packets(val):
    us = val[val["district_id"] == "US"]
    assert set(us["fy"]) == set(range(2002, 2026))
    assert us["match"].all(), us[~us["match"]]
    # national within-range and mean sentence, FY2025 packet Tables 7 and 8 / Sourcebook Table 30
    row = us[(us["fy"] == 2025) & (us["measure"] == "cat_within_pct") & us["table"].str.startswith("Table 8")]
    assert float(row["published"].iloc[0]) == 51.5
    row = us[(us["fy"] == 2025) & (us["measure"] == "sent2018_mean")]
    assert float(row["published"].iloc[0]) == 47


def test_packet_fallback_years_consistent(obs, nat):
    """FY1995-FY2001 come from packets: district values must add up to the national figures."""
    for fy in range(1995, 2002):
        rk = obs[(obs["period"] == fy) & (obs["variable"] == "ussc_cases_range_known")]
        assert len(rk) == 94 and rk["value"].sum() == value(nat, "US", fy, "ussc_cases_range_known")
    for fy in (2000, 2001):
        for var in ("ussc_cases_total", "ussc_cases_offense_known"):
            s = obs[(obs["period"] == fy) & (obs["variable"] == var)]
            assert len(s) == 94 and s["value"].sum() == value(nat, "US", fy, var)
    p = obs[obs["period"] < 2002].pivot_table(index=["district_id", "period"], columns="variable", values="value")
    assert not (p["ussc_cases_range_known"] > p["ussc_cases_total"]).any()
    assert not (p["ussc_cases_offense_known"] > p["ussc_cases_total"]).any()
    assert set(obs[obs["period"] < 2002]["basis"]) <= {"published_packet", "derived_from_published_counts"}


def test_national_sum_of_districts(obs, nat):
    for fy in (2002, 2010, 2025):
        tot = obs[(obs["period"] == fy) & (obs["variable"] == "ussc_cases_total")]["value"].sum()
        assert tot == value(nat, "US", fy, "ussc_cases_total")


# ------------------------------------------------------------------ validation ----------
def test_every_published_value_reproduced(val):
    assert len(val) > 50000
    bad = val[~val["match"]]
    assert bad.empty, bad.head(20).to_string()


def test_all_district_tables_checked_every_year(val):
    t = val[val["table"].str.contains("by district")]
    per = t.groupby("fy")["district_id"].nunique()
    assert set(per.index) == set(range(2002, 2026))
    assert (per >= 94).all()     # 94 districts (+ 'US')


def test_district_level_sample_spans_eras(val):
    d = val[~val["table"].str.contains("by district") & (val["district_id"] != "US")]
    dy = d[["fy", "district_id"]].drop_duplicates()
    assert len(dy) >= 12
    for era in [(2002, 2004), (2005, 2005), (2006, 2010), (2015, 2015), (2019, 2019), (2025, 2025)]:
        assert dy["fy"].between(*era).any(), era
    assert d["table"].str.startswith("Table 7").any() and d["table"].str.startswith("Table 1").any()


# -------------------------------------------------------- hand-checked packet fixtures ----
# (district, FY, packet table, variable, published value)
FIXTURES = [
    # FY2025 E.D. Va. packet: Table 8 (469 of 862 within), Table 7 (63 / 27), Table 1, Table 5
    ("vaed", 2025, "Table 8", "ussc_pct_within_range", 54.4),
    ("vaed", 2025, "Table 8", "ussc_pct_substantial_assistance_5k1", 4.1),
    ("vaed", 2025, "Table 7", "ussc_mean_sentence_months", 63),
    ("vaed", 2025, "Table 7", "ussc_median_sentence_months", 27),
    ("vaed", 2025, "Fig. A", "ussc_cases_total", 884),
    ("vaed", 2025, "Table 1", "ussc_pct_offense_fraud_theft_embezzlement", 15.6),
    ("vaed", 2025, "Table 1", "ussc_count_offense_drug_trafficking", 227),
    ("vaed", 2025, "Table 5", "ussc_pct_prison", 80.2),          # (692 + 17) / 884
    # FY2025 all-district Table 9 (E.D. Va. packet)
    ("med", 2025, "Table 9", "ussc_pct_within_range", 38.9),
    ("mad", 2025, "Table 9", "ussc_pct_early_disposition_5k3", 1.6),
    ("nynd", 2025, "Table 9", "ussc_pct_within_range", 58.9),
    # FY2019 E.D. Va.: Table 8 (782 of 1,200), Table 7 (47 / 12, N 1,211), Table 1 (1,211)
    ("vaed", 2019, "Table 8", "ussc_pct_within_range", 65.2),
    ("vaed", 2019, "Table 8", "ussc_pct_upward_variance", 1.2),
    ("vaed", 2019, "Table 8", "ussc_pct_non_govt_downward_departure", 2.8),
    ("vaed", 2019, "Table 7", "ussc_mean_sentence_months", 47),
    ("vaed", 2019, "Table 1", "ussc_pct_offense_immigration", 18.6),
    # FY2018 E.D. Va.: Table 8 (856 of 1,327), Table 7 (57 / 15)
    ("vaed", 2018, "Table 8", "ussc_pct_within_range", 64.5),
    ("vaed", 2018, "Table 7", "ussc_mean_sentence_months", 57),
    ("vaed", 2018, "Table 7", "ussc_median_sentence_months", 15),
    # FY2017 E.D. Va.: Table 7 (78 / 48, N 771), Table 1
    ("vaed", 2017, "Table 7", "ussc_median_prison_months", 48),
    ("vaed", 2017, "Table 1", "ussc_pct_offense_child_pornography", 4.3),
    ("vaed", 2017, "Table 1", "ussc_count_offense_immigration", 81),
    ("prd", 2017, "Table 9", "ussc_pct_within_range", 66.0),
    # FY2015 E.D. Va.: Table 8 (1,454 cases), Table 7 (67 / 36, N 791), Table 1 (1,461)
    ("vaed", 2015, "Table 8", "ussc_pct_within_range", 69.3),
    ("vaed", 2015, "Table 8", "ussc_pct_non_govt_sponsored_below_range", 22.9),
    ("vaed", 2015, "Table 8", "ussc_pct_early_disposition_5k3", 0.3),
    ("vaed", 2015, "Table 7", "ussc_mean_prison_months", 67),
    ("vaed", 2015, "Table 7", "ussc_cases_prison_term", 791),
    ("vaed", 2015, "Table 1", "ussc_pct_offense_firearms", 7.1),
    # FY2012 E.D. Va. Table 8 (four-way grouping, 1,831 cases)
    ("vaed", 2012, "Table 8", "ussc_pct_within_range", 70.9),
    ("vaed", 2012, "Table 8", "ussc_pct_above_range", 2.5),
    ("vaed", 2012, "Table 8", "ussc_pct_govt_sponsored_below_range", 5.6),
    ("vaed", 2012, "Table 8", "ussc_pct_non_govt_sponsored_below_range", 21.1),
    ("prd", 2010, "Table 9", "ussc_pct_within_range", 73.0),
    # FY2006 E.D. Va. Table 8 (1,424 cases) and Table 7; S.D.N.Y. from Table 9
    ("vaed", 2006, "Table 8", "ussc_pct_within_range", 79.6),
    ("vaed", 2006, "Table 8", "ussc_pct_govt_sponsored_below_range", 5.6),
    ("vaed", 2006, "Table 8", "ussc_pct_substantial_assistance_5k1", 5.2),
    ("vaed", 2006, "Table 7", "ussc_mean_prison_months", 85.7),
    ("nysd", 2006, "Table 9", "ussc_pct_within_range", 58.2),
    ("nysd", 2006, "Table 9", "ussc_pct_substantial_assistance_5k1", 13.5),
    # FY2004 E.D. Va. Table 1 (full year; 2,097 cases, 2,085 with offense)
    ("vaed", 2004, "Table 1", "ussc_cases_total", 2097),
    ("vaed", 2004, "Table 1", "ussc_pct_offense_drug_trafficking", 31.8),
    ("vaed", 2004, "Table 1", "ussc_pct_offense_immigration", 7.2),
    # FY2003 all-district Table 8
    ("med", 2003, "Table 8", "ussc_pct_within_range", 77.8),
    ("med", 2003, "Table 8", "ussc_pct_substantial_assistance_5k1", 19.2),
    # FY2002 E.D. Va. (Table 8 row, Table 7) and Connecticut (Table 8)
    ("vaed", 2002, "Table 8", "ussc_pct_within_range", 89.9),
    ("vaed", 2002, "Table 7", "ussc_mean_prison_months", 79.0),
    ("vaed", 2002, "Table 7", "ussc_median_prison_months", 46.0),
    ("ctd", 2002, "Table 8", "ussc_pct_within_range", 53.7),
    # FY1995-FY2001 packet fallback
    ("med", 1995, "Table 8", "ussc_pct_within_range", 72.3),
    ("nhd", 1995, "Table 8", "ussc_pct_substantial_assistance_5k1", 54.2),
    ("vaed", 1995, "Table 7", "ussc_mean_prison_months", 84.1),
    ("vaed", 1995, "Table 1", "ussc_cases_total", 933),
    ("vaed", 1995, "Table 1", "ussc_pct_offense_fraud", 14.1),
    ("mad", 1998, "Table 8", "ussc_pct_within_range", 56.0),
    ("prd", 2001, "Table 8", "ussc_pct_within_range", 85.9),
    ("vaed", 2001, "Table 7", "ussc_median_prison_months", 55.5),
    ("vaed", 2001, "Table 1", "ussc_count_offense_drug_trafficking", 560),
]


@pytest.mark.parametrize("did,fy,table,var,published", FIXTURES)
def test_packet_fixture(obs, did, fy, table, var, published):
    got = value(obs, did, fy, var)
    tol = 0.5 if (var.startswith("ussc_mean") or var.startswith("ussc_median")) and fy >= 2011 else 0.051
    if var.startswith("ussc_count") or var.startswith("ussc_cases"):
        tol = 0
    assert abs(got - published) <= tol, (did, fy, table, var, published, got)


def test_fixture_spread():
    dy = {(d, y) for d, y, *_ in FIXTURES}
    assert len(dy) >= 12
    years = {y for _, y in dy}
    for need in ({2003, 2004}, set(range(2006, 2011)), {2015}, {2019}, {2025}):
        assert need & years, need
