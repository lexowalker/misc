// Act II: the wandering. Kingdoms, the wise, a dying hand, the silent, the learned, the mountains, the doorways, the whisper.
'use strict';
function chestGlow(c, a, k = 1, size = 1) {
  const pulse = 1 + .18 * Math.sin(c.t * 2.2) + c.aud[0] * .5;
  c.glow(a.chest[0], a.chest[1], (3 + a.hu * .12) * size, C.ember, 2.4 * k * pulse, 2);
}
function pathLine(g, f, x0 = -10, x1 = SW + 10, bottom = SH + 10) {
  g.beginPath(); g.moveTo(x0, bottom);
  for (let x = x0; x <= x1; x += 6) g.lineTo(x, f(x));
  g.lineTo(x1, bottom); g.closePath(); g.fill();
}

// ---------- B1: the kingdoms, the ancient cities ----------
shot(52.6, 60.6, c => {
  const t = c.t, u = c.u;
  const camX = u * 60;
  const g3 = c.L(3);
  g3.save(); g3.translate(-camX * .22, 0); K.city(g3, -300, SW + 600, 712, 64, 101); g3.restore();
  const g1 = c.L(1);
  g1.save(); g1.translate(-camX * .5, 0); K.city(g1, -300, SW + 900, 836, 118, 207); g1.restore();
  const g = c.L(0);
  const gy = x => 938 - Math.sin((x + camX) * .0021) * 16 - (K.fbm((x + camX) * .004) - .5) * 20;
  pathLine(g, gy);
  const x = 520 + u * 18;
  const a = K.seeker(g, { x, y: gy(x) + 3, h: 205, age: 1, face: 1, walk: 1, phase: u * 4.9, wind: .2 });
  for (const tx of [1350, 2150]) { const px = tx - camX; if (px > -200 && px < SW + 200) K.tree(g, px, gy(px) + 6, 260, tx + 3, { leaves: .9, spread: .7 }); }
  const sun = [1480, 610];
  c.run('land', landU({
    zen: hexLin('#2f416e'), hor: hexLin('#f6b066'), horY: 420, gradP: 1.6,
    sun: toGL(sun), sunR: 44, glow: .75, sunCol: [3.8, 2.3, 1.0],
    cloud: .8, cloudY: SH - 360, cloudH: 110, cloudS: 1.2, cloudCol: hexLin('#9a6a6a'),
    ridges: [
      { y: 450, amp: 120, freq: .0015, rough: .6, col: hexLin('#c48a68'), mist: .7, x: camX * .08 },
      { y: 410, amp: 70, freq: .0022, rough: .4, col: hexLin('#a8705a'), mist: .6, x: camX * .14 },
    ], mist: hexLin('#f0aa6a'), mistH: 70,
    a3: 2, c3: hexLin('#7a4e48'), a1: 2, c1: hexLin('#2c1e24'), c0: hexLin('#0a0709'), rim: .8,
  }));
  chestGlow(c, a, .9);
  c.post.sun = [sun[0] / SW, 1 - sun[1] / SH]; c.post.rays = .45; c.post.rayCol = [1, .7, .4]; c.post.bloom = .6; c.post.vig = .55;
}, { fade: 1.0 });

