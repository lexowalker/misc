// Act IV shaders: a raindrop holding a thousand suns, the halls of memory, faces holding worlds, a galaxy.
SHADERS.drop = `
uniform vec2 uDC; uniform float uDR, uIn;
vec3 suns(vec2 q){
  return stars(q, 6.5, .42, 21.)*vec3(1.,.78,.45)*1.6 + stars(q*.6+33., 11., .3, 5.)*vec3(1.,.9,.7)*1.2;
}
vec3 bokeh(vec2 px, float k){
  vec3 c = vec3(0.);
  for(int l=0;l<2;l++){
    float sc = l==0 ? 230. : 140.;
    vec2 g = px/sc + float(l)*7.3; vec2 id = floor(g), f = fract(g);
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
      vec2 cid = id + vec2(i,j);
      float h = hash12(cid + float(l)*13.);
      if(h > .42) continue;
      vec2 cp = vec2(i,j) + hash22(cid) - f;
      float r = (.22 + .3*hash12(cid+5.))*k;
      float d = length(cp);
      float disc = smoothstep(r, r*.93, d)*(.55 + .45*smoothstep(r*.5, r, d));
      vec3 col = mix(vec3(1.,.62,.28), vec3(1.,.85,.6), hash12(cid+9.));
      c += col*disc*(.05 + .12*hash12(cid+2.));
    }
  }
  return c;
}
void main(){
  vec2 px = gl_FragCoord.xy;
  vec3 col = vec3(.003,.003,.008) + bokeh(px + vec2(0., uTime*10.), 1.)*uIn;
  vec2 d = (px - uDC)/uDR; d.y *= .95;
  float r = length(d);
  if(r < 1.){
    vec3 n = vec3(d, sqrt(1. - r*r));
    vec3 rd = refract(vec3(0,0,-1), n, 1./1.33);
    vec2 q = uDC - d*uDR*2.2 + rd.xy*uDR*1.2;
    vec3 inside = suns(q) + bokeh(q*1.6, .5)*1.2 + vec3(.012,.008,.016);
    float F = .03 + .97*pow(1. - n.z, 5.);
    col = inside*(1. - F) + vec3(.25,.3,.5)*.25*F;
    vec3 L = normalize(vec3(-.45,.6,.65));
    col += vec3(1.,.96,.92)*pow(max(dot(reflect(-L,n), vec3(0,0,1)),0.), 90.)*3.;
    col += vec3(1.,.8,.55)*pow(max(dot(reflect(-normalize(vec3(.6,-.5,.6)),n), vec3(0,0,1)),0.), 30.)*.4;
    col *= smoothstep(1., .975, r);
  }
  col += vec3(.7,.75,1.)*exp(-pow((r-1.)*uDR/1.5, 2.))*.06;
  fragColor = vec4(col, 0.);
}`;

