// Shared drawing kit. Every visual is a pure function of time: render(t) paints the frame for second t.
const W = 1920, H = 1080, TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, d) => clamp((t - a) / d);
const lerp = (a, b, p) => a + (b - a) * p;
const ease = {
  out: p => 1 - Math.pow(1 - p, 3),
  in: p => p * p * p,
  inout: p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  sine: p => .5 - .5 * Math.cos(Math.PI * p),
  back: p => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
};
const S = (t, a, d) => ease.sine(P(t, a, d));
// fade in at a, fade out ending at b
const vis = (t, a, b, fi = .5, fo = .5) => S(t, a, fi) * (1 - S(t, b - fo, fo));
// animation "on twos": limb cycles and smoke wobble step at 12 drawings a second, like hand-drawn cels
const twos = t => Math.floor(t * 12) / 12;

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}

const C = {
  ink: '#1e1a24', washi: '#efe3c8', washiDk: '#d9c7a2', ver: '#cf3a26', gold: '#ffd25e',
  crim: '#c8163f', mag: '#e8488a', vio: '#5e2a8c', skin: '#f3cfae', skinSh: '#d9a988',
  hair: '#2a1d1c', coat: '#2f3b5c', coatSh: '#232c46', scarf: '#d9a43a', pants: '#3b3a40',
};

