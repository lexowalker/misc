#!/bin/bash
# Full build: timeline -> audio mix -> picture (4 parallel chunks) -> mux. Needs frames/ and audio/ in place.
set -e
cd "$(dirname "$0")"; mkdir -p build
python3 timeline.py
python3 build_audio.py
for i in 0 1 2 3; do python3 render.py build/part$i.mp4 $((i*45)) $((i*45+45)) & done; wait
printf "file part0.mp4\nfile part1.mp4\nfile part2.mp4\nfile part3.mp4\n" > build/parts.txt
ffmpeg -v error -y -f concat -safe 0 -i build/parts.txt -i build/audio.wav -c:v copy -c:a aac -b:a 256k -movflags +faststart build/listening.mp4
ffprobe -v error -show_entries format=duration,size -of default=nw=1 build/listening.mp4
