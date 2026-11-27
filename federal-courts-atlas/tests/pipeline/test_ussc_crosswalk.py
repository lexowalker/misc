"""USSC lane: district-code crosswalk and parser unit tests."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import pandas as pd
import pytest

from pipeline.common.districts import BY_ID, IDS
from pipeline.ussc.crosswalk import (CODE_TO_ID, ID_TO_CODE, USSC_DISTRICT, district_from_label,
                                     district_packet_code, packet_code_to_district, table_district,
                                     table_state)
from pipeline.ussc.datafile import parse_sas_layout
from pipeline.ussc.packets import Table, all_district_rows, labelled_rows, split_numbers

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "ussc"


def test_crosswalk_is_one_to_one_over_all_94_districts():
    assert len(CODE_TO_ID) == 94
    assert set(CODE_TO_ID.values()) == set(IDS)
    assert len(ID_TO_CODE) == 94
    # USSC leaves codes 21, 59 and 92 unused
    assert set(range(97)) - set(CODE_TO_ID) == {21, 59, 92}


@pytest.mark.parametrize("code", sorted(USSC_DISTRICT))
def test_codebook_label_resolves_to_same_district(code):
    label, did = USSC_DISTRICT[code]
    assert district_from_label(label) == did


def _codebook_text() -> str | None:
    src = ROOT / "data" / "sources" / "ussc.json"
    if not src.exists():
        return None
    m = json.loads(src.read_text()).get("ussc_codebook_fy99_fy25")
    if not m or not m.get("local_path") or not (ROOT / m["local_path"]).exists():
        return None
    r = subprocess.run(["pdftotext", "-layout", str(ROOT / m["local_path"]), "-"], capture_output=True)
    return r.stdout.decode("utf-8", "replace")


def test_crosswalk_matches_codebook_appendix():
    text = _codebook_text()
    if text is None:
        pytest.skip("codebook not cached; run python -m pipeline.ussc.build")
    start = text.index("\nDISTRICT\n")
    block = text[start:start + 4000]
    pairs = re.findall(r"(\d{2})\s*=\s*'([^']+)'", block)
    found = {int(c): lab.strip() for c, lab in pairs}
    assert len(found) == 94, f"parsed {len(found)} codes from the codebook appendix"
    for code, label in found.items():
        assert USSC_DISTRICT[code][0] == label, (code, label)


def test_every_fiscal_year_has_all_94_districts():
    p = OUT / "components.parquet"
    if not p.exists():
        pytest.skip("components not built")
    c = pd.read_parquet(p, columns=["fy", "district_id", "component", "period"])
    c = c[(c["component"] == "cases_total") & (c["period"] == "full") & (c["district_id"] != "US")]
    per_year = c.groupby("fy")["district_id"].nunique()
    assert per_year.index.min() <= 2002 and per_year.index.max() >= 2025
    assert (per_year == 94).all(), per_year[per_year != 94]


def test_packet_codes_roundtrip():
    for did in IDS:
        assert packet_code_to_district(district_packet_code(did)) == did
    assert packet_code_to_district("va") is None          # state-level packet of a multi-district state
    assert packet_code_to_district("dcc") is None         # D.C. Circuit packet
    assert packet_code_to_district("mp") == "nmid"
    assert packet_code_to_district("lam") == "lamd"


def test_table_labels_tolerate_pdftotext_spacing():
    assert table_state("Rhode Isl and") == "RI"
    assert table_state("District of Col umbia") == "DC"
    assert table_state("Northern Mariana Isl ands") == "MP"
    assert table_state("North Mariana Islands") == "MP"
    assert table_district("NY", " Eastern") == "nyed"
    assert table_district("IL", "Central") == "ilcd"


def test_sas_layout_parser():
    sas = """DATA x; INFILE f LRECL=40;
    INPUT
       POOFFICE $ 1   ZONE $ 2       SORGDL $ 3-9
       DISTRICT  10-11      SENTTOT  12-17
    ;
    LENGTH DISTRICT 3 ;"""
    lay = parse_sas_layout(sas)
    assert lay["POOFFICE"] == (1, 1, True)
    assert lay["SORGDL"] == (3, 9, True)
    assert lay["DISTRICT"] == (10, 11, False)
    assert lay["SENTTOT"] == (12, 17, False)


def test_all_district_row_parser():
    lines = """                                                         Table 9
CIRCUIT                    TOTAL     N    %
TOTAL                      66,036   33,979  51.5
D.C. CIRCUIT                 423      175    41.4
District of Col umbia        423      175    41.4
FIRST CIRCUIT              1,901      707    37.2
Rhode Isl and                 98       31    31.6
New York
  Eastern                    604      140    23.2
  Northern                   418      246    58.9
Guam                          12        6    50.0
                                     12""".splitlines()
    rows = {r.district_id: r.numbers for r in all_district_rows(Table(9, "full", lines))}
    assert rows["US"] == [66036.0, 33979.0, 51.5]
    assert rows["dcd"] == [423.0, 175.0, 41.4]
    assert rows["rid"] == [98.0, 31.0, 31.6]
    assert rows["nyed"][0] == 604.0 and rows["nynd"][1] == 246.0
    assert rows["gud"] == [12.0, 6.0, 50.0]
    assert "nysd" not in rows


def test_labelled_rows_join_wrapped_footnote_rows():
    lines = ["          Non-Government Variance          7",
             "                                    11,349      17.2       260    30.2",
             "     Upward Variance5              2,890    4.4     21    2.4"]
    rows = labelled_rows(Table(8, "full", lines))
    assert rows[0][0].startswith("Non-Government Variance") and rows[0][1] == [11349.0, 17.2, 260.0, 30.2]
    assert rows[1][1] == [2890.0, 4.4, 21.0, 2.4]
    assert split_numbers("Antitrust   0   --   0")[1] == ["0", "--", "0"]
