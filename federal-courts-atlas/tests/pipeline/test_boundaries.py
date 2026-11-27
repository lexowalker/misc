"""Tests for the boundaries lane (run after `python -m pipeline.boundaries.build`).

Expectations below were checked against the statute text (28 U.S.C. §§ 81-131 as parsed into
data/processed/boundaries/statute_parsed.json), not just copied from the task list.
"""
from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import Point

from pipeline.boundaries import names, statute
from pipeline.boundaries.geometry import topo_to_gdf
from pipeline.common.districts import BY_ID, IDS, STATES, by_state

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "processed" / "boundaries"
GEO = ROOT / "public" / "data" / "geo"


@pytest.fixture(scope="module")
def cd() -> pd.DataFrame:
    return pd.read_csv(OUT / "county_district.csv", dtype=str, keep_default_na=False)


@pytest.fixture(scope="module")
def parsed() -> dict:
    return json.loads((OUT / "statute_parsed.json").read_text())


@pytest.fixture(scope="module")
def districts() -> gpd.GeoDataFrame:
    return gpd.read_parquet(OUT / "districts.parquet")


# ------------------------------------------------------------------------------------------------ assignment

def test_every_county_equivalent_assigned_exactly_once(cd):
    assert len(cd) == 3235
    assert cd.geoid.is_unique
    assert (cd.geoid.str.len() == 5).all()
    nonas = cd[cd.state != "AS"]
    assert set(nonas.district_id) == set(IDS)
    assert (cd[cd.state == "AS"].district_id == "").all() and (cd.state == "AS").sum() == 5
    assert cd[cd.state == "AS"].basis.str.contains("not part of any judicial district").all()
    for col in ("district_id", "statute_section", "statute_division", "county_name", "geoid", "state", "vintage"):
        assert col in cd.columns


def test_matches_census_geoid_list_when_cached(cd):
    from pipeline.boundaries import sources
    from pipeline.common.http import _cache_paths
    body, meta = _cache_paths(sources.SOURCES["census_cb2025_county_500k"].url)
    if not body.exists():
        pytest.skip("Census county file not in the download cache")
    g = gpd.read_file(body, ignore_geometry=True)
    assert set(g.GEOID) == set(cd.geoid)


def test_district_counts_per_state_match_registry(cd):
    for st in STATES:
        got = set(cd.loc[cd.state == st, "district_id"])
        assert got == {d.id for d in by_state(st)}, st


def test_every_statute_name_matched_to_a_geoid(parsed, cd):
    n = 0
    geoids = set(cd.geoid)
    for did, d in parsed["districts"].items():
        for u in d["units"]:
            for it in u["items"]:
                n += 1
                assert it.get("geoid") in geoids, (did, it["name"])
                assert it["method"] in {"exact", "normalized_variant", "spelling_variant", "renamed", "island",
                                        "former_county"}
    assert n == 2452


def test_non_exact_matches_are_all_in_the_override_tables():
    m = pd.read_csv(OUT / "name_matches.csv", dtype=str, keep_default_na=False)
    for r in m[m.method != "exact"].itertuples():
        if r.method == "former_county":
            assert r.state == "VA" and r.statute_name in names.VA_FORMER_COUNTIES
        else:
            assert names.OVERRIDES[(r.state, r.statute_name, r.kind)]["geoid"] == r.geoid


def test_override_table_is_consistent():
    for (st, nm, kind), ov in names.OVERRIDES.items():
        assert ov["geoid"][:2] == STATES[st][1], (st, nm)
        assert ov["reason"], (st, nm)
        if ov["method"] in ("renamed",):
            assert ov["source_id"] and ov["locator"]


