// ChoroplethView: the reusable map unit every page uses. It composes the AtlasMap,
// the quantile legend, a "View as table" toggle with a sortable table of the same
// data, and the source chip. Pages call setData({variable, values, year}).

import { h, uniqueId } from '../lib/dom.ts';
import { formatValue, periodLabel, periodLabelFor, rankText } from '../lib/format.ts';
import type { ValuesFile, Variable } from '../data/types.ts';
import { DISTRICTS, circuitLabel } from '../data/districts.ts';
import { getRank, getValue, rankedCount, rankTies } from '../data/loaders.ts';
import { cellFlags, flagNodes, flagsText, hasFlags, nameWithFlags } from '../components/cell-flags.ts';
import { renderLegend } from '../components/legend.ts';
import { DataTable, type Column } from '../components/data-table.ts';
import { sourceChipForVariable } from '../components/source-chip.ts';
import { noData } from '../components/states.ts';
import { AtlasMap, type AtlasMapOptions } from './atlas-map.ts';
import { scaleForValues, type QuantileScale } from './scale.ts';

export interface ChoroplethViewOptions extends AtlasMapOptions {
  /** 'all' (default): breaks pooled over every year so colors compare across years. 'year': per-year breaks. */
  scaleScope?: 'year' | 'all';
  tableToggle?: boolean;
  /** Replace the legend footnote (default: how the breaks were pooled). Return undefined for none. */
  legendNote?: (values: ValuesFile, scope: 'year' | 'all') => string | undefined;
  /** 'full' (default): variable label and period above the legend. 'year': the period only. */
  legendHead?: 'full' | 'year';
  /** Header of the table's rank column (default "Rank"). */
  rankLabel?: string;
}

interface Row {
  id: string;
  name: string;
  state: string;
  circuit: string;
  value: number | null;
  rank: number | null;
}

export class ChoroplethView {
  readonly el: HTMLElement;
  readonly map: AtlasMap;
  private o: ChoroplethViewOptions;
  private legendSlot: HTMLDivElement;
  /** Slot directly under the map for page controls such as the year slider. */
  readonly afterMap: HTMLDivElement;
  private footSlot: HTMLDivElement;
  private tableSlot: HTMLDivElement;
  private toggle: HTMLButtonElement;
  private table: DataTable<Row> | null = null;
  private variable: Variable | null = null;
  private values: ValuesFile | null = null;
  private year: number | null = null;
  private scale: QuantileScale | null = null;

  constructor(container: HTMLElement, o: ChoroplethViewOptions = {}) {
    this.o = o;
    const tableId = uniqueId('map-table');
    this.legendSlot = h('div', { class: 'choropleth__legend' });
    const mapSlot = h('div', { class: 'choropleth__map' });
    this.afterMap = h('div', { class: 'choropleth__after-map' });
    this.toggle = h(
      'button',
      { type: 'button', class: 'btn btn--quiet choropleth__toggle', 'aria-expanded': 'false', 'aria-controls': tableId },
      h('span', { class: 'choropleth__toggle-icon', 'aria-hidden': 'true' }),
      h('span', { class: 'choropleth__toggle-text' }, 'View as table'),
    );
    this.toggle.addEventListener('click', () => this.setTableOpen(this.toggle.getAttribute('aria-expanded') !== 'true'));
    this.footSlot = h('div', { class: 'choropleth__source' });
    this.tableSlot = h('div', { class: 'choropleth__table', id: tableId, hidden: true });
    this.el = h(
      'section',
      { class: 'choropleth', 'aria-label': 'Map and data' },
      this.legendSlot,
      mapSlot,
      this.afterMap,
      h('div', { class: 'choropleth__foot' }, o.tableToggle === false ? null : this.toggle, this.footSlot),
      this.tableSlot,
    );
    container.append(this.el);
    this.map = new AtlasMap(mapSlot, o);
    this.render();
  }

  setData(d: { variable: Variable | null; values: ValuesFile | null; year?: number | null }): void {
    this.variable = d.variable;
    this.values = d.values;
    this.year = d.year ?? (d.values?.years.length ? d.values.years[d.values.years.length - 1]! : null);
    this.scale = this.values ? scaleForValues(this.values, this.o.scaleScope ?? 'all', this.year) : null;
    this.map.setData({ variable: this.variable, values: this.values, year: this.year, scale: this.scale });
    this.render();
  }

  setYear(year: number): void {
    if (year === this.year) return;
    this.year = year;
    if ((this.o.scaleScope ?? 'all') === 'year' && this.values) this.scale = scaleForValues(this.values, 'year', year);
    this.map.setData({ year, scale: this.scale });
    this.renderLegend();
    this.renderTable();
  }

