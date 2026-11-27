"""Which CourtListener items the atlas may show.

The atlas shows only case metadata (name, docket number, dates, nature of suit, cause, link). It skips any item
that is sealed or whose caption suggests a minor or another party whose identity deserves protection, using the
caption, the docket-number case type, and the nature of suit. These are conservative, mechanical rules: an item
they reject is simply not shown; nothing is summarised or characterised.
"""
from __future__ import annotations

import re

# Caption patterns (case-insensitive) that suggest a sealed matter, a minor, a pseudonymous party, or an
# investigative application naming people or devices.
SENSITIVE_CAPTION = [
    r"\bdoes?\b", r"\broes?\b", r"\bminor", r"\bjuvenile", r"\bsealed\b", r"\bunder seal\b", r"\bchild",
    r"\binfant", r"\bguardian", r"\bnext friend", r"\bo/b/o\b", r"\bon behalf of\b", r"\banonymous",
    r"\bpseudonym", r"\bgrand jury\b", r"\bsearch warrant", r"\bsearch of\b", r"\bseizure of\b",
    r"\bpen register", r"\btrap and trace", r"\btracking\b", r"\bcell(ular)? (phone|tele)", r"\bapplication (of|for)\b",
    r"\bin re:? (the )?application\b", r"\bin the matter of\b", r"\bunknown\b", r"\bunnamed\b", r"\bjohn\s+\w*\s*doe",
    r"\bimpounded\b", r"\bin re:? \w\.\s?\w\.", r"\bsexual", r"\babuse", r"\bincest", r"\btrafficking victim",
]
# Social Security benefit appeals (claimants' medical records; captions often anonymised by the court):
# the agency or a Commissioner named as defendant.
SOCIAL_SECURITY_CAPTION = [
    r"social security", r"\bcommissioner of social\b",
    r"\bv\.? (frank )?bisignano\b", r"\bv\.? kijakazi\b", r"\bv\.? berryhill\b", r"\bv\.? (martin )?o'malley\b",
    r"\bv\.? colvin\b", r"\bv\.? astrue\b", r"\bv\.? dudek\b",
]
_SENS_RE = re.compile("|".join(SENSITIVE_CAPTION), re.I)
_SSA_RE = re.compile("|".join(SOCIAL_SECURITY_CAPTION), re.I)
# Parties identified only by initials ("A.B. v. Smith", "Smith v. J.D.", "J.M.R.") or by first name and last
# initial ("Robert S. v. ..."), the forms courts use to protect minors and benefit claimants.
_INITIALS_RE = re.compile(r"(^|\bv\.?\s+|\band\s+)([A-Z]\.\s?){2,4}(?=\s|,|$)")
_FIRSTNAME_INITIAL_RE = re.compile(r"(^|\bv\.?\s+)[A-Z][a-z]+ [A-Z]\.(?=\s+v\.?\s|,|$)")
# Nature-of-suit codes (AO JS-44) skipped: 861-865 Social Security; 463 habeas by detained noncitizens
# (asylum seekers among them).
SKIP_NOS_PREFIX = ("861", "862", "863", "864", "865", "463")
SKIP_CAUSE = re.compile(r"^8:1105|aliens?:", re.I)
# Docket case-type letters kept: civil (cv) and criminal (cr). Magistrate-judge (mj), petty-offense (po),
# search-warrant (sw), grand-jury (gj) and miscellaneous (mc) dockets are skipped.
DOCKET_TYPE_RE = re.compile(r"(?:^|[^a-z])(cv|cr|mj|po|sw|gj|mc|bk|ap|md|ml|dp|cb|pt|tp|vb|sc)(?=[^a-z]|\d|$)", re.I)
KEEP_TYPES = {"cv", "cr"}


def docket_type(docket_number: str | None) -> str | None:
    if not docket_number:
        return None
    m = DOCKET_TYPE_RE.search(docket_number.lower())
    if m:
        return m.group(1).lower()
    low = docket_number.lower()
    if re.search(r"\bcriminal\b", low):
        return "cr"
    if re.search(r"\bcivil\b", low):
        return "cv"
    return None


def reject_reason(case_name: str | None, docket_number: str | None = None, nature_of_suit: str | None = None,
                  cause: str | None = None, require_type: bool = True) -> str | None:
    """Return why an item must not be shown, or None if it may be shown."""
    name = (case_name or "").strip()
    if not name or name.lower() in {"unknown case title", "unavailable", "untitled"}:
        return "no caption"
    if _SENS_RE.search(name):
        return "caption suggests a sealed matter, minor, pseudonymous party or investigative application"
    if _SSA_RE.search(name):
        return "Social Security benefits appeal"
    if _INITIALS_RE.search(name) or _FIRSTNAME_INITIAL_RE.search(name):
        return "party identified by initials"
    nos = (nature_of_suit or "").strip()
    if nos.startswith(SKIP_NOS_PREFIX):
        return f"nature of suit {nos[:3]} skipped"
    if cause and SKIP_CAUSE.search(cause.strip()):
        return "cause skipped (immigration detention)"
    if require_type:
        t = docket_type(docket_number)
        if t not in KEEP_TYPES:
            return f"docket case type {t!r} not civil/criminal"
    return None


_YY_RE = re.compile(r"\d:(\d{2})-?(?:cv|cr)\b", re.I)


def date_problem(date_filed: str | None, docket_number: str | None, retrieved_on: str) -> str | None:
    """Reject items whose CourtListener dates are evidently wrong (source data errors).

    * a filing date after the retrieval date;
    * a RECAP docket number whose two-digit year ("1:83-cv-00594") disagrees with the filing year.
    """
    if not date_filed:
        return "no filing date"
    if date_filed[:10] > retrieved_on[:10]:
        return "filing date after retrieval date (source data error)"
    m = _YY_RE.search(docket_number or "")
    if m and m.group(1) != date_filed[2:4]:
        return "docket-number year disagrees with filing date (source data error)"
    return None


def defendant(case_name: str | None) -> str | None:
    """Normalised text after the last ' v. ' in a caption ('Kholiqov v. Swearingen' -> 'swearingen')."""
    parts = re.split(r"\s+v\.?\s+", case_name or "", flags=re.I)
    if len(parts) < 2:
        return None
    d = re.sub(r"[^a-z0-9 ]+", " ", parts[-1].lower())
    d = re.sub(r"\s+", " ", d).strip()
    return d or None


def detention_defendants(results: list[dict]) -> set[str]:
    """Defendants named in immigration-detention habeas petitions (NOS 463 / cause 8:1105) in the results.

    New RECAP dockets often have no nature of suit yet; a civil docket with no nature of suit whose defendant
    also appears in such a petition is skipped as probably the same kind of petition.
    """
    out = set()
    for x in results:
        nos = (x.get("suitNature") or "").strip()
        if nos.startswith("463") or SKIP_CAUSE.search((x.get("cause") or "").strip()):
            d = defendant(x.get("caseName"))
            if d:
                out.add(d)
    return out