SPOT = {
    # geoid: (district, why - checked against the statute text)
    "29510": ("moed", "§ 105(a)(1) '... and the city of Saint Louis'"),
    "29189": ("moed", "§ 105(a)(1) county of Saint Louis"),
    "51510": ("vaed", "§ 127(c): Alexandria formed from Alexandria (now Arlington) County, listed in § 127(a)"),
    "51770": ("vawd", "§ 127(c): Roanoke city formed from Roanoke County, listed in § 127(b)"),
    "51161": ("vawd", "§ 127(b) county of Roanoke"),
    "51059": ("vaed", "§ 127(a) county of Fairfax"),
    "51600": ("vaed", "§ 127(c): Fairfax city formed from Fairfax County"),
    "51760": ("vaed", "§ 127(c): Richmond city formed from Henrico County"),
    "51159": ("vaed", "§ 127(a) county of Richmond"),
    "51620": ("vaed", "§ 127(c): Franklin city formed from Southampton County (E.D.)"),
    "51067": ("vawd", "§ 127(b) county of Franklin"),
    "51019": ("vawd", "§ 127(b) county of Bedford"),
    "51650": ("vaed", "§ 127(c): Hampton formed from Elizabeth City County, listed in § 127(a)"),
    "51810": ("vaed", "§ 127(c): Virginia Beach formed from Princess Anne County, listed in § 127(a)"),
    "51047": ("vawd", "§ 127(b) Culpeper (moved from E.D. in 1991)"),
    "36047": ("nyed", "§ 112(c) Kings"), "36081": ("nyed", "§ 112(c) Queens"),
    "36085": ("nyed", "§ 112(c) Richmond (Staten Island)"),
    "36005": ("nysd", "§ 112(b) Bronx"), "36061": ("nysd", "§ 112(b) New York"),
    "12086": ("flsd", "§ 89(c) Dade (now Miami-Dade)"),
    "12021": ("flmd", "§ 89(b) Collier"),
    "48201": ("txsd", "§ 124(b)(2) Harris, Houston Division"),
    "48453": ("txwd", "§ 124(d)(1) Travis, Austin Division"),
    "48203": ("txed", "§ 124(c)(4) Harrison, Marshall Division"),
    "48113": ("txnd", "§ 124(a)(1) Dallas, Dallas Division"),
    "48097": ("txed", "§ 124(c)(3) 'Cook' = Cooke County, Sherman Division"),
    "17031": ("ilnd", "§ 93(a)(1) Cook"),
    "15005": ("hid", "§ 91: Hawaii constitutes one judicial district (Kalawao County)"),
    "06037": ("cacd", "§ 84(c)(2) Los Angeles"), "06073": ("casd", "§ 84(d) San Diego"),
    "06075": ("cand", "§ 84(a) San Francisco"), "06019": ("caed", "§ 84(b) Fresno"),
    "06059": ("cacd", "§ 84(c)(3) 'comprises Orange County'"),
    "22071": ("laed", "§ 98(a) Orleans"), "22033": ("lamd", "§ 98(b) East Baton Rouge"),
    "42107": ("pamd", "§ 118(b) Schuylkill"),
    "54107": ("wvsd", "§ 129(b) Wood"),
    "37005": ("ncwd", "§ 113(c) Alleghany"),
    "37093": ("ncmd", "§ 113(b) Hoke (excluding the Fort Bragg portion)"),
    "37063": ("ncmd", "§ 113(b) Durham (excluding the FCI Butner portion)"),
    "29186": ("moed", "§ 105(a)(3) 'Saint Genevieve' = Ste. Genevieve County"),
    "39173": ("ohnd", "§ 115(a)(2) 'Woods' = Wood County"),
    "13083": ("gand", "§ 90(a)(3) Dade (Georgia), Rome Division"),
    "29057": ("mowd", "§ 105(b)(5) Dade (Missouri)"),
    "40079": ("oked", "§ 116(b) 'Le Flore Love' = Le Flore"), "40085": ("oked", "§ 116(b) Love"),
    "05059": ("arwd", "§ 83(b)(6) 'Hot Springs' = Hot Spring County"),
    "46102": ("sdd", "§ 122(4) 'Shannon' = Oglala Lakota County"),
    "02158": ("akd", "§ 81A: Alaska one district (Kusilvak)"),
    "09110": ("ctd", "§ 86: Connecticut one district (planning region)"),
    "08014": ("cod", "§ 85: Colorado one district (Broomfield)"),
    "11001": ("dcd", "§ 88"), "72127": ("prd", "§ 119"),
    "78010": ("vid", "48 U.S.C. § 1615 Division of Saint Croix"), "66010": ("gud", "48 U.S.C. § 1424"),
    "69110": ("nmid", "48 U.S.C. § 1821"),
    "60010": ("", "American Samoa: no district"),
}


@pytest.mark.parametrize("geoid", sorted(SPOT))
def test_spot_checks(cd, geoid):
    row = cd[cd.geoid == geoid].iloc[0]
    assert row.district_id == SPOT[geoid][0], f"{geoid} {row.county_name}: {SPOT[geoid][1]}"


