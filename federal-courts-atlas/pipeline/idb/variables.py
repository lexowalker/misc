"""Variable definitions for the IDB lane: one spec per emitted variable id."""
from __future__ import annotations

from dataclasses import dataclass, field

CIVIL_SRC = "idb_civil_cv88on"
CRIM_SRC = "idb_criminal_cr96on"

CIVIL_FILED_LOC = ("cv88on.txt (cv88on_0.zip): DISTRICT='{code}', fiscal year of FDATEUSE = {fy}, one record per "
                   "DISTRICT+OFFICE+DOCKET+ORIGIN+FILEDATE (latest TAPEYEAR kept)")
CIVIL_TERM_LOC = "cv88on.txt (cv88on_0.zip): DISTRICT='{code}', TAPEYEAR != 2099, fiscal year of TDATEUSE = {fy}"
CRIM_FILED_LOC = "cr96on.txt (cr96on_0.zip): FISCALYR={fy}, DISTRICT='{code}', CTFIL=1"
CRIM_TERM_LOC = "cr96on.txt (cr96on_0.zip): FISCALYR={fy}, DISTRICT='{code}', CTTR=1"


@dataclass
class Spec:
    id: str
    label: str
    unit: str
    lane_family: str            # civil | criminal
    numerator: str              # component name
    denominator: str | None     # component name, "_national:<comp>" for a share of the national total, or None
    locator: str                # locator template (cohort)
    condition: str              # numerator filter, appended to the locator
    description: str
    caveats: str
    higher_means: str
    source: str
    min_fy: int | None = None
    coverage: tuple[str, str, float] | None = None   # (covered comp, base comp, min share) per district-year
    formula: str | None = None
    extra: dict = field(default_factory=dict)

    @property
    def derived(self) -> bool:
        return self.denominator is not None


_DEDUP_NOTE = ("Filing cohort: cases are counted in the federal fiscal year (Oct 1-Sep 30) of the AO's 'filing date "
               "used' (FDATEUSE), once per case (duplicate termination records of the same case are collapsed). "
               "Includes original filings, removals, transfers in, MDL transfers in, remands and reopenings, as the AO "
               "counts civil filings. ")
_TERM_NOTE = ("Termination cohort: every termination record counted in the fiscal year of the AO's 'termination "
              "date used' (TDATEUSE), as the AO counts terminations (a case closed twice counts twice). ")
_CRIM_NOTE = ("Defendant-level. Counted from the FJC fiscal-year snapshot of the year with the AO's count flags; "
              "excludes inter-district (Rule 20/21) transfers so no defendant is counted in two districts. ")
_SMALL = " Shares for districts with few cases (see the `denominator` column) are volatile."

