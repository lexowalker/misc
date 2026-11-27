// Case mix for the district profile: the IDB civil nature-of-suit mix and criminal
// offense mix for the latest IDB year (horizontal bars, national share as a tick),
// and the USSC four-way sentencing composition over time (100% stacked columns,
// two series kept apart, the FY 2018 method change annotated). All numbers come from
// public/data/profiles/<id>.json; nothing is computed here except pixel positions.

import { h, s, uniqueId } from '../../lib/dom.ts';
import { formatNumber, periodLabelFor } from '../../lib/format.ts';
import { Tooltip } from '../../components/tooltip.ts';
import { DataTable } from '../../components/data-table.ts';
import { sourceChip } from '../../components/source-chip.ts';
import { phraseLabel, term } from '../../components/glossary.ts';
import type { DistrictProfile, MixBlock, MixYearBlock, SentencingComposition, SentencingCompositionYear, Variable } from '../../data/types.ts';
import { formulaHint, viewToggle } from './common.ts';
import { mdlCallout } from './context.ts';

const SMALL_BASE = 30;
const SHOW_FIRST = 8;

const pct = (v: number) => `${formatNumber(v, 1)}%`;

/* ---- Mix panels: nature of suit, charges, how cases end, offenses of people sentenced ------- */

interface MixPanelOptions {
  id: string;
  title: string;
  unitNoun: string;
  block: MixBlock | undefined;
  notes: Array<string | Node>;
  /** An IDB catalog variable: its preliminary_years label FY 2026 "(preliminary)". */
  variable?: Variable;
  /** Shown while the year on display is preliminary. */
  prelimNote?: string | null;
}

/** "FY 2026 (preliminary)" from the variable's preliminary_years, or from the block's own flag. */
export function blockPeriod(b: MixYearBlock, v: Variable | undefined): string {
  const base = periodLabelFor(v, b.year, b.period_type);
  return b.preliminary && !base.includes('(preliminary)') ? `${base} (preliminary)` : base;
}

function mixRows(b: MixYearBlock, fixed: boolean): { list: HTMLOListElement; n: number; hasNational: boolean } {
  const groups = fixed ? [...b.groups] : [...b.groups].sort((a, z) => (z.share ?? -1) - (a.share ?? -1));
  const max = Math.max(1, ...groups.map((g) => Math.max(g.share ?? 0, g.national_share ?? 0)));
  const scaleMax = Math.ceil(max / 10) * 10;
  const hasNational = groups.some((g) => typeof g.national_share === 'number');
  const collapse = !fixed && groups.length > SHOW_FIRST;
  const list = h('ol', { class: 'mix__rows' });
  groups.forEach((g, i) => {
    const share = g.share;
    const nat = g.national_share;
    const row = h(
      'li',
      { class: `mix__row${collapse && i >= SHOW_FIRST ? ' mix__row--extra' : ''}`, 'data-group': g.id },
      h(
        'div',
        { class: 'mix__line' },
        h('span', { class: 'mix__labelbox' }, h('span', { class: 'mix__label' }, g.label), g.derived && g.formula ? formulaHint(g.formula, `How the share for ${g.label.toLowerCase()} is computed`) : null),
        h('span', { class: 'mix__val' }, share === null ? 'No data' : pct(share), h('span', { class: 'mix__count' }, ` (${formatNumber(g.count, 0)})`)),
      ),
      h(
        'div',
        { class: 'mix__track', 'aria-hidden': 'true' },
        share !== null ? h('span', { class: 'mix__bar', style: `width:${((share / scaleMax) * 100).toFixed(2)}%` }) : null,
        typeof nat === 'number' ? h('span', { class: 'mix__nat', style: `left:${((nat / scaleMax) * 100).toFixed(2)}%` }) : null,
      ),
      typeof nat === 'number' ? h('span', { class: 'visually-hidden' }, `All districts: ${pct(nat)}.`) : null,
    );
    row.title = `${g.label}: ${formatNumber(g.count, 0)} of ${formatNumber(b.total, 0)} (${share === null ? 'no data' : pct(share)})${typeof nat === 'number' ? `; all districts ${pct(nat)}` : ''}`;
    list.append(row);
  });
  if (collapse) list.classList.add('mix__rows--collapsed');
  return { list, n: groups.length, hasNational };
}

