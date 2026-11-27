"""Variable definitions for the USSC lane and the code that turns component counts into
observations. One definition per variable id across all years; where the USSC changed its
own scheme, a separate id is used (or the years are left out and logged as a gap).
"""
from __future__ import annotations

import math

import pandas as pd

from .compute import offense_scheme

PT = "FY_SEP30"
DATAFILE_FIRST, LAST = 2002, 2025
PACKET_FIRST = 1995          # first fiscal year with district packets online (fallback source)

OFF_LABEL = {
    "drug_trafficking": "drug trafficking", "immigration": "immigration", "firearms": "firearms",
    "fraud": "fraud", "fraud_theft_embezzlement": "fraud/theft/embezzlement",
    "child_pornography": "child pornography", "other": "all other offense types",
}

ERA_OFFENSE = (
    "Primary offense type is the variable the USSC used in that year's own Sourcebook and packets: "
    "OFFTYPE2 (FY1995-FY2009) and OFFTYPSB (FY2010-FY2017), both assigned from the count of conviction "
    "with the highest statutory maximum; OFFGUIDE (FY2018+), assigned mainly from the primary sentencing "
    "guideline the court applied. The FY2018 change of basis is a definitional break for every offense "
    "category; the USSC uses the same category names on both sides of it for drug trafficking, "
    "immigration, firearms and child pornography."
)
SMALL_N = ("Territorial courts (D. Guam, D.N. Mar. I., D.V.I.) and some small districts have few cases; "
           "see ussc_cases_total and the n_basis column before comparing percentages.")

PACKET_SUM = ("FY1995-FY1999 values are as printed in each district's own packet; summed over districts they do "
              "not always equal the national packet figure (FY1999 imprisonment N: districts exceed the nation by "
              "57 with all 94 present; other years have missing district-years). Do not present FY1995-FY1999 "
              "district counts as adding up to the nation; see packet_reconciliation.csv. FY2000+ add up exactly.")

RANGE_DEF = (
    "Denominator: individuals whose sentence could be compared with the guideline range (USSC excludes "
    "cases with missing or indeterminable guideline information and offenses with no applicable "
    "guideline) = ussc_cases_range_known."
)


def _v(id, label, unit, description, caveats, higher_means, first, last, *, formula, derived=False,
       basis_by_era=None, breaks=None, kind="percent"):
    return {"id": id, "label": label, "unit": unit, "period_type": PT, "description": description,
            "caveats": caveats, "higher_means": higher_means, "first_period": first, "last_period": last,
            "formula": formula, "derived": derived, "eras": basis_by_era or [], "breaks": breaks or []}


