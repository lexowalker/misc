"""Generates the winter-cabin backdrop SVG and writes it as hooks/scene.ts."""
import random, sys, math

random.seed(7)
W, H = 1600, 1000
out = []
a = out.append

def f(x):
    return f"{x:.1f}".rstrip("0").rstrip(".")

# ---------- window geometry ----------
WX, WY, WW, WH = 130, 150, 430, 560   # inner glass rect (arch top)
AR = WW / 2                           # arch radius
win_path = (f"M{WX},{WY+WH} L{WX},{WY+AR} A{AR},{AR} 0 0 1 {WX+WW},{WY+AR} "
            f"L{WX+WW},{WY+WH} Z")

def pine(cx, base, h, w, col, snow):
    """A layered pine with snow caps."""
    s = []
    tiers = 5
    for i in range(tiers):
        t0 = i / tiers
        top = base - h * (0.25 + 0.75 * (i + 1) / tiers)
        bot = base - h * (0.75 * i / tiers) - h * 0.02
        hw = w * (1 - t0 * 0.75) / 2
        s.append(f'<path d="M{f(cx)},{f(top)} L{f(cx+hw)},{f(bot)} '
                 f'Q{f(cx)},{f(bot-h*0.05)} {f(cx-hw)},{f(bot)} Z" fill="{col}"/>')
        # snow cap on the tier
        sh = (bot - top) * 0.45
        s.append(f'<path d="M{f(cx)},{f(top)} L{f(cx+hw*0.55)},{f(top+sh)} '
                 f'Q{f(cx+hw*0.2)},{f(top+sh*0.8)} {f(cx)},{f(top+sh*1.05)} '
                 f'Q{f(cx-hw*0.25)},{f(top+sh*0.8)} {f(cx-hw*0.55)},{f(top+sh)} Z" fill="{snow}"/>')
    return "".join(s)

# ---------- outside view ----------
outside = []
o = outside.append
o(f'<rect x="{WX-10}" y="{WY-10}" width="{WW+20}" height="{WH+20}" fill="url(#sky)"/>')
# stars
for _ in range(70):
    x = random.uniform(WX, WX + WW); y = random.uniform(WY, WY + WH * 0.5)
    r = random.uniform(0.6, 1.6)
    d = random.uniform(0, 6)
    o(f'<circle class="tw" style="animation-delay:-{f(d)}s" cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="#e8f0ff"/>')
# moon
o(f'<circle cx="{WX+WW*0.72}" cy="{WY+120}" r="80" fill="url(#moonglow)"/>')
o(f'<circle cx="{WX+WW*0.72}" cy="{WY+120}" r="30" fill="#f4f1e4"/>')
o(f'<circle cx="{WX+WW*0.72+9}" cy="{WY+113}" r="6" fill="#ddd8c4" opacity=".6"/>')
o(f'<circle cx="{WX+WW*0.72-10}" cy="{WY+128}" r="4" fill="#ddd8c4" opacity=".5"/>')
# far mountains (snowy peaks)
peaks = [(WX-20, WY+380), (WX+40, WY+300), (WX+110, WY+250), (WX+170, WY+310),
         (WX+240, WY+230), (WX+320, WY+320), (WX+380, WY+270), (WX+WW+20, WY+340),
         (WX+WW+20, WY+WH)]
pts = " ".join(f"{x},{y}" for x, y in peaks) + f" {WX-20},{WY+WH}"
o(f'<polygon points="{pts}" fill="#2a3a55"/>')
# snow caps on peaks
for (px, py), lw, rw in [((WX+110, WY+250), 30, 28), ((WX+240, WY+230), 34, 36),
                         ((WX+380, WY+270), 26, 30), ((WX+40, WY+300), 22, 24)]:
    o(f'<path d="M{px},{py} L{px+rw},{py+40} L{px+rw*0.4},{py+30} L{px},{py+44} '
      f'L{px-lw*0.5},{py+32} L{px-lw},{py+40} Z" fill="#b9c8e0"/>')
