// The Courtroom: seats, their plain-English roles, the atlas measures each seat shows,
// and the room layout shared by the 3D scene and the 2D floor-plan fallback.
//
// No statistic lives here. Stats are named by variable id and read at runtime from
// public/data/values/<id>.json; labels, units, explainers and caveats come from
// public/data/variables.json. Copy rules: plain English, short sentences, no em-dashes,
// patterns not motives, nothing about individual judges.
//
// Coordinates are meters. x runs left to right as seen from the gallery, y is up,
// z runs from the bench (negative) toward the gallery doors (positive).

export type SeatId = 'judge' | 'clerk' | 'reporter' | 'witness' | 'jury' | 'prosecution' | 'defense' | 'lectern' | 'gallery';

export type Vec3 = readonly [number, number, number];

export interface SeatStat {
  /** Variable id in variables.json / values/<id>.json. */
  variable: string;
  /**
   * The variable's label with glossary markup ([[term-id|text]]). Used only when, stripped of
   * markup, it still equals the published label exactly; otherwise the plain label is shown.
   */
  labelRich?: string;
  /**
   * Shown only if values/<id>.json exists. When it does not, the group shows `missingNote`
   * instead of a row (the measure is not in the atlas's published data).
   */
  optional?: boolean;
}

export interface SeatGroup {
  title?: string;
  stats: SeatStat[];
  /** Shown in place of optional stats whose values file is not published. */
  missingNote?: string;
}

export interface SeatDef {
  id: SeatId;
  /** Full name, used as the panel heading. */
  name: string;
  /** Short name for pins and compact lists. */
  short: string;
  /** Who sits here and what they do. Authored text: [[term-id|text]] marks glossary terms. */
  role: string;
  /** A plain statement of what the atlas does not have for this seat. */
  noData?: string;
  /** A note under the figures (scope of the numbers). */
  note?: string;
  groups: SeatGroup[];
  /** Extra blocks rendered by the panel. */
  extras?: Array<'population' | 'places' | 'record'>;
  /** Camera: eye position and the point the eye looks at when seated here. */
  eye: Vec3;
  look: Vec3;
  /** Where the floating label sits in the room view. */
  pin: Vec3;
  /** Click target: axis-aligned box [min, max]. */
  hit: readonly [Vec3, Vec3];
}

