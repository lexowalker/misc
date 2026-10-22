// Layered landscapes: sky, sun, clouds, stars, Milky Way, aurora veil, ridgelines with valley mist, silhouette layers.
SHADERS.land = `
uniform vec3 uZen, uHor, uSunCol; uniform float uHorY, uGradP;
uniform vec2 uSunP; uniform float uSunR, uSunGlow, uSunDisk;
uniform float uStar, uMW, uMWAng, uStarAng, uStarTrail; uniform vec2 uMWOff, uPole;
uniform float uCloud, uCloudY, uCloudH, uCloudS; uniform vec3 uCloudCol;
uniform float uAur, uAurY; uniform vec3 uAurC1, uAurC2;
uniform vec4 uRid[6]; uniform vec4 uRidC[6]; uniform float uRidX[6]; uniform float uNR;
uniform vec3 uMist; uniform float uMistH;
uniform float uA1, uA3; uniform vec3 uC0, uC1, uC3; uniform float uEmitK, uRimK, uRim1K;
uniform float uMoon; uniform vec2 uMoonP; uniform vec4 uBG; uniform vec3 uBGC; uniform float uDis; uniform vec2 uDisB; uniform float uCrum; uniform sampler2D uSkyTex; uniform float uSkyK;

vec3 starTrails(vec2 px){
  // stars rotating about uPole by uStarAng, smeared backwards over uStarTrail radians
  vec2 d = px - uPole;
  float r = length(d), a = atan(d.y, d.x) - uStarAng;
  vec3 acc = vec3(0.);
  float ring = 9.;
  float ri = floor(r/ring);
  float rc = (ri+.5)*ring;
  float cells = max(6., floor(TAU*rc/9.));
  float da = TAU/cells;
  int span = int(min(48., ceil(uStarTrail/da)));
  float ai = floor((a+PI)/da);
  for(int k=0;k<=48;k++){ if(k>span) break;
    float j = mod(ai - float(k), cells);
    vec2 id = vec2(ri, j);
    float h = hash12(id*1.37+4.);
    if(h > .07) continue;
    float m = hash12(id+11.);
    float rs = (ri + .2 + .6*hash12(id+2.))*ring;
    float as = (j + hash12(id+7.))*da - PI;
    // angular distance from star start forward along the trail
    float dA = mod(a - as + PI*3., TAU) - PI;
    float along = clamp(dA, 0., uStarTrail);
    float dist = length(vec2(r - rs, (dA - along)*r));
    float mag = pow(m,8.)*4.5 + m*m*.25;
    float w = .55+.6*pow(m,5.);
    float fadeT = uStarTrail > .0005 ? mix(.35, 1., along/max(uStarTrail,1e-4)) : 1.;
    vec3 sc = mix(vec3(.62,.75,1.), vec3(1.,.8,.58), pow(hash12(id+5.),1.5));
    acc += mix(sc, vec3(1.), .35)*mag*exp(-dist*dist/(2.*w*w))*fadeT;
  }
  return acc;
}

vec3 skyCol(vec2 px){
  float y = (px.y - uHorY)/uR.y;
  vec3 c = mix(uHor, uZen, pow(clamp(y*uGradP, 0., 1.), .55));
  if(y < 0.) c = uHor;
  vec2 sd = (px - uSunP)/uR.y;
  float ds = length(sd);
  c += uSunCol*uSunGlow*(.035/(ds*ds*8.+.02) + .5*exp(-ds*3.5) + .25*exp(-abs(sd.y)*10.)*exp(-abs(sd.x)*1.2));
  if(uStar > 0.){
    vec3 st = uStarTrail > .0005 ? starTrails(px) : stars(uPole + rot(-uStarAng)*(px-uPole), 10., .12, 3.);
    c += st*uStar*smoothstep(-.02, .1, y);
  }
  if(uMW > 0.){
    vec2 s = rot(uMWAng)*((px - .5*uR)/uR.y) + uMWOff;
    c += milkyWay(s*1.6, uMW)*smoothstep(-.02,.15,y);
    // dense small stars inside the band
    float band = exp(-pow((s.y*1.6 - .08*sin(s.x*1.6*.9+1.))/.2, 2.));
    c += stars(px*1.0+77., 4.5, .3*band, 19.)*uMW*.45;
  }
  if(uAur > 0.){
    for(int i=0;i<3;i++){
      float fi = float(i);
      float x = px.x/uR.y + fi*2.3;
      float base = uAurY + (fbm1(x*.9 + fi*4.1 + uTime*.03) - .5)*uR.y*.36 + sin(x*2.2 + uTime*.1 + fi)*uR.y*.04 + fi*uR.y*.06;
      float hgt = px.y - base;
      float edge = smoothstep(-3., 5., hgt);
      float green = exp(-max(hgt,0.)/(uR.y*(.075 + fi*.02)));
      float tail = exp(-max(hgt,0.)/(uR.y*.32))*.22;
      float rays = .25 + .75*pow(noise(vec2(x*34. + uTime*.22*(fi+1.), fi*7.)), 3.)*(.5 + .5*noise(vec2(x*7., fi + uTime*.05)));
      float patchy = smoothstep(.25, .7, fbm1(x*1.4 + fi*5. + uTime*.02));
      vec3 ac = uAurC1*green + uAurC2*tail;
      c += ac*edge*rays*patchy*uAur*(1. - fi*.2)*1.4;
    }
  }
  if(uCloud > 0.){
    vec2 q = vec2(px.x/uR.y*uCloudS*1.4 + uTime*.004, (px.y-uCloudY)/uR.y*uCloudS*5.);
    float n = fbm(q + vec2(0., fbm(q*.7)*.8));
    float band = exp(-pow((px.y-uCloudY)/max(uCloudH,1.), 2.));
    float dens = smoothstep(.45, .8, n)*band*uCloud;
    float lit = exp(-ds*2.2);
    vec3 cc = mix(uCloudCol, uSunCol*.6, lit*.85) + uSunCol*exp(-ds*9.)*1.5;
    c = mix(c, cc, dens);
  }
  if(uMoon > 0.){ float dm = length(px-uMoonP); c += vec3(.95,.96,1.)*smoothstep(uR.y*.012, uR.y*.0105, dm)*uMoon*3. + vec3(.5,.6,.8)*uMoon*.08*exp(-dm/uR.y*6.); }
  c += uSunCol*uSunDisk*smoothstep(uSunR, uSunR*.92, ds*uR.y)*25.;
  return c;
}

void main(){
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px/uR;
  vec3 col = skyCol(px);
  if(uSkyK > 0.) col += texture(uSkyTex, uv).rgb*uSkyK;
  float skyA = clamp((luma(col)-.3)*.2, 0., 1.);
  float cover = 0.;
  for(int i=0;i<6;i++){
    if(float(i) >= uNR) break;
    vec4 rd = uRid[i];
    float x = (px.x + uRidX[i])*rd.z;
    float h = rd.x + rd.y*(ridge1(x + float(i)*17.3, rd.w) - .45);
    float dy = px.y - h;
    float crumbleEdge = 0.;
    if(uCrum > 0.){
      // the range sinks, nearest layers first, its ridgeline breaking into glowing dust
      float k = clamp(uCrum*1.7 - (uNR - 1. - float(i))*.16, 0., 1.);
      float ks = k*k*(3. - 2.*k);
      float rough = (noise(vec2(px.x/14., float(i)*3. + uTime*2.)) - .5)*34.*sin(k*PI);
      h = h - ks*(h + 40.) + rough;
      dy = px.y - h;
      crumbleEdge = exp(-max(-dy, 0.)/5.)*step(dy, 0.)*sin(k*PI);
    }
    if(dy < 0.){
      vec3 rc = uRidC[i].rgb;
      // faint haze gradient inside the layer and a rim where the sun is behind
      rc = mix(rc, uMist, uRidC[i].a*.35*exp(dy/(uR.y*.06)));
      float sunNear = exp(-abs(px.x-uSunP.x)/(uR.y*.35))*smoothstep(-uR.y*.1, uR.y*.05, uSunP.y-h);
      rc += uSunCol*uSunGlow*sunNear*exp(dy/2.2)*.9;
      col = rc + vec3(1.,.7,.4)*crumbleEdge*2.2; cover = 1.;
    } else {
      col = mix(col, uMist, uRidC[i].a*exp(-dy/max(uMistH,1.)));
    }
    if(float(i) == uA3 - 1.){ float a3 = texture(uL3, uv).a; col = mix(col, uC3, a3); cover = max(cover, a3); }
    if(float(i) == uA1 - 1.){
      float a1 = texture(uL1, uv).a; col = mix(col, uC1, a1); cover = max(cover, a1);
      if(uRim1K > 0. && a1 > 0.){ vec2 sd = normalize(uSunP - px + 1e-3); float e=0.; for(int k=1;k<=3;k++) e += a1 - texture(uL1, uv + sd*float(k)*1.5/uR).a; col += uSunCol*clamp(e*.5,0.,1.)*uRim1K; }
    }
  }
  if(uA3 > 5.5){ float a3 = texture(uL3, uv).a; col = mix(col, uC3, a3); cover = max(cover, a3); }
  if(uA1 > 5.5){ float a1 = texture(uL1, uv).a; col = mix(col, uC1, a1); cover = max(cover, a1); }
  if(uBG.w > 0.){ vec2 bd = (px - uBG.xy)/uBG.z; float r2 = dot(bd,bd); col += uBGC*uBG.w*(exp(-r2) + .25/(1.+r2*.3)); }
  float a0 = texture(uL0, uv).a;
  float disEdge = 0.;
  if(uDis > 0. && a0 > 0. && px.y > uDisB.x - 40.){
    float hv = clamp((px.y - uDisB.x)/uDisB.y, 0., 1.);
    float v = .45*noise(px/14.) + .2*noise(px/4.) + .55*(1. - hv);
    float th = uDis*1.3;
    disEdge = smoothstep(th + .07, th, v)*step(th, v)*a0;
    a0 *= smoothstep(th, th + .015, v);
  }
  if(a0 > 0.){
    vec2 sd = normalize(uSunP - px + 1e-3);
    float e = 0.;
    for(int k=1;k<=3;k++) e += a0 - texture(uL0, uv + sd*float(k)*1.6/uR).a;
    col = mix(col, uC0, a0) + uSunCol*clamp(e*.5, 0., 1.)*uRimK*smoothstep(.1, 1.8, luma(col));
  }
  cover = max(cover, a0);
  col += vec3(1.,.72,.42)*disEdge*3.;
  col += texture(uL2, uv).rgb*uEmitK;
  fragColor = vec4(col, skyA*(1.-cover));
}`;
