// The film. Scenes run back-to-back; each scene's draw function takes local time u.
const SCENES = [
  { id: 'title', a: 0, b: 22 },
  { id: 'dawn', a: 22, b: 60 },
  { id: 'subway', a: 60, b: 102 },
  { id: 'street', a: 102, b: 134 },
  { id: 'office', a: 134, b: 164 },
  { id: 'park', a: 164, b: 212 },
  { id: 'night', a: 212, b: 272 },
  { id: 'home', a: 272, b: 300 },
];
const TOTAL = 300, XF = 1.2;
const at = id => SCENES.find(s => s.id === id).a;
window.SCENES = SCENES.map(({ id, a, b }) => ({ id, a, b }));
window.TOTAL = TOTAL;
window.SFX = [];
const sfx = (id, u, type, gain = 1) => window.SFX.push({ t: +(at(id) + u).toFixed(3), type, gain });

/* ------------------------------------------------------------ helpers */
let LAYER, SMALL, RIG = {};
function cam(cx, cy, z, fn) { g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-cx, -cy); fn(); g.restore(); }
// draw fn soft-focused (rendered small, scaled up): a cheap depth-of-field for close-ups
function soft(fn, k = 7) {
  const sc = SMALL.getContext('2d');
  sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, SMALL.width, SMALL.height);
  into(SMALL, () => { g.setTransform(1 / k, 0, 0, 1 / k, 0, 0); fn(); });
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingQuality = 'high';
  g.drawImage(SMALL, 0, 0, W / k, H / k, 0, 0, W, H); g.restore();
}
// world-space point on a person rig (dir = facing)
const rp = (x, y, s, dir, p) => [x + p[0] * s * dir, y + p[1] * s];
function eyeOf(x, y, s, dir, turn = false) {
  const hc = RIG.hc || [0, -90];
  return rp(x, y, s, dir, [hc[0] + (turn ? -4.7 : 4.7), hc[1] - .3]);
}
const capture = o => ({ ...o, onDraw: r => { RIG = r; } });
const ManStyle = { scarf: C.scarf };
function puff(x, y, u, s = 1) {
  if (u < 0 || u > 1.2) return;
  const r = rng(77);
  for (let i = 0; i < 14; i++) {
    const a = r() * TAU, d = (20 + r() * 60) * ease.out(clamp(u / .8)) * s;
    circ(x + Math.cos(a) * d, y + Math.sin(a) * d, (10 + r() * 14) * s * (1 - u / 1.2), '#f4f0e8', .8 * (1 - u / 1.2));
  }
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU, d = 90 * u * s;
    tr(x + Math.cos(a) * d, y + Math.sin(a) * d + u * 40, s, a + u * 3, () => { g.beginPath(); g.ellipse(0, 0, 4, 12, 0, 0, TAU); g.fillStyle = '#1f1c26'; g.fill(); });
  }
}
function flame(x, y, s, t, a = 1) {
  // a single kitsune-bi, fox fire
  const tq = twos(t);
  withA(a, () => tr(x, y, s, 0, () => {
    glow(0, 0, 60, 'rgba(255,60,110,.9)', .8);
    glow(0, 0, 26, 'rgba(255,200,220,.9)', .9);
    const f = noise1(tq * 4) * 3;
    g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(12, 10, 10, -6, f, -24); g.bezierCurveTo(-10, -6, -12, 10, 0, 12);
    g.fillStyle = lin(0, 12, 0, -24, [[0, '#ff4a7a'], [.6, '#ffb0c8'], [1, '#ffffff']]); g.fill();
  }));
}
function shameSpine(sh, s, u, wrap = 1, from = null) {
  const rel = [[9, 15], [8.5, 7], [5, 0], [-1, -3], [-7, -1], [-12, 4], [-18, 3], [-24, -2], [-30, -1], [-36, -6], [-42, -5], [-48, -10]];
  return rel.map(([a, b], k) => {
    const w = k > 5 ? Math.sin(u * 2.4 - k * .8) * (k - 5) * .9 : 0;
    const p = [sh[0] + a * s, sh[1] + (b + w) * s];
    if (!from || wrap >= 1) return p;
    const q = from(k);
    return [lerp(q[0], p[0], wrap), lerp(q[1], p[1], wrap)];
  });
}
// a park bench seen end-on, so he can sit in profile
function bench(x, y, s) {
  tr(x, y, s, 0, () => {
    for (const lx of [-8, 14]) limb([[lx, -25], [lx - 1, 0]], '#2a2a2a', 2.2, '#111', .3);
    g.beginPath(); g.roundRect(-14, -27.5, 34, 4, 1.4); inkPath('#7a5434', .8);
    limb([[-12, -26], [-15, -52]], '#2a2a2a', 2, '#111', .3);
    for (let k = 0; k < 3; k++) { g.beginPath(); g.roundRect(-19 + k * .4, -50 + k * 7, 5, 5, 1); inkPath('#6a4a2c', .6); }
    limb([[-12, -36], [16, -36], [17, -27]], '#2a2a2a', 1.4, '#111', .3);
  });
}
function cupHands(x, y, s) {
  tr(x, y, s, 0, () => {
    // coat cuffs
    for (const sx of [-1, 1]) { g.save(); g.scale(sx, 1); g.beginPath(); g.moveTo(-24, 2); g.lineTo(-40, 14); g.lineTo(-44, 30); g.lineTo(-26, 32); g.lineTo(-14, 16); g.closePath(); inkPath(C.coat, .5); g.restore(); }
    // two palms cupped into one bowl
    const bowl = () => {
      g.beginPath(); g.moveTo(-29, -5);
      for (let k = 0; k < 4; k++) g.quadraticCurveTo(-27 + k * 6.6, -9.5, -23.5 + k * 6.6, -5.5);
      g.quadraticCurveTo(-2, -4, 0, -4.4);
      for (let k = 0; k < 4; k++) g.quadraticCurveTo(3.4 + k * 6.6, -9.5 + (k === 0 ? 1 : 0), 6.8 + k * 6.6, -5.5 + (k === 3 ? .5 : 0));
      g.bezierCurveTo(31, 4, 22, 17, 0, 18); g.bezierCurveTo(-22, 17, -31, 4, -29, -5); g.closePath();
    };
    bowl(); inkPath(C.skin, .5);
    g.save(); bowl(); g.clip();
    g.fillStyle = lin(0, -6, 0, 18, [[0, 'rgba(255,200,150,.0)'], [1, 'rgba(120,60,40,.35)']]); g.fillRect(-32, -10, 64, 30);
    g.restore();
    stroke([[0, -4], [.4, 6], [0, 17.6]], hexA('#8a5a44', .8), .45);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) stroke([[sx * (24 - k * 6.6), -4.6], [sx * (22 - k * 5.4), 0]], hexA('#a06a52', .55), .35);
    // thumbs along the rim
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 15, -5.4, 9, 2.6, sx * .08, 0, TAU); inkPath(C.skin, .45); }
  });
}
/* ============================================================ TITLE */
function sTitle(u) {
  rect(0, 0, W, H, '#0a0710');
  const p = ease.inout(P(u, 3.6, 4.4));
  const L = lerp(W - 90, 90, p);
  if (p > 0) {
    // the scroll paper
    g.save(); g.beginPath(); g.rect(L, 100, W - 90 - L, 880); g.clip();
    g.drawImage(TEX.washi, 0, 0);
    // faint ink clouds and mountains
    g.globalAlpha = .18;
    for (let i = 0; i < 5; i++) { const cx = 300 + i * 360, cy = 250 + (i % 2) * 60; g.strokeStyle = '#3a3030'; g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx + k * 40, cy, 22 + k * 4, Math.PI, TAU); g.stroke(); } }
    g.fillStyle = '#4a4040'; g.beginPath(); g.moveTo(90, 900); for (let x = 90; x <= W; x += 60) g.lineTo(x, 760 - Math.abs(Math.sin(x * .004)) * 140 - Math.sin(x * .013) * 30); g.lineTo(W, 980); g.lineTo(90, 980); g.fill();
    g.globalAlpha = 1;
    // the procession, in sepia ink
    g.save();
    const march = u * 26;
    const parade = [lantern, oni, kappa, nopperabo, tanuki, hitotsume, nekomata, nurikabe, rokurokubi];
    parade.forEach((f, i) => {
      const px = 1560 - i * 190 + march, py = 920 + Math.sin(i * 1.3) * 10;
      if (f === lantern) lantern(px, py - 100, 2.6, { t: u, lit: 0 });
      else f(px, py, 3.8, u);
    });
    kasa(1740 + march, 920, 3, { t: u });
    g.restore();
    // tint the procession to sepia ink and let the paper show through (cheaper than a CSS filter)
    g.save(); g.globalCompositeOperation = 'color'; g.fillStyle = '#8a7258'; g.fillRect(L, 640, W - L, 340); g.restore();
    g.save(); g.globalAlpha = .4; g.drawImage(TEX.washi, 0, 640, W, 340, 0, 640, W, 340); g.restore();
    // title
    const ta = S(u, 6.5, 1.6);
    withA(ta, () => {
      VT('色欲', 1480, 180, { size: 170 });
      T('IROYOKU', 900, 430, { size: 92, weight: 600, color: '#2a1e1a', ls: 30 });
      T('the yokai of lust', 900, 512, { size: 46, italic: true, color: '#4a3424' });
    });
    T('a picture scroll of the hundred demons who live inside one man', 900, 582, { size: 31, italic: true, color: '#5a4434', a: S(u, 8.6, 1.6) });
    // the stamp lands
    if (u > 8) { const k = 1 + 1.5 * (1 - ease.out(P(u, 8, .25))); seal(1480, 590, 1.9 * k, '妖', S(u, 8, .15)); }
    // edge shadow by the roller
    g.fillStyle = lin(L, 0, L + 60, 0, [[0, 'rgba(60,40,20,.35)'], [1, 'rgba(60,40,20,0)']]); g.fillRect(L, 100, 60, 880);
    g.restore();
    // rollers
    for (const [rx, roll] of [[L, 1], [W - 90, 0]]) {
      g.fillStyle = lin(rx - 22, 0, rx + 22, 0, [[0, '#3a2414'], [.4, '#8a5a34'], [1, '#2a180c']]); g.fillRect(rx - 20, 86, 40, 908);
      if (roll) { g.fillStyle = lin(rx - 26, 0, rx + 26, 0, [[0, '#c8b490'], [.5, '#efe3c8'], [1, '#a89470']]); g.fillRect(rx - 26, 100, 52, 880); }
      for (const ey of [74, 994]) { g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(rx, ey, 26, 12, 0, 0, TAU); g.fill(); }
    }
  }
  // the first fox-fire, before the scroll opens
  const fa = S(u, .6, 1.2) * (1 - S(u, 6.4, 1));
  const fx = lerp(960, 1480, ease.inout(P(u, 4.2, 2.6))), fy = lerp(540, 590, ease.inout(P(u, 4.2, 2.6))) + Math.sin(u * 2) * 8;
  flame(fx, fy, 2.2 + .3 * Math.sin(u * 3), u, fa);
  caption(u, 12.4, 16.8, 'In old Japan, painters gave every unseen force a face.', { color: '#3a2618', shadow: 0, y: 672 });
  caption(u, 17.1, 21.6, 'Some of those faces never left. They moved to the city.', { color: '#3a2618', shadow: 0, y: 672 });
}
sfx('title', .7, 'bell', .8); sfx('title', 3.7, 'unroll'); sfx('title', 8.05, 'stamp');

