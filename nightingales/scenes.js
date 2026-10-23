// The film. render(t) paints the frame for second t. Every visual beat is keyed to the
// narration's word timings (window.TL from build/timeline.js), so re-timing the voice
// re-times the picture. Sound cues are collected in window.CUES for audio.py.
'use strict';

const C = document.getElementById('c'), X = C.getContext('2d');
const IMG = {};
const PLATES = ['p01_wood', 'p02_hero', 'p03_migration', 'p04_females', 'p05_rivals', 'p06_twovoice', 'p07_storyteller',
  'p08_foxrain', 'p09_karakuri', 'p10_valley', 'p11_city', 'p12_chorus', 'p13_floor', 'p14_dawn'];

// ---------- timeline lookups ----------
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function seg(id) { return TL.segments.find(s => s.id.startsWith(id)); }
// start time of the n-th occurrence of `word` in segment `id`
function wt(id, word, n = 0) {
  const ws = TL.words[seg(id).id], k = norm(word);
  let c = 0;
  for (const w of ws) if (norm(w[0]) === k && c++ === n) return w[1];
  throw new Error(`word not found: ${id} ${word} ${n}`);
}
const card = i => TL.cards[i];

// ---------- small composed pieces ----------
function tag(x, s, px, py, a, o = {}) {
  if (a <= 0) return;
  const size = o.size || 34;
  x.save(); x.font = `${o.weight || 600} ${size}px ${o.font || SERIF}`; const w = x.measureText(s).width; x.restore();
  const pw = w + 74, ph = size * 1.95;
  const x0 = o.align === 'center' ? px - pw / 2 : o.align === 'right' ? px - pw : px;
  const y0 = py + (1 - ease(a)) * 14;
  cartouche(x, x0, y0, pw, ph, { alpha: a });
  text(x, s, x0 + pw / 2, y0 + ph / 2 + size * 0.34, { size, align: 'center', alpha: a, weight: o.weight || 600, font: o.font, italic: o.italic, color: o.color });
}
function boardTitle(x, jp, en, a) {
  if (a <= 0) return;
  seal(x, 150, 120, 74, jp, { alpha: a });
  text(x, en, 210, 136, { size: 50, weight: 600, alpha: a, italic: true });
  inkStroke(x, [[210, 160], [760, 156]], 3, ease(a));
}
function speculative(x, a) {                       // marks hypothesis on screen, as the narration does aloud
  if (a <= 0) return;
  seal(x, W - 120, 110, 92, '推測', { alpha: a, rot: 0.05 });
  text(x, 'speculation', W - 180, 128, { size: 30, italic: true, align: 'right', color: PAL.ver, alpha: a, weight: 700 });
}
function bars(x, rows, k, o = {}) {               // labelled brush bars; rows: [label, value, colour, note]
  const x0 = o.x || 200, L = o.scale || 1, y0 = o.y || 330, gap = o.gap || 120;
  rows.forEach(([label, v, col, note, from], i) => {
    const kk = ease((k - i * 0.15) * 1.6); if (kk <= 0) return;
    const y = y0 + i * gap;
    text(x, label, x0, y - 18, { size: 34, weight: 600, alpha: kk });
    const a = (from || 0) * L, b = v * L * easeOut(kk);
    const pts = []; for (let j = 0; j <= 30; j++) pts.push([x0 + a + (b - a) * j / 30, y + 22 + Math.sin(j * 1.7) * 1.5]);
    inkStroke(x, pts, 26, 1, col || PAL.ink);
    if (note) text(x, note, x0 + Math.max(b, a) + 24, y + 34, { size: 32, italic: true, alpha: kk, color: col || PAL.ink });
  });
}
function songTile(x, px, py, w, h, seed, a = 1, col) {   // a tiny "song": a few glyphs in a frame
  if (a <= 0) return;
  const r = rng(seed * 7919 + 1);
  x.save(); x.globalAlpha = a;
  x.strokeStyle = 'rgba(28,26,32,0.5)'; x.lineWidth = 1.2; x.strokeRect(px, py, w, h);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) glyph(x, GLYPHS[Math.floor(r() * GLYPHS.length)], px + 4 + i * (w - 8) / n, py + 4, (w - 8) / n - 3, h - 8, { lw: 1.6, color: col });
  x.restore();
}
function strip(x, y, h, a) {                      // a paper band across the frame for diagrams over plates
  if (a <= 0) return;
  x.save(); x.globalAlpha = a; x.shadowColor = 'rgba(0,0,0,0.4)'; x.shadowBlur = 30;
  x.drawImage(TEX.paper, 0, y, W, h, 0, y, W, h); x.shadowBlur = 0;
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.beginPath(); x.moveTo(0, y + 6); x.lineTo(W, y + 6); x.moveTo(0, y + h - 6); x.lineTo(W, y + h - 6); x.stroke();
  x.restore();
}
function lane(x, y, x0, x1, label, a) {
  text(x, label, x0 - 24, y + 12, { size: 30, align: 'right', italic: true, alpha: a });
  x.save(); x.globalAlpha = a * 0.5; x.strokeStyle = PAL.ink; x.setLineDash([4, 8]); x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y); x.stroke(); x.restore();
}
function block(x, px, y, w, kind, a, o = {}) {    // one song on a lane; kind picks its pattern
  if (a <= 0 || w <= 0) return;
  const cols = ['#c49a45', '#1d2c4c', '#7d8c6a', '#8a4f6e'];
  x.save(); x.globalAlpha = a;
  x.fillStyle = cols[kind % cols.length]; x.fillRect(px, y - 24, w, 48);
  x.globalAlpha = a * 0.55; x.strokeStyle = PAL.cream; x.lineWidth = 2;
  for (let i = 0; i < w; i += 14) { x.beginPath(); x.moveTo(px + i, y + (kind % 2 ? 18 : -18)); x.lineTo(px + i + 10, y + (kind % 2 ? -18 : 18)); x.stroke(); }
  x.globalAlpha = a; x.strokeStyle = o.hot ? PAL.ver : PAL.ink; x.lineWidth = o.hot ? 5 : 2; x.strokeRect(px, y - 24, w, 48);
  x.restore();
}
function bead(x, px, py, r, a, o = {}) {
  if (a <= 0) return;
  x.save(); x.globalAlpha = a;
  const g = x.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.1, px, py, r);
  g.addColorStop(0, o.light || '#e9c98a'); g.addColorStop(1, o.dark || '#7a4a22');
  x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.stroke();
  if (o.glyph) glyph(x, o.glyph, px - r * 0.55, py - r * 0.5, r * 1.1, r, { color: PAL.cream, lw: 2.2 });
  x.restore();
}

// ---------- the chapter card ----------
function chapterCard(x, t, c) {
  paper(x);
  const k = ease((t - c.t0) / 0.9), out = 1 - ease((t - (c.t1 - 0.4)) / 0.4);
  x.save(); x.globalAlpha = out;
  const cx = W / 2;
  x.save(); x.translate(cx, 470); x.scale(1 + 0.12 * (1 - k), 1 + 0.12 * (1 - k));
  text(x, c.num, 0, 0, { font: JP, size: 300, weight: 700, align: 'center', base: 'middle', alpha: k });
  x.restore();
  seal(x, cx + 190, 380, 70, '夜鳴', { alpha: ease((t - c.t0 - 0.5) / 0.4) });
  inkStroke(x, [[cx - 330, 690], [cx + 330, 690]], 3, ease((t - c.t0 - 0.3) / 0.8));
  brushText(x, c.title, cx, 780, ease((t - c.t0 - 0.45) / 1.0), { size: 74, italic: true, align: 'center', weight: 600 });
  x.restore();
}

// ---------- shots ----------
// Each shot is drawn while a ≤ t < b + FADE; a later shot fades in over the earlier one.
const FADE = 0.8;
let SHOTS = [], OVERLAYS = [];
const CUES = [];
function cue(t, kind, o = {}) { CUES.push({ t: +t.toFixed(3), kind, ...o }); }

