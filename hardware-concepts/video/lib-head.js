// Shared explainer-video runtime, part 1: palette, SVG helpers, reusable drawings, scene registry.
// A video page = lib-head.js + <product>-scenes.js + lib-tail.js, concatenated by the build script.
// Numbers come from content/model.mjs and the build's cost tables (injected as window.V by build-video.mjs).
(() => {
  const W = 1280, H = 720;
  const C = { page: "#F2F4F8", paper: "#FFFFFF", ink: "#161616", ink2: "#525252", ink3: "#8D8D8D", rule: "#C6C6C6", teal: "#005D5D", tealT: "#D9FBFB", blue: "#002D9C", blueT: "#EDF5FF", violet: "#6929C4", violetT: "#F6F2FF", rust: "#8A3800", rustT: "#FFF2E8", wood: "#F4F1EC", woodD: "#E7E1D8", good: "#0E6027" };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const es = (t, a, b) => ease(seg(t, a, b));
  const lerp = (a, b, u) => a + (b - a) * u;
  const r1 = (v) => Math.round(v * 10) / 10;
  const fmt = (v) => Math.round(v).toLocaleString("en-US");
  const T = (x, y, s, o = {}) => `<text x="${r1(x)}" y="${r1(y)}" font-size="${o.size || 22}" font-weight="${o.w || 400}" fill="${o.fill || C.ink}" text-anchor="${o.a || "start"}" font-family="${o.mono ? "IBM Plex Mono" : "IBM Plex Sans"}, sans-serif"${o.op !== undefined ? ` opacity="${r1(o.op * 100) / 100}"` : ""}>${s}</text>`;
  const R = (x, y, w, h, o = {}) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(Math.max(0, w))}" height="${r1(Math.max(0, h))}" rx="${o.rx || 0}" fill="${o.fill || "none"}" stroke="${o.stroke || "none"}" stroke-width="${o.sw || 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.op !== undefined ? ` opacity="${o.op}"` : ""}/>`;
  const L = (x1, y1, x2, y2, o = {}) => `<path d="M${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}" stroke="${o.stroke || C.ink}" stroke-width="${o.sw || 1.5}" fill="none"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.arrow ? ` marker-end="url(#${o.arrow})"` : ""}${o.op !== undefined ? ` opacity="${o.op}"` : ""} stroke-linecap="round"/>`;
  const Ci = (x, y, r, o = {}) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${o.fill || "none"}" stroke="${o.stroke || "none"}" stroke-width="${o.sw || 1.5}"${o.op !== undefined ? ` opacity="${o.op}"` : ""}/>`;
  const P = (d, o = {}) => `<path d="${d}" fill="${o.fill || "none"}" stroke="${o.stroke || "none"}" stroke-width="${o.sw || 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.op !== undefined ? ` opacity="${o.op}"` : ""} stroke-linejoin="round" stroke-linecap="round"/>`;
  const G = (s, o = {}) => `<g${o.tr ? ` transform="${o.tr}"` : ""}${o.op !== undefined ? ` opacity="${r1(clamp(o.op) * 100) / 100}"` : ""}>${s}</g>`;
  const DEFS = `<defs>
    <marker id="aT" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${C.teal}"/></marker>
    <marker id="aR" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${C.rust}"/></marker>
    <marker id="aK" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${C.ink}"/></marker>
    <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="#A8A8A8" stroke-width="1.2"/></pattern>
    <pattern id="hz" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><path d="M0 0V7" stroke="${C.rust}" stroke-width="1.6"/></pattern>
    <pattern id="sw" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V9" stroke="${C.teal}" stroke-width="1.2"/></pattern>
  </defs>`;

  // ---------- reusable drawings ----------
  // side view of the platform: x = left edge, floor y, scale s (px/mm), lift mm, wheel angle
  function platform(x, fy, s, lift = 0, spin = 0, w = 360) {
    const W2 = w * s;
    let o = "";
    // pinch zone / skirt (between tray top 22 and deck bottom 39+lift)
    o += R(x + 6 * s, fy - (39 + lift) * s, W2 - 12 * s, (17 + lift) * s, { fill: "url(#hz)", stroke: C.rust, sw: 1, op: lift > 0.5 ? 0.85 : 0.35 });
    // links (two toggles drawn as X-ish struts)
    const zt = 35 + lift, zb = 24.5;
    for (const [px, dir] of [[50, 1], [w - 50, -1]]) {
      const len = 120, dy = zt - zb, dx = Math.sqrt(Math.max(0, len * len - dy * dy));
      o += L(x + px * s, fy - zt * s, x + (px + dir * dx) * s, fy - zb * s, { stroke: C.teal, sw: 4 });
      o += Ci(x + px * s, fy - zt * s, 3.5, { fill: "#fff", stroke: C.teal, sw: 2 });
      o += Ci(x + (px + dir * dx) * s, fy - zb * s, 3.5, { fill: "#fff", stroke: C.teal, sw: 2 });
    }
    o += R(x, fy - 22 * s, W2, 19 * s, { fill: "#E4E6E9", stroke: C.ink, rx: 3 });
    o += R(x + 5 * s, fy - (47 + lift) * s, W2 - 10 * s, 8 * s, { fill: "#F7F8F9", stroke: C.ink, rx: 2 });
    for (const cx of [30, w - 30]) {
      const cxp = x + cx * s, cy = fy - 9 * s;
      o += Ci(cxp, cy, 9 * s, { fill: C.tealT, stroke: C.teal, sw: 2 });
      o += L(cxp, cy, cxp + Math.cos(spin) * 8 * s, cy + Math.sin(spin) * 8 * s, { stroke: C.teal, sw: 2 });
    }
    return o;
  }
  // chest section: x left, floor y, s, raise mm, cut height mm
  function chest(x, fy, s, raise = 0, cut = 600, D = 480) {
    const y0 = fy - raise * s;
    let o = "";
    const top = y0 - cut * s;
    let zig = `M${x} ${y0 - 76 * s}V${top}`;
    for (let i = 1; i <= 10; i++) zig += `L${r1(x + (D * s * i) / 10)} ${r1(top + (i % 2 ? -10 : 10))}`;
    zig += `V${y0 - 76 * s}Z`;
    o += P(zig, { fill: C.wood, stroke: C.ink, sw: 2 });
    o += L(x, y0 - 94 * s, x + D * s, y0 - 94 * s, { stroke: "#C9C1B5", sw: 1.5 });
    o += L(x, y0 - 320 * s, x + D * s, y0 - 320 * s, { stroke: "#C9C1B5", sw: 1.5 });
    o += R(x, y0 - 76 * s, 50 * s, 76 * s, { fill: C.woodD, stroke: C.ink, sw: 2 });
    o += R(x + (D - 50) * s, y0 - 76 * s, 50 * s, 76 * s, { fill: C.woodD, stroke: C.ink, sw: 2 });
    return o;
  }
  const floor = (y, x0 = 40, x1 = W - 40, off = 0) => {
    let o = L(x0, y, x1, y, { sw: 2 });
    for (let x = x0 + ((off % 24) + 24) % 24; x < x1; x += 24) o += L(x, y + 2, x - 10, y + 12, { stroke: "#B0B0B0", sw: 1.2 });
    return o;
  };
  function person(x, fy, k = 1, lean = 0, o2 = {}) {
    const hx = x + lean * 40 * k, hy = fy - 300 * k;
    let o = Ci(hx, hy, 26 * k, { fill: "#F5E9DF", stroke: "#6F6F6F", sw: 3 });
    const sh = [hx - lean * 8 * k, hy + 34 * k], hip = [x, fy - 150 * k];
    o += P(`M${sh[0]} ${sh[1]}L${hip[0]} ${hip[1]}`, { stroke: "#6F6F6F", sw: 10 * k });
    o += P(`M${hip[0]} ${hip[1]}L${x - 30 * k} ${fy}M${hip[0]} ${hip[1]}L${x + 26 * k} ${fy}`, { stroke: "#6F6F6F", sw: 9 * k });
    const hand = o2.hand || [sh[0] - 90 * k, sh[1] + 40 * k];
    o += P(`M${sh[0]} ${sh[1] + 8 * k}L${hand[0]} ${hand[1]}`, { stroke: "#6F6F6F", sw: 8 * k });
    return o;
  }
  const chip = (x, y, text, col = C.teal, bg = C.tealT, op = 1) => {
    const w = text.length * 11 + 28;
    return G(R(x, y - 24, w, 34, { fill: bg, stroke: col, rx: 17, sw: 2 }) + T(x + w / 2, y - 1, text, { a: "middle", size: 18, w: 600, fill: col, mono: true }), { op });
  };
  const bigNum = (x, y, n, label, col, op) => G(T(x, y, n, { size: 54, w: 600, fill: col, mono: true }) + T(x, y + 34, label, { size: 20, fill: C.ink2 }), { op });

  // ---------- scenes ----------
  const V = window.V;
  const S = [];
  const scene = (dur, label, draw, caps) => S.push({ dur, label, draw, caps });