o(f'<rect x="{WX-10}" y="{WY+300}" width="{WW+20}" height="140" fill="url(#mist)"/>')
# tree layers, far to near
layers = [
    (WY+400, 70, 110, "#1f2c42", "#7d90b0", 22),
    (WY+450, 110, 170, "#18233a", "#9fb2cf", 14),
    (WY+520, 170, 260, "#111a2b", "#c4d2e8", 8),
]
for base, hmin, hmax, col, snow, n in layers:
    xs = sorted(random.uniform(WX - 30, WX + WW + 30) for _ in range(n))
    for x in xs:
        h = random.uniform(hmin, hmax)
        o(pine(x, base + random.uniform(-8, 8), h, h * 0.45, col, snow))
    o(f'<rect x="{WX-10}" y="{base-4}" width="{WW+20}" height="{WY+WH-base+14}" fill="{snow}" opacity=".9"/>')
# ground drifts
o(f'<path d="M{WX-10},{WY+WH-30} Q{WX+120},{WY+WH-60} {WX+230},{WY+WH-35} '
  f'T{WX+WW+10},{WY+WH-40} L{WX+WW+10},{WY+WH+10} L{WX-10},{WY+WH+10} Z" fill="#dfe8f5"/>')
# a couple of near big pines at the edges
o(pine(WX + 10, WY + WH - 20, 330, 170, "#0c1320", "#d6e1f1"))
o(pine(WX + WW - 5, WY + WH - 10, 290, 150, "#0c1320", "#d6e1f1"))

# falling snow: three depths, each tile drawn twice vertically so it loops
snow = []
for cls, n, rmin, rmax, op in [("s1", 60, 0.8, 1.5, .55), ("s2", 40, 1.4, 2.4, .75), ("s3", 18, 2.4, 3.6, .9)]:
    g = [f'<g class="{cls}">']
    flakes = [(random.uniform(WX - 30, WX + WW + 30), random.uniform(0, WH + 40), random.uniform(rmin, rmax)) for _ in range(n)]
    for dy in (0, -(WH + 40)):
        for x, y, r in flakes:
            g.append(f'<circle cx="{f(x)}" cy="{f(WY + y + dy)}" r="{f(r)}"/>')
    g.append("</g>")
    snow.append(f'<g fill="#ffffff" opacity="{op}">' + "".join(g) + "</g>")

