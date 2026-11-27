// "The bench over time": every Article III judge who served on the court, from the
// FJC Biographical Directory (public/data/judges/<id>.json). One row per service
// record, a bar from start of service to senior status (party color), a lighter band
// for senior service, typographic initials (never photos). The party shown is the
// appointing president's, as the FJC records it. No judge-level statistics.

import { h, uniqueId } from '../../lib/dom.ts';
import { Tooltip } from '../../components/tooltip.ts';
import { DataTable } from '../../components/data-table.ts';
import { sourceChip } from '../../components/source-chip.ts';
import { term } from '../../components/glossary.ts';
import { emptyState } from '../../components/states.ts';
import type { DistrictJudgesFile, Judge } from '../../data/types.ts';
import { longDate, viewToggle, yearFrac } from './common.ts';

type Party = 'd' | 'r' | 'o';
type Filter = 'recent' | 'current' | 'all';

interface BenchRow {
  j: Judge;
  key: string;
  start: number;
  startIso: string;
  seniorStart: number | null;
  seniorIso: string | null;
  end: number;
  ongoing: boolean;
  party: Party;
}

const PARTY_LETTER: Record<Party, string> = { d: 'D', r: 'R', o: 'O' };
const PARTY_LEGEND: Record<Party, string> = {
  d: 'Appointed by a Democratic president',
  r: 'Appointed by a Republican president',
  o: 'Other party (Federalist, Jeffersonian Republican, Whig) or none recorded',
};
const RECENT_FROM = 1980;

function partyOf(j: Judge): Party {
  const p = j.party_of_appointing_president ?? '';
  return p === 'Democratic' ? 'd' : p === 'Republican' ? 'r' : 'o';
}

function lastName(j: Judge): string {
  const s = j.sort_name ?? j.name;
  return s.includes(',') ? s.split(',')[0]!.trim() : s.split(' ').slice(-1)[0]!;
}

