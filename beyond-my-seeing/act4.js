// Act IV: the dream. Seasons pass on the road; a sea made of light; a raindrop full of suns; the halls of memory; faces holding worlds; a galaxy in a mote.
'use strict';

// ---------- D1: the seasons turn while he walks; he rests beneath a tree under the summer stars ----------
const SEASONS = [
  { t: 148.2, zen: '#33436e', hor: '#f2a05a', mist: '#e8a070', near: '#0b0809', far: '#b07a60', sun: [300, 760], glow: .7, star: 0, leaves: .85 },
  { t: 153.4, zen: '#56677f', hor: '#d6dbe4', mist: '#d8dee8', near: '#10131a', far: '#9aa4b4', sun: [520, 830], glow: .35, star: 0, leaves: 0 },
  { t: 158.2, zen: '#4a78b4', hor: '#f4d2c2', mist: '#f0d8d0', near: '#0b0c10', far: '#a8a0b0', sun: [700, 800], glow: .5, star: 0, leaves: .7 },
  { t: 163.0, zen: '#02040f', hor: '#1b2552', mist: '#1d2850', near: '#020306', far: '#121a36', sun: [900, -300], glow: 0, star: 1, leaves: 1 },
];
function seasonAt(t) {
  let i = 0;
  while (i < SEASONS.length - 1 && t >= SEASONS[i + 1].t) i++;
  const a = SEASONS[i], b = SEASONS[Math.min(i + 1, SEASONS.length - 1)];
  const k = b === a ? 0 : smooth(seg(t, b.t - 1.8, b.t + .6));
  const L = (x, y) => mixc(hexLin(x), hexLin(y), k);
  return {
    i, k, zen: L(a.zen, b.zen), hor: L(a.hor, b.hor), mist: L(a.mist, b.mist), near: L(a.near, b.near), far: L(a.far, b.far),
    sun: [lerp(a.sun[0], b.sun[0], k), lerp(a.sun[1], b.sun[1], k)], glow: lerp(a.glow, b.glow, k), star: lerp(a.star, b.star, k), leaves: lerp(a.leaves, b.leaves, k),
  };
}
shot(148.2, 168.6, c => {
  const t = c.t, u = c.u;
  const S = seasonAt(t);
  const stopT = 164.6;
  const camX = (Math.min(t, stopT) - 148.2) * 58 - Math.max(0, Math.min(t, stopT + 1) - stopT) * 0;
  const gy = x => 930 - Math.sin((x + camX) * .0017) * 26 - (K.fbm((x + camX) * .003 + 2) - .5) * 30;
  const g1 = c.L(1), g = c.L(0), g2 = c.L(2);
  // mid-distance trees (hazy)
  for (let k = 0; k < 9; k++) { const tx = k * 520 + 260 - camX * .55; if (tx > -300 && tx < SW + 300) K.tree(g1, tx, 820 + Math.sin(k * 3.1) * 14, 170 + 40 * Math.sin(k * 1.7), 50 + k, { leaves: S.leaves, spread: .7 }); }
  pathLine(g, gy);
  // the great tree he will rest under
  const bigX = 1480 + (stopT - 148.2) * 58 - camX;
  const blobs = K.tree(g, bigX, gy(bigX) + 8, 640, 909, { leaves: S.leaves, spread: .8, depth: 7, sway: Math.sin(t * .6) });
  for (let k = 0; k < 5; k++) { const tx = k * 900 + 900 - camX; if (Math.abs(tx - bigX) > 300 && tx > -300 && tx < SW + 300) K.tree(g, tx, gy(tx) + 6, 300, 70 + k, { leaves: S.leaves, spread: .65 }); }
  // him: walking, then sitting against the trunk, looking up
  const sitT = 165.2;
  const mx = t < stopT ? 640 : lerp(640, bigX - 70, ease(seg(t, stopT, sitT)));
  let me;
  if (t < sitT) me = K.seeker(g, { x: mx, y: gy(mx) + 3, h: 230, age: 1.2, face: 1, walk: 1, phase: (t - 148.2) * 4.6, wind: S.i === 1 ? .6 : .15 });
  else me = K.seeker(g, { x: bigX - 85, y: gy(bigX - 85) + 3, h: 230, age: 1.2, face: -1, pose: 'sit', seat: 30, arms: 'hold', look: lerp(0, .5, ease(seg(t, sitT, 167))) });
  // seasonal particles
  const r = K.rng(3);
  const season = S.i + S.k;
  for (let i = 0; i < 160; i++) {
    const x0 = r() * SW * 1.4, sp = .5 + r(), ph = r() * 50;
    const fall = (t * 60 * sp + ph * 40);
    let x = ((x0 - camX * .8 + Math.sin(t * .8 + ph) * 40) % (SW + 200) + SW + 200) % (SW + 200) - 100;
    let y = (fall % (SH + 100)) - 50;
    const wA = Math.max(0, 1 - Math.abs(season - 0.2)), wB = Math.max(0, 1 - Math.abs(season - 1)), wC = Math.max(0, 1 - Math.abs(season - 2)), wD = Math.max(0, season - 2.2);
    if (wA > 0 && i < 60) { g.save(); g.globalAlpha = wA; g.translate(x, y); g.rotate(t * 2 + ph); g.beginPath(); g.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    if (wB > 0) { g2.fillStyle = `rgba(230,236,255,${.55 * wB})`; g2.beginPath(); g2.arc(x, (fall * .5) % (SH + 100) - 50, 1.6 + r() * 1.6, 0, Math.PI * 2); g2.fill(); }
    if (wC > 0 && i < 90) { g2.fillStyle = `rgba(255,170,190,${.6 * wC})`; g2.save(); g2.translate(x, (fall * .35) % (SH + 100) - 50); g2.rotate(t + ph); g2.beginPath(); g2.ellipse(0, 0, 4, 2.4, 0, 0, Math.PI * 2); g2.fill(); g2.restore(); }
    if (wD > 0 && i < 50) { const fx = (x0 * .9 + Math.sin(t * .7 + ph) * 50) % SW, fy = 700 + Math.sin(t * .9 + ph * 3) * 120 + r() * 120; const b = .5 + .5 * Math.sin(t * 3 + ph * 7); g2.fillStyle = `rgba(210,255,140,${wD * b})`; g2.beginPath(); g2.arc(fx, fy, 2.2, 0, Math.PI * 2); g2.fill(); }
  }
  if (S.leaves > 0 && season > 1.5 && season < 2.6) {
    g2.fillStyle = `rgba(255,190,205,${.35 * Math.max(0, 1 - Math.abs(season - 2) * 1.5)})`;
    for (const [bx, by, br] of blobs) { for (let k = 0; k < 6; k++) { g2.beginPath(); g2.arc(bx + (r() - .5) * br * 1.4, by + (r() - .5) * br, 2 + r() * 2.5, 0, Math.PI * 2); g2.fill(); } }
  }
  const swirl = ease(seg(t, 166.4, 168.6));
  const cols = ridgeCols(3, mixc(S.near, S.far, .55), S.far, 1.2);
  c.run('land', landU({
    zen: S.zen, hor: S.hor, horY: 470, gradP: 1.4,
    sun: toGL(S.sun), sunR: 34, glow: S.glow, sunCol: [3.4, 2.4, 1.3], disk: S.glow > .1 ? 1 : 0,
    star: S.star, mw: S.star * .6, mwAng: .8, trail: swirl * .25, starAng: swirl * .4, pole: [SW * .5, SH * .8],
    cloud: (1 - S.star) * .6, cloudY: SH - 330, cloudH: 120, cloudS: 1.2, cloudCol: mixc(S.hor, S.zen, .4),
    ridges: [
      { y: 470, amp: 120, freq: .0016, rough: .6, col: cols[0], mist: .7, x: camX * .1 },
      { y: 400, amp: 90, freq: .0022, rough: .5, col: cols[1], mist: .6, x: camX * .2 },
    ], mist: S.mist, mistH: 60, a1: 2, c1: mixc(S.near, S.far, .35), c0: S.near, rim: .6, emit: 1.3,
    bg: [me.chest[0], me.chest[1], 70, .25 + S.star * .35],
  }));
  c.post.sun = [S.sun[0] / SW, 1 - S.sun[1] / SH]; c.post.rays = .3 * S.glow; c.post.rayCol = [1, .8, .55];
  c.post.bloom = .6; c.post.vig = .6;
}, { fade: .8 });

// ---------- D2: worlds in dreaming, where the seas were made of light ----------
shot(168.6, 175.4, c => {
  const t = c.t, u = c.u;
  const g = c.L(0), g1 = c.L(1);
  const x = 520 + u * 34;
  const me = K.seeker(g, { x, y: 640, h: 210, age: 1, face: 1, walk: 1, phase: u * 4.2, wind: .2 });
  g1.save(); g1.globalAlpha = .55; g1.translate(0, 1282); g1.scale(1, -1);
  K.seeker(g1, { x, y: 640, h: 210, age: 1, face: 1, walk: 1, phase: u * 4.2, wind: .2 }); g1.restore();
  c.run('sea', seaU({
    uCam: [0, 2.0, 0], uPitch: .05, uFov: .95, uSun: sunDir(-.3, 0), uWaveT: t * .5, uWaveA: .3,
    uZen: hexLin('#0a0620'), uHor: hexLin('#3a2a6a'), uWater: hexLin('#06081a'), uHaze: hexLin('#3a3070'), uFog: .004,
    uStar: 1, uMie: 0, uGlit: 0, uDream: .75, uAur: .35, uAurC1: [.2, .6, 1.1], uAurC2: [.9, .3, .9],
    uPlanet: [Math.sin(.42), .07 + u * .004, Math.cos(.42), .21], uPlanetCol: [.75, .7, 1.0],
    uSil: hexLin('#06040e'), uSil1: hexLin('#120c28'), uRimK: 0,
  }));
  chestGlow(c, me, .6);
  c.post.bloom = .75; c.post.vig = .6;
}, { fade: 1.2 });

// ---------- D3: a thousand suns reflected in a raindrop in the night ----------
shot(175.4, 181.5, c => {
  const t = c.t, u = c.u;
  c.run('drop', { uDC: [SW * .5, SH * .56 - u * 18], uDR: lerp(260, 300, ease(c.p)), uIn: 1 });
  c.post.bloom = .8; c.post.vig = .75; c.post.exp = 1.1;
}, { fade: .8 });

// ---------- D4: the halls of memory, the palaces of mind ----------
shot(181.5, 194.5, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  K.seeker(g, { x: SW * .5 + 10, y: 880, h: 250, age: 1.2, face: 0, walk: 1, phase: t * 3.8 });
  const far = smooth(seg(t, 191.5, 194.5));
  c.run('hall', { uZ: u * 3.0, uSil: hexLin('#030304'), uFar: [1.0, .78, .5], uFarK: 1 + far * 3, uFog: [.025, .028, .045] });
  c.post.bloom = .7; c.post.vig = .7;
}, { fade: .8 });

