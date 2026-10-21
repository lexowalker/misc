// Painted places. Static layers are built once into offscreen canvases; skies, light and weather are live.
const BG = {};

/* ------------------------------------------------------------ skies + clouds */
function skyGrad(stops, y0 = 0, y1 = H) {
  g.fillStyle = lin(0, y0, 0, y1, stops);
  g.fillRect(-W, y0 - 2000, W * 4, y1 - y0 + 4000);
}
// a Ghibli cumulus: shadowed underside, sunlit crown, flat base
function cumulus(x, y, w, h, seed, col) {
  const r = rng(seed), puffs = [];
  const n = Math.round(w / 22);
  for (let i = 0; i < n; i++) {
    const f = r() * 2 - 1;
    const px = x + f * w / 2;
    const top = h * (1 - f * f) * (.55 + r() * .45);
    const rad = 18 + r() * (w / 7) * (1 - Math.abs(f) * .5);
    puffs.push([px, y - top * r() * .9 - rad * .2, rad]);
  }
  puffs.sort((a, b) => b[1] - a[1]);
  g.save();
  g.beginPath(); g.rect(x - w, y - h * 3, w * 2, h * 3 + 8); g.clip();
  for (const [px, py, rad] of puffs) circ(px + rad * .12, py + rad * .2, rad, col.shadow);
  for (const [px, py, rad] of puffs) circ(px, py, rad * .92, col.mid);
  for (const [px, py, rad] of puffs) {
    const gr = g.createRadialGradient(px - rad * .35, py - rad * .45, 0, px - rad * .2, py - rad * .3, rad * .9);
    gr.addColorStop(0, col.light); gr.addColorStop(1, hexA(col.lightHex || '#ffffff', 0));
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, rad * .9, 0, TAU); g.fill();
  }
  g.restore();
  g.fillStyle = lin(0, y - 30, 0, y + 6, [[0, hexA(col.baseHex || '#8090b0', 0)], [1, hexA(col.baseHex || '#8090b0', .55)]]);
  g.fillRect(x - w * .6, y - 30, w * 1.2, 36);
}
function birds(t, x0, y0, n, seed, a = 1) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const bx = x0 + i * 26 + r() * 20 + t * (30 + r() * 10), by = y0 + r() * 30 + Math.sin(t * 1.5 + i) * 6;
    const f = Math.sin(t * 9 + i * 2) * 4;
    stroke([[bx - 7, by - f], [bx, by], [bx + 7, by - f]], `rgba(40,30,40,${.7 * a})`, 1.8, 1, false);
  }
}
function rays(x, y, n, len, color, a, seed = 3) {
  if (a <= 0) return;
  const r = rng(seed);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ang = Math.PI * .25 + r() * Math.PI * .5, wd = .02 + r() * .05;
    g.fillStyle = lin(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, [[0, hexA(color, a * (.25 + r() * .3))], [1, hexA(color, 0)]]);
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang - wd) * len, y + Math.sin(ang - wd) * len);
    g.lineTo(x + Math.cos(ang + wd) * len, y + Math.sin(ang + wd) * len); g.closePath(); g.fill();
  }
  g.restore();
}

/* ------------------------------------------------------------ manhattan rooftops (seen from a window) */
function rooftops(y, seed, col, opts = {}) {
  const r = rng(seed);
  let x = -40;
  while (x < W + 40) {
    const w = 120 + r() * 220, h = 60 + r() * 220;
    const top = y - h;
    rect(x, top, w, H, col.bld[Math.floor(r() * col.bld.length)]);
    // cornice
    rect(x - 4, top, w + 8, 10, col.trim);
    // windows
    for (let wy = top + 26; wy < y + 300; wy += 34) for (let wx = x + 14; wx < x + w - 18; wx += 26) {
      const lit = opts.night ? r() < .35 : r() < .06;
      rect(wx, wy, 13, 20, lit ? col.lit : col.win);
    }
    // water tower on some roofs
    if (r() < .5) {
      const tx = x + 20 + r() * (w - 70), th = 46 + r() * 16;
      for (const lx of [4, 20, 36]) rect(tx + lx, top - 22, 3, 22, col.tower);
      rect(tx - 2, top - 24, 46, 4, col.tower);
      g.beginPath(); g.moveTo(tx, top - 24); g.lineTo(tx, top - 24 - th); g.lineTo(tx + 21, top - 24 - th - 20); g.lineTo(tx + 42, top - 24 - th); g.lineTo(tx + 42, top - 24); g.closePath();
      g.fillStyle = col.towerBody; g.fill();
      for (let k = 1; k < 4; k++) rect(tx, top - 24 - th * k / 4, 42, 2, col.tower);
    }
    x += w + (r() < .3 ? 30 + r() * 60 : 0);
  }
}

