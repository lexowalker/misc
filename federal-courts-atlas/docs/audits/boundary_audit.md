# Boundary audit: Federal Courts Atlas

Date: 2026-11-27. Auditor: Claude (Claude Code), adversarial lane.

## Verdict

**Passed. There are no blocker or major issues.**

- **Spot check:** all 64 rows pass, across 24 multi-district states.
- **Full re-derivation:** I matched all 2,225 county-equivalents in those 24 states from my own parse of the statute. District mismatches: 0. Division mismatches: 0.
- **Virginia:** all 38 independent cities pass my own § 127(c) geometry test.
- **Divisions:** every statutory division in the country matches divisions.json (144 of 144).
- **Geometry:** valid, no gaps, no overlaps, and the carve-outs are correct.
- **Tests:** the lane's 98 tests pass.
- **Minor issues:** five, listed under Issues. None changes which district a county belongs to.

## How I checked, independently of the lane

I did not read or import any parse product from the lane. That excludes statute_parsed.json, name_matches.csv, statute_crosscheck.csv and va_city_rule.csv. I used only pipeline.common.http.fetch with cached copies.

**(a) Statute text from two sources, each parsed with my own code**
- Cornell LII HTML for 28 U.S.C. §§ 81–131 and 81A, and 48 U.S.C. § 1615 (BeautifulSoup).
- The OLRC USLM XML release point 119-142 zip (lxml).
- All 180 "comprises" sentences in the 24 states are identical word for word in the two sources, after whitespace and quote normalisation.
- `uscode.house.gov/view.xhtml` now returns 404, so the zip is the only OLRC route.

**(b) My own list splitter and name matcher**
- I matched names against cb_2025_us_county_500k, by state and type: a plain name could match only a county (LSAD not 25), and "X city" only an independent city.
- I set the spelling and extinct-county readings myself: Hot Springs, Dade, Vermilion, Davies, Breckenridge, Woods, Shackleford, Brisco, Cook, Zavalla, Accomac, "Le Flore Love", and Virginia's Elizabeth City, Nansemond, Norfolk, Princess Anne and Warwick.
- Result: 2,192 names matched. None was unmatched, no GEOID went to two districts, and none was listed twice.

**(c) Virginia § 127(c) by geometry.** For each city I found the counties sharing more than 100 m of boundary in the Census 1:500k file.

**(d) Geometry.** I wrote my own TopoJSON decoder and tested the result with shapely. I rendered maps with matplotlib.

Scripts and renders are in `/tmp/claude-0/-home-user/1a4c400e-f852-5388-9732-71aa7a3040b2/scratchpad/audit/`:
- scripts: indep_parse.py, compare.py, vacities.py, olrc.py, topo.py, topocheck.py, topocheck2.py, render.py, insets.py, divall.py, winding.py
- renders: map_lo.png, map_hi.png, insets.png

## 1. Statute spot check (64 rows, 24 states)

States covered: AL AR CA FL GA IL IN IA KY LA MI MS MO NY NC OH OK PA TN TX VA WA WV WI.

"Expected" is my reading of the quoted sentence. "Assigned" is the value in county_district.csv.

