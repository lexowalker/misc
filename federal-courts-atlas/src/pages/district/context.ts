// Multidistrict litigation (MDL) context for the district profile. When one MDL docket made up
// more than a quarter of the court's civil cases filed or closed in a year the page's civil series
// show (from FY 2010, the first year the FJC records carry docket numbers), the web lane writes
// profile.mdl_context (counts from the IDB lane's MDL docket table, names only when a GovInfo
// court record confirms them). This module only lays the sentences out; every number and
// sentence comes from public/data/profiles/<id>.json.

import { h } from '../../lib/dom.ts';
import { sourceChip } from '../../components/source-chip.ts';
import { term } from '../../components/glossary.ts';
import type { MdlContext, MdlDocket } from '../../data/types.ts';

const MDL_PHRASE = /multidistrict litigation(?: \(MDL\))?/;

/** The intro sentence with "multidistrict litigation (MDL)" as a glossary term (the definition is in the popover). */
function introText(text: string): Array<string | Node> {
  const m = MDL_PHRASE.exec(text);
  if (!m) return [text];
  return [text.slice(0, m.index), term('mdl', m[0]), text.slice(m.index + m[0].length)];
}

function docketLabel(d: MdlDocket): string {
  return d.label ?? `MDL ${d.docket}`;
}

export interface MdlCalloutOptions {
  /** Only sentences for these fiscal years (history lines are left out when filtering). */
  years?: number[];
  /** One line per docket, no history or rule: for "What stands out". */
  compact?: boolean;
  /** Where the full note sits, for the compact variant's link. */
  moreHref?: string;
  /** Accessible name of the note (each note on the page gets its own). */
  label?: string;
}

function docketHead(d: MdlDocket): HTMLElement {
  return h(
    'p',
    { class: 'mdl-note__docket' },
    h('strong', null, docketLabel(d)),
    d.name ? ', ' : null,
    d.name ? h('i', null, d.name) : null,
    d.case_number ? h('span', { class: 'mdl-note__case' }, ` (case ${d.case_number}${d.court_short ? `, ${d.court_short}` : ''})`) : null,
  );
}

/** The compact note's sentence about the other dockets, with the fiscal years each was above a quarter (the same
 * test as the web lane's rule: more than 25% of the court's civil cases filed, or closed, in that year). One docket:
 * "MDL 2433 also made up more than a quarter of this court’s civil cases filed or closed in FY 2015 and FY 2019."
 * Several: "MDL 2592 (FY 2015 to 2023) and MDL 2179 (FY 2013) each also made up ... in the years given." */
function earlierLine(list: MdlDocket[]): string {
  const years = (d: MdlDocket) => d.years_text ?? d.sentences.map((s) => `FY ${s.year}`).join(', ');
  const share = 'more than a quarter of this court’s civil cases filed or closed';
  if (list.length === 1) return `${docketLabel(list[0]!)} also made up ${share} in ${years(list[0]!)}.`;
  const parts = list.map((d) => `${docketLabel(d)} (${years(d)})`);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]} each also made up ${share} in the years given.`;
}

/** The MDL note, or null when the profile has none (or none for the requested years). */
export function mdlCallout(ctx: MdlContext | undefined, o: MdlCalloutOptions = {}): HTMLElement | null {
  if (!ctx?.dockets?.length) return null;
  const dockets = ctx.dockets
    .map((d) => ({ ...d, sentences: o.years ? d.sentences.filter((s) => o.years!.includes(s.year)) : d.sentences }))
    .filter((d) => d.sentences.length);
  if (!dockets.length) return null;

  const box = h('div', { class: `mdl-note${o.compact ? ' mdl-note--compact' : ''}`, role: 'note', 'aria-label': o.label ?? 'Multidistrict litigation', tabindex: o.compact ? null : '-1' });
  box.append(
    h('p', { class: 'mdl-note__kicker' }, 'Context: ', o.compact ? term('mdl', 'multidistrict litigation', { label: true }) : 'multidistrict litigation'),
  );
  if (o.compact) {
    // Dockets above a quarter in the years the page headlines get their sentences; the others share one sentence
    // that lists the years each was above a quarter (their sentences and history are in the full note). With no
    // current docket, the most recent one gets the sentences.
    const current = dockets.filter((d) => d.current ?? true);
    const lead = current.length ? current : dockets.slice(0, 1);
    const rest = dockets.filter((d) => !lead.includes(d));
    for (const d of lead) {
      box.append(h('div', { class: 'mdl-note__item' }, docketHead(d), h('p', { class: 'mdl-note__text' }, d.sentences.map((s) => s.text).join(' '))));
    }
    if (rest.length) {
      box.append(h('p', { class: 'mdl-note__earlier' }, earlierLine(rest)));
    }
    box.append(sourceChip({ sourceIds: ctx.source_ids, derived: ctx.derived, formula: ctx.formula, compact: true }));
    if (o.moreHref) {
      const a = h('a', { href: o.moreHref }, 'Every year and docket, and how they were counted');
      // Scroll to the full note in place (a plain hash change would re-render the page).
      a.addEventListener('click', (e) => {
        const target = document.getElementById('mdl-note');
        if (!target) return;
        e.preventDefault();
        const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
      });
      box.append(h('p', { class: 'mdl-note__more' }, a));
    }
    return box;
  }

  box.append(h('p', { class: 'mdl-note__intro' }, ...introText(ctx.intro)));
  for (const d of dockets) {
    const item = h('div', { class: 'mdl-note__item' }, docketHead(d));
    const lines = h('ul', { class: 'mdl-note__list' }, ...d.sentences.map((s) => h('li', null, s.text)));
    if (!o.years) for (const hh of d.history) lines.append(h('li', { class: 'mdl-note__history' }, hh.text));
    item.append(lines);
    box.append(item);
  }
  box.append(
    h('p', { class: 'mdl-note__rule' }, ctx.rule),
    sourceChip({ sourceIds: ctx.source_ids, derived: ctx.derived, formula: ctx.formula, compact: true }),
  );
  return box;
}
