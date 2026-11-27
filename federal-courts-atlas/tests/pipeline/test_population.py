"""Tests for the population lane (run after `python -m pipeline.population.build`).

The reconciliation test re-reads the published U.S. and Puerto Rico totals straight from the raw Census
files with code independent of pipeline.population.parse, then checks that the district sums add up exactly.
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path

import pandas as pd
import pytest

from pipeline.common.districts import BY_ID, IDS, TERRITORIAL

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "population"
BND = ROOT / "data" / "processed" / "boundaries"
SOURCES = json.loads((ROOT / "data" / "sources" / "population.json").read_text())
STATES_DC = sorted(set(IDS) - TERRITORIAL - {"prd"})


def raw(sid: str) -> Path:
    p = ROOT / SOURCES[sid]["local_path"]
    if not p.exists():
        pytest.skip(f"raw download cache missing ({p})")
    return p


@pytest.fixture(scope="module")
def cp() -> pd.DataFrame:
    return pd.read_parquet(OUT / "county_population.parquet")


@pytest.fixture(scope="module")
def obs() -> pd.DataFrame:
    return pd.read_parquet(OUT / "observations.parquet")


# ------------------------------------------------------------------- independent reads of published totals
def _csv(sid, **kw):
    for enc in ("utf-8", "latin-1"):
        try:
            return pd.read_csv(raw(sid), dtype=str, encoding=enc, **kw)
        except UnicodeDecodeError:
            pass


def published_us_pr() -> dict[tuple[str, int], tuple[int, int | None]]:
    out = {}
    st = _csv("census_st_est00int_alldata")
    us00 = st[(st.STATE == "0") & (st.SEX == "0") & (st.ORIGIN == "0") & (st.RACE == "0") & (st.AGEGRP == "0")].iloc[0]
    prc = _csv("census_prc_est00int_agesex")
    pr00 = prc[(prc.SEX == "0") & (prc.AGE == "999")].iloc[0]
    for y in range(2000, 2010):
        out[("JUL1_EST", y)] = (int(us00[f"POPESTIMATE{y}"]), int(pr00[f"POPESTIMATE{y}"]))
    nc = _csv("census_nc_est2020int_agesex_res")
    us10 = nc[(nc.SEX == "0") & (nc.AGE == "999")].iloc[0]
    for y in range(2010, 2020):
        out[("JUL1_EST", y)] = (int(us10[f"POPESTIMATE{y}"]), None)
    nst = _csv("census_nst_est2025_alldata")
    us20 = nst[nst.SUMLEV == "010"].iloc[0]
    pr20 = nst[nst.STATE == "72"].iloc[0]
    for y in range(2020, 2026):
        out[("JUL1_EST", y)] = (int(us20[f"POPESTIMATE{y}"]), int(pr20[f"POPESTIMATE{y}"]))

    def dp2000(sid, sumlev):
        z = zipfile.ZipFile(raw(sid))
        for rec in csv.reader(io.TextIOWrapper(z.open(z.namelist()[0]), encoding="latin-1")):
            if rec[1] == sumlev and rec[2] == "00":
                return int(rec[15])
    out[("APR1_CENSUS", 2000)] = (dp2000("census2000_dp_all_states", "010"), dp2000("census2000_dp_pr", "040"))

    def geo2010(sid, sumlev):
        z = zipfile.ZipFile(raw(sid))
        g = [n for n in z.namelist() if "geo2010" in n][0]
        for line in z.read(g).decode("latin-1").splitlines():
            if line[8:11] == sumlev and line[11:13] == "00":
                return int(line[318:327])
    out[("APR1_CENSUS", 2010)] = (geo2010("census2010_dp_us", "010"), geo2010("census2010_dp_pr", "040"))

    def geo2020(sid, sumlev):
        z = zipfile.ZipFile(raw(sid))
        g = [n for n in z.namelist() if "geo2020" in n][0]
        for line in io.TextIOWrapper(z.open(g), encoding="latin-1"):
            f = line.split("|")
            if f[2] == sumlev and f[4] == "00":
                return int(f[90])  # POP100 (field 91 of the geographic header)
    out[("APR1_CENSUS", 2020)] = (geo2020("census2020_pl_us", "010"), geo2020("census2020_pl_pr", "040"))
    return out


def test_reconciliation_sum_of_districts_equals_us_plus_pr(obs, cp):
    pub = published_us_pr()
    keys = sorted(set(zip(obs["period_type"], obs["period"])))
    assert keys == sorted(pub)                               # every year has a published total, and vice versa
    for (pt, y), (us, pr) in pub.items():
        o = obs[(obs.period_type == pt) & (obs.period == y)]
        districts = int(o.loc[~o.district_id.isin(TERRITORIAL), "value"].sum())
        if pr is None:   # 2010-2019 intercensal: no separate PR total published; use the municipio file's sum
            pr = int(cp[(cp.period_type == pt) & (cp.period == y) & (cp.state_fips == "72")]["value"].sum())
        assert districts == us + pr, (pt, y, districts, us, pr)
        # and the states+DC part alone equals the published U.S. total
        part = int(o.loc[o.district_id.isin(STATES_DC), "value"].sum())
        assert part == us, (pt, y)
        assert int(o.loc[o.district_id == "prd", "value"].sum()) == pr, (pt, y)


def test_known_published_totals():
    pub = published_us_pr()
    assert pub[("APR1_CENSUS", 2020)] == (331449281, 3285874)
    assert pub[("APR1_CENSUS", 2010)] == (308745538, 3725789)
    assert pub[("APR1_CENSUS", 2000)] == (281421906, 3808610)


def test_reconciliation_from_committed_outputs(obs):
    """Cache-independent version: district sums vs the published totals recorded in reconciliation.csv."""
    r = pd.read_csv(OUT / "reconciliation.csv")
    for row in r.itertuples(index=False):
        o = obs[(obs.period_type == row.period_type) & (obs.period == row.period)]
        pr = row.published_pr_total if pd.notna(row.published_pr_total) else row.sum_municipios_pr
        assert int(o.loc[~o.district_id.isin(TERRITORIAL), "value"].sum()) == int(row.published_us_total + pr)
        assert int(o.loc[o.district_id.isin(STATES_DC), "value"].sum()) == int(row.published_us_total)


def test_reconciliation_csv_is_clean():
    r = pd.read_csv(OUT / "reconciliation.csv")
    assert len(r) == 29                                      # 26 July 1 years + 3 censuses
    assert (r["diff_districts_minus_published"] == 0).all()
    assert (r["diff_counties_minus_us"] == 0).all()
    assert (r["diff_municipios_minus_pr"].fillna(0) == 0).all()
    assert (r["diff_territories"].fillna(0) == 0).all()
    s = pd.read_csv(OUT / "state_reconciliation.csv")
    assert (s["diff"] == 0).all() and len(s) > 1000


def test_territory_census_totals(obs):
    o = obs[obs.period_type == "APR1_CENSUS"].pivot_table(index="district_id", columns="period", values="value")
    # values read from the Census Island Areas tables (cb11cn17x xls for 2000/2010, phc table 1 for 2020)
    assert o.loc["gud"].tolist() == [154805, 159358, 153836]
    assert o.loc["vid"].tolist() == [108612, 106405, 87146]
    assert o.loc["nmid"].tolist() == [69221, 53883, 47329]
    assert o.loc["dcd"].tolist() == [572059, 601723, 689545]
    assert o.loc["prd"].tolist() == [3808610, 3725789, 3285874]


# ------------------------------------------------------------------- mapping
def _mapping() -> dict[str, str]:
    cd = pd.read_csv(BND / "county_district.csv", dtype=str, keep_default_na=False)
    lg = pd.read_csv(BND / "legacy_geoids.csv", dtype=str, keep_default_na=False)
    m = dict(zip(cd.geoid, cd.district_id))
    m.update(dict(zip(lg.legacy_geoid, lg.district_id)))
    return m


def test_every_county_row_maps_to_exactly_one_district(cp):
    m = _mapping()
    assert not cp.duplicated(["geoid", "period", "period_type"]).any()
    assert cp["district_id"].isin(set(BY_ID)).all()
    assert (cp["geoid"].map(m) == cp["district_id"]).all()
    assert not cp["geoid"].str.startswith("60").any()        # American Samoa: no district, not included


def test_county_row_counts_match_raw_files(cp):
    n = cp.groupby(["period_type", "period"]).size()
    co25 = _csv("census_co_est2025_alldata", usecols=["SUMLEV"])
    co00 = _csv("census_co_est00int_tot", usecols=["SUMLEV"])
    i20 = _csv("census_cc_est2020int_agesex_all", usecols=["YEAR"])
    for y in range(2020, 2026):
        assert n[("JUL1_EST", y)] == (co25.SUMLEV == "050").sum() + 78
    for y in range(2010, 2020):
        assert n[("JUL1_EST", y)] == (i20.YEAR == str(y - 2008)).sum() + 78
    for y in range(2000, 2010):
        assert n[("JUL1_EST", y)] == (co00.SUMLEV.str.zfill(3) == "050").sum() + 78
    assert n[("APR1_CENSUS", 2000)] == 3141 + 78 + 8           # counties + PR municipios + island units
    assert n[("APR1_CENSUS", 2010)] == 3143 + 78 + 8
    assert n[("APR1_CENSUS", 2020)] == 3143 + 78 + 8


def test_district_values_are_county_sums(cp, obs):
    s = cp.groupby(["district_id", "period", "period_type"])["value"].sum()
    o = obs.set_index(["district_id", "period", "period_type"])["value"]
    assert len(s) == len(o)
    assert (s.reindex(o.index).astype(float) == o).all()


def _years(cp, geoid, pt):
    return sorted(cp[(cp.geoid == geoid) & (cp.period_type == pt)]["period"].tolist())


def test_connecticut_legacy_counties_and_planning_regions(cp):
    legacy = [f"090{c:02d}" for c in range(1, 16, 2)]
    regions = [f"09{c}" for c in range(110, 191, 10)]
    for g in legacy:
        assert _years(cp, g, "JUL1_EST") == list(range(2000, 2020))
        assert _years(cp, g, "APR1_CENSUS") == [2000, 2010, 2020]
    for g in regions:
        assert _years(cp, g, "JUL1_EST") == list(range(2020, 2026))
    assert set(cp[cp.state == "CT"]["district_id"]) == {"ctd"}


def test_virginia_alaska_south_dakota_changes(cp):
    assert _years(cp, "51515", "JUL1_EST") == list(range(2000, 2010))     # Bedford city, merged 2013
    assert _years(cp, "51515", "APR1_CENSUS") == [2000, 2010]
    assert _years(cp, "51560", "APR1_CENSUS") == [2000]                   # Clifton Forge city (Census 2000)
    assert _years(cp, "46113", "JUL1_EST") == list(range(2000, 2010))     # Shannon -> Oglala Lakota 46102
    assert _years(cp, "46102", "JUL1_EST") == list(range(2010, 2026))
    assert _years(cp, "02261", "APR1_CENSUS") == [2000, 2010]             # Valdez-Cordova, split 2019
    assert _years(cp, "02063", "JUL1_EST") == list(range(2010, 2026))     # Chugach
    assert _years(cp, "02201", "APR1_CENSUS") == [2000]                   # Prince of Wales-Outer Ketchikan
    assert set(cp.loc[cp.geoid.isin(["51515", "51560"]), "district_id"]) == {"vawd"}
    assert set(cp.loc[cp.geoid.isin(["46113", "46102"]), "district_id"]) == {"sdd"}
    assert set(cp.loc[cp.state == "AK", "district_id"]) == {"akd"}


def test_split_counties_flagged(cp):
    sp = pd.read_csv(BND / "split_counties.csv", dtype=str)
    flagged = set(cp.loc[cp.split_county, "geoid"])
    assert flagged == set(sp.geoid)
    m = dict(zip(sp.geoid, sp.county_district))
    for g, d in m.items():
        assert set(cp.loc[cp.geoid == g, "district_id"]) == {d}


def test_carveout_block_table(cp):
    t = pd.read_csv(OUT / "carveout_blocks_2020.csv", dtype={"county_geoid": str})
    sp = pd.read_csv(BND / "split_counties.csv", dtype=str)
    assert set(t.county_geoid) == set(sp.geoid)
    c20 = cp[(cp.period_type == "APR1_CENSUS") & (cp.period == 2020)].set_index("geoid")["value"]
    assert (t.county_population_2020.values == t.county_geoid.map(c20).values).all()   # blocks sum to the county
    assert (t.carve_out_population_2020 <= t.county_population_2020).all()
    assert (t.carve_out_population_2020 >= 0).all() and (t.blocks_in_carve_out <= t.blocks_in_county).all()


# ------------------------------------------------------------------- coverage, variables, sources
def test_coverage(obs):
    est = obs[obs.variable == "population_estimate"]
    cen = obs[obs.variable == "population_census"]
    assert set(est.period_type) == {"JUL1_EST"} and set(cen.period_type) == {"APR1_CENSUS"}
    assert set(est.district_id) == set(IDS) - TERRITORIAL
    for d, g in est.groupby("district_id"):
        assert sorted(g.period) == list(range(2000, 2026)), d
    assert set(cen.district_id) == set(IDS)
    for d, g in cen.groupby("district_id"):
        assert sorted(g.period) == [2000, 2010, 2020], d
    assert (obs.value > 0).all() and (obs.value % 1 == 0).all()


def test_variables_json(obs):
    v = json.loads((OUT / "variables.json").read_text())
    assert {x["id"] for x in v} == set(obs.variable)
    for x in v:
        for k in ["id", "label", "unit", "period_type", "description", "source_ids", "caveats", "higher_means", "formula"]:
            assert x[k]
        assert x["derived"] is True
        assert set(x["source_ids"]) <= set(SOURCES)
        assert set(obs.loc[obs.variable == x["id"], "source_id"]) <= set(x["source_ids"])


def test_sources_have_provenance(obs):
    assert set(obs.source_id) <= set(SOURCES)
    for sid, s in SOURCES.items():
        assert s["url"].startswith("https://www2.census.gov/"), sid
        assert s["sha256"] and s["retrieved_at"] and s["vintage"], sid
        p = ROOT / s["local_path"]
        if p.exists():
            assert b"Request Rejected" not in p.read_bytes()[:2048], sid


def test_gaps_recorded():
    g = json.loads((ROOT / "data" / "gaps" / "population.json").read_text())
    assert set(g["island_areas_no_annual_estimates"]["districts"]) == TERRITORIAL
    assert "split_county_carveout_population" in g
