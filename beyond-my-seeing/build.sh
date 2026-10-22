#!/bin/sh
# Encode the rendered frames with the song.
#   build/frames/%05d.jpg  <- node render.mjs frames 3
#   audio/song.m4a         <- the song (Suno export)
set -e
cd "$(dirname "$0")"
# master: high quality
ffmpeg -y -framerate 24 -i build/frames/%05d.jpg -i audio/song.m4a \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -tune film -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart build/beyond-my-seeing-master.mp4
# repo copy: kept under GitHub's 100 MB file limit
ffmpeg -y -framerate 24 -i build/frames/%05d.jpg -i audio/song.m4a \
  -map 0:v -map 1:a -c:v libx264 -preset slow -b:v 1500k -maxrate 3000k -bufsize 6000k -pass 1 -an -f mp4 /dev/null
ffmpeg -y -framerate 24 -i build/frames/%05d.jpg -i audio/song.m4a \
  -map 0:v -map 1:a -c:v libx264 -preset slow -b:v 1500k -maxrate 3000k -bufsize 6000k -pass 2 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -shortest -movflags +faststart beyond-my-seeing.mp4
rm -f ffmpeg2pass-0.log ffmpeg2pass-0.log.mbtree