| State | County | GEOID | Statute section + quoted phrase | Expected | Assigned | Result |
|---|---|---|---|---|---|---|
| VA | Fairfax County | 51059 | § 127(a): "The Eastern District comprises the counties of … Elizabeth City, Essex, Fairfax, Fauquier, Gloucester …" | vaed | vaed | PASS |
| VA | Fairfax city | 51600 | § 127(c): "Cities … are included in that district in which are included the counties within the exterior boundaries of which such cities … are geographically located or out of the territory of which they have been incorporated." Only neighbour: Fairfax County, listed in § 127(a). | vaed | vaed | PASS |
| VA | Richmond County | 51159 | § 127(a): "The Eastern District comprises the counties of … Prince William, Princess Anne, Richmond, Southampton, Spotsylvania …" | vaed | vaed | PASS |
| VA | Richmond city | 51760 | § 127(c). Neighbours: Henrico and Chesterfield, both listed in § 127(a). | vaed | vaed | PASS |
| VA | Roanoke County | 51161 | § 127(b): "The Western District comprises the counties of … Pulaski, Rappahannock, Roanoke, Rockbridge, Rockingham …" | vawd | vawd | PASS |
| VA | Roanoke city | 51770 | § 127(c). Neighbours: Roanoke County (§ 127(b)) and Salem city. | vawd | vawd | PASS |
| VA | Franklin County | 51067 | § 127(b): "The Western District comprises the counties of … Floyd, Fluvanna, Franklin, Frederick, Giles …" | vawd | vawd | PASS |
| VA | Franklin city | 51620 | § 127(c). Neighbours: Southampton and Isle of Wight, both in § 127(a). Not Franklin County. | vaed | vaed | PASS |
| VA | Culpeper County | 51047 | § 127(b): "… Clarke, Craig, Culpeper, Cumberland, Dickenson …" | vawd | vawd | PASS |
| VA | Chesapeake city | 51550 | § 127(a): "… Nansemond, New Kent, Norfolk, Northampton …" (the former Norfolk County) plus § 127(c); all neighbours are Eastern. | vaed | vaed | PASS |
| VA | Accomack County | 51001 | § 127(a): "The Eastern District comprises the counties of Accomac, Amelia, Arlington …" | vaed | vaed | PASS |
| VA | Bedford County | 51019 | § 127(b): "… Augusta, Bath, Bedford, Bland, Botetourt …" | vawd | vawd | PASS |
| VA | Bedford city (retired; in legacy_geoids.csv) | 51515 | § 127(c): the city lay inside Bedford County, which is in § 127(b). | vawd | vawd | PASS |
| MO | St. Louis city | 29510 | § 105(a)(1): "The Eastern Division comprises the counties of … Saint Louis, Warren, and Washington, and the city of Saint Louis." | moed | moed | PASS |
| MO | St. Louis County | 29189 | § 105(a)(1): "… Saint Charles, Saint Francois, Saint Louis, Warren, and Washington …" | moed | moed | PASS |
| MO | Ste. Genevieve County | 29186 | § 105(a)(3): "The Southeastern Division comprises the counties of … Ripley, Saint Genevieve, Scott …" | moed | moed | PASS |
| MO | Dade County | 29057 | § 105(b)(5): "The Southern Division comprises the counties of Cedar, Christian, Dade, Dallas …" | mowd | mowd | PASS |
| NY | Kings County | 36047 | § 112(c): "The Eastern District comprises the counties of Kings, Nassau, Queens …" | nyed | nyed | PASS |
| NY | Queens County | 36081 | § 112(c): "… Kings, Nassau, Queens, Richmond, and Suffolk and concurrently with the Southern District …" | nyed | nyed | PASS |
| NY | Richmond County (Staten Island) | 36085 | § 112(c): "… Queens, Richmond, and Suffolk …" | nyed | nyed | PASS |
| NY | New York County | 36061 | § 112(b): "The Southern District comprises the counties of Bronx, Dutchess, New York, Orange, Putnam …" | nysd | nysd | PASS |
| NY | Bronx County | 36005 | § 112(b): "The Southern District comprises the counties of Bronx, Dutchess, New York …" | nysd | nysd | PASS |
| NY | Ulster County | 36111 | § 112(a): "The Northern District comprises the counties of … Tompkins, Ulster, Warren, and Washington." | nynd | nynd | PASS |
| LA | Orleans Parish | 22071 | § 98(a): "The Eastern District comprises the parishes of … Lafourche, Orleans, Plaquemines …" | laed | laed | PASS |
| LA | East Baton Rouge Parish | 22033 | § 98(b): "The Middle District comprises the parishes of Ascension, East Baton Rouge, East Feliciana …" | lamd | lamd | PASS |
| LA | LaSalle Parish | 22059 | § 98(c): "The Western District comprises the parishes of … Lafayette, La Salle, Lincoln …" | lawd | lawd | PASS |
| LA | Iberia Parish | 22045 | § 98(c): "… Grant, Iberia, Jackson …" | lawd | lawd | PASS |
| LA | St. Tammany Parish | 22103 | § 98(a): "… Saint John the Baptist, Saint Tammany, Tangipahoa …" | laed | laed | PASS |
| FL | Miami-Dade County | 12086 | § 89(c): "The Southern District comprises the counties of Broward, Dade, Highlands, Indian River …" (recoded 12025 to 12086 in 1997) | flsd | flsd | PASS |
| FL | Collier County | 12021 | § 89(b): "The Middle District comprises the counties of … Clay, Collier, Columbia, De Soto …" | flmd | flmd | PASS |
| GA | Dade County | 13083 | § 90(a)(3): "The Rome Division comprises the counties of … Chattooga, Dade, Floyd …" | gand | gand | PASS |
| GA | Richmond County | 13245 | § 90(c)(1): "The Augusta Division comprises the Counties of … McDuffie, Richmond, Taliaferro …" | gasd | gasd | PASS |
| NC | Durham County | 37063 | § 113(b): "… Davie, Durham (excluding that portion of Durham County encompassing the Federal Correctional Institution, Butner, North Carolina), Forsyth …". § 113(a) puts that portion in the Eastern District. | ncmd (+ nced part) | ncmd, split flagged | PASS |
| NC | Hoke County | 37093 | § 113(b): "… Hoke (excluding that portion of Hoke County encompassing the Fort Bragg Military Reservation and Camp Mackall) …" | ncmd (+ nced part) | ncmd, split flagged | PASS |
| NC | Wilkes County | 37193 | § 113(c): "… Union, Watauga, Wilkes, and Yancey." | ncwd | ncwd | PASS |
| PA | Schuylkill County | 42107 | § 118(b): "The Middle District comprises the counties of … Potter, Schuylkill, Snyder …" | pamd | pamd | PASS |
| WV | Wood County | 54107 | § 129(b): "… Wayne, Wirt, Wood, and Wyoming." | wvsd | wvsd | PASS |
| WV | Braxton County | 54007 | § 129(a): "The Northern District comprises the counties of Barbour, Berkeley, Braxton …" | wvnd | wvnd | PASS |
| TX | Shackelford County | 48417 | § 124(a)(3): "The Abilene Division comprises the counties of … Nolan, Shackleford, Stephens …" | txnd | txnd | PASS |
| TX | Cooke County | 48097 | § 124(c)(3): "The Sherman Division comprises the counties of Collin, Cook, Delta, Denton …" (Texas has no Cook County) | txed | txed | PASS |
| TX | Zavala County | 48507 | § 124(d)(5): "The Del Rio Division comprises the counties of Edwards, Kinney, Maverick, Terrell, Uvalde, Val Verde, and Zavalla." | txwd | txwd | PASS |
| TX | Ector County | 48135 | § 124(d)(7): "The Midland-Odessa Division comprises the counties of Andrews, Crane, Ector, Martin, Midland, and Upton." | txwd | txwd | PASS |
| OK | Le Flore County | 40079 | § 116(b): "The Eastern District comprises the counties of … Latimer, Le Flore Love, McCurtain …" (a missing comma) | oked | oked | PASS |
| OK | Love County | 40085 | § 116(b): same phrase | oked | oked | PASS |
| AR | Hot Spring County | 05059 | § 83(b)(6): "The Hot Springs Division comprises the counties of Clark, Garland, Hot Springs, Montgomery, and Pike." | arwd | arwd | PASS |
| IN | Vermillion County | 18165 | § 94(b)(2): "The Terre Haute Division comprises the counties of … Sullivan, Vermilion, and Vigo." | insd | insd | PASS |
| IN | Daviess County | 18027 | § 94(b)(3): "The Evansville Division comprises the counties of Davies, Dubois, Gibson …" | insd | insd | PASS |
| KY | Breckinridge County | 21027 | § 97(b): "The Western District comprises the counties of … Barren, Breckenridge, Bullitt …" | kywd | kywd | PASS |
| OH | Wood County | 39173 | § 115(a)(2): "The Western Division comprises the counties of … Williams, Woods, and Wyandot." | ohnd | ohnd | PASS |
| IL | DuPage County | 17043 | § 93(a)(1): "The Eastern Division comprises the counties of Cook, Du Page, Grundy, Kane …" | ilnd | ilnd | PASS |
| IL | LaSalle County | 17099 | § 93(a)(1): "… Kendall, Lake, La Salle, and Will." | ilnd | ilnd | PASS |
| IA | O'Brien County | 19141 | § 95(a)(3): "The Western Division comprises the counties of … Monona, O’Brien, Osceola …" | iand | iand | PASS |
| MI | St. Clair County | 26147 | § 102(a)(1): "The Southern Division comprises the counties of … Oakland, Saint Clair, Sanilac …" | mied | mied | PASS |
| MS | Hinds County | 28049 | § 104(b)(1): "The Northern Division comprises the counties of Copiah, Hinds, Holmes …" (the Northern Division of the *Southern* District) | mssd | mssd | PASS |
| MS | DeSoto County | 28033 | § 104(a)(2): "The Oxford Division comprises the counties of Benton, Calhoun, DeSoto …" | msnd | msnd | PASS |
| TN | Shelby County | 47157 | § 123(c)(2): "The Western Division comprises the counties of Fayette, Lauderdale, Shelby, and Tipton." | tnwd | tnwd | PASS |
| TN | Decatur County | 47039 | § 123(c)(1): "The Eastern Division comprises the counties of … Crockett, Decatur, Dyer …" | tnwd | tnwd | PASS |
| CA | San Bernardino County | 06071 | § 84(c)(1): "The Eastern Division comprises the counties of Riverside and San Bernardino." | cacd | cacd | PASS |
| CA | Imperial County | 06025 | § 84(d): "The Southern District comprises the counties of Imperial and San Diego." | casd | casd | PASS |
| CA | Mono County | 06051 | § 84(b): "The Eastern District comprises the counties of … Modoc, Mono, Nevada …" | caed | caed | PASS |
| WA | Klickitat County | 53039 | § 128(a): "The Eastern District comprises the counties of … Kittitas, Klickitat, Lincoln …" | waed | waed | PASS |
| WA | Skamania County | 53059 | § 128(b): "The Western District comprises the counties of … Skagit, Skamania, Snohomish …" | wawd | wawd | PASS |
| WI | St. Croix County | 55109 | § 130(b): "The Western District comprises the counties of … Rusk, Saint Croix, Sauk …" | wiwd | wiwd | PASS |
| AL | St. Clair County | 01115 | § 81(a)(4): "The Eastern Division comprises the counties of … Etowah, Saint Clair, and Talladega." | alnd | alnd | PASS |

