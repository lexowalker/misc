// The yokai. Each is drawn around a local origin in its own units, scaled by s.

/* ============================================================ IROYOKU 色欲 — lust
   A white kitsune mask with gold slit eyes, a mane of crimson fox-fire, and tails that become
   red threads. o: {t, tails, mouth, look:[x,y], a, heat, crack, unmask, dir, squash} */
function iroyoku(x, y, s, o = {}) {
  const t = o.t ?? 0, tq = twos(t), N = o.tails ?? 1, a = o.a ?? 1, heat = o.heat ?? .6;
  if (a <= .002 || s <= 0) return;
  const tailTips = [];
  withA(a, () => tr(x, y, s, o.rot || 0, () => {
    if ((o.dir || 1) < 0) g.scale(-1, 1);
    if (o.squash) g.scale(1 + o.squash, 1 - o.squash);
    glow(0, 6, 120, 'rgba(255,40,90,.55)', .35 + heat * .5);
    // tails fan up behind the mask
    const nT = Math.ceil(N);
    for (let i = 0; i < nT; i++) {
      const ta = clamp(N - i);
      const f = nT === 1 ? .3 : i / (nT - 1);
      const base = lerp(-Math.PI + .35, -.35, f) + (nT === 1 ? -.5 : 0);
      const len = (78 + 18 * Math.sin(i * 2.3)) * (o.tailLen ?? 1);
      tailTips.push(tail(0, 14, base, len, tq, i, ta * (o.tailA ?? 1)));
    }
    // flame mane
    for (let i = 0; i < 16; i++) {
      const ang = i / 16 * TAU + .1;
      const fl = .75 + .25 * noise1(tq * 3 + i * 7.3);
      const r0 = 20, r1 = (36 + 8 * Math.sin(i * 1.7)) * fl;
      const cx = Math.cos(ang), cy = Math.sin(ang);
      g.beginPath();
      g.moveTo(cx * r0 - cy * 9, 6 + cy * r0 + cx * 9);
      g.quadraticCurveTo(cx * r1 * .8 - cy * 7, 6 + cy * r1 * .8 + cx * 7 + noise1(tq * 2 + i) * 3, cx * r1, 6 + cy * r1);
      g.quadraticCurveTo(cx * r1 * .8 + cy * 7, 6 + cy * r1 * .8 - cx * 7, cx * r0 + cy * 9, 6 + cy * r0 - cx * 9);
      g.fillStyle = i % 2 ? C.crim : '#a0124a';
      g.fill();
    }
    // smoke body
    for (let i = 0; i < 14; i++) {
      const ang = i / 14 * TAU;
      const r = 20 + 5 * noise1(tq * 1.3 + i * 3.1);
      circ(Math.cos(ang) * r * .9, 10 + Math.sin(ang) * r * .7, 13 + 3 * noise1(tq + i), i % 3 ? '#7a1442' : C.vio, .85);
    }
    glow(0, 8, 46, 'rgba(255,90,140,.6)', heat);
    // the mask
    const un = o.unmask || 0;
    if (un < 1) tr(0, -un * 30, 1, un * .6, () => withA(1 - un, () => mask(o, tq)));
  }));
  return tailTips.map(([tx, ty]) => [x + tx * s * (o.dir || 1), y + ty * s]);
}

function tail(x0, y0, base, len, tq, i, a) {
  if (a <= .002) return [x0, y0];
  const K = 16, pts = [];
  let px = x0, py = y0, ang = base;
  for (let k = 0; k <= K; k++) {
    pts.push([px, py]);
    ang += (.07 + .06 * Math.sin(i * 1.9)) * (base < -Math.PI / 2 ? -1 : 1) + .07 * Math.sin(tq * 1.6 + i * 1.3 - k * .45);
    px += Math.cos(ang) * len / K; py += Math.sin(ang) * len / K;
  }
  const L = [], R = [];
  pts.forEach((p, k) => {
    const q = pts[Math.min(k + 1, K)], pp = pts[Math.max(k - 1, 0)];
    const dx = q[0] - pp[0], dy = q[1] - pp[1], d = Math.hypot(dx, dy) || 1;
    const w = 14 * Math.pow(1 - k / K, .7) * (k < 3 ? .7 + k * .1 : 1) + .4;
    L.push([p[0] - dy / d * w, p[1] + dx / d * w]); R.push([p[0] + dy / d * w, p[1] - dx / d * w]);
  });
  withA(a, () => {
    const tip = pts[K];
    g.beginPath(); curve([...L, ...R.reverse()], true);
    g.fillStyle = lin(x0, y0, tip[0], tip[1], [[0, '#8e1240'], [.45, C.crim], [.8, C.mag], [1, '#ffd0e0']]);
    g.fill();
    g.lineWidth = .9; g.strokeStyle = 'rgba(40,0,20,.6)'; g.stroke();
    // a lick of paler fire along the spine
    stroke(pts.slice(3, K - 1), 'rgba(255,170,200,.35)', 2.2);
    glow(tip[0], tip[1], 14, 'rgba(255,200,230,.9)', .9);
    circ(tip[0], tip[1], 2, '#fff2f6');
  });
  return pts[K];
}

