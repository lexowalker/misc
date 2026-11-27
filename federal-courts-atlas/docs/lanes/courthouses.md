# Lane report: courthouses (places of holding court, courthouses, search index)

This lane puts every place of holding court named in the statute on the map, adds the federal courthouse
buildings that the district courts use today, and builds the "find your federal court" search index (city,
county, ZIP code, courthouse).

- Rebuild: `PYTHONPATH=. .venv/bin/python -m pipeline.courthouses.build`. It takes about 40 seconds from the
  download cache, makes no network requests once cached, and rewrites every output. The lane's source and gap
  fragments are rebuilt from scratch on each run.
- Tests: `PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_courthouses*.py` (23 tests, all
  passing).

**The short version**

- All 456 named places of holding court have a Census point inside their own district. The 457th statute row
  (D. Md., Southern Division) names no city, so it gets no point.
- The uscourts.gov court finder's address pages are blocked to this pipeline (HTTP 403 from Akamai). So there are
  **no street addresses and no divisional-office records**.
- In their place the lane uses the Federal Judicial Center's list of federal courthouse buildings, which is on an
  allowed host. That list gives 331 buildings in current district-court use. Each sits on its city's Census
  point, not on the building itself.

## Outputs

| File | What it holds |
|---|---|
| `public/data/geo/courthouses.json` | 786 points: 455 `place_of_holding_court` (from 456 statute rows; Salt Lake City is named for two Utah divisions and is merged into one point) and 331 `courthouse` (FJC buildings). Contract fields plus extras (listed below). |
| `public/data/search/index.json` | A manifest of the search files: their byte sizes and format notes. |
| `public/data/search/places.json` | 38,204 rows: `[name, state, lat, lon, district_id, other_district_ids, type]`. |
| `public/data/search/counties.json` | 3,230 rows: `[geoid, name, state, district_id, split_districts]`. |
| `public/data/search/zcta.json` | 33,790 ZCTAs. Each maps to `"district_id"`, or to `[[district_id, land_share], …]` when it spans districts. |
| `public/data/search/courthouses.json` | 786 rows: `[name, city, state, district_id, kind, id]`. `kind` is `p` (statute place) or `c` (FJC building); `id` keys into `geo/courthouses.json`. |
| `data/processed/courthouses/statute_places_geocoded.csv` | All 457 statute rows, with the Census match (layer, GEOID, name, method), the point, the district and county found by point-in-polygon, `in_district`, `in_division`, and notes. |
| `data/processed/courthouses/fjc_courthouses_all.csv` | All 754 FJC "Historic Federal Courthouses" entries, parsed: city, state, year, building name, every court that used the building with its years, and the current district ids. |
| `data/processed/courthouses/fjc_current_district_courthouses.csv` | The 331 buildings in current use by a district court, located and checked. |
| `data/processed/courthouses/court_finder_autocomplete.csv` | The 970 suggestions in the uscourts.gov court-finder search box, with their groups. Names only. |
| `data/processed/courthouses/courthouses.csv` | A flat copy of `courthouses.json`. |
| `data/processed/courthouses/search_places.csv`, `zcta_district.csv` | The search tables at full precision, with method columns. |
| `data/processed/courthouses/variables.json` | `[]`. This lane produces locations and lookups, not district statistics. |
| `data/processed/courthouses/build_summary.json` | Counts and checks. |

The search files total 2.54 MB, under the 6 MB budget, so no per-state split is needed.

**Format of `courthouses.json`.** Each record has the contract fields `id, district_id, city, state, name,
address, lat, lon, kind, statute_section, source_id, geocoder, geocode_match`, plus these extras:

- `census_geoid`, `census_name`: the Census entity whose point is used.
- `precision`.
- `note`: why an override was made; the land-point note.
- For places of holding court: `division`, `statute_place_kind` (`city` / `described_site` / `discretionary`),
  `statute_source_id` (`boundaries:olrc_usc28_xml` or `boundaries:olrc_usc48_xml`, keys in the boundaries
  lane's manifest), and `statute_note` (the boundaries lane's note, e.g. the Texarkana courthouse astride the
  state line).
