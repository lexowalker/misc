"""Every file the courthouses lane downloads, fetched through ``pipeline.common.http.fetch`` and registered.

``get(source_id)`` returns the CachedResponse (downloading on first use) and records the source in
``data/sources/courthouses.json`` (URL, dataset, publisher, vintage, retrieval date, sha256).

A response that should be a zip / JSON / delimited text but is an HTML page (the Census WAF and Akamai
answer some requests with an error page sent as HTTP 200) is rejected, removed from the cache, and refetched
once; if it is still wrong the build stops.
"""
from __future__ import annotations

from dataclasses import dataclass

from pipeline.common.districts import STATES
from pipeline.common.http import FetchError, fetch
from pipeline.common.manifest import register_source

from . import LANE

_GAZ = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer"
_REL = "https://www2.census.gov/geo/docs/maps-data/data/rel2020"
_TIGER = "https://www2.census.gov/geo/tiger"
CENSUS = "U.S. Census Bureau"
FJC_PUBLISHER = "Federal Judicial Center, History Office (fjc.gov)"
FJC_DESC = "https://www.fjc.gov/history/courthouses/descriptions"
FJC_PAGES = 17  # "Displaying 1 - 50 of 806": pages 0..16 (checked at build time)


@dataclass(frozen=True)
class Source:
    url: str
    dataset: str
    publisher: str
    vintage: str
    kind: str          # zip | text | json | html
    notes: str = ""
    params: tuple = ()


