"""After Booker: how often federal sentences fall outside the guideline range (USSC)."""
from __future__ import annotations

import pandas as pd

from .common import Story, cell, district_name, ids_of, national, num_json, obs, series, wide

SLUG = "after-booker"
LATEST = 2025
PRE = (1995, 2004)          # fiscal years before Booker (Jan. 12, 2005, decided in FY 2005)
POST_FIRST = 2006           # first full fiscal year after Booker
SPLIT_OLD = ["ussc_pct_above_range", "ussc_pct_govt_sponsored_below_range", "ussc_pct_non_govt_sponsored_below_range"]
SPLIT_NEW = [v + "_2018scheme" for v in SPLIT_OLD]
SCHEME_YEAR = 2018
MIN_BASE = 200              # districts with at least this many range-known cases, for extremes (stated in text)


def build() -> Story:
    s = Story(SLUG)
    wn = national("ussc", "ussc_pct_within_range")
    nat = wn.set_index("period")["value"]
    years = sorted(int(y) for y in nat.index)
    nsrc = ids_of(wn)
    s.year("fy_first", years[0], source_ids=nsrc, how="First fiscal year in the USSC series.", headline=True)
    s.year("fy_latest", LATEST, source_ids=nsrc, how="Latest USSC fiscal year.", headline=True)
    pre = nat.loc[PRE[0]:PRE[1]]
    s.year("pre_last", PRE[1], source_ids=nsrc, how="Last full fiscal year before Booker.", headline=True)
    s.year("post_first", POST_FIRST, source_ids=nsrc, how="First full fiscal year after Booker.")
    psrc = ids_of(wn[wn.period.between(*PRE)])
    s.num("pre_min", pre.min(), "percent", source_ids=psrc, derived=True, headline=True,
          formula=f"lowest national within-range share, FY {PRE[0]} to FY {PRE[1]}", how="Minimum of the published national shares.")
    s.num("pre_max", pre.max(), "percent", source_ids=psrc, derived=True, headline=True,
          formula=f"highest national within-range share, FY {PRE[0]} to FY {PRE[1]}",
          how="Maximum of the national shares (FY 2004 pools the USSC's two part-year tables, so it is derived).")
    post = nat.loc[POST_FIRST:]
    s.num("post_max", post.max(), "percent", source_ids=ids_of(wn[wn.period >= POST_FIRST]), derived=True,
          formula=f"highest national within-range share, FY {POST_FIRST} to FY {LATEST}", how="Maximum of the published national shares.")
    s.year("post_max_year", int(post.idxmax()), source_ids=nsrc, how="Year of that maximum.")
    lo = int(post.idxmin())
    c = cell(wn, None, lo)
    s.num("post_min", c.value, "percent", source_ids=[c.source_id], year=lo, derived=True,
          formula=f"lowest national within-range share, FY {POST_FIRST} to FY {LATEST}", how="Lowest national within-range share since Booker.")
    s.year("post_min_year", lo, source_ids=[c.source_id], how="Year of that low.")
    c = cell(wn, None, LATEST)
    s.num("within_latest", c.value, "percent", source_ids=[c.source_id], year=LATEST, headline=True,
          how=f"National share of sentences within the guideline range, FY {LATEST}, as published.")
    c95 = cell(wn, None, years[0])
    s.num("within_first", c95.value, "percent", source_ids=[c95.source_id], year=years[0],
          how=f"National within-range share, FY {years[0]}, as published (E.D. Va. packet, national column).")

    k = national("ussc", "ussc_pct_substantial_assistance_5k1")
    kk = k.set_index("period")["value"]
    for y in (years[0], LATEST):
        c = cell(k, None, y)
        s.num(f"k1_{y}", c.value, "percent", source_ids=[c.source_id], year=y,
              how=f"National share of sentences with a substantial-assistance (section 5K1.1) departure, FY {y}.")
    pooled = sorted(int(y) for y in wn[wn.derived.astype(bool)]["period"])
    s.chart("within_line", {
        "kind": "line", "unit": "percent", "format": ".1f", "x": years, "y_min": 0, "y_max": 100,
        "title": "Share of federal sentences within the guideline range, all districts",
        "series": [
            {"id": "_within", "label": "Within the range", "role": "focus", "values": series(wn, None, years)},
            {"id": "_k1", "label": "Substantial assistance (section 5K1.1)", "role": "c2", "values": [num_json(kk.get(y)) for y in years]},
        ],
        "derived_x": pooled,
        "source_ids": nsrc + ids_of(k), "derived": True,
        "formula": "FY 2004 and FY 2005 pool the USSC's two part-year tables: (cases in both parts within range) / (range-known cases in both parts) x 100",
        "how": "USSC packets (FY 1995 to 2001, national column) and datafiles (FY 2002 on).",
    })

    # ---- the four-way split ---------------------------------------------------------------
    split_years = list(range(POST_FIRST, LATEST + 1))
    layers = []
    labels = ["Above the range", "Below, government sponsored", "Below, not government sponsored"]
    ids_all = []
    parts = {}
    for old, new, lab in zip(SPLIT_OLD, SPLIT_NEW, labels):
        a = national("ussc", old)
        b = national("ussc", new)
        a = a[a.period < SCHEME_YEAR]
        b = b[b.period >= SCHEME_YEAR]
        both = pd.concat([a, b])
        parts[old] = both.set_index("period")["value"]
        ids_all += ids_of(both)
        layers.append({"id": old, "label": lab, "values": series(both, None, split_years)})
    layers.insert(0, {"id": "_within", "label": "Within the range", "values": series(wn, None, split_years)})
    s.chart("split_stack", {
        "kind": "stack", "unit": "percent", "format": ".1f", "x": split_years, "y_max": 100, "mark_x": SCHEME_YEAR,
        "title": "How federal sentences compare with the guideline range, all districts",
        "layers": layers, "source_ids": nsrc + ids_all, "derived": True,
        "formula": "FY 2018 on: above = USSC sentence-range codes 1 + 6; government sponsored = 2 + 3 + 4 + 7; not government sponsored = 5 + 8 (each as a share of range-known cases)",
        "how": "USSC four-way grouping as printed for FY 2006 to 2017, then rebuilt from the FY 2018 method's components. The two agree exactly in FY 2014 to 2017.",
    })
    for y in (POST_FIRST, LATEST):
        for old, key in zip(SPLIT_OLD, ("above", "govt", "nongovt")):
            src = ids_of(national("ussc", old if y < SCHEME_YEAR else old + "_2018scheme").query("period == @y"))
            deriv = y >= SCHEME_YEAR
            s.num(f"{key}_{y}", parts[old][y], "percent", source_ids=src, year=y, derived=deriv,
                  formula=("sum of the USSC's FY 2018-method components as a share of range-known cases" if deriv else None),
                  how=f"National share, FY {y}.")
    ng = parts["ussc_pct_non_govt_sponsored_below_range"]
    gv = parts["ussc_pct_govt_sponsored_below_range"]
    ab = parts["ussc_pct_above_range"]
    largest = all(gv[y] > ng[y] and gv[y] > ab[y] for y in split_years)
    if not largest:
        raise ValueError("government-sponsored below is no longer the largest group outside the range every year")
    if not all(ab[y] < ng[y] and ab[y] < gv[y] for y in split_years):
        raise ValueError("the text calls above-range sentences the least common of the three groups every year")
    pk = int(ng.idxmax())
    s.num("nongovt_peak", ng[pk], "percent", source_ids=ids_all, year=pk, derived=pk >= SCHEME_YEAR,
          formula=("sum of the USSC's FY 2018-method components" if pk >= SCHEME_YEAR else None),
          how="Highest national share of below-range sentences without a government motion.")
    s.year("nongovt_peak_year", pk, source_ids=ids_all, how="Year of that peak.")

    # ---- districts --------------------------------------------------------------------------
    w = obs("ussc", "ussc_pct_within_range")
    ww = wide(w)
    for y in (PRE[1], 2023, LATEST):
        row = ww.loc[y]
        src = ids_of(w[w.period == y])
        s.num(f"n_major_{y}", int((row > 50).sum()), "districts", source_ids=src, year=y, derived=True, headline=y in (PRE[1], LATEST),
              formula=f"count of districts whose within-range share exceeds 50% in FY {y}", how="Published district shares.")
    s.num("n_districts", int(ww.loc[LATEST].notna().sum()), "districts", source_ids=ids_of(w[w.period == LATEST]),
          derived=True, formula=f"count of districts with a published within-range share in FY {LATEST}",
          how="Districts with a published within-range share.")
    m23 = ww.loc[years[0]:].apply(lambda r: int((r > 50).sum()), axis=1)
    lo_y = int(m23.idxmin())
    if lo_y != 2023:
        raise ValueError("the lowest count of majority-within districts moved")
    s.num("eighty", 80, "percent", decimals=0, source_ids=ids_of(w), how="Threshold used in the text.")
    s.num(f"n_80_{PRE[1]}", int((ww.loc[PRE[1]] >= 80).sum()), "districts", source_ids=ids_of(w[w.period == PRE[1]]), year=PRE[1],
          derived=True, formula=f"count of districts with a within-range share of 80% or more in FY {PRE[1]}", how="Published district shares.")
    zero80 = [y for y in years if int((ww.loc[y] >= 80).sum()) == 0]
    tail = []
    for y in reversed(years):
        if y in zero80:
            tail.append(y)
        else:
            break
    s.year("zero80_since", min(tail), source_ids=ids_of(w[w.period >= min(tail)]),
           how="Start of the run of years, through the latest, in which no district reached 80% within range.")
    s.layer("within", w, label="Sentenced within the guideline range", unit="percent", fmt_spec=".1f",
            higher_means="more sentences within the guideline range",
            how="USSC packets (FY 1995 to 2001) and datafiles. FY 2004 and FY 2005 are derived: each pools the USSC's two part-year tables, "
                "(cases within range in both parts) / (range-known cases in both parts) x 100.")
    counts = [{"year": y, "majority": int((ww.loc[y] > 50).sum()), "eighty": int((ww.loc[y] >= 80).sum())} for y in years]

    # Distribution ribbon.
    q = ww.quantile([0.25, 0.5, 0.75], axis=1).T
    for y in (PRE[1], LATEST):
        s.num(f"iqr_{y}", float(q.loc[y, 0.75] - q.loc[y, 0.25]), "points", source_ids=ids_of(w[w.period == y]), year=y, derived=True,
              formula=f"75th percentile minus 25th percentile of the 94 district within-range shares, FY {y} (linear interpolation)",
              how="Spread of the middle half of districts.")
        s.num(f"median_{y}", float(q.loc[y, 0.5]), "percent", source_ids=ids_of(w[w.period == y]), year=y, derived=True,
              formula=f"median of the 94 district within-range shares, FY {y}", how="The middle district.")
    s.chart("ribbon", {
        "kind": "line", "unit": "percent", "format": ".1f", "x": years, "y_min": 0, "y_max": 100,
        "title": "Within-range share across the 94 districts",
        "series": [
            {"id": "_median", "label": "Median district", "role": "focus", "values": [round(float(q.loc[y, 0.5]), 6) for y in years]},
            {"id": "_national", "label": "All districts pooled", "role": "national", "values": series(wn, None, years)},
        ],
        "band": {"lo": [round(float(q.loc[y, 0.25]), 6) for y in years], "hi": [round(float(q.loc[y, 0.75]), 6) for y in years],
                 "label": "Middle half of districts (25th to 75th percentile)"},
        "band2": {"lo": [num_json(ww.loc[y].min()) for y in years], "hi": [num_json(ww.loc[y].max()) for y in years],
                  "label": "Lowest to highest district"},
        "counts": counts,
        "source_ids": ids_of(w) + nsrc, "derived": True,
        "formula": "percentiles of the 94 published district shares each year (linear interpolation)",
        "how": "USSC district within-range shares.",
    })

    # Non-government below range, latest year, districts with enough cases.
    v = "ussc_pct_non_govt_sponsored_below_range_2018scheme"
    nb = obs("ussc", v)
    row = nb[nb.period == LATEST].set_index("district_id")
    big = row[row.n_basis >= MIN_BASE]
    s.num("min_base", MIN_BASE, "cases", source_ids=ids_of(big), how="Threshold chosen for this comparison: districts with at least this many range-known cases.")
    s.num("n_big", len(big), "districts", source_ids=ids_of(big), derived=True,
          formula=f"count of districts with at least {MIN_BASE} range-known cases in FY {LATEST}", how="USSC counts of cases with a known guideline range.")
    lo_d = big["value"].idxmin()
    hi_d = big["value"].idxmax()
    if (big["value"] == big["value"].min()).sum() > 1 or (big["value"] == big["value"].max()).sum() > 1:
        raise ValueError("tie at the extremes")
    for key, d in (("ng_lo", lo_d), ("ng_hi", hi_d)):
        s.district(key, d, source_ids=ids_of(big), style="name", how=f"District at the {'low' if key == 'ng_lo' else 'high'} end, FY {LATEST}, {MIN_BASE}+ cases.")
        s.num(f"{key}_value", big.loc[d, "value"], "percent", source_ids=[big.loc[d, "source_id"]], year=LATEST, derived=True,
              formula="sum of the USSC's FY 2018-method components 5 + 8 as a share of range-known cases",
              how="Share of the district's sentences below the range without a government motion.")
    s.num("ng_median_big", float(big["value"].median()), "percent", source_ids=ids_of(big), derived=True,
          formula=f"median across districts with {MIN_BASE}+ range-known cases, FY {LATEST}", how="Middle district.")
    s.layer("nongovt", nb[nb.period >= 2014], label="Below the range, not sponsored by the government", unit="percent", fmt_spec=".1f",
            derived=True, formula="USSC FY 2018-method components 5 + 8 as a share of range-known cases",
            higher_means="more below-range sentences without a government motion",
            how="Rebuilt from the USSC's FY 2018 method; identical to the printed grouping in FY 2014 to 2017.")
    items = []
    for d, r in big.iterrows():
        items.append({"id": d, "label": district_name(d), "value": num_json(r.value), "role": "focus" if d in (lo_d, hi_d) else "context"})
    items.sort(key=lambda r: (-r["value"], r["id"]))
    cn = cell(national("ussc", v), None, LATEST)
    s.chart("nongovt_bars", {
        "kind": "bars", "unit": "percent", "format": ".1f", "compact": True,
        "title": f"Below the range without a government motion, FY {LATEST}, districts with {MIN_BASE} or more cases",
        "items": items, "reference": {"label": "All districts", "value": num_json(cn.value)},
        "source_ids": ids_of(big) + [cn.source_id], "derived": True,
        "formula": "USSC FY 2018-method components 5 + 8 as a share of range-known cases",
        "how": "USSC datafile, FY 2025.",
    })
    s.thumb = {"layer": "within", "year": LATEST, "focus": []}
    return s