function mask(o, tq) {
  const crack = o.crack || 0, mouth = o.mouth || 0;
  const [lx, ly] = o.look || [0, 0];
  g.save();
  g.rotate(.04 * Math.sin(tq * 1.1));
  // ears + face plate
  const plate = () => {
    g.beginPath();
    g.moveTo(0, 33);
    g.bezierCurveTo(8, 30, 17, 16, 21, 4);
    g.bezierCurveTo(24, -6, 22, -14, 18, -20);
    g.lineTo(25, -46); g.lineTo(8, -27);
    g.quadraticCurveTo(0, -29, -8, -27);
    g.lineTo(-25, -46); g.lineTo(-18, -20);
    g.bezierCurveTo(-22, -14, -24, -6, -21, 4);
    g.bezierCurveTo(-17, 16, -8, 30, 0, 33);
    g.closePath();
  };
  plate();
  g.fillStyle = lin(-20, -30, 20, 30, [[0, '#fffaf0'], [.6, '#f3e8d8'], [1, '#d9c6b0']]);
  g.fill(); g.lineWidth = 1.6; g.strokeStyle = C.ink; g.stroke();
  g.save(); plate(); g.clip();
  // inner ears
  poly([[20, -22], [23.5, -41], [11, -26.5]], '#e0506e');
  poly([[-20, -22], [-23.5, -41], [-11, -26.5]], '#e0506e');
  // kumadori markings
  g.strokeStyle = C.ver; g.lineCap = 'round';
  for (const sx of [-1, 1]) {
    g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(sx * 4, -4); g.quadraticCurveTo(sx * 13, -16, sx * 21, -12); g.stroke();
    g.lineWidth = 1.4;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(sx * 9, 10 + k * 3.4); g.quadraticCurveTo(sx * 15, 8 + k * 3.8, sx * 20, 6 + k * 5); g.stroke(); }
  }
  // forehead jewel (hoju) flame
  g.beginPath(); g.moveTo(0, -24); g.bezierCurveTo(5, -18, 4, -12, 0, -10); g.bezierCurveTo(-4, -12, -5, -18, 0, -24);
  g.fillStyle = C.ver; g.fill();
  circ(0, -14, 1.6, C.gold);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-8, -12, 6, 14, -.4, 0, TAU); g.fill();
  g.restore();
  // eyes: black almond sockets with gold irises
  for (const sx of [-1, 1]) {
    g.save(); g.translate(sx * 9, -3); g.scale(sx, 1);
    const eye = () => { g.beginPath(); g.moveTo(-5, 2.5); g.quadraticCurveTo(0, -5, 7.5, -4); g.quadraticCurveTo(3, 4, -5, 2.5); g.closePath(); };
    eye(); g.fillStyle = '#120a10'; g.fill();
    g.save(); eye(); g.clip();
    const op = o.eyesOpen ?? 1;
    if (op > 0) {
      const ix = 1 + lx * 2 * sx, iy = -.5 + ly * 1.2;
      ell(ix, iy, 3.4, 3 * op, C.gold);
      ell(ix, iy, .8, 2.6 * op, '#1a0606');
    }
    g.restore();
    g.restore();
  }
  glow(-9, -3, 12, 'rgba(255,210,90,.7)', .5 * (o.eyesOpen ?? 1));
  glow(9, -3, 12, 'rgba(255,210,90,.7)', .5 * (o.eyesOpen ?? 1));
  // muzzle + smile
  ell(0, 27.5, 2.6, 1.8, '#1a1014');
  if (mouth > .02) {
    g.beginPath(); g.moveTo(-9, 20); g.quadraticCurveTo(0, 21 + 9 * mouth, 9, 20); g.quadraticCurveTo(0, 23, -9, 20); g.closePath();
    g.fillStyle = '#3a0414'; g.fill();
    g.beginPath(); g.ellipse(0, 21.5 + 4 * mouth, 3, 2.2 * mouth, 0, 0, Math.PI); g.fillStyle = '#e8506e'; g.fill();
  }
  stroke([[-10, 19], [-4, 21.6], [0, 21], [4, 21.6], [10, 19]], C.ver, 1.5);
  // cracks
  if (crack > 0) {
    const cr = [[0, -24], [-2, -14], [3, -6], [-1, 4], [4, 14], [1, 24], [3, 33]];
    const n = Math.max(2, Math.ceil(cr.length * crack));
    stroke(cr.slice(0, n), '#1a0a0a', 1.4, 1, false);
    if (crack > .5) stroke([[3, -6], [12, -2], [19, 6]], '#1a0a0a', 1.1, (crack - .5) * 2, false);
    if (crack > .3) glow(0, 4, 30 * crack, 'rgba(255,240,200,.9)', crack);
  }
  g.restore();
}

/* the true form under the mask: a fox kit made of warm fire */
function foxKit(x, y, s, o = {}) {
  const t = o.t ?? 0, tq = twos(t), a = o.a ?? 1;
  withA(a, () => tr(x, y, s, 0, () => {
    if ((o.dir || 1) < 0) g.scale(-1, 1);
    glow(0, -10, 50, 'rgba(255,170,80,.75)', .7 * (o.glow ?? 1));
    const curl = o.curl || 0;
    // tail
    const tw = Math.sin(tq * 2) * 2;
    g.beginPath();
    if (curl) curve([[-6, -2], [-16, -6], [-14, -16 + tw * .3], [-4, -16], [2, -10], [-6, -8]], true);
    else curve([[-6, -4], [-17, -6], [-22, -18 + tw], [-16, -24 + tw], [-12, -14], [-6, -10]], true);
    inkPath('#e8823a', 1);
    circ(curl ? -14 : -19, curl ? -12 : -21 + tw, 3.2, '#fff6e8');
    // body
    g.beginPath(); g.ellipse(0, -8, 10, curl ? 6 : 8, 0, 0, TAU); inkPath('#ef8f42', 1);
    g.beginPath(); g.ellipse(4, -6, 4.5, 5, 0, 0, TAU); g.fillStyle = '#fff1dc'; g.fill();
    // legs
    if (!curl) for (const lx of [-5, -1, 4, 7]) { g.beginPath(); g.roundRect(lx, -3, 2.6, 4, 1.2); inkPath('#5a2a14', .6); }
    // head
    const hy = curl ? -10 : -18, hx = curl ? 6 : 6;
    tr(hx, hy, 1, (o.tilt || 0) + (curl ? .25 : 0), () => {
      poly([[-6, -3], [-7.5, -13], [-1.5, -6]], '#ef8f42'); g.lineWidth = .8; g.strokeStyle = C.ink; g.stroke();
      poly([[3, -6], [6.5, -13], [7, -3]], '#ef8f42'); g.stroke();
      poly([[-5.6, -4], [-6.6, -10.5], [-3, -6]], '#5a2a14');
      g.beginPath(); curve([[-7, -2], [-4, -7], [4, -7], [7, -2], [10, 3], [4, 5], [-5, 4]], true); inkPath('#ef8f42', 1);
      g.beginPath(); curve([[0, 1], [5, 1], [10, 3], [5, 5.2], [0, 4]], true); g.fillStyle = '#fff1dc'; g.fill();
      circ(10, 2.8, 1.1, '#1a1010');
      if (curl || o.sleep) { stroke([[-3, -1], [-1, 0], [1, -1]], C.ink, .7); stroke([[3, -1], [4.6, 0], [6.2, -1]], C.ink, .7); }
      else for (const ex of [-1.6, 4.4]) { ell(ex, -1, 1.5, 1.9, '#1a0e0a'); circ(ex + .5, -1.8, .55, '#fff'); }
    });
  }));
}

