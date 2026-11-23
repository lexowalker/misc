"""Re-download every generated frame from the Flora URLs recorded in runs/*.json (frames are not committed)."""
import json, glob, os, subprocess
os.makedirs("frames", exist_ok=True)
for led in glob.glob("runs/agent*.json"):
    for cid, r in json.load(open(led)).items():
        url = r.get("url") if isinstance(r, dict) else None
        out = f"frames/{cid}.png"
        if url and not os.path.exists(out):
            subprocess.run(["curl", "-sL", "-m", "120", "-o", out, url], check=False)
print(len(os.listdir("frames")), "frames")
