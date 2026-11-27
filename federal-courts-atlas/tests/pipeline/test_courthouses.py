"""Tests for the courthouses lane (places of holding court, FJC courthouses, search index).

Data checks recompute what they can independently of the build (point-in-polygon with shapely directly on
districts.parquet; ZCTA expectations re-derived from the raw Census relationship file and county_district.csv).
"""
from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pytest
import shapely

from pipeline.common.districts import BY_ID, IDS

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "courthouses"
BOUND = ROOT / "data" / "processed" / "boundaries"
GEO = ROOT / "public" / "data" / "geo" / "courthouses.json"
SEARCH = ROOT / "public" / "data" / "search"
CONTRACT_FIELDS = {"id", "district_id", "city", "state", "name", "address", "lat", "lon", "kind",
                   "statute_section", "source_id", "geocoder", "geocode_match"}


@pytest.fixture(scope="module")
def courthouses():
    return json.loads(GEO.read_text())


@pytest.fixture(scope="module")
def statute():
    return pd.read_csv(OUT / "statute_places_geocoded.csv", dtype={"geoid": str, "county_geoid": str})


@pytest.fixture(scope="module")
def district_polys():
    g = gpd.read_parquet(BOUND / "districts.parquet")
    return dict(zip(g["district_id"], g.geometry))


@pytest.fixture(scope="module")
def sources():
    return json.loads((ROOT / "data" / "sources" / "courthouses.json").read_text())


# --- unit tests -----------------------------------------------------------------------------------------

def test_base_name_and_norm():
    from pipeline.courthouses.gazetteer import base_name, norm
    assert base_name("Abbeville city") == "Abbeville"
    assert base_name("Juneau city and borough") == "Juneau"
    assert base_name("Nashville-Davidson metropolitan government (balance)") == "Nashville-Davidson"
    assert base_name("San Juan zona urbana") == "San Juan"
    assert base_name("Brooklyn borough") == "Brooklyn"
    assert base_name("Carson City") == "Carson City"
    assert norm("Sault Sainte Marie") == norm("Sault Ste. Marie")
    assert norm("Mayagüez") == norm("Mayaguez")
    assert norm("St. Louis") == norm("Saint Louis")


def test_fjc_court_mapping_and_years():
    from pipeline.courthouses.fjc import current_district_use, district_for_court
    assert district_for_court("U.S. District Court for the Northern District of Alabama") == "alnd"
    assert district_for_court("U.S. District Court for the District of Columbia") == "dcd"
    assert district_for_court("U.S. Court of Appeals for the Fourth Circuit") is None
    assert district_for_court("U.S. District Court for the District of Indiana") == "UNKNOWN"  # historical court
    e = {"courts": [{"court": "U.S. District Court for the Eastern District of Virginia",
                     "years": "1858-1864, 1871-present"},
                    {"court": "U.S. Court of Appeals for the Fourth Circuit", "years": "1891-present"},
                    {"court": "U.S. District Court for the District of Virginia", "years": "1864-1871"}]}
    assert current_district_use(e) == [("vaed", 1871)]
    assert current_district_use({"courts": [{"court": "U.S. District Court for the Eastern District of "
                                                       "California", "years": "unknown-present"}]}) == [("caed", None)]


def test_fjc_parse_page_fixture():
    from pipeline.courthouses.fjc import parse_page
    html = """<table><tr><td class="views-field views-field-title courthouse-description">
      <strong><a href="/history/courthouse/birmingham-alabama-1987">Birmingham, Alabama (1987)</a></strong>
      <p>Hugo L. Black United States Courthouse</p>
      <p>U.S. District Court for the Northern District of Alabama (1987-present)</p>
      <p>Architects: KPS Group</p></td></tr>
      <tr><td class="courthouse-description"><strong><a href="/history/courthouse/x-1906">Anniston, Alabama (1906)</a>
      </strong><p>Named the Example Courthouse in 1995</p><p>U.S. District Court for the Northern District of
      Alabama (1906-present)</p></td></tr></table>"""
    e = parse_page(html)
    assert e[0]["city"] == "Birmingham" and e[0]["state"] == "AL" and e[0]["year"] == 1987
    assert e[0]["name"] == "Hugo L. Black United States Courthouse"
    assert e[0]["courts"] == [{"court": "U.S. District Court for the Northern District of Alabama",
                               "years": "1987-present"}]
    assert e[1]["name"] == "Example Courthouse"