function build() {
  SHOTS = []; OVERLAYS = []; CUES.length = 0;
  const S = (a, b, f, o = {}) => SHOTS.push({ a, b, f, fade: o.fade ?? FADE });
  const O = (a, b, f) => OVERLAYS.push({ a, b, f });
  const A = window.ASSETS;

  // ===== cold open: the dark wood, then the singer =====
  const tBird = wt('s02', 'Somewhere') - 0.4;
  S(0, tBird, (x, t) => {
    kb(x, IMG.p01_wood, t, 0, tBird + 1, { x: 0.5, y: 0.6, z: 1.0 }, { x: 0.56, y: 0.5, z: 1.22 });
    mist(x, t, { y: 0.62, alpha: 0.18 });
    shade(x, 1 - ease(t / 4.5));
  }, { fade: 0 });
  const tTitle = seg('s02').t1 + 0.6, tS03 = seg('s03').t0;
  S(tBird, tS03, (x, t) => {
    kb(x, IMG.p02_hero, t, tBird, tS03 + 1, { x: 0.32, y: 0.5, z: 1.05 }, { x: 0.36, y: 0.44, z: 1.3 });
    mist(x, t, { y: 0.8, alpha: 0.14 });
    shade(x, 0.55 * win(t, tTitle, card(0).t0 + 0.3, 0.8, 0.4));
  });
  // title
  O(tTitle, card(0).t0 + 0.3, (x, t) => {
    const a = win(t, tTitle, card(0).t0 + 0.3, 1.0, 0.5);
    brushText(x, 'The Speech', 980, 470, ease((t - tTitle - 0.2) / 1.2), { size: 116, weight: 600, color: PAL.cream, shadow: 'rgba(0,0,0,0.8)', italic: true });
    brushText(x, 'of Nightingales', 1040, 596, ease((t - tTitle - 0.7) / 1.3), { size: 116, weight: 600, color: PAL.cream, shadow: 'rgba(0,0,0,0.8)', italic: true });
    x.save(); x.globalAlpha = a; vtext(x, '小夜啼鳥の言葉', 1850, 230, { size: 52, color: PAL.cream, shadow: 'rgba(0,0,0,0.8)' }); x.restore();
    seal(x, 1850, 690, 74, '夜鳴', { alpha: a * ease((t - tTitle - 1.4) / 0.4) });
    text(x, 'a field note in the manner of the yokai prints', 1050, 676, { size: 36, italic: true, color: PAL.cream, alpha: a * ease((t - tTitle - 1.8) / 0.8), shadow: 'rgba(0,0,0,0.9)' });
  });
  cue(tTitle, 'taiko');

  // chapter cards
  TL.cards.forEach(c => { S(c.t0, c.t1, (x, t) => chapterCard(x, t, c), { fade: 0.5 }); cue(c.t0 + 0.1, 'clack'); });

  // ===== 壱 the singer =====
  const tEach = wt('s03', 'Each'), tThey = wt('s03', 'They'), tOnce = wt('s03', 'Once'), tBy = wt('s03', 'By');
  S(card(0).t1, tEach, (x, t) => {
    kb(x, IMG.p02_hero, t, card(0).t1, tEach + 1, { x: 0.36, y: 0.5, z: 1.55 }, { x: 0.33, y: 0.52, z: 1.75 });
    const a = win(t, wt('s03', 'common') - 0.3, tEach + 0.4, 0.6, 0.4);
    if (a > 0) {
      cartouche(x, 1250, 230, 560, 420, { alpha: a });
      vtext(x, '小夜啼鳥', 1735, 270, { size: 50, alpha: a });
      text(x, 'Common nightingale', 1300, 320, { size: 46, weight: 700, alpha: a });
      text(x, 'Luscinia megarhynchos', 1300, 372, { size: 36, italic: true, alpha: a });
      inkStroke(x, [[1300, 400], [1650, 398]], 2, a);
      text(x, 'plain brown, rufous tail', 1300, 452, { size: 32, alpha: a * ease((t - wt('s03', 'plain')) / 0.6) });
      text(x, '≈ 16 cm · ≈ 20 g', 1300, 500, { size: 32, alpha: a * ease((t - wt('s03', 'larger')) / 0.6) });
      text(x, 'a little larger than a robin', 1300, 548, { size: 32, italic: true, alpha: a * ease((t - wt('s03', 'robin')) / 0.6) });
      text(x, 'winters in tropical Africa', 1300, 596, { size: 32, italic: true, alpha: a * ease((t - wt('s03', 'robin') - 0.6) / 0.6) });
    }
  });
  S(tEach, tThey, (x, t) => {
    kb(x, IMG.p03_migration, t, tEach, tThey + 1, { x: 0.8, y: 0.55, z: 1.35 }, { x: 0.25, y: 0.3, z: 1.3 });
    tag(x, 'tropical Africa → the thickets of Europe', W / 2, 820, win(t, wt('s03', 'Africa') - 0.3, tThey + 0.5), { align: 'center' });
  });
  S(tThey, tBy, (x, t) => {
    kb(x, IMG.p04_females, t, tThey, tBy + 1, { x: 0.5, y: 0.5, z: 1.08 }, { x: 0.4, y: 0.6, z: 1.22 });
    shade(x, 0.35 * ease((t - tOnce) / 1.5));
    tag(x, 'unpaired males: song all night', 1380, 760, win(t, tThey + 0.3, tOnce));
    tag(x, 'paired: the night song largely stops', 1300, 760, win(t, tOnce + 0.4, tBy + 0.6));
  });
  S(tBy, card(1).t0, (x, t) => {
    kb(x, IMG.p05_rivals, t, tBy, card(1).t0 + 1, { x: 0.5, y: 0.45, z: 1.0 }, { x: 0.5, y: 0.5, z: 1.12 });
    tag(x, 'by day: a song for rivals', W / 2, 860, win(t, tBy + 0.6, card(1).t0 + 0.5), { align: 'center' });
  });

  // ===== 弐 a thousand sounds =====
  const song = A.song, tSongA = card(1).t1 - 0.35, tSlow = wt('s04', 'Slow'), tBreak = wt('s04', 'breaks');
  const tSlowStart = tBreak - 0.3, SLOW = 4;
  const tSeveral = wt('s04', 'several'), tThou = wt('s04', 'thousand'), tStrung = wt('s04', 'elements');
  const t200 = wt('s04', '200'), t250 = wt('s04', '250'), tMore = wt('s04', 'more'), tEndS04 = wt('s05', 'What') - 0.3;
  cue(tSongA, 'song', { clip: 'song', rate: 1, gain: 0.45 });
  cue(tSlowStart, 'song', { clip: 'song', rate: 1 / SLOW, gain: 0.2 });
  const examples = [['whistle', 'whistle'], ['click', 'click'], ['buzz', 'buzz']];
  examples.forEach(([w, kind]) => cue(wt('s04', w), 'demo', { sound: kind }));
  // layout of the separated notes
  const L0 = 160, LW = 1600, TOP = 290, SH = 400;
  const gap = 16, totalW = song.notes.reduce((s, n) => s + (n.t1 - n.t0 + 0.03), 0);
  const fit = (LW - gap * (song.notes.length - 1)) / totalW;
  let acc = 0;
  const lay = song.notes.map(n => { const w = (n.t1 - n.t0 + 0.03) * fit, p = { from: (n.t0 - 0.015) / song.dur * LW, to: acc, w0: (n.t1 - n.t0 + 0.03) / song.dur * LW, w }; acc += w + gap; return p; });
  S(card(1).t1, tEndS04, (x, t) => {
    paper(x);
    boardTitle(x, '一声', 'One song, taken apart', ease((t - card(1).t1) / 0.8));
    const img = IMG.song;
    const fadeSpec = 1 - ease((t - tSeveral + 0.3) / 0.8);
    if (fadeSpec > 0) {
      x.save(); x.globalAlpha = fadeSpec;
      // frequency axis
      text(x, '8 kHz', L0 - 20, TOP + SH * 0.2 + 10, { size: 26, align: 'right', italic: true });
      text(x, '1 kHz', L0 - 20, TOP + SH * 0.94, { size: 26, align: 'right', italic: true });
      const k = ease((t - tBreak) / 1.4);
      if (k <= 0) {                                  // the whole song, revealed as it plays
        const rev = clamp((t - tSongA) / song.dur);
        x.save(); x.beginPath(); x.rect(L0, TOP - 10, LW * rev, SH + 20); x.clip();
        x.drawImage(img, L0, TOP, LW, SH); x.restore();
        if (rev > 0 && rev < 1) inkStroke(x, [[L0 + LW * rev, TOP - 10], [L0 + LW * rev, TOP + SH + 10]], 3, 1, PAL.ver);
        bracket(x, L0, L0 + LW, TOP + SH + 40, ease((t - tSongA - song.dur) / 0.7), '≈ 3 seconds', { below: true });
      } else {                                       // notes drift apart; a playhead runs at quarter speed
        const play = (t - tSlowStart) / SLOW;        // seconds into the song
        lay.forEach((p, i) => {
          const n = song.notes[i];
          const dx = L0 + lerp(p.from, p.to, k), dw = lerp(p.w0, p.w, k);
          const sx = (n.t0 - 0.015) / song.dur * img.width, sw = (n.t1 - n.t0 + 0.03) / song.dur * img.width;
          const lit = play >= n.t0 && play <= n.t1 + 0.05;
          x.drawImage(img, sx, 0, sw, img.height, dx, TOP, dw, SH);
          if (lit) { x.save(); x.globalAlpha = 0.25; x.fillStyle = PAL.ver; x.fillRect(dx, TOP, dw, SH); x.restore(); }
          if (play > n.t0 && play < n.t1 + 1.6) {
            const u = (play - n.t0) / 1.6;
            spirit(x, dx + dw / 2, TOP + n.y0 * SH - 20 - u * 140, 16, t, { alpha: (1 - u) * 0.9, seed: i, color: 'rgba(250,246,236,0.95)', glow: 'rgba(185,55,42,0.5)' });
          }
        });
        if (play > 0 && play < song.dur) {
          let px = L0;
          for (let i = 0; i < song.notes.length; i++) { const n = song.notes[i], p = lay[i]; if (play >= n.t0) px = L0 + p.to + clamp((play - n.t0) / (n.t1 - n.t0 + 0.001)) * p.w; }
          inkStroke(x, [[px, TOP - 20], [px, TOP + SH + 20]], 3, 1, PAL.ver);
        }
        text(x, 'slowed to a quarter speed', L0 + LW, TOP + SH + 70, { size: 30, italic: true, align: 'right', alpha: k * win(t, tBreak, tSeveral, 0.5, 0.4) });
      }
      // a whistle, a click, a buzz
      examples.forEach(([w, kind], i) => {
        const a = win(t, wt('s04', w) - 0.2, tSeveral - 0.2, 0.4, 0.4); if (a <= 0) return;
        const px = 330 + i * 470, py = 760;
        cartouche(x, px, py, 360, 180, { alpha: a });
        glyph(x, kind, px + 40, py + 40, 120, 100, { alpha: a, lw: 5 });
        text(x, `a ${w}`, px + 250, py + 108, { size: 44, italic: true, align: 'center', alpha: a, weight: 600 });
      });
      x.restore();
    }
    // hundreds → a thousand kinds of note
    const g = ease((t - tSeveral + 0.3) / 0.6) * (1 - ease((t - tStrung) / 0.7));
    if (g > 0) {
      const cols = 40, rows = 25, cw = 40, ch = 25, gx = 160, gy = 240;
      const nShow = Math.floor(lerp(0, 400, ease((t - tSeveral) / 1.6)) + lerp(0, 600, ease((t - wt('s04', 'counts')) / 2.4)));
      const r = rng(42);
      for (let i = 0; i < cols * rows; i++) {
        const kind = GLYPHS[Math.floor(r() * GLYPHS.length)], jit = r();
        if (i >= nShow) continue;
        glyph(x, kind, gx + (i % cols) * cw + 4, gy + Math.floor(i / cols) * ch + 2, cw - 10 - jit * 8, ch - 4, { alpha: g * 0.85, lw: 1.6, color: i < 400 ? PAL.ink : PAL.indigo });
      }
      const n = Math.min(nShow, 1000);
      text(x, n >= 1000 ? '1,000+' : n.toLocaleString('en'), 1760, 900, { size: 96, weight: 700, align: 'right', alpha: g, color: n > 400 ? PAL.ver : PAL.ink });
      text(x, n > 420 ? 'kinds of note, across the species' : 'kinds of note in one bird', 1760, 950, { size: 34, italic: true, align: 'right', alpha: g });
    }
    // notes strung into songs; then two hundred songs, then more
    const s1 = ease((t - tStrung) / 0.6) * (1 - ease((t - t200 + 0.4) / 0.6));
    if (s1 > 0) {
      for (let row = 0; row < 4; row++) {
        const r = rng(row * 31 + 5), y = 330 + row * 130;
        for (let j = 0; j < 14; j++) {
          const kk = ease((t - tStrung - row * 0.35 - j * 0.05) / 0.3);
          glyph(x, GLYPHS[Math.floor(r() * GLYPHS.length)], 300 + j * 95, y, 70, 70, { alpha: s1 * kk, lw: 3 });
        }
        text(x, `song ${row + 1}`, 270, y + 50, { size: 30, italic: true, align: 'right', alpha: s1 });
      }
      bracket(x, 300, 300 + 14 * 95 - 25, 300, ease((t - wt('s04', 'three')) / 0.6), '≈ 3 seconds');
    }
    const s2 = ease((t - t200 + 0.4) / 0.6);
    if (s2 > 0) {
      const n = Math.floor(lerp(0, 200, ease((t - t200 + 0.3) / 1.4)) + lerp(0, 60, ease((t - tMore) / 1.2)));
      for (let i = 0; i < n; i++) songTile(x, 170 + (i % 20) * 66, 250 + Math.floor(i / 20) * 50, 58, 40, i, s2, i >= 200 ? PAL.ver : undefined);
      text(x, n >= 250 ? '250+' : `${n}`, 1760, 960, { size: 96, weight: 700, align: 'right', alpha: s2, color: n >= 250 ? PAL.ver : PAL.ink });
      text(x, 'different songs, one male', 1760, 1010, { size: 34, italic: true, align: 'right', alpha: s2 });
    }
  });

  // ===== what he varies =====
  const tWhat = tEndS04, tOne = wt('s05', 'one', 1), tS06 = seg('s06').t0 - 0.3;
  const props = [['高さ', 'Pitch', wt('s05', 'Pitch')], ['形', 'Shape', wt('s05', 'shape')], ['長さ', 'Length', wt('s05', 'Length')],
    ['強さ', 'Loudness', wt('s05', 'Loudness')], ['速さ', 'Speed', wt('s05', 'Speed')], ['音色', 'Texture', wt('s05', 'texture')]];
  props.forEach(([, en, t0]) => { if (!['Shape', 'Texture'].includes(en)) cue(t0, 'demo', { sound: en.toLowerCase() }); });
  cue(wt('s05', 'pure'), 'demo', { sound: 'whistle' });
  cue(wt('s05', 'rising'), 'demo', { sound: 'up' }); cue(wt('s05', 'falling'), 'demo', { sound: 'down' }); cue(wt('s05', 'swooping'), 'demo', { sound: 'swoop' });
  cue(wt('s05', 'harsh'), 'demo', { sound: 'rattle' });
  S(tWhat, tOne, (x, t) => {
    paper(x);
    boardTitle(x, '変化', 'What he varies', ease((t - tWhat) / 0.8));
    const cur = props.reduce((c, p, i) => t >= p[2] - 0.2 ? i : c, -1);
    props.forEach(([jp, en, t0], i) => {
      const a = ease((t - t0 + 0.2) / 0.5); if (a <= 0) return;
      const y = 300 + i * 105, hot = i === cur;
      text(x, jp, 170, y, { font: JP, size: 46, weight: 700, alpha: a, color: hot ? PAL.ver : PAL.ink });
      text(x, en, 300, y, { size: 50, weight: hot ? 700 : 500, alpha: a * (hot ? 1 : 0.55) });
    });
    // demo panel
    const DX = 700, DY = 250, DW = 1080, DH = 620;
    x.save(); x.globalAlpha = ease((t - props[0][2] + 0.4) / 0.5);
    x.strokeStyle = PAL.inkSoft; x.lineWidth = 2; x.strokeRect(DX, DY, DW, DH); x.restore();
    const at = (i) => win(t, props[i][2] - 0.2, (props[i + 1] ? props[i + 1][2] : tOne) - 0.1, 0.35, 0.3);
    // pitch: a whistle climbing and falling between 1 and 8 kHz
    let a = at(0);
    if (a > 0) {
      const yk = k => DY + DH - 60 - (k - 1) / 7 * (DH - 120);
      x.save(); x.globalAlpha = a;
      for (let k = 1; k <= 8; k++) { text(x, `${k}`, DX + 60, yk(k) + 10, { size: 28, align: 'right' }); inkStroke(x, [[DX + 70, yk(k)], [DX + 86, yk(k)]], 2); }
      text(x, 'kHz', DX + 60, DY + 40, { size: 28, italic: true, align: 'right' });
      const u = (t - props[0][2]) / 2.6, f = 1 + 7 * (0.5 - 0.5 * Math.cos(clamp(u) * Math.PI * 2 * 0.75));
      const y = yk(f);
      inkStroke(x, [[DX + 360, y + 4], [DX + 500, y], [DX + 640, y - 4]], 10);
      x.restore();
    }
    // shape: rising, falling, swooping
    a = at(1);
    if (a > 0) [['up', 'rising', 'rising'], ['down', 'falling', 'falling'], ['swoop', 'swooping', 'swooping']].forEach(([g, w, lbl], i) => {
      const k = ease((t - wt('s05', w) + 0.1) / 0.6);
      glyph(x, g, DX + 90 + i * 330, DY + 150, 260, 300, { alpha: a, lw: 9, k });
      text(x, lbl, DX + 220 + i * 330, DY + 540, { size: 38, italic: true, align: 'center', alpha: a * k });
    });
    // length: three notes and a scale bar
    a = at(2);
    if (a > 0) {
      [0.02, 0.06, 0.18].forEach((d, i) => {
        const k = ease((t - props[2][2] - i * 0.35) / 0.4), w = d / 0.2 * 800;
        inkStroke(x, [[DX + 140, DY + 160 + i * 130], [DX + 140 + w * k, DY + 160 + i * 130]], 12, 1);
        text(x, `${Math.round(d * 1000)} ms`, DX + 170 + w, DY + 172 + i * 130, { size: 32, italic: true, alpha: a * k });
      });
      bracket(x, DX + 140, DX + 540, DY + 560, ease((t - wt('s05', 'hundredths')) / 0.5), 'a tenth of a second', { size: 30 });
    }
    // loudness: same note, more and less ink
    a = at(3);
    if (a > 0) {
      const p = 0.5 + 0.5 * Math.sin((t - props[3][2]) * 5);
      x.save(); x.globalAlpha = a * (0.35 + 0.65 * p);
      inkStroke(x, [[DX + 300, DY + 320], [DX + 520, DY + 300], [DX + 760, DY + 320]], 8 + 34 * p);
      x.restore();
      text(x, 'more ink, more volume', DX + DW / 2, DY + 520, { size: 34, italic: true, align: 'center', alpha: a });
    }
    // speed: a trill that speeds up
    a = at(4);
    if (a > 0) {
      let px = DX + 100, sp = 90; const t0 = props[4][2];
      for (let i = 0; i < 40 && px < DX + DW - 60; i++) {
        const k = ease((t - t0 - i * 0.07) / 0.15);
        inkStroke(x, [[px, DY + 220], [px + 8, DY + 420]], 7, k);
        px += sp; sp = Math.max(14, sp * 0.86);
      }
      text(x, 'accelerando', DX + DW / 2, DY + 540, { size: 34, italic: true, align: 'center', alpha: a });
    }
    // texture: a pure whistle against a harsh rattle
    a = at(5);
    if (a > 0) {
      const k1 = ease((t - wt('s05', 'pure')) / 0.6), k2 = ease((t - wt('s05', 'harsh')) / 0.6);
      glyph(x, 'whistle', DX + 100, DY + 200, 380, 160, { alpha: a, lw: 6, k: k1 });
      glyph(x, 'buzz', DX + 600, DY + 160, 380, 260, { alpha: a, lw: 5, k: k2 });
      text(x, 'pure', DX + 290, DY + 500, { size: 38, italic: true, align: 'center', alpha: a * k1 });
      text(x, 'harsh', DX + 790, DY + 500, { size: 38, italic: true, align: 'center', alpha: a * k2 });
    }
  });
  const tTwo = wt('s05', 'two'), tOnceN = wt('s05', 'notes', 1);
  cue(tOnceN, 'demo', { sound: 'twovoice' });
  S(tOne, tS06, (x, t) => {
    kb(x, IMG.p06_twovoice, t, tOne, tS06 + 1, { x: 0.45, y: 0.45, z: 1.05 }, { x: 0.55, y: 0.4, z: 1.25 });
    mist(x, t, { y: 0.85, alpha: 0.18 });
    tag(x, 'the syrinx: two sides, two voices', 1060, 820, win(t, tTwo - 0.2, tS06 + 0.5));
  });

  // ===== hierarchy =====
  const tPack = wt('s06', 'packages'), tNote = wt('s06', 'Note'), tSongW = wt('s06', 'song'), tPkgW = wt('s06', 'package'), tSeq = wt('s06', 'sequence');
  S(tS06, card(2).t0, (x, t) => {
    paper(x);
    boardTitle(x, '階層', 'Order, and levels of order', ease((t - tS06) / 0.8));
    // packages: songs learned in small batches
    const p1 = ease((t - tPack + 0.4) / 0.6) * (1 - ease((t - tNote + 0.5) / 0.6));
    if (p1 > 0) {
      const groups = [3, 5, 4, 3]; let i = 0, px = 200;
      groups.forEach((n, gi) => {
        const x0 = px;
        for (let j = 0; j < n; j++, i++) { songTile(x, px, 470, 70, 60, i + 11, p1 * ease((t - tPack - i * 0.06) / 0.3)); px += 82; }
        bracket(x, x0, px - 12, 440, p1 * ease((t - tPack - 0.6 - gi * 0.3) / 0.5), `package ${gi + 1}`, { size: 30, italic: true });
        px += 40;
      });
      text(x, 'learned together, kept together', W / 2, 700, { size: 40, italic: true, align: 'center', alpha: p1 * ease((t - wt('s06', 'together')) / 0.6) });
    }
    // nested frames, zooming out a level at each word
    const lv = [tNote, tSongW, tPkgW, tSeq].reduce((c, tt, i) => t >= tt - 0.2 ? i + 1 : c, 0);
    if (lv > 0) {
      const f = [1, 0.62, 0.42, 0.3][lv - 1], fz = lerp(f / 0.7, f, ease((t - [tNote, tSongW, tPkgW, tSeq][lv - 1] + 0.2) / 0.6));
      x.save(); x.translate(W / 2, 600); x.scale(fz, fz);
      const al = ease((t - tNote + 0.2) / 0.5);
      x.globalAlpha = al;
      glyph(x, 'swoop', -60, -45, 120, 90, { lw: 7 });
      const frame = (w, h, label, jp, k) => {
        if (k <= 0) return;
        x.save(); x.globalAlpha = al * k; x.strokeStyle = PAL.ink; x.lineWidth = 4 / fz; x.strokeRect(-w / 2, -h / 2, w, h);
        text(x, label, -w / 2 + 10, -h / 2 - 16, { size: 44 / Math.sqrt(fz), italic: true, weight: 600 });
        text(x, jp, w / 2 - 10, -h / 2 - 16, { size: 44 / Math.sqrt(fz), font: JP, align: 'right', color: PAL.ver });
        x.restore();
      };
      frame(200, 170, 'note', '音', 1);
      if (lv >= 2) { const r = rng(3); for (let j = -3; j <= 3; j++) if (j) glyph(x, GLYPHS[Math.floor(r() * 10)], j * 130 - 50, -40, 100, 80, { lw: 6, alpha: ease((t - tSongW) / 0.5) }); frame(1000, 260, 'song', '歌', ease((t - tSongW + 0.2) / 0.4)); }
      if (lv >= 3) { for (const dy of [-330, 330]) songTile(x, -500, dy - 110, 1000, 220, dy, ease((t - tPkgW) / 0.5)); frame(1120, 1000, 'package', '組', ease((t - tPkgW + 0.2) / 0.4)); }
      if (lv >= 4) { for (const dx of [-1300, 1300]) { x.save(); x.globalAlpha = ease((t - tSeq) / 0.5) * 0.7; x.strokeRect(dx - 520, -480, 1040, 960); for (let j = 0; j < 3; j++) songTile(x, dx - 470, -420 + j * 300, 940, 220, dx + j, 1); x.restore(); } frame(3900, 1260, 'sequence', '連', ease((t - tSeq + 0.2) / 0.4)); }
      x.restore();
    }
    if (t > wt('s06', 'hierarchy') - 0.3) tag(x, 'a hierarchy', W / 2, 930, ease((t - wt('s06', 'hierarchy') + 0.3) / 0.5), { align: 'center', size: 40 });
  });

  // ===== 参 alphabet and grammar =====
  const tEng = wt('s07', 'English'), tBut = wt('s07', 'But'), tLarge = wt('s07', 'large') - 2.0;
  S(card(2).t1, tEng, (x, t) => {
    kb(x, IMG.p07_storyteller, t, card(2).t1, tEng + 1, { x: 0.3, y: 0.45, z: 1.15 }, { x: 0.5, y: 0.4, z: 1.05 });
    tag(x, 'phonemes: the sounds that change a word', 1100, 820, win(t, wt('s07', 'phonemes') - 0.2, tEng + 0.5));
  });
  S(tEng, tBut, (x, t) => {
    paper(x);
    boardTitle(x, '素', 'Building blocks', ease((t - tEng) / 0.8));
    bars(x, [
      ['English phonemes', 44, PAL.ink, '≈ 44'],
    ], ease((t - tEng) / 0.6), { y: 320, scale: 1.3 });
    const k2 = ease((t - wt('s07', 'across') + 0.2) / 0.6);
    if (k2 > 0) bars(x, [['Phonemes across the world’s languages', 140, PAL.indigo, '≈ 11 to 100+', 11]], k2, { y: 460, scale: 1.3 });
    const k3 = ease((t - wt('s07', 'raw') + 0.2) / 0.8);
    if (k3 > 0) bars(x, [['Nightingale note types: one bird', 400, PAL.ochre, 'several hundred'], ['Nightingale note types: the species', 1000, PAL.ver, '1,000+']], k3, { y: 600, scale: 1.3, gap: 140 });
  });
  S(tBut, tLarge, (x, t) => {
    paper(x);
    boardTitle(x, '文法', 'Our trick lies elsewhere', ease((t - tBut) / 0.8));
    const tiers = [['forty-odd sounds', wt('s07', 'Forty'), 260], ['thousands of syllables', wt('s07', 'thousands'), 640],
      ['tens of thousands of words', wt('s07', 'tens'), 1100], ['an unlimited number of sentences', wt('s07', 'unlimited'), 1700]];
    tiers.forEach(([lbl, t0, w], i) => {
      const k = ease((t - t0 + 0.2) / 0.6); if (k <= 0) return;
      const y = 300 + i * 160, ww = w * easeOut(k);
      x.save(); x.globalAlpha = k * 0.12 + 0.05 * i; x.fillStyle = i === 3 ? PAL.ver : PAL.indigo; x.fillRect(W / 2 - ww / 2, y - 50, ww, 100); x.restore();
      inkStroke(x, [[W / 2 - ww / 2, y + 50], [W / 2 + ww / 2, y + 50]], 3, k);
      text(x, lbl, W / 2, y + 14, { size: 46, align: 'center', italic: i === 3, weight: 600, alpha: k, color: i === 3 ? PAL.ver : PAL.ink });
    });
    text(x, '∞', W / 2 + 820, 820, { size: 120, align: 'center', color: PAL.ver, alpha: ease((t - wt('s07', 'sentences')) / 0.6) });
  });
  S(tLarge, card(3).t0, (x, t) => {
    paper(x);
    const k1 = ease((t - tLarge) / 0.6), k2 = ease((t - wt('s07', 'have') + 0.4) / 0.6), k3 = ease((t - wt('s07', 'grammar') + 0.1) / 0.6);
    cartouche(x, 120, 200, 800, 700, { alpha: k1 }); cartouche(x, 1000, 200, 800, 700, { alpha: k2 });
    text(x, 'the nightingale', 520, 300, { size: 52, italic: true, align: 'center', alpha: k1, weight: 600 });
    text(x, 'a large alphabet', 520, 360, { size: 38, align: 'center', alpha: k1 });
    const r = rng(9);
    for (let i = 0; i < 120; i++) glyph(x, GLYPHS[Math.floor(r() * 10)], 170 + (i % 12) * 58, 420 + Math.floor(i / 12) * 44, 44, 34, { alpha: k1 * ease((t - tLarge - i * 0.01) / 0.3), lw: 2 });
    text(x, 'us', 1400, 300, { size: 52, italic: true, align: 'center', alpha: k2, weight: 600 });
    text(x, 'a small alphabet — and grammar', 1400, 360, { size: 38, align: 'center', alpha: k2 });
    const leaves = ['fox', 'the', 'crossed', 'river', 'the'].map((w, i) => [1110 + i * 145, 800, w]);
    leaves.forEach(([lx, ly, w], i) => glyph(x, GLYPHS[i * 2], lx - 30, ly - 10, 70, 50, { alpha: k2, lw: 3 }));
    if (k3 > 0) {
      const nodes = [[1185, 650], [1475, 650], [1620, 560], [1400, 470]];
      const edges = [[0, leaves[0]], [0, leaves[1]], [1, leaves[3]], [1, leaves[4]], [2, nodes[1]], [2, leaves[2]], [3, nodes[0]], [3, nodes[2]]];
      edges.forEach(([ni, p], i) => { const n = nodes[ni]; inkStroke(x, [[n[0], n[1]], [p[0] + 5, p[1] - 14]], 4, ease((t - wt('s07', 'grammar') - i * 0.08) / 0.4), PAL.ver); });
      nodes.forEach(n => { x.save(); x.globalAlpha = k3; x.fillStyle = PAL.ver; x.beginPath(); x.arc(n[0], n[1], 10, 0, 7); x.fill(); x.restore(); });
    }
  });

  // ===== 四 what is he saying? =====
  const tNo = wt('s08', 'There'), tMsg = wt('s08', 'message'), tOld = wt('s08', 'Older'), tHow = wt('s08', 'how', 0);
  const tMatch = wt('s08', 'matching'), tSame = wt('s08', 'same'), tOver = wt('s08', 'overlapping'), tStart = wt('s08', 'Start');
  S(card(3).t1, tNo, (x, t) => {
    kb(x, IMG.p01_wood, t, card(3).t1, tNo + 1, { x: 0.45, y: 0.5, z: 1.1 }, { x: 0.5, y: 0.45, z: 1.25 });
    mist(x, t, { y: 0.6, alpha: 0.2 });
    tag(x, 'as far as we know: no words', W / 2, 800, win(t, wt('s08', 'As') - 0.2, tNo + 0.4), { align: 'center' });
  });
  S(tNo, tMsg - 0.4, (x, t) => {
    kb(x, IMG.p08_foxrain, t, tNo, tMsg + 0.6, { x: 0.45, y: 0.5, z: 1.05 }, { x: 0.5, y: 0.45, z: 1.15 });
    const kf = win(t, wt('s08', 'fox') - 0.1, tMsg, 0.4, 0.4), kr = win(t, wt('s08', 'rain') - 0.1, tMsg, 0.4, 0.4);
    tag(x, 'no song for “fox”', 250, 160, kf); tag(x, 'no song for “rain”', 1250, 760, kr);
  });
  const claims = [['I am here.', wt('s08', 'I', 0)], ['I am male.', wt('s08', 'I', 1)], ['I am healthy, and experienced.', wt('s08', 'I', 2)]];
  S(tMsg - 0.4, tOld, (x, t) => {
    kb(x, IMG.p02_hero, t, tMsg - 0.4, tOld + 1, { x: 0.3, y: 0.42, z: 1.35 }, { x: 0.26, y: 0.42, z: 1.5 });
    tag(x, 'the message is the singer', 1100, 180, ease((t - tMsg) / 0.5), { italic: true });
    claims.forEach(([s, t0], i) => {
      const a = ease((t - t0 + 0.1) / 0.5); if (a <= 0) return;
      const px = 1150 + i * 40, py = 360 + i * 170;
      cartouche(x, px, py, 640, 120, { alpha: a });
      text(x, s, px + 320, py + 76, { size: 44, align: 'center', italic: true, alpha: a, weight: 600 });
    });
  });
  S(tOld, tHow, (x, t) => {
    paper(x);
    boardTitle(x, '年', 'Repertoire grows with age', ease((t - tOld) / 0.8));
    [[6, 'young'], [11, ''], [17, 'older']].forEach(([n, lbl], i) => {
      const px = 520 + i * 360;
      for (let j = 0; j < n; j++) songTile(x, px, 860 - j * 34, 160, 28, i * 50 + j, ease((t - tOld - 0.3 - i * 0.5 - j * 0.04) / 0.3));
      text(x, lbl, px + 80, 940, { size: 40, italic: true, align: 'center', alpha: ease((t - tOld - i * 0.5) / 0.5) });
    });
    inkStroke(x, [[480, 960], [1500, 960]], 3, ease((t - tOld) / 1.2));
    text(x, 'older males tend to have larger repertoires', W / 2, 300, { size: 40, align: 'center', alpha: ease((t - wt('s08', 'repertoires')) / 0.6) });
    text(x, 'so variety itself may be the message', W / 2, 360, { size: 40, italic: true, align: 'center', color: PAL.ver, alpha: ease((t - wt('s08', 'variety')) / 0.6) });
    text(x, 'illustrative, not to scale', 1800, 1010, { size: 26, italic: true, align: 'right', alpha: 0.7 * ease((t - tOld) / 1) });
  });
  // matching and overlapping, on two lanes over the rivals
  S(tHow, card(4).t0, (x, t) => {
    kb(x, IMG.p05_rivals, t, tHow, card(4).t0 + 1, { x: 0.5, y: 0.3, z: 1.15 }, { x: 0.5, y: 0.32, z: 1.22 });
    const sa = ease((t - tHow) / 0.6);
    strip(x, 640, 360, sa);
    if (sa <= 0) return;
    const LX0 = 300, LX1 = 1780, yA = 740, yB = 880;
    lane(x, yA, LX0, LX1, 'rival', sa); lane(x, yB, LX0, LX1, 'he', sa);
    // song events: [lane, x, width, kind, appear time]
    const ev = [
      [0, 320, 150, 2, tHow + 0.3], [1, 520, 140, 3, tHow + 1.1], [0, 720, 160, 1, wt('s08', 'Answer')],
      [1, 920, 160, 1, tSame + 0.1], [0, 1130, 170, 0, tStart + 0.1], [1, 1220, 170, 2, tOver - 0.2],
    ];
    ev.forEach(([ln, px, w, kind, t0], i) => {
      const k = ease((t - t0) / 0.6);
      block(x, px, ln ? yB : yA, w * k, kind, sa, { hot: i === 5 && t > tOver });
    });
    const km = ease((t - tMatch + 0.2) / 0.5) * (1 - ease((t - tStart + 0.3) / 0.5));
    if (km > 0) {
      const pts = []; for (let i = 0; i <= 30; i++) { const u = i / 30; pts.push([lerp(800, 1000, u), lerp(yA + 26, yB - 26, u) - Math.sin(u * Math.PI) * 40]); }
      inkStroke(x, pts, 4, km, PAL.ver);
      tag(x, 'matching: the same song back — a challenge', 600, 660, km, { size: 30 });
    }
    const ko = ease((t - tOver + 0.1) / 0.4);
    if (ko > 0) {
      x.save(); x.globalAlpha = ko * (0.35 + 0.25 * Math.sin(t * 9)); x.fillStyle = PAL.ver; x.fillRect(1220, yA - 40, 80, yB - yA + 80); x.restore();
      tag(x, 'overlapping: singing over him — escalation', 820, 660, ko, { size: 30, color: PAL.ver });
    }
  });

  // ===== 五 bits and beads (speculative) =====
  const tSpec = wt('s09', 'speculation'), tS10 = seg('s10').t0, tEndS10 = card(5).t0;
  cue(tSpec, 'stamp');
  O(tSpec, tEndS10, (x, t) => speculative(x, win(t, tSpec, tEndS10, 0.3, 0.4)));
  O(tSpec - 0.1, tSpec + 1.6, (x, t) => {          // the stamp landing
    const k = ease((t - tSpec) / 0.18), a = 1 - ease((t - tSpec - 1.0) / 0.5);
    x.save(); x.globalAlpha = a; x.translate(W / 2, H / 2); x.scale(lerp(2.4, 1, k), lerp(2.4, 1, k));
    seal(x, 0, 0, 260, '推測', { alpha: k }); x.restore();
  });
  const lines = [
    ['If he chose freely among 200 songs…', wt('s09', 'If')],
    ['log₂ 200 ≈ 7.6 bits per song', wt('s09', 'each')],
    ['one song every 6–7 seconds', wt('s09', 'At')],
    ['≈ 1 bit per second', wt('s09', 'that')],
    ['human speech: ≈ 39 bits per second', wt('s09', 'Human')],
  ];
  const tOnThose = wt('s09', 'those') - 0.3;
  S(card(4).t1, tS10, (x, t) => {
    paper(x);
    boardTitle(x, '算', 'Rough arithmetic', ease((t - card(4).t1) / 0.8));
    const up = ease((t - tOnThose + 0.3) / 0.8);
    x.save(); x.translate(0, -up * 120); x.globalAlpha = 1 - up * 0.65;
    lines.forEach(([s, t0], i) => {
      const hot = i === 3 || i === 4;
      brushText(x, s, 200, 300 + i * 92, ease((t - t0 + 0.1) / 0.9), { size: hot ? 56 : 48, weight: hot ? 700 : 500, color: i === 3 ? PAL.ver : i === 4 ? PAL.indigo : PAL.ink, italic: i === 0 });
    });
    text(x, 'Coupé et al., 2019 · 17 languages', 1100, 300 + 4 * 92, { size: 28, italic: true, alpha: ease((t - wt('s09', 'measured')) / 0.6) });
    // a real night: song starts in two minutes of the Berlin recording
    const kb2 = ease((t - lines[2][1] + 0.1) / 0.6) * (1 - ease((t - tOnThose) / 0.6));
    if (kb2 > 0) {
      const sx = 1100, sw = 680, sy = 440;
      x.save(); x.globalAlpha = kb2;
      inkStroke(x, [[sx, sy + 34], [sx + sw, sy + 34]], 2);
      A.berlinSongs.forEach(([a, b], i) => { if (a > 60) return; const k = ease((t - lines[2][1] - i * 0.08) / 0.2); x.fillStyle = PAL.indigo; x.fillRect(sx + a / 60 * sw, sy + 10, Math.max(4, (b - a) / 60 * sw) * k, 24); });
      text(x, 'one minute of a real nightingale, Berlin', sx, sy + 76, { size: 26, italic: true });
      x.restore();
    }
    // a second of speech against half a minute of song
    const kc = ease((t - tOnThose) / 0.6);
    if (kc > 0) {
      const y1 = 800, y2 = 930;
      text(x, 'speech, 1 s', 180, y1 + 12, { size: 36, italic: true, alpha: kc });
      text(x, 'song, ≈ 30 s', 180, y2 + 12, { size: 36, italic: true, alpha: kc });
      for (let i = 0; i < 39; i++) bead(x, 420 + i * 36, y1, 13, kc * ease((t - tOnThose - 0.3 - i * 0.012) / 0.15), { light: '#8fa3c9', dark: PAL.indigo });
      const fill = ease((t - wt('s09', 'half') + 0.6) / 1.2) * 39;
      for (let i = 0; i < 39; i++) bead(x, 420 + i * 36, y2, 13, kc * (i < fill ? 1 : 0.15));
    }
  });
  cue(tOnThose + 0.3, 'beads', { n: 39, dur: 0.5 });

  const tTreat = wt('s10', 'Treat'), tSo = wt('s10', 'So'), tA = wt('s10', 'rules') + 1.0, tHum = wt('s10', 'Human'), tTen = wt('s10', 'Ten', 1);
  const tBut2 = wt('s10', 'But', 1), tThat = wt('s10', 'That', 1), tGiven = wt('s10', 'Given'), tFlip = wt('s10', 'Now');
  S(tS10 - 0.3, tTreat, (x, t) => {
    kb(x, IMG.p09_karakuri, t, tS10 - 0.3, tTreat + 1, { x: 0.35, y: 0.4, z: 1.2 }, { x: 0.45, y: 0.45, z: 1.05 });
    tag(x, 'a machine that speaks only “nightingale”', 1060, 860, win(t, wt('s10', 'computer'), tTreat + 0.4));
    tag(x, 'the voice, not the meanings', 1260, 120, win(t, wt('s10', 'just'), tTreat + 0.4), { italic: true });
  });
  S(tTreat, tSo, (x, t) => {
    paper(x);
    boardTitle(x, '器', 'The raw channel', ease((t - tTreat) / 0.8));
    [['1,000 kinds of note → log₂ 1000 ≈ 10 bits a note', wt('s10', 'Treat')], ['× 10 notes a second', wt('s10', 'sung')], ['≈ 100 bits per second, raw', wt('s10', 'raw')]]
      .forEach(([s, t0], i) => brushText(x, s, 200, 300 + i * 90, ease((t - t0 + 0.1) / 0.9), { size: i === 2 ? 58 : 48, weight: i === 2 ? 700 : 500, color: i === 2 ? PAL.ver : PAL.ink }));
    const kb3 = ease((t - wt('s10', 'more') + 0.3) / 0.7);
    if (kb3 > 0) bars(x, [['the nightingale’s voice as a channel', 100, PAL.ver, '≈ 100 bits/s'], ['human speech', 39, PAL.indigo, '≈ 39 bits/s']], kb3, { y: 650, scale: 11, gap: 140 });
    text(x, 'capacity, not meaning', 1760, 1000, { size: 30, italic: true, align: 'right', alpha: kb3 });
  });
  S(tSo, tA, (x, t) => {
    cover(x, IMG.p09_karakuri, 0.5, 0.45, 1.1 + (t - tSo) * 0.01);
    shade(x, 0.6);
    brushText(x, 'The bottleneck isn’t the voice.', W / 2, 470, ease((t - tSo) / 1.0), { size: 80, italic: true, align: 'center', color: PAL.cream, weight: 600 });
    brushText(x, 'It’s the rules.', W / 2, 610, ease((t - wt('s10', 'its', 1)) / 0.8), { size: 96, align: 'center', color: '#e8a28f', weight: 700 });
  });
  cue(tA + 0.8, 'beads', { n: 10, dur: 5 });
  S(tA, tHum, (x, t) => {                         // a chain: beads on a string
    paper(x);
    boardTitle(x, '鎖', 'A chain', ease((t - tA) / 0.8));
    const sy = 560, pts = []; for (let i = 0; i <= 120; i++) { const u = i / 120; pts.push([80 + u * 1760, sy + Math.sin(u * 7 + t * 0.6) * 40]); }
    inkStroke(x, pts, 3, ease((t - tA) / 1.2));
    const r = rng(77);
    for (let i = 0; i < 10; i++) {
      const u = (i + 0.5) / 10 + ((t - tA) * 0.012), px = 80 + (u % 1) * 1760, py = sy + Math.sin((u % 1) * 7 + t * 0.6) * 40;
      bead(x, px, py, 46, ease((t - tA - 0.8 - i * 0.18) / 0.3), { glyph: GLYPHS[Math.floor(r() * 10)] });
    }
    text(x, 'each song leads to the next', W / 2, 760, { size: 44, italic: true, align: 'center', alpha: ease((t - wt('s10', 'Each', 1)) / 0.6) });
    text(x, 'a finite-state chain, as far as we can tell', W / 2, 820, { size: 32, align: 'center', alpha: 0.75 * ease((t - wt('s10', 'beads')) / 0.6) });
  });
  S(tHum, tTen, (x, t) => {                       // nesting
    paper(x);
    boardTitle(x, '入れ子', 'Nesting', ease((t - tHum) / 0.8));
    const parts = [
      ['the fox ', 0], ['[ ', 1], ['that the hunter ', 1], ['[ ', 2], ['who the crow mocked ', 2], ['] ', 2], ['chased ', 1], ['] ', 1], ['escaped', 0],
    ];
    const cols = [PAL.ink, PAL.indigo, PAL.ver];
    x.save(); x.font = `600 54px ${SERIF}`;
    const total = parts.reduce((s, [p]) => s + x.measureText(p).width, 0); x.restore();
    let px = W / 2 - total / 2;
    const order = [0, 8, 1, 7, 2, 6, 3, 5, 4], tP = wt('s10', 'Phrases'), tI = wt('s10', 'Ideas');
    parts.forEach(([p, d], i) => {
      x.save(); x.font = `600 54px ${SERIF}`; const w = x.measureText(p).width; x.restore();
      const rank = order.indexOf(i), a = ease((t - (rank < 2 ? tHum : rank < 6 ? tP : tI) - (rank % 4) * 0.25) / 0.5);
      text(x, p, px, 560, { size: 54, weight: 600, color: cols[d], alpha: a });
      if (p.startsWith('[')) { x.save(); x.globalAlpha = a * 0.13; x.fillStyle = cols[d]; x.fillRect(px - 6, 470 + d * 6, 10, 130 - d * 12); x.restore(); }
      px += w;
    });
    text(x, 'phrases inside phrases — with no fixed limit', W / 2, 760, { size: 42, italic: true, align: 'center', alpha: ease((t - wt('s10', 'limit')) / 0.6) });
  });
  S(tTen, tBut2, (x, t) => {                      // the size of the space
    paper(x);
    boardTitle(x, '数', 'Ten songs in a row', ease((t - tTen) / 0.8));
    const r = rng(Math.floor(t * 12));
    for (let i = 0; i < 10; i++) bead(x, 330 + i * 140, 420, 52, ease((t - tTen - i * 0.08) / 0.3), { glyph: GLYPHS[Math.floor(r() * 10)] });
    const k = ease((t - wt('s10', 'arranged')) / 0.6);
    text(x, '200', 820, 700, { size: 140, weight: 700, align: 'right', alpha: k });
    text(x, '10', 830, 630, { size: 70, weight: 700, alpha: k });
    text(x, '≈ 10', 1180, 700, { size: 140, weight: 700, align: 'right', alpha: ease((t - wt('s10', 'power')) / 0.6), color: PAL.ver });
    text(x, '23', 1190, 630, { size: 70, weight: 700, alpha: ease((t - wt('s10', 'twenty')) / 0.6), color: PAL.ver });
    text(x, 'possible sequences', 1250, 700, { size: 44, italic: true, alpha: ease((t - wt('s10', 'ways')) / 0.6) });
    tag(x, 'Vast.', W / 2, 820, ease((t - wt('s10', 'Vast')) / 0.4), { align: 'center', size: 44 });
  });
  const tCombine = wt('s10', 'combine');
  cue(tCombine + 0.6, 'demo', { sound: 'swap' });
  S(tBut2, tThat, (x, t) => {                     // beads vs a grammar that composes meaning
    paper(x);
    boardTitle(x, '意', 'Strings and meanings', ease((t - tBut2) / 0.8));
    const r = rng(5);
    for (let i = 0; i < 7; i++) bead(x, 170 + i * 100, 500, 38, ease((t - tBut2 - i * 0.06) / 0.3), { glyph: GLYPHS[Math.floor(r() * 10)] });
    text(x, 'still just a string of beads', 470, 620, { size: 38, italic: true, align: 'center', alpha: ease((t - wt('s10', 'string', 1)) / 0.6) });
    const kg = ease((t - wt('s10', 'Grammar') + 0.2) / 0.6);
    if (kg > 0) {
      const swap = ease((t - tCombine - 0.6) / 0.5);
      const leaf = [['the fox', 1080], ['crossed', 1330], ['the', 1530], [swap > 0.5 ? 'moon' : 'river', 1700]];
      leaf.forEach(([w, lx], i) => text(x, w, lx, 760, { size: 46, align: 'center', weight: 600, alpha: kg, color: i === 3 && swap > 0.5 ? PAL.ver : PAL.ink }));
      const N = [[1615, 640], [1470, 540], [1280, 440]];
      [[N[0], [1530, 720]], [N[0], [1700, 720]], [N[1], [1330, 720]], [N[1], N[0]], [N[2], [1080, 720]], [N[2], N[1]]]
        .forEach(([a, b], i) => inkStroke(x, [a, b], 4, ease((t - wt('s10', 'Grammar') - i * 0.12) / 0.4), PAL.ver));
      N.forEach(n => { x.save(); x.globalAlpha = kg; x.fillStyle = PAL.ver; x.beginPath(); x.arc(n[0], n[1], 10, 0, 7); x.fill(); x.restore(); });
      text(x, swap > 0.5 ? '“the fox crossed the moon”' : '“the fox crossed the river”', 1390, 880, { size: 40, italic: true, align: 'center', alpha: kg });
      if (swap > 0) text(x, 'a meaning no one has heard before', 1390, 940, { size: 32, align: 'center', color: PAL.ver, alpha: swap });
    }
  });
  S(tThat, tGiven, (x, t) => {
    paper(x);
    brushText(x, 'Not how many signals you can make…', W / 2, 460, ease((t - wt('s10', 'Not', 1) + 0.1) / 1.0), { size: 66, italic: true, align: 'center' });
    brushText(x, '…but how many thoughts they can hold.', W / 2, 600, ease((t - wt('s10', 'but', 2) + 0.1) / 1.0), { size: 66, italic: true, align: 'center', color: PAL.ver, weight: 600 });
  });
  S(tGiven, tEndS10, (x, t) => {
    kb(x, IMG.p02_hero, t, tGiven, tEndS10 + 1, { x: 0.35, y: 0.45, z: 1.4 }, { x: 0.4, y: 0.5, z: 1.1 });
    mist(x, t, { y: 0.82, alpha: 0.15 });
    tag(x, 'a song with a single subject', 1180, 820, win(t, wt('s10', 'Without'), tEndS10 + 0.4), { italic: true });
  });

  // ===== 六 how far it carries =====
  const tBer = wt('s11', 'Berlin') - 0.5;
  S(card(5).t1, tBer, (x, t) => {
    const fr0 = { x: 0.3, y: 0.45, z: 1.25 }, fr1 = { x: 0.5, y: 0.5, z: 1.02 };
    kb(x, IMG.p10_valley, t, card(5).t1, tBer + 1, fr0, fr1);
    const k = ease((t - card(5).t1) / (tBer + 1 - card(5).t1));
    const [bx, by, s] = plateToScreen(IMG.p10_valley, lerp(fr0.x, fr1.x, k), lerp(fr0.y, fr1.y, k), lerp(fr0.z, fr1.z, k), 0.15, 0.41);
    x.save();
    for (let i = 0; i < 6; i++) {                  // rings of song spreading over the valley
      const u = ((t - card(5).t1) / 1.6 - i / 6 * 1) % 1; if (u < 0) continue;
      x.globalAlpha = 0.5 * (1 - u); x.strokeStyle = PAL.cream; x.lineWidth = 3;
      x.beginPath(); x.arc(bx, by, 30 + u * 1500 * s, 0, Math.PI * 2); x.stroke();
    }
    const kk = ease((t - wt('s11', 'kilometer') + 0.2) / 0.6);
    if (kk > 0) { x.globalAlpha = kk; x.setLineDash([16, 12]); x.strokeStyle = '#e8a28f'; x.lineWidth = 4; x.beginPath(); x.arc(bx, by, 1150 * s, -0.5, 0.9); x.stroke(); x.setLineDash([]); }
    x.restore();
    if (kk > 0) tag(x, '≈ 1 km — perhaps more', bx + 1150 * s * 0.75, by + 60, kk, { color: PAL.ver });
    tag(x, '≈ 90 dB at 1 m', 1280, 140, win(t, wt('s11', 'decibels') - 0.3, tBer + 0.4));
    tag(x, '≈ a lawnmower', 1340, 260, win(t, wt('s11', 'lawnmower') - 0.2, tBer + 0.4), { italic: true });
    tag(x, 'from a body of ≈ 20 g', 1300, 380, win(t, wt('s11', 'grams') - 0.4, tBer + 0.4));
    tag(x, 'still air, quiet wood: sound carries', 220, 900, win(t, wt('s11', 'still') - 0.2, wt('s11', 'calm')));
  });
  S(tBer, card(6).t0, (x, t) => {
    kb(x, IMG.p11_city, t, tBer, card(6).t0 + 1, { x: 0.55, y: 0.45, z: 1.05 }, { x: 0.7, y: 0.35, z: 1.2 });
    const k = ease((t - wt('s11', 'louder') + 0.2) / 2.0), a = ease((t - tBer - 0.5) / 0.6);
    if (a > 0) {
      cartouche(x, 1480, 420, 360, 520, { alpha: a });
      [['traffic', PAL.ink, 0.35 + 0.5 * k + 0.04 * Math.sin(t * 23)], ['song', PAL.ver, 0.3 + 0.55 * k]].forEach(([lbl, col, v], i) => {
        const bx = 1560 + i * 140;
        x.save(); x.globalAlpha = a; x.strokeStyle = PAL.ink; x.lineWidth = 2; x.strokeRect(bx, 480, 60, 340);
        x.fillStyle = col; x.fillRect(bx + 6, 474 + 340 - 340 * v, 48, 340 * v); x.restore();
        text(x, lbl, bx + 30, 880, { size: 32, italic: true, align: 'center', alpha: a });
      });
      text(x, 'Brumm, 2004', 1660, 920, { size: 24, italic: true, align: 'center', alpha: a * 0.8 });
    }
  });

  // ===== 七 a wood full of voices =====
  const t12 = card(6).t1, tTurns = wt('s12', 'Neighbours'), tOther = wt('s12', 'Other'), tList = wt('s12', 'Listeners');
  const tEaves = wt('s12', 'eavesdroppers') - 0.8, tNet = wt('s12', 'wood') - 0.3, tEnd12 = card(7).t0;
  const BIRDS = [[0.11, 0.08], [0.1, 0.47], [0.5, 0.42], [0.86, 0.05], [0.87, 0.45], [0.92, 0.8]];
  S(t12, tEnd12, (x, t) => {
    let fr = { x: 0.5, y: 0.5, z: 1.02 };
    if (t > tEaves) { const k = ease((t - tEaves) / 1.5) * (1 - ease((t - tNet) / 1.5)); fr = { x: 0.5, y: 0.45, z: lerp(1.02, 1.55, k) }; }
    cover(x, IMG.p12_chorus, fr.x, fr.y, fr.z);
    const P = BIRDS.map(([bx, by]) => plateToScreen(IMG.p12_chorus, fr.x, fr.y, fr.z, bx, by));
    // turn-taking lanes
    const kl = win(t, tTurns - 0.3, tOther, 0.5, 0.4);
    if (kl > 0) {
      strip(x, 690, 330, kl);
      [790, 880, 970].forEach((y, i) => lane(x, y, 300, 1780, `bird ${'ABC'[i]}`, kl));
      for (let j = 0; j < 9; j++) { const i = j % 3, px = 320 + j * 160; block(x, px, [790, 880, 970][i], 130 * ease((t - tTurns - j * 0.3) / 0.3), i, kl); }
      text(x, 'each slots into the others’ pauses', 1760, 735, { size: 30, italic: true, align: 'right', alpha: kl });
    }
    // other species, other pitches
    const ks = win(t, tOther - 0.2, tList, 0.5, 0.4);
    if (ks > 0) {
      cartouche(x, 1220, 160, 600, 640, { alpha: ks });
      text(x, 'pitch', 1270, 220, { size: 30, italic: true, alpha: ks });
      [['insects', 0.9, '#7d8c6a'], ['nightingale', 0.62, PAL.ver], ['thrush', 0.42, PAL.ochre], ['cuckoo', 0.26, '#8a4f6e'], ['owl', 0.12, PAL.indigo]].forEach(([lbl, y, col], i) => {
        const yy = 760 - y * 520, k = ease((t - tOther - i * 0.12) / 0.4);
        x.save(); x.globalAlpha = ks * 0.8; x.fillStyle = col; x.fillRect(1300, yy - 26, 300 * k, 52); x.restore();
        text(x, lbl, 1620, yy + 12, { size: 32, italic: true, alpha: ks * k });
      });
    }
    // one voice out of the chorus
    const kv = win(t, tList - 0.2, tEaves, 0.6, 0.5);
    if (kv > 0) {
      const [sx, sy] = P[1];
      x.save(); const g = x.createRadialGradient(sx, sy, 60, sx, sy, 520);
      g.addColorStop(0, 'rgba(6,8,16,0)'); g.addColorStop(1, `rgba(6,8,16,${0.72 * kv})`);
      x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore();
      tag(x, 'one voice, picked out of many', sx + 120, sy + 140, kv, { italic: true });
    }
    // the eavesdropper keeps score
    const ke = win(t, tEaves + 0.6, tNet + 0.3, 0.5, 0.5);
    if (ke > 0) {
      const [ox, oy] = P[2];
      tag(x, 'eavesdropping on others’ contests', ox - 560, oy - 380, ke, { italic: true });
      const tally = '正正下';
      [...tally].forEach((ch, i) => text(x, ch, ox + 260 + i * 110, oy - 120, { font: JP, size: 96, weight: 700, color: PAL.cream, shadow: 'rgba(0,0,0,0.9)', alpha: ke * ease((t - tEaves - 1.2 - i * 0.5) / 0.4) }));
      text(x, 'keeping score?', ox + 420, oy, { size: 36, italic: true, color: PAL.cream, align: 'center', shadow: 'rgba(0,0,0,0.9)', alpha: ke * ease((t - wt('s12', 'perhaps')) / 0.5) });
    }
    // a network, taking turns
    const kn = ease((t - tNet + 0.2) / 0.8);
    if (kn > 0) {
      const E = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 2], [0, 2], [1, 4]];
      E.forEach(([a, b], i) => {
        const [ax, ay] = P[a], [bx, by] = P[b];
        x.save(); x.globalAlpha = kn * 0.55; x.strokeStyle = PAL.cream; x.lineWidth = 2; x.setLineDash([6, 10]);
        x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); x.restore();
        const u = ((t - tNet) * 0.6 + i / E.length) % 1, on = Math.floor((t - tNet) * 1.2) % E.length === i;
        if (on) { x.save(); x.globalAlpha = kn; x.fillStyle = '#ffd9a0'; x.shadowColor = '#ffd9a0'; x.shadowBlur = 20; x.beginPath(); x.arc(lerp(ax, bx, u), lerp(ay, by, u), 9, 0, 7); x.fill(); x.restore(); }
      });
      tag(x, 'a network, taking turns', W / 2, 900, win(t, wt('s12', 'network') - 0.3, tEnd12 + 0.3), { align: 'center', italic: true });
    }
  });

  // ===== 結 nightingale floors =====
  const tFloorEnd = wt('s13', 'Perhaps') - 0.4, tHere = wt('s13', 'I'), tCred = tHere + 4.2;
  for (let i = 0; i < 7; i++) cue(wt('s13', 'castle') + 0.4 + i * 0.55, 'chirp', { pan: -0.6 + i * 0.2 });
  for (let i = 0; i < 4; i++) cue(wt('s13', 'floors', 1) + i * 0.5, 'chirp', { pan: 0.4 - i * 0.2 });
  S(card(7).t1, tFloorEnd, (x, t) => {
    kb(x, IMG.p13_floor, t, card(7).t1, tFloorEnd + 1, { x: 0.25, y: 0.5, z: 1.25 }, { x: 0.6, y: 0.5, z: 1.15 });
    tag(x, '鶯 uguisu · the Japanese bush warbler', 160, 120, win(t, wt('s13', 'Uguisu') - 0.3, tFloorEnd + 0.4));
    tag(x, '鶯張り uguisu-bari · nightingale floor', 1050, 860, win(t, wt('s13', 'Nightingale', 1) - 0.3, tFloorEnd + 0.4));
  });
  S(tFloorEnd, tCred, (x, t) => {
    kb(x, IMG.p14_dawn, t, tFloorEnd, tCred + 2, { x: 0.4, y: 0.45, z: 1.3 }, { x: 0.45, y: 0.5, z: 1.05 });
    mist(x, t, { y: 0.78, alpha: 0.16, speed: 8 });
    brushText(x, 'I am here.', 1300, 520, ease((t - tHere) / 1.6), { size: 110, italic: true, align: 'center', color: PAL.cream, shadow: 'rgba(0,0,0,0.6)', weight: 600 });
    shade(x, ease((t - tCred + 1.5) / 1.5) * 0.85);
  });
  // closing credits on paper
  S(tCred, TL.duration + 1, (x, t) => {
    paper(x);
    const k = t - tCred;
    const L = [
      ['The Speech of Nightingales', 64, 600, true], ['', 20], ['小夜啼鳥の言葉', 44, 700, false, JP], ['', 30],
      ['Narration voice: “David – British Documentary” (ElevenLabs)', 30], ['Plates generated in the manner of Utagawa Kuniyoshi’s yokai prints', 30], ['', 16],
      ['Field recordings via radio aporee ::: maps (Internet Archive)', 32, 600], ['nightingales near Naujasodis, Lithuania — alas23/sala (public domain)', 28],
      ['Berlin-Treptow, Kiefholzstraße, a late nightingale — udo noll (CC BY-SA 3.0)', 28], ['midnight on the Island of Koos, Greifswald — radio aporee (CC BY-SA 3.0)', 28], ['', 16],
      ['Sources', 32, 600], ['Hultsch & Todt 1989 · Amrhein, Korner & Naguib 2002 · Brumm 2004', 28], ['Kiefer et al. 2006 · Todt & Naguib 2000 · Coupé et al. 2019', 28],
      ['The bits-and-beads arithmetic is the film’s own speculation.', 28, 500, true], ['', 16],
      ['Type: Shippori Mincho, Cormorant Garamond (SIL OFL)', 26],
    ];
    let y = 200 - Math.max(0, k - 3) * 6;
    L.forEach(([s, size, weight, it, font], i) => {
      text(x, s, W / 2, y, { size, weight: weight || 500, italic: !!it, align: 'center', font, alpha: ease((k - i * 0.12) / 0.6) });
      y += size * 1.6;
    });
    seal(x, W / 2, y + 60, 90, '夜鳴', { alpha: ease((k - 2.5) / 0.5) });
    shade(x, ease((t - TL.duration + 2.5) / 2.5));
  }, { fade: 1.5 });
}