/* a red thread of attention, from (x1,y1) to (x2,y2) */
function thread(x1, y1, x2, y2, t, o = {}) {
  const a = o.a ?? 1, gold = o.gold || 0, upto = o.upto ?? 1, sag = o.sag ?? 60;
  if (a <= .002 || upto <= 0) return;
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const f = i / n * upto;
    const wob = Math.sin(f * 9 + t * 4 + (o.seed || 0)) * 6 * Math.sin(Math.PI * f) * (o.wob ?? 1);
    pts.push([lerp(x1, x2, f) + wob * .4, lerp(y1, y2, f) + Math.sin(Math.PI * f) * sag + wob]);
  }
  const col = gold > 0 ? mixHex('#ff2a50', '#ffd77a', gold) : '#ff2a50';
  g.save(); g.globalCompositeOperation = 'lighter';
  stroke(pts, col, o.w ? o.w * 4 : 7, a * .22);
  g.restore();
  stroke(pts, col, o.w || 1.8, a);
  if (o.burn) for (let k = 0; k < 6; k++) {
    const f = (k / 6 + t * .7) % 1, p = pts[Math.floor(f * n)];
    glow(p[0], p[1], 10, 'rgba(255,220,140,.9)', a * o.burn);
  }
}

/* ============================================================ TENGU 天狗 — will */
function tengu(x, y, s, o = {}) {
  const t = o.t ?? 0, tq = twos(t), mood = o.mood || 'stern', a = o.a ?? 1;
  withA(a, () => tr(x, y, s, o.rot || 0, () => {
    if ((o.dir || 1) < 0) g.scale(-1, 1);
    // wings
    const wo = o.wings ?? .5;
    for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
      const ang = -Math.PI / 2 - side * (.35 + k * (.18 + wo * .16)) + Math.sin(tq * 6) * .05 * wo;
      tr(-2, -24, 1, ang + Math.PI / 2, () => {
        g.beginPath(); g.ellipse(0, -11 - k, 3, 12 + k * .8, 0, 0, TAU); inkPath(k % 2 ? '#1f1c26' : '#2c2834', .7);
      });
    }
    // geta + legs
    for (const lx of [-3, 3]) {
      limb([[lx * .8, -12], [lx, -3]], '#e9e2d4', 2.6);
      rect(lx - 3, -3, 6.4, 1.6, '#7a3a20'); rect(lx - .5, -1.4, 1.2, 1.6, '#4a2412');
    }
    // hakama + robe
    g.beginPath(); curve([[-6, -15], [-7.5, -3], [7.5, -3], [6, -15]], true); inkPath('#6a6a74', .9);
    g.beginPath(); g.moveTo(-6.5, -27); g.lineTo(6.5, -27); g.lineTo(7, -13); g.lineTo(-7, -13); g.closePath(); inkPath('#efe8da', .9);
    rect(-7, -15.6, 14, 2.4, '#3a3240');
    for (const by of [-23, -18.5]) { circ(1.5, by, 2, C.ink); circ(1.5, by, 1.6, '#f08a2a'); }
    // arms
    const fan = o.fan ?? 0;
    if (o.crossed) {
      g.beginPath(); g.roundRect(-6, -23, 13, 4.5, 2); inkPath('#efe8da', .8);
    } else {
      limb([[-5, -25], [-7, -19], [-4, -15]], '#efe8da', 3);
      const hx = 7 + Math.cos(fan) * 2, hy = -22 + Math.sin(fan) * 2;
      limb([[5, -25], [8, -21], [hx, hy]], '#efe8da', 3);
      circ(hx, hy, 1.4, '#c8402a');
      tr(hx, hy, 1, fan - .4, () => yatsude(0, 0, 1));
    }
    // head
    tr(0, -32, 1, mood === 'sleep' ? .25 + Math.sin(tq * 1.5) * .05 : 0, () => {
      g.beginPath(); curve([[-6, 6], [-8, -2], [-4, -7.5], [4, -7.5], [7, -1], [5, 6], [0, 9]], true); inkPath('#f2f0ea', .7);
      g.beginPath(); g.arc(.5, -1, 6.3, 0, TAU); inkPath('#d6342a', .9);
      // the nose
      g.beginPath(); g.moveTo(4.4, -2.6); g.quadraticCurveTo(15, -2.8, 16.5, -1.2); g.quadraticCurveTo(15, .4, 4.6, 1.4); g.closePath(); inkPath('#d6342a', .8);
      stroke([[6, -1.6], [14, -1.6]], 'rgba(255,200,170,.6)', .6, 1, false);
      if (mood === 'sleep') { stroke([[1, -1.6], [3.6, -1.2]], C.ink, .7, 1, false); }
      else {
        ell(2.6, -2, 1.5, 1.2, '#fff8e8'); circ(3, -2, .7, '#120a0a');
      }
      // fierce brows + beard
      const bb = mood === 'stern' || mood === 'angry' ? 1 : 0;
      poly([[-1.5, -4.4 - bb], [5.6, -3.6 + bb * .6], [4.2, -5.6]], '#f6f3ee');
      g.beginPath(); curve([[-1, 3], [2, 4.6], [5, 3.6], [4, 9], [0, 11], [-3, 7]], true); inkPath('#f6f3ee', .6);
      stroke([[1.5, 3.2], [4.2, 2.4]], C.ink, .6, 1, false);
      // tokin cap
      g.beginPath(); g.moveTo(-1.4, -6.8); g.lineTo(3.4, -6.4); g.lineTo(2.2, -10.4); g.lineTo(.2, -10.4); g.closePath(); inkPath('#16141c', .6);
    });
    if (mood === 'sleep') T('z', 9 + Math.sin(tq * 2) * 1, -44 - (t * 4 % 6), { size: 7, italic: true, color: '#fff', a: .8 });
  }));
}
function yatsude(x, y, s) {
  tr(x, y, s, 0, () => {
    limb([[0, 0], [0, -4]], '#6a4a2a', .8, C.ink, .3);
    for (let k = 0; k < 7; k++) {
      const ang = -Math.PI / 2 + (k - 3) * .38;
      tr(0, -4, 1, ang + Math.PI / 2, () => { g.beginPath(); g.ellipse(0, -4.6, 1.9, 4.8, 0, 0, TAU); inkPath('#4f7a3a', .5); });
    }
  });
}