def test_overrides_point_at_real_census_rows():
    from pipeline.courthouses import gazetteer as gaz
    from pipeline.courthouses.locate import OVERRIDES
    places, cousubs, cty = gaz.places(), gaz.cousubs(), gaz.tiger_county_points()
    for (did, name), ov in OVERRIDES.items():
        assert did in BY_ID, did
        assert ov.reason, (did, name)
        if ov.layer == "place":
            assert (places["GEOID"] == ov.geoid).sum() == 1, (did, name)
        elif ov.layer == "cousub":
            assert (cousubs["GEOID"] == ov.geoid).sum() == 1, (did, name)
        elif ov.layer == "tiger_county":
            assert (cty["GEOID"] == ov.geoid).sum() == 1, (did, name)
        else:
            assert ov.layer == "none" and ov.method == "described_site"


# --- statute places ---------------------------------------------------------------------------------------

def test_every_statute_place_is_present(statute):
    sp = pd.read_csv(BOUND / "statute_places.csv", dtype=str)
    assert len(statute) == len(sp) == 457
    assert list(statute["place"]) == list(sp["place"])
    assert list(statute["district_id"]) == list(sp["district_id"])


def test_every_statute_place_geocoded_or_explained(statute):
    missing = statute[statute["lat"].isna()]
    assert len(missing) == 1
    r = missing.iloc[0]
    assert r["district_id"] == "mdd" and r["place_kind"] == "described_site"
    assert r["method"] == "override:described_site" and isinstance(r["note"], str) and "names no city" in r["note"]


def test_every_statute_point_inside_its_district(statute, district_polys):
    pts = statute[statute["lat"].notna()]
    for r in pts.itertuples():
        p = shapely.Point(r.lon, r.lat)
        assert district_polys[r.district_id].covers(p), (r.district_id, r.place, r.lat, r.lon)
        assert r.in_district is True or r.in_district == True  # noqa: E712


def test_statute_points_in_their_division_or_explained(statute):
    off = statute[statute["in_division"] == False]  # noqa: E712
    assert [(r.district_id, r.division, r.place) for r in off.itertuples()] == [
        ("utd", "Northern Division", "Salt Lake City")]
    assert "both" in off.iloc[0]["division_note"]
    # Every place in a district with statutory divisions was checked against the division's counties.
    checked = statute[statute["division"].notna() & statute["lat"].notna()]
    assert checked["in_division"].notna().all()


def test_statute_methods_are_exact_or_documented(statute):
    from pipeline.courthouses.locate import OVERRIDES
    for r in statute.itertuples():
        if r.method.startswith("override:"):
            assert (r.district_id, r.place) in OVERRIDES
        else:
            assert r.method.startswith(("exact_name", "cousub_exact_name")), (r.district_id, r.place, r.method)


def test_known_statute_points(statute):
    def row(d, p):
        return statute[(statute.district_id == d) & (statute.place == p)].iloc[0]
    assert row("tned", "Greenville")["census_name"] == "Greeneville town"
    assert row("nyed", "Brooklyn")["census_name"] == "Brooklyn borough"
    assert row("nysd", "New York")["census_name"] == "Manhattan borough"
    assert row("nmid", "Saipan")["geoid"] == "69110"
    assert row("arwd", "Texarkana")["state"] == "AR" and row("txed", "Texarkana")["state"] == "TX"


# --- courthouses.json --------------------------------------------------------------------------------------

def test_courthouses_schema(courthouses, sources):
    ids = [c["id"] for c in courthouses]
    assert len(ids) == len(set(ids))
    for c in courthouses:
        assert CONTRACT_FIELDS <= set(c), c["id"]
        assert c["district_id"] in BY_ID
        assert c["kind"] in {"place_of_holding_court", "courthouse", "divisional_office"}
        assert c["state"] == BY_ID[c["district_id"]].state
        assert isinstance(c["lat"], float) and isinstance(c["lon"], float)
        assert c["source_id"] in sources, c["source_id"]
        assert c["geocoder"]
        if c["kind"] == "place_of_holding_court":
            assert c["statute_section"].startswith(("28 U.S.C.", "48 U.S.C."))
            assert c["statute_source_id"].startswith("boundaries:")
        else:
            assert c["fjc_url"].startswith("https://www.fjc.gov/history/courthouse/")


def test_courthouse_points_inside_district(courthouses, district_polys):
    for c in courthouses:
        assert district_polys[c["district_id"]].covers(shapely.Point(c["lon"], c["lat"])) or \
            district_polys[c["district_id"]].distance(shapely.Point(c["lon"], c["lat"])) < 0.002, c["id"]


def test_courthouse_coverage(courthouses):
    have = {c["district_id"] for c in courthouses}
    assert set(IDS) - have == {"gud", "vid"}  # no statutory place and no FJC entry (recorded gap)
    gaps = json.loads((ROOT / "data" / "gaps" / "courthouses.json").read_text())
    assert set(gaps["no_place_named_gud_vid"]["districts"]) == {"gud", "vid"}
    assert "court_finder_addresses_unavailable" in gaps
    n_php = sum(c["kind"] == "place_of_holding_court" for c in courthouses)
    assert n_php == 455  # 456 located statute rows; Salt Lake City listed for two Utah divisions


