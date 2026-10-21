// People. One side-view rig in units where the figure is 100 tall (feet at y=0), facing +x.
// o.walk = gait phase (0..1, two steps per cycle; stride ~74 units per cycle) or undefined to stand.

const THIGH = 23, SHIN = 22, UARM = 16, FARM = 15, TORSO = 32;
const dirv = a => [Math.sin(a), Math.cos(a)]; // angle from straight down, + = forward

function legPose(p) {
  const th = .42 * Math.sin(TAU * p);
  const k = .9 * Math.pow(Math.max(0, Math.cos(TAU * p + .25)), 2) + .06;
  return { th, k };
}

function person(x, y, s, o = {}) {
  const st = {
    coat: C.coat, coatSh: C.coatSh, pants: C.pants, shoes: '#2e221c', skin: C.skin, hair: C.hair,
    hairStyle: 'man', scarf: null, skirt: null, shirt: '#ece6da', coatLen: 11, lean: 0, ...o,
  };
  const dir = o.dir || 1;
  tr(x, y, s, 0, () => {
    if (dir < 0) g.scale(-1, 1);
    // ---------- legs
    let legs;
    if (st.sit) {
      const seat = st.seat ?? 25;
      legs = [{ th: 1.45, k: 1.45 }, { th: 1.5, k: 1.42 }].map(l => ({ ...l, hip: [0, -seat] }));
    } else if (st.walk !== undefined) {
      legs = [legPose(st.walk), legPose(st.walk + .5)];
    } else {
      legs = [{ th: .05, k: .04 }, { th: -.06, k: .03 }];
    }
    const chains = legs.map(l => {
      const hip = l.hip || [0, 0];
      const knee = [hip[0] + THIGH * Math.sin(l.th), hip[1] + THIGH * Math.cos(l.th)];
      const sa = l.th - l.k;
      const ank = [knee[0] + SHIN * Math.sin(sa), knee[1] + SHIN * Math.cos(sa)];
      return { hip, knee, ank, sa };
    });
    let hy;
    if (st.sit) hy = 0;
    else {
      const low = Math.max(...chains.map(c => c.ank[1]));
      hy = -(low + 2.6);
    }
    for (const c of chains) for (const k of ['hip', 'knee', 'ank']) c[k] = [c[k][0], c[k][1] + hy];
    const hip = st.sit ? [0, -(st.seat ?? 25)] : [0, hy];
    const lean = st.lean + (st.walk !== undefined ? .05 : 0);
    const td = [Math.sin(lean), -Math.cos(lean)];
    const sh = [hip[0] + TORSO * td[0], hip[1] + TORSO * td[1]];
    const neck = [hip[0] + 36 * td[0], hip[1] + 36 * td[1]];
    // ---------- arms
    const ph = st.walk ?? 0;
    const swing = st.walk !== undefined ? .38 * Math.sin(TAU * ph) : 0;
    const armFrom = (a, bendExtra) => {
      const el = [sh[0] + UARM * Math.sin(a), sh[1] + UARM * Math.cos(a)];
      const b = a + bendExtra;
      return [el, [el[0] + FARM * Math.sin(b), el[1] + FARM * Math.cos(b)]];
    };
    const armTo = (hand) => [ik(sh[0], sh[1], hand[0], hand[1], UARM, FARM, 1), hand];
    const rel = h => [sh[0] + h[0], sh[1] + h[1]];
    let near = armFrom(-swing * 1.0 + .05, .3 + Math.max(0, -swing) * .4);
    let far = armFrom(swing * 1.0 + .05, .3 + Math.max(0, swing) * .4);
    if (st.armN) near = armTo(rel(st.armN));
    if (st.armF) far = armTo(rel(st.armF));
    if (st.umbrella) near = armTo(rel([9, 6]));
    const dark = c => mixHex(c, '#10101c', .32);
    // ---------- far side
    drawArm(sh, far, dark(st.coat), st.skin);
    drawLeg(chains[1], dark(st.skirt ? st.skin : st.pants), dark(st.shoes), st);
    drawLeg(chains[0], st.skirt ? st.skin : st.pants, st.shoes, st);
    // ---------- torso
    tr(hip[0], hip[1], 1, lean, () => {
      const hem = st.sit ? 3 : st.coatLen;
      const sw = st.walk !== undefined ? Math.sin(TAU * ph * 2) * .8 : 0;
      g.beginPath();
      curve([[-3.6, -36], [-6.8, -31], [-7.6, -18], [-8.2, -4], [-9.6 - sw, hem], [9.4 + sw, hem], [8, -4], [7.8, -18], [7.6, -27], [4.4, -35.4]], true);
      inkPath(st.coat, 1.5);
      g.save(); g.clip(); g.fillStyle = lin(-10, 0, 4, 0, [[0, 'rgba(10,10,30,.28)'], [1, 'rgba(10,10,30,0)']]); g.fillRect(-12, -40, 16, 56); g.restore();
      if (st.sit && st.lap !== false) { g.beginPath(); g.roundRect(-6, -4, 30, 9, 4); inkPath(st.coat, 1.4); }
      // lapel + shirt
      poly([[4.4, -35.4], [7.4, -27], [3.8, -24]], st.shirt); g.lineWidth = 1; g.strokeStyle = C.ink; g.stroke();
      g.strokeStyle = hexA('#0d0d18', .35); g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(5.6, -22); g.lineTo(6.8, hem - 1); g.stroke();
      if (st.skirt) { g.beginPath(); curve([[-8, -2], [-11, 16], [11, 16], [8, -2]], true); inkPath(st.skirt, 1.3); }
      if (st.bag) { g.beginPath(); g.roundRect(-11, -6, 10, 10, 2); inkPath(st.bag, 1.2); stroke([[-5, -6], [5, -33]], st.bag, 1.2); }
    });
    // ---------- scarf + head
    if (st.scarf) {
      g.beginPath(); g.ellipse(neck[0] + .5, neck[1] + .5, 6, 3.4, lean, 0, TAU); inkPath(st.scarf, 1.2);
      const fl = st.walk !== undefined ? Math.sin(TAU * ph) * 2 : 0;
      g.beginPath(); curve([[neck[0] + 3, neck[1] + 1], [neck[0] + 6.5 - fl * .5, neck[1] + 8], [neck[0] + 5 - fl, neck[1] + 15], [neck[0] + 2 - fl, neck[1] + 14.5], [neck[0] + 3.5, neck[1] + 7], [neck[0] + 1, neck[1] + 2]], true);
      inkPath(st.scarf, 1.2);
    }
    const hc = [neck[0] + 1.6 + 8.6 * Math.sin(lean + (st.tilt || 0)), neck[1] - 8.6 * Math.cos(lean + (st.tilt || 0))];
    tr(hc[0], hc[1], 1, lean + (st.tilt || 0), () => {
      if (st.turn) g.scale(-1, 1);
      head(st);
    });
    // ---------- near arm + props
    if (st.umbrella) umbrellaProp(near[1], st.umbrella);
    drawArm(sh, near, st.coat, st.skin, st.prop, st);
    if (st.onDraw) st.onDraw({ sh, neck, hc, hip, hand: near[1] });
  });
}

