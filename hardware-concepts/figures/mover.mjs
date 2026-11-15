// Tab 2 figures: P-1 lift platform (iso assembled / exploded, lift stroke), the move sequence
// side section, the plan view of the tightest turn with the swept path, and the wheel/threshold study.
import { k, prism, circle, rrect, part, callout, dim, pathOf, flushCallouts } from "./geom.mjs";
import { MOVER as M, climbRatio } from "../content/model.mjs";

const W = 960, H = 600;
const rad = (d) => (d * Math.PI) / 180;
export const LIFT_FRAMES = 11;

export function moverIso() {
  const { L, W: PW } = M.plat;
  const x0 = -L / 2, x1 = L / 2, y0 = -PW / 2, y1 = PW / 2;
  const pts = [...k.boxCorners({ x: x0, y: y0, w: L, d: PW }, -50, 0), ...k.boxCorners({ x: x0, y: y0, w: L, d: PW }, 340, 350), [-270, y0 - 470, 0], [270, y0 - 470, 30], [x1 + 215, y1, 0], [x1 + 120, y1 + 250, 0], [0, y1 + 320, 0]];
  const P = k.fitProjection(pts, W, H, { pad: 46, azimuth: 36, elevation: 30 });
  const at = (p) => k.iso(p, P);
  const S = (p, o) => k.solidSvg(p, o);
  const Ln = (d, o) => k.lineSvg(d, o);
  const o = [];
  o.push(`<path class="iso-halo" d="${k.haloOf({ x: x0, y: y0, w: L, d: PW, r: 20 }, 0, 2, P)}"/>`);

  // M8 ball transfers (under the tray corners)
  const corners = [[x1 - 30, y1 - 30], [x1 - 30, y0 + 30], [x0 + 30, y1 - 30], [x0 + 30, y0 + 30]];
  o.push(part("M8", "motion", corners.map(([x, y]) => S(k.cylinder(x, y, 13, 0, 4, P, 24), { tone: "hi" }) + k.dotsSvg([at([x, y, 4])], { size: 1.2, tone: "hi" })).join("") + callout("M8", at([x1 - 30, y1 - 30, 2]), 24, 74), { ex: [0, 0, -46] }));

  // M6 drive wheels (both sides, centre)
  const wheel = (ys) => prism("y", circle(0, 19, 19, 26), ys[0], ys[1], P, { tone: "hi" }) + Ln(k.segment([0, ys[1], 19], [14, ys[1], 19 + 12.9], P), { tone: "mid" });
  o.push(part("M6", "motion", wheel([-y1 + 6, -y1 + 22]) + callout("M6", at([0, -y1 + 6, 34]), -80, -40), { ex: [0, -110, 0], internal: true }));

  // M9 chassis tray
  o.push(part("M9", "structure", [
    S(k.slabOf({ x: x0, y: y0, w: L, d: PW, r: 20 }, 3, 3, P, 6), { tone: "hi" }),
    S(k.slabOf({ x: x0, y: y0, w: L, d: 10, r: 4 }, 6, 16, P, 3), { tone: "hi" }),
    S(k.slabOf({ x: x0, y: y0, w: 10, d: PW, r: 4 }, 6, 16, P, 3), { tone: "hi" }),
  ].join("")));
  // internals in the tray
  o.push(part("M7", "power", [
    prism("y", circle(0, 19, 10, 18), -y1 + 24, -y1 + 70, P, { tone: "hi" }),
    prism("y", circle(0, 19, 10, 18), y1 - 70, y1 - 24, P, { tone: "hi" }),
    callout("M7", at([0, -y1 + 50, 29]), -150, -20),
  ].join(""), { ex: [0, 0, 0], internal: true }));
  o.push(part("M11", "power", [
    S(k.slabOf({ x: -270, y: -90, w: 130, d: 120, r: 4 }, 6, 6, P, 3), { tone: "hi" }),
    Ln([0, 1, 2].map((i) => k.planOutline({ x: -258 + i * 40, y: -70, w: 28, d: 28, r: 2 }, 12, P, 2)).join(""), { tone: "mid" }),
    callout("M11", at([-205, -90, 12]), -50, -60),
  ].join(""), { ex: [0, -470, 20], internal: true }));
  o.push(part("M10", "power", [
    S(k.slabOf({ x: 120, y: -60, w: 150, d: 120, r: 6 }, 6, 22, P, 4), { tone: "hi" }),
    Ln(k.planOutline({ x: 130, y: -50, w: 50, d: 30, r: 2 }, 28, P, 2), { tone: "mid" }),
    callout("M10", at([195, -60, 28]), 30, -80),
  ].join(""), { ex: [0, -40, 150], internal: true }));
  o.push(part("M5", "power", [
    prism("x", circle(0, 16, 12, 20), -50, 40, P, { tone: "hi" }),
    callout("M5", at([0, 0, 28]), 0, -90),
  ].join(""), { ex: [0, 0, 0], internal: true }));

  // M4 lead screw + nuts; M3 links: one group per lift frame
  const frames = [];
  for (let f = 0; f < LIFT_FRAMES; f++) {
    const th = M.link.th0 + ((M.link.th1 - M.link.th0) * f) / (LIFT_FRAMES - 1);
    const zt = M.deckZ(th) - 4, zb = M.link.zb;
    const dx = M.link.len * Math.cos(rad(th));
    const ends = [[x0 + 50, 1], [x1 - 50, -1]]; // top pivots near each end, nut inboard
    const links = [], nuts = [];
    for (const [xt, sgn] of ends) {
      const xn = xt + sgn * dx;
      for (const yc of [-120, 120]) {
        const ang = Math.atan2(zt - zb, xt - xn);
        const nx = -Math.sin(ang) * 4, nz = Math.cos(ang) * 4;
        const poly = [[xn - nx, zb - nz], [xt - nx, zt - nz], [xt + nx, zt + nz], [xn + nx, zb + nz]];
        links.push(prism("y", poly, yc - 5, yc + 5, P, { tone: "hi" }));
      }
      nuts.push(S(k.slabOf({ x: xn - 9, y: -12, w: 18, d: 24, r: 3 }, 6, 20, P, 3), { tone: "hi" }));
      nuts.push(prism("y", circle(xn, zb, 3, 12), -126, 126, P, { tone: "mid" }));
    }
    frames.push({ th, links: links.join(""), nuts: nuts.join(""), lift: M.liftAt(th) });
  }
  const linkFrames = frames.map((fr, i) => `<g data-frame="${i}"${i ? " hidden" : ""}>${fr.links}</g>`).join("");
  const nutFrames = frames.map((fr, i) => `<g data-frame="${i}"${i ? " hidden" : ""}>${fr.nuts}</g>`).join("");
  o.push(part("M4", "motion", prism("x", circle(0, 16, 5, 14), x0 + 60, -50, P, { tone: "hi" }) + prism("x", circle(0, 16, 5, 14), 40, x1 - 60, P, { tone: "hi" }) + nutFrames + callout("M4", at([x1 - 120, 0, 21]), 30, -120), { ex: [0, 0, 0], internal: true }));
  o.push(part("M3", "motion", linkFrames + callout("M3", at([x0 + 100, 125, 40]), -60, 60), { ex: [0, 0, 40], internal: true }));

  // M12 load cells at the deck pivots (move with deck)
  const cells = [[x0 + 50, -120], [x0 + 50, 120], [x1 - 50, -120], [x1 - 50, 120]];
  o.push(`<g class="lifts">` + part("M12", "control", cells.map(([x, y]) => S(k.slabOf({ x: x - 14, y: y - 10, w: 28, d: 20, r: 2 }, 31, 8, P, 2), { tone: "hi" })).join("") + callout("M12", at([x1 - 50, 120, 39]), 70, 50), { ex: [0, 0, 190], internal: true, lifts: true }) + `</g>`);
  // M1 deck, M2 pad (move with lift)
  o.push(`<g class="lifts">` + part("M1", "structure", [
    S(k.slabOf({ x: x0 + 5, y: y0 + 5, w: L - 10, d: PW - 10, r: 16 }, 39, 6, P, 6, 1), { tone: "hi" }),
    callout("M1", at([x0 + 260, y1 - 5, 42]), -120, 14),
  ].join(""), { ex: [0, 0, 300], lifts: true }) + part("M2", "structure", [
    S(k.slabOf({ x: x0 + 20, y: y0 + 20, w: L - 40, d: PW - 40, r: 10 }, 45, 2, P, 6), { tone: "mid" }),
    Ln(Array.from({ length: 9 }, (_, i) => k.lineOnTop([x0 + 60 + i * 72, y0 + 30], [x0 + 60 + i * 72, y1 - 30], 47, P)).join(""), { tone: "faint" }),
    callout("M2", at([x0 + 300, y0 + 20, 47]), -40, -70),
  ].join(""), { ex: [0, 0, 240], lifts: true }) + `</g>`);
  // front tray rails drawn after the deck (they are lower; deck above hides links behind them)
  o.push(part("M9", "structure", [
    S(k.slabOf({ x: x0, y: y1 - 10, w: L, d: 10, r: 4 }, 6, 16, P, 3), { tone: "hi" }),
    S(k.slabOf({ x: x1 - 10, y: y0, w: 10, d: PW, r: 4 }, 6, 16, P, 3), { tone: "hi" }),
    Ln([-200, -100, 100, 200].map((x) => k.segment([x, y1, 14], [x + 20, y1, 14], P)).join(""), { tone: "lo" }),
    callout("M9", at([x0 + 520, y1, 10]), 30, 60),
  ].join("")));
  // M6 near-side drive wheel, visible through a slot in the near rail
  o.push(part("M6", "motion", wheel([y1 - 22, y1 - 6]), { ex: [0, 110, 0] }));
  // M14 manual lowering socket on the +x end face
  o.push(part("M14", "control", prism("x", circle(0, 16, 7, 6), x1, x1 + 6, P, { tone: "hi" }) + callout("M14", at([x1 + 6, 0, 22]), 50, -50), { ex: [60, 0, 0] }));
  // M15 pinch skirt: bellows strip along the near edge between tray rail and deck
  // M15 pinch skirt: bellows along the near edge, one drawing per lift frame so it always closes the gap
  const skirtFrames = frames.map((fr, i) => {
    const h = 17 + fr.lift;
    return `<g data-frame="${i}"${i ? " hidden" : ""}>` + S(k.slabOf({ x: x0 + 20, y: y1 - 3, w: L - 40, d: 3, r: 1 }, 22, h, P, 2), { tone: "mid" }) + Ln(Array.from({ length: 22 }, (_, j) => k.segment([x0 + 40 + j * 30, y1, 22], [x0 + 40 + j * 30, y1, 22 + h], P)).join(""), { tone: "lo" }) + `</g>`;
  }).join("");
  o.push(part("M15", "hazard", skirtFrames + callout("M15", at([x0 + 120, y1, 30]), -14, 84), { ex: [0, 60, 0] }));
  // M16 insertion handle socket + pole stub on the +y side
  o.push(part("M16", "structure", S(k.slabOf({ x: -30, y: y1, w: 60, d: 16, r: 4 }, 8, 12, P, 3), { tone: "hi" }) + prism("y", circle(0, 14, 7, 14), y1 + 16, y1 + 220, P, { tone: "hi" }) + callout("M16", at([0, y1 + 200, 21]), 40, 46), { ex: [0, 90, 0] }));
  // M13 pendant and cord
  const pend = [x1 + 70, y1 + 150];
  o.push(part("M13", "control", [
    k.lineSvg(pathOf([at([x1 - 60, y1, 18]), at([x1 + 10, y1 + 60, 2]), at([pend[0] + 20, pend[1], 2])]), { tone: "mid", dotted: true }),
    S(k.slabOf({ x: pend[0], y: pend[1], w: 46, d: 90, r: 14 }, 0, 22, P, 6), { tone: "hi" }),
    S(k.cylinder(pend[0] + 23, pend[1] + 28, 9, 22, 4, P, 20), { tone: "hi" }),
    S(k.slabOf({ x: pend[0] + 10, y: pend[1] + 52, w: 26, d: 26, r: 6 }, 22, 3, P, 4), { tone: "hi" }),
    callout("M13", at([pend[0] + 23, pend[1] + 60, 25]), -84, 30),
  ].join("")));
  // M17 threshold ramp accessory, beside the +x end (drawn last: nearest the viewer)
  o.push(part("M17", "structure", prism("y", [[x1 + 40, 0], [x1 + 210, 0], [x1 + 70, 13], [x1 + 40, 13]], y0 + 20, y1 - 20, P, { tone: "hi" }) + callout("M17", at([x1 + 150, 0, 6]), 70, 20), { ex: [60, 0, 0] }));

  const svg = `<svg class="fig-svg iso-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Isometric view of the P-1 lift platform: a ${L} by ${PW} mm deck on toggle links driven by one lead screw, two drive wheels and four ball transfers in a 45 mm-tall tray.">${o.join("")}${flushCallouts()}</svg>`;
  return { svg, P, frames: frames.map((f) => ({ th: f.th, lift: f.lift })) };
}

