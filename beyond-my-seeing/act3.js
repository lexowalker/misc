// Act III: the cry. The Milky Way; a face against the stars; the eye that holds the night; the endless road; "I will seek You still."
'use strict';

// ---------- C1: Where are You, beyond my seeing? ----------
shot(111.3, 119.4, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  const sink = ease(seg(t, 111.3, 113.5));
  const off = (1 - sink) * -260;            // continuing the upward tilt into the sky: land rises into frame
  g.save(); g.translate(0, -off);
  const crest = x => 905 + Math.pow((x - 980) / 900, 2) * 160 + (K.fbm(x * .005 + 9) - .5) * 18;
  pathLine(g, crest);
  const arms = ease(seg(t, 112.2, 116.5));
  const me = K.seeker(g, { x: 980, y: crest(980) + 3, h: 250, age: 1, face: 0, arms: 'open', armK: arms * .85, look: .3, wind: Math.sin(t * .8) * .15 });
  g.restore();
  c.run('land', landU({
    zen: hexLin('#01030c'), hor: hexLin('#141c40'), horY: 180 + off, gradP: 1.1,
    star: 1.1, mw: 1.25, mwAng: -.35 + u * .006, mwOff: [-.05, .02],
    ridges: [{ y: 150 + off, amp: 70, freq: .0016, rough: .6, col: hexLin('#0a0e1e'), mist: .3 }],
    mist: hexLin('#1a2448'), mistH: 40, c0: hexLin('#020307'), rim: .2,
    bg: [me.chest[0], me.chest[1] + off, 80, .7 + c.aud[0] * .5],
  }));
  c.post.bloom = .8; c.post.vig = .6; c.post.exp = 1.05;
}, { fade: .5 });
words(111.4, 118.6, ['Where are You, beyond my seeing?'], { y: SH * .86, size: 50, fin: 1.6, fout: 1.8 });

// ---------- C2a: within the silence (a face against the stars) ----------
shot(119.4, 122.6, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  const look = .45 + .08 * ease(seg(t, 119.4, 122.5));
  K.seeker(g, { x: 860 - u * 6, y: 2600, h: 2350, age: 1, face: 1, look, arms: 'down', wind: .1 });
  c.run('land', landU({
    zen: hexLin('#010309'), hor: hexLin('#0e1634'), horY: -200, gradP: .8,
    star: 1.2, mw: 1.0, mwAng: .55, mwOff: [.25, -.05 + u * .004],
    c0: hexLin('#010204'), rim: 0,
  }));
  c.post.bloom = .8; c.post.vig = .7;
}, { fade: .7 });

// ---------- C2b: looking through my eyes; we fall into the night inside the pupil ----------
shot(122.6, 126.1, c => {
  const t = c.t;
  const z = Math.pow(seg(t, 123.4, 126.1), 2.2) * 4.2;
  c.run('iris', {
    uC: [SW * .5, SH * .5], uS: SH * lerp(.9, 1.0, seg(t, 122.6, 126)), uPupil: .36, uRefl: 1, uLid: 1.0, uZoom: z, uLight: .55,
    uSunCol: [2, 2.1, 2.4], uIrisA: hexLin('#5e4a2e'), uIrisB: hexLin('#3a4656'), uSkin: hexLin('#0e0b10'), uSunDir: [-.3, .4, .86],
  });
  c.post.bloom = .7; c.post.vig = .9; c.post.satur = .8;
}, { fade: .6 });

