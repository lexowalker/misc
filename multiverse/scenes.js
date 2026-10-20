// Every visual is a pure function of time: render(t) paints the whole frame for second t.
const TL = window.TL.lines, TOTAL = window.TL.total;
const S = id => TL[id].start, E = id => TL[id].end, D = id => E(id) - S(id);
const at = (id, f) => S(id) + f * D(id);
// estimated onset of a phrase inside a line, by character position
const W = (id, s) => {
  const i = TL[id].text.indexOf(s);
  if (i < 0) console.error('phrase not found', id, s);
  return at(id, i / TL[id].text.length);
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, d) => clamp((t - a) / d);
const lerp = (a, b, p) => a + (b - a) * p;
const ease = {
  out: p => 1 - Math.pow(1 - p, 3),
  inout: p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  back: p => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  spring: p => (p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(p * 14)),
};
const fadeIn = (t, a, d = .4) => ease.out(P(t, a, d));
const popIn = (t, a, d = .5) => ease.back(P(t, a, d));
const vis = (t, a, b, fi = .4, fo = .4) => fadeIn(t, a, fi) * (1 - ease.inout(P(t, b - fo, fo)));
const TAU = Math.PI * 2;

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(TAU * r());

const C = {
  cyan: '#38e8ff', mag: '#ff3ea5', gold: '#ffc83d', vio: '#9b6bff', lime: '#7dff9a',
  coral: '#ff7a59', red: '#ff4a5e', blue: '#3d9bff', white: '#f4f1ff', mute: '#a29fcc', ink: '#0a0b24',
};

window.SFX = [];
const sfx = (t, type, gain = 1) => window.SFX.push({ t: +t.toFixed(3), type, gain });

