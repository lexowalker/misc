// Glossary for inline term popovers (components/glossary.ts) and the Learn page.
// Plain-English, neutral, and limited to well-established law and practice.
// Citations point to the governing statute, rule or decision. No statistics here.
//
// Inline markup inside definitions: *italic* (case names).

export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  /** Governing authority, shown under the definition. */
  cite?: string;
  /** Other ids worth reading next. */
  see?: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  // ---- Sentencing ------------------------------------------------------
  {
    id: 'guideline-range',
    term: 'guideline range',
    definition:
      'The range of months in prison that the U.S. Sentencing Guidelines recommend for a particular defendant. It is read from the Sentencing Table where the offense level (based on the offense and related conduct, with adjustments) meets the criminal history category (based on prior convictions). Since *Booker* (2005) the range is advisory: the judge must calculate it correctly and consider it, but may impose a different sentence within the limits set by statute.',
    cite: 'U.S.S.G. ch. 5, pt. A; 18 U.S.C. § 3553(a)(4)',
    see: ['booker', 'departure', 'variance'],
  },
  {
    id: '5k1-1',
    term: '§5K1.1 substantial assistance',
    definition:
      'A Guidelines policy statement that allows a sentence below the guideline range when the government files a motion stating that the defendant gave substantial assistance in investigating or prosecuting another person. Only the government can make the motion; the judge decides how much of a reduction, if any, to grant. A related statute lets a judge go below a mandatory minimum on such a motion.',
    cite: 'U.S.S.G. § 5K1.1; 18 U.S.C. § 3553(e)',
    see: ['departure', 'mandatory-minimum'],
  },
  {
    id: '5k3-1',
    term: '§5K3.1 early disposition',
    definition:
      'A Guidelines policy statement that allowed a departure of up to four offense levels, on the government’s motion, under an early disposition (“fast-track”) program authorized by the Attorney General and the district’s U.S. Attorney. Since November 1, 2025 the same reduction appears in §3F1.1 as a decrease in offense level rather than a departure. Defendants in these programs generally agree to plead guilty promptly and to waive certain procedural rights. Such programs have been used mainly for immigration offenses.',
    cite: 'U.S.S.G. § 5K3.1 (through October 2025); § 3F1.1 (from November 1, 2025)',
    see: ['departure', 'plea-agreement'],
  },
  {
    id: 'variance',
    term: 'variance',
    definition:
      'A sentence outside the guideline range that a judge imposes based on the sentencing factors in 18 U.S.C. § 3553(a), such as the nature of the offense, the defendant’s history and the need for deterrence, rather than on a departure provision in the Guidelines Manual. Variances became possible when *Booker* made the Guidelines advisory. Sentencing Commission data report variances separately from departures.',
    cite: '18 U.S.C. § 3553(a); United States v. Booker, 543 U.S. 220 (2005)',
    see: ['departure', 'sentencing-factors'],
  },
  {
    id: 'departure',
    term: 'departure',
    definition:
      'A sentence outside the guideline range for a reason that the Guidelines Manual itself recognizes, such as substantial assistance (§5K1.1). Amendments effective November 1, 2025 removed most departure provisions from the Manual, kept §5K1.1, and turned the early disposition departure (§5K3.1) into a reduction in offense level (§3F1.1). Sentencing data through FY 2025 still distinguish departures from variances.',
    cite: 'U.S.S.G. ch. 5, pt. K',
    see: ['variance', '5k1-1', '5k3-1'],
  },
  {
    id: 'sentencing-factors',
    term: 'sentencing factors (§ 3553(a))',
    definition:
      'The considerations a federal judge must weigh in choosing a sentence: among them the nature of the offense and the defendant’s history, the need for just punishment, deterrence, public protection and rehabilitation, the kinds of sentences available, the guideline range and Commission policy statements, the need to avoid unwarranted disparities among similar defendants, and restitution to victims.',
    cite: '18 U.S.C. § 3553(a)',
  },
  {
    id: 'mandatory-minimum',
    term: 'mandatory minimum',
    definition:
      'A minimum prison term that a statute requires for certain offenses. A judge may sentence below it only where a statute allows, such as on a government motion for substantial assistance or under the “safety valve” for certain drug offenders.',
    cite: '18 U.S.C. § 3553(e)–(f)',
  },
  {
    id: 'supervised-release',
    term: 'supervised release',
    definition:
      'A period of supervision in the community that follows a prison sentence, overseen by a U.S. probation officer and subject to conditions set by the judge. Judges may impose it in most felony cases and must for some offenses. It replaced federal parole for offenses committed on or after November 1, 1987. Violating the conditions can lead to revocation and more time in prison.',
    cite: '18 U.S.C. § 3583',
  },
  {
    id: 'felony',
    term: 'felony',
    definition:
      'A federal crime punishable by death or by imprisonment for more than one year. Offenses with a maximum of one year or less are misdemeanors or infractions.',
    cite: '18 U.S.C. § 3559(a)',
  },
  {
    id: 'presentence-report',
    term: 'presentence investigation report',
    definition:
      'A report prepared by a U.S. probation officer before sentencing. It describes the offense and the defendant’s background and calculates the guideline range. Both sides may object to it, and the judge resolves disputed points.',
    cite: 'Fed. R. Crim. P. 32',
  },

  // ---- Criminal procedure ---------------------------------------------
  {
    id: 'criminal-complaint',
    term: 'criminal complaint',
    definition:
      'A sworn written statement of the essential facts of an offense, presented to a magistrate judge, that can support an arrest warrant or summons. Many federal cases begin with a complaint, but a felony prosecution must then proceed by indictment or, if the defendant waives indictment, by information.',
    cite: 'Fed. R. Crim. P. 3–4',
  },
  {
    id: 'grand-jury',
    term: 'grand jury',
    definition:
      'A body of 16 to 23 citizens that hears evidence presented by prosecutors, in secret, and decides whether there is probable cause to charge a person with a crime.',
    cite: 'Fed. R. Crim. P. 6',
  },
  {
    id: 'indictment',
    term: 'indictment',
    definition:
      'A formal written accusation issued by a grand jury. The Fifth Amendment requires one to prosecute a federal felony unless the defendant waives it.',
    cite: 'U.S. Const. amend. V; Fed. R. Crim. P. 7',
  },
  {
    id: 'information',
    term: 'information',
    definition:
      'A charging document filed by a prosecutor without a grand jury. In federal court it is used for misdemeanors and for felonies when the defendant waives indictment.',
    cite: 'Fed. R. Crim. P. 7',
  },
  {
    id: 'initial-appearance',
    term: 'initial appearance',
    definition:
      'A defendant’s first appearance before a judge, usually a magistrate judge, after arrest. The judge explains the charges and the defendant’s rights, addresses appointment of counsel, and takes up whether the defendant will be released or detained.',
    cite: 'Fed. R. Crim. P. 5',
  },
  {
    id: 'detention-hearing',
    term: 'detention hearing',
    definition:
      'A hearing at which a judge decides whether a defendant will be released before trial, and on what conditions, or held because no conditions can reasonably assure the defendant’s appearance and the safety of the community.',
    cite: 'Bail Reform Act, 18 U.S.C. § 3142',
  },
  {
    id: 'arraignment',
    term: 'arraignment',
    definition:
      'The proceeding at which the defendant is formally informed of the charges in the indictment or information and enters a plea.',
    cite: 'Fed. R. Crim. P. 10',
  },
  {
    id: 'discovery',
    term: 'discovery',
    definition:
      'The pretrial exchange of information between the parties. In criminal cases the government must disclose specified evidence on request and, under *Brady v. Maryland*, evidence favorable to the defense.',
    cite: 'Fed. R. Crim. P. 16; Brady v. Maryland, 373 U.S. 83 (1963)',
  },
  {
    id: 'plea-agreement',
    term: 'plea agreement',
    definition:
      'An agreement in which a defendant pleads guilty (or no contest), usually in exchange for concessions from the prosecution, such as dismissing other charges, recommending a sentence or agreeing to a specific sentence. The judge decides whether to accept it.',
    cite: 'Fed. R. Crim. P. 11',
  },
  {
    id: 'bench-trial',
    term: 'bench trial',
    definition:
      'A trial in which the judge, not a jury, decides the facts and the verdict. In a federal criminal case it requires the defendant’s written waiver of a jury, the government’s consent and the court’s approval.',
    cite: 'Fed. R. Crim. P. 23(a)',
  },
  {
    id: 'jury-trial',
    term: 'jury trial',
    definition:
      'A trial in which a jury decides the facts. Federal criminal juries normally have 12 members and must reach a unanimous verdict. Federal civil juries have 6 to 12 members, and their verdicts must be unanimous unless the parties agree otherwise.',
    cite: 'Fed. R. Crim. P. 23(b), 31(a); Fed. R. Civ. P. 48',
  },
  {
    id: 'magistrate-judge',
    term: 'magistrate judge',
    definition:
      'A judicial officer appointed by a district court’s judges for an eight-year term. Magistrate judges handle initial appearances, detention hearings, many pretrial matters and misdemeanor cases, and may try civil cases with the parties’ consent. They are not Article III judges.',
    cite: '28 U.S.C. §§ 631, 636',
  },
  {
    id: 'us-attorney',
    term: 'U.S. Attorney',
    definition:
      'The chief federal prosecutor for a judicial district, nominated by the President and confirmed by the Senate. Each district has a U.S. Attorney’s office, except that Guam and the Northern Mariana Islands share one.',
    cite: '28 U.S.C. § 541',
  },

  // ---- Civil and caseload statistics -----------------------------------
  {
    id: 'nature-of-suit',
    term: 'nature of suit',
    definition:
      'A code that classifies a federal civil case by subject, for example contract, civil rights, prisoner petitions or patent (code 830). The filer selects it on the civil cover sheet (form JS 44), and federal court statistics, including the FJC’s Integrated Database, group civil cases by it.',
    cite: 'Civil Cover Sheet, Form JS 44',
    see: ['idb'],
  },
  {
    id: 'pro-se',
    term: 'pro se',
    definition:
      'Latin for “for oneself”: a party who appears in court without a lawyer. In federal district courts, pro se litigants appear mostly in civil cases, including many filed by people in prison.',
    cite: '28 U.S.C. § 1654',
  },
  {
    id: 'prisoner-petition',
    term: 'prisoner petition',
    definition:
      'A civil case filed by a person in custody. In federal court statistics the category includes habeas corpus petitions challenging a conviction or sentence, motions to vacate a federal sentence, and civil rights suits about conditions of confinement. The civil cover sheet also lists habeas petitions by immigration detainees (code 463) as prisoner petitions. The atlas’s prisoner-petition share leaves those out (codes 510 to 560 only), while its case-mix charts include them.',
    cite: '28 U.S.C. §§ 2241, 2254, 2255; 42 U.S.C. § 1983',
  },
  {
    id: 'termination',
    term: 'termination',
    definition:
      'The closing of a case by any means: judgment after trial, dismissal, settlement, guilty plea, transfer or otherwise. Courts count terminations to show how many cases they resolved in a period. Criminal statistics often count defendants rather than cases.',
  },
  {
    id: 'pending-case',
    term: 'pending case',
    definition:
      'A case that has been filed but not yet terminated as of a given date. Pending counts are snapshots, usually taken at the end of a reporting period.',
  },
  {
    id: 'median-time',
    term: 'median time to disposition',
    definition:
      'The midpoint of the time that cases closed during a period took to get from filing to disposition: half took less time and half took more. Federal Court Management Statistics report it in months, separately for civil cases and for criminal felony defendants. Unlike an average, a median is not pulled up by a few unusually long cases.',
    see: ['fcms'],
  },
  {
    id: 'weighted-filings',
    term: 'weighted filings',
    definition:
      'A workload measure that counts each new case according to the judicial time cases of its type typically require, using case weights developed by the Federal Judicial Center and approved by the Judicial Conference of the United States. A complex case counts as more than one filing and a routine one as less. Federal Court Management Statistics report weighted filings per authorized judgeship.',
    see: ['judgeship', 'fcms'],
  },
  {
    id: 'judgeship',
    term: 'judgeship',
    definition:
      'A judge’s position that Congress has authorized for a court. The number of permanent district judgeships in each district is set by statute; Congress also creates temporary judgeships, which lapse when a vacancy occurs after a specified date. A judgeship can be filled or vacant.',
    cite: '28 U.S.C. § 133',
  },
  {
    id: 'vacant-judgeship-months',
    term: 'vacant judgeship months',
    definition:
      'The total number of months during a reporting period that a court’s authorized judgeships went unfilled. One seat vacant for a full year counts as 12 vacant judgeship months; so do two seats each vacant for six months.',
    see: ['judgeship'],
  },
  {
    id: 'senior-status',
    term: 'senior status',
    definition:
      'A form of semi-retirement for Article III judges who meet the “Rule of 80”: at least 65 years old, with age plus years of service totaling at least 80 (and at least 10 years of service). A senior judge remains a federal judge and may keep hearing cases, often a reduced load, while the judgeship becomes vacant and can be filled by a new appointee.',
    cite: '28 U.S.C. § 371(c)',
    see: ['article-iii'],
  },

  // ---- Structure -------------------------------------------------------
  {
    id: 'article-iii',
    term: 'Article III',
    definition:
      'The part of the U.S. Constitution that establishes the federal judicial power. Article III judges, including Supreme Court justices and the judges of the courts of appeals and district courts, are nominated by the President and confirmed by the Senate, hold office “during good Behaviour” (in practice, for life unless they resign, retire, or are impeached and removed), and cannot have their pay reduced.',
    cite: 'U.S. Const. art. III, § 1',
  },
  {
    id: 'article-iv',
    term: 'Article IV territorial court',
    definition:
      'A federal court that Congress created for a U.S. territory under its power over territories in Article IV, rather than under Article III. The District Courts of Guam, the Northern Mariana Islands and the Virgin Islands are territorial courts; their judges are nominated by the President and confirmed by the Senate for ten-year terms. The District of Puerto Rico, by contrast, is an Article III court.',
    cite: 'U.S. Const. art. IV, § 3; 48 U.S.C. §§ 1424b, 1614, 1821',
  },
  {
    id: 'district',
    term: 'district',
    definition:
      'The basic geographic unit of the federal trial courts. Each state has one to four districts, and the District of Columbia and Puerto Rico have one each, for 91 Article III district courts; the territorial courts of Guam, the Northern Mariana Islands and the Virgin Islands bring the total to 94. Boundaries are set by statute, mostly as lists of counties.',
    cite: '28 U.S.C. §§ 81–131',
  },
  {
    id: 'division',
    term: 'division',
    definition:
      'A statutory subdivision of a district, usually a group of counties served by a particular place of holding court. Some districts are divided into divisions and others are not.',
    cite: '28 U.S.C. §§ 81–131',
  },
  {
    id: 'circuit',
    term: 'circuit',
    definition:
      'A group of districts whose appeals go to the same court of appeals. There are 12 regional circuits: the First through the Eleventh and the District of Columbia Circuit. A thirteenth court of appeals, the Federal Circuit, hears appeals nationwide in particular subjects, including patent cases.',
    cite: '28 U.S.C. §§ 41, 1291, 1295',
    see: ['federal-circuit'],
  },
  {
    id: 'federal-circuit',
    term: 'Federal Circuit',
    definition:
      'The U.S. Court of Appeals for the Federal Circuit, in Washington, D.C. Its jurisdiction is defined by subject rather than geography: it hears appeals from every district court in patent cases and certain claims against the United States, as well as appeals from several specialized courts and agencies.',
    cite: '28 U.S.C. § 1295',
  },
  {
    id: 'court-of-appeals',
    term: 'court of appeals',
    definition:
      'The intermediate federal appellate court for a circuit. It reviews district-court decisions for legal error; most appeals are decided by panels of three judges.',
    cite: '28 U.S.C. §§ 43, 46, 1291',
  },
  {
    id: 'certiorari',
    term: 'certiorari',
    definition:
      'The writ by which the Supreme Court agrees to review a lower court’s decision. Parties ask by filing a petition, and the Court has discretion over which petitions to grant.',
    cite: '28 U.S.C. § 1254; Sup. Ct. R. 10',
  },

  // ---- Landmarks -------------------------------------------------------
  {
    id: 'booker',
    term: 'Booker',
    definition:
      '*United States v. Booker* (decided January 12, 2005): the Supreme Court held that applying the Federal Sentencing Guidelines as mandatory violated the Sixth Amendment jury-trial right, because judges had to increase sentences based on facts a jury had not found. Its remedy made the Guidelines “effectively advisory.” Judges must still calculate and consider the guideline range, and appeals courts review sentences for reasonableness.',
    cite: 'United States v. Booker, 543 U.S. 220 (2005)',
    see: ['guideline-range', 'variance'],
  },
  {
    id: 'first-step-act',
    term: 'First Step Act',
    definition:
      'A federal law enacted December 21, 2018 that changed sentencing and prison policy. Among other things, it broadened the “safety valve” that lets some drug defendants be sentenced below a mandatory minimum, reduced certain mandatory minimums for repeat drug offenders, made the Fair Sentencing Act of 2010’s crack-cocaine changes retroactive, ended the “stacking” of certain firearm sentences under 18 U.S.C. § 924(c), and created time credits for completing prison programs.',
    cite: 'Pub. L. No. 115-391, 132 Stat. 5194 (2018)',
    see: ['mandatory-minimum'],
  },
  {
    id: 'tc-heartland',
    term: 'TC Heartland',
    definition:
      '*TC Heartland LLC v. Kraft Foods Group Brands LLC* (decided May 22, 2017): the Supreme Court held that under the patent venue statute a domestic corporation “resides” only in its state of incorporation. Patent-infringement suits against U.S. corporations may therefore be filed only there or where the company has committed acts of infringement and has a regular and established place of business.',
    cite: 'TC Heartland LLC v. Kraft Foods Group Brands LLC, 581 U.S. 258 (2017); 28 U.S.C. § 1400(b)',
  },

  // ---- Data sources ----------------------------------------------------
  {
    id: 'idb',
    term: 'IDB',
    definition:
      'The Integrated Database: the Federal Judicial Center’s case-level records of federal civil, criminal, appellate and bankruptcy cases, compiled from data the courts report to the Administrative Office of the U.S. Courts.',
    cite: 'Federal Judicial Center',
  },
  {
    id: 'fcms',
    term: 'FCMS',
    definition:
      'Federal Court Management Statistics: tables published by the Administrative Office of the U.S. Courts that profile each federal court’s caseload, workload, judgeship vacancies and case-processing times over 12-month periods.',
    cite: 'Administrative Office of the U.S. Courts',
  },
  {
    id: 'ussc',
    term: 'USSC',
    definition:
      'The United States Sentencing Commission: an independent agency in the judicial branch, created by the Sentencing Reform Act of 1984, that writes and amends the Federal Sentencing Guidelines and collects, analyzes and publishes data on federal sentences.',
    cite: '28 U.S.C. § 991',
  },
];

const BY_ID = new Map(GLOSSARY.map((g) => [g.id, g]));

export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id);
}