export const SEATS: readonly SeatDef[] = [
  {
    id: 'judge',
    name: 'The judge’s bench',
    short: 'Judge',
    role:
      'The district judge presides from the raised bench. The judge rules on motions and objections, instructs the jury, decides [[bench-trial|bench trials]] and imposes sentences. Most district judges are [[article-iii|Article III]] judges: nominated by the President, confirmed by the Senate and appointed for life. Judges in Guam, the Virgin Islands and the Northern Mariana Islands serve 10-year terms ([[article-iv|Article IV]]). [[magistrate-judge|Magistrate judges]] handle many pretrial matters.',
    note: 'These counts and workloads describe the whole court. The atlas reports no statistics about individual judges.',
    groups: [
      {
        title: 'The bench',
        stats: [
          { variable: 'judgeships', labelRich: 'Authorized [[judgeship|judgeships]]' },
          { variable: 'active_judges' },
          { variable: 'senior_judges', labelRich: '[[senior-status|Senior]] judges in office' },
        ],
      },
      {
        title: 'Workload',
        stats: [
          { variable: 'weighted_filings_per_judgeship', labelRich: '[[weighted-filings|Weighted filings]] per judgeship' },
          { variable: 'vacant_judgeship_months', labelRich: '[[vacant-judgeship-months|Vacant judgeship months]]' },
        ],
      },
    ],
    eye: [0, 2.0, -7.72],
    look: [0, 0.2, -0.4],
    pin: [0, 2.75, -8.2],
    hit: [
      [-3.4, 0, -9.7],
      [3.4, 2.6, -6.6],
    ],
  },
  {
    id: 'clerk',
    name: 'The courtroom deputy',
    short: 'Deputy clerk',
    role:
      'The courtroom deputy sits just below the bench and works for the clerk of court. The deputy calls each case, swears in witnesses, keeps track of exhibits and records the minutes of each hearing. Behind the deputy is the clerk’s office, which keeps the docket: every case filed, closed and still [[pending-case|pending]].',
    groups: [
      {
        title: 'The docket',
        stats: [
          { variable: 'filings_per_judgeship' },
          { variable: 'terminations_per_judgeship', labelRich: 'Cases [[termination|closed]] per judgeship' },
          { variable: 'pending_per_judgeship', labelRich: '[[pending-case|Pending cases]] per judgeship' },
        ],
      },
    ],
    eye: [-3.3, 1.36, -6.05],
    look: [1.2, 0.95, 1.0],
    pin: [-3.3, 1.95, -5.8],
    hit: [
      [-4.6, 0, -6.7],
      [-2.0, 1.7, -4.95],
    ],
  },
  {
    id: 'reporter',
    name: 'The court reporter',
    short: 'Reporter',
    role:
      'The court reporter makes the official word-for-word record of what is said in court, often on a stenotype machine. Federal law requires a verbatim record of every session of the court (28 U.S.C. § 753). An appeal is decided on the record, so the transcript matters long after the trial ends.',
    noData:
      'The atlas has no data on court reporters or transcripts. In their place, here is the atlas’s own record: where every number in this courtroom comes from.',
    groups: [],
    extras: ['record'],
    eye: [1.6, 1.18, -6.0],
    look: [-1.2, 1.1, 0.6],
    pin: [1.6, 1.75, -5.75],
    hit: [
      [1.0, 0, -6.6],
      [2.2, 1.45, -5.05],
    ],
  },
  {
    id: 'witness',
    name: 'The witness stand',
    short: 'Witness',
    role:
      'Witnesses testify under oath from the stand, beside the bench and in view of the jury. Lawyers question them on direct examination and cross-examination, and the judge rules on objections. Testimony is heard at trials and at some hearings.',
    groups: [
      {
        stats: [
          { variable: 'trials_per_judgeship' },
          { variable: 'civil_trial_months', labelRich: '[[median-time|Median time]] from filing to civil trial' },
        ],
      },
    ],
    eye: [4.3, 1.52, -7.45],
    look: [-1.4, 1.15, 0.2],
    pin: [4.3, 2.35, -7.4],
    hit: [
      [3.55, 0, -8.3],
      [5.0, 2.1, -6.55],
    ],
  },
  {
    id: 'jury',
    name: 'The jury box',
    short: 'Jury',
    role:
      'A federal criminal [[jury-trial|jury]] normally has 12 members, and its verdict must be unanimous. A civil jury has 6 to 12 members. Jurors are drawn at random from lists of citizens who live in the district, such as voter rolls. In a [[bench-trial|bench trial]] there is no jury, and the judge decides the facts.',
    groups: [
      {
        stats: [
          { variable: 'civil_trial_rate_pct' },
          { variable: 'criminal_trial_rate_pct' },
          { variable: 'jurors_avg_present', optional: true },
          { variable: 'jurors_pct_not_selected', optional: true },
        ],
        missingNote:
          'The courts also count how many people come for jury selection and how many are not selected or challenged. Those counts are not part of the atlas yet, so they are not shown here.',
      },
    ],
    eye: [7.0, 1.58, -2.7],
    look: [1.2, 1.15, -5.6],
    pin: [6.35, 2.25, -2.6],
    hit: [
      [4.95, 0, -5.9],
      [7.75, 1.9, 0.7],
    ],
  },
  {
    id: 'prosecution',
    name: 'The prosecution table',
    short: 'Prosecution',
    role:
      'In a criminal case, the government sits here. An Assistant [[us-attorney|U.S. Attorney]] represents the United States, and federal prosecutors decide which cases to bring. Only the government can ask for a [[5k1-1|§5K1.1]] sentence reduction for a defendant’s substantial assistance. In a civil case, the party bringing the suit sits at a counsel table like this one.',
    groups: [
      {
        title: 'Criminal cases',
        stats: [
          { variable: 'felony_defendants_per_100k', labelRich: '[[felony|Felony]] defendants charged per 100,000 residents' },
          { variable: 'guilty_plea_pct' },
          { variable: 'substantial_assistance_pct', labelRich: '[[5k1-1|Substantial-assistance]] departures (§5K1.1)' },
        ],
      },
      {
        title: 'Most common charges',
        stats: [{ variable: 'crim_drugs_pct' }, { variable: 'crim_immigration_pct' }, { variable: 'crim_firearms_pct' }],
      },
    ],
    eye: [2.7, 1.22, -0.45],
    look: [0.2, 1.55, -8.0],
    pin: [2.7, 1.7, -1.25],
    hit: [
      [1.3, 0, -2.0],
      [4.1, 1.4, -0.05],
    ],
  },
  {
    id: 'defense',
    name: 'The defense table',
    short: 'Defense',
    role:
      'The defendant sits here with defense counsel. The Sixth Amendment guarantees a lawyer in a federal criminal case. If a defendant cannot afford one, the court appoints a federal defender or a private lawyer paid under the Criminal Justice Act. In a civil case, the party being sued sits here.',
    noData:
      'The atlas has no data on defense lawyers. It cannot show how many defendants had a federal defender, an appointed private lawyer or a lawyer they hired. The figures below describe people sentenced, and civil cases in which a party had no lawyer.',
    groups: [
      {
        title: 'People sentenced',
        stats: [
          { variable: 'prison_pct' },
          { variable: 'median_sentence_months' },
          { variable: 'within_range_pct', labelRich: 'Sentenced within the [[guideline-range|guideline range]]' },
        ],
      },
      {
        title: 'Civil cases',
        stats: [{ variable: 'pro_se_pct', labelRich: 'Civil cases with a [[pro-se|self-represented]] party' }],
      },
    ],
    eye: [-2.7, 1.22, -0.45],
    look: [-0.2, 1.55, -8.0],
    pin: [-2.7, 1.7, -1.25],
    hit: [
      [-4.1, 0, -2.0],
      [-1.3, 1.4, -0.05],
    ],
  },
  {
    id: 'lectern',
    name: 'The lectern',
    short: 'Lectern',
    role:
      'Lawyers stand at the lectern to question witnesses, argue motions and speak to the jury in opening statements and closing arguments. Before a case gets this far, it moves through filings, [[discovery]] and pretrial motions. Most cases end along the way. The figures below show how long cases take from filing to an end, with or without a trial.',
    groups: [
      {
        stats: [
          { variable: 'civil_disposition_months', labelRich: '[[median-time|Median time]] to resolve a civil case' },
          { variable: 'criminal_disposition_months', labelRich: '[[median-time|Median time]] to resolve a felony case' },
          { variable: 'civil_over_3yrs_pct' },
        ],
      },
    ],
    eye: [0, 1.64, -2.45],
    look: [0, 1.6, -8.5],
    pin: [0, 2.05, -3.1],
    hit: [
      [-0.5, 0, -3.55],
      [0.5, 1.45, -2.65],
    ],
  },
  {
    id: 'gallery',
    name: 'The gallery',
    short: 'Gallery',
    role:
      'Federal courtrooms are open to the public, with few exceptions. Anyone may sit in the gallery and watch. The federal criminal rules bar photographs and broadcasts from the courtroom during proceedings. The court serves everyone who lives in its district.',
    groups: [{ title: 'Filings and residents', stats: [{ variable: 'civil_filings_per_100k' }] }],
    extras: ['population', 'places'],
    eye: [-2.4, 1.22, 5.6],
    look: [0.4, 1.3, -7.0],
    pin: [-4.2, 1.75, 6.6],
    hit: [
      [-7.45, 0, 2.9],
      [7.45, 1.25, 11.0],
    ],
  },
];