// ---------- B2a: listening to the wisest, under a great tree ----------
shot(60.6, 64.0, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  g.save(); const z = 1 + u * .02; g.translate(SW / 2, SH * .8); g.scale(z, z); g.translate(-SW / 2, -SH * .8);
  K.ground(g, 900, 14, .002, 7);
  K.tree(g, 1330, 905, 760, 31, { leaves: 1.05, spread: .75, depth: 7, sway: Math.sin(t * .7) });
  const sage = K.seeker(g, { x: 1170, y: 902, h: 250, age: 2, face: -1, pose: 'cross', arms: 'hold', look: -.05 });
  const me = K.seeker(g, { x: 830, y: 902, h: 250, age: 1, face: 1, pose: 'cross', arms: 'cup', look: .08 + .04 * Math.sin(t) });
  g.restore();
  const sun = [330, 860];
  c.run('land', landU({
    zen: hexLin('#20264e'), hor: hexLin('#e98c62'), horY: 300, gradP: 1.4,
    sun: toGL(sun), sunR: 30, glow: .55, disk: 0, sunCol: [3.4, 1.8, .9],
    cloud: .9, cloudY: SH - 330, cloudH: 120, cloudS: 1.0, cloudCol: hexLin('#704058'),
    star: smooth(seg(t, 60.6, 64)) * .12,
    ridges: [{ y: 260, amp: 70, freq: .0018, rough: .5, col: hexLin('#3c2a3c'), mist: .5 }],
    mist: hexLin('#c47a6a'), mistH: 40, c0: hexLin('#07050a'), rim: .5,
  }));
  const lamp = [1000, 880];
  c.glow(lamp[0], lamp[1], 5, [1, .65, .3], 3 + .4 * Math.sin(t * 9) * Math.sin(t * 5.3), 3);
  chestGlow(c, me, .8);
  c.post.bloom = .7; c.post.vig = .65;
}, { fade: .7 });

// ---------- B2b: holding a dying hand; a light goes up ----------
shot(64.0, 67.4, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  const gy = x => 900 + (x - SW / 2) ** 2 * .00008 + (K.fbm(x * .004 + 2) - .5) * 14;
  pathLine(g, gy);
  K.lying(g, 880, gy(880) + 5, 330);
  const me = K.seeker(g, { x: 1110, y: gy(1110) + 3, h: 360, age: 1, face: -1, pose: 'kneel', arms: 'cup', look: -.35 });
  const rise = ease(seg(t, 64.9, 67.4));
  const lx = lerp(835, 1010, rise), ly = lerp(gy(835) - 40, 230, rise);
  c.run('land', landU({
    zen: hexLin('#03061a'), hor: hexLin('#18234a'), horY: 250, gradP: 1.3,
    star: 1, mw: .25, mwAng: -.6, mwOff: [.2, .1],
    ridges: [{ y: 120, amp: 40, freq: .002, rough: .4, col: hexLin('#0b1022'), mist: .35 }],
    mist: hexLin('#1c2850'), mistH: 50, c0: hexLin('#020306'), rim: 0,
  }));
  const k = smooth(seg(t, 64.3, 65.2));
  c.glow(lx, ly, lerp(6, 2.2, rise), [.95, .9, 1], k * lerp(2.6, 3.5, rise), lerp(2.5, 1, rise));
  chestGlow(c, me, .7);
  c.post.bloom = .8; c.post.vig = .7;
}, { fade: .6 });

// ---------- B3a: sitting beside the silent, by still water ----------
shot(67.4, 70.5, c => {
  const t = c.t, u = c.u;
  const g = c.L(0), g1 = c.L(1);
  const bankY = 880;
  K.smoothPath(g, [[-60, bankY - 26], [220, bankY - 18], [520, bankY - 4], [760, bankY - 8], [1080, bankY - 2], [1380, bankY + 14], [1700, bankY + 6], [SW + 60, bankY + 22], [SW + 60, SH + 20], [-60, SH + 20]], true); g.fill();
  K.rock(g, 1260, bankY + 14, 150, 30, 9); K.rock(g, 300, bankY - 10, 220, 34, 13);
  g.lineWidth = 2.4; g.lineCap = 'round';
  const rr = K.rng(41);
  for (const [cx, n] of [[110, 9], [1480, 12], [1760, 7]]) for (let i = 0; i < n; i++) {
    const x = cx + (rr() - .5) * 120, hh = 40 + rr() * 70, sw = Math.sin(t * 1.3 + i) * 4 + (rr() - .5) * 20, base = bankY + (x > 1300 ? 8 : -16);
    g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + sw * .4, base - hh * .6, x + sw, base - hh); g.stroke();
  }
  const elder = K.seeker(g, { x: 1020, y: bankY - 6, h: 230, age: 2, face: 1, pose: 'cross', arms: 'hold', look: -.02 });
  const me = K.seeker(g, { x: 780, y: bankY - 6, h: 230, age: 1, face: 1, pose: 'cross', arms: 'hold', look: -.02 });
  g1.beginPath(); g1.moveTo(0, 548); g1.bezierCurveTo(300, 520, 520, 536, 760, 546); g1.bezierCurveTo(1100, 556, 1500, 530, SW, 544); g1.lineTo(SW, 552); g1.lineTo(0, 552); g1.fill();
  c.run('sea', seaU({
    uCam: [0, 1.4, 0], uPitch: .01, uFov: .8, uSun: sunDir(.06, -.6), uWaveT: t * .5, uWaveA: .14,
    uZen: hexLin('#3c5a8c'), uHor: hexLin('#e8c0b8'), uWater: hexLin('#1a2a40'), uHaze: hexLin('#d8c0c0'), uFog: .02,
    uSunCol: [2.6, 1.9, 1.5], uMie: .6, uGlit: .4, uSil: hexLin('#16141c'), uSil1: hexLin('#4a4658'), uRimK: .2,
    uCloud: .6, uCloudCol: hexLin('#c8a8b8'), uCloudY: 1.2,
  }));
  chestGlow(c, me, .6);
  c.post.bloom = .45; c.post.vig = .5; c.post.satur = .85;
}, { fade: .6 });

