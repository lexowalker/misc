# Lays the narration clips out on one timeline, with pauses and chapter cards between them,
# and times the captions from the word timings in build/words.json.
# Writes build/voice.wav, build/timeline.json and build/timeline.js.
import json, re, difflib, subprocess
import numpy as np
import soundfile as sf

ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'x x twenty thirty forty fifty sixty seventy eighty ninety'.split()

def num2words(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ONES[n % 10])
    if n < 1000: return ONES[n // 100] + 'hundred' + ('' if n % 100 == 0 else 'and' + num2words(n % 100))
    return num2words(n // 1000) + 'thousand' + ('' if n % 1000 == 0 else num2words(n % 1000))

SR = 48000
ROOT = __file__.rsplit('/', 1)[0]
script = json.load(open(f'{ROOT}/script.json'))
words = json.load(open(f'{ROOT}/build/words.json'))

# (segment id, seconds of silence before it, chapter card shown in that gap)
PLAN = [
    ('s01_open', 5.0, None),
    ('s02_bird', 2.6, None),
    ('s03_basics', 10.5, ('壱', 'The Singer')),
    ('s04_count', 4.0, ('弐', 'A Thousand Sounds')),
    ('s05_vary', 1.6, None),
    ('s06_hier', 1.4, None),
    ('s07_humans', 4.0, ('参', 'Alphabet and Grammar')),
    ('s08_meaning', 4.0, ('四', 'What Is He Saying?')),
    ('s09_bits', 4.0, ('五', 'Bits and Beads')),
    ('s10_computer', 1.4, None),
    ('s11_distance', 4.0, ('六', 'How Far It Carries')),
    ('s12_parallel', 4.0, ('七', 'A Wood Full of Voices')),
    ('s13_close', 4.0, ('結', 'Nightingale Floors')),
]
TAIL = 16.0

def load(f):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768

def norm_words(text):
    text = re.sub(r'(\d+)', lambda m: ' ' + num2words(int(m.group(1))) + ' ', text)
    return re.sub(r'[^a-z]', '', text.lower().replace('uguisu', 'ugisu'))

def chunks(text):
    """Split a segment's text into caption-sized pieces."""
    text = re.sub(r'\[[^\]]+\]\s*', '', text).replace('/ˈuːɡwiːsuː/', 'uguisu').strip()
    parts = re.split(r'(?<=[.?!…:])\s+', text)
    out = []
    for p in parts:
        while len(p) > 64:
            cut = max((m.end() for m in re.finditer(r'[,—;]\s', p[:64])), default=0)
            if cut < 20:
                cut = p.rfind(' ', 0, 60) + 1
            out.append(p[:cut].strip()); p = p[cut:].strip()
        if p: out.append(p)
    return out

def char_times(ws):
    """One (start, end) per normalised character of the whisper transcript."""
    s, times = '', []
    for w in ws:
        n = norm_words(w['w'])
        for i, _ in enumerate(n):
            a = w['s'] + (w['e'] - w['s']) * i / max(len(n), 1)
            times.append((a, w['s'] + (w['e'] - w['s']) * (i + 1) / max(len(n), 1)))
        s += n
    return s, times

voice, cues, segs, cards, absw = [], [], [], [], {}
t = 0.0
by_id = {x['id']: x for x in script}
for sid, gap, card in PLAN:
    if card:
        cards.append(dict(t0=t + max(0.3, gap - 4.2), t1=t + gap - 0.2, num=card[0], title=card[1]))
    voice.append(np.zeros(int(gap * SR), np.float32)); t += gap
    clip = load(f'{ROOT}/vo/{sid}.mp3')
    dur = len(clip) / SR
    segs.append(dict(id=sid, t0=round(t, 3), t1=round(t + dur, 3)))
    # map script characters onto whisper characters
    wtext, wt = char_times(words[sid])
    pieces = chunks(by_id[sid]['text'])
    stext = ''.join(norm_words(p) for p in pieces)
    sm = difflib.SequenceMatcher(None, stext, wtext, autojunk=False)
    smap = [None] * len(stext)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n): smap[a + k] = b + k
    pos = 0
    for p in pieces:
        n = len(norm_words(p))
        idx = [smap[i] for i in range(pos, pos + n) if smap[i] is not None]
        pos += n
        if not idx: continue
        cues.append(dict(t0=round(t + wt[idx[0]][0], 3), t1=round(t + wt[idx[-1]][1], 3), text=p, seg=sid))
    absw[sid] = [[w['w'], round(t + w['s'], 3), round(t + w['e'], 3)] for w in words[sid]]
    voice.append(clip); t += dur
voice.append(np.zeros(int(TAIL * SR), np.float32)); t += TAIL

# hold each caption until just before the next one (max +0.8 s) so they don't flicker
for a, b in zip(cues, cues[1:]):
    a['t1'] = round(min(b['t0'] - 0.05, a['t1'] + 0.8), 3)
cues[-1]['t1'] += 1.5

v = np.concatenate(voice)
sf.write(f'{ROOT}/build/voice.wav', v, SR)
tl = dict(duration=round(t, 3), segments=segs, cues=cues, cards=cards, words=absw)
json.dump(tl, open(f'{ROOT}/build/timeline.json', 'w'), indent=1, ensure_ascii=False)
open(f'{ROOT}/build/timeline.js', 'w').write('window.TL = ' + json.dumps(tl, ensure_ascii=False) + ';\n')
print(f'duration {t:.1f}s, {len(cues)} cues')
