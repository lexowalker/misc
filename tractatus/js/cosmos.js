/* The field: every remark of the Tractatus is one star. A star hangs on the remark it
   comments on, so the decimal numbering becomes a visible structure. The camera follows
   the reader through the book; in atlas mode the reader moves it. */
(function () {
  'use strict';

  var C = (window.Cosmos = { ok: false, onPick: null, onHover: null });
  var T = window.THREE;
  var props = window.TLP || [];
  var N = props.length;
  var idx = {};
  props.forEach(function (p, i) { idx[p.n] = i; });

  /* ───────── layout ───────── */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = rng(1921);
  var GOLD = Math.PI * (3 - Math.sqrt(5));
  var REACH = [0, 46, 21, 11, 6, 3.4, 2.2];
  var SIZE = [15, 8, 5.6, 4.4, 3.7, 3.2, 3.0];

  var P = new Float32Array(N * 3);      // positions
  var level = new Uint8Array(N);
  var station = new Uint8Array(N);
  var parent = new Int16Array(N);
  var kids = [];
  var spine = [];                        // spine[k] = [x, y, z] for main proposition k
  var extent = [0, 0, 0, 0, 0, 0, 0, 0];

  (function layout() {
    var i, k;
    for (i = 0; i < N; i++) { kids.push([]); parent[i] = props[i].p ? idx[props[i].p] : -1; }
    for (i = 0; i < N; i++) if (parent[i] >= 0) kids[parent[i]].push(i);
    for (k = 1; k <= 7; k++) {
      var z = -(k - 1) * 215;
      if (k === 7) z = -5 * 215 - 640;   // 7 stands alone, far beyond the rest
      spine[k] = [k === 7 ? 0 : 36 * Math.sin(k * 1.7), k === 7 ? 0 : 22 * Math.cos(k * 1.15), z];
    }
    function place(i, dir, lv) {
      level[i] = lv;
      station[i] = +props[i].n.charAt(0);
      var ch = kids[i], n = ch.length;
      if (!n) return;
      // orthonormal frame around dir
      var ax = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      var e1 = norm(cross(dir, ax)), e2 = cross(dir, e1);
      var cone = lv === 0 ? Math.PI : Math.min(1.45, 0.75 + n * 0.06);
      var phase = rand() * 6.283;
      for (var j = 0; j < n; j++) {
        var c = ch[j];
        var cosT = 1 - ((j + 0.5) / n) * (1 - Math.cos(cone));
        var sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
        var ph = phase + j * GOLD;
        var d = [
          dir[0] * cosT + (e1[0] * Math.cos(ph) + e2[0] * Math.sin(ph)) * sinT,
          dir[1] * cosT + (e1[1] * Math.cos(ph) + e2[1] * Math.sin(ph)) * sinT,
          dir[2] * cosT + (e1[2] * Math.cos(ph) + e2[2] * Math.sin(ph)) * sinT
        ];
        var r = REACH[Math.min(lv + 1, 6)] * (0.82 + rand() * 0.36);
        P[c * 3] = P[i * 3] + d[0] * r;
        P[c * 3 + 1] = P[i * 3 + 1] + d[1] * r;
        P[c * 3 + 2] = P[i * 3 + 2] + d[2] * r;
        place(c, d, lv + 1);
      }
    }
    for (k = 1; k <= 7; k++) {
      i = idx[String(k)];
      P[i * 3] = spine[k][0]; P[i * 3 + 1] = spine[k][1]; P[i * 3 + 2] = spine[k][2];
      place(i, norm([Math.sin(k * 2.1), 0.6, Math.cos(k * 2.1)]), 0);
    }
    for (i = 0; i < N; i++) {
      var s = spine[station[i]];
      var dx = P[i * 3] - s[0], dy = P[i * 3 + 1] - s[1], dz = P[i * 3 + 2] - s[2];
      extent[station[i]] = Math.max(extent[station[i]], Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
  })();

  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  C.index = idx;
  C.kids = kids;
  C.parent = parent;
  C.level = level;

  /* ───────── renderer ───────── */
  var canvas = document.getElementById('cosmos');
  var labelBox = document.getElementById('labels');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var renderer, scene, camera, starMat, lineMat, dustMat;
  var W = 1, H = 1;

  try {
    if (!T) throw new Error('three.js not loaded');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    document.documentElement.classList.add('no-gl');
    document.body.classList.add('no-gl');
    C.setJourney = C.setMode = C.select = C.setFocus = C.overview = function () {};
    return;
  }
  C.ok = true;
  renderer.setClearColor(0x04060b, 1);
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(46, 1, 1, 9000);

  var VERT_COMMON = [
    'uniform float uActive; uniform float uAll; uniform float uFade; uniform float uScale; uniform float uTime;',
    'float near(float st){ return 1.0 - smoothstep(0.35, 0.9, abs(st - uActive)); }'
  ].join('\n');

  // stars
  (function () {
    var g = new T.BufferGeometry();
    var size = new Float32Array(N), st = new Float32Array(N), id = new Float32Array(N), seed = new Float32Array(N), col = new Float32Array(N * 3);
    var warm = [1.0, 0.84, 0.6], white = [0.96, 0.94, 0.9], cool = [0.62, 0.75, 1.0];
    for (var i = 0; i < N; i++) {
      var lv = level[i];
      size[i] = SIZE[Math.min(lv, 6)];
      st[i] = station[i]; id[i] = i; seed[i] = rand();
      var t = clamp((lv - 1) / 4, 0, 1);
      var c = lv === 0 ? warm : [lerp(white[0], cool[0], t), lerp(white[1], cool[1], t), lerp(white[2], cool[2], t)];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    g.setAttribute('position', new T.BufferAttribute(P, 3));
    g.setAttribute('aSize', new T.BufferAttribute(size, 1));
    g.setAttribute('aStation', new T.BufferAttribute(st, 1));
    g.setAttribute('aId', new T.BufferAttribute(id, 1));
    g.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    g.setAttribute('aColor', new T.BufferAttribute(col, 3));
    starMat = new T.ShaderMaterial({
      uniforms: {
        uActive: { value: 0 }, uAll: { value: 0.6 }, uFade: { value: 1 }, uScale: { value: 300 }, uTime: { value: 0 },
        uFocus: { value: -1 }, uHover: { value: -1 }, uBoost: { value: 1 }
      },
      vertexShader: [
        'attribute float aSize; attribute float aStation; attribute float aId; attribute float aSeed; attribute vec3 aColor;',
        'uniform float uFocus; uniform float uHover; uniform float uBoost;', VERT_COMMON,
        'varying vec3 vColor; varying float vA;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  float act = max(near(aStation), uAll);',
        '  float tw = 0.86 + 0.14 * sin(uTime * (0.5 + aSeed) + aSeed * 50.0);',
        '  float foc = step(abs(aId - uFocus), 0.5);',
        '  float hov = step(abs(aId - uHover), 0.5);',
        '  float px = min(aSize * uBoost * uScale / max(1.0, -mv.z), 14.0 + aSize * 2.6) * (1.0 + foc * 0.9 + hov * 0.5);',
        '  float fog = mix(1.0, 0.45, smoothstep(350.0, 1700.0, -mv.z / uBoost));',
        '  vA = mix(0.2, 1.0, act) * tw * fog * uFade * min(1.0, px * 0.45);',
        '  vA = max(vA, foc * uFade);',
        '  vColor = mix(aColor, vec3(1.0, 0.82, 0.55), foc * 0.7);',
        '  gl_PointSize = clamp(px, 1.5, 140.0);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor; varying float vA;',
        'void main(){',
        '  float d = length(gl_PointCoord - 0.5) * 2.0;',
        '  float core = smoothstep(0.4, 0.1, d);',
        '  float halo = pow(max(0.0, 1.0 - d), 2.4) * 0.42;',
        '  gl_FragColor = vec4(vColor, (core + halo) * vA);',
        '}'
      ].join('\n'),
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    });
    var pts = new T.Points(g, starMat);
    pts.frustumCulled = false;
    scene.add(pts);
  })();

  // edges: one segment from each remark to the remark it comments on
  (function () {
    var seg = [], st = [], lv = [];
    for (var i = 0; i < N; i++) {
      var p = parent[i];
      if (p < 0) continue;
      seg.push(P[p * 3], P[p * 3 + 1], P[p * 3 + 2], P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      st.push(station[i], station[i]); lv.push(level[i], level[i]);
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(seg), 3));
    g.setAttribute('aStation', new T.BufferAttribute(new Float32Array(st), 1));
    g.setAttribute('aLevel', new T.BufferAttribute(new Float32Array(lv), 1));
    lineMat = new T.ShaderMaterial({
      uniforms: {
        uActive: { value: 0 }, uAll: { value: 0 }, uFade: { value: 1 }, uScale: { value: 300 }, uTime: { value: 0 },
        uReveal: { value: [0, 0, 0, 0, 0, 0, 0, 0, 0] }, uBoost: { value: 1 }
      },
      vertexShader: [
        'attribute float aStation; attribute float aLevel; uniform float uReveal[9]; uniform float uBoost;', VERT_COMMON,
        'varying float vA;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  float r = uReveal[int(aStation + 0.5)];',
        '  float on = smoothstep(0.0, 0.22, r * 1.3 - (aLevel - 1.0) * 0.2);',
        '  float fog = mix(1.0, 0.3, smoothstep(300.0, 1500.0, -mv.z / (uBoost * uBoost)));',
        '  vA = on * mix(0.16, 0.42, max(near(aStation), uAll)) * fog * uFade;',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.56, 0.68, 0.92, vA); }',
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    });
    var ls = new T.LineSegments(g, lineMat);
    ls.frustumCulled = false;
    scene.add(ls);
  })();

  // far field: unnamed points, for depth only
  (function () {
    var M = 2600, pos = new Float32Array(M * 3), a = new Float32Array(M), s = new Float32Array(M);
    for (var i = 0; i < M; i++) {
      var x, y;
      do { x = (rand() - 0.5) * 3600; y = (rand() - 0.5) * 2600; } while (Math.hypot(x, y) < 260);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 900 - rand() * 4200;
      a[i] = 0.25 + rand() * 0.55; s[i] = 1.6 + rand() * 2.6;
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('aA', new T.BufferAttribute(a, 1));
    g.setAttribute('aS', new T.BufferAttribute(s, 1));
    dustMat = new T.ShaderMaterial({
      uniforms: { uFade: { value: 1 }, uScale: { value: 300 } },
      vertexShader: [
        'attribute float aA; attribute float aS; uniform float uFade; uniform float uScale; varying float vA;',
        'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  float px = aS * uScale * 1.6 / max(1.0, -mv.z);',
        '  vA = aA * uFade * min(1.0, px);',
        '  gl_PointSize = clamp(px, 1.0, 3.5); gl_Position = projectionMatrix * mv; }'
      ].join('\n'),
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(0.72, 0.78, 0.92, smoothstep(1.0, 0.2, d) * vA * 0.7); }',
      blending: T.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false
    });
    var pts = new T.Points(g, dustMat);
    pts.frustumCulled = false;
    scene.add(pts);
  })();

  /* ───────── camera states ───────── */
  var st = { mode: 'journey', stage: 0, u: 0, a: 0.3, focus: -1, sel: -1, hover: -1 };
  var cur = { p: new T.Vector3(-90, 80, 430), t: new T.Vector3(0, 0, -400), sx: 0, sy: 0, fade: 1, all: 0.6, active: 0, boost: 1, reveal: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
  var want = { p: new T.Vector3(), t: new T.Vector3(), sx: 0, sy: 0, fade: 1, all: 0.6, active: 0, reveal: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
  var orbit = { target: new T.Vector3(), yaw: 0.5, pitch: 0.22, dist: 260, touched: 0 };
  var A = new T.Vector3(), B = new T.Vector3(), TA = new T.Vector3(), TB = new T.Vector3();

  function pose(stage, v, outP, outT) {
    var s;
    if (stage <= 0) {
      outP.set(-90 + 50 * v, 80 - 25 * v, 430 - 150 * v);
      outT.set(0, -10, -520);
    } else if (stage <= 6) {
      s = spine[stage];
      var ang = lerp(-0.62, 0.5, v) + stage * 0.83;
      var dist = extent[stage] * 1.75 + 70;
      outP.set(s[0] + Math.sin(ang) * dist, s[1] + dist * lerp(0.3, 0.14, v), s[2] + Math.cos(ang) * dist);
      outT.set(s[0], s[1], s[2]);
    } else if (stage === 7) {
      s = spine[7];
      outP.set(s[0], s[1] + 4, s[2] + lerp(210, 120, v));
      outT.set(s[0], s[1] - 26, s[2] - 300);
    } else {
      s = spine[7];
      // from far to one side, turned so that the book stands upright: a ladder, with 7 alone at the top
      var phi = lerp(-0.5, 0.4, v), far = lerp(2500, 2250, v);
      outP.set(Math.cos(phi) * far, Math.sin(phi) * far, -850);
      outT.set(0, 0, -850);
    }
  }

  function computeWant() {
    var wide = W >= 1000, i;
    if (st.mode === 'atlas') {
      var cp = Math.cos(orbit.pitch);
      want.p.set(
        orbit.target.x + Math.sin(orbit.yaw) * cp * orbit.dist,
        orbit.target.y + Math.sin(orbit.pitch) * orbit.dist,
        orbit.target.z + Math.cos(orbit.yaw) * cp * orbit.dist
      );
      want.t.copy(orbit.target);
      want.sx = wide ? -0.16 * W : 0;
      want.sy = wide ? 0 : -0.24 * H;
      want.fade = 1; want.all = 1; want.boost = 1; want.roll = 0; want.active = st.sel >= 0 ? station[st.sel] : 0;
      for (i = 1; i <= 7; i++) want.reveal[i] = 1;
      return;
    }
    var s = st.stage, u = st.u, a = st.a;
    if (s > 0 && u < a) {
      pose(s - 1, 1, A, TA); pose(s, 0, B, TB);
      var k = smooth(u / a);
      want.p.lerpVectors(A, B, k); want.t.lerpVectors(TA, TB, k);
    } else {
      pose(s, s > 0 ? (u - a) / (1 - a) : u, want.p, want.t);
    }
    var silent = s === 7;
    want.sx = wide && !silent ? 0.2 * W : 0;
    want.boost = s === 8 ? 2.6 : 1;
    want.roll = s === 8 ? 1 : 0;
    want.sy = 0;
    want.all = s === 0 ? 0.8 : s === 8 ? 1 : 0;
    want.active = s === 0 ? 0 : (u < a * 0.5 ? s - 1 : s);
    want.fade = 1;
    if (s === 7) want.fade = 1 - smooth((u - 0.5) / 0.18);
    if (s === 8) want.fade = smooth((u - a * 0.35) / (a * 0.8));
    for (i = 1; i <= 7; i++) {
      want.reveal[i] = i < s ? 1 : i === s ? clamp((u - a * 0.6) / ((1 - a) * 0.55), 0, 1) : 0;
      if (s === 8) want.reveal[i] = 1;
    }
  }

  /* ───────── labels ───────── */
  var pool = [], v3 = new T.Vector3();
  function label(k) {
    if (!pool[k]) { pool[k] = document.createElement('div'); pool[k].className = 'sl'; labelBox.appendChild(pool[k]); }
    return pool[k];
  }
  function screen(i, out) {
    v3.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).project(camera);
    out.x = (v3.x * 0.5 + 0.5) * W; out.y = (-v3.y * 0.5 + 0.5) * H; out.z = v3.z;
    return out;
  }
  var sp = { x: 0, y: 0, z: 0 };
  function drawLabels() {
    var list = [], seen = {};
    function add(i, cls) { if (i >= 0 && !seen[i]) { seen[i] = 1; list.push([i, cls]); } }
    if (st.mode === 'atlas') {
      add(st.sel, 'sel');
      add(st.hover, 'hov');
      if (st.sel >= 0) {
        add(parent[st.sel], '');
        var ch = kids[st.sel];
        for (var j = 0; j < ch.length && j < 24; j++) add(ch[j], '');
      }
      for (var k = 1; k <= 7; k++) add(idx[String(k)], 'main');
    } else if (st.stage >= 1 && st.stage <= 6 && cur.fade > 0.5) {
      if (W >= 1000) add(st.focus, 'here');
    } else if (st.stage === 8 && cur.fade > 0.8 && st.u > st.a) {
      for (var m = 1; m <= 7; m++) add(idx[String(m)], 'main');
    }
    var used = 0;
    for (var n = 0; n < list.length; n++) {
      var i = list[n][0];
      screen(i, sp);
      if (sp.z > 1 || sp.z < -1 || sp.x < -40 || sp.x > W + 40 || sp.y < -20 || sp.y > H + 20) continue;
      var el = label(used++);
      if (el._n !== i) { el.textContent = props[i].n; el._n = i; }
      var cls = 'sl ' + list[n][1];
      if (el.className !== cls) el.className = cls;
      el.style.transform = 'translate(' + sp.x.toFixed(1) + 'px,' + sp.y.toFixed(1) + 'px) translateY(-50%)';
      el.style.opacity = 1;
    }
    for (; used < pool.length; used++) pool[used].style.opacity = 0;
  }

  /* ───────── frame ───────── */
  var last = performance.now(), first = true;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (st.mode === 'atlas' && !reduced && now - orbit.touched > 6000) orbit.yaw += dt * 0.025;
    computeWant();
    var k = first || reduced ? 1 : 1 - Math.exp(-dt * (st.mode === 'atlas' ? 4.2 : 2.6));
    first = false;
    cur.p.lerp(want.p, k); cur.t.lerp(want.t, k);
    cur.sx = lerp(cur.sx, want.sx, k); cur.sy = lerp(cur.sy, want.sy, k);
    cur.fade = lerp(cur.fade, want.fade, Math.min(1, k * 1.6));
    cur.all = lerp(cur.all, want.all, k);
    cur.boost = lerp(cur.boost, want.boost || 1, k);
    starMat.uniforms.uBoost.value = lineMat.uniforms.uBoost.value = cur.boost;
    cur.roll = lerp(cur.roll || 0, want.roll || 0, k);
    camera.up.set(0, 1 - cur.roll, -cur.roll).normalize();
    cur.active = lerp(cur.active, want.active, Math.min(1, k * 1.5));
    for (var i = 1; i <= 7; i++) cur.reveal[i] = lerp(cur.reveal[i], want.reveal[i], k);
    camera.position.copy(cur.p);
    camera.lookAt(cur.t);
    camera.setViewOffset(W, H, -cur.sx, -cur.sy, W, H);
    camera.updateMatrixWorld();
    var t = reduced ? 0 : now / 1000;
    starMat.uniforms.uTime.value = t;
    starMat.uniforms.uActive.value = lineMat.uniforms.uActive.value = cur.active;
    starMat.uniforms.uAll.value = lineMat.uniforms.uAll.value = cur.all;
    starMat.uniforms.uFade.value = lineMat.uniforms.uFade.value = dustMat.uniforms.uFade.value = cur.fade;
    starMat.uniforms.uFocus.value = st.mode === 'atlas' ? st.sel : st.focus;
    starMat.uniforms.uHover.value = st.mode === 'atlas' ? st.hover : -1;
    lineMat.uniforms.uReveal.value = cur.reveal;
    renderer.render(scene, camera);
    drawLabels();
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W < H ? 58 : 46;
    camera.updateProjectionMatrix();
    var sc = H * renderer.getPixelRatio() * 0.6;
    starMat.uniforms.uScale.value = dustMat.uniforms.uScale.value = sc;
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  /* ───────── picking and orbit ───────── */
  function pick(x, y) {
    var best = -1, bd = 22 * 22;
    for (var i = 0; i < N; i++) {
      screen(i, sp);
      if (sp.z > 1 || sp.z < -1) continue;
      var dx = sp.x - x, dy = sp.y - y, d = dx * dx + dy * dy;
      d -= (6 - level[i]) * 14;         // larger stars are easier to hit
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  var ptrs = {}, drag = null, pinch = 0;
  canvas.addEventListener('pointerdown', function (e) {
    if (st.mode !== 'atlas') return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    var ids = Object.keys(ptrs);
    if (ids.length === 1) drag = { x: e.clientX, y: e.clientY, moved: 0 };
    if (ids.length === 2) { pinch = dist2(); drag = null; }
    orbit.touched = performance.now();
  });
  function dist2() {
    var ids = Object.keys(ptrs); if (ids.length < 2) return 0;
    return Math.hypot(ptrs[ids[0]].x - ptrs[ids[1]].x, ptrs[ids[0]].y - ptrs[ids[1]].y);
  }
  canvas.addEventListener('pointermove', function (e) {
    if (st.mode !== 'atlas') return;
    if (ptrs[e.pointerId]) { ptrs[e.pointerId].x = e.clientX; ptrs[e.pointerId].y = e.clientY; }
    var ids = Object.keys(ptrs);
    if (ids.length === 2) {
      var d = dist2();
      if (pinch > 0 && d > 0) orbit.dist = clamp(orbit.dist * pinch / d, 10, 2600);
      pinch = d; orbit.touched = performance.now();
    } else if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      orbit.yaw -= dx * 0.0052; orbit.pitch = clamp(orbit.pitch + dy * 0.0052, -1.35, 1.35);
      drag.x = e.clientX; drag.y = e.clientY; orbit.touched = performance.now();
    } else if (e.pointerType === 'mouse') {
      var h = pick(e.clientX, e.clientY);
      if (h !== st.hover) { st.hover = h; canvas.style.cursor = h >= 0 ? 'pointer' : 'grab'; }
    }
  });
  function up(e) {
    if (st.mode !== 'atlas') return;
    var was = drag;
    delete ptrs[e.pointerId];
    if (Object.keys(ptrs).length < 2) pinch = 0;
    drag = null;
    if (was && was.moved < 7 && e.type === 'pointerup') {
      var h = pick(e.clientX, e.clientY);
      if (h >= 0 && C.onPick) C.onPick(props[h].n);
    }
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) {
    if (st.mode !== 'atlas') return;
    e.preventDefault();
    orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * 0.0012), 10, 2600);
    orbit.touched = performance.now();
  }, { passive: false });

  /* ───────── interface ───────── */
  C.setJourney = function (stage, u, a) { st.stage = stage; st.u = clamp(u, 0, 1); st.a = clamp(a, 0.05, 0.6); };
  C.setFocus = function (n) { st.focus = n != null && idx[n] != null ? idx[n] : -1; };
  C.setMode = function (mode) {
    st.mode = mode; st.hover = -1;
    canvas.style.cursor = mode === 'atlas' ? 'grab' : '';
    if (mode === 'atlas') orbit.touched = performance.now();
  };
  C.select = function (n, keepDistance) {
    var i = idx[n]; if (i == null) return;
    st.sel = i;
    orbit.target.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    if (!keepDistance) {
      var lv = level[i];
      var d = lv === 0 ? extent[station[i]] * 1.9 + 60 : [0, 120, 64, 38, 24, 17, 14][lv];
      if (i === idx['7']) d = 150;
      orbit.dist = d;
    }
    orbit.touched = performance.now();
  };
  C.overview = function () {
    st.sel = -1;
    orbit.target.set(0, 0, -640); orbit.dist = 1500; orbit.yaw = 1.15; orbit.pitch = 0.25;
  };
})();
