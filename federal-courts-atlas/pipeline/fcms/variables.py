"""Variable definitions for the FCMS lane.

Definitions paraphrase the AO's "Explanation of the Judicial Caseload Profiles for United States
District Courts" (xlsx linked from every FY2017+ period page; PDF for FY2011 and FY2012-14) and the
"Explanation of Selected Terms" (FY2016+). Values are kept exactly as printed.
"""
from __future__ import annotations

import re

PERIOD_TYPE = "FY_SEP30"

# Variables whose values depend on the AO's criminal counting method. Beginning with the March 2012
# profiles the AO counts criminal felony *defendants* rather than cases, and measures criminal median
# time from the defendant's proceeding date rather than the filing date (Explanation of Selected Terms).
# The FY2010 file posted on uscourts.gov was regenerated on the new method; the FY2004-09 and FY2011
# files use the old one. Overlapping columns confirm the split (see docs/lanes/fcms.md).
CRIMINAL_METHOD_SENSITIVE = {
    "fcms_filings_total", "fcms_terminations_total", "fcms_pending_total",
    "fcms_pct_change_filings_1yr", "fcms_pct_change_filings_2yr", "fcms_pct_change_filings_3yr",
    "fcms_pct_change_filings_4yr", "fcms_pct_change_filings_5yr",
    "fcms_filings_per_judgeship_total", "fcms_filings_per_judgeship_criminal_felony",
    "fcms_pending_per_judgeship", "fcms_terminations_per_judgeship",
    "fcms_median_months_criminal_felony_filing_to_disposition", "fcms_avg_felony_defendants_per_case",
    "fcms_filings_criminal_felony",
}
# Weighted filings: the FY2015+ profiles show revised weighted filings for every year they print
# (new case weights "approved for use after December 2015", prior years revised - FY2016 Explanation of
# Selected Terms); FY2004-14 profiles use the earlier weights.
WEIGHTS_SENSITIVE = {"fcms_weighted_filings_per_judgeship"}

# Supervised release hearings are part of total filings/terminations (and weighted filings) only from FY2002.
SRH_INCLUDED = {"fcms_filings_total", "fcms_terminations_total", "fcms_filings_per_judgeship_total",
                "fcms_terminations_per_judgeship", "fcms_weighted_filings_per_judgeship"}

# row_id (parse.py) -> variable id, unit, short label
ROW_VARS = {
    "filings_total": ("fcms_filings_total", "count", "Total filings"),
    "terminations_total": ("fcms_terminations_total", "count", "Total terminations"),
    "pending_total": ("fcms_pending_total", "count", "Total pending"),
    "judgeships": ("fcms_judgeships", "count", "Authorized judgeships"),
    "vacant_months": ("fcms_vacant_judgeship_months", "months", "Vacant judgeship months"),
    "pj_total": ("fcms_filings_per_judgeship_total", "per_judgeship", "Total filings per judgeship"),
    "pj_civil": ("fcms_filings_per_judgeship_civil", "per_judgeship", "Civil filings per judgeship"),
    "pj_criminal_felony": ("fcms_filings_per_judgeship_criminal_felony", "per_judgeship", "Criminal felony filings per judgeship"),
    "pj_srh": ("fcms_filings_per_judgeship_supervised_release_hearings", "per_judgeship", "Supervised release hearings per judgeship"),
    "pj_pending": ("fcms_pending_per_judgeship", "per_judgeship", "Pending cases per judgeship"),
    "pj_weighted": ("fcms_weighted_filings_per_judgeship", "per_judgeship", "Weighted filings per judgeship"),
    "pj_terminations": ("fcms_terminations_per_judgeship", "per_judgeship", "Terminations per judgeship"),
    "pj_trials": ("fcms_trials_completed_per_judgeship", "per_judgeship", "Trials completed per judgeship"),
    "median_criminal": ("fcms_median_months_criminal_felony_filing_to_disposition", "months", "Median months, felony filing to disposition"),
    "median_civil": ("fcms_median_months_civil_filing_to_disposition", "months", "Median months, civil filing to disposition"),
    "median_civil_trial": ("fcms_median_months_civil_filing_to_trial", "months", "Median months, civil filing to trial"),
    "over3_count": ("fcms_civil_over_3yrs_count", "cases", "Civil cases over 3 years old"),
    "over3_pct": ("fcms_civil_over_3yrs_pct", "percent", "Percent of pending civil cases over 3 years old"),
    "avg_defendants": ("fcms_avg_felony_defendants_per_case", "defendants_per_case", "Felony defendants per case"),
    "jurors_present": ("fcms_jurors_avg_present", "persons", "Average jurors present for selection"),
    "jurors_not_selected": ("fcms_jurors_pct_not_selected", "percent", "Percent of jurors not selected or challenged"),
}
PCT_VAR = "fcms_pct_change_filings_{k}yr"