def test_spot_checks_listed_by_statute(cd, parsed):
    """For counties placed by a county list, the statute unit of that district must contain the name."""
    for geoid, (did, _) in SPOT.items():
        row = cd[cd.geoid == geoid].iloc[0]
        if row.match_method in ("whole_state", "va_city_rule", "no_district"):
            continue
        units = parsed["districts"][did]["units"]
        assert any(it["name"] == row.statute_name and it.get("geoid") == geoid and not it["partial"]
                   for u in units for it in u["items"]), geoid


def test_virginia_cities_follow_127c(cd):
    va = pd.read_csv(OUT / "va_city_rule.csv", dtype=str, keep_default_na=False)
    assert len(va) == 38 and (va.consistent == "True").all()
    cities = cd[(cd.state == "VA") & cd.county_name.str.endswith(" city")]
    assert len(cities) == 38 and (cities.match_method == "va_city_rule").all()
    # a same-named city and county may sit in different districts (Franklin) but never by name-matching
    assert cd.set_index("geoid").loc["51620", "district_id"] != cd.set_index("geoid").loc["51067", "district_id"]


def test_division_assignment_examples(cd):
    s = cd.set_index("geoid")
    assert s.loc["17031", "statute_division"] == "Eastern Division"
    assert s.loc["29510", "statute_division"] == "Eastern Division"
    assert s.loc["48201", "statute_division"] == "Houston Division"
    assert s.loc["06059", "statute_division"] == "Southern Division"


def test_split_counties_flagged(cd):
    s = cd.set_index("geoid")
    for g, own, other in [("30067", "mtd", "wyd"), ("30031", "mtd", "wyd"), ("16043", "idd", "wyd"),
                          ("37093", "ncmd", "nced"), ("37125", "ncmd", "nced"), ("37153", "ncmd", "nced"),
                          ("37165", "ncmd", "nced"), ("37063", "ncmd", "nced")]:
        assert s.loc[g, "district_id"] == own
        assert s.loc[g, "split_districts"] == f"{own};{other}", g
        assert s.loc[g, "split_note"]
    assert (cd.split_districts != "").sum() == 8


# ------------------------------------------------------------------------------------------------ statute parse

def test_statute_matches_lii_crosscheck():
    xc = pd.read_csv(OUT / "statute_crosscheck.csv")
    assert len(xc) > 400 and xc.in_lii.all()


def test_specials_recorded(parsed):
    types = {s["type"] for s in parsed["special_clauses"]}
    assert {"yellowstone", "partial_county_inclusion", "concurrent_waters", "river_waters", "outlying_islands",
            "virginia_city_rule"} <= types
    assert all(s["handling"] for s in parsed["special_clauses"])


def test_district_changes_since_1980_recorded(parsed):
    ch = parsed["district_changes_since_1980"]
    assert {(c["section"], c["year"]) for c in ch} >= {("127", 1991), ("118", 1998), ("113", 2021), ("89", 1988)}


def test_places_of_holding_court():
    p = pd.read_csv(OUT / "statute_places.csv", dtype=str, keep_default_na=False)
    assert set(p.district_id) == set(IDS) - {"gud", "vid"}
    nynd = p[p.district_id == "nynd"].place.tolist()
    assert nynd.count("Plattsburgh") == 1 and len(nynd) == 8
    assert set(p[(p.district_id == "ohsd") & (p.division == "Eastern Division")].place) == {
        "Columbus", "St. Clairsville", "Steubenville"}
    assert set(p[p.district_id == "wyd"].place) == {"Casper", "Cheyenne", "Evanston", "Lander", "Jackson", "Sheridan"}
    assert set(p[p.district_id == "vaed"].place) == {"Alexandria", "Newport News", "Norfolk", "Richmond"}
    assert (p.sentence != "").all()


def test_split_list_rules():
    assert statute.split_list("A, King and Queen, B, and C") == ["A", "King and Queen", "B", "C"]
    assert statute.split_list("Riverside and San Bernardino") == ["Riverside", "San Bernardino"]
    assert statute.split_list("Camden, Newark and Trenton") == ["Camden", "Newark", "Trenton"]