- For courthouses: `fjc_url`, `fjc_heading`, `building_year` (FJC's year in the heading), `district_court_since`
  (start of the current period of district-court use), and `in_court_finder` (whether the building name also
  appears in the uscourts.gov court-finder list).

Other field rules:
- `name` for an FJC building with no recorded name is FJC's own heading, e.g. `"Greenbelt, Maryland (1994)"`.
- `address` is always `null` (see gaps).
- `lat`/`lon` are rounded to 3 decimals (about 100 m).

## Sources

All sources are fetched through `pipeline.common.http.fetch` and registered in `data/sources/courthouses.json`
(34 entries).

| source_id | URL | Used for |
|---|---|---|
| `census_gaz2026_place` | https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_place_national.zip | Internal points (INTPTLAT/INTPTLONG) of 32,363 places: 50 states, DC and PR. Locates statute places and courthouse cities; used for the place search. |
| `census_gaz2026_cousub` | …/2026_Gazetteer/2026_Gaz_cousubs_national.zip | County subdivisions: NYC boroughs (statute: Brooklyn; S.D.N.Y.: Manhattan) and towns/townships for the search. |
| `census_tl2025_place_{66,69,78}`, `census_tl2025_cousub_{66,69,78}` | https://www2.census.gov/geo/tiger/TIGER2025/PLACE/tl_2025_66_place.zip (etc.) | Guam, N. Mariana Is. and U.S. Virgin Islands places and subdivisions (the Gazetteer has no island areas). Used for the search. |
| `census_tl2025_county` | https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip | Internal point of Saipan Municipality (69110), the place named in 48 U.S.C. § 1821. |
| `census_cb2025_county_500k` | https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_county_500k.zip | County polygons, to check each statute place against its statutory division's counties. |
| `census_cb2025_place_500k_{06,23,25}` | https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_06_place_500k.zip (etc.) | Land points for San Francisco, Portland ME and Boston, whose Gazetteer points lie in water (see Method). |
| `census_place_by_county2020` | https://www2.census.gov/geo/docs/reference/codes2020/national_place_by_county2020.txt | Counties each place lies in. Gives the "also reaches into" districts in the search. |
| `census_rel2020_zcta_county` | https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt | ZCTA-to-county parts with land area (`AREALAND_PART`), for ZCTA → district shares. |
| `census_cb2020_zcta520_500k` | https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip | Only for the ZCTA parts inside the 8 counties that the statute splits between two districts. |
| `fjc_courthouses_p00` … `p16` | https://www.fjc.gov/history/courthouses/descriptions (`?page=1` … `?page=16`) | FJC History Office, "Historic Federal Courthouses", detailed list. 806 table rows, which are 754 buildings once duplicate photo rows are removed. |
| `uscourts_court_finder_autocomplete` | https://www.uscourts.gov/court-finder-autocomplete?q=Alexandria | The JSON behind the court finder's search box. It returns all 970 suggestions whatever the query: 380 courthouse building names, 94 district courts, and so on. Names only. |

Inputs from the boundaries lane (read only):
- `data/processed/boundaries/statute_places.csv` (457 rows), `county_district.csv`, `legacy_geoids.csv` and
  `districts.parquet` (district polygons with the Yellowstone, Fort Bragg / Camp MacKall and Butner carve-outs).
- `public/data/geo/divisions.json`.

**Probed and not usable**
- `https://www.uscourts.gov/federal-court-finder/find` (and `/federal-court-finder/search`) answer
  **HTTP 403 "Access Denied" (Akamai)** to this pipeline's client. These are the pages that hold court
  addresses. The pipeline tried once with its normal User-Agent and an `Accept: text/html` header, then stopped.
  It did not spoof a browser or look for other routes in.
- The FJC courthouse detail pages (e.g. `/history/courthouse/birmingham-alabama-1987`) carry no street address,
  so no address could be taken from FJC either.

## Method

### 1. Places of holding court → points (`locate.py`, `courthouses.py`)

1. **Exact name.** A statute place matches a Census place in the same state when the names agree after two
   steps:
   - strip the Census legal description: `city`, `town`, `village`, `borough`, `CDP`, `municipality`,
     `city and borough`, `zona urbana`, `… (balance)`, and so on;
   - normalise with `gazetteer.norm`, which ignores accents, case, punctuation and hyphens, and treats
     Saint/St., Sainte/Ste., Fort/Ft. and Mount/Mt. as the same.

   438 of 457 rows match one place exactly. The remaining matching steps were not needed for any statute place.
2. **More than one match.** The build keeps candidates in this order until one is left:
   - those whose point lies in the district (point-in-polygon);
   - then those in the statutory division's counties;
   - then incorporated places over CDPs.

   If more than one candidate is still left, the build fails.
3. **No place.** County subdivisions of the same state, under the same rules.
4. **Overrides.** Every other match is an explicit entry in `locate.OVERRIDES`, with a reason. Nothing is
   fuzzy-matched at run time. The 18 statute overrides are:

| District | Statute name | Census entity used | Kind |
|---|---|---|---|
| ared | Helena | Helena-West Helena city (0531190) | consolidated |
| flmd | Fernandina | Fernandina Beach city (1222175) | renamed |
| gamd | Athens | Athens-Clarke County unified government (balance) | consolidated |
| gamd | Macon | Macon-Bibb County | consolidated |
| gasd | Augusta | Augusta-Richmond County consolidated government (balance) | consolidated |
| hid | Honolulu | Urban Honolulu CDP | Census name |
| idd | Boise | Boise City city | Census name |
| kyed | Lexington | Lexington-Fayette urban county | consolidated |
| mtd | Butte | Butte-Silver Bow (balance) | consolidated |
| tnmd | Nashville | Nashville-Davidson metropolitan government (balance) | consolidated |
| txwd | Pecos | Town of Pecos city | Census name |
| tned | Greenville | **Greeneville town** (Greene County) | spelling variant: the statute (OLRC and LII) spells it "Greenville"; Tennessee has no Census place of that name |
| oked | S. McAlester | McAlester city | **interpretation**, not verified against an allowed source |
| wiwd | Superior | Superior city (not Superior village; both are in Douglas County) | ambiguous |
| nyed | Brooklyn | Brooklyn borough (county subdivision, Kings County) | borough |
| nysd | New York | **Manhattan borough** (county subdivision, New York County) | **interpretation**: the Census point of "New York city" lies in E.D.N.Y. |
| nysd | Middletown-Wallkill area of Orange County | Middletown city | described site: the point marks the area the statute names, not a site |
| nmid | Saipan | Saipan Municipality (TIGER county 69110) | island municipality |
| mdd | "a suitable site in Montgomery or Prince George's County …" | **none** | described site: no city named, so no point |

5. **Checks.**
   - Every located point must fall **inside** its own district's polygon. A point that is only near the polygon
     does not count. The build stops otherwise.
   - Every point in a district with statutory divisions must fall in one of its division's counties, or be an
     explicit exception.
   - Result: **456 of 456 located points are inside their district.** One point is outside its division's
     counties, by statute: Salt Lake City is named for both the Northern and the Central Division of D. Utah, and
     Salt Lake County is in the Central Division.
   - The tests redo the point-in-polygon check directly with shapely on `districts.parquet`.
6. **Points in water.** For three cities the Census internal point lies in water outside the 1:500k land
   polygons, so the build uses a point inside the place's largest land polygon instead. This is the polygon's
   centroid, or shapely's `point_on_surface` if the centroid falls outside. The polygon comes from the Census
   1:500k cartographic place file. The original internal point is kept in the CSV
   (`intpt_lat`/`intpt_lon`), and the method is tagged `+land_point`.

   | City | Gazetteer point | Distance from land polygon | Point used |
   |---|---|---|---|
   | San Francisco | 37.727, −123.032 | 3.4 km | 37.754, −122.443 |
   | Portland ME | 43.633, −70.185 | 1.2 km | 43.678, −70.291 |
   | Boston | 42.333, −71.014 | 0.03 km | 42.317, −71.092 |

7. **Texarkana.** The statute lets court be held anywhere in the federal courthouse that sits astride the
   Arkansas–Texas line. W.D. Ark.'s place is Texarkana city AR and E.D. Tex.'s is Texarkana city TX; each lies in
   its own district.

### 2. Courthouse buildings (FJC list) (`fjc.py`)

- Each table row of the FJC list gives:
  - a heading, "City, State (Year)";
  - optionally a building name ("Hugo L. Black United States Courthouse", or "Named the … in 1995");
  - the courts that used the building, with years, e.g. "U.S. District Court for the Eastern District of
    Virginia (1858-1864, 1871-present)";
  - notes.
- A building counts as **in current district-court use** when a district-court line ends in `-present`. That
  gives 331 buildings (district, building) across **91 districts**.
- `district_court_since` is the year before `-present`, so 1871 in the example above. "unknown-present" gives
  `null` (14 buildings).
- 107 buildings have no recorded name.
- District names are mapped with the registry. Historical districts (e.g. "District of Indiana") map to
  `UNKNOWN` and are never "present".
- The Texarkana building is filed twice, once under Arkansas and once under Texas, each entry listing both courts.
  Each district keeps the entry filed under its own state.
- Cities are located with the same rules as statute places. Three FJC-only overrides:
  - "Corpus Christie" (sic) → Corpus Christi city;
  - "Yosemite" → Yosemite Valley CDP (an interpretation);
  - the FJC "New York" buildings → Manhattan borough.
- All 331 points lie inside their district.
- `in_court_finder`: 112 of the 224 named buildings have names that also appear in the uscourts.gov
  court-finder list, after normalising case, punctuation and "United States". Names that differ in form are not
  counted. This field corroborates a building; it does not locate it.

### 3. Search index (`search.py`)

- **Places.**
  - Coverage:
    - every Gazetteer 2026 place;
    - active minor civil divisions (FUNCSTAT `A`) in the 12 strong-MCD states (CT, ME, MA, MI, MN, NH, NJ, NY,
      PA, RI, VT, WI), skipping any whose name is already a place in the same state and district;
    - the 5 NYC boroughs;
    - the island-area places and subdivisions (TIGER 2025).
  - `district_id` is the district containing the Census internal point. 21 coastal places whose point lies just
    offshore (≤ 5 km) take the nearest district. 77 county subdivisions with no land within 5 km (e.g. Great Lakes
    water parts) are dropped.
  - `other_district_ids` lists the further districts whose counties the place reaches into. It comes from the
    2020 place-by-county file, leaving out the 8 statute-split counties. Example: **Dallas → txnd, also txed**
    (its Collin and Denton county parts). 108 places carry such a list.
  - `type` is `c` incorporated, `p` CDP, `m` town/township/borough, or `i` island area.
- **Counties.** Every row of `county_district.csv` with a district: 3,230 rows. American Samoa's 5 rows are
  omitted because it has no district. `split_districts` is set for the 8 split counties, e.g. Hoke NC
  `ncmd;nced`, Park MT `mtd;wyd`.
- **ZCTAs.**
  - Each ZCTA–county part's `AREALAND_PART` goes to that county's district. 2020 county GEOIDs are mapped
    through `county_district.csv` and `legacy_geoids.csv`, which covers Connecticut's 8 former counties. A
    ZCTA's share for a district is its land area there divided by the ZCTA's total land area.
  - Parts inside a **split county** (100 ZCTA–district rows) are divided between the two districts by the area
    of the 1:500k ZCTA polygon ∩ county ∩ district (EPSG:5070). This is an area apportionment, labelled in
    `zcta_district.csv` `method`. Examples:
    - 59030 Gardiner MT: mtd 0.749, wyd 0.251;
    - 27503 (Durham County, Butner): ncmd 0.979, nced 0.021;
    - 28376 Raeford: ncmd 0.516, nced 0.484.
  - 1,006 ZCTAs span more than one district.
  - ZCTA 96799 (American Samoa) is dropped.
  - Guam (7), N. Mariana Is. (3) and USVI (6) ZCTAs exist in the 2020 file and are included.

**Example lookups, verified in the tests against the raw relationship file**

| ZCTA | Area | County | District |
|---|---|---|---|
| 22314 | Alexandria VA | Alexandria city 51510 | vaed |
| 10007 | Manhattan | New York County 36061 | nysd |
| 11201 | Brooklyn | Kings County 36047 | nyed |
| 75670 | Marshall TX | Harrison County 48203 | txed |

## Variable definitions

This lane emits no district statistics (`variables.json` is `[]`). Field definitions:

| Field | Definition |
|---|---|
| `kind = place_of_holding_court` | A place where 28 U.S.C. §§ 81–131 (or 48 U.S.C. § 1821) says court shall (Odessa: may) be held, as parsed by the boundaries lane (statute current through Pub. L. 119-142). |
| `kind = courthouse` | A building that the FJC list shows in use by a U.S. District Court with the period ending "present". |
| `lat`, `lon` | The Census internal point of the matched place, county subdivision or county (WGS84, NAD83 values carried over), or for 3 cities a point inside the largest land polygon; rounded to 3 decimals. **City-level, not building-level.** |
| `geocode_match` | `exact_name`, `exact_name+land_point`, or `override:<kind>` (table above). |
| `district_id` (search places) | The district whose polygon contains the internal point (`nearest` within 5 km for 21 offshore points). |
| ZCTA share | (land area of the ZCTA in the district) / (land area of the ZCTA), from Census 2020 `AREALAND_PART`; split-county parts apportioned by 1:500k polygon area. |

## Coverage

| Output | Vintage | Districts | Rows |
|---|---|---|---|
| Places of holding court (points) | statute through Pub. L. 119-142 (Nov. 10, 2026); Gazetteer 2026 | 92 (no gud, vid) | 456 located of 457; 455 points |
| FJC courthouse buildings in current use | FJC list retrieved 2026-11-27 | 91 (no gud, vid, nmid) | 331 |
| Any point | | 92 (no gud, vid) | 786 |
| Search: places | Gazetteer 2026, TIGER 2025 | 94 | 38,204 |
| Search: counties | Census 2025 (boundaries lane) | 94 | 3,230 |
| Search: ZCTAs | Census 2020 ZCTAs | 94 | 33,790 |
| Search: courthouses | as above | 92 | 786 |

There is no time dimension. These outputs describe current law, current buildings and current Census
geography.

## Definitional breaks and caveats

- **Points are city-level.** A dot marks the Census internal point of the place where court is held. It is not
  the courthouse. Several buildings in one city share one point. New England statute towns (e.g. Brattleboro,
  St. Johnsbury, Littleton) are placed at their CDP, i.e. the village centre.
- **The FJC list is not a complete inventory.** It covers federal court buildings, mostly federally owned. Leased
  space, temporary quarters and recent moves may be missing, and it has no entries at all for Guam, the Virgin
  Islands or the N. Mariana Islands. "-present" reflects FJC's last update, which this lane cannot date.
- **Interpretations** (flagged `override:interpretation` and listed above):
  - S. McAlester → McAlester;
  - New York (S.D.N.Y.) → Manhattan;
  - Yosemite → Yosemite Valley CDP.

  **Approximation:** the Middletown-Wallkill "area" is marked at Middletown city.
- **Statute spelling.** "Greenville" (E.D. Tenn.) is kept as written in `city`; its point is Greeneville.
- **Search places use one point per place.** A place that spans districts is listed under the district holding
  its internal point. The other districts appear only in `other_district_ids`, and that list comes from 2020
  county membership: places created or annexed since 2020 may lack it. For places in a split county, the
  point-in-polygon district already follows the carve-out.
- **ZCTAs approximate ZIP codes.** They are Census 2020 tabulation areas built from blocks. PO-box-only and
  single-building ZIP codes have no ZCTA. ZIP routes change; ZCTAs do not.
- **Split-county ZCTA shares** are polygon-area apportionments at 1:500k, not Census land-area figures.
- Island-area and Gazetteer points come from two Census vintages (TIGER 2025, Gazetteer 2026). Both postdate
  the boundaries lane's 2025 county file, and the boundaries lane found the 2026 county GEOIDs and names
  identical to it.

## Gaps (`data/gaps/courthouses.json`)

- `court_finder_addresses_unavailable`:
  - no street addresses and no divisional-office records, because the court finder's result pages are blocked
    (HTTP 403, Akamai);
  - `address` is `null` throughout and `kind = divisional_office` never occurs;
  - the court finder's 380 building names are kept (`court_finder_autocomplete.csv`) but carry no city or
    district.
- `no_place_named_gud_vid`: D. Guam and D.V.I. have no point. Title 48 names no place of holding court for either,
  and FJC lists no building there.
- `mdd_southern_division_described_site`: D. Md.'s Southern Division place is a described site with no point.
  The FJC Greenbelt, MD building is mapped as a courthouse.
- `fjc_courthouse_list_coverage`: gud, nmid and vid have no FJC building. D.N. Mar. I. still has its statutory
  point at Saipan.
- `american_samoa_search`: American Samoa is not searchable; it has no district.
- `zip_codes_not_zctas`: the ZIP search covers ZCTAs only.

## What was checked by eye

- **Gazetteer rows against `courthouses.json`:** Florence AL (34.82981, −87.662202 → 34.830, −87.662), Alexandria
  VA, Greeneville TN, Middletown NY, Superior WI. Raw lines printed from the zip and compared.
- **FJC entries against the raw page text:** Central Islip 2000 (name from "Named the Alfonse M. D'Amato United
  States Courthouse in 2003"; E.D.N.Y. 2000-present), Corpus Christie 2001, Greenbelt 1994, Richmond 1858
  (district court "1858-1864, 1871-present" → `district_court_since` 1871).
- **ZCTA examples** against the raw relationship-file rows and `county_district.csv` (table above), and Gardiner
  (59030: one county part, Park MT, 1,241,433,989 m² of land, apportioned mtd/wyd).
- **A random sample of 25 statute matches**, and all 16 rows whose Census name differs from the statute name.

**Not checked:** whether each FJC "-present" building is still in use today, and whether S. McAlester means
McAlester.
