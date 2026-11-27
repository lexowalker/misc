"""County-equivalent -> district assignment from the parsed statute, plus the legacy-GEOID crosswalk."""
from __future__ import annotations

import re
from dataclasses import dataclass

import geopandas as gpd
import pandas as pd

from pipeline.common.districts import BY_ID, STATES

from . import names
from .statute import Unit

LSAD_FOR_KIND = {"county": {"06"}, "parish": {"15"}, "city": {"25"}, "island": {"10"}}
AS_REASON = ("American Samoa is not part of any judicial district: no section of 28 U.S.C. §§ 81-131 or of title 48 "
             "creates a federal district court for it (its trial court is the territorial High Court).")


class UnmatchedName(ValueError):
    pass


@dataclass
class Match:
    section: str
    state: str
    district_id: str
    division: str
    statute_name: str
    kind: str
    partial: str
    geoid: str             # matched (or successor) GEOID
    census_name: str
    method: str            # exact | normalized_variant | spelling_variant | renamed | island | former_county
    reason: str
    source_id: str = ""
    locator: str = ""


def match_item(state: str, name: str, kind: str, counties: pd.DataFrame) -> tuple[str, str, str, str, str]:
    """Return (geoid, method, reason, source_id, locator) or raise UnmatchedName."""
    lsad = LSAD_FOR_KIND[kind]
    cand = counties[(counties.STUSPS == state) & (counties.LSAD.isin(lsad))]
    exact = cand[cand.NAME == name]
    ov = names.OVERRIDES.get((state, name, kind))
    if len(exact) == 1:
        if ov:
            raise ValueError(f"stale override for exact name {state} {name!r}")
        return exact.GEOID.iloc[0], "exact", "", "", ""
    if len(exact) > 1:
        raise UnmatchedName(f"{state} {kind} {name!r} is ambiguous: {list(exact.GEOID)}")
    if ov:
        row = counties[counties.GEOID == ov["geoid"]]
        if len(row) != 1 or row.STUSPS.iloc[0] != state or row.LSAD.iloc[0] not in lsad:
            raise ValueError(f"override {state} {name!r} -> {ov['geoid']} is not a {kind} of {state}")
        if ov["method"] in ("normalized_variant", "island") and \
                names.normalize(name) != names.normalize(row.NAME.iloc[0]):
            raise ValueError(f"override {state} {name!r} marked {ov['method']} but names differ: {row.NAME.iloc[0]}")
        if ov["method"] not in ("normalized_variant", "island") and \
                names.normalize(name) == names.normalize(row.NAME.iloc[0]):
            raise ValueError(f"override {state} {name!r} should be a normalized_variant")
        return ov["geoid"], ov["method"], ov["reason"], ov["source_id"], ov["locator"]
    sugg = cand[cand.NAME.map(names.normalize) == names.normalize(name)]
    raise UnmatchedName(f"No Census {kind} named {name!r} in {state}. Add an explicit override to names.OVERRIDES "
                        f"after checking it. Normalized candidates: {list(zip(sugg.GEOID, sugg.NAME))}")


def match_all(units: list[Unit], counties: pd.DataFrame) -> list[Match]:
    out: list[Match] = []
    for u in units:
        for it in u.items:
            if u.state == "VA" and it.kind == "county" and it.name in names.VA_FORMER_COUNTIES:
                fc = names.VA_FORMER_COUNTIES[it.name]
                g = fc["successor_geoids"][0]
                out.append(Match(u.section, u.state, u.district_id, u.division, it.name, it.kind, it.partial, g,
                                 counties.loc[counties.GEOID == g, "NAMELSAD"].iloc[0], "former_county",
                                 f"Former {it.name} County no longer exists. {fc['text']} Its successor city is "
                                 f"placed by § 127(c).", names.SRC_POP,
                                 f"Part III, 'Virginia Notes', note(s) {fc['note']}"))
                continue
            geoid, method, reason, sid, loc = match_item(u.state, it.name, it.kind, counties)
            if it.note:
                reason = (reason + " " + it.note).strip()
            out.append(Match(u.section, u.state, u.district_id, u.division, it.name, it.kind, it.partial, geoid,
                             counties.loc[counties.GEOID == geoid, "NAMELSAD"].iloc[0], method, reason, sid, loc))
    return out


def _sec_label(u: Unit) -> str:
    return f"{u.title} U.S.C. § {u.section}"


