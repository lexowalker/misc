// Act VII: the flight. Through the ages and the stars; mountains to dust; seas forsaking their shores; a million worlds;
// above the clouds toward the sun; the old man before the galaxy; the converging light; silence; STILL.
'use strict';

// ---------- G1: WHERE ARE YOU — through the ages, through the stars ----------
shot(320.45, 325.7, c => {
  const t = c.t, u = c.u;
  c.run('flight', { uZ: u * 1.1 + c.aud[0] * .05, uSpd: .6 + .5 * smooth(seg(t, 320.5, 322)), uCore: 0, uC: [SW * .5, SH * .5] });
  c.post.bloom = .8; c.post.vig = .55; c.post.exp = 1.1;
  c.post.white = Math.pow(1 - seg(t, 320.45, 321.6), 2);
});
shot(325.7, 328.9, c => {
  const t = c.t, u = c.u;
  const k = ease(seg(t, 325.7, 328.9));
  c.run('galaxy', { uGC: [lerp(SW * .62, SW * .1, k), lerp(SH * .55, SH * .4, k)], uGS: lerp(420, 1700, k), uGRot: t * .08 + 1, uTilt: lerp(.42, .3, k), uBright: 1.3, uBgStars: .9 });
  c.post.bloom = .85; c.post.vig = .55;
}, { fade: .6 });
shot(328.9, 334.55, c => {
  const t = c.t, u = c.u;
  const core = Math.pow(seg(t, 331.4, 334.55), 1.5);
  c.run('flight', { uZ: 8 + u * (1.2 + core * 2.5), uSpd: .7 + core * .9, uCore: core * 2.2, uC: [SW * .5, SH * .5] });
  c.post.bloom = .85 + core * .3; c.post.vig = .55; c.post.exp = 1.1;
  c.post.white = Math.pow(seg(t, 333.9, 334.55), 2) * .8;
}, { fade: .6 });

// ---------- G2a: LET THE MOUNTAINS FALL TO DUST ----------
shot(334.55, 338.25, c => {
  const t = c.t, u = c.u;
  const crum = ease(seg(t, 335.4, 338.4));
  const g2 = c.L(2);
  const r = K.rng(5);
  for (let i = 0; i < 700; i++) {
    const x0 = r() * SW, y0 = 980 - r() * 560, birth = 335.5 + (980 - y0) / 560 * 2.4 + r() * .4;
    const age = t - birth; if (age < 0) continue;
    const px = x0 + Math.sin(i + age) * 20 + age * 30 * (r() - .5), py = y0 - age * age * 70 - age * 50;
    const a = Math.max(0, 1 - age / 3.2) * (.4 + .6 * r());
    g2.fillStyle = `rgba(255,${190 + Math.round(r() * 50)},${120 + Math.round(r() * 60)},${a})`;
    g2.beginPath(); g2.arc(px, py, .8 + r() * 2.2, 0, Math.PI * 2); g2.fill();
  }
  const sun = [SW * .5, 470];
  const cols = ridgeCols(5, hexLin('#1a0e12'), hexLin('#c86a48'), 1.2);
  c.run('land', landU({
    zen: hexLin('#2a1c3c'), hor: hexLin('#ffb070'), horY: 520, gradP: 1.4,
    sun: toGL(sun), sunR: 46, glow: .9, sunCol: [4.2, 2.4, 1.0],
    ridges: cols.map((col, i) => ({ y: 560 - i * 95, amp: 230 - i * 25, freq: .0016 + i * .0005, rough: .85, col, mist: .55 - i * .07 })),
    mist: hexLin('#f09060'), mistH: 70, rim: 0, emit: 1.6, crum,
  }));
  c.post.sun = [sun[0] / SW, 1 - sun[1] / SH]; c.post.rays = .8; c.post.rayCol = [1, .7, .4]; c.post.bloom = .8; c.post.vig = .55;
}, { fade: .35 });

