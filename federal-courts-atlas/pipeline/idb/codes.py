"""Code groupings used by the IDB lane.

Every code meaning comes from a registered source:
  * Civil DISP, PROCPROG, PROSE, CLASSACT, ORIGIN: FJC "Civil Codebook 1988 Forward" (source ``idb_civil_codebook``).
  * Civil NOS groups: the category headings of the AO civil cover sheet JS 44 (Rev. 03/24), section IV
    "Nature of Suit" (source ``ao_js44``), which is the form the NOS code is reported from; descriptions from
    the AO "Nature of Suit Code Descriptions" (source ``ao_nos_descriptions``).
  * Criminal DISP1, PROCCD, FOFFLVL1 and the count flags: FJC "Criminal Code Book 1996 Forward"
    (source ``idb_criminal_codebook``).
  * Criminal D2 offense code labels: the "Nature of Offense" (D2FOFFCD1) list of the FJC IDB interactive
    view (source ``idb_criminal_d2_labels``). The grouping of D2 codes into offense categories below is
    this lane's own mapping, made from those labels, the numeric blocks of the D2 list, and the category
    and sub-category headings of AO Judicial Business Table D-2 (source ``ao_jb_d2_<year>``). The codes
    whose block does not decide the category are listed in ``_D2_EXPLICIT`` with the reason; several were
    placed so that the FY2024 D-2 sub-category totals are reproduced exactly (e.g. 1700 = "Violent:
    Racketeering", 7471 = "General: Racketeering"). ``offense_mapping_check.csv`` compares every category
    with D-2 for FY2005-2025. It is not an AO-published crosswalk.
"""
from __future__ import annotations

# ----------------------------------------------------------------------------- civil: nature of suit
# JS 44 (Rev. 03/24) section IV headings -> NOS codes printed under them.
NOS_GROUPS: dict[str, tuple[str, list[int]]] = {
    "contract": ("Contract", [110, 120, 130, 140, 150, 151, 152, 153, 160, 190, 195, 196]),
    "real_property": ("Real property", [210, 220, 230, 240, 245, 290]),
    "torts_personal_injury": ("Torts: personal injury",
                              [310, 315, 320, 330, 340, 345, 350, 355, 360, 362, 365, 367, 368]),
    "torts_personal_property": ("Torts: personal property", [370, 371, 380, 385]),
    "civil_rights": ("Civil rights", [440, 441, 442, 443, 445, 446, 448]),
    "prisoner_petitions": ("Prisoner petitions", [463, 510, 530, 535, 540, 550, 555, 560]),
    "forfeiture_penalty": ("Forfeiture/penalty", [625, 690]),
    "labor": ("Labor", [710, 720, 740, 751, 790, 791]),
    "immigration": ("Immigration", [462, 465]),
    "bankruptcy": ("Bankruptcy", [422, 423]),
    "intellectual_property": ("Intellectual property rights", [820, 830, 835, 840, 880]),
    "social_security": ("Social Security", [861, 862, 863, 864, 865]),
    "federal_tax": ("Federal tax suits", [870, 871]),
    "other_statutes": ("Other statutes", [375, 376, 400, 410, 430, 450, 460, 470, 480, 485, 490, 850, 890,
                                          891, 893, 895, 896, 899, 950]),
}
NOS_GROUP_UNLISTED = "unlisted_code"   # NOS codes in the data that the current JS 44 does not print
NOS_TO_GROUP: dict[int, str] = {c: g for g, (_, codes) in NOS_GROUPS.items() for c in codes}
NOS_GROUP_LABEL = {g: lab for g, (lab, _) in NOS_GROUPS.items()}
NOS_GROUP_LABEL[NOS_GROUP_UNLISTED] = "Code not on current JS 44 (legacy or invalid)"

PATENT_NOS = 830          # "Patent" (codebook, JS 44)
PATENT_ANDA_NOS = 835     # "Patent - Abbreviated New Drug Application" (added to JS 44; first filings FY2017)
# "Prisoner Petitions" in the codebook's NOS list: the 510-560 block (510, 530, 535, 540, 550, 555, 560).
PRISONER_NOS = [510, 530, 535, 540, 550, 555, 560]

