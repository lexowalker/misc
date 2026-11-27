"""IDB lane: civil cases by multidistrict litigation (MDL) docket (``python -m pipeline.idb.mdl``).

Checks the table against the lane's own civil totals, re-counts N.D. Fla.'s largest docket from the civil extract
with code independent of pipeline.idb.mdl, and checks every docket name against the cached GovInfo record it cites.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq
import pytest

from pipeline.common.districts import IDS

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "idb"
TABLE = OUT / "civil_mdl_dockets.parquet"
NAMES = OUT / "civil_mdl_docket_names.csv"

pytestmark = pytest.mark.skipif(not TABLE.exists(), reason="run python -m pipeline.idb.mdl")


@pytest.fixture(scope="module")
def mdl():
    return pd.read_parquet(TABLE)


@pytest.fixture(scope="module")
def obs():
    return pd.read_parquet(OUT / "observations.parquet")


def test_schema_and_keys(mdl):
    assert list(mdl.columns) == ["district_id", "period", "period_type", "cohort", "mdl_docket", "count", "total",
                                 "share", "source_id", "source_locator"]
    assert set(mdl["cohort"]) == {"filed", "terminated"}
    assert set(mdl["period_type"]) == {"FY_SEP30"}
    assert set(mdl["district_id"]) - {"_national"} <= set(IDS)
    assert mdl["mdl_docket"].str.fullmatch(r"\d{4}").all()
    assert not mdl.duplicated(["district_id", "period", "cohort", "mdl_docket"]).any()
    assert set(mdl["source_id"]) == {"idb_civil_cv88on"}
    srcs = json.loads((ROOT / "data" / "sources" / "idb.json").read_text())
    assert "idb_civil_cv88on" in srcs


def test_shares_and_thresholds(mdl):
    assert (abs(mdl["share"] - 100 * mdl["count"] / mdl["total"]) < 1e-9).all()
    assert (mdl["count"] <= mdl["total"]).all()
    dist = mdl[mdl["district_id"] != "_national"]
    assert (dist["count"] >= 100).all() and (dist["share"] >= 5).all()
    keys = set(map(tuple, dist[["period", "cohort", "mdl_docket"]].values))
    nat = mdl[mdl["district_id"] == "_national"]
    assert set(map(tuple, nat[["period", "cohort", "mdl_docket"]].values)) == keys
    # the national count of a docket is at least the sum of the district rows shown for it
    s = dist.groupby(["period", "cohort", "mdl_docket"])["count"].sum()
    n = nat.set_index(["period", "cohort", "mdl_docket"])["count"]
    assert (n.reindex(s.index) >= s).all()


def test_totals_equal_lane_civil_counts(mdl, obs):
    nat = pd.read_parquet(OUT / "national.parquet")
    for cohort, var in (("filed", "idb_civil_filed"), ("terminated", "idb_civil_terminated")):
        o = obs[obs["variable"] == var].set_index(["district_id", "period"])["value"]
        on = nat[nat["variable"] == var].set_index("period")["value"]
        sub = mdl[mdl["cohort"] == cohort][["district_id", "period", "total"]].drop_duplicates()
        assert not sub.duplicated(["district_id", "period"]).any()
        for d, y, t in sub.itertuples(index=False):
            ref = on[y] if d == "_national" else o[(d, y)]
            assert t == ref, (cohort, d, y, t, ref)


def test_flnd_mdl_2885_pinned(mdl):
    """Lane report: 204,990 N.D. Fla. civil filings in FY2020, almost all under MDL 2885."""
    r = mdl[(mdl["district_id"] == "flnd") & (mdl["mdl_docket"] == "2885")].set_index(["cohort", "period"])
    assert r.loc[("filed", 2020), "total"] == 204990
    assert r.loc[("filed", 2020), "count"] == 202693
    assert r.loc[("terminated", 2025), "count"] == 147231
    assert r.loc[("terminated", 2025), "total"] == 149260
    for y in range(2020, 2025):
        assert r.loc[("filed", y), "share"] > 90


def _extract() -> Path | None:
    x = sorted((ROOT / "data" / "raw" / "idb_extract").glob("civil_*.parquet"))
    return x[-1] if x else None


@pytest.mark.skipif(_extract() is None, reason="civil extract not cached (data/raw is local)")
def test_flnd_recount_from_extract(mdl):
    """Independent recount: N.D. Fla. (IDB code 29) filings in FY2021 by docket, de-duplicated on the lane's key."""
    cols = ["DISTRICT", "OFFICE", "DOCKET", "ORIGIN", "FILEDATE", "FDATEUSE", "TDATEUSE", "TAPEYEAR", "MDLDOCK",
            "ROWNO"]
    t = pq.read_table(_extract(), columns=cols, filters=[("DISTRICT", "=", "29")]).to_pandas()
    t["latest"] = t["TAPEYEAR"].where(t["TAPEYEAR"] != 2099, 9999)
    t = t.sort_values(["latest", "ROWNO"], kind="stable")
    cases = t.drop_duplicates(["DISTRICT", "OFFICE", "DOCKET", "ORIGIN", "FILEDATE"], keep="last")
    fy = cases["FDATEUSE"].dt.year + (cases["FDATEUSE"].dt.month >= 10)
    f21 = cases[fy == 2021]
    row = mdl[(mdl["district_id"] == "flnd") & (mdl["period"] == 2021) & (mdl["cohort"] == "filed")
              & (mdl["mdl_docket"] == "2885")].iloc[0]
    assert len(f21) == row["total"]
    assert int((f21["MDLDOCK"] == "2885").sum()) == row["count"]
    # terminations FY2025 (records with a termination, by TDATEUSE fiscal year; no de-duplication)
    closed = t[t["TAPEYEAR"] != 2099]
    tfy = closed["TDATEUSE"].dt.year + (closed["TDATEUSE"].dt.month >= 10)
    c25 = closed[tfy == 2025]
    row = mdl[(mdl["district_id"] == "flnd") & (mdl["period"] == 2025) & (mdl["cohort"] == "terminated")
              & (mdl["mdl_docket"] == "2885")].iloc[0]
    assert len(c25) == row["total"]
    assert int((c25["MDLDOCK"] == "2885").sum()) == row["count"]


