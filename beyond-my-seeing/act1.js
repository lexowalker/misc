// Act I: the question. A point of light; the sea at dawn; a child; an eye; the road; a light kindled in his breast.
'use strict';
const { W: SW, H: SH } = E;

const ease = K.ease, smooth = K.smooth, lerp = K.lerp, clamp = K.clamp;
const seg = (t, a, b) => clamp((t - a) / (b - a));

// ---------- shared helpers ----------
function sunDir(el, az) { return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]; }
function camBasis(yaw, pitch) {
  const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  let r = [f[2], 0, -f[0]]; const rl = Math.hypot(r[0], r[2]); r = [r[0] / rl, 0, r[2] / rl];
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  return { f, r, u };
}
// project a direction to canvas pixels (y down) for the sea camera
function proj(dir, yaw, pitch, fov) {
  const { f, r, u } = camBasis(yaw, pitch);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const z = dot(dir, f), k = 1 / (2 * Math.tan(fov / 2)) * SH;
  return [SW / 2 + dot(dir, r) / z * k, SH / 2 - dot(dir, u) / z * k];
}
// project a world point (for figures placed in the sea world)
function projP(p, cam, yaw, pitch, fov) {
  const d = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]];
  const { f, r, u } = camBasis(yaw, pitch);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const z = dot(d, f), k = 1 / (2 * Math.tan(fov / 2)) * SH;
  return [SW / 2 + dot(d, r) / z * k, SH / 2 - dot(d, u) / z * k, z];
}
const C = {
  black: [0, 0, 0],
  predawnZen: hexLin('#040a22'), predawnHor: hexLin('#57406a'),
  dawnZen: hexLin('#1f3460'), dawnHor: hexLin('#f0a070'),
  water: hexLin('#071420'),
  gold: [5.2, 3.0, 1.35], warm: [1.0, .55, .25], ember: [1.0, .62, .3],
};
function seaU(o) {
  return Object.assign({
    uCam: [0, 2.2, 0], uYaw: 0, uPitch: .08, uFov: .9,
    uSun: sunDir(.02, 0), uSunCol: C.gold, uSunSize: .022,
    uZen: C.dawnZen, uHor: C.dawnHor, uWater: C.water, uHaze: mul(C.dawnHor, .7), uMie: 1, uFog: .0012,
    uStar: 0, uWaveT: 0, uRough: .055, uGlit: 1,
    uCloud: 0, uCloudCol: hexLin('#3a2a40'), uCloudY: 1,
    uWatch: new Float32Array(16), uNW: 0, uWatchK: 1,
    uSil: hexLin('#06070b'), uSil1: hexLin('#20202c'), uEmitK: 1, uRimK: .8, uDream: 0, uMoon: 0, uMoonDir: sunDir(.3, .5), uWaveA: 1,
    uAur: 0, uAurC1: [.1, 1.1, .5], uAurC2: [.55, .2, 1.], uPlanet: [0, 0, 1, 0], uPlanetCol: [.6, .7, 1],
  }, o);
}
function landU(o) {
  const R6 = new Float32Array(24), RC6 = new Float32Array(24), RX6 = new Float32Array(6);
  (o.ridges || []).forEach((r, i) => {
    R6.set([r.y, r.amp, r.freq, r.rough ?? .5], i * 4);
    RC6.set([...r.col, r.mist ?? .5], i * 4);
    RX6[i] = r.x ?? 0;
  });
  const u = {
    uZen: o.zen, uHor: o.hor, uHorY: o.horY ?? SH * .35, uGradP: o.gradP ?? 1.6,
    uSunCol: o.sunCol ?? C.gold, uSunP: o.sun ?? [SW / 2, -999], uSunR: o.sunR ?? 26, uSunGlow: o.glow ?? .5, uSunDisk: o.disk ?? 1,
    uStar: o.star ?? 0, uMW: o.mw ?? 0, uMWAng: o.mwAng ?? .5, uMWOff: o.mwOff ?? [0, 0], uStarAng: o.starAng ?? 0, uStarTrail: o.trail ?? 0, uPole: o.pole ?? [SW / 2, SH * 1.4],
    uCloud: o.cloud ?? 0, uCloudY: o.cloudY ?? SH * .6, uCloudH: o.cloudH ?? 120, uCloudS: o.cloudS ?? 1, uCloudCol: o.cloudCol ?? hexLin('#40384a'),
    uAur: o.aur ?? 0, uAurY: o.aurY ?? SH * .45, uAurC1: o.aurC1 ?? [.1, 1.2, .55], uAurC2: o.aurC2 ?? [.6, .2, 1.],
    uRid: R6, uRidC: RC6, uRidX: RX6, uNR: (o.ridges || []).length,
    uMist: o.mist ?? o.hor, uMistH: o.mistH ?? 60,
    uA1: o.a1 ?? 99, uA3: o.a3 ?? 99, uC0: o.c0 ?? hexLin('#05060a'), uC1: o.c1 ?? hexLin('#101018'), uC3: o.c3 ?? hexLin('#202030'),
    uEmitK: o.emit ?? 1, uRimK: o.rim ?? .6, uRim1K: o.rim1 ?? 0, uMoon: o.moon ?? 0, uMoonP: o.moonP ?? [0, 0],
    uBG: o.bg ? [o.bg[0], SH - o.bg[1], o.bg[2], o.bg[3]] : [0, 0, 1, 0], uBGC: o.bgc ?? C.ember, uDis: o.dis ?? 0, uDisB: o.disB ?? [0, 1], uCrum: o.crum ?? 0, uSkyTex: o.skyTex, uSkyK: o.skyK ?? 0,
  };
  return u;
}
// atmospheric perspective: n ridge colours from far (hazy) to near (dark)
function ridgeCols(n, near, far, pow = 1.3) { return Array.from({ length: n }, (_, i) => mixc(far, near, Math.pow(i / Math.max(1, n - 1), pow))); }
const toGL = (p) => [p[0], SH - p[1]];