def build_assignment(units: list[Unit], matches: list[Match], counties: pd.DataFrame, vintage: str) -> pd.DataFrame:
    rows: dict[str, dict] = {}
    cinfo = counties.set_index("GEOID")

    def put(geoid, district_id, section, division, statute_name, method, basis):
        if geoid in rows:
            raise ValueError(f"{geoid} assigned twice: {rows[geoid]['district_id']} and {district_id}")
        r = cinfo.loc[geoid]
        rows[geoid] = {"geoid": geoid, "state": r.STUSPS, "county_name": r.NAMELSAD, "district_id": district_id,
                       "statute_section": section, "statute_division": division, "statute_name": statute_name,
                       "match_method": method, "basis": basis, "vintage": vintage}

    by_unit = {}
    for m in matches:
        by_unit.setdefault((m.section, m.district_id, m.division), []).append(m)
    for u in units:
        if u.whole_state:
            for g in counties.loc[counties.STUSPS == u.state, "GEOID"]:
                put(g, u.district_id, _sec_label(u), u.division, "", "whole_state",
                    f"{_sec_label(u)}: the state/territory constitutes one judicial district "
                    f"({(u.county_sentence or u.court_sentence)[:160]})")
            continue
        for m in by_unit.get((u.section, u.district_id, u.division), []):
            if m.partial or m.method == "former_county":
                continue
            put(m.geoid, u.district_id, _sec_label(u), u.division, m.statute_name, m.method,
                f"Listed in {_sec_label(u)}" + (f" ({u.division})" if u.division else "") + ".")

    # Virginia independent cities: 28 U.S.C. § 127(c)
    va_county_district = {}
    for u in units:
        if u.state == "VA":
            for it in u.items:
                va_county_district[it.name] = u.district_id
    for g, (city, origins, note, page) in names.VA_CITY_ORIGINS.items():
        ds = {va_county_district[o] for o in origins}
        if len(ds) != 1:
            raise ValueError(f"{city} city: counties of origin {origins} are in different districts {ds}")
        put(g, ds.pop(), "28 U.S.C. § 127(c)", "", f"{city} city", "va_city_rule",
            f"§ 127(c): independent city formed out of the territory of {' and '.join(origins)} "
            f"(Census 1790-1990 county notes, note {note}, p. {page}).")
    va_cities = set(counties.loc[(counties.STUSPS == "VA") & (counties.LSAD == "25"), "GEOID"])
    if va_cities != set(names.VA_CITY_ORIGINS):
        raise ValueError(f"Virginia city list mismatch: {sorted(va_cities ^ set(names.VA_CITY_ORIGINS))}")

    for g in counties.loc[counties.STUSPS == "AS", "GEOID"]:
        put(g, "", "", "", "", "no_district", AS_REASON)

    missing = sorted(set(counties.GEOID) - set(rows))
    if missing:
        detail = counties[counties.GEOID.isin(missing)][["GEOID", "NAMELSAD", "STUSPS"]].values.tolist()
        raise ValueError(f"{len(missing)} county-equivalents not assigned by the statute: {detail}")
    df = pd.DataFrame(rows.values()).sort_values("geoid").reset_index(drop=True)
    df["split_districts"] = ""
    df["split_note"] = ""
    df["notes"] = ""
    return df


def check_va_city_neighbours(gdf: gpd.GeoDataFrame, assignment: pd.DataFrame) -> pd.DataFrame:
    """For every Virginia independent city, list the county-equivalents it touches and their districts.

    § 127(c) is satisfied unambiguously when every neighbouring *county* is in the same district as the city's
    county of origin. Raises if any city touches a county of the other district.
    """
    va = gdf[gdf.STUSPS == "VA"].to_crs(5070)
    dist = assignment.set_index("geoid")["district_id"]
    out = []
    for g in names.VA_CITY_ORIGINS:
        geom = va.loc[va.GEOID == g, "geometry"].iloc[0]
        nb = va[(va.GEOID != g) & va.geometry.intersects(geom.buffer(5))]
        shared = []
        for _, r in nb.iterrows():
            length = r.geometry.boundary.intersection(geom.buffer(5)).length
            if length > 50:   # metres of shared border; ignore point contacts
                shared.append((r.GEOID, r.NAMELSAD, r.LSAD, dist[r.GEOID], round(length)))
        county_ds = {s[3] for s in shared if s[2] == "06"}
        out.append({"geoid": g, "city": names.VA_CITY_ORIGINS[g][0], "district_id": dist[g],
                    "neighbour_counties": "; ".join(f"{s[1]} ({s[3]})" for s in shared if s[2] == "06"),
                    "neighbour_cities": "; ".join(f"{s[1]} ({s[3]})" for s in shared if s[2] != "06"),
                    "consistent": county_ds <= {dist[g]}})
    df = pd.DataFrame(out)
    bad = df[~df.consistent]
    if len(bad):
        raise ValueError(f"Virginia cities touching counties of another district: {bad.to_dict('records')}")
    return df


# ---------------------------------------------------------------------------------------------------------
# legacy GEOIDs

