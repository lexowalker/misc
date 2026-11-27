"""FY1995-FY2001: values taken directly from the USSC Statistical Information Packets.

The USSC does not post Individual Offender datafiles before FY2002 on its datafiles page,
but it does post a packet per district for FY1995-FY2001. Those packets use the same
table layouts as FY2002 (whose values this lane reproduces exactly from the datafile), so
the published district figures are used as a fallback for the variables whose
definitions are identical:

* Table 8 (all districts, read from the E.D. Va. packet): within-range and §5K1.1 shares
  and the range denominator.
* Each district's own packet: Table 1 note (cases total), Table 1 (offense mix: drug
  trafficking, immigration, firearms, fraud; 'other' = TOTAL minus those four), Table 7
  TOTAL row (mean/median length of imprisonment and its N).
"""
from __future__ import annotations

import re

from .crosswalk import district_from_header, district_from_prose
from .packets import Table, all_district_rows, find_table, labelled_rows, packet_text, split_tables
from .validate import OFFENSE_LABELS, _norm

PT = "FY_SEP30"


def _row(did, fy, var, value, unit, src, loc, basis="published_packet", num=None, den=None):
    return {"district_id": did, "period": fy, "period_type": PT, "variable": var, "value": value, "unit": unit,
            "source_id": src, "source_locator": loc, "basis": basis, "numerator": num, "n_basis": den}


def all_district_values(fy: int, text: str, src: str, fname: str) -> list[dict]:
    """Within-range and §5K1.1 shares for every district (and 'US') from packet Table 8."""
    out: list[dict] = []
    t8 = find_table(split_tables(text), 8)
    if t8 is None:
        return out
    for row in all_district_rows(t8):
        nums = row.numbers
        if len(nums) != 9 or nums[0] is None:
            continue
        total, wn, wp, san, sap = nums[0], nums[1], nums[2], nums[3], nums[4]
        loc = f"{fname} Table 8 'Guideline departure rate by circuit and district', row {row.district_id}"
        out.append(_row(row.district_id, fy, "ussc_cases_range_known", total, "cases", src, loc + ", TOTAL",
                        num=total))
        if wp is not None:
            out.append(_row(row.district_id, fy, "ussc_pct_within_range", wp, "percent", src,
                            loc + f", 'Sentenced within guideline range' % (n={int(wn)}/{int(total)})", num=wn,
                            den=total))
        if sap is not None:
            out.append(_row(row.district_id, fy, "ussc_pct_substantial_assistance_5k1", sap, "percent", src,
                            loc + f", 'Substantial assistance departure' % (n={int(san)}/{int(total)})", num=san,
                            den=total))
    return out


NOTE_RE = re.compile(r"Of the ([\d,]+) guideline cases from (?:the )?(.+?),\s*(?:no|one|two|three|four|five|six|"
                     r"seven|eight|nine|ten|eleven|twelve|[\d,]+) cases?", re.S)


def note_districts(text: str) -> list[tuple[float, str | None, str]]:
    """(N, resolved district id or None, raw name) for every 'Of the N guideline cases from X, ...' note."""
    return [(float(n.replace(",", "")), district_from_prose(name), re.sub(r"\s+", " ", name))
            for n, name in NOTE_RE.findall(text)]


_HEADER_LINE = re.compile(r"\bNational\b")


def column_header(table: Table) -> str | None:
    """The district column header of a district-packet table: the text after 'National' on the
    first number-free header line ('National   Middle Louisiana' -> 'Middle Louisiana')."""
    for ln in table.lines[:25]:
        if _HEADER_LINE.search(ln) and not re.search(r"\d", ln):
            rest = re.sub(r"\s+", " ", _HEADER_LINE.sub(" ", ln, count=1)).strip()
            if rest:
                return rest
    return None


def header_problem(table: Table, did: str) -> str | None:
    """Why ``table`` must not be used for ``did`` judged by its column header, or None if the header
    names ``did``. The header labels the column the values are read from, so it is authoritative: the
    FY1998 W.D. La. packet (LAW98.pdf) is M.D. La.'s packet throughout ('Middle Louisiana' in every
    header) although only some of its notes name a district."""
    h = column_header(table)
    if h is None:
        return "no 'National | <district>' column header found"
    rid = district_from_header(h)
    if rid != did:
        return f"column header reads '{h}' ({rid or 'not a single district'})"
    return None