# ---------- interior ----------
a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">')
a("""<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="#070c1c"/><stop offset=".55" stop-color="#18264a"/><stop offset="1" stop-color="#3a4d74"/>
</linearGradient>
<radialGradient id="moonglow"><stop offset="0" stop-color="#e9efff" stop-opacity=".55"/><stop offset="1" stop-color="#e9efff" stop-opacity="0"/></radialGradient>
<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ea3c6" stop-opacity="0"/><stop offset=".6" stop-color="#8ea3c6" stop-opacity=".35"/><stop offset="1" stop-color="#8ea3c6" stop-opacity="0"/></linearGradient>
<linearGradient id="log" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="#3a2416"/><stop offset=".35" stop-color="#4a2f1c"/><stop offset=".8" stop-color="#2c1b10"/><stop offset="1" stop-color="#160d07"/>
</linearGradient>
<linearGradient id="plank" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22150c"/><stop offset="1" stop-color="#3a2516"/></linearGradient>
<linearGradient id="frame" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a190e"/><stop offset=".5" stop-color="#4d321e"/><stop offset="1" stop-color="#2a190e"/></linearGradient>
<radialGradient id="fireglow" cx="1340" cy="830" r="900" gradientUnits="userSpaceOnUse">
 <stop offset="0" stop-color="#ff9a3c" stop-opacity=".55"/><stop offset=".35" stop-color="#e2611c" stop-opacity=".22"/><stop offset="1" stop-color="#7a2a08" stop-opacity="0"/>
</radialGradient>
<radialGradient id="candleglow">
 <stop offset="0" stop-color="#ffc46b" stop-opacity=".45"/><stop offset="1" stop-color="#ffc46b" stop-opacity="0"/>
</radialGradient>
<linearGradient id="moonbeam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fb6e8" stop-opacity=".16"/><stop offset="1" stop-color="#9fb6e8" stop-opacity="0"/></linearGradient>
<radialGradient id="flame" cx=".5" cy=".85" r=".8"><stop offset="0" stop-color="#fff3b0"/><stop offset=".35" stop-color="#ffc247"/><stop offset=".7" stop-color="#f06a1a"/><stop offset="1" stop-color="#a8240a" stop-opacity="0"/></radialGradient>
<radialGradient id="coals" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#ff7a26"/><stop offset="1" stop-color="#5a1405"/></radialGradient>
<radialGradient id="vignette" cx="800" cy="500" r="950" gradientUnits="userSpaceOnUse"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
""")
a(f'<clipPath id="glass"><path d="{win_path}"/></clipPath>')
a("</defs>")
a("""<style>
.tw{animation:tw 5s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.25}50%{opacity:1}}
.s1{animation:fall 28s linear infinite}
.s2{animation:fall 18s linear infinite}
.s3{animation:fall 11s linear infinite}
@keyframes fall{from{transform:translate(0,0)}to{transform:translate(-30px,FALLPX)}}
.fl{transform-box:fill-box;transform-origin:50% 100%;animation:flick 1.3s ease-in-out infinite alternate}
.fl2{animation-duration:.9s;animation-delay:-.4s}
.fl3{animation-duration:1.7s;animation-delay:-.8s}
@keyframes flick{0%{transform:scale(1,1) skewX(0)}30%{transform:scale(.92,1.08) skewX(3deg)}60%{transform:scale(1.05,.94) skewX(-2deg)}100%{transform:scale(.97,1.1) skewX(2deg)}}
.glow{animation:glow 2.6s ease-in-out infinite alternate}
@keyframes glow{0%{opacity:.75}40%{opacity:1}70%{opacity:.82}100%{opacity:.95}}
.cf{transform-box:fill-box;transform-origin:50% 100%;animation:flick 2.2s ease-in-out infinite alternate}
.ember{animation:rise 4s ease-out infinite;opacity:0}
@keyframes rise{0%{transform:translate(0,0);opacity:0}10%{opacity:1}100%{transform:translate(-14px,-210px);opacity:0}}
.smoke{animation:drift 9s ease-in-out infinite alternate}
@keyframes drift{from{transform:translate(0,0)}to{transform:translate(6px,-4px)}}
@media (max-aspect-ratio:1/1){
 #win{transform:translate(455px,-40px)}
 #hearth{display:none}
 #shelf{display:none}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>""".replace("FALLPX", str(WH + 40)))

# log wall
a(f'<rect width="{W}" height="{H}" fill="#1a1009"/>')
y = 40
i = 0
while y < 900:
    hgt = random.uniform(56, 66)
    a(f'<rect x="0" y="{f(y)}" width="{W}" height="{f(hgt)}" rx="26" fill="url(#log)"/>')
    # knots and grain
    for _ in range(4):
        kx = random.uniform(0, W)
        a(f'<ellipse cx="{f(kx)}" cy="{f(y+hgt*random.uniform(.35,.6))}" rx="{f(random.uniform(6,12))}" ry="{f(random.uniform(3,5))}" fill="#21140b" opacity=".7"/>')
    for _ in range(3):
        gx = random.uniform(0, W - 300)
        gy = y + hgt * random.uniform(.25, .7)
        a(f'<path d="M{f(gx)},{f(gy)} q150,{f(random.uniform(-4,4))} 300,0" stroke="#5a3a22" stroke-width="1.2" fill="none" opacity=".35"/>')
    # chinking
    a(f'<rect x="0" y="{f(y+hgt-3)}" width="{W}" height="5" fill="#0e0905" opacity=".9"/>')
    y += hgt
    i += 1

