// Home: the national choropleth wired to the web lane's catalog (public/data/variables.json
// and values/<variable>.json). A switcher of thumbnail maps grouped in four families, a
// time machine with landmark events, an explicit tooltip (value, unit, rank direction,
// period, cell caveats, No data), courthouse dots, and "find your federal court" search.
// No statistic is written here: every number is read from public/data at runtime.

import '../styles/home.css';
import { h, s, uniqueId } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { replaceQuery } from '../app/router.ts';
import { caveatList, getCellNote, getNational, getRank, getValue, isDerivedCell, loadValues, loadVariables, rankedCount, rankTies } from '../data/loaders.ts';
import type { ValuesFile, Variable } from '../data/types.ts';
import { registryDistrict } from '../data/districts.ts';
import { formatValue, ordinal, periodLabel, periodLabelFor } from '../lib/format.ts';
import { ChoroplethView } from '../map/view.ts';
import type { MapData } from '../map/atlas-map.ts';
import { YearSlider } from '../components/year-slider.ts';
import { emptyState, errorState } from '../components/states.ts';
import { noDataSwatch } from '../components/legend.ts';
import { rich } from '../components/glossary.ts';
import { PlaceSearch } from '../components/place-search.ts';
import { FAMILY_LABEL, FAMILY_ORDER, VariableSwitcher, familyOf } from './home-switcher.ts';

export const title = 'Map of the federal district courts';

const UNIT_PHRASE: Record<string, string> = {
  months: 'Measured in months.',
  percent: 'Measured as a percentage.',
  per_judgeship: 'Measured per authorized judgeship.',
  per_100k: 'Measured per 100,000 residents.',
  cases: 'A count of cases.',
  judges: 'A count of judges.',
  judgeships: 'A count of authorized judgeships.',
  persons: 'A count of people.',
};

/* ---- derived values and ranks ------------------------------------------------- */

function stripDerived(t: string): string {
  return t.replace(/^\s*derived:\s*/i, '');
}

/** The formula behind one derived cell (whole-variable formula, or the year's derived basis). */
export function cellFormula(v: Variable, file: ValuesFile, id: string, year: number | null): string | null {
  if (year === null || !isDerivedCell(file, id, year)) return null;
  if (file.derived) return file.formula ?? v.formula ?? null;
  const fb = file.formula_by_basis ?? v.formula_by_basis ?? {};
  const lines = (file.basis_by_year?.[String(year)] ?? []).map((b) => fb[b]).filter((x): x is string => !!x);
  if (lines.length) return lines.map(stripDerived).join(' ');
  return file.formula ?? v.formula ?? null;
}

/** Formula lines for a variable as a whole (for the "Derived" label). */
function variableFormulas(v: Variable, file: ValuesFile | null): string[] {
  if (v.derived || file?.derived) {
    const f = v.formula ?? file?.formula;
    return f ? [stripDerived(f)] : [];
  }
  const fb = file?.formula_by_basis ?? v.formula_by_basis ?? {};
  return Object.values(fb).map(stripDerived);
}

function yearSpan(years: number[], periodType?: string): string {
  if (!years.length) return '';
  const sorted = [...years].sort((a, b) => a - b);
  const runs: Array<[number, number]> = [];
  for (const y of sorted) {
    const last = runs[runs.length - 1];
    if (last && y === last[1] + 1) last[1] = y;
    else runs.push([y, y]);
  }
  return runs.map(([a, b]) => (a === b ? periodLabel(a, periodType) : `${periodLabel(a, periodType)} to ${b}`)).join(', ');
}

/**
 * "3rd highest of 94", "Lowest of 94", "Tied for 5th lowest of 91". Rank 1 is the highest
 * value (web lane, competition ranking); the position from the bottom is counted the same
 * way over the same year's values, and whichever end is nearer is named.
 */
