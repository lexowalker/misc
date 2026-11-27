// Cell flags for the table views (the #/table page and the map's "View as table"): a Derived tag and the
// cell's note, as the map tooltip shows them (data audit 2026-11-27).
//
// Wide screens get a separate Notes column. On phones that column is hidden (it is marked optional) and the
// same flags are shown under the district name instead, because a fourth column of one-word-wide text does not
// fit at 375 px (recheck lane, 2026-11-27). Only one of the two copies is ever displayed, so assistive
// technology meets each flag once.

import { h } from '../lib/dom.ts';
import { getCellNote, getValue, isDerivedCell } from '../data/loaders.ts';
import type { ValuesFile } from '../data/types.ts';

export interface CellFlags {
  derived: boolean;
  note: string | null;
}

export function cellFlags(file: ValuesFile | null | undefined, id: string, year: number | null | undefined): CellFlags {
  if (!file || getValue(file, id, year) === null) return { derived: false, note: null };
  return { derived: isDerivedCell(file, id, year), note: getCellNote(file, id, year) };
}

export function hasFlags(f: CellFlags): boolean {
  return f.derived || !!f.note;
}

export function flagsText(f: CellFlags): string {
  return [f.derived ? 'Derived' : '', f.note ?? ''].filter(Boolean).join(' ');
}

export function flagNodes(f: CellFlags): Array<Node | string> {
  const parts: Array<Node | string> = [];
  if (f.derived) parts.push(h('span', { class: 'source-chip source-chip--derived' }, h('span', { class: 'source-chip__label' }, 'Derived')));
  if (f.note) parts.push(h('span', { class: 'table-note' }, `${parts.length ? ' ' : ''}${f.note}`));
  return parts;
}

/** The district link, with the cell's flags beneath it on phones (hidden on wider screens by CSS). */
export function nameWithFlags(link: HTMLElement, f: CellFlags): Node {
  if (!hasFlags(f)) return link;
  return h('span', null, link, h('span', { class: 'table-flags-inline' }, ...flagNodes(f)));
}
