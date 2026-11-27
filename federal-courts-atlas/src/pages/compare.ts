// Compare (#/compare?d=vaed,mdd&y=2019). Two to four districts side by side.
//
// - Picker: a search box (name, state or abbreviation such as "E.D. Va." or "vaed").
// - Cards: each district's locator map, aligned with the columns below.
// - Rows: every catalog measure, grouped by family. Each cell shows the value and unit,
//   the rank among all districts ("12th highest of 94"), and a sparkline. Every sparkline
//   in a row shares one y-domain and one x-domain, with the national figure as a dashed
//   reference line. One district per row is marked with a symbol and a word (not color).
// - Summary: the main measures that put the districts furthest apart in the national
//   rankings, computed here from the values files and labeled derived.
// - Year: each row defaults to its latest common year (the latest year in which every
//   chosen district has a value); a selector sets one year for all rows.
//
// Every number is read at runtime from public/data/values/<variable>.json; labels, units,
// formulas and caveats from public/data/variables.json. Nothing here is a statistic.

import '../styles/pages.css';
import '../styles/compare.css';
import { debounce, h, uniqueId } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { parseHash } from '../app/router.ts';
import { DISTRICTS, registryDistrict, circuitLabel, type RegistryDistrict } from '../data/districts.ts';
import { loadAtlasGeometry, type AtlasGeometry } from '../map/geo.ts';
import { renderLocator } from '../map/locator.ts';
import {
  caveatList,
  foldKey,
  getCellNote,
  getCellSources,
  getNational,
  getRank,
  rankTies,
  getValue,
  isDerivedCell,
  loadValues,
  loadVariables,
  rankedCount,
} from '../data/loaders.ts';
import type { Family, ValuesFile, Variable } from '../data/types.ts';
import { renderSparkline } from '../components/sparkline.ts';
import { ensureFormulaPopovers, sourceChip } from '../components/source-chip.ts';
import { formatNumber, formatValue, periodLabel, periodLabelFor } from '../lib/format.ts';
import { fmtNumberOnly, fmtValue, RANK_FORMULA, rankPhrase, valueParts } from './district/common.ts';
import { pageHead } from './_page.ts';

export const title = 'Compare districts';

const MAX = 4;

const FAMILIES: Array<{ id: Family; label: string; dek: string }> = [
  { id: 'speed', label: 'Speed', dek: 'How long cases take to move through the court.' },
  { id: 'workload', label: 'Workload', dek: 'How much work the court carries, per judgeship and per resident.' },
  { id: 'sentencing', label: 'Sentencing', dek: 'How sentences compare with the federal sentencing guidelines.' },
  { id: 'casemix', label: 'Case mix', dek: 'What kinds of cases and charges come before the court.' },
];

/** Starting points when no district is chosen. Titles and notes state geography or law, never a statistic. */
const SUGGESTIONS: Array<{ ids: string[]; title: string; note: string }> = [
  { ids: ['vaed', 'mdd'], title: 'Across the Potomac', note: 'The two district courts that border the District of Columbia, one on each side of the river.' },
  { ids: ['txed', 'txwd', 'ded'], title: 'The TC Heartland courts', note: 'Three courts in the story of the 2017 Supreme Court decision on where patent suits may be filed.' },
  { ids: ['casd', 'azd', 'txwd', 'txsd'], title: 'Along the Mexican border', note: 'Four of the five district courts whose territory reaches the border with Mexico.' },
  { ids: ['nysd', 'cacd', 'ilnd'], title: 'Three big-city courts', note: 'The district courts that sit in Manhattan, Los Angeles and Chicago.' },
];

const GAP_FORMULA =
  'Gap in standing = (rank of the lower district − rank of the higher district) ÷ (districts ranked − 1), in the year shown for that measure. Difference = higher value − lower value, and ratio = higher value ÷ lower value, both from the values as printed. Cells with a caveat note are left out.';

type FileState = { status: 'ok'; file: ValuesFile } | { status: 'missing' | 'error' };

interface RowYear {
  year: number | null;
  /** common: every chosen district has a value; partial: the most that do; chosen: set by the reader; outside: the chosen year is not in the series; none: no data. */
  mode: 'common' | 'partial' | 'chosen' | 'outside' | 'none';
  have: number;
}

/* ---- small helpers ------------------------------------------------------------------- */

/** Keep the address shareable and readable: #/compare?d=vaed,mdd&y=2019 (commas left as commas). */
function syncUrl(ids: string[], year: number | null): void {
  const { path, query } = parseHash();
  query.delete('d');
  query.delete('y');
  const parts = [...query.entries()].map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  if (ids.length) parts.unshift(`d=${ids.map(encodeURIComponent).join(',')}`);
  if (year !== null) parts.push(`y=${year}`);
  history.replaceState(history.state, '', `#${path || '/'}${parts.length ? `?${parts.join('&')}` : ''}`);
}

function parseIds(raw: string | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((id, i, a) => !!registryDistrict(id) && a.indexOf(id) === i)
    .slice(0, MAX);
}

/** Decimal places in a printed number ("1,234.5" -> 1). */
function decimalsOf(printed: string): number {
  const i = printed.indexOf('.');
  return i < 0 ? 0 : printed.length - i - 1;
}

function countWord(n: number): string {
  return ['no', 'one', 'two', 'three', 'four'][n] ?? String(n);
}

/** Every year in the variable's series, ascending. */
function seriesYears(v: Variable, file: ValuesFile): number[] {
  const ys = v.years?.length ? v.years : file.years;
  return [...ys].sort((a, b) => a - b);
}

/** The year a row shows: the reader's choice, else the latest year in which the most chosen districts (ideally all) have a value. */
function rowYear(v: Variable, file: ValuesFile, ids: string[], chosen: number | null): RowYear {
  const years = seriesYears(v, file);
  if (chosen !== null) {
    if (!years.includes(chosen)) return { year: chosen, mode: 'outside', have: 0 };
    return { year: chosen, mode: 'chosen', have: ids.filter((id) => getValue(file, id, chosen) !== null).length };
  }
  let best: number | null = null;
  let bestHave = 0;
  for (const y of years) {
    const have = ids.filter((id) => getValue(file, id, y) !== null).length;
    if (have >= bestHave && have > 0) {
      best = y;
      bestHave = have;
    }
  }
  if (best === null) return { year: null, mode: 'none', have: 0 };
  return { year: best, mode: bestHave === ids.length ? 'common' : 'partial', have: bestHave };
}

