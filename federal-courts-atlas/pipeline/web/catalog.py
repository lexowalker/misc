"""The curated catalog of map variables (public/data/variables.json).

Each entry names exactly where its numbers come from (lane, processed table, lane variable) and carries the
plain-English copy shown in the atlas. Nothing here is a statistic: years, coverage and values are read from
data/processed/* at build time.

Copy rules (client brief): plain English, short sentences, no em-dashes, patterns not motives.

Keys used only by the build (stripped before writing variables.json):
  input        where values come from: {"lane", "table", "variable"} or {"per100k": {...numerator...}}
  fact         template for the profile "distinctive" paragraph: {"text", "high", "low"}; None = never used
  base         column holding the denominator / N behind a share or median (for small-base notes)
"""
from __future__ import annotations

FAMILY_ORDER = ["speed", "workload", "sentencing", "casemix"]

# ---- shared caveats -------------------------------------------------------------------------------------
RANK = ("Ranks are derived by the atlas: 1 is the highest value among the districts with data that year, "
        "and tied districts share a rank.")
FCMS_PRINTED = ("Values are exactly as printed in the AO's September district profiles. FY 1999 to 2003 come "
                "from the back columns of the FY 2004 profile, because the older files online are scanned images.")
FCMS_CURRENT = ("Since March 2012 the AO counts criminal defendants rather than cases. This series uses the current "
                "method for every year from FY 2005, read from the earliest profile that prints each year that way. "
                "Earlier years are left out rather than mixed with the old method.")
FCMS_WEIGHTS = ("Case weights were revised for use after December 2015, and the AO reprinted FY 2010 to 2014 with the "
                "new weights. This series uses the revised weights for every year shown, so it starts in FY 2010.")
FCMS_TERRITORIES_WEIGHTED = "The AO prints no weighted filings for the three territorial courts (Guam, Northern Mariana Islands, Virgin Islands)."
USSC_BASE = ("Territorial courts and some small districts sentence few people a year, so their shares can swing "
             "widely. Cells based on fewer than 30 people carry a note.")
USSC_FY = "USSC fiscal years run October 1 to September 30."
USSC_BOOKER = ("Before United States v. Booker (January 2005) the guidelines were mandatory, and \"within range\" "
               "means no departure was granted. FY 2004 and FY 2005 are pooled by the USSC lane from the two "
               "half-year tables the USSC printed, so those two years are marked derived.")
USSC_2018 = ("In FY 2018 the USSC changed how it classifies sentences (departures versus variances) and stopped "
             "printing this four-way grouping. The atlas rebuilds the same grouping from the published components "
             "for FY 2014 to 2025, so every year is marked derived. In FY 2014 to 2017, where both methods exist, "
             "the USSC lane found the shares identical for every district.")
USSC_OLD_SCHEME = ("This is the grouping the USSC printed for FY 2006 to 2017. For FY 2014 to 2025 see the "
                   "matching measure built on the USSC's FY 2018 method; the two agree exactly where they overlap.")
USSC_OFFENSE_2018 = ("In FY 2018 the USSC began classifying offenses by the main guideline applied instead of the "
                     "statute of conviction. The category name is unchanged, but values before and after FY 2018 "
                     "are not strictly comparable.")
USSC_PACKETS = ("FY 1995 to 2001 come from the USSC's published district packets; FY 2002 on are reproduced from "
                "the USSC's case-level datafiles and match the published tables.")
IDB_COMPUTED = "Computed by the atlas's IDB lane from the FJC's case-level records; the courts do not print this figure."
IDB_2026 = ("FY 2026 values come from FJC files posted in November 2026. The AO has not yet published its FY 2026 "
            "tables, so they have no published cross-check.")
IDB_BASE = "Small districts rest on small numbers of cases. Cells based on fewer than 30 cases carry a note."
PER_CAPITA = ("Population is the Census Bureau's July 1 estimate for the district's counties, matched to the fiscal "
              "year that contains that July 1. The three territorial courts have no annual estimates, so they show "
              "No data.")
SPLIT_COUNTIES = ("For Montana, Idaho, Wyoming and the Eastern and Middle Districts of North Carolina the population "
                  "is approximate: a few counties are split by statute (Yellowstone, Fort Bragg, Butner), and the "
                  "whole county is counted in one district.")
JUDGES_COUNT = ("Counted by the atlas's judges lane from the FJC Biographical Directory dates (judges in office on "
                "September 30). Judges assigned to two districts count in both. The three territorial courts are not "
                "in the directory of Article III judges, so they show No data.")

