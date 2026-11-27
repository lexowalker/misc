// Inline glossary terms with accessible popovers.
//  - Each term is a <button> styled as dotted-underlined text.
//  - Screen readers get the definition via aria-describedby (a visually hidden span),
//    so it is announced on focus without opening anything.
//  - Sighted readers get a popover on hover, focus or tap; Escape closes it.
// rich() turns authored strings into nodes: [[id]] or [[id|shown text]] for terms,
// **text** for bold, *text* for italics (case names).

import { h, uniqueId } from '../lib/dom.ts';
import { glossaryEntry } from '../content/glossary.ts';

let pop: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function popover(): HTMLDivElement {
  if (pop) return pop;
  pop = h('div', { class: 'gloss-pop', role: 'tooltip', 'aria-hidden': 'true', 'data-open': 'false' });
  pop.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  pop.addEventListener('pointerleave', () => scheduleHide());
  document.body.append(pop);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pop?.dataset.open === 'true') {
      hidePopover();
      current?.focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (pop?.dataset.open !== 'true') return;
    const t = e.target as Node;
    if (!pop.contains(t) && !current?.contains(t)) hidePopover();
  });
  // Follow the term while the page scrolls; close once it leaves the viewport.
  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking || pop?.dataset.open !== 'true' || !current) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (!current || pop?.dataset.open !== 'true') return;
        const r = current.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) hidePopover();
        else place(current);
      });
    },
    { passive: true },
  );
  return pop;
}

function scheduleHide(): void {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hidePopover, 160);
}

export function hidePopover(): void {
  if (!pop) return;
  pop.dataset.open = 'false';
  current?.setAttribute('aria-expanded', 'false');
  current = null;
}

function showPopover(btn: HTMLElement, id: string): void {
  const entry = glossaryEntry(id);
  if (!entry) return;
  clearTimeout(hideTimer);
  const p = popover();
  current?.setAttribute('aria-expanded', 'false');
  current = btn;
  btn.setAttribute('aria-expanded', 'true');
  p.replaceChildren(
    h('p', { class: 'gloss-pop__term' }, entry.term),
    h('p', { class: 'gloss-pop__def' }, inlineItalics(entry.definition)),
    entry.cite ? h('p', { class: 'gloss-pop__cite' }, entry.cite) : '',
  );
  p.dataset.open = 'true';
  place(btn);
}

/** Position: below the term, clamped to the viewport; flip above if no room. */
function place(btn: HTMLElement): void {
  const p = popover();
  const r = btn.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const w = Math.min(340, vw - 24);
  p.style.width = `${w}px`;
  const left = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2));
  const ph = p.offsetHeight;
  const below = r.bottom + 8;
  const top = below + ph > vh - 8 && r.top - ph - 8 > 8 ? r.top - ph - 8 : below;
  p.style.left = `${left}px`;
  p.style.top = `${top}px`;
}

function inlineItalics(text: string): DocumentFragment {
  // **bold** and *italic* (case names). Nothing else is interpreted.
  const frag = document.createDocumentFragment();
  text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).forEach((part) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) frag.append(h('strong', null, part.slice(2, -2)));
    else if (/^\*[^*]+\*$/.test(part)) frag.append(h('i', null, part.slice(1, -1)));
    else if (part) frag.append(part);
  });
  return frag;
}

/** An inline glossary term. Falls back to plain text if the id is unknown. */
export function term(id: string, text?: string): HTMLElement {
  const entry = glossaryEntry(id);
  const shown = text ?? entry?.term ?? id;
  if (!entry) return h('span', null, shown);
  const descId = uniqueId('gloss');
  const btn = h(
    'button',
    { type: 'button', class: 'term', 'aria-describedby': descId, 'aria-expanded': 'false', 'data-term': id },
    inlineItalics(shown),
  );
  const desc = h('span', { id: descId, class: 'visually-hidden' }, `Definition: ${entry.definition.replace(/\*/g, '')}`);
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  btn.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showPopover(btn, id), 120);
  });
  btn.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    clearTimeout(hoverTimer);
    scheduleHide();
  });
  btn.addEventListener('focus', () => showPopover(btn, id));
  btn.addEventListener('blur', () => scheduleHide());
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (current === btn && pop?.dataset.open === 'true') hidePopover();
    else showPopover(btn, id);
  });
  return h('span', { class: 'term-wrap' }, btn, desc);
}

/** Parse authored text: [[id]] / [[id|text]] -> term(), *x* -> <i>. */
export function rich(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const re = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.append(inlineItalics(text.slice(last, m.index)));
    frag.append(term(m[1]!, m[2]));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(inlineItalics(text.slice(last)));
  return frag;
}
