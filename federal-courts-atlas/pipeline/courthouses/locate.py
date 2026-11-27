"""Locate a named city (a statutory place of holding court, or an FJC courthouse city) on a Census point.

Rules, in order:
  1. An explicit OVERRIDES entry for (district_id, name), with its reason. Nothing is fuzzy-matched.
  2. Census places in the same state whose name, minus the Census legal description ("city", "town", "CDP",
     ...), equals the name after ``gazetteer.norm`` (accents, case, punctuation, Saint/St. ignored).
  3. If several match, keep those whose internal point falls in the district (point-in-polygon), then those in
     the statutory division's counties, then incorporated places over CDPs. Still ambiguous -> build error.
  4. No place: county subdivisions of the same state, same rules (New England towns, NYC boroughs).
  5. Nothing -> unmatched (build error for statute places; logged for FJC cities).
The point is always the Census internal point of the matched entity.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .gazetteer import norm


@dataclass(frozen=True)
class Override:
    layer: str        # place | cousub | tiger_county | none
    geoid: str | None
    method: str       # renamed | consolidated | spelling_variant | interpretation | described_site | ambiguous | ...
    reason: str


# Keyed by (district_id, name as written in the statute / FJC list).
OVERRIDES: dict[tuple[str, str], Override] = {
    ("ared", "Helena"): Override("place", "0531190", "consolidated",
        "No Census place named Helena in Arkansas. The only place carrying the name is 'Helena-West Helena city' "
        "(Phillips County, in the statute's Delta Division)."),
    ("flmd", "Fernandina"): Override("place", "1222175", "renamed",
        "No Census place named Fernandina in Florida; 'Fernandina Beach city' (Nassau County, Jacksonville "
        "Division) is the only place with that name."),
    ("gamd", "Athens"): Override("place", "1303440", "consolidated",
        "Census records Athens as 'Athens-Clarke County unified government (balance)' (Clarke County, Athens "
        "Division); there is no separate place named Athens in Georgia."),
    ("gamd", "Macon"): Override("place", "1349008", "consolidated",
        "Census records Macon as 'Macon-Bibb County' (Bibb County, Macon Division)."),
    ("gasd", "Augusta"): Override("place", "1304204", "consolidated",
        "Census records Augusta as 'Augusta-Richmond County consolidated government (balance)' (Richmond County, "
        "Augusta Division)."),
    ("hid", "Honolulu"): Override("place", "1571550", "census_name",
        "Census has no incorporated place named Honolulu; the city's urban core is the 'Urban Honolulu CDP' "
        "(Honolulu County)."),
    ("idd", "Boise"): Override("place", "1608830", "census_name",
        "Census records Boise as 'Boise City city' (Ada County)."),
    ("kyed", "Lexington"): Override("place", "2146027", "consolidated",
        "Census records Lexington as 'Lexington-Fayette urban county' (Fayette County, Central Division)."),
    ("mtd", "Butte"): Override("place", "3011397", "consolidated",
        "Census records Butte as 'Butte-Silver Bow (balance)' (Silver Bow County, Butte Division)."),
    ("tnmd", "Nashville"): Override("place", "4752006", "consolidated",
        "Census records Nashville as 'Nashville-Davidson metropolitan government (balance)' (Davidson County, "
        "Nashville Division)."),
    ("txwd", "Pecos"): Override("place", "4873493", "census_name",
        "Census records Pecos as 'Town of Pecos city' (Reeves County, Pecos Division)."),
    ("tned", "Greenville"): Override("place", "4730980", "spelling_variant",
        "28 U.S.C. § 123(a)(2) spells the Northeastern Division's place 'Greenville' (OLRC and LII texts agree). "
        "Tennessee has no Census place of that name; 'Greeneville town' is the seat of Greene County, which the "
        "statute lists in that division."),
    ("oked", "S. McAlester"): Override("place", "4044800", "interpretation",
        "The statute writes 'S. McAlester' (South McAlester). No Census place has that name; 'McAlester city' "
        "(Pittsburg County, in E.D. Okla.) is used. Reading S. McAlester as present-day McAlester is an "
        "interpretation, not verified against an allowed source."),
    ("wiwd", "Superior"): Override("place", "5578650", "ambiguous",
        "Two Census places named Superior lie in Douglas County, W.D. Wis.: 'Superior city' (the county seat) and "
        "'Superior village'. The city is used; the FJC courthouse list places the federal building in Superior."),
    ("nyed", "Brooklyn"): Override("cousub", "3604710022", "borough",
        "Brooklyn is not a Census place; it is the county subdivision 'Brooklyn borough' (Kings County)."),
    ("nysd", "New York"): Override("cousub", "3606144919", "interpretation",
        "'New York city' spans both S.D.N.Y. and E.D.N.Y.; its Census internal point lies in E.D.N.Y. The "
        "S.D.N.Y. part of the city is Manhattan and the Bronx; the point used is Manhattan borough (New York "
        "County), where the FJC list shows the district's New York City courthouses."),
    ("nysd", "Middletown-Wallkill area of Orange County"): Override("place", "3647042", "described_site",
        "The statute describes an area, not a city: 'the Middletown-Wallkill area of Orange County or such nearby "
        "location as may be deemed appropriate'. The point is the internal point of Middletown city, the "
        "incorporated city the description names. It marks the area, not a site."),
    ("mdd", "Montgomery County or Prince George's County (site within five miles of their common boundary)"):
        Override("none", None, "described_site",
        "The statute names no city: 'a suitable site in Montgomery or Prince George's County not more than five "
        "miles from the boundary of Montgomery and Prince George's Counties'. No point is assigned; the courthouse "
        "records show where D. Md.'s Southern Division court actually sits."),
    # --- FJC courthouse cities -------------------------------------------------------------------------
    ("txsd", "Corpus Christie"): Override("place", "4817000", "spelling_variant",
        "FJC heading 'Corpus Christie, Texas (2001)' (sic); Texas has one Census place of that sound, "
        "'Corpus Christi city' (Nueces County, S.D. Tex.)."),
    ("caed", "Yosemite"): Override("place", "0686912", "interpretation",
        "FJC heading 'Yosemite, California' names no Census place. Three CDPs carry the name (Yosemite Lakes, "
        "Yosemite Valley, Yosemite West); 'Yosemite Valley CDP' (Mariposa County, E.D. Cal.) is used. "
        "Interpretation, not verified against an allowed source."),
    ("nmid", "Saipan"): Override("tiger_county", "69110", "island_municipality",
        "48 U.S.C. § 1821 names Saipan, an island and a county-equivalent (Saipan Municipality, 69110). The "
        "Gazetteer has no island areas; the TIGER/Line 2025 county internal point is used."),
}


def _pick(c: pd.DataFrame, district_id: str, division_counties: set | None) -> tuple[pd.DataFrame, str]:
    if len(c) <= 1:
        return c, "exact_name"
    c2 = c[c["district_id"] == district_id]
    if len(c2) == 1:
        return c2, "exact_name_disambiguated_by_district"
    if len(c2) == 0:
        c2 = c
    if division_counties:
        c3 = c2[c2["county_geoid"].isin(division_counties)]
        if len(c3) == 1:
            return c3, "exact_name_disambiguated_by_division"
        if len(c3) > 1:
            c2 = c3
    inc = c2[c2["FUNCSTAT"].isin(["A", "B", "C", "G"])] if "FUNCSTAT" in c2 else c2
    if len(inc) == 1:
        return inc, "exact_name_incorporated_preferred"
    return c2, "ambiguous"


def locate(name: str, state: str, district_id: str, places: pd.DataFrame, cousubs: pd.DataFrame,
           county_pts: pd.DataFrame, division_counties: set | None = None) -> dict:
    """Return {lat, lon, layer, geoid, census_name, method, note, source_id} (lat/lon None if not located)."""
    ov = OVERRIDES.get((district_id, name))
    if ov:
        if ov.layer == "none":
            return {"lat": None, "lon": None, "layer": None, "geoid": None, "census_name": None,
                    "method": f"override:{ov.method}", "note": ov.reason, "source_id": None}
        if ov.layer == "tiger_county":
            row = county_pts[county_pts["GEOID"] == ov.geoid].iloc[0]
            sid = "census_tl2025_county"
        else:
            tab = places if ov.layer == "place" else cousubs
            row = tab[tab["GEOID"] == ov.geoid].iloc[0]
            sid = row["source_id"]
        return {"lat": float(row["lat"]), "lon": float(row["lon"]), "layer": ov.layer, "geoid": ov.geoid,
                "census_name": row["NAME"], "method": f"override:{ov.method}", "note": ov.reason, "source_id": sid}
    key = norm(name)
    for layer, tab in (("place", places), ("cousub", cousubs)):
        c = tab[(tab["USPS"] == state) & (tab["key"] == key)]
        if layer == "cousub" and len(c):
            # County subdivisions repeat names across counties; only an unambiguous one in the district is used.
            c = c[c["district_id"] == district_id]
        if len(c) == 0:
            continue
        c, how = _pick(c, district_id, division_counties)
        if len(c) != 1:
            return {"lat": None, "lon": None, "layer": layer, "geoid": None, "census_name": None,
                    "method": "ambiguous", "note": "candidates: " + "; ".join(c["NAME"] + " " + c["GEOID"]),
                    "source_id": None}
        row = c.iloc[0]
        return {"lat": float(row["lat"]), "lon": float(row["lon"]), "layer": layer, "geoid": row["GEOID"],
                "census_name": row["NAME"], "method": how if layer == "place" else f"cousub_{how}", "note": "",
                "source_id": row["source_id"]}
    return {"lat": None, "lon": None, "layer": None, "geoid": None, "census_name": None, "method": "unmatched",
            "note": "", "source_id": None}