function mixPanel(o: MixPanelOptions): HTMLElement {
  const panel = h('figure', { class: 'mix', id: `mix-${o.id}` });
  const b = o.block;
  if (!b || !b.groups?.length) {
    panel.append(h('figcaption', { class: 'mix__title' }, phraseLabel(o.title)), h('p', { class: 'no-data' }, 'No data'));
    return panel;
  }
  const fixed = b.order === 'fixed';
  // The latest year first; a preliminary year comes with the latest year that has a published cross-check.
  const blocks: MixYearBlock[] = [b, ...(b.other_years ?? [])];
  const sub = h('span', { class: 'mix__sub' });
  const body = h('div', { class: 'mix__body' });
  panel.append(
    h(
      'figcaption',
      { class: 'mix__head' },
      h('span', { class: 'mix__title' }, phraseLabel(o.title)),
      sub,
    ),
  );
  if (blocks.length > 1) {
    const seg = h('div', { class: 'seg mix__years', role: 'group', 'aria-label': `Fiscal year for ${o.title.toLowerCase()}` });
    const btns = blocks.map((blk, i) => {
      const btn = h('button', { type: 'button', class: 'seg__btn', 'aria-pressed': String(i === 0), 'data-year': String(blk.year) }, blockPeriod(blk, o.variable));
      btn.addEventListener('click', () => {
        btns.forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
        draw(blk);
      });
      seg.append(btn);
      return btn;
    });
    panel.append(seg);
  }
  panel.append(body);

  function draw(blk: MixYearBlock): void {
    sub.textContent = `${blockPeriod(blk, o.variable)} · ${formatNumber(blk.total, 0)} ${o.unitNoun}`;
    const { list, n, hasNational } = mixRows(blk, fixed);
    const legend = h(
      'p',
      { class: 'mix__legend', 'aria-hidden': 'true' },
      h('span', { class: 'mix__key mix__key--bar' }),
      'This district',
      hasNational ? h('span', { class: 'mix__key mix__key--nat' }) : null,
      hasNational ? 'All districts' : null,
      h('span', { class: 'mix__key-count' }, 'Share (count)'),
    );
    body.replaceChildren(legend, list);
    if (list.classList.contains('mix__rows--collapsed')) {
      const more = h('button', { type: 'button', class: 'btn btn--quiet mix__more', 'aria-expanded': 'false' }, `Show all ${n} categories`);
      more.addEventListener('click', () => {
        const open = !list.classList.toggle('mix__rows--collapsed');
        more.setAttribute('aria-expanded', String(open));
        more.textContent = open ? 'Show fewer' : `Show all ${n} categories`;
      });
      body.append(more);
    }
    const foot = h('div', { class: 'mix__foot' }, h('p', null, b!.basis));
    if (blk.total < SMALL_BASE) foot.append(h('p', { class: 'stat__note' }, h('span', { class: 'stat__note-mark' }, 'Note'), ` Based on only ${formatNumber(blk.total, 0)} ${o.unitNoun}, so these shares can swing widely from year to year.`));
    if (o.prelimNote && (blk.preliminary || o.variable?.preliminary_years?.includes(blk.year))) foot.append(h('p', null, o.prelimNote));
    if (blk.national_note) foot.append(h('p', { class: 'mix__natnote' }, blk.national_note.text));
    for (const note of o.notes) foot.append(h('p', null, note));
    if (b!.definitions) foot.append(h('details', { class: 'mix__defs' }, h('summary', null, 'What the groups mean'), h('p', null, b!.definitions)));
    foot.append(sourceChip({ sourceIds: blk.source_ids, derived: b!.derived, formula: b!.formula, compact: true }));
    body.append(foot);
  }
  draw(b);
  return panel;
}

/* ---- Sentencing composition ------------------------------------------------------------- */

type CompKey = 'within' | 'nongovt_below' | 'govt_below' | 'above';
const STACK: Array<{ key: CompKey; label: string; short: string }> = [
  { key: 'within', label: 'Within the guideline range', short: 'Within range' },
  { key: 'nongovt_below', label: 'Below range, not sponsored by the government', short: 'Below, other' },
  { key: 'govt_below', label: 'Below range, sponsored by the government', short: 'Below, government' },
  { key: 'above', label: 'Above the guideline range', short: 'Above range' },
];

interface CompSeries {
  scheme: string;
  label: string;
  years: Array<[number, SentencingCompositionYear]>;
}

const PLOT_H = 168;
const AXIS_W = 40;
const TOP = 22;
const BOTTOM = 22;

