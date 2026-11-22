You are joining a songwriting project in progress. The attached zip is the folder `ill-never-love-again/`. Unzip it and read these files first, in this order:

1. `prompts/handoff.md` (this text)
2. `README.md` (what each file is, how to build)
3. `song/LYRICS.md` (the current lyric, the rules for it, and its revision history)
4. `song/NOTES.md` (sections with timestamps, self-check results)
5. `gen/song.py` (the full score as text: chords, melodies, solo, syllables)
6. `reference-profile.md` and `lyric-inspiration.md` (where the design rules come from)

Do not start new work until I tell you what I want. First tell me in a few lines what you understand, and ask me what is unclear.

## The vision (do not drift from this)

"Moderately slow blues song featuring an extraordinary and substantial electric solo on a Les Paul. (Reference audio: Gary Moore's Still Got the Blues; Gary Moore's Parisienne Walkways; other beautiful and heartbreaking melodies of the loving and losing humans go through). The solo includes extraordinary virtuosity in its fast parts (shredding is ok) and hauntingly achy arcs and truly heartbreaking moments in its slow sections. These two seamlessly recapitulate each other in the crescendo leading into their resolution at the end. The song is called "I'll Never Love Again" and it's the quintessential loved and lost tune."

The emotional core: the title is a vow that the song disproves. The singer says "never again" because he never stopped loving. The guitar says what the words cannot.

## What exists now

- **Five two-minute MIDI sketches** in `renditions/` (classic ballad, nocturne, raw slow blues, cinematic, power ballad). I liked the Classic Ballad most (the most tasteful) and the Nocturne second (its guitar phrases run longer). The other three are not in use.
- **The full song** in `song/`: `ill-never-love-again.mid` and `.mp3`. B minor, 66 BPM, 4/4, 4:40. It blends the two sketches I liked: the Classic Ballad's key, tempo, circle-of-fifths chorus, hook and fast vocabulary; the Nocturne's bass line that falls by semitones, its theme that rises against that bass, and its longer phrases.
- **Form:** Intro 0:00, Verse 1 0:14, Chorus 0:43, guitar link 1:05, Verse 2 1:12, Chorus 1:41, Bridge 2:03, Solo 2:32 to 4:14 (slow, build, fast, then theme and speed together), Coda 4:14. No full chorus comes after the solo: the solo is the last big statement, and the coda has three sung lines.
- **Lyrics: draft 3**, in `song/LYRICS.md`. Not yet approved.
- **Suno:** I am taking the MP3 to Suno as reference audio. A style prompt and a lyric prompt with section tags exist (below).

## Decisions that are fixed

- The hook "I'll never love again" is the melodic peak of the chorus. "Again" lands on Gmaj7, not on the home chord, each time. Only "I'd have to finish loving you" and the last line "I never stopped" resolve to the tonic.
- These three lines stay unless I say otherwise: "I'll never love again." / "I'd have to finish loving you." / "I never stopped."
- The melody is fixed for now. Each lyric line must keep its syllable count and stress: verse lines are 8 syllables, iambic; chorus 8, 8, 6, 8; bridge 8, 6, 8, 6; coda 8, 6, 4. The build fails if syllables and sung notes do not match (`gen/song.py`).
- The guitar part must stay playable on a real Les Paul (standard tuning, 22 frets). I will learn it.
- Originality is a hard rule. Reference songs are for architecture, tone and proportions only. `selfcheck.py` compares every melodic line with the reference score. The reference files are copyrighted and are NOT in this zip; never ask me to commit them. Without them the originality check reports "not run".
- Describe the references in prompts for audio models; do not name artists there.

## My feedback on the lyrics so far (important)

I rejected two drafts. Learn from why:

- No clichés. No stock images (lights left on, rain, ghosts, flames, broken hearts, keepsakes).
- Somewhat poetic, but straightforward. It must convey pain and loss plainly. Not unnecessarily poetic.
- Nothing trite or AI-sounding, like the lyrics people post on social media.
- Draft 2 used a keepsake (her cup on a shelf) and too many lines that start with "I" and "they". I found both trite.
- Draft 3 answers that: the verses describe her and the new person, and "I" appears only in the hook, the line after it and the last line. It uses one detail, a cupboard door she never closed. I have not said yet if this works.

## Current lyric (draft 3)

Verse 1
You laughed before the joke was done.
You sang off-key and sang it loud.
You never closed a cupboard door.
The house is very tidy now.

Chorus
So here it is. It isn't new,
and all of it is nearly true:
I'll never love again.
I'd have to finish loving you.

Verse 2
There's someone kind who stays some nights.
She waits until the joke is through.
She closes every cupboard door.
She's lovely, and she isn't you.

Bridge
Time's meant to take the edge off this.
Let time, for once, be wrong.
The day it doesn't hurt at all
is when you're really gone.

Coda
One cupboard door stays open now.
I'll never love again.
I never stopped.

## Suno style prompt in use

Slow blues rock ballad, B minor, 66 BPM, 4/4. Soulful, weathered male tenor, intimate and restrained in the verses, raw and aching in the chorus. Les Paul lead guitar on the neck pickup through a cranked tube amp: warm, thick, singing sustain, wide slow vibrato, long expressive bends, controlled feedback. Hammond organ, lush strings, clean arpeggiated electric guitar, warm fingered bass, restrained drums. Sparse verses, swelling chorus, then a long epic guitar solo that starts slow and mournful, builds to fast virtuosic legato shred, and returns to the melody at its peak. Melancholic, heartbroken, late-night. Analog, organic, live band, 1990 production, plate reverb.

Section tags for the Suno lyrics field: [Intro: slow lead guitar melody, sparse], [Verse 1: soft, intimate, almost spoken], [Chorus: fuller, aching, strings enter], [Guitar fill], [Verse 2], [Chorus], [Bridge: building], four separate [Guitar solo: ...] tags (slow and mournful; building; fast virtuosic shred; melody returns an octave higher, climax), then [Outro: quiet, one held guitar note under the voice] with the three coda lines.

## Known limits (be honest about these)

- Nobody has judged the music by ear except me. The AI that wrote it cannot listen. It used data checks: duration, solo density, chord tones on strong beats, range, a fingering search, and the originality comparison. All pass.
- The audio is General MIDI. A clarinet plays the vocal melody. Judge notes and form, not tone.
- The lead guitar track uses a pitch-bend range of ±12 semitones (set with RPN 0 in the file).
- Stem separation (Demucs) was not available for the reference analysis; one reference was analysed with a simpler filter.

## Open questions

- Do the draft 3 lyrics work? Is the cupboard door too close to "the cup thing"? A no-object coda line exists: "Nobody here laughs early now."
- Does the solo arrive at the right time (2:32)?
- Verse 2 says "she". Keep it?
- Possible next steps: an instrumental MP3 with no clarinet for Suno; a lead-guitar-only MP3; tablature for the solo; changes to the solo after I listen more.

## How to work with me

- Write in Simplified Technical English at about 80% strictness: short sentences, active voice, one instruction per sentence. Be concise and direct.
- When you change lyrics, keep the syllable counts, run the build, and show me the full new lyric.
- Tell me plainly what you could not do or could not check.
- Build: `python3 generate.py`, then `python3 selfcheck.py --song`, then `python3 render.py song/ill-never-love-again.mid` (needs fluidsynth, ffmpeg and a General MIDI soundfont).
