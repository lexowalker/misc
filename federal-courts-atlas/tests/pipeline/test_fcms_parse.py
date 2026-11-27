"""Unit tests for the FCMS parsers and crosswalk (no network; page tests use the download cache)."""
from __future__ import annotations

import json
from pathlib import Path

import pdfplumber
import pytest

from pipeline.common.districts import IDS
from pipeline.common.http import PROJECT_ROOT
from pipeline.fcms import crosswalk
from pipeline.fcms.parse import (_MONO_NOS_FIELDS, _MONO_YEAR_FIELDS, ParseError, _check_mono_line, _field,
                                 is_value_token, parse_mono_page, parse_value, parse_words_page)
from pipeline.fcms.variables import KNOWN_SLUGS, nos_variable, rank_variable

SOURCES = PROJECT_ROOT / "data" / "sources" / "fcms.json"


# ---------------------------------------------------------------- tokens

@pytest.mark.parametrize("tok,val", [
    ("4,358", 4358.0), ("1,242.8", 1242.8), (".0", 0.0), ("-15.3", -15.3),
    ("­5.0", -5.0),          # FY2010-15 PDFs print minus as a soft hyphen
    ("‐3.9", -3.9),          # FY2011 uses U+2010
    ("0", 0.0), ("52.56", 52.56),
])
def test_parse_value_numbers(tok, val):
    assert parse_value(tok) == val


@pytest.mark.parametrize("tok", ["-", "­", "‐", "**", "", None])
def test_parse_value_not_published(tok):
    assert parse_value(tok) is None


def test_parse_value_rejects_text():
    with pytest.raises(ValueError):
        parse_value("Filings")
    assert not is_value_token("U.S.")
    assert not is_value_token("²")


# ---------------------------------------------------------------- fixed-width (FY2004-09) fields

def _line(fields: list[tuple[tuple[int, int], str]], width: int = 79) -> str:
    buf = [" "] * width
    for (a, b), txt in fields:
        txt = txt.rjust(b - a + 1)
        buf[a:b + 1] = list(txt)
    return "".join(buf)


def test_mono_fields_split_run_together_numbers():
    # pdftotext renders this national row as "363,774349,969335,655335,868330,721358,983"
    vals = ["363,774", "349,969", "335,655", "335,868", "330,721", "358,983"]
    line = _line(list(zip(_MONO_YEAR_FIELDS, vals)))
    assert "363,774349,969" in line
    assert [_field(line, sp) for sp in _MONO_YEAR_FIELDS] == vals


def test_mono_nos_fields_sum():
    # FY2004 national civil row, checked against the rendered page: total + A..L
    vals = ["281338", "15873", "2830", "55330", "3460", "5845", "18330", "26574", "55023", "9590", "40239",
            "752", "47492"]
    line = _line(list(zip(_MONO_NOS_FIELDS, vals)))
    got = [_field(line, sp) for sp in _MONO_NOS_FIELDS]
    assert got == vals
    assert sum(int(v) for v in got[1:]) == int(got[0])


def test_mono_rejects_stray_characters():
    with pytest.raises(ParseError):
        _check_mono_line("x" + " " * 30, _MONO_YEAR_FIELDS)


# ---------------------------------------------------------------- crosswalk

def test_crosswalk_covers_all_94_ids_once():
    ids = [v for k, v in crosswalk.KEYS.items() if v != crosswalk.NATIONAL]
    assert set(ids) == set(IDS)
    # each id reachable from exactly one canonical heading, except D.N.M.I. (two spellings)
    from collections import Counter
    dup = {k: n for k, n in Counter(ids).items() if n > 1}
    assert dup == {"nmid": 2}


@pytest.mark.parametrize("heading,did", [
    ("VIRGINIA EASTERN", "vaed"), ("NEW YORK SOUTHERN", "nysd"), ("DISTRICT OF COLUMBIA", "dcd"),
    ("NO. CAROLINA EASTERN", "nced"), ("W. VIRGINIA SOUTHERN", "wvsd"), ("WEST VIRGINIA NORTHERN", "wvnd"),
    ("VIRGINIA WESTERN", "vawd"), ("NORTHERN MARIANAS", "nmid"), ("VIRGIN ISLANDS", "vid"), ("GUAM", "gud"),
    ("PUERTO RICO", "prd"), ("COLORADO", "cod"), ("ALL DISTRICT COURTS", "US"), ("  texas   western ", "txwd"),
])
def test_crosswalk_headings(heading, did):
    assert crosswalk.to_id(heading) == did