function drawLeg(c, color, shoe, st) {
  limb([c.hip, c.knee, c.ank], color, 6.4);
  const fa = clamp(c.sa * .35, -.5, .5);
  tr(c.ank[0], c.ank[1], 1, -fa, () => {
    g.beginPath(); g.moveTo(-2.2, -1.5); g.quadraticCurveTo(-2.6, 2.4, 0, 2.4); g.lineTo(7, 2.4); g.quadraticCurveTo(8.2, 2.2, 7.4, .2); g.quadraticCurveTo(4, -1.8, 2, -2);
    g.closePath(); inkPath(shoe, 1.2);
  });
}

function drawArm(sh, arm, color, skin, prop, st) {
  const [el, hand] = arm;
  limb([sh, el, hand], color, 5.6);
  circ(hand[0], hand[1], 2.6, C.ink); circ(hand[0], hand[1], 2, skin);
  if (prop === 'phone') {
    tr(hand[0] + .5, hand[1] - 2, 1, -.25, () => {
      g.beginPath(); g.roundRect(-1.6, -4, 3.6, 7, .8); inkPath('#1c1c26', .8);
      g.fillStyle = st.screen || '#9fd0ff'; g.fillRect(-1.1, -3.4, 2.6, 5.8);
    });
    glow(hand[0] + 1, hand[1] - 3, 16, st.screenGlow || 'rgba(120,180,255,.35)', .8);
  } else if (prop === 'cup') {
    tr(hand[0] + 1.5, hand[1] - 1.5, 1, 0, () => {
      g.beginPath(); g.moveTo(-2.4, -4); g.lineTo(2.6, -4); g.lineTo(2, 3); g.lineTo(-1.8, 3); g.closePath(); inkPath('#f2ebe0', .9);
      rect(-2.2, -1.5, 4.6, 2.2, '#b8763c');
    });
  } else if (prop === 'case') {
    g.beginPath(); g.roundRect(hand[0] - 5, hand[1] + 1, 10, 7.5, 1.2); inkPath('#5a3a26', 1.1);
  }
  circ(hand[0], hand[1], 2, skin);
}

