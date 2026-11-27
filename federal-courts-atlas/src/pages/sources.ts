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
  type Row = SourceRecord & { id: string; lane?: string };
  const rows: Row[] = Object.entries(r.data).map(([id, s]) => ({ id, ...s }));
  // One section per kind of data, so the reader can find a family without scrolling 900 rows.
  // The keys are the pipeline's source groups; the labels are written for readers.
  const GROUPS: Array<{ key: string; label: string; note: string }> = [
    { key: 'fcms', label: 'Court caseload statistics', note: 'Federal Court Management Statistics from the Administrative Office of the U.S. Courts: one district profile file per year.' },
    { key: 'idb', label: 'Case-level court records', note: 'The Federal Judicial Center Integrated Database of civil cases and criminal defendants.' },
    { key: 'ussc', label: 'Sentencing', note: 'U.S. Sentencing Commission individual offender datafiles and statistical information packets, several files per year.' },
    { key: 'judges', label: 'Judges', note: 'The Federal Judicial Center Biographical Directory of Article III judges.' },
    { key: 'population', label: 'Population', note: 'Census Bureau county population counts and yearly estimates.' },
    { key: 'boundaries', label: 'District boundaries', note: 'The statutes that define each district, from the Office of the Law Revision Counsel.' },
    { key: 'courthouses', label: 'Courthouses and places', note: 'Court locations and the Census map files used to place them.' },
    { key: 'cases', label: 'Recent cases', note: 'CourtListener search results, one file per district.' },
    { key: 'web', label: 'Series built from the files above', note: 'Records that describe a multi-year series assembled from the yearly files listed in the other groups.' },
  ];
  const known = new Set(GROUPS.map((g) => g.key));
  const groups = [...GROUPS, { key: '', label: 'Other sources', note: '' }]
    .map((g) => ({ ...g, rows: rows.filter((row) => (g.key ? row.lane === g.key : !known.has(row.lane ?? ''))) }))
    .filter((g) => g.rows.length);
  const columns = [
    { key: 'dataset', label: 'Dataset', value: (row: Row) => row.dataset, render: (row: Row) => (row.url ? h('a', { href: row.url, target: '_blank', rel: 'noopener' }, row.dataset) : row.dataset) },
    { key: 'publisher', label: 'Publisher', value: (row: Row) => row.publisher ?? '', optional: true },
    { key: 'vintage', label: 'Vintage', value: (row: Row) => row.vintage ?? '' },
    { key: 'retrieved', label: 'Retrieved', value: (row: Row) => row.retrieved_at ?? '', render: (row: Row) => formatDate(row.retrieved_at), optional: true },
  ];
  listSlot.append(
    h('p', { class: 'src-groups__lead' }, `${rows.length.toLocaleString('en-US')} source files in ${groups.length} groups. Open a group to see its files.`),
    ...groups.map((g) => {
      const table = new DataTable<Row>({
        caption: `${g.label}: ${g.rows.length} source ${g.rows.length === 1 ? 'file' : 'files'}`,
        rowKey: (row) => row.id,
        rowHeader: 'dataset',
        sortKey: 'vintage',
        columns,
        rows: g.rows,
      });
      return h(
        'details',
        { class: 'src-group', open: g.rows.length <= 30 ? '' : null },
        h(
          'summary',
          { class: 'src-group__summary' },
          h('span', { class: 'src-group__label' }, g.label),
          h('span', { class: 'src-group__count' }, `${g.rows.length.toLocaleString('en-US')} ${g.rows.length === 1 ? 'file' : 'files'}`),
        ),
        g.note ? h('p', { class: 'src-group__note' }, g.note) : null,
        table.el,
      );
    }),
  );
}