def test_crosswalk_unknown_raises():
    with pytest.raises(KeyError):
        crosswalk.to_id("VIRGINIA CENTRAL")


def test_nos_and_rank_variable_names():
    assert nos_variable("civil", "Torts (other than personal injury/product liability)") == "fcms_civil_type_torts_other"
    assert nos_variable("criminal", "Immigration") == "fcms_criminal_type_immigration"
    assert nos_variable("civil", "All Other Civil Cases") == nos_variable("civil", "All Other Civil")
    with pytest.raises(KeyError):
        nos_variable("civil", "Something New")
    assert rank_variable("us", "fcms_filings_per_judgeship_total") == "fcms_rank_us_filings_per_judgeship_total"
    assert len(set(KNOWN_SLUGS.values())) == len(KNOWN_SLUGS) - 1   # 'All Other Civil (Cases)' share a slug


# ---------------------------------------------------------------- real pages (from the cache)

def _cached_pdf(year: int) -> Path:
    if not SOURCES.exists():
        pytest.skip("run python -m pipeline.fcms.build first")
    src = json.loads(SOURCES.read_text()).get(f"fcms_fy{year}")
    if not src or not src.get("local_path") or not (PROJECT_ROOT / src["local_path"]).exists():
        pytest.skip(f"FY{year} profile not in the download cache")
    return PROJECT_ROOT / src["local_path"]


def test_page_fy2009_mono_dc():
    with pdfplumber.open(_cached_pdf(2009)) as pdf:
        p = parse_mono_page(pdf.pages[1], 2)
    assert p.heading == "DISTRICT OF COLUMBIA"
    assert p.years == [2009, 2008, 2007, 2006, 2005, 2004]
    assert p.rows["filings_total"] == ["3,016", "2,980", "2,870", "2,947", "3,383", "3,121"]
    assert p.rows["vacant_months"][3:] == [".0", ".0", ".0"]
    assert p.rows["jurors_present"][0] == "93.88"
    assert p.ranks["pct_change_last"] == ("59", "-") and p.ranks["pct_change_earlier"] == ("37", "-")
    assert p.nos["civil"]["Total"] == "2564" and p.nos["criminal"]["B"] == "94"


def test_page_fy2011_dc_split_lines():
    with pdfplumber.open(_cached_pdf(2011)) as pdf:
        p = parse_words_page(pdf.pages[1], 2)
    assert p.years == list(range(2006, 2012))
    assert p.rows["over3_count"][-1] == "490" and p.rows["over3_pct"][-1] == "18.2"
    assert p.rows["pct_change_last"] == [None, None, None, None, "6.5", None]
    assert p.ranks["over3_pct"] == ("84", "-")


def test_page_fy2025_blank_cells():
    with pdfplumber.open(_cached_pdf(2025)) as pdf:
        vi = parse_words_page(pdf.pages[18], 19)      # VIRGIN ISLANDS: weighted filings row printed blank
        az = parse_words_page(pdf.pages[64], 65)      # ARIZONA: 1-year change cell blank (rounds to 0.0)
    assert vi.heading == "VIRGIN ISLANDS"
    assert vi.rows["pj_weighted"] == [None] * 6 and vi.ranks["pj_weighted"] == ("-", "-")
    assert az.rows["filings_total"][-2:] == ["16,391", "16,384"]
    assert az.rows["pct_change"][4] is None and az.ranks["pct_change"] == ("79", "11")


def test_page_fy2024_rank_offset_line():
    # FY2017-24: the criminal-median standing is printed a few points above its values line
    with pdfplumber.open(_cached_pdf(2024)) as pdf:
        p = parse_words_page(pdf.pages[1], 2)
    assert p.rows["median_criminal"][-1] == "18.7"
    assert p.ranks["median_criminal"] == ("75", "-")
