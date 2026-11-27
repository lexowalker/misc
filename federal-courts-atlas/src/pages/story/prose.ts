// Story prose: fills {key} placeholders with numbers from the story's data file and renders
// glossary terms. Every number becomes a <span class="story-num"> (or a button for derived
// numbers) with a popover that shows how it was computed, its formula and its sources.

import { h, uniqueId } from '../../lib/dom.ts';
import { formatDate } from '../../lib/format.ts';
import { rich } from '../../components/glossary.ts';
import { EVENTS } from '../../content/events.ts';
import type { SourceProv, StoryNumber } from './types.ts';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

const PLACEHOLDER = /\{([a-z0-9_]+|ev|evy):?([a-zA-Z0-9_-]*)\}/g;

export interface ProseContext {
  numbers: Record<string, StoryNumber>;
  sources: Record<string, SourceProv>;
  /** Interactive popovers (default true). Off for index cards and plain-text uses. */
  interactive?: boolean;
}

export class MissingNumberError extends Error {}

function eventText(id: string, yearOnly: boolean): string {
  const ev = EVENTS.find((e) => e.id === id);
  if (!ev) throw new MissingNumberError(`unknown event ${id}`);
  if (yearOnly) return ev.date.slice(0, 4);
  const d = new Date(`${ev.date}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** The display string for one placeholder. Throws if the number is missing (never shows a gap as text). */
export function resolve(key: string, mod: string, numbers: Record<string, StoryNumber>): string {
  if (key === 'ev' || key === 'evy') return eventText(mod, key === 'evy');
  const n = numbers[key];
  if (!n) throw new MissingNumberError(`story number "${key}" is not in the data file`);
  switch (mod) {
    case '':
      return n.text;
    case 'bare':
      return n.bare;
    case 'year':
      if (n.year === undefined) throw new MissingNumberError(`story number "${key}" has no year`);
      return `FY ${n.year}`;
    case 'word':
    case 'Word': {
      const v = Number(n.value);
      const w = Number.isInteger(v) && v >= 0 && v <= 10 ? WORDS[v]! : n.text;
      return mod === 'Word' ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    }
    default:
      throw new MissingNumberError(`unknown modifier ${mod}`);
  }
}

/** Plain text with placeholders filled (for aria labels and the document title). */
export function fillText(template: string, numbers: Record<string, StoryNumber>): string {
  return template
    .replace(PLACEHOLDER, (_, k: string, m: string) => resolve(k, m, numbers))
    .replace(/\.\.(?!\.)/g, '.')
    .replace(/\[\[[a-z0-9-]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([a-z0-9-]+)\]\]/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1');
}

/* ---- number popover (one shared element) ---------------------------------- */

let pop: HTMLDivElement | null = null;
let popFor: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function ensurePop(): HTMLDivElement {
  if (pop && document.body.contains(pop)) return pop;
  pop = h('div', { class: 'num-pop', role: 'tooltip', id: uniqueId('num-pop'), 'data-open': 'false' });
  pop.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  pop.addEventListener('pointerleave', () => scheduleHide());
  document.body.append(pop);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideNumPop();
  });
  return pop;
}

export function hideNumPop(): void {
  if (!pop) return;
  pop.dataset.open = 'false';
  popFor?.setAttribute('aria-expanded', 'false');
  popFor = null;
}

function scheduleHide(): void {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideNumPop, 160);
}

function sourceLine(ids: string[], sources: Record<string, SourceProv>): HTMLElement {
  const seen = new Map<string, { url?: string; years: string[] }>();
  for (const id of ids) {
    const s = sources[id];
    if (!s) continue;
    const name = [s.publisher?.split(/\s*(?:\(|,|\svia\s)/)[0], s.dataset?.split(/\s*[,(:]/)[0]].filter(Boolean).join(', ');
    const e = seen.get(name) ?? { url: s.url, years: [] };
    if (s.vintage) e.years.push(s.vintage);
    seen.set(name, e);
  }
  const p = h('p', { class: 'num-pop__src' }, h('span', { class: 'caps' }, ids.length > 1 ? 'Sources' : 'Source'), ' ');
  let i = 0;
  for (const [name, e] of seen) {
    if (i++) p.append('; ');
    p.append(e.url ? h('a', { href: e.url, target: '_blank', rel: 'noopener' }, name) : name);
  }
  if (!seen.size) p.append(ids.join(', '));
  return p;
}

function showPop(target: HTMLElement, n: StoryNumber, ctx: ProseContext): void {
  const el = ensurePop();
  clearTimeout(hideTimer);
  el.replaceChildren(
    h('p', { class: 'num-pop__head' }, h('span', { class: `num-pop__tag${n.derived ? ' is-derived' : ''}` }, n.derived ? 'Derived' : 'As published'), h('strong', { class: 'num' }, n.text)),
    h('p', { class: 'num-pop__how' }, n.how),
    n.formula ? h('p', { class: 'num-pop__formula' }, h('span', { class: 'caps' }, 'Formula'), h('code', null, n.formula)) : '',
    sourceLine(n.source_ids, ctx.sources),
  );
  el.dataset.open = 'true';
  popFor?.setAttribute('aria-expanded', 'false');
  popFor = target;
  target.setAttribute('aria-expanded', 'true');
  // Position below (or above) the number, inside the viewport.
  const r = target.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 24);
  el.style.width = `${w}px`;
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  el.style.left = `${left + window.scrollX}px`;
  const ph = el.offsetHeight;
  const below = r.bottom + 8;
  const top = below + ph > window.innerHeight - 8 && r.top - ph - 8 > 8 ? r.top - ph - 8 : below;
  el.style.top = `${top + window.scrollY}px`;
}

function numberNode(key: string, mod: string, ctx: ProseContext): Node {
  const text = resolve(key, mod, ctx.numbers);
  if (key === 'ev' || key === 'evy') return h('span', { class: 'story-date' }, text);
  const n = ctx.numbers[key]!;
  // Names, and years shown for a count ("{key:year}"), are plain text: their popover would describe a different value.
  if (ctx.interactive === false || n.unit === 'district' || mod === 'year') {
    return h('span', { class: `story-num${n.unit === 'district' ? ' story-num--name' : ''}`, 'data-key': key, 'data-mod': mod || null }, text);
  }
  const attrs = { class: `story-num${n.derived ? ' story-num--derived' : ''}`, 'data-key': key, 'data-mod': mod || null };
  // Derived numbers are buttons (keyboard and touch reach the formula); published ones show their
  // source on hover. Every number's details also appear in "How we did this".
  const el = n.derived
    ? h('button', { ...attrs, type: 'button', 'aria-expanded': 'false', 'aria-label': `${text}, derived. Show formula` }, text)
    : h('span', attrs, text);
  el.addEventListener('pointerenter', (e) => {
    if ((e as PointerEvent).pointerType === 'touch') return;
    showPop(el, n, ctx);
  });
  el.addEventListener('pointerleave', (e) => {
    if ((e as PointerEvent).pointerType === 'touch') return;
    scheduleHide();
  });
  if (n.derived) {
    el.addEventListener('focus', () => showPop(el, n, ctx));
    el.addEventListener('blur', () => scheduleHide());
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (popFor === el && pop?.dataset.open === 'true') hideNumPop();
      else showPop(el, n, ctx);
    });
  }
  return el;
}

/** Render a template into a fragment: numbers as spans, glossary terms as buttons. */
export function renderProse(template: string, ctx: ProseContext): DocumentFragment {
  const frag = document.createDocumentFragment();
  let last = 0;
  PLACEHOLDER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER.exec(template))) {
    if (m.index > last) frag.append(rich(template.slice(last, m.index)));
    const node = numberNode(m[1]!, m[2] ?? '', ctx);
    frag.append(node);
    last = m.index + m[0].length;
    // "in D. Ariz.." -> "in D. Ariz.": an abbreviation's period ends the sentence.
    if ((node.textContent ?? '').endsWith('.') && template[last] === '.') last += 1;
  }
  if (last < template.length) frag.append(rich(template.slice(last)));
  return frag;
}

/** All placeholder keys in a template (for checks). */
export function placeholders(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(PLACEHOLDER)) if (m[1] !== 'ev' && m[1] !== 'evy') out.push(m[1]!);
  return out;
}

export { formatDate };