// ---------- A0: a single point of light ----------
const VENUS = sunDir(.255, -.07);
shot(0, 7.4, c => {
  const t = c.t;
  const a = c.aud[0];
  const p = proj(VENUS, 0, .3, .9);
  const k = smooth(seg(t, .3, 3.8));
  c.run('void', { uTint: hexLin('#0b1230'), uDust: .25 * smooth(seg(t, 2, 6)), uGrad: .5 * smooth(seg(t, 4.2, 7.4)) });
  c.glow(p[0], p[1], 2.2, [1, .9, .75], k * (2.2 + a * 2.5), 1.2);
  c.post.bloom = .9; c.post.vig = .8; c.post.grain = .018;
});

// ---------- A1: pre-dawn sea, the swell, the title ----------
shot(7.4, 17.0, c => {
  const t = c.t;
  const pitch = lerp(.3, .095, ease(seg(t, 6.6, 15.5)));
  const el = lerp(-.075, -.018, seg(t, 6.6, 17));
  const dawn = smooth(seg(t, 6.8, 16.5));
  c.run('sea', seaU({
    uPitch: pitch, uSun: sunDir(el, .02),
    uZen: mixc(C.predawnZen, hexLin('#121d42'), dawn), uHor: mixc(C.predawnHor, hexLin('#d77d68'), dawn),
    uSunCol: mul(C.gold, .35 + .5 * dawn), uMie: .6 + dawn, uStar: 1 - dawn * .55, uWaveT: t * .9,
    uHaze: mixc(hexLin('#2a2238'), hexLin('#a0605a'), dawn), uFog: .002,
    uCloud: .8, uCloudCol: mixc(hexLin('#141426'), hexLin('#5a3348'), dawn), uCloudY: 1.3,
  }));
  const p = proj(VENUS, 0, pitch, .9);
  c.glow(p[0], p[1], 2.2, [1, .9, .75], 2.6 + c.aud[0] * 1.5, 1.2);
  c.post.bloom = .8; c.post.vig = .75; c.post.exp = 1.05;
}, { fade: 2.6 });
words(8.9, 15.4, ['Where Are You, Beyond My Seeing?'], { y: SH * .3, size: 66, track: 3, italic: true, weight: 400, fin: 2.2, fout: 2.2 });