def _hist_frames(get, failures: list[str]) -> list[tuple[str, str, gpd.GeoDataFrame]]:
    """(vintage, source_id, gdf[GEOID, NAME, geometry]) for every historical county file that could be fetched."""
    from .sources import HIST_STATES, InvalidBody
    out = []
    for vint, tmpl, stcol, cocol in (("1990", "census_co90_{}", "ST", "CO"), ("2000", "census_co00_{}", "STATE", "COUNTY")):
        for st in HIST_STATES:
            sid = tmpl.format(st)
            try:
                path = get(sid)
            except InvalidBody:
                failures.append(sid)
                continue
            g = gpd.read_file(path)
            if g.crs is None:
                g = g.set_crs(4269)   # these files carry no .prj; they are geographic lon/lat
            g["GEOID"] = g[stcol].astype(str).str.zfill(2) + g[cocol].astype(str).str.zfill(3)
            out.append((vint, sid, g[["GEOID", "NAME", "geometry"]]))
    g = gpd.read_file(get("census_gz2010_county_500k"))
    g["GEOID"] = g["STATE"] + g["COUNTY"]
    out.append(("2010", "census_gz2010_county_500k", g[["GEOID", "NAME", "geometry"]]))
    g = gpd.read_file(get("census_cb2020_county_500k"))
    out.append(("2020", "census_cb2020_county_500k", g[["GEOID", "NAME", "geometry"]]))
    return out


def _change_notes(get) -> list[tuple[str, str]]:
    rows = []
    for sid in ("census_gcn_1970_1999", "census_gcn_2000_2010", "census_gcn_2011_2013", "census_gcn_2014_2020",
                "census_gcn_2021", "census_gcn_2022"):
        with open(get(sid), encoding="latin-1") as f:
            for line in f:
                rows.append((sid, line.rstrip("\n")))
    return rows


def build_legacy(get, districts_gdf: gpd.GeoDataFrame, current_geoids: set[str],
                 failures: list[str] | None = None) -> pd.DataFrame:
    """Every county GEOID in the 1990/2000/2010/2020 Census county files that is not a 2025 GEOID.

    Each is mapped to the district holding the largest share of its area (equal-area overlay of the legacy
    polygon on the 2025 district polygons, Yellowstone/Fort Bragg carve-outs included).
    """
    failures = [] if failures is None else failures
    frames = _hist_frames(get, failures)
    seen: dict[str, dict] = {}
    for vint, sid, g in frames:
        g = g[~g.GEOID.isin(current_geoids)]
        g = g[g.GEOID.str[:2].isin({v[1] for v in STATES.values()} | {"60"})]
        if g.empty:
            continue
        g = g.dissolve(by="GEOID", aggfunc="first").reset_index()
        for _, r in g.iterrows():
            e = seen.setdefault(r.GEOID, {"geoid": r.GEOID, "names": [], "vintages": [], "sources": [], "geom": None,
                                         "geom_vintage": ""})
            if r.NAME not in e["names"]:
                e["names"].append(r.NAME)
            e["vintages"].append(vint)
            e["sources"].append(sid)
            e["geom"], e["geom_vintage"] = gpd.GeoSeries([r.geometry], crs=g.crs), vint   # latest vintage wins
    notes = _change_notes(get)
    dproj = districts_gdf.to_crs(5070)
    fips_to_postal = {v[1]: k for k, v in STATES.items()}
    fips_to_postal["60"] = "AS"
    out = []
    for geoid, e in sorted(seen.items()):
        st = geoid[:2]
        postal = fips_to_postal[st]
        geom = e["geom"].to_crs(5070).iloc[0]
        area = geom.area
        if postal == "AS":
            did, share, succ = "", None, ""
        else:
            inter = dproj.geometry.intersection(geom).area
            shares = (inter / area).round(4)
            top = shares.sort_values(ascending=False)
            did = dproj.loc[top.index[0], "district_id"]
            share = float(top.iloc[0])
            succ = "; ".join(f"{dproj.loc[i, 'district_id']}:{s:.3f}" for i, s in top.items() if s >= 0.001)
        code = geoid[2:]
        ev = ""
        cands = []
        for sid, line in notes:
            parts = line.split("|")
            if len(parts) < 9 or parts[0].split("-")[-1] != st or len(parts[2]) != 3:
                continue
            own = parts[2] == code
            if not own and f"({code})" not in parts[8] and f"(99{code})" not in parts[8]:
                continue
            retire = bool(re.search(r"Deleted|Name Change|Code Change|FIPS|New Entity", parts[3]))
            # prefer: retirement/rename notes (own entity, then others naming it), then any other note
            rank = (0 if own else 1) if retire else (2 if own else 3)
            cands.append((rank, f"{sid}: {parts[1]} | {parts[3]} | {parts[4]} | {parts[8][:220]}"))
        if cands:
            ev = sorted(cands, key=lambda c: c[0])[0][1]
        out.append({"legacy_geoid": geoid, "state": postal, "legacy_name": " / ".join(e["names"]),
                    "census_vintages": ";".join(sorted(set(e["vintages"]))),
                    "district_id": did, "area_share": share, "district_shares": succ,
                    "method": "no_district" if postal == "AS" else
                    f"area overlay of the {e['geom_vintage']} Census polygon on the 2025 district polygons",
                    "source_ids": ";".join(sorted(set(e["sources"]))), "change_note_evidence": ev})
    df = pd.DataFrame(out)
    return df