def test_parse_county_list_nc_partial_and_exclusions():
    items, excl, sp = statute.parse_county_list(
        "the counties of Wake, Wilson, those portions of Hoke and Moore counties encompassing the Fort Bragg "
        "Military Reservation and Camp Mackall, and that portion of Durham County encompassing the Federal "
        "Correctional Institution, Butner, North Carolina.", "113")
    whole = [i.name for i in items if not i.partial]
    part = [i.name for i in items if i.partial]
    assert whole == ["Wake", "Wilson"] and sorted(part) == ["Durham", "Hoke", "Moore"]
    items, excl, sp = statute.parse_county_list(
        "the counties of Alamance, Durham (excluding that portion of Durham County encompassing the Federal "
        "Correctional Institution, Butner, North Carolina), Forsyth.", "113")
    assert [i.name for i in items] == ["Alamance", "Durham", "Forsyth"] and excl[0]["county"] == "Durham"


def test_text_fix_le_flore_love():
    items, _, _ = statute.parse_county_list("the counties of Latimer, Le Flore Love, McCurtain.", "116")
    assert [i.name for i in items] == ["Latimer", "Le Flore", "Love", "McCurtain"]


def test_normalize():
    assert names.normalize("Saint Clair") == names.normalize("St. Clair")
    assert names.normalize("De Kalb") == names.normalize("DeKalb")
    assert names.normalize("O’Brien") == names.normalize("O'Brien")
    assert names.normalize("Doña Ana") == names.normalize("Dona Ana")
    assert names.normalize("La Salle") == names.normalize("LaSalle")
    assert names.normalize("Saint Genevieve") != names.normalize("Ste. Genevieve")   # needs explicit override


# ------------------------------------------------------------------------------------------------ geometry

def test_all_94_districts_valid(districts):
    assert list(districts.district_id) == IDS
    assert districts.geometry.is_valid.all()
    assert (~districts.geometry.is_empty).all()
    assert (districts.area_km2 > 0).all()


YNP_POINTS = [
    # (lat, lon, expected district, verified fact)
    (45.01, -110.70, "wyd", "inside the Montana part of the park near Gardiner (TIGER park polygon, MT)"),
    (44.80, -111.07, "wyd", "inside the park in Gallatin County, MT"),
    (44.30, -111.08, "wyd", "inside the park in Fremont County, ID"),
    (44.97, -110.70, "wyd", "Mammoth area: this point is in Wyoming (south of 45°N), so wyd for that reason"),
    (45.30, -110.70, "mtd", "Park County, MT, outside the park"),
    (44.30, -111.30, "idd", "Fremont County, ID, outside the park"),
    (35.13, -79.20, "nced", "Fort Bragg in Hoke County"),
    (35.05, -79.48, "nced", "Camp MacKall"),
    (34.98, -79.25, "ncmd", "Hoke County outside Fort Bragg"),
]


@pytest.mark.parametrize("lat,lon,want,why", YNP_POINTS)
def test_carve_out_points(districts, lat, lon, want, why):
    hit = districts[districts.contains(Point(lon, lat))].district_id.tolist()
    assert hit == [want], why


def test_yellowstone_portions_inside_wyd(districts):
    sp = pd.read_csv(OUT / "split_counties.csv", dtype=str)
    ynp = sp[sp.area == "yellowstone"]
    assert set(ynp.geoid) == {"30067", "30031", "16043"}
    assert 600 < ynp[ynp.state == "MT"].carved_km2.astype(float).sum() < 680
    assert 140 < ynp[ynp.state == "ID"].carved_km2.astype(float).sum() < 160


def test_yellowstone_polygon_within_wyd_when_cached(districts):
    from pipeline.boundaries import sources
    from pipeline.common.http import _cache_paths
    wyd = districts[districts.district_id == "wyd"].to_crs(5070).geometry.iloc[0]
    for st in ("30", "16"):
        body, _ = _cache_paths(sources.SOURCES[f"census_tl2025_arealm_{st}"].url)
        if not body.exists():
            pytest.skip("AREALM files not cached")
        lm = gpd.read_file(body)
        park = lm[lm.FULLNAME == "Yellowstone Natl Pk"].to_crs(5070).geometry.union_all()
        share = park.intersection(wyd).area / park.area
        assert share > 0.995, (st, share)


def test_dissolved_states_match_census_state_outlines():
    sc = pd.read_csv(OUT / "state_outline_check.csv")
    assert len(sc) == 55
    assert (sc.symdiff_km2 / sc.state_km2 < 1e-4).all()