/* ------------------------------------------------------------ APARTMENT */
function buildApartment(night) {
  return into(mk(), () => {
    const wall = night ? '#2c3550' : '#e9d6b4', wallDk = night ? '#1e2640' : '#cdb390';
    g.fillStyle = lin(0, 0, 0, 900, [[0, wallDk], [.5, wall], [1, wallDk]]); g.fillRect(0, 0, W, 900);
    // wainscot + floor
    rect(0, 820, W, 70, night ? '#262c44' : '#bfa07a');
    rect(0, 818, W, 6, night ? '#3a4260' : '#f2e2c4');
    g.fillStyle = lin(0, 890, 0, H, [[0, night ? '#2a2430' : '#9a6a42'], [1, night ? '#16121c' : '#6e4628']]); g.fillRect(0, 890, W, 190);
    g.strokeStyle = night ? 'rgba(0,0,0,.3)' : 'rgba(60,30,10,.25)'; g.lineWidth = 2;
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(0, 905 + k * 30); g.lineTo(W, 905 + k * 30); g.stroke(); }
    // window opening (transparent so the live sky shows through)
    const wx = 1000, wy = 130, ww = 560, wh = 560;
    rect(wx - 30, wy - 30, ww + 60, wh + 60, night ? '#3c4664' : '#f4ecdc');
    rect(wx - 44, wy + wh + 20, ww + 88, 26, night ? '#4a5474' : '#fbf5ea');
    g.clearRect(wx, wy, ww, wh);
    rect(wx, wy + wh / 2 - 9, ww, 18, night ? '#3c4664' : '#f4ecdc');
    for (const k of [1, 2]) { rect(wx + ww * k / 3 - 5, wy, 10, wh / 2 - 9, night ? '#3c4664' : '#f4ecdc'); rect(wx + ww * k / 3 - 5, wy + wh / 2 + 9, 10, wh / 2 - 9, night ? '#3c4664' : '#f4ecdc'); }
    // curtains
    for (const [cx, dirc] of [[wx - 90, 1], [wx + ww + 30, -1]]) {
      g.fillStyle = lin(cx, 0, cx + 70, 0, [[0, night ? '#3a2a4a' : '#b8584a'], [.5, night ? '#4a3658' : '#d8705c'], [1, night ? '#2e2240' : '#a84a3e']]);
      g.beginPath(); g.moveTo(cx, wy - 50); g.lineTo(cx + 64, wy - 50); g.quadraticCurveTo(cx + 64 + dirc * 14, wy + 300, cx + 70, 820); g.lineTo(cx - 6, 820); g.closePath(); g.fill();
    }
    rect(wx - 120, wy - 58, ww + 240, 10, night ? '#1a1620' : '#5a3a22');
    // framed print: a great wave
    tr(560, 260, 1, 0, () => {
      rect(-130, -90, 260, 180, '#3a2a1e'); rect(-118, -78, 236, 156, '#efe2c4');
      g.beginPath(); g.moveTo(-118, 40); g.quadraticCurveTo(-60, -70, 20, -40); g.quadraticCurveTo(-30, -40, -20, 0); g.quadraticCurveTo(40, 30, 118, 20); g.lineTo(118, 78); g.lineTo(-118, 78); g.closePath();
      g.fillStyle = '#2c4a7a'; g.fill();
      for (let k = 0; k < 7; k++) circ(-10 + k * 6 - k * k, -48 + k * 4, 5, '#f4f0e6');
      poly([[60, 30], [80, 4], [100, 30]], '#f4f0e6');
      if (night) { g.fillStyle = 'rgba(20,30,70,.5)'; g.fillRect(-130, -90, 260, 180); }
    });
    // bookshelf
    tr(1700, 260, 1, 0, () => {
      rect(0, 0, 180, 560, night ? '#2a2026' : '#6a4630');
      const r = rng(5);
      for (let sh = 0; sh < 4; sh++) {
        rect(10, 20 + sh * 135, 160, 112, night ? '#1a1418' : '#4a2e1e');
        let bx = 14;
        while (bx < 160) {
          const bw = 12 + r() * 14, bh = 70 + r() * 36;
          const hue = Math.floor(r() * 360);
          g.fillStyle = night ? `hsl(${hue},20%,${18 + r() * 12}%)` : `hsl(${hue},40%,${40 + r() * 20}%)`;
          g.fillRect(bx, 132 + sh * 135 - bh, bw, bh); bx += bw + 2;
        }
      }
      // plant
      g.fillStyle = night ? '#3a2e30' : '#b0603a'; g.beginPath(); g.moveTo(60, 0); g.lineTo(120, 0); g.lineTo(112, -46); g.lineTo(68, -46); g.closePath(); g.fill();
      for (let k = 0; k < 9; k++) { tr(90, -46, 1, -1.3 + k * .32, () => { g.beginPath(); g.ellipse(0, -40, 12, 42, 0, 0, TAU); g.fillStyle = night ? '#1e3a30' : (k % 2 ? '#4a8a4a' : '#5aa05a'); g.fill(); }); }
    });
    // bed: headboard, mattress, blanket
    rect(120, 560, 40, 330, night ? '#2a2230' : '#7a5236');
    g.fillStyle = night ? '#2a2230' : '#8a5e3e'; rr(110, 540, 60, 40, 10); g.fill();
    g.fillStyle = night ? '#d8dcea' : '#f6f2ea'; rr(160, 680, 860, 90, 14); g.fill();
    rect(170, 770, 840, 110, night ? '#22283c' : '#c8b49a');
    for (const lx of [176, 990]) rect(lx, 860, 20, 40, night ? '#1a1620' : '#5a3a22');
    // pillow
    g.fillStyle = night ? '#c4cadc' : '#fffaf2'; rr(180, 616, 230, 86, 40); g.fill();
    g.strokeStyle = night ? 'rgba(0,0,0,.3)' : 'rgba(120,90,60,.3)'; g.lineWidth = 3; g.stroke();
    // nightstand
    rect(-10, 660, 110, 230, night ? '#2e2430' : '#8a5a3a');
    rect(-10, 650, 120, 16, night ? '#3a2e3c' : '#a26c46');
    rect(10, 720, 70, 4, 'rgba(0,0,0,.3)');
    // bedside lamp
    rect(30, 560, 6, 90, '#3a3030');
    g.fillStyle = night ? '#5a5060' : '#efd9a8'; g.beginPath(); g.moveTo(6, 560); g.lineTo(60, 560); g.lineTo(48, 510); g.lineTo(18, 510); g.closePath(); g.fill();
  });
}
// blanket over a sleeping body, drawn live so it can breathe
function blanket(t, night, sitUp = 0) {
  const br = Math.sin(t * 1.3) * 4;
  g.beginPath();
  g.moveTo(330, 700 - br); g.bezierCurveTo(480, 640 - br, 700, 650 - br * .6, 1000, 680); g.lineTo(1030, 800); g.lineTo(300, 800); g.closePath();
  g.fillStyle = lin(0, 640, 0, 800, night ? [[0, '#3a4a7a'], [1, '#22284a']] : [[0, '#6a8ac0'], [1, '#3e5a90']]); g.fill();
  g.strokeStyle = night ? 'rgba(160,180,255,.25)' : 'rgba(255,255,255,.35)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(340, 698 - br); g.bezierCurveTo(480, 645 - br, 700, 655 - br * .6, 995, 684); g.stroke();
  // quilt stitching
  g.strokeStyle = night ? 'rgba(0,0,0,.25)' : 'rgba(20,30,70,.25)'; g.lineWidth = 2; g.setLineDash([10, 8]);
  for (const k of [520, 720, 900]) { g.beginPath(); g.moveTo(k, 660); g.lineTo(k - 10, 800); g.stroke(); }
  g.setLineDash([]);
}
function windowSky(t, mode) {
  g.save(); g.beginPath(); g.rect(1000, 130, 560, 560); g.clip();
  if (mode === 'dawn') {
    skyGrad([[0, '#6a8ad0'], [.45, '#e8a8b8'], [.75, '#ffd3a0'], [1, '#ffe8c0']], 130, 690);
    glow(1420, 560, 220, 'rgba(255,230,170,.9)', .9, 'source-over');
    cumulus(1180 + t * 3, 330, 300, 110, 4, { shadow: '#c890a8', mid: '#f4c0c0', light: 'rgba(255,240,220,.95)', lightHex: '#fff0dc', baseHex: '#c890a8' });
    cumulus(1500 + t * 2, 250, 220, 70, 9, { shadow: '#b088a8', mid: '#eab8c0', light: 'rgba(255,236,220,.9)', lightHex: '#ffecdc', baseHex: '#b088a8' });
    rooftops(600, 3, { bld: ['#7a5a6a', '#6a4e62', '#8a6070'], trim: '#5a4050', win: '#4a3448', lit: '#ffd890', tower: '#3a2a38', towerBody: '#5a3e4a' });
    birds(t, 1040, 260, 5, 2);
  } else {
    skyGrad([[0, '#0c1230'], [.6, '#1e2a5a'], [1, '#3a3a6a']], 130, 690);
    for (let i = 0; i < 40; i++) { const r = hash(i * 3.3); circ(1000 + hash(i) * 560, 140 + r * 300, 1 + hash(i * 7) * 1.5, '#e8ecff', .4 + .4 * Math.sin(t * 2 + i)); }
    circ(1440, 250, 46, '#f6f0d8'); glow(1440, 250, 160, 'rgba(220,230,255,.5)', .8);
    circ(1428, 240, 8, 'rgba(200,190,160,.5)'); circ(1452, 262, 6, 'rgba(200,190,160,.5)');
    rooftops(600, 3, { bld: ['#1a1e36', '#161a30', '#20243e'], trim: '#12142a', win: '#141830', lit: '#ffcf7a', tower: '#0e1024', towerBody: '#141832' }, { night: true });
  }
  g.restore();
}