# Rows that carry a printed numerical standing (rank) in the margin.
RANKED_ROWS = ["pj_total", "pj_civil", "pj_criminal_felony", "pj_srh", "pj_pending", "pj_weighted",
               "pj_terminations", "pj_trials", "median_criminal", "median_civil", "median_civil_trial", "over3_pct"]
# AO: "caseload" statistics ranked descending (largest = 1); all other statistics ascending (lowest = 1).
DESCENDING_RANK_ROWS = {"pct_change", "pct_change_last", "pct_change_earlier", "pj_total", "pj_civil",
                        "pj_criminal_felony", "pj_srh", "pj_pending", "pj_weighted", "pj_terminations", "pj_trials"}

DESCRIPTIONS = {
    "fcms_filings_total": "Total civil and criminal felony cases (including transfers) filed, plus supervised release hearings held, in the 12 months ending September 30.",
    "fcms_terminations_total": "Total civil and criminal felony cases (including transfers) terminated, plus supervised release hearings held.",
    "fcms_pending_total": "Total civil and criminal felony cases (including transfers) pending at the end of the year (September 30).",
    "fcms_pct_change_filings_1yr": "Percent change in total filings, current year over the previous year, as printed in the profile.",
    "fcms_pct_change_filings_2yr": "Percent change in total filings, current year over two years earlier, as printed in the profile.",
    "fcms_pct_change_filings_3yr": "Percent change in total filings, current year over three years earlier, as printed in the profile.",
    "fcms_pct_change_filings_4yr": "Percent change in total filings, current year over four years earlier, as printed in the profile.",
    "fcms_pct_change_filings_5yr": "Percent change in total filings, current year over five years earlier, as printed in the profile.",
    "fcms_judgeships": "Number of authorized judgeships (not including senior judges). Territorial courts' judgeships are included and are part of the national total.",
    "fcms_vacant_judgeship_months": "Number of months during the year that authorized judgeships were not filled, summed over the district's judgeships.",
    "fcms_filings_per_judgeship_total": "Total filings (civil + criminal felony incl. transfers + supervised release hearings) divided by the number of authorized judgeships.",
    "fcms_filings_per_judgeship_civil": "Total civil cases filed divided by the number of authorized judgeships.",
    "fcms_filings_per_judgeship_criminal_felony": "Total criminal felony filings (including transfers) divided by the number of authorized judgeships.",
    "fcms_filings_per_judgeship_supervised_release_hearings": "Supervised release hearings (court proceedings modifying conditions of, or revoking, a defendant's supervised release) divided by the number of authorized judgeships.",
    "fcms_pending_per_judgeship": "Civil and criminal felony cases (including transfers) pending at year end divided by the number of authorized judgeships.",
    "fcms_weighted_filings_per_judgeship": "Weighted filings per authorized judgeship: total filings weighted by the FJC case weights for relative judge time (average case approx. 1.0).",
    "fcms_terminations_per_judgeship": "Total terminations (including transfers and supervised release hearings) divided by the number of authorized judgeships.",
    "fcms_trials_completed_per_judgeship": "Trials completed by district judges (including evidentiary trials, hearings on temporary restraining orders and preliminary injunctions) per authorized judgeship.",
    "fcms_median_months_criminal_felony_filing_to_disposition": "Median time in months from filing (proceeding date since March 2012) to disposition (sentencing or dismissal/acquittal) for criminal felony defendants terminated, excluding transfers; not computed when fewer than 10 terminations.",
    "fcms_median_months_civil_filing_to_disposition": "Median time in months from filing to disposition for civil cases terminated, excluding land condemnation, prisoner petitions, recovery of overpayments, enforcement of judgments and deportation reviews; not computed when fewer than 10 terminations.",
    "fcms_median_months_civil_filing_to_trial": "Median time in months from filing to the start of trial for civil cases tried by a district judge; not computed when the district had fewer than 10 civil trials.",
    "fcms_civil_over_3yrs_count": "Number of civil cases pending more than three years as of September 30.",
    "fcms_civil_over_3yrs_pct": "Civil cases pending more than three years as a percent (0-100) of the pending civil caseload, as printed.",
    "fcms_avg_felony_defendants_per_case": "Average number of felony defendants in each felony case filed.",
    "fcms_jurors_avg_present": "Average number of petit jurors reporting to court for jury selection.",
    "fcms_jurors_pct_not_selected": "Percent (0-100) of petit jurors neither selected nor challenged on jury selection days.",
    "fcms_filings_civil": "Total civil cases filed in the year ('Total Civil' in the profile's nature-of-suit table).",
    "fcms_filings_criminal_felony": "Total criminal felony filings by nature of offense, EXCLUDING transfers ('Total Criminal' in the nature-of-offense table). Counts defendants in FY2010 and FY2012+ profiles, cases in FY2004-09 and FY2011 profiles.",
}