function umbrellaProp(hand, color) {
  stroke([[hand[0], hand[1] + 2], [hand[0], hand[1] - 34]], '#2a2a2a', 1.1, 1, false);
  tr(hand[0], hand[1] - 34, 1, 0, () => {
    g.beginPath(); g.moveTo(-22, 4);
    g.quadraticCurveTo(-20, -14, 0, -15); g.quadraticCurveTo(20, -14, 22, 4);
    for (let i = 3; i >= -3; i--) g.quadraticCurveTo(i * 6.3 + 3.1, 1, i * 6.3 - 3.1 + (i === -3 ? -.2 : 0), 4 - (i === -3 ? 0 : 0));
    g.closePath(); inkPath(color, 1.2);
    g.strokeStyle = hexA('#000000', .25); g.lineWidth = .8;
    for (const xx of [-11, 0, 11]) { g.beginPath(); g.moveTo(0, -15); g.quadraticCurveTo(xx * .8, -6, xx * 1.15, 3); g.stroke(); }
  });
}

// side-view head in a frame centred on the skull, facing +x
function head(st) {
  const skin = st.skin, hair = st.hair, hs = st.hairStyle;
  if (hs === 'long') { g.beginPath(); curve([[1, -9], [-7.5, -6], [-9, 6], [-8, 15], [-2, 14], [-2.5, 4]], true); inkPath(hair, 1.2); }
  // skull + face profile
  g.beginPath();
  curve([[-3.6, 8.6], [-7.2, 2], [-6.4, -5.8], [0, -8.6], [5.8, -6], [7.2, -2.2], [8.4, 1.2], [7.3, 2.6], [7.6, 4.2], [6.6, 6.6], [3.2, 8.4], [2.6, 10.5]], false);
  g.lineTo(-3.4, 10.5); g.closePath();
  inkPath(skin, 1.3);
  // ear
  g.beginPath(); g.ellipse(-1.2, 1, 1.6, 2.3, 0, 0, TAU); inkPath(skin, 1);
  stroke([[-1.3, -.2], [-.6, 1], [-1.3, 2]], C.skinSh, .6, 1, false);
  // cheek
  circ(4.1, 3, 1.8, 'rgba(240,120,110,.22)');
  // hair
  if (hs !== 'bald') {
    g.beginPath();
    if (hs === 'man') curve([[7.6, -3.1], [7.4, -6.6], [4.6, -9.8], [-.4, -10.8], [-5.4, -9], [-8.3, -4], [-8.2, 1.5], [-6.4, 6], [-4.4, 5.6], [-3.5, .6], [-1.6, -2.6], [2.2, -3.8], [4.4, -2.6], [5.6, -4.4]], true);
    else if (hs === 'bob') curve([[7.2, -3], [6.8, -7.4], [2, -10.4], [-5, -9.6], [-8.6, -3.6], [-8.4, 4.6], [-6.6, 8.6], [-3.4, 8.4], [-3.2, 2], [-1.2, -2.4], [3, -4], [5.6, -3.8]], true);
    else if (hs === 'long') curve([[7.2, -3], [6.8, -7.4], [2, -10.4], [-5, -9.6], [-8, -3.6], [-6, 2], [-3.2, 2], [-1.2, -2.4], [3, -4], [5.6, -3.8]], true);
    else if (hs === 'bun') { curve([[7, -3.4], [6.2, -7.6], [1, -9.8], [-5.4, -8.6], [-7.6, -3], [-6.4, 3], [-3.4, 2.6], [-1.2, -2.4], [3, -4.2], [5.6, -4]], true); }
    else if (hs === 'cap') curve([[11, -3.4], [7, -4.6], [5.6, -8.6], [0, -10.2], [-6, -8.6], [-8, -3], [-7.4, 2], [-4, 1], [-2, -3.4], [6, -3.8]], true);
    else if (hs === 'gray') curve([[6.2, -5.2], [3.4, -8.6], [-2.4, -9.2], [-7, -6], [-8, 0], [-6.6, 4.6], [-4.6, 3], [-3.6, -1.4], [0, -4.6], [3.4, -5]], true);
    inkPath(hair, 1.2);
    if (hs === 'bun') { g.beginPath(); g.arc(-6.2, -8.4, 3.2, 0, TAU); inkPath(hair, 1.2); }
    if (hs === 'man') { // a few loose strands
      stroke([[2, -9.6], [5.8, -7.6], [7.8, -4.2]], hexA('#ffffff', .12), .7);
      stroke([[-5, -8], [-3, -9.6]], hexA('#ffffff', .12), .7);
    }
  }
  if (st.glasses) { g.lineWidth = .7; g.strokeStyle = C.ink; g.beginPath(); g.ellipse(4.9, -.2, 1.8, 1.6, 0, 0, TAU); g.stroke(); stroke([[3.1, -.4], [-.6, -.8]], C.ink, .6, 1, false); }
  // eye
  const ex = 4.7 + (st.look || 0) * .25, ey = -.3 + (st.lookY || 0) * .25;
  if ((st.blink || 0) > .5) stroke([[3.8, -.1], [5.4, .1]], C.ink, .8, 1, false);
  else {
    ell(ex, ey, .95, 1.45, '#1b1416');
    circ(ex + .32, ey - .55, .38, '#ffffff');
    if (st.eyeGlint) circ(ex - .1, ey + .3, .4, st.eyeGlint);
  }
  // brow
  const b = st.brow || 0; // +1 worried, -1 stern
  stroke([[3.5, -2.6 - b * .2], [5.9, -2.8 + b * .55]], hair === '#d8d4cc' ? '#8a8680' : C.ink, .8, 1, false);
  // mouth
  const m = st.mouth || 'flat';
  if (m === 'o') ell(6.7, 4.5, .55, .7, '#5a2a26');
  else if (m === 'smile') stroke([[5.6, 4.1], [6.6, 4.6], [7.4, 4.1]], '#6a3028', .7);
  else if (m === 'frown') stroke([[5.8, 4.8], [6.6, 4.3], [7.4, 4.6]], '#6a3028', .7);
  else stroke([[5.9, 4.4], [7.3, 4.3]], '#6a3028', .7, 1, false);
}

