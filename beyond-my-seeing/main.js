// Timeline runner: picks the shot(s) for time t, renders, crossfades, applies post and text.
'use strict';
const SHOTS = [];
const TEXTS = [];
const SHADERS = {};
// shot(t0, t1, draw, {fade: seconds of crossfade from the previous shot, key: dissolve style})
function shot(t0, t1, draw, opt = {}) { SHOTS.push(Object.assign({ t0, t1, draw, fade: 0 }, opt)); }
function words(t0, t1, lines, opt = {}) { TEXTS.push(Object.assign({ t0, t1, lines }, opt)); }
const hexLin = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => Math.pow(v / 255, 2.2)); };
const mul = (c, k) => c.map(v => v * k);
const mixc = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

const R = (() => {
  const { gl, W, H } = E;
  const audio = window.ENV || { n: 0 };
  function aud(t) {
    if (!audio.n) return [0, 0, 0, 0];
    const i = Math.min(audio.n - 1, Math.max(0, Math.round(t * audio.fps)));
    return [audio.rms[i], audio.low[i], audio.mid[i], audio.high[i]];
  }
  // smoothed audio (attack/release) to avoid flicker
  function audS(t, win = .35) {
    let a = [0, 0, 0, 0], wsum = 0;
    for (let k = -6; k <= 0; k++) { const w = Math.exp(k * .5); const v = aud(t + k * win / 6); for (let j = 0; j < 4; j++) a[j] += v[j] * w; wsum += w; }
    return a.map(v => v / wsum);
  }

  function prog(name) {
    if (!SHADERS[name]) throw new Error('no shader ' + name);
    return E.program(name, SHADERS[name]);
  }

  function makeCtx(s, t, tgt) {
    const layerUsed = [false, false, false, false];
    const c = {
      t, u: t - s.t0, dur: s.t1 - s.t0, p: (t - s.t0) / (s.t1 - s.t0), out: tgt, shot: s,
      aud: audS(t), post: Object.assign({}, E.POST_DEFAULT), glows: [],
      L(i) {
        const L = E.layers[i];
        if (!layerUsed[i]) { L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.clearRect(0, 0, W, H); L.g.globalAlpha = 1; L.g.globalCompositeOperation = 'source-over'; L.g.fillStyle = '#fff'; L.g.strokeStyle = '#fff'; layerUsed[i] = true; L.dirty = true; }
        return L.g;
      },
      run(name, uni = {}, target = tgt) {
        for (let i = 0; i < 4; i++) if (layerUsed[i] && E.layers[i].dirty) { E.upload(E.layers[i]); E.layers[i].dirty = false; }
        const u = Object.assign({ uT: c.u, uP: c.p }, uni);
        for (let i = 0; i < 4; i++) if (u['uL' + i] === undefined) u['uL' + i] = layerUsed[i] ? E.layers[i].tex : E.blank;
        E.run(typeof name === 'string' ? prog(name) : name, target, u);
      },
      tmp(name, w, h) { return E.target(name, w, h); },
      glow(x, y, r, col, k = 1, halo = 1) { c.glows.push([x, H - y, r, halo, col[0], col[1], col[2], k]); },
    };
    return c;
  }

  function renderShot(s, t, slot) {
    const tgt = E.target('shot' + slot);
    const c = makeCtx(s, t, tgt);
    s.draw(c);
    let out = tgt;
    if (c.glows.length) {
      const g2 = E.target('glow' + slot);
      const G = new Float32Array(48), GC = new Float32Array(48);
      c.glows.slice(0, 12).forEach((g, i) => { G.set(g.slice(0, 4), i * 4); GC.set(g.slice(4, 8), i * 4); });
      E.run(E.P.glow, g2, { uSrc: tgt, uG: G, uGC: GC, uN: Math.min(12, c.glows.length) });
      out = g2;
    }
    return { tex: out, post: c.post };
  }

  function activeShots(t) {
    let i = -1;
    for (let k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k].t0 && t < SHOTS[k].t1) i = k;
    if (i < 0) i = t < SHOTS[0].t0 ? 0 : SHOTS.length - 1;
    const s = SHOTS[i];
    if (s.fade > 0 && i > 0 && t < s.t0 + s.fade) return { s, prev: SHOTS[i - 1], k: K.ease((t - s.t0) / s.fade) };
    return { s };
  }

  // ---------------- text ----------------
  function drawText(t) {
    const L = E.text, g = L.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    let any = false;
    for (const tx of TEXTS) {
      if (t < tx.t0 - .01 || t > tx.t1 + .01) continue;
      any = true;
      const fi = tx.fin ?? 1.2, fo = tx.fout ?? 1.4;
      const a = Math.min(K.smooth((t - tx.t0) / fi), K.smooth((tx.t1 - t) / fo));
      const size = tx.size ?? 44;
      const y0 = tx.y ?? H * .82;
      const lh = size * (tx.lh ?? 1.25);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      tx.lines.forEach((line, li) => {
        const la = tx.stagger ? Math.min(a, K.smooth((t - tx.t0 - li * tx.stagger) / fi)) : a;
        if (la <= 0) return;
        g.font = `${tx.italic === false ? '' : 'italic '}${tx.weight ?? 400} ${size}px 'Cormorant Garamond'`;
        if (tx.track) g.letterSpacing = tx.track + 'px'; else g.letterSpacing = '0px';
        const y = y0 + (li - (tx.lines.length - 1) / 2) * lh + (1 - la) * (tx.rise ?? 6);
        g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = size * .5;
        g.fillStyle = `rgba(${tx.color || '250,240,222'},${la})`;
        g.fillText(line, tx.x ?? W / 2, y);
        g.shadowBlur = 0;
      });
    }
    for (const ly of lyricLines(t)) {
      any = true;
      const top = LYR_TOP.some(([a, b]) => ly.s0 >= a - .5 && ly.s0 < b);
      let size = 46, font = 'italic 400', track = .5, y = top ? H * .115 : H * .885;
      if (ly.style === 'caps') { size = 40; font = '500'; track = 5; }
      if (ly.style === 'held') { size = 42; font = '500'; track = 5 + 11 * K.smooth((t - ly.s0) / 10); }
      if (ly.style === 'still') { size = 96; font = '600'; track = 22; y = H * .8; }
      y += ly.row * size * 1.3 + (1 - ly.a) * 5;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `${font} ${size}px 'Cormorant Garamond'`;
      g.letterSpacing = track + 'px';
      const w = g.measureText(ly.text).width;
      const loud = ly.style === 'still' || ly.style === 'held';
      const bright = LYR_BRIGHT.some(([a, b]) => t >= a && t < b);
      scrim(g, W / 2, y, w * (loud ? 1.5 : 1), size * (loud ? 1.6 : 1), (ly.style === 'still' ? .32 : ly.style === 'held' ? .36 : bright ? .5 : .26) * ly.a);
      g.shadowColor = `rgba(0,0,0,${bright ? .85 : .6})`; g.shadowBlur = size * .45;
      g.fillStyle = `rgba(250,240,222,${ly.a})`;
      g.fillText(ly.text, W / 2, y);
      g.shadowBlur = 0;
    }
    if (any) E.upload(L);
    return any;
  }
  // ---------------- the song's words ----------------
  const LYR_TOP = [[16.5, 25.9], [168.6, 175.4], [417.4, 426.2]];   // shots whose lower frame holds a figure or bright water
  const LYR_BRIGHT = [[317.5, 321.8], [331.0, 342.0], [347.8, 361.2], [394.4, 402.5]];  // whiteouts, glare and bright cloud: a deeper scrim
  function scrim(g, x, y, w, size, a) {
    if (a <= 0) return;
    const r = size * 1.6;
    g.save();
    g.translate(x, y); g.scale(Math.max(1, (w / 2 + r) / r), 1);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, `rgba(0,0,0,${a})`); grd.addColorStop(.55, `rgba(0,0,0,${a * .55})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(-r, -r, 2 * r, 2 * r);
    g.restore();
  }
  function lyricLines(t) {
    const out = [], n = LYRICS.length;
    LYRICS.forEach(([s0, s1, text, style], i) => {
      let e = s1, fout = .35, row = 0;
      if (i === n - 2) { e = 437.6; fout = 1.6; row = -1; }       // the closing couplet stays together
      if (i === n - 1) { e = 437.6; fout = 1.6; }
      if (style === 'still') fout = .9;
      if (t < s0 - .01 || t > e + .01) return;
      const fin = style === 'still' ? .06 : .3;
      out.push({ text, style, s0, row, a: Math.min(K.smooth((t - s0) / fin), K.smooth((e - t) / fout)) });
    });
    return out;
  }

  let ready = false;
  function init() {
    E.postPrograms();
    for (const name in SHADERS) prog(name);
    ready = true;
    return { total: TOTAL, fps: 24, shots: SHOTS.length };
  }

  function render(t) {
    if (!ready) init();
    const frame = Math.round(t * 24);
    E.setFrame({ t, aud: audS(t) });
    const a = activeShots(t);
    const A = renderShot(a.s, t, 'A');
    let src = A.tex, post = A.post;
    if (a.prev) {
      const B = renderShot(a.prev, t, 'B');
      const m = E.target('mix');
      E.run(E.P.mix, m, { uA: B.tex, uB: A.tex, uK: a.k, uMode: a.s.key ? 1 : 0 });
      src = m;
      post = E.lerpPost(B.post, A.post, a.k);
    }
    // global fades (silences etc.)
    for (const f of FADES) {
      if (t >= f.t0 && t <= f.t1) {
        const k = Math.min(f.in ? K.smooth((t - f.t0) / f.in) : 1, f.out ? K.smooth((f.t1 - t) / f.out) : 1);
        if (f.white) post.white = Math.max(post.white, k * f.white); else post.fade = Math.max(post.fade, k * (f.k ?? 1));
      }
    }
    // bloom chain
    const sizes = [[960, 540], [480, 270], [240, 135], [120, 68], [60, 34], [30, 17]];
    const down = sizes.map((s, i) => E.target('d' + i, s[0], s[1]));
    const up = sizes.map((s, i) => E.target('u' + i, s[0], s[1]));
    E.run(E.P.bright, down[0], { uSrc: src, uThr: post.thr });
    for (let i = 1; i < sizes.length; i++) E.run(E.P.down, down[i], { uSrc: down[i - 1], uTex: [1 / sizes[i - 1][0], 1 / sizes[i - 1][1]] });
    E.run(E.P.down, up[sizes.length - 1], { uSrc: down[sizes.length - 1], uTex: [1 / 30, 1 / 17] });
    for (let i = sizes.length - 2; i >= 0; i--) E.run(E.P.up, up[i], { uSrc: up[i + 1], uAdd: down[i], uTex: [1 / sizes[i + 1][0], 1 / sizes[i + 1][1]], uW: 1 });
    let raysT = E.blank;
    if (post.rays > 0.001) {
      raysT = E.target('rays', 480, 270);
      E.run(E.P.rays, raysT, { uSrc: src, uSun: post.sun, uDecay: post.raysDecay, uLen: post.raysLen });
    }
    const hasText = drawText(t);
    E.run(E.P.final, null, {
      uSrc: src, uBloom: up[0], uRays: raysT, uText: hasText ? E.text.tex : E.blank,
      uExp: post.exp, uBloomK: post.bloom, uRaysK: post.rays, uRayCol: post.rayCol, uVig: post.vig, uGrain: post.grain,
      uFade: post.fade, uWhite: post.white, uSatur: post.satur, uContrast: post.contrast, uLift: post.lift, uGamma: post.gamma, uGain: post.gain,
      uTextA: hasText ? 1 : 0, uFrame: frame,
    });
  }
  return { init, render, aud, audS };
})();
const FADES = [];
window.init = () => R.init();
window.render = t => R.render(t);