HIGHER_MEANS = {
    "fcms_filings_total": "more cases filed", "fcms_terminations_total": "more cases closed",
    "fcms_pending_total": "more cases awaiting resolution", "fcms_judgeships": "more authorized judgeships",
    "fcms_vacant_judgeship_months": "more unfilled judgeship time", "fcms_civil_over_3yrs_count": "more old civil cases",
    "fcms_civil_over_3yrs_pct": "larger share of old civil cases",
    "fcms_avg_felony_defendants_per_case": "more defendants per felony case",
    "fcms_jurors_avg_present": "more jurors called per selection", "fcms_jurors_pct_not_selected": "more jurors unused",
    "fcms_filings_civil": "more civil cases filed", "fcms_filings_criminal_felony": "more criminal filings",
}


def slug_for_label(label: str) -> str:
    s = label.lower()
    s = re.sub(r"\(other than personal injury/product liability\)", "other", s)
    s = s.replace("all other drugs", "other_drugs")
    s = re.sub(r"\b(suits|offenses|cases)\b", lambda m: "" if m.group(1) in ("suits", "cases") else m.group(1), s)
    s = re.sub(r"\b(and|the)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s


# Printed legend label -> variable slug. Built by slug_for_label; listed explicitly so a new label in
# a future profile fails loudly in tests instead of silently creating a variable.
KNOWN_SLUGS = {
    ("civil", "Social Security"): "social_security",
    ("civil", "Personal Injury/Product Liability"): "personal_injury_product_liability",
    ("civil", "Prisoner Petitions"): "prisoner_petitions",
    ("civil", "Forfeitures and Penalties"): "forfeitures_penalties",
    ("civil", "Real Property"): "real_property",
    ("civil", "Labor Suits"): "labor",
    ("civil", "Contracts"): "contracts",
    ("civil", "Torts (other than Personal Injury/Product Liability)"): "torts_other",
    ("civil", "Copyright, Patent, and Trademark"): "copyright_patent_trademark",
    ("civil", "Intellectual Property Rights"): "intellectual_property_rights",
    ("civil", "Civil Rights"): "civil_rights",
    ("civil", "Antitrust"): "antitrust",
    ("civil", "All Other Civil"): "all_other_civil",
    ("civil", "All Other Civil Cases"): "all_other_civil",
    ("criminal", "Marijuana"): "marijuana",
    ("criminal", "All Other Drugs"): "other_drugs",
    ("criminal", "Immigration"): "immigration",
    ("criminal", "Firearms and Explosives"): "firearms_explosives",
    ("criminal", "Fraud"): "fraud",
    ("criminal", "Violent Offenses"): "violent_offenses",
    ("criminal", "Sex Offenses"): "sex_offenses",
    ("criminal", "Forgery and Counterfeiting"): "forgery_counterfeiting",
    ("criminal", "Larceny and Theft"): "larceny_theft",
    ("criminal", "Justice System Offenses"): "justice_system_offenses",
    ("criminal", "Regulatory Offenses"): "regulatory_offenses",
    ("criminal", "All Other Criminal"): "all_other_criminal",
}


def canonical_label(label: str) -> str:
    """Normalise case/spacing differences between the profile legend and the explanation PDF."""
    lab = re.sub(r"\s+", " ", label).strip()
    for (kind, known) in KNOWN_SLUGS:
        if lab.lower() == known.lower():
            return known
    return lab


def nos_variable(kind: str, label: str) -> str:
    key = (kind, canonical_label(label))
    if key not in KNOWN_SLUGS:
        raise KeyError(f"unknown nature-of-suit/offense label {key}; add it to KNOWN_SLUGS")
    return f"fcms_{kind}_type_{KNOWN_SLUGS[key]}"


def rank_variable(scope: str, base_var: str) -> str:
    assert scope in ("us", "circuit")
    return f"fcms_rank_{scope}_{base_var[len('fcms_'):]}"