/* ============================================================ DAWN — the apartment */
function sleeper(u, x, y, s, o = {}) {
  // his head on the pillow, lying with the top of his head toward the headboard
  tr(x, y, s, -1.25, () => face(0, 0, 1, { ...o, scarf: false, body: false }));
}
function sDawn(u) {
  const night = false;
  if (u < 13.2) {
    const z = 1 + u * .004;
    cam(960, 540, z, () => {
      rect(0, 0, W, H, '#000');
      windowSky(u, 'dawn');
      g.drawImage(BG.apt, 0, 0);
      // sunbeam on the wall
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,200,140,.16)'; g.beginPath(); g.moveTo(1000, 690); g.lineTo(1560, 690); g.lineTo(1340, 1080); g.lineTo(700, 1080); g.closePath(); g.fill(); g.restore();
      const wake = u > 9.6;
      sleeper(u, 300, 640, 5.2, { lid: wake ? lerp(1, .25, S(u, 9.6, 1)) : 1, mouth: wake ? 'flat' : 'smile', lookX: .4 });
      blanket(u, night);
      // phone on the nightstand, with the lust yokai asleep on it as a little flame
      const buzz = u > 8 && u < 10.5 ? Math.sin(u * 90) * 2 : 0;
      tr(56 + buzz, 646, 1, 0, () => { rect(-26, -8, 52, 9, '#1a1a22'); if (u > 8) { rect(-23, -7, 46, 6, '#ffb0d8'); glow(0, -4, 60, 'rgba(255,120,190,.7)', .7); } });
      const wakeI = S(u, 10.5, 1.2);
      if (wakeI <= 0) flame(56, 618, .55 + .05 * Math.sin(u * 2), u, 1);
      else iroyoku(56, 600 - wakeI * 40, lerp(.4, 1.1, wakeI), { t: u, tails: 1 + wakeI * .6, eyesOpen: S(u, 11.2, .6), mouth: Math.max(0, Math.sin(clamp((u - 11.4) / 1.4) * Math.PI)) * .9, look: [.6, .2], a: wakeI });
      // dreams rising to the baku
      const bx = lerp(780, 2100, ease.in(P(u, 8.6, 3.4))), by = 900 - (u > 8 && u < 8.5 ? Math.sin((u - 8) * TAU) * 40 : 0);
      const trunk = [bx - 13 * 5 - 70, by - 25 * 5 + 40];
      for (let i = 0; i < 12; i++) {
        const born = i * .7, f = (u - born) / 3.2;
        if (f < 0 || f > 1 || u > 8.4) continue;
        const sx = 330, sy = 600;
        dream(lerp(sx, trunk[0], ease.inout(f)) + Math.sin(f * 7 + i) * 26, lerp(sy, trunk[1], ease.inout(f)) - Math.sin(f * Math.PI) * 140, 22 * (1 - f * .5), u, i, 1 - S(f, .85, .15));
      }
      baku(bx, by, 5, { t: u, dir: u < 8.5 ? -1 : 1, walk: u > 8.5 ? u * 1.4 : undefined, trunk: u < 8.4 ? .8 + .2 * Math.sin(u * 3) : 0, a: 1 - S(u, 11, 1.5) });
      lantern(820, 150 + (u > 8.3 ? 0 : 0), 3.2, { t: u, lit: u > 8.6 ? .35 : .12, eye: S(u, 8.6, .4), tongue: u > 8.6 ? 10 : 4, mouth: .2, cord: 30 });
      if (u > 8 && u < 8.4) T('!', 1260, 680, { size: 90, weight: 700, color: '#fff', shadow: 10 });
    });
    card(u, 2, 7.6, { kanji: '獏', romaji: 'baku', role: 'Baku — eater of dreams', x: 1730, y: 150 });
    card(u, 11.4, 17.4, { kanji: '色欲', romaji: 'iroyoku', role: 'Iroyoku — lust. It is always hungry.', x: 1730, y: 150 });
  } else if (u < 26.2) {
    // on the edge of the bed, with the phone
    const v = u - 13.2;
    cam(820, 560, 1.15, () => {
      rect(-200, -200, W + 400, H + 400, '#000');
      windowSky(u, 'dawn');
      g.drawImage(BG.apt, 0, 0);
      blanket(u, night);
      fillAll('rgba(30,20,50,1)', .22, 'multiply');
      const putDown = S(v, 11.6, .9);
      const x = 720, y = 905, s = 7.6;
      const bonk = v > 11 && v < 11.5;
      person(x, y, s, capture({
        sit: 1, seat: 27, lap: false, coat: '#e9e4da', shirt: '#e9e4da', pants: '#5a6a8a', shoes: C.skin,
        armN: [lerp(9, 6, putDown), lerp(8, 18, putDown)], prop: putDown < .5 ? 'phone' : null, screen: '#ffb8de', screenGlow: 'rgba(255,120,190,.45)',
        armF: [6, 16], tilt: bonk ? -.15 : lerp(.38, .05, putDown), blink: bonk || (v > 11.5 && v < 11.7) ? 1 : 0, brow: bonk ? 1 : 0,
        look: lerp(.6, 0, putDown), lookY: lerp(1, 0, putDown), eyeGlint: putDown < .5 && v > 4 ? '#ff6a9a' : null,
      }));
      if (putDown >= .5) tr(960, 690, 1, 0, () => rect(-30, -6, 60, 10, '#1a1a22'));
      // the yokai climbs his arm and settles above his shoulder
      const climb = ease.inout(P(v, 0, 3));
      const ex = eyeOf(x, y, s, 1), hand = rp(x, y, s, 1, RIG.hand), hc = rp(x, y, s, 1, RIG.hc);
      const shrink = S(v, 11.4, .8);
      const ix = lerp(hand[0] + 20, hc[0] - 150, climb) + Math.sin(u * 1.3) * 10, iy = lerp(hand[1], hc[1] - 60, climb) + Math.sin(u * 1.7) * 8 + shrink * 140;
      const tips = iroyoku(ix, iy, lerp(1.2, 1.7, S(v, 3, 6)) * (1 - shrink * .55), {
        t: u, tails: 1 + S(v, 3, 6), look: [.8, .3], mouth: (v > 2 && v < 3.4) || (v > 6 && v < 7.4) || (v > 9 && v < 10.4) ? .6 : (shrink > .5 ? 0 : .1),
        squash: v > 11.2 && v < 11.6 ? .25 : 0, heat: .5 + .4 * S(v, 3, 6),
      });
      if (shrink < .9) {
        thread(tips[0][0], tips[0][1], ex[0], ex[1], u, { a: S(v, 3.5, 1) * (1 - shrink), sag: 30 });
        thread(tips[tips.length - 1][0], tips[tips.length - 1][1], hand[0], hand[1] - 20, u, { a: S(v, 5, 1) * (1 - shrink), sag: 60, seed: 3 });
      }
      whisper(v, 2.1, ix - 40, iy - 70, 'ねえ'); whisper(v, 6.1, ix - 30, iy - 80, 'もっと'); whisper(v, 9.1, ix - 40, iy - 70, 'ほら');
      // the lantern of attention dims, then drops on his head
      const drop = ease.in(P(v, 10.4, .6)), back = ease.out(P(v, 11.4, 1));
      const ly0 = 170, ly1 = hc[1] - 90;
      const ly = lerp(lerp(ly0, ly1, drop), ly0, back);
      lantern(lerp(520, hc[0], drop * (1 - back)), ly, 2.6, { t: u, lit: lerp(.9, .15, S(v, 2, 7)) + back * .7, eye: v > 9.2 ? 1 : .6, tongue: 9, rot: v > 9.2 && v < 10.4 ? Math.sin(v * 30) * .15 : undefined, mouth: v > 9.2 ? .9 : .3 });
      if (bonk) T('!', hc[0] + 70, hc[1] - 120, { size: 70, weight: 700, color: '#fff', shadow: 12 });
    });
    card(u, 15, 21, { kanji: '提灯お化け', romaji: 'chōchin-obake', role: 'Chōchin-obake — attention', x: 1730, y: 100 });
  } else {
    // at the window with coffee
    const v = u - 26.2;
    cam(1270, 470, 1.32, () => {
      rect(0, 0, W, H, '#000');
      windowSky(u, 'dawn');
      g.drawImage(BG.apt, 0, 0);
    });
    glow(1400, 700, 600, 'rgba(255,190,140,.4)', .7);
    const x = 1080, y = 1130, s = 6.8;
    person(x, y, s, capture({ ...ManStyle, armN: [8, 5], prop: 'cup', armF: [3, 18], look: .6, lookY: -.2, tilt: -.05 }));
    // steam
    const hand = rp(x, y, s, 1, RIG.hand);
    for (let i = 0; i < 4; i++) { const f = (v * .4 + i / 4) % 1; circ(hand[0] + 12 + Math.sin(f * 6 + i) * 10, hand[1] - 30 - f * 120, 6 + f * 14, 'rgba(255,255,255,.25)', 1 - f); }
    // fox-fur stole: the lust yokai curled about his neck, one eye open
    const nk = rp(x, y, s, 1, RIG.neck);
    iroyoku(nk[0] - 50, nk[1] + 20, 1.5, { t: u, tails: 2, tailLen: .6, eyesOpen: .35 + .15 * Math.sin(v * .8), look: [.9, 0], heat: .3, rot: -.5 });
    caption(u, 27.2, 31.8, 'It rides with him. It always has.');
    caption(u, 32.2, 37.4, "Most mornings, he doesn't notice it at all.");
  }
}
sfx('dawn', 8, 'buzz'); sfx('dawn', 8.6, 'boing', .6); sfx('dawn', 11.3, 'yawn');
sfx('dawn', 13.2 + 2.1, 'whisper'); sfx('dawn', 13.2 + 6.1, 'whisper'); sfx('dawn', 13.2 + 9.1, 'whisper');
sfx('dawn', 13.2 + 10.95, 'bonk'); sfx('dawn', 13.2 + 12.1, 'thump', .5);

