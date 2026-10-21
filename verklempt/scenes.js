// Every visual is a pure function of time: render(t) sets the whole stage for second t.
const TL = window.TL.lines, TOTAL = window.TL.total;
const S = id => TL[id].start, E = id => TL[id].end, D = id => E(id) - S(id);
const at = (id, f) => S(id) + f * D(id);
const seg = (id, k) => TL[id].seg[k][0];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, d) => clamp((t - a) / d);
const lerp = (a, b, p) => a + (b - a) * p;
const ease = {
  out: p => 1 - Math.pow(1 - p, 3),
  inout: p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  back: p => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  bounce: p => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + .75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + .9375;
    return n * (p -= 2.625 / d) * p + .984375;
  },
  // damped spring settling from 0 to 1
  spring: p => (p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(p * 14)),
};
const fadeIn = (t, a, d = .35) => ease.out(P(t, a, d));
const popIn = (t, a, d = .45) => ease.back(P(t, a, d));
const window_ = (t, a, b, fi = .3, fo = .25) => fadeIn(t, a, fi) * (1 - ease.out(P(t, b - fo, fo)));
const $ = id => document.getElementById(id);
const css = (el, { x = 0, y = 0, s = 1, sx, sy, r = 0, o, pre = '' } = {}) => {
  const sc = sx !== undefined || sy !== undefined ? `scale(${sx ?? s},${sy ?? s})` : `scale(${s})`;
  el.style.transform = `${pre}translate(${x}px,${y}px) rotate(${r}deg) ${sc}`;
  if (o !== undefined) el.style.opacity = o;
};
const svgT = (el, { x = 0, y = 0, r = 0, s = 1, sx, sy, o } = {}) => {
  el.setAttribute('transform', `translate(${x} ${y}) rotate(${r}) scale(${sx ?? s} ${sy ?? s})`);
  if (o !== undefined) el.setAttribute('opacity', o);
};
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
};
// spoken word onsets, estimated by character position within the line
function wordTimes(id) {
  const words = TL[id].text.split(/\s+/);
  const total = words.join(' ').length;
  let c = 0;
  return words.map(w => { const s = at(id, c / total); c += w.length + 1; return s; });
}
// deterministic noise for wobbles
const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

const INK = '#1F1A1C', ROSE = '#D2435B', TEAR = '#3F8FD8', CARD = '#FCF8F2', MUTE = '#84786F';

window.SFX = [];
const sfx = (t, type, gain = 1) => window.SFX.push({ t: +t.toFixed(3), type, gain });

/* ------------------------------------------------------------------ scenes */
const SCENES = [
  { id: 'sc-hook', a: 0, b: S('w1') + .25 },
  { id: 'sc-word', a: S('w1') - .35, b: S('d1') - .2 },
  { id: 'sc-def', a: S('d1') - .2, b: S('e1') - .2 },
  { id: 'sc-ety', a: S('e1') - .2, b: S('g1') - .2 },
  { id: 'sc-ff', a: S('g1') - .2, b: S('p1') - .2 },
  { id: 'sc-tv', a: S('p1') - .2, b: S('x0') - .2 },
  { id: 'sc-ex', a: S('x0') - .2, b: S('s1') - .2 },
  { id: 'sc-syn', a: S('s1') - .2, b: S('o1') - .2 },
  { id: 'sc-out', a: S('o1') - .2, b: TOTAL + 5 },
];

/* ---------------------------------------------------------------- captions */
const NO_CAP = new Set(['w1', 'w2', 'o3', 'p3', 'x1', 'x2', 'x3']);
const CAP_TEXT = {
  p1: 'Then, in the early ’90s, Saturday Night Live made it famous.',
};
let CAPS = [];
function buildCaptions() {
  for (const id in TL) {
    if (NO_CAP.has(id)) continue;
    const words = (CAP_TEXT[id] || TL[id].text).replace(/\.\.\./g, '…').split(' ');
    const chunks = [];
    let cur = [];
    for (const w of words) {
      cur.push(w);
      const len = cur.join(' ').length;
      if ((len > 34 && /[,.:?!…]$/.test(w)) || len > 46) { chunks.push(cur.join(' ')); cur = []; }
    }
    if (cur.length) {
      // don't strand a word or two on its own
      if (chunks.length && cur.join(' ').length < 14) chunks.push(chunks.pop() + ' ' + cur.join(' '));
      else chunks.push(cur.join(' '));
    }
    const total = chunks.join(' ').length;
    let c = 0;
    chunks.forEach((txt, i) => {
      const a = at(id, c / total);
      c += txt.length + 1;
      const b = i === chunks.length - 1 ? E(id) + .3 : at(id, c / total);
      CAPS.push({ a, b, html: txt.replace(/(verkle\w*|farklemt|klemmen)/gi, '<span class="k">$1</span>') });
    });
  }
}
let capShown = null;
function renderCaption(t) {
  const c = CAPS.find(c => t >= c.a - .05 && t < c.b);
  const el = $('cap');
  if (c !== capShown) { el.innerHTML = c ? `<div>${c.html}</div>` : ''; capShown = c; }
  if (!c) return;
  const o = fadeIn(t, c.a - .05, .12) * (1 - P(t, c.b - .08, .08));
  css(el, { y: 10 * (1 - fadeIn(t, c.a - .05, .2)), o });
}