function initials(j: Judge): string {
  if (j.initials) return j.initials;
  const parts = j.name.replace(/,.*$/, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function toRows(judges: Judge[], asOf: number): BenchRow[] {
  const out: BenchRow[] = [];
  judges.forEach((j, i) => {
    const startIso = j.service_start_date ?? j.commission_date ?? j.recess_appointment_date ?? null;
    if (!startIso) return;
    const start = yearFrac(startIso);
    const ongoing = !j.service_end_date;
    const end = Math.max(start, ongoing ? asOf : yearFrac(j.service_end_date!));
    const seniorIso = j.effective_senior_status_date ?? j.senior_status_date ?? null;
    const seniorStart = seniorIso ? Math.min(Math.max(yearFrac(seniorIso), start), end) : null;
    out.push({ j, key: String(j.id ?? `${j.name}-${i}`), start, startIso, seniorStart, seniorIso, end, ongoing, party: partyOf(j) });
  });
  return out.sort((a, b) => a.start - b.start || a.j.name.localeCompare(b.j.name));
}

function appointedText(j: Judge): string {
  const party = j.party_of_appointing_president;
  if (j.reassignment) {
    const who = j.president_of_record ?? 'a president';
    return `Reassigned to this court by statute. Earlier appointed by ${who}${party ? ` (${party})` : ''}.`;
  }
  const pres = j.appointing_president ?? 'Not recorded';
  return `Appointed by ${pres}${party ? ` (${party})` : ''}${j.appointment_kind === 'recess_appointment' ? ', first as a recess appointment' : ''}.`;
}

function detailLines(r: BenchRow): string[] {
  const j = r.j;
  const lines = [appointedText(j)];
  if (j.commission_date) lines.push(`Commissioned ${longDate(j.commission_date)}.`);
  if (j.recess_appointment_date) lines.push(`Recess appointment ${longDate(j.recess_appointment_date)}.`);
  if (r.seniorIso) lines.push(`Senior status ${longDate(r.seniorIso)}.`);
  if (j.service_end_date) lines.push(`Service ended ${longDate(j.service_end_date)}${j.termination_reason ? ` (${j.termination_reason.toLowerCase()})` : ''}.`);
  else lines.push(r.seniorIso ? 'Serving in senior status.' : 'In active service.');
  return lines;
}

function tickStep(span: number): number {
  if (span <= 60) return 10;
  if (span <= 120) return 20;
  return 50;
}

export interface BenchOptions {
  file: DistrictJudgesFile;
  /** ISO date the FJC file was retrieved; the right edge of the chart. */
  asOfIso: string;
  districtName: string;
}

export function renderBench(host: HTMLElement, o: BenchOptions): () => void {
  const asOf = yearFrac(o.asOfIso);
  const all = toRows(o.file.judges, asOf);
  if (!all.length) {
    host.append(
      emptyState({
        title: 'No Article III judges to show',
        body: 'Judges of the territorial district courts serve fixed terms under Article IV. They are not in the FJC directory of Article III judges that this timeline uses, so none are listed here.',
        icon: 'data',
        compact: true,
      }),
    );
    return () => {};
  }
  let filter: Filter = all.some((r) => r.end >= RECENT_FROM) ? 'recent' : 'all';

  const legendId = uniqueId('bench-legend');
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Which judges to show' });
  const FILTERS: Array<[Filter, string]> = [
    ['recent', `Since ${RECENT_FROM}`],
    ['current', 'Current bench'],
    ['all', 'All years'],
  ];
  const segBtns = FILTERS.map(([f, label]) => {
    const b = h('button', { type: 'button', class: 'seg__btn', 'aria-pressed': String(f === filter), 'data-filter': f }, label);
    b.addEventListener('click', () => {
      filter = f;
      segBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.filter === f)));
      draw();
    });
    seg.append(b);
    return b;
  });

  const legend = h('ul', { class: 'bench-legend', id: legendId, 'aria-label': 'Legend' });
  const chart = h('div', { class: 'bench__chart' });
  const tip = new Tooltip(chart, 'bench-tip');
  const tableSlot = h('div', { class: 'bench__table', hidden: true });
  const toggle = viewToggle((t) => {
    chart.hidden = t;
    legend.hidden = t;
    tableSlot.hidden = !t;
    tip.hide();
  });

  const table = new DataTable<BenchRow>({
    caption: `Article III judges of the ${o.districtName}`,
    rowKey: (r) => r.key,
    rowHeader: 'name',
    sortKey: 'start',
    sortDir: 'asc',
    rows: [],
    columns: [
      { key: 'name', label: 'Judge', value: (r) => r.j.sort_name ?? r.j.name, render: (r) => r.j.name },
      { key: 'president', label: 'Appointing president', value: (r) => (r.j.reassignment ? r.j.president_of_record : r.j.appointing_president) ?? '', render: (r) => (r.j.reassignment ? `${r.j.president_of_record ?? 'Not recorded'} (reassigned by statute)` : (r.j.appointing_president ?? 'Not recorded')) },
      { key: 'party', label: 'Party', value: (r) => r.j.party_of_appointing_president ?? '', render: (r) => r.j.party_of_appointing_president ?? 'Not recorded' },
      { key: 'start', label: 'Commissioned', value: (r) => r.j.commission_date ?? r.startIso, render: (r) => longDate(r.j.commission_date ?? r.startIso) },
      { key: 'senior', label: 'Senior status', value: (r) => r.seniorIso, render: (r) => (r.seniorIso ? longDate(r.seniorIso) : '') },
      { key: 'end', label: 'Service ended', value: (r) => r.j.service_end_date ?? '9999', render: (r) => (r.j.service_end_date ? longDate(r.j.service_end_date) : 'Serving') },
      { key: 'reason', label: 'Reason', value: (r) => r.j.termination_reason ?? '', render: (r) => r.j.termination_reason ?? '', optional: true },
    ],
    footnote: 'Source: Federal Judicial Center, Biographical Directory of Article III Federal Judges. Party is that of the appointing president as the FJC records it.',
  });
  tableSlot.append(table.el);

  host.append(
    h('div', { class: 'bench__controls' }, seg, toggle),
    legend,
    chart,
    tableSlot,
    status,
    h(
      'p',
      { class: 'bench__note' },
      'Bars run from the start of service to ',
      term('senior-status', 'senior status'),
      ' (fainter band) and the end of service. Colors and letters show the party of the appointing president as the FJC records it; they say nothing about how a judge decides cases. Initials stand in for photographs.',
    ),
    h('div', { class: 'bench__source' }, sourceChip({ sourceIds: o.file.source_ids, compact: true }), h('span', { class: 'bench__asof' }, `Records as of ${longDate(o.asOfIso)}.`)),
  );

  const onLeave = () => tip.hide();
  chart.addEventListener('pointerleave', onLeave);

  function showTip(r: BenchRow, x: number, y: number): void {
    const lines = detailLines(r);
    tip.show(
      h(
        'div',
        { class: 'bench-tip__body' },
        h('p', { class: 'bench-tip__name' }, h('span', { class: `party-tag party-tag--${r.party}` }, PARTY_LETTER[r.party]), ' ', r.j.name),
        ...lines.map((l) => h('p', { class: 'bench-tip__line' }, l)),
      ),
      x,
      y,
    );
  }

  function draw(): void {
    tip.hide();
    const rows =
      filter === 'current' ? all.filter((r) => r.ongoing) : filter === 'recent' ? all.filter((r) => r.end >= RECENT_FROM) : all;
    status.textContent =
      filter === 'current' ? 'Showing judges now in service.' : filter === 'recent' ? `Showing judges in service at any time since ${RECENT_FROM}.` : 'Showing every judge in the court’s history.';
    table.setRows(rows);

    // Legend: only the parties present, plus the senior band.
    const parties = (['d', 'r', 'o'] as Party[]).filter((p) => rows.some((r) => r.party === p));
    legend.replaceChildren(
      ...parties.map((p) => h('li', null, h('span', { class: `party-swatch party-swatch--${p}`, 'aria-hidden': 'true' }), h('span', { class: `party-tag party-tag--${p}`, 'aria-hidden': 'true' }, PARTY_LETTER[p]), PARTY_LEGEND[p])),
      h('li', null, h('span', { class: 'party-swatch party-swatch--senior', 'aria-hidden': 'true' }, ...parties.map((p) => h('span', { class: `party-swatch__half party-swatch--${p}` }))), 'Senior status (fainter band)'),
    );

    if (!rows.length) {
      chart.replaceChildren(h('p', { class: 'bench__empty' }, 'No judge in this view.'), tip.el);
      return;
    }
    const minStart = Math.min(...rows.map((r) => r.start));
    const step = tickStep(asOf - minStart);
    const x0 = Math.floor(minStart / 10) * 10;
    const x1 = asOf;
    const pct = (t: number) => ((t - x0) / (x1 - x0)) * 100;
    const ticks: number[] = [];
    for (let t = Math.ceil(x0 / step) * step; t <= x1; t += step) ticks.push(t);

    const axis = h(
      'div',
      { class: 'bench__axis', 'aria-hidden': 'true' },
      h('span', { class: 'bench__who bench__who--axis' }),
      h('span', { class: 'bench__track' }, ...ticks.map((t) => h('span', { class: 'bench__tick', style: `left:${pct(t).toFixed(2)}%` }, String(t)))),
    );
    const grid = h(
      'div',
      { class: 'bench__grid', 'aria-hidden': 'true' },
      ...ticks.map((t) => h('span', { class: 'bench__gridline', style: `left:${pct(t).toFixed(2)}%` })),
    );
    const list = h('ol', { class: 'bench__rows', 'aria-describedby': legendId, 'aria-label': 'Judges, oldest first. Use the up and down arrow keys to move between them.' });
    for (const r of rows) {
      const descId = uniqueId('judge');
      const activeEnd = r.seniorStart ?? r.end;
      const left = pct(r.start);
      const wActive = Math.max(0.35, pct(activeEnd) - left);
      const bars = h('span', { class: 'bench__track' });
      if (activeEnd > r.start || r.seniorStart === null) {
        bars.append(h('span', { class: `bench__bar bench__bar--${r.party}${r.ongoing && r.seniorStart === null ? ' is-ongoing' : ''}`, style: `left:${left.toFixed(2)}%;width:${wActive.toFixed(2)}%` }));
      }
      if (r.seniorStart !== null && r.end > r.seniorStart) {
        const sl = pct(r.seniorStart);
        bars.append(h('span', { class: `bench__bar bench__bar--senior bench__bar--${r.party}${r.ongoing ? ' is-ongoing' : ''}${activeEnd > r.start ? '' : ' is-alone'}`, style: `left:${sl.toFixed(2)}%;width:${Math.max(0.35, pct(r.end) - sl).toFixed(2)}%` }));
      }
      const btn = h(
        'button',
        { type: 'button', class: 'bench__who', 'aria-describedby': descId },
        h('span', { class: `avatar avatar--${r.party}`, 'aria-hidden': 'true' }, initials(r.j)),
        h('span', { class: 'bench__name', title: r.j.name }, h('span', { class: 'bench__name-full' }, r.j.name), h('span', { class: 'bench__name-short', 'aria-hidden': 'true' }, lastName(r.j))),
        h('span', { class: `party-tag party-tag--${r.party}`, 'aria-hidden': 'true' }, PARTY_LETTER[r.party]),
        h('span', { id: descId, class: 'visually-hidden' }, detailLines(r).join(' ')),
      );
      const li = h('li', { class: 'bench__row', 'data-party': r.party, 'data-ongoing': String(r.ongoing) }, btn, bars);
      const place = (clientX?: number) => {
        const cr = chart.getBoundingClientRect();
        const br = (bars.lastElementChild ?? bars).getBoundingClientRect();
        const lr = li.getBoundingClientRect();
        const x = clientX !== undefined ? clientX - cr.left : br.right - cr.left;
        showTip(r, Math.min(cr.width - 8, Math.max(8, x)), lr.top - cr.top + lr.height / 2);
      };
      li.addEventListener('pointermove', (e) => {
        if ((e as PointerEvent).pointerType === 'touch') return;
        place((e as PointerEvent).clientX);
      });
      btn.addEventListener('focus', () => place());
      btn.addEventListener('blur', () => tip.hide());
      btn.addEventListener('click', () => place());
      list.append(li);
    }
    // Roving tabindex: the list is one tab stop; arrow keys move between judges.
    const btns = [...list.querySelectorAll<HTMLButtonElement>('.bench__who')];
    btns.forEach((b, i) => (b.tabIndex = i === btns.length - 1 ? 0 : -1));
    list.addEventListener('keydown', (e) => {
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      let next = -1;
      if (e.key === 'ArrowDown') next = Math.min(btns.length - 1, i + 1);
      else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = btns.length - 1;
      else if (e.key === 'Escape') tip.hide();
      if (next < 0) return;
      e.preventDefault();
      btns[i]!.tabIndex = -1;
      btns[next]!.tabIndex = 0;
      btns[next]!.focus();
    });
    const axisBottom = axis.cloneNode(true) as HTMLElement;
    axisBottom.classList.add('bench__axis--bottom');
    chart.replaceChildren(axis, h('div', { class: 'bench__plot' }, grid, list), rows.length > 12 ? axisBottom : '', tip.el);
  }

  draw();
  return () => {
    tip.destroy();
    chart.removeEventListener('pointerleave', onLeave);
  };
}
