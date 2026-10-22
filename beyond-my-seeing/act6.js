// Act VI: the breaking. Certainty kept like a flame in crystal; the dawn bursts in; the vessel shatters into birds;
// on the cliff he lets go of the staff and the coat; the man he is tonight dissolves into light; the heart opens.
'use strict';

// ---------- the room: certainty, the dawn, the shattering, the birds ----------
const CRY = { x: 985, y: 598, s: 62 };
const WIN = { x: 1300, y: 170, w: 380, h: 520 };
function crystalShards() {
  const P = K.crystalPoints(CRY.x, CRY.y, CRY.s);
  const O = [CRY.x + 6, CRY.y + 10];
  const r = K.rng(1234);
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const m = [(a[0] + b[0]) / 2 + (r() - .5) * 8, (a[1] + b[1]) / 2 + (r() - .5) * 8];
    const q = [(O[0] + m[0]) / 2 + (r() - .5) * 10, (O[1] + m[1]) / 2 + (r() - .5) * 10];
    for (const tri of [[O, a, q], [a, m, q], [m, b, q], [O, q, b]]) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const dx = cx - O[0], dy = cy - O[1], dl = Math.hypot(dx, dy) || 1;
      out.push({ c: [cx, cy], v: tri.map(p => [p[0] - cx, p[1] - cy]), dir: [dx / dl + (r() - .5) * .8, dy / dl - r() * .5], sp: 15 + r() * r() * 160, spin: (r() - .5) * 2.4, k: r(),
        tgt: [WIN.x + 60 + r() * 300, WIN.y + 60 + r() * 380], out: [SW + 80 + r() * 200, 120 + r() * 400], size: 13 + r() * 12 });
    }
  }
  return out;
}
const SHARDS = crystalShards();
function crack(r, x, y, ang, len, depth, segs) {
  const pts = [[x, y]];
  for (let i = 0; i < 4; i++) { ang += (r() - .5) * .9; x += Math.cos(ang) * len / 4; y += Math.sin(ang) * len / 4; pts.push([x, y]); }
  segs.push(pts);
  if (depth > 0) for (let k = 0; k < 2; k++) crack(r, x, y, ang + (r() - .5) * 1.6, len * .6, depth - 1, segs);
}
const CRACKS = (() => { const r = K.rng(77), segs = []; for (let i = 0; i < 4; i++) crack(r, CRY.x + (r() - .5) * 30, CRY.y + (r() - .5) * 60, r() * 6.28, 70, 2, segs); return segs; })();