/* ------------------------------------------------------------ SUBWAY CAR */
function buildSubway() {
  return into(mk(), () => {
    // ceiling + lights
    g.fillStyle = lin(0, 0, 0, 120, [[0, '#b8bcc0'], [1, '#d8dad6']]); g.fillRect(0, 0, W, 120);
    for (let k = 0; k < 4; k++) { g.fillStyle = '#fbfff4'; rr(160 + k * 450, 34, 300, 26, 8); g.fill(); }
    // ad strip frame
    rect(0, 120, W, 100, '#c9c6bc'); rect(0, 216, W, 8, '#9a9890');
    // wall + window frames (windows clear, tunnel shows through)
    g.fillStyle = lin(0, 224, 0, 600, [[0, '#d8d4c8'], [1, '#c4c0b2']]); g.fillRect(0, 224, W, 380);
    for (const wx of [250, 760, 1270]) { g.save(); g.beginPath(); g.roundRect(wx, 270, 400, 250, 26); g.fillStyle = '#6a6a70'; g.fill(); g.restore(); }
    for (const wx of [250, 760, 1270]) { g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.roundRect(wx + 10, 280, 380, 230, 20); g.fill(); g.restore(); }
    // doors at the far left
    rect(0, 224, 200, 856, '#b8b6ae'); rect(96, 224, 8, 856, '#7a7870');
    for (const dx of [20, 112]) { g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.roundRect(dx, 300, 68, 220, 12); g.fill(); g.restore(); }
    // grab rail
    rect(200, 236, W, 10, '#e8eaee'); rect(200, 244, W, 3, '#8a8c90');
    // seats: the classic orange and yellow benches
    for (let k = 0; k < 9; k++) {
      const sx = 230 + k * 186;
      g.fillStyle = lin(sx, 600, sx, 760, [[0, k % 2 ? '#f0a020' : '#e8762a'], [1, k % 2 ? '#c87a14' : '#b4561c']]);
      g.beginPath(); g.roundRect(sx, 590, 176, 110, [30, 30, 6, 6]); g.fill();
      g.beginPath(); g.roundRect(sx - 4, 694, 184, 40, 10); g.fill();
    }
    rect(200, 734, W, 70, '#3e3c3a');
    // floor
    g.fillStyle = lin(0, 800, 0, H, [[0, '#8a8478'], [1, '#5e5a52']]); g.fillRect(0, 800, W, 280);
    const r = rng(8);
    for (let i = 0; i < 1400; i++) circ(r() * W, 806 + r() * 274, 1 + r() * 2, r() < .5 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.14)');
    // poles
    for (const px of [520, 1440]) {
      g.fillStyle = lin(px - 9, 0, px + 9, 0, [[0, '#8a8e94'], [.4, '#f4f6fa'], [1, '#7a7e84']]); g.fillRect(px - 9, 0, 18, 1080);
    }
    // map + safety placards between windows
    for (const mx of [660, 1170, 1680]) { rect(mx, 300, 90, 140, '#f4f2ea'); rect(mx + 8, 308, 74, 4, '#d23a2a'); rect(mx + 8, 318, 74, 4, '#2a6ad2'); rect(mx + 8, 328, 74, 4, '#2aa25a'); for (let k = 0; k < 6; k++) rect(mx + 10, 344 + k * 14, 50 + (k % 3) * 8, 3, '#9a9890'); }
  });
}
// ad cards along the strip; i=2 is the perfume ad the lust yokai uses
function subwayAds(t, lure = 0) {
  const ads = [['#2a6ad2', 'LEARN CODING', '#fff'], ['#f2d24a', 'DR. ZIZMOR?', '#222'], [null], ['#2aa25a', 'MOVING? CALL', '#fff'], ['#e8e2d4', 'POEMS IN MOTION', '#333']];
  ads.forEach(([bg, txt, fg], i) => {
    const ax = 230 + i * 340, aw = 320;
    if (bg) { rect(ax, 130, aw, 80, bg); T(txt, ax + aw / 2, 170, { size: 30, weight: 600, color: fg, ls: 2 }); return; }
    // the perfume ad
    g.fillStyle = lin(ax, 130, ax + aw, 210, [[0, '#2a0a1e'], [1, '#6a1a3a']]); g.fillRect(ax, 130, aw, 80);
    g.save(); g.beginPath(); g.rect(ax, 130, aw, 80); g.clip();
    // a stylised face in profile, eyes closed
    g.fillStyle = '#f2c8b0';
    g.beginPath(); g.moveTo(ax + 70, 210); g.quadraticCurveTo(ax + 40, 170, ax + 72, 140); g.quadraticCurveTo(ax + 98, 132, ax + 106, 154);
    g.lineTo(ax + 116, 168); g.lineTo(ax + 106, 172); g.quadraticCurveTo(ax + 112, 184, ax + 104, 188); g.quadraticCurveTo(ax + 100, 200, ax + 92, 210); g.closePath(); g.fill();
    g.fillStyle = '#1a0a10'; g.beginPath(); g.moveTo(ax + 72, 136); g.quadraticCurveTo(ax + 20, 140, ax + 30, 210); g.lineTo(ax + 64, 210); g.quadraticCurveTo(ax + 48, 170, ax + 76, 146); g.closePath(); g.fill();
    stroke([[ax + 92, 160], [ax + 100, 162]], '#1a0a10', 2, 1, false);
    circ(ax + 106, 182, 3, '#d81a40');
    T('ÉCLAT', ax + 210, 162, { size: 34, weight: 600, color: '#f6d6a0', ls: 8 });
    T('desire, bottled', ax + 210, 192, { size: 20, italic: true, color: '#f6d6a0' });
    g.restore();
    if (lure > 0) { glow(ax + 100, 170, 90, 'rgba(255,60,120,.8)', lure * (.6 + .3 * Math.sin(t * 5))); }
  });
}
function tunnel(t, speed, station = 0) {
  g.fillStyle = mixHex('#14141a', '#e8e4d8', station); g.fillRect(0, 260, W, 280);
  if (station < .9) {
    for (let k = 0; k < 14; k++) {
      const x = ((k * 260 - t * speed) % 3640 + 3640) % 3640 - 400;
      glow(x, 340 + (k % 3) * 50, 60, 'rgba(255,220,150,.9)', .8 * (1 - station));
      g.save(); g.globalAlpha = .6 * (1 - station); g.fillStyle = 'rgba(255,230,180,.8)'; g.fillRect(x - 120, 338 + (k % 3) * 50, 240, 3); g.restore();
    }
    for (let k = 0; k < 8; k++) { const x = ((k * 480 - t * speed * 1.4) % 3840 + 3840) % 3840 - 200; rect(x, 260, 26, 280, `rgba(30,30,36,${.8 * (1 - station)})`); }
  }
  if (station > 0) {
    withA(station, () => {
      for (let y = 260; y < 540; y += 22) for (let x = -((t * speed * .1) % 44); x < W; x += 44) rect(x, y, 40, 18, '#f0ece2');
      g.fillStyle = 'rgba(160,150,130,.4)'; for (let y = 260; y < 540; y += 22) g.fillRect(0, y + 18, W, 4);
      // mosaic name band
      rect(0, 360, W, 70, '#7a2a1e');
      for (const nx of [500, 1010, 1520]) T('42 ST', nx, 397, { size: 48, weight: 700, color: '#f4ecd8', ls: 10 });
    });
  }
}

