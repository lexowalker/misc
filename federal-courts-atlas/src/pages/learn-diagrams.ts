// Hand-built responsive SVG diagrams for the Learn page:
//  (a) court structure: 94 district courts -> 13 courts of appeals -> Supreme Court
//  (b) the life cycle of a federal criminal case
//  (c) a circuit map (from the district topology, when available)
// Diagrams lay themselves out for the container width (wide vs. stacked), measuring
// text so nothing overflows. District counts per circuit come from the statutory
// registry, not from typing them in.

import { s, h, debounce } from '../lib/dom.ts';
import { DISTRICTS, CIRCUITS, circuitLabel } from '../data/districts.ts';
import { measureText } from '../map/labels.ts';
import type { AtlasGeometry } from '../map/geo.ts';
import { atlasProjection, VIEW_H, VIEW_W } from '../map/projection.ts';
import { mesh } from 'topojson-client';
import type { GeometryCollection, GeometryObject } from 'topojson-specification';
import type { MultiLineString } from 'geojson';

function sans(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'sans-serif';
}
const F = {
  title: () => `700 13px ${sans()}`,
  small: () => `700 12.5px ${sans()}`,
  body: () => `400 12.5px ${sans()}`,
  note: () => `500 11px ${sans()}`,
};
const LH = 15;