// ---------- move sequence: cross-section through the chest's depth ----------
export function moverSequence() {
  // Section through the chest's depth, lower 560 mm only (break line above), so the 45 mm platform reads.
  const s = 0.95, ox = 330, oz = 560, top = 560;
  const X = (y) => ox + y * s, Z = (z) => oz - z * s;
  const it = M.item, pl = M.plat;
  const o = [];
  o.push(`<path class="floor" d="M20 ${Z(0)}H${W - 20}"/>`);
  o.push(`<rect class="floor-hatch" x="20" y="${Z(0)}" width="${W - 40}" height="10"/>`);
  const brk = (y0, y1, z) => { let d = `M${X(y0)} ${Z(z)}`; const n = 10; for (let i = 1; i <= n; i++) d += `L${X(y0 + ((y1 - y0) * i) / n)} ${Z(z + (i % 2 ? 9 : -9))}`; return d; };
  o.push(`<g class="seq-item" data-pid="J3">
    <path class="item-body" d="M${X(-it.D / 2)} ${Z(it.clear)}V${Z(top)}${brk(-it.D / 2, it.D / 2, top).replace(/^M[^L]*/, "")}V${Z(it.clear)}Z"/>
    ${[0, 1].map((i) => `<path class="item-line" d="M${X(-it.D / 2)} ${Z(it.clear + 18 + i * 225)}H${X(it.D / 2)}"/>`).join("")}
    <rect class="item-foot" x="${X(-it.D / 2)}" y="${Z(it.clear)}" width="${it.foot * s}" height="${it.clear * s}"/>
    <rect class="item-foot" x="${X(it.D / 2 - it.foot)}" y="${Z(it.clear)}" width="${it.foot * s}" height="${it.clear * s}"/>
    <g class="cg"><circle cx="${X(0)}" cy="${Z(it.cgZ)}" r="9"/><path d="M${X(0) - 9} ${Z(it.cgZ)}H${X(0) + 9}M${X(0)} ${Z(it.cgZ) - 9}V${Z(it.cgZ) + 9}"/></g>
    <text class="lab" x="${X(0) - 14}" y="${Z(it.cgZ) - 14}" text-anchor="end">CG ${it.cgZ} mm up (assumed)</text>
    <path class="tip-line" d="M${X(0)} ${Z(it.cgZ)}L${X(pl.W / 2)} ${Z(it.clear)}"/>
    <text class="lab small" x="${X(-it.D / 2) + 8}" y="${Z(top) + 30}">Chest, ${it.mass} kg, ${it.D} mm deep (section; top cut away)</text>
  </g>`);
  o.push(`<g class="seq-plat">
    <rect class="haz-zone" data-pid="M15" data-r="pinch" x="${X(-pl.W / 2 + 6)}" y="${Z(39)}" width="${(pl.W - 12) * s}" height="${17 * s}"/>
    <rect class="plat-tray" data-pid="M9" x="${X(-pl.W / 2)}" y="${Z(22)}" width="${pl.W * s}" height="${19 * s}"/>
    <circle class="plat-ball" data-pid="M8" cx="${X(-pl.W / 2 + 30)}" cy="${Z(6.35)}" r="${6.35 * s * 1.6}"/>
    <circle class="plat-ball" data-pid="M8" cx="${X(pl.W / 2 - 30)}" cy="${Z(6.35)}" r="${6.35 * s * 1.6}"/>
    <g class="seq-deck"><rect class="plat-deck" data-pid="M1" x="${X(-pl.W / 2 + 5)}" y="${Z(47)}" width="${(pl.W - 10) * s}" height="${8 * s}"/></g>
    <rect class="plat-handle" data-pid="M16" x="${X(pl.W / 2)}" y="${Z(16)}" width="${180 * s}" height="${8 * s}" rx="3"/>
    <path class="hand" d="M${X(pl.W / 2 + 170)} ${Z(18)}c-8 -30 18 -44 40 -34c18 8 16 30 2 36z"/>
  </g>`);
  o.push(`<g class="seq-dims">
    ${dim(X(it.D / 2 + 24), Z(0), X(it.D / 2 + 24), Z(it.clear), `${it.clear} mm underside (assumed, measure)`, "meas", { anchor: "start", textDx: 8 })}
    ${dim(X(-pl.W / 2 - 14), Z(0), X(-pl.W / 2 - 14), Z(pl.stowed), `${pl.stowed} stowed (target)`, "tgt", { anchor: "end", textDx: -8 })}
    ${dim(X(-pl.W / 2), Z(-16), X(pl.W / 2), Z(-16), `${pl.W} mm support width (target)`, "tgt", { textDy: 15 })}
  </g>`);
  o.push(`<g class="seq-arrow" data-r="arrow"></g>`);
  const svg = `<svg class="fig-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cross-section through the chest's depth showing the eight steps of a move: insert, engage, lift, drive, stop, lower and retrieve.">${o.join("")}</svg>`;
  return { svg, map: { s, ox, oz } };
}

