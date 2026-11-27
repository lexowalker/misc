// Key statistics and "What stands out" for the district profile. Every number comes
// from public/data/profiles/<id>.json (copied by the web lane from the values files);
// labels, units, formulas and caveats come from public/data/variables.json.

import { h } from '../../lib/dom.ts';
import { periodLabel } from '../../lib/format.ts';
import { renderSparkline } from '../../components/sparkline.ts';
import { sourceChip } from '../../components/source-chip.ts';
import { caveatList } from '../../data/loaders.ts';
import type { DistrictProfile, Family, KeyStatRow, ProfileClaim, ProfileSentence, Variable } from '../../data/types.ts';
import { fmtNumberOnly, fmtValue, formulaHint, RANK_FORMULA, rankPhrase, rankStrip, valueParts } from './common.ts';

export const FAMILIES: Array<{ id: Family; label: string; dek: string }> = [
  { id: 'speed', label: 'Speed', dek: 'How long cases take to move through the court.' },
  { id: 'workload', label: 'Workload', dek: 'How much work the court carries, per judgeship and per resident.' },
  { id: 'sentencing', label: 'Sentencing', dek: 'How sentences compare with the federal sentencing guidelines.' },
  { id: 'casemix', label: 'Case mix', dek: 'What kinds of cases and charges come before the court.' },
];

function yearsFor(row: KeyStatRow, v: Variable | undefined): number[] {
  if (v?.years?.length) return [...v.years].sort((a, b) => a - b);
  return Object.keys(row.series).map(Number).sort((a, b) => a - b);
}

function statRow(row: KeyStatRow, v: Variable): HTMLLIElement {
  const li = h('li', { class: 'stat', id: `stat-${v.id}`, 'data-variable': v.id });
  if (!row.featured) li.classList.add('stat--extra');

  // Label + period
  const head = h(
    'div',
    { class: 'stat__head' },
    h('h4', { class: 'stat__label' }, v.label),
    h('p', { class: 'stat__period' }, periodLabel(row.year, row.period_type)),
  );

  // Value
  const value = h('div', { class: 'stat__value' }, h('span', { class: 'visually-hidden' }, 'Value: '));
  if (row.value === null) {
    value.append(h('span', { class: 'no-data stat__nodata' }, 'No data'));
    if (row.latest_year_with_data) {
      value.append(h('span', { class: 'stat__sub' }, `Last reported for ${periodLabel(row.latest_year_with_data, row.period_type)}`));
    }
  } else {
    const p = valueParts(row.value, v);
    value.append(h('span', { class: 'stat__num' }, p.num), p.unit ? h('span', { class: 'stat__unit' }, ` ${p.unit}`) : '');
  }

  // Rank
  const rank = h('div', { class: 'stat__rank' }, h('span', { class: 'visually-hidden' }, 'Rank among districts: '));
  if (row.value !== null && row.rank !== null && row.ranked_of) {
    rank.append(
      h('span', { class: 'stat__rank-text' }, rankPhrase(row.rank, row.ranked_of), formulaHint(RANK_FORMULA)),
      rankStrip(row.rank, row.ranked_of),
    );
  } else {
    rank.append(h('span', { class: 'stat__muted' }, 'Not ranked'));
  }

  // National
  const nat = h('div', { class: 'stat__nat' }, h('span', { class: 'stat__cell-label' }, 'National'), ' ');
  nat.append(row.national !== null ? h('span', { class: 'stat__nat-val' }, fmtValue(row.national, v)) : h('span', { class: 'stat__muted' }, 'None published'));

  // Trend
  const years = yearsFor(row, v);
  const spark = h('div', { class: 'stat__trend' }, h('span', { class: 'visually-hidden' }, 'Trend: '));
  spark.append(
    renderSparkline({
      points: years.map((y) => [y, typeof row.series[String(y)] === 'number' ? row.series[String(y)]! : null]),
      variable: v,
      periodType: row.period_type,
      width: 128,
      height: 30,
      labelLatest: false,
    }),
  );
  const withData = years.filter((y) => typeof row.series[String(y)] === 'number');
  if (withData.length) spark.append(h('span', { class: 'stat__range' }, `${withData[0]} to ${withData[withData.length - 1]}`));

  // Source, derived flag + formula, cell note
  const foot = h(
    'div',
    { class: 'stat__foot' },
    row.source_ids?.length
      ? sourceChip({ sourceIds: row.source_ids, derived: row.derived, formula: row.derived ? (v.formula ?? null) : null, compact: true })
      : null,
  );
  if (row.note) foot.append(h('p', { class: 'stat__note' }, h('span', { class: 'stat__note-mark', 'aria-hidden': 'true' }, 'Note'), ' ', row.note));

  // About this measure (explainer, direction, caveats, series breaks)
  const caveats = caveatList(v);
  const about = h(
    'details',
    { class: 'stat__about' },
    h('summary', null, 'About this measure'),
    h(
      'div',
      { class: 'stat__about-body' },
      v.explainer ? h('p', null, v.explainer) : null,
      v.higher_means ? h('p', null, h('strong', null, 'Higher means: '), v.higher_means) : null,
      v.breaks?.length ? h('p', null, h('strong', null, 'Break in the series: '), v.breaks.map((b) => `FY ${b.year}: ${b.note}`).join(' ')) : null,
      caveats.length ? h('ul', { class: 'stat__caveats' }, ...caveats.map((c) => h('li', null, c))) : null,
      h('p', null, h('a', { href: `#/table/${encodeURIComponent(v.id)}` }, 'All districts in a table'), ' · ', h('a', { href: `#/?v=${encodeURIComponent(v.id)}` }, 'See it on the map')),
    ),
  );
  foot.append(about);

  li.append(head, value, rank, nat, spark, foot);
  return li;
}

