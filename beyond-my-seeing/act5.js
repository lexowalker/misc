// Act V: the veil. Aurora over still water; his heart grows vast; chorus under the veil; a thousand lives as a river of lanterns; the lights become stars.
'use strict';

// ---------- E1: I thought that I was nearing, that the veil would surely part ----------
shot(207.4, 217.1, c => {
  const t = c.t, u = c.u;
  const g = c.L(0), g1 = c.L(1);
  const bankY = 905;
  pathLine(g, x => bankY + Math.sin(x * .004) * 5 + (K.fbm(x * .01) - .5) * 10);
  const reach = smooth(seg(t, 210.6, 211.8)) * (1 - smooth(seg(t, 214.2, 215.6)));
  const walking = t < 210.6 || t > 214.6;
  const x = 520 + Math.min(u, 3.2) * 46 + Math.max(0, t - 214.6) * 40;
  const me = K.seeker(g, { x, y: bankY - 2, h: 270, age: 1.25, face: 1, walk: walking ? 1 : 0, phase: t * 4.3, arms: reach > .01 ? 'reach' : 'swing', armK: reach, look: .25 + reach * .1, wind: .15 });
  g1.save(); g1.globalAlpha = .4; g1.translate(0, 2 * bankY + 6); g1.scale(1, -1);
  g1.restore();
  const recede = ease(seg(t, 213.9, 217.1));
  c.run('sea', seaU({
    uCam: [0, 1.5, 0], uPitch: .17, uFov: 1.0, uSun: sunDir(-.4, 0), uWaveT: t * .4, uWaveA: .12,
    uZen: hexLin('#01030c'), uHor: hexLin('#0a1430'), uWater: hexLin('#01040a'), uHaze: hexLin('#0a1430'), uFog: .002,
    uStar: 1, uMie: 0, uGlit: 0, uAur: 1.25 * (1 - recede * .35) + reach * .5,
    uAurC1: [.08, 1.15, .5], uAurC2: [.6, .18, 1.0],
    uSil: hexLin('#010204'), uSil1: hexLin('#03060c'), uRimK: 0,
  }));
  chestGlow(c, me, .8);
  c.post.bloom = .8; c.post.vig = .6;
}, { fade: .9 });

// ---------- E2: but the farther I have journeyed, the more vast becomes my heart ----------
shot(217.1, 223.45, c => {
  const t = c.t, u = c.u;
  const g = c.L(0), g2 = c.L(2);
  const pull = ease(seg(t, 217.1, 223.4));
  const s = lerp(1.0, .55, pull);
  g.save(); g.translate(SW * .42, SH * .95); g.scale(s, s); g.translate(-SW * .42, -SH * .95);
  K.ground(g, 1010, 20, .002, 31, -800, SW + 800);
  const me = K.seeker(g, { x: SW * .42, y: 1012, h: 640, age: 1.25, face: 1, look: .2 + pull * .2, arms: 'open', armK: ease(seg(t, 218, 221.5)) * .7, wind: .2 });
  g.restore();
  const cx = (me.chest[0] - SW * .42) * s + SW * .42, cy = (me.chest[1] - SH * .95) * s + SH * .95;
  const grow = Math.pow(seg(t, 217.6, 223.4), 1.7);
  const R = lerp(20, 1900, grow);
  const grd = g2.createRadialGradient(cx, cy, 0, cx, cy, R);
  grd.addColorStop(0, `rgba(255,214,150,${.85 * grow + .2})`); grd.addColorStop(.55, `rgba(255,170,90,${.45 * grow})`); grd.addColorStop(1, 'rgba(255,140,60,0)');
  g2.fillStyle = grd; g2.fillRect(0, 0, SW, SH);
  c.run('land', landU({
    zen: hexLin('#02040e'), hor: hexLin('#0b1534'), horY: 120, gradP: 1.2,
    star: 1, aur: .9, aurY: SH * .5, aurC1: [.08, 1.1, .5], aurC2: [.6, .18, 1.0],
    c0: hexLin('#010204'), emit: 1 + grow * 2.5, rim: 0,
  }));
  c.glow(cx, cy, 10 + grow * 40, C.ember, 3 + grow * 6, 2);
  c.post.bloom = .9; c.post.vig = .6; c.post.white = Math.pow(seg(t, 222.2, 223.45), 2) * .55;
}, { fade: .6 });