// ---------- B3b: hearing the learned speak ----------
function listener(g, x, y, s) {
  g.beginPath(); g.ellipse(x, y - s * 1.05, s * .22, s * .26, 0, 0, Math.PI * 2); g.fill();
  K.smoothPath(g, [[x - s * .42, y], [x - s * .4, y - s * .6], [x - s * .18, y - s * .82], [x + s * .18, y - s * .82], [x + s * .4, y - s * .6], [x + s * .42, y]], true); g.fill();
}
shot(70.5, 73.7, c => {
  const t = c.t, u = c.u;
  const g1 = c.L(1), g = c.L(0);
  // the temple on its steps
  for (let i = 0; i < 5; i++) g1.fillRect(560 - i * 40, 700 + i * 22, 800 + i * 80, 24);
  K.colonnade(g1, 960, 700, 640, 300, 8);
  K.seeker(g1, { x: 960, y: 700 + 22 * 2 - 40, h: 120, age: 2, face: 1, arms: 'reach', armK: .6 + .3 * Math.sin(t * 1.3), look: .05 });
  const r = K.rng(5);
  let me;
  for (let row = 0; row < 4; row++) {
    const y = 870 + row * 64, s = 70 + row * 26, n = 9 + row * 2;
    for (let i = 0; i < n; i++) {
      const x = SW / 2 + (i - (n - 1) / 2) * s * 1.05 + (r() - .5) * s * .3;
      listener(g, x, y + (r() - .5) * 8, s);
      if (row === 3 && i === Math.floor(n / 2) - 2) me = { chest: [x, y - s * .55], hu: s * .3 };
    }
  }
  c.run('land', landU({
    zen: hexLin('#0d1434'), hor: hexLin('#c9705a'), horY: 400, gradP: 1.3,
    sun: [SW * .5, -200], glow: .2, disk: 0, sunCol: [3, 1.6, .8], star: .5,
    ridges: [{ y: 420, amp: 60, freq: .002, rough: .5, col: hexLin('#3a2632'), mist: .5 }],
    mist: hexLin('#a85c58'), mistH: 50, a1: 1, c1: hexLin('#1a1218'), c0: hexLin('#050407'), rim: 0,
  }));
  if (me) c.glow(me.chest[0], me.chest[1], 6, C.ember, 1.4, 3);
  for (const [x, y] of [[520, 690], [1400, 690]]) c.glow(x, y, 5, [1, .6, .3], 2.5 + Math.sin(t * 7 + x) * .4, 3);
  c.post.bloom = .7; c.post.vig = .6;
}, { fade: .6 });

