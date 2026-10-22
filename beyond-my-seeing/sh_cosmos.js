// Act VII shaders: flight through creation, worlds, a sea of clouds, the converging light.
SHADERS.flight = `
uniform float uSpd, uZ, uCore; uniform vec2 uC;
vec3 nebPal(float i){ return i<1.?vec3(.7,.2,.5): i<2.?vec3(.15,.35,.9): i<3.?vec3(1.,.55,.25): i<4.?vec3(.4,.25,.9): i<5.?vec3(.15,.55,.6): vec3(.9,.3,.25); }
void main(){
  vec2 uv = (gl_FragCoord.xy - uC)/uR.y;
  vec3 col = vec3(.002,.002,.008);
  // soft nebula veils at cycling depths, back to front; mostly dark space between them
  col += vec3(.02,.01,.04)*smoothstep(1.2, 0., length(uv));
  for(int i=5;i>=0;i--){
    float fi = float(i);
    float cyc = fi/6. - uZ*.12;
    float d = fract(cyc);                      // 0 near .. 1 far
    float scale = mix(.18, 4.5, d);
    vec2 p = uv*scale + vec2(fi*3.7, fi*1.3) + vec2(floor(cyc)*5.1);
    float n = fbm(p*.8 + fbm(p*.5)*1.2);
    float dens = smoothstep(.6, .92, n);
    float a = smoothstep(0., .3, d)*smoothstep(1., .6, d);
    vec3 nc = nebPal(mod(fi + floor(cyc)*2., 6.));
    col += nc*dens*a*.3 + nc*pow(dens, 4.)*a*.3;
  }
  // stars streaming past: cells in (angle, log radius) space
  float r = length(uv), ang = atan(uv.y, uv.x);
  float lr = log(r + .001);
  for(int l=0;l<2;l++){
    float fl = float(l);
    vec2 q = vec2(ang*(40. + fl*25.)/TAU*6., (lr - uZ*(.9+fl*.4))*(9. + fl*4.));
    vec2 id = floor(q), f = fract(q);
    float h = hash12(id + fl*31.);
    if(h < .09){
      vec2 o = .2 + .6*hash22(id + fl*7.);
      float streak = uSpd*.6;
      vec2 dq = f - o; dq.y = dq.y > 0. ? max(dq.y - streak, 0.) : dq.y;
      float dd = length(dq*vec2(1., 1.));
      float m = hash12(id + 3.);
      col += mix(vec3(.7,.8,1.), vec3(1.,.85,.6), m)*exp(-dd*dd*140.)*(.35 + 1.6*pow(m, 6.))*smoothstep(.0, .35, r);
    }
  }
  col += vec3(1.,.85,.6)*uCore*(exp(-r*7.)*1.2 + exp(-r*25.)*3.);
  fragColor = vec4(col, 0.);
}`;

SHADERS.planet = `
uniform vec2 uPC; uniform float uPR, uType, uRotP, uSeed; uniform vec3 uLight, uAtm;
vec3 surface(vec2 s, float ty){
  // s: lon/lat-like coordinates on the sphere
  if(ty < .5){ float b = s.y*7. + fbm(s*vec2(2.,6.) + uSeed)*2.6; return mix(vec3(.85,.65,.45), vec3(.55,.32,.2), .5+.5*sin(b*2.)) * (.8 + .3*noise(s*30.)); }
  if(ty < 1.5){ float l = fbm(s*2.2 + uSeed); vec3 c = l > .55 ? mix(vec3(.25,.42,.18), vec3(.6,.5,.3), smoothstep(.55,.75,l)) : mix(vec3(.02,.08,.25), vec3(.05,.2,.45), l*1.6);
    float cl = smoothstep(.55,.8, fbm(s*3.5 + uSeed*2. + vec2(uTime*.02,0.))); return mix(c, vec3(.95), cl*.85); }
  if(ty < 2.5){ float cr = pow(1. - abs(noise(s*9. + uSeed)*2. - 1.), 18.); return mix(vec3(.82,.9,1.), vec3(.4,.6,.85), cr*.8 + .15*noise(s*20.)); }
  if(ty < 3.5){ float d = fbm(s*4. + uSeed); vec2 g = s*5.; vec2 id = floor(g); vec2 o = hash22(id)*.6+.2; float cr = length(fract(g)-o); float rr = .1+.15*hash12(id+1.);
    float cra = (smoothstep(rr, rr*.7, cr)*.14 - smoothstep(rr*1.25, rr, cr)*smoothstep(rr*.9, rr, cr)*.1)*step(.55, hash12(id+4.));
    float dune = .5+.5*sin(s.x*40. + fbm(s*8.)*6.); return mix(vec3(.62,.26,.1), vec3(.92,.58,.3), d*.8 + dune*.15)*(1. - cra); }
  if(ty < 4.5){ float cr = pow(1. - abs(noise(s*7. + uSeed)*2. - 1.), 10.); return vec3(.03,.02,.02) + vec3(4.,1.2,.2)*cr; }
  float b = s.y*5. + fbm(s*vec2(2.,5.) + uSeed)*1.6; return mix(vec3(.9,.82,.6), vec3(.7,.55,.35), .5+.5*sin(b*2.3));
}
void main(){
  vec2 px = gl_FragCoord.xy;
  vec3 col = vec3(.002,.002,.007) + stars(px, 10., .12, uSeed) + milkyWay(rot(.4)*(px/uR.y - .5) + uSeed, .25);
  vec2 d = (px - uPC)/uPR;
  float r = length(d);
  vec3 L = normalize(uLight);
  // rings (behind and in front)
  float ringK = 0.;
  vec2 rd = rot(.35)*d; float rr = length(rd*vec2(1., 3.4));
  if(uType > 4.5) ringK = smoothstep(1.4,1.43,rr)*smoothstep(2.25,2.2,rr)*(.35 + .45*noise(vec2(rr*60., 0.)) + .2*noise(vec2(rr*200., 1.)))*(1. - smoothstep(1.83,1.86,rr)*smoothstep(1.92,1.89,rr))*.7;
  bool front = rd.y < 0.;
  if(!front || r > 1.) col = mix(col, vec3(.9,.82,.65)*.8, ringK*(r > 1. || !front ? 1. : 0.));
  if(r < 1.){
    vec3 n = vec3(d, sqrt(1. - r*r));
    vec2 s = vec2(atan(n.x, n.z) + uRotP, asin(n.y));
    vec3 sc = surface(s, uType);
    float lam = max(dot(n, L), 0.);
    float term = smoothstep(-.05, .25, dot(n, L));
    col = sc*(lam*1.2 + .02)*term + (uType > 3.5 && uType < 4.5 ? sc*.6 : vec3(0.));
    float rim = pow(1. - n.z, 3.);
    col += uAtm*rim*(.3 + 1.2*smoothstep(-.3, .6, dot(n, L)));
    if(front) col = mix(col, vec3(.9,.82,.65)*(.25 + .75*term), ringK);
  }
  float halo = exp(-max(r - 1., 0.)*9.)*step(1., r);
  col += uAtm*halo*.5*smoothstep(-.6, .6, dot(normalize(vec3(d, .2)), L));
  fragColor = vec4(col, 0.);
}`;

