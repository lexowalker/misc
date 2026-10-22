// 2D drawing kit: the seeker rig, birds, trees, rocks, cities, doors. Everything is drawn as silhouette masks.
'use strict';
const K = (() => {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
  const easeIn = x => Math.pow(clamp(x), 3);
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const vnoise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
  const fbm = x => vnoise(x) * .5 + vnoise(x * 2.1 + 7) * .25 + vnoise(x * 4.3 + 13) * .125 + vnoise(x * 8.9 + 3) * .0625;

  function limb(g, ax, ay, bx, by, w0, w1) {
    // tapered capsule from a (width w0) to b (width w1)
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-3, nx = -dy / L, ny = dx / L;
    g.beginPath();
    g.moveTo(ax + nx * w0 / 2, ay + ny * w0 / 2);
    g.lineTo(bx + nx * w1 / 2, by + ny * w1 / 2);
    g.arc(bx, by, w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, false);
    g.lineTo(ax - nx * w0 / 2, ay - ny * w0 / 2);
    g.arc(ax, ay, w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, false);
    g.fill();
  }
  // closed/open path through points, smoothed with quadratic curves through midpoints
  function smoothPath(g, pts, closed) {
    const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    g.beginPath();
    if (closed) {
      const m0 = mid(pts[n - 1], pts[0]);
      g.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) { const m = mid(pts[i], pts[(i + 1) % n]); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
      g.closePath();
    } else {
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) { const m = mid(pts[i], pts[i + 1]); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
      g.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }
  function ik(hx, hy, fx, fy, L1, L2, dir) {
    let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
    d = Math.min(d, (L1 + L2) * .999);
    const a = Math.atan2(dy, dx);
    const b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const k = a - b * dir;
    return [hx + Math.cos(k) * L1, hy + Math.sin(k) * L1];
  }

  // ---------------- The seeker ----------------
  // o: {x,y (feet on ground), h (standing height px), age 0 child..1 man..2 old, face 1|-1 (side) or 0 (back),
  //     phase (walk, radians), walk 0..1 (stride amount), arms 'swing'|'open'|'up'|'reach'|'down'|'shield'|'cup',
  //     armK (0..1 blend toward arms pose), staff bool, pose 'stand'|'sit'|'kneel'|'lie'|'cross', wind, look (head tilt up)}
  // returns anchor points {chest:[x,y], head:[x,y], hand:[x,y]}
  function seeker(g, o) {
    const age = o.age ?? 1;
    const heads = age < 1 ? lerp(5.0, 7.3, age) : lerp(7.3, 7.0, age - 1);
    const H = o.h, hu = H / heads, f = o.face ?? 1;
    const old = Math.max(0, age - 1), child = Math.max(0, 1 - age);
    const walk = o.walk ?? 0, ph = o.phase ?? 0;
    const wind = o.wind ?? 0;
    const legLen = hu * lerp(3.55, 2.35, child);
    const torso = hu * lerp(2.55, 1.85, child);
    const stoop = (o.stoop ?? old * .22) + (o.lean ?? 0);
    const look = o.look ?? 0;
    g.save();
    g.translate(o.x, o.y);
    if (o.rot) g.rotate(o.rot);
    const out = {};
    if (f === 0) { drawBack(g, o, hu, legLen, torso, child, old, out); g.restore(); return out; }
    g.scale(f, 1);
    const pose = o.pose || 'stand';
    let hip, feet, knees;
    const L1 = legLen * .52, L2 = legLen * .5;
    const bob = walk * hu * .07 * Math.cos(2 * ph);
    if (pose === 'sit' || pose === 'cross') {
      const seat = o.seat ?? legLen * .5; // height of the seat above ground
      hip = [0, -seat];
      if (pose === 'cross') {
        hip = [0, -hu * .35];
        knees = [[hu * 1.25, -hu * .45], [hu * 1.05, -hu * .3]];
        feet = [[hu * .35, -hu * .12], [hu * .55, -hu * .08]];
      } else {
        knees = [[L1 * .97, -seat - hu * .12], [L1 * .9, -seat - hu * .05]];
        feet = [[L1 * .97 + hu * .15, 0], [L1 * .85 + hu * .3, 0]];
      }
    } else if (pose === 'kneel') {
      hip = [0, -legLen * .55];
      knees = [[hu * .9, -legLen * .52], [-hu * .1, 0]];
      feet = [[hu * .95, 0], [-hu * 1.1, -hu * .05]];
    } else {
      hip = [0, -legLen * .985 + bob];
      feet = []; knees = [];
      const stride = hu * lerp(1.0, .7, child) * walk * (1 - old * .35);
      for (let i = 0; i < 2; i++) {
        const u = ((ph / (2 * Math.PI) + i * .5) % 1 + 1) % 1;
        let fx, fy;
        if (u < .58) { fx = stride * (.5 - u / .58); fy = 0; }
        else { const v = (u - .58) / .42; fx = stride * (-.5 + smooth(v)); fy = -hu * .28 * Math.sin(Math.PI * v) * walk; }
        const spread = (i ? -1 : 1) * hu * .08 * (1 - walk);
        feet.push([fx + spread + (o.stance ?? 0) * (i ? -1 : 1), fy]);
        knees.push(ik(hip[0], hip[1], fx + spread + (o.stance ?? 0) * (i ? -1 : 1), fy - hu * .05, L1, L2, -1));
      }
    }
    // spine
    const lean = stoop + walk * .05;
    const sh = [hip[0] + Math.sin(lean) * torso, hip[1] - Math.cos(lean) * torso];
    const neck = [sh[0] + Math.sin(lean * 1.6 + look * -.4) * hu * .35, sh[1] - Math.cos(lean * 1.6) * hu * .35];
    const headC = [neck[0] + Math.sin(lean * 1.4 - look * .3) * hu * .45 + hu * .06, neck[1] - hu * .5 + Math.abs(look) * hu * .05];
    const legW = hu * lerp(.52, .5, child), shinW = hu * .36;
    // far leg first (slightly behind)
    for (const i of [1, 0]) {
      if (!feet[i]) continue;
      limb(g, hip[0], hip[1], knees[i][0], knees[i][1], legW, shinW);
      limb(g, knees[i][0], knees[i][1], feet[i][0], feet[i][1] - hu * .08, shinW, hu * .24);
      // foot
      g.beginPath();
      g.ellipse(feet[i][0] + hu * .16, feet[i][1] - hu * .07, hu * .3, hu * .1, 0, 0, Math.PI * 2);
      g.fill();
    }
    // torso + coat (adult) / tunic (child), drawn in a frame leaning about the hip
    const coatLen = (o.noCoat ? legLen * .12 : lerp(legLen * .64, legLen * .34, child)) / hu;
    const sway = Math.sin(ph) * walk * .25 + wind * .7;
    const kx = feet.length ? (knees[0][0] + knees[1][0]) / 2 / hu : 0;
    const TL = torso / hu, cw = lerp(1, .82, child);
    g.save();
    g.translate(hip[0], hip[1]);
    g.rotate(lean);
    g.scale(hu, hu);
    smoothPath(g, [
      [.16 * cw, -TL - .25], [.3 * cw, -TL + .12], [.56 * cw, -TL + .75], [.5 * cw, -TL + 1.55], [.5 * cw, -.05],
      [(.72 + kx * .45) * cw + sway * .55 + wind * .2, coatLen * .55], [(.8 + kx * .5) * cw + sway * .7 + wind * .5, coatLen],
      [(-.82 + kx * .4) * cw - sway * .2 - wind * .9, coatLen - .08 + wind * .15], [(-.66) * cw - wind * .55, coatLen * .45],
      [-.55 * cw, -.05], [-.4 * cw, -.85], [-.56 * cw, -TL + .62], [-.4 * cw, -TL + .1], [-.16 * cw, -TL - .25],
    ], true);
    g.fill();
    g.restore();
    // head in profile
    g.save();
    g.translate(headC[0], headC[1]);
    g.rotate(-look * .5 + lean * .3);
    g.scale(hu, hu);
    const ck = child, fs = 1 - ck * .12;
    smoothPath(g, [
      [-.47, -.05], [-.42, -.36], [-.12, -.56], [.2, -.5], [.36, -.32], [.41 * fs + .02, -.1], [.39 * fs + .02, .0],
      [.47 * fs, .1], [(.55 - ck * .06) * fs, .19], [.44 * fs, .23], [.45 * fs, .3], [.41 * fs, .35], [.43 * fs, .4],
      [.38 * fs, .48], [.37 * fs, .56], [.22, .63], [.12, .62], [.12, 1.05], [-.3, 1.05], [-.33, .45], [-.48, .2],
    ], true);
    g.fill();
    // hair
    const hv = 1 + ck * .12 - old * .08;
    smoothPath(g, [[.33, -.4], [.3, -.52 * hv], [.14, -.64 * hv], [-.06, -.62 * hv], [-.16, -.7 * hv], [-.4, -.56 * hv], [-.5, -.42], [-.6, -.16 * hv], [-.54, .14], [-.58, .26], [-.42, .38], [-.3, .12], [-.12, -.34]], true);
    g.fill();
    if (o.hair === 'bun') { g.beginPath(); g.ellipse(-.58, -.22, .26, .24, 0, 0, Math.PI * 2); g.fill(); smoothPath(g, [[.3, -.44], [.1, -.66], [-.3, -.62], [-.55, -.38], [-.52, -.1], [-.3, .0]], true); g.fill(); }
    if (o.hair === 'long') { smoothPath(g, [[.28, -.46], [.05, -.68], [-.35, -.6], [-.6, -.25], [-.62, .4], [-.55, 1.0], [-.32, 1.1], [-.3, .5], [-.2, .0]], true); g.fill(); }
    if (old > 0) { smoothPath(g, [[.42, .36], [.47, .62 * old + .3], [.34, .62 + .3 * old], [.14, .66 + .3 * old], [-.02, .7], [.08, .5]], true); g.fill(); }
    g.restore();
    // arms
    const arms = o.arms || 'swing', ak = o.armK ?? 1;
    const UA = hu * lerp(1.45, 1.05, child), FA = hu * lerp(1.35, 1.0, child);
    const armW = hu * .34;
    const hands = [];
    for (const i of [1, 0]) {
      const swing = -Math.sin(ph + i * Math.PI) * .42 * walk;
      let a1 = Math.PI / 2 + swing + lean * .5, a2 = a1 - .25 - Math.max(0, swing) * .6; // canvas angles (down = PI/2)
      let b1, b2;
      if (arms === 'open') { b1 = -Math.PI / 2 + (i ? -.55 : .65) * 1.6; b2 = b1 + (i ? -.15 : .15); }
      else if (arms === 'up') { b1 = -Math.PI / 2 + (i ? -.18 : .32); b2 = b1 + (i ? -.05 : .05); }
      else if (arms === 'reach') { b1 = -.25 + (i ? -.1 : 0); b2 = b1 - .05; }
      else if (arms === 'shield') { b1 = i ? Math.PI / 2 + .2 : -.9; b2 = i ? b1 - .2 : -2.6; }
      else if (arms === 'cup') { b1 = Math.PI / 2 - .6; b2 = -.25 + (i ? .15 : 0); }
      else if (arms === 'staff') { b1 = Math.PI / 2 - .55; b2 = Math.PI / 2 - 1.3; }
      else if (arms === 'hold') { b1 = Math.PI / 2 - .35; b2 = .15; }
      else { b1 = Math.PI / 2 + lean * .5 + (i ? .06 : -.04); b2 = b1 - .12; }
      if (arms === 'staff' && i === 1) { b1 = a1; b2 = a2; }
      a1 = lerp(a1, b1, ak); a2 = lerp(a2, b2, ak);
      const shx = sh[0] + (i ? -hu * .1 : hu * .1), shy = sh[1] + hu * .2;
      const el = [shx + Math.cos(a1) * UA, shy + Math.sin(a1) * UA];
      const hd = [el[0] + Math.cos(a2) * FA, el[1] + Math.sin(a2) * FA];
      limb(g, shx, shy, el[0], el[1], armW, armW * .82);
      limb(g, el[0], el[1], hd[0], hd[1], armW * .82, armW * .6);
      g.beginPath(); g.arc(el[0], el[1], armW * .41, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(hd[0], hd[1], hu * .17, hu * .2, a2, 0, Math.PI * 2); g.fill();
      hands[i] = hd;
    }
    if (o.staff) {
      const hd = hands[0];
      const sx = hd[0] + hu * .25, top = hd[1] - hu * 1.0;
      g.lineWidth = hu * .14; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx + hu * .05, top); g.lineTo(sx + hu * .45 + walk * Math.sin(ph) * hu * .15, 0); g.stroke();
    }
    g.restore();
    const T = (p) => [o.x + (o.rot ? (p[0] * f * Math.cos(o.rot) - p[1] * Math.sin(o.rot)) : p[0] * f), o.y + (o.rot ? (p[0] * f * Math.sin(o.rot) + p[1] * Math.cos(o.rot)) : p[1])];
    out.chest = T([sh[0] * .55 + hip[0] * .45 + hu * .28, sh[1] * .62 + hip[1] * .38]);
    out.head = T(headC);
    out.hands = hands.map(T);
    out.hu = hu;
    return out;
  }
  function drawBack(g, o, hu, legLen, torso, child, old, out) {
    const walk = o.walk ?? 0, ph = o.phase ?? 0;
    const w = hu * lerp(.95, .7, child);
    const bob = walk * hu * .06 * Math.cos(2 * ph);
    const sit = o.pose === 'sit';
    const hipY = sit ? -hu * .25 : -legLen + bob;
    if (sit) { legLen = hu * 1.2; }
    // legs: stepping leg appears shorter as it moves away
    for (let i = 0; i < (sit ? 0 : 2); i++) {
      const s = Math.sin(ph + i * Math.PI) * walk;
      const lift = Math.max(0, s) * hu * .35;
      const x = (i ? -1 : 1) * w * .42;
      limb(g, x, hipY, x * 1.05, -lift - hu * .1, hu * .55, hu * .36);
      g.beginPath(); g.ellipse(x * 1.05, -lift - hu * .06, hu * .2, hu * .1, 0, 0, Math.PI * 2); g.fill();
    }
    const shY = hipY - torso * (1 - (o.stoop ?? old * .2) * .3);
    const coatLen = sit ? hu * .5 : o.noCoat ? legLen * .1 : lerp(legLen * .62, legLen * .3, child);
    const wind = o.wind ?? 0;
    // shoulders slope from a thick neck (trapezius) to rounded deltoids; waist tapers; the coat flares
    const nk = hu * .3;
    const pts = [
      [-nk, shY - hu * .32], [-nk * 1.15, shY - hu * .12], [-w * .62, shY + hu * .03], [-w * .9, shY + hu * .14], [-w * 1.02, shY + hu * .4],
      [-w * .98, shY + hu * .8], [-w * .84, shY + torso * .62], [-w * .76, hipY - hu * .1],
      [-w * .96 + wind * hu * .5, hipY + coatLen * .6], [-w * 1.06 + wind * hu * .6, hipY + coatLen],
      [w * 1.06 + wind * hu * .9, hipY + coatLen + wind * hu * .15], [w * .96 + wind * hu * .7, hipY + coatLen * .6],
      [w * .76, hipY - hu * .1], [w * .84, shY + torso * .62], [w * .98, shY + hu * .8], [w * 1.02, shY + hu * .4], [w * .9, shY + hu * .14],
      [w * .62, shY + hu * .03], [nk * 1.15, shY - hu * .12], [nk, shY - hu * .32],
    ];
    K.smoothPath(g, pts, true);
    g.fill();
    const hy = shY - hu * .82 + (o.look ?? 0) * hu * .1;
    // neck with a raised collar
    g.fillRect(-nk * .85, hy + hu * .2, nk * 1.7, shY - hy - hu * .1);
    K.smoothPath(g, [[-nk * 1.25, shY - hu * .05], [-nk * 1.2, shY - hu * .42], [nk * 1.2, shY - hu * .42], [nk * 1.25, shY - hu * .05]], true); g.fill();
    // head from behind: skull, ears, hair with a few tufts
    g.beginPath(); g.ellipse(0, hy, hu * .4, hu * .5, 0, 0, Math.PI * 2); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * hu * .4, hy + hu * .06, hu * .08, hu * .15, s * .2, 0, Math.PI * 2); g.fill(); }
    const hv = 1 + child * .1 - old * .1;
    K.smoothPath(g, [[-hu * .44, hy + hu * .14], [-hu * .47, hy - hu * .2], [-hu * .36, hy - hu * .46 * hv], [-hu * .2, hy - hu * .56 * hv], [-hu * .06, hy - hu * .6 * hv],
      [hu * .1, hy - hu * .57 * hv], [hu * .24, hy - hu * .58 * hv], [hu * .4, hy - hu * .42 * hv], [hu * .47, hy - hu * .16], [hu * .43, hy + hu * .16], [hu * .2, hy + hu * .34], [-hu * .2, hy + hu * .34]], true); g.fill();
    // arms
    const arms = o.arms || 'swing', ak = o.armK ?? 1;
    const UA = hu * lerp(1.45, 1.05, child), FA = hu * lerp(1.35, 1.0, child);
    const hands = [];
    for (let i = 0; i < 2; i++) {
      const sgn = i ? -1 : 1;
      let a = Math.PI / 2 - sgn * .04, b = a + sgn * .05;
      const sw = Math.sin(ph + i * Math.PI) * walk * .25;
      if (arms === 'open') { a = lerp(a, Math.PI / 2 - sgn * 2.15, ak); b = lerp(b, Math.PI / 2 - sgn * 2.55, ak); }
      else if (arms === 'up') { a = lerp(a, -Math.PI / 2 + sgn * .35, ak); b = lerp(b, -Math.PI / 2 + sgn * .2, ak); }
      else if (arms === 'wide') { a = lerp(a, Math.PI / 2 - sgn * 1.25, ak); b = lerp(b, Math.PI / 2 - sgn * 1.45, ak); }
      const sx = sgn * w * .84, sy = shY + hu * .38;
      const L = UA * (1 - sw * .3);
      const el = [sx + Math.cos(a) * L, sy + Math.sin(a) * L];
      const hd = [el[0] + Math.cos(b) * FA, el[1] + Math.sin(b) * FA];
      limb(g, sx, sy, el[0], el[1], hu * .46, hu * .3);
      limb(g, el[0], el[1], hd[0], hd[1], hu * .3, hu * .2);
      g.beginPath(); g.arc(el[0], el[1], hu * .155, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(sx, sy, hu * .24, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(sx - sgn * hu * .3, sy - hu * .2); g.lineTo(sx + sgn * hu * .05, sy - hu * .25); g.lineTo(sx, sy + hu * .3); g.lineTo(sx - sgn * hu * .35, sy + hu * .35); g.fill();
      g.beginPath(); g.ellipse(hd[0] + Math.cos(b) * hu * .12, hd[1] + Math.sin(b) * hu * .12, hu * .13, hu * .2, b - Math.PI / 2, 0, Math.PI * 2); g.fill();
      hands.push([o.x + hd[0], o.y + hd[1]]);
    }
    if (o.staff) { g.lineWidth = hu * .14; g.lineCap = 'round'; g.beginPath(); g.moveTo(w * 1.3, shY + hu * .6); g.lineTo(w * 1.6, 0); g.stroke(); }
    out.chest = [o.x, o.y + shY + torso * .35];
    out.head = [o.x, o.y + hy];
    out.hands = hands;
    out.hu = hu;
  }

  // a figure lying on its back (for the dying hand)
  function lying(g, x, y, len) {
    const hu = len / 7.2;
    g.save(); g.translate(x, y);
    g.beginPath(); g.ellipse(-len * .45, -hu * .45, hu * .45, hu * .4, 0, 0, Math.PI * 2); g.fill();
    g.beginPath();
    g.moveTo(-len * .4, -hu * .1);
    g.quadraticCurveTo(-len * .1, -hu * 1.1, len * .15, -hu * .7);
    g.quadraticCurveTo(len * .4, -hu * .55, len * .5, -hu * .35);
    g.lineTo(len * .52, 0); g.lineTo(-len * .4, 0); g.fill();
    g.restore();
  }

  // ---------------- birds ----------------
  function bird(g, x, y, s, flap, dir = 1) {
    // gull-like silhouette; flap in radians
    const up = Math.sin(flap);
    g.save(); g.translate(x, y); g.scale(dir * s, s);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-.45, -.35 - up * .5, -1.05, -.05 - up * .75);
    g.quadraticCurveTo(-.55, -.12 - up * .25, -.05, .12);
    g.quadraticCurveTo(.55, -.12 - up * .25, 1.05, -.05 - up * .75);
    g.quadraticCurveTo(.45, -.35 - up * .5, 0, 0);
    g.fill();
    g.beginPath(); g.ellipse(.02, .06, .22, .07, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // ---------------- trees ----------------
  function tree(g, x, y, h, seed, opts = {}) {
    const r = rng(seed);
    const lean = opts.lean ?? 0, leaves = opts.leaves ?? 1, sway = opts.sway ?? 0;
    const blobs = [];
    function branch(x0, y0, ang, len, w, depth) {
      const bend = (r() - .5) * .3 + sway * .02 * (6 - depth);
      const x1 = x0 + Math.cos(ang + bend) * len, y1 = y0 + Math.sin(ang + bend) * len;
      g.lineCap = 'round';
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x0, y0);
      g.quadraticCurveTo(x0 + Math.cos(ang) * len * .5, y0 + Math.sin(ang) * len * .5, x1, y1); g.stroke();
      if (depth <= 0 || len < h * .03) { blobs.push([x1, y1, len * (1.1 + r() * .6)]); return; }
      const n = depth > 3 ? 2 : 2 + (r() < .4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const spread = (opts.spread ?? .55) * (i - (n - 1) / 2) * 1.6 + (r() - .5) * .4;
        branch(x1, y1, ang + spread, len * (.68 + r() * .14), w * .66, depth - 1);
      }
      if (depth < 3 && r() < .5) blobs.push([x1, y1, len * .8]);
    }
    branch(x, y, -Math.PI / 2 + lean, h * .3, h * .055, opts.depth ?? 6);
    if (leaves > 0) {
      for (const [bx, by, br] of blobs) {
        const rr = br * leaves * (opts.leafScale ?? 1);
        const n = 16;
        for (let k = 0; k < n; k++) {
          const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rr * .85;
          const s = rr * (.14 + r() * .22);
          g.beginPath(); g.ellipse(bx + Math.cos(a) * d, by + Math.sin(a) * d * .62 - rr * .1, s * 1.25, s * .85, r() * 3, 0, Math.PI * 2); g.fill();
        }
      }
    }
    return blobs;
  }

  // ---------------- terrain/rocks ----------------
  function rock(g, x, y, w, h, seed) {
    const r = rng(seed);
    g.beginPath(); g.moveTo(x - w / 2, y + 2);
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const u = i / n, px = x - w / 2 + u * w;
      const top = Math.sin(u * Math.PI) ** .6 * h * (0.75 + r() * .35);
      g.lineTo(px + (r() - .5) * w * .05, y - top);
    }
    g.lineTo(x + w / 2, y + 2); g.closePath(); g.fill();
  }
  function ground(g, y0, amp, freq, seed, x0 = 0, x1 = W, bottom = H + 10) {
    g.beginPath(); g.moveTo(x0, bottom);
    for (let x = x0; x <= x1 + 8; x += 8) g.lineTo(x, y0 - (fbm(x * freq + seed) - .5) * amp * 2);
    g.lineTo(x1 + 8, bottom); g.closePath(); g.fill();
  }

  // ---------------- cities ----------------
  function dome(g, x, base, w, h) {
    const drum = h * .35;
    g.fillRect(x - w * .5, base - drum, w, drum);
    g.beginPath(); g.moveTo(x - w * .55, base - drum);
    g.bezierCurveTo(x - w * .6, base - drum - h * .55, x - w * .1, base - drum - h * .62, x, base - h);
    g.bezierCurveTo(x + w * .1, base - drum - h * .62, x + w * .6, base - drum - h * .55, x + w * .55, base - drum);
    g.fill();
    g.fillRect(x - w * .02, base - h * 1.12, w * .04, h * .14);
    g.beginPath(); g.arc(x, base - h * 1.13, w * .035, 0, Math.PI * 2); g.fill();
  }
  function minaret(g, x, base, w, h) {
    g.fillRect(x - w / 2, base - h * .85, w, h * .85);
    for (const k of [.45, .7]) g.fillRect(x - w * .9, base - h * k, w * 1.8, w * .35);
    g.beginPath(); g.moveTo(x - w * .6, base - h * .85); g.lineTo(x, base - h); g.lineTo(x + w * .6, base - h * .85); g.fill();
  }
  function ziggurat(g, x, base, w, h, steps) {
    for (let i = 0; i < steps; i++) { const ww = w * (1 - i / steps * .75); g.fillRect(x - ww / 2, base - h * (i + 1) / steps, ww, h / steps + 1); }
  }
  function colonnade(g, x, base, w, h, n) {
    const cw = w / (n * 2 - 1);
    g.fillRect(x - w / 2 - cw * .3, base - cw * .4, w + cw * .6, cw * .4);
    for (let i = 0; i < n; i++) g.fillRect(x - w / 2 + i * cw * 2, base - h * .82, cw, h * .82);
    g.fillRect(x - w / 2 - cw * .3, base - h * .9, w + cw * .6, h * .1);
    g.beginPath(); g.moveTo(x - w / 2 - cw * .4, base - h * .9); g.lineTo(x, base - h * 1.15); g.lineTo(x + w / 2 + cw * .4, base - h * .9); g.fill();
  }
  function tower(g, x, base, w, h) {
    g.fillRect(x - w / 2, base - h, w, h);
    for (let i = 0; i < 4; i++) g.fillRect(x - w / 2 + i * w / 3.5, base - h - w * .2, w / 7, w * .2);
  }
  function aqueduct(g, x, base, w, h) {
    g.beginPath(); g.rect(x - w / 2, base - h, w, h);
    const n = Math.max(2, Math.round(w / (h * .7)));
    const aw = w / n;
    for (let i = 0; i < n; i++) { const cx = x - w / 2 + aw * (i + .5); g.moveTo(cx + aw * .32, base); g.lineTo(cx + aw * .32, base - h * .55); g.arc(cx, base - h * .55, aw * .32, 0, Math.PI, true); g.lineTo(cx - aw * .32, base); }
    g.fill('evenodd');
  }
  function city(g, x0, x1, base, scale, seed) {
    const r = rng(seed);
    let x = x0;
    while (x < x1) {
      const k = r(), s = scale * (.6 + r() * .7);
      if (k < .2) { dome(g, x + s * .6, base, s * 1.1, s * 1.4); x += s * 1.3; }
      else if (k < .35) { minaret(g, x + s * .15, base, s * .16, s * 2.4); x += s * .4; }
      else if (k < .47) { ziggurat(g, x + s * .9, base, s * 1.8, s * 1.1, 4); x += s * 1.9; }
      else if (k < .58) { colonnade(g, x + s * .8, base, s * 1.5, s * .9, 5); x += s * 1.8; }
      else if (k < .7) { tower(g, x + s * .3, base, s * .5, s * 1.6); x += s * .6; }
      else if (k < .8) { aqueduct(g, x + s * 1.2, base, s * 2.4, s * .55); x += s * 2.4; }
      else { g.fillRect(x, base - s * (.4 + r() * .5), s * (.5 + r()), s * 2); x += s * .9; }
      x += s * r() * .25;
    }
    g.fillRect(x0 - 10, base - scale * .12, x1 - x0 + 20, scale * .2 + 400);
  }
  // pointed arch doorway outline (filled frame) centred at x, base; returns nothing
  function archPath(g, x, base, w, h) {
    const r = w * .62, spring = base - h + w * .72;
    g.moveTo(x - w / 2, base);
    g.lineTo(x - w / 2, spring);
    g.arc(x - w / 2 + r, spring, r, Math.PI, Math.PI + Math.acos((r - w / 2) / r) * 1, false);
    const tx = x, ty = spring - Math.sqrt(r * r - (r - w / 2) ** 2);
    g.lineTo(tx, ty);
    g.arc(x + w / 2 - r, spring, r, -Math.acos((r - w / 2) / r), 0, false);
    g.lineTo(x + w / 2, base);
    g.closePath();
  }

  // ---------------- crystal lantern ----------------
  function crystalPoints(cx, cy, s) {
    // faceted vessel: an elongated octagonal bipyramid seen from the side
    return [[0, -1.25], [.42, -.82], [.62, -.15], [.55, .45], [.3, .95], [0, 1.1], [-.3, .95], [-.55, .45], [-.62, -.15], [-.42, -.82]].map(([x, y]) => [cx + x * s, cy + y * s]);
  }

  return { smoothPath, clamp, lerp, smooth, ease, easeOut, easeIn, rng, hash, vnoise, fbm, limb, seeker, lying, bird, tree, rock, ground, dome, minaret, ziggurat, colonnade, tower, aqueduct, city, archPath, crystalPoints };
})();