/* ------------------------------------------------------------- drawing kit */
const cv = document.getElementById('cv');
const main = cv.getContext('2d');
const layer = document.createElement('canvas');
layer.width = 1920; layer.height = 1080;
const lctx = layer.getContext('2d');
let g = main;

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
const FONT = f => f === 'Inter' ? 'Inter' : f === 'mono' ? '"JetBrains Mono"' : f === 'serif' ? 'Fraunces' : `"${f}"`;
function T(str, x, y, o = {}) {
  const { size = 40, font = 'Inter', weight = 500, color = C.white, align = 'center', base = 'middle',
    a = 1, glow = 0, italic = false, ls = 0, stroke } = o;
  if (a <= .002) return;
  g.save();
  g.globalAlpha *= a;
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT(font)}`;
  g.textAlign = align; g.textBaseline = base;
  if (ls) g.letterSpacing = ls + 'px';
  if (glow) { g.shadowColor = o.glowColor || color; g.shadowBlur = glow; }
  if (stroke) { g.lineWidth = stroke[1]; g.strokeStyle = stroke[0]; g.lineJoin = 'round'; g.strokeText(str, x, y); }
  g.fillStyle = color;
  g.fillText(str, x, y);
  g.restore();
}
function textW(str, size, weight = 500, font = 'Inter') {
  g.save();
  g.font = `${weight} ${size}px ${FONT(font)}`;
  const w = g.measureText(str).width;
  g.restore();
  return w;
}
function rr(x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function glow(x, y, r, color, a = 1) {
  if (a <= .002) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  g.globalAlpha *= a;
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, 2 * r, 2 * r);
  g.restore();
}
function dot(x, y, r, color, a = 1) {
  if (a <= .002) return;
  g.save(); g.globalAlpha *= a; g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
}
function photon(x, y, color, a = 1, s = 1) {
  glow(x, y, 46 * s, color, .9 * a);
  dot(x, y, 7 * s, '#ffffff', a);
}
function line(pts, color, w = 3, a = 1, dash) {
  if (a <= .002) return;
  g.save(); g.globalAlpha *= a; g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke(); g.restore();
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function mixHex(h1, h2, p) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(lerp((a >> s) & 255, (b >> s) & 255, p)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
// a pill label
function chip(str, x, y, o = {}) {
  const { size = 30, color = C.white, bg = 'rgba(20,18,60,.82)', border = C.vio, a = 1, s = 1, weight = 600 } = o;
  if (a <= .002) return;
  const w = textW(str, size, weight) + size * 1.3, h = size * 1.75;
  tr(x, y, s, 0, () => withA(a, () => {
    rr(-w / 2, -h / 2, w, h, h / 2);
    g.fillStyle = bg; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = border; g.stroke();
    T(str, 0, 2, { size, color, weight });
  }));
}
function check(x, y, s, color = C.lime, p = 1) {
  const pts = [[-20, 0], [-6, 16], [24, -18]].map(([a, b]) => [x + a * s, y + b * s]);
  const len1 = Math.hypot(14, 16), len2 = Math.hypot(30, 34), L = (len1 + len2) * p;
  const out = [pts[0]];
  if (L <= len1) out.push([lerp(pts[0][0], pts[1][0], L / len1), lerp(pts[0][1], pts[1][1], L / len1)]);
  else { out.push(pts[1]); const q = (L - len1) / len2; out.push([lerp(pts[1][0], pts[2][0], q), lerp(pts[1][1], pts[2][1], q)]); }
  if (p > 0) line(out, color, 9 * s);
}
function cross(x, y, s, color = C.red, p = 1) {
  const q1 = clamp(p * 2), q2 = clamp(p * 2 - 1);
  if (q1 > 0) line([[x - 20 * s, y - 20 * s], [x + lerp(-20, 20, q1) * s, y + lerp(-20, 20, q1) * s]], color, 9 * s);
  if (q2 > 0) line([[x + 20 * s, y - 20 * s], [x + lerp(20, -20, q2) * s, y + lerp(-20, 20, q2) * s]], color, 9 * s);
}
function arrow(x1, y1, x2, y2, color, w = 4, a = 1, head = 18) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  line([[x1, y1], [x2, y2]], color, w, a);
  line([[x2 - head * Math.cos(ang - .5), y2 - head * Math.sin(ang - .5)], [x2, y2],
    [x2 - head * Math.cos(ang + .5), y2 - head * Math.sin(ang + .5)]], color, w, a);
}

/* -------------------------------------------------------------- characters */
// A small scientist standing with feet at (x, y). o: {coat, accent, pose, t, look, blinkSeed, book}
function person(x, y, s, o = {}) {
  const { coat = '#eef0ff', accent = C.cyan, pose = 'idle', t = 0, look = 0, hair = '#2b1d3f', skin = '#f2c29b', page = 0, halo } = o;
  tr(x, y, s, 0, () => {
    if (halo) glow(0, -110, 190, halo, .55);
    // legs
    g.fillStyle = '#2a2458';
    rr(-27, -66, 22, 66, 9); g.fill();
    rr(5, -66, 22, 66, 9); g.fill();
    g.fillStyle = '#16133a';
    rr(-33, -10, 30, 12, 6); g.fill();
    rr(3, -10, 30, 12, 6); g.fill();
    // coat
    g.fillStyle = coat;
    g.beginPath();
    g.moveTo(-40, -150); g.quadraticCurveTo(-48, -150, -50, -128); g.lineTo(-54, -52);
    g.quadraticCurveTo(-54, -44, -46, -44); g.lineTo(46, -44); g.quadraticCurveTo(54, -44, 54, -52);
    g.lineTo(50, -128); g.quadraticCurveTo(48, -150, 40, -150); g.closePath(); g.fill();
    // shirt
    g.fillStyle = accent;
    g.beginPath(); g.moveTo(-15, -150); g.lineTo(15, -150); g.lineTo(0, -108); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,30,90,.35)'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(0, -108); g.lineTo(0, -46); g.stroke();
    // arms
    g.strokeStyle = coat; g.lineWidth = 19; g.lineCap = 'round';
    const sway = Math.sin(t * 1.7) * 3;
    if (pose === 'read' || pose === 'write') {
      g.beginPath(); g.moveTo(-42, -138); g.quadraticCurveTo(-46, -100, -18, -96); g.stroke();
      g.beginPath(); g.moveTo(42, -138); g.quadraticCurveTo(46, -100, 18, -96); g.stroke();
      // book / notebook
      g.save(); g.translate(0, -104);
      g.fillStyle = pose === 'read' ? (o.bookColor || C.mag) : '#fff8e6';
      rr(-36, -26, 72, 46, 5); g.fill();
      if (pose === 'read') {
        g.fillStyle = '#fff5e8';
        rr(-32, -22, 31, 38, 3); g.fill(); rr(1, -22, 31, 38, 3); g.fill();
        if (page > 0 && page < 1) { // a turning page
          const w = 31 * Math.cos(page * Math.PI);
          g.fillStyle = '#ffffff'; rr(Math.min(0, w), -22, Math.abs(w), 38, 3); g.fill();
        }
      } else if (o.note) {
        T(o.note, 0, -2, { size: 17, weight: 700, font: 'mono', color: o.noteColor || '#222' });
      }
      g.restore();
      g.fillStyle = skin;
      dot(-20, -94, 8, skin); dot(20, -94, 8, skin);
    } else if (pose === 'point') {
      g.beginPath(); g.moveTo(-42, -138); g.quadraticCurveTo(-52, -100, -48 + sway * .2, -68); g.stroke();
      g.beginPath(); g.moveTo(42, -138); g.quadraticCurveTo(70, -150, 88, -176); g.stroke();
      dot(-48, -64, 9, skin); dot(90, -180, 9, skin);
    } else {
      g.beginPath(); g.moveTo(-42, -138); g.quadraticCurveTo(-54, -100, -50 + sway * .3, -68); g.stroke();
      g.beginPath(); g.moveTo(42, -138); g.quadraticCurveTo(54, -100, 50 - sway * .3, -68); g.stroke();
      dot(-50 + sway * .3, -64, 9, skin); dot(50 - sway * .3, -64, 9, skin);
    }
    // neck + head
    g.fillStyle = skin; rr(-9, -166, 18, 20, 6); g.fill();
    const hy = -200 + Math.sin(t * 1.7) * 1.5 + (pose === 'read' ? 4 : 0);
    dot(0, hy, 40, skin);
    // hair
    g.fillStyle = hair;
    g.beginPath(); g.arc(0, hy - 4, 42, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(30, hy - 26, -6, hy - 24);
    g.quadraticCurveTo(-30, hy - 20, -42, hy - 2); g.closePath(); g.fill();
    dot(22, hy - 44, 14, hair);
    // face
    const lx = look * 6, ly = pose === 'read' || pose === 'write' ? 6 : 0;
    const blink = ((t + (o.phase || 0)) % 3.7) < .13;
    g.fillStyle = '#231a3a';
    if (blink) { rr(-19 + lx, hy + 2 + ly, 14, 3, 2); g.fill(); rr(6 + lx, hy + 2 + ly, 14, 3, 2); g.fill(); }
    else { dot(-12 + lx, hy + 3 + ly, 4.5, '#231a3a'); dot(13 + lx, hy + 3 + ly, 4.5, '#231a3a'); }
    g.strokeStyle = '#3c2f63'; g.lineWidth = 3;
    g.beginPath(); g.arc(-12 + lx * .6, hy + 3, 11, 0, TAU); g.stroke();
    g.beginPath(); g.arc(13 + lx * .6, hy + 3, 11, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(-1 + lx * .6, hy + 2); g.lineTo(2 + lx * .6, hy + 2); g.stroke();
    // smile
    g.strokeStyle = '#8a3b4f'; g.lineWidth = 3;
    g.beginPath(); g.arc(lx * .5, hy + 17, 8, .2 * Math.PI, .8 * Math.PI); g.stroke();
    dot(-24, hy + 16, 6, 'rgba(255,120,140,.35)'); dot(25, hy + 16, 6, 'rgba(255,120,140,.35)');
  });
}
function planet(x, y, r, o = {}) {
  const { t = 0, sea = '#2f7dff', land = '#3fd38a', seed = 3 } = o;
  glow(x, y, r * 1.7, hexA(sea, .55), .8);
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
  const gr = g.createRadialGradient(x - r * .4, y - r * .4, r * .1, x, y, r);
  gr.addColorStop(0, '#7fc3ff'); gr.addColorStop(.5, sea); gr.addColorStop(1, '#0d2a7a');
  g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  const R = rng(seed);
  for (let i = 0; i < 6; i++) {
    const cx = ((R() * 2.4 + t * .05) % 2.4 - 1.2) * r, cy = (R() - .5) * 1.4 * r, w = (R() * .5 + .3) * r;
    g.fillStyle = land; g.globalAlpha = .85;
    g.beginPath(); g.ellipse(x + cx, y + cy, w, w * .55, R() * 3, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  const sh = g.createLinearGradient(x - r, y - r, x + r, y + r);
  sh.addColorStop(.45, 'rgba(0,0,30,0)'); sh.addColorStop(1, 'rgba(0,0,30,.55)');
  g.fillStyle = sh; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  g.restore();
}
function lamp(x, y, s, color, on = 0) {
  tr(x, y, s, 0, () => {
    if (on > 0) glow(0, -40, 170, color, on);
    g.fillStyle = '#3b376e'; rr(-26, -12, 52, 22, 6); g.fill();
    g.fillStyle = '#56518f'; rr(-14, -22, 28, 12, 3); g.fill();
    dot(0, -46, 26, on > 0 ? mixHex('#d8d6f0', color, on) : '#d8d6f0');
    if (on > 0) dot(-8, -54, 7, 'rgba(255,255,255,.75)');
  });
}
function detector(x, y, s, o = {}) {
  tr(x, y, s, 0, () => {
    g.fillStyle = '#2c2866'; rr(-60, -50, 120, 100, 16); g.fill();
    g.strokeStyle = o.border || C.vio; g.lineWidth = 4; g.stroke();
    for (let i = 0; i < 4; i++) { g.fillStyle = '#1a1745'; rr(-40, -30 + i * 16, 80, 8, 4); g.fill(); }
    if (o.flash) glow(0, 0, 120, o.flashColor || C.white, o.flash);
  });
}
// a "universe": rounded panel with its own little starfield, clipped. inner(w, h) draws in panel coords
function card(x, y, w, h, o = {}) {
  const { border = C.cyan, seed = 1, t = 0, a = 1, inner, double = 0, s = 1, bw = 4 } = o;
  if (a <= .002) return;
  tr(x, y, s, 0, () => withA(a, () => {
    g.save();
    rr(-w / 2, -h / 2, w, h, 26);
    const gr = g.createLinearGradient(0, -h / 2, 0, h / 2);
    gr.addColorStop(0, '#141546'); gr.addColorStop(1, '#251248');
    g.fillStyle = gr; g.fill();
    g.clip();
    const R = rng(seed);
    for (let i = 0; i < w * h / 2600; i++) {
      const sx = (R() - .5) * w, sy = (R() - .5) * h, tw = .5 + .5 * Math.sin(t * (1 + R() * 2) + R() * 9);
      dot(sx, sy, R() * 1.6 + .5, '#ffffff', .25 + .6 * tw * R());
    }
    if (inner) { g.save(); g.translate(-w / 2, -h / 2); inner(w, h); g.restore(); }
    g.restore();
    if (double > 0) {
      const off = double * 9;
      g.lineWidth = bw; g.strokeStyle = hexA(C.cyan, .9); rr(-w / 2 - off, -h / 2 - off * .5, w, h, 26); g.stroke();
      g.strokeStyle = hexA(C.mag, .9); rr(-w / 2 + off, -h / 2 + off * .5, w, h, 26); g.stroke();
    }
    g.lineWidth = bw; g.strokeStyle = border;
    g.shadowColor = border; g.shadowBlur = 24;
    rr(-w / 2, -h / 2, w, h, 26); g.stroke();
  }));
}
function header(t, num, title, a, b) {
  const v = vis(t, a, b, .6, .5);
  if (v <= 0) return;
  const x = 80 - 30 * (1 - v);
  withA(v, () => {
    T(num, x, 78, { size: 26, font: 'mono', weight: 600, color: C.gold, align: 'left', ls: 3 });
    T(title, x + 62, 78, { size: 30, weight: 600, color: C.white, align: 'left', ls: 1 });
    line([[x, 104], [x + 62 + textW(title, 30, 600) + 6, 104]], hexA(C.gold, .5), 2);
  });
}
function musicNote(x, y, s, color, a) {
  tr(x, y, s, -.15, () => withA(a, () => {
    g.fillStyle = color; g.strokeStyle = color; g.lineWidth = 4;
    g.beginPath(); g.ellipse(0, 0, 11, 8, -.4, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(10, -3); g.lineTo(10, -40); g.quadraticCurveTo(22, -30, 26, -22); g.stroke();
  }));
}
function magnifier(x, y, s, a = 1) {
  tr(x, y, s, 0, () => withA(a, () => {
    g.fillStyle = 'rgba(160,220,255,.12)';
    g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.fill();
    g.strokeStyle = C.gold; g.lineWidth = 10; g.stroke();
    g.lineCap = 'round'; g.lineWidth = 18;
    g.beginPath(); g.moveTo(44, 44); g.lineTo(100, 100); g.stroke();
  }));
}

/* ------------------------------------------------------------- background */
const STARS = [];
let NEB = [];
function makeNebula(seed, cols) {
  const c = document.createElement('canvas');
  c.width = 960; c.height = 540;
  const x = c.getContext('2d');
  const R = rng(seed);
  x.fillStyle = '#05061a'; x.fillRect(0, 0, 960, 540);
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const cx = R() * 960, cy = R() * 540, r = 120 + R() * 320;
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, hexA(cols[i % cols.length], .16 + R() * .12));
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 960, 540);
  }
  return c;
}
let BG_MOOD = () => 0;
function background(t) {
  g = main;
  const m = BG_MOOD(t);
  g.globalAlpha = 1;
  const dx = Math.sin(t * .03) * 40, dy = Math.cos(t * .021) * 25;
  g.drawImage(NEB[0], -60 + dx, -40 + dy, 2040, 1160);
  if (m > 0) { g.globalAlpha = m; g.drawImage(NEB[1], -60 - dx, -40 - dy, 2040, 1160); g.globalAlpha = 1; }
  for (const s of STARS) {
    const x = ((s.x + t * s.v) % 1960 + 1960) % 1960 - 20;
    const tw = .55 + .45 * Math.sin(t * s.f + s.p);
    dot(x, s.y, s.r, s.c, s.b * tw);
  }
}
function vignette() {
  const gr = g.createRadialGradient(960, 540, 500, 960, 540, 1150);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,10,.55)');
  g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
}

/* --------------------------------------------------------------- captions */
const CAP_TEXT = {
  b3: 'Hugh Everett first proposed it in 1957, simply by taking the equations of quantum theory at face value.',
  b4: 'Many physicists preferred to say the theory only predicts the results of experiments, and that asking what is really happening is meaningless. “Shut up and calculate.”',
  h5: 'In his book, The Beginning of Infinity, he calls it the multiverse. So let’s build one, piece by piece.',
  d4: 'And the difference grows. The scientist who sees red writes “red” in her notebook. Her doppelgänger writes “blue.” Their days, and eventually their lives, begin to diverge.',
};
const CAPS = [];
function buildCaptions() {
  for (const id in TL) {
    const words = (CAP_TEXT[id] || TL[id].text).replace(/'/g, '’').split(' ');
    const chunks = [];
    let cur = [];
    for (const w of words) {
      cur.push(w);
      const len = cur.join(' ').length;
      if ((len > 44 && /[,.:?!;”]$/.test(w)) || len > 62) { chunks.push(cur.join(' ')); cur = []; }
    }
    if (cur.length) {
      if (chunks.length && cur.join(' ').length < 16) chunks.push(chunks.pop() + ' ' + cur.join(' '));
      else chunks.push(cur.join(' '));
    }
    const total = chunks.join(' ').length;
    let c = 0;
    chunks.forEach((txt, i) => {
      const a = at(id, c / total);
      c += txt.length + 1;
      const b = i === chunks.length - 1 ? E(id) + .35 : at(id, c / total);
      CAPS.push({ a, b, txt });
    });
  }
}
function captions(t) {
  const c = CAPS.find(c => t >= c.a - .05 && t < c.b);
  if (!c) return;
  const o = fadeIn(t, c.a - .05, .12) * (1 - P(t, c.b - .08, .08));
  const w = textW(c.txt, 36, 500) + 56;
  withA(o, () => {
    rr(960 - w / 2, 1000 - 30, w, 62, 16);
    g.fillStyle = 'rgba(6,6,24,.62)'; g.fill();
    T(c.txt, 960, 1002, { size: 36, weight: 500, color: '#fbfaff' });
  });
}

/* ------------------------------------------------------------------ scenes */
const SCENES = [];
function scene(first, last, fn, opts = {}) {
  SCENES.push({ first, last, fn, ...opts });
}

/* ---------------------------------------------------------- shared pieces */
// branching "river" of histories: each node splits its measure among children
function makeTree(seed, x0, y0, opts = {}) {
  const { depth = 6, step = 260, spread = 330, w0 = 70 } = opts;
  const R = rng(seed), segs = [];
  (function grow(x, y, w, d, span, hue) {
    if (d >= depth) return;
    const n = R() < .3 ? 3 : 2;
    let cuts = Array.from({ length: n - 1 }, () => .2 + R() * .6).sort((a, b) => a - b);
    cuts = [0, ...cuts, 1];
    for (let k = 0; k < n; k++) {
      const share = cuts[k + 1] - cuts[k];
      const off = ((cuts[k] + cuts[k + 1]) / 2 - .5) * span;
      const x2 = x + step * (.85 + R() * .3), y2 = y + off;
      const h = hue + (k - (n - 1) / 2) * 38 + (R() - .5) * 20;
      segs.push({ x1: x, y1: y, x2, y2, w: w * share, d, h });
      grow(x2, y2, w * share, d + 1, span * .62, h);
    }
  })(x0, y0, w0, 0, spread, 250);
  return segs;
}
function drawTree(segs, reveal, a = 1, t = 0, hl) {
  if (a <= .002) return;
  g.save();
  g.globalAlpha *= a;
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (const s of segs) {
    if (s.x1 > reveal) continue;
    const p = clamp((reveal - s.x1) / (s.x2 - s.x1));
    const ex = lerp(s.x1, s.x2, p);
    const mx = (s.x1 + s.x2) / 2;
    const col = `hsl(${((s.h % 360) + 360) % 360} 95% 64%)`;
    g.strokeStyle = col;
    g.lineWidth = Math.max(1.2, s.w * 1.1);
    g.globalAlpha = a * (.25 + .35 * (1 - s.d / 7));
    g.beginPath();
    g.moveTo(s.x1, s.y1);
    // sample the bezier up to the reveal point
    for (let i = 1; i <= 16; i++) {
      const u = i / 16 * p;
      const bx = Math.pow(1 - u, 3) * s.x1 + 3 * Math.pow(1 - u, 2) * u * mx + 3 * (1 - u) * u * u * mx + u * u * u * s.x2;
      const by = Math.pow(1 - u, 3) * s.y1 + 3 * Math.pow(1 - u, 2) * u * s.y1 + 3 * (1 - u) * u * u * s.y2 + u * u * u * s.y2;
      g.lineTo(bx, by);
    }
    g.stroke();
    g.lineWidth = Math.max(.8, s.w * .25);
    g.globalAlpha = a * .8;
    g.strokeStyle = '#ffffff';
    g.stroke();
  }
  g.restore();
}
function gear(x, y, r, teeth, rot, color, a = 1) {
  tr(x, y, 1, rot, () => withA(a, () => {
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const ang = i / (teeth * 2) * TAU, rr2 = i % 2 ? r : r * 1.18;
      const a1 = ang - TAU / (teeth * 4) * .8, a2 = ang + TAU / (teeth * 4) * .8;
      g.lineTo(Math.cos(a1) * rr2, Math.sin(a1) * rr2);
      g.lineTo(Math.cos(a2) * rr2, Math.sin(a2) * rr2);
    }
    g.closePath(); g.fill();
    dot(0, 0, r * .38, '#120f35');
  }));
}
// two people from the opening
function twins(t, x1, x2, y, s, a2 = 1, opts = {}) {
  if (a2 > 0) withA(a2, () => person(x2, y, s, { t, accent: C.mag, halo: hexA(C.mag, .8), phase: 0, ...opts }));
  person(x1, y, s, { t, accent: C.cyan, halo: hexA(C.cyan, .8), phase: 0, ...opts });
}

/* ================================================================= 1 HOOK */
scene('h1', 'h5', (t) => {
  const ta = W('h1', 'another');
  const p = ease.inout(P(t, ta, 1.1));
  const hookA = 1 - fadeIn(t, S('h4') + .1, .6);
  if (hookA > 0) withA(hookA, () => {
    // h3: two worlds side by side
    const w3 = fadeIn(t, S('h3'), .8);
    if (w3 > 0) {
      g.save(); g.globalAlpha *= w3 * .9;
      let gr = g.createLinearGradient(0, 0, 960, 0);
      gr.addColorStop(0, 'rgba(56,232,255,0)'); gr.addColorStop(1, 'rgba(56,232,255,.13)');
      g.fillStyle = gr; g.fillRect(0, 0, 960, 1080);
      gr = g.createLinearGradient(960, 0, 1920, 0);
      gr.addColorStop(0, 'rgba(255,62,165,.13)'); gr.addColorStop(1, 'rgba(255,62,165,0)');
      g.fillStyle = gr; g.fillRect(960, 0, 960, 1080);
      const sh = 1080 * ease.out(P(t, S('h3'), 1));
      g.fillStyle = '#ffffff'; g.shadowColor = C.vio; g.shadowBlur = 30;
      g.fillRect(958, 0, 4, sh);
      g.restore();
      T('YOUR WORLD', 480, 150, { size: 28, weight: 700, color: C.cyan, ls: 6, a: w3 });
      T('THEIR WORLD', 1440, 150, { size: 28, weight: 700, color: C.mag, ls: 6, a: w3 });
      // a particle in each world: theirs goes left, yours goes right
      const drop = (x0, dir, t0, col) => {
        if (t < t0) return;
        const pts = [];
        const u = clamp((t - t0) / 1.5);
        for (let i = 0; i <= 30; i++) {
          const v = i / 30 * u;
          const y = 200 + 260 * Math.min(1, v / .5);
          const x = x0 + dir * 150 * ease.inout(clamp((v - .45) / .55));
          pts.push([x, y + (v > .5 ? 60 * (v - .5) : 0)]);
        }
        line(pts, col, 5, .8);
        const [hx, hy] = pts[pts.length - 1];
        photon(hx, hy, col, 1, 1.1);
        if (u >= 1) T(dir < 0 ? 'LEFT' : 'RIGHT', hx, hy + 56, { size: 34, weight: 700, color: col, ls: 4, a: fadeIn(t, t0 + 1.5) });
      };
      drop(1440, -1, W('h3', 'went left') - .5, C.mag);
      drop(480, 1, W('h3', 'it went right') - .5, C.cyan);
    }
    const sx = w3 > 0 ? lerp(230, 480, ease.inout(P(t, S('h3'), 1))) : 230;
    const x1 = 960 - sx * p, x2 = 960 + sx * p;
    const song = W('h2', 'song');
    const read = 0;
    twins(t, x1, x2, 860, 1.45, p, { look: 0 });
    // h2: the sameness checklist
    const items = [['memories', W('h2', 'memories')], ['face', W('h2', 'face')], ['favorite song', song]];
    const chipsA = 1 - fadeIn(t, S('h3') - .1, .4);
    items.forEach(([s, ts], i) => {
      chip('same ' + s, 960, 330 + i * 90, { a: fadeIn(t, ts - .15, .3) * chipsA, s: popIn(t, ts - .15, .45), border: [C.cyan, C.vio, C.mag][i] });
    });
    for (let k = 0; k < 4; k++) {
      const tk = song + .1 + k * .45, u = P(t, tk, 2.4);
      if (u > 0 && u < 1) {
        const a = Math.sin(u * Math.PI) * chipsA;
        musicNote(x1 + 40 + Math.sin(u * 6 + k) * 30, 520 - u * 220, 1.2, C.gold, a);
        musicNote(x2 + 40 + Math.sin(u * 6 + k) * 30, 520 - u * 220, 1.2, C.gold, a);
      }
    }
  });
  // h4: who says so
  const n1 = vis(t, S('h4'), W('h4', 'According') + .1, .4, .35);
  T('This isn’t science fiction.', 960, 470, { size: 92, font: 'serif', weight: 600, a: n1, glow: 30, glowColor: C.vio });
  const nA = vis(t, W('h4', 'According'), S('h5') + .2, .5, .4);
  if (nA > 0) {
    const yy = 380 + 20 * (1 - fadeIn(t, W('h4', 'According'), .7));
    T('DAVID DEUTSCH', 960, yy, { size: 120, font: 'serif', weight: 700, a: nA, ls: 10, glow: 40, glowColor: C.cyan });
    T('physicist  ·  University of Oxford  ·  pioneer of quantum computation', 960, yy + 100, { size: 32, color: C.mute, a: nA * fadeIn(t, W('h4', 'physicist') + .6) });
    const q = W('h4', 'our best theory');
    chip('ψ   quantum theory', 960, 640, { size: 40, a: nA * fadeIn(t, q, .3), s: popIn(t, q), border: C.gold });
    T('…taken seriously', 960, 750, { size: 54, font: 'serif', italic: true, weight: 500, color: C.gold, a: nA * fadeIn(t, W('h4', 'take it seriously'), .5) });
  }
  // h5: the book, then the title
  const bk = vis(t, S('h5') - .1, W('h5', 'the multiverse') + .2, .5, .5);
  if (bk > 0) {
    const bob = Math.sin(t * 1.3) * 6;
    tr(960, 500 + bob, .9 + .1 * popIn(t, S('h5') - .1, .6), -.04, () => withA(bk, () => {
      g.shadowColor = C.vio; g.shadowBlur = 60;
      g.fillStyle = '#16184e'; rr(-190, -260, 380, 520, 14); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#2a2d7a'; rr(-190, -260, 26, 520, 8); g.fill();
      const gr = g.createLinearGradient(-150, -200, 150, 200);
      gr.addColorStop(0, C.cyan); gr.addColorStop(.5, C.vio); gr.addColorStop(1, C.mag);
      g.strokeStyle = gr; g.lineWidth = 6;
      g.beginPath();
      for (let i = 0; i <= 120; i++) {
        const u = i / 120 * TAU, d = 1 + Math.sin(u) ** 2;
        const x = 110 * Math.cos(u) / d, y = 110 * Math.sin(u) * Math.cos(u) / d;
        i ? g.lineTo(x + 12, y - 40) : g.moveTo(x + 12, y - 40);
      }
      g.stroke();
      T('THE BEGINNING', 12, 90, { size: 34, weight: 700, ls: 3 });
      T('OF INFINITY', 12, 132, { size: 34, weight: 700, ls: 3 });
      T('DAVID DEUTSCH', 12, 210, { size: 22, weight: 600, color: C.gold, ls: 4 });
    }));
  }
  const ti = W('h5', 'the multiverse');
  const tv = fadeIn(t, ti, .8);
  if (tv > 0) {
    drawTree(TREES.title, lerp(-100, 2000, ease.inout(P(t, ti - .3, 3.2))), tv * .9, t);
    const s = .85 + .15 * ease.out(P(t, ti, 1.6));
    withA(tv, () => { g.save(); g.translate(960, 560); g.scale(1, .32); const dk = g.createRadialGradient(0, 0, 0, 0, 0, 900); dk.addColorStop(0, 'rgba(5,6,26,.85)'); dk.addColorStop(1, 'rgba(5,6,26,0)'); g.fillStyle = dk; g.fillRect(-900, -900, 1800, 1800); g.restore(); });
    tr(960, 470, s, 0, () => {
      const gr = g.createLinearGradient(-620, 0, 620, 0);
      const sh = (t * .15) % 1;
      [C.cyan, C.vio, C.mag, C.gold, C.cyan].forEach((c, i) => gr.addColorStop(clamp((i / 4 + sh) % 1.0001), c));
      T('THE MULTIVERSE', 0, 0, { size: 170, font: 'serif', weight: 800, ls: 10, a: tv, color: gr, glow: 50, glowColor: C.vio });
    });
    T('an animated guide to Chapter 11 of David Deutsch’s The Beginning of Infinity', 960, 610, { size: 34, color: C.white, a: fadeIn(t, ti + .9, .8) * .9, stroke: ['rgba(5,6,26,.85)', 8] });
    T('let’s build one, piece by piece', 960, 690, { size: 40, font: 'serif', italic: true, color: C.gold, a: fadeIn(t, W('h5', 'piece by piece'), .6), stroke: ['rgba(5,6,26,.85)', 8] });
  }
});

/* ============================================================ 2 FUNGIBLE */
function uniInner(t, o = {}) {
  return (w, h) => {
    const k = h / 440;
    planet(w * .24, h * .36, 70 * k, { t, seed: 5 });
    // sparkles: "every star"
    if (o.spark > 0) {
      const R = rng(9);
      for (let i = 0; i < 6; i++) {
        const x = R() * w, y = R() * h * .6, s = (10 + R() * 10) * k * o.spark * (0.7 + .3 * Math.sin(t * 5 + i));
        glow(x, y, s * 3, C.gold, .8);
        line([[x - s, y], [x + s, y]], '#fff', 2.5); line([[x, y - s], [x, y + s]], '#fff', 2.5);
      }
    }
    if (o.ring > 0) withA(1 - o.ring, () => { g.strokeStyle = C.lime; g.lineWidth = 4; g.beginPath(); g.arc(w * .24, h * .36, 70 * k * (1 + o.ring * .9), 0, TAU); g.stroke(); });
    person(w * .7, h * .96, 1.05 * k, { t, pose: o.pose || 'idle', page: o.page || 0, accent: o.accent || C.cyan, bookColor: C.gold });
  };
}
scene('f1', 'f7', (t) => {
  header(t, '01', 'Two identical worlds', S('f1'), S('d1') + .2);
  const split = ease.inout(P(t, W('f1', 'two copies'), 1.1));
  const away = fadeIn(t, S('f4') - .1, .6), back = ease.inout(P(t, S('f7') - .2, 1));
  const merge = ease.inout(P(t, W('f7', 'As long as'), 1.4));
  const cardsA = (1 - away) + back;
  const sp = 360 * split * (1 - merge);
  const ring = P(t, W('f2', 'Two Earths'), 1.2), spark = vis(t, W('f2', 'every star'), W('f2', 'Two of you') + .6, .3, .4);
  const read = t > W('f2', 'Two of you') && t < S('f4') + .5;
  const page = P(t, W('f2', 'perfect unison'), .8);
  const inner = uniInner(t, { ring: ring > 0 && ring < 1 ? ring : 0, spark, pose: read ? 'read' : 'idle', page });
  const cw = 620, ch = 440;
  const y = 470 - 40 * merge;
  const s0 = .9 + .1 * popIn(t, S('f1') - .2, .7);
  if (cardsA > 0) {
    card(960 + sp, y, cw, ch, { t, a: clamp(cardsA) * split, inner, seed: 4, border: C.mag, s: s0 });
    card(960 - sp, y, cw, ch, { t, a: clamp(cardsA), inner, seed: 4, border: merge > 0 ? mixHex(C.cyan, '#ffffff', merge) : C.cyan, s: s0, double: merge * (0.6 + .4 * Math.sin(t * 6)) * (merge < 1 ? 1 : .8) });
  }
  // chips beneath the cards
  const cy = 790;
  const chipsA = 1 - away;
  const f2c = [['two Earths', W('f2', 'Two Earths')], ['two of every star', W('f2', 'every star')], ['two of you', W('f2', 'Two of you')]];
  let cur = null;
  for (const [s, ts] of f2c) if (t >= ts - .1) cur = [s, ts];
  if (cur && t < S('f3')) chip(cur[0], 960, cy, { a: chipsA * vis(t, cur[1] - .1, S('f3'), .25, .25), s: popIn(t, cur[1] - .1, .4), border: C.lime });
  // f3: spot the difference
  const mg = vis(t, S('f3'), S('f4'), .3, .4);
  if (mg > 0) {
    const u = P(t, S('f3') + .2, W('f3', 'Nothing') - S('f3'));
    const mx = lerp(380, 1540, ease.inout(u)), my = 420 + Math.sin(u * TAU * 1.5) * 90;
    magnifier(mx, my, 1.1, mg);
    T('SPOT THE DIFFERENCE', 960, 175, { size: 34, weight: 700, color: C.gold, ls: 6, a: mg });
    const n = W('f3', 'Nothing');
    chip('differences found:  0', 960, cy, { a: mg * fadeIn(t, n, .2), s: popIn(t, n, .45), border: C.gold, size: 34 });
    chip('not even in principle', 960, cy + 86, { a: mg * fadeIn(t, W('f3', 'even in principle'), .3), border: C.vio });
  }
  // f4: the word
  T('Deutsch has a word for this…', 960, 470, { size: 60, font: 'serif', italic: true, weight: 500, a: vis(t, S('f4') + .3, W('f4', 'Fungible') - .1, .4, .3) });
  const wv = vis(t, W('f4', 'Fungible') - .2, S('f7') - .1, .5, .5);
  if (wv > 0) {
    const up = ease.inout(P(t, S('f5'), .9));
    const gr = g.createLinearGradient(700, 0, 1220, 0);
    gr.addColorStop(0, C.gold); gr.addColorStop(1, C.coral);
    tr(960, lerp(420, 175, up), lerp(1, .5, up) * (.9 + .1 * popIn(t, W('f4', 'Fungible') - .2, .6)), 0, () => {
      T('fungible', 0, 0, { size: 230, font: 'serif', italic: true, weight: 700, color: gr, a: wv, glow: 40, glowColor: C.coral });
    });
    const da = wv * (1 - up);
    T('/ˈfʌn·dʒə·bəl/   adjective', 960, 580, { size: 34, font: 'mono', color: C.mute, a: da * fadeIn(t, W('f4', 'Fungible') + .4) });
    T('identical in a way that leaves no fact about which is which', 960, 650, { size: 38, color: C.white, a: da * fadeIn(t, W('f4', 'Fungible') + .9) });
  }
  // f5/f6: a hundred dollars in the bank
  const bv = vis(t, S('f5') + .3, S('f7') + .2, .5, .5);
  if (bv > 0) withA(bv, () => {
    const bx = 960, by = 540;
    rr(bx - 300, by - 230, 600, 470, 24);
    g.fillStyle = 'rgba(18,16,58,.92)'; g.fill(); g.strokeStyle = C.gold; g.lineWidth = 3; g.stroke();
    T('BANK BALANCE', bx, by - 190, { size: 26, weight: 700, color: C.gold, ls: 6 });
    const tc = W('f5', 'hundred dollars');
    const tw = W('f5', 'which dollar');
    const tm = W('f6', 'no fact');
    const mp = ease.inout(P(t, tm, 1.2));
    for (let i = 0; i < 100; i++) {
      const r = i / 10 | 0, c = i % 10;
      let x = bx - 225 + c * 50, y = by - 142 + r * 34;
      const ap = fadeIn(t, tc + i * .012, .25);
      let hi = 0;
      if (i === 23 || i === 76) {
        const sw = ease.inout(P(t, tw + .6, 1.4));
        const [ox, oy] = i === 23 ? [bx - 225 + 3 * 50, by - 142 + 2 * 34] : [bx - 225 + 6 * 50, by - 142 + 7 * 34];
        const [tx, ty] = i === 23 ? [bx - 225 + 6 * 50, by - 142 + 7 * 34] : [bx - 225 + 3 * 50, by - 142 + 2 * 34];
        x = lerp(ox, tx, sw); y = lerp(oy, ty, sw) - Math.sin(sw * Math.PI) * 90 * (i === 23 ? 1 : -1);
        hi = vis(t, tw, tm, .3, .3);
      }
      x = lerp(x, bx, mp); y = lerp(y, by + 20, mp);
      withA(ap * (1 - mp * .9), () => {
        if (hi > 0) glow(x, y, 50, C.gold, hi);
        dot(x, y, 14, '#ffcf4a'); dot(x, y, 10, '#e6a92a');
        T('$', x, y + 1, { size: 15, weight: 700, color: '#7a4b00' });
        if (hi > 0) T('?', x, y - 34, { size: 34, weight: 700, color: C.white, a: hi });
      });
    }
    T('which dollar is which?', bx, by + 214, { size: 32, font: 'serif', italic: true, color: C.white, a: vis(t, tw, tm, .3, .3) });
    const big = fadeIn(t, tm + .6, .5);
    T('$100', bx, by + 20, { size: 140, font: 'serif', weight: 800, color: C.gold, a: big, glow: 40 });
    T('just one balance', bx, by + 140, { size: 32, color: C.mute, a: big });
  });
  chip('not just similar', 960, 860, { a: vis(t, S('f6'), S('f7'), .3, .3) * (1 - fadeIn(t, W('f6', 'no fact') - .1, .2)), border: C.vio });
  chip('no fact of the matter distinguishes them', 960, 860, { a: vis(t, W('f6', 'no fact') - .1, S('f7'), .3, .3), border: C.gold });
  const one = fadeIn(t, W('f7', 'they behave as one'), .4);
  chip('2 fungible universes  =  behave as 1', 960, 800, { a: one, s: popIn(t, W('f7', 'they behave as one'), .5), border: C.white, size: 34 });
});

/* ===================================================== 3 DIFFERENTIATION */
function labInner(t, o) {
  return (w, h) => {
    const k = h / 560;
    // source
    tr(w * .12, h * .64, k, 0, () => {
      g.fillStyle = '#3b376e'; rr(-55, -34, 110, 68, 14); g.fill();
      g.fillStyle = '#56518f'; rr(50, -14, 40, 28, 6); g.fill();
      dot(-20, 0, 9, o.fire > 0 && o.fire < 1 ? C.gold : '#7a77b0');
    });
    const dx = w * .46, dy = h * .72;
    detector(dx, dy, k, { flash: o.flash, flashColor: o.color });
    lamp(dx, dy - 52 * k, 1.2 * k, o.color || '#fff', o.on || 0);
    if (o.fire > 0 && o.fire < 1) {
      const x = lerp(w * .12 + 90 * k, dx - 60 * k, o.fire);
      photon(x, h * .64 + (dy - h * .64) * o.fire, C.white, 1, k);
    }
    person(w * .8, h * .97, 1.25 * k, { t, pose: o.note !== undefined ? 'write' : 'idle', note: o.note, noteColor: o.noteColor, accent: o.accent, look: o.look || 0, phase: o.phase });
  };
}
scene('d1', 'd5', (t) => {
  header(t, '02', 'Differentiation', S('d1'), S('w1') + .2);
  const tf = W('d2', 'single particle'), ts = W('d2', 'In one universe') - .3;
  const fire = P(t, tf + .3, W('d2', 'striking') + .3 - tf);
  const flash = vis(t, W('d2', 'striking') + .3, W('d2', 'striking') + .9, .05, .4);
  const sp = ease.inout(P(t, ts, 1.1));
  const onR = fadeIn(t, W('d2', 'red lamp') - .1, .3), onB = fadeIn(t, W('d2', 'blue one') - .1, .3);
  const diff = fadeIn(t, S('d3'), .8);
  const typed = (word, t0) => word.slice(0, Math.floor(clamp((t - t0) / .5) * word.length));
  const nR = t > W('d4', 'writes red') ? typed('RED', W('d4', 'writes red') + .2) : undefined;
  const nB = t > W('d4', 'writes blue') ? typed('BLUE', W('d4', 'writes blue') + .2) : undefined;
  const look = -fadeIn(t, S('d5'), .5);
  const cw = 820, ch = 540, cy = 455;
  const a0 = popIn(t, S('d1') - .2, .7);
  const xs = 490 * sp;
  if (sp <= 0) {
    card(960, cy, cw, ch, { t, s: .9 + .1 * a0, a: clamp(a0), seed: 11, border: '#ffffff', double: .25 + .15 * Math.sin(t * 4),
      inner: labInner(t, { fire, flash, accent: C.cyan }) });
  } else {
    card(960 + xs, cy, cw, ch, { t, seed: 11, border: mixHex('#ffffff', C.blue, diff), double: .25 * (1 - sp),
      inner: labInner(t, { color: C.blue, on: onB, flash: 0, note: nB, noteColor: C.blue, accent: C.mag, look, phase: .9 }) });
    card(960 - xs, cy, cw, ch, { t, seed: 11, border: mixHex('#ffffff', C.red, diff),
      inner: labInner(t, { color: C.red, on: onR, flash: 0, note: nR, noteColor: C.red, accent: C.cyan, look }) });
  }
  const dv = fadeIn(t, W('d3', 'differentiated'), .3);
  T('≠', 960, cy, { size: 120, weight: 700, color: C.white, a: diff * vis(t, S('d3'), S('d4') + 1, .3, .5), glow: 30, font: 'serif' });
  chip('differentiated', 960, 800, { a: dv * (1 - fadeIn(t, W('d4', 'Their days') - .3, .3)), s: popIn(t, W('d3', 'differentiated'), .5), border: C.gold, size: 34 });
  // d4: two lives diverge
  const td = W('d4', 'Their days') - .2;
  const lv = fadeIn(t, td, .3);
  if (lv > 0) {
    const L = [['wrote “red”', 'moves to Paris', 'novelist'], ['wrote “blue”', 'moves to Tokyo', 'astronaut']];
    [-1, 1].forEach((dir, side) => {
      const col = side ? C.blue : C.red;
      const u = ease.out(P(t, td, E('d4') - td + .5));
      const x0 = 960 + dir * 60, x1 = 960 + dir * 900;
      const xe = lerp(x0, x1, u);
      line([[x0, 820], [xe, 820 + 30 * u * 0]], col, 6, lv);
      glow(xe, 820, 50, col, lv);
      L[side].forEach((s, i) => {
        const xi = lerp(x0, x1, (i + .5) / 3.2);
        const ai = clamp((xe - xi) * dir / 40);
        dot(xi, 820, 11, col, ai); dot(xi, 820, 5, '#fff', ai);
        T(s, xi, 868, { size: 28, weight: 600, color: C.white, a: ai });
      });
    });
    dot(960, 820, 14, '#ffffff', lv);
  }
  const d5 = fadeIn(t, W('d5', 'And each'), .4);
  chip('both equally real', 960, 150, { a: d5, s: popIn(t, W('d5', 'And each'), .5), border: C.lime, size: 36 });
});

/* ================================================================ 3 WAVES */
const LATTICE = [];
for (let y = 170; y <= 900; y += 52) for (let x = 40; x <= 1880; x += 52) LATTICE.push([x + ((y / 52) % 2) * 26, y]);
function galaxy(x, y, t, a) {
  withA(a, () => {
    glow(x, y, 220, 'rgba(200,190,255,.5)', .8);
    const R = rng(21);
    for (let i = 0; i < 360; i++) {
      const arm = i % 2, u = R(), ang = u * 7 + arm * Math.PI + t * .08, rad = 8 + u * 170;
      const px = x + Math.cos(ang) * rad + (R() - .5) * 18, py = y + Math.sin(ang) * rad * .45 + (R() - .5) * 10;
      dot(px, py, 1 + R() * 2, '#ffffff', .4 + .6 * (1 - u));
    }
    dot(x, y, 14, '#fff8e8');
  });
}
scene('w1', 'w5', (t) => {
  header(t, '03', 'Waves of differentiation', S('w1'), S('i1') + .2);
  // w1/w2: the movie version
  const mv = vis(t, S('w1'), S('w3') + .1, .4, .5);
  if (mv > 0) withA(mv, () => {
    T('What the movies get wrong', 960, 220, { size: 64, font: 'serif', weight: 600, a: fadeIn(t, S('w1')), glow: 20, glowColor: C.vio });
    const tc = W('w2', 'cosmic photocopier') - .4;
    const scan = P(t, S('w2'), tc - S('w2'));
    const pop = ease.back(P(t, tc, .45));
    const inner = uniInner(t, {});
    const cw = 470, ch = 330;
    card(960 + 380 * pop, 560, cw, ch, { t, a: clamp(pop * 3), inner, seed: 4, border: C.mag });
    card(960 - 380 * pop, 560, cw, ch, { t, a: fadeIn(t, S('w2') - .3), inner, seed: 4, border: C.cyan });
    if (scan > 0 && scan < 1) {
      const yy = 560 - ch / 2 + ch * scan;
      g.save(); g.shadowColor = C.lime; g.shadowBlur = 30; line([[960 - cw / 2 - 30, yy], [960 + cw / 2 + 30, yy]], C.lime, 6); g.restore();
    }
    const x = P(t, W('w2', 'photocopier') + .3, .4);
    if (x > 0) {
      cross(960, 560, 5, C.red, x);
      T('the whole universe, split in an instant?', 960, 790, { size: 34, color: C.mute, a: x });
    }
  });
  // w3..w5: ripples through a field of points
  const fv = vis(t, S('w3') - .1, S('i1') + .3, .6, .5);
  if (fv <= 0) return;
  const evs = [
    { x: 330, y: 540, t0: W('w3', 'spreads') - .2, c1: C.red, c2: C.blue, max: 1150 },
    { x: 760, y: 340, t0: S('w5') + .1, c1: C.gold, c2: C.vio, max: 600 },
    { x: 1080, y: 800, t0: W('w5', 'A wave'), c1: C.lime, c2: C.coral, max: 600 },
  ];
  const speed = 1150 / (S('w5') + 2 - evs[0].t0);
  for (const e of evs) e.r = t < e.t0 ? -1 : Math.min(e.max, (t - e.t0) * speed);
  withA(fv, () => {
    for (const [x, y] of LATTICE) {
      let ex = null, k = 0;
      for (const e of evs) {
        const d = Math.hypot(x - e.x, y - e.y);
        if (d < e.r) { const kk = 5.5 * clamp((e.r - d) / 160); if (!ex) ex = e; k += kk; }
      }
      if (x > 1430 && Math.hypot(x - 1650, (y - 520) * 2.2) < 260) continue; // leave room for the galaxy
      if (!ex) dot(x, y, 3.2, '#d9d6ff', .55);
      else {
        g.save(); g.globalCompositeOperation = 'lighter';
        dot(x - k, y - k * .35, 3.4, ex.c1, .95); dot(x + k, y + k * .35, 3.4, ex.c2, .95);
        g.restore();
      }
    }
    for (const e of evs) {
      if (e.r < 0) continue;
      const fl = vis(t, e.t0, e.t0 + .9, .05, .7);
      glow(e.x, e.y, 160, '#ffffff', fl);
      detector(e.x, e.y, .5, { border: e.c1 });
      const ra = e.r >= e.max ? .5 : 1;
      g.save(); g.globalAlpha *= ra;
      g.lineWidth = 5; g.shadowBlur = 30;
      const grd = g.createLinearGradient(e.x - e.r, 0, e.x + e.r, 0);
      grd.addColorStop(0, e.c1); grd.addColorStop(1, e.c2);
      g.strokeStyle = grd; g.shadowColor = '#ffffff';
      g.beginPath(); g.arc(e.x, e.y, Math.max(1, e.r), 0, TAU); g.stroke();
      g.restore();
    }
    const L = [['light', W('w3', 'by light'), 520, 330], ['air molecules', W('w3', 'air molecules'), 650, 540], ['sound', W('w3', 'by sound'), 520, 760]];
    for (const [s, ts, x, y] of L) chip(s, x, y, { a: vis(t, ts - .1, S('w5'), .25, .4), s: popIn(t, ts - .1, .45), border: C.white, size: 28 });
    const c = W('w3', 'Never faster');
    chip('speed  ≤  c', 330, 300, { a: vis(t, c - .1, S('w5'), .25, .4), s: popIn(t, c - .1), border: C.gold, size: 34, color: C.gold });
    const gv = fadeIn(t, S('w4') - .2, .8);
    galaxy(1650, 520, t, gv);
    chip('untouched: still fungible, still one', 1600, 780, { a: gv * fadeIn(t, W('w4', 'still fungible') - .1, .3), border: C.lime, size: 28 });
    chip('differentiation is local', 960, 160, { a: fadeIn(t, W('w5', 'local process') - .2, .4), s: popIn(t, W('w5', 'local process') - .2), border: C.gold, size: 36 });
  });
});

/* ========================================================= 4 INTERFERENCE */
const MZ = { src: [230, 720], bs1: [520, 720], m1: [1120, 720], m2: [520, 360], bs2: [1120, 360], A: [1360, 360], B: [1120, 140], block: [520, 560] };
function along(pts, s) {
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], L = Math.hypot(x2 - x1, y2 - y1);
    if (s <= L) return [lerp(x1, x2, s / L), lerp(y1, y2, s / L)];
    s -= L;
  }
  return pts[pts.length - 1];
}
const UP = [MZ.bs1, MZ.m2, MZ.bs2], LO = [MZ.bs1, MZ.m1, MZ.bs2];
let PHOTONS = [];
function photonDist(p, t) {
  if (p.hold) { // the slow first photon: walk, wait at the second mirror, then finish
    const { t0, t1, t2, t3 } = p.hold;
    if (t < t0) return -1;
    if (t < t1) return lerp(0, 300, (t - t0) / (t1 - t0));
    if (t < t2) return lerp(300, 1260, (t - t1) / (t2 - t1));
    if (t < t3) return 1260;
    return 1260 + (t - t3) * 520;
  }
  return t < p.t0 ? -1 : (t - p.t0) * p.v;
}
function splitterGlyph(x, y, kind, a = 1, fl = 0) {
  tr(x, y, 1, Math.PI / 4, () => withA(a, () => {
    if (fl > 0) glow(0, 0, 90, kind === 'bs' ? C.cyan : '#ffffff', fl);
    if (kind === 'bs') { g.fillStyle = 'rgba(120,220,255,.35)'; rr(-46, -8, 92, 16, 4); g.fill(); g.strokeStyle = C.cyan; g.lineWidth = 3; g.stroke(); }
    else { g.fillStyle = '#e9ecff'; rr(-46, -7, 92, 14, 4); g.fill(); g.fillStyle = '#6a6fa8'; rr(-46, 4, 92, 6, 3); g.fill(); }
  }));
}
function mzCounts(t, from, to) {
  let a = 0, b = 0;
  for (const p of PHOTONS) {
    if (p.arrive < from || p.arrive > Math.min(t, to)) continue;
    if (p.out === 'A') a++; else if (p.out === 'B') b++;
  }
  return [a, b];
}
scene('i1', 'i9', (t) => {
  header(t, '04', 'Interference', S('i1'), S('c1') + .2);
  // i1/i2: two histories that rejoin
  const hv = vis(t, S('i1'), S('i3') + .1, .4, .4);
  if (hv > 0) withA(hv, () => {
    const te = W('i1', 'erased'), tm = W('i2', 'They merge');
    let rev;
    if (t < te) rev = lerp(200, 1000, ease.inout(P(t, S('i1') + .2, te - S('i1') - .2)));
    else if (t < tm) rev = lerp(1000, 1320, ease.inout(P(t, te, tm - te)));
    else rev = lerp(1320, 1730, ease.inout(P(t, tm, 1.6)));
    const bulge = x => x < 620 || x > 1320 ? 0 : 170 * Math.sin(Math.PI * (x - 620) / 700);
    const pts = (sgn) => { const o = []; for (let x = 200; x <= Math.min(rev, 1320); x += 10) o.push([x, 520 + sgn * bulge(x)]); return o; };
    g.save(); g.shadowBlur = 20;
    g.shadowColor = C.red; line(pts(-1), C.red, 8);
    g.shadowColor = C.blue; line(pts(1), C.blue, 8, .9);
    line(pts(0).filter(p => p[0] <= 620), '#ffffff', 9);
    if (rev > 1320) { g.shadowColor = C.gold; line([[1320, 520], [rev, 520]], C.gold, 11); }
    g.restore();
    T('history 1', 960, 300, { size: 30, weight: 600, color: C.red, a: fadeIn(t, S('i1') + 1.2) });
    T('history 2', 960, 742, { size: 30, weight: 600, color: C.blue, a: fadeIn(t, S('i1') + 1.2) });
    const sp = fadeIn(t, te, .3);
    if (sp > 0) for (let i = 0; i < 6; i++) {
      const ang = i / 6 * TAU + t * 2, r = 30 + 10 * Math.sin(t * 6 + i);
      dot(1300 + Math.cos(ang) * r, 520 + Math.sin(ang) * r, 4, C.gold, sp * vis(t, te, tm + .5, .2, .4));
    }
    chip('difference erased', 1300, 420, { a: vis(t, te, S('i2'), .3, .3), border: C.gold, size: 28 });
    chip('fungible again', 1320, 420, { a: vis(t, W('i2', 'fungible again') - .2, W('i2', 'depend') - .2, .3, .3), border: C.lime, size: 28 });
    chip('what happens next depends on both', 1450, 620, { a: fadeIn(t, W('i2', 'depend') - .2, .3), s: popIn(t, W('i2', 'depend') - .2), border: C.gold, size: 28 });
  });
  // i3: title over a two-source interference pattern
  const iv = vis(t, S('i3') - .1, S('i4') + .2, .5, .5);
  if (iv > 0) {
    const x = WAVE.getContext('2d'), w = WAVE.width, h = WAVE.height;
    const img = x.createImageData(w, h);
    const s1 = [w * .38, h * .5], s2 = [w * .62, h * .5];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const d1 = Math.hypot(i - s1[0], j - s1[1]), d2 = Math.hypot(i - s2[0], j - s2[1]);
      const v = (Math.cos(d1 * .55 - t * 5) + Math.cos(d2 * .55 - t * 5)) / 2;
      const q = v * v, k = (j * w + i) * 4;
      img.data[k] = 40 + 200 * q * (i / w); img.data[k + 1] = 60 + 150 * q * (1 - i / w); img.data[k + 2] = 120 + 135 * q; img.data[k + 3] = 255 * q;
    }
    x.putImageData(img, 0, 0);
    withA(iv * .8, () => { g.imageSmoothingEnabled = true; g.drawImage(WAVE, 0, 0, 1920, 1080); });
    T('INTERFERENCE', 960, 500, { size: 170, font: 'serif', weight: 800, ls: 12, a: iv, glow: 50, glowColor: C.cyan, stroke: ['rgba(5,6,26,.6)', 10] });
    T('it happens in laboratories every day', 960, 640, { size: 38, font: 'serif', italic: true, color: C.gold, a: iv * fadeIn(t, W('i3', 'laboratories') - .3) });
  }
  // i4..i9: the interferometer
  const av = vis(t, S('i4') - .1, S('c1') + .3, .6, .5);
  if (av <= 0) return;
  withA(av, () => {
    const blockIn = ease.inout(P(t, S('i8') + .1, .6)) * (1 - ease.inout(P(t, W('i9', 'So something'), .6)));
    const ghost = fadeIn(t, W('i9', 'So something') + .2, .8);
    // rails
    const rail = (pts, c, a) => line(pts, c, 3, a);
    rail([MZ.src, MZ.bs1], '#ffffff', .25);
    rail(UP, ghost > 0 ? C.vio : '#ffffff', .25 + .5 * ghost);
    if (ghost > 0) { g.save(); g.shadowColor = C.vio; g.shadowBlur = 30; line(UP, C.vio, 10, ghost * .6); g.restore(); }
    rail(LO, '#ffffff', .25);
    rail([MZ.bs2, MZ.A], '#ffffff', .25); rail([MZ.bs2, MZ.B], '#ffffff', .25);
    // parts
    const ap = k => fadeIn(t, S('i4') + k * .15, .4);
    tr(MZ.src[0], MZ.src[1], ap(0), 0, () => { g.fillStyle = '#3b376e'; rr(-70, -36, 110, 72, 14); g.fill(); g.fillStyle = '#56518f'; rr(30, -14, 30, 28, 6); g.fill(); });
    T('photon source', MZ.src[0] - 10, MZ.src[1] + 72, { size: 24, color: C.mute, a: ap(0) });
    let fl = { bs1: 0, bs2: 0, m1: 0, m2: 0, A: 0, B: 0 };
    const counts = { A: 0, B: 0 };
    // photons
    for (const p of PHOTONS) {
      const s = photonDist(p, t);
      if (s < 0) continue;
      if (s > 1260 + 230) {
        const since = t - p.arrive;
        if (since < .5 && p.out) fl[p.out] = Math.max(fl[p.out], 1 - since / .5);
        continue;
      }
      const near = (d) => Math.max(0, 1 - Math.abs(d) / 40);
      if (s < 300) { const [x, y] = along([MZ.src, MZ.bs1], s); photon(x, y, C.white, 1, 1.1); fl.bs1 = Math.max(fl.bs1, near(s - 300)); continue; }
      if (s < 1260) {
        const u = s - 300;
        fl.bs1 = Math.max(fl.bs1, near(u));
        fl.m2 = Math.max(fl.m2, near(u - 360) * (p.mode === 'block' ? 0 : 1));
        fl.m1 = Math.max(fl.m1, near(u - 600));
        const lowA = p.mode === 'block' && p.out === null ? clamp(1 - u / 500) : 1;
        if (p.mode === 'block') {
          if (u < 160) { const [x, y] = along(UP, u); photon(x, y, C.cyan, .8); }
          else { const k = (u - 160) / 120; if (k < 1) glow(MZ.block[0], MZ.block[1] + 20, 80, C.coral, 1 - k); }
        } else {
          const [x, y] = along(UP, u); photon(x, y, p.ghost ? C.vio : C.cyan, .85);
        }
        const [x2, y2] = along(LO, u); photon(x2, y2, C.mag, .85 * lowA);
        continue;
      }
      const u = s - 1260;
      fl.bs2 = Math.max(fl.bs2, near(u));
      if (p.mode === 'block' && p.out === null) continue;
      if (p.hold && t < p.hold.t3) {
        const pulse = .5 + .5 * Math.sin(t * 6);
        photon(MZ.bs2[0], MZ.bs2[1], C.gold, 1, 1.2 + .3 * pulse);
        T('?', MZ.bs2[0] + 70, MZ.bs2[1] - 70, { size: 70, weight: 700, color: C.gold, a: fadeIn(t, S('i6'), .3) * (1 - fadeIn(t, S('i7'), .2)) });
        continue;
      }
      const [x, y] = along([MZ.bs2, p.out === 'B' ? MZ.B : MZ.A], u);
      photon(x, y, C.gold, 1, 1.1);
    }
    splitterGlyph(...MZ.bs1, 'bs', ap(1), fl.bs1);
    splitterGlyph(...MZ.m2, 'm', ap(2), fl.m2);
    splitterGlyph(...MZ.m1, 'm', ap(2), fl.m1);
    splitterGlyph(...MZ.bs2, 'bs', ap(3), fl.bs2);
    detector(MZ.A[0] + 40, MZ.A[1], .85, { border: C.gold, flash: fl.A, flashColor: C.gold });
    tr(MZ.B[0], MZ.B[1] - 40, 1, -Math.PI / 2, () => detector(0, 0, .85, { border: C.lime, flash: fl.B, flashColor: C.lime }));
    const lab = fadeIn(t, S('i6') - .5);
    T('A', MZ.A[0] + 40, MZ.A[1] + 80, { size: 40, weight: 700, color: C.gold, a: lab });
    T('B', MZ.B[0] + 80, MZ.B[1] - 40, { size: 40, weight: 700, color: C.lime, a: lab });
    chip('half-silvered mirror', MZ.bs1[0] - 10, MZ.bs1[1] + 90, { a: vis(t, W('i4', 'half-silvered') - .2, S('i6'), .3, .4), size: 24, border: C.cyan });
    chip('reflected', MZ.bs1[0] - 120, 520, { a: vis(t, W('i4', 'reflected') - .2, S('i6'), .3, .4), size: 24, border: C.cyan, color: C.cyan });
    chip('passes through', 820, 790, { a: vis(t, W('i4', 'passes') - .2, S('i6'), .3, .4), size: 24, border: C.mag, color: C.mag });
    chip('mirror', MZ.m2[0] - 90, MZ.m2[1] - 50, { a: vis(t, W('i5', 'mirrors') - .2, S('i6'), .3, .4), size: 24, border: '#fff' });
    chip('mirror', MZ.m1[0] + 90, MZ.m1[1] + 50, { a: vis(t, W('i5', 'mirrors') - .2, S('i6'), .3, .4), size: 24, border: '#fff' });
    chip('second half-silvered mirror', MZ.bs2[0] - 240, MZ.bs2[1] - 80, { a: vis(t, W('i5', 'second') - .2, S('i6') + .5, .3, .4), size: 24, border: C.cyan });
    chip('path blocked', MZ.block[0] - 170, MZ.block[1], { a: blockIn * fadeIn(t, S('i8') + .5), size: 24, border: C.coral, color: C.coral });
    // block
    if (blockIn > 0) tr(lerp(MZ.block[0] - 260, MZ.block[0], blockIn), MZ.block[1], 1, 0, () => withA(clamp(blockIn * 2), () => {
      g.fillStyle = '#3a2238'; rr(-40, -16, 80, 32, 6); g.fill(); g.strokeStyle = C.coral; g.lineWidth = 4; g.stroke();
      for (let i = -30; i < 40; i += 16) line([[i, -14], [i + 10, 14]], C.coral, 3, .7);
    }));
    if (ghost > 0) chip('instances in other histories', 520, 260, { a: ghost * fadeIn(t, W('i9', 'instances') - .2), size: 26, border: C.vio, color: '#dccbff' });
    // scoreboard
    const sb = fadeIn(t, S('i6') - .2, .5);
    if (sb > 0) withA(sb, () => {
      const x0 = 1530, y0 = 440;
      rr(x0, y0, 330, 330, 22); g.fillStyle = 'rgba(16,14,52,.9)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.stroke();
      const phase2 = t >= S('i8') + .6 && t < W('i9', 'So something') + .6;
      const phase3 = t >= W('i9', 'So something') + .6;
      const from = phase3 ? W('i9', 'So something') + .6 : phase2 ? S('i8') + .6 : 0;
      const [na, nb] = mzCounts(t, from, 1e9);
      T(phase2 ? 'one path blocked' : 'both paths open', x0 + 165, y0 + 36, { size: 24, weight: 700, color: phase2 ? C.coral : C.cyan, ls: 2 });
      const bars = [['A', na, C.gold], ['B', nb, C.lime]];
      const tot = Math.max(1, na + nb);
      const expect = vis(t, S('i6') + .4, S('i7') + 1.5, .4, .5);
      bars.forEach(([k, n, c], i) => {
        const bx = x0 + 70 + i * 140, by = y0 + 270, H = 180;
        rr(bx, by - H, 70, H, 8); g.fillStyle = 'rgba(255,255,255,.06)'; g.fill();
        const f = n / tot;
        if (n > 0) { rr(bx, by - H * f, 70, H * f, 8); g.fillStyle = c; g.fill(); }
        if (expect > 0) withA(expect, () => { g.setLineDash([8, 8]); g.strokeStyle = '#fff'; g.lineWidth = 3; rr(bx, by - H * .5, 70, H * .5, 8); g.stroke(); g.setLineDash([]); });
        T(k, bx + 35, by + 26, { size: 28, weight: 700, color: c });
        T(String(n), bx + 35, by - H - 22, { size: 30, font: 'mono', weight: 600, color: C.white });
      });
      T('expected: 50 / 50', x0 + 165, y0 + 380, { size: 28, color: C.white, a: expect });
    });
    const al = W('i7', 'same detector');
    chip('every photon → A', 1695, 860, { a: vis(t, al - .2, S('i8'), .3, .3), s: popIn(t, al - .2), border: C.gold, size: 30, color: C.gold });
    chip('both detectors fire', 1695, 860, { a: vis(t, W('i8', 'Suddenly') + 1, S('i9') + 2.5, .3, .3), border: C.lime, size: 30, color: C.lime });
    chip('…something took the other path', 1650, 860, { a: vis(t, W('i9', 'So something'), E('i9') + .2, .3, .3), border: C.vio, size: 28, color: '#dccbff' });
  });
});

/* ========================================================= 5 DECOHERENCE */
const CLOUD = (() => {
  const R = rng(77), out = [];
  for (let i = 0; i < 300; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * 330;
    const x = 1430 + Math.cos(a) * r * 1.15, y = 540 + Math.sin(a) * r * .8;
    out.push({ x, y, inf: Math.hypot(x - 1180, y - 540) / 700 + R() * .12, p: R() * TAU });
  }
  return out;
})();
function phoneIcon(x, y, s, a) {
  tr(x, y, s, -.2, () => withA(a, () => {
    g.fillStyle = '#20204f'; rr(-22, -40, 44, 80, 9); g.fill(); g.strokeStyle = C.cyan; g.lineWidth = 3; g.stroke();
    g.fillStyle = C.cyan; rr(-15, -30, 30, 50, 4); g.fill();
    dot(0, 31, 4, C.cyan);
  }));
}
scene('c1', 'c5', (t) => {
  header(t, '05', 'Decoherence', S('c1'), S('m1') + .2);
  // c1: two lives try to merge
  const v1 = vis(t, S('c1'), S('c2') + .4, .4, .5);
  if (v1 > 0) withA(v1, () => {
    const tb = W('c1', 'Why doesn');
    const push = P(t, tb, 1.6);
    const off = push < .45 ? lerp(0, 150, ease.inout(push / .45)) : 150 * (1 - ease.spring((push - .45) / .55));
    const inner = (acc, ph) => (w, h) => { planet(w * .22, h * .3, 50, { t, seed: 5 }); person(w * .68, h * .97, .9, { t, accent: acc, phase: ph }); };
    card(560 + off, 500, 560, 420, { t, inner: inner(C.cyan, 0), seed: 6, border: C.cyan });
    card(1360 - off, 500, 560, 420, { t, inner: inner(C.mag, 1.3), seed: 7, border: C.mag });
    T('you', 560 + off, 250, { size: 34, weight: 700, color: C.cyan, ls: 3 });
    T('your doppelgänger', 1360 - off, 250, { size: 34, weight: 700, color: C.mag, ls: 3 });
    const bump = vis(t, tb + .7, tb + 1.4, .05, .4);
    glow(960, 500, 200, '#ffffff', bump);
    if (t > tb + .7) cross(960, 500, 2.2, C.red, P(t, tb + .7, .4));
  });
  // c2: must be identical, atom for atom
  const v2 = vis(t, S('c2') - .1, S('c3') + .1, .4, .4);
  if (v2 > 0) withA(v2, () => {
    T('To merge, two histories must become', 960, 320, { size: 50, font: 'serif', weight: 500, a: fadeIn(t, S('c2')) });
    T('exactly identical again', 960, 410, { size: 84, font: 'serif', weight: 700, color: C.gold, glow: 30, a: fadeIn(t, W('c2', 'exactly') - .2) });
    const ta = W('c2', 'Every single');
    for (let i = 0; i < 14; i++) {
      const x = 960 + (i - 6.5) * 105, a = fadeIn(t, ta - .4 + i * .06, .3);
      if (a <= 0) continue;
      tr(x, 600, 1, 0, () => withA(a, () => {
        dot(0, 0, 8, C.white);
        g.strokeStyle = hexA(C.cyan, .8); g.lineWidth = 2;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(0, 0, 32, 11, k * Math.PI / 3 + t * .8, 0, TAU); g.stroke(); }
        check(0, 62, .6, C.lime, P(t, ta + .2 + i * .06, .3));
      }));
    }
    T('every single atom', 960, 740, { size: 40, font: 'serif', italic: true, color: C.white, a: fadeIn(t, ta + .5) });
  });
  // c3: easy for one photon, hopeless for a brain
  const v3 = vis(t, S('c3') - .1, S('c4') + .1, .4, .4);
  if (v3 > 0) withA(v3, () => {
    line([[960, 200], [960, 880]], 'rgba(255,255,255,.15)', 2);
    T('one photon in a quiet lab', 480, 220, { size: 36, weight: 600 });
    const te = W('c3', 'easy');
    const m = ease.inout(P(t, te - .9, 1));
    const sep = 70 * (1 - m);
    if (m < 1) { photon(480 - sep, 520, C.red, 1, 1.3); photon(480 + sep, 520, C.blue, 1, 1.3); }
    else photon(480, 520, C.gold, 1, 1.6);
    check(480, 680, 1.4, C.lime, P(t, te, .4));
    T('easy to undo', 480, 780, { size: 32, color: C.lime, a: fadeIn(t, te + .2) });
    const tb = W('c3', 'But once'), tu = W('c3', 'undoing');
    const sp = P(t, tb, tu - tb);
    T('a difference that has spread', 1430, 220, { size: 36, weight: 600, a: fadeIn(t, tb - .3) });
    for (const c of CLOUD) {
      const on = sp > c.inf;
      const j = 2 * Math.sin(t * 3 + c.p);
      if (on) { dot(c.x - 3 + j, c.y - 1, 3.6, C.red, .9); dot(c.x + 3 + j, c.y + 1, 3.6, C.blue, .9); }
      else dot(c.x + j, c.y, 3.4, '#cfd0ff', .45 * fadeIn(t, tb - .5));
    }
    photon(1180, 540, C.white, fadeIn(t, tb - .3) * (1 - sp), 1);
    const words = [['detector', 'a detector', 1210, 420], ['notebook', 'a notebook', 1340, 700], ['the air', 'the air', 1590, 380], ['brain', 'a brain', 1640, 690]];
    for (const [k, s, x, y] of words) chip(s, x, y, { a: fadeIn(t, W('c3', k) - .15, .25), s: popIn(t, W('c3', k) - .15, .4), size: 26, border: C.white });
    const n = Math.round(lerp(0, 27, ease.inout(sp)));
    T(n === 0 ? 'particles that differ: 1' : `particles that differ: ~10${String(n).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('')}`, 1430, 880, { size: 30, font: 'mono', color: C.gold, a: fadeIn(t, tb) });
    if (t > tu) cross(1430, 540, 4, C.red, P(t, tu, .5));
    T('hopeless to undo', 1430, 800, { size: 34, weight: 700, color: C.red, a: fadeIn(t, W('c3', 'hopeless')) });
  });
  // c4: decoherence
  const v4 = vis(t, S('c4') - .1, S('c5') + .1, .4, .4);
  if (v4 > 0) withA(v4, () => {
    const gr = g.createLinearGradient(560, 0, 1360, 0);
    gr.addColorStop(0, C.cyan); gr.addColorStop(1, C.vio);
    T('DECOHERENCE', 960, 230, { size: 130, font: 'serif', weight: 800, ls: 10, color: gr, glow: 40, glowColor: C.vio });
    const hide = ease.inout(P(t, W('c4', 'other histories') - .3, 1.6));
    const inner = (acc) => (w, h) => { planet(w * .22, h * .3, 44, { t, seed: 5 }); person(w * .68, h * .97, .78, { t, accent: acc }); };
    card(1220 + 160 * hide, 600, 440, 330, { t, inner: inner(C.mag), seed: 7, border: C.mag, a: 1 - .85 * hide, s: 1 - .25 * hide });
    card(700, 600, 440, 330, { t, inner: inner(C.cyan), seed: 6, border: C.cyan });
    chip('one solid, ordinary world', 700, 820, { a: fadeIn(t, W('c4', 'one solid') - .2), size: 28, border: C.cyan });
    chip('hidden', 1220 + 160 * hide, 820, { a: fadeIn(t, W('c4', 'stay hidden') - .3), size: 28, border: C.mag });
  });
  // c5: no phone line between histories
  const v5 = vis(t, S('c5') - .1, S('m1') + .3, .4, .5);
  if (v5 > 0) withA(v5, () => {
    person(500, 560, .95, { t, accent: C.cyan, halo: hexA(C.cyan, .7) });
    person(1420, 560, .95, { t, accent: C.mag, halo: hexA(C.mag, .7), phase: 1.1 });
    const tp = W('c5', 'phone') - .3;
    phoneIcon(580, 400, 1, fadeIn(t, tp - .3));
    const u = ease.out(P(t, tp, 1.2));
    const pts = [];
    for (let x = 640; x <= lerp(640, 900, u); x += 6) pts.push([x, 400 + Math.sin(x * .08 - t * 8) * 12]);
    if (pts.length > 1) line(pts, C.cyan, 4, .9);
    const pts2 = [];
    for (let x = 1020; x <= lerp(1020, 1280, u); x += 6) pts2.push([x, 400 + Math.sin(x * .08 - t * 8) * 12]);
    if (pts2.length > 1) line(pts2, C.mag, 4, .35);
    if (u >= 1) { cross(960, 400, 1.6, C.red, P(t, tp + 1.2, .4)); T('no signal', 960, 470, { size: 30, weight: 700, color: C.red, a: fadeIn(t, tp + 1.3) }); }
    // the only channel
    const tc = W('c5', 'Interference is');
    const ch = fadeIn(t, tc - .2, .5);
    if (ch > 0) withA(ch, () => {
      T('interference: the only channel between histories', 960, 640, { size: 34, weight: 600, color: C.gold });
      const items = [['photon', 6], ['atom', 10], ['molecule', 16], ['virus', 24], ['cat', 34], ['you', 46]];
      const tcl = W('c5', 'for anything as big');
      items.forEach(([s, r], i) => {
        const x = 960 + (i - 2.5) * 220, y = 760;
        const a = fadeIn(t, tc + .2 + i * .25, .3);
        withA(a, () => {
          glow(x, y, r * 3, i < 3 ? C.lime : i < 4 ? C.gold : C.coral, .7);
          dot(x, y, r, '#e9e7ff');
          T(s, x, y + 66, { size: 26, weight: 600 });
        });
        const ok = i < 3, maybe = i === 3;
        const pp = P(t, tcl + i * .15, .35);
        if (ok) check(x + r + 24, y - r - 10, .7, C.lime, pp);
        else if (!maybe) cross(x + r + 22, y - r - 10, .7, C.red, pp);
        else T('~', x + r + 22, y - r - 10, { size: 44, weight: 700, color: C.gold, a: pp });
      });
    });
  });
});

/* ============================================================= 6 MEASURE */
const NLINES = 84;
scene('m1', 'm5', (t) => {
  header(t, '06', 'Measure', S('m1'), S('s1') + .2);
  // m1/m2: countable copies, crossed out
  const cv1 = vis(t, S('m1'), W('m2', 'continuum') + .3, .4, .5);
  if (cv1 > 0) withA(cv1, () => {
    T('our fiction: neat, countable copies', 960, 250, { size: 44, font: 'serif', weight: 500, a: fadeIn(t, S('m1') + .3) });
    for (let i = 0; i < 5; i++) card(960 + (i - 2) * 270, 520, 220, 170, { t, seed: 3 + i, border: [C.cyan, C.vio, C.mag, C.gold, C.lime][i], a: fadeIn(t, S('m1') + .5 + i * .12), inner: (w, h) => planet(w * .5, h * .5, 36, { t, seed: 5 }) });
    T('1      2      3      4      5', 960, 680, { size: 36, font: 'mono', color: C.mute });
    const tx = W('m2', 'countable') + .5;
    if (t > tx) cross(960, 520, 4, C.red, P(t, tx, .5));
  });
  // the fluid
  const fv = vis(t, W('m2', 'continuum') - .4, S('s1') + .3, .8, .5);
  if (fv <= 0) return;
  const sp = ease.inout(P(t, W('m3', 'divides') - .3, 1.8));
  const splitX = 880;
  withA(fv, () => {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const up = Math.round(NLINES / 3);
    for (let i = 0; i < NLINES; i++) {
      const top = i < up;
      const base = 540 + (i / (NLINES - 1) - .5) * 300;
      const pts = [];
      for (let x = -20; x <= 1940; x += 24) {
        const k = clamp((x - splitX) / 560);
        const sm = k * k * (3 - 2 * k) * sp;
        const yy = base + (top ? -150 : 120) * sm + (top ? -20 : 25) * sm + 7 * Math.sin(x * .009 + i * .35 + t * 1.3);
        pts.push([x, yy]);
      }
      const col = top ? C.gold : C.vio;
      const gr = g.createLinearGradient(0, 0, 1920, 0);
      gr.addColorStop(0, hexA(C.cyan, .9)); gr.addColorStop(.42, hexA('#bfe9ff', .9)); gr.addColorStop(.62, hexA(sp > 0 ? col : '#bfe9ff', .95)); gr.addColorStop(1, hexA(sp > 0 ? col : C.cyan, .95));
      line(pts, gr, 1.4, .35);
      g.setLineDash([26, 48]); g.lineDashOffset = -t * 160 + i * 17;
      line(pts, gr, 2.6, .8);
      g.setLineDash([]);
    }
    g.restore();
    chip('a continuum of fungible histories', 960, 250, { a: vis(t, W('m2', 'continuum'), S('m3') + .5, .4, .4), size: 32, border: C.cyan });
    const th = W('m3', 'a third'), tt = W('m3', 'two thirds');
    chip('1/3', 1800, 270, { size: 46, weight: 700, color: C.gold, border: C.gold, a: fadeIn(t, th - .2), s: popIn(t, th - .2), bg: 'rgba(10,8,40,.92)' });
    chip('2/3', 1800, 735, { size: 46, weight: 700, color: '#c9b2ff', border: C.vio, a: fadeIn(t, tt - .2), s: popIn(t, tt - .2), bg: 'rgba(10,8,40,.92)' });
    const mv = fadeIn(t, W('m4', 'the measure') - .3, .5);
    if (mv > 0) {
      T('MEASURE', 960, 190, { size: 110, font: 'serif', weight: 800, ls: 12, color: C.white, a: mv, glow: 40, glowColor: C.gold });
      // brackets showing the shares
      line([[1700, 205], [1680, 205], [1680, 335], [1700, 335]], C.gold, 4, mv);
      line([[1700, 620], [1680, 620], [1680, 850], [1700, 850]], C.vio, 4, mv);
    }
    T('= what probability really means', 960, 290, { size: 36, font: 'serif', italic: true, color: C.gold, a: fadeIn(t, W('m4', 'probability') - .2) * (1 - fadeIn(t, S('m5') + .2)) });
    // m5: here -> there
    const hv = fadeIn(t, W('m5', 'start here') - .4, .4);
    if (hv > 0) {
      line([[300, 360], [300, 720]], '#ffffff', 4, hv);
      T('here', 300, 330, { size: 34, weight: 700, a: hv });
      const tv = fadeIn(t, W('m5', 'end up there') - .3, .4);
      line([[1360, 630], [1360, 900]], C.vio, 4, tv);
      T('there', 1360, 600, { size: 34, weight: 700, color: C.vio, a: tv });
      chip('chance 2/3  =  2/3 of the histories', 960, 290, { a: fadeIn(t, S('m5') + .3, .4), size: 32, border: C.vio });
    }
  });
});

/* =========================================================== 7 STRUCTURE */
const FOAM = (() => { const R = rng(5), o = []; for (let i = 0; i < 520; i++) o.push({ x: R() * 1920, y: R() * 1080, p: R() * TAU, f: .5 + R() * 1.5, h: R() }); return o; })();
const ELEC = (() => {
  const R = rng(8), o = [];
  while (o.length < 520) {
    const x = gauss(R) * 230, y = gauss(R) * 70;
    if (R() < Math.cos(x / 34) ** 2) o.push({ x, y, p: R() * TAU, h: R() });
  }
  return o;
})();
scene('s1', 's6', (t) => {
  header(t, '07', 'The shape of the multiverse', S('s1'), S('b1') + .2);
  const tv = vis(t, S('s1') - .2, S('s2') + .3, .5, .5);
  if (tv > 0) {
    drawTree(TREES.big, lerp(60, 1960, ease.inout(P(t, S('s1') - .2, 2.6))), tv, t);
    chip('a rich structure', 960, 170, { a: tv * fadeIn(t, W('s1', 'rich') - .2), size: 32, border: C.gold });
  }
  // s2: layers
  const lv = vis(t, S('s2') - .1, W('s3', 'that picture') + .5, .6, .6);
  const zoom = ease.inout(P(t, S('s3') + .3, 2));
  if (lv > 0) withA(lv, () => {
    tr(960, 520, 1 + zoom * 2.2, 0, () => {
      g.translate(0, zoom * 120);
      for (let i = 4; i >= 0; i--) {
        const a = fadeIn(t, S('s2') + i * .35, .5);
        const y = (i - 2) * 105 + Math.sin(t * .8 + i) * 6;
        const col = [C.cyan, C.vio, C.mag, C.gold, C.lime][i];
        withA(a, () => {
          g.beginPath(); g.moveTo(-440, y + 40); g.lineTo(-240, y - 50); g.lineTo(440, y - 50); g.lineTo(240, y + 40); g.closePath();
          g.fillStyle = hexA(col, .14); g.fill(); g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 20; g.stroke();
          g.shadowBlur = 0;
          dot(-120, y - 6, 16, '#3a8dff'); dot(-126, y - 10, 6, C.lime);
          dot(100, y - 4, 7, '#f2c29b');
          T('≈ universe', 360, y - 5, { size: 22, weight: 600, color: col, align: 'left' });
        });
      }
    });
    chip('classical physics, to a very good approximation', 960, 860, { a: fadeIn(t, W('s2', 'classical') - .2) * (1 - zoom), size: 28, border: C.white });
    chip('decoherence carves out layers', 960, 170, { a: fadeIn(t, W('s2', 'decoherence') - .2) * (1 - zoom), size: 30, border: C.vio });
  });
  // s3: quantum foam
  const qv = vis(t, S('s3') + 1.4, S('s4') + .6, .8, .6);
  if (qv > 0) withA(qv, () => {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const f of FOAM) {
      const x = f.x + Math.sin(t * f.f + f.p) * 22, y = f.y + Math.cos(t * f.f * .8 + f.p) * 18;
      const c = `hsl(${200 + f.h * 140} 90% 65%)`;
      dot(x, y, 2.6, c, .5 + .4 * Math.sin(t * 3 + f.p));
    }
    for (let k = 0; k < 7; k++) {
      const pts = [];
      for (let x = 0; x <= 1920; x += 20) pts.push([x, 160 + k * 120 + 30 * Math.sin(x * .006 + t * (1 + k * .2) + k) * Math.sin(x * .002 - t * .5)]);
      line(pts, `hsl(${200 + k * 20} 90% 65%)`, 2, .25);
    }
    g.restore();
    T('atomic scale', 960, 440, { size: 70, font: 'serif', weight: 700, glow: 30, glowColor: C.cyan });
    T('no separate universes down here', 960, 530, { size: 38, font: 'serif', italic: true, color: C.gold, a: fadeIn(t, W('s3', "isn't divided") - .3) });
  });
  // s4: an electron's instances
  const ev = vis(t, S('s4') - .1, S('s5') + .1, .5, .4);
  if (ev > 0) withA(ev, () => {
    const bl = ease.out(P(t, W('s4', 'Its fungible') - .1, 1.4));
    const cx = 960, cy = 470;
    if (bl < 1) {
      photon(cx, cy, C.cyan, 1 - bl, 1.3);
      T('one place?', cx, cy - 90, { size: 40, weight: 700, a: 1 - bl });
    }
    if (bl > 0) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const e of ELEC) {
        const x = cx + e.x * bl + Math.sin(t * 2 + e.p) * 4, y = cy + e.y * bl + Math.cos(t * 1.7 + e.p) * 4;
        dot(x, y, 3, `hsl(${180 + e.h * 80} 95% 65%)`, .75 * bl);
      }
      g.restore();
      // the distribution
      const pts = [];
      for (let x = -560; x <= 560; x += 5) pts.push([cx + x, 780 - 150 * Math.exp(-(x * x) / (2 * 230 * 230)) * Math.cos(x / 34) ** 2 * bl]);
      line([[cx - 580, 780], [cx + 580, 780]], 'rgba(255,255,255,.3)', 2);
      line(pts, C.cyan, 4, bl);
      T('position →', cx + 640, 780, { size: 24, color: C.mute, align: 'left', a: bl });
      T('instances spread across a range of positions, interfering', cx, 260, { size: 34, weight: 600, a: fadeIn(t, W('s4', 'spread') - .2) });
    }
    chip('Heisenberg’s uncertainty  =  diversity among instances', 960, 880, { a: fadeIn(t, W('s4', 'Heisenberg') - .3), size: 28, border: C.gold });
  });
  // s5: entanglement
  const nv = vis(t, S('s5') - .1, S('s6') + .1, .5, .4);
  if (nv > 0) withA(nv, () => {
    const A = [600, 520], B = [1320, 520];
    const hues = [0, 45, 90, 160, 200, 250, 290, 330];
    const perm = [3, 6, 0, 5, 1, 7, 2, 4];
    const pos = (c, i, ph) => { const a = i / 8 * TAU + ph; return [c[0] + Math.cos(a) * 130, c[1] + Math.sin(a) * 130]; };
    const tl = W('s5', 'which instances') - .3;
    for (let i = 0; i < 8; i++) {
      const p1 = pos(A, i, t * .3), p2 = pos(B, perm.indexOf(i), -t * .25);
      const u = ease.inout(P(t, tl + i * .18, .6));
      if (u > 0) line([p1, [lerp(p1[0], p2[0], u), lerp(p1[1], p2[1], u)]], `hsl(${hues[i]} 95% 65%)`, 3.5, .9);
    }
    for (let i = 0; i < 8; i++) {
      const p1 = pos(A, i, t * .3), p2 = pos(B, perm.indexOf(i), -t * .25), c = `hsl(${hues[i]} 95% 65%)`;
      glow(p1[0], p1[1], 30, c, .8); dot(p1[0], p1[1], 9, c);
      glow(p2[0], p2[1], 30, c, .8); dot(p2[0], p2[1], 9, c);
    }
    T('particle A', A[0], A[1] + 210, { size: 32, weight: 700 });
    T('particle B', B[0], B[1] + 210, { size: 32, weight: 700 });
    T('ENTANGLEMENT', 960, 220, { size: 80, font: 'serif', weight: 800, ls: 8, glow: 30, glowColor: C.mag, a: fadeIn(t, S('s5') + .1) });
    chip('information about which instance goes with which', 960, 860, { a: fadeIn(t, tl), size: 28, border: C.mag });
  });
  // s6: waves on an ocean
  const ov = vis(t, S('s6') - .1, S('b1') + .3, .6, .5);
  if (ov > 0) withA(ov, () => {
    for (let k = 0; k < 6; k++) {
      const pts = [[0, 1080]];
      for (let x = 0; x <= 1920; x += 16) {
        const y = 560 + k * 60 + 36 * Math.sin(x * .006 + t * (.9 + k * .15) + k * 1.3) + 16 * Math.sin(x * .017 - t * 1.4 + k);
        pts.push([x, y]);
      }
      pts.push([1920, 1080]);
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) g.lineTo(p[0], p[1]);
      g.closePath();
      g.fillStyle = `hsla(${200 + k * 18} 85% ${48 - k * 5}% / .55)`; g.fill();
      line(pts.slice(1, -1), `hsl(${190 + k * 18} 95% 75%)`, 2, .6);
    }
    T('Parallel universes are emergent', 960, 300, { size: 64, font: 'serif', weight: 700, glow: 30, glowColor: C.cyan, a: fadeIn(t, W('s6', 'emergent') - .3) });
    T('real, but approximate: like waves on an ocean', 960, 390, { size: 38, font: 'serif', italic: true, color: C.gold, a: fadeIn(t, W('s6', 'Real') - .2) });
    T('not the fundamental thing', 960, 210, { size: 32, color: C.mute, a: fadeIn(t, S('s6') + .2) * (1 - fadeIn(t, W('s6', 'emergent') - .3)) });
  });
});

/* ============================================================= 8 WHY */
scene('b1', 'b6', (t) => {
  header(t, '08', 'Why believe it?', S('b1'), S('o1') + .2);
  const qv = vis(t, S('b1') - .2, S('b3') + .1, .4, .4);
  if (qv > 0) {
    const s = popIn(t, S('b1') - .2, .7) * (1 + .03 * Math.sin(t * 3));
    const gr = g.createLinearGradient(860, 200, 1060, 700);
    gr.addColorStop(0, C.cyan); gr.addColorStop(.5, C.vio); gr.addColorStop(1, C.mag);
    tr(960, 430 - 120 * fadeIn(t, S('b2'), .5), s * (1 - .45 * fadeIn(t, S('b2'), .5)), 0, () => T('?', 0, 0, { size: 440, font: 'serif', weight: 800, color: gr, a: qv, glow: 60, glowColor: C.vio }));
    const e1 = W('b2', 'exciting') - .4, e2 = W('b2', 'explains') - .3;
    chip('because it’s exciting', 700, 620, { a: qv * fadeIn(t, e1, .3), s: popIn(t, e1), size: 34, border: C.red });
    if (t > e1 + .6) cross(700, 620, 1.6, C.red, P(t, e1 + .6, .3) * qv);
    chip('because it explains', 1220, 620, { a: qv * fadeIn(t, e2, .3), s: popIn(t, e2), size: 34, border: C.lime });
    if (t > e2 + .3) withA(qv, () => check(1450, 620, 1.2, C.lime, P(t, e2 + .3, .3)));
  }
  // b3: Everett
  const ev = vis(t, S('b3') - .1, S('b4') + .1, .5, .4);
  if (ev > 0) withA(ev, () => {
    tr(960, 480, .95 + .05 * popIn(t, S('b3') - .1, .6), 0, () => {
      rr(-520, -280, 1040, 560, 26); g.fillStyle = 'rgba(18,16,56,.92)'; g.fill(); g.strokeStyle = C.gold; g.lineWidth = 3; g.stroke();
      T('1957', 0, -170, { size: 120, font: 'mono', weight: 600, color: C.gold, glow: 30, a: fadeIn(t, W('b3', 'nineteen') - .3) });
      T('Hugh Everett III', 0, -50, { size: 60, font: 'serif', weight: 700 });
      T('“Relative State” Formulation of Quantum Mechanics', 0, 20, { size: 32, font: 'serif', italic: true, color: C.mute });
      T('iħ ∂ψ/∂t  =  Ĥψ', 0, 130, { size: 64, font: 'DejaVu Serif', weight: 400, color: C.cyan, a: fadeIn(t, W('b3', 'equations') - .3), glow: 20 });
      T('…taken at face value', 0, 220, { size: 34, font: 'serif', italic: true, color: C.gold, a: fadeIn(t, W('b3', 'face value') - .3) });
    });
  });
  // b4: shut up and calculate
  const sv = vis(t, S('b4') - .1, S('b5') + .1, .5, .4);
  if (sv > 0) withA(sv, () => {
    tr(560, 500, 1, 0, () => {
      rr(-150, -220, 300, 440, 30); g.fillStyle = '#26245e'; g.fill(); g.strokeStyle = C.vio; g.lineWidth = 4; g.stroke();
      rr(-115, -185, 230, 90, 12); g.fillStyle = '#9ff0c8'; g.fill();
      T('0.5', 90, -140, { size: 54, font: 'mono', weight: 600, color: '#18412e', align: 'right' });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { rr(-115 + c * 82, -65 + r * 70, 66, 54, 10); g.fillStyle = r === 3 && c === 2 ? C.coral : '#3a3880'; g.fill(); }
    });
    T('theory  =  a prediction machine?', 1260, 340, { size: 40, weight: 600, a: fadeIn(t, W('b4', 'only predicts') - .3) });
    T('“What is really happening?”', 1260, 450, { size: 44, font: 'serif', italic: true, a: fadeIn(t, W('b4', 'asking') - .3) });
    const mm = W('b4', 'meaningless') - .2;
    T('…meaningless', 1260, 520, { size: 36, color: C.mute, a: fadeIn(t, mm) });
    const st = W('b4', 'Shut up') - .2;
    const ss = popIn(t, st, .35);
    if (t > st) tr(1260, 690, 1.6 - .6 * ss, -.08, () => withA(clamp(ss * 1.5), () => {
      rr(-330, -62, 660, 124, 14); g.strokeStyle = C.red; g.lineWidth = 8; g.stroke();
      T('SHUT UP AND CALCULATE', 0, 4, { size: 50, weight: 700, color: C.red, ls: 4 });
    }));
  });
  // b5: hard to vary
  const hv = vis(t, S('b5') - .1, S('b6') + .1, .5, .4);
  if (hv > 0) withA(hv, () => {
    T('For Deutsch, that’s giving up.', 960, 200, { size: 54, font: 'serif', weight: 600, a: fadeIn(t, S('b5')) });
    const gv = fadeIn(t, W('b5', 'A good explanation') - .3, .5);
    const rot = t * .9;
    gear(780, 470, 90, 12, rot, C.cyan, gv);
    gear(780 + 182, 470 + 18, 70, 9, -rot * 12 / 9 + .2, C.vio, gv);
    gear(780 + 310, 470 - 70, 52, 7, rot * 12 / 7 * 1, C.mag, gv);
    T('a good explanation is', 1360, 400, { size: 34, color: C.mute, align: 'left', a: gv });
    T('HARD TO VARY', 1360, 470, { size: 64, weight: 700, color: C.gold, align: 'left', a: fadeIn(t, W('b5', 'hard to vary') - .3), glow: 20 });
    T('it tells us what’s really out there', 1360, 540, { size: 32, color: C.white, align: 'left', a: fadeIn(t, W('b5', 'It tells us') - .3) });
    const mv = fadeIn(t, W('b5', 'taken seriously') - .3, .5);
    const gr = g.createLinearGradient(560, 0, 1360, 0);
    [C.cyan, C.vio, C.mag, C.gold].forEach((c, i) => gr.addColorStop(i / 3, c));
    T('quantum theory, taken seriously  →  a multiverse', 960, 760, { size: 52, font: 'serif', weight: 700, color: gr, a: mv, glow: 30, glowColor: C.vio });
  });
  // b6: quantum computation
  const qc = vis(t, S('b6') - .1, S('o1') + .3, .5, .5);
  if (qc > 0) withA(qc, () => {
    const st = 6, x0 = 260, x1 = 1660, xm = (x0 + x1) / 2, y0 = 520;
    const grow = ease.inout(P(t, S('b6') + .1, 3));
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let p = 0; p < 64; p++) {
      const pts = [];
      for (let k = 0; k <= st * 2; k++) {
        const lvl = k <= st ? k : 2 * st - k;
        let y = 0;
        for (let b = 0; b < lvl; b++) y += ((p >> (st - 1 - b)) & 1 ? 1 : -1) * 260 / Math.pow(2, b + 1) * 1.1;
        pts.push([lerp(x0, x1, k / (2 * st)), y0 + y]);
      }
      const n = Math.max(2, Math.ceil(pts.length * grow));
      const c = `hsl(${180 + p * 2.6} 95% 65%)`;
      line(pts.slice(0, n), c, 2, .45);
      const ph = ((t * .35 + p * .013) % 1);
      if (grow >= 1) { const [x, y] = along(pts, ph * 1600); dot(x, y, 4, c, .9); }
    }
    g.restore();
    photon(x0, y0, C.white, 1, 1.4);
    T('input', x0, y0 + 70, { size: 28, weight: 600 });
    if (grow >= 1) { photon(x1, y0, C.gold, 1, 1.6); T('answer', x1, y0 + 70, { size: 28, weight: 700, color: C.gold }); }
    T('QUANTUM COMPUTER', 960, 190, { size: 50, weight: 700, ls: 8, color: C.cyan, a: fadeIn(t, S('b6')) });
    T('Where was all that computation done?', 960, 870, { size: 52, font: 'serif', italic: true, weight: 600, color: C.white, glow: 30, glowColor: C.vio, a: fadeIn(t, W('b6', 'where') - .3) });
  });
});

/* ============================================================= 9 OUTRO */
scene('o1', 'o4', (t) => {
  const pv = vis(t, S('o1') - .2, S('o3') + .9, .6, .8);
  if (pv > 0) withA(pv, () => {
    const rb = fadeIn(t, S('o2') - .2, .8);
    // two ribbons of history
    if (rb > 0) {
      g.save(); g.globalCompositeOperation = 'lighter';
      [[C.cyan, 470], [C.mag, 760]].forEach(([c, y]) => {
        for (let k = 0; k < 12; k++) {
          const pts = [];
          for (let x = 0; x <= 1920; x += 24) pts.push([x, y + (k - 5.5) * 6 + 10 * Math.sin(x * .004 + t * .8 + (y > 600 ? 1 : 0))]);
          g.setLineDash([40, 30]); g.lineDashOffset = -t * 140 + k * 9;
          line(pts, c, 2, .45 * rb);
        }
      });
      g.setLineDash([]);
      g.restore();
    }
    const s = 1.15 - .45 * rb;
    const y1 = lerp(820, 470 + 10 * Math.sin(960 * .004 + t * .8), rb), y2 = lerp(820, 760 + 10 * Math.sin(960 * .004 + t * .8 + 1), rb);
    withA(1, () => {
      person(lerp(1160, 960, rb), y2, s, { t, accent: C.mag, halo: hexA(C.mag, .8), phase: 1 });
      person(lerp(760, 960, rb), y1, s, { t, accent: C.cyan, halo: hexA(C.cyan, .8) });
    });
    const c1 = W('o2', 'Not a fantasy') - .2, c2 = W('o2', 'Not a copy') - .2, c3 = W('o2', 'Just another') - .2;
    chip('not a fantasy', 330, 210, { a: fadeIn(t, c1), s: popIn(t, c1), size: 30, border: C.cyan });
    chip('not a copy you can visit', 860, 210, { a: fadeIn(t, c2), s: popIn(t, c2), size: 30, border: C.mag });
    chip('another history, flowing alongside yours', 1480, 210, { a: fadeIn(t, c3), s: popIn(t, c3), size: 30, border: C.gold });
  });
  // o3: the whole multiverse, and one tiny observer
  const zv = fadeIn(t, S('o3') + .3, 1.4);
  if (zv > 0) {
    drawTree(TREES.end, lerp(-40, 2000, ease.inout(P(t, S('o3') + .3, 3.5))), zv * (1 - .6 * fadeIn(t, S('o4') + .5, 1.5)), t);
    const hx = 900, hy = TREES.endY(900);
    const yv = vis(t, W('o3', 'a lump') - .2, S('o4') + 1.2, .4, .6);
    glow(hx, hy, 70, C.gold, yv); dot(hx, hy, 7, '#fff', yv);
    T('you are here', hx, hy - 50, { size: 28, weight: 700, color: C.gold, a: yv });
  }
  // o4: infinity
  const iv = fadeIn(t, S('o4') + .2, 1);
  if (iv > 0) {
    const draw = ease.inout(P(t, S('o4') + .2, 3));
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 9; k++) {
      const pts = [];
      const sc = 330 + (k - 4) * 8, n = Math.max(2, Math.floor(240 * draw));
      for (let i = 0; i <= n; i++) {
        const u = i / 240 * TAU + Math.PI / 2, d = 1 + Math.sin(u) ** 2;
        pts.push([960 + sc * Math.cos(u) / d, 400 + sc * Math.sin(u) * Math.cos(u) / d + (k - 4) * 2]);
      }
      g.shadowColor = `hsl(${180 + k * 20} 95% 65%)`; g.shadowBlur = 20;
      line(pts, `hsl(${180 + k * 20} 95% 65%)`, k === 4 ? 6 : 2, iv * (k === 4 ? 1 : .45));
    }
    g.restore();
    T('the beginning of infinity', 960, 720, { size: 76, font: 'serif', italic: true, weight: 600, glow: 40, glowColor: C.vio, a: fadeIn(t, W('o4', 'beginning') - .2, .8), stroke: ['rgba(5,6,26,.7)', 10] });
    const cr = fadeIn(t, E('o4') + .6, 1);
    T('Based on Chapter 11, “The Multiverse,” of The Beginning of Infinity by David Deutsch (2011)', 960, 840, { size: 28, color: '#c8c5ee', a: cr, stroke: ['rgba(5,6,26,.85)', 8] });
  }
});

/* ------------------------------------------------------------------- run */
const TREES = {};
let WAVE;
window.init = async function () {
  await Promise.all(['700 100px Fraunces', 'italic 600 70px Fraunces', '800 100px Fraunces', '500 40px Inter', '700 40px Inter',
    '600 40px "JetBrains Mono"'].map(f => document.fonts.load(f)));
  await document.fonts.ready;
  NEB = [makeNebula(4, ['#3d2bff', '#ff3ea5', '#1fb6ff', '#7a2bff']), makeNebula(9, ['#00c2b8', '#ffb43d', '#3d6bff', '#c03dff'])];
  const R = rng(1);
  for (let i = 0; i < 420; i++) STARS.push({ x: R() * 1960, y: R() * 1080, r: R() < .1 ? 1.8 + R() : .6 + R() * 1.1, v: 2 + R() * 6, f: .5 + R() * 2.5, p: R() * TAU, b: .3 + R() * .7, c: R() < .2 ? '#cfe3ff' : R() < .3 ? '#ffe3f1' : '#ffffff' });
  BG_MOOD = t => .5 - .5 * Math.cos(t * TAU / 120);
  WAVE = document.createElement('canvas'); WAVE.width = 240; WAVE.height = 135;
  TREES.title = makeTree(12, -60, 470, { depth: 7, step: 290, spread: 760, w0: 60 });
  TREES.big = makeTree(31, 60, 540, { depth: 7, step: 270, spread: 820, w0: 80 });
  TREES.end = makeTree(44, -40, 520, { depth: 8, step: 255, spread: 880, w0: 80 });
  // follow one path through the final tree for "you are here"
  TREES.endY = x => {
    let y = 520, cx = -40, d = 0;
    while (true) {
      const kids = TREES.end.filter(s => s.d === d && Math.abs(s.x1 - cx) < .01 && Math.abs(s.y1 - y) < .01);
      if (!kids.length) return y;
      const k = kids[(kids.length - 1) >> 1];
      if (x <= k.x2) { const u = (x - k.x1) / (k.x2 - k.x1); const e = u * u * (3 - 2 * u); return lerp(k.y1, k.y2, e); }
      cx = k.x2; y = k.y2; d++;
    }
  };
  buildCaptions();
  // scene windows: each runs from just before its first line to just after the next one starts
  SCENES.forEach((s, i) => {
    s.a = S(s.first) - .6;
    s.b = i + 1 < SCENES.length ? S(SCENES[i + 1].first) + .2 : TOTAL + 1;
  });
  SCENES[0].a = -1;
  // photons for the interferometer
  const t0 = W('i4', 'single photon');
  PHOTONS.push({ hold: { t0, t1: t0 + 1, t2: S('i5') + 3.2, t3: S('i7') + .2 }, mode: 'free', out: 'A' });
  const R2 = rng(42);
  for (let tt = S('i7') + .6; tt < S('i8'); tt += .34) PHOTONS.push({ t0: tt, v: 1100, mode: 'free', out: 'A' });
  const outs = ['A', null, 'B', null, null, 'A', 'B', null, 'A', null, 'B', 'B', null, 'A', null, null, 'B', 'A', null, 'A', 'B', null, 'B', null, 'A', null, 'A', 'B', null, 'A'];
  let k = 0;
  for (let tt = S('i8') + .9; tt < W('i9', 'So something') - .6; tt += .3) PHOTONS.push({ t0: tt, v: 1100, mode: 'block', out: outs[k++ % outs.length] });
  for (let tt = W('i9', 'So something') + .8; tt < E('i9') + .5; tt += .34) PHOTONS.push({ t0: tt, v: 1100, mode: 'free', out: 'A', ghost: true });
  for (const p of PHOTONS) {
    if (p.hold) p.arrive = p.hold.t3 + 220 / 520;
    else p.arrive = p.t0 + (1260 + 220) / p.v;
  }
  initSfx();
  return { total: TOTAL };
};

function initSfx() {
  const pops = [];
  sfx(W('h1', 'another'), 'shimmer', .8);
  ['memories', 'face', 'song'].forEach(w => pops.push(W('h2', w) - .15));
  sfx(S('h3'), 'whoosh', .7);
  sfx(W('h3', 'went left') - .5, 'zip', .5); sfx(W('h3', 'it went right') - .5, 'zip', .5);
  sfx(W('h4', 'According'), 'whoosh', .5);
  sfx(W('h4', 'our best theory'), 'pop', .8);
  sfx(W('h5', 'the multiverse'), 'chime', 1);
  sfx(W('h5', 'the multiverse') - .3, 'swell', 1);
  sfx(W('f1', 'two copies'), 'shimmer', .8);
  sfx(W('f2', 'Two Earths'), 'pop', .6); sfx(W('f2', 'every star'), 'sparkle', .8); sfx(W('f2', 'Two of you'), 'pop', .6);
  sfx(W('f3', 'Nothing'), 'thud', .8);
  sfx(W('f4', 'Fungible') - .2, 'chime', .7);
  for (let i = 0; i < 100; i += 10) sfx(W('f5', 'hundred dollars') + i * .012, 'coin', .35);
  sfx(W('f5', 'which dollar') + .6, 'whoosh', .4);
  sfx(W('f6', 'no fact'), 'swell', .5);
  sfx(W('f7', 'As long as'), 'whoosh', .5); sfx(W('f7', 'they behave as one'), 'chime', .6);
  sfx(W('d2', 'single particle') + .3, 'zip', .6);
  sfx(W('d2', 'striking') + .3, 'thud', .7);
  sfx(W('d2', 'In one universe') - .3, 'shimmer', .9);
  sfx(W('d2', 'red lamp') - .1, 'ding', .6); sfx(W('d2', 'blue one') - .1, 'ding', .6);
  pops.push(W('d3', 'differentiated'), W('d5', 'And each'));
  sfx(W('w2', 'cosmic photocopier') - .4, 'shimmer', .6); sfx(W('w2', 'photocopier') + .3, 'thud', .9);
  sfx(W('w3', 'spreads') - .2, 'swell', .9);
  ['by light', 'air molecules', 'by sound', 'Never faster'].forEach(w => pops.push(W('w3', w) - .1));
  sfx(S('w5') + .1, 'swell', .5); sfx(W('w5', 'A wave'), 'swell', .5);
  sfx(W('i1', 'erased'), 'sparkle', .7); sfx(W('i2', 'They merge'), 'chime', .5);
  sfx(S('i3') - .1, 'swell', .9);
  for (const p of PHOTONS) {
    if (p.hold) { sfx(p.hold.t1, 'zip', .5); sfx(p.arrive, 'ding', .7); continue; }
    if (p.out) sfx(p.arrive, 'blip', .45);
  }
  sfx(S('i8') + .1, 'thud', .6);
  pops.push(W('i7', 'same detector') - .2);
  sfx(W('c1', 'Why doesn') + .7, 'thud', 1);
  pops.push(W('c3', 'detector') - .15, W('c3', 'notebook') - .15, W('c3', 'the air') - .15, W('c3', 'brain') - .15);
  sfx(W('c3', 'undoing'), 'thud', .7);
  sfx(S('c4') - .1, 'swell', .8);
  sfx(W('c5', 'phone') + .9, 'thud', .6);
  sfx(W('m2', 'countable') + .5, 'thud', .6);
  sfx(W('m3', 'divides') - .3, 'swell', .7);
  sfx(W('m4', 'the measure') - .3, 'chime', .6);
  sfx(S('s1') - .2, 'swell', .7);
  sfx(S('s3') + .3, 'swell', .9);
  sfx(W('s4', 'Its fungible') - .1, 'shimmer', .7);
  sfx(S('s6'), 'swell', .5);
  sfx(S('b1') - .2, 'pop', .9);
  pops.push(W('b2', 'exciting') - .4, W('b2', 'explains') - .3);
  sfx(W('b4', 'Shut up') - .2, 'thud', 1);
  sfx(W('b5', 'taken seriously') - .3, 'chime', .6);
  sfx(S('b6') + .1, 'swell', .7);
  pops.push(W('o2', 'Not a fantasy') - .2, W('o2', 'Not a copy') - .2, W('o2', 'Just another') - .2);
  sfx(S('o3') + .3, 'swell', 1);
  sfx(W('o4', 'beginning') - .2, 'chime', 1);
  for (const p of pops) sfx(p, 'pop', .6);
  window.SFX.sort((a, b) => a.t - b.t);
}

window.render = function (t) {
  background(t);
  for (const s of SCENES) {
    if (t < s.a || t > s.b) continue;
    const a = vis(t, s.a, s.b, .6, .6);
    if (a >= .999) { g = main; g.save(); s.fn(t); g.restore(); continue; }
    g = lctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 1920, 1080);
    g.save(); s.fn(t); g.restore();
    g = main;
    g.save(); g.globalAlpha = a; g.drawImage(layer, 0, 0); g.restore();
  }
  g = main;
  vignette();
  captions(t);
};