## 2. Global checks

All of these pass unless an Issues entry says otherwise.

**County list**
- county_district.csv has 3,235 rows with 3,235 unique GEOIDs. This is exactly the cb_2025 500k GEOID set: none missing, none extra.
- The vintage is 2025. Every row's state matches its GEOID prefix, and every assigned district belongs to that row's state.
- No district has zero rows.
- American Samoa's 5 rows have district_id "" and give the reason in `basis`.

**Full re-derivation**
- Every non-city row in the 24 multi-district states matches my parse.
- That is 2,225 rows minus 33 Virginia cities. The other 5 cities (Chesapeake, Hampton, Newport News, Suffolk, Virginia Beach) are covered by the statute's extinct-county names.
- District matches: 2,192 of 2,192. Division matches: all.

**Virginia cities**
- For all 38 independent cities, every neighbouring county is in the city's assigned district. No city is ambiguous under § 127(c).

**Divisions**
- divisions.json matches my parse for 117 multi-district divisions (including Midland-Odessa), 25 divisions in single-district states, and the Virgin Islands' 2 divisions.
- That makes 144 of 144, which is the sum of the `statutory_divisions` observations.
- The South Dakota divisions use Edmonds = Edmunds and Shannon = Oglala Lakota, which I confirm are correct.
- Each district's `counties` list equals its rows in the CSV.