function drawCrystal(g, t, alpha) {
  const P = K.crystalPoints(CRY.x, CRY.y, CRY.s);
  const cx = CRY.x, cy = CRY.y + 8;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const k = .25 + .2 * Math.sin(i * 1.7 + t * .5) + .1 * Math.sin(i * 3.1);
    g.fillStyle = `rgba(255,${Math.round(190 + 40 * k)},${Math.round(120 + 60 * k)},${k * alpha})`;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.closePath(); g.fill();
  }
  g.strokeStyle = `rgba(255,236,205,${.75 * alpha})`; g.lineWidth = 1.6;
  g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke();
  g.lineWidth = .9; g.strokeStyle = `rgba(255,230,190,${.35 * alpha})`;
  for (const p of P) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(p[0], p[1]); g.stroke(); }
  // the flame inside
  const fl = 1 + .08 * Math.sin(t * 13) + .05 * Math.sin(t * 7.3);
  const grd = g.createRadialGradient(cx, cy + 10, 0, cx, cy + 10, 26 * fl);
  grd.addColorStop(0, `rgba(255,250,235,${alpha})`); grd.addColorStop(.4, `rgba(255,190,90,${.8 * alpha})`); grd.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(cx, cy - 30 * fl); g.quadraticCurveTo(cx + 16, cy + 6, cx, cy + 26); g.quadraticCurveTo(cx - 16, cy + 6, cx, cy - 30 * fl); g.fill();
}
function drawRoom(g, t, open) {
  // table, chair, window frame, shutters
  g.fillRect(760, 660, 450, 26);
  g.fillRect(790, 686, 22, 200); g.fillRect(1160, 686, 22, 200);
  g.fillRect(470, 690, 22, 196); g.fillRect(560, 700, 18, 186); g.fillRect(460, 690, 130, 16); g.fillRect(470, 520, 18, 180);
  const { x, y, w, h } = WIN;
  g.fillRect(x - 22, y - 22, w + 44, 22); g.fillRect(x - 22, y + h, w + 44, 30); g.fillRect(x - 22, y, 22, h); g.fillRect(x + w, y, 22, h);
  // shutters swing open toward the room: their visible width shrinks with the angle
  const ang = open * 1.45;
  const pw = w / 2 * Math.cos(ang);
  for (const side of [0, 1]) {
    const x0 = side ? x + w : x;
    const dir = side ? -1 : 1;
    const skew = Math.sin(ang) * 40;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + dir * pw, y - skew); g.lineTo(x0 + dir * pw, y + h + skew); g.lineTo(x0, y + h); g.closePath(); g.fill();
  }
}
shot(257.5, 288.25, c => {
  const t = c.t, u = c.u;
  const open = t < 271.55 ? 0 : Math.min(1, ease(seg(t, 271.55, 272.0)) * 1.06 - Math.max(0, Math.sin((t - 272) * 6)) * .04 * Math.exp(-(t - 272) * 3));
  const zoom = lerp(1.0, 1.1, ease(seg(t, 257.5, 271.5))) - (open > 0 ? .1 * ease(seg(t, 271.55, 274)) : 0);
  const tf = g => { g.translate(CRY.x, CRY.y); g.scale(zoom, zoom); g.translate(-CRY.x, -CRY.y); };
  const g = c.L(0), g2 = c.L(2);
  g.save(); tf(g); g2.save(); tf(g2);
  drawRoom(g, t, open);
  // him
  const shield = smooth(seg(t, 271.7, 272.5)) * (1 - smooth(seg(t, 277.6, 279.8)));
  const stand = ease(seg(t, 284.4, 286.2));
  const arms = shield > .02 ? 'shield' : (t < 271.6 ? 'cup' : 'down');
  let me;
  if (stand < .5) me = K.seeker(g, { x: 548, y: 886, h: 470, age: 1.5, face: 1, pose: 'sit', seat: 190, arms, armK: shield > .02 ? shield : 1, lean: -shield * .12 + (t < 271.6 ? .12 : 0), look: t < 271.6 ? -.25 : -shield * .1 + .15 });
  else me = K.seeker(g, { x: 610, y: 886, h: 470, age: 1.5, face: 1, arms: 'down', look: .2, walk: 0 });
  // the crystal: whole, cracking, then shattering into birds of light
  const shatterT = 278.35;
  if (t < shatterT) {
    drawCrystal(g2, t, 1);
    const cr = seg(t, 273.0, 278.3);
    if (cr > 0) {
      g2.strokeStyle = 'rgba(255,248,230,0.95)'; g2.lineWidth = 2; g2.lineCap = 'round';
      const n = Math.floor(cr * CRACKS.length);
      for (let i = 0; i < n; i++) { const s = CRACKS[i]; g2.beginPath(); s.forEach((p, j) => j ? g2.lineTo(p[0], p[1]) : g2.moveTo(p[0], p[1])); g2.stroke(); }
    }
  } else {
    const st = t - shatterT;
    for (const sh of SHARDS) {
      const morph = smooth(seg(t, 281.2 + sh.k * 1.4, 282.6 + sh.k * 1.4));
      const fly = seg(t, 282.4 + sh.k * 1.2, 287.6 + sh.k * .6);
      const d = sh.sp * (1 - Math.exp(-st * .9)) * 1.6;
      let px = sh.c[0] + sh.dir[0] * d, py = sh.c[1] + sh.dir[1] * d - st * 6;
      if (fly > 0) {
        const f = ease(fly);
        const a = [px, py], b = sh.tgt, e = sh.out;
        const m1 = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 160];
        const q = f < .7 ? f / .7 : 1;
        const bx = (1 - q) * (1 - q) * a[0] + 2 * (1 - q) * q * m1[0] + q * q * b[0], by = (1 - q) * (1 - q) * a[1] + 2 * (1 - q) * q * m1[1] + q * q * b[1];
        const o = f < .7 ? 0 : (f - .7) / .3;
        px = lerp(bx, e[0], o * o); py = lerp(by, e[1], o * o);
      }
      if (morph < 1) {
        g2.save(); g2.translate(px, py); g2.rotate(sh.spin * st);
        g2.fillStyle = `rgba(255,222,170,${(1 - morph) * .85})`; g2.strokeStyle = `rgba(255,245,225,${1 - morph})`; g2.lineWidth = 1.3;
        g2.beginPath(); sh.v.forEach((p, j) => j ? g2.lineTo(p[0], p[1]) : g2.moveTo(p[0], p[1])); g2.closePath(); g2.fill(); g2.stroke();
        g2.restore();
      }
      if (morph > 0) { g2.fillStyle = `rgba(255,236,200,${morph})`; K.bird(g2, px, py, sh.size * (.6 + .4 * morph), t * 8 + sh.k * 9, 1); }
    }
  }
  g.restore(); g2.restore();
  const crysK = t < shatterT ? (.75 + .06 * Math.sin(t * 9)) : .75 * Math.exp(-(t - shatterT) * 1.2) + .1;
  c.run('room', {
    uCrys: [CRY.x, SH - CRY.y], uCrysK: crysK, uWin: [WIN.x, SH - WIN.y - WIN.h, WIN.w, WIN.h], uOpen: open,
    uDawn: [1.0, .68, .42], uSil: hexLin('#040303'),
  });
  if (t < shatterT) c.glow(CRY.x, CRY.y + 10, 8, [1, .7, .4], 2.4 + Math.sin(t * 11) * .2, 2.5);
  else c.glow(CRY.x, CRY.y, 8 + (t - shatterT) * 20, [1, .85, .6], 4 * Math.exp(-(t - shatterT) * 2.5), 2);
  if (open === 0) {
    // dawn leaking through the slats
    const g2b = c.L(2);
    g2b.fillStyle = 'rgba(255,190,130,0.75)';
    for (let i = 1; i < 9; i++) g2b.fillRect(WIN.x + 6, WIN.y + i * WIN.h / 9, WIN.w - 12, 2.2);
    g2b.fillRect(WIN.x + WIN.w / 2 - 1, WIN.y, 2.5, WIN.h);
  }
  c.post.sun = [(WIN.x + WIN.w * .45) / SW, 1 - (WIN.y + WIN.h * .7) / SH];
  c.post.rays = open * .9; c.post.raysLen = 1.2; c.post.rayCol = [1, .78, .55];
  c.post.bloom = .7; c.post.vig = .7;
  c.post.white = open > 0 ? .5 * Math.exp(-(t - 271.55) * 3) : 0;
}, { fade: 1.0 });