# ----------------------------------------------------------------------------- civil: disposition
# Civil codebook, DISP. (code: (label, group))
CIVIL_DISP: dict[int, tuple[str, str]] = {
    0: ("Transfer to another district", "transferred_remanded"),
    1: ("Remanded to state court", "transferred_remanded"),
    10: ("Multidistrict litigation transfer", "transferred_remanded"),
    11: ("Remanded to U.S. agency", "transferred_remanded"),
    2: ("Dismissed: want of prosecution", "dismissed_other"),
    3: ("Dismissed: lack of jurisdiction", "dismissed_other"),
    12: ("Dismissed: voluntarily", "dismissed_voluntary"),
    13: ("Dismissed: settled", "dismissed_settled"),
    14: ("Dismissed: other", "dismissed_other"),
    4: ("Judgment: default", "judgment_default_consent"),
    5: ("Judgment: consent", "judgment_default_consent"),
    6: ("Judgment: motion before trial", "judgment_motion_before_trial"),
    7: ("Judgment: jury verdict", "trial_jury"),
    8: ("Judgment: directed verdict", "trial_jury"),
    9: ("Judgment: court trial", "trial_court"),
    15: ("Judgment: award of arbitrator", "judgment_other"),
    16: ("Judgment: stayed pending bankruptcy", "judgment_other"),
    17: ("Judgment: other", "judgment_other"),
    18: ("Statistical closing", "statistical_closing"),
    19: ("Appeal affirmed (magistrate judge)", "judgment_other"),
    20: ("Appeal denied (magistrate judge)", "judgment_other"),
}
CIVIL_DISP_GROUP_LABEL = {
    "transferred_remanded": "Transferred or remanded",
    "dismissed_settled": "Dismissed: settled",
    "dismissed_voluntary": "Dismissed: voluntarily",
    "dismissed_other": "Dismissed: other (want of prosecution, lack of jurisdiction, other)",
    "judgment_default_consent": "Judgment: default or consent",
    "judgment_motion_before_trial": "Judgment on motion before trial",
    "trial_jury": "Judgment after jury trial (jury or directed verdict)",
    "trial_court": "Judgment after court (bench) trial",
    "judgment_other": "Other judgment (arbitration award, bankruptcy stay, magistrate appeal, other)",
    "statistical_closing": "Statistical closing",
    "missing": "Disposition not reported (-8 or blank)",
}
# Trial dispositions: jury verdict (7), directed verdict (8; a verdict directed to a jury during a jury
# trial) and court trial (9) -- the three "judgment on" codes the codebook defines as resulting from a trial.
CIVIL_TRIAL_DISP = [7, 8, 9]
CIVIL_JURY_DISP = [7, 8]
CIVIL_BENCH_DISP = [9]
# Procedural progress "during court trial" (6), "during jury trial" (7), "after court trial" (8),
# "after jury trial" (9): cases that reached trial whatever the final disposition (codebook PROCPROG).
CIVIL_REACHED_TRIAL_PROCPROG = [6, 7, 8, 9]

# PROSE: 1 = pro se plaintiff(s) only, 2 = pro se defendant(s) only, 3 = both, 0 = none, -8 missing.
PROSE_ANY = [1, 2, 3]
PROSE_PLAINTIFF = [1, 3]
PROSE_VALID = [0, 1, 2, 3]