/** Key statistics grouped by family; featured measures first, the rest behind a toggle. */
export function renderKeyStats(host: HTMLElement, profile: DistrictProfile, variables: Variable[]): void {
  const byId = new Map(variables.map((v) => [v.id, v]));
  const rows = new Map(profile.key_stats.map((r) => [r.variable, r]));
  host.append(
    h(
      'p',
      { class: 'dsec__note' },
      'Latest year for each measure. Ranks run from 1 (highest value) among districts with data that year; for the speed measures a high rank means a slower court. ',
      h('span', { class: 'dsec__note-key' }, h('span', { class: 'source-chip__label source-chip--derived-label' }, 'Derived'), 'marks values the atlas or its sources computed; the ƒ button shows the formula.'),
    ),
  );
  for (const fam of FAMILIES) {
    const vars = variables.filter((v) => v.family === fam.id && rows.has(v.id));
    if (!vars.length) continue;
    const extra = vars.filter((v) => !rows.get(v.id)!.featured).length;
    const list = h('ul', { class: 'stat-list', id: `stats-${fam.id}` });
    list.append(
      h(
        'li',
        { class: 'stat stat--colhead', 'aria-hidden': 'true' },
        h('span', null, 'Measure'),
        h('span', null, 'Latest'),
        h('span', null, 'Rank among districts'),
        h('span', null, 'National'),
        h('span', null, 'Trend'),
      ),
    );
    for (const v of vars) list.append(statRow(rows.get(v.id)!, byId.get(v.id)!));
    const group = h(
      'div',
      { class: 'stat-group', 'data-family': fam.id },
      h('div', { class: 'stat-group__head' }, h('h3', { class: 'stat-group__title' }, fam.label), h('p', { class: 'stat-group__dek' }, fam.dek)),
      list,
    );
    if (extra) {
      list.classList.add('stat-list--collapsed');
      const more = h('button', { type: 'button', class: 'btn stat-group__more', 'aria-expanded': 'false', 'aria-controls': `stats-${fam.id}` }, `Show ${extra} more ${fam.label.toLowerCase()} measures`);
      more.addEventListener('click', () => {
        const open = list.classList.toggle('stat-list--collapsed') === false;
        more.setAttribute('aria-expanded', String(open));
        more.textContent = open ? `Show fewer ${fam.label.toLowerCase()} measures` : `Show ${extra} more ${fam.label.toLowerCase()} measures`;
      });
      group.append(more);
    }
    host.append(group);
  }
}