/* ============================================================ CHŌCHIN-OBAKE 提灯お化け — attention */
function lantern(x, y, s, o = {}) {
  const t = o.t ?? 0, tq = twos(t), lit = o.lit ?? 1, a = o.a ?? 1;
  withA(a, () => tr(x, y + Math.sin(t * 1.6) * 3 / Math.max(s, .1), s, o.rot ?? Math.sin(tq * 1.2) * .05, () => {
    if (lit > 0) glow(0, 0, 70 + 40 * lit, 'rgba(255,190,90,.9)', .55 * lit);
    if (o.cord) stroke([[0, -26], [0, -26 - o.cord]], '#2a2420', .9, 1, false);
    stroke([[-5, -25], [0, -29], [5, -25]], '#2a2420', 1, 1, false);
    const body = () => { g.beginPath(); curve([[-9, -22], [-16, -12], [-17, 2], [-15, 14], [-9, 22], [9, 22], [15, 14], [17, 2], [16, -12], [9, -22]], true); };
    body();
    g.fillStyle = rad(-2, -2, 2, 22, [[0, mixHex('#c9c0ad', '#fff6d6', lit)], [.7, mixHex('#a99f8c', '#ffd27a', lit)], [1, mixHex('#7d7466', '#e88a3a', lit)]]);
    g.fill(); g.lineWidth = 1.3; g.strokeStyle = C.ink; g.stroke();
    g.save(); body(); g.clip();
    g.strokeStyle = 'rgba(80,50,30,.4)'; g.lineWidth = .7;
    for (let k = -4; k <= 4; k++) { g.beginPath(); g.ellipse(0, k * 4.6, 18, 2.2, 0, 0, Math.PI); g.stroke(); }
    // the flame within, seen through the paper
    if (o.kit) { g.globalAlpha = .9; foxKit(0, 9, .55, { t, curl: 1, glow: .6 }); g.globalAlpha = 1; }
    // torn mouth + tongue
    const mo = o.mouth ?? .5;
    g.beginPath(); g.moveTo(-14, 7); g.lineTo(-9, 9 + mo * 2); g.lineTo(-5, 7.5); g.lineTo(-1, 10 + mo * 3); g.lineTo(4, 8); g.lineTo(9, 10 + mo * 2); g.lineTo(14, 7.5);
    g.lineTo(9, 11 + mo * 4); g.lineTo(0, 13 + mo * 5); g.lineTo(-9, 11 + mo * 4); g.closePath();
    g.fillStyle = '#2a0c0a'; g.fill();
    g.restore();
    rect(-10, -25, 20, 4.5, '#1c1a1a'); rect(-10, 21, 20, 4.5, '#1c1a1a');
    const tl = o.tongue ?? 10;
    if (tl > 0) {
      const w = Math.sin(tq * 3) * 2;
      g.beginPath(); g.moveTo(-3, 11 + mo * 4); g.quadraticCurveTo(-4 + w, 11 + tl * .6, -1 + w * 1.4, 11 + tl);
      g.quadraticCurveTo(2 + w * 1.4, 12 + tl, 3 + w, 11 + tl * .55); g.quadraticCurveTo(3, 12, 3, 11 + mo * 4); g.closePath(); inkPath('#e0405a', .8);
    }
    // one eye
    const eo = o.eye ?? 1;
    g.beginPath(); g.ellipse(2, -7, 6.5, 5 * Math.max(.08, eo), 0, 0, TAU); inkPath('#fffaf0', 1);
    if (eo > .2) { circ(2 + (o.look || 0) * 2.5, -7, 2.6 * Math.min(1, eo + .2), '#140a08'); circ(3 + (o.look || 0) * 2.5, -8.2, .8, '#fff'); }
  }));
}