# ----------------------------------------------------------------------------- criminal: disposition
# Criminal codebook DISP1 (code: (label, group)). The grouping reproduces AO Judicial Business Table D-4
# ("Not convicted: dismissed / acquitted by bench trial / acquitted by jury trial; Convicted: plea of guilty /
# convicted by bench trial / by jury trial"); see reconciliation (exact match of every D-4 national column).
CRIM_DISP: dict[int, tuple[str, str]] = {
    0: ("Rule 20(a)/21 transfer", "transfer"),
    1: ("Dismissed / government motion for acquittal / other non-conviction", "dismissed"),
    2: ("Acquitted by court", "acquitted_bench"),
    3: ("Acquitted by jury", "acquitted_jury"),
    4: ("Convicted: plea of guilty", "plea"),
    5: ("Convicted: plea of nolo contendere", "plea"),
    8: ("Convicted by court after trial", "convicted_bench"),
    9: ("Convicted by jury after trial", "convicted_jury"),
    10: ("NARA Titles I and III", "dismissed"),
    11: ("Nolle prosequi", "dismissed"),
    12: ("Pretrial diversion", "dismissed"),
    13: ("Mistrial", "dismissed"),
    14: ("Statistically closed", "dismissed"),
    15: ("Dismissed without prejudice", "dismissed"),
    16: ("Not guilty by reason of insanity (court trial)", "acquitted_bench"),
    17: ("Guilty but insane (court trial)", "convicted_bench"),
    18: ("Not guilty by reason of insanity (jury trial)", "acquitted_jury"),
    19: ("Guilty but insane (jury trial)", "convicted_jury"),
    20: ("Dismissal superseded", "dismissed"),
    21: ("Reassigned from judge to magistrate", "dismissed"),
}
CRIM_DISP_GROUP_LABEL = {
    "dismissed": "Not convicted: dismissed (incl. nolle prosequi, pretrial diversion, mistrial, other)",
    "acquitted_bench": "Not convicted: acquitted by court (bench trial)",
    "acquitted_jury": "Not convicted: acquitted by jury",
    "plea": "Convicted: plea of guilty or nolo contendere",
    "convicted_bench": "Convicted by court (bench trial)",
    "convicted_jury": "Convicted by jury",
    "missing": "Disposition not reported",
}
CRIM_TRIAL_GROUPS = ["acquitted_bench", "acquitted_jury", "convicted_bench", "convicted_jury"]
CRIM_ACQUIT_GROUPS = ["acquitted_bench", "acquitted_jury"]

# ----------------------------------------------------------------------------- criminal: offense categories
OFFENSE_CATEGORIES: dict[str, str] = {
    "violent": "Violent offenses",
    "fraud": "Fraud (incl. tax fraud)",
    "property_other": "Property offenses other than fraud (larceny, embezzlement, burglary, forgery, auto theft)",
    "drugs": "Drug offenses",
    "firearms_explosives": "Firearms and explosives",
    "sex": "Sex offenses",
    "justice_system": "Justice system offenses (escape, obstruction, perjury, contempt)",
    "immigration": "Immigration offenses",
    "general": "General offenses (bribery, money laundering, racketeering, extortion, gambling, other)",
    "regulatory": "Regulatory offenses",
    "traffic": "Traffic offenses",
    "unknown": "Offense code missing or not in the D2 code list",
}