SHADERS.hall = `
uniform float uZ; uniform vec3 uSil; uniform vec3 uFar; uniform float uFarK; uniform vec3 uFog;
const float HW = 3.2, HC = 9., D = 5.5, A = 2.1, S = 3.6;
float inOpening(vec2 q){
  float R = A*1.7;
  float aq = abs(q.x);
  if(q.y < 0.) return -1.;
  if(q.y < S) return aq - A;
  return length(vec2(aq - (A - R), q.y - S)) - R;
}
// returns colour and distance along the ray
vec4 trace(vec3 ro, vec3 rd, bool refl){
  float tW = rd.x > 0. ? (HW - ro.x)/rd.x : (-HW - ro.x)/rd.x;
  float tF = rd.y < 0. ? -ro.y/rd.y : 1e9;
  float tC = rd.y > 0. ? (HC - ro.y)/rd.y : 1e9;
  float t = min(tW, min(tF, tC));
  int what = t == tW ? 1 : (t == tF ? 2 : 3);
  float k0 = floor(ro.z/D) + 1.;
  float aid = 0.;
  for(int i=0;i<16;i++){
    float z = (k0 + float(i))*D;
    float ta = (z - ro.z)/rd.z;
    if(ta > t) break;
    vec3 p = ro + rd*ta;
    if(inOpening(p.xy) > 0.){ t = ta; what = 4; aid = k0 + float(i); break; }
  }
  vec3 p = ro + rd*t;
  vec3 col;
  float zl = mod(p.z, D);
  if(what == 4){
    vec2 q = p.xy;
    float e = inOpening(q);
    col = vec3(.05,.05,.06)*(.5 + .5*noise(q*3.));
    col += uFar*.5*exp(-e*9.)*exp(-t*.025);                     // light from the next hall on the arch's edge
    col *= .7 + .3*smoothstep(0., HC, q.y);
  } else if(what == 1){
    // side walls: tall windows of night sky on the right
    col = vec3(.025,.025,.035);
    float win = step(1.4, zl)*step(zl, D - 1.4)*step(1.2, p.y)*step(p.y, 6.4);
    if(p.x > 0. && win > 0.){
      vec2 sq = vec2(p.z*40., p.y*40.);
      col = vec3(.03,.05,.12) + stars(sq, 9., .2, 3.)*.8 + vec3(.15,.2,.4)*.15;
    }
    if(p.x < 0.) col += vec3(.35,.42,.6)*.12*step(1.0, zl)*step(zl, D - 1.0)*smoothstep(6.5, 1., p.y)*.6;
  } else if(what == 2){
    // floor: polished dark stone, moonlight patches cast through the windows
    vec2 f = p.xz;
    col = vec3(.02,.02,.028)*(.7 + .3*noise(f*2.));
    float sh = mod(p.z + (HW - p.x)*.55, D);
    float moonPatch = smoothstep(1.3, 1.6, sh)*smoothstep(D - 1.3, D - 1.6, sh)*smoothstep(-HW, -HW + 1.2, p.x);
    col += vec3(.35,.42,.6)*moonPatch*.35;
    float tile = smoothstep(.02, 0., abs(fract(f.x*.5) - .5) - .48) + smoothstep(.02, 0., abs(fract(f.y*.5) - .5) - .48);
    col *= 1. - tile*.25;
  } else {
    col = vec3(.02,.02,.03);
  }
  col = mix(col, uFog, 1. - exp(-t*.03));
  col += uFar*exp(-t*.012)*0. ;
  return vec4(col, t);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uR)/uR.y;
  vec3 ro = vec3(0., 1.7, uZ);
  vec3 rd = normalize(vec3(uv.x, uv.y + .05, 1.15));
  vec4 h = trace(ro, rd, false);
  vec3 col = h.rgb;
  if(rd.y < 0. && abs(ro.y/rd.y - h.a) < .01){
    vec3 p = ro + rd*h.a;
    vec3 rr = vec3(rd.x, -rd.y, rd.z);
    vec4 r = trace(p + rr*.01, rr, true);
    float F = .05 + .5*pow(1. - abs(rd.y), 5.);
    col += r.rgb*F*1.2;
  }
  // the far doorway: always another light ahead
  col += uFar*uFarK*(.7*exp(-length(uv)*13.) + .06*exp(-length(uv)*4.));
  vec2 sv = gl_FragCoord.xy/uR;
  float a0 = texture(uL0, sv).a;
  col = mix(col, uSil, a0);
  col += texture(uL2, sv).rgb;
  fragColor = vec4(col, 0.);
}`;