**TopoJSON structure (lo and hi)**
- `districts` has 94 features. Their ids equal the registry, and their name, short, state and circuit match the registry exactly.
- `states` has 55 features with postal ids.
- `counties` (hi file only) has 3,230 features: every GEOID except American Samoa. Each `district_id` equals the CSV.
- Coordinates are unprojected lon/lat.
- Every exterior ring is clockwise and every hole counter-clockwise, which is what d3 expects.

**Validity**
- All districts and states are valid in both files.
- One county is invalid: Iberia Parish 22045 in the hi file (Issue 2).

**Gaps and overlaps**
- No two districts overlap by more than 1e-8 deg².
- The union of all districts equals the union of all states exactly.
- Within each state, the union of its districts equals the state polygon. The only exceptions are the Yellowstone carve-out:

| State | Difference | Approx. area | Expected park part |
|---|---|---|---|
| MT | state minus districts 0.0727 deg² | ~635 km² | 638 km² |
| ID | state minus districts 0.0170 deg² | ~150 km² | 149 km² |
| WY | districts minus state 0.0897 deg² | | the MT + ID parts |

- The two holes inside districts are real:
  - ncmd's hole is the Camp Mackall exclave of nced (about 30 km²).
  - gand's hole is a 0.19 km² exclave of Upson County (gamd) that is present in the Census source itself.

