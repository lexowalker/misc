// Drawing kit: easing, seeded noise, washi paper, ink strokes, cartouches, seals,
// sound-spirits and the little note glyphs used all through the film.
'use strict';

const W = 1920, H = 1080;
const PAL = {
  paper: '#ebe0c6', paperDark: '#d9c9a5', ink: '#1c1a20', inkSoft: 'rgba(28,26,32,0.55)',
  indigo: '#1d2c4c', indigoDeep: '#111a30', ver: '#b9372a', ochre: '#c49a45',
  cream: '#f4ead3', sage: '#7d8c6a',
};
const SERIF = '"Cormorant", "Shippori", serif';
const JP = '"Shippori", serif';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => (k = clamp(k), k * k * (3 - 2 * k));
const easeOut = k => 1 - Math.pow(1 - clamp(k), 3);
const easeIn = k => Math.pow(clamp(k), 3);
const ramp = (t, a, b) => clamp((t - a) / (b - a));
// 0 → 1 over [a, a+fin], 1 → 0 over [b-fout, b]
const win = (t, a, b, fin = 0.5, fout = 0.5) => Math.min(ease((t - a) / fin), ease((b - t) / fout));

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x297a2d39 >>> 0, s ^= s >>> 12), (s >>> 0) / 4294967296);
}
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, h = n => { const v = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453; return v - Math.floor(v); };
  return lerp(h(i), h(i + 1), f * f * (3 - 2 * f));
}

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------- textures, built once ----------
const TEX = {};
function buildTextures() {
  // washi: warm base, mottling, long fibres
  const p = mkCanvas(W, H), g = p.getContext('2d'), r = rng(7);
  g.fillStyle = PAL.paper; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) {
    const x = r() * W, y = r() * H, s = 20 + r() * 140;
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    const d = r() < 0.5 ? '120,95,55' : '255,250,235';
    gr.addColorStop(0, `rgba(${d},${0.025 + r() * 0.03})`); gr.addColorStop(1, `rgba(${d},0)`);
    g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = r() * H, a = r() * Math.PI * 2, l = 8 + r() * 46;
    g.strokeStyle = `rgba(${r() < 0.6 ? '110,85,50' : '255,252,240'},${0.05 + r() * 0.1})`;
    g.lineWidth = 0.4 + r() * 0.9;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 8, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 8, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  TEX.paper = p;
  // grain: tiled noise, used with a jittered offset every frame
  const n = mkCanvas(512, 512), ng = n.getContext('2d'), id = ng.createImageData(512, 512), r2 = rng(11);
  for (let i = 0; i < id.data.length; i += 4) { const v = 110 + r2() * 145; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 20; }
  ng.putImageData(id, 0, 0); TEX.grain = n;
  // vignette
  const v = mkCanvas(W, H), vg = v.getContext('2d');
  const gr = vg.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  gr.addColorStop(0, 'rgba(10,8,14,0)'); gr.addColorStop(1, 'rgba(10,8,14,0.55)');
  vg.fillStyle = gr; vg.fillRect(0, 0, W, H); TEX.vignette = v;
}

// ---------- images ----------
// Draws img to cover the frame. (fx, fy) is the focus point in image fractions, z the zoom.
function cover(x, img, fx = 0.5, fy = 0.5, z = 1, alpha = 1) {
  if (!img || alpha <= 0) return;
  const s = Math.max(W / img.width, H / img.height) * z;
  const dw = img.width * s, dh = img.height * s;
  let dx = W / 2 - fx * dw, dy = H / 2 - fy * dh;
  dx = clamp(dx, W - dw, 0); dy = clamp(dy, H - dh, 0);
  x.globalAlpha = alpha; x.drawImage(img, dx, dy, dw, dh); x.globalAlpha = 1;
}
// Ken Burns between two {x, y, z} framings over [t0, t1]
function kb(x, img, t, t0, t1, a, b, alpha = 1) {
  const k = ease((t - t0) / (t1 - t0));
  cover(x, img, lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k), alpha);
}
// where an image point lands on screen for a given framing (to pin overlays to a plate)
function plateToScreen(img, fx, fy, z, px, py) {
  const s = Math.max(W / img.width, H / img.height) * z;
  const dw = img.width * s, dh = img.height * s;
  const dx = clamp(W / 2 - fx * dw, W - dw, 0), dy = clamp(H / 2 - fy * dh, H - dh, 0);
  return [dx + px * dw, dy + py * dh, s];
}

