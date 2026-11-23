"""Render the picture: one image and one centred word per cue, cut on the grid. Pipes frames to ffmpeg.
usage: render.py out.mp4 [t0 t1]   |   render.py --still T out.jpg"""
import json, sys, os, subprocess, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H,FPS=1920,1080,24
TL=json.load(open("timeline.json")); CUES=TL["cues"]; END=TL["end"]
HITS=[56.0,76.0,112.0,156.0]; BLACK=[(48.0,48.75)]
SW,SH=2304,1296
_cache={}
def src(cid):
    if cid not in _cache:
        if len(_cache)>6: _cache.pop(next(iter(_cache)))
        p=f"frames/{cid}.png"
        if os.path.exists(p):
            im=Image.open(p).convert("RGB"); w,h=im.size; s=max(SW/w,SH/h)
            im=im.resize((round(w*s),round(h*s)),Image.LANCZOS); x=(im.width-SW)//2; y=(im.height-SH)//2
            _cache[cid]=np.asarray(im.crop((x,y,x+SW,y+SH)),np.float32)
        else: _cache[cid]=np.zeros((SH,SW,3),np.float32)
    return _cache[cid]
def view(cid, i, u, dur):
    """Camera: long cues drift slowly inward or outward; short cues punch in and settle."""
    if dur>=1.0:
        z=min(0.10,0.028*dur+0.02); s=(1.0+z*u) if i%3 else (1.0+z*(1-u))
        dx=(0.5-u)*24*((i%2)*2-1); dy=(0.5-u)*10*((i%4>1)*2-1)
    else:
        e=1-(1-u)**3; s=1.13-0.07*e if i%2 else 1.02+0.07*e; dx=dy=0
    k=s*W/SW*1.2/1.2*(SW/W)/ (SW/W)   # scale relative to fit
    f=s*(W/SW)*1.0
    f=max(f, W/SW)
    M=np.float32([[f,0,W/2-f*SW/2+dx],[0,f,H/2-f*SH/2+dy]])
    # keep frame covered
    cover=max(1.0,(W+2*abs(dx)+2)/(f*SW),(H+2*abs(dy)+2)/(f*SH))
    if cover>1.0: f*=cover; M=np.float32([[f,0,W/2-f*SW/2+dx],[0,f,H/2-f*SH/2+dy]])
    return cv2.warpAffine(src(cid),M,(W,H),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
FONT="fonts/Fraunces.ttf"
def font(size):
    f=ImageFont.truetype(FONT,size)
    ax=[a["name"] if isinstance(a["name"],str) else a["name"].decode() for a in f.get_variation_axes()]
    vals=[]
    for a,info in zip(ax,f.get_variation_axes()):
        n=a.lower()
        vals.append(144 if "optical" in n else 640 if "weight" in n else 100 if "soft" in n else info["default"])
    f.set_variation_by_axes(vals); return f
_txt={}
def text_layer(c, frame_for_lum):
    cid=c["id"]
    if cid in _txt: return _txt[cid]
    if len(_txt)>4: _txt.pop(next(iter(_txt)))
    s=c["text"].rstrip("."); size=310
    while True:
        f=font(size); l,t,r,b=f.getbbox(s)
        if r-l<=W*0.84 or size<70: break
        size=int(size*0.94)
    m=Image.new("L",(W,H),0); d=ImageDraw.Draw(m)
    asc,desc=f.getmetrics(); x=(W-(r-l))/2-l; y=H/2-(asc*0.62)
    d.text((x,y),s,font=f,fill=255)
    box=(int((W-(r-l))/2),int(y+asc*0.25),int((W+(r-l))/2),int(y+asc*1.02))
    reg=frame_for_lum[box[1]:box[3],box[0]:box[2]]
    lum=(reg@np.float32([0.2126,0.7152,0.0722])).mean()/255
    dark=lum>0.66
    a=np.asarray(m,np.float32)/255
    halo=np.asarray(m.filter(ImageFilter.GaussianBlur(34)),np.float32)/255
    halo=np.clip(halo*1.6,0,1)*(0.50 if not dark else 0.45)
    edge=np.asarray(m.filter(ImageFilter.GaussianBlur(5)),np.float32)/255*0.35
    halo=np.maximum(halo,edge)
    col=np.float32([14,16,20]) if dark else np.float32([255,253,248]); hcol=np.float32([255,255,255]) if dark else np.float32([0,0,0])
    _txt[cid]=(a[...,None],halo[...,None],col,hcol); return _txt[cid]
rng=np.random.default_rng(3)
GRAIN=[cv2.resize(rng.normal(0,1,(H//2,W//2)).astype(np.float32),(W,H),interpolation=cv2.INTER_LINEAR)[...,None]*2.6 for _ in range(6)]
yy,xx=np.mgrid[0:H,0:W].astype(np.float32); VIG=(1-0.30*np.clip((((xx-W/2)/(W/2))**2+((yy-H/2)/(H/2))**2)-0.35,0,None)**1.2)[...,None]
def cue_at(t):
    lo,hi=0,len(CUES)-1
    if t<CUES[0]["t"]: return -1
    while lo<hi:
        mid=(lo+hi+1)//2
        if CUES[mid]["t"]<=t: lo=mid
        else: hi=mid-1
    return lo
def frame(n):
    t=n/FPS+1e-6; i=cue_at(t)
    if i<0 or any(a<=t<b for a,b in BLACK): img=np.zeros((H,W,3),np.float32)
    else:
        c=CUES[i]; u=(t-c["t"])/c["dur"]; img=view(c["id"],i,u,c["dur"])
        xf=0
        if i>0 and c["dur"]>=1.0 and CUES[i-1]["dur"]>=1.0 and c["t"] not in HITS:
            xf=0.5 if c["t"]<17 or c["t"]>157 else 0.33
            xf=min(xf,c["dur"]*0.4)
            if t-c["t"]<xf:
                p=CUES[i-1]; k=(t-c["t"])/xf; k=k*k*(3-2*k)
                prev=view(p["id"],i-1,1.0+ (t-c["t"])/p["dur"],p["dur"]) if not any(a<=p["t"]+p["dur"]-0.01<b for a,b in BLACK) else 0
                img=prev*(1-k)+img*k
        a,halo,col,hcol=text_layer(c,img if c['id'] in _txt else view(c['id'],i,0.5,c['dur']))
        o=1.0
        if c["dur"]>=1.0: o=min(1.0,(t-c["t"])/max(xf,0.12))
        if c["dur"]>=1.5 and i+1<len(CUES) and CUES[i+1]["dur"]>=1.0: o=min(o,max(0.0,(c["t"]+c["dur"]-t)/0.2))
        if i==len(CUES)-1: o=min(o,max(0,(c["t"]+1.2-t)/0.4)+0) if False else o
        img=img*(1-halo*o)+hcol*(halo*o); img=img*(1-a*o)+col*(a*o)
    for h in HITS:
        if 0<=t-h<0.25: img=img+(255-img)*(0.75*(1-(t-h)/0.25)**2)
    img=img*VIG+GRAIN[n%6]
    if t<CUES[0]["t"]+0.8 and i>=0: img*=min(1,(t-CUES[0]["t"])/0.8)
    if t>178.8: img*=max(0,(END-0.15-t)/1.05)
    return np.clip(img,0,255).astype(np.uint8)
if __name__=="__main__":
    if sys.argv[1]=="--still":
        Image.fromarray(frame(int(float(sys.argv[2])*FPS))).save(sys.argv[3],quality=88); sys.exit()
    out=sys.argv[1]; t0=float(sys.argv[2]) if len(sys.argv)>2 else 0; t1=float(sys.argv[3]) if len(sys.argv)>3 else END
    crf=sys.argv[4] if len(sys.argv)>4 else "21"
    p=subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-c:v","libx264","-preset","medium","-crf",crf,"-pix_fmt","yuv420p",out],stdin=subprocess.PIPE)
    for n in range(int(t0*FPS),int(t1*FPS)): p.stdin.write(frame(n).tobytes())
    p.stdin.close(); p.wait()