// ---------- D5: every face contained a story, every story held a world ----------
shot(194.5, 201.5, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  const drift = u * 22;
  const heads = [
    { x: 330, age: 0, face: 1, hair: null },
    { x: 760, age: 1, face: -1, hair: 'bun' },
    { x: 1190, age: 2, face: 1, hair: null },
    { x: 1630, age: 1, face: -1, hair: 'long' },
  ];
  const HC = new Float32Array(24);
  heads.forEach((h, i) => {
    g.fillStyle = `rgb(${(i + 1) * 32},0,0)`;
    const hx = h.x - drift;
    const size = h.age === 0 ? 1500 : 2100;
    const a = K.seeker(g, { x: hx, y: SH + size * .58, h: size, age: h.age, face: h.face, hair: h.hair, arms: 'down', look: .05 });
    HC.set([a.head[0], SH - a.head[1] - 40, 300, u * .02 * (i % 2 ? 1 : -1)], i * 4);
  });
  g.globalCompositeOperation = 'destination-out';
  const fadeG = g.createLinearGradient(0, 540, 0, 840);
  fadeG.addColorStop(0, 'rgba(0,0,0,0)'); fadeG.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fadeG; g.fillRect(0, 600, SW, SH);
  g.globalCompositeOperation = 'source-over';
  c.run('faces', { uHC: HC, uRimK: .35 });
  c.post.bloom = .6; c.post.vig = .6;
}, { fade: .9 });