  getScale(): QuantileScale | null {
    return this.scale;
  }

  setTableOpen(open: boolean): void {
    this.toggle.setAttribute('aria-expanded', String(open));
    this.toggle.querySelector('.choropleth__toggle-text')!.textContent = open ? 'Hide table' : 'View as table';
    this.tableSlot.hidden = !open;
    if (open) this.renderTable();
  }

  private render(): void {
    this.renderLegend();
    this.footSlot.replaceChildren(this.variable ? sourceChipForVariable(this.variable) : '');
    if (!this.tableSlot.hidden) this.renderTable();
  }

  private renderLegend(): void {
    if (!this.variable || !this.values) {
      this.legendSlot.replaceChildren();
      this.legendSlot.hidden = true;
      return;
    }
    this.legendSlot.hidden = false;
    const scope = this.o.scaleScope ?? 'all';
    const years = this.values.years;
    const note = this.o.legendNote
      ? this.o.legendNote(this.values, scope)
      : scope === 'all' && years.length > 1
        ? `Quantile breaks pooled over ${periodLabel(years[0]!, this.values.period_type)}–${periodLabel(years[years.length - 1]!, this.values.period_type)}, so colors compare across years.`
        : undefined;
    this.legendSlot.replaceChildren(
      h(
        'div',
        { class: 'choropleth__legend-head' },
        this.o.legendHead === 'year' ? null : h('span', { class: 'choropleth__legend-title' }, this.variable.label),
        this.year !== null ? h('span', { class: 'choropleth__legend-year num' }, periodLabelFor(this.variable, this.year, this.values.period_type)) : null,
      ),
      renderLegend({ scale: this.scale, variable: this.variable, onHighlight: (i) => this.map.highlightStep(i), note }),
    );
  }

  private rows(): Row[] {
    return DISTRICTS.map((d) => ({
      id: d.id,
      name: d.name,
      state: d.stateName,
      circuit: d.circuit,
      value: getValue(this.values, d.id, this.year),
      rank: getRank(this.values, d.id, this.year),
    }));
  }

  private renderTable(): void {
    if (this.tableSlot.hidden) return;
    const v = this.variable;
    const of = rankedCount(this.values, this.year);
    // Cell flags, as on the tooltip: derived cells and cell notes (data audit 2026-11-27). On phones they sit
    // under the district name instead of in a Notes column (see cell-flags.ts).
    const file = this.values;
    const year = this.year;
    const flags = (id: string) => (v ? cellFlags(file, id, year) : { derived: false, note: null });
    const cols: Column<Row>[] = [
      {
        key: 'name',
        label: 'District',
        value: (r) => r.name,
        render: (r) => nameWithFlags(h('a', { href: `#/district/${r.id}` }, r.name), flags(r.id)),
      },
      { key: 'state', label: 'State', value: (r) => r.state, optional: true },
      { key: 'circuit', label: 'Circuit', value: (r) => (r.circuit === 'DC' ? 0 : Number(r.circuit)), render: (r) => circuitLabel(r.circuit), optional: true },
    ];
    if (v && this.values) {
      cols.push({
        key: 'value',
        label: v.short_label ?? v.label,
        numeric: true,
        value: (r) => r.value,
        render: (r) => (r.value === null ? noData() : formatValue(r.value, v)),
      });
      if (this.values.ranks) {
        cols.push({ key: 'rank', label: this.o.rankLabel ?? 'Rank', numeric: true, value: (r) => r.rank, render: (r) => (r.value === null ? '' : rankText(r.rank, of, rankTies(this.values, this.year, r.rank)) ?? '') });
      }
      if (DISTRICTS.some((d) => hasFlags(flags(d.id)))) {
        cols.push({
          key: 'notes',
          label: 'Notes',
          optional: true,
          value: (r) => flagsText(flags(r.id)),
          render: (r) => {
            const parts = flagNodes(flags(r.id));
            return parts.length ? h('span', null, ...parts) : '';
          },
        });
      }
    }
    const caption = v && this.values && this.year !== null ? `${v.label}, ${periodLabelFor(v, this.year, this.values.period_type)}, by district` : 'The 94 federal judicial districts';
    if (this.table) {
      this.table.el.remove();
    }
    this.table = new DataTable<Row>({
      caption,
      columns: cols,
      rows: this.rows(),
      rowKey: (r) => r.id,
      rowHeader: 'name',
      sortKey: v ? 'value' : 'name',
      sortDir: v ? 'desc' : 'asc',
    });
    this.tableSlot.replaceChildren(this.table.el);
  }

  destroy(): void {
    this.map.destroy();
    this.el.remove();
  }
}
