// Inline glossary terms with accessible popovers.
//  - Each term is a <button> styled as dotted-underlined text.
//  - Screen readers get the definition via aria-describedby (a visually hidden span),
//    so it is announced on focus without opening anything.
//  - Sighted readers get a popover on hover, focus or tap; Escape closes it.
//  - A mouse click (or tap) pins the popover open, even when hovering had already opened it; the next click on the
//    term, Escape or a click elsewhere closes it. Enter and Space toggle it, as before.
// rich() turns authored strings into nodes: [[id]] or [[id|shown text]] for terms,
// **text** for bold, *text* for italics (case names).

import { h, uniqueId } from '../lib/dom.ts';
import { glossaryEntry } from '../content/glossary.ts';
import { PHRASE_TERMS, termsForVariable, type TermRef } from '../content/variable-terms.ts';

let pop: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
/** The open popover was pinned by a click on its term: leaving the term with the pointer does not close it. */
let pinned = false;
/** Set while Escape returns focus to a term, so that focus does not reopen its popover. */
let refocusing = false;

function popover(): HTMLDivElement {
  if (pop) return pop;
  pop = h('div', { class: 'gloss-pop', role: 'tooltip', 'aria-hidden': 'true', 'data-open': 'false' });
  pop.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  pop.addEventListener('pointerleave', () => {
    if (!pinned) scheduleHide();
  });
  document.body.append(pop);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pop?.dataset.open === 'true') {
      const term = current;
      hidePopover();
      // A click inside a pinned popover moves focus off the term; give it back without reopening the popover.
      if (term && document.activeElement !== term) {
        refocusing = true;
        term.focus();
        refocusing = false;
      }
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
  pinned = false;
}

function showPopover(btn: HTMLElement, id: string): void {
  const entry = glossaryEntry(id);
  if (!entry) return;
  clearTimeout(hideTimer);
  const p = popover();
  if (current !== btn) pinned = false;
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

// Definitions for terms inside labels live in one hidden container (one copy per term), so a heading, a table
// row header or anything named by its content (aria-labelledby) does not take the whole definition into its name.
let defsHost: HTMLElement | null = null;

function sharedDescription(id: string, definition: string): string {
  const did = `gloss-def-${id}`;
  if (document.getElementById(did)) return did;
  if (!defsHost || !defsHost.isConnected) {
    defsHost = h('div', { id: 'glossary-definitions', hidden: true });
    document.body.append(defsHost);
  }
  defsHost.append(h('span', { id: did }, definition));
  return did;
}

export interface TermOptions {
  /**
   * The term sits in a label (heading, row header, caption) rather than in running text: its definition is
   * referenced from a shared hidden container instead of being placed inline, and the hit area is padded to
   * at least 24px tall without moving the text.
   */
  label?: boolean;
}

/** An inline glossary term. Falls back to plain text if the id is unknown. */
export function term(id: string, text?: string, opts: TermOptions = {}): HTMLElement {
  const entry = glossaryEntry(id);
  const shown = text ?? entry?.term ?? id;
  if (!entry) return h('span', null, shown);
  const definition = `Definition: ${entry.definition.replace(/\*/g, '')}`;
  const descId = opts.label ? sharedDescription(id, definition) : uniqueId('gloss');
  const btn = h(
    'button',
    { type: 'button', class: opts.label ? 'term term--label' : 'term', 'aria-describedby': descId, 'aria-expanded': 'false', 'data-term': id },
    inlineItalics(shown),
  );
  const desc = opts.label ? null : h('span', { id: descId, class: 'visually-hidden' }, definition);
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  btn.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showPopover(btn, id), 120);
  });
  btn.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return;
    clearTimeout(hoverTimer);
    if (!(pinned && current === btn)) scheduleHide();
  });
  btn.addEventListener('focus', () => {
    if (!refocusing) showPopover(btn, id);
  });
  btn.addEventListener('blur', () => {
    // A press inside a pinned popover (to select its text) takes focus off the term; keep it open then.
    if (pinned && current === btn && pop?.matches(':hover')) return;
    scheduleHide();
  });
  // A press focuses the button in Chrome (desktop and Android), and focus opens the popover, so the click that
  // follows must act on the state before the press; otherwise a tap opened and then closed it at once.
  let openBeforePress = false;
  let pinnedBeforePress = false;
  btn.addEventListener('pointerdown', () => {
    // A press settles the state itself: a hover-open still pending (the pointer entered under 120 ms ago) must not
    // fire after the click and reopen a popover the click just closed.
    clearTimeout(hoverTimer);
    openBeforePress = current === btn && pop?.dataset.open === 'true';
    pinnedBeforePress = openBeforePress && pinned;
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (e.detail === 0) {
      // Keyboard (Enter or Space): toggle.
      if (current === btn && pop?.dataset.open === 'true') hidePopover();
      else showPopover(btn, id);
      return;
    }
    // Pointer: a click pins the popover, including one hovering had already opened (a mouse user who hovers and
    // then clicks to read must not see it close); a click on a pinned term closes it.
    if (openBeforePress && pinnedBeforePress) {
      hidePopover();
      return;
    }
    showPopover(btn, id);
    pinned = true;
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

/**
 * A label with its legal terms marked: each ref's words, found without regard to case, become a glossary term
 * (label variant) that keeps the label's own casing. Refs that do not occur, or overlap an earlier match, are
 * skipped, so the label always reads exactly as written.
 */
export function glossLabel(text: string, refs: readonly TermRef[]): DocumentFragment {
  const lower = text.toLowerCase();
  const hits: Array<{ at: number; end: number; term: string }> = [];
  for (const r of refs) {
    const at = lower.indexOf(r.text.toLowerCase());
    if (at < 0) continue;
    const end = at + r.text.length;
    if (hits.some((x) => at < x.end && end > x.at)) continue;
    hits.push({ at, end, term: r.term });
  }
  hits.sort((a, b) => a.at - b.at);
  const frag = document.createDocumentFragment();
  let last = 0;
  hits.forEach((x, i) => {
    // A term button is an atomic inline box, so the line may break right beside it: punctuation touching the
    // term ("(" and ")" around "§5K1.1") goes into one no-wrap group with it.
    const before = text.slice(last, x.at);
    const lead = /[^\s]+$/.exec(before)?.[0] ?? '';
    const nextAt = hits[i + 1]?.at ?? text.length;
    const trail = /^[^\s]+/.exec(text.slice(x.end, nextAt))?.[0] ?? '';
    if (before.length > lead.length) frag.append(before.slice(0, before.length - lead.length));
    const t = term(x.term, text.slice(x.at, x.end), { label: true });
    frag.append(lead || trail ? h('span', { class: 'term-nowrap' }, lead, t, trail) : t);
    last = x.end + trail.length;
  });
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

/** A measure's label (or `text`, e.g. its short label) with the glossary terms listed in variable-terms.ts. */
export function variableLabel(v: { id: string; label: string }, text: string = v.label): DocumentFragment {
  return glossLabel(text, termsForVariable(v.id));
}

/** A fixed heading with the terms in PHRASE_TERMS marked (nature of suit, guideline range, §5K1.1, §5K3.1). */
export function phraseLabel(text: string): DocumentFragment {
  return glossLabel(text, PHRASE_TERMS);
}
