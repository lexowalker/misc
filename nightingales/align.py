# Transcribe each narration clip with word timestamps (for captions and checking the read).
import json, glob, os, subprocess
import numpy as np
from faster_whisper import WhisperModel
ROOT = __file__.rsplit("/", 1)[0]
m = WhisperModel("small.en", device="cpu", compute_type="int8")
out = {}
for f in sorted(glob.glob(f"{ROOT}/vo/*.mp3")):
    sid = os.path.basename(f)[:-4]
    pcm = subprocess.run(['ffmpeg','-v','error','-i',f,'-ac','1','-ar','16000','-f','s16le','-'],capture_output=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    segs, _ = m.transcribe(audio, word_timestamps=True, beam_size=5)
    words = [dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3)) for s in segs for w in s.words]
    out[sid] = words
    print(sid, " ".join(x["w"] for x in words))
json.dump(out, open(f"{ROOT}/build/words.json", "w"), indent=0)