function wrap(text: string, font: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (measureText(next, font) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function textLines(lines: string[], x: number, y: number, lh: number, attrs: Record<string, string | number>): SVGTextElement {
  const t = s('text', { x, y, ...attrs });
  lines.forEach((l, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, l)));
  return t;
}

/** Mounts a diagram that re-renders when its container width changes. */
function responsive(container: HTMLElement, draw: (width: number) => SVGSVGElement): () => void {
  let lastW = 0;
  const go = () => {
    const w = Math.round(container.clientWidth);
    if (!w || Math.abs(w - lastW) < 4) return;
    lastW = w;
    container.replaceChildren(draw(w));
  };
  const ro = new ResizeObserver(debounce(go, 80));
  ro.observe(container);
  requestAnimationFrame(go);
  void document.fonts?.ready.then(() => {
    lastW = 0;
    go();
  });
  return () => ro.disconnect();
}

function svgRoot(cls: string, titleId: string, title: string, desc: string): SVGSVGElement {
  const svg = s('svg', { class: `diagram ${cls}`, role: 'img', 'aria-labelledby': `${titleId} ${titleId}-d` });
  svg.append(s('title', { id: titleId }, title), s('desc', { id: `${titleId}-d` }, desc));
  return svg;
}

function size(svg: SVGSVGElement, W: number, H: number): SVGSVGElement {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  return svg;
}

/* ---- (a) Structure ------------------------------------------------------ */

type Counts = Array<{ c: string; districts: Array<(typeof DISTRICTS)[number]> }>;

export function mountStructureDiagram(container: HTMLElement): () => void {
  const counts: Counts = CIRCUITS.map((c) => ({ c, districts: DISTRICTS.filter((d) => d.circuit === c) }));
  return responsive(container, (W) => (W >= 640 ? structureWide(W, counts) : structureNarrow(W, counts)));
}

function shortCircuit(c: string): string {
  return c === 'DC' ? 'D.C.' : circuitLabel(c).replace(' Circuit', '');
}

function structureDesc(counts: Counts): string {
  return `At the base, 94 district courts. Their appeals go to 12 regional courts of appeals (${counts
    .map((c) => `${shortCircuit(c.c)} Circuit: ${c.districts.length} districts`)
    .join('; ')}). The Court of Appeals for the Federal Circuit hears patent and certain other appeals from every district. The Supreme Court is at the top.`;
}

function districtSquare(d: (typeof DISTRICTS)[number], x: number, y: number, sq: number): SVGRectElement {
  const r = s('rect', { x, y, width: sq, height: sq, rx: 1.5, class: `dg-district${d.article === 'IV' ? ' dg-district--iv' : ''}` });
  r.append(s('title', null, `${d.name}${d.article === 'IV' ? ' (territorial court)' : ''}`));
  return r;
}

function key(svg: SVGSVGElement, x: number, y: number, stacked: boolean): number {
  const a = 'Article III district court';
  const b = 'Territorial (Article IV) district court';
  svg.append(s('rect', { x, y: y - 9, width: 9, height: 9, rx: 1.5, class: 'dg-district' }), s('text', { x: x + 14, y: y - 1, class: 'dg-key' }, a));
  const x2 = stacked ? x : x + 14 + measureText(a, F.note()) + 22;
  const y2 = stacked ? y + 18 : y;
  svg.append(s('rect', { x: x2, y: y2 - 9, width: 9, height: 9, rx: 1.5, class: 'dg-district dg-district--iv' }), s('text', { x: x2 + 14, y: y2 - 1, class: 'dg-key' }, b));
  return y2;
}

function structureWide(W: number, counts: Counts): SVGSVGElement {
  const svg = svgRoot('diagram--structure', 'structure-title', 'Structure of the federal courts', structureDesc(counts));
  const gutter = 104; // tier labels live in a left gutter, clear of every line
  const fedW = 96;
  const fedGap = 28;
  const gap = 6;
  const x0 = gutter;
  const regionalW = W - gutter - fedW - fedGap;
  const colW = (regionalW - gap * (counts.length - 1)) / counts.length;
  const sq = Math.max(7, Math.min(11, (colW - 8) / 2 - 1));
  const sqGap = 2;
  const perCol = 2;
  const maxRows = Math.max(...counts.map((c) => Math.ceil(c.districts.length / perCol)));
  const ySC = 4;
  const scH = 48;
  const yBus = ySC + scH + 20;
  const yCA = yBus + 18;
  const caH = 42;
  const yDist = yCA + caH + 22;
  const distH = maxRows * (sq + sqGap);
  const yCountMax = yDist + distH + 14;

  const tier = (y: number, lines: string[]) => svg.append(textLines(lines, 0, y, 13, { class: 'dg-tier' }));
  tier(ySC + scH / 2 + 4, ['SUPREME COURT']);
  tier(yCA + caH / 2 - 2, ['COURTS OF', 'APPEALS · 13']);
  tier(yDist + 8, ['DISTRICT', 'COURTS · 94']);

  const colX = (i: number) => x0 + i * (colW + gap);
  const fedX = x0 + regionalW + fedGap;
  const scW = Math.min(320, regionalW * 0.5);
  const scX = x0 + regionalW / 2 - scW / 2;
  svg.append(
    s('rect', { x: scX, y: ySC, width: scW, height: scH, rx: 6, class: 'dg-box dg-box--top' }),
    s('text', { x: scX + scW / 2, y: ySC + 21, class: 'dg-box-title dg-on-dark', 'text-anchor': 'middle' }, 'Supreme Court of the United States'),
    s('text', { x: scX + scW / 2, y: ySC + 37, class: 'dg-box-sub dg-on-dark', 'text-anchor': 'middle' }, 'Reviews cases by writ of certiorari'),
    s('path', { d: `M${scX + scW / 2} ${ySC + scH}V${yBus}`, class: 'dg-line' }),
    s('path', { d: `M${colX(0) + colW / 2} ${yBus}H${fedX + fedW / 2}`, class: 'dg-line' }),
  );

  counts.forEach(({ c, districts }, i) => {
    const x = colX(i);
    svg.append(
      s('path', { d: `M${x + colW / 2} ${yBus}V${yCA}`, class: 'dg-line' }),
      s('rect', { x, y: yCA, width: colW, height: caH, rx: 5, class: 'dg-box' }),
      s('text', { x: x + colW / 2, y: yCA + 19, class: 'dg-box-title', 'text-anchor': 'middle' }, shortCircuit(c)),
      s('text', { x: x + colW / 2, y: yCA + 33, class: 'dg-box-sub', 'text-anchor': 'middle' }, 'Circuit'),
      s('path', { d: `M${x + colW / 2} ${yCA + caH}V${yDist - 5}`, class: 'dg-line dg-line--up' }),
    );
    const blockW = perCol * sq + (perCol - 1) * sqGap;
    const bx = x + colW / 2 - blockW / 2;
    districts.forEach((d, k) => svg.append(districtSquare(d, bx + (k % perCol) * (sq + sqGap), yDist + Math.floor(k / perCol) * (sq + sqGap), sq)));
    const rows = Math.ceil(districts.length / perCol);
    svg.append(s('text', { x: x + colW / 2, y: yDist + rows * (sq + sqGap) + 12, class: 'dg-count', 'text-anchor': 'middle' }, String(districts.length)));
  });

  // Federal Circuit: jurisdiction by subject, from every district (dashed).
  svg.append(
    s('path', { d: `M${fedX + fedW / 2} ${yBus}V${yCA}`, class: 'dg-line' }),
    s('rect', { x: fedX, y: yCA, width: fedW, height: caH, rx: 5, class: 'dg-box dg-box--fed' }),
    s('text', { x: fedX + fedW / 2, y: yCA + 19, class: 'dg-box-title', 'text-anchor': 'middle' }, 'Federal'),
    s('text', { x: fedX + fedW / 2, y: yCA + 33, class: 'dg-box-sub', 'text-anchor': 'middle' }, 'Circuit'),
  );
  const noteLines = wrap('Patent and certain other appeals from every district', F.note(), fedW - 14);
  svg.append(textLines(noteLines, fedX + 14, yCA + caH + 18, 13, { class: 'dg-note' }));
  const yDash = Math.max(yCountMax + 14, yCA + caH + 18 + noteLines.length * 13);
  svg.append(s('path', { d: `M${colX(0)} ${yDash}H${fedX + 6}V${yCA + caH + 3}`, class: 'dg-line dg-line--dash' }));
  const yKey = yDash + 30;
  key(svg, x0, yKey, false);
  return size(svg, W, yKey + 4);
}

function structureNarrow(W: number, counts: Counts): SVGSVGElement {
  const svg = svgRoot('diagram--structure', 'structure-title-n', 'Structure of the federal courts', structureDesc(counts));
  const rowH = 30;
  const sq = 10;
  const sqGap = 3;
  const labelW = 56;
  const spineX = 10;
  const ySC = 4;
  const scH = 52;
  const yRows = ySC + scH + 36;
  svg.append(
    s('rect', { x: 0, y: ySC, width: W, height: scH, rx: 6, class: 'dg-box dg-box--top' }),
    s('text', { x: W / 2, y: ySC + 23, class: 'dg-box-title dg-on-dark', 'text-anchor': 'middle' }, 'Supreme Court'),
    s('text', { x: W / 2, y: ySC + 40, class: 'dg-box-sub dg-on-dark', 'text-anchor': 'middle' }, 'Reviews cases by writ of certiorari'),
    s('text', { x: spineX + 14, y: yRows - 12, class: 'dg-tier' }, 'COURTS OF APPEALS'),
    s('text', { x: W, y: yRows - 12, class: 'dg-tier', 'text-anchor': 'end' }, 'DISTRICTS'),
  );
  let y = yRows;
  const rowYs: number[] = [];
  counts.forEach(({ c, districts }) => {
    const x0 = spineX + 14 + labelW + 10;
    const avail = W - x0 - 26;
    const perRow = Math.max(1, Math.floor((avail + sqGap) / (sq + sqGap)));
    const rows = Math.ceil(districts.length / perRow);
    const h = Math.max(rowH, rows * (sq + sqGap) + 10);
    const mid = y + h / 2;
    rowYs.push(mid);
    svg.append(
      s('path', { d: `M${spineX} ${mid}H${spineX + 14}`, class: 'dg-line' }),
      s('rect', { x: spineX + 14, y: mid - (rowH - 6) / 2, width: labelW, height: rowH - 6, rx: 4, class: 'dg-box' }),
      s('text', { x: spineX + 14 + labelW / 2, y: mid + 4, class: 'dg-box-title dg-box-title--sm', 'text-anchor': 'middle' }, shortCircuit(c)),
    );
    const top = mid - (rows * (sq + sqGap) - sqGap) / 2;
    districts.forEach((d, k) => svg.append(districtSquare(d, x0 + (k % perRow) * (sq + sqGap), top + Math.floor(k / perRow) * (sq + sqGap), sq)));
    svg.append(s('text', { x: W, y: mid + 4, class: 'dg-count', 'text-anchor': 'end' }, String(districts.length)));
    y += h;
  });
  const fedH = 30;
  const yF = y + 14;
  const fedMid = yF + fedH / 2;
  const fedBoxW = labelW + 40;
  svg.append(
    s('path', { d: `M${spineX} ${ySC + scH}V${fedMid}H${spineX + 14}`, class: 'dg-line' }),
    s('rect', { x: spineX + 14, y: yF, width: fedBoxW, height: fedH, rx: 4, class: 'dg-box dg-box--fed' }),
    s('text', { x: spineX + 14 + fedBoxW / 2, y: fedMid + 4, class: 'dg-box-title dg-box-title--sm', 'text-anchor': 'middle' }, 'Federal Circuit'),
  );
  const noteX = spineX + 14 + fedBoxW + 10;
  const note = wrap('Patent and certain other appeals from every district', F.note(), W - noteX);
  svg.append(textLines(note, noteX, fedMid - ((note.length - 1) * 13) / 2 + 4, 13, { class: 'dg-note' }));
  const yKey = Math.max(yF + fedH, fedMid + note.length * 7) + 30;
  const last = key(svg, 0, yKey, true);
  return size(svg, W, last + 4);
}

/* ---- (b) Criminal case life cycle ----------------------------------- */

interface Step {
  n: string;
  title: string;
  sub: string;
}

const STEPS: Step[] = [
  { n: '1', title: 'Investigation', sub: 'Federal agents and prosecutors gather evidence; a grand jury may subpoena records' },
  { n: '2', title: 'Charges', sub: 'Criminal complaint, grand jury indictment, or information' },
  { n: '3', title: 'Initial appearance', sub: 'Charges and rights explained; counsel appointed if needed' },
  { n: '4', title: 'Detention hearing', sub: 'Release on conditions, or detention until trial' },
  { n: '5', title: 'Arraignment', sub: 'Defendant hears the charges and enters a plea' },
  { n: '6', title: 'Discovery and plea talks', sub: 'Evidence exchanged, motions decided, plea negotiations' },
  { n: '7', title: 'Plea or trial', sub: '' },
  { n: '8', title: 'Presentence report', sub: 'Probation officer investigates and calculates the guideline range' },
  { n: '9', title: 'Sentencing', sub: 'Judge sets the sentence under the advisory Guidelines' },
  { n: '10', title: 'Appeal', sub: 'Review by the court of appeals for the circuit' },
];

const OUTCOMES = [
  { title: 'Guilty plea', sub: 'Most cases end this way, often under a plea agreement' },
  { title: 'Trial', sub: 'Jury or bench; an acquittal ends the case' },
];

const SENTENCING_STEPS = ['Calculate the guideline range', 'Consider any departures', 'Weigh the § 3553(a) factors; a variance may follow'];

const LC_DESC = `${STEPS.map((st) => `${st.n}. ${st.title}${st.sub ? `: ${st.sub}` : ''}`).join('. ')}. Step 7 ends in a guilty plea or a trial. At sentencing the judge: ${SENTENCING_STEPS.join('; ')}.`;

export function mountLifecycleDiagram(container: HTMLElement): () => void {
  return responsive(container, (W) => (W >= 700 ? lifecycleWide(W) : lifecycleNarrow(W)));
}

interface Measured {
  title: string[];
  sub: string[];
  h: number;
}

function measureStep(st: Step, w: number): Measured {
  const title = wrap(st.title, F.title(), w - 44);
  const sub = st.sub ? wrap(st.sub, F.body(), w - 22) : [];
  return { title, sub, h: 12 + title.length * 16 + (sub.length ? 8 + sub.length * LH : 0) + 12 };
}

function drawStep(svg: SVGSVGElement, st: Step, m: Measured, x: number, y: number, w: number, h: number, cls = 'dg-box'): void {
  svg.append(s('rect', { x, y, width: w, height: h, rx: 6, class: cls }));
  svg.append(s('circle', { cx: x + 17, cy: y + 18, r: 10, class: 'dg-num' }), s('text', { x: x + 17, y: y + 22, class: 'dg-num-text', 'text-anchor': 'middle' }, st.n));
  svg.append(textLines(m.title, x + 34, y + 22.5, 16, { class: 'dg-box-title dg-box-title--left' }));
  if (m.sub.length) svg.append(textLines(m.sub, x + 11, y + 12 + m.title.length * 16 + 18, LH, { class: 'dg-box-sub dg-box-sub--left' }));
}

/** Step 7: a box holding the two outcomes. Returns its height for width w. */
function measureBranch(w: number): { h: number; inner: Array<{ title: string[]; sub: string[]; h: number }> } {
  const inner = OUTCOMES.map((o) => {
    const title = wrap(o.title, F.small(), w - 34);
    const sub = wrap(o.sub, F.body(), w - 34);
    return { title, sub, h: 10 + title.length * 15 + 4 + sub.length * LH + 8 };
  });
  return { h: 36 + inner.reduce((a, b) => a + b.h, 0) + 8 + 8, inner };
}

function drawBranch(svg: SVGSVGElement, x: number, y: number, w: number, h: number): void {
  const m = measureBranch(w);
  svg.append(s('rect', { x, y, width: w, height: h, rx: 6, class: 'dg-box' }));
  svg.append(s('circle', { cx: x + 17, cy: y + 18, r: 10, class: 'dg-num' }), s('text', { x: x + 17, y: y + 22, class: 'dg-num-text', 'text-anchor': 'middle' }, '7'));
  svg.append(s('text', { x: x + 34, y: y + 22.5, class: 'dg-box-title dg-box-title--left' }, 'Plea or trial'));
  let yy = y + 36;
  m.inner.forEach((o, i) => {
    svg.append(s('rect', { x: x + 7, y: yy, width: w - 14, height: o.h, rx: 4, class: 'dg-box dg-box--alt' }));
    svg.append(textLines(o.title, x + 15, yy + 17, 15, { class: 'dg-box-title dg-box-title--left dg-box-title--sm' }));
    svg.append(textLines(o.sub, x + 15, yy + 17 + o.title.length * 15 + 2, LH, { class: 'dg-box-sub dg-box-sub--left' }));
    yy += o.h + (i === 0 ? 8 : 0);
  });
}

function arrow(svg: SVGSVGElement, d: string): void {
  svg.append(s('path', { d, class: 'dg-line dg-arrow', 'marker-end': 'url(#dg-arrowhead)' }));
}

function arrowDefs(): SVGDefsElement {
  return s(
    'defs',
    null,
    s(
      'marker',
      { id: 'dg-arrowhead', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      s('path', { d: 'M0 1.5 9 5 0 8.5Z', class: 'dg-arrowhead' }),
    ),
  );
}

function sentencingCallout(svg: SVGSVGElement, x: number, y: number, w: number, columns: boolean): number {
  const font = F.body();
  if (columns) {
    const colW = (w - 28 - 2 * 14) / 3;
    const lines = SENTENCING_STEPS.map((t) => wrap(t, font, colW - 18));
    const h = 46 + Math.max(...lines.map((l) => l.length)) * LH + 10;
    svg.append(s('rect', { x, y, width: w, height: h, rx: 6, class: 'dg-callout' }), s('text', { x: x + 14, y: y + 22, class: 'dg-tier' }, 'AT SENTENCING, THE JUDGE'));
    lines.forEach((l, i) => {
      const sx = x + 14 + i * (colW + 14);
      svg.append(s('text', { x: sx, y: y + 46, class: 'dg-substep-num' }, `${String.fromCharCode(97 + i)}.`), textLines(l, sx + 17, y + 46, LH, { class: 'dg-box-sub dg-box-sub--left' }));
    });
    return h;
  }
  const lines = SENTENCING_STEPS.map((t) => wrap(t, font, w - 50));
  const h = 40 + lines.reduce((a, l) => a + l.length * LH + 6, 0) + 4;
  svg.append(s('rect', { x, y, width: w, height: h, rx: 6, class: 'dg-callout' }), s('text', { x: x + 14, y: y + 21, class: 'dg-tier' }, 'AT SENTENCING, THE JUDGE'));
  let yy = y + 42;
  lines.forEach((l, i) => {
    svg.append(s('text', { x: x + 14, y: yy, class: 'dg-substep-num' }, `${String.fromCharCode(97 + i)}.`), textLines(l, x + 31, yy, LH, { class: 'dg-box-sub dg-box-sub--left' }));
    yy += l.length * LH + 6;
  });
  return h;
}

function lifecycleWide(W: number): SVGSVGElement {
  const svg = svgRoot('diagram--lifecycle', 'lc-title', 'The life cycle of a federal criminal case', LC_DESC);
  svg.append(arrowDefs());
  const cols = 5;
  const gap = 24;
  const bw = (W - gap * (cols - 1)) / cols;
  const x = (i: number) => i * (bw + gap);
  const m = STEPS.map((st) => measureStep(st, bw));
  const row1 = Math.max(...m.slice(0, 5).map((v) => v.h));
  const row2 = Math.max(...m.slice(5).filter((_, i) => i !== 1).map((v) => v.h), measureBranch(bw).h);

  const phase = (text: string, x0: number, x1: number, y: number, end = false) =>
    svg.append(
      s('text', { x: end ? x1 : x0, y, class: 'dg-tier', 'text-anchor': end ? 'end' : 'start' }, text.toUpperCase()),
      s('path', { d: `M${x0} ${y + 7}H${x1}`, class: 'dg-phase-rule' }),
    );

  const y1 = 26;
  phase('Investigation and charging', x(0), x(1) + bw, 12);
  phase('First hearings', x(2), x(4) + bw, 12);
  for (let i = 0; i < 5; i++) {
    drawStep(svg, STEPS[i]!, m[i]!, x(i), y1, bw, row1);
    if (i < 4) arrow(svg, `M${x(i) + bw + 3} ${y1 + row1 / 2}H${x(i + 1) - 3}`);
  }
  // Wrap connector: from the bottom of step 5, back left above the row-2 labels,
  // then down into step 6. The first row-2 label is right-aligned so the line
  // never crosses text.
  const yConn = y1 + row1 + 16;
  const yPhase2 = yConn + 28;
  const y2 = yPhase2 + 16;
  const xIn = x(0) + 28;
  arrow(svg, `M${x(4) + bw / 2} ${y1 + row1 + 2}V${yConn}H${xIn}V${y2 - 3}`);
  phase('Pretrial and resolution', xIn + 12, x(1) + bw, yPhase2, true);
  phase('Sentencing and appeal', x(2), x(4) + bw, yPhase2);
  drawStep(svg, STEPS[5]!, m[5]!, x(0), y2, bw, row2);
  arrow(svg, `M${x(0) + bw + 3} ${y2 + row2 / 2}H${x(1) - 3}`);
  drawBranch(svg, x(1), y2, bw, row2);
  arrow(svg, `M${x(1) + bw + 3} ${y2 + row2 / 2}H${x(2) - 3}`);
  for (let i = 7; i < 10; i++) {
    drawStep(svg, STEPS[i]!, m[i]!, x(i - 5), y2, bw, row2);
    if (i < 9) arrow(svg, `M${x(i - 5) + bw + 3} ${y2 + row2 / 2}H${x(i - 4) - 3}`);
  }
  const cy = y2 + row2 + 24;
  svg.append(s('path', { d: `M${x(3) + bw / 2} ${y2 + row2}V${cy}`, class: 'dg-line dg-line--dash' }));
  const ch = sentencingCallout(svg, x(2), cy, x(4) + bw - x(2), true);
  return size(svg, W, cy + ch + 2);
}

function lifecycleNarrow(W: number): SVGSVGElement {
  const svg = svgRoot('diagram--lifecycle', 'lc-title-n', 'The life cycle of a federal criminal case', LC_DESC);
  svg.append(arrowDefs());
  const gap = 20;
  let y = 2;
  STEPS.forEach((st, i) => {
    let h: number;
    if (st.n === '7') {
      h = measureBranch(W).h;
      drawBranch(svg, 0, y, W, h);
    } else {
      const m = measureStep(st, W);
      h = m.h;
      drawStep(svg, st, m, 0, y, W, h);
    }
    if (st.n === '9') {
      const cy = y + h + 12;
      svg.append(s('path', { d: `M${W - 30} ${y + h}V${cy}`, class: 'dg-line dg-line--dash' }));
      const ch = sentencingCallout(svg, 22, cy, W - 22, false);
      h += 12 + ch;
    }
    if (i < STEPS.length - 1) arrow(svg, `M${36} ${y + h + 3}V${y + h + gap - 3}`);
    y += h + gap;
  });
  return size(svg, W, y - gap + 2);
}

/* ---- (c) Circuit map -------------------------------------------------- */

// Four equal-weight tints assigned so that no two neighboring circuits share one.
// (Hand-checked against circuit adjacency; tints are categorical, not a data scale.)
const CIRCUIT_TONE: Record<string, number> = { '1': 1, '2': 0, '3': 2, '4': 1, '5': 0, '6': 3, '7': 1, '8': 2, '9': 0, '10': 1, '11': 2, DC: 3 };

export function renderCircuitMap(g: AtlasGeometry): SVGSVGElement {
  const svg = s('svg', {
    class: 'circuit-map',
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    role: 'img',
    'aria-label': 'Map of the 12 regional federal circuits. Each circuit is a group of neighboring districts; numbers label the circuits.',
  });
  const circuitOfState = new Map<string, string>();
  for (const d of DISTRICTS) circuitOfState.set(d.state, d.circuit);
  const proj = atlasProjection();
  for (const r of proj.regions) {
    if (!r.box) continue;
    const [[x0, y0], [x1, y1]] = r.box;
    svg.append(s('rect', { class: 'inset-frame', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 3 }));
  }
  const sums = new Map<string, { x: number; y: number; a: number }>();
  let dc: [number, number] | null = null;
  for (const d of g.districts) {
    const c = d.circuit || circuitOfState.get(d.state) || '';
    if (!c) continue;
    const p = s('path', { d: d.d, class: `circuit-fill tone-${CIRCUIT_TONE[c] ?? 0}` });
    p.append(s('title', null, `${d.name}: ${circuitLabel(c)}`));
    svg.append(p);
    if (c === 'DC') dc = d.centroid;
    if (d.region === 'lower48') {
      const acc = sums.get(c) ?? { x: 0, y: 0, a: 0 };
      acc.x += d.centroid[0] * d.area;
      acc.y += d.centroid[1] * d.area;
      acc.a += d.area;
      sums.set(c, acc);
    }
  }
  if (g.stateMesh) svg.append(s('path', { d: g.stateMesh, class: 'circuit-states' }));
  if (g.kind === 'districts' && g.topology.objects.districts) {
    let d = '';
    const obj = g.topology.objects.districts as GeometryCollection;
    const circuitOf = (o: GeometryObject) => g.byId.get(String(o.id))?.circuit ?? '';
    for (const r of proj.regions) {
      const m = mesh(g.topology, obj, (a: GeometryObject, b: GeometryObject) => a !== b && circuitOf(a) !== circuitOf(b) && g.byId.get(String(a.id))?.region === r.id) as MultiLineString;
      if (m.coordinates.length) d += proj.path(r.id)(m) ?? '';
    }
    svg.append(s('path', { d, class: 'circuit-borders' }));
  }
  // Circuit numbers in badges at area-weighted centroids (lower 48), nudged off busy spots.
  const nudge: Record<string, [number, number]> = { '1': [8, 14], '2': [-4, 8], '3': [-2, 4] };
  for (const [c, acc] of sums) {
    let x = acc.x / acc.a;
    let y = acc.y / acc.a;
    if (c === 'DC' && dc) {
      // D.C. is too small to label in place: badge offshore with a leader line.
      x = dc[0] + 60;
      y = dc[1] + 22;
      svg.append(s('path', { d: `M${dc[0]} ${dc[1]}L${x - 18} ${y - 4}`, class: 'circuit-leader' }), s('circle', { cx: dc[0], cy: dc[1], r: 2.5, class: 'circuit-dc-dot' }));
    } else {
      const n = nudge[c];
      if (n) {
        x += n[0];
        y += n[1];
      }
    }
    const label = c === 'DC' ? 'D.C.' : c;
    const w = c === 'DC' ? 40 : c.length > 1 ? 34 : 26;
    svg.append(
      s('rect', { x: x - w / 2, y: y - 13, width: w, height: 26, rx: 13, class: 'circuit-badge' }),
      s('text', { x, y: y + 5.5, class: 'circuit-badge-text', 'text-anchor': 'middle' }, label),
    );
  }
  return svg;
}

export function circuitMapFigure(g: AtlasGeometry): HTMLElement {
  return h(
    'figure',
    { class: 'learn-figure learn-figure--map' },
    renderCircuitMap(g),
    h(
      'figcaption',
      { class: 'caption' },
      g.kind === 'districts'
        ? 'The 12 regional circuits. Heavier lines mark circuit boundaries. Puerto Rico is in the First Circuit, the Virgin Islands in the Third, and Alaska, Hawaii, Guam and the Northern Mariana Islands in the Ninth.'
        : 'The 12 regional circuits, shown on state outlines (development preview).',
    ),
  );
}
