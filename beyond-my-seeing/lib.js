// Shared GLSL: header, noise, stars, sky, sea, ridges.
const GLSL_HEADER = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uR;
uniform float uTime;
uniform vec4 uAud;
uniform float uT, uP;
uniform sampler2D uL0, uL1, uL2, uL3;
`;

const GLSL_LIB = `
#define PI 3.14159265359
#define TAU 6.28318530718
float sat(float x){ return clamp(x,0.,1.); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float hash11(float p){ p=fract(p*.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 hash32(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }
float hash13(vec3 p3){ p3=fract(p3*.1031); p3+=dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float noise1(float x){ float i=floor(x), f=fract(x); float u=f*f*f*(f*(f*6.-15.)+10.); return mix(hash11(i),hash11(i+1.),u); }
float noise3(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),u.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),u.x),u.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),u.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),u.x),u.y), u.z); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*noise(p); p=rot(.6)*p*2.03+17.1; a*=.5; } return s/.97; }
float fbm3o(vec2 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*noise(p); p=rot(.6)*p*2.03+17.1; a*=.5; } return s/.875; }
float fbm7(vec2 p){ float s=0., a=.5; for(int i=0;i<7;i++){ s+=a*noise(p); p=rot(.6)*p*2.03+17.1; a*=.5; } return s; }
float fbm3(vec3 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*noise3(p); p=p*2.02+vec3(17.1,3.3,9.7); a*=.5; } return s/.94; }
float fbm1(float x){ float s=0., a=.5; for(int i=0;i<6;i++){ s+=a*noise1(x); x=x*2.07+13.3; a*=.5; } return s; }
float ridge1(float x, float rough){ float s=0., a=.5;
  for(int i=0;i<7;i++){ float n=noise1(x); float r=1.-abs(n*2.-1.); s+=a*mix(n, r*r, rough); x=x*2.11+31.7; a*=.47; } return s; }
