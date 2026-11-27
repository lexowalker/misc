// The Courtroom: a procedural three.js scene of a federal district courtroom.
//
// three.js is imported dynamically inside createCourtroomScene(), and this module itself is
// only ever loaded with `await import()` from src/pages/courtroom.ts, so three.js never ships
// with the map (tests/e2e/perf.spec.ts asserts this). Only `import type` appears at the top.
//
// Everything is built from boxes, cylinders and planes, with canvas-drawn textures
// (src/courtroom/textures.ts). No model, texture or font is fetched.
//
// Rendering is on demand: a frame is drawn only while the camera moves, the controls are
// damping, or something changed. The loop stops while the tab is hidden or the canvas is
// off screen. The overview is a "dollhouse" view: a wall or the ceiling between the camera
// and the room is hidden, so the reader looks into the room from outside it.

import type * as T from 'three';
import { JUROR_CHAIRS, PEW_BANKS, PEW_ROWS, ROOM, SEATS, type SeatDef, type SeatId, type Vec3 } from './seats.ts';
import { bannerCanvas, carpetCanvas, usFlagCanvas, woodGrainCanvas } from './textures.ts';

type Three = typeof import('three');

/** Scene colors, read from CSS custom properties (src/styles/courtroom.css) for the active theme. */
export interface ScenePalette {
  theme: 'light' | 'dark';
  wood: string;
  woodLight: string;
  woodDark: string;
  leather: string;
  carpet: string;
  wall: string;
  ceiling: string;
  brass: string;
  glass: string;
  metal: string;
  paper: string;
  poche: string;
  slab: string;
  highlight: string;
  lamp: string;
}

export interface CourtroomSceneOptions {
  /** Element the canvas is appended to; its size drives the canvas size. */
  container: HTMLElement;
  /** Overlay element for the floating seat labels (pointer-events on the labels only). */
  pinLayer: HTMLElement;
  palette: () => ScenePalette;
  onPick: (id: SeatId) => void;
  onHover?: (id: SeatId | null) => void;
  /** Called once the camera has arrived (after a fly or a cut). */
  onArrive?: (id: SeatId | null) => void;
  /** The WebGL context was lost: the page should switch to its fallback. */
  onContextLost?: () => void;
  reducedMotion: () => boolean;
  /** Keep the drawing buffer (needed for screenshots in automated tests). */
  preserveDrawingBuffer?: boolean;
}

export interface CourtroomScene {
  readonly canvas: HTMLCanvasElement;
  /** Fly (or cut, under reduced motion) to a seat's point of view, or back to the room view. */
  goTo(seat: SeatId | null, opts?: { instant?: boolean }): void;
  /** Highlight a station (e.g. while its button in the seat list is hovered). */
  setHover(id: SeatId | null): void;
  refreshTheme(): void;
  /** Debug and test hook: the current mode and whether a flight is running. */
  state(): { mode: 'overview' | 'pov'; seat: SeatId | null; flying: boolean; frames: number };
  dispose(): void;
}

/** True when the browser can create a WebGL context (checked on a throwaway canvas). */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

type MatKey =
  | 'wood'
  | 'woodLight'
  | 'woodDark'
  | 'leather'
  | 'carpet'
  | 'wall'
  | 'ceiling'
  | 'brass'
  | 'glass'
  | 'metal'
  | 'paper'
  | 'poche'
  | 'slab'
  | 'lamp'
  | 'flagUS'
  | 'flagCourt'
  | 'ceilingLight';

