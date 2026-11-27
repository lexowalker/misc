"""Matching statute county names to Census GEOIDs: the normalization rule and the explicit override table.

Rule: a statute name matches a Census county-equivalent of the same state and type when the names are
identical ("exact"). EVERY other match must be listed in ``OVERRIDES`` with a reason; nothing is matched
fuzzily at run time. ``normalize`` is used (a) to verify that "normalized_variant" overrides really are pure
spelling-convention variants (St./Saint, De Kalb/DeKalb, apostrophes, spacing) and (b) to suggest a fix when an
unknown name makes the build fail.
"""
from __future__ import annotations

import re
import unicodedata

SRC_POP = "census_pop_counties_1790_1990"
POP_LOC = "Part III, 'Virginia Notes', p. {page}, note {note}"


def normalize(name: str) -> str:
    """Spelling-convention-insensitive key: accents, case, apostrophes, periods, Saint/St., spaces, hyphens."""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = s.replace("’", "").replace("'", "").replace(".", "")
    s = re.sub(r"\bsaint\b", "st", s)
    s = re.sub(r"\bsainte\b", "ste", s)
    return re.sub(r"[\s\-]", "", s)


# (state, statute name as written, kind) -> dict(geoid, method, reason[, source_id, locator])
# methods:
#   normalized_variant  same name under normalize() (St./Saint, De Kalb/DeKalb, La Salle/LaSalle, ’/')
#   spelling_variant    statute spelling differs from the Census name; justified individually
#   renamed             county renamed (and recoded) by Census since the statute was written
#   island              Virgin Islands island (48 U.S.C. § 1615) -> Census island county-equivalent
_NV = "normalized_variant"
OVERRIDES: dict[tuple[str, str, str], dict] = {}


def _add(state, name, kind, geoid, method, reason="", source_id="", locator=""):
    OVERRIDES[(state, name, kind)] = {"geoid": geoid, "method": method, "reason": reason,
                                      "source_id": source_id, "locator": locator}


for _st, _nm, _kind, _g in [
    ("AL", "Saint Clair", "county", "01115"),
    ("FL", "De Soto", "county", "12027"),
    ("GA", "De Kalb", "county", "13089"),
    ("IL", "Du Page", "county", "17043"), ("IL", "La Salle", "county", "17099"), ("IL", "De Kalb", "county", "17037"),
    ("IN", "De Kalb", "county", "18033"), ("IN", "Lagrange", "county", "18087"), ("IN", "La Porte", "county", "18091"),
    ("IA", "O’Brien", "county", "19141"),
    ("LA", "Saint Bernard", "parish", "22087"), ("LA", "Saint Charles", "parish", "22089"),
    ("LA", "Saint James", "parish", "22093"), ("LA", "Saint John the Baptist", "parish", "22095"),
    ("LA", "Saint Tammany", "parish", "22103"), ("LA", "Saint Helena", "parish", "22091"),
    ("LA", "La Salle", "parish", "22059"), ("LA", "Saint Landry", "parish", "22097"),
    ("LA", "Saint Martin", "parish", "22099"), ("LA", "Saint Mary", "parish", "22101"),
    ("MD", "Queen Anne’s", "county", "24035"), ("MD", "Prince George’s", "county", "24033"),
    ("MD", "St. Mary’s", "county", "24037"),
    ("MI", "Saint Clair", "county", "26147"), ("MI", "Saint Joseph", "county", "26149"),
    ("MN", "Saint Louis", "county", "27137"),
    ("MO", "Saint Charles", "county", "29183"), ("MO", "Saint Francois", "county", "29187"),
    ("MO", "Saint Louis", "county", "29189"), ("MO", "Saint Clair", "county", "29185"),
    ("MO", "De Kalb", "county", "29063"),
    ("MO", "Saint Louis", "city", "29510"),
    ("NY", "Saint Lawrence", "county", "36089"),
    ("TN", "De Kalb", "county", "47041"),
    ("WI", "Saint Croix", "county", "55109"),
]:
    _add(_st, _nm, _kind, _g, _NV, "Same name under the normalization rule (Saint/St., spacing, apostrophe).")

_SP = ("No county of this exact name exists in the state; the Census county named here is the only near match, "
       "is otherwise unlisted in the section, and with it every county of the state is assigned exactly once.")
