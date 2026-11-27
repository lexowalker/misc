"""How Texas became the patent capital, and what happened after TC Heartland (IDB, NOS 830 and 835)."""
from __future__ import annotations

import pandas as pd

from .common import PROC, Story, cell, ids_of, national, num_json, obs, series, wide

SLUG = "patent-capital"
TX = ["txed", "txwd", "txnd", "txsd"]
FOCUS = [("txed", "E.D. Tex.", "c1"), ("ded", "D. Del.", "c2"), ("txwd", "W.D. Tex.", "c3")]
# Four full calendar quarters before and after TC Heartland v. Kraft Foods (decided May 22, 2017, in 2017Q2,
# which is left out of both windows). See src/content/events.ts for the date.
BEFORE = ["2016Q2", "2016Q3", "2016Q4", "2017Q1"]
AFTER = ["2017Q3", "2017Q4", "2018Q1", "2018Q2"]
WINDOW_DISTRICTS = [("txed", "E.D. Tex."), ("ded", "D. Del."), ("cacd", "C.D. Cal."), ("cand", "N.D. Cal."),
                    ("njd", "D.N.J.")]
QUARTERS_FROM = "2012Q1"
PRELIM_FY = 2026  # IDB FY 2026 has no AO cross-check yet (IDB lane)


def quarterly() -> pd.DataFrame:
    return pd.read_csv(PROC / "idb" / "patent_quarterly.csv", keep_default_na=False, na_values=[""])


