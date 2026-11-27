"""Tests for the cases lane (CourtListener recent items per district)."""
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

import pandas as pd
import pytest

from pipeline.common.districts import IDS

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "cases"
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@pytest.fixture(scope="module")
def files():
    return {d: json.loads((OUT / f"{d}.json").read_text()) for d in IDS}


@pytest.fixture(scope="module")
def gaps():
    p = ROOT / "data" / "gaps" / "cases.json"
    return json.loads(p.read_text()) if p.exists() else {}


# --- filters (unit) ------------------------------------------------------------------------------------

@pytest.mark.parametrize("name,docket,expect_ok", [
    ("United States v. Tucker", "3:26-cr-00113", True),
    ("PayMore Group, LLC v. Fransmart, LLC", "1:26-cv-03916", True),
    ("Elhady v. Kable", "Civil Action No. 1:16-cv-375 (AJT/JFA)", True),
    ("United States v. Black", "Case No. 3:04cr100", True),
    ("Doe v. Fairfax Cnty. Sch. Bd.", "1:18-cv-846", False),
    ("Jane Roe v. Acme", "1:26-cv-1", False),
    ("A.B. v. Smith", "1:26-cv-1", False),
    ("Smith v. J.D.", "1:26-cv-1", False),
    ("Robert S. v. Commissioner", "1:26-cv-1", False),
    ("Watkins v. Bisignano", "3:26-cv-01571", False),
    ("Smith v. Commissioner of Social Security", "3:26-cv-1", False),
    ("United States v. Juvenile Male", "1:26-cr-1", False),
    ("United States v. Sealed", "1:26-cr-1", False),
    ("In re Search of 123 Main Street", "1:26-mj-1", False),
    ("United States v. Turner", "3:26-po-00665", False),    # petty-offense docket
    ("In re Grand Jury Subpoena", "1:26-mc-1", False),
])
def test_reject_reason(name, docket, expect_ok):
    from pipeline.cases.filters import reject_reason
    assert (reject_reason(name, docket) is None) == expect_ok


def test_reject_by_nature_of_suit():
    from pipeline.cases.filters import reject_reason
    assert reject_reason("Lopez v. Warden", "1:26-cv-1", "463 Habeas Corpus - Alien Detainee") is not None
    assert reject_reason("Lopez v. Kijakazi", "1:26-cv-1") is not None
    assert reject_reason("Harris v. Hanon Systems", "3:26-cv-00985", "442 Civil Rights: Jobs") is None


def test_docket_type():
    from pipeline.cases.filters import docket_type
    assert docket_type("1:26-cv-03917") == "cv"
    assert docket_type("CRIMINAL NO. 4:19cr41") == "cr"
    assert docket_type("ACTION NO: 2:18cv566") == "cv"
    assert docket_type("3:26-po-00665") == "po"
    assert docket_type(None) is None


# --- outputs -------------------------------------------------------------------------------------------

def test_files_exist_for_all_94(files):
    assert len(files) == 94
    for d, rec in files.items():
        assert rec["district_id"] == d
        assert rec["court_confirmed"] is True
        assert rec["courtlistener_court"]["id"] == d


def test_items_have_url_and_date(files):
    for d, rec in files.items():
        assert len(rec["items"]) <= 5
        for it in rec["items"]:
            assert it["item_type"] in {"recap_docket", "opinion"}
            assert it["url"].startswith("https://www.courtlistener.com/"), it["url"]
            assert re.match(r"^https://www\.courtlistener\.com/(docket|opinion)/\d+/", it["url"])
            assert ISO.match(it["date_filed"]), it
            assert date.fromisoformat(it["date_filed"]) <= date(2026, 12, 31)
            assert it["court_id"] == d
            assert it["case_name"]
            assert it["retrieved_at"]
            assert it["source_id"].startswith(f"cl_search_{d}_")


def test_items_pass_filters_and_are_unique(files):
    from pipeline.cases.filters import reject_reason
    for d, rec in files.items():
        urls = [it["url"] for it in rec["items"]]
        assert len(urls) == len(set(urls)), d
        keys = [(it["docket_number"], it["case_name"]) for it in rec["items"] if it["item_type"] == "recap_docket"]
        assert len(keys) == len(set(keys)), d
        for it in rec["items"]:
            if it["item_type"] == "recap_docket":
                assert it["docket_type"] in {"cv", "cr"}
                assert reject_reason(it["case_name"], it["docket_number"], it["nature_of_suit"], it["cause"]) is None
            else:
                assert reject_reason(it["case_name"], it["docket_number"], it["nature_of_suit"], None,
                                     require_type=False) is None


def test_no_summaries_or_tokens_stored(files):
    allowed = {"item_type", "case_name", "court", "court_id", "date_filed", "date_terminated", "docket_number",
               "docket_type", "nature_of_suit", "cause", "url", "courtlistener_id", "opinion_status",
               "retrieved_at", "source_id"}
    for rec in files.values():
        for it in rec["items"]:
            assert set(it) <= allowed
    for p in list(OUT.glob("*")) + [ROOT / "data" / "sources" / "cases.json"]:
        txt = p.read_text(errors="ignore")
        assert "Authorization" not in txt and not re.search(r"Token [0-9a-f]{20,}", txt), p


def test_sources_registered(files):
    srcs = json.loads((ROOT / "data" / "sources" / "cases.json").read_text())
    for rec in files.values():
        for it in rec["items"]:
            assert it["source_id"] in srcs
            assert srcs[it["source_id"]]["url"].startswith("https://www.courtlistener.com/api/rest/v4/search/")
            assert srcs[it["source_id"]]["sha256"]


def test_summary_matches_files(files):
    s = pd.read_csv(OUT / "summary.csv", dtype={"district_id": str}).set_index("district_id")
    assert sorted(s.index) == sorted(IDS)
    for d, rec in files.items():
        assert s.loc[d, "n_items"] == len(rec["items"])
        assert s.loc[d, "n_recap_criminal"] == sum(i["docket_type"] == "cr" and i["item_type"] == "recap_docket"
                                                   for i in rec["items"])


def test_short_districts_are_gaps(files, gaps):
    short = sorted(d for d, rec in files.items() if len(rec["items"]) < 3)
    if short:
        assert sorted(gaps["fewer_than_3_cases"]["districts"]) == short
    else:
        assert "fewer_than_3_cases" not in gaps