// ---------- G2b: LET THE SEAS FORSAKE THEIR SHORES ----------
shot(338.25, 341.6, c => {
  const t = c.t, u = c.u;
  const pitch = lerp(.04, .3, ease(seg(t, 338.4, 341.6)));
  const g2 = c.L(2);
  const r = K.rng(12);
  const hz = SH / 2 + Math.tan(pitch) / (2 * Math.tan(.45)) * SH;
  for (let i = 0; i < 900; i++) {
    const x = r() * SW, birth = 338.3 + r() * 3.2;
    const age = t - birth; if (age < 0) continue;
    const zf = .2 + r() * .8;
    const y0 = hz + (SH - hz) * zf;
    const py = y0 - age * age * 260 * zf - age * 120 * zf;
    const sz = (.8 + r() * 3) * zf * (1 + age * .4);
    g2.fillStyle = `rgba(255,${200 + Math.round(r() * 40)},${150 + Math.round(r() * 60)},${Math.min(1, .3 + age) * (.5 + .5 * r())})`;
    g2.beginPath(); g2.ellipse(x, py, sz * .7, sz * (1 + age * .8), 0, 0, Math.PI * 2); g2.fill();
  }
  c.run('sea', seaU({
    uPitch: pitch, uSun: sunDir(.05, 0), uWaveT: t * 1.1, uWaveA: 1.2,
    uZen: hexLin('#1c2a58'), uHor: hexLin('#f6a868'), uSunCol: mul(C.gold, 1.2), uMie: 1.4, uGlit: 1.2,
    uHaze: hexLin('#d08060'), uFog: .0015, uCloud: .6, uCloudCol: hexLin('#6a3a50'), uCloudY: 1.3, uEmitK: 1.5,
  }));
  const sp = proj(sunDir(.05, 0), 0, pitch, .9);
  c.post.sun = [sp[0] / SW, 1 - sp[1] / SH]; c.post.rays = .6; c.post.rayCol = [1, .7, .4]; c.post.bloom = .8;
}, { fade: .3 });

// ---------- G3: LET ME WANDER THROUGH A MILLION UNIMAGINABLE WORLDS ----------
const WORLDS = [
  { ty: 1, atm: [.35, .6, 1.2], seed: 1.3, from: [.75, .35], to: [.2, .6], L: [-.7, .4, .6] },
  { ty: 5, atm: [.9, .75, .5], seed: 4.1, from: [.3, .6], to: [.75, .4], L: [.8, .3, .5] },
  { ty: 2, atm: [.5, .8, 1.2], seed: 7.7, from: [.6, .7], to: [.35, .3], L: [-.5, -.3, .8] },
  { ty: 3, atm: [1.2, .5, .25], seed: 2.2, from: [.25, .35], to: [.7, .65], L: [.6, .6, .5] },
  { ty: 4, atm: [1.2, .35, .1], seed: 9.9, from: [.7, .55], to: [.3, .45], L: [-.4, .5, .7] },
];
WORLDS.forEach((w, i) => {
  const t0 = 341.6 + i * 1.25, t1 = i === WORLDS.length - 1 ? 347.9 : t0 + 1.25;
  shot(t0, t1, c => {
    const k = (c.t - t0) / 1.25;
    const e = Math.pow(k, 1.6);
    c.run('planet', {
      uPC: [lerp(w.from[0], w.to[0], e) * SW, lerp(w.from[1], w.to[1], e) * SH], uPR: lerp(140, 1200, e), uType: w.ty, uRotP: c.t * .3 + w.seed,
      uSeed: w.seed, uLight: w.L, uAtm: w.atm,
    });
    c.post.bloom = .7; c.post.vig = .6;
  }, { fade: i === 0 ? .5 : .18 });
});