/* ------------------------------------------------------------ the man, front close-up */
// units: head ~20 tall, centred on the nose bridge. o: {lookX, lookY, lid, brow, mouth, light, glint, breath}
function face(x, y, s, o = {}) {
  const lookX = o.lookX || 0, lookY = o.lookY || 0, lid = o.lid || 0, brow = o.brow || 0;
  tr(x, y, s, o.rot || 0, () => {
    // shoulders, coat, scarf
    if (o.body !== false) {
    g.beginPath(); curve([[-24, 40], [-21, 22], [-11, 14.6], [0, 13.6], [11, 14.6], [21, 22], [24, 40]], false); g.closePath();
    inkPath(o.coat || C.coat, .35);
    poly([[-4.4, 11], [0, 19], [4.4, 11]], '#ece6da');
    g.beginPath(); g.roundRect(-3.2, 6, 6.4, 8.6, 2); inkPath(C.skinSh, .3);
    if (o.scarf !== false) {
      g.beginPath(); curve([[-8.5, 11.5], [0, 14.6], [8.5, 11.5], [9, 14.8], [0, 18], [-9, 14.8]], true); inkPath(C.scarf, .3);
      g.beginPath(); curve([[3, 15], [5.6, 24], [4, 34], [8.8, 34], [9.6, 22], [7.4, 15]], true); inkPath(C.scarf, .3);
    }
    }
    // ears
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 7.7, .6, 1.5, 2.4, 0, 0, TAU); inkPath(C.skin, .3); }
    // face
    const facePath = () => { g.beginPath(); curve([[0, -10.4], [6.2, -8.6], [7.8, -3.4], [7.5, 2.4], [5.6, 7], [2.6, 9.3], [0, 9.9], [-2.6, 9.3], [-5.6, 7], [-7.5, 2.4], [-7.8, -3.4], [-6.2, -8.6]], true); };
    facePath(); inkPath(C.skin, .35);
    g.save(); facePath(); g.clip();
    g.fillStyle = lin(0, -10, 0, 10, [[0, 'rgba(0,0,0,0)'], [.7, 'rgba(0,0,0,0)'], [1, 'rgba(120,60,40,.18)']]); g.fillRect(-9, -11, 18, 22);
    for (const sx of [-1, 1]) circ(sx * 4.4, 3.6, 1.9, 'rgba(240,110,100,.2)');
    g.restore();
    // eyes
    for (const sx of [-1, 1]) {
      const cx = sx * 3.15, cy = .1;
      g.save();
      g.beginPath(); g.ellipse(cx, cy, 1.85, 1.3, 0, 0, TAU); g.clip();
      g.fillStyle = '#fbf7f0'; g.fillRect(cx - 2, cy - 2, 4, 4);
      const ix = cx + lookX * .75, iy = cy + lookY * .45;
      ell(ix, iy, 1.08, 1.22, o.iris || '#3a2618');
      ell(ix, iy, .6, .7, '#0e0809');
      if (o.glint) { circ(ix - .2, iy + .4, .42, o.glint); glow(ix, iy, 1.6, o.glint, .6); }
      circ(ix + .38, iy - .45, .32, '#ffffff'); circ(ix - .35, iy + .4, .14, '#ffffff');
      // eyelid closing down
      if (lid > 0) { g.fillStyle = C.skin; g.fillRect(cx - 2.2, cy - 1.4, 4.4, 2.7 * lid); }
      g.restore();
      const ly = cy - 1.3 + 2.6 * lid;
      stroke([[cx - 2.05, cy + .2 + lid * 1.3], [cx - 1, ly - .15], [cx + 1, ly - .15], [cx + 2.05, cy + lid * 1.3]], C.ink, .42);
      stroke([[cx - 1.2, cy + 1.25], [cx + 1.2, cy + 1.25]], hexA('#7a4a3a', .45), .22, 1, false);
      // brow: worried lifts the inner end, stern drops it
      const inner = -sx * .5, outer = sx * 2.6;
      stroke([[cx + inner, -3.1 - brow * .55], [cx + outer * .5, -3.55], [cx + outer, -3.1 + brow * .2]], '#2a1c18', .5);
    }
    // nose + mouth
    stroke([[.3, 1.4], [.8, 3.6], [-.1, 3.9]], hexA('#a06a52', .7), .3);
    const m = o.mouth || 'flat';
    if (m === 'o') { g.beginPath(); g.ellipse(0, 6.1, .65, .8, 0, 0, TAU); inkPath('#5a2420', .25); }
    else if (m === 'smile') stroke([[-1.6, 5.8], [0, 6.5], [1.6, 5.8]], '#7a3a30', .32);
    else if (m === 'tight') stroke([[-1.3, 6.2], [1.3, 6.2]], '#6a3028', .4, 1, false);
    else stroke([[-1.3, 6], [0, 6.15], [1.3, 6]], '#7a3a30', .3);
    // hair with fringe
    g.beginPath();
    curve([[-8.4, 1.6], [-8.8, -5], [-6.4, -10], [0, -12.2], [6.6, -10.4], [9, -5.4], [8.3, 1.4], [7.4, -2.6], [6.6, -4], [5, -5.6], [3.6, -3.2], [1.6, -5.6], [-.4, -3.4], [-2.6, -5.8], [-4.6, -3.4], [-6.4, -5], [-7.4, -2.2]], true);
    inkPath(C.hair, .35);
    stroke([[-4, -10], [-1, -11.2], [2.4, -10.8]], hexA('#ffffff', .1), .35);
    // light falling on the face (screen glow, neon, lantern)
    if (o.light) {
      g.save(); facePath(); g.clip();
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = o.light.a ?? .8;
      g.fillStyle = lin(0, o.light.from === 'top' ? -10 : 10, 0, o.light.from === 'top' ? 10 : -10, [[0, o.light.color], [1, 'rgba(0,0,0,0)']]);
      g.fillRect(-10, -12, 20, 24); g.restore();
    }
  });
}

