"""Split each voice take into one clip per cue by finding the pauses between words."""
import subprocess, sys, json, os, numpy as np, soundfile as sf
from words import SECTIONS, cues
SR = 44100
def load(p):
    raw = subprocess.run(["ffmpeg","-v","error","-i",p,"-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True).stdout
    return np.frombuffer(raw, np.float32)
def segments(x, n_expected):
    hop = 441
    env = np.sqrt(np.convolve(x**2, np.ones(1323)/1323, "same"))[::hop]
    db = 20*np.log10(env+1e-9)
    best = None
    for thr in (-38,-35,-42,-32,-45,-30):
        for mingap in (0.20,0.16,0.25,0.12,0.30,0.35):
            loud = db > thr
            segs=[]; i=0; N=len(loud)
            while i<N:
                if loud[i]:
                    j=i
                    while j<N and loud[j]: j+=1
                    segs.append([i,j]); i=j
                else: i+=1
            merged=[]
            for s in segs:
                if merged and (s[0]-merged[-1][1])*hop/SR < mingap: merged[-1][1]=s[1]
                else: merged.append(s)
            merged=[m for m in merged if (m[1]-m[0])*hop/SR>0.08]
            if len(merged)==n_expected:
                return [(a*hop/SR,b*hop/SR) for a,b in merged], (thr,mingap)
            if best is None or abs(len(merged)-n_expected)<abs(len(best)-n_expected): best=merged
    return [(a*hop/SR,b*hop/SR) for a,b in best], None
os.makedirs("audio/words", exist_ok=True)
manifest = {}
take = dict(a.split("=") for a in sys.argv[1:])
for sec in SECTIONS:
    t = take.get(sec,"a")
    x = load(f"audio/voice_raw/{sec}_{t}.mp3")
    cs = cues(sec)
    segs, ok = segments(x, len(cs))
    print(sec, t, "cues", len(cs), "segs", len(segs), "OK" if ok else "MISMATCH", ok)
    if not ok: continue
    for k,((a,b),c) in enumerate(zip(segs,cs)):
        a2=max(0,a-0.04); b2=min(len(x)/SR,b+0.12)
        clip = x[int(a2*SR):int(b2*SR)].copy()
        f=int(0.02*SR); clip[:f]*=np.linspace(0,1,f); g=int(0.08*SR); clip[-g:]*=np.linspace(1,0,g)
        fn=f"audio/words/{sec}_{k:02d}.wav"; sf.write(fn, clip, SR)
        manifest[f"{sec}_{k:02d}"]={"text":c,"dur":round(b-a,3),"file":fn}
json.dump(manifest, open("audio/words.json","w"), indent=0)