function paper(x, alpha = 1) { x.globalAlpha = alpha; x.drawImage(TEX.paper, 0, 0); x.globalAlpha = 1; }
function shade(x, a, color = '8,8,16') { if (a <= 0) return; x.fillStyle = `rgba(${color},${a})`; x.fillRect(0, 0, W, H); }

// ---------- type ----------
function text(x, s, px, py, o = {}) {
  x.save();
  x.font = `${o.italic ? 'italic ' : ''}${o.weight || 500} ${o.size || 40}px ${o.font || SERIF}`;
  x.textAlign = o.align || 'left'; x.textBaseline = o.base || 'alphabetic';
  x.globalAlpha = o.alpha ?? 1;
  if (o.ls) x.letterSpacing = o.ls + 'px';
  if (o.shadow) { x.shadowColor = o.shadow; x.shadowBlur = o.blur ?? 18; }
  if (o.stroke) { x.lineWidth = o.stroke; x.strokeStyle = o.strokeColor || PAL.ink; x.lineJoin = 'round'; x.strokeText(s, px, py); }
  x.fillStyle = o.color || PAL.ink; x.fillText(s, px, py);
  x.restore();
}
// text revealed left to right like a brush pass
function brushText(x, s, px, py, k, o = {}) {
  if (k <= 0) return;
  x.save();
  x.font = `${o.italic ? 'italic ' : ''}${o.weight || 500} ${o.size || 40}px ${o.font || SERIF}`;
  if (o.ls) x.letterSpacing = o.ls + 'px';
  const w = x.measureText(s).width, align = o.align || 'left';
  const left = align === 'center' ? px - w / 2 : align === 'right' ? px - w : px;
  const g = x.createLinearGradient(left, 0, left + w + 80, 0);
  const e = clamp(k) * (1 + 80 / w);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(clamp(e - 0.08 * (1 - k)), 'rgba(0,0,0,1)'); g.addColorStop(clamp(e), 'rgba(0,0,0,0)');
  x.restore();
  const c = mkScratch();
  const cx = c.getContext('2d'); cx.clearRect(0, 0, W, H);
  text(cx, s, px, py, o);
  cx.globalCompositeOperation = 'destination-in'; cx.fillStyle = g; cx.fillRect(0, 0, W, H); cx.globalCompositeOperation = 'source-over';
  x.drawImage(c, 0, 0);
}
let SCR = null;
function mkScratch() { return SCR || (SCR = mkCanvas(W, H)); }

function vtext(x, s, px, py, o = {}) {        // vertical Japanese text, top to bottom
  const size = o.size || 48;
  [...s].forEach((ch, i) => text(x, ch, px, py + i * size * 1.08, { ...o, align: 'center', base: 'top', font: JP }));
}

