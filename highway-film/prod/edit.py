"""Cut and mix 'Death Over Your Left Shoulder' from the Seedance clips and ElevenLabs audio.

    python3 edit.py            # writes build/ and death_over_your_left_shoulder.mp4
    python3 edit.py --audio    # remix sound only, reusing build/picture.mp4

Everything is driven by the two tables below, so a trim or a level change is a one-line edit.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
V, A, B = (os.path.join(HERE, p) for p in ("video", "audio/raw", "build"))
os.makedirs(B, exist_ok=True)
W, H, FPS = 1920, 824, 24          # 2.33:1 delivery, upscaled from Seedance 720p (1470x630)

# Picture: (shot, source clip, in point in seconds, duration in seconds). Durations follow the shot list.
EDL = [
    (1,  "v2/shot01.mp4", 0.0, 6),
    (2,  "v2/shot02.mp4", 0.0, 5),
    (3,  "v2/shot03.mp4", 0.0, 10),
    (4,  "v1/shot04.mp4", 0.0, 3),
    (5,  "v1/shot05.mp4", 0.0, 7),
    (6,  "v1/shot06.mp4", 0.0, 6),
    (7,  "v1/shot07.mp4", 0.0, 6),
    (8,  "v1/shot08.mp4", 0.0, 7),
    (9,  "v1/shot09.mp4", 0.0, 7),
    (10, "v1/shot10.mp4", 0.5, 3),
    (11, "v1/shot11.mp4", 0.0, 1.4),   # foot slams the accelerator
    (11, "v2/shot11b.mp4", 2.3, 1.6),  # hands tighten on the wheel
    (12, "v1/shot12.mp4", 0.0, 5),
    (13, "v1/shot13.mp4", 0.0, 3),
    (14, "v1/shot14.mp4", 0.0, 4),
    (15, "v1/shot15.mp4", 0.0, 6),
    (16, "v1/shot16.mp4", 0.0, 8),
    (17, "v1/shot17.mp4", 0.0, 13),
    (18, "v1/shot18.mp4", 0.3, 12),    # cut lands just before his head completes the turn
]
TAIL_BLACK = 2.0                    # cut to black, absolute silence

# Sound: (file, start on the timeline, gain dB, options). Options: dur, fade_in, fade_out, loop, radio, offset.
# Every file is first level-matched to REF_DB (mean), so gains are relative to that: 0 = reference, -10 = quieter.
REF_DB = -20
MIX = [
    # beds
    ("amb_desert_wind.mp3",     0.0, -9,  dict(loop=True, dur=89, fade_in=1.5)),
    ("amb_desert_wind.mp3",     89.0, -4, dict(loop=True, dur=25)),                             # louder in the silence after the stop
    ("sfx_distant_engine.mp3",  0.0, -13, dict(dur=6.5, fade_in=2, fade_out=1.5)),
    ("sfx_car_pass.mp3",        6.0, 0,   dict(dur=5.0, fade_out=0.8)),
    ("bed_interior_engine.mp3", 11.0, -8, dict(loop=True, dur=46, fade_in=0.6, fade_out=0.4)),
    ("mus_radio_bolero.mp3",    2.5, -17, dict(dur=8.5, radio=True, fade_in=3, fade_out=0.2)),   # faint, emerging (exterior)
    ("mus_radio_bolero.mp3",    11.0, -9, dict(offset=8.5, dur=38, radio=True, fade_out=6)),    # in the cab, falls away in shot 8
    ("sfx_radio_static.mp3",    27.0, -16, dict(dur=4, fade_in=1, fade_out=1)),                 # occasional static (shot 5)
    ("sfx_radio_static.mp3",    31.0, -12, dict(dur=12, fade_in=2, fade_out=3)),                # crackling as it closes (6-8)
    ("sfx_low_rumble.mp3",      44.0, -9, dict(dur=13.5, fade_in=4, fade_out=1.5)),
    # Don Juan, intimate and dry; the beds dip around it (see DUCK)
    ("vo_donjuan_s09_t1.mp3",   51.6, 3,  dict()),
    # chase
    ("sfx_pursuer_roar.mp3",    57.0, 1,  dict(dur=3.4, fade_out=0.4)),
    ("sfx_gasp.mp3",            58.3, -1, dict()),
    ("sfx_engine_floored.mp3",  60.0, 2,  dict(dur=3.6, fade_out=0.4)),
    ("bed_interior_engine.mp3", 60.0, -4, dict(loop=True, dur=15.0, fade_out=0.5)),
    ("sfx_tire_screech.mp3",    64.0, -1, dict(fade_out=0.5)),
    ("sfx_interior_rattle.mp3", 68.0, -3, dict(dur=3.0, fade_out=0.3)),
    ("sfx_breathing.mp3",       68.0, -1, dict(dur=3.0)),
    ("sfx_tire_screech.mp3",    71.4, 0,  dict(fade_out=0.4)),
    ("sfx_engine_floored.mp3",  75.0, -5, dict(dur=2.0, fade_out=0.6)),
    ("sfx_tire_screech.mp3",    75.6, 0,  dict(dur=2.2, fade_out=0.3)),
    ("sfx_gravel_skid.mp3",     77.0, 2,  dict(dur=4.0, fade_out=0.3)),
    # stillness
    ("sfx_engine_sputter.mp3",  81.0, -8, dict(dur=6, fade_out=2)),
    ("sfx_breathing.mp3",       81.2, -2, dict(offset=3.0, dur=7.0, fade_out=2)),
    ("sfx_radio_static.mp3",    82.0, -16, dict(dur=7, fade_in=1, fade_out=3)),
    ("sfx_engine_ticking.mp3",  89.0, -8, dict(dur=13, fade_out=2)),
    ("sfx_door_open.mp3",       89.8, -4, dict()),
    ("sfx_footsteps.mp3",       91.5, -6, dict(dur=6, fade_out=1)),
    ("sfx_wind_whistle.mp3",    102.0, 0, dict(dur=12, fade_in=7)),
    # dialogue
    ("vo_carlos_s03_t1.mp3",    15.4, 4,  dict()),
    ("vo_carlos_s07_t1.mp3",    39.6, 4,  dict()),
    ("vo_carlos_s17_t1.mp3",    99.4, 2,  dict()),
]
MASTER_DB = 0                       # set after measuring the mix; target about -16 LUFS integrated
DUCK = [(51.2, 55.6, -10)]          # (start, end, dB) on everything except the whisper


_MEAN = {}


def mean_db(path):
    if path not in _MEAN:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
                           capture_output=True, text=True)
        _MEAN[path] = float(r.stderr.split("mean_volume:")[1].split("dB")[0])
    return _MEAN[path]


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def picture():
    parts = []
    for i, (shot, src, t_in, dur) in enumerate(EDL):
        out = os.path.join(B, f"p{i:02d}.mp4")
        vf = (f"scale={W}:{H}:flags=lanczos,fps={FPS},setsar=1,"
              f"noise=alls=5:allf=t,format=yuv420p")   # one shared grain pass ties the clips together
        run(["ffmpeg", "-y", "-ss", str(t_in), "-i", os.path.join(V, src), "-t", str(dur), "-an",
             "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "16", out])
        parts.append(out)
    black = os.path.join(B, "black.mp4")
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=black:s={W}x{H}:r={FPS}", "-t", str(TAIL_BLACK),
         "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", black])
    parts.append(black)
    lst = os.path.join(B, "concat.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    pic = os.path.join(B, "picture.mp4")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", pic])
    return pic, sum(d for *_, d in EDL) + TAIL_BLACK


def sound(total):
    ins, chains = [], []
    for k, (f, start, gain, o) in enumerate(MIX):
        args = ["-stream_loop", "-1"] if o.get("loop") else []
        ins += args + ["-i", os.path.join(A, f)]
        c = f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo"
        if o.get("offset"):
            c += f",atrim=start={o['offset']},asetpts=PTS-STARTPTS"
        if o.get("dur"):
            c += f",atrim=duration={o['dur']}"
        if o.get("radio"):   # tinny period AM car radio: band-limited, a little crunch, mono
            c += ",pan=mono|c0=0.5*c0+0.5*c1,highpass=f=420,lowpass=f=3200,acrusher=bits=10:mix=0.25,aformat=channel_layouts=stereo"
        if o.get("fade_in"):
            c += f",afade=t=in:d={o['fade_in']}"
        if o.get("fade_out"):
            d = o.get("dur")
            if d:
                c += f",afade=t=out:st={max(0, d - o['fade_out'])}:d={o['fade_out']}"
        c += f",volume={REF_DB - mean_db(os.path.join(A, f)) + gain:.2f}dB"
        if not f.startswith("vo_donjuan"):
            for s, e, db in DUCK:
                c += f",volume=enable='between(t,{s - start},{e - start})':volume={db}dB"
        c += f",adelay={int(start * 1000)}:all=1[a{k}]"
        chains.append(c)
    mix = "".join(f"[a{k}]" for k in range(len(MIX)))
    graph = ";".join(chains) + (f";{mix}amix=inputs={len(MIX)}:normalize=0:dropout_transition=0,"
                                f"atrim=duration={total - TAIL_BLACK},apad=whole_dur={total},"
                                f"volume={MASTER_DB}dB,alimiter=limit=0.89[out]")
    wav = os.path.join(B, "mix.wav")
    run(["ffmpeg", "-y", *ins, "-filter_complex", graph, "-map", "[out]", "-ar", "48000", wav])
    return wav


if __name__ == "__main__":
    if "--audio" in sys.argv and os.path.exists(os.path.join(B, "picture.mp4")):
        pic, total = os.path.join(B, "picture.mp4"), sum(d for *_, d in EDL) + TAIL_BLACK
    else:
        pic, total = picture()
    wav = sound(total)
    final = os.path.join(HERE, "..", "death_over_your_left_shoulder.mp4")
    master = os.path.join(B, "master.mp4")
    run(["ffmpeg", "-y", "-i", pic, "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", master])
    # two-pass 6 Mbps keeps the grain and stays under GitHub's 100 MB file limit
    enc = ["-c:v", "libx264", "-preset", "slow", "-tune", "grain", "-b:v", "6000k", "-passlogfile", os.path.join(B, "p2")]
    run(["ffmpeg", "-y", "-i", master, *enc, "-pass", "1", "-an", "-f", "null", os.devnull])
    run(["ffmpeg", "-y", "-i", master, *enc, "-maxrate", "9000k", "-bufsize", "12000k", "-pass", "2",
         "-c:a", "copy", "-movflags", "+faststart", final])
    json.dump({"duration": total, "edl": EDL}, open(os.path.join(B, "edl.json"), "w"), indent=1)
    print("wrote", os.path.normpath(final), f"{total:.1f}s")