def variable_specs() -> list[dict]:
    V = []
    V.append(_v("ussc_cases_total", "Individuals sentenced (USSC)", "cases",
                "Number of individual offenders sentenced in the district in the fiscal year and reported to "
                "the U.S. Sentencing Commission (records in the USSC Individual Offender datafile; before FY2018 "
                "the USSC called these 'guideline cases'). Organizational defendants, resentencings and appeals "
                "are not included.",
                [SMALL_N, "FY1995-FY2001 values are the district totals printed in the USSC Statistical "
                 "Information Packet (Table 1 note); FY2002+ are counts of datafile records, which reproduce "
                 "the packet totals exactly.", PACKET_SUM],
                "more individuals sentenced", PACKET_FIRST, LAST, formula="count of datafile records with DISTRICT = d"))
    V.append(_v("ussc_cases_range_known", "Cases with guideline range comparison", "cases",
                "Denominator of the guideline-range percentages: individuals whose sentence the USSC could compare "
                "with the guideline range.",
                ["Era-specific USSC exclusions (missing departure information before FY2005; missing documents "
                 "or no applicable guideline afterwards).", SMALL_N],
                "more cases", PACKET_FIRST, LAST, formula="count of cases with non-missing range category"))
    V.append(_v("ussc_pct_within_range", "Sentenced within the guideline range", "percent",
                "Share of individuals sentenced within the applicable federal sentencing guideline range. "
                + RANGE_DEF,
                ["Before Booker (FY1995-FY2004 and the first 3.5 months of FY2005) the guidelines were mandatory "
                 "and 'within range' means no departure was granted (packet departure table); from FY2006 "
                 "(BOOKERCD=0) and FY2018 (SENTRNGE=0) it is the USSC's 'Within Guideline Range' category. "
                 "The USSC's FY2025 Sourcebook Figure 9 shows the FY2018 methodology change did not alter the "
                 "within-range share (FY2017: 49.1% under both methods).",
                 "FY2004 and FY2005 are pooled from the two half-year tables the USSC published "
                 "(pre/post-Blakely; pre/post-Booker); each half was validated separately.",
                 SMALL_N],
                "more sentences inside the guideline range", PACKET_FIRST, LAST,
                formula="100 * within / ussc_cases_range_known",
                breaks=[{"period": 2005, "note": "United States v. Booker (Jan 12, 2005) made the guidelines advisory"},
                        {"period": 2018, "note": "USSC adopted SENTRNGE methodology; within-range share unaffected"}]))
    V.append(_v("ussc_pct_substantial_assistance_5k1", "§5K1.1 substantial-assistance departures", "percent",
                "Share of individuals who received a downward departure on a government motion under USSG §5K1.1 "
                "for substantial assistance to authorities (USSC category 'Substantial Assistance Departure' / "
                "'§5K1.1 Substantial Assistance'). " + RANGE_DEF,
                ["FY2002: DEPART codes 3,5,7,9 (any §5K1.1); FY2003 DEPART_D=0; FY2004-FY2005 DEPART_A=2; "
                 "FY2005 post-Booker-FY2017 BOOKERCD=5; FY2018+ SENTRNGE=2. Cases with both §5K1.1 and other "
                 "departures are counted as §5K1.1, as the USSC does.", SMALL_N],
                "more substantial-assistance departures", PACKET_FIRST, LAST,
                formula="100 * sa_5k1 / ussc_cases_range_known"))
    V.append(_v("ussc_pct_early_disposition_5k3", "§5K3.1 early-disposition (fast-track) departures", "percent",
                "Share of individuals who received a downward departure under USSG §5K3.1 (early disposition / "
                "'fast-track' programs authorized by the Attorney General). " + RANGE_DEF,
                ["Published separately by district from FY2006 (FY2003-FY2005 packets fold it into 'government "
                 "initiated departure'). Most districts have no program, so 0.0 is common and real.", SMALL_N],
                "more fast-track departures", 2006, LAST, formula="100 * edp_5k3 / ussc_cases_range_known"))
    for gid, glabel, gdesc, hm in [
        ("above_range", "Sentenced above the guideline range",
         "USSC 'Cases sentenced above guideline range' (upward departures, upward departures with Booker/§3553, "
         "above range with Booker/§3553, remaining above range; BOOKERCD 1-4).", "more above-range sentences"),
        ("govt_sponsored_below_range", "Government-sponsored below-range sentences",
         "USSC 'Government sponsored below range' (§5K1.1, §5K3.1 and other government-sponsored below-range "
         "sentences; BOOKERCD 5-7): the prosecution initiated, proposed or stipulated to the sentence.",
         "more below-range sentences sought by the government"),
        ("non_govt_sponsored_below_range", "Non-government-sponsored below-range sentences",
         "USSC 'Non-government sponsored below range' (downward departures, downward departures with "
         "Booker/§3553, below range with Booker/§3553, remaining below range; BOOKERCD 8-11).",
         "more below-range sentences not sought by the government"),
    ]:
        V.append(_v(f"ussc_pct_{gid}", glabel, "percent",
                    f"Share of individuals in the {glabel.lower()} category: {gdesc} " + RANGE_DEF,
                    ["Only FY2006-FY2017, the years the USSC itself published this four-way grouping "
                     "(packet Table 8 'Comparison of sentence imposed and position relative to the guideline "
                     "range'). FY2005 is split pre/post-Booker and FY1995-FY2004 used departure categories "
                     "only; from FY2018 the USSC reports departures and variances instead (see the "
                     f"ussc_pct_{gid}_2018scheme variable). These years are omitted, not imputed.",
                     "In FY2006-FY2009 packets the group percentage was printed as the sum of rounded "
                     "sub-category percentages; this value is count/denominator (counts match exactly), so it can "
                     "differ from the printed figure by up to 0.2 points.", SMALL_N],
                    hm, 2006, 2017, formula=f"100 * {gid} / ussc_cases_range_known"))
    SUP_NOTE = ("FY2014-FY2017 values come from the USSC's supplemental datafiles, which carry the FY2018-"
                "methodology variable SENTRNGE for those years (joined to the main datafile on USSCIDN to get the "
                "district); the USSC released them so researchers can apply the current methodology to FY2014+, "
                "but did not publish district tables for those years on this basis. FY2018+ values reproduce the "
                "packet tables.")
    for gid, glabel, comps, hm in [
        ("above_range", "Sentenced above the guideline range (FY2018 methodology)",
         "Upward Departure + Upward Variance (SENTRNGE 1, 6)", "more above-range sentences"),
        ("govt_sponsored_below_range", "Government-sponsored below-range sentences (FY2018 methodology)",
         "§5K1.1 + §5K3.1 + Other Government Motion departure + Government Motion downward variance "
         "(SENTRNGE 2, 3, 4, 7)", "more below-range sentences sought by the government"),
        ("non_govt_sponsored_below_range", "Non-government-sponsored below-range sentences (FY2018 methodology)",
         "Non-Government Departure + Non-Government downward Variance (SENTRNGE 5, 8)",
         "more below-range sentences not sought by the government"),
    ]:
        V.append(_v(f"ussc_pct_{gid}_2018scheme", glabel, "percent",
                    f"DERIVED: sum of USSC SENTRNGE categories: {comps}, as a share of cases with a "
                    "guideline-range comparison under the FY2018 methodology (n_basis column). Government/non-"
                    "government attribution uses the USSC's own test (the prosecution initiated, proposed or "
                    "stipulated to the sentence).",
                    ["Derived by this lane: the USSC publishes each component (packet Table 8, FY2018+) but not "
                     "this sum.", SUP_NOTE,
                     "Kept separate from the FY2006-FY2017 id without the suffix (BOOKERCD scheme, as published) "
                     "because the USSC stopped printing this grouping after FY2017. For FY2014-FY2017 both were "
                     "computed and are IDENTICAL for every district and year (tested): the FY2018 methodology change "
                     "re-labelled departures vs variances without moving any case between these four groups.",
                     SMALL_N],
                    hm, 2014, LAST, derived=True, formula=f"100 * ({comps}) / cases with SENTRNGE non-missing"))
    for cid, clabel, cdesc in [
        ("upward_departure", "Upward departures (FY2018 methodology)", "SENTRNGE=1: above the range, reason from "
         "Statement of Reasons Part V (Guidelines Manual departure)"),
        ("other_govt_motion_departure", "Other government-motion downward departures (FY2018 methodology)",
         "SENTRNGE=4: below range, Part V reason other than §5K1.1/§5K3.1, prosecution initiated, proposed or "
         "stipulated"),
        ("non_govt_downward_departure", "Non-government downward departures (FY2018 methodology)",
         "SENTRNGE=5: below range, Part V reason, not sponsored by the prosecution"),
        ("upward_variance", "Upward variances (FY2018 methodology)", "SENTRNGE=6: above range, Part VI "
         "(18 U.S.C. §3553(a)) reason"),
        ("govt_motion_downward_variance", "Government-motion downward variances (FY2018 methodology)",
         "SENTRNGE=7: below range, Part VI reason, prosecution initiated, proposed or stipulated"),
        ("non_govt_downward_variance", "Non-government downward variances (FY2018 methodology)",
         "SENTRNGE=8: below range, Part VI reason or no reason, not sponsored by the prosecution"),
        ("variance", "All variances (FY2018 methodology)", "SENTRNGE 6-8: sentences outside the range for "
         "§3553(a) reasons (packet Table 9 'Variance' column)"),
    ]:
        V.append(_v(f"ussc_pct_{cid}", clabel, "percent",
                    f"Share of individuals in the USSC category {cdesc}, among cases with a guideline-range "
                    "comparison under the FY2018 methodology (n_basis column).",
                    ["These categories exist only in the USSC's SENTRNGE scheme.", SUP_NOTE, SMALL_N],
                    "more " + clabel.split(" (")[0].lower(), 2014, LAST,
                    formula=f"100 * {cid} / cases with SENTRNGE non-missing"))
    V.append(_v("ussc_pct_prison", "Sentenced to prison", "percent",
                "Share of individuals sentenced to a term of imprisonment (prison only, or prison plus alternative "
                "confinement / split sentence; SENTIMP 1-2), among individuals with sentence-type information, "
                "fine-only sentences included in the denominator (USSC FY2018+ packet Table 5 convention, "
                "applied to every year).",
                ["FY2002-FY2017 packets left fine-only cases out of the sentence-type denominator; this variable "
                 "keeps them in for every year so the series is consistent. The numerators (prison counts) match "
                 "the packets exactly in every year.", SMALL_N],
                "more prison sentences", DATAFILE_FIRST, LAST,
                formula="100 * (prison_only + prison_with_alternatives) / cases_with_sentence_type"))
    V.append(_v("ussc_mean_sentence_months", "Average sentence (months)", "months",
                "Mean sentence length in months under the USSC's FY2018+ convention: imprisonment plus months of "
                "alternative confinement, probation-only and fine-only sentences counted as 0 months, terms over "
                "470 months set to 469.99 (life = 470). Variable SENSPCAP (FY2018+); for FY2002-FY2017 the identical "
                "rule applied to SENSPLT0.",
                ["FY2018-FY2025 reproduce packet Table 7 'Sentence length'. FY2002-FY2017 are computed by this lane "
                 "with the same rule; the USSC's own packets for those years published only the "
                 "length of imprisonment (see ussc_mean_prison_months).",
                 "Cases with no sentence-length value (SENSPLT0/SENSPCAP missing: 746 records nationally in FY2002, "
                 "falling to 0-2 a year from FY2017) are left out of the mean, the median and N (n_basis), as the "
                 "USSC leaves out a missing SENSPCAP. Before 2026-11-27 this lane wrongly counted them as 469.99 "
                 "months in FY2002-FY2017 (statistics audit, blocker 1); corrected.", SMALL_N],
                "longer sentences", DATAFILE_FIRST, LAST,
                formula="mean(min(SENSPCAP or SENSPLT0, 469.99; life = 470)) over cases with a non-missing value"))
    V.append(_v("ussc_median_sentence_months", "Median sentence (months)", "months",
                "Median of the same quantity as ussc_mean_sentence_months (probation = 0; terms over 470 months set to 469.99, life = 470).",
                ["As for ussc_mean_sentence_months. The median is 0 where more than half the individuals received "
                 "no confinement.", SMALL_N],
                "longer sentences", DATAFILE_FIRST, LAST,
                formula="median(min(SENSPCAP or SENSPLT0, 469.99; life = 470)) over cases with a non-missing value"))
    V.append(_v("ussc_mean_prison_months", "Average prison term (months, prison cases only)", "months",
                "Mean length of imprisonment in months among individuals sentenced to prison (USSC pre-FY2018 "
                "'Length of imprisonment' convention, packet Table 7 FY1995-FY2017): variable SENTTOT, cases with "
                "a prison term > 0 months and a known primary offense; months of alternative confinement are "
                "excluded; terms are not capped (life is coded 470 months).",
                ["FY1995-FY2001 are the published packet values; FY2002-FY2017 reproduce the packets; FY2018-FY2025 "
                 "are computed by this lane with the same rule (the USSC switched to the probation-as-zero "
                 "convention, see ussc_mean_sentence_months).", SMALL_N],
                "longer prison terms", PACKET_FIRST, LAST, formula="mean(SENTTOT | SENTTOT > 0)"))
    V.append(_v("ussc_median_prison_months", "Median prison term (months, prison cases only)", "months",
                "Median of the same quantity as ussc_mean_prison_months.",
                ["As for ussc_mean_prison_months.", SMALL_N],
                "longer prison terms", PACKET_FIRST, LAST, formula="median(SENTTOT | SENTTOT > 0)"))
    V.append(_v("ussc_cases_prison_term", "Individuals with a prison term", "cases",
                "Number of individuals in the denominator of ussc_mean_prison_months (prison term > 0 months, "
                "known primary offense).", [SMALL_N, PACKET_SUM], "more prison sentences", PACKET_FIRST, LAST,
                formula="count(SENTTOT > 0)"))
    V.append(_v("ussc_cases_offense_known", "Cases with a primary offense type", "cases",
                "Denominator of the offense-mix shares: individuals with a known primary offense type.",
                [ERA_OFFENSE, PACKET_SUM], "more cases", PACKET_FIRST, LAST,
                formula="count(offense type non-missing)"))
    for cat in ["drug_trafficking", "immigration", "firearms", "fraud", "fraud_theft_embezzlement",
                "child_pornography", "other"]:
        first, last = PACKET_FIRST, LAST
        extra = []
        if cat == "fraud":
            last = 2017
            extra = ["USSC category 'Fraud' (OFFTYPE2/OFFTYPSB code 18), which excludes embezzlement, larceny and "
                     "forgery/counterfeiting. From FY2018 the USSC merged fraud, theft and embezzlement into one "
                     "guideline-based category: see ussc_pct_offense_fraud_theft_embezzlement."]
        elif cat == "fraud_theft_embezzlement":
            first = 2018
            extra = ["USSC FY2018+ category 'Fraud/Theft/Embezzlement' (OFFGUIDE 16). Wider than the earlier "
                     "'Fraud' category, so it has a separate id."]
        elif cat == "child_pornography":
            first = 2010
            extra = ["Separate category from FY2010 (OFFTYPSB 28; OFFGUIDE 7). Before FY2010 the USSC grouped it "
                     "with prostitution in 'Pornography/Prostitution'; those years are omitted."]
        elif cat == "drug_trafficking":
            extra = ["'Drugs - Trafficking, Manufacturing, and Importing' (code 10) before FY2018; 'Drug "
                     "Trafficking' (OFFGUIDE 10) after. Drug communication-facility and simple-possession cases "
                     "are not included."]
        elif cat == "other":
            extra = ["Everything not in the named categories, so its composition changes at each break "
                     "(FY2010: child pornography leaves 'other'; FY2018: theft and embezzlement leave 'other')."]
        V.append(_v(f"ussc_pct_offense_{cat}", f"Offense mix: {OFF_LABEL[cat]} (share)", "percent",
                    f"Share of individuals whose primary offense type is {OFF_LABEL[cat]}, among individuals with a "
                    "known primary offense type (packet Table 1).",
                    [ERA_OFFENSE] + extra + [SMALL_N], f"larger share of {OFF_LABEL[cat]} cases", first, last,
                    formula=f"100 * count_{cat} / ussc_cases_offense_known",
                    breaks=[{"period": 2010, "note": "OFFTYPE2 -> OFFTYPSB"},
                            {"period": 2018, "note": "statute-based -> guideline-based (OFFGUIDE)"}]))
        V.append(_v(f"ussc_count_offense_{cat}", f"Offense mix: {OFF_LABEL[cat]} (count)", "cases",
                    f"Number of individuals whose primary offense type is {OFF_LABEL[cat]}.",
                    [ERA_OFFENSE] + extra + ([PACKET_SUM] if first < 2000 else []), f"more {OFF_LABEL[cat]} cases",
                    first, last,
                    formula=f"count(primary offense = {cat})", kind="count"))
    return V


