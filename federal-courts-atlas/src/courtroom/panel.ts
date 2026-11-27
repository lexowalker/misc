// The Courtroom data panel: who sits in the chosen seat, and the atlas figures for that seat
// in the chosen district (or the national figure, where the source publishes one).
//
// Every number is read at runtime from public/data/ (values/<variable>.json, districts.json,
// sources.json, manifest.json). Labels, units, explainers and caveats come from
// variables.json. Missing values render as "No data"; derived values carry a "Derived" chip
// whose formula shows on hover or focus. Ranks are derived by the atlas and say so.

import { h, uniqueId } from '../lib/dom.ts';
import { decimalsFor, formatDate, formatNumber, formatValue, ordinal, periodLabel } from '../lib/format.ts';
import { rich } from '../components/glossary.ts';
import { sourceChip } from '../components/source-chip.ts';
import { renderSparkline } from '../components/sparkline.ts';
import { noData } from '../components/states.ts';
import {
  caveatList,
  getCellNote,
  getCellSources,
  getNational,
  getRank,
  getValue,
  isDerivedCell,
  loadDistricts,
  loadManifest,
  loadSources,
  loadValues,
  loadVariables,
  rankedCount,
} from '../data/loaders.ts';
import { districtName, registryDistrict } from '../data/districts.ts';
import { href } from '../app/router.ts';
import type { District, Loaded, SourceRecord, ValuesFile, Variable } from '../data/types.ts';
import { SEATS, seatVariables, type SeatDef, type SeatStat } from './seats.ts';

type Fmt = Pick<Variable, 'format' | 'unit'> | null | undefined;

/* ---- Formatting helpers (local copies; the profile lane keeps its own) ----------------------- */

/** formatValue(), except that a published fraction is never rounded away (the AO prints shared judgeships as halves). */
function fmtValue(value: number | null | undefined, v: Fmt, opts: { unit?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No data';
  if (decimalsFor(v, value) === 0 && !Number.isInteger(value)) return formatValue(value, { unit: v?.unit ?? '', format: '.1f' }, opts);
  return formatValue(value, v, opts);
}

function valueParts(value: number, v: Fmt): { num: string; unit: string } {
  const full = fmtValue(value, v);
  const num = fmtValue(value, v, { unit: false });
  return { num, unit: full.startsWith(num) ? full.slice(num.length).trim() : '' };
}

/** "Highest of 94", "12th highest of 94", "Lowest of 51". Rank 1 is always the highest value. */
function rankPhrase(rank: number, of: number): string {
  if (rank === 1) return `Highest of ${of}`;
  if (rank === of) return `Lowest of ${of}`;
  return `${ordinal(rank)} highest of ${of}`;
}

const RANK_FORMULA =
  'rank = 1 + the number of districts with a higher value that year. Tied districts share a rank. Only districts with data that year are ranked.';

/** A small "ƒ" button with a popover (same look as the source chip's formula button). */
function fxHint(text: string, title: string, label: string): HTMLElement {
  const id = uniqueId('cr-fx');
  return h(
    'span',
    { class: 'cr-fx' },
    h('button', { type: 'button', class: 'source-chip__formula', 'aria-describedby': id, 'aria-controls': id, 'aria-label': label }, 'ƒ'),
    h('span', { id, role: 'tooltip', class: 'source-chip__pop cr-fx__pop' }, h('span', { class: 'caps' }, title), h('code', null, text)),
  );
}

/** Formula for a cell: the file's or variable's own, else the formula of that year's derived basis (USSC). */
function formulaFor(v: Variable | undefined, file: ValuesFile, year: number | null): string | null {
  if (file.formula) return file.formula;
  if (v?.formula) return v.formula;
  if (year === null) return null;
  for (const b of file.basis_by_year?.[String(year)] ?? []) {
    const f = file.formula_by_basis?.[b] ?? v?.formula_by_basis?.[b];
    if (f) return f;
  }
  return null;
}

function stripMarkup(s: string): string {
  return s.replace(/\[\[[a-z0-9-]+\|([^\]]+)\]\]/g, '$1').replace(/\[\[([a-z0-9-]+)\]\]/g, '$1');
}

function latestYearOf(file: ValuesFile): number | null {
  return file.years.length ? file.years[file.years.length - 1]! : null;
}

/* ---- District picker ------------------------------------------------------------------------- */

