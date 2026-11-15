// Tab 1 figures: D-head (flat right-angle hex driver head) on the shared power base,
// the in-use section (dresser plinth bolt in a 40 mm void) with tool comparison,
// and the hammer angle study.
import { k, prism, circle, rrect, part, callout, dim, pathOf, flushCallouts } from "./geom.mjs";
import { DRIVER as G } from "../content/model.mjs";

const W = 960, H = 600;
const HI = 520;

// ---------- isometric assembled / exploded ----------
export function driverIso() {
  const L = G.armLength; // output axis to input end of arm
  const zc = 8; // input/shaft centreline height
  const X = {
    collar: [L + 16, L + 32], shank: [L + 32, L + 58], bay: [L + 58, L + 70],
    barrel: [L + 70, L + 184], hinge: L + 191, grip: [L + 198, L + 300], batt: [L + 300, L + 372],
  };
  const EXB = 130; // base explode along +x
  const ext = [
    ...k.boxCorners({ x: -70, y: -40, w: X.batt[1] + EXB + 90, d: 80 }, -80, 120),
  ];
  const P = k.fitProjection(ext, W, HI, { pad: 40, azimuth: 62, elevation: 30 });
  const at = (p) => k.iso(p, P);
  const S = (paths, o) => k.solidSvg(paths, o);
  const Ln = (d, o) => k.lineSvg(d, o);
  const out = [];
  const hex = (r) => circle(0, 0, r, 6).map(([x, y]) => [x, y]);
  const stadium = (x0, x1, r) => rrect(x0 - r, -r, x1 + r, r, r, 10);

  // halo
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: -20, y: -22, w: X.batt[1] + 20, d: 44, r: 16 }, -12, 2, P)}"/>`);

  // D10 bit (drawn first: it hangs under the arm)
  const bit = [
    S(k.extrude(hex(2.31), -9, 8, P), { tone: "hi" }),
    S(k.extrude(hex(3.67), -1, 17, P), { tone: "hi" }),
    callout("D10", at([0, 0, -9]), -70, 40),
  ].join("");
  out.push(part("D10", "motion", bit, { ex: [0, 0, -62] }));

  // D8 lower bearing (internal)
  out.push(part("D8", "structure", [
    S(k.cylinder(0, 0, 7.5, 0.6, 4, P, 32), { tone: "mid" }),
    Ln(k.ring(0, 0, 5.4, 4.6, P, 28), { tone: "lo" }),
    callout("D8", at([0, -7.5, 4.6]), -84, -10),
  ].join(""), { ex: [0, 0, -34], internal: true }));

  // D3 lower housing (tray)
  out.push(part("D3", "structure", [
    S(k.extrude(stadium(0, L, 16), 0, 10, P), { tone: "hi" }),
    Ln(k.planOutline({ x: -12, y: -12, w: L + 24, d: 24, r: 12 }, 10, P, 10), { tone: "faint" }),
    callout("D3", at([L * 0.45, 16, 5]), -50, 52),
  ].join("")));

  // internals that sit in the tray: D5 shaft, D6 pinion, D7 crown gear, D9 retention ball
  out.push(part("D5", "motion", [
    prism("x", circle(0, zc, 3, 16), 18, L + 10, P, { tone: "hi" }),
    prism("x", circle(0, zc, 4.6, 16), 40, 52, P, { tone: "mid" }),
    prism("x", circle(0, zc, 4.6, 16), L - 26, L - 14, P, { tone: "mid" }),
    callout("D5", at([L * 0.62, 0, zc + 3]), 20, -70),
  ].join(""), { ex: [0, 0, 34], internal: true }));
  out.push(part("D6", "motion", [
    prism("x", circle(0, zc, 4.6, 18), 12, 20, P, { tone: "hi" }),
    callout("D6", at([16, 0, zc + 4.6]), 54, -64),
  ].join(""), { ex: [0, 0, 34], internal: true }));
  const teeth = k.radialTicks(0, 0, 13, 26, 1, 11, [2.4, 2.4], P);
  out.push(part("D7", "motion", [
    S(k.cylinder(0, 0, 13, 5, 6, P, 52), { tone: "hi" }),
    Ln(teeth.minor + teeth.major, { tone: "mid" }),
    Ln(k.onTop(hex(3.67), 11, P, true), { tone: "hi" }),
    callout("D7", at([-9, -9, 11]), -60, -40),
  ].join(""), { ex: [0, 0, 52], internal: true }));
  out.push(part("D9", "structure", [
    S(k.cylinder(-6.5, 0, 1.6, 7, 2.4, P, 12), { tone: "mid" }),
    callout("D9", at([-6.5, 0, 9]), -96, 22),
  ].join(""), { ex: [-18, 0, 52], internal: true }));

  // D8 upper bearing (internal, travels with cover)
  out.push(part("D8", "structure", [
    S(k.cylinder(0, 0, 7.5, 11.2, 4, P, 32), { tone: "mid" }),
    Ln(k.ring(0, 0, 5.4, 15.2, P, 28), { tone: "lo" }),
  ].join(""), { ex: [0, 0, 74], internal: true }));

  // D4 cover with screws
  const screwXs = [22, L * 0.4, L * 0.75];
  const screws = screwXs.flatMap((x) => [[x, 11.5], [x, -11.5]]);
  out.push(part("D4", "structure", [
    S(k.extrude(stadium(0, L, 16), 10, 6, P), { tone: "hi", crease: "faint" }),
    Ln(k.ring(0, 0, 5.2, 16, P, 6), { tone: "mid" }),
    Ln(screws.map(([x, y]) => k.ring(x, y, 1.6, 16, P, 12)).join(""), { tone: "lo" }),
    k.dotsSvg(screws.map(([x, y]) => at([x, y, 16])), { size: 0.7, tone: "hi" }),
    Ln(k.onTop(hex(3.67), 16, P, true), { tone: "hi" }),
    callout("D4", at([L * 0.3, -16, 16]), -40, -62),
  ].join(""), { ex: [0, 0, 96] }));

  // D11 grip sleeve (clip-on, split) near the input end: where the support hand reacts torque
  out.push(part("D11", "structure", [
    S(k.extrude(rrect(L - 44, -18.5, L - 4, 18.5, 7, 6), -2.5, 21, P), { tone: "hi" }),
    Ln([L - 36, L - 28, L - 20, L - 12].map((x) => k.segment([x, 18.5, 18.5], [x, 18.5, -2.5], P)).join(""), { tone: "lo" }),
    callout("D11", at([L - 24, 18.5, 8]), 10, 64),
  ].join(""), { ex: [0, 0, -52] }));

  // D2 clocking collar (12 detents), D1 input shank
  out.push(part("D2", "control", [
    prism("x", rrect(-15, -3, 15, 19, 7, 5), X.collar[0], X.collar[1], P, { tone: "hi" }),
    Ln([0, 1, 2, 3].map((i) => k.segment([X.collar[0] + 3 + i * 3.6, 15, 19], [X.collar[0] + 3 + i * 3.6, 15, -3], P)).join(""), { tone: "lo" }),
    callout("D2", at([X.collar[0] + 8, 0, 19]), -20, -70),
  ].join(""), { ex: [44, 0, 0] }));
  out.push(part("D1", "motion", [
    prism("x", circle(0, zc, 3.67, 6), X.shank[0] - 8, X.shank[1], P, { tone: "hi" }),
    callout("D1", at([X.shank[0] + 12, 0, zc + 3.6]), 0, -66),
  ].join(""), { ex: [80, 0, 0], internal: true }));

  // ---- power base (shared family element; phase 2) ----
  out.push(part("B7", "motion", [
    prism("x", circle(0, zc, 15, 28), X.bay[0], X.bay[1], P, { tone: "hi" }),
    Ln(k.segment([X.bay[0] + 6, 0, zc + 15], [X.bay[0] + 6, 15, zc], P), { tone: "lo" }),
    callout("B7", at([X.bay[0] + 6, 10, zc - 10]), -20, 104),
  ].join(""), { ex: [EXB - 30, 0, 0] }));
  // internals first so the housing hides them when assembled
  out.push(part("B5", "motion", [
    prism("x", circle(0, zc, 15, 24), X.barrel[0] + 6, X.barrel[0] + 52, P, { tone: "hi" }),
    Ln([14, 26, 38].map((d) => k.segment([X.barrel[0] + 6 + d, 15, zc], [X.barrel[0] + 6 + d, 0, zc + 15], P)).join(""), { tone: "lo" }),
    callout("B5", at([X.barrel[0] + 28, 0, zc + 15]), -24, -64),
  ].join(""), { ex: [EXB, 0, 70], internal: true }));
  out.push(part("B4", "power", [
    prism("x", circle(0, zc, 14, 24), X.barrel[0] + 54, X.barrel[1] - 6, P, { tone: "hi" }),
    callout("B4", at([X.barrel[0] + 84, 0, zc + 14]), 10, -64),
  ].join(""), { ex: [EXB, 0, 70], internal: true }));
  out.push(part("B8", "power", [
    S(k.slabOf({ x: X.grip[0] + 8, y: -12, w: 86, d: 24, r: 2 }, 3, 2, P, 3), { tone: "hi" }),
    k.dotsSvg([12, 30, 48, 66].map((d) => at([X.grip[0] + 8 + d, 6, 5])), { size: 1.2, tone: "hi" }),
    callout("B8", at([X.grip[0] + 50, -12, 5]), -10, -66),
  ].join(""), { ex: [EXB, 0, 70], internal: true }));
  out.push(part("B2", "structure", [
    prism("x", rrect(-21, -13, 21, 29, 14, 7), X.barrel[0], X.barrel[1], P, { tone: "hi" }),
    prism("x", rrect(-17, -9, 17, 25, 12, 7), X.grip[0], X.grip[1], P, { tone: "hi" }),
    Ln([X.barrel[0] + 70, X.barrel[0] + 80, X.barrel[0] + 90, X.barrel[0] + 100].map((x) => k.segment([x, 21, 22], [x, 21, -6], P)).join(""), { tone: "lo" }),
    callout("B2", at([X.barrel[0] + 50, 21, 0]), 10, 70),
  ].join(""), { ex: [EXB, 0, 0] }));
  out.push(part("B6", "control", [
    prism("y", circle(X.hinge, zc, 12, 22), -19, 19, P, { tone: "hi" }),
    Ln(Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * Math.PI / 2; return k.segment([X.hinge + Math.cos(a) * 8, 19, zc + Math.sin(a) * 8], [X.hinge + Math.cos(a) * 11.5, 19, zc + Math.sin(a) * 11.5], P); }).join(""), { tone: "mid" }),
    k.dotsSvg([at([X.hinge, 19, zc])], { size: 1.4, tone: "hi" }),
    callout("B6", at([X.hinge, 19, zc + 12]), 6, 82),
  ].join(""), { ex: [EXB, 0, 0] }));
  out.push(part("B3", "control", [
    S(k.slabOf({ x: X.grip[0] + 22, y: -6, w: 44, d: 12, r: 4 }, 25, 4, P, 4), { tone: "hi" }),
    S(k.slabOf({ x: X.grip[0] + 2, y: -5, w: 12, d: 10, r: 2 }, 25, 3, P, 3), { tone: "hi" }),
    callout("B3", at([X.grip[0] + 44, 0, 29]), 10, -60),
  ].join(""), { ex: [EXB, 0, 0] }));
  out.push(part("B1", "power", [
    prism("x", rrect(-20, -12, 20, 28, 6, 4), X.batt[0], X.batt[1], P, { tone: "hi" }),
    Ln(k.segment([X.batt[0] + 10, 20, 28], [X.batt[0] + 10, 20, -12], P), { tone: "lo" }),
    S(k.slabOf({ x: X.batt[0] + 18, y: -8, w: 18, d: 16, r: 3 }, 28, 2.5, P, 3), { tone: "mid" }),
    callout("B1", at([X.batt[0] + 50, 20, 4]), 10, 66),
  ].join(""), { ex: [EXB + 60, 0, 0] }));

  const svg = `<svg class="fig-svg iso-svg" viewBox="0 0 ${W} ${HI}" role="img" aria-label="Isometric view of the D-head, a flat right-angle hex driver head, mounted on the shared 12 V power base. In the exploded state each part moves out along the axis it is assembled on.">${out.join("")}${flushCallouts()}</svg>`;
  return { svg, P };
}