SHADERS.faces = `
uniform vec4 uHC[6]; uniform float uRimK;
vec3 world(float id, vec2 p, float t){
  // p: roughly -1..1 across the head
  vec3 c;
  if(id < 1.5){        // night sky over mountains
    c = mix(vec3(.02,.04,.12), vec3(.0,.005,.02), p.y*.5+.5);
    c += milkyWay(rot(.6)*p*1.2 + vec2(t*.01,0.), .9) + stars(p*500., 7., .2, 2.)*.9;
    float m = -.35 + .18*ridge1(p.x*3. + 4., .7);
    if(p.y < m) c = vec3(.005,.006,.012);
  } else if(id < 2.5){ // sunrise sea
    c = mix(vec3(1.,.55,.3), vec3(.15,.2,.45), smoothstep(-.1,.8,p.y));
    c += vec3(4.,2.4,1.)*exp(-length(p - vec2(.1,-.05))*9.);
    if(p.y < -.08){ c = vec3(.03,.05,.1) + vec3(2.,1.2,.5)*pow(noise(vec2(p.x*30., p.y*90. - t)), 6.)*exp(-abs(p.x-.1)*5.)*1.5; }
  } else if(id < 3.5){ // forest under the moon
    c = mix(vec3(.08,.12,.2), vec3(.02,.03,.07), p.y*.5+.5);
    c += vec3(.9,.95,1.)*smoothstep(.11,.1,length(p - vec2(-.3,.45)))*1.5 + vec3(.3,.35,.5)*exp(-length(p - vec2(-.3,.45))*4.)*.4;
    float tr = -.2 + .35*pow(noise1(p.x*14.), 2.) + .2*noise1(p.x*40.);
    if(p.y < tr) c = vec3(.004,.008,.01);
  } else if(id < 4.5){ // a city's lights at dusk
    c = mix(vec3(.9,.45,.3), vec3(.1,.08,.25), smoothstep(-.2,.6,p.y));
    float bh = -.1 + .4*noise1(floor(p.x*18.)*1.7);
    if(p.y < bh){
      c = vec3(.01,.01,.02);
      vec2 w = fract(p*vec2(70.,90.)); vec2 wi = floor(p*vec2(70.,90.));
      c += vec3(1.,.75,.4)*step(.6, hash12(wi))*step(.25,w.x)*step(w.x,.75)*step(.25,w.y)*step(w.y,.75)*.9;
    }
  } else if(id < 5.5){ // aurora over snow
    c = vec3(.005,.01,.03);
    float cur = exp(-max(p.y - (.0 + .15*noise1(p.x*3. + t*.1)), 0.)*3.)*step(.0 + .15*noise1(p.x*3. + t*.1), p.y);
    c += vec3(.1,1.,.5)*cur*(.4 + .6*pow(noise(vec2(p.x*30. + t*.3, 1.)),2.))*.8;
    c += stars(p*500.+9., 8., .15, 4.)*.6;
    if(p.y < -.4 + .05*noise1(p.x*5.)) c = vec3(.25,.3,.4)*(.5 + .3*p.y);
  } else {             // the deep: a nebula
    float n = fbm(p*2.5 + vec2(t*.02, 0.));
    c = mix(vec3(.02,.0,.05), vec3(.8,.2,.5), smoothstep(.4,.8,n))*.8 + vec3(.2,.5,1.)*smoothstep(.55,.9,fbm(p*4.+3.))*.6;
    c += stars(p*500.+5., 7., .2, 7.)*.8;
  }
  return c;
}
void main(){
  vec2 px = gl_FragCoord.xy, uv = px/uR;
  vec4 m = texture(uL0, uv);
  vec3 bg = mix(vec3(.012,.012,.02), vec3(.03,.025,.045), uv.y) + stars(px, 12., .06, 1.)*.3;
  vec3 col = bg;
  if(m.a > .001){
    float id = floor(m.r/m.a*8. + .5);
    vec4 hc = uHC[int(clamp(id-1., 0., 5.))];
    vec2 p = (px - hc.xy)/hc.z + vec2(hc.w, 0.);
    vec3 w = world(id, p, uTime);
    col = mix(bg, w, m.a);
    // rim: a thin warm edge on the outline
    float e = 0.;
    for(int k=1;k<=2;k++){ e += m.a - texture(uL0, uv + vec2(float(k)*1.5,0.)/uR).a; e += m.a - texture(uL0, uv - vec2(float(k)*1.5,0.)/uR).a; e += m.a - texture(uL0, uv + vec2(0.,float(k)*1.5)/uR).a; }
    col += vec3(1.,.8,.6)*clamp(e*.4,0.,1.)*uRimK;
  }
  col += texture(uL2, uv).rgb;
  fragColor = vec4(col, 0.);
}`;

SHADERS.galaxy = `
uniform vec2 uGC; uniform float uGS, uGRot, uTilt, uBright, uBgStars;
void main(){
  vec2 px = gl_FragCoord.xy;
  vec3 col = vec3(.002,.002,.006) + stars(px, 11., .1, 3.)*uBgStars;
  vec2 p = rot(uGRot)*((px - uGC)/uGS);
  p.y /= uTilt;
  float r = length(p), a = atan(p.y, p.x);
  float sp = a - log(r + .03)*2.3;
  float arm = pow(.5 + .5*cos(2.*sp), 3.);
  float arm2 = pow(.5 + .5*cos(2.*sp + 1.), 6.);
  float n = fbm(p*5. + vec2(1.3, 7.1));
  float dens = exp(-r*2.4)*(.25 + arm*1.5*(.55 + .9*n));
  float dust = smoothstep(.42,.72, fbm(p*12. + 3.))*arm2*exp(-r*1.8);
  vec3 gc = mix(vec3(1.,.82,.58), vec3(.5,.66,1.), smoothstep(.08,.6,r));
  vec3 g = gc*dens*1.4;
  g += vec3(1.,.9,.72)*(exp(-r*r*90.)*4. + exp(-r*9.)*.8);
  g *= 1. - dust*.75;
  g += vec3(1.,.38,.55)*pow(noise(p*38.), 14.)*arm*exp(-r*1.2)*7.;
  g += stars(p*uGS*.9 + 300., 4., .35*exp(-r*1.5), 13.)*arm*1.2;
  float edge = smoothstep(1.6, .9, r);
  col += g*edge*uBright;
  fragColor = vec4(col, 0.);
}`;

