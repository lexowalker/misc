// Full table for one variable (#/table/:variable): every district, one year at a
// time, with a year picker. The accessible companion to every map.

import '../styles/pages.css';
import { h } from '../lib/dom.ts';
import { formatValue, periodLabel, rankText } from '../lib/format.ts';
import type { PageContext } from '../app/router.ts';
import { replaceQuery } from '../app/router.ts';
import { DISTRICTS, circuitLabel } from '../data/districts.ts';
import { getRank, getValue, loadValues, loadVariables, rankedCount, caveatList } from '../data/loaders.ts';
import { DataTable } from '../components/data-table.ts';
import { dataNotBuilt, emptyState, errorState, noData } from '../components/states.ts';
import { sourceChipForVariable } from '../components/source-chip.ts';
import { pageHead } from './_page.ts';

export function title(ctx: PageContext): string {
  return `Table: ${ctx.params.variable ?? ''}`;
}

export async function render(ctx: PageContext): Promise<void> {
  const id = ctx.params.variable ?? '';
  const page = h('div', { class: 'page table-page' });
  ctx.root.append(page);
  const [vr, values] = await Promise.all([loadVariables(), loadValues(id)]);
  const v = vr.status === 'ok' ? vr.data.find((x) => x.id === id) : undefined;
  if (vr.status === 'ok' && !v) {
    // The catalog is published but has no such measure: say so, rather than "not yet built".
    page.append(
      pageHead({ kicker: 'Data table', title: 'No measure by that name' }),
      emptyState({
        title: `The atlas has no measure called "${id}"`,
        body: 'Every published measure is listed on the map, grouped by family. Each one has its own table.',
        icon: 'map',
        action: h('a', { class: 'btn btn--primary', href: '#/' }, 'Choose a measure on the map'),
      }),
    );
    return;
  }
  page.append(pageHead({ kicker: 'Data table', title: v?.label ?? id, dek: v?.explainer }));
  if (values.status !== 'ok') {
    page.append(values.status === 'missing' ? dataNotBuilt(`values/${id}.json`, 'This table') : errorState(values.error, values.url));
    return;
  }
  const file = values.data;
  if (!file.years.length) {
    page.append(dataNotBuilt(`values/${id}.json`, 'This table'));
    return;
  }
  const y0 = Number(ctx.query.get('y'));
  let year = file.years.includes(y0) ? y0 : file.years[file.years.length - 1]!;
  const select = h('select', { id: 'table-year', class: 'compare-select' }, ...[...file.years].reverse().map((y) => h('option', { value: String(y) }, periodLabel(y, file.period_type))));
  select.value = String(year);
  const slot = h('div');
  page.append(
    h('div', { class: 'table-controls' }, h('label', { for: 'table-year', class: 'caps' }, 'Period'), h('div', { class: 'select-wrap' }, select), v ? sourceChipForVariable(v) : null),
    slot,
  );
  const caveats = caveatList(v);
  if (caveats.length) page.append(h('section', { class: 'table-caveats' }, h('h2', { class: 'caps' }, 'Caveats'), h('ul', null, ...caveats.map((c) => h('li', null, c)))));

  type Row = { id: string; name: string; state: string; circuit: string };
  const draw = () => {
    const of = rankedCount(file, year);
    const t = new DataTable<Row>({
      caption: `${v?.label ?? id}, ${periodLabel(year, file.period_type)}`,
      rowKey: (r) => r.id,
      rowHeader: 'name',
      sortKey: 'value',
      sortDir: 'desc',
      rows: DISTRICTS.map((d) => ({ id: d.id, name: d.name, state: d.stateName, circuit: d.circuit })),
      columns: [
        { key: 'name', label: 'District', value: (r) => r.name, render: (r) => h('a', { href: `#/district/${r.id}` }, r.name) },
        { key: 'state', label: 'State', value: (r) => r.state, optional: true },
        { key: 'circuit', label: 'Circuit', value: (r) => (r.circuit === 'DC' ? 0 : Number(r.circuit)), render: (r) => circuitLabel(r.circuit), optional: true },
        {
          key: 'value',
          label: v?.short_label ?? 'Value',
          numeric: true,
          value: (r) => getValue(file, r.id, year),
          render: (r) => {
            const x = getValue(file, r.id, year);
            return x === null ? noData() : formatValue(x, v);
          },
        },
        ...(file.ranks
          ? [{ key: 'rank', label: 'Rank', numeric: true, value: (r: Row) => getRank(file, r.id, year), render: (r: Row) => rankText(getRank(file, r.id, year), of) ?? '' }]
          : []),
      ],
    });
    slot.replaceChildren(t.el);
  };
  select.addEventListener('change', () => {
    year = Number(select.value);
    replaceQuery({ y: String(year) });
    draw();
  });
  draw();
}