/* ---- What stands out ------------------------------------------------------------------- */

/**
 * A sentence is shown only if every claimed number appears in it as the atlas would print
 * it. This guards against a template rounding a published value (e.g. 3.5 judgeships).
 */
export function sentenceIsSupported(s: { text: string; claims: ProfileClaim[] }, byId: Map<string, Variable>): boolean {
  if (!s.claims.length) return false;
  return s.claims.every((c) => {
    const v = byId.get(c.variable);
    if (!v || typeof c.value !== 'number') return false;
    return s.text.includes(fmtNumberOnly(c.value, v));
  });
}

function claimLine(c: ProfileClaim, v: Variable | undefined): string {
  const parts = [v?.label ?? c.variable, periodLabel(c.year, v?.period_type)];
  if (c.rank && c.ranked_of) parts.push(`rank ${c.rank} of ${c.ranked_of}${c.scope === 'circuit' && c.circuit_of ? `; ${c.position === 1 ? 'extreme' : 'position ' + c.position} of ${c.circuit_of} in its circuit` : ''}`);
  return parts.join(', ');
}

function sentenceBlock(s: ProfileSentence | { text: string; claims: ProfileClaim[] }, byId: Map<string, Variable>, goTo: (variable: string) => void): HTMLElement {
  const ids = [...new Set(s.claims.flatMap((c) => c.source_ids))];
  const derived = s.claims.some((c) => c.derived);
  const formula = s.claims.find((c) => c.derived && c.formula)?.formula ?? null;
  const first = s.claims[0];
  const v = first ? byId.get(first.variable) : undefined;
  return h(
    'li',
    { class: 'standout__item' },
    h('p', { class: 'standout__text' }, s.text),
    h(
      'div',
      { class: 'standout__meta' },
      sourceChip({ sourceIds: ids, derived, formula, compact: true }),
      first
        ? h(
            'a',
            {
              class: 'standout__link',
              href: `#/district/${encodeURIComponent('')}`,
              onclick: ((e: Event) => {
                e.preventDefault();
                goTo(first.variable);
              }) as EventListener,
              title: claimLine(first, v),
            },
            'See the measure',
          )
        : null,
    ),
  );
}

export function renderStandout(host: HTMLElement, profile: DistrictProfile, variables: Variable[], goTo: (variable: string) => void, districtId: string): void {
  const byId = new Map(variables.map((v) => [v.id, v]));
  const shown = profile.distinctive.sentences.filter((s) => sentenceIsSupported(s, byId));
  if (shown.length) {
    const list = h('ol', { class: 'standout__list' }, ...shown.map((s) => sentenceBlock(s, byId, goTo)));
    list.querySelectorAll<HTMLAnchorElement>('.standout__link').forEach((a) => (a.href = `#/district/${districtId}?s=stats`));
    host.append(list);
  } else {
    host.append(
      h(
        'p',
        { class: 'standout__none' },
        'No measure puts this district among the three highest or lowest in the country, or at the top or bottom of its circuit, in the latest year. The key statistics below show where it stands on each one.',
      ),
    );
  }
  host.append(
    h(
      'details',
      { class: 'standout__method' },
      h('summary', null, 'How this is written'),
      h('p', null, profile.distinctive.method),
      h('p', null, 'Each sentence is checked against the published values before it is shown. A sentence whose numbers do not match is left out.'),
    ),
  );
}
