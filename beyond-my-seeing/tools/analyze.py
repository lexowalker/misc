import sys, json, numpy as np, librosa
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
dur = len(y)/sr
hop = 512
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
t = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop)
print("dur", round(dur,2), "tempo", tempo)
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
def band(lo,hi): return S[(freqs>=lo)&(freqs<hi)].mean(axis=0)
low, mid, high = band(20,250), band(250,2000), band(2000,8000)
cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
# per-second summary
db = librosa.amplitude_to_db(rms, ref=rms.max())
out=[]
for s in range(int(dur)+1):
    m=(t>=s)&(t<s+1)
    if m.sum()==0: continue
    out.append((s, db[m].mean(), onset_env[m].mean(), cent[m].mean()))
for s,d,o,c in out:
    if s%2==0: print(f"{s//60}:{s%60:02d} {d:6.1f}dB onset{o:5.2f} cent{c:6.0f} " + "#"*int(max(0,(d+40))))
# save envelopes at 24fps for renderer
fps=24
nf=int(np.ceil(dur*fps))
tt=np.arange(nf)/fps
def at(x): return np.interp(tt, t, x)
def norm(x):
    x=np.asarray(x,float); lo,hi=np.percentile(x,2),np.percentile(x,99.5); return np.clip((x-lo)/(hi-lo+1e-9),0,1)
env={"fps":fps,"n":nf,"rms":norm(at(rms)).round(4).tolist(),"low":norm(at(low)).round(4).tolist(),
     "mid":norm(at(mid)).round(4).tolist(),"high":norm(at(high)).round(4).tolist(),
     "onset":norm(at(onset_env)).round(4).tolist(),"beats":librosa.frames_to_time(beats,sr=sr,hop_length=hop).round(3).tolist()}
json.dump(env, open(sys.argv[2],"w"))
