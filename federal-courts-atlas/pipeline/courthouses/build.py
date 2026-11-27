"""Build the courthouses lane: places of holding court, federal courthouse buildings, and the search index.

    PYTHONPATH=. .venv/bin/python -m pipeline.courthouses.build

Idempotent: every download goes through pipeline.common.http.fetch (disk cache); all outputs are rewritten,
and the lane's source and gap fragments are rebuilt from scratch on each run.

Inputs from the boundaries lane (read only): data/processed/boundaries/statute_places.csv, county_district.csv,
legacy_geoids.csv, districts.parquet, and public/data/geo/divisions.json.

Outputs
  public/data/geo/courthouses.json                     points for the map (contract format + extra fields)
  public/data/search/{index,places,counties,zcta,courthouses}.json   search index (format in index.json)
  data/processed/courthouses/
    statute_places_geocoded.csv     all 457 statute rows with the Census match, point, and checks
    fjc_courthouses_all.csv         every FJC "Historic Federal Courthouses" entry, parsed
    fjc_current_district_courthouses.csv   buildings in current use by a district court, located
    court_finder_autocomplete.csv   the uscourts.gov court-finder suggestion list (names only)
    courthouses.csv                 flat copy of courthouses.json
    search_places.csv, zcta_district.csv   full-precision versions of the search tables
    variables.json                  [] (this lane emits no district statistics)
    build_summary.json              counts and checks
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from pipeline.common.districts import BY_ID, IDS
from pipeline.common.manifest import DATA, record_gap

from . import LANE
from . import gazetteer as gaz
from .courthouses import GEOCODER, fjc_courthouses, statute_places
from .fjc import load as load_fjc
from .geo import county_of, district_of
from .search import county_rows, place_rows, write_json, zcta_map, zcta_table
from .sources import get

OUT = DATA / "processed" / LANE
PUBLIC = DATA.parent / "public" / "data"
STATUTE_SOURCE = {"nmid": "boundaries:olrc_usc48_xml"}
# The one statute place outside its own division's counties, and why (checked, not silenced).
DIVISION_EXCEPTIONS = {
    ("utd", "Northern Division", "Salt Lake City"):
        "28 U.S.C. § 125 names Salt Lake City as a place of holding court for both the Northern and the Central "
        "Division; Salt Lake County is in the Central Division.",
}


def _reset_fragments() -> None:
    for sub in ("sources", "gaps"):
        p = DATA / sub / f"{LANE}.json"
        if p.exists():
            p.unlink()


def _s(x):
    """A string value, or None for NaN/empty."""
    return x if isinstance(x, str) and x.strip() else None


def _nkey(s: str | None) -> str:
    s = (_s(s) or "").lower().replace("united states", "u.s.").replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def court_finder() -> pd.DataFrame:
    r = get("uscourts_court_finder_autocomplete")
    rows, group = [], None
    for x in r.json():
        if x.get("group"):
            group = x["group"]["group_id"]
        rows.append({"group": group, "value": x["value"], "link": x.get("link")})
    return pd.DataFrame(rows)


def _r3(x):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else float(np.round(x, 3))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    _reset_fragments()

    # --- Census points, located in districts ---------------------------------------------------------
    places, cousubs, county_pts = gaz.places(), gaz.cousubs(), gaz.tiger_county_points()
    d = district_of(places["lon"].values, places["lat"].values)
    places["district_id"], places["pip_how"] = d["id"].values, d["how"].values
    places["county_geoid"] = county_of(places["lon"].values, places["lat"].values)["id"].values
    d = district_of(cousubs["lon"].values, cousubs["lat"].values)
    cousubs["district_id"], cousubs["pip_how"] = d["id"].values, d["how"].values
    cousubs["county_geoid"] = cousubs["GEOID"].str[:5]

    # --- 1. statute places --------------------------------------------------------------------------
    sp = statute_places(places, cousubs, county_pts)
    unlocated = sp[sp["lat"].isna()]
    assert set(unlocated["method"]) <= {"override:described_site"}, unlocated[["district_id", "place", "method"]]
    bad = sp[sp["lat"].notna() & (sp["in_district"] != True)]  # noqa: E712
    if len(bad):
        raise RuntimeError(f"statute places outside their district:\n{bad[['district_id', 'place', 'pip_district']]}")
    sp["division_note"] = None
    for i, r in sp[sp["in_division"] == False].iterrows():  # noqa: E712
        key = (r.district_id, r.division, r.place)
        if key not in DIVISION_EXCEPTIONS:
            raise RuntimeError(f"statute place outside its division's counties: {key} ({r.county_geoid})")
        sp.at[i, "division_note"] = DIVISION_EXCEPTIONS[key]
    sp.to_csv(OUT / "statute_places_geocoded.csv", index=False)

    # --- 2. FJC courthouse buildings ----------------------------------------------------------------
    entries, _ = load_fjc()
    fc, fall = fjc_courthouses(places, cousubs, county_pts, entries)
    fall.to_csv(OUT / "fjc_courthouses_all.csv", index=False)
    cf = court_finder()
    cf.to_csv(OUT / "court_finder_autocomplete.csv", index=False)
    cf_names = {_nkey(v) for v in cf.loc[cf["group"] == "courthouse-buildings", "value"]}
    fc["in_court_finder"] = [(_nkey(n) in cf_names) if _s(n) else False for n in fc["building_name"]]
    fc.to_csv(OUT / "fjc_current_district_courthouses.csv", index=False)
    fjc_unlocated = fc[fc["lat"].isna()]
    fjc_outside = fc[fc["lat"].notna() & (fc["in_district"] != True)]  # noqa: E712

    # --- 3. courthouses.json ------------------------------------------------------------------------
    recs: dict[str, dict] = {}
    for _, r in sp[sp["lat"].notna()].iterrows():
        if r.id in recs:  # same district-place listed for two divisions (Salt Lake City)
            recs[r.id]["division"] = "; ".join(x for x in [recs[r.id]["division"], _s(r.division)] if x)
            continue
        recs[r.id] = {
            "id": r.id, "district_id": r.district_id, "city": r.place, "state": r.state, "name": r.place,
            "address": None, "lat": _r3(r.lat), "lon": _r3(r.lon), "kind": "place_of_holding_court",
            "statute_section": r.statute_section, "source_id": r.source_id, "geocoder": GEOCODER[r.source_id],
            "geocode_match": r.method, "census_geoid": r.geoid, "census_name": r.census_name,
            "division": _s(r.division), "statute_place_kind": r.place_kind,
            "statute_source_id": STATUTE_SOURCE.get(r.district_id, "boundaries:olrc_usc28_xml"),
            "precision": "city (Census internal point)" if r.place_kind == "city" else "area (Census internal point of the named city)",
            "note": " ".join(x for x in [_s(r.note), _s(r.division_note)] if x) or None,
            "statute_note": _s(r.boundaries_note),
        }
    for _, r in fc[fc["lat"].notna()].iterrows():
        recs[r.id] = {
            "id": r.id, "district_id": r.district_id,
            # FJC's own spelling, except where it is a misspelling of the Census name (Corpus "Christie").
            "city": gaz.base_name(r.census_name) if r.method == "override:spelling_variant" else r.city,
            "state": r.state, "name": _s(r.building_name) or r.fjc_heading, "fjc_heading": r.fjc_heading, "address": None, "lat": _r3(r.lat), "lon": _r3(r.lon),
            "kind": "courthouse", "statute_section": None, "source_id": r.fjc_source_id,
            "geocoder": GEOCODER[r.source_id], "geocode_match": r.method, "census_geoid": r.geoid,
            "census_name": r.census_name, "fjc_url": r.fjc_url, "building_year": (int(r.building_year)
            if pd.notna(r.building_year) else None), "district_court_since": (int(r.district_court_since)
            if pd.notna(r.district_court_since) else None), "in_court_finder": bool(r.in_court_finder),
            "precision": "city (Census internal point); building address not available",
            "note": _s(r.note),
        }
    out = sorted(recs.values(), key=lambda x: (x["district_id"], x["kind"] != "place_of_holding_court", x["city"], x["id"]))
    geo_bytes = write_json(PUBLIC / "geo" / "courthouses.json", out)
    pd.DataFrame(out).to_csv(OUT / "courthouses.csv", index=False)

    # --- 4. search index ----------------------------------------------------------------------------
    prow, ptab = place_rows(places, cousubs)
    ptab[["USPS", "GEOID", "NAME", "base", "layer", "FUNCSTAT", "lat", "lon", "district_id", "other", "t", "pip_how",
          "source_id"]].to_csv(OUT / "search_places.csv", index=False)
    crow, n_as = county_rows()
    zt = zcta_table()
    zt_as = zt[zt["district_id"] == ""]
    zt = zt[zt["district_id"] != ""]
    zt.to_csv(OUT / "zcta_district.csv", index=False)
    zmap = zcta_map(zt)
    chrow = sorted({(x["name"], x["city"], x["state"], x["district_id"], x["kind"][0], x["id"]) for x in out})
    meta = {"built": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    sizes = {
        "places.json": write_json(PUBLIC / "search" / "places.json", {
            "fields": ["name", "state", "lat", "lon", "district_id", "other_district_ids", "type"],
            "types": {"c": "incorporated place", "p": "census designated place (CDP)",
                      "m": "town/township (minor civil division) or NYC borough", "i": "island-area place or subdivision"},
            "source_ids": ["census_gaz2026_place", "census_gaz2026_cousub", "census_place_by_county2020",
                           "census_tl2025_place_66", "census_tl2025_place_69", "census_tl2025_place_78",
                           "census_tl2025_cousub_66", "census_tl2025_cousub_69", "census_tl2025_cousub_78"],
            **meta, "rows": prow}),
        "counties.json": write_json(PUBLIC / "search" / "counties.json", {
            "fields": ["geoid", "name", "state", "district_id", "split_districts"],
            "source": "data/processed/boundaries/county_district.csv (boundaries lane)", **meta, "rows": crow}),
        "zcta.json": write_json(PUBLIC / "search" / "zcta.json", {
            "format": "zcta -> district_id, or [[district_id, land_share], ...] (largest first) when the ZCTA spans districts",
            "source_ids": ["census_rel2020_zcta_county", "census_cb2020_zcta520_500k"], **meta, "zcta": zmap}),
        "courthouses.json": write_json(PUBLIC / "search" / "courthouses.json", {
            "fields": ["name", "city", "state", "district_id", "kind", "id"],
            "kinds": {"p": "place of holding court (statute)", "c": "courthouse building (FJC)"},
            "points": "public/data/geo/courthouses.json (look up by id)", **meta, "rows": [list(r) for r in chrow]}),
    }
    sizes["index.json"] = write_json(PUBLIC / "search" / "index.json", {
        "description": "Find-your-federal-court lookup tables. Rows are arrays; see each file's `fields`.",
        "files": {k: {"bytes": v} for k, v in sizes.items()}, **meta,
        "notes": [
            "Coordinates are Census internal points rounded to 3 decimals (about 100 m); they locate a place, not "
            "an address.",
            "places: district_id is the district containing the place's internal point; other_district_ids lists "
            "further districts whose counties the place reaches into (2020 place-by-county file; counties split "
            "by statute are left out of that list).",
            "zcta: ZIP Code Tabulation Areas (Census 2020) approximate USPS ZIP codes; some ZIP codes (PO boxes, "
            "single buildings) have no ZCTA. Shares are of the ZCTA's land area.",
            "American Samoa (5 county-equivalents, ZCTA 96799) belongs to no judicial district and is omitted.",
        ]})
    total = sum(sizes.values())
    assert total < 6_000_000, f"search index too large: {total} bytes"

    # --- 5. gaps ------------------------------------------------------------------------------------
    record_gap(LANE, "court_finder_addresses_unavailable",
               description="No courthouse street addresses or divisional-office records: the uscourts.gov Federal "
                           "Court Finder result pages (/federal-court-finder/find) answer HTTP 403 (Akamai 'Access "
                           "Denied') to this pipeline. Only its autocomplete name list was reachable (no addresses, "
                           "cities or districts). Courthouse points are therefore city-level (Census internal "
                           "points) and no 'divisional_office' records are produced.",
               variables=["courthouses.address", "kind=divisional_office"], districts="all",
               reason="Source blocked for automated clients; not worked around.")
    record_gap(LANE, "no_place_named_gud_vid",
               description="No point at all for D. Guam (gud) and D.V.I. (vid): title 48 names no place of holding "
                           "court for either, and the FJC courthouse list has no entries for Guam, the Virgin Islands "
                           "or the Northern Mariana Islands.",
               districts=["gud", "vid"], reason="No allowed source gives a location.")
    record_gap(LANE, "mdd_southern_division_described_site",
               description="D. Md. Southern Division: the statute names no city ('a suitable site in Montgomery or "
                           "Prince George's County not more than five miles from the boundary'), so this place of "
                           "holding court gets no point. D. Md.'s FJC courthouse records are mapped.",
               districts=["mdd"], reason="Described site, not a named place.")
    nofjc = sorted(set(IDS) - set(fc["district_id"]))
    record_gap(LANE, "fjc_courthouse_list_coverage",
               description="Districts with no building in current district-court use in the FJC 'Historic Federal "
                           f"Courthouses' list: {', '.join(nofjc)}. The FJC list covers buildings, mostly federally "
                           "owned; leased court space and recent moves may be missing, so the courthouse layer is "
                           "not a complete inventory of where each court sits.",
               districts=nofjc, reason="Coverage of the FJC list.")
    if len(fjc_unlocated):
        record_gap(LANE, "fjc_cities_not_located",
                   description="FJC courthouse cities with no Census point: " + "; ".join(
                       f"{r.city}, {r.state} ({r.district_id})" for r in fjc_unlocated.itertuples()),
                   districts=sorted(set(fjc_unlocated["district_id"])), reason="No matching Census place.")
    record_gap(LANE, "american_samoa_search",
               description=f"American Samoa ({n_as} county-equivalents, ZCTA 96799) is not in the search index: it "
                           "belongs to no federal judicial district.", districts=[], reason="No district.")
    record_gap(LANE, "zip_codes_not_zctas",
               description="The ZIP search uses Census 2020 ZCTAs, which approximate USPS ZIP code delivery areas. "
                           "PO-box-only and single-site ZIP codes have no ZCTA and are not searchable; ZCTA "
                           "boundaries differ from current ZIP routes.", districts=[], reason="Only ZCTAs are public.")

    # --- 6. variables + summary ---------------------------------------------------------------------
    (OUT / "variables.json").write_text("[]\n")
    summary = {
        "statute_rows": int(len(sp)), "statute_points": int(sp["lat"].notna().sum()),
        "statute_unlocated": unlocated[["district_id", "place"]].to_dict("records"),
        "statute_methods": sp["method"].value_counts().to_dict(),
        "statute_in_district": int((sp["in_district"] == True).sum()),  # noqa: E712
        "statute_in_division_false": sp.loc[sp["in_division"] == False, ["district_id", "division", "place"]].to_dict("records"),  # noqa: E712
        "fjc_entries": int(len(fall)), "fjc_current_district_buildings": int(len(fc)),
        "fjc_located": int(fc["lat"].notna().sum()), "fjc_outside_district": fjc_outside[["district_id", "city"]].to_dict("records"),
        "fjc_methods": fc["method"].value_counts().to_dict(),
        "fjc_in_court_finder_names": int(fc["in_court_finder"].sum()),
        "court_finder_suggestions": int(len(cf)), "court_finder_groups": cf["group"].value_counts().to_dict(),
        "courthouses_json_records": len(out), "courthouses_json_bytes": geo_bytes,
        "courthouses_by_kind": pd.Series([x["kind"] for x in out]).value_counts().to_dict(),
        "districts_with_points": len({x["district_id"] for x in out}),
        "search": {"places_rows": len(prow), "place_types": pd.Series([r[6] for r in prow]).value_counts().to_dict(),
                   "counties_rows": len(crow), "zcta_count": len(zmap),
                   "zcta_multi_district": sum(isinstance(v, list) for v in zmap.values()),
                   "zcta_split_county_method": int(zt["method"].str.contains("split").sum()),
                   "american_samoa_zcta_dropped": sorted(zt_as["zcta"].unique().tolist()),
                   "courthouse_rows": len(chrow), "bytes": sizes, "total_bytes": total},
        "places_not_in_any_district": int(places["district_id"].isna().sum()),
        "cousubs_not_in_any_district": int(cousubs["district_id"].isna().sum()),
        "places_nearest_assigned": int((places["pip_how"] == "nearest").sum()),
    }
    (OUT / "build_summary.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False, default=str) + "\n")
    print(json.dumps({k: summary[k] for k in ("statute_points", "statute_in_district", "fjc_current_district_buildings",
                                               "fjc_located", "courthouses_json_records", "districts_with_points")}))
    print("search bytes:", sizes, "total", total)


if __name__ == "__main__":
    main()