def test_names_verified_against_cached_govinfo_records():
    names = pd.read_csv(NAMES, dtype=str)
    assert "2885" in set(names["mdl_docket"])
    srcs = json.loads((ROOT / "data" / "sources" / "idb.json").read_text())
    from pipeline.common.districts import BY_ID
    for r in names.itertuples(index=False):
        s = srcs[r.source_id]
        assert s["url"].startswith("https://www.govinfo.gov/metadata/pkg/USCOURTS-"), s["url"]
        assert re.search(rf"-(md|mn)-0?{r.mdl_docket}$", r.case_number)
        text = (ROOT / s["local_path"]).read_text(errors="replace")
        assert f"<caseNumber>{r.case_number}</caseNumber>" in text
        assert f"United States District Court {BY_ID[r.district_id].name}" in text
        import html
        assert html.escape(r.title_as_printed, quote=False) in text or r.title_as_printed in text
        assert "\u2014" not in r.title


def test_display_title():
    from pipeline.idb.mdl import display_title
    assert display_title("IN RE: 3M COMBAT ARMS EARPLUG PRODUCTS LIABILITY LITIGATION") == \
        "In re: 3M Combat Arms Earplug Products Liability Litigation"
    assert display_title("In Re: Taxotere (Docetaxel) Products Liability Litigation") == \
        "In re: Taxotere (Docetaxel) Products Liability Litigation"
    assert display_title("JOHNSON &amp; JOHNSON TALCUM POWDER PRODUCTS") == "Johnson & Johnson Talcum Powder Products"