// ---------- in-use section: plinth bolt under a drawer frame ----------
// Side section through a dresser base. x: depth from the front face (front at right), z: height above bottom panel.
export function driverInUse() {
  const s = 1.5; // px per mm
  const ox = 500, oz = 330; // screen position of (front face, panel top)
  const X = (x) => ox + x * s, Z = (z) => oz - z * s;
  const C = G.void, bolt = G.boltDepth;
  const o = [];
  // floor, panel, plinth (section hatch on cut material)
  o.push(`<rect class="sec-cut" x="${X(-310)}" y="${Z(0)}" width="${(310 + 30) * s}" height="${18 * s}"/>`);
  o.push(`<rect class="sec-cut" x="${X(-310)}" y="${Z(C + 18)}" width="${310 * s}" height="${18 * s}"/>`);
  o.push(`<rect class="sec-cut" x="${X(-30)}" y="${Z(C + 18 + 210)}" width="${30 * s}" height="${0}"/>`);
  o.push(`<text class="lab" x="${X(-150)}" y="${Z(-9) + 4}">Bottom panel, 18 mm (section)</text>`);
  o.push(`<text class="lab" x="${X(-300)}" y="${Z(C + 9) + 4}">Drawer frame / dust panel, 18 mm (section)</text>`);
  // back panel
  o.push(`<path class="break" d="M${X(-310)} ${Z(C + 26)}l8 12l-12 12l8 12l-8 12l12 12l-8 12l8 12l-8 12"/>`);
  // bolt (M6 socket cap, head Ø10 × 6)
  o.push(`<g data-pid="J1" class="job"><rect class="bolt" x="${X(-bolt - 5)}" y="${Z(6)}" width="${10 * s}" height="${6 * s}"/><rect class="bolt-shank" x="${X(-bolt - 3)}" y="${Z(0)}" width="${6 * s}" height="${30 * s}"/><path class="bolt-socket" d="M${X(-bolt - 2)} ${Z(6)}V${Z(2.5)}H${X(-bolt + 2)}V${Z(6)}"/><path id="bolt-mark" class="bolt-mark" d="M${X(-bolt)} ${Z(6)}v-6"/></g>`);
  o.push(`<text class="lab" x="${X(-bolt + 8)}" y="${Z(-30)}">M6 × 30 socket cap, 4 mm hex (J1)</text>`);
  // dims: void height, bolt depth
  o.push(dim(X(-296), Z(0), X(-296), Z(C), `${C} (assumed)`, "meas", { off: 0, textDx: 6, anchor: "start" }));
  o.push(dim(X(-bolt), Z(C + 50), X(0), Z(C + 50), `${bolt} mm to bolt axis (assumed)`, "meas", { textDy: -8 }));
  o.push(dim(X(-bolt + 14), Z(0), X(-bolt + 14), Z(6), `6`, "src", { textDx: 14 }));
  // front face line
  o.push(`<path class="front-face" d="M${X(0)} ${Z(-18)}V${Z(C + 18 + 60)}"/>`);
  o.push(`<text class="lab" x="${X(4)}" y="${Z(C + 18 + 64)}">Front face (drawer removed)</text>`);

  // tools — each in its own group, shown one at a time. Positions are set live from the model (approach t).
  // Proposed D-head
  const dh = `<g class="tool" data-tool="dhead">
    <g class="mover">
      <rect class="t-bit" data-pid="D10" x="${-3.2 * s}" y="${-25 * s}" width="${6.4 * s}" height="${25 * s}"/>
      <rect class="t-body" data-pid="D3" x="${-16 * s}" y="${-25 * s}" width="${(G.armLength + 32) * s}" height="${16 * s}" rx="${8 * s}"/>
      <rect class="t-sleeve" data-pid="D11" x="${(G.armLength - 44) * s}" y="${-27.5 * s}" width="${40 * s}" height="${21 * s}" rx="${4 * s}"/>
      <rect class="t-collar" data-pid="D2" x="${(G.armLength + 16) * s}" y="${-30 * s}" width="${16 * s}" height="${22 * s}" rx="${4}"/>
      <rect class="t-host" data-pid="B2" x="${(G.armLength + 58) * s}" y="${-38 * s}" width="${180 * s}" height="${42 * s}" rx="${12 * s}"/>
      <path class="hand" d="${handPath((G.armLength - 10) * s, -27.5 * s, 0.8)}"/>
      <path class="hand" d="${handPath((G.armLength + 150) * s, -38 * s, 1.2)}"/>
    </g></g>`;
  // Milwaukee 49-22-8510 right-angle attachment: head height 51 mm (published, listings vary 44–51)
  const ra = `<g class="tool" data-tool="ra" hidden>
    <g class="mover">
      <rect class="t-bit" x="${-3.2 * s}" y="${-25 * s}" width="${6.4 * s}" height="${25 * s}"/>
      <rect class="t-body comp" x="${-18 * s}" y="${-51 * s}" width="${40 * s}" height="${26 * s}" rx="${6}"/>
      <rect class="t-body comp" x="${10 * s}" y="${-45 * s}" width="${140 * s}" height="${24 * s}" rx="${10}"/>
      <rect class="t-host comp" x="${150 * s}" y="${-60 * s}" width="${170 * s}" height="${50 * s}" rx="${12 * s}"/>
      <path class="hand" d="${handPath(230 * s, -60 * s, 1.2)}"/>
    </g></g>`;
  // Ball-end L-key, 4 mm
  const lk = `<g class="tool" data-tool="lkey" hidden>
    <g class="mover">
      <path class="t-key" d="M0 0V${-22 * s}H${G.lkeyLong * s}"/>
      <path class="hand" d="${handPath((G.lkeyLong - 8) * s, -26 * s, 0.9)}"/>
    </g></g>`;
  o.push(dh, ra, lk);
  // collision overlay for the right-angle attachment
  o.push(`<rect class="haz-zone" data-tool-only="ra" hidden x="${X(-40)}" y="${Z(C + 18)}" width="${40 * s}" height="${(51 + 6.5 - C) * s}"/>`);
  o.push(`<text class="lab haz" data-tool-only="ra" hidden x="${X(-bolt + 10)}" y="${Z(C + 30)}">Head 51 + bolt head 6 = 57 mm against a 40 mm void: cannot enter</text>`);
  // live dims for the D-head
  o.push(`<g data-tool-only="dhead"><g class="dim" data-kind="tgt" data-live="stack"></g></g>`);
  // plan inset: reaction torque path
  const ix = 70, iy = 70, is = 0.62;
  o.push(`<g class="inset" transform="translate(${ix} ${iy})">
    <rect class="inset-frame" x="-40" y="-46" width="${(G.armLength + 110) * is + 40}" height="118"/>
    <text class="lab small" x="-32" y="-30">Plan, looking down: where reaction torque goes</text>
    <circle class="bolt-plan" cx="0" cy="20" r="${7 * is * 2}"/>
    <rect class="t-body-plan" x="${-16 * is}" y="${20 - 16 * is}" width="${(G.armLength + 32) * is}" height="${32 * is}" rx="${16 * is}"/>
    <path class="force-path" d="M-22 ${20 + 22}A30 30 0 0 1 -22 ${20 - 22}" marker-end="url(#ar-force)"/>
    <text class="lab small force" x="-6" y="62">${G.torque} N·m at J1</text>
    <path class="force-path" d="M${(G.armLength - 24) * is} ${20 + 30}V${20 + 8}" marker-end="url(#ar-force)"/>
    <text class="lab small force" x="${(G.armLength - 20) * is + 4}" y="62" data-r="react2"></text>
    <rect class="t-sleeve" x="${(G.armLength - 44) * is}" y="${20 - 19 * is}" width="${40 * is}" height="${38 * is}" rx="3"/>
  </g>`);
  const svg = `<svg class="fig-svg" viewBox="0 0 ${W} 440" role="img" aria-label="Side section through a dresser base: an M6 bolt sits in a 40 mm void 180 mm behind the front face. Select a tool to compare how it reaches the bolt.">${o.join("")}</svg>`;
  return { svg, map: { s, ox, oz } };
}