// A dark stone room: a crystal's light, a shuttered window that bursts open on the dawn.
SHADERS.room = `
uniform vec2 uCrys; uniform float uCrysK; uniform vec4 uWin; uniform float uOpen; uniform vec3 uDawn; uniform vec3 uSil;
void main(){
  vec2 px = gl_FragCoord.xy, uv = px/uR;
  // stone wall
  float st = .6 + .4*fbm(px/90.) ;
  float joints = smoothstep(.0, .04, abs(fract(px.y/70.) - .5) - .46) + smoothstep(.0, .04, abs(fract(px.x/140. + floor(px.y/70.)*.5) - .5) - .47);
  vec3 wall = vec3(.05,.042,.038)*st*(1. - joints*.4);
  // crystal light on the wall
  float dc = length(px - uCrys)/uR.y;
  vec3 col = wall*(.08 + uCrysK*(1.6*exp(-dc*3.2) + .3*exp(-dc*1.2)))*vec3(1.,.75,.5);
  // window: closed shutters leak lines of dawn; open, the dawn floods in
  vec2 wp = (px - uWin.xy)/uWin.zw;
  float inWin = step(0., wp.x)*step(wp.x, 1.)*step(0., wp.y)*step(wp.y, 1.);
  vec3 sky = mix(uDawn*.9, vec3(.22,.3,.6), smoothstep(.15, 1.1, wp.y)) + uDawn*2.2*exp(-length((wp - vec2(.45,.22))*vec2(1.,1.4))*6.);
  sky = mix(sky, vec3(.08,.06,.07), smoothstep(.2, .16, wp.y)*(.6 + .4*noise(vec2(wp.x*12., 1.))));
  col = mix(col, sky, inWin*uOpen);
  // light thrown into the room from the open window
  vec2 toW = uWin.xy + uWin.zw*.5 - px;
  float wl = exp(-length(toW)/uR.y*3.)*uOpen;
  // the window's light cast onto the far wall and the floor, slanting down to the left
  vec2 bp = px - vec2(uWin.x - (uWin.y + uWin.w*.0 - px.y)*.0, 0.);
  float sx = (px.x - (uWin.x - (uWin.y + uWin.w - px.y)*.9))/(uWin.z*1.3);
  float beam = smoothstep(-.05, .1, sx)*smoothstep(1.05, .9, sx)*smoothstep(uWin.y + uWin.w + 80., uWin.y + uWin.w - 40., px.y)*smoothstep(uWin.x + 60., uWin.x - 120., px.x)*uOpen;
  col += wall*uDawn*(wl*3.5 + beam*5.) + uDawn*beam*.03;
  float floorY = uR.y*.18;
  if(px.y < floorY){ col = vec3(.03,.025,.022)*(.6 + .4*noise(px/30.))*(.15 + uCrysK*1.4*exp(-dc*2.5) + wl*3.*uDawn.r + beam*6.); }
  // silhouettes, rim-lit by the crystal and the window
  float a0 = texture(uL0, uv).a;
  if(a0 > 0.){
    vec2 sd = normalize(uCrys - px + 1e-3);
    vec2 sw = normalize(toW + 1e-3);
    float e = 0., e2 = 0.;
    for(int k=1;k<=3;k++){ e += a0 - texture(uL0, uv + sd*float(k)*1.6/uR).a; e2 += a0 - texture(uL0, uv + sw*float(k)*1.6/uR).a; }
    col = mix(col, uSil, a0) + vec3(1.,.7,.4)*clamp(e*.5,0.,1.)*uCrysK*1.4*exp(-dc*6.) + uDawn*clamp(e2*.5,0.,1.)*uOpen*1.6*exp(-length(toW)/uR.y*1.5);
  }
  col += texture(uL2, uv).rgb*1.6;
  fragColor = vec4(col, inWin*uOpen*.9*(1.-a0));
}`;