# Explicit assignments for D2 codes whose numeric block does not decide the category.
_D2_EXPLICIT: dict[str, str] = {
    "1560": "violent",          # Fair Housing Law (assault block; D-2 counts it under Assault)
    "1602": "justice_system",   # Obstruction of Justice-Interference
    "1700": "violent",          # Racketeering, Violent Crime (D-2 "Violent: Racketeering")
    "6120": "violent",          # Interstate Domestic Violence
    "6121": "violent",          # Violent Offenses, Other
    "6200": "sex",              # White Slave & Importing Aliens (Mann Act)
    "6810": "drugs",            # Under Influence Alcohol/Drugs (drug block; D-2 "Other Drug Offenses")
    "7330": "general",          # Prison Contraband (D-2 "Other General Offenses")
    "7331": "fraud",            # Fraud, Other
    "7460": "drugs",            # Racketeering, Narcotics
    "7472": "violent", "7473": "violent", "7474": "violent", "7475": "violent",
    "7478": "violent", "7481": "violent",   # racketeering kidnap / maim / murder / robbery
    # 7471 "Racketeering, Murder" stays in the 74xx general block: D-2 FY2024 "General: Racketeering" (23)
    # equals the 7471 count exactly, while "Violent: Racketeering" (397) equals code 1700.
    "7700": "justice_system",   # Perjury
    "7910": "general",          # Arson (D-2 "Other Property" total matches only without it)
    "7940": "property_other",   # Malicious Destruction of Property
    "7941": "property_other",   # Other, Property
    "8200": "fraud",            # False Claims and Services, Government
    "8201": "fraud",            # Identification Documents and Information Fraud
    "8500": "fraud",            # Mail Fraud
    "8600": "fraud",            # Wire, Radio, or Television Fraud
    "8731": "immigration",      # Fraud And Misuse of Visa/Permits (D-2 lists it under Immigration)
    "8900": "regulatory",       # Liquor, Internal Revenue
    "8901": "fraud",            # Fraud, Other Tax
    "9740": "immigration",      # Alien Registration
    "9751": "regulatory", "9752": "regulatory", "9753": "regulatory", "9754": "regulatory",
    "9755": "regulatory",       # treason / espionage / sabotage / sedition / Smith Act (national defense)
    "9760": "general",          # Curfew, Restricted Areas (D-2 "Other General Offenses"; moving it closes the
                                # general/regulatory residual in FY2007-2025, e.g. FY2010: 64 defendants)
    "9810": "general", "9820": "general",   # obscene mail / matter (D-2 sex sub-totals exclude them)
    "9921": "justice_system", "9922": "justice_system",  # contempt
    "9923": "general",          # Forfeiture - Criminal or Drug Related
    "9926": "general",          # Extort/Oppress under Law
    "9944": "property_other",   # Destruction of Property, Interstate Commerce
    "9957": "violent",          # Terrorist Activity
    "9991": "property_other",   # Destroying Federal Property
    "9992": "justice_system",   # Intimidation of Witnesses, Jurors, etc.
    "9994": "firearms_explosives",  # Explosives (Except on Vessels)
}

# Numeric blocks of the D2 code list (lower bound inclusive, upper bound inclusive) -> category.
_D2_BLOCKS: list[tuple[int, int, str]] = [
    (100, 399, "violent"),            # homicide, manslaughter
    (1100, 1499, "violent"),          # robbery
    (1500, 1699, "violent"),          # assault
    (1800, 1899, "violent"),          # carjacking
    (2100, 2499, "property_other"),   # burglary
    (3100, 3899, "property_other"),   # larceny & theft
    (4100, 4399, "property_other"),   # embezzlement
    (4500, 4999, "fraud"),            # income tax, lending/bank, postal/wire, other fraud
    (5100, 5299, "property_other"),   # auto theft
    (5500, 5899, "property_other"),   # forgery and counterfeiting
    (5900, 5999, "sex"),              # sexually explicit material
    (6100, 6499, "sex"),              # sexual abuse, sex offenses, failure to register
    (6500, 6999, "drugs"),            # marijuana, narcotics, controlled substances, other drug
    (7100, 7199, "general"),          # bribery, conflict of interest
    (7200, 7299, "traffic"),          # traffic offenses
    (7300, 7329, "justice_system"),   # escape, bail jumping, criminal default, harboring
    (7400, 7499, "general"),          # extortion, racketeering, threats, money laundering
    (7500, 7599, "general"),          # gambling & lottery
    (7600, 7699, "violent"),          # kidnapping
    (7800, 7899, "firearms_explosives"),  # firearms & weapons
    (7900, 7999, "general"),          # misc. general offenses
    (8100, 8199, "general"),          # failure to pay child support
    (8700, 8799, "immigration"),      # immigration laws
    (9000, 9999, "regulatory"),       # regulatory / other federal statutes
]


def d2_category(code) -> str:
    """Map a 4-character D2 offense code to an offense category (see module docstring)."""
    if code is None:
        return "unknown"
    s = str(code).strip()
    if not s or s == "-8":
        return "unknown"
    if s.isdigit() and len(s) < 4:
        s = s.zfill(4)
    if s in _D2_EXPLICIT:
        return _D2_EXPLICIT[s]
    if not s.isdigit():
        return "unknown"
    n = int(s)
    for lo, hi, cat in _D2_BLOCKS:
        if lo <= n <= hi:
            return cat
    return "unknown"


DRUG_MARIJUANA_BLOCK = (6500, 6599)