// ---------- B4: climbing the highest mountains ----------
function ridgePath(x) {
  const up = 1000 - Math.max(0, x - 250) * .56, down = 420 + (x - 1350) * .9;
  const base = x < 1350 ? up : Math.max(up, down);
  const crag = (K.fbm(x * .011 + 1) - .5) * 46 + (K.fbm(x * .035 + 7) - .5) * 16 + Math.abs(Math.sin(x * .021)) * -10;
  return base + crag * (x < 1310 || x > 1390 ? 1 : .2);
}
shot(73.7, 81.0, c => {
  const t = c.t, u = c.u;
  const lift = ease(seg(t, 73.7, 81)) * 160;
  const g = c.L(0);
  g.save(); g.translate(0, lift);
  g.beginPath(); g.moveTo(-10, SH + 300);
  for (let x = -10; x <= SW + 10; x += 5) g.lineTo(x, ridgePath(x));
  g.lineTo(SW + 10, SH + 300); g.fill();
  const climb = ease(seg(t, 73.8, 78.6));
  const x = lerp(520, 1338, climb);
  const standing = t > 78.6;
  const a = K.seeker(g, { x, y: ridgePath(x) + 3, h: 190, age: 1, face: 1, walk: standing ? Math.max(0, 1 - (t - 78.6) * 2) : 1, phase: u * 4.2, lean: standing ? 0 : .22, wind: .35 + Math.sin(t * 1.7) * .2, staff: true, arms: 'staff' });
  g.restore();
  a.chest[1] += lift;
  const cols = ridgeCols(5, hexLin('#3a4a6a'), hexLin('#c8d4e6'), 1.4);
  c.run('land', landU({
    zen: hexLin('#1e3d78'), hor: hexLin('#dfe6ee'), horY: 520 - lift, gradP: 1.3,
    sun: [380, SH - 230 + lift * .3], sunR: 26, glow: .45, sunCol: [3.2, 3.0, 2.6],
    cloud: .6, cloudY: 520 - lift, cloudH: 60, cloudS: 1.6, cloudCol: hexLin('#ffffff'),
    ridges: [
      { y: 520 - lift * .3, amp: 180, freq: .0021, rough: .9, col: cols[0], mist: .7 },
      { y: 470 - lift * .4, amp: 160, freq: .0026, rough: .9, col: cols[1], mist: .6 },
      { y: 410 - lift * .5, amp: 140, freq: .0031, rough: .85, col: cols[2], mist: .5 },
      { y: 330 - lift * .65, amp: 120, freq: .0036, rough: .8, col: cols[3], mist: .45 },
      { y: 240 - lift * .8, amp: 100, freq: .0042, rough: .75, col: cols[4], mist: .4 },
    ], mist: hexLin('#e8eef6'), mistH: 50, c0: hexLin('#0c0f18'), rim: .5,
  }));
  chestGlow(c, a, .5);
  c.post.sun = [380 / SW, (SH - 230 + lift * .3) / SH]; c.post.rays = .2; c.post.rayCol = [1, .95, .85]; c.post.bloom = .45; c.post.vig = .5;
}, { fade: .7 });