/* ============================================================ SUBWAY */
const RIDERS = [
  { x: 330, dir: 1, st: { ...CROWD_STYLES[5], armN: [10, 4], armF: [10, 5], tilt: .25, look: .5, lookY: .6 }, paper: 1, pal: 'kappa' },
  { x: 600, dir: 1, st: { ...CROWD_STYLES[4], blink: 1, tilt: .1 }, pal: 'lantern' },
  { x: 800, dir: -1, st: { ...CROWD_STYLES[6], armN: [9, 8], prop: 'phone', tilt: .3, look: .5, lookY: .8 }, pal: 'phone' },
  { x: 1020, dir: 1, st: { ...CROWD_STYLES[1], brow: 1, tilt: .05 }, pal: 'ittan' },
  { x: 1180, dir: -1, st: { ...CROWD_STYLES[3], bag: '#c8402a', tilt: -.1, look: .3 }, pal: 'kodama' },
  { x: 1660, dir: -1, st: { ...CROWD_STYLES[7], coat: '#4aa0a0', pants: '#4aa0a0', skirt: null, blink: 1, tilt: .3 }, pal: 'tengu' },
];
function riders(u) {
  for (const r of RIDERS) {
    const s = 4.6, y = 852;
    person(r.x, y, s, capture({ ...r.st, sit: 1, dir: r.dir, seat: 25 }));
    const hc = rp(r.x, y, s, r.dir, RIG.hc), sh = rp(r.x, y, s, r.dir, RIG.sh);
    if (r.paper) { tr(rp(r.x, y, s, r.dir, RIG.hand)[0] + 20, rp(r.x, y, s, r.dir, RIG.hand)[1] - 50, 1, -.08, () => { rect(-10, 0, 70, 96, '#ece8dc'); for (let k = 0; k < 7; k++) rect(-4, 10 + k * 12, 56, 4, '#9a968c'); }); }
    if (r.pal === 'kappa') kappa(hc[0] - 4, hc[1] - 36, 1.2, u);
    if (r.pal === 'lantern') { lantern(hc[0] + 10, hc[1] - 90, .9, { t: u + 1, lit: 1, eye: 1, tongue: 5 }); for (let k = 0; k < 3; k++) { const f = (u * .5 + k / 3) % 1; T('♪', hc[0] + 30 + f * 40, hc[1] - 30 - f * 70, { size: 26, color: '#fff', a: Math.sin(f * Math.PI) }); } }
    if (r.pal === 'phone') phoneMon(hc[0] - 40, hc[1] + 10, 1.4, { t: u, awake: 1, look: -1 });
    if (r.pal === 'ittan') ittan(Array.from({ length: 9 }, (_, k) => [sh[0] - 30 + k * 16, sh[1] - 4 + Math.sin(u * 2 + k * .7) * 6 + k * 3]), .7, { a: .9 });
    if (r.pal === 'kodama') kodama(sh[0] + 26, sh[1] + 34, 3, { t: u, seed: 2 });
    if (r.pal === 'tengu') tengu(sh[0] - 6, sh[1] + 4, 1.1, { t: u, mood: 'sleep', dir: -1 });
  }
}
function subwayScene(u, v, man, extra) {
  const sway = .004 * Math.sin(u * 1.7) + .003 * Math.sin(u * 4.3);
  const stop = clamp((v - 34) / 4);
  g.save(); g.translate(W / 2, H / 2); g.rotate(sway * (1 - stop)); g.translate(-W / 2, -H / 2 + Math.sin(u * 9) * 1.5 * (1 - stop));
  rect(0, 0, W, H, '#000');
  const speed = 1700 * (1 - ease.out(stop));
  tunnel(u * (1 - stop * .5), speed, S(v, 36.5, 1.5));
  g.drawImage(BG.subway, 0, 0);
  subwayAds(u, man.lure || 0);
  riders(u);
  extra && extra();
  g.restore();
}
function sSubway(u) {
  const v = u;
  const x = 1330, y = 1000, s = 5.4, pole = 1440;
  if (v < 12 || (v >= 18)) {
    const turn = v > 9.2 && v < 24.8, lure = S(v, 7, 2) * (1 - S(v, 24, 1));
    subwayScene(u, v, { lure }, () => {
      const tenguIn = v > 21;
      person(x, y, s, capture({
        ...ManStyle, armN: [15, -3], armF: [1, 22], turn, tilt: turn ? -.38 : 0, look: turn ? .3 : 0, lookY: turn ? -1 : 0,
        brow: v > 24.8 && v < 30 ? -1 : (turn ? .5 : 0), eyeGlint: turn ? '#ff3a6a' : null, blink: v > 24.6 && v < 24.8 ? 1 : 0,
      }));
      const ex = eyeOf(x, y, s, 1, turn), sh = rp(x, y, s, 1, RIG.sh), nk = rp(x, y, s, 1, RIG.neck);
      // the lust yokai: out of his collar, up the pole, along the ad strip
      let ix, iy, is, rot = 0, tails;
      if (v < 6) { ix = nk[0] - 10; iy = nk[1] - 10 - S(v, 2, 2) * 20; is = .7; tails = 1; }
      else if (v < 12) { const f = ease.inout(P(v, 6, 4)); ix = lerp(nk[0] - 10, 1150, f) + Math.sin(f * 9) * 30; iy = lerp(nk[1] - 30, 300, f); is = lerp(.7, 2, f); tails = 1 + 2 * f; }
      else if (v < 24) { ix = 1180 + Math.sin(u * 1.1) * 20; iy = 330 + Math.sin(u * 1.6) * 14; is = 2.3; tails = 3; }
      else { const f = ease.out(P(v, 24, 1.6)); ix = lerp(1180, 900, f); iy = lerp(330, 120, f); is = lerp(2.3, 1.1, f); tails = lerp(3, 1, f); rot = Math.PI * f; }
      const tips = iroyoku(ix, iy, is, { t: u, tails, rot, look: turn ? [-.5, .5] : [.4, .6], mouth: (v > 9.4 && v < 10.8) ? .7 : .1, squash: v > 24 && v < 24.4 ? .3 : 0, heat: .4 + lure * .5, eyesOpen: v > 26 && v < 34 ? .4 : 1 });
      if (turn) {
        const tip = tips[0];
        thread(tip[0], tip[1], ex[0], ex[1], u, { a: S(v, 9.4, 1) * (1 - S(v, 24, .3)), sag: 50 });
        thread(ex[0], ex[1], 1010, 210, u, { a: S(v, 10, 1) * (1 - S(v, 24, .3)) * .7, sag: -40, seed: 5 });
      }
      whisper(v, 9.4, ix - 120, iy + 60, 'みて', { dx: -60 });
      // will arrives
      if (tenguIn) {
        const sleep = v > 30.5, crossed = v > 25.2 && !sleep;
        const swing = v > 23.4 && v < 24.4 ? -1.6 + 2.4 * ease.out(P(v, 23.4, .5)) : -.4;
        tengu(sh[0] - 7 * s, sh[1] - 2, 1.9, { t: u, mood: sleep ? 'sleep' : 'stern', wings: sleep ? .2 : .8, fan: swing, crossed, dir: 1, rot: sleep ? .1 : 0 });
        puff(sh[0], sh[1] - 30, v - 21, 1.2);
      }
    });
    caption(u, 1.4, 6.2, 'Everyone in the city carries their own parade.');
    caption(u, 6.5, 9.6, 'Most never see it.');
    card(u, 21.6, 27.6, { kanji: '天狗', romaji: 'tengu', role: 'Tengu — will. Stern, small, easily tired.', x: 200, y: 110 });
    caption(u, 28.2, 33.4, 'Will is strong. But will gets tired.');
  } else {
    // close: his eyes drift; the mask leans in
    const w = v - 12;
    soft(() => subwayScene(u, v, { lure: 1 }), 6);
    fillAll('rgba(30,10,30,1)', .45, 'multiply');
    glow(300, 200, 700, 'rgba(255,60,130,.5)', .6);
    face(880, 600, 26, { lookX: -lerp(.2, .9, S(w, .5, 2)), lookY: -.5, lid: lerp(.1, .4, S(w, 1, 3)), brow: .6, glint: '#ff3a6a', light: { color: 'rgba(255,90,160,1)', a: .8, from: 'top' } });
    const tips = iroyoku(1430 - S(w, 0, 4) * 80, 440, 5.4, { t: u, tails: 3, look: [-.9, .4], mouth: (w > 1.3 && w < 2.8) || (w > 3.9 && w < 5.2) ? .8 : .15, heat: .9 });
    thread(tips[0][0], tips[0][1], 880 - 3.15 * 26, 600, u, { a: .9, sag: 40, w: 2.6 });
    whisper(w, 1.4, 1250, 330, 'もっと', { size: 54 }); whisper(w, 4, 1300, 300, 'ほら', { size: 54 });
  }
}
sfx('subway', 9.4, 'whisper'); sfx('subway', 12, 'heartbeat'); sfx('subway', 13.4, 'whisper'); sfx('subway', 16, 'whisper');
sfx('subway', 21, 'puff'); sfx('subway', 23.7, 'thwack'); sfx('subway', 24.1, 'hiss', .6);
sfx('subway', 34, 'brake'); sfx('subway', 39, 'chime');

