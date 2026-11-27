"""Every Census file the population lane reads: URL, dataset title, vintage. All on www2.census.gov.

api.census.gov now answers "Missing Key" without an API key (keys need an account), so the lane uses
only downloadable files.
"""
from __future__ import annotations

import time

from pipeline.common.districts import STATES
from pipeline.common.http import CachedResponse, fetch

POPEST = "https://www2.census.gov/programs-surveys/popest/datasets/"
LAYOUT = "https://www2.census.gov/programs-surveys/popest/technical-documentation/file-layouts/"
DEC = "https://www2.census.gov/programs-surveys/decennial/"
PUBLISHER = "U.S. Census Bureau"

# Population estimates (county + Puerto Rico municipio files and the published national / PR totals).
ESTIMATES = {
    "census_co_est2025_alldata": (
        POPEST + "2020-2025/counties/totals/co-est2025-alldata.csv",
        "Annual Resident Population Estimates for Counties and States: April 1, 2020 to July 1, 2025 "
        "(CO-EST2025-ALLDATA)", "Vintage 2025 (released March 2026)"),
    "census_nst_est2025_alldata": (
        POPEST + "2020-2025/state/totals/NST-EST2025-ALLDATA.csv",
        "Annual Resident Population Estimates for the United States, States, and Puerto Rico: April 1, 2020 "
        "to July 1, 2025 (NST-EST2025-ALLDATA)", "Vintage 2025"),
    "census_cc_est2025_agesex_72": (
        POPEST + "2020-2025/counties/asrh/cc-est2025-agesex-72.csv",
        "Annual County and Puerto Rico Municipio Resident Population Estimates by Selected Age Groups and "
        "Sex: April 1, 2020 to July 1, 2025 (CC-EST2025-AGESEX-72, Puerto Rico)", "Vintage 2025"),
    "census_cc_est2020int_agesex_all": (
        POPEST + "2010-2020/intercensal/county/asrh/cc-est2020int-agesex-all.csv",
        "Annual Intercensal County Resident Population Estimates by Selected Age Groups and Sex: April 1, "
        "2010 to April 1, 2020 (CC-EST2020INT-AGESEX)", "2010-2020 intercensal series"),
    "census_cc_est2020int_agesex_72": (
        POPEST + "2010-2020/intercensal/county/asrh/cc-est2020int-agesex-72.csv",
        "Annual Intercensal Puerto Rico Municipio Resident Population Estimates by Selected Age Groups and "
        "Sex: April 1, 2010 to April 1, 2020 (CC-EST2020INT-AGESEX-72)", "2010-2020 intercensal series"),
    "census_nc_est2020int_agesex_res": (
        POPEST + "2010-2020/intercensal/national/asrh/nc-est2020int-agesex-res.csv",
        "Intercensal Estimates of the Resident Population by Single Year of Age and Sex for the United "
        "States: April 1, 2010 to April 1, 2020 (NC-EST2020INT-AGESEX-RES)", "2010-2020 intercensal series"),
    "census_co_est00int_tot": (
        POPEST + "2000-2010/intercensal/county/co-est00int-tot.csv",
        "Intercensal Estimates of the Resident Population for Counties and States: April 1, 2000 to July 1, "
        "2010 (CO-EST00INT-TOT)", "2000-2010 intercensal series"),
    "census_prm_est00int_agesex_5yr": (
        POPEST + "2000-2010/intercensal/puerto-rico/prm-est00int-agesex-5yr.csv",
        "Intercensal Estimates of the Resident Population by Five-Year Age Groups and Sex for Municipios of "
        "Puerto Rico: April 1, 2000 to July 1, 2010 (PRM-EST00INT-AGESEX-5YR)", "2000-2010 intercensal series"),
    "census_prc_est00int_agesex": (
        POPEST + "2000-2010/intercensal/puerto-rico/prc-est00int-agesex.csv",
        "Intercensal Estimates of the Resident Population by Single Year of Age and Sex for Puerto Rico: "
        "April 1, 2000 to July 1, 2010 (PRC-EST00INT-AGESEX)", "2000-2010 intercensal series"),
    "census_st_est00int_alldata": (
        POPEST + "2000-2010/intercensal/state/st-est00int-alldata.csv",
        "Intercensal Estimates of the Resident Population by Sex, Race, and Hispanic Origin for the United "
        "States and States: April 1, 2000 to July 1, 2010 (ST-EST00INT-ALLDATA)", "2000-2010 intercensal series"),
}