# ceiling beam
a(f'<rect x="0" y="0" width="{W}" height="52" fill="#120a05"/>')
a(f'<rect x="0" y="40" width="{W}" height="16" fill="#2e1c10"/>')

# floor
a(f'<rect x="0" y="880" width="{W}" height="120" fill="url(#plank)"/>')
for k in range(0, W, 110):
    a(f'<path d="M{k},880 L{k-60+k*0.07},1000" stroke="#140c06" stroke-width="3"/>')
a(f'<rect x="0" y="876" width="{W}" height="10" fill="#120a05"/>')
# woven rug
a('<ellipse cx="820" cy="960" rx="420" ry="46" fill="#5c1f17" opacity=".85"/>'
  '<ellipse cx="820" cy="960" rx="380" ry="38" fill="none" stroke="#b07a3a" stroke-width="4" stroke-dasharray="14 8" opacity=".7"/>'
  '<ellipse cx="820" cy="960" rx="300" ry="27" fill="none" stroke="#2b3f2a" stroke-width="6" opacity=".8"/>')

# ---- window group ----
a('<g id="win">')
# moonbeam on the floor (behind frame, in front of wall)
a(f'<path d="M{WX},{WY+WH} L{WX+WW},{WY+WH} L{WX+WW+420},{1000} L{WX+140},{1000} Z" fill="url(#moonbeam)"/>')
# deep stone/wood surround
a(f'<path d="M{WX-46},{WY+WH+30} L{WX-46},{WY+AR} A{AR+46},{AR+46} 0 0 1 {WX+WW+46},{WY+AR} L{WX+WW+46},{WY+WH+30} Z" fill="url(#frame)"/>')
a(f'<path d="M{WX-20},{WY+WH+10} L{WX-20},{WY+AR} A{AR+20},{AR+20} 0 0 1 {WX+WW+20},{WY+AR} L{WX+WW+20},{WY+WH+10} Z" fill="#160d07"/>')
a('<g clip-path="url(#glass)">' + "".join(outside) + "".join(snow) +
  # frost on the glass corners
  f'<rect x="{WX}" y="{WY+WH-70}" width="{WW}" height="70" fill="#dce8ff" opacity=".12"/>' + '</g>')
# leaded mullions
cx = WX + WW / 2
mull = "#20140b"
a(f'<g stroke="{mull}" stroke-width="12" fill="none">')
a(f'<line x1="{cx}" y1="{WY}" x2="{cx}" y2="{WY+WH}"/>')
for yy in (WY + AR, WY + AR + (WH - AR) / 2):
    a(f'<line x1="{WX}" y1="{yy}" x2="{WX+WW}" y2="{yy}"/>')
a(f'<path d="{win_path}" stroke-width="14"/>')
a("</g>")
# thin lead diamond tracery in the arch
a(f'<g clip-path="url(#glass)" stroke="#20140b" stroke-width="3" opacity=".8">')
for k in range(-6, 8):
    x0 = WX + k * 60
    a(f'<line x1="{x0}" y1="{WY}" x2="{x0+AR}" y2="{WY+AR}"/><line x1="{x0+AR}" y1="{WY}" x2="{x0}" y2="{WY+AR}"/>')
