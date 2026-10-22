// Misc shaders: the eye.
SHADERS.iris = `
uniform vec2 uC; uniform float uS, uPupil, uRefl, uLid, uZoom, uLight;
uniform vec3 uSunCol, uIrisA, uIrisB, uSkin;
uniform vec3 uSunDir;
vec3 env(vec3 R){
  // what the eye sees, reflected in the cornea
  vec3 c;
  if(uRefl < .5){
    float e = R.y;
    c = mix(vec3(.02,.02,.04), mix(vec3(.4,.2,.13), vec3(.05,.08,.18), smoothstep(0.,.45,e)), smoothstep(-.15,.1,e));
    c += uSunCol*.1*exp(-abs(R.x-uSunDir.x)*14.)*smoothstep(-.5,0.,e)*smoothstep(.1,-.05,e);
    float d = length(R - uSunDir);
    c += uSunCol*(smoothstep(.05,.035,d)*30. + exp(-d*14.)*.8);
  } else {
    vec2 q = vec2(atan(R.x, R.z), asin(clamp(R.y,-1.,1.)))*900.;
    c = vec3(.002,.003,.008) + stars(q, 9., .2, 5.)*.7;
    c += milkyWay(rot(.5)*vec2(atan(R.x,R.z), R.y)*2.2, .25);
  }
  return c;
}
void main(){
  vec2 px = gl_FragCoord.xy;
  float S = uS*exp(uZoom);
  vec2 p = (px - uC)/S;
  float r = length(p), a = atan(p.y, p.x);
  vec3 col;
  float rp = uPupil;
  vec3 dir3 = vec3(cos(a), sin(a), 0.);
  // light falls across the concave iris from the side opposite the light
  float side = .55 + .75*smoothstep(-1.2, 1.2, -dot(p, normalize(uSunDir.xy+1e-4)));
  if(r < rp){
    col = vec3(.004,.003,.004);
    float inz = smoothstep(.4, 3., uZoom);
    vec3 night = vec3(.002,.003,.01) + stars((px-uC)*(1.+uZoom*.2)+500., 9., .2, 8.)*1.1 + milkyWay(rot(.7)*(px-uC)/uR.y*1.3+vec2(.3,.1), .45);
    col = mix(col, night, inz*smoothstep(rp, rp*.9, r));
  } else if(r < 1.){
    float t = (r - rp)/(1. - rp);
    float fib = fbm3(vec3(dir3.xy*46., t*2.6));
    float fib2 = noise3(vec3(dir3.xy*130., t*7.));
    float fib3 = pow(noise3(vec3(dir3.xy*220., t*1.5)), 3.)*2.;
    float rc = .34 + .05*noise3(vec3(dir3.xy*5., 1.)) + .03*noise3(vec3(dir3.xy*18., 4.));
    float coll = exp(-pow((t - rc)/.03, 2.));
    float crypt = smoothstep(.6, .8, noise3(vec3(dir3.xy*16., t*7.)))*smoothstep(rc, rc+.08, t)*smoothstep(.88, .62, t);
    float furrow = 0.;
    col = mix(uIrisA, uIrisB, smoothstep(rc-.06, rc+.3, t));
    col = mix(col, uIrisA*1.3, smoothstep(.06, .0, t)*.6);
    col *= .35 + .9*fib + .35*fib2 + .2*fib3;
    col += uIrisA*coll*.45;
    col *= 1. - crypt*.6 - furrow;
    col *= mix(1., .18, smoothstep(.8, 1., t));
    col *= .55 + .45*smoothstep(0., .06, t);
    col *= side*1.1;
  } else {
    float sc = smoothstep(2.1, 1.02, r);
    col = vec3(.5,.42,.38)*(.12 + .88*sc*sc)*side*.75;
    float vein = pow(1. - abs(noise3(vec3(p*4., 2.))*2.-1.), 22.)*smoothstep(1.1, 2., r);
    col = mix(col, vec3(.45,.08,.06), vein*.45);
    col *= mix(.55, 1., smoothstep(1., 1.1, r));
  }
  // cornea reflection
  float rr = min(r/1.25, 1.);
  vec3 n = normalize(vec3(p*.62, sqrt(max(1. - rr*rr*.39, .05))));
  vec3 R = reflect(vec3(0,0,-1), n);
  float F = .02 + .16*pow(rr, 4.);
  col = col*.9 + env(R)*F*smoothstep(1.3, 1.1, r);
  // eyelids at the frame's edges, a wet lid line and soft lashes
  float x = p.x;
  float up = uLid*.8 - .1*x*x, lo = -uLid*.74 + .08*x*x;
  float m = 2./S;
  float lidU = smoothstep(up, up + m*1.5, p.y), lidL = smoothstep(lo, lo - m*1.5, p.y);
  float wet = exp(-pow((p.y - lo)/.012, 2.))*.5 + exp(-pow((p.y - up)/.01, 2.))*.25;
  vec3 skin = uSkin*(.35 + .65*noise(p*6.))*(.6 + .4*side);
  col = mix(col, skin, clamp(lidU + lidL, 0., 1.));
  col += vec3(1.,.75,.6)*wet*uSunCol*.06;
  float k = (p.y - up)/.3;
  if(k > -.02){
    float strand = 0.;
    for(int i=0;i<2;i++){
      float fi = float(i);
      float s = x*(48.+fi*31.) + noise(vec2(x*5., fi))*7. - k*k*(4.+fi*2.)*sign(x);
      float len = .4 + .6*hash11(floor(s/PI)+fi*13.);
      strand += smoothstep(.93, .995, abs(sin(s)))*smoothstep(len, len*.3, k);
    }
    col = mix(col, vec3(.006), clamp(strand, 0., 1.)*.8);
  }
  col *= mix(1., .5, smoothstep(up - .25, up, p.y)*(1. - lidU));
  col *= uLight;
  fragColor = vec4(col, 0.);
}`;

