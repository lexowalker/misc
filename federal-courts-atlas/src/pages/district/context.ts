// Multidistrict litigation (MDL) context for the district profile. When one MDL docket made up
// more than a quarter of the court's civil cases filed or closed in a year the page shows, the
// web lane writes profile.mdl_context (counts from the IDB lane's MDL docket table, names only
// when a GovInfo court record confirms them). This module only lays the sentences out; every
// number and sentence comes from public/data/profiles/<id>.json.

import { h } from '../../lib/dom.ts';
import { sourceChip } from '../../components/source-chip.ts';
import type { MdlContext, MdlDocket } from '../../data/types.ts';

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
    h('strong', null, `MDL ${d.docket}`),
    d.name ? ', ' : null,
    d.name ? h('i', null, d.name) : null,
    d.case_number ? h('span', { class: 'mdl-note__case' }, ` (case ${d.case_number})`) : null,
  );
}

/** The MDL note, or null when the profile has none (or none for the requested years). */
export function mdlCallout(ctx: MdlContext | undefined, o: MdlCalloutOptions = {}): HTMLElement | null {
  if (!ctx?.dockets?.length) return null;
  const dockets = ctx.dockets
    .map((d) => ({ ...d, sentences: o.years ? d.sentences.filter((s) => o.years!.includes(s.year)) : d.sentences }))
    .filter((d) => d.sentences.length);
  if (!dockets.length) return null;

  const box = h('div', { class: `mdl-note${o.compact ? ' mdl-note--compact' : ''}`, role: 'note', 'aria-label': o.label ?? 'Multidistrict litigation', tabindex: o.compact ? null : '-1' });
  box.append(h('p', { class: 'mdl-note__kicker' }, 'Context: multidistrict litigation'));
  if (o.compact) {
    for (const d of dockets) {
      box.append(h('div', { class: 'mdl-note__item' }, docketHead(d), h('p', { class: 'mdl-note__text' }, d.sentences.map((s) => s.text).join(' '))));
    }
    box.append(sourceChip({ sourceIds: ctx.source_ids, derived: ctx.derived, formula: ctx.formula, compact: true }));
    if (o.moreHref) {
      const a = h('a', { href: o.moreHref }, 'What an MDL docket is, and how this was counted');
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

  box.append(h('p', { class: 'mdl-note__intro' }, ctx.intro));
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