SHADERS.clouds = `
uniform float uFly, uSunEl, uHgt; uniform vec3 uSunCol;
float cloudH(vec2 p){ return pow(fbm(p*.035), 1.6)*2.2 + fbm(p*.12 + 3.)*.45; }
void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uR)/uR.y;
  vec3 ro = vec3(0., uHgt, uFly);
  vec3 rd = normalize(vec3(uv.x, uv.y - .12, 1.1));
  vec3 sun = normalize(vec3(0., sin(uSunEl), cos(uSunEl)));
  // sky
  float e = max(rd.y, 0.);
  vec3 col = mix(vec3(.95,.45,.22), vec3(.05,.08,.28), 1. - exp(-e*7.));
  float mu = dot(rd, sun);
  col += uSunCol*(pow(max(mu,0.), 900.)*14. + pow(max(mu,0.), 60.)*.25 + pow(max(mu,0.), 8.)*.08);
  float skyA = 0.;
  if(rd.y < 0.){
    float t = (ro.y - 1.)/(-rd.y);
    vec3 p = ro + rd*t;
    float h = cloudH(p.xz);
    vec2 e2 = vec2(.8, 0.);
    vec3 n = normalize(vec3(-(cloudH(p.xz+e2.xy)-h)/.8*9., 1., -(cloudH(p.xz+e2.yx)-h)/.8*9.));
    float lit = clamp(dot(n, normalize(sun + vec3(0.,.3,0.))), 0., 1.);
    vec3 cc = mix(vec3(.04,.05,.14), vec3(1.,.6,.4), pow(lit, 1.6)) + uSunCol*pow(max(dot(reflect(rd, n), sun), 0.), 12.)*.05;
    cc *= .35 + .75*smoothstep(.2, 1.3, h);
    float fog = 1. - exp(-t*.0035);
    vec3 hz = mix(vec3(.7,.34,.22), uSunCol*.2, pow(max(dot(normalize(vec3(rd.x,0.,rd.z)), normalize(vec3(sun.x,0.,sun.z))),0.), 6.));
    col = mix(cc, hz, fog);
  } else skyA = clamp(pow(max(mu,0.), 30.), 0., 1.);
  col += texture(uL2, gl_FragCoord.xy/uR).rgb;
  fragColor = vec4(col, skyA);
}`;

SHADERS.radiance = `
uniform vec2 uC; uniform float uK, uSpd; uniform vec3 uSil;
void main(){
  vec2 px = gl_FragCoord.xy;
  vec2 d = (px - uC)/uR.y;
  float r = length(d), a = atan(d.y, d.x);
  vec3 col = vec3(.01,.008,.012);
  float rays = pow(noise(vec2(a*14., uTime*.3)), 3.)*.8 + pow(noise(vec2(a*41. + 3., uTime*.5)), 4.)*.6;
  col += vec3(1.,.78,.5)*rays*exp(-r*(2.6 - uK*1.4))*uK*1.6;
  // streaks rushing outward
  vec2 q = vec2(a*60./TAU*4., log(r + .01)*10. - uTime*uSpd);
  vec2 id = floor(q), f = fract(q);
  if(hash12(id) < .3){ float s = exp(-pow((f.x - .5)*6., 2.))*smoothstep(1., .2, f.y)*smoothstep(0., .1, f.y); col += vec3(1.,.9,.75)*s*.7*uK*smoothstep(.02,.2,r); }
  col += vec3(1.,.9,.75)*(exp(-r*r*40.)*2. + exp(-r*6.)*.8)*(.4 + uK*2.2);
  vec2 uv = px/uR;
  float a0 = texture(uL0, uv).a;
  col = mix(col, uSil, a0*(1. - uK*.55));
  col += texture(uL2, uv).rgb;
  fragColor = vec4(col, clamp(exp(-r*4.)*uK, 0., 1.));
}`;
