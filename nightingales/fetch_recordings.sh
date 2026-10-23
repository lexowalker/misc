#!/bin/sh
# Downloads the field recordings (radio aporee ::: maps, via the Internet Archive) into build/rec/.
set -e
cd "$(dirname "$0")" && mkdir -p build/rec && cd build/rec
curl -sSL -o lithuania.flac "https://archive.org/download/aporee_67721_78390/nightingale05140130.flac"
curl -sSL -o berlin.mp3 "https://archive.org/download/aporee_44805_50918/berlinTreptowKiefholzstrNachtigall15062019.mp3"
curl -sSL -o koos.mp3 "https://archive.org/download/rec_koosmic_2025_05_01_00_05_12/rec_koosmic_2025_05_01_00_05_12.mp3"
