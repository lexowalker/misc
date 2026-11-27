// Small-multiple thumbnail maps: tiny static SVGs in the same projection, no
// interaction. Paths are decimated once per topology (points closer than ~1.6
// viewBox units dropped) and districts are merged into one path per class, so a
// strip of 20 thumbnails stays light.

import { geoPath, type GeoStream } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import { s } from '../lib/dom.ts';
import { atlasProjection, VIEW_H, VIEW_W } from './projection.ts';
import type { AtlasGeometry } from './geo.ts';
import { hatchPattern } from '../components/legend.ts';
import { STEPS } from './scale.ts';

const TOL = 1.6;

function decimate(out: GeoStream, tol: number): GeoStream {
  let x0 = 0;
  let y0 = 0;
  let n = 0;
  return {
    point(x, y) {
      if (n === 0 || Math.abs(x - x0) + Math.abs(y - y0) >= tol) {
        out.point(x, y);
        x0 = x;
        y0 = y;
        n += 1;
      }
    },
    lineStart() {
      n = 0;
      out.lineStart();
    },
    lineEnd() {
      out.lineEnd();
    },
    polygonStart() {
      out.polygonStart();
    },
    polygonEnd() {
      out.polygonEnd();
    },
    sphere() {
      out.sphere?.();
    },
  };
}

interface ThumbGeometry {
  districts: Map<string, string>;
  outline: string;
}
const thumbCache = new WeakMap<AtlasGeometry, ThumbGeometry>();

function thumbGeometry(g: AtlasGeometry): ThumbGeometry {
  const hit = thumbCache.get(g);
  if (hit) return hit;
  const districts = new Map<string, string>();
  const proj = atlasProjection();
  if (g.kind === 'districts' && g.topology.objects.districts) {
    const fc = feature(g.topology, g.topology.objects.districts as GeometryCollection);
    for (const f of fc.features) {
      const id = String(f.id ?? '');
      const shape = g.byId.get(id);
      if (!shape) continue;
      const p = proj.byId[shape.region].projection;
      const path = geoPath({ stream: (sink: GeoStream) => p.stream(decimate(sink, TOL)) }).digits(1);
      districts.set(id, path(f) ?? '');
    }
  } else {
    for (const d of g.districts) districts.set(d.id, d.d);
  }
  const out = { districts, outline: g.stateMesh };
  thumbCache.set(g, out);
  return out;
}

let thumbSeq = 0;

export interface ThumbnailOptions {
  geometry: AtlasGeometry;
  /** Quantile step 0..4 for a district, or null for No data. Omit for a neutral base map. */
  classOf?: (id: string) => number | null;
  title: string;
  className?: string;
  /** Highlight one district (used by locator-like thumbnails). */
  highlight?: string;
}

export function renderThumbnail(o: ThumbnailOptions): SVGSVGElement {
  thumbSeq += 1;
  const hatchId = `thumb-hatch-${thumbSeq}`;
  const tg = thumbGeometry(o.geometry);
  const groups = new Map<string, string[]>();
  for (const [id, d] of tg.districts) {
    const cls = o.highlight ? (id === o.highlight ? 'hl' : 'ctx') : o.classOf ? (o.classOf(id) === null ? 'nodata' : `q${o.classOf(id)}`) : 'base';
    (groups.get(cls) ?? groups.set(cls, []).get(cls)!).push(d);
  }
  const svg = s('svg', {
    class: `thumb-map ${o.className ?? ''}`.trim(),
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    role: 'img',
    'aria-label': o.title,
    preserveAspectRatio: 'xMidYMid meet',
  });
  svg.append(s('defs', null, hatchPattern(hatchId, 10)));
  for (const r of atlasProjection().regions) {
    if (!r.box) continue;
    const [[x0, y0], [x1, y1]] = r.box;
    svg.append(s('rect', { class: 'thumb-map__frame', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 4 }));
  }
  const order = ['base', 'ctx', 'nodata', ...Array.from({ length: STEPS }, (_, i) => `q${i}`), 'hl'];
  for (const cls of order) {
    const ds = groups.get(cls);
    if (!ds?.length) continue;
    const p = s('path', { class: `thumb-map__fill ${cls}`, d: ds.join('') });
    if (cls === 'nodata') p.setAttribute('fill', `url(#${hatchId})`);
    svg.append(p);
  }
  if (tg.outline) svg.append(s('path', { class: 'thumb-map__states', d: tg.outline }));
  return svg;
}
