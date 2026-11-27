// The Courtroom fallback: a 2D floor plan (SVG) drawn from the same layout as the 3D scene.
// Used when WebGL is unavailable or fails. Stations are clickable; keyboard and screen-reader
// users choose seats from the seat list, which works the same with or without WebGL.

import { s } from '../lib/dom.ts';
import { JUROR_CHAIRS, PEW_BANKS, PEW_ROWS, PLAN, ROOM, SEATS, type Rect, type SeatId } from './seats.ts';

export interface FloorPlan {
  el: SVGSVGElement;
  select(id: SeatId | null): void;
  setHover(id: SeatId | null): void;
}

const K = 20; // px per meter
const M = 12; // margin
const X = (x: number): number => (x - ROOM.x0) * K + M;
const Y = (z: number): number => (z - ROOM.z0) * K + M;

function rect(r: Rect, cls: string, rx = 2): SVGRectElement {
  return s('rect', { class: cls, x: X(r.x0), y: Y(r.z0), width: (r.x1 - r.x0) * K, height: (r.z1 - r.z0) * K, rx });
}

function chair(x: number, z: number): SVGCircleElement {
  return s('circle', { class: 'cr-plan__chair', cx: X(x), cy: Y(z), r: 5 });
}

/** Label baselines (x, z in meters), placed clear of the furniture. */
const LABEL_AT: Record<SeatId, [number, number]> = {
  judge: [-1.7, -8.45],
  clerk: [-3.3, -4.4],
  reporter: [1.6, -4.55],
  witness: [4.3, -8.45],
  jury: [6.35, 1.3],
  prosecution: [2.7, 0.4],
  defense: [-2.7, 0.4],
  lectern: [0, -2.25],
  gallery: [0, 2.95],
};

export function createFloorPlan(onPick: (id: SeatId) => void, onHover?: (id: SeatId | null) => void): FloorPlan {
  const W = (ROOM.x1 - ROOM.x0) * K + 2 * M;
  const H = (ROOM.z1 - ROOM.z0) * K + 2 * M;
  const svg = s('svg', {
    class: 'cr-plan',
    viewBox: `0 0 ${W} ${H}`,
    role: 'img',
    'aria-label': 'Floor plan of a federal district courtroom, seen from above, with the judge’s bench at the top and the public gallery at the bottom.',
  });
  svg.append(
    s('rect', { class: 'cr-plan__room', x: M, y: M, width: W - 2 * M, height: H - 2 * M, rx: 4 }),
    s('rect', { class: 'cr-plan__gallery-floor', x: M, y: Y(ROOM.barZ), width: W - 2 * M, height: Y(ROOM.z1) - Y(ROOM.barZ) }),
  );
  // The bar, with its gate.
  svg.append(
    s('line', { class: 'cr-plan__bar', x1: X(ROOM.x0), y1: Y(ROOM.barZ), x2: X(-ROOM.gateHalf), y2: Y(ROOM.barZ) }),
    s('line', { class: 'cr-plan__bar', x1: X(ROOM.gateHalf), y1: Y(ROOM.barZ), x2: X(ROOM.x1), y2: Y(ROOM.barZ) }),
    s('path', {
      class: 'cr-plan__gate',
      d: `M${X(-ROOM.gateHalf)},${Y(ROOM.barZ)} A${ROOM.gateHalf * K},${ROOM.gateHalf * K} 0 0 1 ${X(0)},${Y(ROOM.barZ) - ROOM.gateHalf * K} M${X(ROOM.gateHalf)},${Y(ROOM.barZ)} A${ROOM.gateHalf * K},${ROOM.gateHalf * K} 0 0 0 ${X(0)},${Y(ROOM.barZ) - ROOM.gateHalf * K}`,
    }),
    s('text', { class: 'cr-plan__note', x: X(ROOM.x0) + 6, y: Y(ROOM.barZ) - 6 }, 'The bar'),
    s('text', { class: 'cr-plan__note', x: X(ROOM.x0) + 6, y: Y(ROOM.z0) + 16 }, 'The well'),
  );

  const groups = new Map<SeatId, SVGGElement>();
  const station = (id: SeatId, ...children: SVGElement[]): void => {
    const def = SEATS.find((x) => x.id === id)!;
    const [a, b] = def.hit;
    const g = s('g', { class: 'cr-plan__seat', 'data-seat': id });
    g.append(
      s('rect', { class: 'cr-plan__hit', x: X(a[0]) - 4, y: Y(a[2]) - 4, width: (b[0] - a[0]) * K + 8, height: (b[2] - a[2]) * K + 8, rx: 6 }),
      ...children,
      s('text', { class: 'cr-plan__label', x: X(LABEL_AT[id][0]), y: Y(LABEL_AT[id][1]), 'text-anchor': 'middle' }, def.short),
    );
    g.addEventListener('click', () => onPick(id));
    g.addEventListener('pointerenter', () => onHover?.(id));
    g.addEventListener('pointerleave', () => onHover?.(null));
    groups.set(id, g);
    svg.append(g);
  };

  station('judge', rect(PLAN.benchPlatform as Rect, 'cr-plan__platform'), rect(PLAN.bench as Rect, 'cr-plan__desk'), chair(0, -8.35));
  station('witness', rect(PLAN.witness as Rect, 'cr-plan__desk'), chair(4.35, -7.55));
  station('clerk', rect(PLAN.clerk as Rect, 'cr-plan__desk'), chair(-3.3, -6.1));
  station('reporter', rect(PLAN.reporter as Rect, 'cr-plan__platform'), chair(1.6, -6.05));
  station('jury', rect(PLAN.juryBox as Rect, 'cr-plan__platform'), ...JUROR_CHAIRS.map(([x, , z]) => chair(x, z)));
  station('prosecution', rect(PLAN.prosecution as Rect, 'cr-plan__desk'), chair(1.85, -0.42), chair(2.7, -0.42), chair(3.55, -0.42));
  station('defense', rect(PLAN.defense as Rect, 'cr-plan__desk'), chair(-3.55, -0.42), chair(-2.7, -0.42), chair(-1.85, -0.42));
  station('lectern', rect(PLAN.lectern as Rect, 'cr-plan__desk', 1));
  station(
    'gallery',
    ...PEW_ROWS.flatMap((zf) => PEW_BANKS.map(([xa, xb]) => rect({ x0: xa, x1: xb, z0: zf, z1: zf + 0.55 }, 'cr-plan__pew', 1))),
  );

  // Doors.
  svg.append(
    s('rect', { class: 'cr-plan__door', x: X(-1.1), y: Y(ROOM.z1) - 3, width: 2.2 * K, height: 6 }),
    s('text', { class: 'cr-plan__note', x: X(0), y: Y(ROOM.z1) - 8, 'text-anchor': 'middle' }, 'Public entrance'),
  );

  let selected: SeatId | null = null;
  return {
    el: svg,
    select(id) {
      selected = id;
      groups.forEach((g, sid) => g.classList.toggle('is-selected', sid === selected));
    },
    setHover(id) {
      groups.forEach((g, sid) => g.classList.toggle('is-hover', sid === id));
    },
  };
}
