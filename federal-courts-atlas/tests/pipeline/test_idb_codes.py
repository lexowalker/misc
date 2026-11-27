"""IDB lane: crosswalk and code-table unit tests (no large files needed)."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

import pandas as pd
import pytest

from pipeline.common.districts import BY_ID, IDS
from pipeline.idb import jb
from pipeline.idb.codes import (CIVIL_DISP, CRIM_DISP, NOS_GROUPS, NOS_TO_GROUP, PRISONER_NOS, d2_category)
from pipeline.idb.crosswalk import CODE_TO_ID, ID_TO_CODE, IDB_DISTRICT, circuit_code, normalize_code, to_district_id

ROOT = Path(__file__).resolve().parents[2]


# ----------------------------------------------------------------------------- district crosswalk
def test_crosswalk_maps_all_94_districts_one_to_one():
    assert len(CODE_TO_ID) == 94
    assert set(CODE_TO_ID.values()) == set(IDS)
    assert len(ID_TO_CODE) == 94


def test_unused_codes_are_21_59_92():
    numeric = {int(c) for c in CODE_TO_ID if c.isdigit()}
    assert set(range(95)) - numeric - {30, 31, 32, 33, 34, 35} == {21, 59, 92}
    assert {"3A", "3C", "3E", "3G", "3J", "3L", "3N", "7-"} <= set(CODE_TO_ID)


@pytest.mark.parametrize("code", sorted(IDB_DISTRICT))
def test_codebook_label_agrees_with_registry_name(code):
    label, did = IDB_DISTRICT[code]
    d = BY_ID[did]
    if " - " in label:
        state, div = label.split(" - ")
        assert d.state_name == state and d.name.startswith(div), (code, label, d.name)
    else:
        assert label in (d.state_name, d.name.replace("District of the ", "").replace("District of ", ""),
                         "Virgin Islands", "Northern Mariana Islands"), (code, label, d.name)


def test_normalize_code():
    assert normalize_code("0") == "00" and normalize_code(" 3a ") == "3A" and normalize_code("-8") is None
    assert to_district_id("7-") == "akd" and to_district_id("40") == "txed" and to_district_id("XX") is None


def _pdf_text(source_id: str) -> str | None:
    import json
    src = ROOT / "data" / "sources" / "idb.json"
    if not src.exists():
        return None
    m = json.loads(src.read_text()).get(source_id)
    if not m or not m.get("local_path") or not (ROOT / m["local_path"]).exists():
        return None
    return subprocess.run(["pdftotext", "-layout", str(ROOT / m["local_path"]), "-"], capture_output=True,
                          text=True).stdout


@pytest.mark.parametrize("sid", ["idb_civil_codebook", "idb_criminal_codebook"])
def test_crosswalk_labels_appear_in_codebook_district_table(sid):
    text = _pdf_text(sid)
    if text is None:
        pytest.skip("codebook not downloaded")
    flat = re.sub(r"\s+", " ", text.replace("–", "-"))
    for code, (label, _) in IDB_DISTRICT.items():
        assert f"{code} - {label}" in flat, (sid, code, label)


def test_circuit_codes():
    assert circuit_code("dcd") == "0" and circuit_code("txed") == "5" and circuit_code("gud") == "9"


# ----------------------------------------------------------------------------- civil codes
def test_nos_groups_are_disjoint_and_cover_codebook_list():
    all_codes = [c for _, cs in NOS_GROUPS.values() for c in cs]
    assert len(all_codes) == len(set(all_codes))
    # every NOS code printed in the civil codebook's list belongs to a JS 44 group
    text = _pdf_text("idb_civil_codebook")
    if text is None:
        pytest.skip("codebook not downloaded")
    block = text.split("NATURE OF SUIT")[1].split("Must have appropriate jurisdiction")[0]
    codes = {int(m) for m in re.findall(r"^\s+(\d{3})\s+\S", block, re.M)}
    assert len(codes) > 90
    assert codes - set(NOS_TO_GROUP) == set(), sorted(codes - set(NOS_TO_GROUP))


def test_patent_and_prisoner_codes():
    assert NOS_TO_GROUP[830] == NOS_TO_GROUP[835] == "intellectual_property"
    assert PRISONER_NOS == [510, 530, 535, 540, 550, 555, 560]


def test_civil_disp_codes_cover_codebook():
    assert set(CIVIL_DISP) == set(range(21))
    assert {c for c, (_, g) in CIVIL_DISP.items() if g.startswith("trial")} == {7, 8, 9}


def test_criminal_disp_codes_cover_codebook():
    assert set(CRIM_DISP) == {0, 1, 2, 3, 4, 5} | set(range(8, 22))
    groups = {g for _, g in CRIM_DISP.values()}
    assert groups == {"transfer", "dismissed", "acquitted_bench", "acquitted_jury", "plea", "convicted_bench",
                      "convicted_jury"}


# ----------------------------------------------------------------------------- offense mapping
@pytest.mark.parametrize("code,cat", [
    ("8720", "immigration"), ("8731", "immigration"), ("6701", "drugs"), ("6501", "drugs"), ("7820", "firearms_explosives"),
    ("9994", "firearms_explosives"), ("4601", "fraud"), ("8600", "fraud"), ("0100", "violent"), ("1700", "violent"),
    ("7471", "general"), ("7477", "general"), ("5900", "sex"), ("6400", "sex"), ("7310", "justice_system"),
    ("9992", "justice_system"), ("7210", "traffic"), ("9931", "regulatory"), ("3400", "property_other"),
    ("5800", "property_other"), ("-8", "unknown"), (None, "unknown"), ("100", "violent"),
])
def test_d2_category_examples(code, cat):
    assert d2_category(code) == cat


def test_every_listed_d2_code_has_a_category():
    p = ROOT / "data" / "processed" / "idb" / "d2_offense_codes.csv"
    if not p.exists():
        pytest.skip("build not run")
    d = pd.read_csv(p, dtype={"d2_code": str})
    assert len(d) >= 280
    assert (d["offense_category"] != "unknown").all(), d[d["offense_category"] == "unknown"]


# ----------------------------------------------------------------------------- AO table helpers
def test_ao_label_map_covers_94():
    assert set(jb.LABEL_TO_ID.values()) == set(IDS)
    assert jb.LABEL_TO_ID["NY,S"] == "nysd" and jb.LABEL_TO_ID["GUAM"] == "gud" and jb.LABEL_TO_ID["NMI"] == "nmid"
    assert jb._norm_label("WV,S¹") == "WV,S" and jb._norm_label("WV,S1") == "WV,S"


def test_pdf_footnote_after_label_is_dropped():
    line = "      NY,S 4                        4,472          4,032"
    assert jb._FOOTNOTE_AFTER_LABEL.sub(r"\1", line).split()[:2] == ["NY,S", "4,472"]


def test_d1_structural_index():
    row = [146482, 117056, 29426, 69802, 69532, 66263, 3155, 114, 141, 129,
           74796, 74553, 64144, 3497, 6912, 131, 112, 141585, 112310, 29275]
    i = jb._d1_index(row)
    assert i == 3 and jb._d1_index(row, i + 7) == 10