/* ============================================================ BAKU 獏 — dreams */
function baku(x, y, s, o = {}) {
  const t = o.t ?? 0, tq = twos(t), ph = o.walk, a = o.a ?? 1;
  withA(a, () => tr(x, y, s, 0, () => {
    if ((o.dir || 1) < 0) g.scale(-1, 1);
    // legs with tiger stripes
    const legs = [[-12, 0], [-6, .5], [8, .25], [13, .75]];
    legs.forEach(([lx, off], i) => {
      const lift = ph === undefined ? 0 : Math.max(0, Math.sin(TAU * (ph + off))) * 3;
      const far = i % 2 === 0;
      g.beginPath(); g.roundRect(lx - 3, -14 - lift, 6, 14, 2.4); inkPath(far ? '#c9a24a' : '#e3b85a', .9);
      for (let k = 0; k < 3; k++) stroke([[lx - 2.6, -11 + k * 3.6 - lift], [lx + 2.6, -12 + k * 3.6 - lift]], '#2a1a10', .9, 1, false);
      g.beginPath(); g.ellipse(lx, -.8 - lift, 3.6, 1.6, 0, 0, TAU); inkPath('#f2eadc', .7);
    });
    // tail
    stroke([[-19, -22], [-25, -18 + Math.sin(tq * 3) * 2]], '#5a5e70', 1.4);
    circ(-25.5, -17 + Math.sin(tq * 3) * 2, 2.2, '#3a3e50');
    // body
    g.beginPath(); g.ellipse(0, -20, 21, 12, 0, 0, TAU); inkPath('#b9c3d6', 1.2);
    g.save(); g.beginPath(); g.ellipse(0, -20, 21, 12, 0, 0, TAU); g.clip();
    g.fillStyle = 'rgba(70,80,110,.25)'; g.fillRect(-22, -14, 44, 8);
    for (const [sx, sy] of [[-10, -24], [-2, -27], [6, -22], [-6, -17], [12, -26]]) circ(sx, sy, 1.8, 'rgba(60,64,90,.55)');
    g.restore();
    // flame-like curled tufts at the shoulder and haunch (as carved on temple eaves)
    for (const [cx, cy] of [[10, -14], [-13, -14]]) {
      g.strokeStyle = '#f2eadc'; g.lineWidth = 1.3;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx + k * 2.5 - 2.5, cy, 2.2, Math.PI, TAU * .95); g.stroke(); }
    }
    // head + trunk
    tr(19, -25, 1, Math.sin(tq * 1.4) * .04, () => {
      g.beginPath(); g.ellipse(0, 0, 9, 8, 0, 0, TAU); inkPath('#b9c3d6', 1.1);
      const curl = o.trunk ?? Math.sin(tq * 1.2) * .5;
      g.beginPath(); curve([[5, -2], [12, 0], [16, 5 - curl * 4], [16 + curl * 2, 11 - curl * 6], [13, 12 - curl * 5]], false);
      g.lineWidth = 6; g.strokeStyle = C.ink; g.lineCap = 'round'; g.stroke(); g.lineWidth = 4.2; g.strokeStyle = '#b9c3d6'; g.stroke();
      stroke([[7, 3.4], [10.5, 6]], '#f6f0e6', 1.6);
      g.beginPath(); g.ellipse(-4, -6.5, 3, 4.2, -.5, 0, TAU); inkPath('#9aa4ba', .8);
      ell(3.4, -2.2, 1.6, 1.6, '#fff8ea'); circ(3.8, -2.2, .9, '#1a1414');
      stroke([[1.4, -3.8], [5.4, -3.6]], C.ink, .9, 1, false);
      for (let k = 0; k < 3; k++) stroke([[-6 + k * 2, -8], [-5 + k * 2, -11 - k]], '#f2eadc', 1, 1, false);
    });
  }));
}
// a dream: iridescent bubble with a tiny picture-memory inside
function dream(x, y, r, t, seed, a = 1) {
  withA(a, () => {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = rad(x - r * .3, y - r * .3, 0, r, [[0, 'rgba(255,255,255,.18)'], [.7, `hsla(${(seed * 70 + t * 40) % 360},80%,70%,.12)`], [1, `hsla(${(seed * 70 + 120 + t * 40) % 360},90%,75%,.45)`]]);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.restore();
    circ(x - r * .35, y - r * .4, r * .16, 'rgba(255,255,255,.8)');
    const k = seed % 3;
    if (k === 0) circ(x, y + r * .1, r * .28, 'rgba(255,220,150,.6)');
    else if (k === 1) poly([[x - r * .4, y + r * .3], [x, y - r * .3], [x + r * .4, y + r * .3]], 'rgba(160,220,255,.5)');
    else stroke([[x - r * .4, y], [x - r * .1, y - r * .2], [x + r * .2, y + r * .1], [x + r * .45, y - r * .15]], 'rgba(200,255,200,.6)', r * .08);
  });
}

/* ============================================================ KODAMA 木霊 — stillness */
function kodama(x, y, s, o = {}) {
  const t = o.t ?? 0, a = o.a ?? 1, seed = o.seed || 0;
  // the rattle: a quick head-tilt tick now and then
  const tick = Math.floor(twos(t) * 2 + seed * 3);
  const rot = (hash(tick + seed * 11) > .62 ? (hash(tick * 3 + seed) - .5) * 1.2 : 0) * (o.rattle ?? 1);
  withA(a, () => tr(x, y, s, 0, () => {
    glow(0, -9, 22, 'rgba(220,255,230,.5)', .35);
    limb([[-1.6, -5], [-1.8, -.4]], '#f2f4ec', 1.6, 'rgba(60,70,60,.6)', .4);
    limb([[1.6, -5], [1.8, -.4]], '#f2f4ec', 1.6, 'rgba(60,70,60,.6)', .4);
    g.beginPath(); g.ellipse(0, -7, 3.2, 4, 0, 0, TAU); inkPath('#f4f6ee', .5, 'rgba(60,70,60,.6)');
    limb([[-2.6, -8], [-4.6, -5.4]], '#f2f4ec', 1.3, 'rgba(60,70,60,.6)', .4);
    limb([[2.6, -8], [4.6, -5.4]], '#f2f4ec', 1.3, 'rgba(60,70,60,.6)', .4);
    tr(0, -12.5, 1, rot, () => {
      g.beginPath(); curve([[-5, -1], [-4, -5], [0, -6.2], [4.4, -4.6], [5.4, 0], [3, 3.6], [-3, 3.6]], true);
      inkPath('#f6f8f0', .5, 'rgba(60,70,60,.6)');
      ell(-2, -1.4, 1, 1.3, '#25302a'); ell(2.2, -1.2, .9, 1.4, '#25302a'); ell(.2, 1.8, .8, .9, '#25302a');
    });
  }));
}