vec3 aces(vec3 x){ const float a=2.51,b=.03,c=2.43,d=.59,e=.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
vec3 lin(vec3 s){ return pow(s, vec3(2.2)); }
float luma(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.); }
float smin(float a, float b, float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
// pointed (gothic/persian) arch: p in units where the opening is 2 wide, springline at y=0, height of straight part hs
float sdArch(vec2 p, float hs, float pointy){
  // straight jambs below springline
  float dJ = sdBox(p-vec2(0.,-hs*.5), vec2(1., hs*.5));
  // two circles of radius r centred at +-(r-1) produce a pointed arch
  float r = 1.+pointy;
  vec2 q = vec2(abs(p.x), p.y);
  float dC = length(q-vec2(1.-r, 0.)) - r;
  float dTop = max(dC, -p.y);
  dTop = max(dTop, -q.x - 0.);
  float a = min(dJ, max(dC, -p.y));
  return a;
}
vec2 polar(vec2 p){ return vec2(length(p), atan(p.y,p.x)); }

// ---- stars: q in cell units, cellPx = pixels per cell
vec3 starCell(vec2 q, float cellPx, float dens, float seed, float bright){
  vec2 id = floor(q), f = fract(q);
  float h = hash12(id*1.31 + seed);
  if(h > dens) return vec3(0.);
  vec2 o = .22 + .56*hash22(id + seed*7.7);
  float d = length(f-o)*cellPx;
  float m = hash12(id + seed*3.1 + 11.);
  float mag = pow(m, 9.)*7. + m*m*.16;
  float sz = .62 + .8*pow(m,5.);
  float tw = 1. + .45*sin(uTime*(1.7+4.*hash12(id+3.)) + h*60.)*smoothstep(.3,.9,m);
  vec3 col = mix(vec3(.62,.75,1.), vec3(1.,.8,.58), pow(hash12(id+5.),1.5));
  col = mix(col, vec3(1.), .35);
  return col*mag*tw*exp(-d*d/(2.*sz*sz))*bright;
}
vec3 stars(vec2 px, float scale, float dens, float seed){
  // px: pixel-space coordinate (stable domain), scale: cell size in px
  vec3 c = starCell(px/scale, scale, dens, seed, 1.);
  c += starCell(px/(scale*.6)+31.7, scale*.6, dens*.7, seed+17., .35);
  return c;
}
// Milky Way band in a 2D sky domain (u along band, v across)
vec3 milkyWay(vec2 s, float amt){
  float w = .17 + .05*sin(s.x*1.3);
  float v = s.y - .08*sin(s.x*.9+1.);
  float band = exp(-v*v/(w*w));
  float n = fbm(s*vec2(3.,7.)+3.1);
  float n2 = fbm(s*vec2(9.,18.)-7.3);
  float dust = smoothstep(.45,.75, fbm(s*vec2(5.,12.)+vec2(9.,1.)))*exp(-v*v/(w*w*.25));
  float core = exp(-pow((s.x-.3)/1.1,2.))*.8+.35;
  vec3 col = mix(vec3(.35,.42,.75), vec3(1.,.82,.62), band*core*.9);
  float glow = band*(.35+.9*n*n)*(.55+.6*n2)*core;
  glow *= 1.-dust*.85;
  return col*glow*amt;
}

// ---- sky
vec3 skyGrad(vec3 d, vec3 sun, vec3 zen, vec3 hor, vec3 sunCol, float mie){
  float e = max(d.y, 0.);
  vec3 c = mix(hor, zen, 1.-exp(-e*7.));
  float mu = dot(d, sun);
  float g = .8; float hg = (1.-g*g)/pow(max(1.+g*g-2.*g*mu, 1e-4), 1.5);
  c += sunCol*hg*mie*.0055;
  float g2 = .3; float hg2 = (1.-g2*g2)/pow(1.+g2*g2-2.*g2*mu, 1.5);
  c += sunCol*hg2*mie*.012*exp(-e*9.)*max(mu*.5+.5,0.);
  return c;
}
float sunDisk(vec3 d, vec3 sun, float size){
  float a = acos(clamp(dot(d,sun),-1.,1.));
  return smoothstep(size, size*.86, a)*(1.-.35*pow(a/size,2.));
}

// ---- sea: height-field waves with filtered normals; glitter for several watchers
float waveH(vec2 p, float t){
  float h = 0.;
  h += .14*sin(dot(p, vec2(.13,.99))*1.1 + t*1.05);
  h += .09*sin(dot(p, vec2(-.38,.92))*1.9 + t*1.4);
  h += .05*sin(dot(p, vec2(.62,.78))*3.3 + t*1.9);
  h += .03*sin(dot(p, vec2(-.8,.6))*5.7 + t*2.6);
  return h;
}
vec3 seaNormal(vec2 p, float t, float detail){
  vec2 e = vec2(.02, 0.);
  float h0 = waveH(p,t);
  vec3 n = normalize(vec3(-(waveH(p+e.xy,t)-h0)/e.x, 1., -(waveH(p+e.yx,t)-h0)/e.x));
  // chop: animated noise slopes, faded by detail (footprint)
  vec2 q = vec2(p.x*1.1, p.y*2.6) + vec2(t*.25, t*.45);
  float nx = noise(q*2.) - noise(q*2.+vec2(.15,0.));
  float nz = noise(q*2.+vec2(5.)) - noise(q*2.+vec2(5.,5.15));
  vec2 q2 = vec2(p.x*3.3, p.y*7.) + vec2(-t*.4, t*.9);
  float nx2 = noise(q2+9.) - noise(q2+vec2(9.08,9.));
  float nz2 = noise(q2+3.) - noise(q2+vec2(3.,3.08));
  n.xz += (vec2(nx,nz)*1.3 + vec2(nx2,nz2)*1.6)*detail;
  return normalize(n);
}
`;