// ---------- captions ----------
function captions(x, t) {
  const c = TL.cues.find(c => t >= c.t0 - 0.12 && t < c.t1 + 0.12);
  if (!c) return;
  const a = Math.min(ease((t - c.t0 + 0.12) / 0.2), ease((c.t1 + 0.12 - t) / 0.2));
  x.save(); x.font = `500 46px ${SERIF}`;
  const w = x.measureText(c.text).width;
  const g = x.createRadialGradient(W / 2, H + 40, 40, W / 2, H + 40, Math.max(420, w * 0.75));
  g.addColorStop(0, `rgba(8,8,14,${0.5 * a})`); g.addColorStop(1, 'rgba(8,8,14,0)');
  x.fillStyle = g; x.fillRect(0, H - 260, W, 260);
  x.restore();
  text(x, c.text, W / 2, H - 58, { size: 46, align: 'center', color: PAL.cream, alpha: a, stroke: 5, strokeColor: 'rgba(10,10,16,0.75)', shadow: 'rgba(0,0,0,0.7)', blur: 10 });
}

function render(t) {
  X.setTransform(1, 0, 0, 1, 0, 0);
  X.fillStyle = '#0b0a10'; X.fillRect(0, 0, W, H);
  for (const s of SHOTS) {
    if (t < s.a || t >= s.b + FADE) continue;
    const a = s.fade > 0 ? ease((t - s.a) / s.fade) : 1;
    if (a >= 1) { s.f(X, t); continue; }
    const c = mkLayer(); const cx = c.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, W, H);
    s.f(cx, t);
    X.globalAlpha = a; X.drawImage(c, 0, 0); X.globalAlpha = 1;
  }
  for (const o of OVERLAYS) if (t >= o.a && t < o.b) o.f(X, t);
  finish(X, t);
  captions(X, t);
}
let LAYER = null;
function mkLayer() { return LAYER || (LAYER = mkCanvas(W, H)); }

async function boot() {
  buildTextures();
  const load = (k, src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = rej; i.src = src; });
  await Promise.all([...PLATES.map(p => load(p, `plates/${p}.jpg`)), load('song', ASSETS.song.img), load('whistles', ASSETS.whistles.img)]);
  await document.fonts.load(`600 40px ${SERIF}`); await document.fonts.load(`italic 600 40px ${SERIF}`); await document.fonts.load(`700 40px ${JP}`);
  build();
  window.CUES = CUES;
  window.render = render;
  window.READY = true;
  const q = new URLSearchParams(location.search);
  if (q.has('t')) render(+q.get('t'));
  else if (q.has('play')) { const t0 = performance.now(), off = +q.get('play'); const loop = () => { render(off + (performance.now() - t0) / 1000); requestAnimationFrame(loop); }; loop(); }
}
boot();