// ---------- the cliff: take away my easy answers ----------
const cliffY = x => x < 1240 ? 820 + (K.fbm(x * .006 + 4) - .5) * 26 : 820 + (x - 1240) * 6;
function stormSky(o) {
  return landU(Object.assign({
    zen: hexLin('#01030b'), hor: hexLin('#0e1630'), horY: 360, gradP: 1.2,
    star: 1, mw: .5, mwAng: -.5, mwOff: [.2, .1],
    cloud: .9, cloudY: SH - 300, cloudH: 220, cloudS: 1.4, cloudCol: hexLin('#141a30'),
    ridges: [{ y: 300, amp: 60, freq: .0018, rough: .6, col: hexLin('#070a16'), mist: .4 }],
    mist: hexLin('#16203e'), mistH: 50, c0: hexLin('#010103'), rim: 0,
  }, o));
}
shot(288.25, 292.75, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  pathLine(g, cliffY);
  const me = K.seeker(g, { x: 1120, y: cliffY(1120) + 3, h: 300, age: 1.5, face: 1, arms: t < 289.6 ? 'staff' : 'down', armK: 1, staff: t < 289.6, wind: .7 + .2 * Math.sin(t * 3), look: -.05 });
  if (t >= 289.6) {
    const ft = t - 289.6;
    const sx = 1168 + ft * 70, sy = cliffY(1120) - 150 + 120 * ft * ft;
    g.save(); g.translate(sx, sy); g.rotate(.3 + ft * 2.2); g.lineWidth = 4.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -130); g.lineTo(0, 130); g.stroke(); g.restore();
  }
  c.run('land', stormSky({ cloudS: 1.4 + u * .05 }));
  chestGlow(c, me, .7);
  c.post.bloom = .7; c.post.vig = .65;
}, { fade: .4 });
shot(292.75, 296.4, c => {
  const t = c.t, u = c.u;
  const g = c.L(0), g1 = c.L(1);
  pathLine(g, x => 1010 + (K.fbm(x * .004) - .5) * 20);
  const off = smooth(seg(t, 293.3, 294.3));
  const me = K.seeker(g, { x: 900, y: 1012, h: 720, age: 1.5, face: 1, noCoat: off > .5, arms: off > .02 && off < .98 ? 'up' : 'down', armK: Math.sin(off * Math.PI), wind: .8, look: .05 });
  if (off > .3) {
    const ft = t - 293.7;
    const cx = 760 - ft * 420, cy = 500 - ft * 160 + Math.sin(ft * 4) * 30;
    g.save(); g.translate(cx, cy); g.rotate(-.3 + Math.sin(ft * 3) * .5 - ft * .4);
    const fl = Math.sin(t * 9), f2 = Math.sin(t * 7 + 1);
    // a cloak: collar, two sleeves, a long hem rippling in the wind
    K.smoothPath(g, [[-40, -120], [40, -126], [70, -100], [150, -40 + fl * 20], [120, -20], [90, -60], [100, 60 + f2 * 20], [130, 190 + fl * 30], [60, 175 + f2 * 25], [0, 205 + fl * 18], [-70, 170 - f2 * 22], [-130, 185 - fl * 26], [-95, 50], [-90, -60], [-120, -20], [-150, -45 - fl * 18], [-70, -100]], true); g.fill();
    g.restore();
  }
  c.run('land', stormSky({ horY: 200, cloudY: SH - 200 }));
  chestGlow(c, me, .9);
  c.post.bloom = .7; c.post.vig = .7;
});
FADES.push({ t0: 292.3, t1: 293.25, in: .06, out: .08 }, { t0: 296.0, t1: 296.78, in: .06, out: .04 });

