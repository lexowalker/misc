// The sea at dawn: the path of light that always runs to whoever is looking.
SHADERS.sea = `
uniform vec3 uCam; uniform float uYaw, uPitch, uFov;
uniform vec3 uSun; uniform vec3 uSunCol; uniform float uSunSize;
uniform vec3 uZen, uHor, uWater, uHaze; uniform float uMie, uFog;
uniform float uStar, uWaveT, uRough, uGlit;
uniform float uCloud; uniform vec3 uCloudCol; uniform float uCloudY;
uniform vec4 uWatch[4]; uniform float uNW, uWatchK;
uniform vec3 uSil, uSil1; uniform float uEmitK, uRimK, uDream, uMoon;
uniform vec3 uMoonDir; uniform float uWaveA;
uniform float uAur; uniform vec3 uAurC1, uAurC2; uniform vec4 uPlanet; uniform vec3 uPlanetCol;

vec3 camRay(vec2 frag, out vec3 ro){
  vec2 uv = (frag - .5*uR)/uR.y;
  float t = tan(uFov*.5);
  vec3 f = vec3(sin(uYaw)*cos(uPitch), sin(uPitch), cos(uYaw)*cos(uPitch));
  vec3 r = normalize(cross(vec3(0,1,0), f));
  vec3 u = cross(f, r);
  ro = uCam;
  return normalize(f + (uv.x*r + uv.y*u)*2.*t);
}
vec3 sky(vec3 d, bool withSun){
  vec3 c = skyGrad(d, uSun, uZen, uHor, uSunCol, uMie);
  // horizon band warmth toward the sun
  float az = max(dot(normalize(d.xz), normalize(uSun.xz)), 0.);
  c += uSunCol*.05*pow(az, 6.)*exp(-max(d.y,0.)*14.)*uMie;
  if(uStar > 0.){
    vec2 q = vec2(atan(d.x, d.z), asin(clamp(d.y,-1.,1.)))*uR.y/uFov;
    c += stars(q, 11., .11, 3.)*uStar*smoothstep(0.,.08,d.y);
  }
  if(uCloud > 0. && d.y > 0.){
    vec2 cp = d.xz/(d.y+.03)*uCloudY;
    float n = fbm(cp*vec2(.55,1.6)+vec2(uTime*.01,0.));
    float band = smoothstep(.0,.05,d.y)*smoothstep(.22,.06,d.y);
    float dens = smoothstep(.5,.78,n)*band*uCloud;
    float fw = pow(max(dot(d,uSun),0.), 12.);
    vec3 cc = mix(uCloudCol, uSunCol*.25, fw*.8) + uSunCol*.6*pow(max(dot(d,uSun),0.),60.);
    c = mix(c, cc, dens);
  }
  if(uAur > 0. && d.y > 0.){
    float az = atan(d.x, d.z), el = asin(clamp(d.y,0.,1.));
    for(int i=0;i<3;i++){
      float fi = float(i);
      float base = .06 + .05*fi + (fbm1(az*1.6 + fi*3.1 + uTime*.03) - .5)*.22 + sin(az*3.1 + uTime*.1 + fi)*.025;
      float h = el - base;
      float edge = smoothstep(-.004, .008, h);
      float green = exp(-max(h,0.)/(.07 + fi*.02));
      float tail = exp(-max(h,0.)/.3)*.22;
      float rays = .25 + .75*pow(noise(vec2(az*55. + uTime*.22*(fi+1.), fi*7.)), 3.)*(.5 + .5*noise(vec2(az*11., fi + uTime*.05)));
      float patchy = smoothstep(.25, .7, fbm1(az*2.2 + fi*5. + uTime*.02));
      c += (uAurC1*green + uAurC2*tail)*edge*rays*patchy*uAur*(1. - fi*.2)*1.4;
    }
  }
  if(uPlanet.w > 0.){
    vec3 pd = normalize(uPlanet.xyz);
    float ang = acos(clamp(dot(d, pd), -1., 1.));
    if(ang < uPlanet.w){
      vec3 tang = normalize(cross(pd, vec3(0,1,0))); vec3 bit = cross(tang, pd);
      vec2 q = vec2(dot(d - pd, tang), dot(d - pd, bit))/uPlanet.w;
      float z = sqrt(max(1. - dot(q,q), 0.));
      vec3 nn = vec3(q, z);
      float lit = clamp(dot(nn, normalize(vec3(-.6,.3,.7))), 0., 1.);
      float bands = .7 + .3*sin(q.y*14. + fbm(q*3.)*4.);
      c = mix(c, uPlanetCol*bands*(lit*.9 + .03), smoothstep(uPlanet.w, uPlanet.w*.985, ang));
    }
    c += uPlanetCol*.12*exp(-max(ang - uPlanet.w, 0.)*40.)*step(uPlanet.w, ang);
  }
  if(withSun) c += uSunCol*sunDisk(d, uSun, uSunSize)*14.;
  if(uMoon > 0.) c += vec3(.9,.95,1.)*sunDisk(d, uMoonDir, .012)*uMoon*4.;
  return c;
}
float beck(float ndh, float m){ float c2 = max(ndh*ndh, 1e-3); float t2 = (1.-c2)/c2; return exp(-t2/(m*m))/(PI*m*m*c2*c2); }

void main(){
  vec3 ro; vec3 d = camRay(gl_FragCoord.xy, ro);
  vec3 col; float skyA = 0.;
  if(d.y > 0.){
    col = sky(d, true);
    float l = luma(col);
    skyA = clamp((l-.25)*.15, 0., 1.);
  } else {
    float t = -ro.y/d.y;
    vec3 P = ro + d*t;
    float px = t*2.*tan(uFov*.5)/uR.y;          // world size of a pixel
    float detail = clamp(1. - px*9., 0., 1.);
    float waveFade = clamp(1. - px*1.6, 0., 1.);
    vec3 n = seaNormal(P.xz*.9, uWaveT, detail*.9);
    n = normalize(mix(vec3(0,1,0), n, (.25+.75*waveFade)*uWaveA));
    vec3 v = -d;
    float ndv = max(dot(n,v), .02);
    float F = .02 + .98*pow(1.-ndv, 5.);
    vec3 rd = reflect(d, n); rd.y = abs(rd.y)+.002;
    vec3 refl = sky(rd, false);
    vec3 base = uWater*(.45+.55*smoothstep(-.2,.6,dot(n, normalize(vec3(uSun.x,0.,uSun.z)))));
    col = mix(base, refl, F);
    // sun glitter: stochastic micro-facets near (each a tiny mirror that catches the sun), a smooth lobe far
    vec3 h = normalize(uSun + v);
    float sunUp = smoothstep(-.02, .01, uSun.y);
    float omega = PI*uSunSize*uSunSize, Lsun = 14.;
    float smoothSpec = beck(max(dot(n,h),0.), uRough*2.2)*F/(4.*ndv)*omega*Lsun;
    vec2 fc = P.xz*vec2(9., 22.) + vec2(uWaveT*.6, uWaveT*1.7);
    vec2 cid = floor(fc);
    vec2 rnd = hash22(cid) - .5;
    float ang = uWaveT*(2. + 5.*hash12(cid+3.)) + hash12(cid)*TAU;
    rnd = rot(ang)*rnd;
    vec3 ng = normalize(n + vec3(rnd.x, 0., rnd.y)*.42);
    float facet = smoothstep(.5, .25, length(fract(fc) - .5));
    float ndh = max(dot(ng,h), 1e-3);
    float glint = exp(-(1.-ndh*ndh)/(ndh*ndh)/(.07*.07))*(F+.04)*Lsun*.6*facet;
    float spec = mix(smoothSpec, glint + smoothSpec*.5, detail);
    col += uSunCol*spec*uGlit*sunUp;
    float m = uRough*2.2;
    // the paths of the other watchers
    for(int i=0;i<4;i++){ if(float(i)>=uNW) break;
      vec3 vw = normalize(uWatch[i].xyz - P);
      vec3 hw = normalize(uSun + vw);
      float sw = beck(max(dot(n,hw),0.), m)*F/(4.*max(dot(n,vw),.05))*PI*uSunSize*uSunSize*14.;
      col += uSunCol*sw*uGlit*uWatch[i].w*uWatchK*sunUp;
    }
    // dream sea: the water itself is made of light
    if(uDream > 0.){
      vec2 q = P.xz*.35 + vec2(0., uTime*.15);
      float ca = pow(abs(sin(fbm(q*1.3)*9. + uTime*.4)), 6.);
      float cb = pow(abs(sin(fbm(q*2.7+5.)*11. - uTime*.3)), 8.);
      vec3 lc = mix(vec3(.15,.55,1.), vec3(1.,.6,.3), smoothstep(.35,.7,fbm(q*.5+2.)));
      col += lc*(ca*.7+cb*.45)*uDream*(.35+.65*detail)*.9 + lc*uDream*.08;
    }
    col = mix(col, uHaze, 1.-exp(-t*uFog));
  }
  // silhouettes: L1 mid (hazed), L0 near (with rim light from the sun side)
  vec2 uv = gl_FragCoord.xy/uR;
  float a1 = texture(uL1, uv).a;
  col = mix(col, uSil1, a1);
  vec4 s0 = texture(uL0, uv);
  if(s0.a > 0.){
    // sun position on screen for rim direction
    vec3 f = vec3(sin(uYaw)*cos(uPitch), sin(uPitch), cos(uYaw)*cos(uPitch));
    vec3 r = normalize(cross(vec3(0,1,0), f)); vec3 u = cross(f, r);
    vec2 sp = vec2(dot(uSun,r), dot(uSun,u))/max(dot(uSun,f),.05);
    vec2 sd = normalize(sp*vec2(1.,1.) - (uv-.5)*vec2(uR.x/uR.y,1.)*2.*tan(uFov*.5) + 1e-4);
    float edge = 0.;
    for(int k=1;k<=3;k++) edge += s0.a - texture(uL0, uv + sd*float(k)*1.6/uR).a;
    edge = clamp(edge/2., 0., 1.);
    col = mix(col, uSil, s0.a) + uSunCol*edge*uRimK*.6*smoothstep(.15, 2.5, luma(col));
  }
  col += texture(uL2, uv).rgb*uEmitK;
  fragColor = vec4(col, skyA*(1.-s0.a)*(1.-a1));
}`;

SHADERS.void = `
uniform vec3 uTint; uniform float uDust, uGrad;
void main(){
  vec2 uv = gl_FragCoord.xy/uR;
  vec3 col = uTint*uGrad*smoothstep(1.2, .0, length((uv-vec2(.5,.35))*vec2(1.6,1.)));
  // drifting motes
  vec2 p = gl_FragCoord.xy + vec2(uTime*6., -uTime*4.);
  col += stars(p, 40., .03, 9.)*uDust*vec3(1.,.85,.7);
  col += texture(uL2, uv).rgb;
  fragColor = vec4(col, 0.);
}`;
