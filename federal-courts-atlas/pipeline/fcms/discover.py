"""Find the September district-court profile PDF for every year on uscourts.gov.

The FCMS index page lists every period ("2025 : December | September | June | March ...").
Each "September" link leads to a period page whose download list contains the district
"profiles" PDF (file names vary: fcms_na_distprofile0930.2024.pdf, district-fcms-profiles-
september-2013.pdf, District_FCMS_Sep_2009.pdf, fcms_na_disprofile0930.2023.pdf, ...).
Everything goes through pipeline.common.http.fetch (cached).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urljoin

from bs4 import BeautifulSoup, NavigableString

from pipeline.common.http import FetchError, fetch

BASE = "https://www.uscourts.gov"
INDEX_URL = BASE + "/data-news/reports/statistical-reports/federal-court-management-statistics"
# Canonical period-page patterns, used when an index link is a /node/ alias that redirects to http://
PERIOD_URL_PATTERNS = [
    INDEX_URL + "/federal-court-management-statistics-september-{year}",
    INDEX_URL + "/federal-court-management-statistics-{year}",
]
_PROFILE_RE = re.compile(r"dist(?:rict)?[_-]?(?:fcms[_-])?profiles?|dis(?:t)?profile|District_FCMS_Sep", re.I)
# Explanation documents used for definitions / the FY2011 nature-of-suit legend.
EXPLANATION_2011_URL = BASE + "/file/document/explanation-judicial-caseload-profiles-district-2011"
EXPLANATION_CURRENT_URL = BASE + "/sites/default/files/2024-12/explanation_of_judicial_caseload_profiles_district.xlsx"
SELECTED_TERMS_2016_URL = BASE + "/file/24306/download"


@dataclass
class Period:
    year: int
    page_url: str
    pdf_url: str
    page_title: str


def september_links() -> dict[int, str]:
    """Map year -> September period-page URL, read from the FCMS index page."""
    soup = BeautifulSoup(fetch(INDEX_URL).text, "lxml")
    main = soup.find("main") or soup
    out: dict[int, str] = {}
    year = None
    for node in main.descendants:
        if isinstance(node, NavigableString):
            if node.find_parent("a") is not None:
                continue
            m = re.findall(r"\b(19\d\d|20\d\d)\b", str(node))
            if m:
                year = int(m[-1])
        elif node.name == "a" and node.get_text(strip=True) == "September" and year:
            out.setdefault(year, urljoin(BASE, node["href"]))
    return out


def _fetch_period_page(year: int, url: str):
    tried = [url] + [p.format(year=year) for p in PERIOD_URL_PATTERNS]
    for u in tried:
        try:
            r = fetch(u)
        except FetchError:
            continue
        soup = BeautifulSoup(r.text, "lxml")
        h1 = soup.find("h1")
        title = h1.get_text(" ", strip=True) if h1 else ""
        if str(year) in title and ("September" in title or re.search(rf"Statistics,\s*{year}$", title)):
            return r, soup, title
    raise FetchError(f"no September {year} period page reachable (tried {tried})")


def discover() -> list[Period]:
    periods = []
    for year, url in sorted(september_links().items()):
        r, soup, title = _fetch_period_page(year, url)
        main = soup.find("main") or soup
        cands = []
        for a in main.find_all("a", href=True):
            href = urljoin(r.meta["final_url"], a["href"])
            if href.lower().endswith(".pdf") and _PROFILE_RE.search(href.rsplit("/", 1)[-1]) \
                    and "comparison" not in href.lower() and "app" not in href.rsplit("/", 1)[-1].lower():
                cands.append(href)
        cands = list(dict.fromkeys(cands))
        if len(cands) != 1:
            raise RuntimeError(f"September {year}: expected one district profile PDF, found {cands}")
        periods.append(Period(year, r.meta["final_url"], cands[0], title))
    return periods