SOURCES: dict[str, Source] = {
    "census_gaz2026_place": Source(
        f"{_GAZ}/2026_Gaz_place_national.zip", "Census Gazetteer Files: Places (national)", CENSUS, "2026",
        "zip", "INTPTLAT/INTPTLONG internal points of every incorporated place and CDP in the 50 states, DC and "
               "PR. Used to locate places of holding court and courthouse cities, and for the place search index."),
    "census_gaz2026_cousub": Source(
        f"{_GAZ}/2026_Gaz_cousubs_national.zip", "Census Gazetteer Files: County Subdivisions (national)",
        CENSUS, "2026", "zip",
        "Internal points of county subdivisions. Used for New York City boroughs (statute: Brooklyn) and for "
        "active minor civil divisions (towns, townships) in the 12 strong-MCD states in the search index."),
    "census_tl2025_county": Source(
        f"{_TIGER}/TIGER2025/COUNTY/tl_2025_us_county.zip", "TIGER/Line Shapefile, Counties (tl_2025_us_county)",
        CENSUS, "2025", "zip",
        "INTPTLAT/INTPTLON of Saipan Municipality (69110), the place of holding court named in 48 U.S.C. § 1821; "
        "the Gazetteer has no island-area records."),
    "census_cb2025_county_500k": Source(
        f"{_TIGER}/GENZ2025/shp/cb_2025_us_county_500k.zip",
        "Cartographic Boundary File, Counties, 1:500,000 (cb_2025_us_county_500k)", CENSUS, "2025", "zip",
        "County polygons: which county a geocoded point falls in (checks a place of holding court against the "
        "counties of its statutory division)."),
    "census_place_by_county2020": Source(
        "https://www2.census.gov/geo/docs/reference/codes2020/national_place_by_county2020.txt",
        "2020 Census place-by-county reference file (national_place_by_county2020)", CENSUS, "2020", "text",
        "Counties each place lies in; lists the other districts a place reaches into (search index `o` field)."),
    "census_rel2020_zcta_county": Source(
        f"{_REL}/zcta520/tab20_zcta520_county20_natl.txt",
        "2020 ZIP Code Tabulation Area (ZCTA5) to County Relationship File", CENSUS, "2020", "text",
        "Land area of each ZCTA-county part (AREALAND_PART); ZCTA -> district land-area shares."),
    "census_cb2020_zcta520_500k": Source(
        f"{_TIGER}/GENZ2020/shp/cb_2020_us_zcta520_500k.zip",
        "Cartographic Boundary File, ZCTA5, 1:500,000 (cb_2020_us_zcta520_500k)", CENSUS, "2020", "zip",
        "Only for ZCTAs with land in one of the 8 counties split between two districts by statute (Fort Bragg / "
        "Camp MacKall, FCI Butner, Yellowstone): splits that ZCTA-county part between the two districts by "
        "polygon area."),
    **{f"census_tl2025_place_{fp}": Source(
        f"{_TIGER}/TIGER2025/PLACE/tl_2025_{fp}_place.zip", f"TIGER/Line Shapefile, Places, {nm} (tl_2025_{fp}_place)",
        CENSUS, "2025", "zip",
        f"Internal points of {nm} places (the Gazetteer covers no island areas): courthouse towns and search index.")
        for fp, nm in [("66", "Guam"), ("69", "Northern Mariana Islands"), ("78", "U.S. Virgin Islands")]},
    **{f"census_tl2025_cousub_{fp}": Source(
        f"{_TIGER}/TIGER2025/COUSUB/tl_2025_{fp}_cousub.zip",
        f"TIGER/Line Shapefile, County Subdivisions, {nm} (tl_2025_{fp}_cousub)", CENSUS, "2025", "zip",
        f"Internal points of {nm} county subdivisions (villages, districts, subdistricts) for the search index.")
        for fp, nm in [("66", "Guam"), ("69", "Northern Mariana Islands"), ("78", "U.S. Virgin Islands")]},
    **{f"census_cb2025_place_500k_{fips}": Source(
        f"{_TIGER}/GENZ2025/shp/cb_2025_{fips}_place_500k.zip",
        f"Cartographic Boundary File, Places, {nm}, 1:500,000 (cb_2025_{fips}_place_500k)", CENSUS, "2025", "zip",
        "Fetched only for a state where a located place's Gazetteer internal point falls outside the district's "
        "land polygon (in water): a point inside the place's largest land polygon is used instead.")
        for nm, fips in STATES.values() if fips not in ("66", "69", "78")},
    "uscourts_court_finder_autocomplete": Source(
        "https://www.uscourts.gov/court-finder-autocomplete", "Federal Court Finder: search autocomplete list",
        "Administrative Office of the U.S. Courts (uscourts.gov)", "retrieved 2026-11", "json",
        "The JSON list behind the court finder's search box (970 suggestions in 7 groups, including 380 "
        "courthouse building names). Names only: no addresses, cities or districts. The finder's result pages "
        "(/federal-court-finder/find), which hold the addresses, answer HTTP 403 (Akamai 'Access Denied') to "
        "this pipeline, so no addresses could be taken from it.",
        params=(("q", "Alexandria"),)),
    **{f"fjc_courthouses_p{p:02d}": Source(
        FJC_DESC, f"Historic Federal Courthouses: detailed list, page {p + 1} of {FJC_PAGES}", FJC_PUBLISHER,
        "retrieved 2026-11", "html",
        "Each entry: city, state, year, building name, and the federal courts that used the building with years "
        "of use ('-present' = current use).",
        params=(("page", str(p)),) if p else ())
        for p in range(FJC_PAGES)},
}


def _looks_ok(path, kind: str) -> bool:
    with open(path, "rb") as f:
        head = f.read(512).lstrip()
    if kind == "zip":
        return head[:2] == b"PK"
    if kind == "json":
        return head[:1] in (b"[", b"{")
    if kind == "text":
        return not head.lower().startswith((b"<!doctype", b"<html"))
    return True


def get(source_id: str):
    s = SOURCES[source_id]
    params = dict(s.params) or None
    r = fetch(s.url, params)
    if not _looks_ok(r.path, s.kind):
        r.path.unlink(missing_ok=True)
        r = fetch(s.url, params, refresh=True)
        if not _looks_ok(r.path, s.kind):
            raise FetchError(f"{source_id}: {r.meta['url']} did not return a {s.kind} file")
    register_source(LANE, source_id, url=r.meta["url"], dataset=s.dataset, publisher=s.publisher,
                    vintage=s.vintage, notes=s.notes, cached=r)
    return r