// ---------- then let me be a stranger: he dissolves into light ----------
shot(296.4, 309.65, c => {
  const t = c.t, u = c.u;
  const g = c.L(0), g2 = c.L(2);
  const cliff = x => 940 + Math.pow((x - 960) / 1100, 2) * 140 + (K.fbm(x * .006) - .5) * 16;
  pathLine(g, cliff);
  const fx = 960, fy = cliff(960) + 3, fh = 430;
  const gl = c.L(1);
  const me = K.seeker(gl, { x: fx, y: fy, h: fh, age: 1.5, face: 0, noCoat: true, arms: 'open', armK: .25 + .65 * ease(seg(t, 296.9, 299)), look: .3, wind: .5 });
  // copy the figure onto the near layer (it dissolves there); keep the cliff solid
  g.drawImage(gl.canvas, 0, 0);
  gl.clearRect(0, 0, SW, SH);
  const dis = Math.pow(seg(t, 298.8, 308.6), .9);
  // motes rising from the dissolving body
  const r = K.rng(99);
  for (let i = 0; i < 900; i++) {
    const hv = r(), bx = fx + (r() - .5) * fh * .36 * (1 - Math.abs(hv - .5) * .5), by = fy - fh * (.05 + hv * .95);
    const v = .45 * r() + .55 * (1 - hv);
    const birth = 298.8 + v / 1.3 * 9.8;
    const age = t - birth;
    if (age < 0 || age > 4.5) continue;
    const px = bx + Math.sin(age * 1.3 + i) * 30 * age + age * 40 * (r() - .3), py = by - age * age * 40 - age * 60;
    const a = Math.max(0, 1 - age / 4.5);
    g2.fillStyle = `rgba(255,${200 + Math.round(40 * r())},${140 + Math.round(60 * r())},${a})`;
    g2.beginPath(); g2.arc(px, py, 1.4 + r() * 2.4, 0, Math.PI * 2); g2.fill();
  }
  c.run('land', landU({
    zen: hexLin('#010209'), hor: hexLin('#121c40'), horY: 260, gradP: 1.1,
    star: 1.1, mw: .9 + dis * .3, mwAng: -1.0, mwOff: [0, .2],
    aur: .5 + dis * .5, aurY: SH * .55, aurC1: [.08, 1.1, .5], aurC2: [.6, .2, 1.0],
    ridges: [{ y: 200, amp: 70, freq: .0018, rough: .6, col: hexLin('#050813'), mist: .4 }],
    mist: hexLin('#16203e'), mistH: 50, c0: hexLin('#010103'), rim: 0, emit: 1.6,
    dis, disB: [SH - fy, fh],
    bg: [me.chest[0], me.chest[1], 90, .8 + dis * .6],
  }));
  c.glow(me.chest[0], me.chest[1], 6 + dis * 6, C.ember, 2 + dis * 2.5, 2.2);
  c.post.bloom = .85; c.post.vig = .6;
  c.post.white = .45 * Math.exp(-Math.max(0, t - 297.0) * 2.5) * (t > 296.95 ? 1 : 0);
}, { fade: .0 });