// ---------- G4: key change — no crown, no throne; above the clouds, toward the sun ----------
shot(347.9, 361.05, c => {
  const t = c.t, u = c.u;
  const g2 = c.L(2);
  // the seeker as a point of light streaking toward the sun
  const k = ease(seg(t, 348.2, 360.8));
  const hx = lerp(SW * .32, SW * .5, k), hy = lerp(SH * .62, SH * .44, k);
  for (let i = 0; i < 40; i++) {
    const f = i / 40;
    g2.fillStyle = `rgba(255,${220 - i * 2},${170 - i * 2},${(1 - f) * .5})`;
    g2.beginPath(); g2.arc(hx - (1 - k * .6) * f * 260, hy + f * 120 * (1 - k * .5) + Math.sin(f * 6 + t * 3) * 6 * f, 3 * (1 - f) + .5, 0, Math.PI * 2); g2.fill();
  }
  const el = lerp(.03, .16, ease(seg(t, 347.9, 361)));
  c.run('clouds', { uFly: u * 60, uSunEl: el, uHgt: lerp(30, 55, k), uSunCol: [3.4, 2.4, 1.5] });
  c.glow(hx, hy, 4, [1, .9, .75], 3.5 + c.aud[0] * 1.5, 2);
  const sunY = SH * .5 - (Math.atan(Math.tan(el)) - .12 * 0) * 0;
  c.post.sun = [.5, .62]; c.post.rays = .3; c.post.rayCol = [1, .8, .55];
  c.post.bloom = .45; c.post.vig = .55; c.post.exp = .9;
  c.post.white = Math.pow(1 - seg(t, 347.9, 348.6), 2) * .6;
}, { fade: .2 });

// ---------- G5: and if all my days are numbered (the old man before the galaxy) ----------
function galaxySky(c, k, cx, cy, size, rot) {
  const T = c.tmp('gal');
  c.run('galaxy', { uGC: [cx, cy], uGS: size, uGRot: rot, uTilt: .38, uBright: k, uBgStars: 0 }, T);
  return T;
}
const summit = x => 900 - Math.max(0, 300 - Math.abs(x - 980)) * .7 + (K.fbm(x * .008 + 2) - .5) * 30;
shot(361.05, 364.55, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  pathLine(g, summit);
  const me = K.seeker(g, { x: 980, y: summit(980) + 3, h: 200, age: 2, face: 0, staff: true, wind: .5 + .2 * Math.sin(t * 2), look: .3 });
  const gal = galaxySky(c, .9, SW * .5, SH * .62, 620, -.4 + t * .01);
  c.run('land', landU({
    zen: hexLin('#010208'), hor: hexLin('#0c1430'), horY: 220, gradP: 1.2, star: 1, skyTex: gal, skyK: 1,
    ridges: ridgeCols(3, hexLin('#04060c'), hexLin('#121a34'), 1.2).map((col, i) => ({ y: 300 - i * 50, amp: 120 - i * 20, freq: .002 + i * .0006, rough: .8, col, mist: .4 })),
    mist: hexLin('#141c3c'), mistH: 50, c0: hexLin('#010103'), rim: 0,
    bg: [me.chest[0], me.chest[1], 50, .9],
  }));
  c.post.bloom = .8; c.post.vig = .6;
}, { fade: .25 });
shot(364.55, 368.55, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  const me = K.seeker(g, { x: 760, y: 1500, h: 1250, age: 2, face: 1, look: .35, wind: .7 + .2 * Math.sin(t * 2.3), arms: 'down' });
  const gal = galaxySky(c, 1.0, SW * .72, SH * .55, 820, -.3 + t * .01);
  c.run('land', landU({ zen: hexLin('#010208'), hor: hexLin('#0c1430'), horY: -200, gradP: .9, star: 1, skyTex: gal, skyK: 1, c0: hexLin('#010103'), rim: 0 }));
  chestGlow(c, me, .9, 1.2);
  c.post.bloom = .8; c.post.vig = .65;
});
FADES.push({ t0: 364.5, t1: 365.7, in: .05, out: .1 }, { t0: 368.5, t1: 369.7, in: .05, out: .1 });
shot(368.55, 383.65, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  const lift = ease(seg(t, 369.8, 374));
  const step = ease(seg(t, 376.6, 380.5));
  const edge = x => 960 + (K.fbm(x * .006 + 5) - .5) * 26 + Math.max(0, Math.abs(x - 980) - 700) * .4;
  pathLine(g, edge);
  const me = K.seeker(g, { x: 980, y: edge(980) + 3 - step * 30, h: lerp(520, 470, step), age: 2, face: 0, look: .15 + lift * .35, wind: .5, arms: step > 0 ? 'open' : 'down', armK: step * .9, staff: step < .3, walk: step > 0 && step < 1 ? 1 : 0, phase: t * 3 });
  const bright = 1 + step * .8 + Math.pow(seg(t, 380, 383.6), 2) * 1.2;
  const gal = galaxySky(c, bright, SW * .5, SH * .66, lerp(900, 1100, u / 15), -.2 + t * .01);
  const dim = 1 - .35 * smooth(seg(t, 373.5, 375.6)) * (1 - smooth(seg(t, 376.3, 377)));
  c.run('land', landU({ zen: hexLin('#010208'), hor: hexLin('#0c1430'), horY: 150, gradP: 1.1, star: 1, skyTex: gal, skyK: 1, c0: hexLin('#010103'), rim: 0, bg: [me.chest[0], me.chest[1], 70, .9] }));
  c.post.bloom = .85; c.post.vig = .6; c.post.exp = dim;
});