function rowYearText(ry: RowYear, v: Variable, file: ValuesFile, n: number): string {
  const pt = v.period_type ?? file.period_type;
  if (ry.year === null) return 'No data for these districts in any year';
  const p = periodLabelFor(v, ry.year, pt);
  if (ry.mode === 'outside') {
    const ys = seriesYears(v, file);
    return `Not published for ${p}. This series covers ${periodLabel(ys[0]!, pt)} to ${periodLabel(ys[ys.length - 1]!, pt)}.`;
  }
  if (ry.mode === 'chosen') return p;
  if (n === 1) return `${p}, the latest year with data`;
  if (ry.mode === 'common') return `${p}, the latest year with data for ${n === 2 ? 'both' : `all ${countWord(n)}`}`;
  return `${p}, the latest year with data for ${countWord(ry.have)} of ${countWord(n)}`;
}

/** Formula for a cell: the variable's own, else the formula for that year's derived basis (USSC). */
function formulaFor(v: Variable, file: ValuesFile, year: number | null): string | null {
  if (file.formula) return file.formula;
  if (v.formula) return v.formula;
  if (year === null) return null;
  for (const b of file.basis_by_year?.[String(year)] ?? []) {
    const f = file.formula_by_basis?.[b] ?? v.formula_by_basis?.[b];
    if (f) return f;
  }
  return null;
}

/** A "Derived" label with the formula in a popover (same look as the source chip's). */
function derivedTag(formula: string | null, popTitle = 'Formula', label = 'How this is derived'): HTMLElement {
  const root = h('span', { class: 'source-chip source-chip--derived cmp-derived' }, h('span', { class: 'source-chip__label' }, 'Derived'));
  if (formula) root.append(...fxParts(formula, popTitle, label));
  return root;
}

/** A standalone "ƒ" button with a popover. */
function fxHint(text: string, popTitle: string, label: string): HTMLElement {
  return h('span', { class: 'cmp-fx' }, ...fxParts(text, popTitle, label));
}

function fxParts(text: string, popTitle: string, label: string): HTMLElement[] {
  const id = uniqueId('cmp-fx');
  return [
    h('button', { type: 'button', class: 'source-chip__formula', 'aria-describedby': id, 'aria-controls': id, 'aria-label': label }, 'ƒ'),
    h('span', { id, role: 'tooltip', class: 'source-chip__pop' }, h('span', { class: 'caps' }, popTitle), h('code', null, text)),
  ];
}

/** National standing of two districts on one strip: lowest rank at left, highest at right. Decorative; the ranks are in the text. */
function standingStrip(hiRank: number, loRank: number, of: number): HTMLElement {
  const pos = (r: number) => (of > 1 ? ((of - r) / (of - 1)) * 100 : 50);
  const a = pos(hiRank);
  const b = pos(loRank);
  return h(
    'div',
    { class: 'cmp-gap__strip', 'aria-hidden': 'true' },
    h('span', { class: 'cmp-gap__strip-line' }),
    h('span', { class: 'cmp-gap__strip-span', style: `left:${b.toFixed(1)}%;width:${(a - b).toFixed(1)}%` }),
    h('span', { class: 'cmp-gap__strip-dot cmp-gap__strip-dot--lo', style: `left:${b.toFixed(1)}%` }),
    h('span', { class: 'cmp-gap__strip-dot cmp-gap__strip-dot--hi', style: `left:${a.toFixed(1)}%` }),
    h('span', { class: 'cmp-gap__strip-end cmp-gap__strip-end--lo' }, 'Lowest'),
    h('span', { class: 'cmp-gap__strip-end cmp-gap__strip-end--hi' }, 'Highest'),
  );
}

/* ---- search picker ------------------------------------------------------------------- */

interface PickerKey {
  d: RegistryDistrict;
  name: string;
  nameCompact: string;
  short: string;
  shortCompact: string;
  words: string[];
}

const KEYS: PickerKey[] = DISTRICTS.map((d) => {
  const name = foldKey(d.name);
  const short = foldKey(d.short);
  return {
    d,
    name,
    nameCompact: name.replace(/ /g, ''),
    short,
    shortCompact: short.replace(/ /g, ''),
    words: `${name} ${foldKey(d.stateName)} ${d.state.toLowerCase()} ${short} ${d.id}`.split(' '),
  };
});

function scoreKey(k: PickerKey, q: string): number {
  const qf = foldKey(q);
  if (!qf) return 1;
  const qc = qf.replace(/ /g, '');
  if (qc === k.d.id || qc === k.shortCompact) return 100;
  if (k.d.id.startsWith(qc) || k.shortCompact.startsWith(qc)) return 90;
  if (k.name.startsWith(qf)) return 80;
  const toks = qf.split(' ');
  if (toks.every((t) => k.words.some((w) => w.startsWith(t)))) return 60;
  if (qc.length >= 3 && k.nameCompact.includes(qc)) return 40;
  return 0;
}

interface Picker {
  el: HTMLElement;
  input: HTMLInputElement;
  refresh(): void;
  dispose(): void;
}