export function rankPhrase(file: ValuesFile, id: string, year: number | null): string | null {
  const v = getValue(file, id, year);
  const r = getRank(file, id, year);
  const n = rankedCount(file, year);
  if (v === null || !r || !n || year === null) return null;
  // Counted from the ranks, which the web lane computes on the values as displayed, so districts that
  // show the same number count as tied (data audit 2026-11-27).
  let lower = 0;
  let equal = 0;
  for (const d of Object.keys(file.values)) {
    const w = getRank(file, d, year);
    if (w === null || getValue(file, d, year) === null) continue;
    if (w > r) lower += 1;
    else if (w === r) equal += 1;
  }
  const tied = equal > 1;
  const fromBottom = lower + 1;
  const pre = tied ? 'Tied for ' : '';
  if (r === 1) return `${pre}${tied ? 'highest' : 'Highest'} of ${n}`;
  if (fromBottom === 1) return `${pre}${tied ? 'lowest' : 'Lowest'} of ${n}`;
  if (r <= fromBottom) return `${pre}${ordinal(r)} highest of ${n}`;
  return `${pre}${ordinal(fromBottom)} lowest of ${n}`;
}

/* ---- map tooltip and accessible names ------------------------------------------ */

function tooltipBody(id: string, data: MapData): Node | null {
  const { variable, values, year } = data;
  if (!variable || !values) return null;
  const frag = document.createDocumentFragment();
  const v = getValue(values, id, year);
  const derived = v !== null && isDerivedCell(values, id, year);
  frag.append(
    h('p', { class: 'map-tip__label' }, variable.short_label ?? variable.label, derived ? h('span', { class: 'map-tip__tag' }, 'Derived') : ''),
  );
  if (v === null) {
    frag.append(h('p', { class: 'map-tip__value is-missing' }, noDataSwatch(14), h('span', null, 'No data')));
  } else {
    const full = formatValue(v, variable);
    const num = formatValue(v, variable, { unit: false });
    const rest = full.startsWith(num) ? full.slice(num.length).trim() : '';
    frag.append(h('p', { class: 'map-tip__value' }, h('span', { class: 'num' }, rest ? num : full), rest ? h('span', { class: 'map-tip__unit' }, rest) : ''));
  }
  const rank = v !== null ? rankPhrase(values, id, year) : null;
  if (rank) frag.append(h('p', { class: 'map-tip__rank' }, rank, h('span', { class: 'map-tip__fine' }, ' districts')));
  const meta: string[] = [];
  if (year !== null) meta.push(periodLabelFor(variable, year, values.period_type));
  const r = getRank(values, id, year);
  const n = rankedCount(values, year);
  if (rank && r && n) meta.push(`derived rank ${rankTies(values, year, r) > 1 ? 'tied for ' : ''}${ordinal(r)} of ${n} (1 = highest)`);
  if (meta.length) box(frag, 'map-tip__meta', meta.join(' · '));
  const note = getCellNote(values, id, year);
  if (note) box(frag, 'map-tip__note', note);
  const f = derived ? cellFormula(variable, values, id, year) : null;
  if (f) frag.append(h('p', { class: 'map-tip__formula' }, h('span', { class: 'caps' }, 'Formula '), f));
  return frag;
}

function box(frag: DocumentFragment, cls: string, text: string): void {
  frag.append(h('p', { class: cls }, text));
}

/** Same pattern as the default ("..., 12th of 94, FY 2023"), with the rank direction named. */
function ariaLabelFor(id: string, data: MapData): string | null {
  const { variable, values, year } = data;
  if (!variable || !values) return null;
  const name = registryDistrict(id)?.name ?? id;
  const v = getValue(values, id, year);
  // Same order as the default label ("name, measure: value, 12th of 94, FY 2023"); the rank
  // direction is in the map's help text (ariaHelp), and a cell caveat follows the period.
  const parts = [`${name}, ${variable.label}: ${formatValue(v, variable)}`];
  const r = getRank(values, id, year);
  const n = rankedCount(values, year);
  if (v !== null && r && n) parts.push(`${ordinal(r)} of ${n}${rankTies(values, year, r) > 1 ? ' (tied)' : ''}`);
  if (year !== null) parts.push(periodLabelFor(variable, year, values.period_type));
  const note = getCellNote(values, id, year);
  return parts.join(', ') + (note ? `. Note: ${note}` : '');
}

/* ---- small UI pieces ------------------------------------------------------------ */