/* ------------------------------------------------------------ the man, from behind */
function personBack(x, y, s, o = {}) {
  const ph = o.walk;
  tr(x, y, s, 0, () => {
    const lift = i => ph === undefined ? 0 : Math.max(0, Math.sin(TAU * (ph + i * .5))) * 4;
    for (const [i, sx] of [[0, -1], [1, 1]]) {
      const ly = -lift(i);
      limb([[sx * 4, -47], [sx * 4.4, -24 + ly], [sx * 4.6, -2 + ly]], i ? C.pants : mixHex(C.pants, '#000000', .15), 7);
      g.beginPath(); g.ellipse(sx * 4.6, -1 + ly, 3.6, 2.2, 0, 0, TAU); inkPath('#2e221c', 1);
    }
    const sw = ph === undefined ? 0 : Math.sin(TAU * ph) * 2;
    const armOut = o.armsOut || 0;
    for (const sx of [-1, 1]) {
      const hand = [sx * (12.5 + armOut * 18), -50 - armOut * 10 + sx * sw];
      limb([[sx * 8, -78], [sx * (10.5 + armOut * 10), -64 - armOut * 6], hand], C.coat, 5.6);
      circ(hand[0], hand[1], 2.2, C.skin);
    }
    g.beginPath(); curve([[-4, -83], [-9, -78], [-9.4, -60], [-10.4, -36], [10.4, -36], [9.4, -60], [9, -78], [4, -83]], true);
    inkPath(C.coat, 1.4);
    stroke([[0, -76], [0, -37]], hexA('#000000', .25), .9, 1, false);
    g.beginPath(); g.ellipse(0, -82, 6.4, 3.4, 0, 0, TAU); inkPath(C.scarf, 1.2);
    g.beginPath(); g.ellipse(0, -90.5, 7.3, 8.4, 0, 0, TAU); inkPath(C.hair, 1.3);
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 7.2, -89.6, 1.3, 2.2, 0, 0, TAU); inkPath(C.skin, .9); }
    stroke([[-3, -96], [0, -98.4], [3.4, -96.4]], hexA('#ffffff', .12), .7);
    if (o.rim) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = o.rim.a;
      g.fillStyle = lin(0, -100, 0, 0, [[0, o.rim.color], [1, 'rgba(0,0,0,0)']]);
      g.beginPath(); g.ellipse(0, -90.5, 7.3, 8.4, 0, 0, TAU); g.fill();
      g.restore();
    }
  });
}