_add("AR", "Hot Springs", "county", "05059", "spelling_variant",
     "Statute writes 'Hot Springs'; the county is Hot Spring County (the city of Hot Springs is its seat). " + _SP)
_add("IN", "Vermilion", "county", "18165", "spelling_variant", "Statute 'Vermilion'; Census 'Vermillion'. " + _SP)
_add("IN", "Davies", "county", "18027", "spelling_variant", "Statute 'Davies'; Census 'Daviess'. " + _SP)
_add("KY", "Breckenridge", "county", "21027", "spelling_variant",
     "Statute 'Breckenridge'; Census 'Breckinridge'. " + _SP)
_add("MO", "Saint Genevieve", "county", "29186", "spelling_variant",
     "Statute 'Saint Genevieve'; Census 'Ste. Genevieve' (Sainte, not Saint). " + _SP)
_add("OH", "Woods", "county", "39173", "spelling_variant", "Statute 'Woods'; Census 'Wood'. " + _SP)
_add("SD", "Edmonds", "county", "46045", "spelling_variant", "Statute 'Edmonds'; Census 'Edmunds'. " + _SP)
_add("TX", "Shackleford", "county", "48417", "spelling_variant", "Statute 'Shackleford'; Census 'Shackelford'. " + _SP)
_add("TX", "Brisco", "county", "48045", "spelling_variant", "Statute 'Brisco'; Census 'Briscoe'. " + _SP)
_add("TX", "Cook", "county", "48097", "spelling_variant", "Statute 'Cook'; Census 'Cooke'. " + _SP)
_add("TX", "Zavalla", "county", "48507", "spelling_variant", "Statute 'Zavalla'; Census 'Zavala'. " + _SP)
_add("VA", "Accomac", "county", "51001", "spelling_variant", "Statute 'Accomac'; Census 'Accomack'. " + _SP)
_add("FL", "Dade", "county", "12086", "renamed",
     "Dade County was renamed Miami-Dade County and recoded 12025 -> 12086 (Census change note, 1997).",
     "census_gcn_1970_1999", "row 'FL-12|Dade County|025|Name Change, Census Code Change|11-13-1997'")
_add("SD", "Shannon", "county", "46102", "renamed",
     "Shannon County was renamed Oglala Lakota County and recoded 46113 -> 46102 (Census change note, 2015).",
     "census_gcn_2014_2020", "row 'SD-46|Oglala Lakota County|102|Name Change, FIPS Code Change|05-01-2015'")
_add("VI", "Saint Croix", "island", "78010", "island", "48 U.S.C. § 1615 'island of Saint Croix' = Census "
     "'St. Croix Island' (adjacent islands and cays are inside the Census polygon set).")
_add("VI", "Saint Thomas", "island", "78030", "island", "48 U.S.C. § 1615 'Saint Thomas' = Census 'St. Thomas Island'.")
_add("VI", "Saint John", "island", "78020", "island", "48 U.S.C. § 1615 'Saint John' = Census 'St. John Island'.")


# Counties named in 28 U.S.C. § 127(a) that no longer exist. They are matched to their successor Census
# entity for the "every statute name matched" requirement, but they assign nothing directly: every Virginia
# independent city is placed by § 127(c) using VA_CITY_ORIGINS below.
VA_FORMER_COUNTIES: dict[str, dict] = {
    "Elizabeth City": {"successor_geoids": ["51650"], "note": "C17",
                       "text": "Hampton city, formed from Elizabeth City County (1908). The remainder of the county "
                               "was annexed to the city in 1952."},
    "Nansemond": {"successor_geoids": ["51800"], "note": "C38",
                  "text": "Suffolk city, formed from Nansemond County. The remainder of the county became Nansemond "
                          "city in 1972 and then was annexed to Suffolk city in 1974."},
    "Norfolk": {"successor_geoids": ["51550", "51710", "51740"], "note": "C6, C26, C30, C36",
                "text": "Chesapeake city formed through combination of Norfolk County and South Norfolk city (1963); "
                        "Norfolk city and Portsmouth city were formed from Norfolk County."},
    "Princess Anne": {"successor_geoids": ["51810"], "note": "C39",
                      "text": "Virginia Beach city, formed from Princess Anne County (1952). The remainder of the "
                              "county was annexed to the city in 1963."},
    "Warwick": {"successor_geoids": ["51700"], "note": "C25",
                "text": "Newport News city, formed from Warwick County ... The remainder of Warwick County became "
                        "Warwick city in 1952 and then was annexed to Newport News city in 1958."},
}