export const SEAT_BY_ID: ReadonlyMap<SeatId, SeatDef> = new Map(SEATS.map((s) => [s.id, s]));

export function isSeatId(v: string | null | undefined): v is SeatId {
  return !!v && SEAT_BY_ID.has(v as SeatId);
}

/** Every variable any seat reads (for preloading and for the record). */
export function seatVariables(): string[] {
  return [...new Set(SEATS.flatMap((s) => s.groups.flatMap((g) => g.stats.map((st) => st.variable))))];
}

/* ---- Room layout (meters), shared by the 3D scene and the floor plan ---------------------- */

export const ROOM = {
  x0: -8,
  x1: 8,
  z0: -10,
  z1: 12,
  height: 6,
  /** The bar (railing) between the well and the gallery, with a gate gap at the center. */
  barZ: 2.0,
  gateHalf: 0.7,
} as const;

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Top-view footprints, used by the floor plan (and as a reference for the scene). */
export const PLAN: Record<string, Rect | Rect[]> = {
  benchPlatform: { x0: -3.4, x1: 3.4, z0: -9.6, z1: -6.6 },
  bench: { x0: -3.2, x1: 3.2, z0: -7.8, z1: -6.85 },
  witness: { x0: 3.6, x1: 5.0, z0: -8.2, z1: -6.6 },
  clerk: { x0: -4.5, x1: -2.1, z0: -6.6, z1: -5.0 },
  reporter: { x0: 1.1, x1: 2.1, z0: -6.5, z1: -5.15 },
  juryBox: { x0: 5.0, x1: 7.7, z0: -5.8, z1: 0.6 },
  prosecution: { x0: 1.4, x1: 4.0, z0: -1.9, z1: -0.9 },
  defense: { x0: -4.0, x1: -1.4, z0: -1.9, z1: -0.9 },
  lectern: { x0: -0.32, x1: 0.32, z0: -3.35, z1: -2.85 },
};

/** Juror chair centers: two rows of seven (12 jurors and 2 alternates). */
export const JUROR_CHAIRS: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < 7; i++) {
    const z = -5.15 + i * 0.83;
    out.push([5.78, 0.12, z]);
    out.push([7.0, 0.45, z]);
  }
  return out;
})();

/** Gallery pew rows: z of each row's front edge, and the two banks' x extents. */
export const PEW_ROWS: readonly number[] = [3.3, 4.45, 5.6, 6.75, 7.9, 9.05, 10.2];
export const PEW_BANKS: ReadonlyArray<readonly [number, number]> = [
  [-7.3, -1.0],
  [1.0, 7.3],
];
