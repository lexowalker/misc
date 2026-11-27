"""Boundaries lane entry point: ``python -m pipeline.boundaries.build``.

Rebuilds every output from the download cache (fetching anything missing through pipeline.common.http):

  data/processed/boundaries/statute_parsed.json   parsed 28 U.S.C. §§ 81-131 + 48 U.S.C. territorial sections
  data/processed/boundaries/statute_places.csv    places of holding court named in the statute
  data/processed/boundaries/statute_crosscheck.csv  OLRC sentence-by-sentence check against Cornell LII
  data/processed/boundaries/name_matches.csv      every statute county name -> GEOID, with match method
  data/processed/boundaries/county_district.csv   every 2025 county-equivalent -> district_id
  data/processed/boundaries/legacy_geoids.csv     retired county GEOIDs (1990-2020 Census files) -> district_id
  data/processed/boundaries/va_city_rule.csv      28 U.S.C. § 127(c) check for Virginia's independent cities
  data/processed/boundaries/split_counties.csv    counties divided by a statutory carve-out
  data/processed/boundaries/districts.parquet     GeoParquet, 94 district polygons (1:500k Census base)
  data/processed/boundaries/observations.{parquet,csv}, variables.json
  data/processed/boundaries/preview.png
  public/data/geo/districts-lo.topo.json, districts-hi.topo.json, divisions.json
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict

import geopandas as gpd
import pandas as pd

from pipeline.common.districts import BY_ID, IDS
from pipeline.common.http import PROJECT_ROOT
from pipeline.common.manifest import DATA, record_gap, write_observations

from . import assign, crosscheck, geometry, names, preview, sources, statute
from .sources import LANE

OUT = DATA / "processed" / LANE
GEO = PROJECT_ROOT / "public" / "data" / "geo"
LO_INTERVALS, LO_QUANT = {"default": 1000, "PR,HI": 400, "GU,MP,VI": 150}, 1_000_000
HI_INTERVALS, HI_QUANT = {"default": 250, "PR,HI": 120, "GU,MP,VI": 50}, 4_000_000
STATUTE_PERIOD = 2026   # statute current through Pub. L. 119-142 (Nov. 10, 2026)


def _reset_manifests() -> None:
    for sub in ("sources", "gaps"):
        p = DATA / sub / f"{LANE}.json"
        if p.exists():
            p.unlink()


def _special_handling(sp: dict) -> str:
    t = sp["type"]
    if t == "yellowstone":
        return ("Drawn: the TIGER/Line 2025 Yellowstone National Park polygon is cut out of the Montana and Idaho "
                "counties it covers and added to wyd (county rows stay with mtd/idd; see split_counties.csv).")
    if t == "partial_county_inclusion":
        return ("Drawn: the part of each named county covered by the TIGER/Line 2025 feature(s) for this area is "
                "moved to nced; the county row stays with ncmd (see split_counties.csv).")
    if t == "concurrent_waters":
        return ("Not drawn: concurrent jurisdiction over waters cannot be shown as exclusive territory. County "
                "rows follow the county lists; noted in county_district.csv 'notes'.")
    if t == "river_waters":
        return ("Not drawn: the statute gives W.D. Tenn. the Tennessee River to the low-water mark on the eastern "
                "shore where the river divides the Western and Middle Districts. The river is now impounded "
                "(Kentucky Lake) and no public dataset on the allowed hosts gives that historical low-water line, "
                "so the strip is not delineated. Recorded as a gap.")
    if t == "outlying_islands":
        return ("Not drawn: these islands are not county-equivalents in the Census files. Recorded as a gap. "
                "(Canton and Enderbury are no longer U.S. territory; noted, not mapped.)")
    if t == "virginia_city_rule":
        return "Applied to all 38 Virginia independent cities (va_city_rule.csv)."
    return ""


def main() -> int:
    _reset_manifests()
    get = sources.get

    # ---- 1. statute ------------------------------------------------------------------------------------
    units, specials, metas, secs = statute.parse_all(get("olrc_usc28_xml"), get("olrc_usc48_xml"))
    xc = crosscheck.crosscheck(units, metas)
    bad = [r for r in xc if not r["in_lii"]]
    if bad:
        print(f"WARNING: {len(bad)} statute sentences differ from Cornell LII", file=sys.stderr)

    # ---- 2. counties + assignment ----------------------------------------------------------------------
    counties = geometry.load_counties(get("census_cb2025_county_500k"))
    cattr = counties.drop(columns="geometry")
    for sid in ("census_cb2025_county_5m", "census_tl2025_county", "census_tl2026_county"):
        other = gpd.read_file(get(sid), ignore_geometry=True)
        if set(other.GEOID) != set(cattr.GEOID):
            raise ValueError(f"{sid} GEOIDs differ from cb_2025 500k: {sorted(set(other.GEOID) ^ set(cattr.GEOID))}")
    c20 = gpd.read_file(get("census_cb2025_county_20m"), ignore_geometry=True)
    missing20 = sorted(set(c20.STUSPS) ^ set(cattr.STUSPS))
    matches = assign.match_all(units, cattr)
    asg = assign.build_assignment(units, matches, cattr, sources.CENSUS_VINTAGE)
    va = assign.check_va_city_neighbours(counties, asg)
    get(names.SRC_POP)
    get("census_gcn_1970_1999")
    get("census_gcn_2014_2020")

    # ---- 3. geometry -----------------------------------------------------------------------------------
    areas = geometry.special_areas(get)
    nc_partial = sorted({m.geoid for m in matches if m.partial})
    durham = next(m.geoid for m in matches if m.partial and m.statute_name == "Durham")
    pieces, splits = geometry.build_pieces(counties, asg, areas, nc_partial, durham)
    split_by = {s["geoid"]: s for s in splits}
    for g, s in split_by.items():
        i = asg.index[asg.geoid == g][0]
        asg.at[i, "split_districts"] = f"{s['county_district']};{s['carved_to']}"
        label = {"yellowstone": "inside Yellowstone National Park",
                 "fort_bragg_camp_mackall": "in the Fort Bragg Military Reservation / Camp MacKall",
                 "fci_butner": "in the Butner Federal Correctional Complex"}[s["area"]]
        asg.at[i, "split_note"] = (f"The part {label} ({s['carved_km2']} km²) is in {s['carved_to']} under "
                                   f"{s['statute']}; the row is assigned to {s['county_district']}, which holds "
                                   f"the rest of the county ({s['remainder_km2']} km²).")
    for g in ("36005", "36061"):
        asg.loc[asg.geoid == g, "notes"] = ("28 U.S.C. § 112(c): E.D.N.Y. has concurrent jurisdiction over the "
                                            "waters within this county.")
    for g in asg.loc[asg.district_id == "nyed", "geoid"]:
        asg.loc[asg.geoid == g, "notes"] = ("28 U.S.C. § 112(b): S.D.N.Y. has concurrent jurisdiction over the "
                                            "waters within the Eastern District.")
    districts = geometry.district_frame(pieces)
    states = geometry.dissolve(pieces, "state")
    st500 = gpd.read_file(get("census_cb2025_state_500k")).set_crs(4326, allow_override=True)
    state_check = []
    for _, r in states.iterrows():
        ref = st500[st500.STUSPS == r.state].geometry.iloc[0]
        sym = geometry._km2(r.geometry.symmetric_difference(ref))
        state_check.append({"state": r.state, "symdiff_km2": round(sym, 2), "state_km2": round(geometry._km2(ref), 1)})
    legacy_failures: list[str] = []
    legacy = assign.build_legacy(get, districts, set(cattr.GEOID), legacy_failures)
    for g, (city, origins, note, page) in names.VA_FORMER_CITIES.items():
        dids = {asg.loc[(asg.state == "VA") & (asg.statute_name == o) & (asg.match_method != "va_city_rule"),
                        "district_id"].iloc[0] for o in origins}
        i = legacy.index[legacy.legacy_geoid == g]
        if len(i) == 0:
            raise ValueError(f"legacy Virginia city {g} not found in historical files")
        legacy.loc[i, "statute_check"] = (f"§ 127(c): formed from {', '.join(origins)} County (Census county notes, "
                                          f"note {note}, p. {page}) -> {'/'.join(sorted(dids))}")
        if dids != {legacy.loc[i[0], "district_id"]}:
            raise ValueError(f"legacy {g}: overlay {legacy.loc[i[0], 'district_id']} vs § 127(c) {dids}")
    legacy["statute_check"] = legacy.get("statute_check", pd.Series(dtype=str)).fillna("")

    # ---- 4. write tabular outputs ----------------------------------------------------------------------
    OUT.mkdir(parents=True, exist_ok=True)
    asg.to_csv(OUT / "county_district.csv", index=False)
    legacy.to_csv(OUT / "legacy_geoids.csv", index=False)
    va.to_csv(OUT / "va_city_rule.csv", index=False)
    pd.DataFrame(splits).to_csv(OUT / "split_counties.csv", index=False)
    pd.DataFrame([m.__dict__ for m in matches]).to_csv(OUT / "name_matches.csv", index=False)
    pd.DataFrame(xc).to_csv(OUT / "statute_crosscheck.csv", index=False)
    pd.DataFrame(state_check).to_csv(OUT / "state_outline_check.csv", index=False)

    place_rows = []
    for u in units:
        sec = f"{u.title} U.S.C. § {u.section}"
        for p in u.places:
            place_rows.append({"district_id": u.district_id, "division": u.division, "place": p.place,
                               "state": u.state, "statute_section": sec, "sentence": u.court_sentence,
                               "place_kind": p.place_kind, "statute_text": p.statute_text, "note": p.note})
    places = pd.DataFrame(place_rows)
    places.to_csv(OUT / "statute_places.csv", index=False)

    mby = defaultdict(list)
    for m in matches:
        mby[(m.section, m.district_id, m.division)].append(m)
    sp_out = []
    for sp in specials:
        sp = dict(sp)
        sp["handling"] = _special_handling(sp)
        sp_out.append(sp)
    dist_json = {}
    for did in IDS:
        us = [u for u in units if u.district_id == did]
        dist_json[did] = {"name": BY_ID[did].name, "short": BY_ID[did].short, "state": BY_ID[did].state,
                          "statute_sections": sorted({f"{u.title} U.S.C. § {u.section}" for u in us}),
                          "units": []}
        for u in us:
            ud = u.to_dict()
            ud["items"] = [{**it, **({k: getattr(m, k) for k in ("geoid", "census_name", "method", "reason",
                                                                 "source_id", "locator")}
                                     if (m := next((m for m in mby[(u.section, u.district_id, u.division)]
                                                    if m.statute_name == it["name"] and m.kind == it["kind"]
                                                    and m.partial == it["partial"]),
                                                   None)) else {})}
                           for it in ud["items"]]
            dist_json[did]["units"].append(ud)
    parsed = {
        "generated_by": "python -m pipeline.boundaries.build",
        "statute_source_ids": {"title28": "olrc_usc28_xml", "title48": "olrc_usc48_xml"},
        "release_point": f"Pub. L. {sources.USC_RELEASE_POINT}",
        "lii_crosscheck": {"sentences_checked": len(xc), "identical": sum(r["in_lii"] for r in xc),
                           "differences": bad},
        "district_changes_since_1980": _verified_changes(metas),
        "unverifiable_rewrites": statute.UNVERIFIABLE_REWRITES,
        "sections": metas,
        "special_clauses": sp_out,
        "districts": dist_json,
    }
    (OUT / "statute_parsed.json").write_text(json.dumps(parsed, indent=1, ensure_ascii=False))

    # ---- 5. geometry outputs ---------------------------------------------------------------------------
    districts.to_parquet(OUT / "districts.parquet", index=False)
    lo = geometry.write_topojson(pieces, GEO / "districts-lo.topo.json", intervals=LO_INTERVALS,
                                 with_counties=False, quantization=LO_QUANT)
    hi = geometry.write_topojson(pieces, GEO / "districts-hi.topo.json", intervals=HI_INTERVALS,
                                 with_counties=True, quantization=HI_QUANT)
    _write_divisions(units, matches, asg, places, splits)
    preview.render(GEO / "districts-lo.topo.json", GEO / "districts-hi.topo.json", OUT / "preview.png",
                   {k: gpd.GeoDataFrame(geometry=[v["geometry"]], crs=4326) for k, v in areas.items()})

    # ---- 6. observations + variables -------------------------------------------------------------------
    _write_observations(units, asg)

    # ---- 7. gaps ---------------------------------------------------------------------------------------
    _record_gaps(specials, missing20, legacy_failures, splits)

    summary = {"units": len(units), "matches": len(matches), "county_rows": len(asg),
               "districts": int(districts.district_id.nunique()), "splits": len(splits), "legacy": len(legacy),
               "places": len(places), "lii_identical": f"{parsed['lii_crosscheck']['identical']}/{len(xc)}",
               "lo": lo, "hi": hi}
    (OUT / "build_summary.json").write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary, indent=1))
    return 0


def _verified_changes(metas) -> list[dict]:
    """The curated inter-district moves, each checked against the OLRC amendment-note text."""
    notes = {m["section"]: " ".join(a["text"] for a in m.get("amendment_notes", [])) for m in metas}
    out = []
    for c in statute.DISTRICT_CHANGES_SINCE_1980:
        if c["quote"] not in notes.get(c["section"], ""):
            raise ValueError(f"amendment quote not found in § {c['section']} notes: {c['quote']!r}")
        out.append({**c, "verified_in": f"OLRC amendment notes to 28 U.S.C. § {c['section']} (olrc_usc28_xml)"})
    return out


def _write_divisions(units, matches, asg, places, splits) -> None:
    cname = asg.set_index("geoid")["county_name"]
    by_unit = defaultdict(list)
    for m in matches:
        by_unit[(m.section, m.district_id, m.division)].append(m)
    out = {"source": "28 U.S.C. §§ 81-131 and 48 U.S.C. §§ 1424, 1615, 1821 (OLRC USLM XML, release point "
                     f"{sources.USC_RELEASE_POINT}); county GEOIDs: Census cartographic boundaries {sources.CENSUS_VINTAGE}",
           "source_ids": ["olrc_usc28_xml", "olrc_usc48_xml", "census_cb2025_county_500k"],
           "districts": {}}
    split_by = defaultdict(list)
    for s in splits:
        split_by[s["carved_to"]].append(s)
    for did in IDS:
        us = [u for u in units if u.district_id == did]
        members = asg.loc[asg.district_id == did].sort_values("geoid")
        divs = []
        for u in sorted([u for u in us if u.division], key=lambda x: x.division_ordinal or 0):
            ms = [m for m in by_unit[(u.section, u.district_id, u.division)] if not m.partial]
            geoids = [m.geoid for m in ms if m.method != "former_county"]
            divs.append({"name": u.division, "ordinal": u.division_ordinal,
                         "statute_section": f"{u.title} U.S.C. § {u.section}",
                         "counties": [{"geoid": g, "name": cname[g]} for g in geoids],
                         "statute_names": [m.statute_name for m in ms],
                         "places_of_holding_court": [p.place for p in u.places],
                         "sentence": u.county_sentence, "court_sentence": u.court_sentence})
        partial = [{"geoid": s["geoid"], "name": s["county_name"], "portion": s["area"], "km2": s["carved_km2"],
                    "statute": s["statute"]} for s in split_by.get(did, [])]
        all_places = []
        for u in us:
            for p in u.places:
                if p.place not in all_places:
                    all_places.append(p.place)
        notes = []
        if did in ("vaed", "vawd"):
            notes.append("Independent cities are placed by 28 U.S.C. § 127(c) (county of origin); the statute's "
                         "county list includes former counties (Elizabeth City, Nansemond, Norfolk, Princess Anne, "
                         "Warwick) whose territory is now in independent cities.")
        if did == "txed":
            notes.append(statute.DIVISION_COUNT_DISCREPANCIES[("124", "txed")][2])
        out["districts"][did] = {
            "name": BY_ID[did].name,
            "statute_sections": sorted({f"{u.title} U.S.C. § {u.section}" for u in us}),
            "has_statutory_divisions": bool(divs),
            "divisions": divs,
            "counties": [{"geoid": r.geoid, "name": r.county_name} for r in members.itertuples()],
            "partial_counties_included": partial,
            "places_of_holding_court": all_places,
            "notes": notes,
        }
    (GEO / "divisions.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))


def _write_observations(units, asg) -> None:
    rows = []
    for did in IDS:
        us = [u for u in units if u.district_id == did]
        ndiv = len([u for u in us if u.division])
        places = []
        for u in us:
            for p in u.places:
                if p.place not in places:
                    places.append(p.place)
        secs = sorted({f"{u.title} U.S.C. § {u.section}" for u in us})
        src = "olrc_usc48_xml" if us[0].title == 48 else "olrc_usc28_xml"
        rows.append({"district_id": did, "period": STATUTE_PERIOD, "period_type": "CY",
                     "variable": "statutory_divisions", "value": ndiv, "unit": "count", "source_id": src,
                     "source_locator": f"{', '.join(secs)}: count of '(n) The ... Division comprises' paragraphs"})
        if places:   # gud, vid: title 48 names no place; omitted (gap), not reported as 0
            rows.append({"district_id": did, "period": STATUTE_PERIOD, "period_type": "CY",
                         "variable": "statutory_places_of_holding_court", "value": len(places), "unit": "count",
                         "source_id": src,
                         "source_locator": f"{', '.join(secs)}: distinct places in 'Court ... shall be held at' "
                                           f"sentences (statute_places.csv)"})
        rows.append({"district_id": did, "period": int(sources.CENSUS_VINTAGE), "period_type": "CY",
                     "variable": "county_equivalents", "value": int((asg.district_id == did).sum()),
                     "unit": "count", "source_id": "census_cb2025_county_500k",
                     "source_locator": "county_district.csv rows with this district_id (cb_2025_us_county_500k "
                                       "GEOIDs)"})
    write_observations(LANE, pd.DataFrame(rows))
    variables = [
        {"id": "statutory_divisions", "label": "Statutory divisions", "unit": "count", "period_type": "CY",
         "description": "Number of divisions into which the district is divided by statute (28 U.S.C. §§ 81-131; "
                        "48 U.S.C. § 1615 for the Virgin Islands). 0 = the statute names no divisions (many such "
                        "courts create divisions by local rule, which this does not count).",
         "source_ids": ["olrc_usc28_xml", "olrc_usc48_xml"],
         "caveats": "Statute current through Pub. L. 119-142 (Nov. 10, 2026); period = 2026. E.D. Tex.: § 124(c) "
                    "says 'seven divisions' but lists six; the six listed are counted.",
         "higher_means": "more statutory divisions", "derived": False, "formula": ""},
        {"id": "statutory_places_of_holding_court", "label": "Statutory places of holding court", "unit": "count",
         "period_type": "CY",
         "description": "Number of distinct places where the statute says court shall (or, for Odessa, may) be "
                        "held. 'Champaign/Urbana' and 'Eugene or Springfield' count as two places each; a "
                        "described site (D. Md. Southern Division; the Middletown-Wallkill area) counts as one.",
         "source_ids": ["olrc_usc28_xml", "olrc_usc48_xml"],
         "caveats": "Statutory places are not the same as the courthouses a court actually uses. Title 48 names no "
                    "place for D. Guam or D.V.I.; those two districts have no value (see data gaps).",
         "higher_means": "more places named in statute", "derived": False, "formula": ""},
        {"id": "county_equivalents", "label": "County-equivalents in the district", "unit": "count",
         "period_type": "CY",
         "description": "Number of Census 2025 county-equivalents (counties, parishes, boroughs, census areas, "
                        "independent cities, planning regions, municipios, islands) assigned to the district in "
                        "county_district.csv.",
         "source_ids": ["census_cb2025_county_500k", "olrc_usc28_xml"],
         "caveats": "Counties divided by a statutory carve-out (Yellowstone NP; Fort Bragg/Camp MacKall; FCI Butner) "
                    "are counted once, in the district that holds the rest of the county.",
         "higher_means": "more county-equivalents", "derived": True,
         "formula": "count(county_district.csv rows where district_id = d)"},
    ]
    (OUT / "variables.json").write_text(json.dumps(variables, indent=1))


def _record_gaps(specials, missing20, legacy_failures, splits) -> None:
    if legacy_failures:
        record_gap(LANE, "legacy_files_unavailable",
                   description="Historical county files that www2.census.gov answered with a 'Request Rejected' page "
                               "(HTTP 200) on every attempt: " + ", ".join(
                                   sources.SOURCES[s].url for s in legacy_failures) +
                               ". Legacy GEOIDs that appear only in these files are missing from legacy_geoids.csv.",
                   reason="Census CDN/WAF rejection; not worked around.")
    record_gap(LANE, "american_samoa_no_district",
               description="American Samoa (5 county-equivalents, GEOIDs 60010-60050) belongs to no federal judicial "
                           "district; county_district.csv carries it with district_id ''. It is not drawn.",
               districts=[], reason=assign.AS_REASON)
    isl = next(s for s in specials if s["type"] == "outlying_islands")
    record_gap(LANE, "hawaii_outlying_islands_not_drawn",
               description="28 U.S.C. § 91 includes in the District of Hawaii: " + ", ".join(isl["islands"]) +
                           ". None is a Census county-equivalent, so none is drawn or listed in county_district.csv.",
               districts=["hid"], reason="Not present in Census county files (cb_2025/tl_2025 contain no "
                                         "U.S. Minor Outlying Islands); Canton and Enderbury are no longer U.S. "
                                         "territory.")
    record_gap(LANE, "tennessee_river_waters_not_delineated",
               description="28 U.S.C. § 123(c)(1): W.D. Tenn. (Eastern Division) includes the waters of the Tennessee "
                           "River to the low-water mark on the eastern shore where the river divides the Western and "
                           "Middle Districts. That strip is not drawn; the Census county lines are used as is.",
               districts=["tnwd", "tnmd"],
               reason="No allowed public source gives the historical low-water line of the (now impounded) river.")
    big = max(splits, key=lambda s: s["carved_km2"] / (s["carved_km2"] + s["remainder_km2"]))
    big_total = big["carved_km2"] + big["remainder_km2"]
    record_gap(LANE, "split_counties_whole_in_county_tables",
               description="Eight counties are divided by a statutory carve-out: Park and Gallatin MT and Fremont ID "
                           "(Yellowstone NP -> wyd, 28 U.S.C. §§ 92, 106, 131); Hoke, Moore, Scotland and Richmond NC "
                           "(Fort Bragg / Camp MacKall -> nced) and Durham NC (FCI Butner -> nced), § 113(a)-(b). "
                           "The district polygons are cut, but each county's row in county_district.csv (and its "
                           "feature in the hi TopoJSON `counties` object) carries one district_id: the district holding "
                           "the rest of the county (mtd, idd or ncmd). Any county->district sum, such as a Census "
                           "population denominator or the county_equivalents count, therefore credits the carved-out "
                           "parts to mtd, idd and ncmd instead of wyd and nced. The largest share is "
                           f"{big['county_name']}, {big['state']}: {big['carved_km2']:,.1f} of {big_total:,.1f} km² "
                           f"({100 * big['carved_km2'] / big_total:.0f}%) is in {big['carved_to']} "
                           "(split_counties.csv). These rows carry split_districts and "
                           "split_note; no sub-county population split is produced by this lane, so per-capita rates "
                           "for these five districts that use a county-sum denominator are approximate.",
               districts=["mtd", "idd", "wyd", "ncmd", "nced"],
               reason="Census county rows are indivisible here; allocating the carved parts' population would need "
                      "block-level counts (population lane), and area shares are not population shares.")
    record_gap(LANE, "ny_concurrent_waters_not_drawn",
               description="28 U.S.C. § 112(b)-(c): S.D.N.Y. and E.D.N.Y. share jurisdiction over certain waters. "
                           "Shared jurisdiction is not drawable as territory; maps show the county lists only.",
               districts=["nysd", "nyed"], reason="Concurrent, not exclusive, jurisdiction.")
    record_gap(LANE, "statutory_places_not_named_gud_vid",
               description="Title 48 names no place of holding court for the District Court of Guam or the District "
                           "Court of the Virgin Islands; statute_places.csv has no rows for gud and vid.",
               variables=["statutory_places_of_holding_court"], districts=["gud", "vid"], periods=[STATUTE_PERIOD],
               reason="Not specified in 48 U.S.C. §§ 1424, 1611-1615.")
    if missing20:
        record_gap(LANE, "cb2025_20m_lacks_island_areas",
                   description=f"The 1:20m Census county file omits {', '.join(missing20)}; it is not used for "
                               "geometry (the low-res topology is simplified from the 1:500k file instead).",
                   reason="Census product scope.")


if __name__ == "__main__":
    raise SystemExit(main())