// ---------- shapes ----------
// paper cartouche with a double ink rule, like the title blocks on prints
function cartouche(x, px, py, w, h, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return;
  x.save(); x.globalAlpha = a;
  x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = o.flat ? 0 : 24; x.shadowOffsetY = 6;
  x.fillStyle = o.fill || PAL.paper; x.fillRect(px, py, w, h);
  x.shadowColor = 'transparent';
  if (!o.fill) { x.globalAlpha = a * 0.9; x.drawImage(TEX.paper, px, py, w, h, px, py, w, h); x.globalAlpha = a; }
  x.strokeStyle = o.rule || PAL.ink; x.lineWidth = 3; x.strokeRect(px + 8, py + 8, w - 16, h - 16);
  x.lineWidth = 1.2; x.strokeRect(px + 15, py + 15, w - 30, h - 30);
  x.restore();
}
function seal(x, px, py, size, chars, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return;
  x.save(); x.globalAlpha = a * 0.92; x.translate(px, py); x.rotate(o.rot ?? -0.04);
  x.fillStyle = PAL.ver;
  const r = rng(chars.length * 97 + 3);
  x.beginPath(); x.moveTo(-size / 2, -size / 2);
  for (const [cx, cy] of [[size / 2, -size / 2], [size / 2, size / 2], [-size / 2, size / 2]]) x.lineTo(cx + (r() - 0.5) * size * 0.04, cy + (r() - 0.5) * size * 0.04);
  x.closePath(); x.fill();
  x.globalCompositeOperation = 'destination-out';
  x.strokeStyle = '#000'; x.lineWidth = size * 0.05; x.strokeRect(-size * 0.4, -size * 0.4, size * 0.8, size * 0.8);
  const n = [...chars].length, cols = n > 2 ? 2 : 1, rows = Math.ceil(n / cols), fs = size * (n > 2 ? 0.34 : n === 2 ? 0.36 : 0.62);
  [...chars].forEach((ch, i) => {
    const col = cols - 1 - Math.floor(i / rows), row = i % rows;
    const cx = cols === 1 ? 0 : (col - 0.5) * size * 0.36, cy = (row - (rows - 1) / 2) * fs * 1.05;
    text(x, ch, cx, cy, { font: JP, size: fs, weight: 700, align: 'center', base: 'middle', color: '#000' });
  });
  x.restore();
}
// tapered ink stroke along points, drawn up to fraction k
function inkStroke(x, pts, width, k = 1, color = PAL.ink) {
  if (k <= 0 || pts.length < 2) return;
  if (pts.length < 12) {                          // resample short polylines so the taper has room
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < 12; j++) out.push([lerp(pts[i][0], pts[i + 1][0], j / 12), lerp(pts[i][1], pts[i + 1][1], j / 12)]);
    out.push(pts[pts.length - 1]); pts = out;
  }
  const n = Math.max(2, Math.floor(pts.length * clamp(k)));
  x.save(); x.fillStyle = color; x.strokeStyle = color; x.lineCap = 'round';
  for (let i = 1; i < n; i++) {
    const u = i / (pts.length - 1), wv = width * (0.45 + 0.55 * Math.sin(Math.PI * clamp(0.04 + u * 0.92)));
    x.lineWidth = Math.max(0.6, wv);
    x.beginPath(); x.moveTo(pts[i - 1][0], pts[i - 1][1]); x.lineTo(pts[i][0], pts[i][1]); x.stroke();
  }
  x.restore();
}
function bracket(x, x0, x1, y, k, label, o = {}) {      // a brush-drawn span marker with a label
  if (k <= 0) return;
  const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push([lerp(x0, x1, u), y + Math.sin(u * Math.PI) * (o.bow ?? -10)]); }
  x.save(); x.globalAlpha = o.alpha ?? 1;
  inkStroke(x, pts, o.w || 4, k, o.color || PAL.ink);
  for (const ex of [x0, x1]) inkStroke(x, [[ex, y - 14], [ex, y + 14]], 3, k, o.color || PAL.ink);
  if (label) text(x, label, (x0 + x1) / 2, y + (o.below ? 46 : -22), { size: o.size || 34, align: 'center', color: o.color || PAL.ink, italic: o.italic, alpha: (o.alpha ?? 1) * ease(k * 1.5 - 0.3) });
  x.restore();
}

// a little sound-spirit: teardrop body, two eyes, a wavering tail
function spirit(x, px, py, s, t, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return;
  x.save(); x.translate(px, py); x.rotate(o.rot ?? Math.sin(t * 1.3 + (o.seed || 0)) * 0.15); x.globalAlpha = a;
  const col = o.color || 'rgba(244,236,214,0.92)';
  x.shadowColor = o.glow || 'rgba(230,235,255,0.6)'; x.shadowBlur = s * 0.6;
  x.fillStyle = col; x.beginPath();
  x.moveTo(0, -s);
  x.bezierCurveTo(s * 0.75, -s, s * 0.8, s * 0.1, s * 0.3, s * 0.45);
  const tw = Math.sin(t * 4 + (o.seed || 0)) * s * 0.35;
  x.quadraticCurveTo(s * 0.1 + tw, s * 1.2, -s * 0.15 + tw * 1.4, s * 1.6);
  x.quadraticCurveTo(-s * 0.2, s * 0.9, -s * 0.45, s * 0.35);
  x.bezierCurveTo(-s * 0.85, 0, -s * 0.7, -s, 0, -s);
  x.fill(); x.shadowBlur = 0;
  x.fillStyle = PAL.ink;
  const blink = (Math.sin(t * 0.9 + (o.seed || 0) * 3) > 0.97) ? 0.15 : 1;
  for (const ex of [-0.22, 0.2]) { x.beginPath(); x.ellipse(ex * s, -s * 0.35, s * 0.09, s * 0.13 * blink, 0, 0, Math.PI * 2); x.fill(); }
  x.restore();
}