// Composite two rendered worlds through a mask (a doorway), with a frame on top and light spilling at the edge.
SHADERS.portal = `
uniform sampler2D uA, uB; uniform vec3 uFrame; uniform vec3 uSpill; uniform float uSpillK;
void main(){
  vec2 uv = gl_FragCoord.xy/uR;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float m = texture(uL3, uv).a;
  vec3 col = mix(a, b, m);
  // light spilling out of the doorway
  float sp = 0.;
  for(int i=1;i<=6;i++){ float r = float(i)*5.; sp += texture(uL3, uv + vec2(r,0.)/uR).a + texture(uL3, uv - vec2(r,0.)/uR).a + texture(uL3, uv + vec2(0.,r)/uR).a; }
  col += uSpill*uSpillK*(sp/18.)*(1.-m);
  float f = texture(uL0, uv).a;
  col = mix(col, uFrame, f);
  col += texture(uL2, uv).rgb;
  fragColor = vec4(col, texture(uA, uv).a*(1.-f));
}`;

// Infinite fall through nested doorways; each opens onto another world.
SHADERS.doors = `
uniform float uZ; uniform float uF;
vec3 palTop(float i){ return i<1.?vec3(.01,.015,.05): i<2.?vec3(.06,.08,.22): i<3.?vec3(.14,.24,.45): i<4.?vec3(.12,.04,.14): i<5.?vec3(.0,.02,.04): vec3(.05,.04,.14); }
vec3 palHor(float i){ return i<1.?vec3(.12,.1,.25): i<2.?vec3(1.,.5,.32): i<3.?vec3(.8,.82,.86): i<4.?vec3(1.,.42,.16): i<5.?vec3(.05,.45,.35): vec3(.9,.55,.6); }
vec3 pal(float k, float y){
  float i = mod(k, 6.);
  return mix(palHor(i), palTop(i), 1.-exp(-max(y,0.)*3.2));
}
float doorSd(vec2 p){ // pointed arch: half-width .2, springline .32 above the ground at y=-.35
  vec2 q = p - vec2(0., -.35);
  float body = sdBox(q - vec2(0., .16), vec2(.2, .16));
  float r = .29; vec2 a = vec2(abs(q.x), q.y - .32);
  float top = max(length(a - vec2(.2 - r, 0.)) - r, -a.y);
  return min(body, max(top, a.x - .2));
}
void main(){
  vec2 p = (gl_FragCoord.xy - .5*uR)/uR.y;
  float z = uZ;
  float lvl = floor(z), fz = z - lvl;
  // focus point: the centre of the next door's opening
  vec2 c = vec2(0., -.35 + .24);
  vec2 q = (p - vec2(0.,0.))*pow(uF, -fz) + c*(1.-pow(uF,-fz));
  vec3 col = vec3(0.);
  float k = lvl;
  for(int i=0;i<7;i++){
    float d = doorSd(q);
    if(d > 0.){
      // world k: sky with a glow on the horizon, far ridges in mist, ground, stars in the night worlds
      float y = q.y, mk = mod(k,6.);
      vec3 sky = pal(k, y + .35);
      sky += palHor(mk)*.6*exp(-length((q - vec2(.0,-.35))*vec2(.7,3.))*2.5);
      float rx = q.x*3. + k*13.;
      float rh = -.35 + .07*ridge1(rx*1.3, .7) - .02;
      float rh2 = -.35 + .035*ridge1(rx*2.7+5., .5);
      vec3 rc = mix(palHor(mk), palTop(mk), .55)*.45;
      if(y < rh) sky = mix(rc, palHor(mk), .25);
      if(y < rh2) sky = rc*.5;
      float ground = smoothstep(-.345, -.352, y);
      col = mix(sky, palTop(mk)*.15, ground);
      if(mk < 1. || (mk > 3.9 && mk < 5.)){ col += stars(q*1200. + k*77., 9., .12, k)*(1.-ground)*smoothstep(-.3,-.1,y); }
      if(mk > 3.9 && mk < 5.){ col += vec3(.1,.9,.6)*.35*smoothstep(-.1,.3,y)*exp(-max(y-.1,0.)*3.)*(.5+.5*noise(vec2(q.x*20.,k))); }
      // the doorway: dark stone with a rim of the light behind it
      float fr = smoothstep(.0, .002, d) * smoothstep(.05, .046, d);
      // light spilling forward from the opening onto the ground
      float below = max(-.35 - y, 0.);
      float spill = smoothstep(-.35, -.5, y)*exp(-abs(q.x)/(.22 + below*.9))*exp(-below*3.);
      col = mix(col, vec3(.008,.007,.01), fr);
      col += (palHor(mod(k+1.,6.))*exp(-d*30.)*.6 + palHor(mod(k+1.,6.))*exp(-d*9.)*.12)*(1.-fr*.9);
      col = mix(col, palTop(mk)*.1 + palHor(mk)*.05, ground*.5);
      col += palHor(mod(k+1.,6.))*spill*.5;
      break;
    }
    q = (q - c)*uF + c;
    k += 1.;
  }
  fragColor = vec4(col, 0.);
}`;
