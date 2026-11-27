// Locator map: one district highlighted in its state context, zoomed in, with a tiny
// national key map in the corner. Used for district-profile heroes, compare and search.

import { s } from '../lib/dom.ts';
import { VIEW_H, VIEW_W } from './projection.ts';
import type { AtlasGeometry } from './geo.ts';
import { renderThumbnail } from './thumbnail.ts';

export interface LocatorOptions {
  geometry: AtlasGeometry;
  districtId: string;
  /** Target aspect ratio (width / height) of the crop. Default 1.3. */
  aspect?: number;
  /** Show the national key map (default true). */
  keyMap?: boolean;
  /** Courthouse points (already projected, viewBox units) to mark. */
  points?: Array<{ x: number; y: number; label?: string }>;
  className?: string;
}

type B = [[number, number], [number, number]];

function union(a: B, b: B): B {
  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];
}

export function renderLocator(o: LocatorOptions): SVGSVGElement | null {
  const g = o.geometry;
  const target = g.byId.get(o.districtId);
  if (!target) return null;
  const aspect = o.aspect ?? 1.3;
  const stateShape = g.states.find((st) => st.id === target.state);
  let b: B = stateShape ? union(target.bounds, stateShape.bounds) : target.bounds;
  // Pad, then grow the short side to the target aspect.
  let w = b[1][0] - b[0][0];
  let h = b[1][1] - b[0][1];
  const pad = Math.max(w, h) * 0.14 + 4;
  b = [[b[0][0] - pad, b[0][1] - pad], [b[1][0] + pad, b[1][1] + pad]];
  w = b[1][0] - b[0][0];
  h = b[1][1] - b[0][1];
  if (w / h < aspect) {
    const nw = h * aspect;
    b[0][0] -= (nw - w) / 2;
    w = nw;
  } else {
    const nh = w / aspect;
    b[0][1] -= (nh - h) / 2;
    h = nh;
  }
  const svg = s('svg', {
    class: `locator-map ${o.className ?? ''}`.trim(),
    viewBox: `${b[0][0].toFixed(2)} ${b[0][1].toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`,
    role: 'img',
    'aria-label': `Locator map: ${target.name}, highlighted within ${target.state}`,
  });
  svg.append(s('rect', { class: 'locator-map__bg', x: b[0][0] - w, y: b[0][1] - h, width: w * 3, height: h * 3 }));
  // Context: every district in the same region; same-state districts a step darker.
  const ctx = s('g', { class: 'locator-map__ctx' });
  for (const d of g.districts) {
    if (d.region !== target.region || d.id === target.id) continue;
    ctx.append(s('path', { d: d.d, class: d.state === target.state ? 'same-state' : 'other' }));
  }
  svg.append(ctx);
  svg.append(s('path', { class: 'locator-map__target', d: target.d }));
  if (g.districtMesh) svg.append(s('path', { class: 'locator-map__mesh', d: g.districtMesh }));
  if (g.stateMesh) svg.append(s('path', { class: 'locator-map__states', d: g.stateMesh }));
  for (const p of o.points ?? []) {
    svg.append(s('path', { class: 'locator-map__dot-ring', d: `M${p.x} ${p.y}h0` }), s('path', { class: 'locator-map__dot', d: `M${p.x} ${p.y}h0` }));
  }
  if (o.keyMap !== false) {
    // National key map, bottom-right, ~28% of the width.
    const kw = w * 0.3;
    const kh = (kw * VIEW_H) / VIEW_W;
    const key = renderThumbnail({ geometry: g, title: '', highlight: target.id, className: 'locator-map__key' });
    key.removeAttribute('role');
    key.setAttribute('aria-hidden', 'true');
    key.setAttribute('x', String(b[0][0] + w - kw - w * 0.02));
    key.setAttribute('y', String(b[0][1] + h - kh - h * 0.03));
    key.setAttribute('width', String(kw));
    key.setAttribute('height', String(kh));
    svg.append(
      s('rect', {
        class: 'locator-map__key-bg',
        x: b[0][0] + w - kw - w * 0.02 - kw * 0.03,
        y: b[0][1] + h - kh - h * 0.03 - kh * 0.05,
        width: kw * 1.06,
        height: kh * 1.1,
        rx: kw * 0.03,
      }),
      key,
    );
  }
  return svg;
}
