// Source citation chip: dataset + vintage + link; for derived values, the formula
// is shown in a popover on hover/focus. Reads sources.json via the data layer.

import { h, uniqueId } from '../lib/dom.ts';
import { formatDate } from '../lib/format.ts';
import { loadSources } from '../data/loaders.ts';
import type { SourceRecord, Variable } from '../data/types.ts';

export interface SourceChipOptions {
  sourceIds: string[];
  /** For derived values: the formula string, shown on hover. */
  formula?: string | null;
  derived?: boolean;
  /** Prefix label, default "Source". */
  label?: string;
}

/** Renders immediately with ids, then fills in dataset names once sources.json loads. */
export function sourceChip(o: SourceChipOptions): HTMLElement {
  const popId = uniqueId('src-pop');
  const root = h('span', { class: `source-chip${o.derived ? ' source-chip--derived' : ''}` });
  const label = h('span', { class: 'source-chip__label' }, o.derived ? 'Derived' : (o.label ?? 'Source'));
  const body = h('span', { class: 'source-chip__body' }, o.sourceIds.length ? o.sourceIds.join(', ') : 'Source not recorded');
  root.append(label, body);

  if (o.derived && o.formula) {
    const btn = h(
      'button',
      { type: 'button', class: 'source-chip__formula', 'aria-describedby': popId, 'aria-label': 'How this value is derived' },
      'ƒ',
    );
    const pop = h('span', { id: popId, role: 'tooltip', class: 'source-chip__pop' }, h('span', { class: 'caps' }, 'Formula'), h('code', null, o.formula));
    root.append(btn, pop);
  }

  void loadSources().then((r) => {
    if (r.status !== 'ok') return;
    const recs = o.sourceIds.map((id) => [id, r.data[id]] as const).filter((x): x is readonly [string, SourceRecord] => !!x[1]);
    if (!recs.length) return;
    body.replaceChildren();
    recs.forEach(([id, rec], i) => {
      if (i) body.append('; ');
      const text = [rec.publisher, rec.dataset].filter(Boolean).join(', ') + (rec.vintage ? ` (${rec.vintage})` : '');
      const title = `${rec.dataset}${rec.retrieved_at ? ` · retrieved ${formatDate(rec.retrieved_at)}` : ''} · id ${id}`;
      body.append(rec.url ? h('a', { href: rec.url, target: '_blank', rel: 'noopener', title }, text) : h('span', { title }, text));
    });
  });
  return root;
}

export function sourceChipForVariable(v: Variable): HTMLElement {
  return sourceChip({ sourceIds: v.source_ids ?? [], formula: v.formula, derived: !!v.derived });
}
