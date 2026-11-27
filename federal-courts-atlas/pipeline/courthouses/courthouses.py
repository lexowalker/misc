"""Places of holding court (28 U.S.C. §§ 81-131, 48 U.S.C. § 1821) and FJC courthouse buildings -> points."""
from __future__ import annotations

import json
import re
import unicodedata

import pandas as pd

from pipeline.common.districts import BY_ID, STATES
from pipeline.common.manifest import DATA

from . import fjc
from .geo import county_of, district_of
from .locate import locate
from .sources import get

BOUNDARIES = DATA / "processed" / "boundaries"
DIVISIONS_JSON = DATA.parent / "public" / "data" / "geo" / "divisions.json"
GEOCODER = {
    **{f"census_cb2025_place_500k_{fips}": "Census cartographic boundary 2025 place polygon (point inside largest "
                                            "land part)" for _, fips in STATES.values()},
    "census_gaz2026_place": "Census Gazetteer 2026 place internal point",
    "census_gaz2026_cousub": "Census Gazetteer 2026 county subdivision internal point",
    "census_tl2025_county": "Census TIGER/Line 2025 county internal point",
    "census_tl2025_place_66": "Census TIGER/Line 2025 place internal point (Guam)",
    "census_tl2025_place_69": "Census TIGER/Line 2025 place internal point (N. Mariana Is.)",
    "census_tl2025_place_78": "Census TIGER/Line 2025 place internal point (U.S. Virgin Islands)",
}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def division_counties() -> dict[tuple[str, str], set[str]]:
    d = json.loads(DIVISIONS_JSON.read_text())["districts"]
    out = {}
    for did, rec in d.items():
        for div in rec.get("divisions", []):
            out[(did, div["name"])] = {c["geoid"] for c in div["counties"]}
    return out


def district_counties() -> dict[str, set[str]]:
    d = json.loads(DIVISIONS_JSON.read_text())["districts"]
    return {did: {c["geoid"] for c in rec["counties"]} for did, rec in d.items()}


_PLACE_POLYS: dict = {}


def land_point(geoid: str):
    """A point inside the largest polygon of a Census place's 1:500k cartographic boundary (land only):
    its centroid if that lies inside, else shapely's point_on_surface."""
    import pyogrio
    import shapely
    fips = geoid[:2]
    if fips not in _PLACE_POLYS:
        r = get(f"census_cb2025_place_500k_{fips}")
        _PLACE_POLYS[fips] = pyogrio.read_dataframe(f"zip://{r.path}", columns=["GEOID"]).to_crs(4326)
    g = _PLACE_POLYS[fips]
    geom = g.loc[g["GEOID"] == geoid].geometry
    if geom.empty:
        return None
    parts = list(getattr(geom.iloc[0], "geoms", [geom.iloc[0]]))
    big = max(parts, key=lambda x: x.area)
    c = big.centroid
    if not big.contains(c):
        c = big.point_on_surface()
    return float(c.y), float(c.x), f"census_cb2025_place_500k_{fips}"


def _check_point(rec: dict) -> dict:
    if rec["lat"] is None:
        rec.update(pip_district=None, pip_how=None, pip_km=None, county_geoid=None, in_district=None)
        return rec
    d = district_of([rec["lon"]], [rec["lat"]]).iloc[0]
    if d["how"] != "within" and rec.get("layer") == "place" and rec.get("geoid"):
        # The Census internal point lies in water outside the land polygons (San Francisco's is near the
        # Farallon side of the city limits; Portland ME and Boston include harbor islands/water).
        lp = land_point(rec["geoid"])
        if lp:
            rec["intpt_lat"], rec["intpt_lon"] = rec["lat"], rec["lon"]
            rec["lat"], rec["lon"], rec["source_id"] = lp
            rec["method"] = rec["method"] + "+land_point"
            rec["note"] = ((rec.get("note") or "") + " The Census internal point of this place lies in water "
                           f"({d['km']} km from the district's land polygon); the point used is inside the place's "
                           "largest land polygon (Census 1:500k cartographic boundary).").strip()
            d = district_of([rec["lon"]], [rec["lat"]]).iloc[0]
    c = county_of([rec["lon"]], [rec["lat"]]).iloc[0]
    rec.update(pip_district=d["id"], pip_how=d["how"], pip_km=d["km"], county_geoid=c["id"],
               in_district=bool(d["id"] == rec["district_id"] and d["how"] == "within"))
    return rec


def statute_places(places: pd.DataFrame, cousubs: pd.DataFrame, county_pts: pd.DataFrame) -> pd.DataFrame:
    sp = pd.read_csv(BOUNDARIES / "statute_places.csv", dtype=str).fillna("")
    divs = division_counties()
    rows = []
    for _, r in sp.iterrows():
        dc = divs.get((r.district_id, r.division)) if r.division else None
        loc = locate(r.place, r.state, r.district_id, places, cousubs, county_pts, dc)
        rec = {"district_id": r.district_id, "division": r.division or None, "place": r.place, "state": r.state,
               "statute_section": r.statute_section, "place_kind": r.place_kind, "statute_sentence": r.sentence,
               "boundaries_note": r.note or None, **loc}
        rec = _check_point(rec)
        rec["in_division"] = (None if (dc is None or rec["county_geoid"] is None) else rec["county_geoid"] in dc)
        rows.append(rec)
    df = pd.DataFrame(rows)
    # Utah lists Salt Lake City in both divisions: one point per district-place pair, divisions joined.
    df["id"] = "php-" + df["district_id"] + "-" + df["place"].map(slug)
    return df


def fjc_courthouses(places: pd.DataFrame, cousubs: pd.DataFrame, county_pts: pd.DataFrame,
                    entries: list[dict]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """(current district-court buildings located, all parsed FJC entries)."""
    allrows, rows = [], []
    for e in entries:
        uses = fjc.current_district_use(e)
        allrows.append({"fjc_path": e["fjc_path"], "heading": e["heading"], "city": e["city"], "state": e["state"],
                        "year": e["year"], "name": e["name"],
                        "courts": " | ".join(f"{c['court']} ({c['years']})" for c in e["courts"]),
                        "current_district_ids": ";".join(d for d, _ in uses), "source_id": e["source_id"]})
        for did, since in uses:
            if did not in BY_ID:
                continue
            if BY_ID[did].state != e["state"]:
                # A building astride a state line (Texarkana) is listed once under each state with both courts;
                # each district keeps the entry filed under its own state.
                continue
            loc = locate(e["city"], e["state"], did, places, cousubs, county_pts)
            rec = {"district_id": did, "city": e["city"], "state": e["state"], "fjc_heading": e["heading"],
                   "building_name": e["name"], "building_year": e["year"], "district_court_since": since,
                   "fjc_url": "https://www.fjc.gov" + e["fjc_path"], "fjc_source_id": e["source_id"], **loc}
            rows.append(_check_point(rec))
    df = pd.DataFrame(rows)
    df["id"] = "fjc-" + df["district_id"] + "-" + df["fjc_url"].str.rsplit("/", n=1).str[-1]
    return df, pd.DataFrame(allrows)