// ---------- A2: sunrise, the child on the rock, the path of gold ----------
function shoreRocks(g, seed, y0) {
  const r = K.rng(seed);
  K.rock(g, SW * .5, y0 + 70, 420, 120, seed + 1);
  K.rock(g, SW * .24, y0 + 110, 520, 90, seed + 2);
  K.rock(g, SW * .8, y0 + 100, 600, 110, seed + 3);
  K.rock(g, SW * .02, y0 + 120, 380, 160, seed + 4);
  K.rock(g, SW * .98, y0 + 120, 420, 190, seed + 5);
  pathLine(g, x => y0 + 100 + (K.fbm(x * .013 + seed) - .5) * 34 + Math.sin(x * .03 + seed) * 4);
}
shot(17.0, 25.9, c => {
  const t = c.t;
  const el = lerp(-.012, .05, ease(seg(t, 16.3, 26)));
  const pitch = .075, yaw = 0;
  const glit = smooth(seg(t, 18.5, 23));
  // foreground: the rocks and the child, seen from behind
  const g = c.L(0);
  shoreRocks(g, 11, 930);
  const sway = Math.sin(t * 1.3) * .05;
  K.seeker(g, { x: SW * .5 + 6, y: 948, h: 172, age: 0, face: 0, look: .2, wind: sway });
  // a far headland
  const g1 = c.L(1);
  g1.beginPath(); g1.moveTo(0, 612); g1.bezierCurveTo(120, 596, 260, 590, 420, 610); g1.lineTo(560, 614); g1.lineTo(0, 616); g1.fill();
  // gulls crossing
  for (let i = 0; i < 2; i++) {
    const bt = seg(t, 20.5 + i * .9, 26.5 + i * .9);
    if (bt > 0 && bt < 1) K.bird(g1, lerp(-60, SW + 80, bt) - i * 140, 330 + i * 46 + Math.sin(bt * 9) * 12, 18 - i * 3, t * 7 + i * 2, 1);
  }
  c.run('sea', seaU({
    uPitch: pitch, uSun: sunDir(el, 0), uWaveT: t * .9,
    uZen: hexLin('#1b2b55'), uHor: mixc(hexLin('#d77d68'), hexLin('#f2a066'), seg(t, 17, 24)),
    uSunCol: mul(C.gold, .9 + glit * .3), uMie: 1.3, uGlit: .25 + glit * .6, uStar: .25 * (1 - seg(t, 16, 21)),
    uHaze: hexLin('#c07860'), uFog: .0015, uCloud: .8, uCloudCol: hexLin('#4a2c44'), uCloudY: 1.3,
  }));
  const sp = proj(sunDir(el, 0), yaw, pitch, .9);
  c.post.sun = [sp[0] / SW, 1 - sp[1] / SH];
  c.post.rays = .25 * glit; c.post.rayCol = [1, .7, .4];
  c.post.bloom = .5; c.post.vig = .6; c.post.exp = 1.0;
}, { fade: 1.6 });

// ---------- A3a: the child in profile, wondering ----------
shot(25.9, 30.0, c => {
  const t = c.t;
  const yaw = -.25, pitch = .02, fov = .8;
  const el = .06 + seg(t, 25.7, 30) * .01;
  const g = c.L(0);
  K.rock(g, 760, 1180, 900, 260, 77);
  const look = .1 + .3 * ease(seg(t, 26.2, 29));
  K.seeker(g, { x: 700, y: 1068, h: 560, age: 0, face: 1, look, wind: Math.sin(t * 1.1) * .08, arms: 'down' });
  c.run('sea', seaU({
    uCam: [0, 1.0, 0], uYaw: yaw, uPitch: pitch, uFov: fov, uSun: sunDir(el, 0), uWaveT: t * .9,
    uZen: hexLin('#22335f'), uHor: hexLin('#f2a066'), uSunCol: mul(C.gold, 1.15), uMie: 1.5, uGlit: 1.1,
    uHaze: hexLin('#c07860'), uFog: .0015, uCloud: .7, uCloudCol: hexLin('#55304a'), uCloudY: 1.3, uRimK: 1.6,
  }));
  const sp = proj(sunDir(el, 0), yaw, pitch, fov);
  c.post.sun = [sp[0] / SW, 1 - sp[1] / SH]; c.post.rays = .35; c.post.rayCol = [1, .65, .35];
  c.post.bloom = .75; c.post.vig = .6;
}, { fade: .8 });

// ---------- A3b: the eye that the dawn made ----------
shot(30.0, 34.0, c => {
  const t = c.t, u = c.u;
  c.run('iris', {
    uC: [SW * .52, SH * .5], uS: SH * lerp(1.12, .78, ease(seg(t, 30, 34))), uPupil: lerp(.33, .24, ease(seg(t, 30.2, 32.8))), uRefl: 0, uLid: 1.0, uZoom: 0, uLight: smooth(seg(t, 30, 30.8)) * .4 + .6 + .25 * ease(seg(t, 30.2, 33)),
    uSunCol: [4.5, 2.6, 1.2], uIrisA: hexLin('#6e4318'), uIrisB: hexLin('#3f4a3a'), uSkin: hexLin('#2a1812'), uSunDir: [.42, .16, .89],
  });
  c.post.bloom = .6; c.post.vig = .95; c.post.exp = 1.05; c.post.satur = .82;
}, { fade: .7 });