/* ============================================================ STREET — midtown on foot */
const WALKERS = (() => {
  const r = rng(404), out = [];
  for (let i = 0; i < 26; i++) {
    const front = r() < .35;
    out.push({ x0: -600 + r() * 9000, dir: r() < .5 ? 1 : -1, sp: .8 + r() * .5, st: CROWD_STYLES[i % CROWD_STYLES.length], front, umb: ['#2a3a6a', '#7a2a2a', '#2a2a2a', '#3a6a5a', '#c8a03a'][i % 5], seed: r() });
  }
  return out;
})();
function sStreet(u) {
  const s = 4.2, mx = 760, my = 935;
  const pace = 1 + .2 * S(u, 23, 2);
  const dist = u * 74 * s + .2 * 74 * s * Math.max(0, u - 24); // world px walked
  const off = 400 + dist, wet = S(u, 20.5, 3);
  rect(0, 0, W, H, '#000');
  streetSky(u, wet);
  g.drawImage(BG.far, 0, 0, FAR_TILE, 700, -((off * .12) % FAR_TILE), 140, FAR_TILE, 700);
  g.drawImage(BG.far, 0, 0, FAR_TILE, 700, FAR_TILE - ((off * .12) % FAR_TILE), 140, FAR_TILE, 700);
  drawTiled(BG.mid, off * .4, -40);
  // billboard on the mid layer
  const bbx = 2600 - off * .4;
  const bbEyes = S(u, 9.2, .8) * (1 - S(u, 14.5, .8));
  if (bbx > -700 && bbx < W) billboard(bbx, 120, 600, 330, u, bbEyes);
  fillAll('#8090b0', .12 + wet * .1, 'multiply');
  drawTiled(BG.near, off, 0);
  steamStack(1500 - (off % 2600) + 2600 * (off % 2600 > 1700 ? 1 : 0), 1000, u, 1);
  fillAll(mixHex('#ffe8c0', '#8a90a8', wet), .22, 'soft-light');
  // walkers behind (farther along the sidewalk)
  const walkerAt = (w, front) => {
    const ws = front ? 4.6 : 3.7, wy = front ? 1012 : 905;
    const wx = ((w.x0 + w.dir * w.sp * 74 * ws * u - off) % 9000 + 9000) % 9000 - 600;
    if (wx < -200 || wx > W + 200) return;
    const umb = wet > .5 && u > 23.5 + w.seed * 1.5 ? w.umb : null;
    person(wx, wy, ws, { ...w.st, walk: u * w.sp + w.seed, dir: w.dir, umbrella: umb });
  };
  WALKERS.filter(w => !w.front).forEach(w => walkerAt(w));
  // the woman in the red coat, walking the other way
  const rx = 1900 - (u - 14) * 300 - (u - 14) * 74 * s * 0 ;
  const redX = 2200 - (u - 13) * (74 * 3.9 * .95 + 74 * s);
  if (u > 12 && u < 22) {
    person(redX, 920, 3.9, { ...CROWD_STYLES[8], coat: '#b8282e', walk: u * .95, dir: -1, hairStyle: 'long', hair: '#2a1a14' });
    lantern(redX + 10, 920 - 3.9 * 118, .9, { t: u, lit: 1, eye: 1, look: u > 17.3 && u < 19.5 ? 1 : -1, tongue: 6 });
  }
  // the man
  const looksBB = u > 10 && u < 13.6, looksRed = u > 17.4 && u < 19.2;
  const turn = looksBB || looksRed;
  person(mx, my, s, capture({
    ...ManStyle, walk: u * pace, turn, tilt: looksBB ? -.35 : (looksRed ? .05 : 0), look: turn ? .3 : 0, lookY: looksBB ? -1 : 0,
    brow: u > 13.6 && u < 15.5 ? 1 : (u > 22 ? .5 : 0), eyeGlint: turn ? '#ff3a6a' : null, blink: u > 13.6 && u < 13.8 ? 1 : 0, mouth: u > 13.6 && u < 15 ? 'frown' : 'flat',
  }));
  const ex = eyeOf(mx, my, s, 1, turn), sh = rp(mx, my, s, 1, RIG.sh), nk = rp(mx, my, s, 1, RIG.neck);
  // will rides his shoulder, asleep until it is needed
  const yank = u > 13.2 && u < 14.2;
  tengu(sh[0] - 7 * s + (yank ? 14 : 0), sh[1] - 2, 1.5, { t: u, mood: u < 12.8 ? 'sleep' : 'stern', wings: yank ? 1 : .3, fan: yank ? -1.4 : -.4, dir: 1 });
  // the lust yokai, flying above him like a kite on a leash
  const grow = 1 + .3 * S(u, 9, 6);
  const kx = mx - 120 + Math.sin(u * .9) * 60 + (looksRed ? 180 : 0), ky = 380 + Math.sin(u * 1.3) * 30 + wet * 60;
  const tips = iroyoku(kx, ky, 1.6 * grow, { t: u, tails: 3 + S(u, 9, 6), look: looksBB ? [.8, -.6] : (looksRed ? [1, .5] : [.3, .8]), mouth: looksRed ? .5 : .1, heat: .5 + .3 * S(u, 9, 4), squash: u > 18.4 && u < 18.8 ? .25 : 0 });
  thread(tips[1][0], tips[1][1], nk[0], nk[1], u, { a: .8, sag: 120, w: 1.4 });
  if (looksBB) thread(bbx + 200, 300, ex[0], ex[1], u, { a: S(u, 10, .5), sag: 80 });
  if (looksRed) thread(tips[0][0], tips[0][1], redX + 10, 920 - 3.9 * 92, u, { a: S(u, 17.4, .5) * (1 - S(u, 18.4, .5)), sag: 120, seed: 7 });
  whisper(u, 16.4, kx + 80, ky - 40, 'みて');
  // walkers in front
  WALKERS.filter(w => w.front).forEach(w => walkerAt(w, true));
  // a kasa-obake hops through the crowd once the rain comes
  if (u > 24) kasa(lerp(W + 100, -200, (u - 24) / 8), 1040, 4, { t: u, color: '#c43a2e' });
  // cabs in the near lane
  for (let k = 0; k < 3; k++) {
    const cx = ((k * 1500 - u * 900) % 4500 + 4500) % 4500 - 600;
    cab(cx, 1150, 1.6, u);
  }
  rain(u, wet, .2);
  if (wet > 0) fillAll('#4a5068', wet * .25, 'multiply');
  caption(u, 2.6, 7.6, 'Lust is rarely one big choice. It is a thousand small tugs.');
  caption(u, 25.4, 30.6, 'And every tug it wins makes it a little larger.');
}
sfx('street', 9.3, 'shimmer', .5); sfx('street', 13.3, 'yank'); sfx('street', 16.4, 'whisper'); sfx('street', 18.5, 'hiss', .5);
sfx('street', 20.6, 'thunder'); sfx('street', 23.6, 'umbrella'); sfx('street', 24.4, 'umbrella', .7); sfx('street', 25.1, 'umbrella', .6);