def district_values(fy: int, did: str, text: str, src: str, fname: str, national: bool = False,
                    problems: list | None = None) -> list[dict]:
    """Cases total, offense mix and imprisonment length for one district (or 'US' columns).

    Safety checks (the FY1995-FY2001 packets contain copy-and-paste slips):
      * a table whose district column header does not name this district is not used (the header
        labels the column the values come from);
      * a table whose notes name a *different* district is not used for this district;
      * the cases total is taken only from notes that name this district, and only if they agree;
      * Table 7 needs a complete TOTAL row (6 numbers); counts must not exceed the cases total.
    Skipped items are appended to ``problems`` (recorded as data gaps by the build).
    """
    out: list[dict] = []
    problems = problems if problems is not None else []
    tables = split_tables(text)
    who = "US" if national else did
    col = 0 if national else 2           # national columns come first in district packets

    def foreign(t) -> str | None:
        if national:
            return None
        if (bad_header := header_problem(t, did)) is not None:
            return bad_header
        for _n, rid, raw in note_districts(t.text):
            if rid is not None and rid != did:
                return f"note names {raw} ({rid})"
        return None

    # cases total
    cases_total = None
    if national:
        t1 = find_table(tables, 1)
        nat_notes = re.findall(r"Of the ([\d,]+) guideline cases,", t1.text) if t1 is not None else []
        if nat_notes:
            cases_total = float(nat_notes[0].replace(",", ""))
            out.append(_row(who, fy, "ussc_cases_total", cases_total, "cases", src,
                            f"{fname} Table 1 note 'Of the N guideline cases'", num=cases_total))
    else:
        own = {}
        for t in tables:
            for n, rid, _raw in note_districts(t.text):
                if rid == did:
                    own.setdefault(n, []).append(t.number)
        if len(own) == 1:
            cases_total, tabs = next(iter(own.items()))
            out.append(_row(who, fy, "ussc_cases_total", cases_total, "cases", src,
                            f"{fname} note 'Of the N guideline cases from <district>' (Tables "
                            f"{', '.join(str(x) for x in sorted(set(tabs)))})", num=cases_total))
        elif len(own) > 1:
            problems.append((fy, did, "ussc_cases_total", f"notes disagree: {sorted(own)}"))
        else:
            problems.append((fy, did, "ussc_cases_total", "no note in the packet names this district's total"))

    t1 = find_table(tables, 1)
    if t1 is not None and (bad := foreign(t1)):
        problems.append((fy, did, "offense mix (Table 1)", f"Table 1 not for this district: {bad}"))
        t1 = None
    if t1 is not None:
        counts: dict[str, float] = {}
        total = None
        rows_t1 = []
        for label, nums in labelled_rows(t1):
            key = _norm(label)
            if len(nums) < 4:
                continue
            if key == "total" and total is None:
                total = nums[col]
            elif key in OFFENSE_LABELS and OFFENSE_LABELS[key] in ("drug_trafficking", "immigration", "firearms",
                                                                    "fraud") and OFFENSE_LABELS[key] not in counts:
                counts[OFFENSE_LABELS[key]] = nums[col]
                rows_t1.append((OFFENSE_LABELS[key], label, nums))
        if total and cases_total is not None and total > cases_total:
            problems.append((fy, did, "offense mix (Table 1)", f"Table 1 TOTAL {total} exceeds cases total"))
            total = None
        if total:
            loc = f"{fname} Table 1, row 'TOTAL'"
            out.append(_row(who, fy, "ussc_cases_offense_known", total, "cases", src, loc, num=total))
            for cat, label, nums in rows_t1:
                loc1 = f"{fname} Table 1 'Distribution of guideline defendants by primary offense', row '{label}'"
                out.append(_row(who, fy, f"ussc_count_offense_{cat}", nums[col], "cases", src, loc1 + ", Number",
                                num=nums[col]))
                out.append(_row(who, fy, f"ussc_pct_offense_{cat}", nums[col + 1], "percent", src,
                                loc1 + f", Percent (n={int(nums[col])}/{int(total)})", num=nums[col], den=total))
            if len(counts) == 4:
                other = total - sum(counts.values())
                out.append(_row(who, fy, "ussc_count_offense_other", other, "cases", src,
                                loc + " minus the drug-trafficking, immigration, firearms and fraud rows",
                                basis="derived_from_published_counts", num=other))
                out.append(_row(who, fy, "ussc_pct_offense_other", float(f"{100.0 * other / total:.1f}"), "percent",
                                src, loc + f" minus the four named rows (n={int(other)}/{int(total)})",
                                basis="derived_from_published_counts", num=other, den=total))

    t7 = find_table(tables, 7)
    if t7 is None:
        problems.append((fy, did, "imprisonment length (Table 7)", "Table 7 heading not found in the PDF text layer"))
    elif bad := foreign(t7):
        problems.append((fy, did, "imprisonment length (Table 7)", f"Table 7 not for this district: {bad}"))
    else:
        done = False
        for label, nums in labelled_rows(t7):
            if _norm(label) == "total":
                if len(nums) < 6:
                    break
                mn, md, n = nums[3 * (0 if national else 1): 3 * (0 if national else 1) + 3]
                if n is not None and cases_total is not None and n > cases_total:
                    problems.append((fy, did, "imprisonment length (Table 7)", f"N {n} exceeds cases total"))
                    done = True
                    break
                loc = f"{fname} Table 7 'Average length of imprisonment', row 'TOTAL'"
                if n is not None:
                    out.append(_row(who, fy, "ussc_cases_prison_term", n, "cases", src, loc + ", Number", num=n))
                if mn is not None:
                    out.append(_row(who, fy, "ussc_mean_prison_months", mn, "months", src, loc + ", Mean Months",
                                    den=n))
                if md is not None:
                    out.append(_row(who, fy, "ussc_median_prison_months", md, "months", src, loc + ", Median Months",
                                    den=n))
                done = True
                break
        if not done:
            problems.append((fy, did, "imprisonment length (Table 7)", "TOTAL row incomplete in the PDF text layer"))
    return out