// ---------- C3: though the road should run forever; though the stars themselves stand still ----------
// star rotation: wheeling, then slowing to a stop
function starSpin(t) {
  const t0 = 126.1, t1 = 132.4;
  const w0 = .1;
  if (t < t1) { const x = t - t0, T = t1 - t0; return { ang: w0 * (x - x * x / (2 * T)) * (x < 0 ? 0 : 1), w: w0 * Math.max(0, 1 - x / T) }; }
  return { ang: w0 * (t1 - t0) / 2, w: 0 };
}
shot(126.1, 139.3, c => {
  const t = c.t, u = c.u;
  const hz = 610;                                  // canvas y of the horizon
  const g3 = c.L(3), g1 = c.L(1), g = c.L(0);
  g3.fillRect(0, hz, SW, SH - hz + 10);
  // the road: a pale ribbon to the vanishing point, gently curving
  const vp = [SW * .5, hz];
  const grad = g1.createLinearGradient(0, hz, 0, SH);
  grad.addColorStop(0, 'rgba(255,255,255,0.15)'); grad.addColorStop(.35, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0.9)');
  g1.fillStyle = grad;
  g1.beginPath();
  for (let i = 0; i <= 60; i++) { const k = i / 60, z = Math.pow(k, 2.2); const y = hz + (SH + 40 - hz) * z; const half = 2 + z * 300; const bend = Math.sin(k * 3 + 1) * 40 * (1 - z); g1.lineTo(vp[0] + bend + half, y); }
  for (let i = 60; i >= 0; i--) { const k = i / 60, z = Math.pow(k, 2.2); const y = hz + (SH + 40 - hz) * z; const half = 2 + z * 300; const bend = Math.sin(k * 3 + 1) * 40 * (1 - z); g1.lineTo(vp[0] + bend - half, y); }
  g1.fill();
  g1.fillStyle = '#fff';
  // he walks away down the road
  const walk = seg(t, 126.6, 136.6);
  const d = 1 + walk * 5.5;
  const fh = 520 / d;
  const kk = Math.pow(1 / d, 1);
  const fy = hz + (SH - 40 - hz) * kk * .82 + fh * .1;
  const bendAt = Math.sin(Math.pow(Math.max(0, (fy - hz) / (SH + 40 - hz)), 1 / 2.2) * 3 + 1) * 40 * (1 - (fy - hz) / (SH + 40 - hz));
  const me = K.seeker(g, { x: vp[0] + bendAt + 20 / d, y: fy, h: fh, age: 1, face: 0, walk: t < 137 ? 1 : Math.max(0, 1 - (t - 137) * 2), phase: t * 4.4, look: .05 });
  const spin = starSpin(t);
  const dark = smooth(seg(t, 136.6, 138.1));
  c.run('land', landU({
    zen: hexLin('#010208'), hor: hexLin('#1a2246'), horY: SH - hz, gradP: 1.6,
    star: 1.25 * (1 - dark * .8), starAng: spin.ang, trail: spin.w * 1.6, pole: [SW * .5, SH - 120],
    mw: .35 * (1 - dark), mwAng: 1.2, mwOff: [0, .1],
    ridges: [{ y: SH - hz + 2, amp: 14, freq: .0016, rough: .5, col: hexLin('#06080f'), mist: .3 }],
    mist: hexLin('#1a2246'), mistH: 30, a3: 99, c3: hexLin('#06080e'), a1: 99, c1: mul(hexLin('#1c2030'), 1 - dark * .8), c0: hexLin('#010103'), rim: 0,
    bg: [me.chest[0], me.chest[1] - me.hu * .4, me.hu * 5, .55 + dark * .4],
  }));
  c.post.bloom = .75; c.post.vig = .65; c.post.exp = 1 - dark * .55;
}, { fade: .9 });

// ---------- C4: I will seek You still ----------
shot(139.3, 148.2, c => {
  const t = c.t, u = c.u;
  const g = c.L(0);
  const step = seg(t, 145.2, 148.2);
  const look = lerp(-.1, .12, ease(seg(t, 141, 144.5)));
  const a = K.seeker(g, { x: 880 + ease(step) * 120, y: 1480, h: 1180, age: 1.15, face: 1, look, walk: step > 0 ? smooth(step * 3) : 0, phase: (t - 145.2) * 3.2, wind: .15 + .1 * Math.sin(t * .7), arms: 'down' });
  const k = smooth(seg(t, 139.2, 141.2));
  c.run('land', landU({
    zen: hexLin('#010207'), hor: hexLin('#0b1128'), horY: 200, gradP: .9,
    star: .5, c0: hexLin('#010103'), rim: 0,
    bg: [a.chest[0], a.chest[1], 200, .14 + k * .2],
  }));
  const pulse = 1 + .12 * Math.sin(t * 2) + c.aud[0] * .4;
  c.glow(a.chest[0], a.chest[1], 9 + k * 5, C.ember, (1.2 + k * 2.2) * pulse, 2.4);
  c.post.bloom = .8; c.post.vig = .75;
}, { fade: .25 });
words(139.5, 145.6, ['I will seek You still.'], { y: SH * .84, size: 50, fin: 1.4, fout: 1.6 });
