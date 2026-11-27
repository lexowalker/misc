// Compact positioned tooltip. Lives inside a positioned container and flips to stay
// within it. Used by the map (hover + tap) and by charts.

import { h } from '../lib/dom.ts';

export class Tooltip {
  readonly el: HTMLDivElement;
  private container: HTMLElement;
  pinned = false;

  constructor(container: HTMLElement, className = '') {
    this.container = container;
    this.el = h('div', { class: `tooltip ${className}`.trim(), 'aria-hidden': 'true', 'data-open': 'false' });
    container.append(this.el);
  }

  /** Show content near (x, y) in container coordinates. */
  show(content: Node | string, x: number, y: number, opts: { pinned?: boolean } = {}): void {
    this.pinned = !!opts.pinned;
    this.el.replaceChildren(typeof content === 'string' ? document.createTextNode(content) : content);
    this.el.dataset.open = 'true';
    this.el.dataset.pinned = String(this.pinned);
    // Interactive (pinned) tooltips contain a link; expose them to assistive tech.
    this.el.setAttribute('aria-hidden', this.pinned ? 'false' : 'true');
    this.move(x, y);
  }

  move(x: number, y: number): void {
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    const tw = this.el.offsetWidth;
    const th = this.el.offsetHeight;
    const off = 14;
    let left = x + off;
    let top = y - th - off;
    if (left + tw > cw - 4) left = x - tw - off;
    if (left < 4) left = Math.max(4, Math.min(cw - tw - 4, x - tw / 2));
    if (top < 4) top = y + off + 6;
    if (top + th > ch - 4) top = Math.max(4, ch - th - 4);
    this.el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  hide(): void {
    this.pinned = false;
    this.el.dataset.open = 'false';
    this.el.setAttribute('aria-hidden', 'true');
  }

  get open(): boolean {
    return this.el.dataset.open === 'true';
  }

  destroy(): void {
    this.el.remove();
  }
}