// note glyphs: deterministic ink marks in a w×h box, one per element "type"
const GLYPHS = ['whistle', 'up', 'down', 'chevron', 'swoop', 'trill', 'buzz', 'click', 'hook', 'double'];
function glyph(x, kind, px, py, w, h, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0) return;
  x.save(); x.globalAlpha = a; x.translate(px, py);
  const c = o.color || PAL.ink, lw = o.lw || Math.max(1.5, h * 0.09), y0 = o.y ?? 0.5;
  const line = (pts) => inkStroke(x, pts, lw, o.k ?? 1, c);
  const curve = (f) => { const p = []; for (let i = 0; i <= 24; i++) { const u = i / 24; p.push([u * w, (1 - f(u)) * h]); } line(p); };
  switch (kind) {
    case 'whistle': curve(u => y0 + 0.03 * Math.sin(u * 6)); break;
    case 'up': curve(u => 0.15 + 0.7 * u * u); break;
    case 'down': curve(u => 0.85 - 0.7 * Math.sqrt(u)); break;
    case 'chevron': curve(u => 0.25 + 0.6 * (1 - Math.abs(u * 2 - 1))); break;
    case 'swoop': curve(u => 0.5 + 0.35 * Math.sin(u * Math.PI * 1.5)); break;
    case 'trill': for (let i = 0; i < 5; i++) { const xx = (i + 0.3) / 5.3 * w; line([[xx, h * 0.12], [xx + w * 0.05, h * 0.88]]); } break;
    case 'buzz': for (let i = 0; i < 9; i++) { const xx = i / 8 * w; line([[xx, h * (0.3 + 0.05 * Math.sin(i))], [xx, h * 0.75]]); } break;
    case 'click': line([[w * 0.5, h * 0.05], [w * 0.52, h * 0.95]]); break;
    case 'hook': curve(u => u < 0.6 ? 0.4 + u * 0.6 : 0.76 - (u - 0.6) * 1.5); break;
    case 'double': curve(u => 0.72 - 0.15 * u); curve(u => 0.32 + 0.12 * u); break;
  }
  x.restore();
}

// drifting mist bands over a plate
function mist(x, t, o = {}) {
  const a = o.alpha ?? 0.25; if (a <= 0) return;
  x.save();
  for (let i = 0; i < (o.n || 4); i++) {
    const y = (o.y || 0.7) * H + i * 60 + Math.sin(t * 0.07 + i) * 20;
    const xo = ((t * (o.speed || 14) * (1 + i * 0.3) + i * 500) % (W + 1400)) - 1400;
    const g = x.createLinearGradient(0, y - 30, 0, y + 30);
    g.addColorStop(0, 'rgba(235,232,222,0)'); g.addColorStop(0.5, `rgba(235,232,222,${a * (0.6 + 0.4 * Math.sin(i * 2.1))})`); g.addColorStop(1, 'rgba(235,232,222,0)');
    x.fillStyle = g;
    x.beginPath(); x.ellipse(xo + 700, y, 760, 26 + i * 4, 0, 0, Math.PI * 2); x.fill();
  }
  x.restore();
}

function finish(x, t, o = {}) {                     // grain, vignette and the faint paper bloom over everything
  x.save();
  x.globalCompositeOperation = 'multiply'; x.globalAlpha = o.paper ?? 0.18; x.drawImage(TEX.paper, 0, 0);
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.5;
  const ox = Math.floor(noise1(t * 30) * 512), oy = Math.floor(noise1(t * 30, 5) * 512);
  for (let gx = -ox; gx < W; gx += 512) for (let gy = -oy; gy < H; gy += 512) x.drawImage(TEX.grain, gx, gy);
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = o.vignette ?? 1; x.drawImage(TEX.vignette, 0, 0);
  x.restore();
}