// ---------- G7: I WILL SEEK YOU — the converging light ----------
shot(383.65, 394.0, c => {
  const t = c.t, u = c.u;
  const k = Math.pow(seg(t, 383.6, 393.7), 1.3);
  const g = c.L(0);
  const d = 1 + k * 4;
  const me = K.seeker(g, { x: SW * .5, y: SH * .5 + 300 + 360 / d * .2, h: 560 / d, age: 2, face: 0, walk: 1, phase: t * 3.5, arms: 'open', armK: .5 });
  c.run('radiance', { uC: [SW * .5, SH * .5 + 190], uK: .35 + k * 1.1 + c.aud[0] * .2, uSpd: 1.5 + k * 4, uSil: hexLin('#050304') });
  c.post.sun = [.5, .5 + 190 / SH]; c.post.rays = .5 + k * .6; c.post.rayCol = [1, .8, .55];
  c.post.bloom = .9; c.post.vig = .6; c.post.white = Math.pow(seg(t, 391.5, 393.7), 2) * .5;
}, { fade: .4 });
FADES.push({ t0: 393.72, t1: 394.48, in: .03, out: .02 });

// ---------- G9: STILL! — the sun breaks over the sea ----------
shot(394.0, 400.6, c => {
  const t = c.t, u = c.u;
  const burst = Math.exp(-Math.max(0, t - 394.5) * 1.2);
  const el = lerp(.0, .03, ease(seg(t, 394.4, 400.6)));
  c.run('sea', seaU({
    uPitch: .075, uSun: sunDir(el, 0), uWaveT: t * .9,
    uZen: hexLin('#24386a'), uHor: hexLin('#ffb070'), uSunCol: mul(C.gold, 1.3 + burst * 2.5), uMie: 1.8 + burst * 2, uGlit: 1.4,
    uHaze: hexLin('#d08868'), uFog: .0015, uCloud: .7, uCloudCol: hexLin('#7a4048'), uCloudY: 1.3,
  }));
  const sp = proj(sunDir(el, 0), 0, .075, .9);
  c.post.sun = [sp[0] / SW, 1 - sp[1] / SH]; c.post.rays = .5 + burst * 1.2; c.post.rayCol = [1, .75, .45];
  c.post.bloom = .8 + burst * .4; c.post.vig = .55;
  c.post.white = burst * .65 * (t > 394.45 ? 1 : 0);
});