a("</g>")
# sill
a(f'<rect x="{WX-70}" y="{WY+WH+10}" width="{WW+140}" height="26" rx="4" fill="#4a2e1a"/>')
a(f'<rect x="{WX-60}" y="{WY+WH+36}" width="{WW+120}" height="12" fill="#25160c"/>')
# candle on the sill
cxn, cy = WX + WW - 40, WY + WH + 10
a(f'<g class="glow"><circle cx="{cxn}" cy="{cy-40}" r="200" fill="url(#candleglow)" opacity=".8"/></g>')
a(f'<ellipse cx="{cxn}" cy="{cy}" rx="26" ry="6" fill="#6b4a2c"/>')
a(f'<rect x="{cxn-11}" y="{cy-58}" width="22" height="58" rx="3" fill="#efe2c4"/>')
a(f'<path d="M{cxn-11},{cy-50} q4,10 0,22" stroke="#d9c79f" stroke-width="3" fill="none"/>')
a(f'<line x1="{cxn}" y1="{cy-58}" x2="{cxn}" y2="{cy-65}" stroke="#2a1a0d" stroke-width="2"/>')
a(f'<path class="cf" d="M{cxn},{cy-92} C{cxn+9},{cy-78} {cxn+7},{cy-66} {cxn},{cy-64} C{cxn-7},{cy-66} {cxn-9},{cy-78} {cxn},{cy-92} Z" fill="url(#flame)"/>')
# snow drift on the outside sill edge (seen through glass bottom) + an old book
a(f'<rect x="{WX+30}" y="{cy-16}" width="90" height="16" rx="2" fill="#5b2a1e"/>'
  f'<rect x="{WX+36}" y="{cy-30}" width="80" height="14" rx="2" fill="#2f3f2b"/>'
  f'<rect x="{WX+33}" y="{cy-14}" width="84" height="3" fill="#c9b27a" opacity=".6"/>')
a("</g>")

# ---- shelf with antlers / lantern, between ----
a('<g id="shelf">')
# hanging iron lantern from beam
lx = 860
a(f'<line x1="{lx}" y1="56" x2="{lx}" y2="140" stroke="#0d0805" stroke-width="3"/>')
a(f'<path d="M{lx-22},140 L{lx+22},140 L{lx+28},150 L{lx-28},150 Z" fill="#1a110a"/>'
  f'<g class="glow"><rect x="{lx-22}" y="150" width="44" height="62" fill="#ffbe63" opacity=".55"/></g>'
  f'<path d="M{lx-24},150 v62 M{lx},150 v62 M{lx+24},150 v62" stroke="#1a110a" stroke-width="4"/>'
  f'<path d="M{lx-28},212 L{lx+28},212 L{lx+18},224 L{lx-18},224 Z" fill="#1a110a"/>')
a("</g>")

# ---- hearth group ----
HX = 1180
a('<g id="hearth">')
# chimney breast stones
a(f'<rect x="{HX}" y="52" width="360" height="830" fill="#1b1714"/>')
rs = random.Random(3)
for row in range(0, 830, 46):
    off = rs.uniform(0, 40)
    x = HX - off
    while x < HX + 360:
        w = rs.uniform(54, 96)
        g = rs.randint(40, 60)
        col = f"#{g:02x}{g-6:02x}{g-12:02x}"
        a(f'<rect x="{f(max(x,HX)+2)}" y="{52+row+2}" width="{f(min(w-4, HX+360-max(x,HX)-4))}" height="42" rx="9" fill="{col}"/>')
        x += w
# mantel
a(f'<rect x="{HX-30}" y="520" width="420" height="34" rx="4" fill="#4f321d"/>'
  f'<rect x="{HX-20}" y="554" width="400" height="10" fill="#24160c"/>')
# items on mantel: hourglass, small horn, jar
a(f'<path d="M{HX+40},520 l26,0 l-10,-22 l10,-22 l-26,0 l10,22 Z" fill="#c9a35a" opacity=".85"/>'
  f'<path d="M{HX+250},518 q40,-8 70,-46 q-10,30 -60,52 Z" fill="#d8c8a6"/>'
  f'<rect x="{HX+160}" y="486" width="34" height="34" rx="6" fill="#3d5a4a"/>')