const CIRCUIT_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'DC'];
function circuitName(c: string): string {
  if (c === 'DC') return 'D.C. Circuit';
  const n = parseInt(c, 10);
  const suf = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suf} Circuit`;
}

export function districtSelect(selected: string | null, onChange: (id: string | null) => void, ids: string[]): HTMLSelectElement {
  const sel = h('select', { id: 'cr-district', class: 'cr-select', 'aria-describedby': 'cr-district-help' });
  sel.append(h('option', { value: '' }, 'All districts (national figures)'));
  for (const c of CIRCUIT_ORDER) {
    const group = h('optgroup', { label: circuitName(c) });
    for (const id of ids) {
      const d = registryDistrict(id);
      if (d?.circuit === c) group.append(h('option', { value: id }, d.name));
    }
    if (group.childElementCount) sel.append(group);
  }
  sel.value = selected ?? '';
  sel.addEventListener('change', () => onChange(sel.value || null));
  return sel;
}

/* ---- Panel ----------------------------------------------------------------------------------- */

export interface PanelContext {
  seat: SeatDef | null;
  district: string | null;
}

let renderSeq = 0;

/** Fill `body` with the content for a seat (or the intro when no seat is chosen). */
export async function renderPanelBody(body: HTMLElement, ctx: PanelContext): Promise<void> {
  const seq = ++renderSeq;
  body.replaceChildren();
  body.setAttribute('aria-busy', 'true');
  if (!ctx.seat) {
    body.append(intro(ctx.district));
    body.removeAttribute('aria-busy');
    return;
  }
  const seat = ctx.seat;
  const n = SEATS.indexOf(seat) + 1;
  body.append(
    h(
      'header',
      { class: 'cr-panel__head' },
      h('p', { class: 'kicker cr-panel__kicker' }, `Seat ${n} of ${SEATS.length}`),
      h('h2', { class: 'cr-panel__title', id: 'cr-panel-title', tabindex: '-1' }, seat.name),
    ),
    h('p', { class: 'cr-panel__role' }, rich(seat.role)),
  );
  if (seat.noData) body.append(h('p', { class: 'cr-panel__nodata' }, h('span', { class: 'caps' }, 'Not in the data'), seat.noData));

  const figures = h('div', { class: 'cr-panel__figures' });
  figures.append(
    h(
      'p',
      { class: 'cr-panel__scope' },
      ctx.district ? `Figures for the ${districtName(ctx.district)}` : 'National figures, for all districts combined',
    ),
  );
  body.append(figures);
  const skeleton = h('div', { class: 'cr-skel', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'));
  if (seat.groups.length || seat.extras?.length) figures.append(skeleton);

  // Optional measures are fetched only if the catalog lists them (no request for a file that is not published).
  const varsR = await loadVariables();
  const listed = new Set(varsR.status === 'ok' ? varsR.data.map((v) => v.id) : []);
  const notPublished = (): Promise<Loaded<ValuesFile>> => Promise.resolve({ status: 'missing', url: '' });
  const valueResults = await Promise.all(
    seat.groups.flatMap((g) => g.stats.map((st) => (st.optional && !listed.has(st.variable) ? notPublished() : loadValues(st.variable)))),
  );
  const needDistricts = seat.extras?.includes('population') || seat.extras?.includes('places');
  const distR = needDistricts ? await loadDistricts() : null;
  if (seq !== renderSeq) return;
  skeleton.remove();

  const vars = new Map<string, Variable>();
  if (varsR.status === 'ok') for (const v of varsR.data) vars.set(v.id, v);

  if (seat.extras?.includes('population')) figures.append(populationBlock(ctx.district, distR));

  let k = 0;
  for (const g of seat.groups) {
    const groupEl = h('section', { class: 'cr-group' }, g.title ? h('h3', { class: 'cr-group__title' }, g.title) : null);
    const list = h('div', { class: 'cr-group__list' });
    let missingOptional = false;
    for (const st of g.stats) {
      const r = valueResults[k++]!;
      if (st.optional && r.status === 'missing') {
        missingOptional = true;
        continue;
      }
      list.append(statRow(st, vars.get(st.variable), r, ctx.district));
    }
    groupEl.append(list);
    if (missingOptional && g.missingNote) groupEl.append(h('p', { class: 'cr-group__missing' }, g.missingNote));
    figures.append(groupEl);
  }

  if (seat.extras?.includes('places')) figures.append(placesBlock(ctx.district, distR));
  if (seat.extras?.includes('record')) figures.append(await recordBlock(vars));
  if (seq !== renderSeq) return;

  if (seat.note) body.append(h('p', { class: 'cr-panel__note' }, seat.note));
  if (seat.groups.length) {
    body.append(
      h(
        'p',
        { class: 'cr-panel__key' },
        h('span', { class: 'source-chip__label cr-key-derived' }, 'Derived'),
        ' marks values the atlas or its sources computed. The ƒ button shows the formula. Ranks are computed by the atlas: 1 is the highest value.',
      ),
    );
  }
  body.removeAttribute('aria-busy');
}

function intro(district: string | null): HTMLElement {
  return h(
    'div',
    { class: 'cr-intro' },
    h('h2', { class: 'cr-panel__title', id: 'cr-panel-title', tabindex: '-1' }, 'Choose a seat'),
    h(
      'p',
      { class: 'cr-panel__role' },
      'This is a typical federal district courtroom. The judge’s bench is at the front. A low railing, called the bar, separates the public gallery from the well, where the case is heard.',
    ),
    h(
      'p',
      { class: 'cr-panel__role' },
      rich(
        'Pick a seat in the room or from the list. The view moves to that seat, and this panel explains the role and shows figures from the atlas for that part of the court. They come from the courts’ own statistics ([[fcms|FCMS]] and the [[idb|IDB]]), the [[ussc|U.S. Sentencing Commission]], the Federal Judicial Center and the Census Bureau.',
      ),
    ),
    h(
      'p',
      { class: 'cr-intro__scope' },
      district
        ? `Figures will be for the ${districtName(district)}.`
        : 'Figures start with the national number where the source publishes one. Choose a district above to see its own figures.',
    ),
  );
}

function statLabel(st: SeatStat, v: Variable | undefined): Node {
  const plain = v?.label ?? st.variable;
  if (st.labelRich && v && stripMarkup(st.labelRich) === v.label) return rich(st.labelRich);
  return document.createTextNode(plain);
}

function statRow(st: SeatStat, v: Variable | undefined, r: Loaded<ValuesFile>, district: string | null): HTMLElement {
  const row = h('article', { class: 'cr-stat', 'data-variable': st.variable });
  const labelEl = h('h4', { class: 'cr-stat__label' }, statLabel(st, v));
  if (r.status !== 'ok') {
    row.append(
      h('div', { class: 'cr-stat__top' }, labelEl, h('p', { class: 'cr-stat__value' }, noData())),
      h('p', { class: 'cr-stat__meta' }, r.status === 'missing' ? 'This measure is not in the atlas’s published data.' : 'Could not load this measure.'),
    );
    return row;
  }
  const file = r.data;
  const year = latestYearOf(file);
  const periodType = file.period_type ?? v?.period_type;
  const fmt: Fmt = v ?? { unit: file.unit ?? '', format: undefined };

  let value: number | null;
  let sources: string[] = [];
  let derived = false;
  let note: string | null = null;
  const meta: Array<Node | string> = [];
  if (year !== null) meta.push(h('span', { class: 'cr-stat__period' }, periodLabel(year, periodType)));

  if (district) {
    value = getValue(file, district, year);
    if (value !== null) {
      sources = getCellSources(file, district, year);
      derived = isDerivedCell(file, district, year);
      note = getCellNote(file, district, year);
      const rank = getRank(file, district, year);
      const of = rankedCount(file, year);
      if (rank && of) meta.push(h('span', { class: 'cr-stat__rank' }, rankPhrase(rank, of), fxHint(RANK_FORMULA, 'Derived by the atlas', 'How this rank is computed')));
      const nat = getNational(file, year);
      if (nat !== null) meta.push(h('span', { class: 'cr-stat__nat' }, `National: ${fmtValue(nat, fmt)}`));
    } else {
      meta.push(h('span', null, `No data for this district in ${year !== null ? periodLabel(year, periodType) : 'any year'}`));
    }
  } else {
    value = getNational(file, year);
    if (value !== null) {
      const src = year !== null ? file.national_source_by_year?.[String(year)] : undefined;
      sources = src ? [src] : (year !== null ? (file.source_by_year?.[String(year)] ?? []) : []);
      derived = !!file.derived || (year !== null && !!file.national_derived_years?.includes(year));
      meta.push(h('span', { class: 'cr-stat__nat' }, 'National figure'));
    } else {
      meta.push(h('span', null, 'No national figure is published for this measure. Choose a district to see it.'));
    }
  }

  const valueEl = h('p', { class: 'cr-stat__value' });
  if (value === null) {
    valueEl.append(district ? noData() : h('span', { class: 'no-data' }, 'No national figure'));
  } else {
    const parts = valueParts(value, fmt);
    valueEl.append(h('span', { class: 'cr-stat__num' }, parts.num), parts.unit ? h('span', { class: 'cr-stat__unit' }, ` ${parts.unit}`) : '');
  }
  row.append(h('div', { class: 'cr-stat__top' }, labelEl, valueEl));
  row.append(h('p', { class: 'cr-stat__meta' }, ...meta.flatMap((m, i) => (i ? [h('span', { class: 'cr-stat__sep', 'aria-hidden': 'true' }, ' · '), m] : [m]))));

  // Trend line and source.
  const foot = h('div', { class: 'cr-stat__foot' });
  const points: Array<[number, number | null]> = file.years.map((y) => [y, district ? getValue(file, district, y) : getNational(file, y)]);
  const reference = district && file.national ? file.years.map((y): [number, number | null] => [y, getNational(file, y)]) : null;
  if (points.filter((p) => p[1] !== null).length >= 2) {
    foot.append(
      renderSparkline({
        points,
        variable: v ?? { unit: fmt?.unit ?? '', format: fmt?.format, label: st.variable },
        periodType,
        width: 120,
        height: 30,
        labelLatest: false,
        reference: reference && reference.some((p) => p[1] !== null) ? reference : null,
        referenceLabel: 'National figure',
        markYear: year,
        labelPrefix: district ? districtName(district) : 'National',
      }),
    );
  }
  if (value !== null) {
    foot.append(sourceChip({ sourceIds: sources, derived, formula: derived ? formulaFor(v, file, year) : null, compact: true }));
  }
  if (foot.childElementCount) row.append(foot);
  if (note) row.append(h('p', { class: 'cr-stat__note' }, note));

  // About this measure: explainer, direction, caveats.
  if (v) {
    const about = h('details', { class: 'cr-stat__about' }, h('summary', null, 'About this measure'));
    if (v.explainer) about.append(h('p', null, v.explainer));
    if (v.higher_means) about.append(h('p', null, `Higher means ${v.higher_means}.`));
    if (!district && file.national_note && value !== null) about.append(h('p', null, file.national_note));
    const cav = caveatList(v);
    if (cav.length) about.append(h('ul', null, ...cav.map((c) => h('li', null, c))));
    row.append(about);
  }
  return row;
}

/* ---- Gallery: population and places of holding court --------------------------------------- */

function populationBlock(district: string | null, r: Loaded<Record<string, District>> | null): HTMLElement {
  const sec = h('section', { class: 'cr-group' }, h('h3', { class: 'cr-group__title' }, 'People served'));
  const list = h('div', { class: 'cr-group__list' });
  sec.append(list);
  if (!district) {
    list.append(
      h(
        'p',
        { class: 'cr-group__missing' },
        'The atlas does not publish a national population total for the district courts. Choose a district to see how many people it serves.',
      ),
    );
    return sec;
  }
  const d = r?.status === 'ok' ? r.data[district] : undefined;
  const fmt = { unit: 'persons', format: ',.0f' };
  const pop = typeof d?.population === 'number' ? d.population : null;
  const popRow = h('article', { class: 'cr-stat', 'data-variable': 'population' });
  popRow.append(
    h(
      'div',
      { class: 'cr-stat__top' },
      h('h4', { class: 'cr-stat__label' }, 'Residents of the district'),
      h('p', { class: 'cr-stat__value' }, pop === null ? noData() : statNum(pop, fmt)),
    ),
    h(
      'p',
      { class: 'cr-stat__meta' },
      pop !== null && d?.population_year ? periodLabel(d.population_year, d.population_period_type ?? 'JUL1_EST') : 'No population estimate for this district',
    ),
  );
  if (pop !== null && d) {
    popRow.append(
      h(
        'div',
        { class: 'cr-stat__foot' },
        sourceChip({ sourceIds: d.population_source_id ? [d.population_source_id] : [], derived: !!d.population_derived, formula: d.population_formula ?? null, compact: true }),
      ),
    );
    if (d.population_approximate && d.population_note) popRow.append(h('p', { class: 'cr-stat__note' }, d.population_note));
  }
  list.append(popRow);
  const c20 = d?.population_census_2020;
  if (c20 && typeof c20.value === 'number') {
    list.append(
      h(
        'article',
        { class: 'cr-stat', 'data-variable': 'population_census_2020' },
        h('div', { class: 'cr-stat__top' }, h('h4', { class: 'cr-stat__label' }, 'Residents at the 2020 Census'), h('p', { class: 'cr-stat__value' }, statNum(c20.value, fmt))),
        h('p', { class: 'cr-stat__meta' }, periodLabel(c20.year, c20.period_type)),
        h('div', { class: 'cr-stat__foot' }, sourceChip({ sourceIds: [c20.source_id], derived: !!c20.derived, formula: c20.formula ?? null, compact: true })),
      ),
    );
  }
  return sec;
}

function statNum(value: number, fmt: Fmt): DocumentFragment {
  const f = document.createDocumentFragment();
  const parts = valueParts(value, fmt);
  f.append(h('span', { class: 'cr-stat__num' }, parts.num), parts.unit ? h('span', { class: 'cr-stat__unit' }, ` ${parts.unit}`) : '');
  return f;
}

function placesBlock(district: string | null, r: Loaded<Record<string, District>> | null): HTMLElement {
  const sec = h('section', { class: 'cr-group' }, h('h3', { class: 'cr-group__title' }, 'Where the court sits'));
  if (!district) {
    sec.append(h('p', { class: 'cr-group__missing' }, 'Choose a district to see the cities where it holds court.'));
    return sec;
  }
  const d = r?.status === 'ok' ? r.data[district] : undefined;
  const places = d?.places_of_holding_court ?? [];
  if (!places.length) {
    sec.append(h('p', { class: 'cr-group__missing' }, 'No places of holding court are listed for this district.'));
    return sec;
  }
  const statute = d?.statute_sections?.length ? ` (${d.statute_sections.join(', ')})` : '';
  sec.append(
    h('p', { class: 'cr-places__lead' }, `By statute${statute}, the court holds court in:`),
    h('ul', { class: 'cr-places' }, ...places.map((p) => h('li', null, p))),
    h('p', { class: 'cr-places__more' }, h('a', { href: href(`/district/${district}`) }, 'Counties, divisions and courthouses on the district page')),
  );
  return sec;
}

/* ---- Court reporter: the atlas's own record ------------------------------------------------ */

async function recordBlock(vars: Map<string, Variable>): Promise<HTMLElement> {
  const sec = h('section', { class: 'cr-group cr-record' }, h('h3', { class: 'cr-group__title' }, 'The record'));
  const [srcR, manR] = await Promise.all([loadSources(), loadManifest()]);
  const ids: string[] = [];
  for (const id of seatVariables()) for (const s of vars.get(id)?.source_ids ?? []) if (!ids.includes(s)) ids.push(s);
  if (srcR.status === 'ok' && srcR.data['web_series_census_popest'] && !ids.includes('web_series_census_popest')) ids.push('web_series_census_popest');
  const list = h('ul', { class: 'cr-record__list' });
  if (srcR.status !== 'ok') {
    sec.append(h('p', { class: 'cr-group__missing' }, 'The source list could not be loaded.'));
    return sec;
  }
  for (const id of ids) {
    const rec: SourceRecord | undefined = srcR.data[id];
    if (!rec) continue;
    const members = rec.kind === 'series' && rec.members?.length ? rec.members.length : 0;
    list.append(
      h(
        'li',
        { class: 'cr-record__item' },
        h('p', { class: 'cr-record__pub' }, rec.publisher ?? ''),
        h('p', { class: 'cr-record__ds' }, rec.url ? h('a', { href: rec.url, target: '_blank', rel: 'noopener' }, rec.dataset) : rec.dataset),
        h(
          'p',
          { class: 'cr-record__meta' },
          [rec.vintage, members ? `${formatNumber(members, 0)} source files` : null, rec.retrieved_at ? `retrieved ${formatDate(rec.retrieved_at)}` : null]
            .filter(Boolean)
            .join(' · '),
        ),
      ),
    );
  }
  sec.append(list);
  if (manR.status === 'ok' && (manR.data.build_date || manR.data.version)) {
    sec.append(
      h(
        'p',
        { class: 'cr-record__build' },
        [manR.data.build_date ? `Data build of ${formatDate(String(manR.data.build_date))}` : null, manR.data.version ? `version ${manR.data.version}` : null]
          .filter(Boolean)
          .join(', ') + '.',
      ),
    );
  }
  sec.append(h('p', { class: 'cr-places__more' }, h('a', { href: href('/sources') }, 'Every source in the atlas')));
  return sec;
}
