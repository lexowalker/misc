// Act VIII: the return. The old man on the child's rock; every watcher on the shore has a path of gold that runs to them;
// then the view from the other side: a single point of light on a dark shore, as at the beginning.
'use strict';

// screen point on the water -> a watcher's eye in the sea world
function watcherAt(sx, sy, cam, yaw, pitch, fov, eye = 1.6) {
  const { f, r, u } = camBasis(yaw, pitch);
  const x = (sx - SW / 2) / SH, y = (SH / 2 - sy) / SH;
  const tn = 2 * Math.tan(fov / 2);
  const d = [f[0] + (x * r[0] + y * u[0]) * tn, f[1] + (x * r[1] + y * u[1]) * tn, f[2] + (x * r[2] + y * u[2]) * tn];
  const t = cam[1] / -d[1];
  return [cam[0] + d[0] * t, eye, cam[2] + d[2] * t];
}

// ---------- H1: and if I never find the answer ----------
shot(400.6, 417.4, c => {
  const t = c.t, u = c.u;
  const push = ease(seg(t, 400.6, 417.4));
  const el = .055 + u * .0012;
  const g = c.L(0), g1 = c.L(1);
  const z = 1 + push * .14;
  g.save(); g.translate(SW * .5, 960); g.scale(z, z); g.translate(-SW * .5, -960);
  shoreRocks(g, 11, 930);
  const me = K.seeker(g, { x: SW * .5 + 6, y: 896, h: 250, age: 2, face: 0, pose: 'sit', look: .12, wind: Math.sin(t * 1.1) * .06 });
  g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(SW * .5 + 70, 900); g.lineTo(SW * .5 + 98, 770); g.stroke();
  g.restore();
  g1.beginPath(); g1.moveTo(0, 612); g1.bezierCurveTo(120, 596, 260, 590, 420, 610); g1.lineTo(560, 614); g1.lineTo(0, 616); g1.fill();
  for (let i = 0; i < 3; i++) {
    const bt = seg(t, 402 + i * 3.3, 410 + i * 3.3);
    if (bt > 0 && bt < 1) K.bird(g1, lerp(SW + 80, -80, bt) + i * 90, 300 + i * 50 + Math.sin(bt * 8 + i) * 14, 16 - i * 2, t * 6.5 + i * 2, -1);
  }
  c.run('sea', seaU({
    uPitch: .075, uSun: sunDir(el, 0), uWaveT: t * .9,
    uZen: hexLin('#22365f'), uHor: hexLin('#f6aa6c'), uSunCol: mul(C.gold, 1.15), uMie: 1.3, uGlit: .95,
    uHaze: hexLin('#d08868'), uFog: .0015, uCloud: .7, uCloudCol: hexLin('#7a4a52'), uCloudY: 1.3, uRimK: 1.2,
  }));
  const sp = proj(sunDir(el, 0), 0, .075, .9);
  c.post.sun = [sp[0] / SW, 1 - sp[1] / SH]; c.post.rays = .35; c.post.rayCol = [1, .72, .42];
  c.post.bloom = .5; c.post.vig = .6;
}, { fade: 2.2 });

