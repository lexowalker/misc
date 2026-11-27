# Lane report: boundaries

Builds the 94 federal judicial districts from the statute (28 U.S.C. §§ 81–131 and the territorial-court sections
of title 48) and Census county geometry. Rebuild with
`PYTHONPATH=. .venv/bin/python -m pipeline.boundaries.build` (about one minute from the download cache; it needs
Node/npx for `npx -y mapshaper@0.6`). Tests: `PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/test_boundaries*.py`
(106 tests, all passing at the time of writing).

## Outputs

| File | What it holds |
|---|---|
| `data/processed/boundaries/county_district.csv` | All 3,235 Census 2025 county-equivalents → exactly one `district_id` (American Samoa: `""`, with the reason). |
| `data/processed/boundaries/legacy_geoids.csv` | 20 retired county GEOIDs from the 1990/2000/2010/2020 Census files → `district_id`, for older Census tables. |
| `data/processed/boundaries/statute_parsed.json` | The statute, parsed: per district → statutory division → listed names (with GEOID and match method) and places of holding court. It keeps the raw sentences, OLRC footnotes, every OLRC amendment note, the special clauses and how each is handled, and the list of inter-district changes since 1980. |
| `data/processed/boundaries/statute_places.csv` | 457 places of holding court: `district_id, division, place, state, statute_section, sentence, place_kind, statute_text, note`. |
| `data/processed/boundaries/name_matches.csv` | All 2,452 names listed in the statute → GEOID, with `method` and `reason`. |
| `data/processed/boundaries/va_city_rule.csv` | The § 127(c) check for each of Virginia's 38 independent cities: neighbouring counties and their districts. |
| `data/processed/boundaries/split_counties.csv` | The 8 counties cut by a statutory carve-out, with areas. |
| `data/processed/boundaries/statute_crosscheck.csv` | 432 statute sentences compared with Cornell LII: all identical. |
| `data/processed/boundaries/state_outline_check.csv` | Dissolved counties compared with the Census state outlines: 0 km² difference for all 55. |
| `data/processed/boundaries/districts.parquet` | GeoParquet (EPSG:4326) of the 94 district polygons at 1:500k, carve-outs applied. Columns: `district_id, name, short, state, circuit, article, area_km2`. |
| `data/processed/boundaries/observations.{parquet,csv}`, `variables.json` | 3 small statute and geography variables (below). |
| `data/processed/boundaries/preview.png` | Verification render: national map, insets, and zooms on the carve-outs, New York City and Hampton Roads. |
| `public/data/geo/districts-lo.topo.json` | 350 KB. Objects `districts` (94) and `states` (55). |
| `public/data/geo/districts-hi.topo.json` | 2.8 MB. Objects `districts`, `states` and `counties` (3,230; American Samoa is not drawn). |
| `public/data/geo/divisions.json` | Per district: statutory divisions with member counties (GEOID and name) and places, all member counties, partial counties included, and notes. |

**TopoJSON format.** Coordinates are unprojected lon/lat. Census NAD83 coordinates are carried over unchanged and
labelled WGS84 (the two datums differ by less than 2 m in the US). The arcs are shared across all objects.

Properties of each object:
- `districts`: `id` = district_id; `name`, `short`, `state`, `circuit`.
- `states`: `id` = postal code; `name`, `fips`. The 55 states are the 50 states, DC, PR, GU, VI and MP.
- `counties` (hi file only): `id` = GEOID; `name`, `district_id`, `state`. A split county carries the
  `district_id` of its row in `county_district.csv`, and also **`split_districts`** (only on the 8 split counties),
  in the same format as the CSV column: the county row's district first, then the carved-to district, e.g.
  `"ncmd;nced"` for Hoke or `"mtd;wyd"` for Park MT. The feature is drawn whole, so a point inside the carved part
  (Fort Bragg, Camp MacKall, FCI Butner, the Yellowstone parts of MT and ID) must be resolved against the
  `districts` object, never against the county's `district_id`. **Contract addition** (audit fix): the data
  contract lists only `name, district_id` for counties; `state` and the optional `split_districts` are additions.
  Nothing existing is renamed or removed.