// ---------- D6: within the smallest fragment, endless heavens lay unfurled ----------
shot(201.5, 207.4, c => {
  const t = c.t, u = c.u;
  const k = ease(seg(t, 202.0, 207.4));
  const gs = 2.2 * Math.exp(k * 6.0);
  const g2 = c.L(2);
  const r = K.rng(8);
  for (let i = 0; i < 40; i++) {
    const x = r() * SW, y = r() * SH, s = .6 + r() * 1.6;
    const dx = (x - SW / 2) * (1 + k * 6), dy = (y - SH / 2) * (1 + k * 6);
    const a = (1 - k) * (.25 + .35 * Math.sin(t * 1.3 + i));
    g2.fillStyle = `rgba(255,220,180,${Math.max(0, a)})`;
    g2.beginPath(); g2.arc(SW / 2 + dx + Math.sin(t * .4 + i) * 20, SH / 2 + dy + t * 4 % 40, s * (1 + k * 3), 0, Math.PI * 2); g2.fill();
  }
  c.run('galaxy', { uGC: [SW * .5, SH * .5], uGS: gs, uGRot: t * .05, uTilt: lerp(1, .55, k), uBright: 1.2, uBgStars: k * .8, uL2: undefined });
  c.glow(SW * .5, SH * .5, 3, [1, .85, .6], (1 - k) * 2.5, 1.5);
  c.post.bloom = .8; c.post.vig = .6;
}, { fade: .7 });
