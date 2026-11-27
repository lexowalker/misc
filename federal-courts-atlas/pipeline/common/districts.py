"""Canonical registry of the 94 U.S. district courts.

Every lane keys its output by ``district_id`` from this registry. IDs follow the
CourtListener court-id convention (e.g. ``vaed`` = Eastern District of Virginia).

Statutory sources:
  * 89 state districts + D.D.C. + D.P.R.: 28 U.S.C. §§ 81-131.
  * D.V.I.: 48 U.S.C. § 1611.  D. Guam: 48 U.S.C. § 1424.  D.N.M.I.: 48 U.S.C. § 1821.
Circuit assignments: 28 U.S.C. § 41 (and 48 U.S.C. for the territorial courts).
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

STATES = {
    # postal: (name, fips)
    "AL": ("Alabama", "01"), "AK": ("Alaska", "02"), "AZ": ("Arizona", "04"),
    "AR": ("Arkansas", "05"), "CA": ("California", "06"), "CO": ("Colorado", "08"),
    "CT": ("Connecticut", "09"), "DE": ("Delaware", "10"), "DC": ("District of Columbia", "11"),
    "FL": ("Florida", "12"), "GA": ("Georgia", "13"), "HI": ("Hawaii", "15"),
    "ID": ("Idaho", "16"), "IL": ("Illinois", "17"), "IN": ("Indiana", "18"),
    "IA": ("Iowa", "19"), "KS": ("Kansas", "20"), "KY": ("Kentucky", "21"),
    "LA": ("Louisiana", "22"), "ME": ("Maine", "23"), "MD": ("Maryland", "24"),
    "MA": ("Massachusetts", "25"), "MI": ("Michigan", "26"), "MN": ("Minnesota", "27"),
    "MS": ("Mississippi", "28"), "MO": ("Missouri", "29"), "MT": ("Montana", "30"),
    "NE": ("Nebraska", "31"), "NV": ("Nevada", "32"), "NH": ("New Hampshire", "33"),
    "NJ": ("New Jersey", "34"), "NM": ("New Mexico", "35"), "NY": ("New York", "36"),
    "NC": ("North Carolina", "37"), "ND": ("North Dakota", "38"), "OH": ("Ohio", "39"),
    "OK": ("Oklahoma", "40"), "OR": ("Oregon", "41"), "PA": ("Pennsylvania", "42"),
    "RI": ("Rhode Island", "44"), "SC": ("South Carolina", "45"), "SD": ("South Dakota", "46"),
    "TN": ("Tennessee", "47"), "TX": ("Texas", "48"), "UT": ("Utah", "49"),
    "VT": ("Vermont", "50"), "VA": ("Virginia", "51"), "WA": ("Washington", "53"),
    "WV": ("West Virginia", "54"), "WI": ("Wisconsin", "55"), "WY": ("Wyoming", "56"),
    "GU": ("Guam", "66"), "MP": ("Northern Mariana Islands", "69"),
    "PR": ("Puerto Rico", "72"), "VI": ("U.S. Virgin Islands", "78"),
}

CIRCUIT_BY_STATE = {
    **{s: "1" for s in ["ME", "MA", "NH", "RI", "PR"]},
    **{s: "2" for s in ["CT", "NY", "VT"]},
    **{s: "3" for s in ["DE", "NJ", "PA", "VI"]},
    **{s: "4" for s in ["MD", "NC", "SC", "VA", "WV"]},
    **{s: "5" for s in ["LA", "MS", "TX"]},
    **{s: "6" for s in ["KY", "MI", "OH", "TN"]},
    **{s: "7" for s in ["IL", "IN", "WI"]},
    **{s: "8" for s in ["AR", "IA", "MN", "MO", "NE", "ND", "SD"]},
    **{s: "9" for s in ["AK", "AZ", "CA", "HI", "ID", "MT", "NV", "OR", "WA", "GU", "MP"]},
    **{s: "10" for s in ["CO", "KS", "NM", "OK", "UT", "WY"]},
    **{s: "11" for s in ["AL", "FL", "GA"]},
    "DC": "DC",
}

# (district_id, state postal, division word or None)
_RAW = [
    ("alnd", "AL", "Northern"), ("almd", "AL", "Middle"), ("alsd", "AL", "Southern"),
    ("akd", "AK", None), ("azd", "AZ", None),
    ("ared", "AR", "Eastern"), ("arwd", "AR", "Western"),
    ("cand", "CA", "Northern"), ("caed", "CA", "Eastern"), ("cacd", "CA", "Central"), ("casd", "CA", "Southern"),
    ("cod", "CO", None), ("ctd", "CT", None), ("ded", "DE", None), ("dcd", "DC", None),
    ("flnd", "FL", "Northern"), ("flmd", "FL", "Middle"), ("flsd", "FL", "Southern"),
    ("gand", "GA", "Northern"), ("gamd", "GA", "Middle"), ("gasd", "GA", "Southern"),
    ("hid", "HI", None), ("idd", "ID", None),
    ("ilnd", "IL", "Northern"), ("ilcd", "IL", "Central"), ("ilsd", "IL", "Southern"),
    ("innd", "IN", "Northern"), ("insd", "IN", "Southern"),
    ("iand", "IA", "Northern"), ("iasd", "IA", "Southern"),
    ("ksd", "KS", None),
    ("kyed", "KY", "Eastern"), ("kywd", "KY", "Western"),
    ("laed", "LA", "Eastern"), ("lamd", "LA", "Middle"), ("lawd", "LA", "Western"),
    ("med", "ME", None), ("mdd", "MD", None), ("mad", "MA", None),
    ("mied", "MI", "Eastern"), ("miwd", "MI", "Western"),
    ("mnd", "MN", None),
    ("msnd", "MS", "Northern"), ("mssd", "MS", "Southern"),
    ("moed", "MO", "Eastern"), ("mowd", "MO", "Western"),
    ("mtd", "MT", None), ("ned", "NE", None), ("nvd", "NV", None), ("nhd", "NH", None),
    ("njd", "NJ", None), ("nmd", "NM", None),
    ("nynd", "NY", "Northern"), ("nyed", "NY", "Eastern"), ("nysd", "NY", "Southern"), ("nywd", "NY", "Western"),
    ("nced", "NC", "Eastern"), ("ncmd", "NC", "Middle"), ("ncwd", "NC", "Western"),
    ("ndd", "ND", None),
    ("ohnd", "OH", "Northern"), ("ohsd", "OH", "Southern"),
    ("oknd", "OK", "Northern"), ("oked", "OK", "Eastern"), ("okwd", "OK", "Western"),
    ("ord", "OR", None),
    ("paed", "PA", "Eastern"), ("pamd", "PA", "Middle"), ("pawd", "PA", "Western"),
    ("rid", "RI", None), ("scd", "SC", None), ("sdd", "SD", None),
    ("tned", "TN", "Eastern"), ("tnmd", "TN", "Middle"), ("tnwd", "TN", "Western"),
    ("txnd", "TX", "Northern"), ("txed", "TX", "Eastern"), ("txsd", "TX", "Southern"), ("txwd", "TX", "Western"),
    ("utd", "UT", None), ("vtd", "VT", None),
    ("vaed", "VA", "Eastern"), ("vawd", "VA", "Western"),
    ("waed", "WA", "Eastern"), ("wawd", "WA", "Western"),
    ("wvnd", "WV", "Northern"), ("wvsd", "WV", "Southern"),
    ("wied", "WI", "Eastern"), ("wiwd", "WI", "Western"),
    ("wyd", "WY", None),
    ("prd", "PR", None), ("vid", "VI", None), ("gud", "GU", None), ("nmid", "MP", None),
]

_STATE_ABBR = {  # Bluebook-style state abbreviations used in court citations
    "AL": "Ala.", "AK": "Alaska", "AZ": "Ariz.", "AR": "Ark.", "CA": "Cal.", "CO": "Colo.",
    "CT": "Conn.", "DE": "Del.", "DC": "D.C.", "FL": "Fla.", "GA": "Ga.", "HI": "Haw.",
    "ID": "Idaho", "IL": "Ill.", "IN": "Ind.", "IA": "Iowa", "KS": "Kan.", "KY": "Ky.",
    "LA": "La.", "ME": "Me.", "MD": "Md.", "MA": "Mass.", "MI": "Mich.", "MN": "Minn.",
    "MS": "Miss.", "MO": "Mo.", "MT": "Mont.", "NE": "Neb.", "NV": "Nev.", "NH": "N.H.",
    "NJ": "N.J.", "NM": "N.M.", "NY": "N.Y.", "NC": "N.C.", "ND": "N.D.", "OH": "Ohio",
    "OK": "Okla.", "OR": "Or.", "PA": "Pa.", "RI": "R.I.", "SC": "S.C.", "SD": "S.D.",
    "TN": "Tenn.", "TX": "Tex.", "UT": "Utah", "VT": "Vt.", "VA": "Va.", "WA": "Wash.",
    "WV": "W. Va.", "WI": "Wis.", "WY": "Wyo.", "GU": "Guam", "MP": "N. Mar. I.",
    "PR": "P.R.", "VI": "V.I.",
}
_DIV_ABBR = {"Northern": "N.D.", "Southern": "S.D.", "Eastern": "E.D.", "Western": "W.D.",
             "Middle": "M.D.", "Central": "C.D."}

TERRITORIAL = {"vid", "gud", "nmid"}  # Article IV courts; all others are Article III


@dataclass(frozen=True)
class District:
    id: str
    name: str          # "Eastern District of Virginia"
    short: str         # "E.D. Va."
    state: str         # postal code
    state_name: str
    state_fips: str
    circuit: str       # "1".."11" or "DC"
    article: str       # "III" or "IV"

    def to_dict(self) -> dict:
        return asdict(self)


def _build() -> list[District]:
    out = []
    for did, st, div in _RAW:
        sname, fips = STATES[st]
        if st == "DC":
            name, short = "District of Columbia", "D.D.C."
        elif st == "VI":
            name, short = "District of the Virgin Islands", "D.V.I."
        elif st == "MP":
            name, short = "District of the Northern Mariana Islands", "D.N. Mar. I."
        elif div:
            name, short = f"{div} District of {sname}", f"{_DIV_ABBR[div]} {_STATE_ABBR[st]}"
        else:
            name, short = f"District of {sname}", f"D. {_STATE_ABBR[st]}"
        out.append(District(did, name, short, st, sname, fips, CIRCUIT_BY_STATE[st],
                            "IV" if did in TERRITORIAL else "III"))
    return out


DISTRICTS: list[District] = _build()
BY_ID: dict[str, District] = {d.id: d for d in DISTRICTS}
IDS: list[str] = [d.id for d in DISTRICTS]
assert len(DISTRICTS) == 94 and len(BY_ID) == 94, "registry must hold exactly 94 districts"


def by_state(postal: str) -> list[District]:
    return [d for d in DISTRICTS if d.state == postal]