// ---------- plan view: tightest turn, with path search ----------
function rectPoly(cx, cy, L, D, phi) {
  const c = Math.cos(phi), s = Math.sin(phi);
  return [[-L / 2, -D / 2], [L / 2, -D / 2], [L / 2, D / 2], [-L / 2, D / 2]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
function satHit(poly, box) {
  // box: [x0,y0,x1,y1]
  const bpoly = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]];
  const axes = [];
  for (const pg of [poly, bpoly]) for (let i = 0; i < 4; i++) { const a = pg[i], b = pg[(i + 1) % 4]; axes.push([-(b[1] - a[1]), b[0] - a[0]]); }
  for (const [ax, ay] of axes) {
    const pr = (pg) => pg.map(([x, y]) => x * ax + y * ay);
    const p1 = pr(poly), p2 = pr(bpoly);
    if (Math.max(...p1) <= Math.min(...p2) || Math.max(...p2) <= Math.min(...p1)) return false;
  }
  return true;
}
export function planTurn(Lx = M.item.L, Dy = M.item.D, margin = 0) {
  const hall = M.hall, door = M.door, wall = M.wall;
  const obstacles = [[-9000, -9000, 9000, 0], [-9000, hall, 0, hall + wall], [door, hall, 9000, hall + wall]];
  const free = (cx, cy, phi) => !obstacles.some((b) => satHit(rectPoly(cx, cy, Lx + 2 * margin, Dy + 2 * margin, phi), b));
  const step = 15, nphi = 31;
  const xs = [], ys = [];
  for (let x = -1300; x <= 1300; x += step) xs.push(x);
  for (let y = 100; y <= 1900; y += step) ys.push(y);
  const key = (i, j, p) => (p * ys.length + j) * xs.length + i;
  const ok = new Uint8Array(xs.length * ys.length * nphi);
  for (let p = 0; p < nphi; p++) { const phi = (p / (nphi - 1)) * Math.PI / 2; for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) ok[key(i, j, p)] = free(xs[i], ys[j], phi) ? 1 : 0; }
  const prev = new Int32Array(ok.length).fill(-2);
  const q = [];
  for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) if (xs[i] < -900 && ys[j] < hall && ok[key(i, j, 0)]) { prev[key(i, j, 0)] = -1; q.push(key(i, j, 0)); }
  let goal = -1;
  for (let h = 0; h < q.length && goal < 0; h++) {
    const n = q[h];
    const i = n % xs.length, j = Math.floor(n / xs.length) % ys.length, p = Math.floor(n / (xs.length * ys.length));
    if (p === nphi - 1 && xs[i] > 0 && xs[i] < door && ys[j] > hall + wall + Lx / 2 + 60) { goal = n; break; }
    for (const [di, dj, dp] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [0, 1, 1], [-1, 0, 1], [0, -1, 1], [1, 1, 1], [-1, 1, 1]]) {
      const a = i + di, b = j + dj, c = p + dp;
      if (a < 0 || b < 0 || c < 0 || a >= xs.length || b >= ys.length || c >= nphi) continue;
      const nk = key(a, b, c);
      if (!ok[nk] || prev[nk] !== -2) continue;
      prev[nk] = n; q.push(nk);
    }
  }
  if (goal < 0) return { feasible: false };
  const path = [];
  for (let n = goal; n >= 0; n = prev[n]) { const i = n % xs.length, j = Math.floor(n / xs.length) % ys.length, p = Math.floor(n / (xs.length * ys.length)); path.push([xs[i], ys[j], (p / (nphi - 1)) * 90]); }
  path.reverse();
  // smooth (moving average) while staying collision-free
  let sm = path.map((p) => [...p]);
  for (let pass = 0; pass < 6; pass++) {
    sm = sm.map((p, idx) => {
      if (idx === 0 || idx === sm.length - 1) return p;
      const a = sm[idx - 1], b = sm[idx + 1];
      const c = [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4, (a[2] + 2 * p[2] + b[2]) / 4];
      return free(c[0], c[1], rad(c[2])) ? c : p;
    });
  }
  // clearance along the path: min distance from rectangle corners/edges to obstacle boxes (sampled)
  const distBox = ([x, y], b) => Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3]));
  const clearance = (cx, cy, phi) => {
    const poly = rectPoly(cx, cy, Lx, Dy, phi);
    let best = Infinity;
    for (let e = 0; e < 4; e++) for (let t = 0; t <= 1; t += 0.05) { const a = poly[e], bb = poly[(e + 1) % 4]; const p = [a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t]; for (const b of obstacles) best = Math.min(best, distBox(p, b)); }
    // door jamb corners against rectangle interior edges
    for (const c of [[0, hall], [door, hall], [0, hall + wall], [door, hall + wall]]) {
      for (let e = 0; e < 4; e++) { const a = poly[e], bb = poly[(e + 1) % 4]; const vx = bb[0] - a[0], vy = bb[1] - a[1]; const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * vx + (c[1] - a[1]) * vy) / (vx * vx + vy * vy))); best = Math.min(best, Math.hypot(a[0] + vx * t - c[0], a[1] + vy * t - c[1])); }
    }
    return best;
  };
  const samples = sm.map(([x, y, ph]) => ({ x, y, ph, c: clearance(x, y, rad(ph)) }));
  return { feasible: true, samples, minClear: Math.min(...samples.map((s) => s.c)) };
}