// ---------- B5a: each answer was a doorway ----------
function archDoor(g, x, base, w, h, frame) {
  g.beginPath();
  K.archPath(g, x, base, w + frame * 2, h + frame);
  K.archPath(g, x, base, w, h);
  g.fill('evenodd');
}
shot(81.0, 84.2, c => {
  const t = c.t, u = c.u;
  const push = easeInC(seg(t, 82.6, 84.2));
  const z = 1 + push * 5.5;
  const cx = 960, cy = 610;
  const tf = g => { g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy); };
  // world A: the summit by day
  const A = c.tmp('worldA'), B = c.tmp('worldB');
  const g0 = c.L(0);
  g0.save(); tf(g0);
  g0.beginPath(); g0.moveTo(-200, SH + 400); g0.lineTo(-200, 860); g0.quadraticCurveTo(600, 790, 960, 780); g0.quadraticCurveTo(1300, 790, SW + 200, 880); g0.lineTo(SW + 200, SH + 400); g0.fill();
  archDoor(g0, 960, 785, 210, 420, 34);
  const walkIn = seg(t, 81.6, 83.4);
  const fig = K.seeker(g0, { x: 960, y: 820 - walkIn * 30, h: lerp(230, 180, walkIn), age: 1, face: 0, walk: walkIn > 0 && walkIn < 1 ? 1 : 0, phase: t * 5, wind: .2 });
  g0.restore();
  const g3 = c.L(3);
  g3.save(); tf(g3); g3.beginPath(); K.archPath(g3, 960, 785, 210, 420); g3.fill(); g3.restore();
  const cols = ridgeCols(4, hexLin('#3a4a6a'), hexLin('#c8d4e6'), 1.4);
  c.run('land', landU({
    zen: hexLin('#1e3d78'), hor: hexLin('#dfe6ee'), horY: 360, gradP: 1.3,
    sun: [380, SH - 160], sunR: 26, glow: .45, sunCol: [3.2, 3.0, 2.6],
    ridges: cols.map((col, i) => ({ y: 470 - i * 70, amp: 140 - i * 15, freq: .0024 + i * .0006, rough: .85, col, mist: .6 - i * .05 })),
    mist: hexLin('#e8eef6'), mistH: 50, c0: hexLin('#0c0f18'), rim: .4, a3: -1,
  }), A);
  c.run('land', landU({
    zen: hexLin('#02040f'), hor: hexLin('#1b1d4a'), horY: 300, gradP: 1.2, star: 1.3, mw: .9, mwAng: .9, mwOff: [0, .05],
    ridges: [], mist: hexLin('#1b1d4a'), a3: -1,
  }), B);
  c.run('portal', { uA: A, uB: B, uFrame: hexLin('#0c0f18'), uSpill: [.3, .35, .8], uSpillK: .25 });
  c.post.bloom = .5; c.post.vig = .55;
}, { fade: .6 });
function easeInC(x) { x = clamp(x); return x * x * x; }

// ---------- B5b: ...and each doorway opened wide ----------
shot(84.2, 90.0, c => {
  const t = c.t;
  const z = .15 + (t - 84.2) * .52;
  c.run('doors', { uZ: z, uF: 4.6 });
  c.post.bloom = .45; c.post.vig = .6;
}, { fade: .35 });

// ---------- B5c: a thousand further questions ----------
shot(90.0, 94.0, c => {
  const t = c.t, u = c.u;
  const hz = 700;
  const g2 = c.L(2), g0 = c.L(0);
  const r = K.rng(77);
  const doors = [];
  for (let i = 0; i < 420; i++) {
    const zz = 2.5 + r() * 60;
    const x = SW / 2 + (r() - .5) * 2.4 * SW / zz * 6;
    doors.push([zz, x, r()]);
  }
  doors.sort((a, b) => b[0] - a[0]);
  const reveal = seg(t, 90, 92.5);
  for (const [zz, x, k] of doors) {
    if (k > reveal * 1.4) continue;
    const s = 800 / zz, y = hz + 1100 / zz;
    if (x < -s || x > SW + s) continue;
    const hue = [[1, .8, .5], [.6, .8, 1], [1, .6, .5], [.8, .9, .7], [.9, .7, 1]][Math.floor(k * 5)];
    const b = .6 + .4 * Math.sin(t * 2 + k * 30);
    g2.fillStyle = `rgba(${hue.map(v => Math.round(v * 255 * b)).join(',')},1)`;
    g2.beginPath(); K.archPath(g2, x, y, s * .13, s * .42); g2.fill();
    g2.save(); g2.globalAlpha = .35; g2.beginPath(); g2.ellipse(x, y + s * .02, s * .3, s * .035, 0, 0, Math.PI * 2); g2.fill(); g2.restore();
    g0.beginPath(); K.archPath(g0, x, y, s * .2, s * .48); K.archPath(g0, x, y, s * .13, s * .42); g0.fill('evenodd');
  }
  const me = K.seeker(g0, { x: SW * .3, y: SH + 330, h: 960, age: 1, face: 0, look: .05 });
  c.run('land', landU({
    zen: hexLin('#0c1236'), hor: hexLin('#e08a5a'), horY: SH - hz, gradP: 1.2,
    sun: [SW / 2, SH - hz - 30], glow: .35, disk: 0, sunCol: [3, 1.6, .7], star: .5,
    ridges: [{ y: SH - hz + 2, amp: 4, freq: .002, rough: .2, col: hexLin('#1c1520'), mist: .4 }],
    mist: hexLin('#7a4a50'), mistH: 30, c0: hexLin('#050408'), emit: 2.2, rim: .5, bg: [me.chest[0], me.chest[1] - 40, 260, .35],
  }));
  c.post.bloom = .7; c.post.vig = .6;
}, { fade: .8 });

