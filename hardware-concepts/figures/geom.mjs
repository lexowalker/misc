// Shared drawing helpers for this project's figures.
// Isometric solids come from the vendored Anatomy kit (vendor/anatomy/iso-kit.mjs).
// This file adds: convex prisms along any axis (the kit extrudes only along z),
// part groups with explode vectors, ID callouts, and 2D dimension helpers.
import * as k from "../vendor/anatomy/iso-kit.mjs";
export { k };

const r1 = (v) => Math.round(v * 10) / 10;
const pt = ([x, y]) => `${r1(x)} ${r1(y)}`;
export const pathOf = (pts, closed = false) => (pts.length ? "M" + pts.map(pt).join("L") + (closed ? "Z" : "") : "");

export function viewVec(P) {
  const c = k.cameraOf(P);
  return [c.cosA * c.cosE, c.sinA * c.cosE, c.sinE];
}

function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper = [];
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// A convex prism: a convex 2D polygon in the plane perpendicular to `axis`, swept from s0 to s1.
// axis "x": polygon in (y, z); "y": polygon in (x, z); "z": polygon in (x, y).
export function prism(axis, poly, s0, s1, P, { tone = "hi", crease = "faint", bevelLines = true } = {}) {
  const to3 = (a, b, s) => (axis === "x" ? [s, a, b] : axis === "y" ? [a, s, b] : [a, b, s]);
  const n = poly.length;
  const A = poly.map(([a, b]) => to3(a, b, s0));
  const B = poly.map(([a, b]) => to3(a, b, s1));
  const c = [0, 0, 0];
  [...A, ...B].forEach((v) => { c[0] += v[0] / (2 * n); c[1] += v[1] / (2 * n); c[2] += v[2] / (2 * n); });
  const faces = [A.slice().reverse(), B.slice()];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([A[i], A[j], B[j], B[i]]); }
  const V = viewVec(P);
  const cam = k.cameraOf(P);
  const light = [-cam.sinA, cam.cosA];
  const shades = [[], [], [], []];
  let top = "";
  const edges = [];
  for (const f of faces) {
    const u = f[1].map((v, i) => v - f[0][i]);
    const w = f[2].map((v, i) => v - f[0][i]);
    let nrm = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const fc = [0, 1, 2].map((i) => f.reduce((s, v) => s + v[i], 0) / f.length);
    if (nrm[0] * (fc[0] - c[0]) + nrm[1] * (fc[1] - c[1]) + nrm[2] * (fc[2] - c[2]) < 0) nrm = nrm.map((v) => -v);
    const len = Math.hypot(...nrm) || 1;
    nrm = nrm.map((v) => v / len);
    if (nrm[0] * V[0] + nrm[1] * V[1] + nrm[2] * V[2] <= 1e-6) continue;
    const scr = f.map((v) => k.iso(v, P));
    const d = pathOf(scr, true);
    if (nrm[2] > 0.55) top += d;
    else {
      const h = Math.hypot(nrm[0], nrm[1]) || 1;
      const lit = ((nrm[0] / h) * light[0] + (nrm[1] / h) * light[1] + 1) / 2;
      const sh = Math.min(3, Math.max(0, Math.floor(lit * 4 - (nrm[2] < -0.3 ? 1 : 0))));
      shades[sh].push(d);
    }
    if (bevelLines) edges.push(d);
  }
  const all = [...A, ...B].map((v) => k.iso(v, P));
  const outline = pathOf(hull(all), true);
  const parts = [`<path class="iso-fill" d="${outline}"/>`];
  shades.forEach((list, i) => list.length && parts.push(`<path class="iso-shade" data-shade="${i}" d="${list.join("")}"/>`));
  if (top) parts.push(`<path class="iso-top" d="${top}"/>`);
  if (crease !== "none" && edges.length) parts.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${edges.join("")}"/>`);
  parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${outline}"/>`);
  return `<g class="iso-solid">${parts.join("")}</g>`;
}

export const circle = (cx, cy, r, steps = 28) => Array.from({ length: steps }, (_, i) => [cx + r * Math.cos((i / steps) * 2 * Math.PI), cy + r * Math.sin((i / steps) * 2 * Math.PI)]);
export const rrect = (a0, b0, a1, b1, r, steps = 5) => k.roundedPlan({ x: a0, y: b0, w: a1 - a0, d: b1 - b0, r }, steps);