export function bestTurn(L = M.item.L, D = M.item.D) {
  for (const margin of [120, 90, 60, 30, 0]) { const t = planTurn(L, D, margin); if (t.feasible) return { ...t, margin }; }
  return { feasible: false };
}

export function longestThatTurns(D = M.item.D) {
  let lo = 900, hi = 2200;
  while (hi - lo > 20) { const mid = (lo + hi) / 2; if (planTurn(mid, D).feasible) lo = mid; else hi = mid; }
  return lo;
}

export function moverPlan(turn) {
  const s = 0.28, ox = 500, oy = 560;
  const X = (x) => ox + x * s, Y = (y) => oy - y * s;
  const hall = M.hall, door = M.door, wall = M.wall;
  const o = [];
  // walls (section)
  o.push(`<rect class="sec-cut" x="${X(-1700)}" y="${Y(0)}" width="${3400 * s}" height="${wall * s}"/>`);
  o.push(`<rect class="sec-cut" x="${X(-1700)}" y="${Y(hall + wall)}" width="${1700 * s}" height="${wall * s}"/>`);
  o.push(`<rect class="sec-cut" x="${X(door)}" y="${Y(hall + wall)}" width="${(1700 - door) * s}" height="${wall * s}"/>`);
  o.push(`<text class="lab" x="${X(-1680)}" y="${Y(hall / 2) + 4}">Hallway</text>`);
  o.push(`<text class="lab" x="${X(-900)}" y="${Y(hall + wall + 500)}">Bedroom</text>`);
  o.push(dim(X(-1400), Y(0), X(-1400), Y(hall), `${hall} mm (36 in, IRC min)`, "src", { textDx: 8, anchor: "start" }));
  o.push(dim(X(0), Y(hall + wall + 40), X(door), Y(hall + wall + 40), `${door} clear (32 in door, measure)`, "meas", { textDy: -8, textDx: -260 }));
  // swept path (union, uniform via group opacity)
  const poly = (x, y, ph, L = M.item.L, D = M.item.D) => pathOf(rectPoly(x, y, L, D, rad(ph)).map(([a, b]) => [X(a), Y(b)]), true);
  const sw = turn.samples.filter((_, i) => i % 2 === 0).map((p) => poly(p.x, p.y, p.ph)).join("");
  o.push(`<path class="swept" d="${sw}"/>`);
  o.push(`<path class="swept-edge" d="${sw}"/>`);
  // live item + platform
  o.push(`<g class="plan-live"><path class="plan-item" data-r="item" d=""/><path class="plan-plat" data-pid="M1" data-r="plat" d=""/><circle class="plan-user" data-r="user" r="9"/><path class="plan-cord" data-r="cord" d=""/></g>`);
  o.push(`<text class="lab small" x="24" y="30">Plan view. Hatched: area swept by the chest and the platform beneath it.</text>`);
  const svg = `<svg class="fig-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Plan view of the tightest turn: a 36 inch hallway into a 32 inch bedroom door, with the area swept by the chest and platform.">${o.join("")}</svg>`;
  return { svg, map: { s, ox, oy } };
}

// ---------- entry height vs wheel diameter vs threshold ----------
export function wheelStudy() {
  const w = 460, h = 230;
  return `<svg class="fig-svg small-fig" viewBox="0 0 ${w} ${h}" role="img" aria-label="A wheel meeting a threshold; the push needed rises steeply as the threshold approaches the wheel radius.">
    <path class="floor" d="M10 190H200"/><rect class="sill" data-r="sill" x="200" y="180" width="240" height="10"/><path class="floor" d="M200 190H450"/>
    <g data-r="wheel"><circle class="wheel" cx="0" cy="0" r="10"/><circle class="axle" cx="0" cy="0" r="2.5"/></g>
    <path class="force-path" data-r="push" d="" marker-end="url(#ar-force)"/>
    <path class="lever" data-r="lever" d=""/>
  </svg>`;
}