/* ============================================================ OFFICE */
function sOffice(u) {
  const binge = S(u, 10, 2) * (1 - S(u, 20, .2));
  const lost = S(u, 20, .4);
  rect(0, 0, W, H, '#000');
  cam(960, 540, 1 + u * .003, () => {
    officeWindow(u, binge * .8);
    g.drawImage(BG.office, 0, 0);
    // clock: 10:05, racing to 12:24 while he scrolls
    const hrs = 10.08 + 2.32 * ease.in(clamp((u - 10) / 10));
    clockHands(u, hrs);
    // the chair
    rect(650, 560, 26, 300, '#2a2a30'); g.fillStyle = '#3a3a44'; rr(600, 520, 64, 250, 14); g.fill();
    const x = 760, y = 925, s = 5.4;
    const holding = u > 9.5 && u < 20.3;
    person(x, y, s, capture({
      ...ManStyle, sit: 1, seat: 25,
      armN: holding ? [11, 4] : (u > 20.3 ? [12, 8] : [17, 17]), armF: holding ? [10, 6] : [16, 17],
      prop: holding || (u > 20.3 && u < 24) ? 'phone' : null, screen: lost > .5 ? '#101014' : '#ffb8de', screenGlow: lost > .5 ? 'rgba(0,0,0,0)' : 'rgba(255,120,190,.5)',
      tilt: holding ? .38 : (u > 20.6 && u < 23.5 ? -.3 : .1), look: holding ? .6 : .2, lookY: holding ? 1 : (u > 20.6 && u < 23.5 ? -1 : .3),
      brow: u > 20.5 ? 1 : 0, mouth: u > 20.5 ? 'frown' : 'flat', lid: 0, eyeGlint: holding ? '#ff6a9a' : null,
    }));
    const sh = rp(x, y, s, 1, RIG.sh), hcp = rp(x, y, s, 1, RIG.hc);
    // the desk front hides his legs
    g.fillStyle = lin(0, 756, 0, 780, [[0, '#c8b898'], [1, '#b8a888']]); g.fillRect(300, 756, 1500, 24); rect(300, 780, 1500, 300, '#8a7a62'); rect(330, 800, 1440, 4, 'rgba(0,0,0,.25)');
    // the phone, before he picks it up, wakes into a tsukumogami
    if (!holding && u < 20) {
      const buzz = u > 3 && u < 4.4 ? Math.sin(u * 80) * 2 : 0;
      phoneMon(1100 + buzz, 742, 2.6, { t: u, awake: S(u, 3.2, 1), look: -1, wink: u > 7.2 && u < 7.6 });
    }
    // will gets crowded out and tumbles off
    const fall = ease.in(P(u, 13, 1.4));
    if (fall < 1) tengu(sh[0] - 7 * s - fall * 120, sh[1] - 2 + fall * 500, 1.8, { t: u, mood: u > 11 ? 'angry' : 'stern', wings: .4 + fall, rot: fall * 4, dir: 1, fan: -.4 });
    // the lantern gutters
    lantern(500, 300, 2.6, { t: u, lit: lerp(.7, .03, binge) + lost * .3, eye: lerp(1, .15, binge), tongue: 6, cord: 100 });
    // the lust yokai: whispering to the phone, then swelling to fill the room
    const grown = S(u, 10.5, 8);
    const sated = S(u, 20.5, 1.5);
    let ix = lerp(1250, 1080, S(u, 4.5, 2)), iy = lerp(160, 560, S(u, 4.5, 2));
    ix = lerp(ix, 1080, grown); iy = lerp(iy, 300, grown);
    ix = lerp(ix, hcp[0] - 10, sated); iy = lerp(iy, hcp[1] - 75, sated);
    const sz = lerp(lerp(1.4, 3.6, grown), 1.25, sated) + S(u, 23, 4) * .35;
    iroyoku(ix, iy, sz, { t: u, tails: lerp(lerp(3, 7, grown), 2.5, sated), look: [-.7, .6], mouth: (u > 5.6 && u < 9) ? .5 + .3 * Math.sin(u * 9) : .1, heat: lerp(.5, 1, grown), eyesOpen: sated > .5 ? .35 : 1 });
    whisper(u, 5.6, ix - 140, iy - 10, 'ねえ', { dx: -40 }); whisper(u, 7.4, ix - 160, iy + 10, 'ほら', { dx: -40 });
    // shame drifts in through the window and wraps him
    const sw = ease.inout(P(u, 21.4, 2.8));
    if (sw > 0) ittan(shameSpine(sh, s, u, sw, k => [1500 - k * 70 + (1 - sw) * 400, 160 + k * 10 + Math.sin(u * 3 + k) * 20]), 1.4, { a: 1 });
  });
  fillAll('#3a0a20', binge * .35, 'multiply');
  fillAll('#ff3a6a', binge * .12, 'soft-light');
  fillAll('#606878', lost * .25 * (1 - S(u, 28, 2)), 'multiply');
  card(u, 4.4, 10.2, { kanji: '付喪神', romaji: 'tsukumogami', role: 'Tsukumogami — the screen. An object that learned to want.', x: 1730, y: 70 });
  card(u, 22.2, 28.4, { kanji: '一反木綿', romaji: 'ittan-momen', role: 'Ittan-momen — shame. It always arrives after.', x: 1730, y: 70 });
  caption(u, 23.6, 29.2, 'Shame does not starve it. Shame feeds it.');
}
sfx('office', 3.1, 'buzz'); sfx('office', 5.6, 'whisper'); sfx('office', 7.3, 'giggle'); sfx('office', 13.1, 'tumble', .7);
sfx('office', 20, 'powerdown'); sfx('office', 21.6, 'cloth');