// ---------- B6: still I hear a whisper ----------
shot(94.0, 111.3, c => {
  const t = c.t, u = c.u;
  const night = smooth(seg(t, 95, 104));
  const tilt = ease(seg(t, 106.5, 111.3));
  const hzY = SH - 560 - tilt * 900;          // GL y of the horizon
  const g0 = c.L(0);
  g0.save(); g0.translate(0, tilt * 900);
  g0.fillRect(-10, SH - hzY - 2, SW + 20, 1400);
  const walk = seg(t, 101, 108.5);
  const dist = 1 + ease(walk) * 3.2;               // relative distance from camera
  const fh = 760 / dist;
  const fy = (SH - hzY) + fh * .62;                  // camera at chest height
  const fx = lerp(SW * .42, SW * .5, ease(walk));
  const me = K.seeker(g0, { x: fx, y: fy, h: fh, age: 1, face: 0, walk: walk > 0 && walk < 1 ? 1 : 0, phase: t * 4.6, look: lerp(.15, 0, night) });
  g0.restore();
  // the far light: it calls, and his light answers
  const call = t2 => Math.exp(-Math.pow((t - t2) / .35, 2));
  const pulse = call(94.4) + call(97.4) + call(100.8) + call(104.3) + .25;
  const answer = call(95.2) + call(98.2) + call(101.6) + call(105.1) + .3;
  // constellations that remember a face
  const g2 = c.L(2);
  const face = seg(t, 103.6, 108);
  if (face > 0 && face < 1) {
    const a = Math.sin(face * Math.PI) * .55;
    g2.save(); g2.translate(1320, 330 + tilt * 900); g2.scale(1.15, 1.15);
    const pts = [[-40, -170], [30, -150], [70, -95], [78, -40], [104, 10], [80, 30], [86, 62], [70, 88], [40, 120], [-20, 132], [-90, 80], [-120, -40], [-95, -130]];
    g2.strokeStyle = `rgba(150,170,255,${a * .35})`; g2.lineWidth = 1.4;
    g2.beginPath(); pts.forEach(([x, y], i) => i ? g2.lineTo(x, y) : g2.moveTo(x, y)); g2.stroke();
    g2.fillStyle = `rgba(220,230,255,${a})`;
    for (const [x, y] of pts) { g2.beginPath(); g2.arc(x, y, 2.4, 0, Math.PI * 2); g2.fill(); }
    g2.restore();
  }
  c.run('land', landU({
    zen: mixc(hexLin('#141a44'), hexLin('#02040f'), night), hor: mixc(hexLin('#c0705a'), hexLin('#141a3a'), night), horY: hzY, gradP: 1.2,
    sun: [SW / 2, hzY - 40], glow: .3 * (1 - night), disk: 0, sunCol: [3, 1.6, .7],
    star: .3 + night * .9, mw: night * .8 + tilt * .4, mwAng: 1.1 - tilt * .3, mwOff: [0, -.25 + tilt * .35],
    ridges: [{ y: hzY + 3, amp: 5, freq: .002, rough: .2, col: mixc(hexLin('#2a1c24'), hexLin('#05060c'), night), mist: .4 }],
    mist: mixc(hexLin('#7a4a50'), hexLin('#101830'), night), mistH: 30, c0: hexLin('#040408'), emit: 1, rim: .7,
    bg: [me.chest[0], me.chest[1] + tilt * 900 - me.hu * .4, me.hu * 4.5, .55 * answer * (1 - tilt * .6)],
  }));
  c.glow(SW / 2 + 160, SH - hzY - 5, 2.8, [1, .9, .75], 3.2 * pulse * (1 - tilt), 2.2);

  c.post.bloom = .7; c.post.vig = .65;
}, { fade: 1.0 });
