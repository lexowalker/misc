"""Re-cut the score to the film's structure, place every spoken word on the grid, add air, mix. Writes build/audio.wav."""
import json, subprocess, numpy as np, soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt
SR=44100; END=180.0; N=int(END*SR)
rng=np.random.default_rng(7)
def load(p, ch=2):
    raw=subprocess.run(["ffmpeg","-v","error","-i",p,"-ac",str(ch),"-ar",str(SR),"-f","f32le","-"],capture_output=True).stdout
    return np.frombuffer(raw,np.float32).reshape(-1,ch).astype(np.float64)
def seg(x,a,b): return x[int(a*SR):int(b*SR)]
def fade(x,fi=0.0,fo=0.0):
    x=x.copy(); n=len(x)
    if fi>0: k=min(n,int(fi*SR)); x[:k]*=np.sin(np.linspace(0,np.pi/2,k))[:,None]**2
    if fo>0: k=min(n,int(fo*SR)); x[-k:]*=np.cos(np.linspace(0,np.pi/2,k))[:,None]**2
    return x
def put(mix,x,t,g=1.0):
    a=int(round(t*SR));
    if a<0: x=x[-a:]; a=0
    b=min(len(mix),a+len(x)); mix[a:b]+=x[:b-a]*g
def paulstretch(x, factor, win=0.35):
    """Extreme time-stretch (phase-randomised overlap-add): turns a short tail into a long drone in the same key."""
    w=int(win*SR)//2*2; hop=w//2; window=np.sin(np.linspace(0,np.pi,w))
    n_out=int(len(x)*factor); out=np.zeros((n_out+w,x.shape[1]))
    pos=0.0; o=0
    while o<n_out:
        a=int(pos); fr=x[a:a+w]
        if len(fr)<w: fr=np.vstack([fr,np.zeros((w-len(fr),x.shape[1]))])
        for c in range(x.shape[1]):
            S=np.abs(np.fft.rfft(fr[:,c]*window)); ph=rng.uniform(0,2*np.pi,len(S))
            out[o:o+w,c]+=np.fft.irfft(S*np.exp(1j*ph))*window
        o+=hop; pos+=hop/factor
    return out[:n_out]
def level(x, db, win=1.0):
    """Flatten a pad's envelope toward a constant level."""
    k=int(win*SR); e=np.sqrt(fftconvolve((x**2).mean(1),np.ones(k)/k,"same")+1e-12)
    return x/e[:,None]*10**(db/20)

A=load("audio/music/score_a.mp3")
music=np.zeros((N,2)); X=0.03   # splice 30 ms ahead of the downbeat, 40 ms crossfades
def lay(film_t, a, b, fi=0.04, fo=0.04, g=1.0):
    put(music, fade(seg(A,a-X,b-X+fo),fi,fo), film_t-X, g)
lay(0,   0.03, 24, fi=0)          # Deep, Memory i
lay(24,  32, 40)                  # Memory ii
lay(32,  48, 56)                  # Star
lay(40,  56, 64)                  # Cycle -> Why
lay(48,  64, 73.2, fo=1.0)        # the cut to silence; hit lands on "City" at 56
tail=paulstretch(seg(A,73.0,76.0),5.4)            # the hit's decay becomes the ruin's drone
put(music, fade(level(tail,-31),1.5,3.0), 57.0)
lay(72,  76, 80, fi=1.5)          # swell into the journey
lay(76,  80, 88)
lay(84,  96, 104)
lay(92,  104, 114.3, fo=1.2)      # Summit, then the fall at 98
glass=paulstretch(seg(A,112.6,115.0),4.2)         # held breath before the drop
put(music, fade(level(glass,-33),2.0,2.5), 101.0)
lay(110, 114, 116, fi=1.0)
lay(112, 116, 148)                # Metamorphosis, Beauty
lay(144, 148, 156, fo=0.5)        # the fall
hold=paulstretch(seg(A,153.5,156.0),2.4)
put(music, fade(level(hold,-34),1.5,1.0), 151.0)
lay(156, 156, 162.5, fo=2.0)      # hit lands on "Transmit"
aft=paulstretch(seg(A,157.0,160.0),4.5)
put(music, fade(level(aft,-36),2.5,5.0), 158.0)
lay(162, 0.03, 18, fi=0)          # the opening returns under "And again"
music[int(178.6*SR):]*=np.cos(np.linspace(0,np.pi/2,N-int(178.6*SR)))[:,None]**2