# File layouts that define the columns / YEAR codes used above.
LAYOUTS = {
    "census_layout_co_est2025_alldata": (LAYOUT + "2020-2025/CO-EST2025-ALLDATA.pdf", "File layout: CO-EST2025-ALLDATA"),
    "census_layout_nst_est2025_alldata": (LAYOUT + "2020-2025/NST-EST2025-ALLDATA.pdf", "File layout: NST-EST2025-ALLDATA"),
    "census_layout_cc_est2025_agesex": (LAYOUT + "2020-2025/CC-EST2025-AGESEX.pdf", "File layout: CC-EST2025-AGESEX (YEAR codes)"),
    "census_layout_cc_est2020int_agesex": (LAYOUT + "2010-2020/intercensal/county/CC-EST2020INT-AGESEX.pdf",
                                           "File layout: CC-EST2020INT-AGESEX (YEAR codes)"),
    "census_layout_nc_est2020int_agesex_res": (LAYOUT + "2010-2020/intercensal/national/NC-EST2020INT-AGESEX-RES.pdf",
                                               "File layout: NC-EST2020INT-AGESEX-RES"),
    "census_layout_co_est00int_tot": (LAYOUT + "2000-2010/intercensal/county/co-est00int-tot.pdf", "File layout: CO-EST00INT-TOT"),
    "census_layout_prm_est00int_agesex_5yr": (LAYOUT + "2000-2010/intercensal/puerto-rico/prm-est00int-agesex-5yr.pdf",
                                              "File layout: PRM-EST00INT-AGESEX-5YR"),
    "census_layout_prc_est00int_agesex": (LAYOUT + "2000-2010/intercensal/puerto-rico/prc-est00int-agesex.pdf",
                                          "File layout: PRC-EST00INT-AGESEX"),
    "census_layout_st_est00int_alldata": (LAYOUT + "2000-2010/intercensal/state/st-est00int-alldata.pdf",
                                          "File layout: ST-EST00INT-ALLDATA"),
    "census2000_profile_td": (DEC + "2000/technical-documentation/complete-tech-docs/profile-td.pdf",
                              "Census 2000 Demographic Profiles: Technical Documentation (record layout)"),
    "census2010_dpsf_td": (DEC + "2010/technical-documentation/complete-tech-docs/summary-file/dpsf.pdf",
                           "2010 Census Demographic Profile Summary File: Technical Documentation"),
    "census2020_pl_td": (DEC + "2020/technical-documentation/complete-tech-docs/summary-file/"
                         "2020Census_PL94_171Redistricting_StatesTechDoc_English.pdf",
                         "2020 Census State Redistricting Data (P.L. 94-171) Summary File: Technical Documentation"),
}

# Decennial census counts.
C2000_ALL = "https://www2.census.gov/census_2000/datasets/demographic_profile/0_All_State/2khxx.zip"
C2000_PR = "https://www2.census.gov/census_2000/datasets/demographic_profile/Puerto_Rico/2kh72.zip"
C2010_DP = "https://www2.census.gov/census_2010/03-Demographic_Profile/{dir}/{st}2010.dp.zip"
# Same 2010 Demographic Profile tables, published with the full SF1 set of geographies. Used only if the CDN
# rejects the plain file (it did for Ohio on every attempt on 2026-11-27).
C2010_DP_SF1GEOS = "https://www2.census.gov/census_2010/03-Demographic_Profile_with_SF1geos/{dir}/{st}20101.dp.zip"
C2010_DP_US = "https://www2.census.gov/census_2010/03-Demographic_Profile/National/us2010.dp.zip"
C2020_PL = DEC + "2020/data/01-Redistricting_File--PL_94-171/{dir}/{st}2020.pl.zip"
C2020_PL_US = DEC + "2020/data/01-Redistricting_File--PL_94-171/National/us2020.npl.zip"
IA2020 = DEC + "2020/data/island-areas/{dir}/population-and-housing-unit-counts/{stem}-phc-table01.csv"
IA2020_FILES = {  # territory postal -> (dir, stem)
    "GU": ("guam", "guam"),
    "VI": ("us-virgin-islands", "us-virgin-islands"),
    "MP": ("commonwealth-of-the-northern-mariana-islands", "commonwealth-northern-mariana-islands"),
}
IA2010 = DEC + "tables/2010/island-areas/{fn}"
IA2010_FILES = {"GU": "cb11cn179-guam.xls", "MP": "cb11cn178-cnmi.xls", "VI": "cb11cn180-vi.xls"}

STATE_POSTALS = [s for s in sorted(STATES) if s not in ("GU", "MP", "VI")]  # 50 states + DC + PR


def state_dir(postal: str) -> str:
    return STATES[postal][0].replace(" ", "_")


class RejectedError(RuntimeError):
    pass


def get(url: str) -> CachedResponse:
    """fetch() plus a guard: the Census CDN sometimes answers a block page ("Request Rejected") with
    HTTP 200. Such a body is removed from the cache and refetched once; a second rejection raises."""
    for attempt in range(2):
        r = fetch(url)
        head = r.path.open("rb").read(2048)
        if b"Request Rejected" in head and b"<html" in head.lower():
            meta = r.path.with_name(r.path.name.rsplit(".", 1)[0] + ".meta.json")
            r.path.unlink(missing_ok=True)
            meta.unlink(missing_ok=True)
            if attempt == 0:
                time.sleep(15)
                continue
            raise RejectedError(f"Census CDN rejected {url}")
        return r
    raise RejectedError(url)
