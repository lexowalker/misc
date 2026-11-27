// Greedy, priority-ordered label placement with collision avoidance (screen space).
// Each label tries right, left, above, below its point; the first slot that does not
// collide with an already placed label (or leave the viewport) wins; otherwise it is hidden.

export interface LabelCandidate {
  id: string;
  text: string;
  /** Screen-space anchor point (px). */
  x: number;
  y: number;
  /** Higher places first. */
  priority: number;
}

export interface PlacedLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
  /** Offset from the anchor point to the text baseline origin. */
  dx: number;
  dy: number;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

let ctx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();

export function measureText(text: string, font: string): number {
  const key = font + '|' + text;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  ctx ??= document.createElement('canvas').getContext('2d');
  let w = text.length * 6.2;
  if (ctx) {
    ctx.font = font;
    w = ctx.measureText(text).width;
  }
  widthCache.set(key, w);
  return w;
}

export function placeLabels(
  candidates: LabelCandidate[],
  opts: { font: string; fontSize: number; width: number; height: number; gap?: number; padding?: number; reserved?: Rect[] },
): PlacedLabel[] {
  const gap = opts.gap ?? 5;
  const pad = opts.padding ?? 2;
  const h = opts.fontSize;
  const placed: Rect[] = [...(opts.reserved ?? [])];
  const out: PlacedLabel[] = [];
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority);
  const collides = (r: Rect) => {
    if (r.x0 < 2 || r.y0 < 2 || r.x1 > opts.width - 2 || r.y1 > opts.height - 2) return true;
    for (const p of placed) if (r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0) return true;
    return false;
  };
  for (const c of sorted) {
    if (c.x < 0 || c.y < 0 || c.x > opts.width || c.y > opts.height) continue;
    const w = measureText(c.text, opts.font);
    const slots: Array<[PlacedLabel['anchor'], number, number, Rect]> = [
      ['start', gap, h * 0.35, { x0: c.x + gap - pad, y0: c.y - h * 0.65 - pad, x1: c.x + gap + w + pad, y1: c.y + h * 0.35 + pad }],
      ['end', -gap, h * 0.35, { x0: c.x - gap - w - pad, y0: c.y - h * 0.65 - pad, x1: c.x - gap + pad, y1: c.y + h * 0.35 + pad }],
      ['middle', 0, -gap - 1, { x0: c.x - w / 2 - pad, y0: c.y - gap - 1 - h - pad, x1: c.x + w / 2 + pad, y1: c.y - gap + pad }],
      ['middle', 0, gap + h * 0.8, { x0: c.x - w / 2 - pad, y0: c.y + gap - pad, x1: c.x + w / 2 + pad, y1: c.y + gap + h + pad }],
    ];
    for (const [anchor, dx, dy, rect] of slots) {
      if (!collides(rect)) {
        placed.push(rect);
        out.push({ id: c.id, text: c.text, x: c.x, y: c.y, anchor, dx, dy });
        break;
      }
    }
  }
  return out;
}