// ---------- only leave me with the courage to keep an open heart: the heart opens like a flower ----------
shot(309.65, 320.6, c => {
  const t = c.t, u = c.u;
  const g2 = c.L(2);
  const cx = SW * .5, cy = 940 - 560 * .62;
  const k = seg(t, 309.8, 319.3);
  const grow = Math.pow(k, 1.6);
  g2.save(); g2.translate(cx, cy); g2.globalCompositeOperation = 'lighter';
  const rings = [[8, 0, 1], [12, .18, 1.6], [16, .36, 2.3], [24, .55, 3.1]];
  for (const [n, delay, rr] of rings) {
    const open = ease(seg(k, delay, delay + .45));
    if (open <= 0) continue;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + t * .05 * (rr % 2 ? 1 : -1) + delay * 3;
      const L = (50 + 95 * rr) * open * (1 + grow * 1.2), Wd = L * .26;
      g2.save(); g2.rotate(a);
      const grd = g2.createLinearGradient(0, 0, L, 0);
      grd.addColorStop(0, `rgba(255,245,225,${.32 * open})`); grd.addColorStop(.7, `rgba(255,190,110,${.18 * open})`); grd.addColorStop(1, 'rgba(255,140,60,0.02)');
      g2.fillStyle = grd;
      g2.beginPath(); g2.moveTo(0, 0); g2.quadraticCurveTo(L * .5, -Wd * .8, L, 0); g2.quadraticCurveTo(L * .5, Wd * .8, 0, 0); g2.fill();
      g2.strokeStyle = `rgba(255,224,170,${.55 * open})`; g2.lineWidth = 1.4; g2.stroke();
      g2.strokeStyle = `rgba(255,240,210,${.25 * open})`; g2.lineWidth = .8; g2.beginPath(); g2.moveTo(L * .08, 0); g2.lineTo(L * .92, 0); g2.stroke();
      g2.restore();
    }
  }
  g2.restore();
  c.run('land', landU({
    zen: hexLin('#010209'), hor: hexLin('#121c40'), horY: 260, gradP: 1.1,
    star: 1.1, mw: 1.2, mwAng: -1.0, mwOff: [0, .2], aur: 1 - k * .5, aurY: SH * .55,
    ridges: [{ y: 200, amp: 70, freq: .0018, rough: .6, col: hexLin('#050813'), mist: .4 }],
    mist: hexLin('#16203e'), mistH: 50, c0: hexLin('#010103'), rim: 0, emit: 1.2 + grow * .8,
  }));
  c.glow(cx, cy, 10 + grow * 18, C.ember, 3 + grow * 3 + c.aud[0] * 1.5, 1.4);
  c.post.bloom = .9 + grow * .3; c.post.vig = .6;
  c.post.white = Math.pow(seg(t, 318.6, 320.55), 1.5);
}, { fade: .6 });
