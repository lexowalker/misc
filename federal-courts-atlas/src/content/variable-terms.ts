// Which glossary terms each measure's label uses, so labels can carry the same definition popovers as prose
// (the brief: "every legal term gets a glossary tooltip"). Used by the home measure header and switcher,
// compare row names, the #/table/<variable> heading and the profile's key statistics.
//
// `text` is the words to mark inside the label, matched without regard to case; the label's own casing is kept.
// A label that no longer contains `text` simply shows plain words (tests/e2e/glossary-labels.spec.ts reports it).
// `term` is typed as GlossaryId, so an id that is not in src/content/glossary.ts fails `npm run typecheck`.
// Measures whose labels hold no legal term (average sentence, shares of offense types, per-resident rates) have
// no entry on purpose.

import type { GlossaryId } from './glossary.ts';

export interface TermRef {
  term: GlossaryId;
  /** Words to mark in the label (case-insensitive). */
  text: string;
}

const t = (term: GlossaryId, text: string): TermRef => ({ term, text });

export const VARIABLE_TERMS: Readonly<Record<string, readonly TermRef[]>> = {
  // Speed
  civil_disposition_months: [t('median-time', 'Median time')],
  criminal_disposition_months: [t('median-time', 'Median time'), t('felony', 'felony')],
  civil_trial_months: [t('time-to-trial', 'Median time')],
  civil_over_3yrs_pct: [t('pending-case', 'pending')],
  // Workload
  weighted_filings_per_judgeship: [t('weighted-filings', 'Weighted filings'), t('judgeship', 'judgeship')],
  filings_per_judgeship: [t('judgeship', 'judgeship')],
  civil_filings_per_judgeship: [t('judgeship', 'judgeship')],
  pending_per_judgeship: [t('pending-case', 'Pending cases'), t('judgeship', 'judgeship')],
  terminations_per_judgeship: [t('termination', 'Cases closed'), t('judgeship', 'judgeship')],
  trials_per_judgeship: [t('judgeship', 'judgeship')],
  vacant_judgeship_months: [t('vacant-judgeship-months', 'Vacant judgeship months')],
  judgeships: [t('judgeship', 'judgeships')],
  felony_defendants_per_100k: [t('felony', 'Felony')],
  active_judges: [t('active-judge', 'Active judges')],
  senior_judges: [t('senior-status', 'Senior judges')],
  jurors_avg_present: [t('jury-selection', 'jury selection')],
  jurors_pct_not_selected: [t('jury-selection', 'challenged')],
  // Sentencing
  within_range_pct: [t('guideline-range', 'guideline range')],
  above_range_pct: [t('guideline-range', 'guideline range')],
  govt_below_range_pct: [t('below-range', 'Below range')],
  nongovt_below_range_pct: [t('below-range', 'Below range')],
  above_range_pct_2006: [t('guideline-range', 'Above range')],
  govt_below_range_pct_2006: [t('below-range', 'Below range')],
  nongovt_below_range_pct_2006: [t('below-range', 'Below range')],
  substantial_assistance_pct: [t('departure', 'departures'), t('5k1-1', '§5K1.1')],
  early_disposition_pct: [t('departure', 'departures'), t('5k3-1', '§5K3.1')],
  // Case mix
  patent_filings: [t('patent-case', 'Patent cases')],
  patent_share_pct: [t('patent-case', 'patent cases')],
  pro_se_pct: [t('pro-se', 'self-represented')],
  prisoner_petitions_pct: [t('prisoner-petition', 'Prisoner petitions')],
  guilty_plea_pct: [t('guilty-plea', 'pleaded guilty')],
};

/** Fixed headings outside the measure catalog (for example the profile's "Civil cases by nature of suit"). */
export const PHRASE_TERMS: readonly TermRef[] = [
  t('nature-of-suit', 'nature of suit'),
  t('guideline-range', 'guideline range'),
  t('5k1-1', '§5K1.1'),
  t('5k3-1', '§5K3.1'),
];

export function termsForVariable(id: string): readonly TermRef[] {
  return VARIABLE_TERMS[id] ?? [];
}

/** The distinct terms used by a list of measures, in order of first use. */
export function termsForVariables(ids: readonly string[]): GlossaryId[] {
  const out: GlossaryId[] = [];
  for (const id of ids) for (const r of termsForVariable(id)) if (!out.includes(r.term)) out.push(r.term);
  return out;
}