# --- search index ------------------------------------------------------------------------------------------

def test_search_index_size():
    total = sum(p.stat().st_size for p in SEARCH.glob("*.json"))
    assert total < 6_000_000


def test_every_county_in_search_has_a_district():
    c = json.loads((SEARCH / "counties.json").read_text())
    rows = c["rows"]
    cd = pd.read_csv(BOUND / "county_district.csv", dtype=str).fillna("")
    assert len(rows) == (cd["district_id"] != "").sum() == len(cd) - 5  # only American Samoa omitted
    assert all(r[3] in BY_ID for r in rows)
    lookup = dict(zip(cd["geoid"], cd["district_id"]))
    assert all(lookup[r[0]] == r[3] for r in rows)
    assert {r[0] for r in rows if r[4]} == set(cd.loc[cd["split_districts"] != "", "geoid"])


def _raw_zcta_district(z: str) -> set[str]:
    """Re-derive a ZCTA's districts from the raw rel2020 file + county_district.csv (independent of the build)."""
    from pipeline.courthouses.sources import get
    rel = pd.read_csv(get("census_rel2020_zcta_county").path, sep="|", dtype=str,
                      usecols=["GEOID_ZCTA5_20", "GEOID_COUNTY_20"])
    cd = pd.read_csv(BOUND / "county_district.csv", dtype=str)
    m = dict(zip(cd["geoid"], cd["district_id"]))
    return {m[c] for c in rel.loc[rel["GEOID_ZCTA5_20"] == z, "GEOID_COUNTY_20"]}


@pytest.mark.parametrize("zcta,expected", [("22314", "vaed"), ("10007", "nysd"), ("11201", "nyed"),
                                           ("75670", "txed")])
def test_zcta_examples(zcta, expected):
    z = json.loads((SEARCH / "zcta.json").read_text())["zcta"]
    assert z[zcta] == expected
    assert _raw_zcta_district(zcta) == {expected}


def test_zcta_shares_and_split_county():
    z = json.loads((SEARCH / "zcta.json").read_text())["zcta"]
    assert len(z) > 33000
    for k, v in z.items():
        assert len(k) == 5 and k.isdigit()
        if isinstance(v, list):
            assert abs(sum(s for _, s in v) - 1) < 0.01, k
            assert all(d in BY_ID for d, _ in v)
            assert [s for _, s in v] == sorted((s for _, s in v), reverse=True)
        else:
            assert v in BY_ID
    # Gardiner, MT (Park County, partly inside Yellowstone NP -> D. Wyo.)
    assert {d for d, _ in z["59030"]} == {"mtd", "wyd"}
    assert "96799" not in z  # American Samoa


def test_places_index():
    p = json.loads((SEARCH / "places.json").read_text())
    assert p["fields"][:5] == ["name", "state", "lat", "lon", "district_id"]
    rows = p["rows"]
    assert len(rows) > 30000
    assert all(r[4] in BY_ID for r in rows)
    assert all(o in BY_ID for r in rows if r[5] for o in r[5].split(";"))
    idx = {(r[0], r[1]): r for r in rows}
    assert idx[("Dallas", "TX")][4] == "txnd" and "txed" in idx[("Dallas", "TX")][5]
    assert idx[("Brooklyn", "NY")][4] == "nyed"
    assert idx[("Alexandria", "VA")][4] == "vaed"
    assert idx[("Hagåtña", "GU")][4] == "gud"
    # Dallas reaches into E.D. Tex.: confirm from the raw place-by-county file + county_district.csv
    from pipeline.courthouses.sources import get
    pbc = pd.read_csv(get("census_place_by_county2020").path, sep="|", dtype=str, encoding="utf-8-sig")
    dal = pbc[(pbc["STATE"] == "TX") & (pbc["PLACENAME"] == "Dallas city")]
    cd = pd.read_csv(BOUND / "county_district.csv", dtype=str)
    m = dict(zip(cd["geoid"], cd["district_id"]))
    assert {m[s + c] for s, c in zip(dal["STATEFP"], dal["COUNTYFP"])} == {"txnd", "txed"}


def test_search_courthouses_match_geo(courthouses):
    s = json.loads((SEARCH / "courthouses.json").read_text())
    ids = {c["id"] for c in courthouses}
    assert {r[5] for r in s["rows"]} == ids


def test_variables_json():
    v = json.loads((OUT / "variables.json").read_text())
    assert v == []