# firebox arch
fx0, fx1, fy0, fy1 = HX + 60, HX + 300, 640, 880
a(f'<path d="M{fx0-26},{fy1} L{fx0-26},{fy0+60} Q{(fx0+fx1)/2},{fy0-60} {fx1+26},{fy0+60} L{fx1+26},{fy1} Z" fill="#3f3833"/>')
a(f'<path d="M{fx0},{fy1} L{fx0},{fy0+70} Q{(fx0+fx1)/2},{fy0-30} {fx1},{fy0+70} L{fx1},{fy1} Z" fill="#0b0604"/>')
# inner glow on back of firebox
a(f'<g class="glow"><ellipse cx="{(fx0+fx1)/2}" cy="{fy1-50}" rx="110" ry="100" fill="#c2481a" opacity=".28"/></g>')
# logs
fcx = (fx0 + fx1) / 2
a(f'<rect x="{fcx-100}" y="{fy1-36}" width="200" height="26" rx="13" fill="#3b2213" transform="rotate(-8 {fcx} {fy1-23})"/>'
  f'<rect x="{fcx-100}" y="{fy1-36}" width="200" height="26" rx="13" fill="#2f1b0f" transform="rotate(9 {fcx} {fy1-23})"/>'
  f'<g class="glow"><ellipse cx="{fcx}" cy="{fy1-12}" rx="110" ry="14" fill="url(#coals)"/></g>')
# flames
flames = [(-55, 95, "fl"), (0, 150, "fl fl2"), (50, 110, "fl fl3"), (-20, 120, "fl fl3"), (28, 80, "fl fl2")]
for dx, hh, cls in flames:
    bx, by = fcx + dx, fy1 - 22
    w = hh * 0.36
    a(f'<path class="{cls}" d="M{f(bx)},{f(by-hh)} C{f(bx+w*0.9)},{f(by-hh*0.55)} {f(bx+w)},{f(by-hh*0.1)} {f(bx)},{f(by)} '
      f'C{f(bx-w)},{f(by-hh*0.1)} {f(bx-w*0.8)},{f(by-hh*0.5)} {f(bx)},{f(by-hh)} Z" fill="url(#flame)" opacity=".95"/>')
# embers rising
for k in range(9):
    ex = fcx + rs.uniform(-60, 60)
    a(f'<circle class="ember" style="animation-delay:-{f(rs.uniform(0,4))}s;animation-duration:{f(rs.uniform(3,5.5))}s" cx="{f(ex)}" cy="{fy1-60}" r="{f(rs.uniform(1.2,2.4))}" fill="#ffb347"/>')
# hearthstone
a(f'<rect x="{HX-40}" y="{fy1-4}" width="440" height="24" rx="4" fill="#4a423b"/>')
# iron poker & firewood pile
a(f'<line x1="{HX+345}" y1="{fy1-4}" x2="{HX+372}" y2="{fy0-20}" stroke="#141010" stroke-width="5"/>'
  f'<circle cx="{HX+372}" cy="{fy0-24}" r="8" fill="none" stroke="#141010" stroke-width="4"/>')
for k, (lx2, ly2) in enumerate([(HX-110, 952), (HX-60, 952), (HX-10, 952), (HX-85, 912), (HX-35, 912), (HX-60, 872)]):
    a(f'<circle cx="{lx2}" cy="{ly2-40}" r="24" fill="#4a2d18"/><circle cx="{lx2}" cy="{ly2-40}" r="16" fill="#8a5a33"/>'
      f'<circle cx="{lx2}" cy="{ly2-40}" r="7" fill="none" stroke="#5e3b20" stroke-width="2"/>')
a("</g>")

# room-wide fire light and vignette
a(f'<g class="glow"><rect width="{W}" height="{H}" fill="url(#fireglow)" opacity=".85" style="mix-blend-mode:screen"/></g>')
a(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')
a("</svg>")

svg = "".join(out)
sys.stderr.write(f"svg chars: {len(svg)}\n")
open(sys.argv[1], "w").write(svg)
with open(sys.argv[2], "w") as fh:
    fh.write("// Generated by gen_scene.py: a log cabin at night, a moonlit snowy forest\n"
             "// through an arched window and a fire crackling in the hearth.\n")
    fh.write("export const SCENE = " + repr(svg).replace("\\'", "'") + "\n" if False else
             "export const SCENE = " + __import__("json").dumps(svg) + "\n")
