/* strangers: "The web of knowing". A three.js crowd (with a 2D canvas fallback) that draws a jury of twelve
   from places of different sizes and counts how many jurors know you. Seal: 'strangers'. */
(function () {
  'use strict';

  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

  /* ---- facts and settings (edit here) ---- */
  var DATA = {
    knowDefault: 600,   // about 600 people known: mean 611, median 472 (McCormick, Salganik and Zheng 2010)
    knowMin: 50,
    knowMax: 1500,      // Dunbar's 1,500 layer: faces you can put a name to
    maxDots: 9000,
    modes: [
      { id: 'band', chip: 'Band', size: '40 people', N: 40, rule: 'neighbors', layout: 'ring', dotPx: 11,
        place: 'A foraging band',
        note: 'In a band of a few dozen, everyone is kin, friend or rival. Any jury here is a jury of people who know you.' },
      { id: 'vill', chip: 'Village, 1300', size: '300 people', N: 300, rule: 'neighbors', layout: 'village', dotPx: 7,
        place: 'An English village, about 1300',
        note: 'In a village of a few hundred you know nearly everyone by name. Medieval jurors came from the neighborhood because they knew the people and the facts.' },
      { id: 'town', chip: 'Market town', size: '5,000 people', N: 5000, rule: 'random', layout: 'town', dotPx: 3.2,
        place: 'A market town',
        note: 'In a town of 5,000 you might know one person in eight. A random jury would usually still seat someone who knows you.' },
      { id: 'city', chip: 'Manhattan, 2026', size: '1.2 million adult citizens', N: 1200000, rule: 'random', layout: 'island', dotPx: 2.2,
        place: 'Manhattan today',
        note: 'In Manhattan a random jury almost never seats anyone who knows you. Courts now count that as a feature: knowing the accused is a reason to send a juror home.' }
    ]
  };

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function pct(p) {
    if (p >= 0.9995) return '100%';
    if (p >= 0.995) return '>99%';
    if (p >= 0.1) return Math.round(p * 100) + '%';
    if (p >= 0.01) return (p * 100).toFixed(1) + '%';
    if (p >= 0.0001) return (p * 100).toFixed(2) + '%';
    return '<0.01%';
  }
  function token(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; }

  // small seeded RNG so layouts are stable for a mode
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // chance that at least one of 12 jurors drawn without replacement from N knows you, when k people do
  function pAtLeastOne(N, k, n) {
    if (k <= 0) return 0;
    if (N - k < n) return 1;
    var q = 1;
    for (var i = 0; i < n; i++) q *= (N - k - i) / (N - i);
    return 1 - q;
  }

  /* ---- layouts: returns positions [x, z] in world units, index 0 is "you" at the origin ---- */
  function buildLayout(mode, dots) {
    var r = rng(mode.id.length * 7919 + 13);
    var pts = [[0, 0]];
    var i, a, rad;
    if (mode.layout === 'ring') {
      for (i = 1; i < dots; i++) {
        a = (i / (dots - 1)) * Math.PI * 2;
        rad = 6 + (r() - 0.5) * 0.9;
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
    } else if (mode.layout === 'village') {
      // households clustered along a winding lane
      var houses = Math.ceil((dots - 1) / 5);
      for (var h = 0; h < houses; h++) {
        var t = h / houses;
        var lane = (t - 0.5) * 34;
        var side = (h % 2 ? 1 : -1) * (3 + r() * 4);
        var hx = lane + (r() - 0.5) * 3;
        var hz = Math.sin(t * 5) * 4 + side;
        for (var m = 0; m < 5 && pts.length < dots; m++) pts.push([hx + (r() - 0.5) * 1.8, hz + (r() - 0.5) * 1.8]);
      }
    } else if (mode.layout === 'town') {
      var side2 = Math.ceil(Math.sqrt(dots * 1.35));
      var cand = [];
      for (var gx = 0; gx < side2; gx++) {
        for (var gz = 0; gz < side2; gz++) {
          if (gx % 7 === 3 || gz % 7 === 3) continue; // streets
          var x = (gx - side2 / 2) * 1.0, z = (gz - side2 / 2) * 1.0;
          if (x * x + z * z > (side2 / 2) * (side2 / 2)) continue;
          cand.push([x + (r() - 0.5) * 0.5, z + (r() - 0.5) * 0.5]);
        }
      }
      cand.sort(function () { return r() - 0.5; });
      for (i = 0; pts.length < dots && i < cand.length; i++) if (Math.abs(cand[i][0]) + Math.abs(cand[i][1]) > 0.8) pts.push(cand[i]);
    } else {
      // a long, narrow island with a tilted street grid
      var L = 190, Wmax = 34, tilt = 29 * Math.PI / 180;
      var tries = 0;
      while (pts.length < dots && tries < dots * 20) {
        tries++;
        var u = r(), v = r() - 0.5;
        var width = Wmax * (0.35 + 0.65 * Math.sin(Math.min(1, u * 1.15) * Math.PI) * (u < 0.12 ? u / 0.12 : 1));
        var lx = (u - 0.5) * L, lz = v * width;
        // avenues run along the island, streets across it
        if (Math.abs(((lz + 100) % 5.4)) < 0.9) continue;
        if (Math.abs(((lx + 400) % 2.6)) < 0.45) continue;
        var cx = lx * Math.cos(tilt) - lz * Math.sin(tilt);
        var cz = lx * Math.sin(tilt) + lz * Math.cos(tilt);
        if (cx * cx + cz * cz < 1.5) continue;
        pts.push([cx, cz]);
      }
    }
    return pts;
  }

  TS.register('strangers', function (el, ctx) {
    var state = {
      mode: DATA.modes[3],
      know: DATA.knowDefault,
      rule: 'random',
      ruleTouched: false,
      jury: null,           // [{knows, dot}]
      drawsByMode: {},
      azimuth: 0.6,
      drag: null
    };

    el.innerHTML =
      '<div class="w-str">' +
        '<div class="w-str-modes" role="group" aria-label="Choose a place">' +
          DATA.modes.map(function (m) {
            return '<button type="button" class="w-str-mode" data-mode="' + m.id + '" aria-pressed="false"><span>' + m.chip + '</span><small>' + m.size + '</small></button>';
          }).join('') +
        '</div>' +
        '<div class="w-str-stage">' +
          '<canvas class="w-str-c2d" role="img"></canvas>' +
          '<canvas class="w-str-c3d" aria-hidden="true"></canvas>' +
          '<div class="w-str-place typed"></div>' +
          '<div class="w-str-scale typed"></div>' +
          '<ul class="w-str-legend typed" aria-hidden="true">' +
            '<li><i class="is-you"></i>You</li><li><i class="is-know"></i>Knows you</li><li><i class="is-crowd"></i>Everyone else</li>' +
          '</ul>' +
        '</div>' +
        '<div class="w-str-controls">' +
          '<div class="w-str-range">' +
            '<label for="w-str-know" class="label">People who know you by name</label>' +
            '<output class="w-str-know-out typed tnum" for="w-str-know"></output>' +
            '<input type="range" id="w-str-know" min="' + DATA.knowMin + '" max="' + DATA.knowMax + '" step="10">' +
            '<p class="w-str-range-note">About 600 is a typical estimate for an American adult. 150 is Dunbar\'s number for close ties.</p>' +
          '</div>' +
          '<div class="w-str-rule">' +
            '<span class="label" id="w-str-rule-label">How jurors are picked</span>' +
            '<div class="chips" role="group" aria-labelledby="w-str-rule-label">' +
              '<button type="button" class="chip" data-rule="neighbors" aria-pressed="false">Neighbors who know (1300)</button>' +
              '<button type="button" class="chip" data-rule="random" aria-pressed="false">Random draw (today)</button>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn w-str-draw">Draw a jury of twelve</button>' +
        '</div>' +
        '<div class="w-str-result">' +
          '<ol class="w-str-box" aria-label="The jury box"></ol>' +
          '<div class="w-str-readout" aria-live="polite">' +
            '<p class="w-str-big"><b class="tnum">?</b> <span>of 12 jurors know you</span></p>' +
            '<dl class="w-str-stats">' +
              '<div><dt>Chance at least one juror knows you</dt><dd class="tnum w-str-p"></dd></div>' +
              '<div><dt>Jurors who know you, on average</dt><dd class="tnum w-str-e"></dd></div>' +
            '</dl>' +
            '<p class="w-str-note"></p>' +
            '<p class="w-str-insight" hidden></p>' +
          '</div>' +
        '</div>' +
      '</div>';

    var $ = function (s) { return el.querySelector(s); };
    var c2d = $('.w-str-c2d'), c3d = $('.w-str-c3d'), stage = $('.w-str-stage');
    var knowInput = $('#w-str-know'), knowOut = $('.w-str-know-out');
    var box = $('.w-str-box');
    var seatsHtml = '';
    for (var s = 0; s < 12; s++) {
      seatsHtml += '<li class="w-str-seat" aria-label="Seat ' + (s + 1) + ', empty"><svg viewBox="0 0 24 30" aria-hidden="true"><circle cx="12" cy="7.5" r="5.2"/><path d="M2.5 29c0-7.2 4.2-12.5 9.5-12.5S21.5 21.8 21.5 29z"/></svg></li>';
    }
    box.innerHTML = seatsHtml;
    var seatEls = box.querySelectorAll('.w-str-seat');
    knowInput.value = state.know;

    /* ---- model for the current mode ---- */
    var model = null;
    function kEff() { return Math.max(0, Math.min(state.know, state.mode.N - 1)); }
    function buildModel() {
      var mode = state.mode;
      var dots = Math.min(mode.N, DATA.maxDots);
      var perDot = mode.N / dots;
      var pos = buildLayout(mode, dots);
      dots = pos.length;
      var k = kEff();
      var knowDots = Math.min(dots - 1, k >= mode.N - 1 ? dots - 1 : Math.max(k > 0 ? 1 : 0, Math.round(k / perDot)));
      // pick acquaintances: mostly the nearest dots, some scattered
      var order = [];
      for (var i = 1; i < dots; i++) order.push(i);
      var r = rng(dots * 31 + 7);
      var near = order.slice().sort(function (a, b) {
        var da = pos[a][0] * pos[a][0] + pos[a][1] * pos[a][1], db = pos[b][0] * pos[b][0] + pos[b][1] * pos[b][1];
        return da - db;
      });
      var isKnow = new Uint8Array(dots);
      var nearShare = mode.layout === 'island' ? 0.35 : 0.65;
      var nNear = Math.round(knowDots * nearShare), picked = 0;
      for (i = 0; i < near.length && picked < nNear; i++) { isKnow[near[i]] = 1; picked++; }
      var guard = 0;
      while (picked < knowDots && guard < dots * 10) {
        guard++;
        var j = 1 + Math.floor(r() * (dots - 1));
        if (!isKnow[j]) { isKnow[j] = 1; picked++; }
      }
      var knowList = [], crowdList = [];
      for (i = 1; i < dots; i++) (isKnow[i] ? knowList : crowdList).push(i);
      // a web among others, for the small places
      var web = [];
      if (mode.layout === 'ring') {
        for (i = 1; i < dots; i++) for (var j2 = i + 1; j2 < dots; j2++) if (r() < 0.55) web.push([i, j2]);
      } else if (mode.layout === 'village') {
        for (i = 1; i < dots; i++) {
          for (var t = 0; t < 3; t++) {
            var o = 1 + Math.floor(r() * (dots - 1));
            var dx = pos[i][0] - pos[o][0], dz = pos[i][1] - pos[o][1];
            if (o !== i && dx * dx + dz * dz < 90) web.push([i, o]);
          }
        }
      }
      var extent = 0;
      pos.forEach(function (p) { extent = Math.max(extent, Math.abs(p[0]), Math.abs(p[1])); });
      model = { pos: pos, dots: dots, perDot: perDot, knowList: knowList, crowdList: crowdList, isKnow: isKnow, web: web, extent: extent };
    }

    /* ---- jury draw ---- */
    function drawJury() {
      var N = state.mode.N, k = kEff();
      var jury = [];
      var kr = k, nr = N;
      for (var i = 0; i < 12; i++) {
        var knows;
        if (state.rule === 'neighbors') knows = kr > 0;
        else knows = Math.random() < kr / nr;
        if (knows) kr--;
        nr--;
        jury.push({ knows: knows });
      }
      // place each juror on a dot
      var usedK = {}, usedC = {};
      jury.forEach(function (j) {
        var list = j.knows ? model.knowList : model.crowdList, used = j.knows ? usedK : usedC;
        if (!list.length) list = j.knows ? model.crowdList : model.knowList;
        var pick, tries = 0;
        do { pick = list[Math.floor(Math.random() * list.length)]; tries++; } while (used[pick] && tries < 30);
        used[pick] = 1;
        j.dot = pick;
      });
      return jury;
    }

    /* ---- readouts ---- */
    function updateReadout() {
      var N = state.mode.N, k = kEff();
      var p = state.rule === 'neighbors' ? (k > 0 ? 1 : 0) : pAtLeastOne(N, k, 12);
      var e = state.rule === 'neighbors' ? Math.min(12, k) : 12 * k / N;
      $('.w-str-p').textContent = pct(p);
      $('.w-str-e').textContent = e >= 10 ? fmt(e) : e >= 0.1 ? e.toFixed(1) : e >= 0.01 ? e.toFixed(2) : e.toFixed(3);
      $('.w-str-note').textContent = state.mode.note;
      knowOut.textContent = fmt(state.know) + (state.know > N - 1 ? ' (everyone here: ' + fmt(N - 1) + ')' : '');
      $('.w-str-place').textContent = state.mode.place;
      $('.w-str-scale').textContent = fmt(N) + ' people, ' + (model.perDot <= 1.001 ? '1 dot each' : '1 dot = about ' + fmt(model.perDot));
      c2d.setAttribute('aria-label', state.mode.place + '. ' + fmt(N) + ' people, ' + fmt(k) + ' of whom know you.');
    }
    function renderSeats(n) {
      var known = 0;
      seatEls.forEach(function (li, i) {
        var j = state.jury && i < n ? state.jury[i] : null;
        li.classList.toggle('is-filled', !!j);
        li.classList.toggle('is-know', !!(j && j.knows));
        li.setAttribute('aria-label', 'Seat ' + (i + 1) + ', ' + (j ? (j.knows ? 'knows you' : 'a stranger') : 'empty'));
        if (j && j.knows) known++;
      });
      return known;
    }
    function finishDraw() {
      var known = renderSeats(12);
      $('.w-str-big b').textContent = known;
      var ins = $('.w-str-insight');
      var small = state.mode.id === 'band' || state.mode.id === 'vill';
      if (small && state.rule === 'random') {
        ins.textContent = 'Even a random draw here seats people who know you. Juries of strangers come from scale as much as from rules.';
        ins.hidden = false;
      } else if (!small && state.rule === 'neighbors') {
        ins.textContent = 'A city court could still pick jurors who know you. It will not: today that is a reason to excuse them.';
        ins.hidden = false;
      } else if (state.mode.id === 'city' && known === 0) {
        ins.textContent = 'Twelve strangers. Run it a hundred times and you will rarely see anyone you know.';
        ins.hidden = false;
      } else ins.hidden = true;
      state.drawsByMode[state.mode.id] = true;
      if (state.drawsByMode.city || Object.keys(state.drawsByMode).length >= 2) ctx.stamp('strangers');
    }

    var drawing = false;
    function runDraw() {
      if (drawing) return;
      drawing = true;
      state.jury = drawJury();
      $('.w-str-big b').textContent = '…';
      renderSeats(0);
      var n = 0;
      var step = ctx.reduced ? 0 : 110;
      function next() {
        n++;
        renderSeats(n);
        view.showJury(n);
        if (n < 12) { if (step) setTimeout(next, step); else next(); }
        else { finishDraw(); drawing = false; }
      }
      if (step) setTimeout(next, 60); else next();
    }

    /* ---- controls ---- */
    function setMode(id) {
      state.mode = DATA.modes.filter(function (m) { return m.id === id; })[0];
      if (!state.ruleTouched) state.rule = state.mode.rule;
      state.jury = null;
      el.querySelectorAll('.w-str-mode').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === id)); });
      syncRule();
      buildModel();
      renderSeats(0);
      $('.w-str-big b').textContent = '?';
      $('.w-str-insight').hidden = true;
      updateReadout();
      view.rebuild(true);
    }
    function syncRule() {
      el.querySelectorAll('[data-rule]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.rule === state.rule)); });
    }
    el.querySelectorAll('.w-str-mode').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
    el.querySelectorAll('[data-rule]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.rule = b.dataset.rule; state.ruleTouched = true; syncRule();
        state.jury = null; renderSeats(0); $('.w-str-big b').textContent = '?'; $('.w-str-insight').hidden = true;
        updateReadout(); view.showJury(0);
      });
    });
    var knowTimer;
    knowInput.addEventListener('input', function () {
      state.know = +knowInput.value;
      state.jury = null; renderSeats(0); $('.w-str-big b').textContent = '?';
      $('.w-str-insight').hidden = true;
      buildModel();
      updateReadout();
      clearTimeout(knowTimer);
      knowTimer = setTimeout(function () { view.rebuild(false); }, 40);
    });
    $('.w-str-draw').addEventListener('click', runDraw);

    /* ---- colors ---- */
    var colors = {};
    function readColors() {
      colors = { ink: token('--ink'), ink3: token('--ink-3'), rule: token('--rule'), accent: token('--accent'), brass: token('--brass'), seal: token('--seal'), sheet: token('--sheet-2') };
    }
    readColors();

    /* ---- 2D renderer (always available; first paint and fallback) ---- */
    var view2d = {
      size: function () {
        var w = stage.clientWidth, h = stage.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
        c2d.width = Math.round(w * dpr); c2d.height = Math.round(h * dpr);
        return { w: w, h: h, dpr: dpr };
      },
      draw: function (n) {
        if (!model) return;
        var sz = this.size(), g = c2d.getContext('2d');
        g.setTransform(sz.dpr, 0, 0, sz.dpr, 0, 0);
        g.clearRect(0, 0, sz.w, sz.h);
        var scale = (Math.min(sz.w, sz.h) * 0.44) / Math.max(6, model.extent);
        var cx = sz.w / 2, cy = sz.h / 2 + 8;
        var cos = Math.cos(state.azimuth), sin = Math.sin(state.azimuth);
        function P(i) {
          var p = model.pos[i], x = p[0] * cos - p[1] * sin, z = p[0] * sin + p[1] * cos;
          return [cx + x * scale, cy + z * scale * 0.62];
        }
        var dot = Math.max(1.2, state.mode.dotPx * 0.55);
        g.lineWidth = 1;
        if (model.web.length) {
          g.strokeStyle = colors.rule; g.globalAlpha = 0.7; g.beginPath();
          model.web.forEach(function (e) { var a = P(e[0]), b = P(e[1]); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); });
          g.stroke(); g.globalAlpha = 1;
        }
        var you = P(0);
        g.strokeStyle = colors.accent; g.globalAlpha = 0.35; g.beginPath();
        model.knowList.forEach(function (i) { var a = P(i); g.moveTo(you[0], you[1]); g.lineTo(a[0], a[1]); });
        g.stroke(); g.globalAlpha = 1;
        g.fillStyle = colors.ink3;
        model.crowdList.forEach(function (i) { var a = P(i); g.fillRect(a[0] - dot / 2, a[1] - dot / 2, dot, dot); });
        g.fillStyle = colors.accent;
        model.knowList.forEach(function (i) { var a = P(i); g.beginPath(); g.arc(a[0], a[1], dot * 0.75 + 0.6, 0, 6.283); g.fill(); });
        if (state.jury && n) {
          for (var j = 0; j < n; j++) {
            var jr = state.jury[j], a = P(jr.dot);
            if (jr.knows) { g.strokeStyle = colors.brass; g.lineWidth = 2; g.beginPath(); g.moveTo(you[0], you[1]); g.lineTo(a[0], a[1]); g.stroke(); }
            g.lineWidth = 2; g.strokeStyle = jr.knows ? colors.brass : colors.ink;
            g.beginPath(); g.arc(a[0], a[1], 7, 0, 6.283); g.stroke();
            g.fillStyle = jr.knows ? colors.brass : colors.ink; g.beginPath(); g.arc(a[0], a[1], 3, 0, 6.283); g.fill();
          }
        }
        g.fillStyle = colors.brass; g.beginPath(); g.arc(you[0], you[1], 6, 0, 6.283); g.fill();
        g.strokeStyle = colors.brass; g.lineWidth = 1.5; g.beginPath(); g.arc(you[0], you[1], 10, 0, 6.283); g.stroke();
      }
    };

    /* ---- 3D renderer ---- */
    var three = null; // { renderer, scene, camera, groups... }
    var shown = 0;
    var visible = false, raf = 0, lastT = 0;

    function circleTexture(ring) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 64;
      var g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.strokeStyle = '#fff';
      if (ring) { g.lineWidth = 6; g.beginPath(); g.arc(32, 32, 26, 0, 6.283); g.stroke(); }
      else { g.beginPath(); g.arc(32, 32, 28, 0, 6.283); g.fill(); }
      var t = new THREE.CanvasTexture(cv);
      return t;
    }

    function init3D() {
      var T = window.THREE;
      var renderer;
      try {
        renderer = new T.WebGLRenderer({ canvas: c3d, antialias: true, alpha: true, powerPreference: 'low-power' });
      } catch (e) { return false; }
      if (!renderer || !renderer.getContext()) return false;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setClearColor(0x000000, 0);
      var scene = new T.Scene();
      var camera = new T.PerspectiveCamera(38, 1, 0.1, 5000);
      var dotTex = circleTexture(false), ringTex = circleTexture(true);
      three = { T: T, renderer: renderer, scene: scene, camera: camera, dotTex: dotTex, ringTex: ringTex, objs: [], camDist: 40, camTarget: 40, grow: 1 };
      c3d.classList.add('is-on');
      c2d.classList.add('is-off');
      return true;
    }

    function disposeObjs() {
      three.objs.forEach(function (o) { three.scene.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      three.objs = [];
    }
    function add(o) { three.scene.add(o); three.objs.push(o); return o; }

    function pointsFrom(list, size, color, tex, opacity, y) {
      var T = three.T;
      var arr = new Float32Array(list.length * 3);
      list.forEach(function (i, n) { var p = model.pos[i]; arr[n * 3] = p[0]; arr[n * 3 + 1] = y || 0; arr[n * 3 + 2] = p[1]; });
      var geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(arr, 3));
      var mat = new T.PointsMaterial({ size: size, sizeAttenuation: false, map: tex, transparent: true, alphaTest: 0.25, color: new T.Color(color), opacity: opacity == null ? 1 : opacity, depthWrite: false });
      return new T.Points(geo, mat);
    }
    function linesFrom(pairs, color, opacity, y0, y1) {
      var T = three.T;
      var arr = new Float32Array(pairs.length * 6);
      pairs.forEach(function (e, n) {
        var a = model.pos[e[0]], b = model.pos[e[1]];
        arr.set([a[0], y0 || 0, a[1], b[0], y1 || 0, b[1]], n * 6);
      });
      var geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(arr, 3));
      return new T.LineSegments(geo, new T.LineBasicMaterial({ color: new T.Color(color), transparent: true, opacity: opacity, depthWrite: false }));
    }

    function rebuild3D(animate) {
      if (!three) return;
      disposeObjs();
      var T = three.T, dpr = three.renderer.getPixelRatio();
      var px = state.mode.dotPx * dpr;
      if (model.web.length) add(linesFrom(model.web, colors.rule, 0.55));
      add(linesFrom(model.knowList.map(function (i) { return [0, i]; }), colors.accent, model.knowList.length > 200 ? 0.16 : 0.4, 0.6, 0));
      three.crowd = add(pointsFrom(model.crowdList, px, colors.ink3, three.dotTex, state.mode.layout === 'island' ? 0.5 : 0.9));
      three.know = add(pointsFrom(model.knowList, px * 1.25 + dpr, colors.accent, three.dotTex, 1));
      // you: a small brass column with a halo
      var you = new T.Mesh(new T.CylinderGeometry(0.0, 1, 1, 24), new T.MeshBasicMaterial({ color: new T.Color(colors.brass) }));
      var youScale = Math.max(0.22, model.extent / 32);
      you.scale.set(youScale * 0.55, youScale * 1.6, youScale * 0.55);
      you.position.y = youScale * 0.8;
      you.rotation.x = Math.PI;
      three.you = add(you);
      three.youHalo = add(pointsFrom([0], 26 * dpr, colors.brass, three.ringTex, 0.9, 0.05));
      three.juryRings = null; three.juryDots = null; three.juryTies = null;
      shown = 0;
      three.camTarget = Math.max(16, model.extent * 2.05);
      if (animate) three.camDist = three.camTarget * (ctx.reduced ? 1 : 1.5);
      three.grow = animate && !ctx.reduced ? 0 : 1;
      showJury3D(state.jury ? 12 : 0);
    }

    function showJury3D(n) {
      if (!three) return;
      ['juryRings', 'juryDots', 'juryTies', 'juryPins'].forEach(function (k) {
        if (three[k]) { three.scene.remove(three[k]); three[k].geometry.dispose(); three[k].material.dispose(); var idx = three.objs.indexOf(three[k]); if (idx >= 0) three.objs.splice(idx, 1); three[k] = null; }
      });
      shown = n;
      if (!state.jury || !n) return;
      var T = three.T, dpr = three.renderer.getPixelRatio();
      var js = state.jury.slice(0, n);
      var strangers = js.filter(function (j) { return !j.knows; }).map(function (j) { return j.dot; });
      var knowers = js.filter(function (j) { return j.knows; }).map(function (j) { return j.dot; });
      var lift = Math.max(1.2, model.extent / 14);
      var group = new T.Group();
      if (strangers.length) {
        group.add(pointsFrom(strangers, 18 * dpr, colors.ink, three.ringTex, 1, lift));
        group.add(pointsFrom(strangers, 7 * dpr, colors.ink, three.dotTex, 1, lift));
      }
      if (knowers.length) {
        group.add(pointsFrom(knowers, 20 * dpr, colors.brass, three.ringTex, 1, lift));
        group.add(pointsFrom(knowers, 8 * dpr, colors.brass, three.dotTex, 1, lift));
      }
      three.juryRings = add(group);
      three.juryRings.geometry = { dispose: function () { group.children.forEach(function (c) { c.geometry.dispose(); }); } };
      three.juryRings.material = { dispose: function () { group.children.forEach(function (c) { c.material.dispose(); }); } };
      // pins from the ground to the raised marker
      var pins = js.map(function (j) { return [j.dot, j.dot]; });
      three.juryPins = add(linesFrom(pins, colors.ink, 0.6, 0, lift));
      if (knowers.length) three.juryTies = add(linesFrom(knowers.map(function (d) { return [0, d]; }), colors.brass, 0.95, lift * 0.9, lift));
    }

    function recolor3D() { if (three) rebuild3D(false); }

    function frame(t) {
      raf = 0;
      if (!visible) return;
      var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
      lastT = t;
      if (!state.drag && !ctx.reduced) state.azimuth += dt * 0.12;
      if (three) {
        var w = stage.clientWidth, h = stage.clientHeight;
        var cv = three.renderer.domElement;
        if (cv.width !== Math.round(w * three.renderer.getPixelRatio()) || cv.height !== Math.round(h * three.renderer.getPixelRatio())) {
          three.renderer.setSize(w, h, false);
          three.camera.aspect = w / h;
          three.camera.updateProjectionMatrix();
        }
        three.camDist += (three.camTarget - three.camDist) * Math.min(1, dt * 3.2);
        if (three.grow < 1) {
          three.grow = Math.min(1, three.grow + dt * 2.2);
          var gs = 1 - Math.pow(1 - three.grow, 3);
          three.objs.forEach(function (o) { o.scale.set(gs, 1, gs); });
        }
        var aspectBoost = w / h < 1 ? 1 / Math.max(0.62, w / h) : 1;
        var d = three.camDist * aspectBoost, elev = 0.95;
        three.camera.position.set(Math.cos(state.azimuth) * d * Math.cos(elev), d * Math.sin(elev), Math.sin(state.azimuth) * d * Math.cos(elev));
        three.camera.lookAt(0, 0, 0);
        if (three.youHalo) three.youHalo.material.size = (24 + Math.sin(t / 380) * 4) * three.renderer.getPixelRatio();
        three.renderer.render(three.scene, three.camera);
      } else {
        view2d.draw(shown);
      }
      if (!ctx.reduced || state.drag || (three && (three.grow < 1 || Math.abs(three.camTarget - three.camDist) > 0.05))) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

    var view = {
      rebuild: function (animate) { if (three) rebuild3D(animate); else view2d.draw(shown = 0); kick(); },
      showJury: function (n) { shown = n; if (three) showJury3D(n); else view2d.draw(n); kick(); }
    };

    // drag to turn the scene
    stage.addEventListener('pointerdown', function (e) { state.drag = { x: e.clientX, a: state.azimuth }; stage.setPointerCapture && stage.setPointerCapture(e.pointerId); kick(); });
    stage.addEventListener('pointermove', function (e) { if (!state.drag) return; state.azimuth = state.drag.a + (e.clientX - state.drag.x) * 0.008; if (!three) view2d.draw(shown); kick(); });
    function endDrag() { state.drag = null; }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    // theme changes
    function onTheme() { readColors(); if (three) recolor3D(); else view2d.draw(shown); kick(); }
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme); } catch (e) {}
    new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.ResizeObserver) new ResizeObserver(function () { if (!three) view2d.draw(shown); kick(); }).observe(stage);

    // first paint in 2D, then upgrade to 3D when the exhibit comes near
    setMode('city');
    var loading = false;
    ctx.onVisible(function (isVis) {
      visible = isVis;
      if (isVis) {
        lastT = 0; kick();
        if (!three && !loading && window.WebGLRenderingContext) {
          loading = true;
          (window.THREE ? Promise.resolve() : ctx.loadScript(THREE_URL)).then(function () {
            if (window.THREE && init3D()) { rebuild3D(true); kick(); }
          }).catch(function () { /* stay in 2D */ });
        }
      }
    }, { rootMargin: '400px 0px' });
  });
})();