/* ============================================================ PARK */
function sPark(u) {
  const dusk = 1.2 * S(u, 33.5, 9) + .8 * S(u, 42, 6);
  const parkWide = (extra) => {
    rect(0, 0, W, H, '#000');
    park(u, dusk);
    extra && extra();
    parkGrade(u, dusk);
  };
  const kodamaSpots = [[420, 260, 2.6], [560, 330, 2.2], [300, 380, 2.4], [1760, 250, 2.4], [1860, 330, 2.2], [1090, 812, 3.4], [640, 820, 3], [1180, 830, 2.6], [980, 748, 2.8]];
  const drawKodama = (a) => kodamaSpots.forEach(([kx, ky, ks], i) => kodama(kx, ky, ks, { t: u, seed: i, a: a * S(u, 7 + i * .5, 1.5) }));
  if (u < 8.3 || u >= 33) {
    parkWide(() => {
      const sitting = u > 7.3;
      const walkF = clamp(u / 7.3);
      const x = sitting ? 800 : lerp(-80, 780, walkF), y = sitting ? 840 : 870;
      drawKodama(u < 33 ? .6 : 1);
      bench(800, 840, 3.6);
      person(x, y, 3.6, capture({ ...ManStyle, walk: sitting ? undefined : u * .47, sit: sitting ? 1 : 0, seat: 25, armN: sitting ? [12, 15] : undefined, armF: sitting ? [11, 16] : undefined, brow: u < 33 ? 1 : 0, mouth: u > 33 ? 'smile' : 'flat', tilt: u < 8.3 ? .25 : -.05, lookY: u < 8.3 ? .8 : -.3 }));
      const sh = rp(x, y, 3.6, 1, RIG.sh);
      if (u < 8.3) {
        ittan(shameSpine(sh, 3.6, u), 1);
        iroyoku(x + 160 + Math.cos(u * 1.4) * 90, 520 + Math.sin(u * 1.4) * 40, 1.2, { t: u, tails: 3, look: [-.8, .5], heat: .6 });
      } else {
        // after: peaceful; the yokai glimmers again in the dusk sky
        lantern(sh[0] - 40, sh[1] - 230, 1.8, { t: u, lit: .9 - S(u, 42, 4) * .4, eye: 1 - S(u, 44, 2) * .7, tongue: 4, mouth: .2 });
        tengu(sh[0] - 7 * 3.6, sh[1] - 2, 1.2, { t: u, mood: 'sleep', wings: .2 });
        const back = S(u, 43, 3);
        if (back > 0) iroyoku(1500, 170, .8, { t: u, tails: 2, a: back * .9, eyesOpen: S(u, 45.5, 1), look: [-.6, .6], heat: .8 });
      }
    });
    caption(u, 35.8, 41, 'But hunger does not end.');
    caption(u, 42.2, 47.2, 'It waits for dark.');
  } else if (u < 21) {
    // closer: he sits; the kodama gather; he breathes
    const v = u - 8.3;
    cam(820, 640, 1.9, () => parkWide(() => {
      drawKodama(1);
      const x = 800, y = 840, s = 3.6;
      const closed = v > 2.8;
      bench(x, y, s);
      person(x, y, s, capture({ ...ManStyle, sit: 1, seat: 25, armN: [12, 15], armF: [11, 16], blink: closed ? 1 : 0, brow: lerp(1, 0, S(v, 4, 4)), tilt: lerp(.25, 0, S(v, 3, 3)), lookY: .4 }));
      const sh = rp(x, y, s, 1, RIG.sh), hip = rp(x, y, s, 1, RIG.hip);
      // breath: in for four, out for five
      if (closed) {
        const ph = ((v - 3.2) % 9 + 9) % 9, b = ph < 4 ? ease.sine(ph / 4) : 1 - ease.sine((ph - 4) / 5);
        const ba = S(v, 3.2, 1.5) * (1 - S(v, 12.2, .6));
        g.save(); g.globalCompositeOperation = 'lighter';
        g.lineWidth = 3; g.strokeStyle = `rgba(255,220,150,${.5 * ba})`;
        g.beginPath(); g.arc(sh[0] + 8, sh[1] + 40, 30 + b * 60, 0, TAU); g.stroke();
        g.restore();
        glow(sh[0] + 8, sh[1] + 40, 60 + b * 70, 'rgba(255,220,150,.6)', ba * .5);
      }
      // shame loosens and blows away
      const go = ease.in(P(v, 5.6, 4));
      ittan(shameSpine(sh, s, u).map(([px, py], k) => [px + go * (700 + k * 26), py - go * (260 + Math.sin(k + u) * 40)]), 1, { a: 1 - S(v, 8, 1.5) });
      // the lantern brightens as he attends
      lantern(sh[0] - 50, sh[1] - 200, 1.8, { t: u, lit: lerp(.15, 1, S(v, 3.5, 5)), eye: lerp(.4, 1, S(v, 3, 2)), tongue: 5, mouth: .3 });
      // the lust yokai circles closer
      const close = S(v, 6, 6);
      const ix = lerp(1120, 960, close) + Math.cos(u * 1.2) * 40 * (1 - close), iy = lerp(480, 560, close) + Math.sin(u * 1.2) * 30;
      iroyoku(ix, iy, 1.1, { t: u, tails: 3, look: [-1, .4], mouth: (v > 8.7 && v < 9.9) || (v > 11.2 && v < 12.4) ? .6 : .1, heat: .7 });
      whisper(v, 8.7, ix + 30, iy - 40, 'ねえ', { size: 24 }); whisper(v, 11.2, ix + 30, iy - 40, 'こっち', { size: 24 });
    }));
    card(u, 9.2, 15.2, { kanji: '木霊', romaji: 'kodama', role: 'Kodama — stillness. They only appear when you are quiet.', x: 1730, y: 110 });
    caption(u, 12.6, 17.6, 'He stops. He breathes. He listens.');
  } else if (u < 25) {
    // he opens his eyes and looks straight at it
    const v = u - 21;
    soft(() => cam(820, 560, 2.4, () => { park(u, dusk); parkGrade(u, dusk); }), 7);
    glow(1500, 400, 700, 'rgba(255,220,150,.6)', .5);
    face(900, 600, 25, { lookX: lerp(.1, .75, S(v, .9, .6)), lookY: .1, lid: lerp(1, 0, S(v, .3, .7)), brow: 0, mouth: 'flat', light: { color: 'rgba(255,200,120,1)', a: .7, from: 'top' } });
  } else {
    // reverse: seen, it shrinks; the mask slips
    const v = u - 25;
    soft(() => cam(1100, 500, 2.4, () => { park(u, dusk); parkGrade(u, dusk); }), 7);
    fillAll('#203020', .2, 'multiply');
    const shrink = ease.inout(P(v, .8, 2.4));
    const dart = ease.in(P(v, 6.1, 1.6));
    const un = S(v, 2.6, .9) * (1 - S(v, 5.4, .3));
    const ix = 960 + dart * 1300, iy = 540 - dart * 500;
    const sz = lerp(6, 3.1, shrink);
    // the fox kit beneath the mask
    if (un > 0) foxKit(ix, iy + 70 * sz / 3.1, 6.5 * sz / 3.1, { t: u, a: un, tilt: -.1 });
    iroyoku(ix, iy, sz, { t: u, tails: lerp(3, 1.5, shrink), look: [0, 0], eyesOpen: 1 + S(v, 0, .4) * .2, mouth: 0, heat: lerp(.8, .3, shrink), unmask: un, squash: v < .5 ? -.08 * Math.sin(v * 20) : 0, tailA: 1 - un * .6 });
    caption(u, 26, 31.6, 'Looked at directly, it was smaller than it seemed.');
  }
}
sfx('park', 10, 'clack', .6); sfx('park', 13.4, 'clack', .5); sfx('park', 17, 'whisper', .7); sfx('park', 19.5, 'whisper', .6);
sfx('park', 21.4, 'breathout', .7); sfx('park', 25.2, 'gasp'); sfx('park', 27.6, 'slip'); sfx('park', 30.4, 'snap'); sfx('park', 31.1, 'whoosh');

