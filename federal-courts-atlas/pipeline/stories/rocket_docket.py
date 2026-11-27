"""The Rocket Docket: how fast civil and criminal cases move in the Eastern District of Virginia (FCMS)."""
from __future__ import annotations

from .common import Story, cell, ids_of, national, obs, series, wide

SLUG = "rocket-docket"
D = "vaed"

V_TRIAL = "fcms_median_months_civil_filing_to_trial"
V_DISP = "fcms_median_months_civil_filing_to_disposition"
V_CRIM = "fcms_median_months_criminal_felony_filing_to_disposition"
V_TRIALS = "fcms_trials_completed_per_judgeship"
R = "fcms_rank_us_"


def _runs(years: list[int]) -> list[tuple[int, int]]:
    """Unbroken runs of consecutive years."""
    out: list[tuple[int, int]] = []
    for y in sorted(years):
        if out and y == out[-1][1] + 1:
            out[-1] = (out[-1][0], y)
        else:
            out.append((y, y))
    return out


def band(df, years: list[int]) -> dict:
    w = wide(df)
    lo, hi, n = [], [], []
    for y in years:
        row = w.loc[y].dropna() if y in w.index else []
        lo.append(float(row.min()) if len(row) else None)
        hi.append(float(row.max()) if len(row) else None)
        n.append(int(len(row)))
    return {"lo": lo, "hi": hi, "n": n}


def _fy_span(years: list[int]) -> str:
    """'FY 2010 and FY 2012 to 2025' for a sorted list of fiscal years."""
    runs: list[list[int]] = []
    for y in years:
        if runs and y == runs[-1][1] + 1:
            runs[-1][1] = y
        else:
            runs.append([y, y])
    parts = [f"FY {a}" if a == b else f"FY {a} to {b}" for a, b in runs]
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]


