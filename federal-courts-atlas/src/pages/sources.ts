// Sources and methodology (#/sources). Lists the merged source manifest
// (public/data/sources.json) and states the atlas's rules for data.

import '../styles/pages.css';
import { h } from '../lib/dom.ts';
import { formatDate } from '../lib/format.ts';
import type { PageContext } from '../app/router.ts';
import { loadSources } from '../data/loaders.ts';
import { DataTable } from '../components/data-table.ts';
import { dataNotBuilt, errorState } from '../components/states.ts';
import { rich } from '../components/glossary.ts';
import { pageHead } from './_page.ts';
import type { SourceRecord } from '../data/types.ts';

export const title = 'Sources and methodology';

export async function render(ctx: PageContext): Promise<void> {
  const page = h('div', { class: 'page sources-page' });
  const listSlot = h('div', { class: 'sources-list' });
  const method = h(
    'section',
    { class: 'methodology prose', id: 'methodology', 'aria-labelledby': 'method-h' },
    h('h2', { id: 'method-h' }, 'Methodology'),
    h('h3', null, 'Real data only'),
    h('p', null, 'Every number in the atlas comes from a public file that was downloaded, checksummed and recorded with its publisher, dataset name, vintage and retrieval date. Nothing is estimated, interpolated or filled in. Where a value could not be sourced, the atlas shows “No data” and the gap is logged.'),
    h('h3', null, 'Derived values are labeled'),
    h('p', null, 'Some figures are computed from published ones: rates per resident, shares computed from counts, ranks and changes over time. These are marked “Derived,” and the formula is shown wherever the number appears.'),
    h('h3', null, 'Districts, not judges'),
    h('p', null, 'Statistics are reported for districts. Judges appear only with public biographical facts from the Federal Judicial Center, such as appointing president and dates of service. The atlas reports patterns and does not attribute motives to any court or judge.'),
    h('h3', null, 'Boundaries'),
    h('p', null, rich('District boundaries are assembled from the county lists in 28 U.S.C. §§ 81–131 and Census county geometry, with each county assigned to exactly one [[district]]. Alaska, Hawaii, Puerto Rico, the U.S. Virgin Islands, Guam and the Northern Mariana Islands are shown in insets; the Northwestern Hawaiian Islands fall outside the Hawaii inset. American Samoa has no federal district court and is not shown.')),
    h('h3', null, 'Maps'),
    h('p', null, 'Choropleth maps divide districts into five groups with equal numbers of districts (quantiles), from lowest to highest. Unless noted, the group boundaries are computed across all years shown, so the same color means the same range of values in every year.'),
  );
  page.append(
    pageHead({ kicker: 'Sources', title: 'Sources and methodology', dek: 'Where every number comes from, and the rules the atlas follows.' }),
    h('section', { class: 'sources-section', 'aria-labelledby': 'src-h' }, h('h2', { id: 'src-h', class: 'section-title' }, 'Data sources'), listSlot),
    method,
  );
  ctx.root.append(page);

  if (ctx.query.get('section') === 'methodology') requestAnimationFrame(() => method.scrollIntoView());

  const r = await loadSources();
  if (r.status === 'missing') {
    listSlot.append(dataNotBuilt('sources.json', 'The list of sources'));
    return;
  }
  if (r.status === 'error') {
    listSlot.append(errorState(r.error, r.url));
    return;
  }
  type Row = SourceRecord & { id: string };
  const rows: Row[] = Object.entries(r.data).map(([id, s]) => ({ id, ...s }));
  const table = new DataTable<Row>({
    caption: `${rows.length} source files`,
    rowKey: (row) => row.id,
    rowHeader: 'dataset',
    sortKey: 'publisher',
    columns: [
      { key: 'dataset', label: 'Dataset', value: (row) => row.dataset, render: (row) => (row.url ? h('a', { href: row.url, target: '_blank', rel: 'noopener' }, row.dataset) : row.dataset) },
      { key: 'publisher', label: 'Publisher', value: (row) => row.publisher ?? '', optional: true },
      { key: 'vintage', label: 'Vintage', value: (row) => row.vintage ?? '' },
      { key: 'retrieved', label: 'Retrieved', value: (row) => row.retrieved_at ?? '', render: (row) => formatDate(row.retrieved_at), optional: true },
    ],
    rows,
  });
  listSlot.append(table.el);
}