def test_legacy_crosswalk():
    lg = pd.read_csv(OUT / "legacy_geoids.csv", dtype=str, keep_default_na=False).set_index("legacy_geoid")
    want = {"30113": "wyd", "12025": "flsd", "46113": "sdd", "02270": "akd", "02261": "akd", "02201": "akd",
            "02232": "akd", "02280": "akd", "51515": "vawd", "51560": "vawd", "51780": "vawd"}
    want.update({f"09{c:03d}": "ctd" for c in range(1, 16, 2)})
    for g, d in want.items():
        assert lg.loc[g, "district_id"] == d, g
    assert (lg.area_share.astype(float) > 0.95).all()
    cd = pd.read_csv(OUT / "county_district.csv", dtype=str)
    assert not set(lg.index) & set(cd.geoid)


# ------------------------------------------------------------------------------------------------ web files

@pytest.mark.parametrize("name,limit,objs", [("districts-lo", 450_000, ["districts", "states"]),
                                             ("districts-hi", 3_000_000, ["districts", "states", "counties"])])
def test_topojson(name, limit, objs, cd):
    path = GEO / f"{name}.topo.json"
    assert path.stat().st_size <= limit
    topo = json.loads(path.read_text())
    assert topo["type"] == "Topology" and sorted(topo["objects"]) == sorted(objs)
    d = topo["objects"]["districts"]["geometries"]
    assert sorted(g["id"] for g in d) == sorted(IDS)
    for g in d:
        p = g["properties"]
        assert p["name"] == BY_ID[g["id"]].name and p["short"] and p["state"] and p["circuit"]
    s = topo["objects"]["states"]["geometries"]
    assert sorted(g["id"] for g in s) == sorted(k for k in STATES)
    for o in ("districts", "states"):
        gdf = topo_to_gdf(path, o)
        assert gdf.geometry.is_valid.all(), (name, o, list(gdf[~gdf.geometry.is_valid].id))
    if "counties" in objs:
        c = topo["objects"]["counties"]["geometries"]
        m = cd[cd.state != "AS"].set_index("geoid").district_id.to_dict()
        assert len(c) == len(m)
        for g in c:
            assert g["properties"]["district_id"] == m[g["id"]] and g["properties"]["name"]
        gdf = topo_to_gdf(path, "counties")
        assert (~gdf.geometry.is_valid).sum() <= 3


def test_topojson_keeps_small_islands():
    gdf = topo_to_gdf(GEO / "districts-lo.topo.json", "districts").set_index("id")
    parts = lambda i: len(gdf.loc[i].geometry.geoms) if gdf.loc[i].geometry.geom_type == "MultiPolygon" else 1
    assert parts("akd") > 50          # Aleutians and the southeast archipelago
    assert parts("hid") >= 8          # main Hawaiian islands
    assert parts("nmid") >= 4 and parts("vid") >= 3 and parts("flsd") > 5   # territories, Florida Keys


def test_divisions_json(cd):
    dv = json.loads((GEO / "divisions.json").read_text())["districts"]
    assert sorted(dv) == sorted(IDS)
    for did, d in dv.items():
        members = set(cd.loc[cd.district_id == did, "geoid"])
        assert {c["geoid"] for c in d["counties"]} == members, did
        if d["has_statutory_divisions"]:
            in_divs = [c["geoid"] for div in d["divisions"] for c in div["counties"]]
            assert len(in_divs) == len(set(in_divs)), did
            assert set(in_divs) == members, did
    assert len(dv["alnd"]["divisions"]) == 5 and len(dv["txed"]["divisions"]) == 6
    assert dv["nced"]["partial_counties_included"]
    assert len(dv["vid"]["divisions"]) == 2


def test_observations_and_variables():
    obs = pd.read_parquet(OUT / "observations.parquet")
    assert len(obs) == 94 * 3 - 2     # no statutory place of holding court is named for gud or vid
    assert not ((obs.variable == "statutory_places_of_holding_court") & obs.district_id.isin(["gud", "vid"])).any()
    v = json.loads((OUT / "variables.json").read_text())
    assert {x["id"] for x in v} == set(obs.variable)
    for x in v:
        for k in ("id", "label", "unit", "period_type", "description", "source_ids", "caveats", "higher_means"):
            assert k in x
    o = obs.set_index(["district_id", "variable"]).value
    assert o[("alnd", "statutory_divisions")] == 5
    assert o[("txed", "statutory_divisions")] == 6
    assert o[("wyd", "statutory_places_of_holding_court")] == 6
    assert o[("vaed", "county_equivalents")] + o[("vawd", "county_equivalents")] == 133