/* ============================================================ NIGHT — Times Square */
const CROSSERS = (() => {
  const r = rng(512), out = [];
  for (let i = 0; i < 20; i++) out.push({ y: 600 + Math.pow(r(), .7) * 330, dir: r() < .5 ? 1 : -1, sp: .8 + r() * .5, x0: r() * 2600, st: CROWD_STYLES[i % 10], seed: r() });
  return out.sort((a, b) => a.y - b.y);
})();
function tsquare(u, possessed, o = {}) {
  g.drawImage(BG.ts, 0, 0);
  boards(u, possessed);
  wetStreet(u, possessed);
  if (o.giant) o.giant();
  // cabs crossing far up the avenue
  for (let k = 0; k < 4; k++) {
    const cx = ((k * 700 + u * (k % 2 ? 260 : -260)) % 2800 + 2800) % 2800 - 400;
    cab(cx, 590 + (k % 2) * 30, .55 + (k % 2) * .1, u);
  }
  if (o.parade) o.parade();
  // crowd crossing
  for (const c of CROSSERS) {
    const k = (c.y - 470) / 610, ws = 1.2 + k * 4;
    const x = ((c.x0 + c.dir * c.sp * 74 * ws * u * (o.slow ?? 1)) % 2600 + 2600) % 2600 - 340;
    person(x, c.y, ws, { ...c.st, walk: u * c.sp * (o.slow ?? 1) + c.seed, dir: c.dir });
    if (o.threads > 0 && c.seed < .55) {
      const [hx, hy] = [x + c.dir * 4 * ws, c.y - 92 * ws];
      thread(o.tipFor(c.seed)[0], o.tipFor(c.seed)[1], hx, hy, u, { a: o.threads * .7, sag: 80, seed: c.seed * 10, w: 1.2, gold: o.gold || 0, upto: o.upto ?? 1 });
    }
  }
  fillAll('#3a1a5a', .18, 'soft-light');
}
function sNight(u) {
  const possessed = clamp(Math.floor(S(u, 15.5, 4) * 6) / 6 + (u > 19.5 ? 1 : 0)) * (1 - S(u, 47, 4));
  const rise = ease.out(P(u, 20, 6));
  const collapse = ease.in(P(u, 48.5, 2.6));
  const giant = { x: 960, y: lerp(980, 300, rise) + collapse * 520, s: lerp(9, .5, collapse) };
  const shake = u > 22 && u < 32 ? (Math.sin(u * 37) + Math.sin(u * 23)) * 6 * S(u, 22, 3) : 0;
  const goldT = S(u, 42.4, 1.6), burn = S(u, 42.4, .6) * (1 - S(u, 45.6, .6)), upto = 1 - S(u, 44, 2);
  const drawGiant = (scale = 1) => {
    if (rise <= 0 || giant.s <= .55) return [];
    return iroyoku(giant.x, giant.y, giant.s * scale, { t: u, tails: lerp(1, 9, ease.out(P(u, 21, 5))) * (1 - collapse), tailLen: 1.5, look: [0, .9], mouth: (u > 25 && u < 27) || (u > 29 && u < 31) ? .7 : .15, heat: 1, crack: S(u, 46, 2.4), unmask: S(u, 48.4, 1.2), a: 1 - S(u, 50.8, .4) });
  };
  if (u < 32 || (u >= 37 && u < 41) || (u >= 46 && u < 52)) {
    const z = 1 + Math.min(u, 30) * .003;
    cam(960 + shake, 540 + shake * .5, z, () => {
      rect(0, 0, W, H, '#000');
      let tips = [];
      const tipFor = seed => tips.length ? tips[Math.floor(seed * 97) % tips.length] : [960, 300];
      tsquare(u, possessed, {
        giant: () => { tips = drawGiant(); },
        threads: rise > 0 && giant.s > .55 ? S(u, 24, 2) * (1 - collapse) : 0, tipFor, gold: goldT, upto,
        slow: 1 - S(u, 35, 2) * .8,
        parade: () => {
          if (u < 9 || u > 30) return;
          const marchers = [lantern, oni, kappa, nopperabo, tanuki, hitotsume, kasa, nekomata, nurikabe, rokurokubi, lantern, oni, kappa];
          const road = 400;
          g.save(); g.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 14; k++) { const mx = ((k * 170 + u * 40) % 2400) - 200; glow(mx, road + Math.sin(k + u) * 8, 160, 'rgba(255,150,120,.35)', .6); }
          g.restore();
          marchers.forEach((f, i) => {
            const px = -260 - i * 190 + (u - 9) * 210, py = road + Math.sin(u * 2 + i) * 6;
            if (px < -200 || px > W + 200) return;
            if (f === lantern) lantern(px, py - 130, 2.6, { t: u + i, lit: 1, eye: 1, tongue: 8 });
            else if (f === kasa) kasa(px, py, 3.2, { t: u, seed: i });
            else f(px, py, 3.9, u + i);
            glow(px, py - 60, 90, 'rgba(255,140,80,.4)', .5);
          });
          for (let i = 0; i < 16; i++) { const fx = -200 - i * 160 + (u - 9) * 230, fy = 250 + Math.sin(u * 1.5 + i) * 50; if (fx > -100 && fx < W + 100) flame(fx, fy, .45, u + i, .8); }
        },
      });
      // the man, from behind
      const pull = S(u, 26, 3) * (1 - S(u, 37, 1));
      const mx = 960, my = 1080 - pull * 30;
      // his allies gather behind him
      const ally = S(u, 37.4, 2);
      if (ally > 0) {
        lantern(mx - 260, lerp(200, 560, ally), lerp(2, 5.5, ally), { t: u, lit: 1 + ally, eye: 1, tongue: 14, mouth: .4 });
        for (let k = 0; k < 6; k++) kodama(mx - 300 + k * 120 + (k > 2 ? 120 : 0), 1070, 5, { t: u, seed: k, a: S(u, 38 + k * .2, .8) });
        baku(mx + 330, 1080, 6, { t: u, dir: -1, a: S(u, 38.6, 1) });
      }
      const gl = S(u, 37.4, 2) * (1 - S(u, 52, 1));
      personBack(mx, my, 5.6, { armsOut: pull * .35, rim: { color: gl > 0 ? 'rgba(255,210,120,1)' : 'rgba(255,60,110,1)', a: gl > 0 ? .5 * gl : .35 * rise } });
      if (ally > 0) tengu(mx + 60, my - 5.6 * 78, 1.8, { t: u, mood: 'stern', wings: 1, fan: -1.2, a: ally });
      // threads to the man himself
      if (tips.length) for (let k = 0; k < 3; k++) {
        const tip = tips[(k * 3 + 1) % tips.length];
        const tgt = [[mx, my - 5.6 * 92], [mx - 5.6 * 13, my - 5.6 * 50], [mx + 5.6 * 13, my - 5.6 * 50]][k];
        thread(tip[0], tip[1], tgt[0], tgt[1], u, { a: S(u, 25, 1.5) * (1 - collapse), sag: 60, w: 2.6, gold: goldT, burn, upto, seed: k * 4 });
      }
      // the giant collapses to a single falling ember
      if (collapse > 0 && u < 52) {
        const ey = lerp(450, 820, ease.inout(P(u, 50, 2)));
        flame(960, ey, lerp(1.6, .9, collapse), u, S(u, 49.8, .6));
      }
      if (gl > 0) glow(mx, 500, 900, 'rgba(255,200,110,.7)', gl * .45);
    });
    if (collapse > 0) fillAll('rgba(255,230,180,1)', Math.max(0, Math.sin(clamp((u - 48.2) / 1.2) * Math.PI)) * .4, 'lighter');
    card(u, 10, 16.4, { kanji: '百鬼夜行', romaji: 'hyakki yagyō', role: 'Hyakki yagyō — the night parade of a hundred demons', x: 1730, y: 70, seal: '鬼' });
    caption(u, 2, 7.2, 'At night, every hunger in the city comes out to walk.');
  } else if (u < 37) {
    // close on his face, red light, then he closes his eyes
    const v = u - 32;
    soft(() => cam(960, 300, 1.5, () => { g.drawImage(BG.ts, 0, 0); boards(u, possessed); drawGiant(); }), 7);
    fillAll('#4a0a1a', .35, 'multiply');
    const calm = S(v, 3.2, 1.5);
    face(960, 640, 26, { lookX: 0, lookY: lerp(-1, 0, calm), lid: lerp(0, 1, S(v, 2.3, .9)), brow: lerp(1, 0, calm), mouth: v < 2.3 ? 'o' : 'flat', glint: v < 2.3 ? '#ff3a6a' : null, light: { color: calm > .3 ? 'rgba(255,200,120,1)' : 'rgba(255,40,90,1)', a: .9, from: calm > .3 ? 'bottom' : 'top' } });
    if (calm > 0) glow(700, 1080, 700, 'rgba(255,200,110,.7)', calm * .6);
  } else if (u < 46) {
    // side on: he bows; the red threads turn gold and burn away
    const v = u - 41;
    rect(0, 0, W, H, '#000');
    soft(() => cam(1100, 380, 1.4, () => { g.drawImage(BG.ts, 0, 0); boards(u, possessed); }), 5);
    fillAll('#1a0a2a', .3, 'multiply');
    const bow = S(v, .4, 1.6) * (1 - S(v, 4.2, 1));
    const tips = iroyoku(1460, 470, 5.2, { t: u, tails: 9, tailLen: .8, look: [-.8, .5], heat: 1, mouth: .1, eyesOpen: 1 + S(v, 2, 1) * .3 });
    lantern(330, 360, 4, { t: u, lit: 2, eye: 1, tongue: 12, mouth: .4 });
    glow(330, 360, 800, 'rgba(255,200,110,.7)', .45);
    const x = 640, y = 1060, s = 6;
    person(x, y, s, capture({ ...ManStyle, lean: bow * .8, armN: [3, 16], armF: [2, 16], blink: bow > .5 ? 1 : 0, brow: 0, look: .2 }));
    const hc = rp(x, y, s, 1, RIG.hc), sh = rp(x, y, s, 1, RIG.sh);
    tengu(sh[0] - 7 * s, sh[1] - 2, 2.1, { t: u, mood: 'stern', wings: .6, crossed: true });
    tips.slice(0, 6).forEach((tip, k) => thread(tip[0], tip[1], hc[0] + (k % 3 - 1) * 30, hc[1] + 20 + k * 25, u, { a: 1, sag: 40, w: 2.4, gold: goldT, burn, upto, seed: k * 3 }));
    caption(u, 41.3, 45.6, 'He does not fight it. He does not obey it.');
  } else {
    // in his hands: the ember becomes a fox kit, then a lantern flame
    const v = u - 52;
    rect(0, 0, W, H, '#000');
    soft(() => { g.drawImage(BG.ts, 0, 0); boards(u, 0); }, 8);
    fillAll('#2a1a30', .45, 'multiply');
    glow(960, 900, 700, 'rgba(255,180,90,.7)', .5);
    face(960, 330, 18, { lookX: 0, lookY: .9, lid: .2, brow: -.1, mouth: v > 1.6 ? 'smile' : 'flat', light: { color: 'rgba(255,190,110,1)', a: .9, from: 'bottom' } });
    const hop = ease.inout(P(v, 4.4, 1.4));
    const lantY = lerp(-200, 330, ease.out(P(v, 2.6, 1.8)));
    lantern(1420, lantY, 6, { t: u, lit: 1.2 + hop, eye: 1, tongue: 10, mouth: .3, kit: hop >= 1 });
    cupHands(960, 930, 9);
    if (hop < 1) {
      const kx = lerp(960, 1420, hop), ky = lerp(900, lantY + 60, hop) - Math.sin(hop * Math.PI) * 260;
      const shiver = v < 2 ? Math.sin(v * 50) * 2 : 0;
      foxKit(kx + shiver, ky, lerp(6.5, 3, hop), { t: u, tilt: -.2, glow: 1 });
      if (v < .6) flame(960, 860, 1, u, 1 - S(v, 0, .6));
    }
    caption(u, 52.6, 56.4, 'It was never a demon to be slain.');
    caption(u, 56.7, 60.4, 'Only a fire that had forgotten its hearth.');
  }
}
sfx('night', 9, 'parade'); sfx('night', 16, 'glitch', .6); sfx('night', 17.5, 'glitch', .6); sfx('night', 19.4, 'glitch', .8);
sfx('night', 20, 'rise'); sfx('night', 25, 'whisper', 1.2); sfx('night', 29, 'whisper', 1.2);
sfx('night', 34.4, 'heartbeat', 1.2); sfx('night', 37.4, 'bloom'); sfx('night', 42.4, 'shimmer', 1);
sfx('night', 46.2, 'crack'); sfx('night', 47.6, 'crack', .8); sfx('night', 48.5, 'collapse'); sfx('night', 54.4, 'hop'); sfx('night', 55.8, 'chimelow');