**Yellowstone**
- These test points fall in wyd in both files:
  - MT park points 45.01N -110.70W and 44.80N -111.07W;
  - ID park point 44.30N -111.08W;
  - Old Faithful and Mammoth Hot Springs.
- Gardiner, MT and West Yellowstone, MT fall in mtd.
- The statute text I fetched supports this:
  - § 92: "Idaho, exclusive of Yellowstone National Park …";
  - § 106: "Montana, exclusive of Yellowstone National Park …";
  - § 131: "Wyoming and those portions of Yellowstone National Park situated in Montana and Idaho constitute one judicial district."
- Area check against my own TIGER 2025 measurement, by state:

| State | TIGER park part | Lane's carve-out |
|---|---|---|
| ID | 149.5 km² | 149.4 km² |
| MT | 638.9 km² | 377.1 + 261.3 = 638.4 km² |
| WY | 8,108 km² | |

- The 1990 Census county "Yellowstone National Park" (30113) measures 637.2 km², which agrees with the MT carve-out.

**North Carolina carve-outs**
- Fort Bragg (35.14N -79.00W), Camp Mackall (35.03N -79.50W) and Butner FCI (36.15N -78.79W) all fall in nced.
- The 8 split counties are the only counties less than 99.9% inside their assigned district.

**Other test points**
- Brooklyn and Staten Island fall in nyed; Manhattan in nysd; the Gateway Arch in moed.
- Kalaupapa falls in hid, Saipan in nmid, Guam in gud, San Juan in prd.
- St. Croix, St. John and Charlotte Amalie fall in vid.
- Attu (+173.2°) and Adak fall in akd.

**Islands**
- The hi file keeps 1,531 polygon parts and the lo file 1,527. The 4 parts missing from lo (akd 2, ctd 1, med 1) were merged into neighbouring parts within 0.01°; no island is lost.
- The insets show the main Hawaiian islands, the NW Hawaiian Islands, PR with Vieques, Culebra and Mona, the 3 Virgin Islands, Guam and the full NMI chain.