/* ------------------------------------------------------------- drawing kit */
// A round face (radius 200, centred on 0,0) whose mood is set per frame.
function makeFace(g, { body = false, bow = false } = {}) {
  const f = {};
  if (body) {
    svgEl('path', { d: 'M-270 430 Q-262 318 -88 296 L88 296 Q262 318 270 430 Z', fill: '#E7DACB', stroke: INK, 'stroke-width': 10, 'stroke-linejoin': 'round' }, g);
    svgEl('rect', { x: -62, y: 170, width: 124, height: 140, fill: CARD, stroke: INK, 'stroke-width': 10 }, g);
    f.lump = svgEl('circle', { cx: 0, cy: 250, r: 0, fill: ROSE }, g);
  }
  if (bow) {
    svgEl('path', { d: 'M0 222 L-62 192 L-62 252 Z M0 222 L62 192 L62 252 Z', fill: ROSE, stroke: INK, 'stroke-width': 8, 'stroke-linejoin': 'round' }, g);
    svgEl('circle', { cx: 0, cy: 222, r: 14, fill: ROSE, stroke: INK, 'stroke-width': 8 }, g);
  }
  svgEl('circle', { r: 200, fill: CARD, stroke: INK, 'stroke-width': 10 }, g);
  f.blush = [-1, 1].map(s => svgEl('ellipse', { cx: s * 118, cy: 62, rx: 38, ry: 22, fill: ROSE, opacity: 0 }, g));
  f.eyes = [-1, 1].map(s => {
    const eg = svgEl('g', { transform: `translate(${s * 76} -18)` }, g);
    const lid = svgEl('ellipse', { rx: 20, ry: 26, fill: INK }, eg);
    const shine = svgEl('circle', { cx: 6, cy: -9, r: 6, fill: '#FFFFFF' }, eg);
    const well = svgEl('ellipse', { cx: 0, cy: 26, rx: 30, ry: 0, fill: TEAR, opacity: .9 }, eg);
    const drop = svgEl('path', { d: 'M0 -18 Q13 0 13 8 A13 13 0 1 1 -13 8 Q-13 0 0 -18 Z', fill: TEAR, opacity: 0 }, eg);
    return { eg, lid, shine, well, drop, s };
  });
  f.brows = [-1, 1].map(s => svgEl('line', { x1: -36, y1: 0, x2: 36, y2: 0, stroke: INK, 'stroke-width': 11, 'stroke-linecap': 'round' }, g));
  f.mouth = svgEl('path', { fill: 'none', stroke: INK, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  f.sweat = svgEl('path', { d: 'M0 -22 Q14 0 14 9 A14 14 0 1 1 -14 9 Q-14 0 0 -22 Z', fill: TEAR, opacity: 0, transform: 'translate(150 -110)' }, g);
  return f;
}
// mood: brow (+ = worried/moved, - = tense), smile (+ smile, - frown), wobble, well (0..1), blink (0..1), blush, cry (0..1 drop progress)
function setFace(f, t, { brow = 0, smile = 10, wobble = 0, well = 0, blink = 0, blush = 0, cry = -1, sweat = 0, browY = -88 } = {}) {
  f.brows.forEach((b, i) => {
    const s = i ? 1 : -1;
    b.setAttribute('transform', `translate(${s * 76} ${browY - Math.abs(brow) * .6}) rotate(${s * brow})`);
  });
  f.eyes.forEach(e => {
    e.lid.setAttribute('ry', (26 * (1 - .92 * blink)).toFixed(2));
    e.shine.setAttribute('opacity', blink > .5 ? 0 : 1);
    e.shine.setAttribute('r', 6 + 4 * well);
    e.well.setAttribute('ry', (11 * well).toFixed(2));
    e.well.setAttribute('cy', 24 - 4 * well);
    if (cry >= 0 && cry < 1) {
      const y = 30 + 210 * ease.inout(cry);
      e.drop.setAttribute('transform', `translate(${e.s * (8 + 22 * cry)} ${y}) scale(${lerp(.5, 1, clamp(cry * 4))})`);
      e.drop.setAttribute('opacity', 1 - clamp((cry - .85) / .15));
    } else e.drop.setAttribute('opacity', 0);
  });
  f.blush.forEach(b => b.setAttribute('opacity', .45 * blush));
  const pts = [];
  for (let k = 0; k <= 16; k++) {
    const x = -62 + k * 124 / 16, u = x / 62;
    const y = 100 + smile * (1 - u * u) + wobble * Math.sin(x * .22 + t * 22) * (1 - u * u * .5);
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  f.mouth.setAttribute('d', 'M' + pts.join(' L'));
  f.sweat.setAttribute('opacity', sweat);
}
const blinkAt = (t, times) => times.reduce((m, b) => Math.max(m, 1 - Math.abs(t - b) / .09), 0);

// An open hand, wrist at 0,0, fingers pointing up.
function makeHand(g) {
  const h = svgEl('g', {}, g);
  const st = { fill: CARD, stroke: INK, 'stroke-width': 9, 'stroke-linejoin': 'round' };
  [[-36, -150, 64], [-12, -170, 84], [12, -164, 78], [36, -140, 56]].forEach(([x, y, hgt]) =>
    svgEl('rect', { x: x - 12, y, width: 24, height: hgt + 40, rx: 12, ...st }, h));
  svgEl('rect', { x: -50, y: -100, width: 100, height: 112, rx: 34, ...st }, h);
  svgEl('rect', { x: -12, y: -72, width: 24, height: 76, rx: 12, ...st, transform: 'rotate(-48 -40 -10) translate(-60 0)' }, h);
  svgEl('rect', { x: -30, y: 6, width: 60, height: 60, fill: CARD, stroke: 'none' }, h);
  svgEl('line', { x1: -30, y1: 8, x2: -30, y2: 66, stroke: INK, 'stroke-width': 9 }, h);
  svgEl('line', { x1: 30, y1: 8, x2: 30, y2: 66, stroke: INK, 'stroke-width': 9 }, h);
  return h;
}
const fanAngle = (t, a, rate = 3.2) => (t < a ? 0 : 22 * Math.sin((t - a) * rate * 2 * Math.PI) * clamp((t - a) * 4));

// A C-clamp with a heart in its jaws. Its open side faces right; the jaws sit at x = 80.
const HEART = 'M0 52 C -72 2 -78 -44 -42 -60 C -18 -70 -4 -56 0 -40 C 4 -56 18 -70 42 -60 C 78 -44 72 2 0 52 Z';
function makeClamp(g) {
  const c = { g };
  svgEl('path', { d: 'M86 -150 L-70 -150 Q-86 -150 -86 -134 L-86 154 Q-86 170 -70 170 L86 170', fill: 'none', stroke: INK, 'stroke-width': 30, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  svgEl('rect', { x: 26, y: -144, width: 108, height: 24, rx: 6, fill: MUTE, stroke: INK, 'stroke-width': 6 }, g);
  c.heart = svgEl('path', { d: HEART, fill: ROSE, stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round' }, g);
  c.screw = svgEl('g', {}, g);
  svgEl('rect', { x: 70, y: 0, width: 20, height: 300, fill: '#B9AC9C', stroke: INK, 'stroke-width': 6 }, c.screw);
  c.threads = [0, 1, 2, 3, 4, 5, 6, 7].map(i => svgEl('line', { x1: 72, x2: 88, stroke: INK, 'stroke-width': 4 }, c.screw));
  c.pad = svgEl('rect', { x: 26, y: 0, width: 108, height: 24, rx: 6, fill: MUTE, stroke: INK, 'stroke-width': 6 }, g);
  c.handle = svgEl('rect', { x: 20, y: 0, width: 120, height: 22, rx: 11, fill: INK }, g);
  return c;
}
// squeeze 0 = open, 1 = tight
function setClamp(c, squeeze, beat = 0) {
  const padTop = lerp(64, -22, squeeze);
  const gap = padTop - (-120);
  const sy = Math.min(1, gap / 128), sx = 1 + (1 - sy) * .7;
  const b = 1 + .06 * beat;
  c.heart.setAttribute('transform', `translate(80 ${(-120 + gap / 2).toFixed(2)}) scale(${(sx * b).toFixed(3)} ${(sy * b).toFixed(3)})`);
  c.pad.setAttribute('y', padTop);
  c.screw.setAttribute('transform', `translate(0 ${padTop + 24})`);
  c.threads.forEach((l, i) => {
    const y = ((i * 22 + squeeze * 140) % 176) + 70;
    l.setAttribute('y1', y); l.setAttribute('y2', y + 8);
  });
  c.handle.setAttribute('y', padTop + 24 + 260);
}

/* ------------------------------------------------------------------- init */
const G = {};
window.init = async function () {
  await Promise.all([
    '600 180px Fraunces', 'italic 600 70px Fraunces', 'italic 700 70px Fraunces', '400 80px Fraunces', '500 60px Fraunces',
    '500 40px Inter', '600 40px Inter', '400 40px "JetBrains Mono"', '600 40px "JetBrains Mono"', '700 60px "Frank Ruhl Libre"',
  ].map(f => document.fonts.load(f, f.includes('Frank') ? 'פֿאַרקלעמט' : undefined)));
  await document.fonts.ready;

  // paper grain
  const gc = $('grain').getContext('2d');
  const im = gc.createImageData(540, 960);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < im.data.length; i += 4) {
    const v = 150 + rnd() * 105;
    im.data[i] = v; im.data[i + 1] = v * .96; im.data[i + 2] = v * .93; im.data[i + 3] = 26;
  }
  gc.putImageData(im, 0, 0);

  // progress dots
  SCENES.forEach((_, i) => {
    const d = document.createElement('i');
    d.style.left = (540 + (i - 4) * 34 - 6) + 'px';
    $('dots').appendChild(d);
  });

  // fit the headline word to the frame width
  for (const id of ['wordT', 'endT']) {
    const el = $(id);
    const w = el.getComputedTextLength();
    if (w > 880) el.setAttribute('font-size', (180 * 880 / w).toFixed(1));
  }
  G.wordW = $('wordT').getComputedTextLength();

  /* hook */
  G.hookFace = makeFace($('hookFig'), { body: true });
  G.rings = [0, 1, 2].map(() => svgEl('circle', { r: 0, fill: 'none', stroke: ROSE, 'stroke-width': 6 }, $('lumpRings')));
  G.lumpT = at('h2', .4); sfx(G.lumpT, 'thump', .9);
  G.wellT = at('h3', .55); sfx(G.wellT, 'bubble', .45);
  G.sayT = seg('h4', 0); sfx(G.sayT, 'pop', .8);
  G.sayStr = 'I just want to say—';
  G.squeezeT = seg('h4', 1) + .15; sfx(G.squeezeT, 'ratchet', .9);
  G.sayGoneT = G.squeezeT + .75; sfx(G.sayGoneT, 'pop', .6);
  G.dropT = seg('h4', 1) + .1;
  sfx(S('h1') - .1, 'pop', .6);

  /* word */
  G.releaseT = S('w1') + .05; sfx(G.releaseT, 'snap', .9);
  const syl = ['fer', ' · ', 'KLEMPT'];
  const sylT = svgEl('text', { x: 540, y: 1000 }, $('sylG'));
  G.syl = syl.map(s => {
    const ts = svgEl('tspan', { fill: s === ' · ' ? ROSE : INK, 'font-weight': s === 'KLEMPT' ? 600 : 400 }, sylT);
    ts.textContent = s;
    return ts;
  });
  G.sylT = [seg('w2', 1), seg('w2', 2)];
  G.sylT.forEach(t => sfx(t, 'tick', .6));
  G.posT = at('w2', .78); sfx(G.posT, 'pop', .8);

  /* definition */
  const defWords = 'overcome with emotion; choked up.'.split(' ');
  const dwt = wordTimes('d1');
  const spokenIdx = [2, 3, 4, 8, 9];
  G.def = defWords.map((w, i) => {
    const sp = document.createElement('span');
    sp.textContent = w;
    $('defText').appendChild(sp);
    $('defText').appendChild(document.createTextNode(' '));
    return { el: sp, t: dwt[spokenIdx[i]] - .05, ul: i === 0 || i >= 3 };
  });
  G.def.forEach((d, i) => {
    if (!d.ul) return;
    const r = d.el.getBoundingClientRect();
    d.line = svgEl('line', { x1: r.left, y1: r.bottom + 2, x2: r.left, y2: r.bottom + 2, stroke: ROSE, 'stroke-width': 7, 'stroke-linecap': 'round' }, $('defSvg'));
    d.x1 = r.left - (i === 4 ? 20 : 0); d.x2 = r.right - (/[.;]$/.test(d.el.textContent) ? 26 : 0);
  });
  const d2s = TL.d2.seg;
  const EMO = [
    ['sadness', 1, d2s[0][0] + (d2s[0][1] - d2s[0][0]) * .72, true],
    ['joy', 1, d2s[1][0]],
    ['pride', 1, d2s[2][0]],
    ['nostalgia', 2, lerp(d2s[2][0], d2s[2][1], .3)],
    ['gratitude', 2, lerp(d2s[2][0], d2s[2][1], .66)],
  ];
  G.emo = EMO.map(([txt, row, t, sad]) => {
    const el = document.createElement('div');
    el.className = 'emo' + (sad ? ' sad' : '');
    el.textContent = txt;
    $('emoRow' + row).appendChild(el);
    sfx(t, 'pop', .75);
    return { el, t };
  });
  G.defClamp = makeClamp($('heartClamp'));
  G.defClampIn = d2s[3][0] - .1;
  G.squeezeD = lerp(d2s[3][0], d2s[3][1], .62);
  sfx(G.squeezeD, 'ratchet');

  /* etymology */
  G.etyClamp = makeClamp($('etyClamp'));
  G.e1Squeeze = at('e1', .25); sfx(G.e1Squeeze, 'ratchet', .8);
  G.clampMove = S('e2') - .2;
  const kl = (pre, root, post) => `${pre}<b>${root}</b>${post}`;
  const NODES = [
    { k: 'GERMAN', w: kl('', 'klemm', 'en'), g: '“to pinch, to clamp”', t: S('e2'), gt: seg('e2', 1) + .2 },
    { k: 'GERMAN', w: kl('ver', 'klemm', 'en'), g: '“to jam something tight”', t: S('e3'), gt: at('e3', .45) },
    { k: 'GERMAN', w: kl('ver', 'klemm', 't'), g: '“jammed, squeezed”', t: S('e4'), gt: at('e4', .55) },
    { k: 'YIDDISH', w: kl('far', 'klem', 't') + '<span class="heb">פֿאַרקלעמט</span>', g: '“choked with emotion”', t: S('e5'), wt: at('e5', .27), gt: seg('e5', 1) },
    { k: 'AMERICAN ENGLISH', w: kl('ver', 'klemp', 't'), g: '“overcome with emotion”', t: at('e6', .55) },
  ];
  G.nodes = NODES.map((n, i) => {
    const top = 440 + i * 192;
    const div = document.createElement('div');
    div.className = 'node';
    div.style.top = top + 'px';
    div.innerHTML = `<div class="k">${n.k}</div><div class="w"${i === 4 ? ' style="color:#D2435B"' : ''}>${n.w}</div><div class="g">${n.g}</div>`;
    if (i === 4) div.querySelector('.w b').style.color = INK;
    $('etyNodes').appendChild(div);
    const dot = svgEl('circle', { cx: 160, cy: top + 76, r: 0, fill: ROSE }, $('etyDots'));
    sfx(n.t, 'pop', .8);
    return { ...n, div, dot, y: top + 76, wt: n.wt ?? n.t + .1, gt: n.gt ?? n.t + .5, kEl: div.querySelector('.k'), wEl: div.querySelector('.w'), gEl: div.querySelector('.g') };
  });
  G.heartT = seg('e5', 2) + .5; sfx(G.heartT, 'ratchet', .8);
  G.arcT = S('e6') + .1; sfx(G.arcT, 'whoosh', .6);
  const y3 = G.nodes[3].y, y4 = G.nodes[4].y;
  $('etyArc').setAttribute('d', `M160 ${y3} C 40 ${y3 + 40} 40 ${y4 - 40} 160 ${y4}`);
  G.arcLen = $('etyArc').getTotalLength();

  /* false friend */
  G.ff1 = makeFace($('ffFace1'));
  G.ff2 = makeFace($('ffFace2'));
  $('ffFace1').setAttribute('transform', 'scale(.62)');
  $('ffFace2').setAttribute('transform', 'scale(.62)');
  G.ff1T = at('g1', .2); sfx(G.ff1T, 'whoosh', .6);
  G.ff2T = S('g2'); sfx(G.ff2T, 'whoosh', .6);
  G.upT = seg('g2', 1) + 1.0; sfx(G.upT, 'tick', .7);
  G.inhT = seg('g2', 2) + .2; sfx(G.inhT, 'tick', .7);
  G.notTearT = seg('g2', 3); sfx(G.notTearT + .45, 'pop', .6);
  G.tenseT = seg('g2', 4) + .15; sfx(G.tenseT, 'thud', .8);

  /* television */
  buildTV();
  G.tvOnT = S('p1') + .2; sfx(G.tvOnT, 'tvon', .8);
  G.titleT = at('p1', .55);
  G.subT = S('p2') + .1;
  G.fanT = seg('p2', 1) + .2;
  G.q1T = S('p3') - .05; sfx(G.q1T, 'pop', .8);
  G.q2T = seg('p3', 2) - .05; sfx(G.q2T, 'pop');

  /* examples: karaoke sentences */
  G.sent = ['x1', 'x2', 'x3'].map((id, i) => {
    const el = document.querySelector(`#ex${i + 1} .sent`);
    const wt = wordTimes(id);
    const words = [];
    const walk = node => {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const sp = document.createElement('span');
            sp.textContent = part;
            words.push(sp);
            frag.appendChild(sp);
          });
          node.replaceChild(frag, ch);
        } else walk(ch);
      }
    };
    walk(el);
    return words.map((sp, k) => ({ sp, t: wt[k] - .05, em: sp.parentElement.tagName === 'EM' }));
  });
  buildExamples();
  sfx(S('x0') + .05, 'pop');

  /* similar */
  const s1s = TL.s1.seg;
  G.synT = [s1s[1][0], s1s[2][0], lerp(s1s[2][0], s1s[2][1], .55)];
  G.synT.forEach(t => sfx(t, 'pop', .8));
  G.bigT = S('s2') + .15; sfx(G.bigT, 'thump', .7);
  G.warmT = TL.s2.seg[0][1] - .45; sfx(G.warmT, 'bubble', .7);
  G.humorT = TL.s2.seg[1][0]; sfx(G.humorT, 'bubble', .8);
  G.synHearts = [0, 1, 2, 3, 4].map(() => svgEl('path', { d: HEART, fill: ROSE, opacity: 0 }, $('synHearts')));

  /* outro */
  G.outFace = makeFace($('outFig'), { body: true });
  G.outHand = makeHand($('outFig'));
  G.outFanT = S('o2') + .2; sfx(G.outFanT, 'swipe', .7); sfx(G.outFanT + .32, 'swipe', .6); sfx(G.outFanT + .64, 'swipe', .5);
  G.endT = S('o3') - .55;
  G.endRelease = S('o3') + .02; sfx(G.endRelease, 'snap', .8);
  sfx(S('o3') + 1, 'chime');

  SCENES.slice(1).forEach(s => sfx(s.a, 'whoosh', .35));
  window.SFX.sort((a, b) => a.t - b.t);
  buildCaptions();
  return { total: TOTAL };
};

function buildTV() {
  const g = $('tvSet');
  g.setAttribute('transform', 'translate(540 680)');
  svgEl('line', { x1: -20, y1: -228, x2: -110, y2: -296, stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
  svgEl('line', { x1: 20, y1: -228, x2: 120, y2: -290, stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
  svgEl('circle', { cx: -110, cy: -296, r: 10, fill: ROSE }, g);
  svgEl('circle', { cx: 120, cy: -290, r: 10, fill: ROSE }, g);
  svgEl('path', { d: 'M-210 228 L-235 268 M210 228 L235 268', stroke: INK, 'stroke-width': 12, 'stroke-linecap': 'round' }, g);
  svgEl('rect', { x: -320, y: -232, width: 640, height: 464, rx: 46, fill: '#E3D2BE', stroke: INK, 'stroke-width': 10 }, g);
  const clip = svgEl('clipPath', { id: 'scr' }, g);
  svgEl('rect', { x: -282, y: -196, width: 440, height: 392, rx: 54 }, clip);
  const scr = svgEl('g', { 'clip-path': 'url(#scr)' }, g);
  G.scrBg = svgEl('rect', { x: -282, y: -196, width: 440, height: 392, fill: '#2A2326' }, scr);
  G.scrShow = svgEl('g', { opacity: 0 }, scr);
  const sh = G.scrShow;
  svgEl('rect', { x: -282, y: -196, width: 440, height: 392, fill: '#F2D9C4' }, sh);
  // backdrop: a window and a wall stripe, couch, coffee table
  svgEl('rect', { x: -282, y: 40, width: 440, height: 160, fill: '#E7B9A6' }, sh);
  svgEl('rect', { x: 20, y: -150, width: 110, height: 120, rx: 8, fill: '#BFD6E6', stroke: '#7E6A5C', 'stroke-width': 6 }, sh);
  svgEl('line', { x1: 75, y1: -150, x2: 75, y2: -30, stroke: '#7E6A5C', 'stroke-width': 5 }, sh);
  // host
  const host = svgEl('g', { transform: 'translate(-110 30)' }, sh);
  svgEl('path', { d: 'M-120 180 Q-110 70 0 62 Q110 70 120 180 Z', fill: '#9C5B7A', stroke: INK, 'stroke-width': 6 }, host);
  svgEl('ellipse', { cx: 0, cy: -48, rx: 92, ry: 84, fill: '#5A3C2E' }, host);
  svgEl('circle', { cx: 0, cy: -20, r: 60, fill: '#F4DCC8', stroke: INK, 'stroke-width': 6 }, host);
  svgEl('path', { d: 'M-62 -40 Q-50 -100 0 -96 Q50 -100 62 -40 Q30 -70 -62 -40 Z', fill: '#5A3C2E' }, host);
  svgEl('circle', { cx: -40, cy: 24, r: 9, fill: '#F2C94C', stroke: INK, 'stroke-width': 3 }, host);
  svgEl('circle', { cx: 40, cy: 24, r: 9, fill: '#F2C94C', stroke: INK, 'stroke-width': 3 }, host);
  G.hostEyes = [-1, 1].map(s => svgEl('path', { d: `M${s * 22 - 10} -22 Q${s * 22} -30 ${s * 22 + 10} -22`, fill: 'none', stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' }, host));
  svgEl('path', { d: 'M-14 8 Q0 18 14 8', fill: 'none', stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' }, host);
  G.hostHand = svgEl('g', {}, host);
  makeHand(G.hostHand);
  // mug with steam
  const mug = svgEl('g', { transform: 'translate(70 140)' }, sh);
  svgEl('rect', { x: -32, y: -40, width: 64, height: 66, rx: 10, fill: CARD, stroke: INK, 'stroke-width': 6 }, mug);
  svgEl('path', { d: 'M32 -26 Q58 -20 32 8', fill: 'none', stroke: INK, 'stroke-width': 6 }, mug);
  G.steam = [-12, 10].map(x => svgEl('path', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: .8 }, mug));
  G.steamX = [-12, 10];
  // CRT overlay
  G.scan = svgEl('g', { opacity: .12 }, scr);
  for (let y = -196; y < 200; y += 8) svgEl('rect', { x: -282, y, width: 440, height: 3, fill: '#000' }, G.scan);
  G.crt = svgEl('rect', { x: -282, y: -4, width: 440, height: 8, fill: '#FFFFFF', opacity: 0 }, scr);
  svgEl('rect', { x: -282, y: -196, width: 440, height: 392, rx: 54, fill: 'none', stroke: INK, 'stroke-width': 8 }, g);
  // knobs and speaker
  G.knob = svgEl('g', { transform: 'translate(242 -120)' }, g);
  svgEl('circle', { r: 30, fill: CARD, stroke: INK, 'stroke-width': 7 }, G.knob);
  svgEl('line', { x1: 0, y1: 0, x2: 0, y2: -22, stroke: ROSE, 'stroke-width': 7, 'stroke-linecap': 'round' }, G.knob);
  svgEl('circle', { cx: 242, cy: -30, r: 22, fill: CARD, stroke: INK, 'stroke-width': 7 }, g);
  for (let k = 0; k < 5; k++) svgEl('line', { x1: 212, y1: 40 + k * 28, x2: 272, y2: 40 + k * 28, stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
}

function buildExamples() {
  // 1: the father of the bride, glass raised
  const s1 = $('ex1Svg');
  G.dad = svgEl('g', {}, s1);
  G.dadFace = makeFace(G.dad, { bow: true });
  G.glass = svgEl('g', {}, s1);
  svgEl('path', { d: 'M-42 -150 L42 -150 L30 -20 Q0 8 -30 -20 Z', fill: '#F3DC93', stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round' }, G.glass);
  svgEl('path', { d: 'M-40 -132 L40 -132', stroke: CARD, 'stroke-width': 6, opacity: .8 }, G.glass);
  svgEl('line', { x1: 0, y1: -6, x2: 0, y2: 110, stroke: INK, 'stroke-width': 8 }, G.glass);
  svgEl('ellipse', { cx: 0, cy: 112, rx: 46, ry: 11, fill: CARD, stroke: INK, 'stroke-width': 7 }, G.glass);
  G.fizz = [0, 1, 2, 3, 4, 5].map(i => svgEl('circle', { r: 5, fill: CARD, opacity: .9 }, G.glass));
  G.toastT = S('x1') + .4; sfx(G.toastT, 'bubble', .6);
  G.chokeT = wordTimes('x1')[11] - .1; sfx(G.chokeT, 'ratchet', .7);
  G.clinkT = S('x1') + .1; sfx(G.clinkT + .5, 'tick', .7);

  // 2: movie screen, popcorn and a tissue box
  const s2 = $('ex2Svg');
  svgEl('rect', { x: 210, y: 440, width: 660, height: 330, rx: 12, fill: '#2A2326' }, s2);
  G.endCard = svgEl('text', { x: 540, y: 630, 'text-anchor': 'middle', 'font-family': 'Fraunces', 'font-style': 'italic', 'font-weight': 600, 'font-size': 84, fill: CARD, opacity: 0 }, s2);
  G.endCard.textContent = 'The End';
  G.curtL = svgEl('path', { fill: ROSE, stroke: INK, 'stroke-width': 6 }, s2);
  G.curtR = svgEl('path', { fill: ROSE, stroke: INK, 'stroke-width': 6 }, s2);
  const pop = svgEl('g', { transform: 'translate(330 900)' }, s2);
  [[-46, -70], [-12, -84], [24, -76], [52, -64], [-30, -96], [8, -104], [38, -92]].forEach(([x, y]) =>
    svgEl('circle', { cx: x, cy: y + 12, r: 26, fill: '#FFF4D6', stroke: INK, 'stroke-width': 5 }, pop));
  svgEl('path', { d: 'M-80 -60 L80 -60 L62 90 L-62 90 Z', fill: CARD, stroke: INK, 'stroke-width': 7, 'stroke-linejoin': 'round' }, pop);
  [-46, 0, 46].map(x => svgEl('path', { d: `M${x - 14} -60 L${x + 14} -60 L${x * .78 + 11} 90 L${x * .78 - 11} 90 Z`, fill: ROSE }, pop));
  G.tissues = [0, 1, 2].map(() => svgEl('path', { d: 'M-34 -10 Q-20 -60 0 -40 Q20 -70 34 -14 Q10 -24 0 -8 Q-12 -22 -34 -10 Z', fill: '#FFFFFF', stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round', opacity: 0 }, s2));
  const box = svgEl('g', { transform: 'translate(730 920)' }, s2);
  svgEl('rect', { x: -110, y: -60, width: 220, height: 120, rx: 10, fill: '#BFD6E6', stroke: INK, 'stroke-width': 7 }, box);
  svgEl('rect', { x: -50, y: -66, width: 100, height: 16, rx: 8, fill: INK }, box);
  G.puff = svgEl('path', { d: 'M-30 -60 Q-14 -100 0 -84 Q16 -104 30 -60 Z', fill: '#FFFFFF', stroke: INK, 'stroke-width': 5, 'stroke-linejoin': 'round' }, box);
  G.tally = svgEl('text', { x: 860, y: 830, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono', 'font-weight': 600, 'font-size': 46, fill: ROSE }, s2);
  const x2s = TL.x2.seg;
  G.endCardT = at('x2', .3); sfx(G.endCardT, 'swipe', .6);
  G.tissueT = [x2s[1][0], x2s[2][0], lerp(x2s[2][0], x2s[2][1], .55)];
  G.tissueT.forEach(t => sfx(t, 'pop', .7));

  // 3: shelter dog
  const s3 = $('ex3Svg');
  G.dog = svgEl('g', {}, s3);
  const d = G.dog;
  G.ears = [-1, 1].map(s => svgEl('ellipse', { cx: s * 138, cy: -20, rx: 52, ry: 104, fill: '#9C6B45', stroke: INK, 'stroke-width': 8 }, d));
  svgEl('ellipse', { cx: 0, cy: 0, rx: 150, ry: 140, fill: '#E2BF94', stroke: INK, 'stroke-width': 8 }, d);
  svgEl('ellipse', { cx: 0, cy: 70, rx: 80, ry: 58, fill: '#F2DFC5' }, d);
  svgEl('ellipse', { cx: -58, cy: -50, rx: 34, ry: 26, fill: '#C79A6C' }, d);
  G.dogEyes = [-1, 1].map(s => svgEl('ellipse', { cx: s * 54, cy: -30, rx: 15, ry: 19, fill: INK }, d));
  svgEl('ellipse', { cx: 0, cy: 34, rx: 26, ry: 18, fill: INK }, d);
  svgEl('path', { d: 'M0 52 L0 74 M-34 76 Q-16 96 0 74 Q16 96 34 76', fill: 'none', stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round' }, d);
  G.tongue = svgEl('path', { d: 'M-16 86 Q-16 126 0 126 Q16 126 16 86 Z', fill: ROSE, stroke: INK, 'stroke-width': 5 }, d);
  svgEl('path', { d: 'M-104 120 Q0 160 104 120', fill: 'none', stroke: ROSE, 'stroke-width': 18, 'stroke-linecap': 'round' }, d);
  G.tag = svgEl('path', { d: HEART, fill: '#F2C94C', stroke: INK, 'stroke-width': 9, transform: 'translate(0 170) scale(.32)' }, d);
  G.stamp = svgEl('g', {}, s3);
  svgEl('rect', { x: -170, y: -50, width: 340, height: 100, rx: 10, fill: 'none', stroke: ROSE, 'stroke-width': 8 }, G.stamp);
  const st = svgEl('text', { x: 0, y: 22, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono', 'font-weight': 600, 'font-size': 60, fill: ROSE, 'letter-spacing': 10 }, G.stamp);
  st.textContent = 'ADOPTED';
  G.dogHearts = [0, 1, 2, 3, 4, 5].map(() => svgEl('path', { d: HEART, fill: ROSE, stroke: INK, 'stroke-width': 8, opacity: 0 }, s3));
  const xw = wordTimes('x3');
  G.stampT = xw[6] + .1; sfx(G.stampT + .15, 'thump', .9);
  G.dogHeartT = xw[xw.length - 1] - .3; sfx(G.dogHeartT, 'chime', .35);
}

/* ----------------------------------------------------------------- render */
function sceneVis(t, sc) {
  const fi = sc.a <= 0 ? 1 : fadeIn(t, sc.a, .4);
  const fo = ease.out(P(t, sc.b - .3, .3));
  return { o: fi * (1 - fo), y: 40 * (1 - fi) - 30 * fo };
}

window.render = function (t) {
  $('grid').style.backgroundPositionY = (30 + t * 8) + 'px';
  const vis = {};
  SCENES.forEach(sc => {
    const v = sceneVis(t, sc);
    vis[sc.id] = v.o;
    const el = $(sc.id);
    el.style.display = v.o > 0.001 ? 'block' : 'none';
    css(el, { y: v.y, o: v.o });
  });
  const cur = SCENES.reduce((acc, sc, i) => (t >= sc.a ? i : acc), 0);
  [...$('dots').children].forEach((d, i) => {
    d.style.background = i === cur ? ROSE : i < cur ? INK : '#DCD0C2';
    d.style.transform = `scale(${i === cur ? 1.35 : 1})`;
  });
  renderCaption(t);
  if (vis['sc-hook']) hook(t);
  if (vis['sc-word']) word(t);
  if (vis['sc-def']) def(t);
  if (vis['sc-ety']) ety(t);
  if (vis['sc-ff']) ff(t);
  if (vis['sc-tv']) tv(t);
  if (vis['sc-ex']) ex(t);
  if (vis['sc-syn']) syn(t);
  if (vis['sc-out']) out(t);
};

function hook(t) {
  const enter = popIn(t, S('h1') - .3, .6);
  const exit = ease.inout(P(t, S('h5') + .1, .9));
  const breathe = Math.sin(t * 2.2) * 4;
  svgT($('hookFig'), { x: 540, y: 800 + breathe + 60 * exit, s: Math.max(0, lerp(.6, 1.05, enter)) * (1 - .15 * exit), o: clamp(enter * 2) * (1 - .75 * exit) });
  const moved = fadeIn(t, G.wellT - .3, .6);
  const tight = fadeIn(t, G.lumpT, .5);
  const words = P(t, G.squeezeT, .5);
  const cry = t >= G.dropT ? (t - G.dropT) / 1.3 : -1;
  setFace(G.hookFace, t, {
    brow: 18 * moved, smile: lerp(14, -10, tight), wobble: 5 * fadeIn(t, G.sayT, .4),
    well: moved, blush: tight, blink: blinkAt(t, [1.5, 4.1]), cry: cry < 1 ? cry : -1,
  });
  // the lump in the throat, with pulsing rings
  const lr = popIn(t, G.lumpT, .5);
  G.hookFace.lump.setAttribute('r', Math.max(0, 32 * lr * (1 + .08 * Math.sin(t * 9))));
  const s = lerp(.6, 1.05, clamp(enter)) * (1 - .15 * exit);
  G.rings.forEach((r, i) => {
    const ph = t < G.lumpT ? -1 : ((t - G.lumpT) / 1.1 + i / 3) % 1;
    r.setAttribute('cx', 540); r.setAttribute('cy', 800 + breathe + 60 * exit + 250 * s);
    r.setAttribute('r', ph < 0 ? 0 : (34 + 80 * ph) * s);
    r.setAttribute('opacity', ph < 0 ? 0 : (1 - ph) * .8 * (1 - exit));
  });
  // the speech bubble gets squeezed shut
  const sp = popIn(t, G.sayT, .45);
  const n = Math.floor(clamp((t - G.sayT - .1) / 1.0) * G.sayStr.length);
  $('sayTxt').textContent = t < G.squeezeT + .25 ? G.sayStr.slice(0, n) : '…';
  const sq = ease.inout(words);
  const gone = ease.back(P(t, G.sayGoneT, .35));
  const shake = words > 0 && words < 1 ? Math.sin(t * 70) * 4 : 0;
  css($('say'), { x: shake, s: Math.max(0, sp) * (1 - gone), sx: Math.max(0, sp) * lerp(1, .32, sq) * (1 - gone), sy: Math.max(0, sp) * lerp(1, .85, sq) * (1 - gone), o: clamp(sp * 2) });
}

function word(t) {
  const rel = ease.spring(P(t, G.releaseT, .9));
  const squeezed = .42;
  const sx = lerp(squeezed, 1, rel);
  const wp = fadeIn(t, S('w1') - .35, .3);
  svgT($('wordG'), { x: 540, y: 0, sx, sy: lerp(1.12, 1, rel) });
  $('wordT').setAttribute('x', 0);
  $('wordT').setAttribute('opacity', wp);
  // clamp jaws press in, then fly apart on release
  const half = G.wordW * squeezed / 2 + 26;
  const fly = ease.out(P(t, G.releaseT, .5));
  const press = fadeIn(t, S('w1') - .35, .3);
  const jl = 540 - half - 40 - 600 * fly - 160 * (1 - press), jr = 540 + half + 600 * fly + 160 * (1 - press);
  $('jawL').setAttribute('x', jl);
  $('jawR').setAttribute('x', jr);
  const sp = fadeIn(t, S('w2') - .1, .35);
  $('sylG').setAttribute('opacity', sp);
  $('sylG').setAttribute('transform', `translate(0 ${16 * (1 - sp)})`);
  const active = t >= G.sylT[1] ? 2 : t >= G.sylT[0] ? 0 : -1;
  const lit = t < at('w2', .7);
  G.syl.forEach((ts, i) => {
    if (i === 1) return;
    ts.setAttribute('fill', active === i && lit ? ROSE : INK);
  });
  const pp = popIn(t, G.posT, .45);
  css($('pos'), { pre: 'translateX(-50%) ', s: Math.max(0, lerp(.6, 1, pp)), o: clamp(pp * 2) });
}

function def(t) {
  G.def.forEach(d => {
    const p = fadeIn(t, d.t, .3);
    css(d.el, { y: 18 * (1 - p), o: p });
    if (d.line) {
      const lp = ease.inout(P(t, d.t + .1, .35));
      d.line.setAttribute('x2', lerp(d.x1, d.x2, lp));
      d.line.setAttribute('x1', d.x1);
      d.line.setAttribute('opacity', lp > 0 ? 1 : 0);
    }
  });
  G.emo.forEach((e, i) => {
    const p = popIn(t, e.t, .45);
    const bob = Math.sin(t * 2.4 + i) * 4;
    css(e.el, { y: bob + 20 * (1 - clamp(p)), s: Math.max(0, lerp(.4, 1, p)), o: clamp(p * 2) });
  });
  // a heart caught in a clamp
  const ci = popIn(t, G.defClampIn, .5);
  const sq = ease.inout(P(t, G.squeezeD - .25, .45));
  const tremble = sq > .9 ? Math.sin(t * 60) * 1.5 : 0;
  svgT(G.defClamp.g, { x: 460 + tremble, y: 1255, s: .78 * Math.max(0, lerp(.5, 1, ci)), o: clamp(ci * 2) });
  setClamp(G.defClamp, lerp(.15, 1, sq), sq > .9 ? Math.max(0, Math.sin(t * 7)) : 0);
}

function ety(t) {
  // the clamp squeezes centre-stage, then retires to the corner
  const mv = ease.inout(P(t, G.clampMove, .7));
  const ci = popIn(t, S('e1') - .1, .5);
  svgT(G.etyClamp.g, { x: lerp(460, 860, mv), y: lerp(880, 570, mv), s: Math.max(0, lerp(1.25, .68, mv) * lerp(.5, 1, ci)), o: clamp(ci * 2) });
  const s1 = ease.inout(P(t, G.e1Squeeze, .5)), rel = ease.inout(P(t, G.clampMove, .5));
  const s2 = ease.inout(P(t, G.heartT - .25, .5)), rel2 = ease.inout(P(t, S('e6') + .6, .5));
  const nodeNudge = G.nodes.slice(0, 3).reduce((m, n) => m + .25 * Math.exp(-Math.max(0, t - n.t) * 4) * (t >= n.t ? 1 : 0), 0);
  setClamp(G.etyClamp, clamp(.85 * s1 - .7 * rel + .2 * rel + nodeNudge + .8 * s2 - .6 * rel2), s2 > .9 && rel2 < .1 ? Math.max(0, Math.sin(t * 8)) : 0);

  let lineEnd = G.nodes[0].y;
  G.nodes.forEach((n, i) => {
    n.dot.setAttribute('r', Math.max(0, 15 * popIn(t, n.t, .4)));
    const next = G.nodes[i + 1];
    const passed = next && t >= next.t;
    n.dot.setAttribute('fill', passed ? INK : ROSE);
    const kp = fadeIn(t, n.t, .3), wp = fadeIn(t, n.wt, .35), gp = fadeIn(t, n.gt, .35);
    css(n.kEl, { o: kp });
    css(n.wEl, { x: 24 * (1 - wp), o: wp });
    css(n.gEl, { y: 10 * (1 - gp), o: gp });
    n.div.style.opacity = passed && i < 3 ? lerp(1, .5, fadeIn(t, next.t, .4)) : 1;
    if (i > 0 && i < 4) lineEnd = lerp(lineEnd, n.y, ease.inout(P(t, n.t - .45, .45)));
  });
  $('etyLine').setAttribute('y1', G.nodes[0].y);
  $('etyLine').setAttribute('y2', lineEnd);
  $('etyLine').setAttribute('opacity', t >= G.nodes[0].t ? 1 : 0);
  // the crossing to America
  const ap = ease.inout(P(t, G.arcT, .9));
  $('etyArc').setAttribute('stroke-dasharray', `14 12`);
  $('etyArc').style.clipPath = '';
  $('etyArc').setAttribute('opacity', ap > 0 ? 1 : 0);
  $('etyArc').setAttribute('stroke-dashoffset', -t * 30);
  $('etyArc').style.strokeDasharray = ap < 1 ? `${G.arcLen * ap} ${G.arcLen}` : '14 12';
}

function ff(t) {
  const p1 = ease.out(P(t, G.ff1T, .5)), p2 = ease.out(P(t, G.ff2T, .5));
  css($('ff1'), { x: -220 * (1 - p1), o: p1 });
  const tense = P(t, G.tenseT, .3);
  const shake = tense > 0 ? Math.sin(t * 55) * 5 * (1 - P(t, G.tenseT + .9, .4)) : 0;
  css($('ff2'), { x: 220 * (1 - p2) + shake, o: p2 });
  const nq = popIn(t, G.ff2T + .3, .45);
  $('neq').setAttribute('transform', `translate(540 890) scale(${Math.max(0, nq)}) translate(-540 -890)`);
  $('neq').setAttribute('opacity', clamp(nq * 2));
  const cyc = ((t - G.ff1T) % 2.6) / 1.5;
  setFace(G.ff1, t, { brow: 18, smile: 16, wobble: 4, well: 1, blush: 1, cry: cyc < 1 && t > G.ff1T + .4 ? cyc : -1, blink: blinkAt(t, [S('g2') + 1.7]) });
  // the German face: a tear starts, gets suppressed, the face tenses up
  const tearIn = fadeIn(t, G.notTearT - .1, .25) * (1 - ease.back(P(t, G.notTearT + .45, .3)));
  setFace(G.ff2, t, { brow: -16 - 6 * tense, browY: -80, smile: -2, well: Math.max(0, tearIn), sweat: fadeIn(t, G.tenseT, .3), blink: blinkAt(t, [S('g2') + 1.2]) });
  css($('gUp'), { o: fadeIn(t, G.upT, .3) });
  css($('gInh'), { o: fadeIn(t, G.inhT, .3) });
  const tp = popIn(t, G.tenseT, .4);
  $('gTense').style.display = 'inline-block';
  css($('gTense'), { s: Math.max(0, tp), o: clamp(tp * 2) });
}

function tv(t) {
  const ti = popIn(t, S('p1') - .2, .5);
  $('tvSet').setAttribute('transform', `translate(540 ${680 + 30 * (1 - clamp(ti))}) scale(${Math.max(0, lerp(.8, 1, ti))})`);
  // CRT switch-on: a bright line opens into the picture
  const on = P(t, G.tvOnT, .45);
  const lineH = on < .4 ? 8 : lerp(8, 392, ease.out((on - .4) / .6));
  G.crt.setAttribute('height', lineH);
  G.crt.setAttribute('y', -lineH / 2);
  G.crt.setAttribute('opacity', on > 0 ? (1 - ease.out(P(t, G.tvOnT + .3, .4))) : 0);
  G.scrShow.setAttribute('opacity', on >= .4 ? 1 : 0);
  G.scan.setAttribute('transform', `translate(0 ${(t * 40) % 8})`);
  G.knob.setAttribute('transform', `translate(242 -120) rotate(${-60 + 120 * ease.out(P(t, G.tvOnT - .3, .4))})`);
  // the host fans her face
  const fa = fanAngle(t, G.fanT, 2.6);
  const handUp = ease.out(P(t, G.fanT - .3, .4));
  G.hostHand.setAttribute('transform', `translate(${lerp(100, 92, handUp)} ${lerp(200, 40, handUp)}) rotate(${fa - 10}) scale(.5)`);
  G.hostHand.setAttribute('opacity', clamp(handUp * 3));
  G.hostEyes.forEach((e, i) => e.setAttribute('transform', `translate(0 ${t >= G.fanT ? 4 * Math.abs(Math.sin(t * 3)) : 0})`));
  G.steam.forEach((p, i) => {
    const x = G.steamX[i], ph = t * 3 + i * 2;
    p.setAttribute('d', `M${x} -50 Q${x + 10 * Math.sin(ph)} -70 ${x} -88 Q${x - 10 * Math.sin(ph + 1)} -104 ${x} -120`);
  });
  css($('tvTitle'), { y: 14 * (1 - fadeIn(t, G.titleT, .4)), o: fadeIn(t, G.titleT, .4) });
  css($('tvSub'), { o: fadeIn(t, G.subT, .4) });
  const q1 = popIn(t, G.q1T, .45), q2 = popIn(t, G.q2T, .45);
  css($('q1'), { s: Math.max(0, lerp(.6, 1, q1)), o: clamp(q1 * 2) });
  css($('q2'), { s: Math.max(0, lerp(.6, 1, q2)), r: -3 * clamp(q2), o: clamp(q2 * 2) });
}

function ex(t) {
  const tp = popIn(t, S('x0'), .5), tOut = ease.inout(P(t, S('x1') - .5, .4));
  css($('exTitle'), { s: lerp(.8, 1, tp) * (1 - .2 * tOut), y: -120 * tOut, o: clamp(tp * 2) * (1 - tOut) });
  css($('exLabel'), { o: fadeIn(t, S('x0') + .15, .3) * (1 - tOut) });
  const win = [[S('x1') - .35, S('x2') - .2], [S('x2') - .35, S('x3') - .2], [S('x3') - .35, TOTAL]];
  win.forEach(([a, b], i) => {
    const el = $('ex' + (i + 1));
    const pi = ease.out(P(t, a, .45)), po = ease.inout(P(t, b - .3, .3));
    el.style.display = pi > 0 && po < 1 ? 'block' : 'none';
    css(el, { x: 140 * (1 - pi) - 140 * po, o: pi * (1 - po) });
    G.sent[i].forEach(w => {
      const on = t >= w.t;
      w.sp.style.color = on ? (w.em ? ROSE : INK) : '#C3B8AC';
    });
  });

  // 1: the toast that never finishes
  const choke = fadeIn(t, G.chokeT, .4);
  svgT(G.dad, { x: 690, y: 730, s: .62 });
  const cry = t >= G.chokeT + .2 ? ((t - G.chokeT - .2) % 1.6) / 1.3 : -1;
  setFace(G.dadFace, t, { brow: 20 * choke, smile: lerp(18, -4, choke), wobble: 5 * choke, well: choke, blush: choke, cry: cry < 1 ? cry : -1, blink: blinkAt(t, [S('x1') + .9]) });
  const raise = ease.out(P(t, G.clinkT, .6));
  const tremble = choke * Math.sin(t * 40) * 2.5;
  svgT(G.glass, { x: 360 + tremble, y: lerp(900, 770, raise), r: lerp(0, -12, raise) });
  G.fizz.forEach((b, i) => {
    const ph = (t * .8 + hash(i)) % 1;
    b.setAttribute('cx', -18 + 36 * hash(i + 9) + 4 * Math.sin(t * 5 + i));
    b.setAttribute('cy', -30 - 100 * ph);
    b.setAttribute('opacity', .9 * (1 - ph));
  });
  const bp = popIn(t, G.toastT, .45);
  const n = Math.floor(clamp((t - G.toastT) / 1.1) * 16);
  $('toast').textContent = t < G.chokeT + .3 ? 'To my little gi—'.slice(0, Math.max(1, n)) : '…';
  const sq = ease.inout(P(t, G.chokeT + .1, .4));
  $('toast').style.transformOrigin = '0% 100%';
  css($('toast'), { x: choke > 0 && choke < 1 ? Math.sin(t * 60) * 4 : 0, sx: Math.max(0, bp) * lerp(1, .75, sq), sy: Math.max(0, bp), o: clamp(bp * 2) });

  // 2: The End, and a tissue for every word
  const ec = fadeIn(t, G.endCardT, .6);
  G.endCard.setAttribute('opacity', ec);
  const open = ease.inout(P(t, S('x2') - .2, .8)) * (1 - ease.inout(P(t, G.endCardT + 1.2, .9)) * .3);
  const cw = lerp(330, 40, open);
  G.curtL.setAttribute('d', `M210 440 L${210 + cw} 440 Q${200 + cw * .7} 610 ${210 + cw * .9} 770 L210 770 Z`);
  G.curtR.setAttribute('d', `M870 440 L${870 - cw} 440 Q${880 - cw * .7} 610 ${870 - cw * .9} 770 L870 770 Z`);
  let count = 0;
  G.tissues.forEach((tis, i) => {
    const p = P(t, G.tissueT[i], 1.4);
    if (t >= G.tissueT[i]) count = i + 1;
    const fly = ease.out(p);
    tis.setAttribute('transform', `translate(${730 + (i - 1) * 110 * fly + 20 * Math.sin(t * 4 + i)} ${850 - 300 * fly}) rotate(${(i - 1) * 25 * fly + 10 * Math.sin(t * 3 + i)})`);
    tis.setAttribute('opacity', p > 0 ? 1 - P(t, G.tissueT[i] + 1.1, .3) : 0);
  });
  G.tally.textContent = count ? '×' + count : '';
  const tp2 = count ? popIn(t, G.tissueT[count - 1], .3) : 0;
  G.tally.setAttribute('transform', `translate(860 830) scale(${Math.max(0, tp2)}) translate(-860 -830)`);

  // 3: the dog gets adopted
  const wag = Math.sin(t * 6);
  const happy = fadeIn(t, G.stampT, .4);
  svgT(G.dog, { x: 540, y: 690 + 6 * Math.abs(Math.sin(t * 6)) * happy, r: 4 * wag * happy, s: .95 });
  G.ears.forEach((e, i) => e.setAttribute('transform', `rotate(${(i ? 1 : -1) * (8 + 10 * happy * Math.sin(t * 9 + i))} ${(i ? 1 : -1) * 138} -100)`));
  G.tongue.setAttribute('opacity', happy);
  G.dogEyes.forEach(e => e.setAttribute('ry', 19 * (1 - .9 * blinkAt(t, [S('x3') + .7, S('x3') + 3.1]))));
  const sp = P(t, G.stampT, .25);
  G.stamp.setAttribute('transform', `translate(540 940) rotate(-8) scale(${lerp(1.8, 1, ease.out(sp))})`);
  G.stamp.setAttribute('opacity', sp > 0 ? clamp(sp * 3) : 0);
  G.dogHearts.forEach((h, i) => {
    const p = P(t, G.dogHeartT + i * .12, 1.6);
    const x = 540 + (i - 2.5) * 110 + 20 * Math.sin(t * 3 + i);
    h.setAttribute('transform', `translate(${x} ${820 - 330 * ease.out(p)}) scale(${.32 + .1 * hash(i)})`);
    h.setAttribute('opacity', p > 0 ? 1 - p * p : 0);
  });
}

function syn(t) {
  ['c1', 'c2', 'c3'].forEach((id, i) => {
    const p = popIn(t, G.synT[i], .45);
    css($(id), { s: Math.max(0, lerp(.5, 1, p)), o: clamp(p * 2) * lerp(1, .55, fadeIn(t, G.bigT - .3, .4)) });
  });
  css($('butLbl'), { o: fadeIn(t, G.bigT - .2, .3) });
  const bp = popIn(t, G.bigT, .5);
  const glow = fadeIn(t, G.warmT, .4);
  css($('cBig'), { s: Math.max(0, lerp(.5, 1, bp)) * (1 + .02 * glow * Math.sin(t * 5)), o: clamp(bp * 2) });
  const w = popIn(t, G.warmT, .4), h = popIn(t, G.humorT, .4);
  css($('p1'), { y: 20 * (1 - clamp(w)), s: Math.max(0, w), o: clamp(w * 2) });
  css($('p2'), { y: 20 * (1 - clamp(h)), s: Math.max(0, h), r: h > .5 ? 4 * Math.sin(t * 14) * (1 - P(t, G.humorT + .4, .6)) : 0, o: clamp(h * 2) });
  G.synHearts.forEach((hh, i) => {
    const p = ((t - G.warmT) / 2.2 + i / 5) % 1;
    const x = 290 + i * 130 + 16 * Math.sin(t * 2 + i);
    hh.setAttribute('transform', `translate(${x} ${1340 - 140 * p}) scale(.22)`);
    hh.setAttribute('opacity', t < G.warmT ? 0 : .7 * Math.sin(Math.PI * p));
  });
}

function out(t) {
  const ft = t - (S('o1') - .2);
  const fOut = ease.inout(P(t, G.endT, .5));
  const enter = popIn(t, S('o1') - .2, .6);
  svgT($('outFig'), { x: 540, y: 800 - 80 * fOut, s: Math.max(0, lerp(.7, .95, enter)) * (1 - .2 * fOut), o: clamp(enter * 2) * (1 - fOut) });
  const moved = fadeIn(t, S('o1') + .2, .6);
  const fan = fadeIn(t, G.outFanT - .3, .3);
  const cry = ((ft + .5) % 1.8) / 1.4;
  setFace(G.outFace, t, { brow: 18 * moved, smile: lerp(6, 16, fan), wobble: 4 * moved, well: moved, blush: moved, cry: moved > .9 && cry < 1 ? cry : -1, blink: blinkAt(t, [S('o1') + 1.3]) });
  G.outFace.lump.setAttribute('r', 26 * moved * (1 + .08 * Math.sin(t * 9)));
  const fa = fanAngle(t, G.outFanT, 3.1);
  G.outHand.setAttribute('transform', `translate(${lerp(320, 268, fan)} ${lerp(480, 40, fan)}) rotate(${fa - 14}) scale(.95)`);
  G.outHand.setAttribute('opacity', fan);
  // end card: the word is released from its clamp one last time
  const eIn = fadeIn(t, G.endT + .25, .5);
  $('endBlock').style.opacity = eIn;
  $('endBlock').style.transform = `translateY(${30 * (1 - eIn)}px)`;
  const rel = ease.spring(P(t, G.endRelease, .9));
  $('endT').setAttribute('transform', `translate(540 0) scale(${lerp(.42, 1, rel)} 1) translate(-540 0)`);
  css($('endDef'), { y: 12 * (1 - fadeIn(t, S('o3') + .5, .5)), o: fadeIn(t, S('o3') + .5, .5) });
  css($('endTag'), { o: fadeIn(t, S('o3') + 1, .5) });
}
