"""The Border Districts: the five districts along the Mexican border (IDB, FCMS, USSC)."""
from __future__ import annotations

import pandas as pd

from .common import PROC, Story, cell, district_name, ids_of, national, num_json, obs, series, wide

SLUG = "border-districts"
B = ["casd", "azd", "nmd", "txwd", "txsd"]   # west to east along the border
PRELIM_FY = 2026
LATEST = 2025
PLEA_BASE = 500   # districts with at least this many terminated defendants (editorial threshold, stated in the text)
B_FORMULA = "S.D. Cal. + D. Ariz. + D.N.M. + W.D. Tex. + S.D. Tex."


def offense_mix() -> pd.DataFrame:
    return pd.read_parquet(PROC / "idb" / "criminal_offense_mix.parquet")


def build() -> Story:
    s = Story(SLUG)
    m = offense_mix()
    msrc = ids_of(m)
    s.year("fy_latest", LATEST, source_ids=msrc, how="Latest fiscal year with an AO cross-check for IDB criminal data.", headline=True)
    s.year("fy_prelim", PRELIM_FY, source_ids=msrc, how="Latest IDB fiscal year; no AO cross-check yet.")
    s.num("n_border", len(B), "districts", source_ids=msrc, how="The five districts whose territory reaches the Mexican border.")

    # ---- felony immigration defendants ----------------------------------------------------------
    im = m[m.offense_category == "immigration"].pivot(index="period", columns="district_id", values="count_felony")
    fel = m.groupby(["period", "district_id"])["count_felony"].sum().unstack()
    years = sorted(int(y) for y in im.index)
    imm5 = im[B].sum(axis=1)
    imm5_share = imm5 / im["_national"] * 100
    s.year("fy_first", years[0], source_ids=msrc, how="First fiscal year of the IDB criminal file used here.")
    s.num("imm5_latest", imm5[LATEST], "defendants", source_ids=msrc, year=LATEST, derived=True,
          formula=f"sum of felony immigration defendants filed in {B_FORMULA}",
          how="IDB criminal offense mix, immigration category, felony defendants filed.")
    s.num("imm_us_latest", im.loc[LATEST, "_national"], "defendants", source_ids=msrc, year=LATEST,
          how="Felony immigration defendants filed in all district courts (IDB national total).")
    s.num("imm5_share_latest", imm5_share[LATEST], "percent", source_ids=msrc, year=LATEST, derived=True, headline=True,
          formula=f"({B_FORMULA} felony immigration defendants) / national felony immigration defendants x 100",
          how="Sum of the five districts divided by the national count.")
    s.num("imm5_share_first", imm5_share[years[0]], "percent", source_ids=msrc, year=years[0], derived=True,
          formula=f"({B_FORMULA} felony immigration defendants) / national x 100 (FY {years[0]})",
          how="Sum of the five districts divided by the national count.")
    full = [y for y in years if y < PRELIM_FY]
    pk = int(imm5_share.loc[full].idxmax())
    s.num("imm5_share_peak", imm5_share[pk], "percent", source_ids=msrc, year=pk, derived=True,
          formula="highest yearly five-district share of national felony immigration defendants",
          how=f"Maximum over FY {years[0]} to FY {LATEST}.")
    s.year("imm5_share_peak_year", pk, source_ids=msrc, how="Year of the highest share.")

    f = obs("idb", "idb_crim_felony_defendants_filed")
    fn = national("idb", "idb_crim_felony_defendants_filed")
    fw = wide(f)
    fel5 = fw[B].sum(axis=1)
    fel5_share = fel5 / fn.set_index("period")["value"] * 100
    fsrc = ids_of(f) + ids_of(fn)
    for y in (years[0], LATEST):
        s.num(f"fel5_share_{y}", fel5_share[y], "percent", source_ids=fsrc, year=y, derived=True, headline=y == LATEST,
              formula=f"({B_FORMULA} felony defendants filed) / national felony defendants filed x 100 (FY {y})",
              how="IDB felony defendants filed; sum of the five districts divided by the national count.")
        s.num(f"fel5_{y}", fel5[y], "defendants", source_ids=fsrc, year=y, derived=True,
              formula=f"sum of felony defendants filed in {B_FORMULA} (FY {y})", how="IDB felony defendants filed.")
        s.num(f"fel_us_{y}", fn.set_index("period")["value"][y], "defendants", source_ids=ids_of(fn), year=y,
              how="Felony defendants filed in all district courts (IDB national total).")
    s.chart("share_lines", {
        "kind": "line", "unit": "percent", "format": ".1f", "x": years, "y_min": 0, "y_max": 100, "prelim_from": PRELIM_FY,
        "title": "The five border districts' share of the nation's felony defendants",
        "series": [
            {"id": "_imm", "label": "Felony immigration defendants", "role": "focus", "values": [round(float(imm5_share[y]), 6) for y in years]},
            {"id": "_all", "label": "All felony defendants", "role": "c2", "values": [round(float(fel5_share[y]), 6) for y in years]},
        ],
        "source_ids": msrc + fsrc, "derived": True,
        "formula": f"({B_FORMULA}) / national x 100, for each measure and year",
        "how": "IDB criminal file, defendants filed, by fiscal year. FY 2026 is preliminary.",
    })

    # Felony immigration share of each district's felony docket (map layer + bars).
    share = (im / fel * 100)
    rows = []
    for y in years:
        for d in share.columns:
            if d == "_national":
                continue
            tot = fel.loc[y, d] if d in fel.columns else 0
            if not tot or pd.isna(tot):
                continue
            rows.append({"district_id": d, "period": y, "value": float(share.loc[y, d]), "source_id": "idb_criminal_cr96on"})
    lay = pd.DataFrame(rows)
    s.layer("imm_share", lay, label="Immigration charges, share of felony defendants filed", unit="percent", fmt_spec=".1f",
            derived=True, formula="felony immigration defendants filed / all felony defendants filed x 100",
            higher_means="immigration cases make up more of the felony docket",
            how="IDB criminal offense mix (most serious filing charge), felony defendants, by fiscal year. FY 2026 is preliminary.")
    bar_items = []
    for d in B:
        v = float(share.loc[LATEST, d])
        s.num(f"{d}_imm_pct", v, "percent", source_ids=msrc, year=LATEST, derived=True,
              formula=f"{district_name(d)} felony immigration defendants / all its felony defendants x 100 (FY {LATEST})",
              how="IDB criminal offense mix, felony defendants filed.")
        bar_items.append({"id": d, "label": district_name(d), "value": round(v, 6), "role": "focus"})
    usv = float(share.loc[LATEST, "_national"])
    s.num("us_imm_pct", usv, "percent", source_ids=msrc, year=LATEST, derived=True,
          formula=f"national felony immigration defendants / all felony defendants x 100 (FY {LATEST})",
          how="IDB national totals.")
    lo = min(B, key=lambda d: share.loc[LATEST, d])
    hi = max(B, key=lambda d: share.loc[LATEST, d])
    s.district("imm_pct_lo", lo, source_ids=msrc, style="short", how="Border district with the lowest felony immigration share.")
    s.district("imm_pct_hi", hi, source_ids=msrc, style="short", how="Border district with the highest felony immigration share.")
    for key, dd in (("imm_pct_lo_value", lo), ("imm_pct_hi_value", hi)):
        s.num(key, float(share.loc[LATEST, dd]), "percent", source_ids=msrc, year=LATEST, derived=True,
              formula=f"{district_name(dd)} felony immigration defendants / all its felony defendants x 100 (FY {LATEST})",
              how="IDB criminal offense mix, felony defendants filed.")
    bar_items.sort(key=lambda r: -r["value"])
    bar_items.append({"id": "_national", "label": "All districts", "value": round(usv, 6), "role": "national"})
    s.chart("imm_bars", {
        "kind": "bars", "unit": "percent", "format": ".1f", "x_max": 100,
        "title": f"Immigration charges as a share of felony defendants filed, FY {LATEST}",
        "items": bar_items, "source_ids": msrc, "derived": True,
        "formula": "felony immigration defendants filed / all felony defendants filed x 100",
        "how": "IDB criminal offense mix, most serious filing charge.",
    })

    # ---- felony filings per judgeship (FCMS) ------------------------------------------------------
    fp = obs("fcms", "fcms_filings_per_judgeship_criminal_felony", "observations_current_method")
    fpn = national("fcms", "fcms_filings_per_judgeship_criminal_felony", current_method=True)
    rk = obs("fcms", "fcms_rank_us_filings_per_judgeship_criminal_felony", "observations_ranks")
    rw = wide(rk)
    ryears = [int(y) for y in rw.index]
    top5 = [y for y in ryears if set(rw.loc[y][rw.loc[y] <= 5].index) == set(B)]
    rsrc = ids_of(rk)
    s.num("n_top5", len(top5), "years", source_ids=rsrc, derived=True, headline=True,
          formula="count of years in which the five districts held U.S. standings 1 to 5",
          how="Published numerical standings within the U.S., felony filings per judgeship.")
    s.num("n_top5_years", len(ryears), "years", source_ids=rsrc, derived=True,
          formula="count of years with published U.S. standings", how="Years with published standings.")
    s.year("top5_first", ryears[0], source_ids=rsrc, how="First year with a published standing.")
    exc = [y for y in ryears if y not in top5]
    for i, y in enumerate(exc, start=1):
        s.year(f"top5_exc{i}", y, source_ids=rsrc, how="A year in which one border district ranked sixth or lower.")
    fpw = wide(fp)
    items = []
    for d in fpw.columns:
        v = fpw.loc[LATEST, d]
        if pd.isna(v):
            continue
        items.append({"id": d, "label": district_name(d), "value": num_json(v), "role": "focus" if d in B else "context"})
    items.sort(key=lambda r: (-r["value"], r["id"]))
    cfn = cell(fpn, None, LATEST)
    s.chart("fpj_bars", {
        "kind": "bars", "unit": "per_judgeship", "format": ",.0f", "compact": True,
        "title": f"Felony filings per authorized judgeship, FY {LATEST}, all districts",
        "items": items, "reference": {"label": "All districts", "value": num_json(cfn.value)},
        "source_ids": ids_of(fp[fp.period == LATEST]) + [cfn.source_id], "derived": False,
        "how": "FCMS profiles (current method: felony defendants).",
    })
    best = fpw.loc[LATEST, B].idxmax()
    cb = cell(fp, best, LATEST)
    s.district("fpj_top", best, source_ids=[cb.source_id], style="short", how=f"Border district with the most felony filings per judgeship in FY {LATEST}.")
    s.num("fpj_top_value", cb.value, "per_judgeship", source_ids=[cb.source_id], year=LATEST,
          how="Published felony filings per judgeship.")
    s.num("us_fpj_latest", cfn.value, "per_judgeship", source_ids=[cfn.source_id], year=LATEST,
          how="Felony filings per judgeship, all district courts.")

    # ---- felony disposition time (FCMS current method) ------------------------------------------
    cr = obs("fcms", "fcms_median_months_criminal_felony_filing_to_disposition", "observations_current_method")
    crn = national("fcms", "fcms_median_months_criminal_felony_filing_to_disposition", current_method=True)
    cyears = sorted(int(y) for y in crn["period"])
    crw = wide(cr)
    nat = crn.set_index("period")["value"]
    below = sum(1 for y in cyears for d in B if crw.loc[y, d] < nat[y])
    csrc = ids_of(cr[cr.district_id.isin(B)]) + ids_of(crn)
    s.num("n_disp_below", below, "count", source_ids=csrc, derived=True,
          formula="count of district-years (five districts x years) with a median below the national median",
          how="Compared each border district's published median with the national median, current-method series.")
    s.num("n_disp_cells", len(B) * len(cyears), "count", source_ids=csrc, how="Five districts times the years shown.")
    if below != len(B) * len(cyears):
        raise ValueError("the text says every border district was below the national median in every year")
    s.year("disp_first", cyears[0], source_ids=ids_of(crn), how="First year of the current-method series.")
    rc = obs("fcms", "fcms_rank_us_median_months_criminal_felony_filing_to_disposition", "observations_ranks")
    rcy = rc[rc.period.isin(cyears)]
    nmd_first = rcy[(rcy.district_id == "nmd") & (rcy.value == 1)]
    s.num("n_nmd_first", len(nmd_first), "years", source_ids=ids_of(rcy[rcy.district_id == "nmd"]), derived=True,
          formula="count of years where the published U.S. standing of D.N.M. = 1",
          how=f"Published standings, FY {cyears[0]} to FY {cyears[-1]}.")
    s.num("n_disp_years", len(cyears), "years", source_ids=ids_of(crn), derived=True,
          formula="count of years in the current-method series", how="Years in the current-method series.")
    cn_ = cell(cr, "nmd", LATEST)
    s.num("nmd_disp_latest", cn_.value, "months", source_ids=[cn_.source_id], year=LATEST, how="D.N.M. published median.")
    cu = cell(crn, None, LATEST)
    s.num("us_disp_latest", cu.value, "months", source_ids=[cu.source_id], year=LATEST, how="National published median.")
    s.chart("disp_lines", {
        "kind": "line", "unit": "months", "format": ".1f", "x": cyears, "y_min": 0,
        "title": "Median months from filing to disposition, felony defendants",
        "series": [{"id": d, "label": district_name(d), "role": "focus" if d == "nmd" else "focus2", "values": series(cr, d, cyears)} for d in B]
        + [{"id": "_national", "label": "All district courts", "role": "national", "values": series(crn, None, cyears)}],
        "source_ids": csrc, "derived": False,
        "how": "FCMS current-method series (felony defendants; time measured from the proceeding date since March 2012).",
    })

    # ---- pleas and trials ------------------------------------------------------------------------
    g = obs("idb", "idb_crim_pct_guilty_plea")
    t = obs("idb", "idb_crim_trial_rate")
    gy = g[g.period == LATEST].set_index("district_id")
    ty = t[t.period == LATEST].set_index("district_id")
    big = sorted(gy[gy.denominator >= PLEA_BASE].index)
    gsrc = ids_of(g[g.period == LATEST]) + ids_of(t[t.period == LATEST])
    s.num("plea_base", PLEA_BASE, "defendants", source_ids=gsrc, how="Threshold chosen for this comparison: districts with at least this many terminated defendants.")
    s.num("n_big", len(big), "districts", source_ids=gsrc, derived=True,
          formula=f"count of districts with at least {PLEA_BASE} criminal defendants terminated in FY {LATEST}",
          how="IDB defendants terminated (the denominator of the guilty-plea and trial rates).")
    low5 = list(ty.loc[big, "value"].sort_values().index[:5])
    if set(low5) != set(B):
        raise ValueError("the border districts no longer have the five lowest trial rates")
    top_plea = list(gy.loc[big, "value"].sort_values(ascending=False).index)
    n_top_plea = 0
    for d in top_plea:
        if d in B:
            n_top_plea += 1
        else:
            break
    s.num("n_top_plea", n_top_plea, "districts", source_ids=gsrc, derived=True,
          formula=f"number of border districts at the top of the guilty-plea ranking before any other district (districts with {PLEA_BASE}+ defendants)",
          how="Sorted guilty-plea shares among the districts above the threshold.")
    for d in B:
        tv = ty.loc[d]
        s.num(f"{d}_trial", tv.value, "percent", decimals=2, source_ids=[tv.source_id], year=LATEST, derived=True,
              formula=f"defendants terminated after trial / defendants terminated x 100 ({district_name(d)}, FY {LATEST})",
              how="IDB trial rate.")
        gv = gy.loc[d]
        s.num(f"{d}_plea", gv.value, "percent", source_ids=[gv.source_id], year=LATEST, derived=True,
              formula=f"defendants who pleaded guilty / defendants terminated x 100 ({district_name(d)}, FY {LATEST})",
              how="IDB guilty-plea share.")
    tn = cell(national("idb", "idb_crim_trial_rate"), None, LATEST)
    gn = cell(national("idb", "idb_crim_pct_guilty_plea"), None, LATEST)
    s.num("us_trial", tn.value, "percent", decimals=2, source_ids=[tn.source_id], year=LATEST, derived=True,
          formula="defendants terminated after trial / defendants terminated x 100 (all districts)", how="IDB national rate.")
    s.num("us_plea", gn.value, "percent", source_ids=[gn.source_id], year=LATEST, derived=True,
          formula="defendants who pleaded guilty / defendants terminated x 100 (all districts)", how="IDB national share.")
    trial_lo = low5[0]
    trial_hi = low5[-1]
    s.district("trial_lo", trial_lo, source_ids=gsrc, style="short", how="Lowest trial rate among the districts above the threshold.")
    s.district("trial_hi5", trial_hi, source_ids=gsrc, style="short", how="Fifth-lowest trial rate among the districts above the threshold.")
    for key, dd in (("trial_lo_value", trial_lo), ("trial_hi5_value", trial_hi)):
        tv = ty.loc[dd]
        s.num(key, tv.value, "percent", decimals=2, source_ids=[tv.source_id], year=LATEST, derived=True,
              formula=f"defendants terminated after trial / defendants terminated x 100 ({district_name(dd)}, FY {LATEST})",
              how="IDB trial rate.")
    dots = []
    for d in big:
        dots.append({"id": d, "label": district_name(d), "x": round(float(ty.loc[d, "value"]), 6), "y": round(float(gy.loc[d, "value"]), 6),
                     "n": int(gy.loc[d, "denominator"]), "role": "focus" if d in B else "context"})
    s.chart("plea_dots", {
        "kind": "dots", "unit": "percent", "format": ".1f",
        "title": f"Trial rate and guilty-plea share, FY {LATEST}, districts with {PLEA_BASE:,} or more defendants terminated",
        "x_label": "Share of defendants whose cases ended after a trial", "y_label": "Share who pleaded guilty",
        "x_format": ".1f", "y_format": ".0f",
        "items": dots, "reference": {"x": round(float(tn.value), 6), "y": round(float(gn.value), 6), "label": "All districts"},
        "source_ids": gsrc + [tn.source_id, gn.source_id], "derived": True,
        "formula": "trial rate = defendants terminated after trial / defendants terminated x 100; plea share = guilty pleas / defendants terminated x 100",
        "how": "IDB criminal file, defendants terminated, most serious charge.",
    })

    # ---- early disposition (USSC 5K3.1) ----------------------------------------------------------
    u = obs("ussc", "ussc_pct_early_disposition_5k3")
    un = national("ussc", "ussc_pct_early_disposition_5k3")
    uw = u.pivot(index="period", columns="district_id", values="numerator")
    unn = un.set_index("period")["numerator"]
    k5 = uw[B].sum(axis=1) / unn * 100
    usrc = ids_of(u[u.district_id.isin(B)]) + ids_of(un)
    kyears = sorted(int(y) for y in un["period"])
    s.num("k3_5_share_latest", k5[LATEST], "percent", source_ids=usrc, year=LATEST, derived=True, headline=True,
          formula=f"({B_FORMULA} section 5K3.1 sentences) / national section 5K3.1 sentences x 100 (FY {LATEST})",
          how="USSC counts of early-disposition sentences (numerators of the published shares).")
    s.num("k3_5_latest", uw.loc[LATEST, B].sum(), "people", source_ids=usrc, year=LATEST, derived=True,
          formula=f"sum of section 5K3.1 sentences in {B_FORMULA} (FY {LATEST})", how="USSC counts.")
    s.num("k3_us_latest", unn[LATEST], "people", source_ids=ids_of(un), year=LATEST, how="National count of section 5K3.1 sentences.")
    s.num("k3_5_min", k5.min(), "percent", source_ids=usrc, derived=True,
          formula="lowest yearly five-district share of national section 5K3.1 sentences",
          how=f"Minimum over FY {kyears[0]} to FY {kyears[-1]}.")
    s.year("k3_first", kyears[0], source_ids=ids_of(un), how="First year the USSC reports section 5K3.1 separately.")
    for d in B:
        c = cell(u, d, LATEST)
        s.num(f"{d}_k3", c.value, "percent", source_ids=[c.source_id], year=LATEST,
              how=f"Share of {district_name(d)} sentences with an early-disposition (section 5K3.1) departure, as published.")
    cu = cell(un, None, LATEST)
    s.num("us_k3", cu.value, "percent", source_ids=[cu.source_id], year=LATEST, how="National share, as published.")
    s.num("txwd_k3_max", u[u.district_id == "txwd"]["value"].max(), "percent", source_ids=ids_of(u[u.district_id == "txwd"]),
          derived=True, formula="highest yearly W.D. Tex. section 5K3.1 share", how=f"Maximum over FY {kyears[0]} to FY {kyears[-1]}.")
    s.chart("k3_multiples", {
        "kind": "multiples", "unit": "percent", "format": ".1f", "x": kyears, "y_min": 0,
        "title": "Share of sentences with an early-disposition (section 5K3.1) departure",
        "panels": [{"id": d, "label": district_name(d), "values": series(u, d, kyears)} for d in B],
        "national": {"label": "All districts", "values": series(un, None, kyears)},
        "source_ids": usrc, "derived": False, "how": "USSC datafiles, published shares.",
    })

    # ---- people sentenced (USSC) -----------------------------------------------------------------
    ct = obs("ussc", "ussc_cases_total")
    ctn = national("ussc", "ussc_cases_total")
    ctw = wide(ct)
    sent = ctw[B].sum(axis=1) / ctn.set_index("period")["value"] * 100
    first_df = 2002  # USSC district counts from the datafiles; FY 1995-1999 packets do not sum to the national figure
    for y in (first_df, LATEST):
        s.num(f"sent5_share_{y}", sent[y], "percent", source_ids=ids_of(ct[ct.period == y]) + ids_of(ctn[ctn.period == y]), year=y,
              derived=True, formula=f"({B_FORMULA} people sentenced) / national people sentenced x 100 (FY {y})",
              how="USSC case counts, datafiles.")
    s.year("sent_first", first_df, source_ids=ids_of(ctn[ctn.period == first_df]), how="First year of the USSC datafile series used here.")

    s.thumb = {"layer": "imm_share", "year": LATEST, "focus": B}
    return s