**legacy_geoids.csv**
- It covers the CT legacy counties 09001–09015 (all ctd, area share 1.0).
- It covers the retired VA cities 51515 Bedford, 51560 Clifton Forge and 51780 South Boston (all vawd).
- It covers the retired AK codes 02201, 02231, 02232, 02261, 02270 and 02280 (akd), SD 46113 Shannon (sdd), FL 12025 Dade (flsd) and MT 30113 Yellowstone NP (wyd, share 0.989).

**Other outputs**
- districts.parquet: 94 valid features in EPSG:4326, with area_km2 within ±0.02% of my recomputation.
- Every observation source_id is in data/sources/boundaries.json.

**File sizes**

| File | Raw | gzip |
|---|---|---|
| districts-lo.topo.json | 349,885 B | 120 KB |
| districts-hi.topo.json | 2,793,059 B | 946 KB |
| divisions.json | 298 KB | |

All processed files are under 20 MB; the largest is districts.parquet at 5.4 MB.

## 3. Renders

I rendered both files: the lower 48 in EPSG:5070 with Alaska, Hawaii, PR/VI and GU/MP insets, zooms on Yellowstone, NYC and Fort Bragg, and districts coloured so that neighbours differ (5 colours).

Nothing is odd beyond what the data intends:
- The wyd strip along the MT north edge and the MT/ID west edge of the park is visible.
- Camp Mackall shows as an nced exclave.
- NYC splits Manhattan and the Bronx (nysd) from Brooklyn, Queens, Staten Island and Long Island (nyed).
- Alaska is complete, with the Aleutians across 180°.
- All territories are present.
- I found no missing islands and no holes other than the two real exclaves.

The Hawaii inset framed on hid's full bounding box makes the main islands tiny, because the NW Hawaiian Islands reach about 178°W (Issue 4).

## 4. Lane tests

`PYTHONPATH=. .venv/bin/python -m pytest -q tests/pipeline/` gives **98 passed** in 3.3 s: 95 boundaries tests and 3 registry tests.

## Issues (all minor)

1. Split counties have no split marker in the `counties` layer (details below).
2. Iberia Parish 22045 is an invalid polygon in the hi `counties` layer.
3. Split-county populations will go to one district in per-capita work.
4. Hawaii's map extent, and the documented undrawn areas.
5. Not a lane defect: the report file was not written.

Details are in the structured issues list.

## What I did not check

- I did not compare the Fort Bragg, Camp Mackall and Butner extents with surveyed legal boundaries; TIGER landmark and installation polygons are a proxy, as the lane documents.
- I did not verify that the pre-1980 history notes are complete.
- I did not check the front-end projection code.

## Fixes applied

Saved here by the orchestrator: the auditor could not write this file itself. The boundaries fix lane
recorded its resolutions in the "Audit fixes (boundary audit, 2026-11-27)" section of `docs/lanes/boundaries.md`.
Summary:

| # | Issue | Resolution |
|---|---|---|
| 1 | Split counties carry no split marker in the hi `counties` object | **Fixed.** `split_districts` property (for example `ncmd;nced`) on the 8 split counties; the web and search lanes resolve points against `districts`, not a county's `district_id`. Tested. |
| 2 | Iberia Parish 22045 invalid after quantization | **Fixed** (mapshaper `fix-geometry`); every feature in both files is now valid. Tested. |
| 3 | Split-county population credited wholly to one district | **Documented** as gap `split_counties_whole_in_county_tables`; per-capita denominators for mtd, idd, wyd, ncmd and nced are flagged as approximate. Not allocated by area. |
| 4 | Hawaii inset framing; undrawn § 91 islands, § 123(c)(1) strip, § 112 waters | **No data change.** The web lane frames the Hawaii inset on the main islands; the undrawn items are recorded gaps. |
| 5 | Report file not written | **Resolved** by saving this file. |

Tests after the fixes: 106 boundaries tests passed.