function districtPicker(getIds: () => string[], onAdd: (id: string) => void): Picker {
  const inputId = uniqueId('cmp-search');
  const listId = uniqueId('cmp-list');
  const hintId = uniqueId('cmp-hint');
  const input = h('input', {
    id: inputId,
    class: 'cmp-picker__input',
    type: 'text',
    role: 'combobox',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': listId,
    'aria-describedby': hintId,
    placeholder: 'Search by name, state or abbreviation',
  });
  const list = h('ul', { id: listId, class: 'cmp-picker__list', role: 'listbox', 'aria-label': 'Districts', hidden: true });
  const status = h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  const hint = h('p', { id: hintId, class: 'cmp-picker__hint' });
  const el = h(
    'div',
    { class: 'cmp-picker' },
    h('label', { for: inputId, class: 'cmp-picker__label' }, 'Add a district'),
    h('div', { class: 'cmp-picker__box' }, h('span', { class: 'cmp-picker__icon', 'aria-hidden': 'true' }), input, list),
    hint,
    status,
  );

  let hits: RegistryDistrict[] = [];
  let active = -1;

  const optId = (id: string) => `${listId}-${id}`;
  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  const setActive = (i: number) => {
    active = i;
    list.querySelectorAll('[role="option"]').forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
    const d = hits[i];
    if (d) {
      input.setAttribute('aria-activedescendant', optId(d.id));
      document.getElementById(optId(d.id))?.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };
  const choose = (d: RegistryDistrict | undefined) => {
    if (!d || getIds().includes(d.id) || getIds().length >= MAX) return;
    input.value = '';
    close();
    onAdd(d.id);
    const n = getIds().length;
    status.textContent = `Added ${d.name}. ${n} of ${MAX} districts chosen.`;
  };
  const search = () => {
    const q = input.value;
    const chosen = getIds();
    hits = KEYS.map((k) => [k, scoreKey(k, q)] as const)
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1] || a[0].d.order - b[0].d.order)
      .map(([k]) => k.d);
    list.replaceChildren();
    if (!hits.length) {
      list.append(h('li', { class: 'cmp-picker__none', role: 'presentation' }, `No district matches “${q.trim()}”.`));
    }
    for (const d of hits) {
      const added = chosen.includes(d.id);
      const li = h(
        'li',
        { id: optId(d.id), role: 'option', class: 'cmp-picker__opt', 'aria-selected': 'false', 'aria-disabled': added ? 'true' : null, 'data-id': d.id },
        h('span', { class: 'cmp-picker__name' }, d.name),
        h('span', { class: 'cmp-picker__meta' }, `${d.short} · ${d.stateName}`, added ? h('span', { class: 'cmp-picker__added' }, ' · Added') : null),
      );
      li.addEventListener('mousedown', (e) => e.preventDefault());
      li.addEventListener('click', () => choose(d));
      list.append(li);
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(q.trim() && hits.length ? hits.findIndex((d) => !chosen.includes(d.id)) : -1);
    status.textContent = q.trim() ? `${hits.length} ${hits.length === 1 ? 'district matches' : 'districts match'}.` : '';
  };

  input.addEventListener('input', search);
  input.addEventListener('focus', () => {
    if (input.value.trim()) search();
  });
  input.addEventListener('click', () => {
    if (list.hidden) search();
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) {
        search();
        if (active < 0 && hits.length) setActive(0);
        return;
      }
      if (!hits.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(active < 0 ? (step > 0 ? 0 : hits.length - 1) : (active + step + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      if (!list.hidden && active >= 0) {
        e.preventDefault();
        choose(hits[active]);
      }
    } else if (e.key === 'Escape') {
      if (!list.hidden) {
        e.preventDefault();
        close();
      } else if (input.value) {
        input.value = '';
      }
    } else if (e.key === 'Tab') {
      close();
    }
  });

  const refresh = () => {
    const n = getIds().length;
    const full = n >= MAX;
    input.disabled = full;
    input.placeholder = full ? 'Remove a district to add another' : 'Search by name, state or abbreviation';
    hint.textContent = full
      ? `${MAX} of ${MAX} districts chosen.`
      : `Up to ${MAX} districts. Try “E.D. Va.”, “vaed”, “Texas” or “eastern virginia”.`;
    if (!list.hidden) search();
  };
  refresh();
  return { el, input, refresh, dispose: close };
}

/* ---- the page ------------------------------------------------------------------------- */

export async function render(ctx: PageContext): Promise<() => void> {
  let ids = parseIds(ctx.query.get('d'));
  const yq = parseInt(ctx.query.get('y') ?? '', 10);
  let chosenYear: number | null = Number.isFinite(yq) ? yq : null;
  const expanded = new Set<Family>();

  const page = h('div', { class: 'page cmp-page' });
  const cmp = h('div', { class: 'cmp', 'data-n': String(ids.length) });
  const top = h('div', { class: 'cmp-top' });
  const body = h('div', { class: 'cmp-body' });
  const live = h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });

  const picker = districtPicker(
    () => ids,
    (id) => {
      ids = [...ids, id];
      draw();
      // A full picker disables its input; keep focus on the page.
      if (ids.length >= MAX) top.querySelector<HTMLElement>(`.cmp-card[data-district="${id}"] .cmp-card__name a`)?.focus();
    },
  );

  page.append(
    pageHead({
      kicker: 'Compare',
      title: 'Compare districts side by side',
      dek: 'Pick two to four district courts. Each row lines up one measure for every court, with its rank among the districts with data, its trend and the national figure.',
      className: 'cmp-head',
    }),
    picker.el,
    cmp,
    live,
  );
  cmp.append(top, body);
  ctx.root.append(page);

  // Formula popovers: hover and keyboard focus show them (compare.css); a click or tap toggles them, and Escape
  // or an outside click closes them (the shared handler in source-chip.ts).
  ensureFormulaPopovers();

  // Stack the columns when they would be narrower than a comfortable cell.
  const stackFor = (w: number) => {
    const n = Math.max(2, ids.length);
    const lead = w >= 1000 ? 240 : 176;
    return (w - lead - n * 20) / n < 150;
  };
  const applyStack = () => {
    const stacked = stackFor(cmp.clientWidth || page.clientWidth);
    cmp.classList.toggle('cmp--stacked', stacked);
    cmp.classList.toggle('cmp--wide', !stacked && ids.length <= 2);
  };
  /** Sparkline size for the current layout, so it draws at about 1:1 (CSS still scales it to fit). */
  const sparkSize = (): { width: number; height: number } => {
    const w = cmp.clientWidth || page.clientWidth || 1000;
    if (cmp.classList.contains('cmp--stacked')) return { width: 108, height: 36 };
    const n = Math.max(2, ids.length);
    const lead = w >= 1000 ? 240 : 176;
    const gap = w >= 1000 ? 24 : 16;
    const col = (w - lead - n * gap) / n;
    if (cmp.classList.contains('cmp--wide')) return { width: Math.round(Math.min(300, col * 0.55)), height: 84 };
    return { width: Math.round(Math.min(260, col)), height: 60 };
  };
  // Crossing a layout threshold (rotate a phone, resize a window) redraws, so cards and sparklines fit the new layout.
  let layoutKey = '';
  const relayout = debounce(() => {
    const before = layoutKey;
    applyStack();
    layoutKey = cmp.className;
    if (before && before !== layoutKey && ids.length) draw();
  }, 150);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => relayout()) : null;
  ro?.observe(cmp);

  top.append(h('div', { class: 'loading-state' }, h('span', { class: 'loading-state__bar' }), 'Loading the districts'));
  const [geo, vars] = await Promise.all([loadAtlasGeometry(), loadVariables()]);
  const geometry: AtlasGeometry | null = geo.status === 'ok' ? geo.geometry : null;
  const variables: Variable[] = vars.status === 'ok' ? vars.data : [];
  const byFamily = new Map<Family, Variable[]>(FAMILIES.map((f) => [f.id, variables.filter((v) => v.family === f.id)]));
  // The summary reads the catalog's main (featured) measures; all of them if none is flagged.
  const flagged = variables.filter((v) => v.featured);
  const featured = flagged.length ? flagged : variables;
  // Year choices: every year that at least five measures cover (earlier years hold only one or two series).
  const yearCount = new Map<number, number>();
  for (const v of variables) for (const y of v.years ?? []) yearCount.set(y, (yearCount.get(y) ?? 0) + 1);
  const allYears = [...yearCount].filter(([, c]) => c >= Math.min(5, variables.length)).map(([y]) => y).sort((a, b) => b - a);
  if (chosenYear !== null && !allYears.includes(chosenYear)) chosenYear = null;

  const files = new Map<string, FileState>();
  const ensure = async (vs: Variable[]): Promise<void> => {
    await Promise.all(
      vs
        .filter((v) => !files.has(v.id))
        .map(async (v) => {
          const r = await loadValues(v.id);
          files.set(v.id, r.status === 'ok' ? { status: 'ok', file: r.data } : { status: r.status === 'missing' ? 'missing' : 'error' });
        }),
    );
  };

  let generation = 0;

  /* ---- cards ---- */
  const cardFor = (id: string, aspect: number, keyMap: boolean): HTMLElement => {
    const d = registryDistrict(id)!;
    const remove = h(
      'button',
      { type: 'button', class: 'cmp-card__remove', 'aria-label': `Remove ${d.name} from the comparison` },
      h('span', { 'aria-hidden': 'true' }, '×'),
    );
    remove.addEventListener('click', () => {
      const i = ids.indexOf(id);
      ids = ids.filter((x) => x !== id);
      live.textContent = `Removed ${d.name}.`;
      draw();
      const next = top.querySelectorAll<HTMLButtonElement>('.cmp-card__remove')[Math.min(i, ids.length - 1)];
      (next ?? picker.input).focus();
    });
    const fig = h('div', { class: 'cmp-card__map' });
    if (geometry) {
      const svg = renderLocator({ geometry, districtId: id, aspect, keyMap });
      if (svg) fig.append(svg);
    }
    return h(
      'article',
      { class: 'cmp-card', 'data-district': id },
      fig,
      h(
        'div',
        { class: 'cmp-card__text' },
        h('p', { class: 'cmp-card__short' }, d.short),
        h('h2', { class: 'cmp-card__name' }, h('a', { href: `#/district/${id}` }, d.name)),
        h('p', { class: 'cmp-card__meta' }, `${d.stateName} · ${circuitLabel(d.circuit)}`),
      ),
      remove,
    );
  };

  /* ---- empty state: suggestions ---- */
  const suggestions = (): HTMLElement => {
    const list = h('ul', { class: 'cmp-suggest__list' });
    for (const sgg of SUGGESTIONS) {
      const btn = h(
        'button',
        { type: 'button', class: 'cmp-suggest__btn' },
        h('span', { class: 'cmp-suggest__title' }, sgg.title),
        h('span', { class: 'cmp-suggest__ids' }, sgg.ids.map((id) => registryDistrict(id)?.short ?? id).join(' · ')),
        h('span', { class: 'cmp-suggest__note' }, sgg.note),
      );
      btn.addEventListener('click', () => {
        ids = [...sgg.ids];
        draw();
        live.textContent = `Comparing ${ids.map((id) => registryDistrict(id)?.name ?? id).join(', ')}.`;
        top.querySelector<HTMLElement>('.cmp-card__name a')?.focus();
      });
      list.append(h('li', null, btn));
    }
    return h(
      'section',
      { class: 'cmp-suggest', 'aria-labelledby': 'cmp-suggest-h' },
      h('h2', { class: 'cmp-suggest__head', id: 'cmp-suggest-h' }, 'Start with a pair'),
      h('p', { class: 'cmp-suggest__dek' }, 'Search for any district above, or try one of these.'),
      list,
    );
  };

  /* ---- toolbar: year selector + key ---- */
  const toolbar = (): HTMLElement => {
    const sel = h('select', { id: 'cmp-year', class: 'cmp-year__select' });
    sel.append(h('option', { value: '' }, 'Latest common year'));
    for (const y of allYears) sel.append(h('option', { value: String(y) }, periodLabel(y, 'FY_SEP30')));
    sel.value = chosenYear === null ? '' : String(chosenYear);
    const yearNote = () =>
      chosenYear === null ? 'Each measure shows the latest year in which every chosen district has data.' : 'Every measure shows this year. Some series do not reach it.';
    const note = h('p', { class: 'cmp-year__note' }, yearNote());
    // Only the rows redraw; the select keeps keyboard focus.
    sel.addEventListener('change', () => {
      chosenYear = sel.value ? parseInt(sel.value, 10) : null;
      syncUrl(ids, chosenYear);
      note.textContent = yearNote();
      drawBody();
      live.textContent = chosenYear === null ? 'Each measure shows its latest common year.' : `Every measure shows ${periodLabel(chosenYear, 'FY_SEP30')}.`;
    });
    return h(
      'div',
      { class: 'cmp-tools' },
      h(
        'div',
        { class: 'cmp-year' },
        h('label', { for: 'cmp-year', class: 'cmp-year__label caps' }, 'Year shown'),
        h('div', { class: 'select-wrap cmp-year__wrap' }, sel),
        note,
      ),
      h(
        'ul',
        { class: 'cmp-key', 'aria-label': 'How to read the rows' },
        h('li', null, h('span', { class: 'cmp-key__mark', 'aria-hidden': 'true' }, '▲'), h('span', null, 'Highest value among these districts.')),
        h('li', null, h('span', { class: 'cmp-key__mark', 'aria-hidden': 'true' }, '▼'), h('span', null, 'Lowest value, for measures read lowest first, such as times.')),
        h('li', null, h('span', { class: 'cmp-key__swatch cmp-key__swatch--ref', 'aria-hidden': 'true' }), h('span', null, 'National figure, on the same scale as each row’s trend lines.')),
        h('li', null, h('span', { class: 'cmp-key__swatch cmp-key__swatch--year', 'aria-hidden': 'true' }), h('span', null, 'The year shown.')),
        h('li', null, h('span', null, 'Ranks run from 1, the highest value among all districts with data that year.'), fxHint(RANK_FORMULA, 'Derived by the atlas', 'How ranks are computed')),
      ),
    );
  };

  /* ---- summary: widest gaps ---- */
  const summary = (host: HTMLElement) => {
    host.replaceChildren();
    const headId = uniqueId('cmp-sum');
    host.setAttribute('aria-labelledby', headId);
    const head = h(
      'header',
      { class: 'cmp-sum__head' },
      h('h2', { class: 'cmp-sum__title', id: headId }, 'Where they differ most'),
      derivedTag(GAP_FORMULA, 'How the gaps are measured', 'How the gaps are measured'),
    );
    host.append(head);
    if (ids.length < 2) {
      host.append(h('p', { class: 'cmp-sum__dek' }, 'Add a second district to see the measures that set them furthest apart.'));
      return;
    }
    const pending = featured.filter((v) => !files.has(v.id));
    if (pending.length) {
      host.append(h('div', { class: 'loading-state cmp-sum__loading' }, h('span', { class: 'loading-state__bar' }), 'Reading the main measures'));
      return;
    }
    type Gap = { v: Variable; file: ValuesFile; year: number; gap: number; hi: [string, number, number]; lo: [string, number, number]; of: number };
    const gaps: Gap[] = [];
    for (const v of featured) {
      const st = files.get(v.id);
      if (!st || st.status !== 'ok') continue;
      const file = st.file;
      const ry = rowYear(v, file, ids, chosenYear);
      if (ry.year === null || ry.mode === 'outside') continue;
      const year = ry.year;
      const of = rankedCount(file, year);
      if (!of || of < 2) continue;
      const cells = ids
        .map((id) => [id, getValue(file, id, year), getRank(file, id, year)] as const)
        .filter((c): c is readonly [string, number, number] => c[1] !== null && c[2] !== null && !getCellNote(file, c[0], year));
      if (cells.length < 2) continue;
      const hi = cells.reduce((a, b) => (b[2] < a[2] ? b : a));
      const lo = cells.reduce((a, b) => (b[2] > a[2] ? b : a));
      if (hi[1] === lo[1]) continue;
      gaps.push({ v, file, year, gap: (lo[2] - hi[2]) / (of - 1), hi: [...hi], lo: [...lo], of });
    }
    gaps.sort((a, b) => b.gap - a.gap || a.v.label.localeCompare(b.v.label));
    const top3 = gaps.filter((g) => g.gap > 0).slice(0, 3);
    host.append(
      h(
        'p',
        { class: 'cmp-sum__dek' },
        top3.length
          ? `Of the ${featured.length} main measures, these put the districts furthest apart in the national rankings.`
          : `None of the ${featured.length} main measures separates these districts in the national rankings for the years shown.`,
      ),
    );
    if (!top3.length) return;
    const list = h('ol', { class: 'cmp-sum__list' });
    for (const g of top3) {
      const pt = g.v.period_type ?? g.file.period_type;
      const side = (c: [string, number, number], which: 'hi' | 'lo') => {
        const d = registryDistrict(c[0])!;
        const p = valueParts(c[1], g.v);
        return h(
          'div',
          { class: `cmp-gap__side cmp-gap__side--${which}` },
          h('span', { class: 'cmp-gap__who' }, h('abbr', { title: d.name }, d.short)),
          h('span', { class: 'cmp-gap__val num' }, p.num, p.unit ? h('span', { class: 'cmp-gap__unit' }, ` ${p.unit}`) : ''),
          h('span', { class: 'cmp-gap__rank' }, rankPhrase(c[2], g.of, rankTies(g.file, g.year, c[2]))),
        );
      };
      // Computed from the values as printed on the page, so a reader's own subtraction matches.
      const asShown = (x: number) => Number(fmtNumberOnly(x, g.v).replace(/,/g, ''));
      const a = asShown(g.hi[1]);
      const b = asShown(g.lo[1]);
      const places = Math.max(decimalsOf(fmtNumberOnly(g.hi[1], g.v)), decimalsOf(fmtNumberOnly(g.lo[1], g.v)));
      const diff = Math.abs(a - b);
      const isPct = g.v.unit === 'percent';
      const diffText = isPct
        ? `${formatNumber(diff, places)} percentage points apart`
        : `A difference of ${formatValue(diff, { unit: g.v.unit, format: `.${places}f` })}`;
      const lowVal = Math.min(a, b);
      const highVal = Math.max(a, b);
      const ratio = !isPct && lowVal > 0 ? highVal / lowVal : null;
      const go = h('button', { type: 'button', class: 'cmp-gap__go' }, 'Go to the row');
      go.addEventListener('click', () => {
        const row = page.querySelector<HTMLElement>(`#cmp-row-${CSS.escape(g.v.id)}`);
        if (row) {
          row.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          row.focus({ preventScroll: true });
          row.classList.remove('cmp-tr--flash');
          void row.offsetWidth;
          row.classList.add('cmp-tr--flash');
          setTimeout(() => row.classList.remove('cmp-tr--flash'), 2000);
        }
      });
      list.append(
        h(
          'li',
          { class: 'cmp-gap' },
          h('p', { class: 'cmp-gap__label' }, h('span', { class: 'cmp-gap__measure' }, g.v.label), h('span', { class: 'cmp-gap__year' }, periodLabelFor(g.v, g.year, pt))),
          h('div', { class: 'cmp-gap__pair' }, side(g.hi, 'hi'), side(g.lo, 'lo')),
          standingStrip(g.hi[2], g.lo[2], g.of),
          h(
            'p',
            { class: 'cmp-gap__diff' },
            h('span', { class: 'cmp-gap__diff-text' }, diffText, ratio !== null && ratio < 1000 ? `, a ratio of ${formatNumber(ratio, ratio < 10 ? 1 : 0)} to 1` : '', '.'),
          ),
          go,
        ),
      );
    }
    host.append(list);
  };

  /* ---- rows ---- */
  const loadingRow = (v: Variable): HTMLElement =>
    h(
      'div',
      { class: 'cmp-tr cmp-tr--loading', role: 'row', 'data-variable': v.id },
      h('div', { class: 'cmp-measure', role: 'rowheader' }, h('h3', { class: 'cmp-measure__label' }, v.label)),
      ...ids.map(() => h('div', { class: 'cmp-td', role: 'cell' }, h('span', { class: 'cmp-skel', 'aria-hidden': 'true' }), h('span', { class: 'visually-hidden' }, 'Loading'))),
    );

  const missingRow = (v: Variable, why: string): HTMLElement =>
    h(
      'div',
      { class: 'cmp-tr cmp-tr--missing', role: 'row', 'data-variable': v.id },
      h('div', { class: 'cmp-measure', role: 'rowheader' }, h('h3', { class: 'cmp-measure__label' }, v.label), h('p', { class: 'cmp-measure__period' }, why)),
      ...ids.map(() => h('div', { class: 'cmp-td', role: 'cell' }, h('span', { class: 'no-data' }, 'No data'))),
    );

  const statRow = (v: Variable, file: ValuesFile): HTMLElement => {
    const n = ids.length;
    const pt = v.period_type ?? file.period_type;
    const ry = rowYear(v, file, ids, chosenYear);
    const year = ry.mode === 'outside' ? null : ry.year;
    const years = seriesYears(v, file);
    const xDomain: [number, number] = [years[0]!, years[years.length - 1]!];
    const spark = sparkSize();

    // One y-domain for every sparkline in the row: all chosen districts, every year, plus the national figure.
    // A national figure above every district in every published year is a total for all districts combined
    // (judgeships, vacant judgeship months, patent cases). It is not on a district's scale, so it is neither drawn
    // as the reference line nor allowed to stretch the shared domain.
    const nationalAll: Array<[number, number | null]> = years.map((y) => [y, getNational(file, y)]);
    const withNat = nationalAll.filter((e): e is [number, number] => e[1] !== null);
    const nationalIsTotal =
      withNat.length > 0 &&
      withNat.every(([y, nv]) => Object.keys(file.values).every((d) => {
        const dv = getValue(file, d, y);
        return dv === null || nv > dv;
      }));
    const nationalSeries: Array<[number, number | null]> = nationalIsTotal ? [] : nationalAll;
    const pool: number[] = [];
    for (const id of ids) for (const y of years) {
      const val = getValue(file, id, y);
      if (val !== null) pool.push(val);
    }
    for (const [, val] of nationalSeries) if (val !== null) pool.push(val);
    const domain: [number, number] | null = pool.length ? [Math.min(...pool), Math.max(...pool)] : null;

    // The marked district: highest value, or lowest for measures read lowest first.
    const asc = v.default_rank_direction === 'asc';
    const shown = ids.map((id) => getValue(file, id, year));
    const present = shown.filter((x): x is number => x !== null);
    let leadVal: number | null = null;
    if (present.length >= 2 && Math.min(...present) !== Math.max(...present)) leadVal = asc ? Math.min(...present) : Math.max(...present);
    const tied = leadVal !== null && present.filter((x) => x === leadVal).length > 1;

    // Derived? Sources?
    const anyDerived = !!v.derived || ids.some((id) => year !== null && getValue(file, id, year) !== null && isDerivedCell(file, id, year));
    const formula = anyDerived ? formulaFor(v, file, year) : null;
    const srcIds = new Set<string>();
    if (year !== null) {
      for (const id of ids) if (getValue(file, id, year) !== null) getCellSources(file, id, year).forEach((s) => srcIds.add(s));
      const ns = file.national_source_by_year?.[String(year)];
      if (ns && getNational(file, year) !== null) srcIds.add(ns);
    }
    const sources = srcIds.size ? [...srcIds] : (v.source_ids ?? []);

    // Measure cell
    const nat = year !== null ? getNational(file, year) : null;
    const natDerived = nat !== null && year !== null && !!file.national_derived_years?.includes(year);
    const caveats = caveatList(v);
    const measure = h(
      'div',
      { class: 'cmp-measure', role: 'rowheader' },
      h('h3', { class: 'cmp-measure__label' }, v.label),
      h('p', { class: `cmp-measure__period${ry.mode === 'outside' || ry.mode === 'none' ? ' cmp-measure__period--warn' : ''}` }, rowYearText(ry, v, file, n)),
      h(
        'p',
        { class: 'cmp-measure__nat' },
        h('span', { class: 'cmp-measure__nat-label' }, 'National'),
        ' ',
        nat !== null
          ? h('span', { class: 'cmp-measure__nat-val num', title: file.national_note ?? '' }, fmtValue(nat, v))
          : h('span', { class: 'cmp-measure__muted' }, year === null ? 'No data' : 'None published'),
        natDerived ? h('span', { class: 'cmp-measure__nat-derived' }, ' (derived)') : null,
        nationalIsTotal && nat !== null
          ? h('span', { class: 'cmp-measure__muted cmp-measure__nat-total' }, ' All districts combined, so it is not drawn on the trend lines.')
          : null,
      ),
      v.higher_means ? h('p', { class: 'cmp-measure__hint' }, `Higher means ${v.higher_means}.`) : null,
      h(
        'div',
        { class: 'cmp-measure__foot' },
        sourceChip({ sourceIds: sources, derived: anyDerived, formula, compact: true }),
        h(
          'details',
          { class: 'cmp-about' },
          h('summary', null, 'About this measure'),
          h(
            'div',
            { class: 'cmp-about__body' },
            v.explainer ? h('p', null, v.explainer) : null,
            v.breaks?.length ? h('p', null, h('strong', null, 'Break in the series: '), v.breaks.map((b) => `FY ${b.year}: ${b.note}`).join(' ')) : null,
            caveats.length ? h('ul', { class: 'cmp-about__caveats' }, ...caveats.map((c) => h('li', null, c))) : null,
            file.national_note && nat !== null ? h('p', null, h('strong', null, 'National figure: '), file.national_note) : null,
            h('p', null, h('a', { href: `#/?v=${encodeURIComponent(v.id)}` }, 'See it on the map'), ' · ', h('a', { href: `#/table/${encodeURIComponent(v.id)}` }, 'All districts in a table')),
          ),
        ),
      ),
    );

    const row = h(
      'div',
      {
        class: 'cmp-tr',
        role: 'row',
        id: `cmp-row-${v.id}`,
        'data-variable': v.id,
        'data-year': year === null ? null : String(year),
        'data-domain': domain ? domain.join(',') : null,
        tabindex: '-1',
      },
      measure,
    );

    ids.forEach((id, i) => {
      const d = registryDistrict(id)!;
      const val = shown[i] ?? null;
      const cell = h('div', { class: 'cmp-td', role: 'cell', 'data-district': id });
      cell.append(h('span', { class: 'cmp-td__who', 'aria-hidden': 'true' }, d.short));
      const valueEl = h('div', { class: 'cmp-td__value' });
      if (val === null || year === null) {
        valueEl.append(h('span', { class: 'no-data' }, 'No data'));
      } else {
        const p = valueParts(val, v);
        valueEl.append(h('span', { class: 'cmp-td__num num' }, p.num), p.unit ? h('span', { class: 'cmp-td__unit' }, ` ${p.unit}`) : '');
      }
      const isLead = leadVal !== null && val === leadVal;
      if (isLead) {
        cell.classList.add('cmp-td--lead');
        const word = asc ? 'Lowest' : 'Highest';
        valueEl.append(
          h(
            'span',
            { class: 'cmp-lead' },
            h('span', { class: 'cmp-lead__mark', 'aria-hidden': 'true' }, asc ? '▼' : '▲'),
            ` ${tied ? `Tied ${word.toLowerCase()}` : word}`,
            h('span', { class: 'visually-hidden' }, ' among these districts'),
          ),
        );
      }
      cell.append(valueEl);

      const rank = val !== null && year !== null ? getRank(file, id, year) : null;
      const of = year !== null ? rankedCount(file, year) : null;
      cell.append(
        h(
          'p',
          { class: 'cmp-td__rank' },
          val === null ? '' : rank !== null && of ? rankPhrase(rank, of, rankTies(file, year, rank)) : h('span', { class: 'cmp-measure__muted' }, 'Not ranked'),
        ),
      );
      const hasSeries = years.some((y) => getValue(file, id, y) !== null);
      const sparkEl = renderSparkline({
        points: years.map((y) => [y, getValue(file, id, y)]),
        variable: v,
        periodType: pt,
        ...spark,
        labelLatest: false,
        domain,
        xDomain,
        reference: nationalSeries.some(([, x]) => x !== null) ? nationalSeries : null,
        referenceLabel: 'National figure',
        markYear: year,
        labelPrefix: d.name,
      });
      cell.append(
        h(
          'div',
          { class: 'cmp-td__trend' },
          // A district with no value in any year already reads "No data"; an empty trend keeps the rows aligned.
          hasSeries ? sparkEl : null,
          // First and last year of the shared x-axis (wide layouts only; the phone layout is too small to label).
          hasSeries && sparkEl.querySelector('svg')
            ? h('span', { class: 'cmp-td__axis', 'aria-hidden': 'true' }, h('span', null, String(xDomain[0])), h('span', null, String(xDomain[1])))
            : null,
        ),
      );

      // Always present (possibly empty), so value, rank and trend line up across the row (CSS subgrid).
      const extra = h('div', { class: 'cmp-td__extra' });
      const cellDerived = !v.derived && val !== null && year !== null && isDerivedCell(file, id, year);
      if (cellDerived) extra.append(h('p', { class: 'cmp-td__flag' }, 'Derived value'));
      const note = val !== null && year !== null ? getCellNote(file, id, year) : null;
      if (note) {
        extra.append(h('details', { class: 'cmp-note' }, h('summary', null, h('span', { class: 'cmp-note__mark', 'aria-hidden': 'true' }, '!'), ' Note'), h('p', null, note)));
      }
      cell.append(extra);
      row.append(cell);
    });
    return row;
  };

  const rowFor = (v: Variable): HTMLElement => {
    const st = files.get(v.id);
    if (!st) return loadingRow(v);
    if (st.status !== 'ok') return missingRow(v, st.status === 'missing' ? 'This measure’s data file is not published yet.' : 'This measure’s data file could not be read.');
    return statRow(v, st.file);
  };

  const headRow = (): HTMLElement =>
    h(
      'div',
      { class: 'cmp-tr cmp-tr--head', role: 'row' },
      h('div', { class: 'cmp-th', role: 'columnheader' }, 'Measure'),
      ...ids.map((id) => {
        const d = registryDistrict(id)!;
        return h('div', { class: 'cmp-th cmp-th--district', role: 'columnheader' }, h('abbr', { title: d.name }, d.short), h('span', { class: 'visually-hidden' }, `, ${d.name}`));
      }),
    );

  const familySection = (fam: (typeof FAMILIES)[number], gen: number): HTMLElement | null => {
    const vs = byFamily.get(fam.id) ?? [];
    if (!vs.length) return null;
    const main = vs.filter((v) => v.featured);
    const extra = vs.filter((v) => !v.featured);
    const first = main.length ? main : vs;
    const rest = main.length ? extra : [];
    const titleId = `cmp-fam-${fam.id}`;
    const table = h('div', { class: 'cmp-table', role: 'table', 'aria-labelledby': titleId, 'aria-describedby': `${titleId}-dek` }, headRow());
    const rowsOf = (list: Variable[]) => list.map((v) => rowFor(v));
    table.append(...rowsOf(first));
    const sec = h(
      'section',
      { class: 'cmp-family', id: `cmp-${fam.id}`, 'data-family': fam.id },
      h('header', { class: 'cmp-family__head' }, h('h2', { class: 'cmp-family__title', id: titleId }, fam.label), h('p', { class: 'cmp-family__dek', id: `${titleId}-dek` }, fam.dek)),
      table,
    );
    const refill = (list: Variable[], extra = false) => {
      if (gen !== generation) return;
      for (const v of list) {
        const old = table.querySelector(`.cmp-tr--loading[data-variable="${CSS.escape(v.id)}"]`);
        if (!old) continue;
        const fresh = rowFor(v);
        if (extra) fresh.classList.add('cmp-tr--extra');
        old.replaceWith(fresh);
      }
    };
    void ensure(first).then(() => refill(first));
    if (rest.length) {
      const btn = h('button', { type: 'button', class: 'btn cmp-family__more', 'aria-expanded': 'false' });
      const label = (open: boolean) =>
        (btn.textContent = open ? `Show fewer ${fam.label.toLowerCase()} measures` : `Show ${rest.length} more ${fam.label.toLowerCase()} measures`);
      const open = (on: boolean) => {
        btn.setAttribute('aria-expanded', String(on));
        label(on);
        table.querySelectorAll('.cmp-tr--extra').forEach((r) => r.remove());
        if (on) {
          const rows = rowsOf(rest);
          rows.forEach((r) => r.classList.add('cmp-tr--extra'));
          table.append(...rows);
          void ensure(rest).then(() => refill(rest, true));
        }
      };
      label(false);
      btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-expanded') !== 'true';
        if (on) expanded.add(fam.id);
        else expanded.delete(fam.id);
        open(on);
      });
      sec.append(btn);
      if (expanded.has(fam.id)) open(true);
    }
    return sec;
  };

  /* ---- draw ---- */
  let sumHost: HTMLElement | null = null;

  const drawBody = () => {
    generation += 1;
    const gen = generation;
    body.replaceChildren();
    if (!ids.length) return;
    if (!variables.length) {
      body.append(
        h(
          'div',
          { class: 'empty-state' },
          h('p', { class: 'empty-state__title' }, 'The statistics are not published yet'),
          h('p', { class: 'empty-state__body' }, 'The list of measures (variables.json) could not be read, so there is nothing to compare.'),
        ),
      );
      return;
    }
    sumHost = h('section', { class: 'cmp-sum' });
    body.append(sumHost);
    summary(sumHost);
    for (const fam of FAMILIES) {
      const sec = familySection(fam, gen);
      if (sec) body.append(sec);
    }
    void ensure(featured).then(() => {
      if (gen === generation && sumHost) summary(sumHost);
    });
  };

  const draw = () => {
    syncUrl(ids, chosenYear);
    cmp.dataset.n = String(ids.length);
    cmp.style.setProperty('--n', String(Math.max(1, ids.length)));
    cmp.style.setProperty('--cols', String(Math.max(2, ids.length)));
    picker.refresh();
    applyStack();
    layoutKey = cmp.className;
    top.replaceChildren();
    if (!ids.length) {
      top.append(suggestions());
      body.replaceChildren();
      generation += 1;
      return;
    }
    const stacked = cmp.classList.contains('cmp--stacked');
    const aspect = stacked ? 1.3 : ids.length <= 2 ? 1.75 : ids.length === 3 ? 1.4 : 1.2;
    const cards = h('div', { class: 'cmp-cards' }, ...ids.map((id) => cardFor(id, aspect, !stacked)));
    if (ids.length === 1) {
      const d = registryDistrict(ids[0]!)!;
      const near = DISTRICTS.filter((x) => x.id !== d.id && (x.state === d.state || x.circuit === d.circuit))
        .sort((a, b) => Number(b.state === d.state) - Number(a.state === d.state) || a.order - b.order)
        .slice(0, 4);
      const quick = h(
        'div',
        { class: 'cmp-quick' },
        h('p', { class: 'cmp-quick__label' }, `Add one more to compare. Others in the ${circuitLabel(d.circuit)}:`),
        h(
          'ul',
          { class: 'cmp-quick__list' },
          ...near.map((x) => {
            const b = h('button', { type: 'button', class: 'cmp-quick__btn' }, `+ ${x.short}`);
            b.setAttribute('aria-label', `Add ${x.name}`);
            b.addEventListener('click', () => {
              ids = [...ids, x.id];
              draw();
              live.textContent = `Added ${x.name}.`;
            });
            return h('li', null, b);
          }),
        ),
      );
      cards.append(quick);
    }
    top.append(toolbar(), cards);
    drawBody();
  };

  draw();

  return () => {
    ro?.disconnect();
    picker.dispose();
  };
}