# ------------------------------------------------------------- derived flag per row ----------
# A row is a USSC-published figure only when its basis is one of these; every other basis is a value
# this lane computed (DATA_CONTRACT rule 3: labelled derived, with a formula).
PUBLISHED_BASES = {"reproduces_published", "published_packet"}
DERIVED_BASES = {"computed_ussc_definition", "derived_from_published_counts", "pooled_published_halves",
                 "sum_of_published_components", "computed_ussc_supplemental",
                 # Data audit 2026-11-27 (auditor A #8): FY2006-FY2009 packets print a range group's percentage as
                 # the sum of its rounded sub-category percentages; this lane emits the exact count share, which
                 # can differ from the printed figure by 0.1, so it is not the printed number.
                 "exact_share_of_published_counts",
                 # Data audit 2026-11-27 (auditor B #134/#135): from FY2011 the USSC prints means and medians as
                 # whole months; this lane keeps one decimal, a precision the USSC does not print.
                 "unrounded_published_statistic"}

# Years in which the USSC printed a BOOKERCD range group's percentage as the sum of rounded sub-category
# percentages (validated in validate.py; FY2010-FY2017 packets print the exact share).
GROUP_SUM_OF_ROUNDED_YEARS = range(2006, 2010)
# First fiscal year in which the USSC prints sentence means and medians as whole months.
WHOLE_MONTHS_FROM = 2011