/* ------------------------------------------------------------ MIDTOWN STREET (parallax) */
const STREET_TILE = 3600, MID_TILE = 3000, FAR_TILE = 2400;
function buildStreet() {
  // far skyline: Empire State + Chrysler, hazy blue
  BG.far = into(mk(FAR_TILE, 700), () => {
    const r = rng(41);
    let x = 0;
    while (x < FAR_TILE) { const w = 60 + r() * 120, h = 160 + r() * 260; rect(x, 700 - h, w, h, r() < .5 ? '#9fb2cc' : '#a8bad2'); x += w; }
    // empire state
    tr(700, 700, 1, 0, () => {
      g.fillStyle = '#8ea2c0';
      g.fillRect(-90, -300, 180, 300); g.fillRect(-60, -420, 120, 130); g.fillRect(-40, -500, 80, 90); g.fillRect(-24, -560, 48, 70);
      g.fillRect(-12, -620, 24, 70); g.fillRect(-3, -700, 6, 90);
      g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(-90, -300, 50, 300); g.fillRect(-60, -420, 30, 130);
    });
    // chrysler
    tr(1700, 700, 1, 0, () => {
      g.fillStyle = '#93a8c6'; g.fillRect(-60, -380, 120, 380);
      for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(0, -380 - k * 26, 56 - k * 9, 34 - k * 4, 0, Math.PI, TAU); g.fill(); }
      g.fillRect(-3, -560, 6, 60);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      for (let k = 0; k < 6; k++) for (let j = -2; j <= 2; j++) { g.beginPath(); g.moveTo(j * (10 - k), -386 - k * 26); g.lineTo(j * (10 - k), -400 - k * 26); g.stroke(); }
    });
  });
  // mid towers: tall, warm limestone and glass
  BG.mid = into(mk(MID_TILE, 1080), () => {
    const r = rng(52);
    let x = 0;
    while (x < MID_TILE) {
      const w = 220 + r() * 260, top = 80 + r() * 300;
      const base = ['#c8a888', '#b89878', '#9aa6b4', '#d4bc98', '#8a7a6e'][Math.floor(r() * 5)];
      g.fillStyle = lin(x, 0, x + w, 0, [[0, mixHex(base, '#ffffff', .12)], [1, mixHex(base, '#203050', .18)]]); g.fillRect(x, top, w, 1080 - top);
      rect(x - 6, top, w + 12, 14, mixHex(base, '#000000', .2));
      const glass = r() < .4;
      for (let wy = top + 34; wy < 1080; wy += glass ? 30 : 46) for (let wx = x + 16; wx < x + w - 20; wx += glass ? 24 : 34) {
        rect(wx, wy, glass ? 20 : 16, glass ? 24 : 28, glass ? `rgba(60,90,130,${.5 + r() * .3})` : `rgba(50,60,80,${.45 + r() * .2})`);
      }
      x += w + (r() < .25 ? 40 + r() * 80 : 0);
    }
  });
  // near street wall: shopfronts with apartments above, broken by cross-streets
  BG.near = into(mk(STREET_TILE, 1080), () => {
    const r = rng(63);
    const shops = [['DELI', '#2a6a3a'], ['PIZZA', '#b83a2a'], ['CAFÉ', '#3a2a1e'], ['BAGELS', '#d89a2a'], ['NAILS', '#c86aa0'], ['SHOES', '#2a3a6a'], ['BOOKS', '#5a2a3a'], ['RAMEN', '#1a1a1a'], ['FLOWERS', '#3a7a5a']];
    let x = 0, si = 0;
    while (x < STREET_TILE) {
      if (x > 400 && r() < .18) { x += 640; continue; } // cross street gap
      const w = 300 + r() * 220, top = 80 + r() * 330;
      const base = ['#8a4a36', '#a85a40', '#c4b49a', '#6a5a52', '#b8a080', '#7a3e30'][Math.floor(r() * 6)];
      g.fillStyle = lin(x, 0, x + w, 0, [[0, mixHex(base, '#ffffff', .08)], [1, mixHex(base, '#101020', .22)]]); g.fillRect(x, top, w, 860 - top);
      // cornice
      rect(x - 8, top, w + 16, 18, mixHex(base, '#000000', .25)); rect(x - 4, top + 18, w + 8, 6, mixHex(base, '#ffffff', .2));
      // windows with lintels
      for (let wy = top + 56; wy < 560; wy += 110) for (let wx = x + 30; wx < x + w - 60; wx += 86) {
        rect(wx - 4, wy - 10, 52, 8, mixHex(base, '#ffffff', .25));
        g.fillStyle = lin(wx, wy, wx + 44, wy + 74, [[0, '#4a5a74'], [1, '#2a3248']]); g.fillRect(wx, wy, 44, 74);
        rect(wx, wy + 35, 44, 4, mixHex(base, '#ffffff', .15)); rect(wx + 20, wy, 4, 74, mixHex(base, '#ffffff', .15));
        if (r() < .25) rect(wx + 2, wy + 2, 18, 32, 'rgba(255,220,160,.35)');
      }
      // fire escape on some
      if (r() < .45) {
        const fx = x + w * .3;
        g.strokeStyle = '#1e1e22'; g.lineWidth = 4;
        for (let fy = top + 140; fy < 560; fy += 110) {
          g.strokeRect(fx, fy, 180, 6); for (let k = 0; k <= 180; k += 12) { g.beginPath(); g.moveTo(fx + k, fy); g.lineTo(fx + k, fy - 34); g.stroke(); }
          g.beginPath(); g.moveTo(fx, fy - 34); g.lineTo(fx + 180, fy - 34); g.stroke();
          g.beginPath(); g.moveTo(fx + 20, fy + 6); g.lineTo(fx + 150, fy + 104); g.stroke();
        }
      }
      // shopfront
      const [name, col] = shops[si++ % shops.length];
      rect(x, 580, w, 280, '#2a2420');
      g.fillStyle = lin(0, 640, 0, 840, [[0, 'rgba(255,230,180,.55)'], [1, 'rgba(255,200,140,.25)']]); g.fillRect(x + 20, 650, w - 120, 190);
      for (let k = 0; k < 4; k++) rect(x + 30 + k * ((w - 140) / 4), 690 + (k % 2) * 30, 30, 50, `hsl(${(si * 40 + k * 60) % 360},50%,55%)`);
      rect(x + w - 90, 650, 70, 210, '#1a1612'); rect(x + w - 82, 660, 54, 120, 'rgba(255,220,160,.35)');
      // awning
      g.fillStyle = col; g.beginPath(); g.moveTo(x + 4, 580); g.lineTo(x + w - 4, 580); g.lineTo(x + w + 16, 640); g.lineTo(x - 16, 640); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)'; for (let k = x; k < x + w; k += 40) { g.beginPath(); g.moveTo(k, 580); g.lineTo(k + 20, 580); g.lineTo(k + 26, 640); g.lineTo(k + 4, 640); g.closePath(); g.fill(); }
      T(name, x + w / 2, 612, { size: 34, weight: 700, color: '#fbf3e0', ls: 6 });
      x += w;
    }
    // sidewalk
    g.fillStyle = lin(0, 860, 0, 1000, [[0, '#a8a29a'], [1, '#8a847c']]); g.fillRect(0, 860, STREET_TILE, 140);
    g.strokeStyle = 'rgba(60,50,40,.25)'; g.lineWidth = 2;
    for (let k = 0; k < STREET_TILE; k += 120) { g.beginPath(); g.moveTo(k, 860); g.lineTo(k - 30, 1000); g.stroke(); }
    rect(0, 996, STREET_TILE, 14, '#c8c2b8'); rect(0, 1010, STREET_TILE, 70, '#3a3a40');
    // street furniture
    for (let k = 300; k < STREET_TILE; k += 900) {
      rect(k, 520, 10, 360, '#2a3a2e'); g.fillStyle = '#2a3a2e'; g.beginPath(); g.ellipse(k + 5, 520, 26, 10, 0, 0, TAU); g.fill();
      glow(k + 5, 530, 40, 'rgba(255,230,180,.6)', .3);
    }
    for (let k = 700; k < STREET_TILE; k += 1300) { g.fillStyle = '#c83a2a'; rr(k, 940, 26, 44, 8); g.fill(); rect(k - 6, 952, 38, 8, '#a82a1e'); }
    for (let k = 1100; k < STREET_TILE; k += 1500) { g.fillStyle = '#3a4a3a'; rr(k, 900, 50, 84, 6); g.fill(); }
  });
}
function streetSky(t, rain) {
  const c = rain;
  skyGrad([[0, mixHex('#5a8ad8', '#6a7084', c)], [.6, mixHex('#a8c8ec', '#9a9ca8', c)], [1, mixHex('#f4e4c8', '#b8b8c0', c)]], 0, 800);
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 700 + 200 - t * 8) % 2800 + 2800) % 2800 - 400;
    cumulus(cx, 300 + (i % 2) * 80, 360 + i * 40, 150, 20 + i, {
      shadow: mixHex('#9aaacc', '#5a5e6e', c), mid: mixHex('#e8eef8', '#8a8e9c', c), light: c > .5 ? 'rgba(200,200,210,.6)' : 'rgba(255,255,255,.95)', baseHex: mixHex('#9aaacc', '#5a5e6e', c),
    });
  }
}
function drawTiled(img, off, y = 0, h) {
  const w = img.width;
  let x = -(((off % w) + w) % w);
  for (; x < W; x += w) g.drawImage(img, x, y, w, h || img.height);
}
// a manhole steam stack (orange and white striped chimney)
function steamStack(x, y, t, s = 1) {
  tr(x, y, s, 0, () => {
    for (let i = 0; i < 9; i++) {
      const u = (t * .35 + i / 9) % 1;
      circ(Math.sin(u * 5 + i) * 18 + u * 40, -110 - u * 380, 30 + u * 90, 'rgba(240,240,240,.18)', 1 - u);
    }
    for (let k = 0; k < 5; k++) rect(-22, -110 + k * 22, 44, 22, k % 2 ? '#f4f0e8' : '#e8762a');
  });
}
function cab(x, y, s, t) {
  tr(x, y, s, 0, () => {
    g.fillStyle = '#f2c21a'; rr(-120, -60, 240, 52, 14); g.fill();
    g.beginPath(); g.moveTo(-70, -60); g.lineTo(-50, -100); g.lineTo(50, -100); g.lineTo(80, -60); g.closePath(); g.fill();
    g.fillStyle = '#2a3a4a'; g.beginPath(); g.moveTo(-60, -62); g.lineTo(-44, -94); g.lineTo(-4, -94); g.lineTo(-4, -62); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(4, -62); g.lineTo(4, -94); g.lineTo(46, -94); g.lineTo(70, -62); g.closePath(); g.fill();
    rect(-24, -116, 48, 16, '#f6f0d8'); T('TAXI', 0, -107, { size: 13, weight: 700, color: '#222' });
    rect(-120, -36, 240, 4, '#1a1a1a'); for (let k = -100; k < 100; k += 12) rect(k, -32, 6, 6, (k / 12 | 0) % 2 ? '#1a1a1a' : '#f2c21a');
    for (const wx of [-72, 72]) { circ(wx, -8, 24, '#1a1a1e'); circ(wx, -8, 11, '#8a8a90'); }
    glow(116, -40, 40, 'rgba(255,240,200,.8)', .6);
  });
}
function billboard(x, y, w, h, t, eyes = 0) {
  // a fashion billboard: a serene face, which can open gold fox eyes
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = lin(x, y, x + w, y + h, [[0, '#f2d8c8'], [1, '#d8a8a0']]); g.fillRect(x, y, w, h);
  const cx = x + w * .38, cy = y + h * .56, s = h / 240;
  g.fillStyle = '#2a1414'; g.beginPath(); g.ellipse(cx, cy - 18 * s, 90 * s, 110 * s, 0, 0, TAU); g.fill();
  g.fillStyle = '#f6d4bc'; g.beginPath(); g.ellipse(cx + 6 * s, cy + 6 * s, 64 * s, 84 * s, 0, 0, TAU); g.fill();
  for (const ex of [-22, 30]) {
    if (eyes > 0) { ell(cx + ex * s, cy - 4 * s, 13 * s, 7 * s * eyes, C.gold); ell(cx + ex * s, cy - 4 * s, 2.5 * s, 6 * s * eyes, '#1a0606'); }
    stroke([[cx + (ex - 14) * s, cy - 4 * s], [cx + ex * s, cy + 2 * s], [cx + (ex + 14) * s, cy - 4 * s]], '#2a1414', 3 * s, 1 - eyes);
  }
  g.fillStyle = '#c8243a'; g.beginPath(); g.ellipse(cx + 4 * s, cy + 48 * s, 16 * s, 6 * s, 0, 0, TAU); g.fill();
  T('ÉCLAT', x + w * .78, y + h * .4, { size: 44 * s, weight: 600, color: '#5a1a28', ls: 10 * s });
  T('want more', x + w * .78, y + h * .58, { size: 26 * s, italic: true, color: '#5a1a28' });
  g.restore();
  g.lineWidth = 8; g.strokeStyle = '#2a2a2e'; g.strokeRect(x, y, w, h);
  if (eyes > 0) glow(cx, cy, 160 * s, 'rgba(255,60,110,.7)', eyes * .6);
}
function rain(t, a, wind = .25, seed = 1) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.strokeStyle = 'rgba(210,220,240,.55)'; g.lineWidth = 1.6; g.beginPath();
  const r = rng(seed);
  for (let i = 0; i < 260; i++) {
    const x0 = r() * (W + 300), sp = 900 + r() * 500, y = ((r() * H + t * sp) % (H + 100)) - 50;
    const x = (x0 - y * wind) % (W + 300);
    g.moveTo(x, y); g.lineTo(x - 40 * wind, y + 40);
  }
  g.stroke(); g.restore();
}