SPECS: list[Spec] = [
    # ------------------------------------------------------------------ civil
    Spec("idb_civil_filed", "Civil cases filed (IDB)", "cases", "civil", "filed", None, CIVIL_FILED_LOC, "",
         "Civil cases filed in the district during the fiscal year, from the FJC Integrated Database.",
         _DEDUP_NOTE + "Reconstructed from case records still in the cumulative file (closed or pending), so it can "
         "differ slightly from the AO's published count for the year (Judicial Business Table C-1); see "
         "reconciliation.csv. Mass-tort MDL filings make some district-years spike (e.g. N.D. Fla.: 204,990 "
         "filings in FY2020, 202,838 of them NOS 365 product liability, almost all under MDL docket 2885). FY2026 "
         "includes 80,415 NOS 463 alien-detainee habeas petitions (2,315 in FY2025).", "more civil cases filed", CIVIL_SRC),
    Spec("idb_civil_terminated", "Civil cases terminated (IDB)", "cases", "civil", "terminated", None,
         CIVIL_TERM_LOC, "", "Civil case terminations in the district during the fiscal year.",
         _TERM_NOTE + "Matches the AO's published terminations (Table C-1) exactly in most years.",
         "more civil cases closed", CIVIL_SRC),
    Spec("idb_patent_filed", "Patent cases filed (NOS 830)", "cases", "civil", "patent830", None, CIVIL_FILED_LOC,
         "; NOS=830", "Civil cases filed with nature of suit 830 (Patent).",
         _DEDUP_NOTE + "SERIES BREAK FY2017: the AO added NOS 835 'Patent - Abbreviated New Drug Application' "
         "(Hatch-Waxman pharmaceutical cases), first used for filings in FY2017; those cases were coded 830 before "
         "and are excluded from this variable after. The break matters most in D. Del. and D.N.J.; use "
         "idb_patent_incl_anda_filed for a continuous series.", "more patent suits filed", CIVIL_SRC),
    Spec("idb_patent_incl_anda_filed", "Patent cases filed, incl. ANDA (NOS 830 + 835)", "cases", "civil",
         "patent830_835", None, CIVIL_FILED_LOC, "; NOS in (830, 835)",
         "Civil cases filed with nature of suit 830 (Patent) or 835 (Patent - Abbreviated New Drug Application).",
         _DEDUP_NOTE + "Continuous across the FY2017 introduction of NOS 835.", "more patent suits filed",
         CIVIL_SRC),
    Spec("idb_patent_share_of_national", "Share of U.S. patent filings (NOS 830)", "percent", "civil",
         "patent830", "_national:patent830", CIVIL_FILED_LOC, "; NOS=830, divided by the national NOS 830 count",
         "The district's share of all NOS 830 patent cases filed in U.S. district courts that fiscal year.",
         "Derived. Same NOS 830 series break in FY2017 as idb_patent_filed (ANDA cases moved to NOS 835).",
         "larger share of the nation's patent suits", CIVIL_SRC,
         formula="100 * idb_patent_filed[district, FY] / sum over all 94 districts of idb_patent_filed[FY]"),
    Spec("idb_civil_pct_pro_se", "Civil cases with a pro se party", "percent", "civil", "prose_any", "prose_valid",
         CIVIL_FILED_LOC, "; PROSE in (1,2,3) over PROSE in (0,1,2,3)",
         "Share of civil cases filed in which at least one party is self-represented: one or more pro se "
         "plaintiffs, one or more pro se defendants, or both (codebook PROSE codes 1, 2, 3), among cases with a "
         "reported PROSE code (0-3).",
         _DEDUP_NOTE + "PROSE is the value on the case's latest record (it can change during a case) and has no AO "
         "quality control (FJC IDB Research Guide). It is blank on every record of tape years 1988-1995 and 1998, "
         "so the series starts with FY1999 filings; district-years where fewer than 95% of filings carry a PROSE "
         "code are omitted. Most pro se cases are prisoner petitions and pro se plaintiffs. Mass-tort MDL "
         "dockets can carry pro se codes on very many cases: in N.D. Fla., 110,916 of 204,990 FY2020 filings and "
         "23,884 of 25,251 FY2024 filings have a pro se code, almost all in MDL docket 2885, which lifts that "
         "district and the national value in FY2020-21 and FY2024." + _SMALL,
         "more cases with a self-represented party", CIVIL_SRC, min_fy=1999,
         coverage=("prose_valid", "filed", 0.95),
         formula="100 * filed cases with PROSE in {1,2,3} / filed cases with PROSE in {0,1,2,3}"),
    Spec("idb_civil_pct_pro_se_plaintiff", "Civil cases with a pro se plaintiff", "percent", "civil",
         "prose_plaintiff", "prose_valid", CIVIL_FILED_LOC, "; PROSE in (1,3) over PROSE in (0,1,2,3)",
         "Share of civil cases filed with one or more self-represented plaintiffs (PROSE codes 1 and 3), among "
         "cases with a reported PROSE code.",
         "Same coverage rules and caveats as idb_civil_pct_pro_se." + _SMALL,
         "more cases brought by self-represented plaintiffs", CIVIL_SRC, min_fy=1999,
         coverage=("prose_valid", "filed", 0.95),
         formula="100 * filed cases with PROSE in {1,3} / filed cases with PROSE in {0,1,2,3}"),
    Spec("idb_civil_pct_prisoner_petitions", "Prisoner petitions, share of civil filings", "percent", "civil",
         "prisoner", "filed", CIVIL_FILED_LOC, "; NOS in (510,530,535,540,550,555,560)",
         "Share of civil cases filed that are prisoner petitions: nature of suit 510 (motion to vacate sentence), "
         "530 (habeas corpus), 535 (death-penalty habeas), 540 (mandamus and other), 550 (prisoner civil rights), "
         "555 (prison condition) and 560 (civil detainee).",
         _DEDUP_NOTE + "Excludes NOS 463 (alien detainee habeas), which the current JS 44 also lists under "
         "'Prisoner Petitions' but which is not in the codebook's 510-560 prisoner block; it is in the NOS mix "
         "table. Districts with federal prisons or many state prisons show high values." + _SMALL,
         "more of the civil docket is prisoner litigation", CIVIL_SRC,
         formula="100 * filed cases with NOS in 510-560 / all filed cases"),
    Spec("idb_civil_pct_class_action", "Civil cases filed as class actions", "percent", "civil", "class_action",
         "filed", CIVIL_FILED_LOC, "; CLASSACT=1",
         "Share of civil cases filed in which the plaintiff alleged a Rule 23 class action (CLASSACT = 1).",
         _DEDUP_NOTE + "The field records the allegation at filing, not certification. Only '1' or missing (-8) "
         "occur, so 'no class allegation' and 'not reported' cannot be told apart; the FJC notes the field has no "
         "quality-control checks. Low values before about FY2001 may partly reflect reporting." + _SMALL,
         "more class-action complaints", CIVIL_SRC, formula="100 * filed cases with CLASSACT = 1 / all filed cases"),
    Spec("idb_civil_trial_rate", "Civil terminations by trial verdict", "percent", "civil", "trial_disp",
         "terminated", CIVIL_TERM_LOC, "; DISP in (7,8,9) over all terminations",
         "Share of civil terminations disposed of by a judgment after trial: jury verdict (DISP 7), directed "
         "verdict (DISP 8) or court (bench) trial (DISP 9).",
         _TERM_NOTE + "Counts only cases whose final disposition is a trial judgment; cases that settle or are "
         "otherwise resolved during or after a trial are not counted (see idb_civil_pct_reached_trial, the AO's "
         "'reaching trial' measure). FY2007: M.D. La. recorded 6,350 terminations coded as jury verdicts (6,305 of "
         "them NOS 360 'other personal injury', nearly all dated May 2007), which lifts that district-year and the "
         "national value." + _SMALL,
         "more civil cases decided by trial", CIVIL_SRC,
         formula="100 * terminations with DISP in {7,8,9} / all terminations"),
    Spec("idb_civil_pct_reached_trial", "Civil terminations during or after trial", "percent", "civil",
         "reached_trial", "terminated", CIVIL_TERM_LOC, "; PROCPROG in (6,7,8,9) over all terminations",
         "Share of civil terminations whose procedural progress at disposition was during or after a court or "
         "jury trial (PROCPROG 6-9), whatever the final disposition. This is the AO's 'percent reaching trial' "
         "(Judicial Business Table C-4).",
         _TERM_NOTE + "AO Table C-4 excludes a few hundred records a year (its total is slightly below C-1's), so "
         "national values differ from the published percent in the second decimal." + _SMALL,
         "more civil cases reach trial", CIVIL_SRC,
         formula="100 * terminations with PROCPROG in {6,7,8,9} / all terminations"),
    # ------------------------------------------------------------------ criminal
    Spec("idb_crim_defendants_filed", "Criminal defendants filed (IDB)", "defendants", "criminal", "filed", None,
         CRIM_FILED_LOC, "", "Criminal defendants whose proceedings commenced in the district during the fiscal "
         "year (felony, Class A misdemeanor, and petty-offense defendants assigned to district judges).",
         _CRIM_NOTE + "Equals the AO's Judicial Business Table D-2 total (defendants commenced, excluding "
         "transfers). Not comparable with FCMS 'felony filings' (felony only; FY2004-09 and FY2011 count cases).",
         "more criminal defendants charged", CRIM_SRC),
    Spec("idb_crim_felony_defendants_filed", "Felony defendants filed (IDB)", "defendants", "criminal",
         "filed_felony", None, CRIM_FILED_LOC, "; FOFFLVL1=4",
         "Criminal defendants filed whose most serious filing offense is a felony (FOFFLVL1 = 4).",
         _CRIM_NOTE + "Comparable with FCMS 'Total Criminal' felony filings in the years FCMS counts defendants "
         "(FY2010, FY2012+).", "more felony defendants charged", CRIM_SRC),
    Spec("idb_crim_defendants_terminated", "Criminal defendants terminated (IDB)", "defendants", "criminal",
         "terminated", None, CRIM_TERM_LOC, "",
         "Criminal defendants whose cases closed in the district during the fiscal year (by dismissal, acquittal "
         "or sentencing after conviction).", _CRIM_NOTE + "Equals AO Judicial Business Table D-4 'total "
         "defendants'.", "more criminal defendants' cases closed", CRIM_SRC),
    Spec("idb_crim_trial_rate", "Criminal defendants disposed of by trial", "percent", "criminal", "trial",
         "terminated", CRIM_TERM_LOC, "; DISP1 in (2,3,8,9,16,17,18,19)",
         "Share of terminated defendants whose final disposition followed a bench or jury trial: acquitted or "
         "convicted by the court or by a jury, including insanity verdicts (DISP1 2, 3, 8, 9, 16, 17, 18, 19).",
         _CRIM_NOTE + "Same grouping as AO Table D-4's bench-trial and jury-trial columns. Mistrials (DISP1 13) are "
         "counted with dismissals, as in D-4." + _SMALL, "more defendants go to trial", CRIM_SRC,
         formula="100 * terminated defendants with DISP1 in {2,3,8,9,16,17,18,19} / all terminated defendants"),
    Spec("idb_crim_pct_guilty_plea", "Criminal defendants convicted by guilty plea", "percent", "criminal", "plea",
         "terminated", CRIM_TERM_LOC, "; DISP1 in (4,5)",
         "Share of terminated defendants convicted on a plea of guilty or nolo contendere (DISP1 4, 5).",
         _CRIM_NOTE + "Same as AO Table D-4 'plea of guilty' (which includes nolo contendere pleas)." + _SMALL,
         "more defendants plead guilty", CRIM_SRC,
         formula="100 * terminated defendants with DISP1 in {4,5} / all terminated defendants"),
    Spec("idb_crim_pct_dismissed", "Criminal defendants dismissed", "percent", "criminal", "dismissed",
         "terminated", CRIM_TERM_LOC, "; DISP1 in (1,10,11,12,13,14,15,20,21)",
         "Share of terminated defendants not convicted and not acquitted: dismissed (with or without prejudice), "
         "nolle prosequi, pretrial diversion, mistrial, statistically closed, dismissal superseded (DISP1 1, 10-15, "
         "20, 21).", _CRIM_NOTE + "Same as AO Table D-4 'dismissed'. Includes dismissals because charges were "
         "superseded or refiled." + _SMALL, "more defendants' charges dismissed", CRIM_SRC,
         formula="100 * terminated defendants with DISP1 in {1,10,11,12,13,14,15,20,21} / all terminated defendants"),
    Spec("idb_crim_pct_acquitted", "Criminal defendants acquitted", "percent", "criminal", "acquitted",
         "terminated", CRIM_TERM_LOC, "; DISP1 in (2,3,16,18)",
         "Share of terminated defendants acquitted by the court or by a jury, including not guilty by reason of "
         "insanity (DISP1 2, 3, 16, 18).",
         _CRIM_NOTE + "Code 2 also covers a judgment of acquittal on the defendant's motion or the court's "
         "initiative. Values are small (national ~0.2-1%)." + _SMALL, "more defendants acquitted", CRIM_SRC,
         formula="100 * terminated defendants with DISP1 in {2,3,16,18} / all terminated defendants"),
]