def is_derived(basis: str) -> bool:
    if basis in PUBLISHED_BASES:
        return False
    if basis in DERIVED_BASES:
        return True
    raise ValueError(f"unknown basis {basis!r}")


def derived_formula(spec: dict, basis: str) -> str:
    """Formula shown for a derived row of variable ``spec`` with this ``basis``."""
    f = spec["formula"]
    pct = spec["unit"] == "percent"
    if basis == "computed_ussc_definition":
        return (f"{f}, computed by this lane from the USSC Individual Offender datafile with the USSC's own "
                "definition, in a year when the USSC did not print this statistic")
    if basis == "derived_from_published_counts":
        diff = "packet Table 1 TOTAL - (drug trafficking + immigration + firearms + fraud rows)"
        return f"100 * ({diff}) / Table 1 TOTAL" if pct else diff
    if basis == "pooled_published_halves":
        return ("100 * (n_first_half + n_second_half) / (N_first_half + N_second_half): the full fiscal year "
                "pooled from the two half-year tables the USSC printed (FY2004 pre/post-Blakely, FY2005 "
                "pre/post-Booker)" if pct else "N_first_half + N_second_half (FY2004 pre/post-Blakely, FY2005 "
                "pre/post-Booker half-year tables)")
    if basis == "sum_of_published_components":
        return f"{f} (sum of USSC-published SENTRNGE components)"
    if basis == "computed_ussc_supplemental":
        return (f"{f}, SENTRNGE from the USSC FY2014-FY2017 supplemental datafile joined on USSCIDN to the main "
                "datafile for DISTRICT; the USSC did not publish district tables on this basis for these years")
    if basis == "exact_share_of_published_counts":
        return (f"{f}: the exact share from the group count and denominator the USSC printed. The FY2006-FY2009 "
                "packets print the group's percentage as the sum of its rounded sub-category percentages, which "
                "can differ from this value by 0.1")
    if basis == "unrounded_published_statistic":
        return (f"{f}, computed by this lane from the USSC Individual Offender datafile and kept to one decimal; "
                "the USSC prints this statistic rounded to whole months from FY2011")
    raise ValueError(f"no derived formula for basis {basis!r}")


