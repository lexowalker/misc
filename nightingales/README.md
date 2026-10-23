# The Speech of Nightingales 小夜啼鳥の言葉

`nightingales.mp4` is a 1920×1080, 30 fps animated explainer, 7:51 long. It has narration, burned-in captions, real nightingale recordings, a quiet synthesized score and small demonstration sounds. The look borrows from Utagawa Kuniyoshi's yokai prints: woodblock plates, washi paper, ink, cartouches and red seals. Sounds turn into little ghost-spirits.

**Chapters:** cold open in a dark wood → title → 壱 *The Singer* (who sings, when and why: migration, unpaired males singing at night, day song for rivals) → 弐 *A Thousand Sounds* (a real Berlin song, slowed and taken apart into its notes; several hundred note types per bird and 1,000+ across the species; about 200 songs per male, some 250+; pitch, shape, length, loudness, speed and texture; the two-sided syrinx; songs learned in packages, giving a hierarchy of note, song, package and sequence) → 参 *Alphabet and Grammar* (phoneme counts against note types; sounds → syllables → words → unlimited sentences) → 四 *What Is He Saying?* (no referential "words"; the message is the singer; repertoire and age; song matching and overlapping) → 五 *Bits and Beads* (marked as **speculation** on screen and in the voiceover: about 1 bit/s for song choice against about 39 bits/s for speech; a "nightingale-speaking computer" whose raw channel could reach about 100 bits/s; a chain of beads against nested grammar; 200¹⁰ ≈ 10²³) → 六 *How Far It Carries* (about 90 dB at 1 m, quiet night air, louder songs in Berlin traffic) → 七 *A Wood Full of Voices* (turn-taking, pitch niches, picking out one voice, eavesdroppers) → 結 *Nightingale Floors* (the uguisu and uguisu-bari) → "I am here."

Hypotheses are flagged where they appear: the narration says "may", "seems" or "as far as we can tell", and every frame of the arithmetic chapter carries a red 推測 ("speculation") seal.

## How it's built

| File | Role |
|---|---|
| `script.json` | The narration, in 13 sections. |
| `vo/*.mp3` | The narration read by ElevenLabs (`eleven_v4`, voice "David – British Documentary"), one clip per section. |
| `align.py` | Transcribes each clip with word timestamps (faster-whisper `small.en`). Writes `build/words.json`. |
| `timeline.py` | Lays the clips out with pauses and chapter cards. Times the captions by aligning the script to the transcript, and exports every word's absolute time. Writes `build/voice.wav` and `build/timeline.{json,js}`. |
| `fetch_recordings.sh` | Downloads the three field recordings into `build/rec/`. |
| `assets.py` | Builds ink spectrograms of one real Berlin song, plus note boundaries and song onsets, from the recordings. Writes `build/assets/` and `build/assets.js`. |
| `plates/*.jpg` | 14 illustration plates generated with `gpt-image-2.5-sunburst` from prompts asking for Kuniyoshi-style yokai woodblock prints (`prompts/plates.json`; 16:9, 2K, best of up to four takes). |
| `kit.js` | Drawing helpers: washi texture, ink strokes, cartouches, seals, sound-spirits, note glyphs, mist and grain. |
| `scenes.js` | The film. `render(t)` paints second `t`. Every beat is keyed to a narrated word (`wt('s05', 'rattle')`), so re-timing the voice re-times the picture. It also emits the sound cues. |
| `render.mjs` | Playwright captures frames and pipes them to ffmpeg in parallel chunks (`build/video.mp4`). Writes `build/cues.json`. |
| `audio.py` | Mixes the narration, the recordings (ducked under the voice), a drone in the In scale, Karplus-Strong koto, taiko, hyoshigi clappers and the demonstration sounds. Writes `build/mix.wav`. |
| `subset_fonts.py`, `fonts/` | Shippori Mincho (subset to the film's kana and kanji) and Cormorant Garamond, both SIL OFL. |

## Rebuild

```sh
pip install numpy scipy soundfile faster-whisper fonttools
./fetch_recordings.sh
python3 align.py && python3 timeline.py && python3 assets.py
# only needed if scenes.js gains new kanji: put ShipporiMincho-Bold.ttf (google/fonts) in fonts/, then
python3 subset_fonts.py
node render.mjs video 30 4          # ~20 min on 4 cores; also writes build/cues.json
python3 audio.py
ffmpeg -i build/video.mp4 -i build/mix.wav -c:v libx264 -preset slow -crf 23 -tune animation -pix_fmt yuv420p \
  -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a aac -b:a 192k -shortest -movflags +faststart nightingales.mp4
```

`node render.mjs stills 27 113 372` writes single frames (`build/still_<t>.jpg`) for checking a moment.

## Credits and sources

- Field recordings from radio aporee ::: maps, via the Internet Archive: nightingales near Naujasodis, Lithuania, by alas23/sala (public domain); a late nightingale at Kiefholzstraße, Berlin-Treptow, by udo noll (CC BY-SA 3.0); midnight on the Island of Koos, Greifswald, by radio aporee (CC BY-SA 3.0).
- Facts: Hultsch & Todt 1989 (song packages); Amrhein, Korner & Naguib 2002 (night song and mating status); Brumm 2004 (louder song in Berlin noise); Kiefer et al. 2006 (repertoire and age); Todt & Naguib 2000 (matching and overlapping); Coupé et al. 2019 (about 39 bits/s across 17 languages). The bits-and-beads arithmetic is the film's own speculation.
