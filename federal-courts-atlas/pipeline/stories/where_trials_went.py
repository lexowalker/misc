"""Where Trials Went: the decline of civil and criminal trials (IDB, FCMS)."""
from __future__ import annotations

from .common import Story, cell, district_name, ids_of, national, num_json, obs, series, wide

SLUG = "where-trials-went"
LATEST = 2025
PRELIM_FY = 2026
SPIKE_YEAR = 2007          # one district recorded most of its FY 2007 civil terminations as trials (IDB lane note)
SPIKE_DISTRICT = "lamd"
MASS_DISTRICT = "flnd"     # N.D. Fla.: very large civil termination counts in FY 2024 and FY 2025
HIGH_RATE = 10.0           # criminal trial rate threshold for the map comparison (stated in the text)
BASE = 500                 # districts with at least this many terminated defendants (stated in the text)


def build() -> Story:
    s = Story(SLUG)
    ct = national("idb", "idb_civil_trial_rate")
    cr = ct.set_index("period")
    years = sorted(int(y) for y in cr.index)
    first = years[0]
    csrc = ids_of(ct)
    s.year("fy_first", first, source_ids=csrc, how="First fiscal year of the IDB civil file used here.", headline=True)
    s.year("fy_latest", LATEST, source_ids=csrc, how="Latest fiscal year with an AO cross-check for IDB data.", headline=True)
    s.year("fy_prelim", PRELIM_FY, source_ids=csrc, how="Latest IDB fiscal year; no AO cross-check yet.")
    s.num("civ_first", cr.loc[first, "numerator"], "cases", source_ids=csrc, year=first, headline=True,
          how="Civil cases terminated by jury verdict, directed verdict or court (bench) trial, all districts (numerator of the IDB civil trial rate).")
    s.num("civ_latest", cr.loc[LATEST, "numerator"], "cases", source_ids=csrc, year=LATEST, headline=True,
          how="Same count for the latest year.")
    drop = (cr.loc[first, "numerator"] - cr.loc[LATEST, "numerator"]) / cr.loc[first, "numerator"] * 100
    s.num("civ_drop", drop, "percent", source_ids=csrc, derived=True, headline=True,
          formula=f"(trials in FY {first} - trials in FY {LATEST}) / trials in FY {first} x 100", how="Percent decline in the count.")
    c = obs("idb", "idb_civil_trial_rate")
    spike = cell(c, SPIKE_DISTRICT, SPIKE_YEAR)
    s.num("civ_spike", cr.loc[SPIKE_YEAR, "numerator"], "cases", source_ids=csrc, year=SPIKE_YEAR, how=f"National count, FY {SPIKE_YEAR}.")
    s.num("spike_trials", spike.numerator, "cases", source_ids=[spike.source_id], year=SPIKE_YEAR,
          how=f"Civil terminations recorded as trials in {district_name(SPIKE_DISTRICT)}, FY {SPIKE_YEAR}.")
    s.num("spike_terms", spike.denominator, "cases", source_ids=[spike.source_id], year=SPIKE_YEAR,
          how=f"All civil terminations in {district_name(SPIKE_DISTRICT)}, FY {SPIKE_YEAR}.")
    s.num("civ_spike_ex", cr.loc[SPIKE_YEAR, "numerator"] - spike.numerator, "cases", source_ids=csrc, year=SPIKE_YEAR, derived=True,
          formula=f"national civil trials minus {district_name(SPIKE_DISTRICT)} civil trials, FY {SPIKE_YEAR}", how="Subtraction.")
    s.chart("civil_count", {
        "kind": "line", "unit": "cases", "format": ",.0f", "x": years, "y_min": 0, "prelim_from": PRELIM_FY,
        "title": "Civil cases decided by a trial, all federal district courts",
        "series": [{"id": "_national", "label": "Civil cases ended by verdict or bench trial", "role": "focus",
                    "values": [num_json(cr.loc[y, "numerator"]) for y in years]}],
        "notes": [{"x": SPIKE_YEAR, "text": f"{district_name(SPIKE_DISTRICT)} spike"}],
        "source_ids": csrc, "derived": False,
        "how": "IDB civil file: terminations with disposition jury verdict, directed verdict or court trial, by fiscal year of termination.",
    })

    # Rate, with and without N.D. Fla.
    f = c[c.district_id == MASS_DISTRICT].set_index("period")
    ex = {}
    for y in years:
        ex[y] = (cr.loc[y, "numerator"] - f.loc[y, "numerator"]) / (cr.loc[y, "denominator"] - f.loc[y, "denominator"]) * 100
    s.num("rate_first", cr.loc[first, "value"], "percent", decimals=2, source_ids=csrc, year=first, derived=True,
          formula="civil trials / civil terminations x 100", how="IDB lane national civil trial rate.")
    s.num("rate_latest", cr.loc[LATEST, "value"], "percent", decimals=2, source_ids=csrc, year=LATEST, derived=True,
          formula="civil trials / civil terminations x 100", how="IDB lane national civil trial rate.")
    fsrc = ids_of(c[c.district_id == MASS_DISTRICT]) + csrc
    s.num("rate_ex_latest", ex[LATEST], "percent", decimals=2, source_ids=fsrc, year=LATEST, derived=True,
          formula=f"(national civil trials - N.D. Fla. civil trials) / (national civil terminations - N.D. Fla. civil terminations) x 100, FY {LATEST}",
          how="Leaves out the one district whose terminations swelled the national total.")
    for y in (2024, LATEST):
        s.num(f"mass_terms_{y}", f.loc[y, "denominator"], "cases", source_ids=ids_of(c[(c.district_id == MASS_DISTRICT) & (c.period == y)]), year=y,
              how=f"Civil cases terminated in N.D. Fla., FY {y} (denominator of its trial rate).")
        s.num(f"mass_share_{y}", f.loc[y, "denominator"] / cr.loc[y, "denominator"] * 100, "percent", source_ids=fsrc, year=y, derived=True,
              formula=f"N.D. Fla. civil terminations / national civil terminations x 100, FY {y}", how="Share of the national total.")
    s.chart("civil_rate", {
        "kind": "line", "unit": "percent", "format": ".2f", "x": years, "y_min": 0, "prelim_from": PRELIM_FY,
        "title": "Share of civil cases closed that were decided by a trial",
        "series": [
            {"id": "_national", "label": "All districts", "role": "focus", "values": [round(float(cr.loc[y, "value"]), 6) for y in years]},
            {"id": "_ex", "label": "All districts except N.D. Fla.", "role": "c2", "values": [round(float(ex[y]), 6) for y in years]},
        ],
        "notes": [{"x": SPIKE_YEAR, "text": f"{district_name(SPIKE_DISTRICT)} spike"}],
        "source_ids": fsrc, "derived": True,
        "formula": "civil trials / civil terminations x 100; second line leaves N.D. Fla. out of both counts",
        "how": "IDB civil file, by fiscal year of termination.",
    })

    # ---- criminal ------------------------------------------------------------------------
    t = national("idb", "idb_crim_trial_rate").set_index("period")
    g = national("idb", "idb_crim_pct_guilty_plea").set_index("period")
    tsrc = ids_of(national("idb", "idb_crim_trial_rate")) + ids_of(national("idb", "idb_crim_pct_guilty_plea"))
    cyears = sorted(int(y) for y in t.index)
    cf = cyears[0]
    s.year("fy_crim_first", cf, source_ids=tsrc, how="First fiscal year of the IDB criminal file used here.")
    for y in (cf, LATEST):
        s.num(f"crim_rate_{y}", t.loc[y, "value"], "percent", source_ids=tsrc, year=y, derived=True, headline=y == LATEST,
              formula="defendants whose cases ended after a trial / defendants terminated x 100", how="IDB lane national rate.")
        s.num(f"crim_trials_{y}", t.loc[y, "numerator"], "defendants", source_ids=tsrc, year=y,
              how="Defendants whose cases ended after a trial, all districts (numerator of the rate).")
        s.num(f"crim_terms_{y}", t.loc[y, "denominator"], "defendants", source_ids=tsrc, year=y,
              how="Criminal defendants terminated, all districts.")
        s.num(f"plea_{y}", g.loc[y, "value"], "percent", source_ids=tsrc, year=y, derived=True,
              formula="defendants who pleaded guilty (including nolo contendere) / defendants terminated x 100", how="IDB lane national share.")
    s.num("crim_drop", (t.loc[cf, "numerator"] - t.loc[LATEST, "numerator"]) / t.loc[cf, "numerator"] * 100, "percent", source_ids=tsrc,
          derived=True, formula=f"(trials in FY {cf} - trials in FY {LATEST}) / trials in FY {cf} x 100", how="Percent decline in the count.")
    s.chart("crim_rate", {
        "kind": "line", "unit": "percent", "format": ".1f", "x": cyears, "y_min": 0, "prelim_from": PRELIM_FY,
        "title": "Share of criminal defendants whose cases ended after a trial",
        "series": [{"id": "_national", "label": "All districts", "role": "focus", "values": [round(float(t.loc[y, "value"]), 6) for y in cyears]}],
        "source_ids": tsrc, "derived": True, "formula": "defendants terminated after trial / defendants terminated x 100",
        "how": "IDB criminal file, most serious count (DISP1), by fiscal year of termination.",
    })
    s.chart("plea_rate", {
        "kind": "line", "unit": "percent", "format": ".1f", "x": cyears, "y_min": 0, "y_max": 100, "prelim_from": PRELIM_FY,
        "title": "Share of criminal defendants who pleaded guilty",
        "series": [{"id": "_national", "label": "All districts", "role": "focus", "values": [round(float(g.loc[y, "value"]), 6) for y in cyears]}],
        "source_ids": tsrc, "derived": True, "formula": "defendants who pleaded guilty / defendants terminated x 100",
        "how": "IDB criminal file, most serious count (DISP1), by fiscal year of termination.",
    })

    # ---- districts ------------------------------------------------------------------------
    d = obs("idb", "idb_crim_trial_rate")
    dw = wide(d)
    s.num("high_rate", HIGH_RATE, "percent", decimals=0, source_ids=ids_of(d), how="Threshold chosen for the map comparison.")
    for y in (cf, LATEST):
        src = ids_of(d[d.period == y])
        s.num(f"n_high_{y}", int((dw.loc[y] >= HIGH_RATE).sum()), "districts", source_ids=src, year=y, derived=True,
              formula=f"count of districts with a criminal trial rate of {HIGH_RATE:g}% or more, FY {y}", how="IDB district rates.")
        s.num(f"median_{y}", float(dw.loc[y].median()), "percent", decimals=2, source_ids=src, year=y, derived=True,
              formula=f"median of the district criminal trial rates, FY {y}", how="The middle district.")
    s.layer("crim_trial", d[d.period <= PRELIM_FY], label="Criminal defendants whose cases went to trial", unit="percent", fmt_spec=".1f",
            derived=True, formula="defendants terminated after trial / defendants terminated x 100",
            higher_means="more cases ended in a trial", how="IDB criminal file. FY 2026 is preliminary.")
    row = d[d.period == LATEST].set_index("district_id")
    big = row[row.denominator >= BASE]
    s.num("base", BASE, "defendants", source_ids=ids_of(big), how="Threshold chosen for this comparison.")
    s.num("n_big", len(big), "districts", source_ids=ids_of(big), derived=True,
          formula=f"count of districts with at least {BASE} defendants terminated, FY {LATEST}", how="IDB denominators.")
    lo, hi = big["value"].idxmin(), big["value"].idxmax()
    for key, dd in (("lo", lo), ("hi", hi)):
        s.district(f"big_{key}", dd, source_ids=ids_of(big), style="short", how=f"District at the {'low' if key == 'lo' else 'high'} end.")
        s.num(f"big_{key}_value", big.loc[dd, "value"], "percent", decimals=2 if key == "lo" else 1, source_ids=[big.loc[dd, "source_id"]],
              year=LATEST, derived=True, formula="defendants terminated after trial / defendants terminated x 100", how="IDB lane rate.")
    dis = obs("idb", "idb_crim_pct_dismissed")
    for y in (2024, LATEST):
        cc = cell(dis, hi, y)
        s.num(f"hi_dismissed_{y}", cc.value, "percent", source_ids=[cc.source_id], year=y, derived=True,
              formula="defendants whose cases were dismissed / defendants terminated x 100", how=f"IDB lane share, {district_name(hi)}.")
    items = [{"id": dd, "label": district_name(dd), "value": round(float(r.value), 6), "role": "focus" if dd in (lo, hi) else "context"}
             for dd, r in big.iterrows()]
    items.sort(key=lambda r: (-r["value"], r["id"]))
    s.chart("big_bars", {
        "kind": "bars", "unit": "percent", "format": ".1f", "compact": True,
        "title": f"Criminal trial rate, FY {LATEST}, districts with {BASE} or more defendants terminated",
        "items": items, "reference": {"label": "All districts", "value": round(float(t.loc[LATEST, "value"]), 6)},
        "source_ids": ids_of(big) + tsrc, "derived": True,
        "formula": "defendants terminated after trial / defendants terminated x 100", "how": "IDB criminal file.",
    })

    # ---- FCMS trials per judgeship ------------------------------------------------------------
    tp = national("fcms", "fcms_trials_completed_per_judgeship")
    tpv = tp.set_index("period")["value"]
    tyears = sorted(int(y) for y in tpv.index)
    tpsrc = ids_of(tp)
    s.year("fy_tpj_first", tyears[0], source_ids=tpsrc, how="First year of the FCMS series.")
    s.num("tpj_first", tpv[tyears[0]], "per_judgeship", source_ids=[cell(tp, None, tyears[0]).source_id], year=tyears[0],
          how="Trials completed per authorized judgeship, all district courts.")
    s.num("tpj_latest", tpv[LATEST], "per_judgeship", source_ids=[cell(tp, None, LATEST).source_id], year=LATEST,
          how="Trials completed per authorized judgeship, all district courts.")
    low = int(tpv.idxmin())
    if (tpv == tpv.min()).sum() != 1:
        raise ValueError("tied low")
    s.num("tpj_low", tpv[low], "per_judgeship", source_ids=[cell(tp, None, low).source_id], year=low, how="Lowest value in the series.")
    s.year("tpj_low_year", low, source_ids=[cell(tp, None, low).source_id], how="Year of the low.")
    s.chart("tpj_line", {
        "kind": "line", "unit": "per_judgeship", "format": ".0f", "x": tyears, "y_min": 0,
        "title": "Trials completed per authorized judgeship, all district courts",
        "series": [{"id": "_national", "label": "All district courts", "role": "focus", "values": series(tp, None, tyears)}],
        "source_ids": tpsrc, "derived": False,
        "how": "FCMS profiles. Counts civil and criminal trials, including hearings on temporary restraining orders and preliminary injunctions.",
    })
    s.thumb = {"layer": "crim_trial", "year": cf, "focus": []}
    return s