# ---------------------------------------------------------------- observations ----------
def _r1(x: float) -> float:
    return float(f"{x + 0.0:.1f}") if x is not None and not math.isnan(x) else x


def observations_from_components(comps: pd.DataFrame, source_for_fy: dict[int, str],
                                 file_for_fy: dict[int, str], sup_source_for_fy: dict[int, str] | None = None,
                                 sup_file_for_fy: dict[int, str] | None = None) -> pd.DataFrame:
    """District-level observations (and national rows, district_id='US') from datafile components."""
    rows: list[dict] = []
    idx = {(r.fy, r.district_id, r.period, r.scheme, r.component): r.value for r in comps.itertuples(index=False)}
    dists = sorted(set(comps["district_id"]))

    for fy in sorted(set(comps["fy"])):
        src = source_for_fy[fy]
        fname = file_for_fy[fy]
        ovar, omap = offense_scheme(fy)
        rscheme = {2002: "depart02", 2003: "depart03", 2004: "departA", 2005: "mixed2005"}.get(
            fy, "booker" if fy <= 2017 else "sentrnge")
        rvar = {"depart02": "DEPART", "depart03": "DEPART_S/DEPART_D", "departA": "DEPART_A (BLAKPOST both halves)",
                "mixed2005": "DEPART_A (BOOKPOST=0) + BOOKERCD (BOOKPOST=1)", "booker": "BOOKERCD",
                "sentrnge": "SENTRNGE"}[rscheme]
        pooled = fy in (2004, 2005)

        for did in dists:
            def g(period, scheme, comp, default=None):
                return idx.get((fy, did, period, scheme, comp), default)

            def add(var, value, unit, locator, basis, num=None, den=None, source=None, file=None):
                if value is None or (isinstance(value, float) and math.isnan(value)):
                    return
                rows.append({"district_id": did, "period": fy, "period_type": PT, "variable": var,
                             "value": value, "unit": unit, "source_id": source or src,
                             "source_locator": f"{file or fname}: DISTRICT={did}; {locator}", "basis": basis,
                             "numerator": num, "n_basis": den})

            def pct(var, num, den, locator, basis, source=None, file=None):
                if num is None or not den:
                    return
                add(var, _r1(100.0 * num / den), "percent", f"{locator} (n={int(num)}/{int(den)})", basis, num, den,
                    source, file)

            total = g("full", "all", "cases_total")
            add("ussc_cases_total", total, "cases", "count of records", "reproduces_published", total, None)

            # guideline range
            rk = g("full", rscheme, "range_known", 0)
            rbasis = "pooled_published_halves" if pooled else "reproduces_published"
            add("ussc_cases_range_known", rk, "cases", f"{rvar} non-missing", rbasis, rk, None)
            pct("ussc_pct_within_range", g("full", rscheme, "grp_within", 0), rk, f"{rvar} = within range", rbasis)
            pct("ussc_pct_substantial_assistance_5k1", g("full", rscheme, "grp_sa_5k1", 0), rk,
                f"{rvar} = §5K1.1 substantial assistance", rbasis)
            if fy >= 2006:
                pct("ussc_pct_early_disposition_5k3", g("full", rscheme, "grp_edp_5k3", 0), rk,
                    f"{rvar} = §5K3.1 early disposition", "reproduces_published")
            if 2006 <= fy <= 2017:
                gbasis = ("exact_share_of_published_counts" if fy in GROUP_SUM_OF_ROUNDED_YEARS
                          else "reproduces_published")
                pct("ussc_pct_above_range", g("full", rscheme, "grp_above", 0), rk, "BOOKERCD in 1-4", gbasis)
                pct("ussc_pct_govt_sponsored_below_range", g("full", rscheme, "grp_govt_below", 0), rk,
                    "BOOKERCD in 5-7", gbasis)
                pct("ussc_pct_non_govt_sponsored_below_range", g("full", rscheme, "grp_non_govt_below", 0), rk,
                    "BOOKERCD in 8-11", gbasis)
            if fy >= 2018:
                pct("ussc_pct_above_range_2018scheme", g("full", rscheme, "grp_above", 0), rk, "SENTRNGE in {1,6}",
                    "sum_of_published_components")
                pct("ussc_pct_govt_sponsored_below_range_2018scheme", g("full", rscheme, "grp_govt_below", 0), rk,
                    "SENTRNGE in {2,3,4,7}", "sum_of_published_components")
                pct("ussc_pct_non_govt_sponsored_below_range_2018scheme", g("full", rscheme, "grp_non_govt_below", 0),
                    rk, "SENTRNGE in {5,8}", "sum_of_published_components")
                for var, comp, code in [("ussc_pct_upward_departure", "grp_upward_departure", "1"),
                                        ("ussc_pct_other_govt_motion_departure", "grp_other_govt_departure", "4"),
                                        ("ussc_pct_non_govt_downward_departure", "grp_non_govt_departure", "5"),
                                        ("ussc_pct_upward_variance", "grp_upward_variance", "6"),
                                        ("ussc_pct_govt_motion_downward_variance", "grp_govt_variance", "7"),
                                        ("ussc_pct_non_govt_downward_variance", "grp_non_govt_variance", "8"),
                                        ("ussc_pct_variance", "grp_variance", "6,7,8")]:
                    pct(var, g("full", rscheme, comp, 0), rk, f"SENTRNGE in {{{code}}}", "reproduces_published")

            if sup_source_for_fy and fy in sup_source_for_fy:
                ssrc, sfile = sup_source_for_fy[fy], sup_file_for_fy[fy]
                sfile = f"{sfile} joined on USSCIDN to {fname} (for DISTRICT)"
                rk2 = g("full", "sentrnge_sup", "range_known", 0)
                for var, comp, code in [("ussc_pct_above_range_2018scheme", "grp_above", "1,6"),
                                        ("ussc_pct_govt_sponsored_below_range_2018scheme", "grp_govt_below", "2,3,4,7"),
                                        ("ussc_pct_non_govt_sponsored_below_range_2018scheme", "grp_non_govt_below",
                                         "5,8"),
                                        ("ussc_pct_upward_departure", "grp_upward_departure", "1"),
                                        ("ussc_pct_other_govt_motion_departure", "grp_other_govt_departure", "4"),
                                        ("ussc_pct_non_govt_downward_departure", "grp_non_govt_departure", "5"),
                                        ("ussc_pct_upward_variance", "grp_upward_variance", "6"),
                                        ("ussc_pct_govt_motion_downward_variance", "grp_govt_variance", "7"),
                                        ("ussc_pct_non_govt_downward_variance", "grp_non_govt_variance", "8"),
                                        ("ussc_pct_variance", "grp_variance", "6,7,8")]:
                    pct(var, g("full", "sentrnge_sup", comp, 0), rk2, f"supplemental SENTRNGE in {{{code}}}",
                        "computed_ussc_supplemental", ssrc, sfile)

            # prison
            sk = g("full", "SENTIMP", "senttype_known", 0)
            pr = (g("full", "SENTIMP", "senttype_prison_only", 0) or 0) + (g("full", "SENTIMP", "senttype_prison_alt", 0) or 0)
            pct("ussc_pct_prison", pr, sk, "SENTIMP in {1,2} / SENTIMP non-missing (fine-only included)",
                "reproduces_published" if fy >= 2018 else "computed_ussc_definition")

            # sentence length
            n18 = g("full", "sent2018", "n", 0)
            if n18:
                # FY2018+ reproduce the published Table 7 statistic, but the USSC prints it in whole months.
                b = "unrounded_published_statistic" if fy >= 2018 else "computed_ussc_definition"
                v = "SENSPCAP" if fy >= 2018 else "SENSPLT0 (>470 -> 469.99; missing excluded)"
                add("ussc_mean_sentence_months", _r1(g("full", "sent2018", "mean")), "months",
                    f"mean of {v}, probation = 0 (N={int(n18)})", b, None, n18)
                add("ussc_median_sentence_months", _r1(g("full", "sent2018", "median")), "months",
                    f"median of {v}, probation = 0 (N={int(n18)})", b, None, n18)
            npt = g("full", "prison_pre2018", "n", 0)
            add("ussc_cases_prison_term", npt, "cases", f"SENTTOT > 0 and {ovar} non-missing",
                "computed_ussc_definition" if (fy >= 2018 or pooled) else "reproduces_published", npt, None)
            if npt:
                b = "computed_ussc_definition" if (fy >= 2018 or pooled) else (
                    "unrounded_published_statistic" if fy >= WHOLE_MONTHS_FROM else "reproduces_published")
                add("ussc_mean_prison_months", _r1(g("full", "prison_pre2018", "mean")), "months",
                    f"mean of SENTTOT where SENTTOT > 0 and {ovar} non-missing (N={int(npt)})", b, None, npt)
                add("ussc_median_prison_months", _r1(g("full", "prison_pre2018", "median")), "months",
                    f"median of SENTTOT where SENTTOT > 0 and {ovar} non-missing (N={int(npt)})", b, None, npt)

            # offense mix
            ok = g("full", ovar, "offense_known", 0)
            add("ussc_cases_offense_known", ok, "cases", f"{ovar} non-missing", "reproduces_published", ok, None)
            for cat in list(omap) + ["other"]:
                c = g("full", ovar, f"offense_{cat}", 0)
                codes = ",".join(str(x) for x in omap.get(cat, [])) or "all other codes"
                add(f"ussc_count_offense_{cat}", c, "cases", f"{ovar} in {{{codes}}}", "reproduces_published", c, None)
                pct(f"ussc_pct_offense_{cat}", c, ok, f"{ovar} in {{{codes}}}", "reproduces_published")
    return pd.DataFrame(rows)
