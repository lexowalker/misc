// Recent cases from CourtListener (public/data/cases/<id>.json): metadata only, with
// links to the public docket or opinion. Seven districts have none yet because the
// free tier's daily quota ran out; they get a designed empty state, never filler.

import { h } from '../../lib/dom.ts';
import { sourceChip } from '../../components/source-chip.ts';
import { emptyState } from '../../components/states.ts';
import type { Case, CasesFile } from '../../data/types.ts';
import { longDate } from './common.ts';

function kindLabel(c: Case): string {
  if (c.kind === 'opinion' || c.item_type === 'opinion') return c.opinion_status ? `Opinion (${c.opinion_status.toLowerCase()})` : 'Opinion';
  if (c.docket_type === 'cr') return 'Criminal docket';
  if (c.docket_type === 'cv') return 'Civil docket';
  return 'Docket';
}

function kindClass(c: Case): string {
  if (c.kind === 'opinion' || c.item_type === 'opinion') return 'opinion';
  return c.docket_type === 'cr' ? 'criminal' : 'civil';
}

export function renderCases(host: HTMLElement, file: CasesFile | null, districtId: string): void {
  const searchUrl = `https://www.courtlistener.com/?type=r&order_by=dateFiled%20desc&court=${encodeURIComponent(districtId)}`;
  const items = (file?.items ?? []).slice(0, 5);
  if (!items.length) {
    host.append(
      emptyState({
        title: 'No recent cases yet',
        body: h(
          'span',
          null,
          (file?.note ?? 'No CourtListener items have been published for this district yet.').replace(/^No recent cases yet\.\s*/i, ''),
          ' Nothing is shown in their place.',
        ),
        icon: 'soon',
        action: h('a', { class: 'btn', href: searchUrl, target: '_blank', rel: 'noopener' }, 'Search this court on CourtListener'),
      }),
    );
    return;
  }
  host.append(
    h(
      'ol',
      { class: 'cases' },
      ...items.map((c) =>
        h(
          'li',
          { class: `case case--${kindClass(c)}` },
          h('p', { class: 'case__kind' }, kindLabel(c)),
          h('h3', { class: 'case__name' }, h('a', { href: c.url, target: '_blank', rel: 'noopener' }, c.case_name)),
          h(
            'p',
            { class: 'case__meta' },
            c.date_filed ? h('span', null, `Filed ${longDate(c.date_filed)}`) : null,
            c.docket_number ? h('span', null, /\bno\.\s/i.test(c.docket_number) ? c.docket_number : `No. ${c.docket_number}`) : null,
            c.nature_of_suit ? h('span', null, c.nature_of_suit) : null,
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'cases__foot' },
      sourceChip({ sourceIds: file?.source_ids ?? [], compact: true }),
      file?.retrieved_at ? h('span', { class: 'cases__asof' }, `Retrieved ${longDate(file.retrieved_at)}.`) : null,
      file?.selection
        ? h('details', { class: 'cases__how' }, h('summary', null, 'How these were chosen'), h('p', null, file.selection))
        : null,
    ),
  );
}