def build() -> Story:
    s = Story(SLUG)
    p = obs("idb", "idb_patent_filed")
    pn = national("idb", "idb_patent_filed")
    src = ids_of(p) + ids_of(pn)
    w = wide(p)
    nat = pn.set_index("period")["value"]
    years = sorted(int(y) for y in nat.index)
    full_years = [y for y in years if y < PRELIM_FY]
    s.year("fy_first", years[0], source_ids=ids_of(pn), how="First fiscal year in the IDB civil file used here.")
    s.year("fy_prelim", PRELIM_FY, source_ids=ids_of(pn), how="Latest IDB fiscal year; no AO cross-check yet.")

    # ---- national totals -----------------------------------------------------------------
    s.num("us_first", nat[years[0]], "cases", source_ids=ids_of(pn), year=years[0],
          how=f"Patent cases (nature of suit 830) filed in all district courts, FY {years[0]}, IDB.")
    peak = int(nat.loc[full_years].idxmax())
    s.num("us_peak", nat[peak], "cases", source_ids=ids_of(pn), year=peak, headline=True,
          how=f"Highest national count of patent cases filed, FY {years[0]} to FY {PRELIM_FY}.")
    s.year("us_peak_year", peak, source_ids=ids_of(pn), how="Year of the national peak.", headline=True)
    if int(nat.idxmax()) != peak:
        raise ValueError("national patent peak falls in a preliminary year")
    s.num("us_2025", nat[2025], "cases", source_ids=ids_of(pn), year=2025, headline=True,
          how="Patent cases filed in all district courts, FY 2025.")
    s.chart("national_line", {
        "kind": "line", "unit": "cases", "format": ",.0f", "x": years, "y_min": 0, "prelim_from": PRELIM_FY,
        "title": "Patent cases filed in all federal district courts",
        "series": [{"id": "_national", "label": "All district courts", "role": "focus", "values": series(pn, None, years)}],
        "source_ids": ids_of(pn), "derived": False,
        "how": "IDB civil file, nature of suit 830, by fiscal year of filing. FY 2026 is preliminary.",
    })

    # ---- E.D. Tex. FY 2015 ------------------------------------------------------------------
    sh = obs("idb", "idb_patent_share_of_national")
    c = cell(p, "txed", 2015)
    s.num("txed_2015", c.value, "cases", source_ids=[c.source_id], year=2015, headline=True,
          how="Patent cases filed in E.D. Tex., FY 2015.")
    s.num("us_2015", nat[2015], "cases", source_ids=ids_of(pn), year=2015, how="Patent cases filed nationally, FY 2015.")
    cs = cell(sh, "txed", 2015)
    s.num("txed_share_2015", cs.value, "percent", source_ids=[cs.source_id], year=2015, headline=True, derived=True,
          formula="E.D. Tex. patent filings / national patent filings x 100 (FY 2015)",
          how="The IDB lane's share of national patent filings.")
    txs = sh[sh.district_id == "txed"].set_index("period")["value"]
    if int(txs.idxmax()) != 2015 or int(w["txed"].idxmax()) != 2015:
        raise ValueError("E.D. Tex. FY 2015 is no longer its peak")
    s.layer("patent_share", sh[sh.period <= PRELIM_FY], label="Share of the nation's patent cases filed", unit="percent",
            fmt_spec=".1f", derived=True, formula="district patent filings / national patent filings x 100",
            higher_means="a larger share of the nation's patent suits",
            how="IDB civil file, nature of suit 830, by fiscal year of filing.")

    # ---- leaders by fiscal year --------------------------------------------------------------
    leaders = {}
    for y in years:
        row = w.loc[y].dropna()
        top = row[row == row.max()]
        leaders[y] = str(top.index[0]) if len(top) == 1 else None
    txed_years = [y for y in years if leaders[y] == "txed"]
    first_lead = txed_years[0]
    # The first era runs from E.D. Tex.'s first year in the lead through the last year of that era before
    # a different district led two years in a row.
    era_end = first_lead
    y = first_lead
    while y + 1 in leaders:
        if leaders[y + 1] == "txed":
            era_end = y + 1
        elif leaders.get(y + 2) != "txed":
            break
        y += 1
    exc = [y for y in range(first_lead, era_end + 1) if leaders[y] != "txed"]
    if len(exc) != 2:
        raise ValueError("the text names exactly two exception years")
    s.year("txed_lead_first", first_lead, source_ids=src, how="First fiscal year E.D. Tex. had the most patent filings of any district.")
    s.year("txed_lead_last", era_end, source_ids=src, how="Last fiscal year of that first run in the lead.")
    s.num("txed_lead_exceptions", len(exc), "years", source_ids=src, derived=True,
          formula="count of years in the run where another district had the most patent filings",
          how="Compared every district's filings in each year.")
    for i, y in enumerate(exc, start=1):
        s.year(f"lead_exc{i}", y, source_ids=src, how="A year in the run when another district led.")
        s.district(f"lead_exc{i}_district", leaders[y], source_ids=src, style="short",
                   how=f"District with the most patent filings in FY {y}.")
    s.chart("leaders", {
        "kind": "leaders", "x": years, "leaders": [leaders[y] for y in years],
        "values": [num_json(w.loc[y, leaders[y]]) if leaders[y] else None for y in years],
        "source_ids": src, "derived": True, "formula": "district with the most patent filings in each fiscal year",
        "how": "Argmax of patent filings across the 94 districts each year.",
    })

    # ---- annual lines ------------------------------------------------------------------------
    ayears = [y for y in years if y >= 2000]
    other = (pn.set_index("period")["value"] - w[[d for d, _, _ in FOCUS]].sum(axis=1)).loc[ayears]
    s.chart("annual_lines", {
        "kind": "line", "unit": "cases", "format": ",.0f", "x": ayears, "y_min": 0, "prelim_from": PRELIM_FY,
        "title": "Patent cases filed per fiscal year",
        "series": [{"id": d, "label": lab, "role": role, "values": series(p, d, ayears)} for d, lab, role in FOCUS]
        + [{"id": "_other", "label": "All other districts combined", "role": "context",
            "values": [num_json(other[y]) for y in ayears]}],
        "source_ids": src, "derived": True, "formula": "all other districts = national filings minus the three districts shown",
        "how": "IDB civil file, nature of suit 830, by fiscal year of filing. FY 2026 is preliminary.",
    })

    # ---- TC Heartland windows (NOS 830 + 835, calendar quarters) ------------------------------
    q = quarterly()
    qsrc = ids_of(q)
    bsum = q[q.quarter.isin(BEFORE)].groupby("district_id")["nos830_835"].sum()
    asum = q[q.quarter.isin(AFTER)].groupby("district_id")["nos830_835"].sum()
    for key, ss in (("before", bsum), ("after", asum)):
        s.num(f"us_{key}", ss["_national"], "cases", source_ids=qsrc,
              derived=True, formula="sum of national nature-of-suit 830 and 835 filings over the four quarters",
              how="Calendar quarters of the AO filing date, IDB patent_quarterly table.")
    items = []
    for d, lab in WINDOW_DISTRICTS:
        bs = bsum[d] / bsum["_national"] * 100
        as_ = asum[d] / asum["_national"] * 100
        s.num(f"{d}_before", bsum[d], "cases", source_ids=qsrc, derived=True,
              formula=f"sum of {lab} nature-of-suit 830 and 835 filings, {BEFORE[0]} to {BEFORE[-1]}",
              how="Four full calendar quarters before the decision quarter.")
        s.num(f"{d}_after", asum[d], "cases", source_ids=qsrc, derived=True,
              formula=f"sum of {lab} nature-of-suit 830 and 835 filings, {AFTER[0]} to {AFTER[-1]}",
              how="Four full calendar quarters after the decision quarter.")
        s.num(f"{d}_before_share", bs, "percent", source_ids=qsrc, derived=True, headline=d in ("txed", "ded"),
              formula=f"{lab} filings / national filings x 100, {BEFORE[0]} to {BEFORE[-1]} (NOS 830 + 835)",
              how="Share of national patent filings in the four quarters before.")
        s.num(f"{d}_after_share", as_, "percent", source_ids=qsrc, derived=True, headline=d in ("txed", "ded"),
              formula=f"{lab} filings / national filings x 100, {AFTER[0]} to {AFTER[-1]} (NOS 830 + 835)",
              how="Share of national patent filings in the four quarters after.")
        items.append({"id": d, "label": lab, "before": round(float(bs), 6), "after": round(float(as_), 6),
                      "before_n": int(bsum[d]), "after_n": int(asum[d])})
    rest_b = bsum["_national"] - sum(bsum[d] for d, _ in WINDOW_DISTRICTS)
    rest_a = asum["_national"] - sum(asum[d] for d, _ in WINDOW_DISTRICTS)
    items.append({"id": "_other", "label": "All other districts", "before": round(float(rest_b / bsum["_national"] * 100), 6),
                  "after": round(float(rest_a / asum["_national"] * 100), 6), "before_n": int(rest_b), "after_n": int(rest_a)})
    s.chart("window_slope", {
        "kind": "slope", "unit": "percent", "format": ".1f",
        "title": "Share of the nation's patent filings, four quarters before and after TC Heartland",
        "left_label": "Apr. 2016 to Mar. 2017", "right_label": "July 2017 to June 2018",
        "items": items, "source_ids": qsrc, "derived": True,
        "formula": "district filings / national filings x 100 over each four-quarter window (NOS 830 + 835)",
        "how": "IDB civil file, natures of suit 830 and 835, by calendar quarter of filing. The decision quarter (April to June 2017) is left out.",
    })
    qq = q[q.quarter >= QUARTERS_FROM]
    quarters = sorted(qq.quarter.unique())
    qw = qq.pivot(index="quarter", columns="district_id", values="nos830_835").reindex(quarters)
    qother = qw["_national"] - qw[[d for d, _, _ in FOCUS]].sum(axis=1)
    prelim_q = min(qq[qq.fiscal_year >= PRELIM_FY].quarter)
    s.chart("quarterly", {
        "kind": "line", "unit": "cases", "format": ",.0f", "x": quarters, "x_type": "quarter", "y_min": 0,
        "prelim_from": prelim_q, "mark": "2017Q2",
        "title": "Patent cases filed per calendar quarter (natures of suit 830 and 835)",
        "series": [{"id": d, "label": lab, "role": role, "values": [num_json(qw.loc[x, d]) for x in quarters]} for d, lab, role in FOCUS]
        + [{"id": "_other", "label": "All other districts combined", "role": "context", "values": [num_json(qother[x]) for x in quarters]}],
        "source_ids": qsrc, "derived": True, "formula": "all other districts = national filings minus the three districts shown",
        "how": "IDB patent_quarterly table: calendar quarter of the AO filing date. Quarters from October 2025 fall in preliminary FY 2026.",
    })

    # ---- W.D. Tex. ---------------------------------------------------------------------------
    for y in (2017, 2021):
        c = cell(p, "txwd", y)
        s.num(f"txwd_{y}", c.value, "cases", source_ids=[c.source_id], year=y, how=f"Patent cases filed in W.D. Tex., FY {y}.")
        cs = cell(sh, "txwd", y)
        s.num(f"txwd_share_{y}", cs.value, "percent", source_ids=[cs.source_id], year=y, derived=True,
              formula=f"W.D. Tex. patent filings / national patent filings x 100 (FY {y})",
              how="The IDB lane's share of national patent filings.")
    if int(w.loc[full_years, "txwd"].idxmax()) != 2021:
        raise ValueError("W.D. Tex. peak moved")
    wd_years = [y for y in years if leaders[y] == "txwd"]
    if wd_years != list(range(wd_years[0], wd_years[-1] + 1)):
        raise ValueError("W.D. Tex. lead years are not one run")
    s.year("txwd_lead_first", wd_years[0], source_ids=src, how="First fiscal year W.D. Tex. had the most patent filings.")
    s.year("txwd_lead_last", wd_years[-1], source_ids=src, how="Last fiscal year W.D. Tex. had the most patent filings.")

    # ---- E.D. Tex. after the decision ----------------------------------------------------------
    post = w.loc[[y for y in full_years if y >= 2018], "txed"]
    low = int(post.idxmin())
    s.num("txed_low", post[low], "cases", source_ids=ids_of(p[p.district_id == "txed"]), year=low,
          how="Lowest E.D. Tex. patent filing count after FY 2017.")
    s.year("txed_low_year", low, source_ids=ids_of(p[p.district_id == "txed"]), how="Year of that low.")
    c = cell(p, "txed", 2025)
    s.num("txed_2025", c.value, "cases", source_ids=[c.source_id], year=2025, headline=True,
          how="Patent cases filed in E.D. Tex., FY 2025.")
    cs = cell(sh, "txed", 2025)
    s.num("txed_share_2025", cs.value, "percent", source_ids=[cs.source_id], year=2025, derived=True,
          formula="E.D. Tex. patent filings / national patent filings x 100 (FY 2025)",
          how="The IDB lane's share of national patent filings.")
    if leaders[2025] != "txed":
        raise ValueError("E.D. Tex. no longer leads in FY 2025")
    back = [y for y in years if y > wd_years[-1] and leaders[y] == "txed"]
    if any(leaders[y] != "txed" for y in years if y >= back[0]):
        raise ValueError("the text says E.D. Tex. has led every year since it regained the lead")
    s.year("txed_back_first", back[0], source_ids=src, how="First fiscal year E.D. Tex. led again after W.D. Tex.")

    # ---- the four Texas districts --------------------------------------------------------------
    txsum = w[TX].sum(axis=1)
    txshare = txsum / nat * 100
    s.num("tx_2025", txsum[2025], "cases", source_ids=ids_of(p[p.district_id.isin(TX) & (p.period == 2025)]), year=2025,
          derived=True, formula="sum of FY 2025 patent filings in E.D., W.D., N.D. and S.D. Tex.",
          how="Sum of the four Texas districts.")
    s.num("tx_share_2025", txshare[2025], "percent", source_ids=src, year=2025, headline=True, derived=True,
          formula="(E.D. + W.D. + N.D. + S.D. Tex. patent filings) / national patent filings x 100 (FY 2025)",
          how="Sum of the four Texas districts divided by the national count.")
    if int(txshare.idxmax()) != 2025:
        raise ValueError("Texas share peak moved")
    s.num("tx_share_2015", txshare[2015], "percent", source_ids=src, year=2015, derived=True,
          formula="(E.D. + W.D. + N.D. + S.D. Tex. patent filings) / national patent filings x 100 (FY 2015)",
          how="Sum of the four Texas districts divided by the national count.")
    pre = txshare.loc[[y for y in years if y < 2005]]
    s.year("tx_pre_cut", 2005, source_ids=src, how="Cut-off year for the comparison of earlier Texas shares.")
    s.num("tx_share_max_pre2005", pre.max(), "percent", source_ids=src, derived=True,
          formula="highest yearly Texas share before FY 2005",
          how="Maximum of the combined share over FY 1988 to FY 2004.")
    s.chart("texas_share", {
        "kind": "line", "unit": "percent", "format": ".1f", "x": years, "y_min": 0, "prelim_from": PRELIM_FY,
        "title": "Share of the nation's patent cases filed in the four Texas districts",
        "series": [{"id": "_texas", "label": "Four Texas districts", "role": "focus",
                    "values": [round(float(txshare[y]), 6) for y in years]}],
        "source_ids": src, "derived": True,
        "formula": "(E.D. + W.D. + N.D. + S.D. Tex. patent filings) / national patent filings x 100",
        "how": "IDB civil file, nature of suit 830, by fiscal year of filing.",
    })
    s.layer("patent_filings", p[p.period <= PRELIM_FY], label="Patent cases filed", unit="cases", fmt_spec=",.0f",
            higher_means="more patent suits filed", how="IDB civil file, nature of suit 830, by fiscal year of filing.")
    s.thumb = {"layer": "patent_share", "year": 2015, "focus": ["txed"]}
    return s