/* ------------------------------------------------------------ crowd */
const CROWD_STYLES = [
  { coat: '#7a4a3a', pants: '#2b2b33', hairStyle: 'bob', hair: '#5a3a24', skin: '#f0c9a6' },
  { coat: '#4a6a58', pants: '#3a3630', hairStyle: 'man', hair: '#1a1414', skin: '#8a5a3c' },
  { coat: '#b8a07a', pants: '#3c3a44', hairStyle: 'long', hair: '#2a1a14', skin: '#f2d2b6' },
  { coat: '#3c3c4a', pants: '#24242a', hairStyle: 'cap', hair: '#a8323a', skin: '#c48a64', bag: '#6a4a2a' },
  { coat: '#9a3a3a', pants: '#2a2a30', hairStyle: 'bun', hair: '#1a1210', skin: '#e6b892' },
  { coat: '#5a5e70', pants: '#2c2c34', hairStyle: 'gray', hair: '#d8d4cc', skin: '#f0ceb2', glasses: true },
  { coat: '#d7c9a8', pants: '#5a4a3a', hairStyle: 'man', hair: '#4a2e1c', skin: '#f3cfae', bag: '#2a2a2a' },
  { coat: '#2e4a6e', pants: '#1e1e26', hairStyle: 'bob', hair: '#111', skin: '#6a422c', skirt: '#2a2a40' },
  { coat: '#6a5a8a', pants: '#2a2a34', hairStyle: 'long', hair: '#c89a5a', skin: '#f6d6bc' },
  { coat: '#8a6a2a', pants: '#2a2622', hairStyle: 'bald', hair: '#222', skin: '#9a6a48' },
];