function compPanel(series: CompSeries, annotateYear: number | null, tip: Tooltip, chartRoot: HTMLElement, live: HTMLElement): { el: HTMLElement; draw: () => void } {
  const el = h('div', { class: 'comp__panel' }, h('p', { class: 'comp__panel-title' }, series.label));
  const svgWrap = h('div', { class: 'comp__svg' });
  el.append(svgWrap);
  let focusIdx = series.years.length - 1;

  const summary = (y: number, d: SentencingCompositionYear) =>
    `FY ${y}: ${STACK.map((k) => `${k.short} ${d[k.key] === null ? 'no data' : pct(d[k.key]!)}`).join(', ')}${d.n !== null ? `; ${formatNumber(d.n, 0)} people` : ''}.`;

  function tipContent(y: number, d: SentencingCompositionYear): Node {
    return h(
      'div',
      { class: 'comp-tip' },
      h('p', { class: 'comp-tip__year' }, `FY ${y}`),
      h(
        'ul',
        { class: 'comp-tip__list' },
        ...[...STACK].reverse().map((k) =>
          h('li', null, h('span', { class: `comp-swatch comp-swatch--${k.key}`, 'aria-hidden': 'true' }), h('span', { class: 'comp-tip__label' }, k.short), h('span', { class: 'comp-tip__val' }, d[k.key] === null ? 'No data' : pct(d[k.key]!))),
        ),
      ),
      d.n !== null ? h('p', { class: 'comp-tip__n' }, `${formatNumber(d.n, 0)} people whose sentence could be compared with the range${d.n < SMALL_BASE ? '. A small base, so shares can swing widely.' : ''}`) : null,
      d.derived ? h('p', { class: 'comp-tip__n' }, 'Derived from USSC case records.') : null,
    );
  }

  function draw(): void {
    const width = Math.max(220, Math.floor(svgWrap.clientWidth || 320));
    const n = series.years.length;
    const plotW = width - AXIS_W - 4;
    const slot = plotW / Math.max(1, n);
    const barW = Math.min(24, Math.max(6, slot * 0.68));
    const H = TOP + PLOT_H + BOTTOM;
    const y = (p: number) => TOP + PLOT_H - (Math.max(0, Math.min(100, p)) / 100) * PLOT_H;
    const svg = s('svg', {
      class: 'comp__chart',
      width,
      height: H,
      viewBox: `0 0 ${width} ${H}`,
      role: 'img',
      tabindex: '0',
      'aria-label': `${series.label}. Use the left and right arrow keys to step through the years.`,
    });
    // Grid + y labels
    for (const g of [0, 50, 100]) {
      svg.append(
        s('line', { class: 'comp__grid', x1: AXIS_W, x2: width, y1: y(g), y2: y(g) }),
        s('text', { class: 'comp__ylab', x: AXIS_W - 6, y: y(g) + 3.5, 'text-anchor': 'end' }, `${g}%`),
      );
    }
    const cols: SVGGElement[] = [];
    series.years.forEach(([yr, d], i) => {
      const cx = AXIS_W + slot * (i + 0.5);
      const g = s('g', { class: `comp__col${d.n !== null && d.n < SMALL_BASE ? ' is-small' : ''}`, 'data-year': String(yr) });
      let acc = 0;
      STACK.forEach((k, si) => {
        const v = d[k.key];
        if (v === null || v <= 0) return;
        const y0 = y(acc);
        const y1 = y(acc + v);
        acc += v;
        // 1px surface gap between stacked segments (kept thin so 1% segments stay visible).
        const gap = si > 0 && acc - v > 0 ? 1 : 0;
        const hgt = Math.max(0.6, y0 - y1 - gap);
        g.append(s('rect', { class: `comp__seg comp__seg--${k.key}`, x: cx - barW / 2, y: y1, width: barW, height: hgt, rx: si === STACK.length - 1 || acc >= 99.95 ? 1.5 : 0 }));
      });
      g.append(s('rect', { class: 'comp__hit', x: cx - slot / 2, y: TOP, width: slot, height: PLOT_H }));
      const labelEvery = n > 10 ? (slot < 26 ? 4 : 2) : 1;
      if (i === 0 || i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= labelEvery / 2)) {
        g.append(s('text', { class: 'comp__xlab', x: cx, y: TOP + PLOT_H + 15, 'text-anchor': 'middle' }, String(yr)));
      }
      const show = () => {
        const cr = chartRoot.getBoundingClientRect();
        const sr = svg.getBoundingClientRect();
        tip.show(tipContent(yr, d), sr.left - cr.left + cx, sr.top - cr.top + y(Math.min(100, acc)) );
        cols.forEach((c) => c.classList.toggle('is-active', c === g));
      };
      g.addEventListener('pointerenter', show);
      g.addEventListener('pointerdown', show);
      cols.push(g);
      svg.append(g);
    });
    if (annotateYear !== null) {
      const idx = series.years.findIndex(([yr]) => yr === annotateYear);
      if (idx > 0) {
        const x = AXIS_W + slot * idx;
        svg.append(
          s('line', { class: 'comp__break', x1: x, x2: x, y1: TOP - 18, y2: TOP + PLOT_H }),
          s('text', { class: 'comp__break-label', x: x + 4, y: TOP - 9 }, `FY ${annotateYear}: new USSC method`),
        );
      }
    }
    svg.addEventListener('pointerleave', () => {
      tip.hide();
      cols.forEach((c) => c.classList.remove('is-active'));
    });
    const focusCol = (i: number) => {
      focusIdx = Math.max(0, Math.min(n - 1, i));
      const [yr, d] = series.years[focusIdx]!;
      const g = cols[focusIdx]!;
      cols.forEach((c) => c.classList.toggle('is-active', c === g));
      const cr = chartRoot.getBoundingClientRect();
      const sr = svg.getBoundingClientRect();
      tip.show(tipContent(yr, d), sr.left - cr.left + AXIS_W + slot * (focusIdx + 0.5), sr.top - cr.top + TOP + 10);
      live.textContent = summary(yr, d);
    };
    svg.addEventListener('focus', () => focusCol(focusIdx));
    svg.addEventListener('blur', () => {
      tip.hide();
      cols.forEach((c) => c.classList.remove('is-active'));
    });
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        focusCol(e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : focusIdx + (e.key === 'ArrowRight' ? 1 : -1));
      } else if (e.key === 'Escape') tip.hide();
    });
    svgWrap.replaceChildren(svg);
  }
  return { el, draw };
}

