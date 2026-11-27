// Landmark events for time-series annotations (time machine, sparklines, stories).
// Dates are exact; periodYear() places each on the right period for a dataset
// (e.g. the First Step Act, signed Dec. 21, 2018, falls in federal FY 2019).

export interface AtlasEvent {
  id: string;
  /** ISO date. */
  date: string;
  label: string;
  short: string;
  description: string;
  /** Glossary term id for a popover, if any. */
  term?: string;
}

export const EVENTS: AtlasEvent[] = [
  {
    id: 'booker',
    date: '2005-01-12',
    label: 'United States v. Booker',
    short: 'Booker',
    description: 'The Supreme Court makes the Federal Sentencing Guidelines advisory rather than mandatory.',
    term: 'booker',
  },
  {
    id: 'tc-heartland',
    date: '2017-05-22',
    label: 'TC Heartland v. Kraft Foods',
    short: 'TC Heartland',
    description: 'The Supreme Court narrows where patent-infringement suits against U.S. corporations may be filed.',
    term: 'tc-heartland',
  },
  {
    id: 'first-step-act',
    date: '2018-12-21',
    label: 'First Step Act signed',
    short: 'First Step Act',
    description: 'Congress changes several federal sentencing and prison laws.',
    term: 'first-step-act',
  },
  {
    id: 'covid',
    date: '2020-03-13',
    label: 'COVID-19 national emergency',
    short: 'COVID-19',
    description: 'A national emergency is declared on March 13, 2020; federal courts curtail in-person proceedings, including jury trials.',
  },
];

const AP_MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/** An event's date in newspaper (AP) style, e.g. "Dec. 21, 2018" or "March 13, 2020". */
export function eventDateLabel(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number) as [number, number, number];
  return `${AP_MONTHS[m - 1] ?? ''} ${d}, ${y}`;
}

/** The period label (year) an event falls in, for a dataset's period type. */
export function periodYear(dateIso: string, periodType?: string | null): number {
  const [y, m] = dateIso.split('-').map(Number) as [number, number];
  switch (periodType) {
    case 'FY_SEP30':
    case 'SNAPSHOT_SEP30':
      return m >= 10 ? y + 1 : y;
    case '12M_JUN30':
      return m >= 7 ? y + 1 : y;
    case '12M_MAR31':
      return m >= 4 ? y + 1 : y;
    default:
      return y;
  }
}