CATALOG: list[dict] = [
    # ------------------------------------------------------------------ SPEED
    {
        "id": "civil_disposition_months", "family": "speed",
        "label": "Median time to resolve a civil case", "short_label": "Civil case, median months",
        "unit": "months", "format": ".1f", "higher_means": "slower: civil cases take longer to resolve",
        "default_rank_direction": "asc",
        "explainer": ("How long the typical civil lawsuit takes, from the day it is filed to the day the court "
                      "disposes of it. Half of cases finish faster than this, half slower."),
        "caveats": [FCMS_PRINTED,
                    "The AO leaves out land condemnation, prisoner petitions, deportation reviews, recovery of overpayments and enforcement of judgments.",
                    "Large waves of related cases (for example, mass torts) can move a district's median sharply from one year to the next.",
                    RANK],
        "input": {"lane": "fcms", "table": "observations", "variable": "fcms_median_months_civil_filing_to_disposition"},
        "fact": {"text": "the median civil case took {value} from filing to disposition", "high": "longest", "low": "shortest"},
        "featured": True,
    },
    {
        "id": "criminal_disposition_months", "family": "speed",
        "label": "Median time to resolve a felony case", "short_label": "Felony case, median months",
        "unit": "months", "format": ".1f", "higher_means": "slower: felony cases take longer to resolve",
        "default_rank_direction": "asc",
        "explainer": ("How long the typical felony defendant's case takes to reach a disposition, such as a plea, "
                      "a verdict or a dismissal. Half of defendants' cases finish faster than this."),
        "caveats": [FCMS_CURRENT,
                    "On the current method the clock starts at the defendant's first proceeding, not the filing date.",
                    "The AO does not compute the median for fewer than 10 defendants.",
                    RANK],
        "input": {"lane": "fcms", "table": "observations_current_method", "variable": "fcms_median_months_criminal_felony_filing_to_disposition"},
        "fact": {"text": "the median felony defendant's case took {value} to reach disposition", "high": "longest", "low": "shortest"},
        "featured": True,
    },
    {
        "id": "civil_trial_months", "family": "speed",
        "label": "Median time from filing to civil trial", "short_label": "To civil trial, median months",
        "unit": "months", "format": ".1f", "higher_means": "slower: civil cases wait longer for trial",
        "default_rank_direction": "asc",
        "explainer": ("For the few civil cases that go to trial, how long they wait from filing until the trial "
                      "starts. Half wait less than this, half more."),
        "caveats": [FCMS_PRINTED,
                    "The AO does not compute this median when a district tried fewer than 10 civil cases, so many small districts show No data in some years. Guam and the Northern Mariana Islands never have a value.",
                    RANK],
        "input": {"lane": "fcms", "table": "observations", "variable": "fcms_median_months_civil_filing_to_trial"},
        "fact": {"text": "the median civil case that went to trial took {value} to get there", "high": "longest", "low": "shortest"},
        "featured": True,
    },
    {
        "id": "civil_over_3yrs_pct", "family": "speed",
        "label": "Civil cases pending more than three years", "short_label": "Civil cases over 3 years old",
        "unit": "percent", "format": ".1f", "higher_means": "more of the civil docket is old",
        "default_rank_direction": "asc",
        "explainer": ("The share of a court's pending civil cases that had been open for more than three years on "
                      "September 30. Congress asks courts to report these old cases."),
        "caveats": [FCMS_PRINTED,
                    "One multidistrict litigation (MDL) docket can hold thousands of old cases and dominate a district's share.",
                    RANK],
        "input": {"lane": "fcms", "table": "observations", "variable": "fcms_civil_over_3yrs_pct"},
        "fact": {"text": "{value} of pending civil cases had been open for more than three years", "high": "highest share", "low": "lowest share"},
        "featured": True,
    },
    # ------------------------------------------------------------------ WORKLOAD
    {
        "id": "weighted_filings_per_judgeship", "family": "workload",
        "label": "Weighted filings per judgeship", "short_label": "Weighted filings per judgeship",
        "unit": "per_judgeship", "format": ".0f", "higher_means": "heavier workload per judgeship",
        "default_rank_direction": "desc",
        "explainer": ("New cases per authorized judgeship, with each case weighted by how much judge time cases of "
                      "its type usually need. An average case counts about 1. This is the courts' main workload yardstick."),
        "caveats": [FCMS_WEIGHTS, FCMS_TERRITORIES_WEIGHTED,
                    "Judgeships are authorized positions, not judges in office. Senior judges also hear cases.",
                    RANK],
        "input": {"lane": "fcms", "table": "observations_current_method", "variable": "fcms_weighted_filings_per_judgeship"},
        "fact": {"text": "the court had {number} weighted filings per judgeship", "high": "most", "low": "fewest"},
        "featured": True,
    },
    {
        "id": "filings_per_judgeship", "family": "workload",
        "label": "Total filings per judgeship", "short_label": "Filings per judgeship",
        "unit": "per_judgeship", "format": ".0f", "higher_means": "more new cases per judgeship",
        "default_rank_direction": "desc",
        "explainer": ("All new civil cases, felony cases and supervised release hearings in the year, divided by the "
                      "number of authorized judgeships."),
        "caveats": [FCMS_CURRENT, "Judgeships are authorized positions, not judges in office.", RANK],
        "input": {"lane": "fcms", "table": "observations_current_method", "variable": "fcms_filings_per_judgeship_total"},
        "fact": {"text": "the court had {number} new filings per judgeship", "high": "most", "low": "fewest"},
    },
    {
        "id": "civil_filings_per_judgeship", "family": "workload",
        "label": "Civil filings per judgeship", "short_label": "Civil filings per judgeship",
        "unit": "per_judgeship", "format": ".0f", "higher_means": "more new civil cases per judgeship",
        "default_rank_direction": "desc",
        "explainer": "New civil cases filed in the year, divided by the number of authorized judgeships.",
        "caveats": [FCMS_PRINTED, "Judgeships are authorized positions, not judges in office.", RANK],
        "input": {"lane": "fcms", "table": "observations", "variable": "fcms_filings_per_judgeship_civil"},
        "fact": None,
    },
    {
        "id": "pending_per_judgeship", "family": "workload",
        "label": "Pending cases per judgeship", "short_label": "Pending per judgeship",
        "unit": "per_judgeship", "format": ".0f", "higher_means": "a larger backlog per judgeship",
        "default_rank_direction": "desc",
        "explainer": "Civil and felony cases still open on September 30, divided by the number of authorized judgeships.",
        "caveats": [FCMS_CURRENT, "One large multidistrict litigation (MDL) docket can dominate this measure.", RANK],
        "input": {"lane": "fcms", "table": "observations_current_method", "variable": "fcms_pending_per_judgeship"},
        "fact": {"text": "the court had {number} pending cases per judgeship", "high": "most", "low": "fewest"},
        "featured": True,
    },
    {
        "id": "terminations_per_judgeship", "family": "workload",
        "label": "Cases closed per judgeship", "short_label": "Closed per judgeship",
        "unit": "per_judgeship", "format": ".0f", "higher_means": "more cases closed per judgeship",
        "default_rank_direction": "desc",
        "explainer": "Civil and felony cases closed during the year, divided by the number of authorized judgeships.",
        "caveats": [FCMS_CURRENT, RANK],
        "input": {"lane": "fcms", "table": "observations_current_method", "variable": "fcms_terminations_per_judgeship"},
        "fact": {"text": "the court closed {number} cases per judgeship", "high": "most", "low": "fewest"},
    },
    {
        "id": "trials_per_judgeship", "family": "workload",
        "label": "Trials completed per judgeship", "short_label": "Trials per judgeship",
        "unit": "per_judgeship", "format": ".0f", "higher_means": "more trials per judgeship",
        "default_rank_direction": "desc",
        "explainer": ("Civil and criminal trials completed by district judges in the year, divided by the number of "
                      "authorized judgeships. The AO counts hearings on emergency orders and preliminary injunctions as trials."),
        "caveats": [FCMS_PRINTED, RANK],
        "input": {"lane": "fcms", "table": "observations", "variable": "fcms_trials_completed_per_judgeship"},
        "fact": {"text": "the court completed {number} trials per judgeship", "high": "most", "low": "fewest"},
    },
    {
        "id": "vacant_judgeship_months", "family": "workload",
        "label": "Vacant judgeship months", "short_label": "Vacant judgeship months",
        "unit": "months", "format": ".1f", "higher_means": "judgeships stood empty longer",
        "default_rank_direction": "desc",
        "explainer": ("The total number of months during the year that the court's authorized judgeships sat "
                      "empty. Two seats vacant for six months each count as 12 months."),
        "caveats": [FCMS_PRINTED, "Many districts have no vacancy in a given year, so ties at zero are common.", RANK],
        "input": {"lane": "fcms", "table": "observations", "variable": "fcms_vacant_judgeship_months"},
        "fact": {"text": "judgeships stood vacant for a combined {value}", "high": "most", "low": "fewest"},
    },
    {
        "id": "judgeships", "family": "workload",
        "label": "Authorized judgeships", "short_label": "Judgeships",
        "unit": "judgeships", "format": ".0f", "higher_means": "a larger court",
        "default_rank_direction": "desc",
        "explainer": ("The number of district judge positions Congress has authorized for the court. It measures the "
                      "size of the court, not how many judges are serving."),
        "caveats": [FCMS_PRINTED, "Includes the four judgeships of the territorial courts.", RANK],
        "input": {"lane": "fcms", "table": "observations", "variable": "fcms_judgeships"},
        "fact": None,
    },
    {
        "id": "civil_filings_per_100k", "family": "workload",
        "label": "Civil filings per 100,000 residents", "short_label": "Civil filings per 100k",
        "unit": "per_100k", "format": ".1f", "higher_means": "more civil cases relative to population",
        "default_rank_direction": "desc",
        "explainer": ("New federal civil cases in the year for every 100,000 people living in the district. It "
                      "puts big and small districts on the same scale."),
        "caveats": ["Derived by the atlas from two published series: AO civil filings and Census population.",
                    PER_CAPITA, SPLIT_COUNTIES,
                    "Many civil cases are filed where a company or agency is based, or are transferred in, so filings do not only reflect local residents.",
                    RANK],
        "input": {"per100k": {"lane": "fcms", "table": "observations", "variable": "fcms_filings_civil"}},
        "derived": True,
        "formula": "FCMS civil filings (FY) ÷ Census July 1 population estimate (same year) × 100,000, rounded to 1 decimal",
        "fact": {"text": "there were {number} new civil cases for every 100,000 residents", "high": "most", "low": "fewest"},
        "featured": True,
    },
    {
        "id": "felony_defendants_per_100k", "family": "workload",
        "label": "Felony defendants charged per 100,000 residents", "short_label": "Felony defendants per 100k",
        "unit": "per_100k", "format": ".1f", "higher_means": "more felony prosecutions relative to population",
        "default_rank_direction": "desc",
        "explainer": ("New felony defendants charged in the year for every 100,000 people living in the district. "
                      "Border districts and districts with major ports of entry often rank high."),
        "caveats": ["Derived by the atlas from two series: FJC felony defendants filed and Census population.",
                    ("The numerator is the FJC Integrated Database count of felony defendants, which matches the AO's "
                     "own felony filings exactly in every year the AO counts defendants. It is used because the AO's "
                     "printed series switches between cases and defendants before FY 2012."),
                    PER_CAPITA, SPLIT_COUNTIES, RANK],
        "input": {"per100k": {"lane": "idb", "table": "observations", "variable": "idb_crim_felony_defendants_filed"}},
        "derived": True,
        "formula": "FJC IDB felony defendants filed (FY) ÷ Census July 1 population estimate (same year) × 100,000, rounded to 1 decimal",
        "fact": {"text": "{number} felony defendants were charged for every 100,000 residents", "high": "most", "low": "fewest"},
        "featured": True,
    },
    {
        "id": "active_judges", "family": "workload",
        "label": "Active judges in office", "short_label": "Active judges",
        "unit": "judges", "format": ".0f", "higher_means": "more active judges serving",
        "default_rank_direction": "desc",
        "explainer": ("Article III district judges in active service on September 30, not counting senior judges. "
                      "Compare it with authorized judgeships to see vacancies."),
        "caveats": [JUDGES_COUNT, RANK],
        "input": {"lane": "judges", "table": "observations", "variable": "judges_active"},
        "derived": True,
        "formula": "Count of distinct judges whose service started on or before September 30 and whose active service (before senior status or departure) had not ended",
        "fact": None,
    },
    {
        "id": "senior_judges", "family": "workload",
        "label": "Senior judges in office", "short_label": "Senior judges",
        "unit": "judges", "format": ".0f", "higher_means": "more senior judges serving",
        "default_rank_direction": "desc",
        "explainer": ("Judges who have taken senior status, a form of semi-retirement in which they keep hearing "
                      "cases, often with a lighter load, and their seat becomes vacant."),
        "caveats": [JUDGES_COUNT, RANK],
        "input": {"lane": "judges", "table": "observations", "variable": "judges_senior"},
        "derived": True,
        "formula": "Count of distinct judges in service on September 30 whose senior status date was on or before that day",
        "fact": None,
    },
    # ------------------------------------------------------------------ SENTENCING
    {
        "id": "within_range_pct", "family": "sentencing",
        "label": "Sentenced within the guideline range", "short_label": "Within range",
        "unit": "percent", "format": ".1f", "higher_means": "more sentences inside the guideline range",
        "default_rank_direction": "desc",
        "explainer": ("The share of people sentenced whose prison term fell inside the range the federal sentencing "
                      "guidelines recommend for their offense and criminal history."),
        "caveats": [USSC_BOOKER, USSC_PACKETS, USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_within_range"},
        "base": "n_basis",
        "breaks": [{"year": 2005, "note": "Booker made the guidelines advisory (January 12, 2005)."}],
        "fact": {"text": "{value} of sentences fell within the guideline range", "high": "highest share", "low": "lowest share"},
        "featured": True,
    },
    {
        "id": "above_range_pct", "family": "sentencing",
        "label": "Sentenced above the guideline range", "short_label": "Above range",
        "unit": "percent", "format": ".1f", "higher_means": "more sentences above the guideline range",
        "default_rank_direction": "desc",
        "explainer": "The share of people sentenced whose sentence was longer than the guideline range recommends.",
        "caveats": [USSC_2018, USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_above_range_2018scheme"},
        "base": "n_basis",
        "formula": "100 × (upward departures + upward variances) ÷ people whose sentence could be compared with the guideline range, in the USSC's FY 2018 categories",
        "fact": {"text": "{value} of sentences were above the guideline range", "high": "highest share", "low": "lowest share"},
    },
    {
        "id": "govt_below_range_pct", "family": "sentencing",
        "label": "Below range, sponsored by the government", "short_label": "Below range (government)",
        "unit": "percent", "format": ".1f", "higher_means": "more below-range sentences the government asked for",
        "default_rank_direction": "desc",
        "explainer": ("The share of people sentenced below the guideline range on a government motion, for example "
                      "for helping investigators or through a fast-track program."),
        "caveats": [USSC_2018, USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_govt_sponsored_below_range_2018scheme"},
        "base": "n_basis",
        "formula": "100 × (§5K1.1 + §5K3.1 + other government-motion departures + government-motion downward variances) ÷ people whose sentence could be compared with the guideline range",
        "fact": {"text": "{value} of sentences were below the guideline range at the government's request", "high": "highest share", "low": "lowest share"},
        "featured": True,
    },
    {
        "id": "nongovt_below_range_pct", "family": "sentencing",
        "label": "Below range, not sponsored by the government", "short_label": "Below range (other)",
        "unit": "percent", "format": ".1f", "higher_means": "more below-range sentences the government did not ask for",
        "default_rank_direction": "desc",
        "explainer": ("The share of people sentenced below the guideline range without a government motion, usually "
                      "after a request by the defense."),
        "caveats": [USSC_2018, USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_non_govt_sponsored_below_range_2018scheme"},
        "base": "n_basis",
        "formula": "100 × (non-government downward departures + non-government downward variances) ÷ people whose sentence could be compared with the guideline range",
        "fact": {"text": "{value} of sentences were below the guideline range without a government request", "high": "highest share", "low": "lowest share"},
        "featured": True,
    },
    {
        "id": "above_range_pct_2006", "family": "sentencing",
        "label": "Above range (FY 2006 to 2017 method)", "short_label": "Above range, 2006 to 2017",
        "unit": "percent", "format": ".1f", "higher_means": "more sentences above the guideline range",
        "default_rank_direction": "desc",
        "explainer": "The share of people sentenced above the guideline range, as the USSC grouped sentences after Booker.",
        "caveats": [USSC_OLD_SCHEME, USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_above_range"},
        "base": "n_basis",
        "fact": None,
    },
    {
        "id": "govt_below_range_pct_2006", "family": "sentencing",
        "label": "Below range, government (FY 2006 to 2017 method)", "short_label": "Below range (government), 2006 to 2017",
        "unit": "percent", "format": ".1f", "higher_means": "more below-range sentences the government asked for",
        "default_rank_direction": "desc",
        "explainer": "The share of people sentenced below the guideline range on a government motion, as the USSC grouped sentences after Booker.",
        "caveats": [USSC_OLD_SCHEME, USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_govt_sponsored_below_range"},
        "base": "n_basis",
        "fact": None,
    },
    {
        "id": "nongovt_below_range_pct_2006", "family": "sentencing",
        "label": "Below range, other (FY 2006 to 2017 method)", "short_label": "Below range (other), 2006 to 2017",
        "unit": "percent", "format": ".1f", "higher_means": "more below-range sentences the government did not ask for",
        "default_rank_direction": "desc",
        "explainer": "The share of people sentenced below the guideline range without a government motion, as the USSC grouped sentences after Booker.",
        "caveats": [USSC_OLD_SCHEME, USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_non_govt_sponsored_below_range"},
        "base": "n_basis",
        "fact": None,
    },
    {
        "id": "substantial_assistance_pct", "family": "sentencing",
        "label": "Substantial-assistance departures (§5K1.1)", "short_label": "§5K1.1 departures",
        "unit": "percent", "format": ".1f", "higher_means": "more sentences reduced for cooperation",
        "default_rank_direction": "desc",
        "explainer": ("The share of people sentenced below the range because the government told the court they "
                      "gave substantial help in investigating or prosecuting someone else."),
        "caveats": [USSC_PACKETS, "FY 2004 and FY 2005 are pooled from two half-year tables and marked derived.", USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_substantial_assistance_5k1"},
        "base": "n_basis",
        "fact": {"text": "{value} of sentences included a substantial-assistance departure", "high": "highest share", "low": "lowest share"},
    },
    {
        "id": "early_disposition_pct", "family": "sentencing",
        "label": "Early-disposition (fast-track) departures (§5K3.1)", "short_label": "§5K3.1 fast-track",
        "unit": "percent", "format": ".1f", "higher_means": "more fast-track sentence reductions",
        "default_rank_direction": "desc",
        "explainer": ("The share of people sentenced below the range under an early-disposition program, in which "
                      "a defendant pleads guilty quickly in exchange for a shorter sentence."),
        "caveats": ["The USSC prints this category separately only from FY 2006; earlier years fold it into other government departures.",
                    USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_early_disposition_5k3"},
        "base": "n_basis",
        "fact": {"text": "{value} of sentences included a fast-track departure", "high": "highest share", "low": "lowest share"},
    },
    {
        "id": "mean_sentence_months", "family": "sentencing",
        "label": "Average sentence", "short_label": "Average sentence",
        "unit": "months", "format": ".1f", "higher_means": "longer sentences on average",
        "default_rank_direction": "desc",
        "explainer": ("The average sentence in months, counting prison plus any alternative confinement. Probation "
                      "and fine-only sentences count as zero months."),
        "caveats": ["Follows the USSC's FY 2018 convention for every year. FY 2002 to 2017 are computed by the USSC lane with that rule, so they are marked derived; FY 2018 on reproduce the published figures.",
                    "Terms of 470 months or more, including life, count as 470 months, as the USSC does.",
                    "From FY 2011 the USSC prints whole months.", USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_mean_sentence_months"},
        "base": "n_basis",
        "fact": {"text": "the average sentence was {value}", "high": "longest", "low": "shortest"},
        "featured": True,
    },
    {
        "id": "median_sentence_months", "family": "sentencing",
        "label": "Median sentence", "short_label": "Median sentence",
        "unit": "months", "format": ".1f", "higher_means": "longer sentences for the typical person",
        "default_rank_direction": "desc",
        "explainer": ("The middle sentence in months: half of people sentenced got less, half got more. Probation "
                      "and fine-only sentences count as zero months."),
        "caveats": ["Follows the USSC's FY 2018 convention for every year. FY 2002 to 2017 are computed by the USSC lane with that rule, so they are marked derived.",
                    "From FY 2011 the USSC prints whole months.", USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_median_sentence_months"},
        "base": "n_basis",
        "fact": {"text": "the median sentence was {value}", "high": "longest", "low": "shortest"},
    },
    {
        "id": "prison_pct", "family": "sentencing",
        "label": "Sentenced to prison", "short_label": "Prison sentences",
        "unit": "percent", "format": ".1f", "higher_means": "more people sentenced to prison",
        "default_rank_direction": "desc",
        "explainer": "The share of people sentenced who received a prison term, alone or combined with another sanction.",
        "caveats": ["Fine-only cases stay in the denominator in every year, as in the USSC's tables since FY 2018. Before FY 2018 the USSC left them out, so its printed rates run slightly higher; those years are computed by the USSC lane and marked derived.",
                    USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_prison"},
        "base": "n_basis",
        "fact": {"text": "{value} of people sentenced received a prison term", "high": "highest share", "low": "lowest share"},
    },
    # ------------------------------------------------------------------ CASE MIX
    {
        "id": "patent_filings", "family": "casemix",
        "label": "Patent cases filed", "short_label": "Patent filings",
        "unit": "cases", "format": ",.0f", "higher_means": "more patent suits filed",
        "default_rank_direction": "desc",
        "explainer": ("New patent infringement and validity suits (nature of suit 830) filed in the year. Patent "
                      "plaintiffs can choose among courts, so a few districts draw most of these cases."),
        "caveats": ["Hatch-Waxman drug patent cases moved to a new code (835) in June 2017 and are not counted here.",
                    IDB_COMPUTED, IDB_2026, RANK],
        "input": {"lane": "idb", "table": "observations", "variable": "idb_patent_filed"},
        "breaks": [{"year": 2017, "note": "TC Heartland (May 22, 2017) narrowed where patent suits can be filed. Drug patent (ANDA) cases moved to code 835 in June 2017."}],
        "fact": {"text": "{number} patent cases were filed", "high": "most", "low": None},
        "featured": True,
    },
    {
        "id": "patent_share_pct", "family": "casemix",
        "label": "Share of the nation's patent cases", "short_label": "Share of U.S. patent cases",
        "unit": "percent", "format": ".1f", "higher_means": "a larger share of the nation's patent suits",
        "default_rank_direction": "desc",
        "explainer": "The district's share of all patent cases (nature of suit 830) filed in federal district courts that year.",
        "caveats": ["Drug patent (ANDA) cases, code 835 since June 2017, are not counted.", IDB_COMPUTED, IDB_2026, RANK],
        "input": {"lane": "idb", "table": "observations", "variable": "idb_patent_share_of_national"},
        "derived": True,
        "formula": "100 × district patent filings (nature of suit 830) ÷ patent filings in all 94 districts, same fiscal year",
        "breaks": [{"year": 2017, "note": "TC Heartland (May 22, 2017) narrowed where patent suits can be filed."}],
        "fact": None,
    },
    {
        "id": "pro_se_pct", "family": "casemix",
        "label": "Civil cases with a self-represented party", "short_label": "Pro se civil cases",
        "unit": "percent", "format": ".1f", "higher_means": "more civil cases with a party who has no lawyer",
        "default_rank_direction": "desc",
        "explainer": ("The share of new civil cases in which at least one side, plaintiff or defendant, has no lawyer "
                      "and represents itself (\"pro se\")."),
        "caveats": ["The pro se code has no AO quality control and is blank before FY 1999.",
                    "Mass-tort waves can carry pro se codes in bulk: N.D. Fla. held hundreds of thousands of such cases in FY 2020 to 2024.",
                    IDB_COMPUTED, IDB_2026, IDB_BASE, RANK],
        "input": {"lane": "idb", "table": "observations", "variable": "idb_civil_pct_pro_se"},
        "derived": True,
        "formula": "100 × civil cases filed with a self-represented party on either side ÷ civil cases filed with a pro se code recorded",
        "base": "denominator",
        "fact": {"text": "{value} of new civil cases had a self-represented party", "high": "highest share", "low": "lowest share"},
    },
    {
        "id": "prisoner_petitions_pct", "family": "casemix",
        "label": "Prisoner petitions, share of civil cases", "short_label": "Prisoner petitions",
        "unit": "percent", "format": ".1f", "higher_means": "more of the civil docket is prisoner litigation",
        "default_rank_direction": "desc",
        "explainer": ("The share of new civil cases brought by prisoners: habeas corpus petitions, motions to vacate "
                      "a sentence, and suits over prison conditions or civil rights."),
        "caveats": ["Uses nature-of-suit codes 510 to 560. Habeas petitions by immigration detainees (code 463) are not included; they surged in FY 2026.",
                    IDB_COMPUTED, IDB_2026, IDB_BASE, RANK],
        "input": {"lane": "idb", "table": "observations", "variable": "idb_civil_pct_prisoner_petitions"},
        "derived": True,
        "formula": "100 × civil cases filed with nature of suit 510 to 560 ÷ all civil cases filed",
        "base": "denominator",
        "fact": {"text": "prisoner petitions made up {value} of new civil cases", "high": "highest share", "low": "lowest share"},
    },
    {
        "id": "civil_trial_rate_pct", "family": "casemix",
        "label": "Civil cases decided by trial", "short_label": "Civil trial rate",
        "unit": "percent", "format": ".1f", "higher_means": "more civil cases end in a trial verdict",
        "default_rank_direction": "desc",
        "explainer": ("The share of civil cases closed during the year that ended in a jury verdict, a directed "
                      "verdict or a judge's decision after trial. Most civil cases settle or are dismissed."),
        "caveats": ["In FY 2007 M.D. La. recorded thousands of related cases as jury verdicts, which lifts its rate that year.",
                    IDB_COMPUTED, IDB_2026, IDB_BASE, RANK],
        "input": {"lane": "idb", "table": "observations", "variable": "idb_civil_trial_rate"},
        "derived": True,
        "formula": "100 × civil cases closed by jury verdict, directed verdict or court trial ÷ all civil cases closed",
        "base": "denominator",
        "fact": {"text": "{value} of civil cases closed ended in a trial verdict", "high": "highest share", "low": "lowest share"},
    },
    {
        "id": "criminal_trial_rate_pct", "family": "casemix",
        "label": "Criminal defendants whose cases went to trial", "short_label": "Criminal trial rate",
        "unit": "percent", "format": ".1f", "higher_means": "more defendants go to trial",
        "default_rank_direction": "desc",
        "explainer": ("The share of criminal defendants whose cases closed during the year after a bench or jury "
                      "trial, whether they were convicted or acquitted."),
        "caveats": ["Counts the disposition of the most serious charge.", IDB_COMPUTED, IDB_2026, IDB_BASE, RANK],
        "input": {"lane": "idb", "table": "observations", "variable": "idb_crim_trial_rate"},
        "derived": True,
        "formula": "100 × defendants whose cases closed after a bench or jury trial ÷ all defendants whose cases closed",
        "base": "denominator",
        "fact": {"text": "{value} of criminal defendants whose cases closed went to trial", "high": "highest share", "low": "lowest share"},
        "featured": True,
    },
    {
        "id": "guilty_plea_pct", "family": "casemix",
        "label": "Criminal defendants who pleaded guilty", "short_label": "Guilty pleas",
        "unit": "percent", "format": ".1f", "higher_means": "more defendants plead guilty",
        "default_rank_direction": "desc",
        "explainer": ("The share of criminal defendants whose cases closed during the year with a guilty plea (or a "
                      "plea of no contest). The rest were dismissed or went to trial."),
        "caveats": ["Counts the disposition of the most serious charge.", IDB_COMPUTED, IDB_2026, IDB_BASE, RANK],
        "input": {"lane": "idb", "table": "observations", "variable": "idb_crim_pct_guilty_plea"},
        "derived": True,
        "formula": "100 × defendants whose cases closed with a guilty or no-contest plea ÷ all defendants whose cases closed",
        "base": "denominator",
        "fact": {"text": "{value} of criminal defendants whose cases closed pleaded guilty", "high": "highest share", "low": "lowest share"},
    },
    {
        "id": "crim_immigration_pct", "family": "casemix",
        "label": "Immigration charges, share of new defendants", "short_label": "Immigration defendants",
        "unit": "percent", "format": ".1f", "higher_means": "more of the criminal docket is immigration cases",
        "default_rank_direction": "desc",
        "explainer": ("The share of new criminal defendants whose most serious charge was an immigration offense, "
                      "such as illegal reentry after deportation."),
        "caveats": ["Offense categories follow the AO's top-level headings, mapped from FJC offense codes by the IDB lane; the mapping reproduces the AO's published immigration totals exactly.",
                    IDB_COMPUTED, IDB_2026, IDB_BASE, RANK],
        "input": {"lane": "idb", "table": "observations", "variable": "idb_crim_pct_immigration"},
        "derived": True,
        "formula": "100 × new defendants whose most serious charge is an immigration offense ÷ all new defendants",
        "base": "denominator",
        "fact": {"text": "immigration offenses were the most serious charge for {value} of new criminal defendants", "high": "highest share", "low": "lowest share"},
        "featured": True,
    },
    {
        "id": "crim_drugs_pct", "family": "casemix",
        "label": "Drug charges, share of new defendants", "short_label": "Drug defendants",
        "unit": "percent", "format": ".1f", "higher_means": "more of the criminal docket is drug cases",
        "default_rank_direction": "desc",
        "explainer": "The share of new criminal defendants whose most serious charge was a drug offense.",
        "caveats": ["Offense categories follow the AO's top-level headings, mapped from FJC offense codes by the IDB lane.",
                    IDB_COMPUTED, IDB_2026, IDB_BASE, RANK],
        "input": {"lane": "idb", "table": "observations", "variable": "idb_crim_pct_drugs"},
        "derived": True,
        "formula": "100 × new defendants whose most serious charge is a drug offense ÷ all new defendants",
        "base": "denominator",
        "fact": {"text": "drug offenses were the most serious charge for {value} of new criminal defendants", "high": "highest share", "low": "lowest share"},
    },
    {
        "id": "crim_firearms_pct", "family": "casemix",
        "label": "Firearms charges, share of new defendants", "short_label": "Firearms defendants",
        "unit": "percent", "format": ".1f", "higher_means": "more of the criminal docket is firearms cases",
        "default_rank_direction": "desc",
        "explainer": "The share of new criminal defendants whose most serious charge was a firearms or explosives offense.",
        "caveats": ["Offense categories follow the AO's top-level headings, mapped from FJC offense codes by the IDB lane; the mapping reproduces the AO's published firearms totals exactly.",
                    IDB_COMPUTED, IDB_2026, IDB_BASE, RANK],
        "input": {"lane": "idb", "table": "observations", "variable": "idb_crim_pct_firearms_explosives"},
        "derived": True,
        "formula": "100 × new defendants whose most serious charge is a firearms or explosives offense ÷ all new defendants",
        "base": "denominator",
        "fact": {"text": "firearms offenses were the most serious charge for {value} of new criminal defendants", "high": "highest share", "low": "lowest share"},
    },
    {
        "id": "sentenced_drug_trafficking_pct", "family": "casemix",
        "label": "Drug trafficking, share of people sentenced", "short_label": "Sentenced: drug trafficking",
        "unit": "percent", "format": ".1f", "higher_means": "more of those sentenced were drug trafficking cases",
        "default_rank_direction": "desc",
        "explainer": "The share of people sentenced whose main offense was drug trafficking, as classified by the U.S. Sentencing Commission.",
        "caveats": [USSC_OFFENSE_2018, USSC_PACKETS, USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_offense_drug_trafficking"},
        "base": "n_basis",
        "breaks": [{"year": 2018, "note": "USSC offense classification moved from statute of conviction to primary guideline."}],
        "fact": None,
    },
    {
        "id": "sentenced_immigration_pct", "family": "casemix",
        "label": "Immigration, share of people sentenced", "short_label": "Sentenced: immigration",
        "unit": "percent", "format": ".1f", "higher_means": "more of those sentenced were immigration cases",
        "default_rank_direction": "desc",
        "explainer": "The share of people sentenced whose main offense was an immigration offense, as classified by the U.S. Sentencing Commission.",
        "caveats": [USSC_OFFENSE_2018, USSC_PACKETS, USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_offense_immigration"},
        "base": "n_basis",
        "breaks": [{"year": 2018, "note": "USSC offense classification moved from statute of conviction to primary guideline."}],
        "fact": None,
    },
    {
        "id": "sentenced_firearms_pct", "family": "casemix",
        "label": "Firearms, share of people sentenced", "short_label": "Sentenced: firearms",
        "unit": "percent", "format": ".1f", "higher_means": "more of those sentenced were firearms cases",
        "default_rank_direction": "desc",
        "explainer": "The share of people sentenced whose main offense was a firearms offense, as classified by the U.S. Sentencing Commission.",
        "caveats": [USSC_OFFENSE_2018, USSC_PACKETS, USSC_FY, USSC_BASE, RANK],
        "input": {"lane": "ussc", "table": "observations", "variable": "ussc_pct_offense_firearms"},
        "base": "n_basis",
        "breaks": [{"year": 2018, "note": "USSC offense classification moved from statute of conviction to primary guideline."}],
        "fact": None,
    },
]

BY_ID = {v["id"]: v for v in CATALOG}
assert len(BY_ID) == len(CATALOG), "duplicate catalog id"

# Variables used for the "size and circuit" fallback sentence in profiles.
FALLBACK_SIZE_VARIABLE = "judgeships"

# Order in which outlier facts of equal strength are preferred (featured measures first).
FACT_PRIORITY = [v["id"] for v in CATALOG if v.get("fact") and v.get("featured")] + \
                [v["id"] for v in CATALOG if v.get("fact") and not v.get("featured")]