/* ============================================================ ITTAN-MOMEN 一反木綿 — shame
   a long strip of cotton following a spine of points; its head is the first point */
function ittan(spine, s, o = {}) {
  const a = o.a ?? 1;
  if (a <= .002) return;
  const L = [], R = [], n = spine.length;
  spine.forEach((p, k) => {
    const q = spine[Math.min(k + 1, n - 1)], pp = spine[Math.max(k - 1, 0)];
    const dx = q[0] - pp[0], dy = q[1] - pp[1], d = Math.hypot(dx, dy) || 1;
    const w = 13 * s * (k > n - 4 ? .5 + (n - 1 - k) * .17 : 1);
    L.push([p[0] - dy / d * w, p[1] + dx / d * w]); R.push([p[0] + dy / d * w, p[1] - dx / d * w]);
  });
  withA(a, () => {
    g.beginPath(); curve([...L, ...R.reverse()], true);
    g.fillStyle = lin(spine[0][0], spine[0][1], spine[n - 1][0], spine[n - 1][1], [[0, '#e8e6e0'], [1, '#9a9aa4']]);
    g.fill(); g.lineWidth = 1.4 * s; g.strokeStyle = 'rgba(30,30,40,.7)'; g.stroke();
    // weave texture
    stroke(spine, 'rgba(120,120,140,.35)', 1.2 * s);
    const [hx, hy] = spine[0], [nx, ny] = spine[1];
    const ang = Math.atan2(ny - hy, nx - hx) + Math.PI;
    tr(hx, hy, s, ang, () => {
      for (const ey of [-5, 5]) {
        ell(-4, ey, 2.4, 2, '#fbfbf6'); g.lineWidth = .5; g.strokeStyle = C.ink; g.stroke();
        circ(-3.4, ey + .4, 1.2, '#16141c');
        stroke([[-7, ey - 2.6], [-1.6, ey - 1.6 * Math.sign(ey)]], C.ink, .7, 1, false);
      }
    });
  });
}

/* ============================================================ TSUKUMOGAMI 付喪神 — the screen */
function phoneMon(x, y, s, o = {}) {
  const t = o.t ?? 0, tq = twos(t), a = o.a ?? 1, awake = o.awake ?? 1;
  withA(a, () => tr(x, y, s, o.rot || 0, () => {
    if (awake > 0) glow(0, -13, 50, 'rgba(255,90,170,.6)', .6 * awake);
    if (awake > .5) for (const sx of [-1, 1]) {
      const ph = tq * 6 + (sx > 0 ? Math.PI : 0);
      limb([[sx * 3, -1], [sx * 4, 3 + Math.max(0, Math.sin(ph)) * -1.5]], '#2a2a32', 1.1, C.ink, .3);
      limb([[sx * 7, -16], [sx * 11, -12 + Math.sin(ph) * 2], [sx * 12, -9]], '#2a2a32', 1.1, C.ink, .3);
    }
    g.beginPath(); g.roundRect(-7, -27, 14, 27, 2.6); inkPath('#1e1e28', 1);
    g.fillStyle = lin(0, -25, 0, -2, [[0, mixHex('#1a1a24', '#ff7ab8', awake)], [1, mixHex('#1a1a24', '#7a5aff', awake)]]);
    g.fillRect(-5.8, -25.4, 11.6, 23.6);
    if (awake > .3) {
      const eo = Math.min(1, (awake - .3) / .5) * (o.wink ? .1 : 1);
      g.beginPath(); g.ellipse(0, -16, 4.2, 3.2 * eo, 0, 0, TAU); inkPath('#fff8fb', .6);
      if (eo > .3) { circ((o.look || 0) * 1.6, -16, 1.8, '#1a0a1a'); circ((o.look || 0) * 1.6 + .7, -16.8, .5, '#fff'); }
      for (let k = -2; k <= 2; k++) stroke([[k * 1.6, -19.4 + Math.abs(k) * .3], [k * 2.1, -21 + Math.abs(k) * .5]], C.ink, .5, eo, false);
      g.beginPath(); g.ellipse(0, -8, 2.8, 1.6, 0, 0, Math.PI); inkPath('#3a0a1a', .4);
      g.beginPath(); g.moveTo(-1, -7); g.quadraticCurveTo(0 + Math.sin(tq * 4), -2, 1.2, -7); inkPath('#ff5a7a', .3);
    }
  }));
}

/* ============================================================ KASA-OBAKE 傘お化け */
function kasa(x, y, s, o = {}) {
  const t = o.t ?? 0, hop = Math.abs(Math.sin(t * 5 + (o.seed || 0))) * 8;
  tr(x, y - hop * s, s, Math.sin(t * 5 + (o.seed || 0)) * .08, () => {
    limb([[0, -6], [0, 0]], '#e8d8b8', 2.2);
    rect(-3, 0, 6, 1.4, '#7a3a20'); rect(-.6, 1.4, 1.2, 1.6, '#4a2412');
    g.beginPath(); g.moveTo(0, -42); g.lineTo(-11, -8); g.quadraticCurveTo(0, -4, 11, -8); g.closePath(); inkPath(o.color || '#b4362e', 1.2);
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .7;
    for (const k of [-6, 0, 6]) { g.beginPath(); g.moveTo(0, -42); g.lineTo(k, -6); g.stroke(); }
    ell(0, -25, 3.6, 3, '#fff8ea'); circ(.6, -25, 1.6, '#160a08');
    g.beginPath(); g.moveTo(-2, -15); g.quadraticCurveTo(0, -4 + Math.sin(t * 7) * 2, 3, -6); g.quadraticCurveTo(1, -13, 2, -15); inkPath('#e0405a', .6);
  });
}