/* ------------------------------------------------------------ canvases */
const cv = document.getElementById('cv');
const main = cv.getContext('2d');
let g = main;
function mk(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
// draw fn into an offscreen canvas, temporarily redirecting g
function into(canvas, fn) {
  const prev = g;
  g = canvas.getContext('2d');
  fn(g);
  g = prev;
  return canvas;
}

/* ------------------------------------------------------------ primitives */
function withA(a, fn) {
  if (a <= .002) return;
  g.save();
  g.globalAlpha *= Math.min(1, a);
  fn();
  g.restore();
}
function tr(x, y, s = 1, r = 0, fn) {
  g.save(); g.translate(x, y); if (r) g.rotate(r); if (s !== 1) g.scale(s, s); fn(); g.restore();
}
function trs(x, y, sx, sy, fn) {
  g.save(); g.translate(x, y); g.scale(sx, sy); fn(); g.restore();
}
function glow(x, y, r, color, a = 1, op = 'lighter') {
  if (a <= .002 || r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  g.globalAlpha *= Math.min(1, a);
  g.globalCompositeOperation = op;
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, 2 * r, 2 * r);
  g.restore();
}
function circ(x, y, r, fill, a = 1) {
  if (a <= .002 || r <= 0) return;
  g.save(); g.globalAlpha *= a; g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
}
function ell(x, y, rx, ry, fill, rot = 0) {
  g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); g.fill();
}
function rect(x, y, w, h, fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); }
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function poly(pts, fill, close = true) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
}
// smooth closed/open curve through points (Catmull-Rom -> bezier)
function curve(pts, close = false) {
  const n = pts.length;
  const p = i => close ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  g.moveTo(pts[0][0], pts[0][1]);
  const m = close ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (close) g.closePath();
}
function stroke(pts, color, w = 3, a = 1, smooth = true) {
  if (a <= .002) return;
  g.save(); g.globalAlpha *= a; g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  if (smooth && pts.length > 2) curve(pts); else { g.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) g.lineTo(q[0], q[1]); }
  g.stroke(); g.restore();
}
// a limb: ink outline then colour, through joints
function limb(pts, color, w, ink = C.ink, iw = 1.6) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) g.lineTo(q[0], q[1]);
  g.strokeStyle = ink; g.lineWidth = w + iw * 2; g.stroke();
  g.strokeStyle = color; g.lineWidth = w; g.stroke();
  g.restore();
}
// fill then ink the current path
function inkPath(fill, lw = 1.4, ink = C.ink) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (lw) { g.lineWidth = lw; g.strokeStyle = ink; g.lineJoin = 'round'; g.stroke(); }
}
// two-bone IK: elbow position for shoulder s -> hand h, bend +1/-1
function ik(sx, sy, hx, hy, l1, l2, bend = 1) {
  let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy);
  const dd = clamp(d, Math.abs(l1 - l2) + .01, l1 + l2 - .01);
  if (d < 1e-6) { dx = 0; dy = 1; d = 1; }
  const a = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1));
  const base = Math.atan2(dy, dx) + bend * a;
  return [sx + l1 * Math.cos(base), sy + l1 * Math.sin(base)];
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function mixHex(h1, h2, p) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(lerp((a >> s) & 255, (b >> s) & 255, clamp(p))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function lin(x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
}
function rad(x, y, r0, r1, stops) {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
}
function fillAll(style, a = 1, op) {
  if (a <= .002) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a; if (op) g.globalCompositeOperation = op;
  g.fillStyle = style; g.fillRect(0, 0, W, H); g.restore();
}

/* ------------------------------------------------------------ text */
const FONT = f => f === 'mincho' ? '"Shippori Mincho"' : '"Cormorant Garamond"';
function T(str, x, y, o = {}) {
  const { size = 40, font = 'serif', weight = 500, color = '#f6efe2', align = 'center', base = 'middle',
    a = 1, shadow = 0, italic = false, ls = 0 } = o;
  if (a <= .002) return;
  g.save();
  g.globalAlpha *= a;
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT(font)}`;
  g.textAlign = align; g.textBaseline = base;
  if (ls) g.letterSpacing = ls + 'px';
  if (shadow) { g.shadowColor = o.shadowColor || 'rgba(0,0,0,.75)'; g.shadowBlur = shadow; }
  g.fillStyle = color;
  g.fillText(str, x, y);
  g.restore();
}
// vertical Japanese text, top-down, centred on x
function VT(str, x, y, o = {}) {
  const { size = 60, gap = 1.08 } = o;
  [...str].forEach((ch, i) => T(ch, x, y + i * size * gap, { font: 'mincho', weight: 800, color: C.ink, ...o, base: 'top' }));
}
// a red hanko seal with white characters
function seal(x, y, s, chars, a = 1) {
  withA(a, () => tr(x, y, s, -.03, () => {
    g.beginPath(); g.roundRect(-24, -24, 48, 48, 5);
    g.fillStyle = C.ver; g.fill();
    g.lineWidth = 2; g.strokeStyle = '#f3d9c8'; g.beginPath(); g.roundRect(-19, -19, 38, 38, 3); g.stroke();
    if (chars.length === 1) T(chars, 0, 1, { font: 'mincho', weight: 800, size: 30, color: '#fbeee4' });
    else [...chars].forEach((c, i) => T(c, 0, -9 + i * 19, { font: 'mincho', weight: 800, size: 17, color: '#fbeee4' }));
  }));
}

/* ------------------------------------------------------------ paper + grain */
const TEX = {};
function buildTextures() {
  // washi: warm fibrous paper
  const p = mk(W, H), pc = p.getContext('2d');
  const id = pc.createImageData(W, H), d = id.data, r = rng(7);
  for (let i = 0; i < W * H; i++) {
    const n = (r() + r() + r()) / 3 - .5;
    d[i * 4] = 239 + n * 22; d[i * 4 + 1] = 227 + n * 22; d[i * 4 + 2] = 200 + n * 24; d[i * 4 + 3] = 255;
  }
  pc.putImageData(id, 0, 0);
  pc.globalAlpha = .07; pc.strokeStyle = '#8a6a3a'; pc.lineWidth = 1;
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = r() * H, a = r() * TAU, l = 6 + r() * 26;
    pc.beginPath(); pc.moveTo(x, y); pc.quadraticCurveTo(x + Math.cos(a) * l * .5 + r() * 6, y + Math.sin(a) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); pc.stroke();
  }
  const vg = pc.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
  vg.addColorStop(0, 'rgba(120,80,30,0)'); vg.addColorStop(1, 'rgba(120,80,30,.28)');
  pc.globalAlpha = 1; pc.fillStyle = vg; pc.fillRect(0, 0, W, H);
  TEX.washi = p;
  // film grain frames
  TEX.grain = [0, 1, 2, 3].map(k => {
    const c = mk(960, 540), cc = c.getContext('2d'), im = cc.createImageData(960, 540), dd = im.data, rr2 = rng(100 + k);
    for (let i = 0; i < 960 * 540; i++) { const v = 128 + (rr2() - .5) * 120; dd[i * 4] = dd[i * 4 + 1] = dd[i * 4 + 2] = v; dd[i * 4 + 3] = 255; }
    cc.putImageData(im, 0, 0);
    return c;
  });
  // painterly canvas tooth used on backgrounds
  const tooth = mk(W, H), tc = tooth.getContext('2d'), r2 = rng(21);
  tc.fillStyle = '#808080'; tc.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    const v = 100 + r2() * 56 | 0;
    tc.fillStyle = `rgba(${v},${v},${v},.35)`;
    const x = r2() * W, y = r2() * H;
    tc.beginPath(); tc.ellipse(x, y, 2 + r2() * 14, 1 + r2() * 5, r2() * TAU, 0, TAU); tc.fill();
  }
  TEX.tooth = tooth;
  // vignette
  TEX.vig = into(mk(), () => {
    g.fillStyle = rad(W / 2, H / 2, H * .42, H * 1.02, [[0, 'rgba(10,6,14,0)'], [1, 'rgba(10,6,14,.55)']]);
    g.fillRect(0, 0, W, H);
  });
}
function finish(t, o = {}) {
  const { vig = 1, grain = .07, tooth = .1 } = o;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (tooth > 0) { g.globalAlpha = tooth; g.globalCompositeOperation = 'overlay'; g.drawImage(TEX.tooth, 0, 0); }
  g.globalCompositeOperation = 'source-over';
  if (vig > 0) { g.globalAlpha = vig; g.drawImage(TEX.vig, 0, 0); }
  g.globalAlpha = grain; g.globalCompositeOperation = 'overlay';
  g.drawImage(TEX.grain[Math.floor(t * 12) % 4], 0, 0, W, H);
  g.restore();
}

/* ------------------------------------------------------------ cards + captions */
// a yokai-database entry: washi strip with vertical name, seal, romaji and its role in the psyche
function card(t, t0, t1, o) {
  const a = vis(t, t0, t1, .6, .6);
  if (a <= 0) return;
  const { kanji, romaji, role, x = 1640, y = 120, seal: sl = '妖' } = o;
  const n = [...kanji].length, h = Math.max(330, 96 + n * 70 + 40);
  const slide = (1 - ease.out(P(t, t0, .8))) * 40;
  withA(a, () => tr(x + slide, y, 1, 0, () => {
    g.save();
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
    g.beginPath(); g.rect(-110, 0, 220, h);
    g.fillStyle = '#ece0c2'; g.fill();
    g.restore();
    g.save(); g.beginPath(); g.rect(-110, 0, 220, h); g.clip();
    g.globalAlpha = .55; g.drawImage(TEX.washi, 400, 200, 220, h, -110, 0, 220, h); g.restore();
    // mounting bars, like a hanging scroll
    rect(-118, -8, 236, 12, '#5a3a22'); rect(-118, h - 4, 236, 12, '#5a3a22');
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(60,40,20,.5)'; g.strokeRect(-98, 14, 196, h - 28);
    VT(kanji, 34, 34, { size: 62 });
    seal(-58, h - 66, .95, sl);
    g.save(); g.translate(-52, 40); g.rotate(Math.PI / 2);
    T(romaji.toUpperCase(), 0, 0, { size: 22, weight: 600, color: '#4a3424', align: 'left', ls: 5 });
    g.restore();
  }));
  // role line beneath the scroll, on a dark ribbon so it reads on any background
  const ra = a * S(t, t0 + .5, .6);
  if (ra > 0) {
    g.save(); g.font = `italic 500 34px ${FONT('serif')}`; const rw = g.measureText(role).width; g.restore();
    const rx = clamp(x, 40 + rw / 2, W - 40 - rw / 2);
    withA(ra * .72, () => { g.fillStyle = 'rgba(14,8,16,.85)'; rr(rx - rw / 2 - 26, y + h + 22, rw + 52, 50, 25); g.fill(); });
    T(role, rx, y + h + 46, { size: 34, italic: true, color: '#fff5e4', a: ra });
  }
}
// lower-third poetic caption
function caption(t, t0, t1, str, o = {}) {
  const a = vis(t, t0, t1, .9, .9);
  if (a <= 0) return;
  const { y = 968, size = 44, color = '#fbf3e6', shadow = 18 } = o;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (shadow) T(str, W / 2, y + (1 - S(t, t0, 1.2)) * 10, { size, italic: true, color: 'rgba(0,0,0,.6)', a, shadow: 26, shadowColor: 'rgba(0,0,0,1)', weight: 500 });
  T(str, W / 2, y + (1 - S(t, t0, 1.2)) * 10, { size, italic: true, color, a, shadow, shadowColor: 'rgba(0,0,0,.9)', weight: 500 });
  g.restore();
}
// a whispered word drifting from the lust yokai
function whisper(t, t0, x, y, str, o = {}) {
  const u = t - t0, dur = o.dur || 2.4;
  if (u < 0 || u > dur) return;
  const a = Math.sin(Math.PI * u / dur), dx = (o.dx ?? 60) * u / dur, dy = (o.dy ?? -50) * u / dur;
  g.save();
  T(str, x + dx, y + dy, { font: 'mincho', weight: 800, size: o.size || 34, color: '#3a0618', a: a * .7, shadow: 10, shadowColor: '#000' });
  T(str, x + dx, y + dy, { font: 'mincho', weight: 800, size: o.size || 34, color: '#ffb3c9', a: a * .95, shadow: 16, shadowColor: '#ff2a6a' });
  g.restore();
}