/* ============================================================ HOME */
function sHome(u) {
  const shrinkTo = ease.inout(P(u, 13, 4));
  const rollP = ease.inout(P(u, 17.6, 3.2));
  const endA = S(u, 21, 1.4);
  rect(0, 0, W, H, '#0a0710');
  const paint = () => {
    windowSky(u, 'night');
    g.drawImage(BG.aptNight, 0, 0);
    sleeper(u, 300, 640, 5.2, { lid: 1, mouth: 'smile', light: { color: 'rgba(160,180,255,1)', a: .4 } });
    blanket(u, true);
    tr(56, 646, 1, 0, () => rect(-26, -8, 52, 9, '#1a1a22'));
    tengu(150, 646, 2, { t: u, mood: 'sleep', wings: .1 });
    // the lantern, now with a hearth-fire in it
    lantern(820, 150, 3.2, { t: u, lit: .9, eye: 0, tongue: 4, mouth: .1, cord: 30, kit: true });
    glow(820, 300, 500, 'rgba(255,170,90,.6)', .35);
    const bx = lerp(1300, 760, ease.out(P(u, 1.5, 4)));
    baku(bx, 900, 5, { t: u, dir: -1, walk: u < 5.5 ? u * 1.2 : undefined });
    if (u > 5.5 && u < 9.5) dream(lerp(330, bx - 140, ease.inout((u - 5.5) / 3)), lerp(600, 760, (u - 5.5) / 3) - Math.sin((u - 5.5) / 3 * Math.PI) * 100, 20, u, 4, 1 - S(u, 8.6, .8));
    fillAll('#101830', .2, 'multiply');
  };
  if (shrinkTo <= 0) { paint(); }
  else {
    // the picture shrinks into a painting on the scroll
    const k = lerp(1, .62, shrinkTo);
    const pw = W * k, ph = H * k, px = (W - pw) / 2, py = (H - ph) / 2;
    g.save(); g.beginPath(); g.rect(lerp(0, 90, shrinkTo), lerp(0, 100, shrinkTo), lerp(W, W - 180, shrinkTo), lerp(H, 880, shrinkTo)); g.clip();
    g.drawImage(TEX.washi, 0, 0);
    g.restore();
    const lft = lerp(90, W - 90, rollP);
    g.save(); g.beginPath(); g.rect(Math.max(lft, lerp(0, 90, shrinkTo)), 0, W, H); g.clip();
    g.save(); g.beginPath(); g.rect(lerp(0, 90, shrinkTo), lerp(0, 100, shrinkTo), lerp(W, W - 180, shrinkTo), lerp(H, 880, shrinkTo)); g.clip();
    g.drawImage(TEX.washi, 0, 0);
    tr(px, py, k, 0, () => { g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); paint(); g.restore(); });
    g.lineWidth = 3; g.strokeStyle = 'rgba(60,40,20,.5)'; g.strokeRect(px, py, pw, ph);
    seal(px + pw + 40, py + ph - 30, 1.1, '心', shrinkTo);
    g.restore();
    g.restore();
    if (shrinkTo > .6) for (const [rx, roll] of [[lft, 1], [W - 90, 0]]) {
      withA(S(shrinkTo, .6, .4), () => {
        g.fillStyle = lin(rx - 22, 0, rx + 22, 0, [[0, '#3a2414'], [.4, '#8a5a34'], [1, '#2a180c']]); g.fillRect(rx - 20, 86, 40, 908);
        if (roll) { g.fillStyle = lin(rx - 26 - rollP * 20, 0, rx + 26 + rollP * 20, 0, [[0, '#c8b490'], [.5, '#efe3c8'], [1, '#a89470']]); g.fillRect(rx - 26 - rollP * 20, 100, 52 + rollP * 40, 880); }
        for (const ey of [74, 994]) { g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(rx, ey, 26 + rollP * 20, 12, 0, 0, TAU); g.fill(); }
      });
    }
  }
  // end card
  if (endA > 0) {
    fillAll('#0a0710', endA);
    const ea = endA * (1 - S(u, 26.4, 1.5));
    withA(ea, () => {
      g.save(); g.beginPath(); g.rect(760, 160, 400, 700); g.clip(); g.drawImage(TEX.washi, 600, 200, 400, 700, 760, 160, 400, 700); g.restore();
      rect(744, 148, 432, 14, '#5a3a22'); rect(744, 858, 432, 14, '#5a3a22');
      VT('終', 960, 250, { size: 220, color: C.ink });
      seal(1060, 760, 1.3, '妖');
      T('IROYOKU', 967, 640, { size: 40, weight: 600, color: '#2a1e1a', ls: 14 });
      T('a picture scroll by Claude', 960, 700, { size: 28, italic: true, color: '#4a3424' });
    });
  }
  caption(u, 1.5, 6.6, 'Tomorrow it will wake hungry again.');
  caption(u, 7, 12.4, 'And so will he — a little more awake.');
}
sfx('home', 13.2, 'whoosh', .4); sfx('home', 17.8, 'unroll'); sfx('home', 21.2, 'bell', .9);

/* ============================================================ frame */
const DRAW = { title: sTitle, dawn: sDawn, subway: sSubway, street: sStreet, office: sOffice, park: sPark, night: sNight, home: sHome };
window.init = async function () {
  await document.fonts.load('800 40px "Shippori Mincho"', '色欲');
  await document.fonts.load('500 40px "Cormorant Garamond"');
  await document.fonts.load('italic 500 40px "Cormorant Garamond"');
  await document.fonts.ready;
  buildTextures();
  LAYER = mk(); SMALL = mk(Math.ceil(W / 4), Math.ceil(H / 4));
  BG.apt = buildApartment(false); BG.aptNight = buildApartment(true);
  BG.subway = buildSubway();
  buildStreet();
  BG.office = buildOffice();
  buildPark();
  BG.ts = buildTimesSquare();
  return { total: TOTAL };
};
function drawScene(sc, t) { g.save(); DRAW[sc.id](t - sc.a); g.restore(); }
window.render = function (t) {
  g = main; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const i = Math.max(0, SCENES.findIndex(s => t >= s.a && t < s.b));
  const sc = SCENES[i];
  drawScene(sc, t);
  // dissolve into the next scene across each boundary
  const nx = SCENES[i + 1], pv = SCENES[i - 1];
  let other = null, p = 0;
  if (nx && t > sc.b - XF / 2) { other = nx; p = (t - (sc.b - XF / 2)) / XF; }
  else if (pv && t < sc.a + XF / 2) { other = pv; p = 1 - (t - (sc.a - XF / 2)) / XF; }
  if (other) {
    const lc = LAYER.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalAlpha = 1; lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, W, H);
    into(LAYER, () => drawScene(other, t));
    g.save(); g.globalAlpha = other === nx ? ease.sine(p) : 1 - ease.sine(1 - p); g.drawImage(LAYER, 0, 0); g.restore();
  }
  finish(t);
  if (t < .8) fillAll('#000', 1 - t / .8);
  if (t > TOTAL - .8) fillAll('#000', (t - (TOTAL - .8)) / .8);
};