/** Reader-facing note on the two series (the data file's note uses pipeline vocabulary). */
function compNote(series: CompSeries[]): string {
  const sets = series.map((sr) => new Set(sr.years.map(([y]) => y)));
  const overlap = series.length > 1 ? [...sets[0]!].filter((y) => sets.slice(1).every((st) => st.has(y))).sort((a, b) => a - b) : [];
  return [
    'The USSC changed how it groups sentences in FY 2018, so the two series are shown apart rather than joined.',
    overlap.length ? `Where they overlap, FY ${overlap[0]} to ${overlap[overlap.length - 1]}, the atlas checked that the four shares match for every district.` : '',
    'Shares may not add to exactly 100 because each is rounded to one decimal.',
    `Columns based on fewer than ${SMALL_BASE} people are drawn lighter.`,
  ]
    .filter(Boolean)
    .join(' ');
}

function renderComposition(host: HTMLElement, comp: SentencingComposition, byId: Map<string, Variable>): () => void {
  const series: CompSeries[] = comp.series
    .map((sr) => ({
      scheme: sr.scheme,
      label: sr.label,
      years: Object.entries(sr.years)
        .map(([y, d]) => [Number(y), d] as [number, SentencingCompositionYear])
        .filter(([, d]) => STACK.some((k) => d[k.key] !== null))
        .sort((a, b) => a[0] - b[0]),
    }))
    .filter((sr) => sr.years.length);
  if (!series.length) {
    host.append(h('p', { class: 'no-data' }, 'No data'));
    return () => {};
  }
  const chartRoot = h('div', { class: 'comp__charts' });
  const tip = new Tooltip(chartRoot, 'comp-tooltip');
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  // Annotate the FY 2018 method change inside the rebuilt series (it spans the change).
  const panels = series.map((sr) => compPanel(sr, sr.years.some(([y]) => y === 2018) && sr.years[0]![0] < 2018 ? 2018 : null, tip, chartRoot, live));
  chartRoot.append(...panels.map((p) => p.el));

  const legend = h(
    'ul',
    { class: 'comp__legend' },
    ...[...STACK].reverse().map((k) => h('li', null, h('span', { class: `comp-swatch comp-swatch--${k.key}`, 'aria-hidden': 'true' }), k.label)),
  );

  const tableSlot = h('div', { class: 'comp__table', hidden: true });
  const rows = series.flatMap((sr) => sr.years.map(([y, d]) => ({ key: `${sr.scheme}-${y}`, year: y, scheme: sr.label, d })));
  const table = new DataTable<(typeof rows)[number]>({
    caption: 'Sentences relative to the guideline range, by fiscal year',
    rowKey: (r) => r.key,
    rowHeader: 'year',
    sortKey: 'year',
    sortDir: 'asc',
    rows,
    columns: [
      { key: 'year', label: 'Year', value: (r) => r.year, render: (r) => `FY ${r.year}` },
      { key: 'scheme', label: 'Series', value: (r) => r.scheme, optional: true },
      ...STACK.map((k) => ({ key: k.key, label: k.short, numeric: true, value: (r: (typeof rows)[number]) => r.d[k.key], render: (r: (typeof rows)[number]) => (r.d[k.key] === null ? 'No data' : pct(r.d[k.key]!)) })),
      { key: 'n', label: 'People', numeric: true, value: (r) => r.d.n, render: (r) => (r.d.n === null ? 'No data' : formatNumber(r.d.n, 0)) },
    ],
  });
  tableSlot.append(table.el);
  const toggle = viewToggle((t) => {
    chartRoot.hidden = t;
    legend.hidden = t;
    tableSlot.hidden = !t;
    tip.hide();
  });

  const ids = [...new Set(series.flatMap((sr) => sr.years.flatMap(([, d]) => d.source_ids)))];
  const formulas = (['above_range_pct', 'govt_below_range_pct', 'nongovt_below_range_pct'] as const)
    .map((id) => byId.get(id))
    .filter((v): v is Variable => !!v?.formula)
    .map((v) => `${v.short_label ?? v.label}: ${v.formula}`)
    .join(' | ');

  host.append(
    h('div', { class: 'comp__top' }, legend, toggle),
    chartRoot,
    tableSlot,
    live,
    h('p', { class: 'comp__note' }, compNote(series)),
    h('div', { class: 'comp__source' }, sourceChip({ sourceIds: ids, derived: series.some((sr) => sr.years.some(([, d]) => d.derived)), formula: formulas || null, compact: true })),
  );

  const drawAll = () => panels.forEach((p) => p.draw());
  drawAll();
  let ro: ResizeObserver | null = null;
  let lastW = chartRoot.clientWidth;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      const w = chartRoot.clientWidth;
      if (Math.abs(w - lastW) < 2) return;
      lastW = w;
      tip.hide();
      drawAll();
    });
    ro.observe(chartRoot);
  }
  return () => {
    ro?.disconnect();
    tip.destroy();
  };
}