// ---------- E3a: Where are You? (chorus, beneath the veil) ----------
shot(223.45, 235.0, c => {
  const t = c.t, u = c.u;
  const rise = ease(seg(t, 223.4, 235)) * 120;
  const g = c.L(0);
  g.save(); g.translate(0, rise);
  const crest = x => 860 - Math.max(0, 260 - Math.abs(x - 1180)) * .9 + (K.fbm(x * .009 + 3) - .5) * 40;
  pathLine(g, crest, -10, SW + 10, SH + 400);
  const arms = ease(seg(t, 224, 228));
  const me = K.seeker(g, { x: 1180, y: crest(1180) + 3, h: 210, age: 1.25, face: 0, arms: 'open', armK: arms * .9, look: .35, wind: .25 + .1 * Math.sin(t) });
  g.restore();
  const cols = ridgeCols(4, hexLin('#04060d'), hexLin('#1a2448'), 1.3);
  c.run('land', landU({
    zen: hexLin('#01020a'), hor: hexLin('#101a3c'), horY: 380 - rise * .3, gradP: 1.2,
    star: 1.1, mw: .9, mwAng: -.9, mwOff: [.1, .25],
    aur: 1.15 + c.aud[0] * .4, aurY: SH * .45 - rise * .2, aurC1: [.08, 1.15, .55], aurC2: [.65, .2, 1.05],
    ridges: cols.map((col, i) => ({ y: 520 - i * 90 - rise * (.3 + i * .15), amp: 170 - i * 20, freq: .0018 + i * .0005, rough: .85, col, mist: .5 - i * .08 })),
    mist: hexLin('#16305a'), mistH: 60, c0: hexLin('#010204'), rim: 0,
    bg: [me.chest[0], me.chest[1] + rise, 60, .8],
  }));
  c.post.bloom = .85; c.post.vig = .55;
}, { fade: 1.2 });

// ---------- E3b: are You looking through my eyes? ----------
shot(235.0, 238.4, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  K.seeker(g, { x: 900 - u * 8, y: 2700, h: 2450, age: 1.3, face: 1, look: .5 + u * .03, arms: 'down', wind: .2 });
  c.run('land', landU({
    zen: hexLin('#01020a'), hor: hexLin('#0e1838'), horY: -100, gradP: .9,
    star: 1.1, aur: 1.2, aurY: SH * .1, aurC1: [.08, 1.15, .55], aurC2: [.65, .2, 1.05],
    c0: hexLin('#010103'), rim: 0,
  }));
  c.post.bloom = .85; c.post.vig = .65;
}, { fade: .5 });

// ---------- E4/E5: if a thousand lives were given... the lights become stars ----------
function procession(t) {
  // a winding road from the foreground into the far mountains; s=0 near, s=1 at the horizon
  const hz = 470;
  return s => {
    const k = Math.pow(1 - s, 2.4);
    return [SW * .5 + Math.sin(s * 11 + .6) * (520 * k + 18) + (1 - k) * 160, hz + (SH + 60 - hz) * k, .03 + .97 * k];
  };
}
shot(238.4, 257.5, c => {
  const t = c.t, u = c.u;
  const crane = ease(seg(t, 238.4, 249)) * 140;
  const P = procession(t);
  const g = c.L(0), g2 = c.L(2), g3 = c.L(3);
  g3.fillRect(0, 470 + crane, SW, SH);
  const rise = seg(t, 248.6, 256.8);
  const N = 420;
  for (let i = 0; i < N; i++) {
    const s = ((i / N) + (t - 238.4) * .012) % 1;
    const [x, y0, k] = P(s);
    const y = y0 + crane * (1 - s * .7);
    // after "what no words can define", the lanterns lift into the sky
    const h = K.hash(i * 3.1);
    const lift = Math.max(0, rise * 1.4 - h * .4);
    const ly = y - lift * lift * (500 + h * 700) - lift * 60;
    const lx = x + Math.sin(lift * 3 + i) * lift * 60;
    if (k > .12 && lift < .02) K.seeker(g, { x, y, h: 120 * k, age: 1, face: 0, walk: 1, phase: t * 4 + i, arms: 'swing' });
    const a = (1 - lift * .3) * (.6 + .4 * Math.sin(t * 3 + i * 7));
    const rr = Math.max(.9, 4.5 * k) * (1 - lift * .5);
    g2.fillStyle = `rgba(255,${Math.round(180 - lift * 40)},${Math.round(100 + lift * 120)},${Math.max(0, Math.min(1, a))})`;
    g2.beginPath(); g2.arc(lx + 18 * k, ly - (lift > 0 ? 0 : 60 * k), rr, 0, Math.PI * 2); g2.fill();
  }
  // him, in the foreground, among them
  const me = K.seeker(g, { x: SW * .5 - 420, y: SH + 40 + crane * .3, h: 520, age: 1.3, face: 0, walk: t < 248.6 ? 1 : 0, phase: t * 3.5, look: rise * .4 });
  const cols = ridgeCols(3, hexLin('#04060c'), hexLin('#141c3a'), 1.3);
  c.run('land', landU({
    zen: hexLin('#01020a'), hor: hexLin('#141a3a'), horY: SH - 470 - crane, gradP: 1.3,
    star: .9 + rise * .4, mw: .5 + rise * .3, mwAng: .6, mwOff: [0, .2],
    ridges: cols.map((col, i) => ({ y: SH - 470 - crane + 150 - i * 55, amp: 150 - i * 30, freq: .0017 + i * .0006, rough: .8, col, mist: .4 })),
    mist: hexLin('#1a2448'), mistH: 50, a3: 99, c3: hexLin('#0a0c17'), c0: hexLin('#010103'), emit: 2.2, rim: 0,
    bg: [me.chest[0], me.chest[1], 110, .3],
  }));
  c.post.bloom = .8; c.post.vig = .55;
}, { fade: .7 });