_OFFENSE_VARS = [
    ("immigration", "Immigration offenses, share of criminal defendants filed",
     "D2 codes 8710-8750 (illegal entry, illegal re-entry, alien smuggling, visa fraud) and 9740.",
     "more of the criminal docket is immigration prosecutions"),
    ("drugs", "Drug offenses, share of criminal defendants filed",
     "D2 codes 6500-6999 (marijuana, narcotics, controlled substances, other drug offenses) and 7460.",
     "more of the criminal docket is drug prosecutions"),
    ("firearms_explosives", "Firearms and explosives offenses, share of criminal defendants filed",
     "D2 codes 7800-7831 and 9994.", "more of the criminal docket is firearms prosecutions"),
    ("fraud", "Fraud offenses, share of criminal defendants filed",
     "D2 codes 4500-4999 (tax, bank, mail/wire, health-care and other fraud), 7331, 8200, 8201, 8500, 8600, 8901.",
     "more of the criminal docket is fraud prosecutions"),
    ("violent", "Violent offenses, share of criminal defendants filed",
     "D2 homicide, robbery, assault, carjacking, kidnapping, violent racketeering, terrorism and other violent codes.",
     "more of the criminal docket is violent-crime prosecutions"),
    ("sex", "Sex offenses, share of criminal defendants filed",
     "D2 codes 5900, 6100-6400 (explicit material, sexual abuse, transportation, registry) and 6200.",
     "more of the criminal docket is sex-offense prosecutions"),
]
for cat, label, codes, hm in _OFFENSE_VARS:
    SPECS.append(Spec(
        f"idb_crim_pct_{cat}", label, "percent", "criminal", f"offense_{cat}", "filed", CRIM_FILED_LOC,
        f"; offense category of D2FOFFCD1 = {cat}",
        f"Share of criminal defendants filed whose most serious filing offense (D2FOFFCD1) is in the '{cat}' "
        f"category: {codes}",
        _CRIM_NOTE + "Offense categories follow AO Judicial Business Table D-2's headings; the code-to-category "
        "mapping is this lane's (pipeline/idb/codes.py), checked against the D-2 national totals for every year "
        "FY2005-2025 (offense_mapping_check.csv). D2 codes were created in FY2005 and back-filled by the FJC for "
        "FY1996-2004." + _SMALL, hm, CRIM_SRC,
        formula=f"100 * defendants filed with offense category {cat} / all defendants filed"))

SPEC_BY_ID = {s.id: s for s in SPECS}