export interface MixOptions {
  civil?: MixBlock;
  criminal?: MixBlock;
  composition: SentencingComposition;
  variables: Variable[];
  /** The whole profile: how cases end, offenses of people sentenced and the MDL note (optional, additive). */
  profile?: DistrictProfile;
}

const PRELIM_NOTE = 'FY 2026 figures from the IDB have not yet been checked against the AO’s published tables.';

/** Section subhead inside the case mix (same type as the composition title). */
function subhead(title: string, dek: string | null): HTMLElement[] {
  const id = uniqueId('mixsec');
  return [h('h3', { class: 'mix-sec__title comp__title', id }, title), ...(dek ? [h('p', { class: 'comp__dek mix-sec__dek' }, dek)] : [])];
}

/** USSC offense types that have their own map measure. */
const SENTENCED_MAP: Array<[string, string]> = [
  ['drug_trafficking', 'sentenced_drug_trafficking_pct'],
  ['immigration', 'sentenced_immigration_pct'],
  ['firearms', 'sentenced_firearms_pct'],
  ['child_pornography', 'sentenced_child_pornography_pct'],
];

export function renderCaseMix(host: HTMLElement, o: MixOptions): () => void {
  const byId = new Map(o.variables.map((v) => [v.id, v]));
  const cm = o.profile?.case_mix;
  const prisoner = byId.get('prisoner_petitions_pct');
  // IDB catalog variables carry preliminary_years (FY 2026); the mix blocks use them for their period labels.
  const idbCivil = byId.get('civil_trial_rate_pct') ?? prisoner;
  const idbCrim = byId.get('guilty_plea_pct') ?? byId.get('crim_drugs_pct');
  const civilNotes: Array<string | Node> = [
    'This grouping follows the civil cover sheet (JS 44), which counts immigration detention petitions (nature of suit 463) as prisoner petitions.' +
      (prisoner ? ` The “${prisoner.label.toLowerCase()}” measure in the statistics above counts only codes 510 to 560, so the two can differ.` : ''),
  ];

  // Multidistrict litigation note for the IDB years shown in this section.
  const idbYears = [o.civil, o.criminal, cm?.civil_disposition, cm?.criminal_disposition]
    .flatMap((b) => (b ? [b.year, ...(b.other_years ?? []).map((x) => x.year)] : []));
  const mdl = mdlCallout(o.profile?.mdl_context, { years: [...new Set(idbYears)], label: 'Multidistrict litigation in the case mix years' });

  const mixes = h(
    'div',
    { class: 'mix-grid' },
    mixPanel({ id: 'civil', title: 'Civil cases by nature of suit', unitNoun: 'civil cases filed', block: o.civil, notes: civilNotes, variable: idbCivil, prelimNote: PRELIM_NOTE }),
    mixPanel({ id: 'criminal', title: 'Criminal defendants by most serious charge', unitNoun: 'defendants charged', block: o.criminal, notes: [], variable: idbCrim, prelimNote: PRELIM_NOTE }),
  );
  host.append(...subhead('New cases and charges', null));
  if (mdl) host.append(mdl);
  host.append(mixes);

  // How cases end (IDB disposition groups).
  if (cm?.civil_disposition || cm?.criminal_disposition) {
    const prelim = [cm.civil_disposition, cm.criminal_disposition].some((b) => b?.preliminary && b.other_years?.length);
    host.append(
      h(
        'div',
        { class: 'mix-sec', id: 'mix-ends' },
        ...subhead(
          'How cases end',
          `Civil cases and criminal defendants whose cases closed during the year, by how they ended.${prelim ? ' FY 2026 figures are preliminary; switch to FY 2025 for the latest year checked against the AO’s published tables.' : ''}`,
        ),
        h(
          'div',
          { class: 'mix-grid' },
          mixPanel({ id: 'civil-ends', title: 'How civil cases ended', unitNoun: 'civil cases closed', block: cm.civil_disposition, notes: [], variable: idbCivil, prelimNote: PRELIM_NOTE }),
          mixPanel({ id: 'criminal-ends', title: 'How criminal cases ended', unitNoun: 'defendants whose cases closed', block: cm.criminal_disposition, notes: [], variable: idbCrim, prelimNote: PRELIM_NOTE }),
        ),
      ),
    );
  }

  // Offenses of people sentenced (USSC).
  const off = cm?.sentenced_offense;
  if (off) {
    const links = SENTENCED_MAP.filter(([gid, vid]) => byId.has(vid) && off.groups.some((g) => g.id === gid)).map(([gid, vid]) =>
      h('li', null, h('a', { href: `#/?v=${encodeURIComponent(vid)}` }, off.groups.find((g) => g.id === gid)!.label)),
    );
    host.append(
      h(
        'div',
        { class: 'mix-sec', id: 'mix-sentenced-sec' },
        ...subhead('Offenses of people sentenced', 'The main offense of each person sentenced during the year, as the U.S. Sentencing Commission classifies it.'),
        h(
          'div',
          { class: 'mix-grid' },
          mixPanel({ id: 'sentenced', title: 'People sentenced, by offense type', unitNoun: 'people sentenced with a known offense type', block: off, notes: [] }),
          h(
            'div',
            { class: 'mix-aside' },
            h('p', { class: 'mix-aside__title' }, 'How this differs from the charge mix'),
            h(
              'p',
              null,
              'The charge mix above counts defendants when their cases begin, by the most serious charge filed. This chart counts people when they are sentenced, using the Sentencing Commission’s offense types. People whose cases end in a dismissal or an acquittal are not sentenced, so they are not in it.',
            ),
            links.length ? h('p', { class: 'mix-aside__title' }, 'See these offense types on the map') : null,
            links.length ? h('ul', { class: 'mix-aside__links' }, ...links) : null,
          ),
        ),
      ),
    );
  }

  const compId = uniqueId('comp');
  const comp = h(
    'div',
    { class: 'comp', 'aria-labelledby': compId },
    h('h3', { class: 'comp__title', id: compId }, 'Sentences and the guideline range, by year'),
    h(
      'p',
      { class: 'comp__dek' },
      'Each column splits the people sentenced that year by where the sentence fell relative to the ',
      term('guideline-range', 'guideline range'),
      '. Government-sponsored reductions include ',
      term('5k1-1', '§5K1.1'),
      ' cooperation and ',
      term('5k3-1', '§5K3.1'),
      ' fast-track motions.',
    ),
  );
  host.append(comp);
  return renderComposition(comp, o.composition, byId);
}