# air
air=np.zeros((N,2))
oc=load("audio/sfx/ocean.mp3"); put(air,fade(oc[:int(20*SR)],0.8,5.0),0.0,0.9)
put(air,fade(oc[:int(11*SR)],3.0,2.5),169.0,0.8)
wd=load("audio/sfx/wind.mp3"); put(air,fade(wd,2.0,4.0),49.0,0.55)
dr=load("audio/sfx/drop.mp3"); put(air,fade(dr,0,1.5),108.5-0.356,0.9)
rn=load("audio/sfx/rain.mp3"); put(air,fade(rn[:int(14*SR)],3.0,5.0),158.0,0.5)

# voice
tl=json.load(open("timeline.json"))["cues"]
t=np.arange(int(2.2*SR))/SR
ir=rng.standard_normal((len(t),2))*np.exp(-t/0.55)[:,None]; ir[:int(0.012*SR)]=0
sos=butter(2,[250,6000],btype="band",fs=SR,output="sos"); ir=sosfilt(sos,ir,axis=0); ir/=np.sqrt((ir**2).sum(0))
dry=np.zeros((N,2)); side=0
for c in tl:
    f=f"audio/words/{c['id']}.wav"; x,_=sf.read(f); L=len(x)/SR
    speed=1.0
    if c["dur"]<0.5 and L>c["dur"]*1.6: speed=min(1.45, L/(c["dur"]*1.6))
    elif c["dur"]<0.8 and L>c["dur"]*1.25: speed=min(1.25, L/(c["dur"]*1.25))
    if speed>1.02:
        raw=subprocess.run(["ffmpeg","-v","error","-i",f,"-af",f"atempo={speed:.3f}","-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True).stdout
        x=np.frombuffer(raw,np.float32).astype(np.float64)
    x=x/ (np.sqrt((x**2).mean())+1e-9) * 10**(-21/20)          # even loudness word to word
    pan=0.0
    if c["dur"]<=0.5: side=1-side; pan=0.45 if side else -0.45  # flurries alternate left and right
    st=np.stack([x*np.sqrt((1-pan)/2)*1.414, x*np.sqrt((1+pan)/2)*1.414],1)
    put(dry, st, c["t"]-0.04)
wet=np.stack([fftconvolve(dry[:,i],ir[:,i])[:N] for i in range(2)],1)
voice=dry+0.20*wet

# gentle duck of the score under speech
env=np.sqrt(fftconvolve((dry**2).mean(1),np.ones(int(0.25*SR))/int(0.25*SR),"same")+1e-12)
duck=1-0.30*np.clip(env/10**(-24/20),0,1)
mix=music*duck[:,None]*0.80 + air*0.5 + voice*1.9
mix[:int(0.3*SR)]*=np.linspace(0,1,int(0.3*SR))[:,None]
pk=np.abs(mix).max(); print("peak",pk)
mix=np.tanh(mix/ max(pk,1e-9) *1.25)/np.tanh(1.25)*0.97
sf.write("build/audio.wav",mix,SR,subtype="PCM_16")
for name,x in (("music",music),("voice",voice),("mix",mix)):
    r=[20*np.log10(np.sqrt((x[int(s*SR):int((s+4)*SR)]**2).mean())+1e-9) for s in range(0,180,4)]
    print(name," ".join(f"{v:.0f}" for v in r))
