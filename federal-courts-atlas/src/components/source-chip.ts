// Source citation chip: dataset + vintage + link; for derived values, the formula
// is shown in a popover on hover, focus, click or tap. Reads sources.json via the data layer.

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
  /**
   * Short citation: publisher and dataset name only (text before the first colon, comma or
   * parenthesis), with the full dataset, vintage and retrieval date in the link title.
   * For dense lists such as profile stat rows. Default false (full citation).
   */
  compact?: boolean;
}

/** "Administrative Office of the U.S. Courts (Statistics Division), via uscourts.gov" -> "Administrative Office of the U.S. Courts". */
function shortName(s: string | undefined): string {
  if (!s) return '';
  return s.split(/\s*(?:\(|,|:|\svia\s)/)[0]!.trim();
}

let popoversInstalled = false;

/** The popover a formula button opens: aria-controls, else aria-describedby, else the next sibling. */
function popoverFor(btn: Element): HTMLElement | null {
  const id = btn.getAttribute('aria-controls') ?? btn.getAttribute('aria-describedby');
  const byId = id ? document.getElementById(id) : null;
  if (byId?.classList.contains('source-chip__pop')) return byId;
  const next = btn.nextElementSibling;
  return next instanceof HTMLElement && next.classList.contains('source-chip__pop') ? next : null;
}

function setFormulaOpen(btn: Element, open: boolean): void {
  btn.setAttribute('aria-expanded', String(open));
  const pop = popoverFor(btn);
  if (!pop) return;
  if (open) pop.setAttribute('data-open', 'true');
  else pop.removeAttribute('data-open');
}

/**
 * Formula popovers (every `.source-chip__formula` button with its `.source-chip__pop`, on any page) open on
 * click or tap, not only on hover or keyboard focus: iOS Safari does not focus a tapped button, so a
 * focus-only popover never opens there. A click toggles `aria-expanded` on the button and `data-open` on
 * the popover; Escape or a click anywhere else closes it. Hover (on devices that hover) and keyboard focus
 * still show it (components.css). Installed once, on first use; safe to call repeatedly.
 */
export function ensureFormulaPopovers(): void {
  if (popoversInstalled || typeof document === 'undefined') return;
  popoversInstalled = true;
  const closeAll = (except?: Element | null) => {
    document.querySelectorAll('.source-chip__formula[aria-expanded="true"]').forEach((b) => {
      if (b !== except) setFormulaOpen(b, false);
    });
  };
  document.addEventListener('click', (e) => {
    const t = e.target as Element | null;
    const btn = t?.closest?.('.source-chip__formula') ?? null;
    if (!btn) {
      // A click inside an open popover (to select its text) keeps it open.
      if (!t?.closest?.('.source-chip__pop')) closeAll();
      return;
    }
    const open = btn.getAttribute('aria-expanded') !== 'true';
    closeAll(btn);
    setFormulaOpen(btn, open);
  });
  // Escape dismisses every open popover, including one shown by hover or keyboard focus (WCAG 1.4.13).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeAll();
    document.querySelectorAll('.source-chip__formula:hover, .source-chip__formula:focus').forEach((b) => setFormulaOpen(b, false));
  });
  // A dismissed button goes back to its first state once the pointer or focus leaves and returns, so
  // hover and keyboard focus show the popover again next time.
  const reset = (e: Event) => {
    const t = e.target as Element | null;
    if (!t?.classList?.contains('source-chip__formula') || t.getAttribute('aria-expanded') !== 'false') return;
    if (e.type === 'mouseover' && t === document.activeElement) return;
    t.removeAttribute('aria-expanded');
  };
  document.addEventListener('focusout', reset);
  document.addEventListener('mouseover', reset);
}

/** Renders immediately with ids, then fills in dataset names once sources.json loads. */
export function sourceChip(o: SourceChipOptions): HTMLElement {
  ensureFormulaPopovers();
  const popId = uniqueId('src-pop');
  const root = h('span', { class: `source-chip${o.derived ? ' source-chip--derived' : ''}` });
  const label = h('span', { class: 'source-chip__label' }, o.derived ? 'Derived' : (o.label ?? 'Source'));
  const body = h('span', { class: 'source-chip__body' }, o.sourceIds.length ? o.sourceIds.join(', ') : 'Source not recorded');
  root.append(label, body);

  if (o.derived && o.formula) {
    const btn = h(
      'button',
      { type: 'button', class: 'source-chip__formula', 'aria-describedby': popId, 'aria-controls': popId, 'aria-label': 'How this value is derived' },
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
    const seen = new Set<string>();
    recs.forEach(([id, rec]) => {
      const text = o.compact
        ? [shortName(rec.publisher), shortName(rec.dataset)].filter(Boolean).join(', ')
        : [rec.publisher, rec.dataset].filter(Boolean).join(', ') + (rec.vintage ? ` (${rec.vintage})` : '');
      if (o.compact && seen.has(text)) return;
      seen.add(text);
      if (body.childNodes.length) body.append('; ');
      const title = o.compact
        ? `${rec.dataset}${rec.vintage ? ` (${rec.vintage})` : ''}${rec.retrieved_at ? ` · retrieved ${formatDate(rec.retrieved_at)}` : ''} · id ${id}`
        : `${rec.dataset}${rec.retrieved_at ? ` · retrieved ${formatDate(rec.retrieved_at)}` : ''} · id ${id}`;
      body.append(rec.url ? h('a', { href: rec.url, target: '_blank', rel: 'noopener', title }, text) : h('span', { title }, text));
    });
  });
  return root;
}

export function sourceChipForVariable(v: Variable): HTMLElement {
  return sourceChip({ sourceIds: v.source_ids ?? [], formula: v.formula, derived: !!v.derived });
}