/** "Derived" label; its formula shows on hover or keyboard focus (Escape hides it). */
function derivedTag(text: string, lines: string[]): HTMLElement {
  const id = uniqueId('derived');
  const wrap = h('span', { class: 'dtag' });
  const btn = h('button', { type: 'button', class: 'dtag__btn', 'aria-describedby': lines.length ? id : null }, text);
  wrap.append(btn);
  if (lines.length) {
    wrap.append(h('span', { id, role: 'tooltip', class: 'dtag__pop' }, h('span', { class: 'caps' }, 'Formula'), ...lines.map((l) => h('span', { class: 'dtag__line' }, l))));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') wrap.classList.add('is-dismissed');
    });
    btn.addEventListener('blur', () => wrap.classList.remove('is-dismissed'));
    wrap.addEventListener('pointerleave', () => wrap.classList.remove('is-dismissed'));
  }
  return wrap;
}

function dotKey(): HTMLElement {
  const dot = (open: boolean) =>
    s(
      'svg',
      { class: 'home-key__dot', width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': 'true' },
      s('circle', { cx: 6, cy: 6, r: 4.6, class: 'home-key__halo' }),
      s('circle', { cx: 6, cy: 6, r: 3, class: 'home-key__fill' }),
      open ? s('circle', { cx: 6, cy: 6, r: 1.3, class: 'home-key__hole' }) : null,
    );
  return h(
    'p',
    { class: 'home-key' },
    h('span', { class: 'home-key__item' }, dot(false), 'Where the law says court is held'),
    h('span', { class: 'home-key__item' }, dot(true), 'Other federal courthouse (FJC list)'),
    h('span', { class: 'home-key__note' }, 'Dots mark cities, not buildings. Zoom in for names.'),
  );
}

/* ---- page ----------------------------------------------------------------------- */

export async function render(ctx: PageContext): Promise<() => void> {
  const root = ctx.root;
  const page = h('div', { class: 'page home' });
  const findSlot = h('div', { class: 'home-find' });
  const head = h(
    'header',
    { class: 'home-head' },
    h('p', { class: 'kicker' }, 'The 94 U.S. district courts'),
    h('h1', { class: 'home-head__title' }, 'How federal justice varies from place to place'),
    h(
      'div',
      { class: 'home-head__row' },
      h(
        'div',
        { class: 'home-head__intro' },
        h(
          'p',
          { class: 'dek home-head__dek' },
          rich('Federal cases begin in 94 [[district|district courts]]. Pick a measure to compare how fast they work, how busy they are, how they sentence and what cases they hear, year by year.'),
        ),
        h('p', { class: 'home-head__learn' }, h('a', { href: '#/learn' }, 'New to federal courts? Start with how they work', h('span', { 'aria-hidden': 'true' }, ' →'))),
      ),
      findSlot,
    ),
  );
  const switchSlot = h('div', { class: 'home-switch' });
  const measure = h('section', { class: 'home-measure', 'aria-label': 'Measure on the map' });
  const mapSlot = h('div', { class: 'home-map' });
  const about = h('section', { class: 'home-about', 'aria-label': 'About this measure' });
  const live = h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  page.append(head, switchSlot, measure, mapSlot, about, live);
  root.append(page);

  const search = new PlaceSearch(findSlot, {
    mode: 'popup',
    label: 'Find your federal court',
    placeholder: 'City, county, ZIP or courthouse',
  });

  let view: ChoroplethView | null = null;
  view = new ChoroplethView(mapSlot, {
    ariaLabel: 'Map of the 94 federal judicial districts',
    courthouseKinds: true,
    tooltipBody,
    ariaLabelFor,
    ariaHelp: 'Ranks count from the highest value: 1st of 94 is the highest.',
    legendHead: 'year',
    rankLabel: 'Rank (1 = highest)',
    legendNote: (values) => {
      const ys = values.years;
      const sc = view?.getScale();
      const groups = sc && sc.classes < 5 ? `Tied values leave ${sc.classes} color groups.` : 'Each color holds about a fifth of all values.';
      if (ys.length < 2) return groups;
      return `Colors are pooled across ${periodLabel(ys[0]!, values.period_type)} to ${ys[ys.length - 1]}, so a color means the same range in every year. ${groups}`;
    },
  });
  const mapView = view;
  const legendEl = mapView.el.querySelector<HTMLElement>('.choropleth__legend');
  const timeSlot = h('div', { class: 'home-time' });
  mapView.afterMap.append(timeSlot, dotKey());
  let slider: YearSlider | null = null;
  let switcher: VariableSwitcher | null = null;
  let current: { v: Variable; values: ValuesFile | null; year: number | null } | null = null;
  let seq = 0;
  let destroyed = false;

  const renderMeasure = () => {
    if (!current) return;
    const { v, values, year } = current;
    const lines = variableFormulas(v, values);
    const partly = !v.derived && !values?.derived && (values?.derived_years?.length || v.derived_years?.length);
    const tag = v.derived || values?.derived
      ? derivedTag('Derived', lines)
      : partly
        ? derivedTag(`Derived for ${yearSpan(values?.derived_years ?? v.derived_years ?? [], values?.period_type ?? v.period_type)}`, lines)
        : null;
    const nat = values ? getNational(values, year) : null;
    const natDerived = nat !== null && year !== null && !!values?.national_derived_years?.includes(year);
    measure.replaceChildren(
      h(
        'div',
        { class: 'home-measure__text' },
        h('p', { class: 'home-measure__family caps' }, FAMILY_LABEL[familyOf(v)] ?? 'Measure'),
        h('h2', { class: 'home-measure__title', id: 'home-measure-title' }, v.label, tag ? ' ' : '', tag),
        v.explainer ? h('p', { class: 'home-measure__explainer' }, v.explainer) : null,
        h(
          'p',
          { class: 'home-measure__higher' },
          UNIT_PHRASE[v.unit] ? `${UNIT_PHRASE[v.unit]} ` : '',
          v.higher_means ? h('span', null, h('strong', null, 'Higher means '), v.higher_means, '.') : '',
        ),
      ),
      h(
        'div',
        { class: 'home-measure__side' },
        nat !== null && values && year !== null
          ? h(
              'div',
              { class: 'home-measure__nat' },
              h('p', { class: 'caps' }, `All district courts, ${periodLabel(year, values.period_type)}`),
              h(
                'p',
                { class: 'home-measure__nat-value num', title: values.national_note ?? null },
                formatValue(nat, v),
                natDerived ? h('span', { class: 'map-tip__tag' }, 'Derived') : '',
              ),
            )
          : null,
        // The map's legend (owned by ChoroplethView, which keeps rendering into it) sits
        // beside the measure's name so the map itself starts higher on the page.
        legendEl,
      ),
    );
  };

  const renderAbout = () => {
    if (!current) return;
    const { v, values } = current;
    const caveats = caveatList(v);
    const breaks = v.breaks ?? [];
    about.replaceChildren(
      h(
        'div',
        { class: 'home-about__main' },
        h('h2', { class: 'home-about__title' }, 'What to keep in mind'),
        caveats.length ? h('ul', { class: 'home-about__caveats' }, ...caveats.map((c) => h('li', null, c))) : h('p', { class: 'home-about__text' }, 'No caveats are recorded for this measure.'),
        breaks.length
          ? h(
              'div',
              { class: 'home-about__breaks' },
              h('h3', { class: 'caps' }, 'Breaks in the series'),
              h('ul', { class: 'home-about__caveats' }, ...breaks.map((b) => h('li', null, h('strong', null, `${periodLabel(b.year, values?.period_type ?? v.period_type)}. `), b.note))),
            )
          : null,
      ),
      h(
        'div',
        { class: 'home-about__side' },
        ...(variableFormulas(v, values).length
          ? [
              h('h3', { class: 'caps' }, v.derived || values?.derived ? 'How this measure is derived' : 'How the derived years are computed'),
              h('p', { class: 'home-about__formula' }, ...variableFormulas(v, values).map((l) => h('span', { class: 'home-about__formula-line' }, l))),
            ]
          : []),
        h('h3', { class: 'caps' }, 'How ranks work'),
        h(
          'p',
          { class: 'home-about__small' },
          derivedTag('Derived', ['Rank = 1 + the number of districts with a higher value that year.', 'Districts with the same value share a rank.']),
          ' Rank 1 is the highest value among the districts with data that year. The tooltip counts from whichever end of the list is nearer, for example "3rd lowest".',
        ),
        ...(values?.national_note ? [h('h3', { class: 'caps' }, 'The national figure'), h('p', { class: 'home-about__small' }, values.national_note)] : []),
        h('h3', { class: 'caps' }, 'Reading the map'),
        h(
          'p',
          { class: 'home-about__small' },
          rich('Each shape is one of the 94 federal judicial districts. Thin lines separate districts; heavier lines are state borders. Alaska, Hawaii and the territories sit in the boxes at lower left. Hatched districts have no data for that year.'),
        ),
        h(
          'ul',
          { class: 'home-about__links' },
          values ? h('li', null, h('a', { href: `#/table/${encodeURIComponent(v.id)}` }, 'Every district, every year, as a table')) : null,
          h('li', null, h('a', { href: '#/sources' }, 'Where the data comes from')),
          h('li', null, h('a', { href: '#/learn' }, 'How federal courts work')),
        ),
      ),
    );
  };

  const showVariable = async (v: Variable, wantYear?: number | null) => {
    const my = ++seq;
    const r = await loadValues(v.id);
    if (my !== seq || destroyed) return;
    slider?.destroy();
    slider = null;
    switcher?.setActive(v.id);
    if (r.status !== 'ok') {
      current = { v, values: null, year: null };
      mapView.setData({ variable: null, values: null });
      timeSlot.replaceChildren(
        r.status === 'missing'
          ? emptyState({ title: 'No values for this measure yet', body: `${v.label} is listed, but its values file has not been published.`, file: `public/data/values/${v.id}.json`, compact: true })
          : errorState(r.error, r.url),
      );
      replaceQuery({ v: v.id, y: null });
      renderMeasure();
      renderAbout();
      return;
    }
    const values = r.data;
    const years = values.years;
    const keep = wantYear ?? current?.year ?? null;
    const y = keep !== null && years.includes(keep) ? keep : years[years.length - 1] ?? null;
    current = { v, values, year: y };
    mapView.setData({ variable: v, values, year: y });
    timeSlot.replaceChildren();
    if (years.length > 1 && y !== null) {
      slider = new YearSlider({
        years,
        value: y,
        periodType: values.period_type,
        label: `Year shown for ${v.label}`,
        onChange: (yr) => {
          if (!current) return;
          current.year = yr;
          mapView.setYear(yr);
          replaceQuery({ y: String(yr) });
          renderMeasure();
        },
      });
      timeSlot.append(slider.el);
    }
    replaceQuery({ v: v.id, y: y !== null ? String(y) : null });
    renderMeasure();
    renderAbout();
    live.textContent = `Map shows ${v.label}${y !== null ? `, ${periodLabel(y, values.period_type)}` : ''}.`;
  };

  const vr = await loadVariables();
  if (destroyed) return () => {};
  if (vr.status !== 'ok' || !vr.data.length) {
    switchSlot.append(
      h(
        'div',
        { class: 'home-notice', role: 'status' },
        h('span', { class: 'home-notice__dot', 'aria-hidden': 'true' }),
        h(
          'p',
          null,
          h('strong', null, 'Statistics not yet built. '),
          vr.status === 'error'
            ? `The list of measures could not be loaded (${vr.error}).`
            : 'The map shows the 94 district boundaries. Measures appear here once they are published. Nothing is estimated in the meantime.',
        ),
      ),
    );
    mapView.setData({ variable: null, values: null });
  } else {
    const order = (v: Variable) => {
      const i = (FAMILY_ORDER as readonly string[]).indexOf(v.family);
      return i < 0 ? 99 : i;
    };
    const vars = vr.data.map((v, i) => [v, i] as const).sort((a, b) => order(a[0]) - order(b[0]) || a[1] - b[1]).map(([v]) => v);
    const wanted = ctx.query.get('v');
    const initial = vars.find((v) => v.id === wanted) ?? vars[0]!;
    switcher = new VariableSwitcher(switchSlot, vars, initial.id, (v) => void showVariable(v));
    const yq = Number(ctx.query.get('y'));
    await showVariable(initial, Number.isFinite(yq) && yq > 0 ? yq : null);
    // Thumbnails only after the main map has painted (two frames after its paths exist),
    // and then in idle time, so they never compete with the first paint.
    void mapView.map.ready.then(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const start = () => !destroyed && switcher?.enableThumbnails();
          const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
          if (ric) ric(start, { timeout: 1200 });
          else setTimeout(start, 200);
        }),
      );
    });
  }

  return () => {
    destroyed = true;
    slider?.destroy();
    switcher?.destroy();
    search.destroy();
    mapView.destroy();
  };
}
