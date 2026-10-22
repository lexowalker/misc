// WebGL2 HDR pipeline: shot shaders -> glows -> crossfade -> god rays + bloom -> tonemap/grade -> screen.
'use strict';
const W = 1920, H = 1080;

const E = (() => {
  const cv = document.getElementById('cv');
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false, depth: false, stencil: false });
  if (!gl.getExtension('EXT_color_buffer_float')) console.error('EXT_color_buffer_float missing');
  gl.getExtension('OES_texture_float_linear');

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const VS = `#version 300 es
layout(location=0) in vec2 p; out vec2 vUv;
void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0,1); }`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const m = /0:(\d+)/.exec(log), ln = m ? +m[1] : 0;
      const ctx = src.split('\n').map((l, i) => (i + 1) + ': ' + l).slice(Math.max(0, ln - 4), ln + 3).join('\n');
      throw new Error(log + '\n' + ctx);
    }
    return s;
  }

  const progs = {};
  function program(name, fsrc) {
    if (progs[name]) return progs[name];
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, GLSL_HEADER + GLSL_LIB + fsrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ': ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const a = gl.getActiveUniform(p, i);
      u[a.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, a.name), type: a.type, size: a.size };
    }
    return (progs[name] = { p, u, name });
  }

  function texture(w, h, internal, format, type, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  const targets = {};
  function target(name, w = W, h = H) {
    const k = name + w + 'x' + h;
    if (targets[k]) return targets[k];
    const tex = texture(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return (targets[k] = { fb, tex, w, h, name });
  }

  // 1x1 transparent texture bound to unused samplers
  const blank = texture(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);

  let FRAME = { t: 0, aud: [0, 0, 0, 0] };

  function run(prog, tgt, uni = {}) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, tgt ? tgt.fb : null);
    gl.viewport(0, 0, tgt ? tgt.w : W, tgt ? tgt.h : H);
    gl.useProgram(prog.p);
    let unit = 0;
    const all = Object.assign({ uR: [tgt ? tgt.w : W, tgt ? tgt.h : H], uTime: FRAME.t, uAud: FRAME.aud }, uni);
    for (const name in prog.u) {
      const u = prog.u[name];
      let v = all[name];
      if (u.type === gl.SAMPLER_2D) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v ? (v.tex || v) : blank);
        gl.uniform1i(u.loc, unit++);
        continue;
      }
      if (v === undefined) continue;
      if (typeof v === 'boolean') v = v ? 1 : 0;
      switch (u.type) {
        case gl.FLOAT: u.size > 1 ? gl.uniform1fv(u.loc, v) : gl.uniform1f(u.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
        case gl.INT: gl.uniform1i(u.loc, v); break;
        case gl.FLOAT_MAT2: gl.uniformMatrix2fv(u.loc, false, v); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
      }
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- 2D layers (Canvas2D), uploaded as premultiplied textures, flipped to GL orientation
  function makeLayer() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    return { c, g, tex: texture(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR), used: false };
  }
  const layers = [makeLayer(), makeLayer(), makeLayer(), makeLayer()];
  const text = makeLayer();
  function upload(L) {
    gl.bindTexture(gl.TEXTURE_2D, L.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, L.c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  // ---- post programs
  const P = {};
  function postPrograms() {
    P.glow = program('glow', `
uniform sampler2D uSrc; uniform vec4 uG[12]; uniform vec4 uGC[12]; uniform float uN;
void main(){
  vec3 c = texture(uSrc, vUv).rgb; float a = texture(uSrc, vUv).a;
  vec2 px = vUv*uR;
  for(int i=0;i<12;i++){ if(float(i)>=uN) break;
    vec2 d = px - uG[i].xy; float r2 = dot(d,d);
    float core = exp(-r2/(uG[i].z*uG[i].z));             // tight core
    float halo = uG[i].w / (1. + r2/(uG[i].z*uG[i].z*9.)); // soft falloff
    c += uGC[i].rgb * uGC[i].a * (core + halo*.18);
  }
  fragColor = vec4(c, a);
}`);
    P.mix = program('mix', `
uniform sampler2D uA, uB; uniform float uK; uniform float uMode;
void main(){
  vec4 a = texture(uA, vUv), b = texture(uB, vUv);
  float k = uK;
  if(uMode > .5){ // luminance-keyed dissolve: bright parts of the new shot arrive first
    float n = fbm(vUv*vec2(6.,3.4)+3.1);
    k = smoothstep(n-.25, n+.25, uK*1.5-.25);
  }
  fragColor = mix(a, b, k);
}`);
    P.bright = program('bright', `
uniform sampler2D uSrc; uniform float uThr;
void main(){
  vec2 o = 1./uR*.5;
  vec3 c = (texture(uSrc,vUv+vec2(-o.x,-o.y)).rgb + texture(uSrc,vUv+vec2(o.x,-o.y)).rgb + texture(uSrc,vUv+vec2(-o.x,o.y)).rgb + texture(uSrc,vUv+vec2(o.x,o.y)).rgb)*.25;
  c = min(c, vec3(24.));
  float l = max(c.r,max(c.g,c.b));
  float k = max(l-uThr,0.); k = k*k/(l*.5+uThr+1e-4) + max(l-uThr*2.,0.)*.5;
  fragColor = vec4(c*(k/max(l,1e-4)), 1.);
}`);
    P.down = program('down', `
uniform sampler2D uSrc; uniform vec2 uTex;
void main(){
  vec2 h = uTex*.5;
  vec3 s = texture(uSrc, vUv).rgb*4.;
  s += texture(uSrc, vUv-h).rgb + texture(uSrc, vUv+h).rgb + texture(uSrc, vUv+vec2(h.x,-h.y)).rgb + texture(uSrc, vUv-vec2(h.x,-h.y)).rgb;
  fragColor = vec4(s/8., 1.);
}`);
    P.up = program('up', `
uniform sampler2D uSrc, uAdd; uniform vec2 uTex; uniform float uW;
void main(){
  vec2 h = uTex*.5;
  vec3 s = texture(uSrc, vUv+vec2(-h.x*2.,0.)).rgb + texture(uSrc, vUv+vec2(-h.x,h.y)).rgb*2. + texture(uSrc, vUv+vec2(0.,h.y*2.)).rgb
        + texture(uSrc, vUv+vec2(h.x,h.y)).rgb*2. + texture(uSrc, vUv+vec2(h.x*2.,0.)).rgb + texture(uSrc, vUv+vec2(h.x,-h.y)).rgb*2.
        + texture(uSrc, vUv+vec2(0.,-h.y*2.)).rgb + texture(uSrc, vUv+vec2(-h.x,-h.y)).rgb*2.;
  fragColor = vec4(s/12. + texture(uAdd, vUv).rgb*uW, 1.);
}`);
    P.rays = program('rays', `
uniform sampler2D uSrc; uniform vec2 uSun; uniform float uDecay; uniform float uLen;
void main(){
  vec2 uv = vUv; vec2 d = (uSun - uv)*uLen/48.;
  float j = hash12(gl_FragCoord.xy+fract(uTime)*91.);
  uv += d*j;
  float s = 0., w = 1.;
  for(int i=0;i<48;i++){ s += texture(uSrc, uv).a*w; w *= uDecay; uv += d; }
  fragColor = vec4(vec3(s/48.), 1.);
}`);
    P.final = program('final', `
uniform sampler2D uSrc, uBloom, uRays, uText;
uniform float uExp, uBloomK, uRaysK, uVig, uGrain, uFade, uWhite, uSatur, uTextA, uFrame, uContrast;
uniform vec3 uLift, uGamma, uGain, uRayCol;
void main(){
  vec3 c = texture(uSrc, vUv).rgb;
  vec3 b = texture(uBloom, vUv).rgb;
  c += b*uBloomK;
  c += texture(uRays, vUv).r*uRayCol*uRaysK;
  c *= uExp;
  c = aces(c);
  c = pow(max(c,0.), vec3(1./2.2));
  // grade
  c = pow(max(c,0.), 1./uGamma)*uGain + uLift*(1.-c);
  float l = luma(c);
  c = mix(vec3(l), c, uSatur);
  c = mix(vec3(.5), c, uContrast);
  vec2 q = vUv-.5; q.x *= uR.x/uR.y;
  c *= mix(1., smoothstep(1.25, .25, length(q)), uVig);
  c = mix(c, vec3(1.,.985,.96), uWhite);
  c *= 1.-uFade;
  vec4 tx = texture(uText, vUv);
  c = c*(1.-tx.a*uTextA) + tx.rgb*uTextA;
  float g = hash12(gl_FragCoord.xy + uFrame*vec2(37.1,11.7)) + hash12(gl_FragCoord.xy*1.37 + uFrame*vec2(5.3,71.9)) - 1.;
  c += g*uGrain*(.6+.4*(1.-l)) + (hash12(gl_FragCoord.yx+uFrame)-.5)/255.;
  fragColor = vec4(clamp(c,0.,1.), 1.);
}`);
  }

  const POST_DEFAULT = {
    exp: 1, bloom: .5, thr: 1.0, rays: 0, raysDecay: .97, raysLen: .9, rayCol: [1, .8, .55], sun: [.5, .5],
    vig: .55, grain: .02, fade: 0, white: 0, satur: 1, contrast: 1,
    lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
  };

  function lerpPost(a, b, k) {
    const o = {};
    for (const key in POST_DEFAULT) {
      const x = a[key], y = b[key];
      o[key] = Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * k) : x + (y - x) * k;
    }
    return o;
  }

  return {
    gl, W, H, program, target, run, layers, text, upload, blank, P, postPrograms, POST_DEFAULT, lerpPost,
    setFrame(f) { FRAME = f; },
  };
})();