// A part group. `ex` is the explode vector (world units) along the part's assembly axis.
// `internal` parts fade in as the assembly comes apart (they are hidden inside a housing when assembled).
export const CO = [];
const CO_RE = /<g class="callout[\s\S]*?<\/text><\/g>/g;
export function part(pid, fn, body, { ex = [0, 0, 0], internal = false, lifts = false } = {}) {
  const cos = body.match(CO_RE) || [];
  const rest = body.replace(CO_RE, "");
  if (cos.length) {
    const co = `<g class="part-co" data-pid="${pid}" data-fn="${fn}" data-ex="${ex.join(",")}"${internal ? ' data-internal=""' : ""}>${cos.join("")}</g>`;
    CO.push(lifts ? `<g class="lifts">${co}</g>` : co);
  }
  return `<g class="part" data-pid="${pid}" data-fn="${fn}" data-ex="${ex.join(",")}"${internal ? ' data-internal=""' : ""}>${rest}</g>`;
}
export const flushCallouts = () => `<g class="co-layer">${CO.splice(0).join("")}</g>`;

// ID callout: leader from the part's anchor to a label pill. Lives inside the part group so it travels with it.
export function callout(pid, at, dx, dy, { cls = "" } = {}) {
  const [x, y] = at;
  const lx = x + dx, ly = y + dy;
  const w = 10 + pid.length * 7.2;
  const ex = lx - Math.sign(dx || 1) * 0; // leader ends at pill centre edge
  return `<g class="callout ${cls}" data-pid="${pid}" tabindex="0" role="button" aria-label="Part ${pid}"><path class="co-leader" d="M${r1(x)} ${r1(y)}L${r1(ex)} ${r1(ly)}"/><circle class="co-dot" cx="${r1(x)}" cy="${r1(y)}" r="2"/><rect class="co-pill" x="${r1(lx - w / 2)}" y="${r1(ly - 9)}" width="${r1(w)}" height="18" rx="9"/><text class="co-text" x="${r1(lx)}" y="${r1(ly + 4)}" text-anchor="middle">${pid}</text></g>`;
}

// ---- 2D helpers (side sections, plan views) ----
// kind: "src" sourced (solid, filled arrows), "tgt" design target (solid, open arrows, italic), "meas" needs measurement (dashed).
export function dim(x1, y1, x2, y2, label, kind = "tgt", { off = 0, side = 1, textDx = 0, textDy = 0, ext = true, anchor = "middle", pid } = {}) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const nx = -Math.sin(ang) * off, ny = Math.cos(ang) * off;
  const a = [x1 + nx, y1 + ny], b = [x2 + nx, y2 + ny];
  const mx = (a[0] + b[0]) / 2 + textDx, my = (a[1] + b[1]) / 2 + textDy;
  const exts = ext && off ? `<path class="dim-ext" d="M${r1(x1)} ${r1(y1)}L${r1(a[0] + Math.sign(off) * -Math.sin(ang) * 3)} ${r1(a[1] + Math.sign(off) * Math.cos(ang) * 3)}M${r1(x2)} ${r1(y2)}L${r1(b[0] + Math.sign(off) * -Math.sin(ang) * 3)} ${r1(b[1] + Math.sign(off) * Math.cos(ang) * 3)}"/>` : "";
  const pidAttr = pid ? ` data-pid="${pid}"` : "";
  return `<g class="dim" data-kind="${kind}"${pidAttr}>${exts}<path class="dim-line" d="M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}" marker-start="url(#ar-${kind})" marker-end="url(#ar-${kind})"/><text class="dim-text" x="${r1(mx)}" y="${r1(my)}" text-anchor="${anchor}">${label}</text></g>`;
}

export const markerDefs = () => `<defs>
<marker id="ar-src" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L10 5L0 9Z" class="mk-src"/></marker>
<marker id="ar-tgt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L10 5L0 9" class="mk-tgt"/></marker>
<marker id="ar-meas" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L10 5L0 9" class="mk-meas"/></marker>
<marker id="ar-force" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" class="mk-force"/></marker>
<marker id="ar-haz" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" class="mk-haz"/></marker>
<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V6" class="hatch-line"/></pattern>
<pattern id="hatch-haz" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><path d="M0 0V5" class="hatch-haz"/></pattern>
<pattern id="hatch-sweep" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V7" class="hatch-sweep"/></pattern>
</defs>`;

// Label pill for 2D views (same look as callouts).
export function tag(pid, x, y, ax, ay) {
  return callout(pid, [ax, ay], x - ax, y - ay);
}