/* ------------------------------------------------------------ OFFICE */
function buildOffice() {
  return into(mk(), () => {
    g.fillStyle = lin(0, 0, 0, 760, [[0, '#c4c8c4'], [1, '#aab0ac']]); g.fillRect(0, 0, W, 760);
    // big window
    g.clearRect(760, 90, 1060, 560);
    rect(750, 80, 1080, 12, '#5a5e62'); rect(750, 646, 1080, 14, '#5a5e62');
    for (const k of [0, 1, 2, 3]) rect(750 + k * 356, 80, 12, 580, '#5a5e62');
    // ceiling lights
    for (const lx of [200, 900, 1600]) { rect(lx, 0, 300, 18, '#f4f8f4'); glow(lx + 150, 20, 200, 'rgba(240,250,255,.3)', .5); }
    // wall clock frame
    circ(330, 220, 92, '#2a2a2e'); circ(330, 220, 82, '#f8f6ee');
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; rect(330 + Math.cos(a) * 70 - 3, 220 + Math.sin(a) * 70 - 3, 6, 6, '#2a2a2e'); }
    // cubicle partition
    rect(0, 520, 640, 240, '#7a8a9a'); rect(0, 510, 640, 14, '#5a6a7a');
    for (let k = 0; k < 5; k++) { rect(40 + k * 110, 560, 70, 90, ['#f4e48a', '#a8d8f0', '#f4b0c0', '#f4e48a', '#c8f0a8'][k]); }
    // desk
    g.fillStyle = lin(0, 740, 0, 780, [[0, '#d8c8a8'], [1, '#b8a888']]); g.fillRect(300, 740, 1500, 40);
    rect(300, 780, 1500, 300, '#8a7a62'); rect(330, 800, 1440, 4, 'rgba(0,0,0,.25)');
    g.fillStyle = lin(0, 760, 0, H, [[0, '#6a6a72'], [1, '#4a4a52']]); g.fillRect(0, 760, 300, 320); g.fillRect(1800, 760, 120, 320);
    // monitor
    rect(1250, 470, 420, 260, '#1e1e24'); rect(1262, 482, 396, 230, '#3a5a8a');
    for (let k = 0; k < 8; k++) rect(1290, 510 + k * 24, 120 + (k * 53 % 200), 8, 'rgba(255,255,255,.4)');
    rect(1440, 730, 40, 14, '#2a2a30'); rect(1400, 736, 120, 6, '#2a2a30');
    // plant + mug
    g.fillStyle = '#c87a4a'; g.beginPath(); g.moveTo(1690, 742); g.lineTo(1760, 742); g.lineTo(1750, 690); g.lineTo(1700, 690); g.closePath(); g.fill();
    for (let k = 0; k < 7; k++) tr(1725, 690, 1, -1 + k * .33, () => { g.beginPath(); g.ellipse(0, -36, 9, 36, 0, 0, TAU); g.fillStyle = k % 2 ? '#3a7a4a' : '#4a9a5a'; g.fill(); });
    g.fillStyle = '#f4f0e6'; rr(1180, 690, 40, 52, 6); g.fill();
  });
}
function officeWindow(t, dark) {
  g.save(); g.beginPath(); g.rect(760, 90, 1060, 560); g.clip();
  skyGrad([[0, mixHex('#7a8090', '#2a2030', dark)], [1, mixHex('#a8acb4', '#4a3040', dark)]], 90, 650);
  const r = rng(70);
  let x = 740;
  while (x < 1840) { const w = 60 + r() * 120, h = 160 + r() * 340; rect(x, 650 - h, w, h, mixHex(r() < .5 ? '#5a6070' : '#646a7a', '#1a1420', dark)); for (let wy = 660 - h; wy < 650; wy += 22) for (let wx = x + 8; wx < x + w - 8; wx += 16) if (r() < .5) rect(wx, wy, 8, 10, `rgba(220,230,240,${.25 - dark * .15})`); x += w + 6; }
  rain(t, .7, .15, 9);
  // droplets on the glass
  for (let i = 0; i < 40; i++) {
    const dx = 770 + hash(i) * 1040, dy = 100 + ((hash(i * 2) * 540 + t * (8 + hash(i * 5) * 30)) % 540);
    circ(dx, dy, 2 + hash(i * 3) * 4, 'rgba(230,240,255,.35)');
  }
  g.restore();
}
function clockHands(t, hours) {
  const h = hours % 12, m = (hours * 60) % 60;
  tr(330, 220, 1, 0, () => {
    g.lineCap = 'round';
    g.strokeStyle = '#1a1a1e'; g.lineWidth = 8; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(h / 12 * TAU) * 40, -Math.cos(h / 12 * TAU) * 40); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(m / 60 * TAU) * 64, -Math.cos(m / 60 * TAU) * 64); g.stroke();
    circ(0, 0, 7, '#c83a2a');
  });
}