// ---------- H2: for in every face, a question; in each breath, a mystery ----------
shot(417.4, 426.6, c => {
  const t = c.t, u = c.u;
  const pitch = .07, yaw = 0, fov = .95, cam = [0, 2.6, 0];
  const el = .075 + u * .001;
  const g = c.L(0);
  const shoreY = 968;
  // a long low shore of flat rocks
  g.beginPath(); g.moveTo(-10, SH + 10);
  for (let x = -10; x <= SW + 10; x += 8) g.lineTo(x, shoreY + 14 + (K.fbm(x * .01 + 3) - .5) * 26);
  g.lineTo(SW + 10, SH + 10); g.fill();
  const people = [
    { x: 260, h: 150, age: 0 }, { x: 560, h: 205, age: 1, hair: 'long' }, { x: 610, h: 220, age: 1 },
    { x: 960, h: 190, age: 2, sit: true }, { x: 1330, h: 210, age: 1, hair: 'bun' }, { x: 1660, h: 225, age: 1.6 },
  ];
  const W = new Float32Array(16);
  let n = 0;
  people.forEach((p, i) => {
    const y = shoreY + 6;
    K.seeker(g, { x: p.x, y: p.sit ? y + 2 : y, h: p.h, age: p.age, face: 0, pose: p.sit ? 'sit' : 'stand', look: .1, wind: Math.sin(t * 1.2 + i) * .06 });
    if (n < 4 && i !== 3) {
      const w = watcherAt(p.x, shoreY + 40, cam, yaw, pitch, fov);
      const k = smooth(seg(t, 418 + n * 1.2, 420 + n * 1.2));
      W.set([w[0], w[1], w[2], k], n * 4); n++;
    }
  });
  c.run('sea', seaU({
    uCam: cam, uYaw: yaw, uPitch: pitch, uFov: fov, uSun: sunDir(el, 0), uWaveT: t * .9,
    uZen: hexLin('#2a3f6a'), uHor: hexLin('#f8b274'), uSunCol: mul(C.gold, 1.1), uMie: 1.3, uGlit: .55,
    uWatch: W, uNW: n, uWatchK: 2.2,
    uHaze: hexLin('#d49070'), uFog: .0014, uCloud: .6, uCloudCol: hexLin('#7a4a52'), uCloudY: 1.3, uRimK: 1.0,
  }));
  const sp = proj(sunDir(el, 0), yaw, pitch, fov);
  c.post.sun = [sp[0] / SW, 1 - sp[1] / SH]; c.post.rays = .3; c.post.rayCol = [1, .72, .42];
  c.post.bloom = .65; c.post.vig = .55;
}, { fade: 1.4 });

// ---------- H3: and perhaps the One I'm seeking has been searching, too, for me ----------
shot(426.6, 438.37, c => {
  const t = c.t, u = c.u;
  const away = ease(seg(t, 428.2, 437.4));
  const pitch = -.02 - away * .05;
  const g = c.L(0);
  const hz = SH / 2 - Math.tan(pitch) / (2 * Math.tan(.45)) * SH;   // canvas y of the horizon
  const s = lerp(1, .085, away);
  g.save(); g.translate(SW * .5, hz); g.scale(s, s); g.translate(-SW * .5, -hz);
  // the shore seen from the sea, lit by the sun behind us
  g.beginPath(); g.moveTo(-3000, hz + 4);
  for (let x = -3000; x <= SW + 3000; x += 10) g.lineTo(x, hz - 18 - (K.fbm(x * .004 + 1) - .3) * 60 - Math.max(0, 260 - Math.abs(x - SW * .5)) * .12);
  g.lineTo(SW + 3000, hz + 4); g.closePath(); g.fill();
  K.rock(g, SW * .5, hz + 10, 300, 70, 5);
  const me = K.seeker(g, { x: SW * .5, y: hz - 42, h: 200, age: 2, face: 0, pose: 'sit', look: -.05 });
  g.restore();
  const chest = [SW * .5 + (me.chest[0] - SW * .5) * s, hz + (me.chest[1] - hz) * s];
  const dark = smooth(seg(t, 430.5, 437.0));
  c.run('sea', seaU({
    uYaw: Math.PI, uPitch: pitch, uFov: .9, uCam: [0, 2.2 + away * 30, 0], uSun: sunDir(.08, 0), uWaveT: t * .9,
    uZen: mixc(hexLin('#141c42'), hexLin('#010208'), dark), uHor: mixc(hexLin('#6a5a8a'), hexLin('#05060e'), dark),
    uWater: hexLin('#050a16'), uHaze: mixc(hexLin('#4a4a70'), hexLin('#020306'), dark), uFog: .002,
    uSunCol: mul(C.gold, .6), uMie: .2, uGlit: 0, uStar: .2 + dark * .6,
    uSil: mixc(hexLin('#5a4034'), hexLin('#030304'), dark), uSil1: hexLin('#20202c'), uRimK: 0,
  }));
  const breathe = 1 + .2 * Math.sin(t * 1.6) + c.aud[0] * .4;
  const last = 1 - smooth(seg(t, 437.3, 438.3));
  c.glow(chest[0], chest[1], lerp(3.2, 2.2, away), C.ember, (1.3 + away * 2.2) * breathe * last, lerp(1.0, 1.2, away));
  c.post.bloom = .85; c.post.vig = .6 + dark * .3;
  c.post.exp = lerp(1, .2, dark);
}, { fade: 1.2 });