// ---------- A4: the road; he walks, and grows ----------
function hillY(x) { return 905 - (K.fbm(x * .0016 + 4.1) - .5) * 150 - Math.sin(x * .0011) * 30; }
function drawHill(g, camX) {
  g.beginPath(); g.moveTo(0, SH + 5);
  for (let x = 0; x <= SW + 10; x += 6) g.lineTo(x, hillY(x + camX));
  g.lineTo(SW + 10, SH + 5); g.fill();
}
shot(34.0, 46.0, c => {
  const t = c.t, u = c.u;
  const camX = u * 70;
  const walkX = SW * .38 + u * 10;
  const age = ease(seg(t, 35.5, 45));
  const hgt = lerp(118, 238, age);
  const day = seg(t, 33.8, 46);
  const g = c.L(0);
  drawHill(g, camX);
  for (const tx of [1200, 2050, 2600]) { const x = tx - camX; if (x > -300 && x < SW + 300) K.tree(g, x, hillY(x + camX) + 8, 330, tx, { leaves: 1 }); }
  const ph = u * 5.2;
  const fy = hillY(walkX + camX);
  K.seeker(g, { x: walkX, y: fy + 2, h: hgt, age, face: 1, walk: 1, phase: ph, wind: .15 });
  const g3 = c.L(3);
  for (const tx of [700, 1500, 2300]) { const x = tx - camX * .45; K.tree(g3, x, 790 + Math.sin(tx) * 20, 120, tx + 9, { leaves: 1.2 }); }
  const sun = [lerp(260, 360, day), lerp(720, 860, day)];
  const cols = ridgeCols(4, hexLin('#3a3b4e'), hexLin('#d6a988'), 1.1);
  c.run('land', landU({
    zen: mixc(hexLin('#3a5c94'), hexLin('#4a6aa0'), day), hor: hexLin('#f4c79a'), horY: 620, gradP: 1.8,
    sun: toGL(sun), sunR: 30, glow: .55, sunCol: [3.4, 2.4, 1.4],
    cloud: .7, cloudY: SH - 220, cloudH: 180, cloudS: 1.4, cloudCol: hexLin('#e8c4b0'),
    ridges: [
      { y: 470, amp: 170, freq: .0018, rough: .7, col: cols[0], mist: .7, x: camX * .08 },
      { y: 430, amp: 130, freq: .0024, rough: .6, col: cols[1], mist: .6, x: camX * .16 },
      { y: 360, amp: 90, freq: .0032, rough: .4, col: cols[2], mist: .5, x: camX * .3 },
      { y: 290, amp: 60, freq: .004, rough: .2, col: cols[3], mist: .4, x: camX * .55 },
    ], mist: hexLin('#e8bf9c'), mistH: 50, a3: 3, c3: hexLin('#4a4658'),
    c0: hexLin('#0b0b12'), rim: .55,
  }));
  c.post.sun = [sun[0] / SW, 1 - sun[1] / SH]; c.post.rays = .3; c.post.rayCol = [1, .8, .55];
  c.post.bloom = .55; c.post.vig = .55;
}, { fade: .9 });

// ---------- A5: a question in his breast ----------
shot(46.0, 52.6, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  const look = lerp(-.35, .12, ease(seg(t, 48.6, 51.2))) * smooth(seg(t, 46.2, 47.4)) + (1 - smooth(seg(t, 46.2, 47.4))) * .05;
  const a = K.seeker(g, { x: 900 + u * 4, y: 1450, h: 1150, age: 1, face: 1, look, wind: .3 + Math.sin(t * .9) * .15, arms: 'down', lean: -.03 });
  K.ground(g, 1280, 30, .002, 3);
  const k = smooth(seg(t, 46.6, 50.2));
  const pulse = 1 + .25 * Math.sin(t * 2.4) * k + c.aud[0] * .6;
  c.glow(a.chest[0], a.chest[1], 7 + 6 * k, C.ember, k * 3.2 * pulse, 2.2);
  const sun = [180, 760];
  const cols = ridgeCols(3, hexLin('#2b2234'), hexLin('#c47a5a'));
  c.run('land', landU({
    zen: hexLin('#2c3a6a'), hor: hexLin('#f39a62'), horY: 300, gradP: 1.2,
    sun: toGL(sun), sunR: 34, glow: .8, sunCol: [3.6, 2.0, 1.0],
    cloud: .9, cloudY: SH - 300, cloudH: 140, cloudS: 1.1, cloudCol: hexLin('#6a3c50'),
    ridges: [
      { y: 330, amp: 140, freq: .0016, rough: .6, col: cols[0], mist: .6 },
      { y: 270, amp: 110, freq: .0022, rough: .5, col: cols[1], mist: .5 },
      { y: 190, amp: 80, freq: .003, rough: .3, col: cols[2], mist: .4 },
    ], mist: hexLin('#d88a66'), mistH: 40, c0: hexLin('#07060a'), rim: .9,
  }));
  c.post.sun = [sun[0] / SW, 1 - sun[1] / SH]; c.post.rays = .35; c.post.rayCol = [1, .62, .35];
  c.post.bloom = .7; c.post.vig = .7;
}, { fade: .8 });
