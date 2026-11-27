"""Every file the boundaries lane downloads, fetched through ``pipeline.common.http.fetch`` and registered.

``get(source_id)`` returns the cached path (downloading on first use) and records the source in
``data/sources/boundaries.json`` with URL, dataset, publisher, vintage, retrieval date and sha256.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

from pipeline.common.http import fetch
from pipeline.common.manifest import register_source

LANE = "boundaries"

USC_RELEASE_POINT = "119-142"  # Public Law 119-142 (Nov. 10, 2026): current OLRC release point when fetched
_USC = f"https://uscode.house.gov/download/releasepoints/us/pl/119/142"
_TIGER = "https://www2.census.gov/geo/tiger"
_CENSUS_REF = "https://www2.census.gov/geo/docs/reference"
CENSUS_VINTAGE = "2025"

# States/territories present in the 1990 and 2000 cartographic county files (one zip per state).
_HIST_STATES = ["01", "02", "04", "05", "06", "08", "09", "10", "11", "12", "13", "15", "16", "17", "18", "19",
                "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35",
                "36", "37", "38", "39", "40", "41", "42", "44", "45", "46", "47", "48", "49", "50", "51", "53",
                "54", "55", "56", "60", "66", "69", "72", "78"]


@dataclass(frozen=True)
class Source:
    url: str
    dataset: str
    publisher: str
    vintage: str
    notes: str = ""


SOURCES: dict[str, Source] = {
    # --- statute -------------------------------------------------------------------------------------
    "olrc_usc28_xml": Source(
        f"{_USC}/xml_usc28@{USC_RELEASE_POINT}.zip",
        "United States Code, Title 28 (USLM XML), release point " + USC_RELEASE_POINT,
        "Office of the Law Revision Counsel, U.S. House of Representatives",
        f"current through Pub. L. {USC_RELEASE_POINT}",
        "28 U.S.C. §§ 81-131 (judicial districts, divisions, places of holding court) parsed from this file."),
    "olrc_usc48_xml": Source(
        f"{_USC}/xml_usc48@{USC_RELEASE_POINT}.zip",
        "United States Code, Title 48 (USLM XML), release point " + USC_RELEASE_POINT,
        "Office of the Law Revision Counsel, U.S. House of Representatives",
        f"current through Pub. L. {USC_RELEASE_POINT}",
        "48 U.S.C. § 1424 (Guam), §§ 1611/1615 (Virgin Islands and its divisions), § 1821 (N. Mariana Is.)."),
    # --- Census county geometry -----------------------------------------------------------------------
    "census_cb2025_county_500k": Source(
        f"{_TIGER}/GENZ2025/shp/cb_2025_us_county_500k.zip",
        "Cartographic Boundary File, Counties, 1:500,000 (cb_2025_us_county_500k)",
        "U.S. Census Bureau", CENSUS_VINTAGE,
        "3,235 county-equivalents: 50 states, DC, PR, AS, GU, MP, VI. Geometry for the hi-res topology, the "
        "GeoParquet and the low-res topology (simplified)."),
    "census_cb2025_county_5m": Source(
        f"{_TIGER}/GENZ2025/shp/cb_2025_us_county_5m.zip",
        "Cartographic Boundary File, Counties, 1:5,000,000 (cb_2025_us_county_5m)",
        "U.S. Census Bureau", CENSUS_VINTAGE, "Cross-check of county list (same 3,235 GEOIDs)."),
    "census_cb2025_county_20m": Source(
        f"{_TIGER}/GENZ2025/shp/cb_2025_us_county_20m.zip",
        "Cartographic Boundary File, Counties, 1:20,000,000 (cb_2025_us_county_20m)",
        "U.S. Census Bureau", CENSUS_VINTAGE,
        "Checked only: omits AS, GU, MP, VI (3,222 rows), so not used for geometry."),
    "census_tl2025_county": Source(
        f"{_TIGER}/TIGER2025/COUNTY/tl_2025_us_county.zip",
        "TIGER/Line Shapefile, Counties (tl_2025_us_county)", "U.S. Census Bureau", CENSUS_VINTAGE,
        "Cross-check: identical GEOID set to cb_2025 (island areas included in both)."),
    "census_tl2026_county": Source(
        f"{_TIGER}/TIGER2026/COUNTY/tl_2026_us_county.zip",
        "TIGER/Line Shapefile, Counties (tl_2026_us_county)", "U.S. Census Bureau", "2026",
        "Cross-check only: no 2026 cartographic file existed when fetched; GEOIDs and names identical to 2025."),
    "census_cb2025_state_500k": Source(
        f"{_TIGER}/GENZ2025/shp/cb_2025_us_state_500k.zip",
        "Cartographic Boundary File, States, 1:500,000 (cb_2025_us_state_500k)", "U.S. Census Bureau",
        CENSUS_VINTAGE, "Used only to check that dissolved counties reproduce state outlines."),
    # --- special areas named in the statute ------------------------------------------------------------
    "census_tl2025_arealm_16": Source(
        f"{_TIGER}/TIGER2025/AREALM/tl_2025_16_arealm.zip", "TIGER/Line Area Landmarks, Idaho (tl_2025_16_arealm)",
        "U.S. Census Bureau", CENSUS_VINTAGE, "Feature 'Yellowstone Natl Pk' (MTFCC K2181), Idaho part."),
    "census_tl2025_arealm_30": Source(
        f"{_TIGER}/TIGER2025/AREALM/tl_2025_30_arealm.zip", "TIGER/Line Area Landmarks, Montana (tl_2025_30_arealm)",
        "U.S. Census Bureau", CENSUS_VINTAGE, "Feature 'Yellowstone Natl Pk' (MTFCC K2181), Montana part."),
    "census_tl2025_arealm_56": Source(
        f"{_TIGER}/TIGER2025/AREALM/tl_2025_56_arealm.zip", "TIGER/Line Area Landmarks, Wyoming (tl_2025_56_arealm)",
        "U.S. Census Bureau", CENSUS_VINTAGE, "Feature 'Yellowstone Natl Pk', Wyoming part (checked only)."),
    "census_tl2025_arealm_37": Source(
        f"{_TIGER}/TIGER2025/AREALM/tl_2025_37_arealm.zip",
        "TIGER/Line Area Landmarks, North Carolina (tl_2025_37_arealm)", "U.S. Census Bureau", CENSUS_VINTAGE,
        "Feature 'Butner Federal Correctional Complx' (MTFCC K1237) for the 28 U.S.C. § 113 Butner carve-out."),
    "census_tl2025_mil": Source(
        f"{_TIGER}/TIGER2025/MIL/tl_2025_us_mil.zip", "TIGER/Line Military Installations (tl_2025_us_mil)",
        "U.S. Census Bureau", CENSUS_VINTAGE,
        "Features 'Fort Bragg' and 'Camp MacKall' (MTFCC G6500) for the 28 U.S.C. § 113 carve-out."),
    # --- legacy county codes (for pre-2025 Census tables) ------------------------------------------------
    "census_cb2020_county_500k": Source(
        f"{_TIGER}/GENZ2020/shp/cb_2020_us_county_500k.zip",
        "Cartographic Boundary File, Counties, 1:500,000 (cb_2020_us_county_500k)", "U.S. Census Bureau", "2020",
        "Legacy GEOIDs (e.g. Connecticut's eight pre-2022 counties)."),
    "census_gz2010_county_500k": Source(
        f"{_TIGER}/GENZ2010/gz_2010_us_050_00_500k.zip",
        "Cartographic Boundary File, Counties, 1:500,000, Census 2010 (gz_2010_us_050_00_500k)",
        "U.S. Census Bureau", "2010", "Legacy GEOIDs present in 2010 geography."),
    "census_gcn_1970_1999": Source(f"{_CENSUS_REF}/bndrychange/national_gcn_1970_1999.txt",
                                   "Geographic change notes, 1970-1999", "U.S. Census Bureau", "1970-1999",
                                   "Evidence column of legacy_geoids.csv."),
    "census_gcn_2000_2010": Source(f"{_CENSUS_REF}/bndrychange/national_gcn_2000_2010.txt",
                                   "Geographic change notes, 2000-2010", "U.S. Census Bureau", "2000-2010"),
    "census_gcn_2011_2013": Source(f"{_CENSUS_REF}/bndrychange/national_gcn_2011_2013.txt",
                                   "Geographic change notes, 2011-2013", "U.S. Census Bureau", "2011-2013"),
    "census_gcn_2014_2020": Source(f"{_CENSUS_REF}/bndrychange/national_gcn_2014_2020.txt",
                                   "Geographic change notes, 2014-2020", "U.S. Census Bureau", "2014-2020"),
    "census_gcn_2021": Source(f"{_CENSUS_REF}/bndrychange/national_gcn_2021.txt", "Geographic change notes, 2021",
                              "U.S. Census Bureau", "2021"),
    "census_gcn_2022": Source(f"{_CENSUS_REF}/bndrychange/national_gcn_2022.txt", "Geographic change notes, 2022",
                              "U.S. Census Bureau", "2022"),
    # --- Virginia independent cities: county of origin (28 U.S.C. § 127(c)) ------------------------------
    "census_pop_counties_1790_1990": Source(
        "https://www2.census.gov/library/publications/decennial/1990/population-of-states-and-counties-us-1790-1990/"
        "population-of-states-and-counties-of-the-united-states-1790-1990.pdf",
        "Population of States and Counties of the United States: 1790 to 1990 (Forstall, 1996)",
        "U.S. Census Bureau", "1996",
        "Part III 'Virginia Notes', notes C1-C42 (pp. 174-175): the county or counties from which each "
        "Virginia independent city was formed, and the fate of the former counties of Elizabeth City, "
        "Nansemond, Norfolk, Princess Anne and Warwick."),
}
for _st in _HIST_STATES:
    SOURCES[f"census_co90_{_st}"] = Source(
        f"{_TIGER}/PREVGENZ/co/co90shp/co{_st}_d90_shp.zip",
        f"Cartographic Boundary File, Counties, 1990 (co{_st}_d90)", "U.S. Census Bureau", "1990",
        "Legacy county GEOIDs present in 1990 geography.")
    SOURCES[f"census_co00_{_st}"] = Source(
        f"{_TIGER}/PREVGENZ/co/co00shp/co{_st}_d00_shp.zip",
        f"Cartographic Boundary File, Counties, 2000 (co{_st}_d00)", "U.S. Census Bureau", "2000",
        "Legacy county GEOIDs present in 2000 geography.")

HIST_STATES = _HIST_STATES


def lii_source_id(title: int, section: str) -> str:
    return f"lii_{title}usc{section}"


def lii_source(title: int, section: str) -> Source:
    return Source(f"https://www.law.cornell.edu/uscode/text/{title}/{section}",
                  f"{title} U.S.C. § {section} (Cornell LII web text)", "Legal Information Institute, Cornell Law School",
                  "as published when fetched", "Cross-check of the OLRC text only; never used as the primary text.")


_MAGIC = {".zip": b"PK", ".pdf": b"%PDF"}


class InvalidBody(RuntimeError):
    """The server answered 200 but with something other than the file (e.g. a cached WAF rejection page)."""


def _body_ok(path: Path, url: str) -> bool:
    """Reject bodies that are not what the URL promises (e.g. a WAF 'Request Rejected' page sent with HTTP 200)."""
    with open(path, "rb") as f:
        head = f.read(512)
    for suffix, magic in _MAGIC.items():
        if url.lower().endswith(suffix):
            return head.startswith(magic)
    if url.lower().endswith(".txt"):
        return not head.lstrip().lower().startswith(b"<html") and b"Request Rejected" not in head
    return b"Request Rejected" not in head


def get(source_id: str, *, register: bool = True) -> Path:
    """Fetch (cached) and register one source; return the local path."""
    if source_id.startswith("lii_"):
        title, sec = source_id[4:].split("usc")
        src = lii_source(int(title), sec)
    else:
        src = SOURCES[source_id]
    r = fetch(src.url)
    tries = 0
    while not _body_ok(r.path, src.url):
        tries += 1
        if tries > 1:   # one fresh attempt per build; a CDN-cached rejection does not clear in seconds
            raise InvalidBody(f"{source_id}: server keeps returning an invalid body for {src.url}")
        time.sleep(3 * tries)
        r = fetch(src.url, refresh=True)
    if register:
        register_source(LANE, source_id, url=src.url, dataset=src.dataset, publisher=src.publisher,
                        vintage=src.vintage, notes=src.notes, cached=r)
    return r.path