# 28 U.S.C. § 127(c): "Cities and incorporated towns are included in that district in which are included the
# counties within the exterior boundaries of which such cities and incorporated towns are geographically
# located or out of the territory of which they have been incorporated."
# geoid -> (city, [counties of origin, spelled as in § 127(a)], note id, page). Transcribed from the Census
# publication's Virginia notes (pp. 174-175); checked by eye against the PDF. Geometry is checked separately:
# every county a city touches must lie in the same district as its county of origin.
VA_CITY_ORIGINS: dict[str, tuple[str, list[str], str, int]] = {
    "51510": ("Alexandria", ["Arlington", "Fairfax"], "C1", 174),   # formed from Alexandria (now Arlington) Co.; annexed from Fairfax
    "51520": ("Bristol", ["Washington"], "C3", 174),
    "51530": ("Buena Vista", ["Rockbridge"], "C4", 174),
    "51540": ("Charlottesville", ["Albemarle"], "C5", 174),
    "51550": ("Chesapeake", ["Norfolk"], "C6", 174),                # Norfolk County + South Norfolk city
    "51570": ("Colonial Heights", ["Chesterfield"], "C8", 174),
    "51580": ("Covington", ["Alleghany"], "C9", 175),
    "51590": ("Danville", ["Pittsylvania"], "C10", 175),
    "51595": ("Emporia", ["Greensville"], "C11", 175),
    "51600": ("Fairfax", ["Fairfax"], "C12", 175),
    "51610": ("Falls Church", ["Fairfax"], "C13", 175),
    "51620": ("Franklin", ["Southampton"], "C14", 175),
    "51630": ("Fredericksburg", ["Spotsylvania"], "C15", 175),
    "51640": ("Galax", ["Carroll", "Grayson"], "C16", 175),
    "51650": ("Hampton", ["Elizabeth City"], "C17", 175),
    "51660": ("Harrisonburg", ["Rockingham"], "C18", 175),
    "51670": ("Hopewell", ["Prince George"], "C19", 175),
    "51678": ("Lexington", ["Rockbridge"], "C20", 175),
    "51680": ("Lynchburg", ["Campbell", "Bedford"], "C21", 175),
    "51683": ("Manassas", ["Prince William"], "C22", 175),
    "51685": ("Manassas Park", ["Prince William"], "C22", 175),
    "51690": ("Martinsville", ["Henry"], "C24", 175),
    "51700": ("Newport News", ["Warwick", "Elizabeth City"], "C25", 175),
    "51710": ("Norfolk", ["Norfolk", "Princess Anne"], "C26", 175),
    "51720": ("Norton", ["Wise"], "C27", 175),
    "51730": ("Petersburg", ["Dinwiddie", "Chesterfield", "Prince George"], "C28", 175),
    "51735": ("Poquoson", ["York"], "C29", 175),
    "51740": ("Portsmouth", ["Norfolk"], "C30", 175),
    "51750": ("Radford", ["Montgomery"], "C31", 175),
    "51760": ("Richmond", ["Henrico", "Chesterfield"], "C32", 175),
    "51770": ("Roanoke", ["Roanoke"], "C33", 175),
    "51775": ("Salem", ["Roanoke"], "C34", 175),
    "51790": ("Staunton", ["Augusta"], "C37", 175),
    "51800": ("Suffolk", ["Nansemond"], "C38", 175),
    "51810": ("Virginia Beach", ["Princess Anne"], "C39", 175),
    "51820": ("Waynesboro", ["Augusta"], "C40", 175),
    "51830": ("Williamsburg", ["James City", "York"], "C41", 175),
    "51840": ("Winchester", ["Frederick"], "C42", 175),
}
# Former independent cities (now towns in a county) that appear in older Census tables.
VA_FORMER_CITIES: dict[str, tuple[str, list[str], str, int]] = {
    "51515": ("Bedford", ["Bedford"], "C2", 174),
    "51560": ("Clifton Forge", ["Alleghany"], "C7", 174),
    "51780": ("South Boston", ["Halifax"], "C35", 175),
}