export function handPath(x, y, k = 1) {
  // simple mitten silhouette resting on a part at (x, y): palm above, thumb wrapping down
  const m = (dx, dy) => `${(x + dx * k).toFixed(1)} ${(y + dy * k).toFixed(1)}`;
  return `M${m(-40, 0)}C${m(-40, -26)} ${m(-14, -44)} ${m(16, -40)}C${m(40, -36)} ${m(52, -18)} ${m(50, 0)}C${m(48, 10)} ${m(36, 14)} ${m(30, 8)}L${m(22, 0)}Z`;
}

// ---------- hammer angle study ----------
// Elevation: nail axis horizontal into a joist face; an obstruction (duct) parallel to the face at G.hammerGap.
export function hammerStudy() {
  const s = 2.0, ox = 220, oy = 312;
  const X = (x) => ox + x * s, Y = (y) => oy + y * s;
  const gap = G.hammerGap;
  const o = [];
  o.push(`<rect class="sec-cut" x="${X(-38)}" y="${Y(-140)}" width="${38 * s}" height="${280 * s}"/>`);
  o.push(`<text class="lab" x="${X(-34)}" y="${Y(-146)}">Joist, 38 mm (section)</text>`);
  o.push(`<rect class="obstruction" x="${X(gap)}" y="${Y(-140)}" width="${60 * s}" height="${280 * s}"/>`);
  o.push(`<text class="lab" x="${X(gap + 4)}" y="${Y(-146)}">Duct or pipe</text>`);
  o.push(dim(X(0), Y(120), X(gap), Y(120), `${gap} mm clear along nail axis (assumed)`, "meas", { textDy: 18 }));
  // hanger flange
  o.push(`<rect class="hanger" x="${X(0)}" y="${Y(-70)}" width="${1.5 * s}" height="${140 * s}"/>`);
  // nail (moves): stick-out set live
  o.push(`<g class="nail" data-pid="J2"><rect class="nail-shank" x="0" y="${Y(-1.6)}" width="${G.nail * s}" height="${3.2 * s}"/><rect class="nail-head" x="${G.nail * s - 2}" y="${Y(-4)}" width="${2 * s}" height="${8 * s}"/></g>`);
  // three tools (one visible). Their bodies are positioned live so the nose rides on the nail head.
  o.push(`<g class="htool" data-htool="linear">
      <g class="hmove">
        <rect class="t-body" data-pid="H1" x="0" y="${Y(-20)}" width="${G.linearHead * s}" height="${40 * s}" rx="8"/>
        <rect class="t-striker" data-pid="H2" x="0" y="${Y(-6)}" width="${30 * s}" height="${12 * s}" rx="3"/>
        <rect class="t-collar" data-pid="H3" x="${(G.linearHead / 2 - 26) * s}" y="${Y(-30)}" width="${52 * s}" height="${12 * s}" rx="4"/>
        <rect class="t-host" data-pid="B2" x="${(G.linearHead / 2 - 21) * s}" y="${Y(-150)}" width="${42 * s}" height="${122 * s}" rx="14"/>
        <path class="force-path" d="M${(G.linearHead / 2 + 30) * s} ${Y(-24)}V${Y(-70)}" marker-end="url(#ar-force)"/>
        <text class="lab small force" x="${(G.linearHead / 2 + 34) * s}" y="${Y(-60)}">recoil → H3 teeth → handle</text>
      </g></g>`);
  o.push(`<g class="htool" data-htool="pivot" hidden>
      <g class="hmove">
        <rect class="t-body" x="${20 * s}" y="${Y(-34)}" width="${(G.pivotHead - 20) * s}" height="${68 * s}" rx="10"/>
        <g class="swing"><rect class="t-striker" x="0" y="${Y(-14)}" width="${26 * s}" height="${28 * s}" rx="4"/><path class="pivot-arm" d="M${13 * s} ${Y(0)}L${G.pivotR * s} ${Y(-G.pivotR * 0.9)}"/></g>
        <circle class="pivot-pin" cx="${G.pivotR * s}" cy="${Y(-G.pivotR * 0.9)}" r="5"/>
        <path class="arc-path" d="" data-r="arc"/>
        <rect class="t-host" x="${(45 - 21) * s}" y="${Y(-150)}" width="${42 * s}" height="${116 * s}" rx="14"/>
      </g></g>`);
  o.push(`<g class="htool" data-htool="palm" hidden>
      <g class="hmove">
        <rect class="t-body comp" x="0" y="${Y(-31)}" width="${G.palmLen * s}" height="${63 * s}" rx="14"/>
        <text class="lab small" x="${G.palmLen * s + 8}" y="${Y(4)}">palm pushes here</text>
      </g></g>`);
  o.push(`<path class="impact-axis" d="M${X(-10)} ${Y(0)}H${X(gap)}"/>`);
  o.push(`<g class="haz-flag" hidden><rect class="haz-zone" x="0" y="${Y(-40)}" width="10" height="${80 * s}"/></g>`);
  const svg = `<svg class="fig-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Elevation of a joist-hanger nail with a duct ${gap} mm away. Compare a linear striker, a pivoting striking face and a palm nailer.">${o.join("")}</svg>`;
  return { svg, map: { s, ox, oy } };
}