## Sources

Every file is fetched through `pipeline.common.http.fetch` and registered in `data/sources/boundaries.json`
(188 entries).

| source_id | URL | Used for |
|---|---|---|
| `olrc_usc28_xml` | https://uscode.house.gov/download/releasepoints/us/pl/119/142/xml_usc28@119-142.zip | **Primary statute text.** Title 28 (USLM XML), current through Pub. L. 119-142 (Nov. 10, 2026). The old `download/download.shtml` page now returns 404; the site's `download.html` links this release point. |
| `olrc_usc48_xml` | https://uscode.house.gov/download/releasepoints/us/pl/119/142/xml_usc48@119-142.zip | 48 U.S.C. § 1424 (Guam), §§ 1611 and 1615 (Virgin Islands and its two divisions), § 1821 (N. Mariana Is.). |
| `lii_28usc81` … `lii_28usc131`, `lii_28usc81A`, `lii_48usc1424`, `lii_48usc1615`, `lii_48usc1821` | https://www.law.cornell.edu/uscode/text/28/81 (etc.) | Sentence-by-sentence cross-check only. |
| `census_cb2025_county_500k` | https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_county_500k.zip | County list and all geometry. It includes PR, AS, GU, MP and VI (3,235 rows). GENZ2025 is the latest cartographic vintage; there is no GENZ2026 yet. |
| `census_cb2025_county_5m`, `census_tl2025_county`, `census_tl2026_county` | …/GENZ2025/shp/cb_2025_us_county_5m.zip, …/TIGER2025/COUNTY/tl_2025_us_county.zip, …/TIGER2026/COUNTY/tl_2026_us_county.zip | Cross-check: the same 3,235 GEOIDs, and the same names in 2026. |
| `census_cb2025_county_20m` | …/GENZ2025/shp/cb_2025_us_county_20m.zip | Checked, not used: it lacks AS, GU, MP and VI. |
| `census_cb2025_state_500k` | …/GENZ2025/shp/cb_2025_us_state_500k.zip | State-outline check. |
| `census_tl2025_arealm_{16,30,56}` | …/TIGER2025/AREALM/tl_2025_{16,30,56}_arealm.zip | "Yellowstone Natl Pk" (MTFCC K2181, AREAID 1102215199136): the ID, MT and WY parts. |
| `census_tl2025_mil` | …/TIGER2025/MIL/tl_2025_us_mil.zip | "Fort Bragg" and "Camp MacKall" (MTFCC G6500). |
| `census_tl2025_arealm_37` | …/TIGER2025/AREALM/tl_2025_37_arealm.zip | "Butner Federal Correctional Complx" (MTFCC K1237, 2 polygons). |
| `census_pop_counties_1790_1990` | https://www2.census.gov/library/publications/decennial/1990/population-of-states-and-counties-us-1790-1990/population-of-states-and-counties-of-the-united-states-1790-1990.pdf | Part III, "Virginia Notes", notes C1–C42 (printed pp. 174–175): the county each Virginia independent city was formed from, and what became of the former counties. |
| `census_co90_XX`, `census_co00_XX` (56 + 55 per-state files) | https://www2.census.gov/geo/tiger/PREVGENZ/co/co90shp/coXX_d90_shp.zip, …/co00shp/coXX_d00_shp.zip | Legacy county GEOIDs and polygons, 1990 and 2000. |
| `census_gz2010_county_500k`, `census_cb2020_county_500k` | …/GENZ2010/gz_2010_us_050_00_500k.zip, …/GENZ2020/shp/cb_2020_us_county_500k.zip | Legacy GEOIDs, 2010 and 2020 (including Connecticut's eight former counties). |
| `census_gcn_*` (6 files) | https://www2.census.gov/geo/docs/reference/bndrychange/national_gcn_1970_1999.txt (and 2000_2010, 2011_2013, 2014_2020, 2021, 2022) | Census geographic change notes, used as evidence for renames and retired codes. |

## Method

### 1. Parsing the statute (`pipeline/boundaries/statute.py`)

- Each `<section>` (§§ 81, **81A (Alaska)**, 82–131) is flattened into lines, one per `<p>`, `<chapeau>` or
  `<paragraph>`. OLRC footnotes ("So in original") are removed from the text and kept per unit.
- A small state machine reads the lines:
  - district headings ("Northern District");
  - "(a) The X District comprises …";
  - "(n) The Y Division comprises …";
  - "Court for … shall/will/is to be held at …".
- Each district (or statutory division) becomes a *unit* holding the raw county sentence, the court sentence, the
  listed names and the places of holding court.
- The parser checks the stated number of districts and divisions against what it finds. The one mismatch it
  meets is allowed only because it is listed explicitly (E.D. Tex., under caveats). The parse fails on any
  unrecognised sentence, list token or place phrase.
- List splitting handles both "A, B, and C" and "A and B", and keeps "King and Queen" whole.
- Clause handling:
  - Partial-county clauses ("those portions of Hoke, Moore, Scotland, and Richmond counties encompassing …",
    "that portion of Durham County encompassing …") are parsed as partial items.
  - M.D.N.C.'s "(excluding that portion …)" parentheticals become `excluded_portions`.
  - "and the City of Baltimore" and "the city of Saint Louis" become independent-city items.
- Readings that are not mechanical are listed in code with reasons:
  - `TEXT_FIXES`: "Le Flore Love" (§ 116(b), a missing comma) is read as Le Flore + Love.
  - `PLACE_FIXES`:
    - Riverside / San Bernardino "suitable site" (§ 84);
    - D. Md. Southern Division "suitable site in Montgomery or Prince George's County" (`described_site`);
    - "Middletown-Wallkill area of Orange County" (`described_site`);
    - "Hempstead (including the village of Uniondale)";
    - "Columbus St. Clairsville" (OLRC footnote: probably needs a comma);
    - "Eugene or Springfield" and "Champaign/Urbana" (two places each);
    - Midland plus Odessa (`discretionary`);
    - the Texarkana courthouse astride the state line;
    - "S. McAlester", kept as written. Reading it as present-day McAlester is not verified here and is left to
      the courthouses lane.
  - "Plattsburgh" appears twice in § 112(a) (OLRC: "So in original") and is counted once.
- Title 48:
  - Guam (§ 1424) and the Northern Mariana Islands (§ 1821) are whole territories.
  - The Virgin Islands have two statutory divisions (§ 1615): Saint Croix, and Saint Thomas and Saint John.
  - Only § 1821 names a place: "Terms of court shall be held on Saipan".
- **Cross-check:** all 432 county, court and intro sentences are identical in the Cornell LII text after
  whitespace and quote normalisation (`statute_crosscheck.csv`). The parsed divisions for S.D. Ga. Augusta,
  E.D. Tex. Sherman, D.S.D. Western, D. Md. Northern, E.D. Mo. Eastern and D.V.I. St. Croix were also compared
  with the statute by eye.

### 2. Names → GEOIDs (`pipeline/boundaries/names.py`, `assign.py`)

- A listed name matches a Census county-equivalent of the same state *and type*:
  - county = LSAD 06; parish = 15; independent city = 25; Virgin Islands island = 10.
  - So in Virginia "Richmond", "Fairfax", "Roanoke", "Franklin" and "Bedford" can only match the *counties*
    (51159, 51059, 51161, 51067, 51019), never the same-named cities.
- 2,395 names match exactly. **Every other match is an explicit entry in `names.OVERRIDES` with a reason.**
  Nothing is fuzzy-matched at run time. An unknown name stops the build and prints a suggestion.
- `normalize()` is tested. It ignores accents, case, apostrophes, periods, Saint/St. and spaces or hyphens
  (De Kalb = DeKalb, La Salle = LaSalle, Doña Ana = Dona Ana). It is used only to *verify* the
  `normalized_variant` overrides.

| Kind | Count | Entries |
|---|---|---|
| normalized_variant | 35 | Saint/St. (AL, LA ×9, MI ×2, MN, MO ×5 incl. **St. Louis city 29510** and **St. Louis County 29189**, NY, WI); De Kalb/DeKalb (GA, IL, IN, MO, TN); De Soto/DeSoto (FL); Du Page, La Salle (IL); La Salle (LA); Lagrange, La Porte (IN); O’Brien (IA); Queen Anne’s, Prince George’s, St. Mary’s (MD) |
| spelling_variant | 12 | Hot Springs→Hot Spring 05059; Vermilion→Vermillion 18165; Davies→Daviess 18027; Breckenridge→Breckinridge 21027; Saint Genevieve→Ste. Genevieve 29186; Woods→Wood 39173; Edmonds→Edmunds 46045; Shackleford→Shackelford 48417; Brisco→Briscoe 48045; Cook→Cooke 48097; Zavalla→Zavala 48507; Accomac→Accomack 51001 |
| renamed | 2 | Dade→Miami-Dade 12086 (recoded 12025→12086 in 1997, per a Census change note); Shannon→Oglala Lakota 46102 (recoded 46113→46102 in 2015, per a Census change note) |
| former_county (VA) | 5 | Elizabeth City→Hampton 51650; Nansemond→Suffolk 51800; Norfolk County→Chesapeake 51550 (Norfolk city 51710 and Portsmouth 51740 were also formed from it); Princess Anne→Virginia Beach 51810; Warwick→Newport News 51700 |
| island | 3 | Saint Croix 78010, Saint Thomas 78030, Saint John 78020 |

- Each spelling variant is the only near match in its state and is otherwise unlisted in the section. With it,
  every county of the state is assigned exactly once; the build fails on any county assigned twice or not at all.
- Georgia's Dade (13083) and Missouri's Dade (29057) match exactly. They are not Miami-Dade.
- Single-district states, DC, PR, GU and MP: every county-equivalent of the jurisdiction goes to its district
  (`whole_state`, 750 rows). This covers:
  - Alaska's 30 boroughs and census areas;
  - Connecticut's 9 planning regions (09110–09190);
  - Kalawao County, HI (15005);
  - Broomfield, CO (08014);
  - Carson City, NV;
  - the 78 municipios of Puerto Rico.
- American Samoa's 5 county-equivalents have `district_id = ""`; see gaps.

### 3. Virginia independent cities (28 U.S.C. § 127(c))

- § 127(c) places each city in the district of the county "within the exterior boundaries of which" it lies or
  "out of the territory of which" it was incorporated.
- The county of origin of all 38 cities is taken from the Census 1790–1990 publication's Virginia notes
  (`names.VA_CITY_ORIGINS`, note number and page per city), read by eye against the PDF.
- The build checks that all the counties a city came from are in one district.
- It also checks geometry: every county a city touches is in that same district (`va_city_rule.csv`; all 38
  consistent, so no city is ambiguous).
- Examples:
  - Alexandria 51510: from Alexandria (now Arlington) County → vaed.
  - Roanoke city 51770: from Roanoke County → vawd.
  - Franklin city 51620: from Southampton → **vaed**, while Franklin County 51067 → vawd.
  - Fairfax city 51600 and Richmond city 51760 → vaed.
- Former cities:
  - Bedford city 51515 (Bedford County), Clifton Forge 51560 (Alleghany) and South Boston 51780 (Halifax) →
    vawd.
  - They appear only in `legacy_geoids.csv`, where the area overlay and § 127(c) agree.
- The extinct counties still named in § 127(a) are handled through their successor cities, as in the table
  above.

### 4. Special geographic clauses

| Clause | Handling |
|---|---|
| §§ 92, 106, 131: Yellowstone NP in MT and ID belongs to D. Wyo. | **Drawn.** The park polygon (union of the three state parts) is cut out of each MT/ID county it covers by ≥ 1 km² and added to wyd: Park MT 377.1 km² and Gallatin MT 261.3 km² (both otherwise mtd), Fremont ID 149.4 km² (otherwise idd). The county rows stay with the district holding the rest of the county, with `split_districts` and `split_note` set. The test points 45.01N −110.70W (MT, in park), 44.80N −111.07W (Gallatin, in park) and 44.30N −111.08W (ID, in park) all fall in wyd. Note: 44.97N −110.70W is south of 45°N, so it is in *Wyoming*; it lies in wyd for that reason and does not test the carve-out. |
| § 113(a)–(b) (2021): parts of Hoke, Moore, Scotland and Richmond counties encompassing Fort Bragg and Camp Mackall → E.D.N.C. | **Drawn** from the TIGER "Fort Bragg" and "Camp MacKall" polygons: Hoke 362.3 km², Scotland 18.3, Moore 13.5, Richmond 10.5 km². Camp MacKall is an E.D.N.C. exclave inside M.D.N.C. County rows stay ncmd and are flagged. Hoke ∩ Camp MacKall (0.02 km²) is below the 0.1 km² artefact threshold and stays ncmd. |
| § 113(a)–(b) (1980): the part of Durham County encompassing the Federal Correctional Institution, Butner → E.D.N.C. | **Drawn** using the TIGER "Butner Federal Correctional Complx" polygons (2.1 km² in Durham). This is an approximation: the landmark is the whole complex, while the statute names "the Federal Correctional Institution". |
| § 112(b)–(c): S.D.N.Y. and E.D.N.Y. share jurisdiction over certain waters | Not drawn, because the jurisdiction is shared, not exclusive. Noted in `county_district.csv` `notes` for Bronx, New York and the E.D.N.Y. counties. Kings, Queens, Richmond, Nassau and Suffolk → nyed; New York and Bronx → nysd (§ 112(b)–(c)). |
| § 123(c)(1): W.D. Tenn. includes the Tennessee River to the low-water mark on the eastern shore where it divides W.D. and M.D. | **Not drawn** (gap). The river is now impounded (Kentucky Lake), and no allowed source gives the historical low-water line. Census county lines are used as they are. |
| § 91: Hawaii includes Midway, Wake, Johnston, Sand Island, Kingman Reef, Palmyra, Baker, Howland, Jarvis, Canton and Enderbury | **Not drawn** (gap). None is a Census county-equivalent. Canton and Enderbury are no longer U.S. territory. |

**Carve-out mechanics** (`geometry.carve`):
1. The full-resolution TIGER polygon is snapped to the county boundary within 0.0005° (about 50 m).
2. Intersection parts under 0.1 km² are dropped.
3. Slivers of the remainder under 0.1 km² that touch the carved piece are given to it.
4. The two pieces always union back to the original county (tested).

### 5. Geometry and topology

- Districts and states are dissolved (shapely) from the county pieces at 1:500k. The dissolved states reproduce
  the Census 1:500k state outlines exactly: symmetric difference 0.0 km² for all 55.
- TopoJSON is built with mapshaper 0.6 in one session, so the three objects share arcs:
  1. explode multipart pieces, so that `keep-shapes` protects every island and not just one ring per feature;
  2. simplify with a variable interval: lo 1000 m (PR and HI 400 m; GU, MP and VI 150 m); hi 250 m (PR and HI
     120 m; GU, MP and VI 50 m);
  3. `-clean` the pieces;
  4. dissolve to districts, states and (hi only) counties;
  5. `-clean` those layers;
  6. quantize: lo 1e6, hi 4e6, with mapshaper's `fix-geometry` output flag (see validity below).
- Islands kept, compared with the 1,531 polygon parts at full resolution: lo 1,527, hi 1,531.
- District areas compared with full resolution: lo median 0.015% (max 0.9%, the Virgin Islands); hi median
  0.002% (max 0.12%).
- Validity after decoding: **every feature in both files is valid** (lo: 94 districts and 55 states; hi: 94, 55
  and 3,230 counties). The build records this per object in `build_summary.json`, and the tests require it.
  - Before the audit fix, one county in the hi file was invalid: Iberia Parish 22045 self-intersected at
    −91.25527, 29.97161, where the Iberia, Iberville, Assumption and St. Martin lines meet. Two arc endpoints there
    are about 16 m apart in latitude. The hi grid is about 9 m in x (4e6 steps across the 359° longitude span), so
    rounding pushed one vertex across the neighbouring edge.
  - The fix is `fix-geometry` on the `-o` command (mapshaper 0.6.121). After rounding, mapshaper finds the
    segments that now cross and puts back the unrounded position of only their vertices. It first checks that the
    unrounded data has no intersections, which the `-clean` passes ensure. It changed 5 points (8 vertex slots,
    because shared arc endpoints are duplicated), each by under 2 m, all at that corner. Area changes: lawd and
    laed about 2,100 m² each; the counties 22007, 22045, 22099 and 22101 under 4,700 m² each; no state changed.
    The lo file is byte-identical, because nothing needed fixing there.
  - Side effect: those 11 restored values are non-integer quantized deltas, while the other values in the arcs
    are integers. `topojson-client` `feature`/`mesh` and `d3-geo` decode them correctly; this was checked with the
    project's own `node_modules`. A strict validator that requires integer quantized positions would flag them.
- The Aleutian islands east of 180° keep positive longitudes, as in the Census file. A composite AlbersUSA
  projection handles them.
- **Hawaii inset framing (for the web lane).** hid includes the Northwestern Hawaiian Islands out to about
  178°W, because Census Honolulu County (15003) includes them. That is faithful to the source, so it is not
  trimmed here. An inset fitted to hid's full bounding box shrinks the main islands to specks. Frame the inset on
  the main islands instead (d3's `geoAlbersUsa` already clips its Hawaii inset that way). The § 91 outlying
  islands are not drawn (gap above).

### 6. Legacy GEOIDs (`legacy_geoids.csv`)

- These are every county GEOID present in the 1990, 2000, 2010 or 2020 Census county files and absent in 2025.
- Each polygon (from the latest vintage it appears in) is overlaid on the 2025 district polygons, carve-outs
  included.
- Columns: `legacy_geoid, state, legacy_name, census_vintages, district_id, area_share, district_shares, method,
  source_ids, change_note_evidence, statute_check`.
- Results:

| Legacy GEOIDs | District | Area share |
|---|---|---|
| CT 09001–09015 | ctd | 1.0 |
| AK 02201, 02231, 02232, 02261, 02270, 02280 | akd | ≥ 0.96 (generalization differences) |
| Dade 12025 | flsd | — |
| Shannon 46113 | sdd | — |
| Bedford city 51515, Clifton Forge 51560, South Boston 51780 | vawd | — |
| **30113 "Yellowstone National Park" (MT, 1990 file)** | **wyd** | 0.989 |

- The Census change notes are cited per row where one mentions the code.
- Codes that kept their number while their boundaries changed (e.g. Broomfield 08014 created from 4 counties in
  2001; Alaska boundary corrections) are not "legacy". Every such change happened within a single district.

## Variables (`variables.json`, `observations.*`)

| id | Definition | Unit | Period |
|---|---|---|---|
| `statutory_divisions` | Number of statutory divisions named for the district: the count of "(n) The … Division comprises" paragraphs in 28 U.S.C., or 48 U.S.C. § 1615 for the V.I. Zero means the statute names none; divisions created by local rule are not counted. | count | `CY` 2026 (statute current through Pub. L. 119-142) |
| `statutory_places_of_holding_court` | Number of distinct places where the statute says court shall (or, for Odessa, may) be held. "Champaign/Urbana" and "Eugene or Springfield" count as two places each; a described site counts as one. | count | `CY` 2026 |
| `county_equivalents` (derived: `count(county_district rows where district_id = d)`) | Number of Census 2025 county-equivalents whose row is assigned to the district. Split counties are counted once, in the district holding the rest of the county. | count | `CY` 2025 (Census vintage) |

**Coverage**

| variable | first year | last year | districts |
|---|---|---|---|
| statutory_divisions | 2026 | 2026 | 94 |
| statutory_places_of_holding_court | 2026 | 2026 | 92 (gud and vid have no statutory place; gap) |
| county_equivalents | 2025 | 2025 | 94 |

These describe current law and current geography only. The contract has no "snapshot as of a date" period type
other than `SNAPSHOT_SEP30`, so `CY` is used, with the year of the statute release point or Census vintage.

## Definitional breaks and caveats

**District composition has changed.** Counties moved between districts since 1980, according to the OLRC
amendment notes. Each quote is checked against the notes at build time and stored in
`statute_parsed.json → district_changes_since_1980`:

| Year | Law | From → to | What moved |
|---|---|---|---|
| 1980 | Pub. L. 96-462 | ncmd → nced | the FCI Butner portion of Durham County |
| 1980 | Pub. L. 96-462 | ncmd → ncwd | Alleghany, Ashe, Watauga, Wilkes |
| 1983 | Pub. L. 97-471 | wvnd → wvsd | Wirt, Wood |
| 1983 | Pub. L. 97-471 | wvsd → wvnd | Braxton, Pocahontas, Webster |
| 1988 | Pub. L. 100-702 | flsd → flmd | Collier, Glades, Hendry |
| 1991 | Pub. L. 102-200 | vaed → vawd | Culpeper, Louisa, Orange |
| 1998 | Pub. L. 105-277 | paed → pamd | Schuylkill |
| 2021 | Pub. L. 117-26 | ncmd → nced | the Fort Bragg / Camp Mackall portions of Hoke, Moore, Scotland, Richmond |

- **Not verifiable:** 28 U.S.C. § 104 (Mississippi) was rewritten wholesale in 2012 and 2013 (Pub. L. 112-188,
  113-61). The notes do not quote the earlier county lists, so a move between N.D. and S.D. Miss. cannot be
  confirmed or ruled out from this source.
- The geometry here is **current law only**. Per-capita or time-series comparisons across these years mix
  slightly different territories. That matters most for E.D./W.D. Va. before 1991, E.D./M.D. Pa. before 1998
  and E.D./M.D.N.C. before 2021. Many other amendments (listed in the JSON) only moved counties between
  divisions of one district, or changed places of holding court.
- **E.D. Tex.:** § 124(c) says "seven divisions" but lists six. Pub. L. 108-157 (2003) abolished the Paris
  Division without changing the count. The six listed divisions are used.
- **Statute spellings** differ from Census names in 12 places (table above). The statute's own text is preserved
  in `statute_name`.
- **Carve-out extents** come from TIGER 2025 landmark and military-installation polygons, applied to 1:500k
  county lines with a 50 m snap and a 0.1 km² artefact threshold. The Butner polygon is the whole correctional
  complex. Yellowstone's extent is the TIGER park polygon, not a surveyed legal boundary.
- **Places of holding court** are what the statute names. They are not geocoded here and may differ from where
  courthouses actually sit (the courthouses lane geocodes them). Utah lists Salt Lake City in both divisions,
  so `statute_places.csv` has 457 rows but 456 distinct district–place pairs.
- **Census quirks:** the 1:20m county file lacks the island areas, so it is not used. The Census WAF answered one
  2000 file (Iowa) with a "Request Rejected" page sent with HTTP 200. `sources.get` checks file signatures and
  refetches once. Iowa had no county-code changes, so `legacy_geoids.csv` is unaffected; the gap is recorded.
- The shared `pipeline.common.http.fetch` caches 200-status error pages. This lane guards against that in its own
  `sources.get`; other lanes may want the same check.

## Gaps (`data/gaps/boundaries.json`)

- `american_samoa_no_district`: AS (60010–60050) belongs to no judicial district; it is not drawn.
- `hawaii_outlying_islands_not_drawn`: the islands listed in § 91 are not Census county-equivalents.
- `tennessee_river_waters_not_delineated`: the § 123(c)(1) river strip is not drawn.
- `ny_concurrent_waters_not_drawn`: the waters shared under § 112(b)–(c) are not drawn.
- `statutory_places_not_named_gud_vid`: title 48 names no place of holding court for D. Guam or D.V.I.; the
  variable is omitted for those two districts.
- `legacy_files_unavailable`: co19_d00 (Iowa, 2000) was rejected by the Census CDN on every attempt; this was not
  worked around.
- `cb2025_20m_lacks_island_areas`: a scope note on that file.
- `split_counties_whole_in_county_tables` (added after the audit): each of the 8 split counties has one
  `district_id` in `county_district.csv` and in the `counties` object, namely the district holding the rest of the
  county. So any county→district sum (Census population denominators, `county_equivalents`) credits the carved
  parts to mtd, idd and ncmd instead of wyd and nced. The largest share is Hoke: 362.3 of 1,014.3 km² (36%) is in
  nced. Per-capita figures for mtd, idd, wyd, ncmd and nced that use a county-sum denominator are approximate;
  allocating exactly would need block-level counts from the population lane. Area shares are not population
  shares and are not used as such.

## Audit fixes (boundary audit, 2026-11-27)

The adversarial boundary audit found no blocker or major issue. It raised five minor issues; each is listed below
with what was done. The auditor could not save its report to `docs/audits/boundary_audit.md` (a harness guard
blocked the write), and that folder is outside this lane's write scope. So this section records the fixes, and the
orchestrator holds the auditor's report text.

| # | Issue | Resolution |
|---|---|---|
| 1 | The 8 split counties are drawn whole in the hi `counties` object with one `district_id` and no split marker, so county-based hover or search in Fort Bragg / Camp MacKall, Butner or the Yellowstone parts of MT and ID would report ncmd, mtd or idd. | **Fixed.** `geometry.split_districts()` derives `own;carved_to` from the county pieces. `_finish_topology` writes it as `split_districts` on those 8 features (e.g. 37093 `ncmd;nced`, 30067 `mtd;wyd`), matching `county_district.csv`. This is a contract addition, recorded above. The auditor's area shares were reproduced from `split_counties.csv` (Hoke 64.3% in ncmd, …; Park is 94.8%, not 94.9%). Tests: `test_hi_counties_carry_split_districts`, and `test_carve_out_points_resolve_in_hi_topology`, which checks all 9 carve-out test points against the hi `districts` object and the containing county's `split_districts`. **For the web and search lanes:** resolve a point to a district against `districts`, not a county's `district_id`. Today the web uses `counties` only to draw county lines. |
| 2 | Iberia Parish 22045 is invalid in the hi `counties` object (a self-intersection caused by quantization). | **Fixed** with mapshaper's `-o … fix-geometry` (see "Validity after decoding"). Every feature in both files is now valid. 5 points moved by under 2 m; the lo file is unchanged. Tests: `test_topojson` now requires every county to be valid (it allowed up to 3 invalid before), plus `test_iberia_parish_valid_in_hi_counties`. Both new tests fail on the pre-fix file and pass on the rebuilt one. |
| 3 | Split counties sit wholly in one district, so county-sum population and per-capita rates credit the carved parts to ncmd, mtd and idd. | **Documented; no data change.** The assignment is by design: one row per Census county, already flagged with `split_districts` and `split_note`, with areas in `split_counties.csv`. New gap `split_counties_whole_in_county_tables` in `data/gaps/boundaries.json` (it flows into DATA_GAPS.md through `pipeline.build_docs`). It names mtd, idd, wyd, ncmd and nced as having approximate county-sum per-capita denominators. Allocating by area would be an estimate, so it is not done. An exact split needs block-level counts, which is work for the population lane. |
| 4 | hid's extent reaches about 178°W (NW Hawaiian Islands), so an inset fitted to its bounding box is too small; the § 91 islands, the § 123(c)(1) river strip and the § 112(b)–(c) waters are not drawn. | **No boundaries change** (the auditor agrees). This is faithful to Census Honolulu County. A framing note for the web lane is added under §5. The three undrawn items were already recorded as gaps. |
| 5 | The audit report could not be written to `docs/audits/boundary_audit.md`. | **Not fixable in this lane** (outside its write scope; the same harness guard applies). Passed to the orchestrator: save the auditor's summary as that file, with this table as its "Fixes applied" section. |

Rebuild after the fixes: `python -m pipeline.boundaries.build` (exit 0). Byte-identical to before: `county_district.csv`,
`split_counties.csv`, `statute_*`, `name_matches.csv`, `legacy_geoids.csv`, `observations.*`, `variables.json`,
`districts-lo.topo.json` and `divisions.json`. Changed: `districts-hi.topo.json` (2,793,059 → 2,793,589 bytes),
`build_summary.json` and `data/gaps/boundaries.json` (one gap added). Tests: 106 passed.
