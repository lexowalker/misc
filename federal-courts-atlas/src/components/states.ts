// Designed empty, loading and error states. Never show a number where data is missing.

import { h, html } from '../lib/dom.ts';

const ICONS = {
  data: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5.5" rx="7.5" ry="2.75"/><path d="M4.5 5.5v6.5c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75V5.5"/><path d="M4.5 12v6.5c0 1.5 3.4 2.75 7.5 2.75s7.5-1.25 7.5-2.75V12"/></svg>',
  map: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z"/><path d="M9 4v14M15 6v14"/></svg>',
  soon: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  error: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z"/><path d="M12 10v4.5M12 17v.5"/></svg>',
};

export interface EmptyStateOptions {
  title: string;
  body?: string | Node;
  icon?: keyof typeof ICONS;
  /** Small mono line naming the file that is missing, for maintainers. */
  file?: string;
  compact?: boolean;
  action?: Node;
}

export function emptyState(o: EmptyStateOptions): HTMLElement {
  return h(
    'div',
    { class: `empty-state${o.compact ? ' empty-state--compact' : ''}`, role: 'status' },
    h('div', { class: 'empty-state__icon' }, html(ICONS[o.icon ?? 'data'])),
    h('p', { class: 'empty-state__title' }, o.title),
    o.body ? h('p', { class: 'empty-state__body' }, o.body) : null,
    o.file ? h('p', { class: 'empty-state__file' }, h('code', null, o.file)) : null,
    o.action ?? null,
  );
}

/** "Data not yet built": the standard state for a missing public/data file. */
export function dataNotBuilt(file: string, what = 'This view', compact = false): HTMLElement {
  return emptyState({
    title: 'Data not yet built',
    body: `${what} appears once the atlas's data pipeline publishes it. Nothing is estimated in the meantime.`,
    file: `public/data/${file}`,
    icon: 'data',
    compact,
  });
}

export function errorState(message: string, file?: string): HTMLElement {
  return emptyState({ title: 'Could not load this data', body: message, file, icon: 'error' });
}

export function loadingState(label = 'Loading'): HTMLElement {
  return h(
    'div',
    { class: 'loading-state', role: 'status', 'aria-live': 'polite' },
    h('span', { class: 'loading-state__bar', 'aria-hidden': 'true' }),
    h('span', { class: 'loading-state__label' }, label),
  );
}

/** Inline "No data" marker for table cells, tooltips and stat blocks. */
export function noData(): HTMLElement {
  return h('span', { class: 'no-data' }, 'No data');
}
