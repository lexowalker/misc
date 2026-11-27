// Accessible sortable table. Header buttons toggle sort; aria-sort reflects state.
// Used for "View as table" on every map and for #/table/:variable.

import { h } from '../lib/dom.ts';

export interface Column<R> {
  key: string;
  label: string;
  /** Value used for sorting (numbers sort numerically; null/undefined always last). */
  value: (row: R) => string | number | null | undefined;
  /** Cell content (defaults to the value). */
  render?: (row: R) => Node | string;
  numeric?: boolean;
  /** Hide below this breakpoint on small screens. */
  optional?: boolean;
  width?: string;
}

export interface DataTableOptions<R> {
  caption: string;
  columns: Column<R>[];
  rows: R[];
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  rowKey: (row: R) => string;
  /** Optional row header column key (announced as the row's name). */
  rowHeader?: string;
  footnote?: string | Node;
  className?: string;
}

export class DataTable<R> {
  readonly el: HTMLDivElement;
  private o: DataTableOptions<R>;
  private sortKey: string;
  private sortDir: 'asc' | 'desc';
  private tbody: HTMLTableSectionElement;
  private headers = new Map<string, HTMLTableCellElement>();
  private status: HTMLParagraphElement;

  constructor(o: DataTableOptions<R>) {
    this.o = o;
    this.sortKey = o.sortKey ?? o.columns[0]!.key;
    this.sortDir = o.sortDir ?? 'asc';
    const table = h('table', { class: 'data-table' });
    // The visible title sits outside the horizontal scroll region so it never clips on phones;
    // the <caption> stays for assistive technology.
    table.append(h('caption', { class: 'visually-hidden' }, o.caption));
    const tr = h('tr');
    for (const c of o.columns) {
      const btn = h(
        'button',
        { type: 'button', class: 'data-table__sort' },
        h('span', null, c.label),
        h('span', { class: 'data-table__arrow', 'aria-hidden': 'true' }),
      );
      btn.addEventListener('click', () => this.sortBy(c.key));
      const th = h('th', { scope: 'col', class: `${c.numeric ? 'is-num' : ''} ${c.optional ? 'is-optional' : ''}`.trim(), style: c.width ? `width:${c.width}` : null }, btn);
      this.headers.set(c.key, th);
      tr.append(th);
    }
    table.append(h('thead', null, tr));
    this.tbody = h('tbody');
    table.append(this.tbody);
    this.status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
    this.el = h(
      'div',
      { class: `data-table-wrap ${o.className ?? ''}`.trim() },
      h('p', { class: 'data-table__caption', 'aria-hidden': 'true' }, o.caption),
      h('div', { class: 'data-table-scroll', tabindex: '0', role: 'region', 'aria-label': o.caption }, table),
      o.footnote ? h('p', { class: 'data-table__foot' }, o.footnote) : null,
      this.status,
    );
    this.render();
  }

  setRows(rows: R[]): void {
    this.o.rows = rows;
    this.render();
  }

  sortBy(key: string): void {
    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else {
      this.sortKey = key;
      this.sortDir = this.o.columns.find((c) => c.key === key)?.numeric ? 'desc' : 'asc';
    }
    this.render();
    const col = this.o.columns.find((c) => c.key === key);
    this.status.textContent = `Sorted by ${col?.label ?? key}, ${this.sortDir === 'asc' ? 'ascending' : 'descending'}`;
  }

  private render(): void {
    const col = this.o.columns.find((c) => c.key === this.sortKey) ?? this.o.columns[0]!;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const rows = [...this.o.rows].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      const na = va === null || va === undefined || (typeof va === 'number' && !Number.isFinite(va));
      const nb = vb === null || vb === undefined || (typeof vb === 'number' && !Number.isFinite(vb));
      if (na && nb) return 0;
      if (na) return 1;
      if (nb) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'en', { numeric: true }) * dir;
    });
    for (const [key, th] of this.headers) {
      th.setAttribute('aria-sort', key === this.sortKey ? (this.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    }
    const frag = document.createDocumentFragment();
    for (const r of rows) {
      const tr = h('tr', { 'data-key': this.o.rowKey(r) });
      for (const c of this.o.columns) {
        const content = c.render ? c.render(r) : String(c.value(r) ?? '');
        const cls = `${c.numeric ? 'is-num' : ''} ${c.optional ? 'is-optional' : ''}`.trim() || null;
        const cell = c.key === this.o.rowHeader ? h('th', { scope: 'row', class: cls }, content) : h('td', { class: cls }, content);
        tr.append(cell);
      }
      frag.append(tr);
    }
    this.tbody.replaceChildren(frag);
  }
}