/* ------------------------------------------------------------ CENTRAL PARK */
function treeClump(x, y, w, h, seed, cols) {
  const r = rng(seed);
  const n = Math.round(w * h / 1800);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r());
    blobs.push([x + Math.cos(a) * d * w / 2, y + Math.sin(a) * d * h / 2, 16 + r() * 36]);
  }
  blobs.sort((p, q) => p[1] - q[1]);
  for (const [bx, by, br] of blobs) circ(bx + 6, by + 10, br, cols[0]);
  for (const [bx, by, br] of blobs) circ(bx, by, br * .9, cols[1]);
  for (const [bx, by, br] of blobs) if (by < y + h * .1) circ(bx - br * .25, by - br * .3, br * .55, cols[2], .9);
  for (const [bx, by, br] of blobs) if (by < y - h * .15 && r() < .5) circ(bx - br * .3, by - br * .4, br * .3, cols[3], .8);
}
function buildPark() {
  // skyline over the trees (transparent sky)
  BG.parkCity = into(mk(), () => {
    const r = rng(80);
    let x = 0;
    while (x < W) {
      const w = 40 + r() * 90, h = 50 + r() * 150;
      const tall = r() < .12 ? 120 + r() * 80 : 0;
      g.fillStyle = lin(0, 520 - h - tall, 0, 540, [[0, r() < .5 ? '#8c98b6' : '#98a2bc'], [1, '#c8cce0']]);
      g.fillRect(x, 520 - h - tall, w, h + tall + 40);
      if (tall) { g.fillRect(x + w * .3, 520 - h - tall - 30, w * .4, 30); g.fillRect(x + w * .48, 520 - h - tall - 70, w * .04, 40); }
      x += w + r() * 30;
    }
  });
  BG.parkWin = (() => { const r = rng(81), out = []; for (let i = 0; i < 260; i++) out.push([r() * W, 120 + r() * 380, r()]); return out; })();
  BG.parkFar = into(mk(), () => {
    treeClump(300, 520, 700, 120, 1, ['#3a5a3a', '#4a6e44', '#6a8a4e', '#8aa85a']);
    treeClump(960, 530, 900, 110, 2, ['#3a5a3a', '#4a6e44', '#6a8a4e', '#8aa85a']);
    treeClump(1650, 515, 700, 130, 3, ['#3a5a3a', '#4a6e44', '#6a8a4e', '#8aa85a']);
  });
  BG.parkNear = into(mk(), () => {
    // lawn
    g.fillStyle = lin(0, 540, 0, H, [[0, '#7aa04a'], [1, '#4a7a34']]); g.fillRect(0, 540, W, 540);
    // lake on the right
    g.fillStyle = lin(0, 580, 0, 760, [[0, '#9ab8c8'], [1, '#6a8aa0']]);
    g.beginPath(); g.moveTo(1150, 600); g.quadraticCurveTo(1500, 560, W, 590); g.lineTo(W, 760); g.quadraticCurveTo(1500, 740, 1250, 700); g.quadraticCurveTo(1080, 660, 1150, 600); g.fill();
    // path
    g.fillStyle = lin(0, 700, 0, H, [[0, '#d8c8a4'], [1, '#c4ae86']]);
    g.beginPath(); g.moveTo(-50, 1080); g.quadraticCurveTo(500, 760, 1100, 790); g.quadraticCurveTo(1500, 800, 1980, 760); g.lineTo(1980, 880); g.quadraticCurveTo(1500, 900, 1100, 900); g.quadraticCurveTo(700, 920, 400, 1080); g.closePath(); g.fill();
    // puddles reflecting the sky
    for (const [px, py, pw] of [[700, 900, 120], [1400, 850, 160], [1000, 860, 70]]) { g.fillStyle = 'rgba(200,220,240,.75)'; g.beginPath(); g.ellipse(px, py, pw, 14, 0, 0, TAU); g.fill(); }
    // grass tufts
    const r = rng(90);
    for (let i = 0; i < 500; i++) { const x = r() * W, y = 560 + r() * 520; stroke([[x, y], [x + (r() - .5) * 6, y - 8 - r() * 10]], r() < .5 ? '#5a8a3a' : '#8ab85a', 2, .7, false); }
    // lamp post
    tr(1580, 820, 1, 0, () => {
      rect(-6, -300, 12, 300, '#1e2a22'); rect(-14, -20, 28, 20, '#1e2a22');
      g.fillStyle = '#1e2a22'; g.beginPath(); g.moveTo(-22, -300); g.lineTo(22, -300); g.lineTo(14, -350); g.lineTo(-14, -350); g.closePath(); g.fill();
      rect(-10, -344, 20, 40, 'rgba(255,240,200,.5)'); circ(0, -356, 8, '#1e2a22');
    });
    // big tree framing the left
    g.fillStyle = lin(120, 0, 260, 0, [[0, '#3a2a1e'], [1, '#5a4030']]);
    g.beginPath(); g.moveTo(100, 1080); g.quadraticCurveTo(160, 700, 140, 300); g.lineTo(250, 300); g.quadraticCurveTo(230, 700, 300, 1080); g.closePath(); g.fill();
    g.strokeStyle = '#4a3424'; g.lineWidth = 22; g.lineCap = 'round';
    g.beginPath(); g.moveTo(200, 420); g.quadraticCurveTo(320, 300, 470, 260); g.stroke();
    treeClump(260, 140, 760, 360, 7, ['#2a4a2a', '#3a6a36', '#5a8a42', '#a8c860']);
    treeClump(1880, 120, 400, 360, 8, ['#2a4a2a', '#3a6a36', '#5a8a42', '#a8c860']);

  });
}
function parkSky(t, dusk) {
  // dusk: 0 golden afternoon -> 1 sunset -> 2 night
  const d1 = clamp(dusk), d2 = clamp(dusk - 1);
  const top = mixHex(mixHex('#6aa0d8', '#5a5a9a', d1), '#0e1230', d2);
  const mid = mixHex(mixHex('#f0d8a0', '#f4906a', d1), '#3a2a5a', d2);
  const low = mixHex(mixHex('#fff0c8', '#ffc88a', d1), '#6a3a5a', d2);
  skyGrad([[0, top], [.55, mid], [1, low]], 0, 560);
  const sunY = 260 + dusk * 200;
  glow(1300, sunY, 300, `rgba(255,${230 - d1 * 60},${170 - d1 * 80},.9)`, 1 - d2, 'source-over');
  circ(1300, sunY, 40, mixHex('#fff6e0', '#ffb070', d1), 1 - d2);
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 640 + 100 + t * 6) % 2600) - 300;
    cumulus(cx, 230 + (i % 2) * 70, 320, 110, 30 + i, {
      shadow: mixHex(mixHex('#a8a0c0', '#8a5a7a', d1), '#1a1a3a', d2), mid: mixHex(mixHex('#f8f0e8', '#f4b0a0', d1), '#2a2a4a', d2),
      light: d2 > .5 ? 'rgba(80,80,120,.4)' : `rgba(255,${240 - d1 * 50},${200 - d1 * 60},.95)`, baseHex: mixHex('#a8a0c0', '#1a1a3a', d2),
    });
  }
  if (d2 > 0) for (let i = 0; i < 60; i++) circ(hash(i) * W, hash(i * 2) * 360, 1.2, '#f0f0ff', d2 * (.5 + .5 * Math.sin(t * 2 + i)));
}
function park(t, dusk) {
  const d1 = clamp(dusk), d2 = clamp(dusk - 1);
  parkSky(t, dusk);
  g.drawImage(BG.parkCity, 0, 0);
  fillAll(mixHex(mixHex('#c8d4f0', '#f0a090', d1), '#101830', d2), .35 + d2 * .4, 'multiply');
  if (d1 > .5) for (const [x, y, r] of BG.parkWin) if (r < (d1 - .5) * 1.4 + d2 * .4) { const yy = y + 20; if (yy < 520) rect(x, yy, 5, 7, '#ffd890'); }
  g.drawImage(BG.parkFar, 0, 0);
  g.drawImage(BG.parkNear, 0, 0);
}
function parkGrade(t, dusk) {
  const d1 = clamp(dusk), d2 = clamp(dusk - 1);
  fillAll(mixHex('#ffe0a0', '#ff8a5a', d1), .18 * (1 - d2), 'soft-light');
  fillAll(mixHex('#ffffff', '#202850', d2), d2 * .55 + d1 * .1, 'multiply');
}

