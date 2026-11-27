// Tiny DOM helpers. No framework: pages are small, and the map owns its own SVG.

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(el: Element, attrs: Attrs | undefined, children: Child[]): void {
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'class') {
        el.setAttribute('class', String(v));
      } else if (k === 'html') {
        el.innerHTML = String(v);
      } else {
        el.setAttribute(k, v === true ? '' : String(v));
      }
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Create an HTML element: h('a', {href: '#/'}, 'Home'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs ?? undefined, children);
  return el;
}

/** Create an SVG element. */
export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, attrs ?? undefined, children);
  return el;
}

/** Parse a trusted, static HTML string (icons, authored content) into a fragment. */
export function html(markup: string): DocumentFragment {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content;
}

let uid = 0;
export function uniqueId(prefix = 'id'): string {
  uid += 1;
  return `${prefix}-${uid}`;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Read a CSS custom property from :root (resolved for the active theme). */
export function cssVar(name: string, el: Element = document.documentElement): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Duration token in ms (honors prefers-reduced-motion through the tokens). */
export function durationMs(token: string, fallback = 0): number {
  const v = cssVar(token);
  if (!v) return fallback;
  const n = parseFloat(v);
  return v.endsWith('ms') ? n : v.endsWith('s') ? n * 1000 : fallback;
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function rafThrottle<A extends unknown[]>(fn: (...a: A) => void): (...a: A) => void {
  let queued = false;
  let last: A;
  return (...a: A) => {
    last = a;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...last);
    });
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
