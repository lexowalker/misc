"""Tests for the judges lane (run after `python -m pipeline.judges.build`).

Known-fact values below were read from the FJC federal-judicial-service.csv itself (Nov. 26, 2026 export),
and each test also re-reads the raw CSV row and compares it with the processed output.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

import pandas as pd
import pytest

from pipeline.common.districts import BY_ID, DISTRICTS, TERRITORIAL
from pipeline.judges.crosswalk import HISTORICAL, VARIANTS, article3_names, map_court

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "judges"
SOURCES = json.loads((ROOT / "data" / "sources" / "judges.json").read_text())
ARTICLE3 = {d.id for d in DISTRICTS if d.id not in TERRITORIAL}
DATE_COLS = ["Recess Appointment Date", "Nomination Date", "Confirmation Date", "Commission Date",
             "Senior Status Date", "Termination Date"]


def _raw_path(sid: str) -> Path:
    p = ROOT / SOURCES[sid]["local_path"]
    if not p.exists():
        pytest.skip(f"raw download cache missing ({p}); run the build first")
    return p


@pytest.fixture(scope="module")
def raw() -> pd.DataFrame:
    df = pd.read_csv(_raw_path("fjc_federal_judicial_service_csv"), dtype=str, keep_default_na=False,
                     na_values=[""])
    return df.apply(lambda s: s.str.strip() if s.dtype == object or str(s.dtype).startswith("str") else s)


@pytest.fixture(scope="module")
def dj() -> pd.DataFrame:
    return pd.read_csv(OUT / "district_judges.csv", dtype=str, keep_default_na=False, na_values=[""])


@pytest.fixture(scope="module")
def obs() -> pd.DataFrame:
    return pd.read_parquet(OUT / "observations.parquet")


# ------------------------------------------------------------------------------------------- crosswalk
def test_crosswalk_names_every_article3_district_once():
    names = article3_names()
    modern = {k: v for k, v in names.items() if k not in VARIANTS}
    assert sorted(modern.values()) == sorted(ARTICLE3)          # 91 districts, one modern name each
    assert len(modern) == 91
    assert not (set(names.values()) & TERRITORIAL)
    for d in DISTRICTS:
        if d.id in ARTICLE3:
            assert map_court(f"U.S. District Court for the {d.name}") == (d.id, "current")


def test_territorial_courts_are_not_mapped():
    for did in TERRITORIAL:
        with pytest.raises(KeyError):
            map_court(f"U.S. District Court for the {BY_ID[did].name}")


def test_every_fjc_district_court_name_is_classified(raw):
    dc = raw[raw["Court Type"] == "U.S. District Court"]
    for name in dc["Court Name"].unique():
        did, status = map_court(name)  # raises on an unknown name
        assert (did is None) == (status == "historical")
    assert set(HISTORICAL).isdisjoint(article3_names())


def test_every_district_court_record_maps_to_an_id(raw, dj):
    dc = raw[raw["Court Type"] == "U.S. District Court"]
    hist = pd.read_csv(OUT / "historical_court_service.csv", dtype=str)
    assert len(dj) + len(hist) == len(dc)
    assert dj["district_id"].notna().all()
    assert set(dj["district_id"]) == ARTICLE3                  # every Article III district has records
    expected = dc["Court Name"].map(lambda n: map_court(n)[0])
    assert int(expected.notna().sum()) == len(dj)
    # record counts per FJC court name agree
    a = dc[expected.notna()]["Court Name"].value_counts().sort_index()
    b = dj["fjc_court_name"].value_counts().sort_index()
    assert a.equals(b)
    assert hist["district_id"].isna().all()


def test_dc_variant_maps_to_dcd(dj):
    v = dj[dj["fjc_court_name"].str.contains("Supreme Court of the District of Columbia")]
    assert len(v) > 0 and set(v["district_id"]) == {"dcd"}


def test_crosswalk_csv_complete():
    x = pd.read_csv(OUT / "court_crosswalk.csv", dtype=str, keep_default_na=False)
    cur = x[x["status"] != "historical"]
    assert set(cur["district_id"]) == ARTICLE3
    assert (x[x["status"] == "historical"]["district_id"] == "").all()


# ------------------------------------------------------------------------------------------- known facts
KNOWN = [
    # (nid, district_id, appointing_president, party, nomination, confirmation, commission, senior,
    #  termination_reason, termination_date, seat)
    ("1388091", "nysd", "George H.W. Bush", "Republican", "1991-11-27", "1992-08-11", "1992-08-12", None,
     "Appointment to Another Judicial Position", "1998-10-13", "NYSD0307"),          # Sonia Sotomayor
    ("1394151", "dcd", "Barack Obama", "Democratic", "2013-01-04", "2013-03-23", "2013-03-26", None,
     "Appointment to Another Judicial Position", "2021-06-17", "DCD1405"),           # Ketanji Brown Jackson
    ("1385436", "nysd", "Lyndon B. Johnson", "Democratic", "1966-01-26", "1966-08-30", "1966-08-30",
     "1986-09-30", "Death", "2005-09-28", "NYSD0503"),                               # Constance Baker Motley
    ("1382831", "almd", "Dwight D. Eisenhower", "Republican", "1956-01-12", "1956-01-31", "1956-02-01", None,
     "Appointment to Another Judicial Position", "1979-07-12", "ALMD0110"),          # Frank M. Johnson Jr.
    ("1381766", "nysd", "William H. Taft", "Republican", "1909-04-01", "1909-04-26", "1909-04-26", None,
     "Appointment to Another Judicial Position", "1924-12-29", "NYSD0401"),          # Learned Hand
    ("1378271", "vaed", "William J. Clinton", "Democratic", "1993-08-06", "1993-10-18", "1993-10-20", None,
     None, None, "VAED0702"),                                                        # Leonie M. Brinkema
]


@pytest.mark.parametrize("fact", KNOWN, ids=[k[0] for k in KNOWN])
def test_known_judges(fact, raw, dj):
    nid, did, pres, party, nom, conf, comm, senior, treason, tdate, seat = fact
    row = dj[(dj["fjc_nid"] == nid) & (dj["district_id"] == did)]
    assert len(row) == 1
    r = row.iloc[0]
    got = (r["appointing_president"], r["appointing_party"], r["nomination_date"], r["confirmation_date"],
           r["commission_date"], r["senior_status_date"], r["termination_reason"], r["termination_date"],
           r["seat_id"])
    want = (pres, party, nom, conf, comm, senior, treason, tdate, seat)
    assert tuple(None if pd.isna(v) else v for v in got) == want
    # and the raw CSV row says the same thing
    src = raw[(raw["nid"] == nid) & (raw["Court Name"] == r["fjc_court_name"])]
    assert len(src) == 1
    s = src.iloc[0]
    raw_vals = (s["Appointing President"], s["Party of Appointing President"], s["Nomination Date"],
                s["Confirmation Date"], s["Commission Date"], s["Senior Status Date"], s["Termination"],
                s["Termination Date"], s["Seat ID"])
    assert tuple(None if pd.isna(v) else v for v in raw_vals) == want


def test_frank_johnson_recess_appointment(dj):
    r = dj[(dj["fjc_nid"] == "1382831") & (dj["district_id"] == "almd")].iloc[0]
    assert r["recess_appointment"] == "True"
    assert r["recess_appointment_date"] == "1955-10-22"
    assert r["service_start_date"] == "1955-10-22"     # earlier of recess and commission dates


def test_reassigned_senior_judge(dj):
    # William M. Byrne Sr.: senior in S.D. Cal. (1966-06-30), reassigned to C.D. Cal. 1966-09-18 (seat CACDSR)
    r = dj[(dj["fjc_nid"] == "1378666") & (dj["district_id"] == "cacd")].iloc[0]
    assert r["appointing_party"] == "None (reassignment)"
    assert r["resolved_appointing_party"] == "Democratic"
    assert r["resolved_appointing_president"] == "Harry S Truman"
    assert pd.isna(r["senior_status_date"])
    assert r["effective_senior_status_date"] == "1966-09-18"
    assert r["senior_status_basis"] == "senior_before_reassignment"


def test_reassignment_party_resolution(dj):
    none = dj[dj["appointing_party"].isin(["None (reassignment)", "None (assignment)"])]
    assert len(none) > 0
    assert not none["resolved_appointing_party"].isin(["None (reassignment)", "None (assignment)"]).any()
    assert none["party_resolution"].str.startswith("from_prior_record_seq_").all()
    r = dj[(dj["fjc_nid"] == "1382036") & (dj["district_id"] == "scd")].iloc[0]   # R. W. Hemphill
    assert r["resolved_appointing_party"] == "Democratic"


def test_no_duty_station_and_no_photos(dj):
    assert dj["duty_station"].isna().all()
    for s in SOURCES.values():
        assert not s["url"].lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp"))
        assert "photo" not in s["url"].lower() and "image" not in s["url"].lower()
    assert not any("photo" in c or "image" in c for c in dj.columns)


# ------------------------------------------------------------------------------------------- counts
def _independent_counts(raw: pd.DataFrame, did: str, year: int) -> tuple[int, int]:
    """Recount from the raw CSV with a separate, simple implementation."""
    names = [n for n, d in article3_names().items() if d == did]
    g = raw[raw["Court Name"].isin(names)].copy()
    for c in DATE_COLS:
        g[c] = pd.to_datetime(g[c])
    D = pd.Timestamp(year, 9, 30)
    start = g[["Recess Appointment Date", "Commission Date"]].min(axis=1)
    if did == "scd":
        g = g[start >= pd.Timestamp("1965-11-01")]
        start = start[g.index]
    term = g["Termination Date"]
    in_service = (start <= D) & (term.isna() | (term > D))
    senior_from = g["Senior Status Date"].where(~g["Seat ID"].fillna("").str.endswith("SR"), start)
    is_senior = senior_from.notna() & (senior_from <= D)
    active = set(g.loc[in_service & ~is_senior, "nid"])
    senior = set(g.loc[in_service & is_senior, "nid"]) - active
    return len(active), len(senior)


def test_counts_match_independent_recount(raw, obs):
    rng = random.Random(20261127)
    piv = obs.pivot_table(index=["district_id", "period"], columns="variable", values="value")
    keys = list(piv.index)
    sample = rng.sample(keys, 150) + [("vaed", 2024), ("cacd", 1967), ("scd", 1966), ("dcd", 1950),
                                      ("nysd", 1986), ("nysd", 1987)]
    for did, y in sample:
        a, s = _independent_counts(raw, did, y)
        assert piv.loc[(did, y), "judges_active"] == a, (did, y)
        assert piv.loc[(did, y), "judges_senior"] == s, (did, y)


def test_motley_moves_to_senior(obs, dj):
    # Constance Baker Motley took senior status on 1986-09-30: active on 1985-09-30, senior on 1986-09-30
    piv = obs[obs["district_id"] == "nysd"].pivot_table(index="period", columns="variable", values="value")
    assert piv.loc[1986, "judges_senior"] >= 1


def test_party_counts_sum_to_active(obs):
    piv = obs.pivot_table(index=["district_id", "period"], columns="variable", values="value")
    assert (piv["judges_active_appointed_dem"] + piv["judges_active_appointed_rep"] == piv["judges_active"]).all()


def test_observation_coverage(obs):
    summ = json.loads((OUT / "build_summary.json").read_text())
    last = summ["snapshot_years"][1]
    assert set(obs["district_id"]) == ARTICLE3
    assert set(obs["period_type"]) == {"SNAPSHOT_SEP30"}
    assert obs["value"].ge(0).all() and (obs["value"] % 1 == 0).all()
    late = {"akd": 1960, "hid": 1961, "prd": 1967, "scd": 1966, "cacd": 1966, "caed": 1966, "flmd": 1963,
            "lamd": 1972, "ilcd": 1979}
    for did in ARTICLE3:
        years = sorted(obs[(obs["district_id"] == did) & (obs["variable"] == "judges_active")]["period"])
        first = late.get(did, 1950)
        assert years == list(range(first, last + 1)), did
    assert obs["source_id"].isin(SOURCES).all()


def test_variables_json(obs):
    v = json.loads((OUT / "variables.json").read_text())
    ids = {x["id"] for x in v}
    assert ids == set(obs["variable"])
    for x in v:
        assert x["derived"] is True and x["formula"]
        assert x["period_type"] == "SNAPSHOT_SEP30"
        for k in ["id", "label", "unit", "period_type", "description", "source_ids", "caveats", "higher_means"]:
            assert x[k]
        assert set(x["source_ids"]) <= set(SOURCES)


def test_sources_have_provenance():
    for sid, s in SOURCES.items():
        assert s["url"].startswith("https://www.fjc.gov/"), sid
        assert s["sha256"] and s["retrieved_at"] and s["vintage"], sid


def test_leghist_pages_support_series_starts(dj):
    from pipeline.judges.build import LEGHIST, LEGHIST_SOURCE_ID, _text
    from pipeline.common.http import fetch
    for did, (url, phrase, iso) in LEGHIST.items():
        p = ROOT / SOURCES[LEGHIST_SOURCE_ID[did]]["local_path"]
        if not p.exists():
            pytest.skip("raw cache missing")
        assert phrase in _text(fetch(url))
        g = dj[(dj["district_id"] == did) & (dj["before_current_incarnation"] == "False")]
        assert g["service_start_date"].min() >= iso