/* ------------------------------------------------------------ TIMES SQUARE (night, one-point perspective) */
const VP = [960, 470];
function persp(x, y, k) { return [lerp(VP[0], x, k), lerp(VP[1], y, k)]; }
function buildTimesSquare() {
  return into(mk(), () => {
    skyGrad([[0, '#06040e'], [.5, '#1a0e2a'], [1, '#3a1a3a']], 0, 600);
    // central tower (One Times Square) and distant buildings
    rect(870, 140, 180, 360, '#1a1626'); rect(890, 100, 140, 50, '#1a1626');
    // street
    g.fillStyle = lin(0, 470, 0, H, [[0, '#1a1422'], [1, '#2a2230']]);
    g.beginPath(); g.moveTo(VP[0] - 60, 470); g.lineTo(VP[0] + 60, 470); g.lineTo(W + 600, H); g.lineTo(-600, H); g.closePath(); g.fill();
    // crosswalk
    for (let k = -8; k <= 8; k++) {
      const a = persp(960 + k * 120, 960, 1), b = persp(960 + k * 120 + 60, 960, 1);
      g.fillStyle = 'rgba(230,230,240,.35)';
      g.beginPath(); g.moveTo(a[0], 900); g.lineTo(b[0], 900); g.lineTo(b[0] + k * 6, 990); g.lineTo(a[0] + k * 6, 990); g.closePath(); g.fill();
    }
    // building walls on both sides
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const k0 = 1.6 - i * .28, k1 = k0 - .28;
        const xo = side * 1150;
        const p = (x, y, k) => persp(VP[0] + x, y, k);
        const a = p(xo, -200, k0), b = p(xo, -200, k1), c = p(xo, 1000, k1), d = p(xo, 1000, k0);
        g.fillStyle = mixHex('#1e1a2a', '#2a2238', i % 2);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
        // window grid
        g.fillStyle = 'rgba(255,220,160,.25)';
        for (let wy = -150; wy < 120; wy += 46) for (let f = .1; f < .9; f += .2) {
          const q = p(xo, wy, lerp(k0, k1, f));
          g.fillRect(q[0] - 3, q[1], 6, 8 * lerp(k0, k1, f));
        }
      }
    }
  });
}
// billboard quads on the side walls; content is live
const BOARDS = [
  { side: -1, k0: 1.55, k1: 1.08, y0: -120, y1: 360, kind: 'face' },
  { side: 1, k0: 1.55, k1: 1.1, y0: -60, y1: 420, kind: 'red' },
  { side: -1, k0: 1.02, k1: .72, y0: 120, y1: 470, kind: 'blue' },
  { side: 1, k0: 1.05, k1: .74, y0: 60, y1: 380, kind: 'gold' },
  { side: -1, k0: .7, k1: .46, y0: 50, y1: 330, kind: 'pink' },
  { side: 1, k0: .7, k1: .46, y0: 140, y1: 420, kind: 'cyan' },
  { side: 0, k0: 1, k1: 1, y0: 170, y1: 340, kind: 'center' },
];
function boards(t, possessed) {
  for (const b of BOARDS) {
    let quad;
    if (b.side === 0) quad = [[880, 170], [1040, 170], [1040, 330], [880, 330]];
    else {
      const xo = b.side * 1150, p = (y, k) => persp(VP[0] + xo, y, k);
      quad = [p(b.y0, b.k0), p(b.y0, b.k1), p(b.y1, b.k1), p(b.y1, b.k0)];
    }
    g.save();
    g.beginPath(); g.moveTo(quad[0][0], quad[0][1]); for (const q of quad.slice(1)) g.lineTo(q[0], q[1]); g.closePath(); g.clip();
    const xs = quad.map(q => q[0]), ys = quad.map(q => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const hue = { face: 340, red: 0, blue: 220, gold: 45, pink: 320, cyan: 185, center: 280 }[b.kind];
    const flick = .85 + .15 * Math.sin(t * 7 + hue);
    g.fillStyle = lin(x0, y0, x1, y1, [[0, `hsl(${hue + Math.sin(t) * 20},80%,${45 * flick}%)`], [1, `hsl(${hue + 40},70%,${25 * flick}%)`]]);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    // moving shapes
    for (let k = 0; k < 4; k++) circ(lerp(x0, x1, (k * .3 + t * .1 * (k + 1)) % 1), lerp(y0, y1, .3 + .4 * Math.sin(t + k)), (x1 - x0) * .12, `hsla(${hue + 60 * k},90%,70%,.5)`);
    if (possessed > 0) {
      // the screens all become the lust yokai's eyes
      g.globalAlpha = possessed;
      g.fillStyle = '#1a0408'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ew = (x1 - x0) * .18;
      for (const sx of [-1, 1]) {
        g.save(); g.translate(cx + sx * ew * 1.3, cy); g.scale(sx, 1);
        g.beginPath(); g.moveTo(-ew, ew * .3); g.quadraticCurveTo(0, -ew * .8, ew * 1.2, -ew * .5); g.quadraticCurveTo(ew * .4, ew * .6, -ew, ew * .3); g.fillStyle = C.gold; g.fill();
        ell(0, -ew * .05, ew * .12, ew * .45, '#1a0404');
        g.restore();
      }
    }
    g.restore();
    glow((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) * .9, `hsla(${possessed > .5 ? 350 : hue},90%,60%,.6)`, .35);
  }
}
// neon reflections smeared across the wet street
function wetStreet(t, possessed) {
  g.save(); g.globalCompositeOperation = 'lighter';
  const cols = [340, 0, 220, 45, 320, 185];
  cols.forEach((h, i) => {
    const side = i % 2 ? 1 : -1, x = 960 + side * (220 + (i >> 1) * 140);
    const hue = possessed > .5 ? 350 : h;
    g.fillStyle = lin(0, 560, 0, H, [[0, `hsla(${hue},90%,60%,.0)`], [.4, `hsla(${hue},90%,60%,.16)`], [1, `hsla(${hue},90%,60%,.04)`]]);
    g.beginPath(); g.moveTo(x - 30, 560); g.lineTo(x + 30, 560); g.lineTo(x + side * 200 + 90 + Math.sin(t * 2 + i) * 10, H); g.lineTo(x + side * 200 - 90, H); g.closePath(); g.fill();
  });
  g.restore();
}
