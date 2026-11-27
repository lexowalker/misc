"""Tests on the built FCMS outputs (run `python -m pipeline.fcms.build` first)."""
from __future__ import annotations

import json
import re

import pandas as pd
import pytest

from pipeline.common.districts import IDS, TERRITORIAL
from pipeline.common.http import PROJECT_ROOT

OUT = PROJECT_ROOT / "data" / "processed" / "fcms"
pytestmark = pytest.mark.skipif(not (OUT / "observations.parquet").exists(), reason="fcms build not run")


@pytest.fixture(scope="module")
def obs():
    a = pd.read_parquet(OUT / "observations.parquet")
    b = pd.read_parquet(OUT / "observations_ranks.parquet")
    return pd.concat([a, b], ignore_index=True)


@pytest.fixture(scope="module")
def nat():
    return pd.read_parquet(OUT / "national.parquet")


@pytest.fixture(scope="module")
def vint():
    return pd.read_parquet(OUT / "vintages.parquet")


@pytest.fixture(scope="module")
def gaps():
    return json.loads((PROJECT_ROOT / "data" / "gaps" / "fcms.json").read_text())


def _get(obs, did, year, var):
    r = obs[(obs.district_id == did) & (obs.period == year) & (obs.variable == var)]
    return r


# Values read by eye from the PDFs (rendered page images / pdftotext -layout), with page numbers.
HAND_CHECKED = [
    # (district, FY, variable, value, PDF page in that FY's profile, profile FY)
    ("dcd", 2025, "fcms_filings_total", 4784, 2, 2025),
    ("dcd", 2025, "fcms_median_months_civil_filing_to_disposition", 7.7, 2, 2025),
    ("dcd", 2025, "fcms_civil_type_civil_rights", 1162, 2, 2025),
    ("dcd", 2025, "fcms_rank_us_filings_per_judgeship_total", 82, 2, 2025),
    ("dcd", 2015, "fcms_weighted_filings_per_judgeship", 178, 2, 2015),
    ("dcd", 2015, "fcms_rank_us_median_months_civil_filing_to_disposition", 33, 2, 2015),
    ("dcd", 2011, "fcms_civil_over_3yrs_count", 490, 2, 2011),
    ("dcd", 2011, "fcms_civil_over_3yrs_pct", 18.2, 2, 2011),
    ("dcd", 2011, "fcms_rank_us_pct_change_filings_5yr", 50, 2, 2011),
    ("dcd", 2009, "fcms_jurors_avg_present", 93.88, 2, 2009),
    ("dcd", 2009, "fcms_rank_us_pct_change_filings_1yr", 59, 2, 2009),
    ("dcd", 2009, "fcms_filings_criminal_felony", 313, 2, 2009),
    ("gasd", 2009, "fcms_filings_total", 1334, 95, 2009),
    ("gasd", 2009, "fcms_pct_change_filings_1yr", -1.6, 95, 2009),
    ("gasd", 2009, "fcms_rank_circuit_pct_change_filings_1yr", 7, 95, 2009),
    ("azd", 2025, "fcms_filings_total", 16384, 65, 2025),
    ("caed", 2025, "fcms_pct_change_filings_1yr", 9.8, 67, 2025),
    ("vid", 2025, "fcms_pending_total", 530, 19, 2025),
]


@pytest.mark.parametrize("did,year,var,value,page,profile", HAND_CHECKED)
def test_hand_checked_values(obs, did, year, var, value, page, profile):
    r = _get(obs, did, year, var)
    assert len(r) == 1, (did, year, var)
    assert r.value.iloc[0] == pytest.approx(value)
    assert f" p.{page}:" in r.source_locator.iloc[0]
    assert r.source_id.iloc[0] == f"fcms_fy{profile}"


def test_hand_checked_national(nat):
    # FY2004 national page, back-column 1999 (rendered image); FY2022 national list, letter I printed unprefixed
    r = nat[(nat.period == 1999) & (nat.variable == "fcms_filings_total")]
    assert r.value.iloc[0] == 307997 and "back-column of FY2004" in r.source_locator.iloc[0]
    r = nat[(nat.period == 2022) & (nat.variable == "fcms_civil_type_intellectual_property_rights")]
    assert r.value.iloc[0] == 12742
    r = nat[(nat.period == 2004) & (nat.variable == "fcms_filings_civil")]
    assert r.value.iloc[0] == 281338


