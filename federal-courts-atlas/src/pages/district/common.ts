// Helpers shared by the district profile modules (src/pages/district.ts and
// src/pages/district/*.ts). Formatting never rescales a value; ranks are read
// from the published files and only phrased here.

import { h, uniqueId } from '../../lib/dom.ts';
import { decimalsFor, formatNumber, formatValue, ordinal } from '../../lib/format.ts';
import type { Variable } from '../../data/types.ts';
import { ensureFormulaPopovers } from '../../components/source-chip.ts';

type Fmt = Pick<Variable, 'format' | 'unit'> | null | undefined;

/**
 * formatValue(), except that a published fraction is never rounded away: the AO prints
 * shared judgeships as halves (3.5), which a ".0f" format would show as 4.
 */
export function fmtValue(value: number | null | undefined, v: Fmt, opts: { unit?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No data';
  if (decimalsFor(v, value) === 0 && !Number.isInteger(value)) {
    return formatValue(value, { unit: v?.unit ?? '', format: '.1f' }, opts);
  }
  return formatValue(value, v, opts);
}

/** The number as it is printed in prose (thousands separators, the variable's decimals, no unit). */
export function fmtNumberOnly(value: number, v: Fmt): string {
  let d = decimalsFor(v, value);
  if (d === 0 && !Number.isInteger(value)) d = 1;
  return formatNumber(value, d);
}

/** Splits "5.6 months" into {num: "5.6", unit: "months"}; percents keep their sign: {num: "38.5%", unit: ""}. */
export function valueParts(value: number, v: Fmt): { num: string; unit: string } {
  const full = fmtValue(value, v);
  const num = fmtValue(value, v, { unit: false });
  return { num, unit: full.startsWith(num) ? full.slice(num.length).trim() : '' };
}

/** "Highest of 94", "12th highest of 94", "Lowest of 51". Rank 1 is always the highest value. */
export function rankPhrase(rank: number, of: number): string {
  if (rank === 1) return `Highest of ${of}`;
  if (rank === of) return `Lowest of ${of}`;
  return `${ordinal(rank)} highest of ${of}`;
}

export const RANK_FORMULA =
  'rank = 1 + the number of districts with a higher value that year. Tied districts share a rank. Only districts with data that year are ranked.';

/** A small "ƒ" button whose popover explains a derived quantity (same look as the source chip's). */
export function formulaHint(text: string, label = 'How this rank is computed'): HTMLElement {
  ensureFormulaPopovers();
  const id = uniqueId('fx');
  return h(
    'span',
    { class: 'fx-hint' },
    h('button', { type: 'button', class: 'source-chip__formula', 'aria-describedby': id, 'aria-controls': id, 'aria-label': label }, 'ƒ'),
    h('span', { id, role: 'tooltip', class: 'source-chip__pop fx-hint__pop' }, h('span', { class: 'caps' }, 'Derived by the atlas'), h('code', null, text)),
  );
}

/** Horizontal rank strip: a hairline from lowest (left) to highest (right) with a dot at the district. */
export function rankStrip(rank: number, of: number): HTMLElement {
  const p = of > 1 ? (of - rank) / (of - 1) : 0.5;
  return h(
    'span',
    { class: 'rank-strip', 'aria-hidden': 'true' },
    h('span', { class: 'rank-strip__line' }),
    h('span', { class: 'rank-strip__dot', style: `left:${(p * 100).toFixed(1)}%` }),
  );
}

export interface SectionShell {
  el: HTMLElement;
  body: HTMLElement;
  head: HTMLElement;
}

/** A profile section: kicker, serif title, optional dek. */
export function sectionShell(id: string, kicker: string, title: string, dek?: string | Node | null): SectionShell {
  const titleId = `${id}-h`;
  const head = h(
    'header',
    { class: 'dsec__head' },
    h('p', { class: 'dsec__kicker' }, kicker),
    h('h2', { class: 'dsec__title', id: titleId, tabindex: '-1' }, title),
    dek ? h('p', { class: 'dsec__dek' }, dek) : null,
  );
  const body = h('div', { class: 'dsec__body' });
  const el = h('section', { class: `dsec dsec--${id}`, id: `sec-${id}`, 'aria-labelledby': titleId }, head, body);
  return { el, body, head };
}

/** Run `fn` once the element comes within `margin` of the viewport. Returns a disposer. */
export function whenNear(el: Element, fn: () => void, margin = '700px 0px'): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    fn();
    return () => {};
  }
  let done = false;
  const io = new IntersectionObserver(
    (entries) => {
      if (done || !entries.some((e) => e.isIntersecting)) return;
      done = true;
      io.disconnect();
      fn();
    },
    { rootMargin: margin },
  );
  io.observe(el);
  return () => io.disconnect();
}

/** "Nov 2, 2021" from an ISO date, without time-zone drift. */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Fractional year (2021.84) from an ISO date. */
export function yearFrac(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (Date.UTC(y, (m || 1) - 1, d || 1) - start) / (end - start);
}

/** A "View as table" / "View as chart" toggle button. */
export function viewToggle(onToggle: (table: boolean) => void, labels: [string, string] = ['View as table', 'View as chart']): HTMLButtonElement {
  let table = false;
  const btn = h('button', { type: 'button', class: 'btn btn--quiet dview-toggle', 'aria-pressed': 'false' }, labels[0]);
  btn.addEventListener('click', () => {
    table = !table;
    btn.setAttribute('aria-pressed', String(table));
    btn.textContent = table ? labels[1] : labels[0];
    onToggle(table);
  });
  return btn;
}