/* ============================================================ the night parade (hyakki yagyō) */
function oni(x, y, s, t) {
  tr(x, y, s, 0, () => {
    const st = Math.sin(twos(t) * 6) * 2;
    for (const lx of [-3, 3]) limb([[lx, -14], [lx + (lx > 0 ? st : -st) * .4, 0]], '#c83a2a', 3.6);
    g.beginPath(); g.ellipse(0, -16, 6, 4, 0, 0, TAU); inkPath('#e8c84a', .8);
    for (let k = -4; k <= 4; k += 2) stroke([[k, -19], [k + 1, -13]], '#1a1010', .8, 1, false);
    g.beginPath(); g.ellipse(0, -25, 7, 9, 0, 0, TAU); inkPath('#c83a2a', 1);
    limb([[5, -30], [10, -26], [12, -34]], '#c83a2a', 3);
    limb([[12, -34], [15, -50]], '#5a4030', 2.4);
    for (let k = 0; k < 4; k++) circ(13.5 + k * .4, -38 - k * 3.4, .8, '#a8a8a8');
    tr(0, -38, 1, 0, () => {
      g.beginPath(); g.arc(0, 0, 6.4, 0, TAU); inkPath('#c83a2a', 1);
      for (const sx of [-1, 1]) { poly([[sx * 2, -5], [sx * 4.5, -11], [sx * 4.5, -4]], '#f0e6c8'); }
      g.beginPath(); curve([[-6, -3], [-3, -7], [3, -7], [6, -3]], false); g.lineWidth = 2.4; g.strokeStyle = '#1a1010'; g.stroke();
      for (const ex of [-2.4, 2.4]) { ell(ex, -1, 1.6, 1.3, '#ffe85a'); circ(ex, -1, .6, '#1a0a0a'); }
      stroke([[-3, 3], [3, 3]], '#1a0a0a', 1, 1, false);
      poly([[-2.4, 3], [-1.6, 4.6], [-.8, 3]], '#fff'); poly([[.8, 3], [1.6, 4.6], [2.4, 3]], '#fff');
    });
  });
}
function kappa(x, y, s, t) {
  tr(x, y, s, 0, () => {
    const st = Math.sin(twos(t) * 6 + 1) * 2;
    for (const lx of [-2.4, 2.4]) limb([[lx, -10], [lx + (lx > 0 ? st : -st) * .4, 0]], '#5a9a5a', 2.6);
    g.beginPath(); g.ellipse(-3, -17, 6, 8, .2, 0, TAU); inkPath('#8a6a3a', .9);
    g.beginPath(); g.ellipse(0, -16, 5, 7, 0, 0, TAU); inkPath('#6aaa62', .9);
    limb([[3, -19], [7, -14], [9, -16]], '#6aaa62', 2.2);
    tr(1, -27, 1, 0, () => {
      g.beginPath(); g.arc(0, 0, 5.4, 0, TAU); inkPath('#6aaa62', .9);
      g.beginPath(); g.ellipse(0, -4.6, 4.6, 1.6, 0, 0, TAU); inkPath('#cfe6e8', .7);
      for (let k = -4; k <= 4; k += 2) stroke([[k, -5.4], [k * 1.2, -7.2]], '#2a4a2a', .7, 1, false);
      poly([[3.4, -.4], [8.5, 1.2], [3.4, 2.6]], '#e8c04a'); g.lineWidth = .6; g.strokeStyle = C.ink; g.stroke();
      circ(1.6, -1.4, 1, '#fff'); circ(1.9, -1.4, .5, '#111');
    });
  });
}
function nopperabo(x, y, s, t) {
  tr(x, y, s, 0, () => {
    g.beginPath(); g.moveTo(-6, -30); g.lineTo(6, -30); g.lineTo(8, 0); g.lineTo(-8, 0); g.closePath(); inkPath('#3a4a6a', 1);
    stroke([[-1, -30], [2, -12], [1, 0]], '#d8c8a0', 1, 1, false);
    rect(-7, -17, 14, 3, '#b8a070');
    g.beginPath(); g.ellipse(0, -36, 5.4, 6.6, 0, 0, TAU); inkPath('#f2e4cc', 1);
    g.beginPath(); g.ellipse(-.4, -40, 5.6, 3.4, 0, Math.PI, TAU); inkPath('#1e1a1a', .6);
    rect(-2, -45.5, 4, 3, '#1e1a1a');
  });
}
function hitotsume(x, y, s, t) {
  tr(x, y, s, 0, () => {
    g.beginPath(); g.moveTo(-5, -22); g.lineTo(5, -22); g.lineTo(6.4, 0); g.lineTo(-6.4, 0); g.closePath(); inkPath('#6a8aa8', 1);
    tr(0, -28, 1, Math.sin(twos(t) * 3) * .1, () => {
      g.beginPath(); g.arc(0, 0, 6, 0, TAU); inkPath('#f4dcc0', 1);
      ell(0, -1, 3, 2.6, '#fff'); circ(.4, -1, 1.5, '#140a08');
      g.beginPath(); g.moveTo(-1.2, 2.6); g.quadraticCurveTo(0, 9 + Math.sin(t * 6), 1.4, 2.6); inkPath('#e0405a', .5);
    });
  });
}
function nekomata(x, y, s, t) {
  tr(x, y, s, 0, () => {
    const st = Math.sin(twos(t) * 6 + 2);
    for (const k of [0, 1]) stroke([[-4, -10], [-10 - k * 3, -18 + k * 2], [-8 - k * 4, -26 + st * 2]], '#e8e0d0', 2, 1);
    for (const lx of [-2, 2]) limb([[lx, -9], [lx + st * (lx > 0 ? 1 : -1), 0]], '#e8e0d0', 2.4);
    g.beginPath(); g.ellipse(0, -14, 4.6, 7, 0, 0, TAU); inkPath('#f2ece0', .9);
    limb([[3, -18], [7, -24 + st * 2]], '#f2ece0', 1.8); limb([[-3, -18], [-6, -24 - st * 2]], '#f2ece0', 1.8);
    tr(0, -24, 1, 0, () => {
      g.beginPath(); g.arc(0, 0, 4.6, 0, TAU); inkPath('#f2ece0', .9);
      poly([[-4, -2], [-3.4, -7], [-1, -3.6]], '#f2ece0'); poly([[4, -2], [3.4, -7], [1, -3.6]], '#f2ece0');
      circ(-2.6, -2, 1.8, '#3a2a20');
      for (const ex of [-1.6, 1.6]) { ell(ex, -.4, 1, 1.2, '#c8f04a'); ell(ex, -.4, .3, 1, '#111'); }
    });
    // a tenugui on its head, dancing
    poly([[-3, -29], [3, -29.5], [5.5, -27], [-4.5, -26.5]], '#b84a3a');
  });
}
function nurikabe(x, y, s, t) {
  tr(x, y, s, 0, () => {
    const st = Math.sin(twos(t) * 4);
    for (const lx of [-6, 6]) limb([[lx, -4], [lx + st * (lx > 0 ? 1 : -1), 0]], '#8a8478', 2.6);
    g.beginPath(); g.roundRect(-14, -36, 28, 33, 3); inkPath('#b8b0a0', 1.1);
    g.strokeStyle = 'rgba(60,50,40,.35)'; g.lineWidth = .7;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-14, -28 + k * 7); g.lineTo(14, -28 + k * 7); g.stroke(); }
    for (const ex of [-5, 5]) { ell(ex, -22, 2, 1.4, '#fffaf0'); circ(ex, -22, .8, '#111'); }
    stroke([[-3, -15], [3, -15]], '#3a3028', .9, 1, false);
  });
}
function tanuki(x, y, s, t) {
  tr(x, y, s, 0, () => {
    const beat = Math.pow(Math.max(0, Math.sin(t * TAU * 1.5)), 6);
    for (const lx of [-3, 3]) limb([[lx, -8], [lx, 0]], '#6a4a30', 3);
    g.beginPath(); g.ellipse(0, -14, 8 + beat, 9 + beat, 0, 0, TAU); inkPath('#e8d4b0', 1);
    g.beginPath(); g.ellipse(0, -14, 8.6, 10, 0, -Math.PI * .6, Math.PI * .6, true); g.fillStyle = '#7a5434'; g.fill();
    limb([[-6, -19], [-4, -14 - beat * 3]], '#7a5434', 2.4); limb([[6, -19], [4, -14 - beat * 3]], '#7a5434', 2.4);
    tr(0, -26, 1, 0, () => {
      g.beginPath(); g.arc(0, 0, 5.6, 0, TAU); inkPath('#9a7050', 1);
      circ(-4, -4.6, 1.8, '#7a5434'); circ(4, -4.6, 1.8, '#7a5434');
      ell(-2.2, 0, 2, 1.6, '#3a2418'); ell(2.2, 0, 2, 1.6, '#3a2418');
      circ(-2, -.2, .6, '#fff'); circ(2.4, -.2, .6, '#fff');
      ell(0, 2.4, 1.6, 1.2, '#efe2c8'); circ(0, 2, .6, '#111');
    });
    // straw hat
    poly([[-8, -31], [0, -36], [8, -31]], '#c8a050'); g.lineWidth = .6; g.strokeStyle = C.ink; g.stroke();
  });
}
function rokurokubi(x, y, s, t) {
  tr(x, y, s, 0, () => {
    g.beginPath(); g.moveTo(-6, -28); g.lineTo(6, -28); g.lineTo(9, 0); g.lineTo(-9, 0); g.closePath(); inkPath('#7a3a6a', 1);
    for (const k of [-4, 0, 4]) circ(k, -8, 1.2, '#f0c0d0');
    rect(-7, -18, 14, 3, '#e8b84a');
    const neck = [];
    for (let k = 0; k <= 12; k++) neck.push([Math.sin(k * .6 + t * 1.4) * 7 + k * .9, -29 - k * 3.6]);
    stroke(neck, C.ink, 3.6); stroke(neck, '#f6e6d8', 2.4);
    const [hx, hy] = neck[12];
    tr(hx, hy, 1, 0, () => {
      g.beginPath(); g.ellipse(0, 0, 4.6, 5.4, 0, 0, TAU); inkPath('#f6e6d8', .9);
      g.beginPath(); curve([[-5, 2], [-5.6, -4], [0, -7.4], [5.4, -4], [5, 0], [2, -3], [-3, -2]], true); inkPath('#16121a', .6);
      circ(-1.6, 3.2, 1.2, 'rgba(255,120,140,.4)');
      stroke([[-2.4, .6], [-.8, 1]], C.ink, .6, 1, false); stroke([[1, 1], [2.6, .6]], C.ink, .6, 1, false);
      circ(.2, 3.4, .6, '#c83a4a');
    });
  });
}
const PARADE = [oni, kappa, nopperabo, hitotsume, nekomata, nurikabe, tanuki, rokurokubi];