def test_suppressed_and_blank_cells_are_omitted_and_logged(obs, gaps):
    assert _get(obs, "azd", 2025, "fcms_pct_change_filings_1yr").empty
    assert _get(obs, "vid", 2025, "fcms_weighted_filings_per_judgeship").empty
    assert _get(obs, "dcd", 2025, "fcms_median_months_civil_filing_to_trial").empty   # printed '-'
    assert _get(obs, "dcd", 2025, "fcms_rank_circuit_filings_per_judgeship_total").empty  # single-district circuit
    covered = _gap_index(gaps)
    for key in [("fcms_pct_change_filings_1yr", "azd", 2025), ("fcms_weighted_filings_per_judgeship", "vid", 2025),
                ("fcms_median_months_civil_filing_to_trial", "dcd", 2025),
                ("fcms_rank_circuit_filings_per_judgeship_total", "dcd", 2025)]:
        assert key in covered, key


def _gap_index(gaps):
    """(variable, district, period) triples covered by cell-level gap records."""
    cov = set()
    for gid, g in gaps.items():
        if not gid.startswith("cells:"):
            continue
        m = re.search(r"\((.*)\)\.$", g["description"])
        for part in m.group(1).split("; "):
            d, ys = part.split(": ")
            for y in ys.split(","):
                cov.add((g["variables"][0], d, int(y)))
    return cov


CORE = ["fcms_filings_total", "fcms_terminations_total", "fcms_pending_total", "fcms_judgeships",
        "fcms_vacant_judgeship_months", "fcms_filings_per_judgeship_total", "fcms_filings_per_judgeship_civil",
        "fcms_filings_per_judgeship_criminal_felony", "fcms_filings_per_judgeship_supervised_release_hearings",
        "fcms_pending_per_judgeship", "fcms_weighted_filings_per_judgeship", "fcms_terminations_per_judgeship",
        "fcms_trials_completed_per_judgeship", "fcms_median_months_criminal_felony_filing_to_disposition",
        "fcms_median_months_civil_filing_to_disposition", "fcms_median_months_civil_filing_to_trial",
        "fcms_civil_over_3yrs_count", "fcms_civil_over_3yrs_pct", "fcms_avg_felony_defendants_per_case",
        "fcms_jurors_avg_present", "fcms_jurors_pct_not_selected"]


def test_core_variables_complete_or_logged(obs, gaps):
    """Every district x FY1999-2025 x core variable is either an observation or a logged gap."""
    have = set(zip(obs.variable, obs.district_id, obs.period))
    covered = _gap_index(gaps)
    years = range(1999, 2026)
    missing = [(v, d, y) for v in CORE for d in IDS for y in years if (v, d, y) not in have and (v, d, y) not in covered]
    assert not missing, missing[:20]


def test_recent_years_full_core_set(obs):
    """FY2016-2025: all 94 districts have every core variable except medians suppressed by the AO and the
    territorial courts' weighted filings (both logged)."""
    exempt_vars = {"fcms_median_months_civil_filing_to_trial", "fcms_median_months_criminal_felony_filing_to_disposition",
                   "fcms_median_months_civil_filing_to_disposition"}
    rec = obs[obs.period >= 2016]
    for v in CORE:
        if v in exempt_vars:
            continue
        g = rec[rec.variable == v].groupby("period").district_id.nunique()
        expect = 91 if v == "fcms_weighted_filings_per_judgeship" else 94
        if v == "fcms_trials_completed_per_judgeship":
            assert (g >= 93).all() and g.drop(2024).eq(94).all(), g   # D.N.M.I. FY2024 cell blank
        else:
            assert (g == expect).all(), (v, g[g != expect])
    assert set(rec[rec.variable == "fcms_weighted_filings_per_judgeship"].district_id) == set(IDS) - TERRITORIAL


def test_reconciliation_with_national_totals():
    rec = pd.read_csv(OUT / "reconciliation.csv")
    assert set(rec.period) == set(range(1999, 2026)) or set(rec.period) >= set(range(2004, 2026))
    assert (rec.n_districts == 94).all()
    bad = rec[rec.diff_sum_minus_national != 0]
    # the only exception: FY2011 profile prints 40,435 nationally but its districts sum to 40,434
    # (the FY2012 profile revises both to 40,439)
    assert [(r.variable, r.period, r.diff_sum_minus_national) for r in bad.itertuples()] == [
        ("fcms_civil_over_3yrs_count", 2011, -1.0)]
    j = rec[rec.variable == "fcms_judgeships"].set_index("period")
    assert j.loc[2025, "national"] == 677 and j.loc[2025, "sum_article_iii"] == 673   # 4 territorial judgeships


def test_percent_change_matches_printed_filings(obs, vint):
    f = vint[vint.row == "filings_total"].set_index(["profile_year", "district_id", "data_year"])["value"]
    pc = obs[obs.variable.str.startswith("fcms_pct_change_filings_")]
    assert len(pc) > 9000
    for r in pc.itertuples():
        k = int(r.variable.rsplit("_", 1)[1][:-2])
        cur, old = f[(r.period, r.district_id, r.period)], f[(r.period, r.district_id, r.period - k)]
        assert abs((cur - old) / old * 100 - r.value) <= 0.051, r


