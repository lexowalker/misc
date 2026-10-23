# Prepares data drawn from the field recordings: ink spectrograms of one real song
# (and where its notes fall), plus song onset times from the Berlin recording.
# Writes build/assets/*.png and build/assets.js.
import json, subprocess
import numpy as np
from scipy import signal, ndimage
from PIL import Image

ROOT = __file__.rsplit('/', 1)[0]
OUT = f'{ROOT}/build/assets'
SONG = ('build/rec/berlin.mp3', 199.4, 3.3)       # soft notes, a rattle, a final flourish
WHISTLES = ('build/rec/berlin.mp3', 137.3, 3.9)   # a run of pure whistles

def load(f, ss, t, sr=44100):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(ss), '-t', str(t), '-i', f'{ROOT}/{f}',
                          '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768

def ink_spectrogram(src, name, width, height=520, fmax=10000):
    x = load(*src)
    f, t, S = signal.spectrogram(x, 44100, nperseg=1024, noverlap=1024 - 96)
    keep = (f > 400) & (f < fmax)
    S = 10 * np.log10(S[keep] + 1e-12)
    lo, hi = np.percentile(S, 72), np.percentile(S, 99.8)
    a = np.clip((S - lo) / (hi - lo), 0, 1) ** 0.8
    a = ndimage.gaussian_filter(a, 0.7)[::-1]
    img = Image.fromarray((a * 255).astype(np.uint8)).resize((width, height), Image.LANCZOS)
    rgba = np.zeros((height, width, 4), np.uint8)
    rgba[..., :3] = (24, 20, 26)                   # sumi ink
    rgba[..., 3] = np.asarray(img)
    Image.fromarray(rgba).save(f'{OUT}/{name}.png')
    # notes: runs of columns with energy, split at silent gaps
    fr_rows = np.linspace(fmax, 400, a.shape[0])          # row 0 is the top (fmax)
    band = (fr_rows > 1500) & (fr_rows < fmax * 0.95)
    col = a[band].max(axis=0)
    on = ndimage.binary_closing(col > 0.45, iterations=1)
    lab, n = ndimage.label(on)
    notes = []
    for i in range(1, n + 1):
        idx = np.where(lab == i)[0]
        if len(idx) < 3: continue
        rows = np.where(band & (a[:, idx].max(axis=1) > 0.45))[0]
        notes.append(dict(t0=round(t[idx[0]], 3), t1=round(t[idx[-1]], 3),
                          y0=round(rows.min() / a.shape[0], 3), y1=round(rows.max() / a.shape[0], 3)))
    return dict(img=f'build/assets/{name}.png', dur=src[2], fmin=400, fmax=fmax, notes=notes)

def onsets(f, ss, t):
    x = load(f, ss, t, 22050)
    y = signal.sosfiltfilt(signal.butter(4, [1500, 9000], 'bandpass', fs=22050, output='sos'), x)
    env = np.sqrt(signal.sosfiltfilt(signal.butter(2, 20, fs=22050, output='sos'), y ** 2).clip(0))[::220]
    on = env > np.percentile(env, 60) * 4
    tt = np.arange(len(env)) * 220 / 22050
    bouts, start, last = [], None, None
    for i, v in enumerate(on):
        if v:
            start = tt[i] if start is None else start; last = tt[i]
        elif start is not None and tt[i] - last > 0.6:
            if last - start > 0.8: bouts.append([round(start, 2), round(last, 2)])
            start = None
    return bouts

data = dict(song=ink_spectrogram(SONG, 'song', 2400), whistles=ink_spectrogram(WHISTLES, 'whistles', 1600),
            berlinSongs=onsets('build/rec/berlin.mp3', 0, 120))
open(f'{ROOT}/build/assets.js', 'w').write('window.ASSETS = ' + json.dumps(data) + ';\n')
print(len(data['song']['notes']), 'notes;', len(data['berlinSongs']), 'songs in 2 min')
