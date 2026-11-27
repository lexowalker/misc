"""FJC "Court Name" -> district_id crosswalk for U.S. district courts.

The FJC export names every district court "U.S. District Court for the <district name>". For the 91
Article III districts in the registry the district name is the registry ``name`` (e.g. "Eastern District
of Virginia"). Two FJC spellings map to D.D.C.: the modern name and "U.S. District Court for the District
of Columbia (Supreme Court of the District of Columbia)", which FJC uses for the Supreme Court of the
District of Columbia (1863-1936), the same court under its earlier name (judges commissioned to it served on
into the renamed court without a new service record; some until 1965).

Every other district-court name in the export is a court that no longer exists (it was split, merged or
abolished). Those are listed explicitly in HISTORICAL so that an unexpected new name fails the build instead
of being silently dropped. The three Article IV territorial courts (D.V.I., D. Guam, D.N.M.I.) never appear:
their judges serve fixed terms and are not in the Article III directory.
"""
from __future__ import annotations

from pipeline.common.districts import DISTRICTS, TERRITORIAL

PREFIX = "U.S. District Court for the "

# FJC name variants that refer to a current district court under an earlier name.
VARIANTS = {
    "U.S. District Court for the District of Columbia (Supreme Court of the District of Columbia)": (
        "dcd",
        "Supreme Court of the District of Columbia (1863-1936), renamed the District Court of the United "
        "States for the District of Columbia in 1936 and the U.S. District Court in 1948; FJC files its "
        "justices under this court name.",
    ),
}

# District courts in the FJC export that are not one of today's 94 districts. Value: short history note.
HISTORICAL = {
    'U.S. District Court for the Albemarle, Cape Fear & Pamptico Districts of North Carolina':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the Edenton, New Bern & Wilmington Districts of North Carolina':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Alabama':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Arkansas':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of California':
        'California reorganized as a single district July 27, 1866 and divided again Aug. 5, 1886 (FJC California legislative history).',
    'U.S. District Court for the District of Florida':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Georgia':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Illinois':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Indiana':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Iowa':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Kentucky':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Louisiana':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Michigan':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Mississippi':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Missouri':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of New York':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of North Carolina':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Ohio':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Orleans':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Pennsylvania':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Tennessee':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Texas':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Virginia':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Washington':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of West Virginia':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the District of Wisconsin':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the Eastern District of Illinois':
        'Established Mar. 3, 1905; Illinois reorganized into N.D., C.D. and S.D. effective Mar. 31, 1979 (FJC Illinois legislative history).',
    'U.S. District Court for the Eastern District of New Jersey':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the Western District of New Jersey':
        "Not one of today's 94 districts (a predecessor court; see FJC state legislative-history pages). Not verified line by line.",
    'U.S. District Court for the Eastern District of South Carolina':
        'South Carolina divided into Eastern and Western Districts effective Jan. 1, 1912; reorganized as a single district by the act of Oct. 7, 1965 (FJC South Carolina legislative history).',
    'U.S. District Court for the Western District of South Carolina':
        'South Carolina divided into Eastern and Western Districts effective Jan. 1, 1912; reorganized as a single district by the act of Oct. 7, 1965 (FJC South Carolina legislative history).',
}
# Notes marked 'FJC ... legislative history' were read from the cached FJC pages; the build never uses the
# notes as data. Service dates for these courts are reported from the export itself in court_crosswalk.csv.

INCARNATION_START = {"scd": "1965-11-01"}


def article3_names() -> dict[str, str]:
    """FJC court name -> district_id for every Article III district (modern names + variants)."""
    out = {PREFIX + d.name: d.id for d in DISTRICTS if d.id not in TERRITORIAL}
    out.update({k: v[0] for k, v in VARIANTS.items()})
    return out


def map_court(name: str) -> tuple[str | None, str]:
    """Return (district_id or None, status) for an FJC district-court name.

    status is "current" (one of the 94), "current_variant" (earlier name of a current court) or
    "historical" (a court that no longer exists). Unknown names raise KeyError.
    """
    if name in VARIANTS:
        return VARIANTS[name][0], "current_variant"
    m = article3_names()
    if name in m:
        return m[name], "current"
    if name in HISTORICAL:
        return None, "historical"
    raise KeyError(f"unmapped FJC district-court name: {name!r}")


def note_for(name: str) -> str:
    if name in VARIANTS:
        return VARIANTS[name][1]
    return HISTORICAL.get(name, "")