def test_per_judgeship_identities(vint):
    val = pd.read_csv(OUT / "validation.csv")
    # only the FY2000-01 W.D./S.D. W. Va. pending-per-judgeship cells, printed identically in three profiles
    assert set(zip(val.district_id, val.data_year)) == {("wvsd", 2000), ("wvsd", 2001)}
    prof = pd.read_csv(OUT / "profiles.csv").set_index("year")
    piv = vint.pivot_table(index=["profile_year", "district_id", "data_year"], columns="row", values="value")
    piv = piv.reset_index()
    d = piv[piv.profile_year.map(prof["criminal_basis"]) == "defendants"]
    dev = (d.filings_total / d.judgeships - d.pj_total).abs()
    assert (dev <= 0.5 + 1e-9).all()


def test_nos_letters_sum_to_totals():
    nl = pd.read_csv(OUT / "nos_letters.csv")
    for (d, p, k), g in nl.groupby(["district_id", "period", "kind"]):
        tot = g[g.letter == "Total"].value.iloc[0]
        assert g[g.letter != "Total"].value.fillna(0).sum() == tot, (d, p, k)


def test_method_flags(obs):
    f = obs[(obs.variable == "fcms_filings_total")].groupby("period").method.agg(lambda s: set(s))
    for y in range(1999, 2026):
        expect = "crim_cases" if (y <= 2009 or y == 2011) else "crim_defendants"
        assert f[y] == {expect}, y
    w = obs[obs.variable == "fcms_weighted_filings_per_judgeship"].groupby("period").method.agg(lambda s: set(s))
    assert w[2014] == {"weights_old"} and w[2015] == {"weights_2015"}
    assert set(obs[obs.variable == "fcms_filings_per_judgeship_civil"].method) == {""}


def test_current_method_series(vint):
    cm = pd.read_parquet(OUT / "observations_current_method.parquet")
    f = cm[cm.variable == "fcms_filings_total"]
    assert sorted(f.period.unique()) == list(range(2005, 2026))
    assert (f.groupby("period").district_id.nunique() == 94).all()
    # FY2009 on the current method comes from the regenerated FY2010 profile's back-column
    v09 = f[(f.district_id == "dcd") & (f.period == 2009)]
    src = vint[(vint.profile_year == 2010) & (vint.district_id == "dcd") & (vint.row == "filings_total") & (vint.data_year == 2009)]
    assert v09.value.iloc[0] == src.value.iloc[0] and v09.source_id.iloc[0] == "fcms_fy2010"
    w = cm[cm.variable == "fcms_weighted_filings_per_judgeship"]
    assert w.period.min() == 2010 and set(w[w.period == 2012].source_id) == {"fcms_fy2015"}


def test_published_ranks_match_printed_values(obs):
    """The 1-year % change standing ranks the printed 1-year change, largest = 1 (verified every year)."""
    for y in [2006, 2011, 2015, 2020, 2024]:
        v = obs[(obs.period == y) & (obs.variable == "fcms_pct_change_filings_1yr")].set_index("district_id").value
        r = obs[(obs.period == y) & (obs.variable == "fcms_rank_us_pct_change_filings_1yr")].set_index("district_id").value
        calc = v.rank(method="min", ascending=False)
        common = calc.index.intersection(r.index)
        assert (calc[common] == r[common]).mean() >= 0.97, y


def test_variables_json_matches_outputs(obs):
    vj = json.loads((OUT / "variables.json").read_text())
    ids = {v["id"] for v in vj}
    assert ids == set(obs.variable.unique())
    for v in vj:
        for k in ["id", "label", "unit", "period_type", "description", "source_ids", "caveats", "higher_means"]:
            assert v.get(k) not in (None, ""), (v["id"], k)
        assert v["period_type"] == "FY_SEP30"
        assert v["table"] in ("observations", "observations_ranks")
    long = [v for v in vj if v["id"] == "fcms_filings_total"][0]
    assert long["first_period"] == 1999 and long["last_period"] == 2025 and long["n_districts"] == 94


def test_sources_registered_with_hashes(obs):
    src = json.loads((PROJECT_ROOT / "data" / "sources" / "fcms.json").read_text())
    for sid in set(obs.source_id):
        assert sid in src and re.fullmatch(r"[0-9a-f]{64}", src[sid]["sha256"]), sid
        assert src[sid]["url"].startswith("https://www.uscourts.gov/")
    assert {f"fcms_fy{y}" for y in range(1997, 2026)} <= set(src)


def test_output_files_under_20mb():
    for f in OUT.iterdir():
        assert f.stat().st_size < 20 * 1024 * 1024, f
