// Every visual is a pure function of time: render(t) sets the whole stage for second t.
const TL = window.TL.lines, TOTAL = window.TL.total;
const S = id => TL[id].start, E = id => TL[id].end, D = id => E(id) - S(id);
const at = (id, f) => S(id) + f * D(id);
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
const css = (el, { x = 0, y = 0, s = 1, r = 0, o, pre = '' } = {}) => {
  el.style.transform = `${pre}translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
  if (o !== undefined) el.style.opacity = o;
};
const svgT = (el, { x = 0, y = 0, r = 0, s = 1, o } = {}) => {
  el.setAttribute('transform', `translate(${x} ${y}) rotate(${r}) scale(${s})`);
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

window.SFX = [];
const sfx = (t, type, gain = 1) => window.SFX.push({ t: +t.toFixed(3), type, gain });

/* ------------------------------------------------------------------ scenes */
const SCENES = [
  { id: 'sc-hook', a: 0, b: S('w1') + .25 },
  { id: 'sc-word', a: S('w1') - .35, b: S('d1') - .2 },
  { id: 'sc-def', a: S('d1') - .2, b: S('e1') - .2 },
  { id: 'sc-ety', a: S('e1') - .2, b: S('f1') - .2 },
  { id: 'sc-fam', a: S('f1') - .2, b: S('x0') - .2 },
  { id: 'sc-ex', a: S('x0') - .2, b: S('s1') - .2 },
  { id: 'sc-syn', a: S('s1') - .2, b: S('o1') - .2 },
  { id: 'sc-out', a: S('o1') - .2, b: TOTAL + 5 },
];

/* ---------------------------------------------------------------- captions */
const NO_CAP = new Set(['w1', 'w2', 'o3', 'x1', 'x2', 'x3']);
const CAP_TEXT = {
  h4: 'The letter i… without its dot.',
  d2: 'A punctilious person follows the rules, the etiquette, and the fine print… exactly.',
  e5: 'In the 1590s, English borrowed it as punctilio, a tiny detail of conduct.',
  e6: 'And by the 1630s, someone devoted to those details was punctilious.',
};
let CAPS = [];
function buildCaptions() {
  for (const id in TL) {
    if (NO_CAP.has(id)) continue;
    const words = (CAP_TEXT[id] || TL[id].text).split(' ');
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
      CAPS.push({ a, b, html: txt.replace(/(punctili\w*)/gi, '<span class="k">$1</span>') });
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

/* -------------------------------------------------------------- measuring */
// Find where the dot of an "i" sits relative to its baseline and advance centre, by drawing one.
function tittle(font, size) {
  const cv = document.createElement('canvas');
  cv.width = size * 2; cv.height = size * 2;
  const g = cv.getContext('2d');
  g.font = `${font} ${size}px Fraunces`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const bx = size, by = size * 1.5;
  g.fillText('i', bx, by);
  const img = g.getImageData(0, 0, cv.width, cv.height).data;
  const rowInk = y => { let n = 0; for (let x = 0; x < cv.width; x++) n += img[(y * cv.width + x) * 4 + 3] > 128; return n; };
  let y = 0;
  while (y < cv.height && !rowInk(y)) y++;
  const top = y;
  while (y < cv.height && rowInk(y)) y++;
  const bottom = y;
  let minX = 1e9, maxX = -1;
  for (let yy = top; yy < bottom; yy++)
    for (let x = 0; x < cv.width; x++)
      if (img[(yy * cv.width + x) * 4 + 3] > 128) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  return { dx: (minX + maxX + 1) / 2 - bx, dy: (top + bottom) / 2 - by, r: Math.max(bottom - top, maxX - minX + 1) / 2 };
}
function dotsFor(textEl) {
  const size = parseFloat(textEl.getAttribute('font-size'));
  const tt = tittle(textEl.getAttribute('font-weight'), size);
  const y = parseFloat(textEl.getAttribute('y'));
  const out = [];
  const s = textEl.textContent;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== 'ı') continue;
    const ext = textEl.getExtentOfChar(i);
    out.push({ x: ext.x + ext.width / 2 + tt.dx, y: y + tt.dy, r: tt.r });
  }
  return out;
}

/* ------------------------------------------------------------------- init */
const G = {};
window.init = async function () {
  await Promise.all([
    '500 440px Fraunces', '600 160px Fraunces', 'italic 600 70px Fraunces', '400 80px Fraunces',
    '500 40px Inter', '600 40px Inter', '400 40px "JetBrains Mono"', '600 40px "JetBrains Mono"',
  ].map(f => document.fonts.load(f)));
  await document.fonts.ready;

  // paper grain
  const gc = $('grain').getContext('2d');
  const im = gc.createImageData(540, 960);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < im.data.length; i += 4) {
    const v = 150 + rnd() * 105;
    im.data[i] = v; im.data[i + 1] = v * .97; im.data[i + 2] = v * .92; im.data[i + 3] = 26;
  }
  gc.putImageData(im, 0, 0);

  // progress dots
  SCENES.forEach((_, i) => {
    const d = document.createElement('i');
    d.style.left = (540 + (i - 3.5) * 34 - 6) + 'px';
    $('dots').appendChild(d);
  });

  // fit the headline word to the frame width
  for (const id of ['wordT', 'endT']) {
    const el = $(id);
    const w = el.getComputedTextLength();
    if (w > 880) el.setAttribute('font-size', (160 * 880 / w).toFixed(1));
  }
  G.wordDots = dotsFor($('wordT'));
  G.endDots = dotsFor($('endT'));
  G.bigDot = dotsFor($('bigI'))[0];

  // hook: comma width + caret position
  const cc = $('commaC');
  G.commaW = cc.getBoundingClientRect().width;
  const lr = $('lensIn').getBoundingClientRect(), cr = cc.getBoundingClientRect();
  G.caret = { x: cr.left - lr.left + cr.width / 2, y: cr.bottom - lr.top + 8 };

  // pronunciation
  const syl = ['punk', '·', 'TIL', '·', 'ee', '·', 'us'];
  const sylT = svgEl('text', { x: 540, y: 1000 }, $('sylG'));
  G.syl = syl.map(s => {
    const ts = svgEl('tspan', { fill: s === '·' ? '#E2412A' : '#1D1B18' }, sylT);
    if (s === 'TIL') ts.setAttribute('font-weight', 700);
    ts.textContent = s;
    return ts;
  });

  // definition
  const defWords = 'showing great attention to detail or correct behavior.'.split(' ');
  const spokenIdx = [2, 3, 4, 5, 6, 7, 9, 10];
  const dwt = wordTimes('d1');
  G.def = defWords.map((w, i) => {
    const sp = document.createElement('span');
    sp.textContent = w;
    $('defText').appendChild(sp);
    $('defText').appendChild(document.createTextNode(' '));
    return { el: sp, t: dwt[spokenIdx[i]], ul: [2, 3, 4, 6, 7].includes(i) };
  });
  G.def.forEach(d => {
    if (!d.ul) return;
    const r = d.el.getBoundingClientRect();
    d.line = svgEl('line', { x1: r.left, y1: r.bottom + 2, x2: r.left, y2: r.bottom + 2, stroke: '#E2412A', 'stroke-width': 7, 'stroke-linecap': 'round' }, $('defSvg'));
    d.x1 = r.left; d.x2 = r.right - (/\.$/.test(d.el.textContent) ? 20 : 0);
  });
  const checks = ['the rules', 'the etiquette', 'the fine print'];
  const checkT = [.41, .56, .75].map(f => at('d2', f));
  G.checks = checks.map((txt, i) => {
    const row = document.createElement('div');
    row.className = 'check';
    row.style.top = (920 + i * 125) + 'px';
    row.innerHTML = `<div class="box"><svg width="64" height="64" viewBox="0 0 64 64" style="left:-5px;top:-5px">
      <path d="M12 33 L27 48 L56 13" fill="none" stroke="#E2412A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"
      pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg></div><span>${txt}</span>`;
    $('checks').appendChild(row);
    sfx(checkT[i], 'tick');
    return { row, path: row.querySelector('path'), t: checkT[i], a: S('d2') + .1 + i * .12 };
  });
  G.stampT = at('d2', .87);
  sfx(G.stampT + .12, 'thump');

  // etymology
  const seg = (id, k, f) => (TL[id].seg[k] ? TL[id].seg[k][0] : at(id, f));
  const NODES = [
    { k: ['LATIN'], w: ['pungere'], g: '“to prick”', kt: [seg('e2', 0, 0)], wt: [seg('e2', 1, .35)], gt: seg('e2', 2, .75) },
    { k: ['LATIN'], w: ['punctum'], g: '“a point, a dot”', kt: [at('e3', .3)], wt: [at('e3', .42)], gt: seg('e3', 1, .6) },
    { k: ['ITALIAN', ' · SPANISH'], w: ['puntiglio', ' / puntillo'], g: '“a fine point of honor”',
      kt: [S('e4'), at('e4', .37)], wt: [at('e4', .14), at('e4', .54)], gt: at('e4', .66) },
    { k: ['ENGLISH · 1590s'], w: ['punctilio'], g: '“a fine detail of conduct”', kt: [S('e5')], wt: [at('e5', .5)], gt: at('e5', .69) },
    { k: ['ENGLISH · 1630s'], w: ['punctilious'], g: 'attentive to every fine point', kt: [S('e6')], wt: [at('e6', .8)], gt: at('e6', .86) },
  ];
  G.nodes = NODES.map((n, i) => {
    const top = 470 + i * 200;
    const div = document.createElement('div');
    div.className = 'node';
    div.style.top = top + 'px';
    div.innerHTML = `<div class="k">${n.k.map(s => `<span>${s}</span>`).join('')}</div>
      <div class="w"${i === 4 ? ' style="color:#E2412A"' : ''}>${n.w.map(s => `<span style="display:inline-block;white-space:pre">${s}</span>`).join('')}</div>
      <div class="g">${n.g}</div>`;
    $('etyNodes').appendChild(div);
    const dot = svgEl('circle', { cx: 160, cy: top + 76, r: 0, fill: '#E2412A' }, $('etyDots'));
    const appear = Math.min(n.kt[0], n.wt[0]);
    sfx(appear, 'pop', .8);
    return { ...n, div, dot, y: top + 76, appear, ks: [...div.querySelectorAll('.k span')], ws: [...div.querySelectorAll('.w span')], gEl: div.querySelector('.g') };
  });
  G.introDot = { a: S('e1') + .45, move: G.nodes[0].appear - .55 };
  sfx(G.introDot.a, 'pop');
  G.needleT = G.nodes[0].wt[0] + .15;
  sfx(G.needleT + .3, 'tick');

  // family
  const FAM = [
    ['punct', 'ual', 'on time: right on the point', .38],
    ['punct', 'uation', 'the points and marks of writing', .52],
    ['punct', 'ure', 'a hole made by a sharp point', .60],
    ['pung', 'ent', 'sharp enough to prick your nose', .68],
  ];
  G.fam = FAM.map(([root, rest, gloss, f], i) => {
    const top = 640 + i * 182;
    const div = document.createElement('div');
    div.className = 'fam';
    div.style.top = top + 'px';
    div.innerHTML = `<div class="w"><b>${root}</b>${rest}</div><div class="g">${gloss}</div>`;
    $('famRows').appendChild(div);
    const dot = svgEl('circle', { cx: 140, cy: top + 52, r: 0, fill: '#E2412A' }, $('famDots'));
    const t = at('f1', f) - .05;
    sfx(t, 'pop', .8);
    return { div, dot, t, gt: i === 3 ? at('f1', .8) : t + .35, gEl: div.querySelector('.g'), y: top + 52 };
  });
  G.rootT = S('f1') + .15;

  // examples: karaoke sentences
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
  // document page for example 2
  const doc = $('docSvg');
  G.docLines = [];
  const widths = [480, 520, 500, 450, 0, 530, 490, 510, 300];
  let y = 520;
  svgEl('rect', { x: 290, y: 448, width: 320, height: 26, rx: 6, fill: '#1D1B18' }, doc);
  widths.forEach((w, i) => {
    if (w) G.docLines.push(svgEl('rect', { x: 290, y, width: 0, height: 14, rx: 7, fill: '#D3CABB', 'data-w': w }, doc));
    y += 38;
  });
  G.sups = [[290 + 450 + 8, 520 + 3 * 38 + 12], [290 + 510 + 8, 520 + 7 * 38 + 12], [290 + 300 + 8, 520 + 8 * 38 + 12]].map(([x, yy], i) =>
    svgEl('text', { x, y: yy, 'font-family': 'JetBrains Mono', 'font-weight': 600, 'font-size': 26, fill: '#E2412A', opacity: 0 }, doc));
  G.sups.forEach((s, i) => { s.textContent = i + 1; });
  svgEl('line', { x1: 290, y1: 900, x2: 480, y2: 900, stroke: '#1D1B18', 'stroke-width': 3 }, doc);
  G.hl = svgEl('rect', { x: 0, y: 0, width: 0, height: 30, rx: 4, fill: '#E2412A', opacity: .22 }, doc);
  G.notes = ['1  Hale, On Margins, p. 47.', '2  Ortiz, Fine Print, p. 112.', '3  Ibid., p. 113.'].map((s, i) => {
    const el = svgEl('text', { x: 290, y: 942 + i * 34, 'font-family': 'JetBrains Mono', 'font-size': 25, fill: '#1D1B18', opacity: 0 }, doc);
    el.textContent = s;
    return el;
  });
  const n0 = G.notes[0].getBBox();
  const pw = G.notes[0].getSubStringLength(19, 6);
  const px = G.notes[0].getStartPositionOfChar(19).x;
  G.hlBox = { x: px - 4, y: n0.y - 2, w: pw + 8 };
  G.supT = [.36, .45, .54].map(f => at('x2', f));
  G.noteT = [.58, .66, .74].map(f => at('x2', f));
  G.hlT = at('x2', .86);
  G.supT.forEach(t => sfx(t, 'tick', .6));
  sfx(G.hlT, 'swipe', .7);
  // example 1 and 3 cues
  G.forkT = S('x1') + .15;
  sfx(G.forkT + .6, 'tick');
  G.dimT = at('x1', .3);
  G.nameT = at('x1', .5); sfx(G.nameT, 'pop', .8);
  G.nutsT = at('x1', .82); sfx(G.nutsT, 'tick', .7);
  G.b1T = S('x3') - .1; sfx(G.b1T + .1, 'bubble', .7);
  G.typeT = at('x3', .42);
  G.b2T = at('x3', .64); sfx(G.b2T, 'bubble');
  sfx(S('x0') + .05, 'pop');

  // synonyms
  G.synT = [.35, .59, .84].map(f => at('s1', f));
  G.antT = [.35, .67, .84].map(f => at('s2', f));
  G.synT.forEach(t => sfx(t, 'pop', .8));
  G.antT.forEach(t => sfx(t + .25, 'thud'));
  G.vs1T = at('s3', .62); sfx(G.vs1T, 'whoosh', .6);
  G.g1T = at('s4', .25); sfx(G.g1T + .7, 'tick');
  G.vs2T = at('s4', .43); sfx(G.vs2T, 'whoosh', .6);
  G.g2T = at('s4', .72); sfx(G.g2T, 'tick');

  // outro
  G.straightT = at('o1', .5);
  sfx(G.straightT + .12, 'snap');
  G.endT = S('o3') - .55;
  G.endDotT = [S('o3') - .05, S('o3') + .25];
  G.endDotT.forEach(t => sfx(t + .45, 'tick'));
  sfx(S('o3') + 1, 'chime');

  // hook + word cues
  G.bigDotT = S('h5') + .15; sfx(G.bigDotT, 'pop');
  G.flyT = S('w1') - .3;
  G.dropT = S('w1') + .2;
  sfx(G.flyT + .5, 'tick'); sfx(G.dropT + .45, 'tick');
  sfx(at('h3', .55), 'tick', .7);
  sfx(at('h2', .45), 'tick', .5);
  G.sylT = [.18, .37, .45, .55].map(f => at('w2', f));
  G.posT = at('w2', .66); sfx(G.posT, 'pop', .8);

  SCENES.slice(1).forEach(s => sfx(s.a, 'whoosh', .35));
  window.SFX.sort((a, b) => a.t - b.t);
  buildCaptions();
  return { total: TOTAL };
};

/* ----------------------------------------------------------------- render */
function sceneVis(t, sc) {
  const fi = sc.a <= 0 ? 1 : fadeIn(t, sc.a, .4);
  const fo = ease.out(P(t, sc.b - .3, .3));
  return { o: fi * (1 - fo), y: 40 * (1 - fi) - 30 * fo };
}

window.render = function (t) {
  $('grid').style.backgroundPositionY = (30 + t * 8) + 'px';
  const vis = {};
  SCENES.forEach((sc, i) => {
    const v = sceneVis(t, sc);
    vis[sc.id] = v.o;
    const el = $(sc.id);
    el.style.display = v.o > 0.001 ? 'block' : 'none';
    css(el, { y: v.y, o: v.o });
  });
  const cur = SCENES.reduce((acc, sc, i) => (t >= sc.a ? i : acc), 0);
  [...$('dots').children].forEach((d, i) => {
    d.style.background = i === cur ? '#E2412A' : i < cur ? '#1D1B18' : '#D8CFBF';
    d.style.transform = `scale(${i === cur ? 1.35 : 1})`;
  });
  renderCaption(t);
  if (vis['sc-hook']) hook(t);
  if (vis['sc-word'] || vis['sc-hook']) word(t, vis['sc-word']);
  if (vis['sc-def']) def(t);
  if (vis['sc-ety']) ety(t);
  if (vis['sc-fam']) fam(t);
  if (vis['sc-ex']) ex(t);
  if (vis['sc-syn']) syn(t);
  if (vis['sc-out']) out(t);
  dots(t, vis);
};

function hook(t) {
  const enter = ease.out(P(t, .1, 1.1));
  const exit = ease.out(P(t, S('h5') + .05, .5));
  const drift = Math.sin(t * 1.6) * 6;
  css($('lens'), { x: lerp(620, 0, enter) + drift, y: lerp(820, 0, enter) + drift * .5, r: lerp(28, 0, enter), s: 1 + .3 * exit, o: 1 - exit });
  css($('lensGrid'), { x: Math.sin(t * .9) * 30 - 30, y: Math.cos(t * .7) * 30 - 30 });

  // crooked frame
  const fo = window_(t, S('h2') - .2, S('h3') - .1);
  const ft = t - (S('h2') - .2);
  const ang = 8 + 5 * Math.sin(ft * 8) * Math.exp(-ft * 2.2);
  $('vFrame').style.opacity = fo;
  $('vFrameG').setAttribute('transform', `rotate(${ang.toFixed(2)} 300 300) translate(300 300) scale(${lerp(.7, 1, popIn(t, S('h2') - .2))}) translate(-300 -300)`);
  const ann = fadeIn(t, at('h2', .45), .25);
  $('vLevel').setAttribute('opacity', ann);
  $('vLevel').setAttribute('stroke-dashoffset', -t * 30);
  $('vDeg').setAttribute('opacity', ann);

  // missing comma
  const co = window_(t, S('h3') - .15, S('h4') - .1);
  const cp = popIn(t, at('h3', .55), .4);
  $('comma').style.opacity = co;
  $('commaC').style.width = (G.commaW * clamp(cp, 0, 1.2)) + 'px';
  css($('commaC'), { y: -40 * (1 - clamp(cp)) });
  $('caret').style.opacity = co * clamp(cp);
  svgT($('caretP'), { x: G.caret.x, y: G.caret.y + 10 * (1 - clamp(cp)) });

  // dotless i
  const io = fadeIn(t, S('h4') - .1, .3) * (1 - fadeIn(t, S('w1') - .45, .3));
  const ip = popIn(t, S('h4') - .1, .5);
  svgT($('bigI'), { x: 540, y: 1000, s: lerp(.85, 1, ip), o: io });
  $('bigI').setAttribute('x', 0); $('bigI').setAttribute('y', 0);
  const g = G.bigDot;
  const gs = lerp(.85, 1, ip);
  const ghost = $('ghostDot');
  const gp = fadeIn(t, at('h4', .55), .3) * (1 - fadeIn(t, G.bigDotT, .1));
  ghost.setAttribute('cx', 540 + (g.x - 540) * gs);
  ghost.setAttribute('cy', 1000 + (g.y - 1000) * gs);
  ghost.setAttribute('r', g.r * gs * (1.12 + .06 * Math.sin(t * 9)));
  ghost.setAttribute('opacity', gp * io);
}

function word(t, vo) {
  const wp = fadeIn(t, S('w1') - .35, .5);
  svgT($('wordT'), { o: wp, y: 20 * (1 - wp) });
  const sp = fadeIn(t, S('w2') - .1, .35);
  $('sylG').setAttribute('opacity', sp);
  $('sylG').setAttribute('transform', `translate(0 ${16 * (1 - sp)})`);
  const active = G.sylT.reduce((acc, st, i) => (t >= st ? i : acc), -1);
  const sylIdx = [0, 2, 4, 6];
  G.syl.forEach((ts, i) => {
    if (ts.textContent === '·') return;
    const on = sylIdx[active] === i && t < at('w2', .64);
    ts.setAttribute('fill', on ? '#E2412A' : '#1D1B18');
  });
  const pp = popIn(t, G.posT, .45);
  css($('pos'), { pre: 'translateX(-50%) ', s: lerp(.6, 1, pp), o: clamp(pp * 2) });
}

function dots(t, vis) {
  const A = $('dotA'), B = $('dotB');
  let a = null, b = null;
  if (t < G.endT) {
    // dot A: fills the dotless i, then flies into the headline
    const big = G.bigDot, w1 = G.wordDots[0], w2 = G.wordDots[1];
    if (t >= G.bigDotT) {
      const p = popIn(t, G.bigDotT, .4);
      const f = ease.inout(P(t, G.flyT, .5));
      a = {
        x: lerp(big.x, w1.x, f), y: lerp(big.y, w1.y, f) - Math.sin(Math.PI * f) * 140,
        r: lerp(big.r, w1.r, f) * clamp(p, 0, 1.3), o: t > S('w1') ? vis['sc-word'] : 1,
      };
    }
    if (t >= G.dropT) {
      const f = ease.bounce(P(t, G.dropT, .65));
      b = { x: w2.x, y: lerp(-60, w2.y, f), r: w2.r, o: vis['sc-word'] };
    }
  } else {
    const [e1, e2] = G.endDots;
    const v = vis['sc-out'];
    if (t >= G.endDotT[0]) b = { x: e1.x, y: lerp(-60, e1.y, ease.bounce(P(t, G.endDotT[0], .65))), r: e1.r, o: v };
    if (t >= G.endDotT[1]) a = { x: e2.x, y: lerp(-60, e2.y, ease.bounce(P(t, G.endDotT[1], .65))), r: e2.r, o: v };
  }
  for (const [el, d] of [[A, a], [B, b]]) {
    if (!d) { el.setAttribute('opacity', 0); continue; }
    el.setAttribute('cx', d.x.toFixed(2)); el.setAttribute('cy', d.y.toFixed(2));
    el.setAttribute('r', Math.max(0, d.r).toFixed(2)); el.setAttribute('opacity', d.o);
  }
}

function def(t) {
  G.def.forEach(d => {
    const p = fadeIn(t, d.t, .3);
    css(d.el, { y: 18 * (1 - p), o: p });
    if (d.line) {
      const lp = ease.inout(P(t, d.t + .1, .35));
      d.line.setAttribute('x2', lerp(d.x1, d.x2, lp));
      d.line.setAttribute('opacity', lp > 0 ? 1 : 0);
    }
  });
  G.checks.forEach(c => {
    const p = fadeIn(t, c.a, .4);
    css(c.row, { x: -30 * (1 - p), o: p });
    c.path.setAttribute('stroke-dashoffset', 1 - ease.out(P(t, c.t, .28)));
  });
  const sp = P(t, G.stampT, .25);
  css($('stamp'), { pre: 'translate(-50%,-50%) ', s: lerp(1.8, 1, ease.out(sp)), o: sp > 0 ? clamp(sp * 3) : 0 });
}

function ety(t) {
  const n0 = G.nodes[0];
  // the single point of e1 travels to become the first node
  const ip = popIn(t, G.introDot.a, .45);
  const mv = ease.inout(P(t, G.introDot.move, .55));
  let lineEnd = n0.y;
  G.nodes.forEach((n, i) => {
    const on = t >= n.appear;
    let r = 15 * popIn(t, n.appear, .4);
    let cx = 160, cy = n.y;
    if (i === 0) { r = lerp(30 * ip, 15, mv); cx = lerp(540, 160, mv); cy = lerp(900, n.y, mv); }
    n.dot.setAttribute('r', Math.max(0, r));
    n.dot.setAttribute('cx', cx); n.dot.setAttribute('cy', cy);
    const next = G.nodes[i + 1];
    const passed = next && t >= next.appear;
    n.dot.setAttribute('fill', passed ? '#1D1B18' : '#E2412A');
    n.ks.forEach((k, j) => { const p = fadeIn(t, n.kt[j], .3); css(k, { o: p }); k.style.display = 'inline'; });
    n.ws.forEach((w, j) => { const p = fadeIn(t, n.wt[j], .35); css(w, { x: 24 * (1 - p), o: p }); });
    const gp = fadeIn(t, n.gt, .35);
    css(n.gEl, { y: 10 * (1 - gp), o: gp });
    n.div.style.opacity = passed ? lerp(1, .5, fadeIn(t, next.appear, .4)) : 1;
    if (i > 0) lineEnd = lerp(lineEnd, n.y, ease.inout(P(t, n.appear - .45, .45)));
  });
  $('etyLine').setAttribute('y1', n0.y);
  $('etyLine').setAttribute('y2', lineEnd);
  $('etyLine').setAttribute('opacity', mv >= 1 ? 1 : 0);
  // needle pricks the first point
  const np = P(t, G.needleT, .9);
  const down = np < .35 ? ease.out(np / .35) : 1 - ease.inout((np - .35) / .65);
  svgT($('needle'), { x: 160, y: n0.y - 18 - 240 * (1 - down), r: 0, o: np > 0 && np < 1 ? clamp(down * 3) : 0 });
}

function fam(t) {
  const rp = popIn(t, G.rootT, .5);
  css($('root'), { s: lerp(.7, 1, rp), o: clamp(rp * 2) });
  let end = 560;
  G.fam.forEach(f => {
    const p = fadeIn(t, f.t, .35);
    css(f.div, { x: 40 * (1 - p), o: p });
    const gp = fadeIn(t, f.gt, .35);
    css(f.gEl, { o: gp });
    f.dot.setAttribute('r', 12 * popIn(t, f.t, .4));
    end = lerp(end, f.y, ease.inout(P(t, f.t - .3, .3)));
  });
  $('famLine').setAttribute('y1', 560);
  $('famLine').setAttribute('y2', end);
  $('famLine').setAttribute('opacity', fadeIn(t, G.rootT + .2, .2));
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
      w.sp.style.color = on ? (w.em ? '#E2412A' : '#1D1B18') : '#BDB4A5';
    });
  });
  // 1: place setting snaps into alignment
  const fp = ease.inout(P(t, G.forkT, .65));
  svgT($('fork'), { x: lerp(262, 300, fp), y: lerp(790, 745, fp), r: lerp(-16, 0, fp) });
  svgT($('knife'), { x: lerp(820, 780, fp), y: lerp(715, 745, fp), r: lerp(14, 0, fp) });
  $('dim').setAttribute('opacity', fadeIn(t, G.dimT, .3));
  const np = popIn(t, G.nameT, .45);
  $('nameCard').setAttribute('transform', `translate(540 501) scale(${Math.max(0, np)}) translate(-540 -501)`);
  $('noNuts').setAttribute('opacity', fadeIn(t, G.nutsT, .25));
  // 2: citations
  G.docLines.forEach((l, i) => l.setAttribute('width', +l.dataset.w * ease.out(P(t, S('x2') - .3 + i * .07, .4))));
  G.sups.forEach((s, i) => s.setAttribute('opacity', fadeIn(t, G.supT[i], .2)));
  G.notes.forEach((s, i) => s.setAttribute('opacity', fadeIn(t, G.noteT[i], .3)));
  const hp = ease.inout(P(t, G.hlT, .35));
  Object.entries({ x: G.hlBox.x, y: G.hlBox.y, width: G.hlBox.w * hp }).forEach(([k, v]) => G.hl.setAttribute(k, v));
  // 3: text correction
  const b1 = popIn(t, G.b1T + .1, .4);
  css($('b1'), { s: Math.max(0, b1), o: clamp(b1 * 2) });
  $('b1').style.transformOrigin = '100% 100%';
  const ty = fadeIn(t, G.typeT, .2) * (1 - P(t, G.b2T - .05, .05));
  $('typing').setAttribute('opacity', ty);
  ['ty1', 'ty2', 'ty3'].forEach((id, i) => $(id).setAttribute('cy', 798 - 8 * Math.max(0, Math.sin(t * 12 - i * .9))));
  const b2 = popIn(t, G.b2T, .4);
  $('b2').style.transformOrigin = '0% 100%';
  css($('b2'), { s: Math.max(0, b2), o: clamp(b2 * 2) });
}

function syn(t) {
  const aOut = ease.inout(P(t, S('s3') - .35, .3));
  $('synA').style.opacity = 1 - aOut;
  $('synA').style.display = aOut < 1 ? 'block' : 'none';
  ['c1', 'c2', 'c3'].forEach((id, i) => {
    const p = popIn(t, G.synT[i], .45);
    css($(id), { s: lerp(.5, 1, p), o: clamp(p * 2) });
  });
  const mess = [[-60, -7], [80, 5], [-25, -10]];
  ['c4', 'c5', 'c6'].forEach((id, i) => {
    const p = ease.bounce(P(t, G.antT[i], .55));
    css($(id), { x: mess[i][0], y: lerp(-260, 0, p), r: lerp(-30 + i * 25, mess[i][1], p), o: t >= G.antT[i] ? 1 : 0 });
  });
  const bIn = fadeIn(t, S('s3') - .1, .3);
  $('synB').style.opacity = bIn;
  $('synB').style.display = bIn > 0 ? 'block' : 'none';
  const v1 = ease.out(P(t, G.vs1T, .45)), v2 = ease.out(P(t, G.vs2T, .45));
  css($('vs1'), { x: -200 * (1 - v1), o: v1 });
  css($('vs2'), { x: 200 * (1 - v2), o: v2 });
  const nq = popIn(t, G.vs2T - .15, .45);
  css($('neq'), { s: Math.max(0, nq), o: clamp(nq * 2) });
  css($('g1'), { o: fadeIn(t, G.g1T, .3) });
  css($('g2'), { o: fadeIn(t, G.g2T, .3) });
  const cp = ease.out(P(t, G.vs1T, 1.6 + (G.g1T - G.vs1T)));
  $('mnHand').setAttribute('transform', `rotate(${(1 - cp) * 1080})`);
  $('hrHand').setAttribute('transform', `rotate(${(1 - cp) * 90})`);
  const bp = P(t, G.vs2T, G.g2T - G.vs2T + .3);
  $('bubble').setAttribute('cx', (-50 * (1 - ease.spring(bp))).toFixed(2));
}

function out(t) {
  const ft = t - (S('o1') - .2);
  const sway = 9 + 1.5 * Math.sin(ft * 3);
  const sp = ease.spring(P(t, G.straightT, 1.1));
  const ang = lerp(sway, 0, sp);
  $('hang').setAttribute('transform', `rotate(${ang.toFixed(3)} 540 390)`);
  $('levelB').setAttribute('cx', (540 + ang * 9).toFixed(2));
  const fOut = ease.inout(P(t, G.endT, .5));
  $('outFrame').style.opacity = 1 - fOut;
  $('outFrame').style.transform = `translateY(${-80 * fOut}px) scale(${1 - .15 * fOut})`;
  const eIn = fadeIn(t, G.endT + .25, .5);
  $('endBlock').style.opacity = eIn;
  $('endBlock').style.transform = `translateY(${30 * (1 - eIn)}px)`;
  css($('endDef'), { y: 12 * (1 - fadeIn(t, S('o3') + .5, .5)), o: fadeIn(t, S('o3') + .5, .5) });
  css($('endTag'), { o: fadeIn(t, S('o3') + 1, .5) });
}