def build() -> Story:
    s = Story(SLUG)

    # ---- civil filing to trial ----------------------------------------------------------
    t = obs("fcms", V_TRIAL)
    tn = national("fcms", V_TRIAL)
    years = sorted(int(y) for y in tn["period"])
    first, latest = years[0], years[-1]
    s.year("fy_first", first, source_ids=ids_of(tn), how="First year with a published civil filing-to-trial median.")
    s.year("fy_latest", latest, source_ids=ids_of(tn), how="Latest year with a published civil filing-to-trial median.", headline=True)

    c = cell(t, D, latest)
    s.num("vaed_trial_latest", c.value, "months", source_ids=[c.source_id], year=latest, headline=True,
          how=f"Median months from filing to civil trial, E.D. Va., FY {latest}, as printed in the FCMS profile.")
    cn = cell(tn, None, latest)
    s.num("us_trial_latest", cn.value, "months", source_ids=[cn.source_id], year=latest, headline=True,
          how=f"Median months from filing to civil trial, all district courts, FY {latest}, as printed.")
    w = wide(t)
    s.num("n_trial_latest", int(w.loc[latest].notna().sum()), "districts", source_ids=ids_of(t[t.period == latest]),
          derived=True, formula=f"count of districts with a published civil trial median in FY {latest}",
          how="Districts for which the FCMS profile prints a median (the AO computes it only with at least ten civil trials).")
    ratio = c.value / cn.value
    rk0 = obs("fcms", R + "median_months_civil_filing_to_trial", "observations_ranks")
    r0 = cell(rk0, D, latest)
    if r0.value != 1 or (rk0[(rk0.period == latest)]["value"] == 1).sum() != 1:
        raise ValueError("E.D. Va. is no longer alone in first place in the latest year (the text says so)")
    s.num("rank_latest", r0.value, "rank", source_ids=[r0.source_id], year=latest, headline=True,
          how=f"Published U.S. standing of E.D. Va., FY {latest} (1 = shortest median).")
    s.num("ratio_latest", ratio, "ratio", source_ids=[c.source_id, cn.source_id], derived=True,
          formula=f"E.D. Va. median / national median, FY {latest}",
          how="Ratio of the two published medians.")

    # Years below half of the national median.
    vv = t[t.district_id == D].set_index("period")["value"]
    nn = tn.set_index("period")["value"]
    both = [y for y in years if y in vv.index]
    below_half = [y for y in both if vv[y] / nn[y] < 0.5]
    src_trial = ids_of(t[t.district_id == D]) + ids_of(tn)
    s.num("n_below_half", len(below_half), "years", source_ids=src_trial, derived=True,
          formula="count of years where E.D. Va. median / national median < 0.5", headline=True,
          how=f"Compared the two published medians in each year, FY {first} to FY {latest}.")
    s.num("n_years_trial", len(both), "years", source_ids=src_trial, derived=True,
          formula="count of years with both medians published",
          how=f"Years with both values published, FY {first} to FY {latest}.")
    ymin = int(vv.idxmin())
    ymax = int(vv.idxmax())
    s.num("vaed_trial_min", vv[ymin], "months", source_ids=[cell(t, D, ymin).source_id], year=ymin,
          how="Lowest published E.D. Va. civil trial median in the series.")
    s.year("vaed_trial_min_year", ymin, source_ids=[cell(t, D, ymin).source_id], how="Year of the lowest median.")
    s.num("vaed_trial_max", vv[ymax], "months", source_ids=[cell(t, D, ymax).source_id], year=ymax,
          how="Highest published E.D. Va. civil trial median in the series.")
    s.year("vaed_trial_max_year", ymax, source_ids=[cell(t, D, ymax).source_id], how="Year of the highest median.")

    b = band(t, years)
    s.chart("trial_line", {
        "kind": "line", "unit": "months", "format": ".1f", "x": years, "y_min": 0,
        "title": "Median months from filing to civil trial",
        "series": [
            {"id": D, "label": "E.D. Va.", "role": "focus", "values": series(t, D, years)},
            {"id": "_national", "label": "All district courts", "role": "national", "values": series(tn, None, years)},
        ],
        "band": {"lo": b["lo"], "hi": b["hi"], "n": b["n"], "label": "Range across districts with a median"},
        "source_ids": ids_of(t) + ids_of(tn),
        "derived": True, "formula": "band = lowest and highest published district median in each year",
        "how": "Published medians; the shaded band spans the lowest to the highest district median each year.",
    })

    # ---- published standings ------------------------------------------------------------
    rk = obs("fcms", R + "median_months_civil_filing_to_trial", "observations_ranks")
    rv = rk[rk.district_id == D].set_index("period")["value"]
    ryears = sorted(int(y) for y in rv.index)
    firsts = [y for y in ryears if rv[y] == 1]
    rsrc = ids_of(rk[rk.district_id == D])
    s.year("fy_rank_first", ryears[0], source_ids=rsrc, how="First year with a published national standing.")
    s.num("n_first", len(firsts), "years", source_ids=rsrc, derived=True, headline=True,
          formula="count of years where the published U.S. standing of E.D. Va. = 1",
          how=f"Counted years with a published standing of 1, FY {ryears[0]} to FY {ryears[-1]}.")
    s.num("n_rank_years", len(ryears), "years", source_ids=rsrc, headline=True, derived=True,
          formula="count of years with a published U.S. standing for E.D. Va.",
          how=f"Years with a published national standing, FY {ryears[0]} to FY {ryears[-1]}.")
    runs = [r for r in _runs(firsts) if r[1] > r[0]]
    runs.sort(key=lambda r: (-(r[1] - r[0]), r[0]))
    runs = sorted(runs[:2])
    for i, (a, z) in enumerate(runs, start=1):
        s.year(f"run{i}_start", a, source_ids=rsrc, how=f"Start of unbroken run {i} of first-place standings.")
        s.year(f"run{i}_end", z, source_ids=rsrc, how=f"End of unbroken run {i} of first-place standings.")
    # Who was first when E.D. Va. was not.
    leaders = []
    for y in ryears:
        top = rk[(rk.period == y) & (rk.value == 1)]
        leaders.append({"year": y, "id": str(top.iloc[0].district_id) if len(top) == 1 else None})
    others = [(y, ld["id"]) for y, ld in zip(ryears, leaders) if ld["id"] != D]
    # Group consecutive years with the same leader.
    groups: list[list] = []
    for y, did in others:
        if groups and groups[-1][0] == did and y == groups[-1][2] + 1:
            groups[-1][2] = y
        else:
            groups.append([did, y, y])
    for i, (did, a, z) in enumerate(groups, start=1):
        src = ids_of(rk[(rk.period >= a) & (rk.period <= z) & (rk.value == 1)])
        s.district(f"other{i}", did, source_ids=src, style="name",
                   how=f"District with a published U.S. standing of 1 in FY {a}" + (f" to FY {z}" if z > a else "") + ".")
        s.year(f"other{i}_start", a, source_ids=src, how="First year of that district's first-place standing.")
        if z > a:
            s.year(f"other{i}_end", z, source_ids=src, how="Last year of that district's first-place standing.")
        own = cell(rk, D, a)
        s.num(f"other{i}_vaed_rank", own.value, "rank", source_ids=[own.source_id], year=a,
              how=f"Published U.S. standing of E.D. Va. in FY {a}.")
    worst_y = int(rv.idxmax())
    if worst_y != 2021:
        raise ValueError("the text calls the worst year the first full fiscal year of the pandemic (FY 2021)")
    s.year("fy_worst", worst_y, source_ids=rsrc, how="Year of E.D. Va.'s lowest published standing.")
    s.num("rank_worst", rv[worst_y], "rank", source_ids=[cell(rk, D, worst_y).source_id], year=worst_y, derived=True,
          formula="largest (lowest) published U.S. standing of E.D. Va. across the years shown",
          how="Lowest published U.S. standing of E.D. Va.")
    cw = cell(t, D, worst_y)
    s.num("vaed_trial_worst", cw.value, "months", source_ids=[cw.source_id], year=worst_y,
          how=f"E.D. Va. civil trial median in FY {worst_y}.")
    of = rk.groupby("period").size()
    s.chart("trial_rank", {
        "kind": "rankstrip", "x": ryears, "title": "E.D. Va.'s published national standing, civil filing to trial",
        "focus": D, "focus_label": "E.D. Va.",
        "ranks": [int(rv[y]) for y in ryears], "of": [int(of[y]) for y in ryears],
        "leaders": leaders,
        "source_ids": ids_of(rk[(rk.district_id == D) | (rk.value == 1)]) + ids_of(rk),
        "derived": False,
        "how": "Numerical standing within the U.S. as printed in each FCMS profile (1 = shortest median).",
    })

    # ---- districts with a median, FY 2019 vs 2020 ------------------------------------------
    for y in (2019, 2020):
        s.num(f"n_trial_{y}", int(w.loc[y].notna().sum()), "districts", source_ids=ids_of(t[t.period == y]), year=y,
              derived=True, formula=f"count of districts with a published civil trial median in FY {y}",
              how="Districts for which the FCMS profile prints a median.")
    s.layer("civil_trial", t, label="Median months from filing to civil trial", unit="months", fmt_spec=".1f",
            higher_means="slower", how="Published FCMS medians. No data where the AO did not compute one (fewer than ten civil trials).")

    # ---- civil filing to disposition --------------------------------------------------------
    d = obs("fcms", V_DISP)
    dn = national("fcms", V_DISP)
    dv = d[d.district_id == D].set_index("period")["value"]
    dnv = dn.set_index("period")["value"]
    dyears = sorted(int(y) for y in dnv.index)
    below = [y for y in dyears if y in dv.index and dv[y] < dnv[y]]
    dsrc = ids_of(d[d.district_id == D]) + ids_of(dn)
    s.num("n_disp_below", len(below), "years", source_ids=dsrc, derived=True,
          formula="count of years where E.D. Va. median < national median",
          how=f"Compared the published medians in each year, FY {dyears[0]} to FY {dyears[-1]}.")
    s.num("n_disp_years", len(dyears), "years", source_ids=dsrc, derived=True,
          formula="count of years with both medians published", how="Years with both values published.")
    if len(below) != len(dyears):
        raise ValueError("the text says E.D. Va. was below the national civil median in every year")
    cd = cell(d, D, latest)
    s.num("vaed_disp_latest", cd.value, "months", source_ids=[cd.source_id], year=latest,
          how=f"Median months from filing to disposition, civil, E.D. Va., FY {latest}.")
    cdn = cell(dn, None, latest)
    s.num("us_disp_latest", cdn.value, "months", source_ids=[cdn.source_id], year=latest,
          how=f"Median months from filing to disposition, civil, all district courts, FY {latest}.")
    rd = obs("fcms", R + "median_months_civil_filing_to_disposition", "observations_ranks")
    rdv = rd[rd.district_id == D].set_index("period")["value"]
    top5 = [y for y in rdv.index if rdv[y] <= 5]
    rdsrc = ids_of(rd[rd.district_id == D])
    s.num("n_disp_top5", len(top5), "years", source_ids=rdsrc, derived=True,
          formula="count of years where the published U.S. standing of E.D. Va. <= 5",
          how="Counted published standings of 5 or better.")
    s.num("n_disp_rank_years", len(rdv), "years", source_ids=rdsrc, derived=True,
          formula="count of years with a published U.S. standing for E.D. Va.", how="Years with a published standing.")
    s.chart("disp_line", {
        "kind": "line", "unit": "months", "format": ".1f", "x": dyears, "y_min": 0,
        "title": "Median months from filing to disposition, civil cases",
        "series": [
            {"id": D, "label": "E.D. Va.", "role": "focus", "values": series(d, D, dyears)},
            {"id": "_national", "label": "All district courts", "role": "national", "values": series(dn, None, dyears)},
        ],
        "source_ids": ids_of(d[d.district_id == D]) + ids_of(dn), "derived": False,
        "how": "Published medians.",
    })

    # ---- felony filing to disposition (current method) -------------------------------------
    cr = obs("fcms", V_CRIM, "observations_current_method")
    crn = national("fcms", V_CRIM, current_method=True)
    cyears = sorted(int(y) for y in crn["period"])
    crv = cr[cr.district_id == D].set_index("period")["value"]
    crnv = crn.set_index("period")["value"]
    cbelow = [y for y in cyears if y in crv.index and crv[y] < crnv[y]]
    csrc = ids_of(cr[cr.district_id == D]) + ids_of(crn)
    s.year("fy_crim_first", cyears[0], source_ids=ids_of(crn), how="First year of the current-method series.")
    s.num("n_crim_below", len(cbelow), "years", source_ids=csrc, derived=True,
          formula="count of years where E.D. Va. median < national median",
          how="Compared the published medians in each year of the current-method series.")
    s.num("n_crim_years", len(cyears), "years", source_ids=csrc, derived=True,
          formula="count of years in the current-method series", how="Years in the current-method series.")
    if len(cbelow) != len(cyears):
        raise ValueError("the text says E.D. Va. was below the national felony median in every year")
    rc = obs("fcms", R + "median_months_criminal_felony_filing_to_disposition", "observations_ranks")
    # Only standings that rank the same defendant-based median as the series shown. The own-year FY 2005 to
    # 2009 and FY 2011 profiles rank the older case-based median (data audit 2026-11-27, auditor B).
    rsel = rc[(rc.district_id == D) & (rc.period.isin(cyears)) & (rc["method"] == "crim_defendants")]
    rcv = rsel.set_index("period")["value"]
    rcsrc = ids_of(rsel)
    ryears = sorted(int(y) for y in rcv.index)
    left_out = [y for y in cyears if y not in ryears]
    rhow = (f"Published U.S. standings, {_fy_span(ryears)}: the years whose profile ranks the defendant-based "
            "median shown here.")
    if left_out:
        rhow += f" The profiles for {_fy_span(left_out)} rank an older case-based median, so they are left out."
    s.num("crim_rank_best", rcv.min(), "rank", source_ids=rcsrc, derived=True,
          formula="best published U.S. standing of E.D. Va. in the years ranked on the defendant-based median",
          how=rhow)
    s.num("crim_rank_worst", rcv.max(), "rank", source_ids=rcsrc, derived=True,
          formula="lowest published U.S. standing of E.D. Va. in the years ranked on the defendant-based median",
          how=rhow)
    cc = cell(cr, D, latest)
    s.num("vaed_crim_latest", cc.value, "months", source_ids=[cc.source_id], year=latest,
          how=f"Median months, felony filing to disposition, E.D. Va., FY {latest}.")
    ccn = cell(crn, None, latest)
    s.num("us_crim_latest", ccn.value, "months", source_ids=[ccn.source_id], year=latest,
          how=f"Median months, felony filing to disposition, all district courts, FY {latest}.")
    top = rc[(rc.period == latest) & (rc.value == 1)]
    s.district("fastest_crim_latest", str(top.iloc[0].district_id), source_ids=ids_of(top), style="short",
               how=f"District with a published U.S. standing of 1 in FY {latest}.")
    ctop = cell(cr, str(top.iloc[0].district_id), latest)
    s.num("fastest_crim_value", ctop.value, "months", source_ids=[ctop.source_id], year=latest,
          how="That district's published median.")
    cb = band(cr, cyears)
    s.chart("crim_line", {
        "kind": "line", "unit": "months", "format": ".1f", "x": cyears, "y_min": 0,
        "title": "Median months from filing to disposition, felony defendants",
        "series": [
            {"id": D, "label": "E.D. Va.", "role": "focus", "values": series(cr, D, cyears)},
            {"id": "_national", "label": "All district courts", "role": "national", "values": series(crn, None, cyears)},
        ],
        "band": {"lo": cb["lo"], "hi": cb["hi"], "n": cb["n"], "label": "Range across districts"},
        "source_ids": ids_of(cr) + ids_of(crn),
        "derived": True, "formula": "band = lowest and highest published district median in each year",
        "how": "FCMS current-method series (felony defendants; time measured from the proceeding date since March 2012).",
    })

    # ---- trials completed per judgeship ------------------------------------------------------
    tr = obs("fcms", V_TRIALS)
    trn = national("fcms", V_TRIALS)
    tyears = sorted(int(y) for y in trn["period"])
    trv = tr[tr.district_id == D].set_index("period")["value"]
    trnv = trn.set_index("period")["value"]
    more = [y for y in tyears if trv[y] > trnv[y]]
    equal = [y for y in tyears if trv[y] == trnv[y]]
    tsrc = ids_of(tr[tr.district_id == D]) + ids_of(trn)
    s.num("n_trials_more", len(more), "years", source_ids=tsrc, derived=True,
          formula="count of years where E.D. Va. trials per judgeship > national figure",
          how="Compared the published figures in each year.")
    s.num("n_trials_years", len(tyears), "years", source_ids=tsrc, derived=True,
          formula="count of years with both figures published", how="Years with both figures published.")
    if len(equal) == 1:
        s.year("fy_trials_equal", equal[0], source_ids=tsrc, how="The one year the two figures were equal.")
    ct = cell(tr, D, latest)
    s.num("vaed_trials_latest", ct.value, "per_judgeship", source_ids=[ct.source_id], year=latest,
          how=f"Trials completed per judgeship, E.D. Va., FY {latest}.")
    ctn = cell(trn, None, latest)
    s.num("us_trials_latest", ctn.value, "per_judgeship", source_ids=[ctn.source_id], year=latest,
          how=f"Trials completed per judgeship, all district courts, FY {latest}.")
    c0 = cell(tr, D, tyears[0])
    s.num("vaed_trials_first", c0.value, "per_judgeship", source_ids=[c0.source_id], year=tyears[0],
          how=f"Trials completed per judgeship, E.D. Va., FY {tyears[0]}.")
    c0n = cell(trn, None, tyears[0])
    s.num("us_trials_first", c0n.value, "per_judgeship", source_ids=[c0n.source_id], year=tyears[0],
          how=f"Trials completed per judgeship, all district courts, FY {tyears[0]}.")
    s.chart("trials_line", {
        "kind": "line", "unit": "per_judgeship", "format": ".0f", "x": tyears, "y_min": 0,
        "title": "Trials completed per authorized judgeship",
        "series": [
            {"id": D, "label": "E.D. Va.", "role": "focus", "values": series(tr, D, tyears)},
            {"id": "_national", "label": "All district courts", "role": "national", "values": series(trn, None, tyears)},
        ],
        "source_ids": tsrc, "derived": False, "how": "Published figures.",
    })

    s.thumb = {"layer": "civil_trial", "year": latest, "focus": [D]}
    return s