type GroupKey = 'static' | 'wall:bench' | 'wall:left' | 'wall:right' | 'wall:gallery' | 'ceiling' | `seat:${SeatId}`;

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export async function createCourtroomScene(o: CourtroomSceneOptions): Promise<CourtroomScene> {
  const THREE: Three = await import('three');
  const [{ OrbitControls }, { RoomEnvironment }, { mergeGeometries }] = await Promise.all([
    import('three/examples/jsm/controls/OrbitControls.js'),
    import('three/examples/jsm/environments/RoomEnvironment.js'),
    import('three/examples/jsm/utils/BufferGeometryUtils.js'),
  ]);

  /* ---- Renderer --------------------------------------------------------------------------- */

  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: !!o.preserveDrawingBuffer,
  });
  const canvas = renderer.domElement;
  canvas.className = 'cr-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Cap the pixel ratio: 2 at most, 1.5 on touch devices (phones have small, dense screens).
  const dprCap = coarse ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  const shadows = !coarse;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  o.container.append(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRT = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envRT.texture;
  roomEnv.traverse((obj) => {
    const m = obj as T.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => mat.dispose());
    }
  });
  pmrem.dispose();

  /* ---- Textures and materials ------------------------------------------------------------- */

  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (c: HTMLCanvasElement, repeat = true, color = true): T.CanvasTexture => {
    const t = new THREE.CanvasTexture(c);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  const woodTex = tex(woodGrainCanvas(512, 7));
  const woodTex2 = tex(woodGrainCanvas(512, 23));
  const carpetTex = tex(carpetCanvas(256, 11));
  carpetTex.repeat.set(1, 1);
  const flagTex = tex(usFlagCanvas(), false);
  const bannerTex = tex(bannerCanvas(), false);

  const std = (p: T.MeshStandardMaterialParameters): T.MeshStandardMaterial => new THREE.MeshStandardMaterial(p);
  const materials: Record<MatKey, T.MeshStandardMaterial | T.MeshBasicMaterial> = {
    wood: std({ map: woodTex, roughness: 0.52, metalness: 0 }),
    woodLight: std({ map: woodTex2, roughness: 0.42, metalness: 0 }),
    woodDark: std({ map: woodTex, roughness: 0.6, metalness: 0 }),
    leather: std({ roughness: 0.48, metalness: 0 }),
    carpet: std({ map: carpetTex, roughness: 0.96, metalness: 0 }),
    wall: std({ roughness: 0.92, metalness: 0 }),
    ceiling: std({ roughness: 0.95, metalness: 0, transparent: true }),
    brass: std({ roughness: 0.34, metalness: 1 }),
    glass: new THREE.MeshBasicMaterial({}),
    metal: std({ roughness: 0.45, metalness: 0.6 }),
    paper: std({ roughness: 0.85, metalness: 0 }),
    poche: new THREE.MeshBasicMaterial({}),
    slab: std({ roughness: 0.9, metalness: 0 }),
    lamp: new THREE.MeshBasicMaterial({}),
    flagUS: std({ map: flagTex, roughness: 0.8, side: THREE.DoubleSide }),
    flagCourt: std({ map: bannerTex, roughness: 0.8, side: THREE.DoubleSide }),
    ceilingLight: new THREE.MeshBasicMaterial({ transparent: true }),
  };
  // Highlighted variants for station hover: same look plus a soft periwinkle glow.
  const hlMaterials = new Map<MatKey, T.Material>();
  const hlFor = (key: MatKey): T.Material => {
    let m = hlMaterials.get(key);
    if (!m) {
      const base = materials[key];
      m = base.clone();
      hlMaterials.set(key, m);
      applyHighlight(key);
    }
    return m;
  };
  function applyHighlight(key: MatKey): void {
    const base = materials[key];
    const m = hlMaterials.get(key);
    if (!m) return;
    (m as T.MeshStandardMaterial).color.copy((base as T.MeshStandardMaterial).color);
    if ((m as T.MeshStandardMaterial).isMeshStandardMaterial) {
      const pal = o.palette();
      (m as T.MeshStandardMaterial).emissive.set(pal.highlight);
      (m as T.MeshStandardMaterial).emissiveIntensity = pal.theme === 'dark' ? 0.32 : 0.42;
    }
  }

  /* ---- Geometry builder: everything static is merged by group and material ---------------- */

  const buckets = new Map<GroupKey, Map<MatKey, T.BufferGeometry[]>>();
  let xf: T.Matrix4 = new THREE.Matrix4();
  const tmpM = new THREE.Matrix4();

  function push(group: GroupKey, mat: MatKey, geo: T.BufferGeometry, local?: T.Matrix4): void {
    if (local) geo.applyMatrix4(local);
    geo.applyMatrix4(xf);
    let byMat = buckets.get(group);
    if (!byMat) buckets.set(group, (byMat = new Map()));
    let list = byMat.get(mat);
    if (!list) byMat.set(mat, (list = []));
    list.push(geo);
  }

  /** Run `fn` with an extra transform (translation + rotation about y) applied to every part. */
  function at(x: number, y: number, z: number, ry: number, fn: () => void): void {
    const prev = xf;
    xf = prev.clone().multiply(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
    fn();
    xf = prev;
  }

  /** Scale a box's UVs so the texture keeps a constant world size (1 repeat per `texel` m). */
  function scaleBoxUV(geo: T.BufferGeometry, w: number, hgt: number, d: number, texel: number, vertical: boolean): void {
    const uv = geo.getAttribute('uv') as T.BufferAttribute;
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z; four vertices each.
    const dims: Array<[number, number, boolean]> = [
      [d, hgt, true],
      [d, hgt, true],
      [w, d, false],
      [w, d, false],
      [w, hgt, true],
      [w, hgt, true],
    ];
    for (let f = 0; f < 6; f++) {
      const [du, dv, vIsY] = dims[f]!;
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        let u = uv.getX(i) * (du / texel);
        let v = uv.getY(i) * (dv / texel);
        if (vertical && vIsY) [u, v] = [v, u];
        uv.setXY(i, u, v);
      }
    }
    uv.needsUpdate = true;
  }

  /** Axis-aligned box from min/max ranges (in the current transform's local space). */
  function box(
    group: GroupKey,
    mat: MatKey,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    opts: { vertical?: boolean; texel?: number; rx?: number } = {},
  ): void {
    const w = Math.abs(x1 - x0);
    const hh = Math.abs(y1 - y0);
    const d = Math.abs(z1 - z0);
    if (w <= 0 || hh <= 0 || d <= 0) return;
    const geo = new THREE.BoxGeometry(w, hh, d);
    scaleBoxUV(geo, w, hh, d, opts.texel ?? 1.4, !!opts.vertical);
    tmpM.identity();
    if (opts.rx) tmpM.makeRotationX(opts.rx);
    tmpM.setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    push(group, mat, geo, tmpM.clone());
  }

  function cyl(
    group: GroupKey,
    mat: MatKey,
    rTop: number,
    rBottom: number,
    height: number,
    x: number,
    y: number,
    z: number,
    opts: { seg?: number; rx?: number; rz?: number; open?: boolean } = {},
  ): void {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, height, opts.seg ?? 16, 1, !!opts.open);
    const m = new THREE.Matrix4();
    const r = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(opts.rx ?? 0, 0, opts.rz ?? 0));
    m.multiply(new THREE.Matrix4().makeTranslation(x, y, z)).multiply(r).multiply(new THREE.Matrix4().makeTranslation(0, height / 2, 0));
    push(group, mat, geo, m);
  }

  function plane(group: GroupKey, mat: MatKey, w: number, hgt: number, m: T.Matrix4, uvScale?: [number, number]): void {
    const geo = new THREE.PlaneGeometry(w, hgt);
    if (uvScale) {
      const uv = geo.getAttribute('uv') as T.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1]);
    }
    push(group, mat, geo, m);
  }

  const mat4 = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T.Matrix4 =>
    new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).setPosition(x, y, z);

  /* ---- Furniture ------------------------------------------------------------------------- */

  /** An office armchair facing +z, seat at local y = h. */
  function chair(group: GroupKey, h = 0.48, scale = 1, high = false): void {
    const s = scale;
    const backH = high ? 0.95 : 0.55;
    box(group, 'leather', -0.27 * s, 0.27 * s, h - 0.08, h, -0.25 * s, 0.25 * s);
    box(group, 'leather', -0.28 * s, 0.28 * s, h, h + backH * s, -0.33 * s, -0.22 * s, { rx: -0.08 });
    if (high) box(group, 'leather', -0.24 * s, 0.24 * s, h + backH * s - 0.02, h + backH * s + 0.06, -0.33 * s, -0.22 * s, { rx: -0.08 });
    box(group, 'leather', -0.32 * s, -0.27 * s, h + 0.1, h + 0.16, -0.22 * s, 0.16 * s);
    box(group, 'leather', 0.27 * s, 0.32 * s, h + 0.1, h + 0.16, -0.22 * s, 0.16 * s);
    box(group, 'metal', -0.3 * s, -0.29 * s, h - 0.02, h + 0.1, -0.05 * s, 0.05 * s);
    box(group, 'metal', 0.29 * s, 0.3 * s, h - 0.02, h + 0.1, -0.05 * s, 0.05 * s);
    cyl(group, 'metal', 0.025, 0.025, h - 0.14, 0, 0.06, 0, { seg: 10 });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      at(0, 0, 0, a, () => box(group, 'metal', -0.02, 0.02, 0.03, 0.07, 0, 0.3 * s));
    }
  }

  function lamp(group: GroupKey, x: number, y: number, z: number): void {
    cyl(group, 'brass', 0.075, 0.085, 0.025, x, y, z, { seg: 20 });
    cyl(group, 'brass', 0.011, 0.011, 0.34, x, y + 0.025, z, { seg: 8 });
    cyl(group, 'lamp', 0.055, 0.12, 0.13, x, y + 0.33, z, { seg: 20, open: false });
  }

  function mic(group: GroupKey, x: number, y: number, z: number, ry: number): void {
    at(x, y, z, ry, () => {
      cyl(group, 'metal', 0.03, 0.035, 0.02, 0, 0, 0, { seg: 10 });
      cyl(group, 'metal', 0.006, 0.006, 0.3, 0, 0.02, 0, { seg: 6, rx: 0.55 });
      cyl(group, 'metal', 0.014, 0.012, 0.06, 0, 0.27, 0.15, { seg: 8, rx: 1.0 });
    });
  }

  /** A raised wood panel (frame and field) on a wall or desk front, facing +z, at local origin. */
  function panelFront(group: GroupKey, x0: number, x1: number, y0: number, y1: number, z: number, depth = 0.025): void {
    box(group, 'woodLight', x0, x1, y0, y1, z, z + depth * 0.5);
    box(group, 'wood', x0 + 0.06, x1 - 0.06, y0 + 0.06, y1 - 0.06, z + depth * 0.5, z + depth, { vertical: true });
  }

  /* -- Room shell -- */
  const { x0: RX0, x1: RX1, z0: RZ0, z1: RZ1, height: RH } = ROOM;
  const WT = 0.28; // wall thickness, outside the room
  box('static', 'slab', RX0 - WT, RX1 + WT, -0.35, -0.002, RZ0 - WT, RZ1 + WT);
  plane('static', 'carpet', RX1 - RX0, RZ1 - RZ0, mat4(0, 0.001, (RZ0 + RZ1) / 2, -Math.PI / 2), [(RX1 - RX0) / 1.1, (RZ1 - RZ0) / 1.1]);

  // Walls: boxes outside the boundary, each with wainscot, chair rail, baseboard and cornice.
  const WAIN = 1.15;
  function wallDecorZ(group: GroupKey, z: number, dir: 1 | -1, xa: number, xb: number, skip: Array<[number, number]> = []): void {
    // dir: +1 = the wall faces +z (bench wall), -1 = faces -z (gallery wall).
    const zIn = z + dir * 0.0;
    const seg = (a: number, b: number) => {
      if (b - a < 0.05) return;
      const zz0 = dir > 0 ? zIn : zIn - 0.05;
      const zz1 = dir > 0 ? zIn + 0.05 : zIn;
      box(group, 'wood', a, b, 0, WAIN, Math.min(zz0, zz1), Math.max(zz0, zz1));
      const r0 = dir > 0 ? zIn : zIn - 0.08;
      const r1 = dir > 0 ? zIn + 0.08 : zIn;
      box(group, 'woodLight', a, b, WAIN, WAIN + 0.07, r0, r1);
      box(group, 'woodDark', a, b, 0, 0.14, dir > 0 ? zIn : zIn - 0.07, dir > 0 ? zIn + 0.07 : zIn);
    };
    let cur = xa;
    for (const [s0, s1] of [...skip].sort((p, q) => p[0] - q[0])) {
      seg(cur, s0);
      cur = s1;
    }
    seg(cur, xb);
    box(group, 'woodLight', xa, xb, RH - 0.22, RH, dir > 0 ? zIn : zIn - 0.14, dir > 0 ? zIn + 0.14 : zIn);
  }
  function wallDecorX(group: GroupKey, x: number, dir: 1 | -1, za: number, zb: number, skip: Array<[number, number]> = []): void {
    const seg = (a: number, b: number) => {
      if (b - a < 0.05) return;
      box(group, 'wood', dir > 0 ? x : x - 0.05, dir > 0 ? x + 0.05 : x, 0, WAIN, a, b);
      box(group, 'woodLight', dir > 0 ? x : x - 0.08, dir > 0 ? x + 0.08 : x, WAIN, WAIN + 0.07, a, b);
      box(group, 'woodDark', dir > 0 ? x : x - 0.07, dir > 0 ? x + 0.07 : x, 0, 0.14, a, b);
    };
    let cur = za;
    for (const [s0, s1] of [...skip].sort((p, q) => p[0] - q[0])) {
      seg(cur, s0);
      cur = s1;
    }
    seg(cur, zb);
    box(group, 'woodLight', dir > 0 ? x : x - 0.14, dir > 0 ? x + 0.14 : x, RH - 0.22, RH, za, zb);
  }

  // Bench wall (z = RZ0), facing +z: never hidden in the allowed views.
  {
    const g: GroupKey = 'wall:bench';
    box(g, 'wall', RX0 - WT, RX1 + WT, 0, RH, RZ0 - WT, RZ0);
    box(g, 'poche', RX0 - WT, RX1 + WT, RH, RH + 0.02, RZ0 - WT, RZ0);
    wallDecorZ(g, RZ0, 1, RX0, RX1, [[-4.3, 4.3]]);
    // Full-height paneling behind the bench.
    box(g, 'woodDark', -4.3, 4.3, 0, 5.3, RZ0, RZ0 + 0.04);
    for (let i = 0; i < 5; i++) {
      const xa = -4.1 + i * 1.66;
      panelFront(g, xa, xa + 1.5, 0.75, 2.6, RZ0 + 0.04, 0.03);
      if (i !== 2) panelFront(g, xa, xa + 1.5, 2.75, 5.0, RZ0 + 0.04, 0.03);
    }
    box(g, 'woodLight', -4.45, 4.45, 5.3, 5.45, RZ0, RZ0 + 0.16);
    for (const px of [-4.4, 4.4]) box(g, 'woodLight', px - 0.13, px + 0.13, 0, 5.3, RZ0, RZ0 + 0.12, { vertical: true });
    // The seal: concentric discs and a ring of thirteen brass studs (no lettering).
    const sealZ = RZ0 + 0.07;
    cyl(g, 'brass', 0.82, 0.82, 0.05, 0, 3.95, sealZ - 0.025, { seg: 48, rx: Math.PI / 2 });
    cyl(g, 'leather', 0.7, 0.7, 0.03, 0, 3.95, sealZ + 0.01, { seg: 48, rx: Math.PI / 2 });
    cyl(g, 'brass', 0.5, 0.5, 0.012, 0, 3.95, sealZ + 0.03, { seg: 48, rx: Math.PI / 2 });
    cyl(g, 'leather', 0.47, 0.47, 0.012, 0, 3.95, sealZ + 0.036, { seg: 48, rx: Math.PI / 2 });
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2;
      const geo = new THREE.SphereGeometry(0.028, 10, 8);
      push(g, 'brass', geo, mat4(Math.cos(a) * 0.6, 3.95 + Math.sin(a) * 0.6, sealZ + 0.03));
    }
    {
      const geo = new THREE.SphereGeometry(0.16, 24, 16);
      geo.scale(1, 1, 0.3);
      push(g, 'brass', geo, mat4(0, 3.95, sealZ + 0.05));
    }
    // Chambers door.
    box(g, 'woodDark', -6.7, -5.5, 0, 2.45, RZ0, RZ0 + 0.06);
    panelFront(g, -6.6, -5.6, 0.2, 1.2, RZ0 + 0.06, 0.02);
    panelFront(g, -6.6, -5.6, 1.35, 2.3, RZ0 + 0.06, 0.02);
    box(g, 'brass', -5.68, -5.6, 1.0, 1.06, RZ0 + 0.08, RZ0 + 0.12);
  }

  // Gallery wall (z = RZ1), facing -z, with the public doors.
  {
    const g: GroupKey = 'wall:gallery';
    box(g, 'wall', RX0 - WT, RX1 + WT, 0, RH, RZ1, RZ1 + WT);
    box(g, 'poche', RX0 - WT, RX1 + WT, RH, RH + 0.02, RZ1, RZ1 + WT);
    wallDecorZ(g, RZ1, -1, RX0, RX1, [[-1.25, 1.25]]);
    box(g, 'woodLight', -1.25, 1.25, 0, 3.05, RZ1 - 0.08, RZ1);
    box(g, 'woodDark', -1.1, -0.02, 0, 2.75, RZ1 - 0.1, RZ1 - 0.05);
    box(g, 'woodDark', 0.02, 1.1, 0, 2.75, RZ1 - 0.1, RZ1 - 0.05);
    box(g, 'brass', -0.3, -0.1, 1.0, 1.35, RZ1 - 0.12, RZ1 - 0.1);
    box(g, 'brass', 0.1, 0.3, 1.0, 1.35, RZ1 - 0.12, RZ1 - 0.1);
    for (const px of [-6, -3.5, 3.5, 6]) box(g, 'woodLight', px - 0.12, px + 0.12, 0, RH, RZ1 - 0.1, RZ1, { vertical: true });
  }

  // Left wall (x = RX0), facing +x, with tall windows.
  const WINDOWS_Z = [-6.2, -1.8, 2.6, 7.0];
  {
    const g: GroupKey = 'wall:left';
    box(g, 'wall', RX0 - WT, RX0, 0, RH, RZ0 - WT, RZ1 + WT);
    box(g, 'poche', RX0 - WT, RX0, RH, RH + 0.02, RZ0 - WT, RZ1 + WT);
    wallDecorX(g, RX0, 1, RZ0, RZ1);
    for (const wz of WINDOWS_Z) {
      const za = wz - 0.8;
      const zb = wz + 0.8;
      const y0 = 1.65;
      const y1 = 5.2;
      plane(g, 'glass', zb - za, y1 - y0, mat4(RX0 + 0.012, (y0 + y1) / 2, wz, 0, Math.PI / 2));
      box(g, 'woodLight', RX0, RX0 + 0.12, y0 - 0.1, y0, za - 0.1, zb + 0.1);
      box(g, 'woodLight', RX0, RX0 + 0.1, y1, y1 + 0.12, za - 0.1, zb + 0.1);
      box(g, 'woodLight', RX0, RX0 + 0.1, y0, y1, za - 0.1, za, { vertical: true });
      box(g, 'woodLight', RX0, RX0 + 0.1, y0, y1, zb, zb + 0.1, { vertical: true });
      box(g, 'woodLight', RX0, RX0 + 0.05, y0, y1, wz - 0.025, wz + 0.025, { vertical: true });
      for (const fy of [2.85, 4.05]) box(g, 'woodLight', RX0, RX0 + 0.05, fy - 0.02, fy + 0.02, za, zb);
    }
    for (const pz of [-8.6, -4.0, 0.4, 4.8, 9.6]) box(g, 'woodLight', RX0, RX0 + 0.1, 0, RH, pz - 0.13, pz + 0.13, { vertical: true });
  }

  // Right wall (x = RX1), facing -x, behind the jury box, with the jury room door.
  {
    const g: GroupKey = 'wall:right';
    box(g, 'wall', RX1, RX1 + WT, 0, RH, RZ0 - WT, RZ1 + WT);
    box(g, 'poche', RX1, RX1 + WT, RH, RH + 0.02, RZ0 - WT, RZ1 + WT);
    wallDecorX(g, RX1, -1, RZ0, RZ1, [[0.85, 1.95]]);
    box(g, 'woodDark', RX1 - 0.06, RX1, 0, 2.45, 0.85, 1.95);
    box(g, 'brass', RX1 - 0.1, RX1 - 0.06, 1.0, 1.06, 1.05, 1.13);
    // Tall wood paneling behind the jury box.
    box(g, 'woodDark', RX1 - 0.04, RX1, 0, 3.2, -6.0, 0.7);
    for (let i = 0; i < 4; i++) {
      const za = -5.85 + i * 1.6;
      box(g, 'woodLight', RX1 - 0.055, RX1 - 0.04, 1.3, 3.0, za, za + 1.45);
      box(g, 'wood', RX1 - 0.07, RX1 - 0.055, 1.36, 2.94, za + 0.06, za + 1.39, { vertical: true });
    }
    box(g, 'woodLight', RX1 - 0.14, RX1, 3.2, 3.32, -6.05, 0.75);
    for (const pz of [-8.0, 3.6, 7.6]) box(g, 'woodLight', RX1 - 0.1, RX1, 0, RH, pz - 0.13, pz + 0.13, { vertical: true });
  }

  // Ceiling: plaster, coffer beams and recessed lights. Fades out when the camera rises above it.
  {
    const g: GroupKey = 'ceiling';
    plane(g, 'ceiling', RX1 - RX0, RZ1 - RZ0, mat4(0, RH, (RZ0 + RZ1) / 2, Math.PI / 2));
    for (let x = RX0 + 4; x < RX1; x += 4) box(g, 'ceiling', x - 0.12, x + 0.12, RH - 0.28, RH, RZ0, RZ1);
    for (let z = RZ0 + 3.6; z < RZ1; z += 3.6) box(g, 'ceiling', RX0, RX1, RH - 0.28, RH, z - 0.12, z + 0.12);
    for (let x = RX0 + 2; x < RX1; x += 4) {
      for (let z = RZ0 + 1.8; z < RZ1; z += 3.6) {
        const geo = new THREE.CircleGeometry(0.22, 24);
        push(g, 'ceilingLight', geo, mat4(x, RH - 0.005, z, Math.PI / 2));
      }
    }
  }

  /* -- The judge's bench -- */
  {
    const g: GroupKey = 'seat:judge';
    const P = 0.6;
    box(g, 'woodDark', -3.4, 3.4, 0, P, -9.6, -6.6);
    plane(g, 'carpet', 6.7, 2.9, mat4(0, P + 0.002, -8.1, -Math.PI / 2), [6.7 / 1.1, 2.9 / 1.1]);
    // Front panel with five raised panels, overhanging top, sides and the desk.
    box(g, 'wood', -3.2, 3.2, P, 1.5, -7.0, -6.86);
    for (let i = 0; i < 5; i++) {
      const xa = -3.08 + i * 1.25;
      panelFront(g, xa, xa + 1.16, P + 0.14, 1.36, -6.86, 0.03);
    }
    box(g, 'woodLight', -3.32, 3.32, 1.5, 1.56, -7.12, -6.76);
    box(g, 'wood', -3.2, -3.06, P, 1.5, -7.9, -6.86);
    box(g, 'wood', 3.06, 3.2, P, 1.5, -7.9, -6.86);
    box(g, 'woodLight', -3.06, 3.06, 1.3, 1.34, -7.9, -7.0);
    box(g, 'woodDark', -3.06, 3.06, P, 1.3, -7.02, -7.0);
    // Steps up to the bench on the witness side.
    box(g, 'woodDark', 3.4, 3.85, 0, 0.2, -9.4, -8.6);
    box(g, 'woodDark', 3.4, 3.62, 0.2, 0.4, -9.4, -8.6);
    at(0, P, -8.35, 0, () => chair(g, 0.5, 1.08, true));
    lamp(g, -2.1, 1.34, -7.6);
    lamp(g, 2.1, 1.34, -7.6);
    mic(g, 0.95, 1.34, -7.3, -0.5);
    // A monitor and a closed binder on the desk.
    at(-1.0, 1.34, -7.6, 0.2, () => {
      box(g, 'metal', -0.25, 0.25, 0.06, 0.34, -0.02, 0.0);
      box(g, 'metal', -0.03, 0.03, 0, 0.08, -0.06, 0.0);
    });
    box(g, 'leather', 0.9, 1.25, 1.34, 1.38, -7.65, -7.35);
    box(g, 'paper', 0.95, 1.2, 1.38, 1.385, -7.63, -7.38);
  }

  // Flags beside the bench: the U.S. flag at the judge's right (the room's left, seen from the gallery).
  function flag(x: number, mat: MatKey): void {
    const g: GroupKey = 'wall:bench';
    const z = RZ0 + 0.55;
    cyl(g, 'brass', 0.22, 0.26, 0.06, x, 0, z, { seg: 24 });
    cyl(g, 'woodDark', 0.022, 0.022, 2.95, x, 0.06, z, { seg: 10 });
    cyl(g, 'brass', 0.035, 0.035, 0.05, x, 3.0, z, { seg: 12 });
    cyl(g, 'brass', 0.0, 0.05, 0.18, x, 3.05, z, { seg: 12 });
    // Cloth hangs from the staff in soft vertical folds.
    const W = 1.05;
    const H = 1.6;
    const geo = new THREE.PlaneGeometry(W, H, 24, 4);
    const pos = geo.getAttribute('position') as T.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const u = (px + W / 2) / W; // 0 at the staff, 1 at the fly end
      const v = (py + H / 2) / H; // 0 at the bottom
      const zf = Math.sin(u * Math.PI * 5) * 0.06 * u;
      // Gather toward the staff at the bottom, as a draped indoor flag does.
      const xx = u * W * (0.42 + 0.58 * v) * 0.62;
      pos.setXYZ(i, xx, py, zf);
    }
    geo.computeVertexNormals();
    const dirX = x < 0 ? 1 : -1;
    const m = mat4(x, 2.95 - H / 2, z + 0.02, 0, dirX > 0 ? 0 : Math.PI);
    push(g, mat, geo, m);
  }
  flag(-4.75, 'flagUS');
  flag(4.75, 'flagCourt');

  /* -- Courtroom deputy -- */
  {
    const g: GroupKey = 'seat:clerk';
    box(g, 'woodDark', -4.5, -2.1, 0, 0.15, -6.6, -5.0);
    box(g, 'wood', -4.4, -2.2, 0.15, 1.1, -5.18, -5.08);
    panelFront(g, -4.32, -3.33, 0.3, 0.98, -5.08, 0.025);
    panelFront(g, -3.27, -2.28, 0.3, 0.98, -5.08, 0.025);
    box(g, 'woodLight', -4.46, -2.14, 1.1, 1.15, -5.24, -5.02);
    box(g, 'woodLight', -4.4, -2.2, 0.86, 0.9, -5.9, -5.18);
    box(g, 'wood', -4.4, -4.3, 0.15, 1.1, -5.9, -5.18);
    box(g, 'wood', -2.3, -2.2, 0.15, 1.1, -5.9, -5.18);
    at(-3.7, 0.9, -5.5, -0.2, () => {
      box(g, 'metal', -0.27, 0.27, 0.06, 0.38, -0.02, 0.0);
      box(g, 'metal', -0.03, 0.03, 0, 0.08, -0.06, 0.0);
    });
    box(g, 'paper', -3.05, -2.75, 0.9, 0.93, -5.75, -5.45);
    lamp(g, -4.15, 0.9, -5.55);
    at(-3.3, 0.15, -6.1, 0, () => chair(g, 0.47, 1));
  }

  /* -- Court reporter -- */
  {
    const g: GroupKey = 'seat:reporter';
    at(1.6, 0, -6.05, -0.25, () => {
      chair(g, 0.5, 0.92);
      // Stenotype machine on its tripod.
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const lx = Math.sin(a) * 0.14;
        const lz = 0.5 + Math.cos(a) * 0.14;
        cyl(g, 'metal', 0.008, 0.008, 0.66, lx, 0, lz, { seg: 6, rx: -Math.cos(a) * 0.2, rz: Math.sin(a) * 0.2 });
      }
      box(g, 'metal', -0.12, 0.12, 0.64, 0.7, 0.4, 0.6, { rx: -0.25 });
      box(g, 'leather', -0.1, 0.1, 0.7, 0.72, 0.42, 0.58, { rx: -0.25 });
      // A small side table with a laptop.
      box(g, 'woodLight', 0.42, 0.95, 0.68, 0.72, -0.2, 0.3);
      box(g, 'wood', 0.44, 0.93, 0, 0.68, -0.18, -0.12);
      box(g, 'metal', 0.5, 0.86, 0.72, 0.735, -0.1, 0.16);
    });
  }

  /* -- Witness stand -- */
  {
    const g: GroupKey = 'seat:witness';
    box(g, 'woodDark', 3.6, 5.0, 0, 0.3, -8.2, -6.6);
    plane(g, 'carpet', 1.38, 1.58, mat4(4.3, 0.302, -7.4, -Math.PI / 2));
    box(g, 'wood', 3.6, 5.0, 0.3, 1.25, -6.7, -6.6);
    panelFront(g, 3.7, 4.9, 0.42, 1.12, -6.6, 0.025);
    box(g, 'wood', 3.6, 3.7, 0.3, 1.25, -8.2, -6.6);
    box(g, 'woodLight', 3.55, 5.05, 1.25, 1.31, -6.76, -6.55);
    box(g, 'woodLight', 3.55, 3.75, 1.25, 1.31, -8.25, -6.55);
    box(g, 'woodDark', 4.6, 5.0, 0, 0.15, -6.6, -6.1);
    mic(g, 4.05, 1.31, -6.68, Math.PI - 0.33);
    at(4.35, 0.3, -7.55, -1.0, () => chair(g, 0.47, 1));
  }

  /* -- Jury box -- */
  {
    const g: GroupKey = 'seat:jury';
    box(g, 'woodDark', 5.06, 6.38, 0, 0.12, -5.75, 0.55);
    plane(g, 'carpet', 1.3, 6.28, mat4(5.72, 0.122, -2.6, -Math.PI / 2));
    box(g, 'woodDark', 6.38, 7.72, 0, 0.45, -5.75, 0.55);
    plane(g, 'carpet', 1.32, 6.28, mat4(7.05, 0.452, -2.6, -Math.PI / 2));
    box(g, 'wood', 4.98, 5.08, 0, 0.98, -5.82, 0.62);
    for (let i = 0; i < 4; i++) {
      const za = -5.7 + i * 1.58;
      box(g, 'woodLight', 4.955, 4.98, 0.16, 0.86, za, za + 1.46);
      box(g, 'wood', 4.94, 4.955, 0.22, 0.8, za + 0.06, za + 1.4, { vertical: true });
    }
    box(g, 'woodLight', 4.93, 5.13, 0.98, 1.04, -5.86, 0.66);
    for (const ez of [-5.82, 0.55]) {
      box(g, 'wood', 5.08, 7.72, 0, 0.98, ez, ez + 0.07);
      box(g, 'woodLight', 5.08, 7.75, 0.98, 1.04, ez - 0.02, ez + 0.09);
    }
    for (const [cx, cy, cz] of JUROR_CHAIRS) at(cx, cy, cz, -Math.PI / 2, () => chair(g, 0.47, 0.95));
  }

  /* -- Counsel tables -- */
  function counselTable(g: GroupKey, cx: number): void {
    const x0 = cx - 1.3;
    const x1 = cx + 1.3;
    box(g, 'woodLight', x0, x1, 0.72, 0.77, -1.92, -0.88);
    box(g, 'wood', x0 + 0.05, x1 - 0.05, 0.08, 0.72, -1.9, -1.85);
    box(g, 'wood', x0 + 0.05, x0 + 0.1, 0, 0.72, -1.9, -0.95);
    box(g, 'wood', x1 - 0.1, x1 - 0.05, 0, 0.72, -1.9, -0.95);
    box(g, 'paper', cx - 0.75, cx - 0.47, 0.77, 0.78, -1.45, -1.1);
    box(g, 'paper', cx + 0.15, cx + 0.43, 0.77, 0.78, -1.5, -1.12);
    box(g, 'paper', cx + 0.6, cx + 0.88, 0.77, 0.8, -1.62, -1.32);
    box(g, 'metal', cx - 0.25, cx + 0.08, 0.77, 0.785, -1.35, -1.1);
    mic(g, cx, 0.77, -1.75, Math.PI);
    lamp(g, cx + (cx > 0 ? 1.05 : -1.05), 0.77, -1.7);
    for (const dx of [-0.85, 0, 0.85]) at(cx + dx, 0, -0.42, Math.PI, () => chair(g, 0.47, 1));
  }
  counselTable('seat:prosecution', 2.7);
  counselTable('seat:defense', -2.7);

  /* -- Lectern -- */
  {
    const g: GroupKey = 'seat:lectern';
    box(g, 'wood', -0.3, 0.3, 0, 1.0, -3.33, -2.87, { vertical: true });
    box(g, 'woodDark', -0.34, 0.34, 0, 0.08, -3.37, -2.83);
    box(g, 'woodLight', -0.36, 0.36, 1.0, 1.06, -3.42, -2.8, { rx: 0.22 });
    panelFront(g, -0.22, 0.22, 0.2, 0.86, -2.87, 0.02);
    mic(g, 0.18, 1.06, -3.28, Math.PI);
  }

  /* -- The bar and the gallery -- */
  {
    const g: GroupKey = 'static';
    const z = ROOM.barZ;
    const gh = ROOM.gateHalf;
    const rail = (a: number, b: number) => {
      box(g, 'woodLight', a, b, 0.94, 1.0, z - 0.07, z + 0.07);
      box(g, 'woodLight', a, b, 0.08, 0.15, z - 0.05, z + 0.05);
      for (let x = a + 0.12; x < b - 0.06; x += 0.16) box(g, 'wood', x - 0.022, x + 0.022, 0.15, 0.94, z - 0.022, z + 0.022, { vertical: true });
      for (let x = a; x <= b + 0.01; x += (b - a) / Math.max(1, Math.round((b - a) / 1.8))) {
        box(g, 'woodLight', x - 0.06, x + 0.06, 0, 1.06, z - 0.06, z + 0.06, { vertical: true });
      }
    };
    rail(RX0, -gh);
    rail(gh, RX1);
    // The swinging gate, closed.
    for (const [a, b] of [
      [-gh + 0.04, -0.01],
      [0.01, gh - 0.04],
    ] as const) {
      box(g, 'woodLight', a, b, 0.86, 0.92, z - 0.04, z + 0.04);
      box(g, 'woodLight', a, b, 0.12, 0.18, z - 0.04, z + 0.04);
      for (let x = a + 0.1; x < b - 0.05; x += 0.16) box(g, 'wood', x - 0.02, x + 0.02, 0.18, 0.86, z - 0.02, z + 0.02, { vertical: true });
    }
  }
  {
    const g: GroupKey = 'seat:gallery';
    for (const zf of PEW_ROWS) {
      for (const [xa, xb] of PEW_BANKS) {
        box(g, 'woodLight', xa, xb, 0.42, 0.47, zf, zf + 0.46);
        box(g, 'wood', xa, xb, 0.22, 0.42, zf + 0.02, zf + 0.05);
        box(g, 'wood', xa, xb, 0.47, 0.98, zf + 0.46, zf + 0.52, { rx: 0.1 });
        box(g, 'woodLight', xa, xb, 0.98, 1.02, zf + 0.5, zf + 0.58);
        box(g, 'wood', xa - 0.05, xa, 0, 1.0, zf - 0.02, zf + 0.6, { vertical: true });
        box(g, 'wood', xb, xb + 0.05, 0, 1.0, zf - 0.02, zf + 0.6, { vertical: true });
      }
    }
  }

  /* ---- Merge buckets into meshes ---------------------------------------------------------- */

  const groups = new Map<GroupKey, T.Group>();
  const stationMeshes = new Map<SeatId, Array<{ mesh: T.Mesh; key: MatKey }>>();
  for (const [gk, byMat] of buckets) {
    const grp = new THREE.Group();
    grp.name = gk;
    for (const [mk, geos] of byMat) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((gg) => gg.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, materials[mk]);
      const isWallish = gk.startsWith('wall:') || gk === 'ceiling';
      mesh.receiveShadow = shadows && mk !== 'glass' && mk !== 'lamp' && mk !== 'ceilingLight' && mk !== 'poche';
      mesh.castShadow = shadows && !isWallish && mk !== 'carpet' && mk !== 'lamp' && !(gk === 'static' && mk === 'slab');
      grp.add(mesh);
      if (gk.startsWith('seat:')) {
        const id = gk.slice(5) as SeatId;
        let list = stationMeshes.get(id);
        if (!list) stationMeshes.set(id, (list = []));
        list.push({ mesh, key: mk });
      }
    }
    groups.set(gk, grp);
    scene.add(grp);
  }
  buckets.clear();

  /* ---- Lights ------------------------------------------------------------------------------ */

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-15, 13, 1);
  key.target.position.set(0, 0, -1.5);
  scene.add(key, key.target);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -15;
    sc.right = 15;
    sc.top = 15;
    sc.bottom = -15;
    sc.near = 2;
    sc.far = 50;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 3;
  }
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(10, 9, 16);
  scene.add(fill);
  const lampLights = [
    new THREE.PointLight(0xffd9a0, 0, 9, 1.6),
    new THREE.PointLight(0xffd9a0, 0, 9, 1.6),
    new THREE.PointLight(0xffd9a0, 0, 7, 1.6),
  ];
  lampLights[0]!.position.set(0, 2.9, -8.9);
  lampLights[1]!.position.set(0, 1.9, -1.2);
  lampLights[2]!.position.set(-3.2, 1.7, -5.4);
  lampLights.forEach((l) => scene.add(l));

  function refreshTheme(): void {
    const p = o.palette();
    const dark = p.theme === 'dark';
    const set = (k: MatKey, c: string) => (materials[k] as T.MeshStandardMaterial).color.set(c);
    set('wood', p.wood);
    set('woodLight', p.woodLight);
    set('woodDark', p.woodDark);
    set('leather', p.leather);
    set('carpet', p.carpet);
    set('wall', p.wall);
    set('ceiling', p.ceiling);
    set('brass', p.brass);
    set('glass', p.glass);
    set('metal', p.metal);
    set('paper', p.paper);
    set('poche', p.poche);
    set('slab', p.slab);
    set('lamp', p.lamp);
    set('ceilingLight', p.lamp);
    set('flagUS', dark ? '#c9c4bb' : '#ffffff');
    set('flagCourt', dark ? '#c9c4bb' : '#ffffff');
    for (const k of hlMaterials.keys()) applyHighlight(k);

    // Dark theme: an evening room lit by its lamps, but lifted enough that the furniture reads on a phone
    // screen (UI audit: the earlier values averaged about 11% luminance across the stage).
    renderer.toneMappingExposure = dark ? 1.05 : 1.0;
    scene.environmentIntensity = dark ? 0.3 : 0.5;
    hemi.color.set(dark ? '#8794c4' : '#fbf7ef');
    hemi.groundColor.set(dark ? '#20160f' : '#6d5642');
    hemi.intensity = dark ? 0.5 : 0.75;
    key.color.set(dark ? '#9fb0ea' : '#fff1dc');
    key.intensity = dark ? 0.5 : 1.55;
    fill.color.set(dark ? '#5d6ca8' : '#e8ecff');
    fill.intensity = dark ? 0.2 : 0.35;
    lampLights.forEach((l, i) => {
      l.intensity = dark ? (i === 0 ? 6 : 4) : 0.5;
    });
    invalidate();
  }

  /* ---- Camera, controls and modes -------------------------------------------------------- */

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 220);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = !o.reducedMotion();
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.minPolarAngle = 0.32;
  controls.maxPolarAngle = 1.3;
  controls.minAzimuthAngle = -1.15;
  controls.maxAzimuthAngle = 1.15;

  let mode: 'overview' | 'pov' = 'overview';
  let seat: SeatId | null = null;
  const lookPoint = new THREE.Vector3();
  // POV look-around offsets (radians) and their eased current values.
  const look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, baseYaw: 0, basePitch: 0, dist: 8 };

  // The room view frames the well (bench to bar) and the front of the gallery; the back rows may crop.
  const overview = { pos: new THREE.Vector3(), target: new THREE.Vector3(0, 0.4, -2.6), fov: 40 };
  const FIT_POINTS = (() => {
    const pts: T.Vector3[] = [];
    for (const x of [RX0, RX1]) for (const y of [0, 2.2]) for (const z of [RZ0, 5.5]) pts.push(new THREE.Vector3(x, y, z));
    pts.push(new THREE.Vector3(0, 4.6, RZ0));
    return pts;
  })();

  function computeOverview(): void {
    const aspect = camera.aspect;
    const portrait = aspect < 1;
    const az = portrait ? 0.26 : 0.5;
    const pol = portrait ? 0.74 : 0.96;
    overview.fov = portrait ? 46 : 38;
    const dir = new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az));
    // Fit: the smallest distance at which every corner of the room is inside the frame.
    const cam = camera.clone();
    cam.fov = overview.fov;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    const v = new THREE.Vector3();
    const fits = (d: number): boolean => {
      cam.position.copy(overview.target).addScaledVector(dir, d);
      cam.lookAt(overview.target);
      cam.updateMatrixWorld(true);
      for (const p of FIT_POINTS) {
        v.copy(p).project(cam);
        if (Math.abs(v.x) > 0.97 || Math.abs(v.y) > 0.93 || v.z > 1) return false;
      }
      return true;
    };
    let lo = 8;
    let hi = 120;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    overview.pos.copy(overview.target).addScaledVector(dir, hi);
    controls.minDistance = hi * 0.6;
    controls.maxDistance = hi * 1.3;
  }

  function povFov(): number {
    // Keep at least ~56 degrees horizontally on narrow screens.
    const minH = 56 * (Math.PI / 180);
    const vFromH = 2 * Math.atan(Math.tan(minH / 2) / Math.max(0.3, camera.aspect));
    return Math.max(52, Math.min(78, (vFromH * 180) / Math.PI));
  }

  function seatDef(id: SeatId): SeatDef {
    return SEATS.find((s) => s.id === id)!;
  }

  function setPovBase(def: SeatDef): void {
    const d = new THREE.Vector3(def.look[0] - def.eye[0], def.look[1] - def.eye[1], def.look[2] - def.eye[2]);
    look.dist = d.length();
    d.normalize();
    look.baseYaw = Math.atan2(d.x, d.z);
    look.basePitch = Math.asin(clamp(d.y, -1, 1));
    look.yaw = look.tYaw = 0;
    look.pitch = look.tPitch = 0;
  }

  function applyPov(): void {
    if (!seat) return;
    const def = seatDef(seat);
    const yaw = look.baseYaw + look.yaw;
    const pitch = look.basePitch + look.pitch;
    camera.position.set(def.eye[0], def.eye[1], def.eye[2]);
    lookPoint.set(
      def.eye[0] + Math.cos(pitch) * Math.sin(yaw) * look.dist,
      def.eye[1] + Math.sin(pitch) * look.dist,
      def.eye[2] + Math.cos(pitch) * Math.cos(yaw) * look.dist,
    );
    camera.lookAt(lookPoint);
  }

  /* ---- Flights ----------------------------------------------------------------------------- */

  interface Flight {
    t0: number;
    dur: number;
    p0: T.Vector3;
    c: T.Vector3;
    p1: T.Vector3;
    l0: T.Vector3;
    l1: T.Vector3;
    f0: number;
    f1: number;
    to: SeatId | null;
  }
  let flight: Flight | null = null;

  function goTo(target: SeatId | null, opts: { instant?: boolean } = {}): void {
    const instant = !!opts.instant || o.reducedMotion();
    if (target && target === seat && mode === 'pov' && !flight) {
      // Already seated here: just face forward again.
      look.tYaw = 0;
      look.tPitch = 0;
      if (instant) {
        look.yaw = look.pitch = 0;
        applyPov();
        invalidate();
      } else requestFrame();
      o.onArrive?.(target);
      return;
    }
    if (!target) orbited = false;
    let p1: T.Vector3;
    let l1: T.Vector3;
    let f1: number;
    if (target) {
      const def = seatDef(target);
      p1 = new THREE.Vector3(...def.eye);
      l1 = new THREE.Vector3(...def.look);
      f1 = povFov();
    } else {
      computeOverview();
      p1 = overview.pos.clone();
      l1 = overview.target.clone();
      f1 = overview.fov;
    }
    controls.enabled = false;
    setHoverInternal(null);
    o.pinLayer.dataset.visible = 'false';
    if (instant) {
      flight = null;
      arrive(target, p1, l1, f1);
      return;
    }
    const p0 = camera.position.clone();
    // Start looking along the current view direction, at a distance comparable to the end.
    const dir0 = new THREE.Vector3().subVectors(lookPoint, p0).normalize();
    const l0 = p0.clone().addScaledVector(dir0, Math.max(3, l1.distanceTo(p1)));
    const dist = p0.distanceTo(p1);
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const lift = clamp(dist * 0.18, 0.5, 3.5);
    mid.y = Math.max(mid.y + lift, Math.max(p0.y, p1.y) + (target && mode === 'pov' ? 0.9 : 0.3));
    flight = {
      t0: performance.now(),
      dur: clamp(900 + dist * 38, 1000, 1900),
      p0,
      c: mid,
      p1,
      l0,
      l1,
      f0: camera.fov,
      f1,
      to: target,
    };
    seat = target;
    requestFrame();
  }

  function arrive(target: SeatId | null, p1: T.Vector3, l1: T.Vector3, f1: number): void {
    flight = null;
    seat = target;
    camera.fov = f1;
    camera.updateProjectionMatrix();
    if (target) {
      mode = 'pov';
      setPovBase(seatDef(target));
      applyPov();
      controls.enabled = false;
    } else {
      mode = 'overview';
      camera.position.copy(p1);
      controls.target.copy(l1);
      lookPoint.copy(l1);
      camera.lookAt(l1);
      controls.enabled = true;
      controls.update();
      o.pinLayer.dataset.visible = 'true';
    }
    invalidate();
    o.onArrive?.(target);
  }

  const bez = new THREE.Vector3();
  function stepFlight(now: number): void {
    const f = flight!;
    const u = clamp((now - f.t0) / f.dur, 0, 1);
    const e = easeInOutCubic(u);
    const a = (1 - e) * (1 - e);
    const b = 2 * (1 - e) * e;
    const c = e * e;
    bez.set(a * f.p0.x + b * f.c.x + c * f.p1.x, a * f.p0.y + b * f.c.y + c * f.p1.y, a * f.p0.z + b * f.c.z + c * f.p1.z);
    camera.position.copy(bez);
    lookPoint.lerpVectors(f.l0, f.l1, e);
    camera.lookAt(lookPoint);
    camera.fov = f.f0 + (f.f1 - f.f0) * e;
    camera.updateProjectionMatrix();
    if (u >= 1) arrive(f.to, f.p1, f.l1, f.f1);
  }

  /* ---- Culling for the dollhouse view ------------------------------------------------------ */

  function updateCulling(): void {
    const p = camera.position;
    const gWall = (k: GroupKey, show: boolean) => {
      const g = groups.get(k);
      if (g) g.visible = show;
    };
    gWall('wall:gallery', p.z <= RZ1);
    gWall('wall:left', p.x >= RX0);
    gWall('wall:right', p.x <= RX1);
    const op = clamp((RH + 0.5 - p.y) / 0.9, 0, 1);
    const ceil = groups.get('ceiling');
    if (ceil) ceil.visible = op > 0.01;
    for (const k of ['ceiling', 'ceilingLight'] as const) {
      const m = materials[k];
      m.opacity = op;
      m.depthWrite = op > 0.98;
    }
  }

  /* ---- Pins (floating labels in the room view) -------------------------------------------- */

  const pins = new Map<SeatId, HTMLElement>();
  for (const s of SEATS) {
    const el = document.createElement('span');
    el.className = 'cr-pin';
    el.dataset.seat = s.id;
    const dot = document.createElement('span');
    dot.className = 'cr-pin__dot';
    const label = document.createElement('span');
    label.className = 'cr-pin__label';
    label.textContent = s.short;
    el.append(dot, label);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      o.onPick(s.id);
    });
    el.addEventListener('pointerenter', () => setHoverInternal(s.id, true));
    el.addEventListener('pointerleave', () => setHoverInternal(null, true));
    o.pinLayer.append(el);
    pins.set(s.id, el);
  }
  o.pinLayer.dataset.visible = 'true';
  const pv = new THREE.Vector3();
  // Label placement priority when labels collide: earlier wins; a later label flips below its
  // dot, and if that collides too it collapses to the dot (its label shows on hover).
  const PIN_PRIORITY: SeatId[] = ['judge', 'jury', 'witness', 'prosecution', 'defense', 'gallery', 'lectern', 'clerk', 'reporter'];
  const pinSize = new Map<SeatId, [number, number]>();
  function updatePins(): void {
    if (mode !== 'overview' || flight) return;
    const w = canvas.clientWidth;
    const hgt = canvas.clientHeight;
    // Read label sizes first (one layout), then write positions.
    for (const id of PIN_PRIORITY) {
      const cached = pinSize.get(id);
      if (!cached || cached[0] === 0) {
        const lab = pins.get(id)!.querySelector<HTMLElement>('.cr-pin__label')!;
        pinSize.set(id, [lab.offsetWidth, lab.offsetHeight]);
      }
    }
    const placed: Array<[number, number, number, number]> = [];
    const hits = (r: [number, number, number, number]) =>
      placed.some((q) => r[0] < q[0] + q[2] + 4 && r[0] + r[2] + 4 > q[0] && r[1] < q[1] + q[3] + 2 && r[1] + r[3] + 2 > q[1]);
    for (const id of PIN_PRIORITY) {
      const s = SEATS.find((x) => x.id === id)!;
      const el = pins.get(id)!;
      pv.set(...s.pin).project(camera);
      const off = pv.z > 1 || Math.abs(pv.x) > 1.05 || Math.abs(pv.y) > 1.05;
      const x = ((pv.x + 1) / 2) * w;
      const y = ((1 - pv.y) / 2) * hgt;
      el.style.visibility = off ? 'hidden' : '';
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (off) continue;
      const [lw, lh] = pinSize.get(id)!;
      const options: Array<['above' | 'below' | 'right' | 'left', [number, number, number, number]]> = [
        ['above', [x - lw / 2, y - 9 - lh, lw, lh]],
        ['below', [x - lw / 2, y + 9, lw, lh]],
        ['right', [x + 9, y - lh / 2, lw, lh]],
        ['left', [x - 9 - lw, y - lh / 2, lw, lh]],
      ];
      const fit = options.find(([, r]) => !hits(r) && r[0] >= 2 && r[0] + r[2] <= w - 2 && r[1] >= 2);
      el.dataset.place = fit ? fit[0] : 'none';
      if (fit) placed.push(fit[1]);
      placed.push([x - 5, y - 5, 10, 10]);
    }
  }

  /* ---- Hover and picking ------------------------------------------------------------------ */

  let hovered: SeatId | null = null;
  function setHoverInternal(id: SeatId | null, notify = false): void {
    if (id === hovered) return;
    const prev = hovered;
    hovered = id;
    for (const [sid, list] of stationMeshes) {
      const on = sid === id && mode === 'overview' && !flight;
      for (const { mesh, key: mk } of list) mesh.material = on ? hlFor(mk) : materials[mk];
    }
    pins.forEach((el, sid) => el.classList.toggle('is-hover', sid === id));
    canvas.style.cursor = id ? 'pointer' : '';
    if (notify && prev !== id) o.onHover?.(id);
    invalidate();
  }

  const hitBoxes = SEATS.map((s) => ({ id: s.id, box: new THREE.Box3(new THREE.Vector3(...s.hit[0]), new THREE.Vector3(...s.hit[1])) }));
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitPoint = new THREE.Vector3();
  function pick(clientX: number, clientY: number): SeatId | null {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    let best: SeatId | null = null;
    let bestD = Infinity;
    for (const hb of hitBoxes) {
      if (mode === 'pov' && hb.id === seat) continue;
      if (raycaster.ray.intersectBox(hb.box, hitPoint)) {
        const d = hitPoint.distanceTo(raycaster.ray.origin);
        if (d < bestD) {
          bestD = d;
          best = hb.id;
        }
      }
    }
    return best;
  }

  let down: { x: number; y: number; lx: number; ly: number; t: number; id: number } | null = null;
  let dragging = false;
  const onPointerDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), id: e.pointerId };
    dragging = false;
    if (mode === 'pov' && !flight) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported */
      }
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    if (down && down.id === e.pointerId) {
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      const mx = e.clientX - down.lx;
      const my = e.clientY - down.ly;
      down.lx = e.clientX;
      down.ly = e.clientY;
      if (!dragging && Math.hypot(dx, dy) > 5) dragging = true;
      if (mode === 'pov' && !flight && dragging) {
        look.tYaw = clamp(look.tYaw + mx * 0.0042, -0.85, 0.85);
        look.tPitch = clamp(look.tPitch + my * 0.0036, -0.38, 0.38);
        if (o.reducedMotion()) {
          look.yaw = look.tYaw;
          look.pitch = look.tPitch;
          applyPov();
          invalidate();
        } else requestFrame();
      }
      return;
    }
    if (e.pointerType === 'mouse' && !flight) hoverAt(e.clientX, e.clientY);
  };
  let hoverQueued = false;
  let hoverXY: [number, number] = [0, 0];
  function hoverAt(x: number, y: number): void {
    hoverXY = [x, y];
    if (hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      if (disposed) return;
      setHoverInternal(mode === 'overview' ? pick(hoverXY[0], hoverXY[1]) : null, true);
      if (mode === 'pov') canvas.style.cursor = pick(hoverXY[0], hoverXY[1]) ? 'pointer' : 'grab';
    });
  }
  const onPointerUp = (e: PointerEvent) => {
    if (!down || down.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 700;
    down = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    if (!dragging && moved < 6 && quick && !flight) {
      const id = pick(e.clientX, e.clientY);
      if (id) o.onPick(id);
    }
    dragging = false;
  };
  const onPointerLeave = () => {
    if (!down) setHoverInternal(null, true);
  };
  // Plain wheel scrolls the page; Ctrl or Cmd + wheel (and pinch) zoom the room view.
  const onWheelCapture = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey) || mode !== 'overview') e.stopPropagation();
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  o.container.addEventListener('wheel', onWheelCapture, { capture: true });
  controls.addEventListener('change', () => invalidate());
  let interacting = false;
  let orbited = false;
  controls.addEventListener('start', () => {
    interacting = true;
    orbited = true;
    setHoverInternal(null, true);
    requestFrame();
  });
  controls.addEventListener('end', () => {
    interacting = false;
    requestFrame();
  });

  /* ---- Loop, visibility, resize ---------------------------------------------------------- */

  let raf = 0;
  let dirty = true;
  let onScreen = true;
  let disposed = false;
  let frames = 0;

  function requestFrame(): void {
    if (raf || disposed || !onScreen || document.hidden) return;
    raf = requestAnimationFrame(tick);
  }
  function invalidate(): void {
    dirty = true;
    requestFrame();
  }
  function tick(now: number): void {
    raf = 0;
    if (disposed) return;
    let keep = false;
    if (flight) {
      stepFlight(now);
      dirty = true;
      keep = !!flight;
    } else if (mode === 'overview') {
      if (controls.enabled && controls.update()) {
        dirty = true;
        keep = true;
      }
      if (interacting) keep = true;
    } else if (mode === 'pov') {
      const k = 0.18;
      const dy = look.tYaw - look.yaw;
      const dp = look.tPitch - look.pitch;
      if (Math.abs(dy) > 1e-4 || Math.abs(dp) > 1e-4) {
        look.yaw += dy * k;
        look.pitch += dp * k;
        applyPov();
        dirty = true;
        keep = true;
      }
    }
    if (dirty) {
      dirty = false;
      updateCulling();
      renderer.render(scene, camera);
      frames++;
      updatePins();
    }
    if (keep) requestFrame();
  }

  function resize(): void {
    const w = Math.max(1, o.container.clientWidth);
    const hgt = Math.max(1, o.container.clientHeight);
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    if (flight) {
      // Let the flight finish; its end pose is recomputed on the next goTo.
    } else if (mode === 'overview') {
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
      computeOverview();
      camera.fov = overview.fov;
      if (orbited) {
        // Keep the reader's orbit angle; take the new fit distance.
        camera.position.copy(controls.target).addScaledVector(dir, overview.pos.distanceTo(overview.target));
      } else {
        camera.position.copy(overview.pos);
      }
      controls.update();
    } else {
      camera.fov = povFov();
    }
    camera.updateProjectionMatrix();
    invalidate();
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(o.container);
  const io =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          onScreen = entries.some((en) => en.isIntersecting);
          if (onScreen) invalidate();
        })
      : null;
  io?.observe(canvas);
  const onVisibility = () => {
    if (!document.hidden) invalidate();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const onLost = (e: Event) => {
    e.preventDefault();
    o.onContextLost?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  // First frame: room view.
  {
    const w = Math.max(1, o.container.clientWidth);
    const hgt = Math.max(1, o.container.clientHeight);
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    computeOverview();
    camera.fov = overview.fov;
    camera.updateProjectionMatrix();
    camera.position.copy(overview.pos);
    controls.target.copy(overview.target);
    lookPoint.copy(overview.target);
    camera.lookAt(overview.target);
    controls.update();
  }
  refreshTheme();

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ro.disconnect();
    io?.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('webglcontextlost', onLost);
    o.container.removeEventListener('wheel', onWheelCapture, { capture: true });
    controls.dispose();
    const disposedSet = new Set<unknown>();
    scene.traverse((obj) => {
      const m = obj as T.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
      }
    });
    for (const m of [...Object.values(materials), ...hlMaterials.values()]) {
      if (disposedSet.has(m)) continue;
      disposedSet.add(m);
      m.dispose();
    }
    [woodTex, woodTex2, carpetTex, flagTex, bannerTex].forEach((t) => t.dispose());
    envRT.dispose();
    scene.clear();
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    pins.forEach((el) => el.remove());
    pins.clear();
  }

  return {
    canvas,
    goTo,
    setHover: (id) => setHoverInternal(id, false),
    refreshTheme,
    state: () => ({ mode, seat, flying: !!flight, frames }),
    dispose,
  };
}

export type { Vec3 };
