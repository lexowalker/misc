# Tractatus Expedition

A guided, interactive reading of Ludwig Wittgenstein's *Tractatus Logico-Philosophicus*
for a curious reader without training in philosophy or logic.

The complete text is on the page: all 526 numbered remarks, in the order of the book,
none shortened. The guide's explanations stand between the remarks and are set in a
different typeface. Around the text are a glossary, eight small interactive models, and a
WebGL map in which each remark is one star.

## Run it

It is a static site.

```sh
cd tractatus
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` directly from disk also works. Three.js (r128) and the fonts load
from public CDNs, so the first visit needs a network connection. Without WebGL the page
still works: the text, the instruments and the Atlas reader remain, without the map.

## What is in it

| Part | What it does |
| --- | --- |
| **The route** | Seven stations, one for each main proposition, plus a prologue and an afterword. Each station holds every remark of its book in order. A remark is set one step further to the right for each level of its number, so the hierarchy of the book is visible. Each station opens with a list of the direct comments on its main proposition. |
| **Depth** | Reads the book in layers. Depth 1 shows only the direct comments on each main proposition (2.01, 2.02 … 2.1, 2.2); depths 2 and 3 add a level each; All shows everything. A remark with hidden comments shows how many are below it. |
| **The field** | The numbering of the book is a tree: 2.01 comments on 2, 2.012 on 2.01. The scene draws that tree. Each star is a remark, each line is "comments on". Lines appear as you read a station. The remark you are reading is marked on the map. |
| **Instruments** | Logical space of three atomic facts; picture and reality; one sign, three symbols; a proposition as a selection of truth-table rows; what follows from what (with Wittgenstein's probability measure); building all 16 truth-functions with the operation N; the general form `[p̄, ξ̄, N(ξ̄)]` part by part; the net of 6.341. |
| **Atlas** | Any remark by number, with what it comments on and what comments on it. Select a star, type a number, or step with the arrow keys (← → in book order, ↑ parent, ↓ first comment). From there you can jump to the remark's place on the route. |

Every remark has an address: `#r2-0121` opens the page at remark 2.0121.

## The text and how it was checked

- **Edition.** *Tractatus Logico-Philosophicus*, Kegan Paul, London 1922, translated by
  F. P. Ramsey and edited by C. K. Ogden. Public domain.
- **Source.** The markup is generated from the Project Gutenberg transcription
  (eBook #5740) by `tools/build_text.py`.
- **Reference.** The wording follows the English edition of the
  [Ludwig Wittgenstein Project](https://www.wittgensteinproject.org/w/index.php/Tractatus_Logico-Philosophicus_(English)).
  That edition differs from the 1922 first printing in about 30 remarks, where it has the
  corrected readings of later printings (for example 2.03 "links of a chain" for "members
  of a chain", and 4.4611 "not nonsensical" for "not senseless"). These readings are
  applied by the `CORRECTIONS` table in `tools/build_text.py`, one entry per change.
- **Audit.** `tools/audit_text.py` compares this text with a saved copy of the reference
  page, remark by remark: the same 526 numbers in the same order, and the same words.
  Result: 522 remarks identical in wording; 4 remarks where the reference has an evident
  misprint and this edition keeps the 1922 reading:

  | Remark | Reference page | Here |
  | --- | --- | --- |
  | 3.323 | "a proper name as the last an adjective" | "and the last" |
  | 4.024 | "understands it constituent parts" | "its" |
  | 4.04 | "as many thing distinguishable" | "things" |
  | 5.234 | "truth-functions of elementary proposition," | "propositions," |

  Formulas are typeset differently in the two editions, so they are compared by eye, not
  by the script.
- **Diagrams.** All eight diagrams of the original are redrawn as SVG: 5.5423, 5.6331,
  6.36111 and the five bracket diagrams of 6.1203. The last of those is a tidied version
  of a hand-drawn figure; it keeps every connection but not the exact shapes.
- **On the page.** No remark is typed into the page. The page fills in every remark from
  `data/tlp.js` when it loads, and a check at build time rejects a note that points at a
  remark that does not exist.

## Design decisions

**The metaphor is the book's own.** Wittgenstein calls the totality of possibilities
*logical space* (1.13). So the dark field stands for logical space, and a lit point for
something that is the case. The same convention runs through the instruments: a lit
disc means "exists" or "true", a ring means "does not exist" or "false".

**Three voices, three typefaces.** Wittgenstein's text is set in a Garamond, as a 1922
book would be, with his number in the margin. The guide speaks in a plain technical
sans. Numbers and labels are monospaced. Interpretation (things scholars disagree about)
and translation notes are labelled as such and are never mixed into the explanation of
what the text says.

**The hierarchy is shown, not described.** Indentation follows the numbering; the size
of the type falls slightly with depth; the map draws the same tree in space; the depth
control lets a reader take the book one layer at a time.

**Plain language.** The guide's prose follows the spirit of ASD-STE100 Simplified
Technical English: short sentences, one idea per sentence, active voice, one word for
one concept. It does not follow the rulebook to the letter.

**Translation is treated as part of the difficulty.** This translation uses "senseless"
for two different things: mostly for what later translations call "nonsensical", and
sometimes for the milder "without sense" of tautologies. The argument depends on the
difference, so the guide says which is meant wherever it matters.

**The end is taken seriously.** At proposition 7 the interface, the map and the guide
all go quiet. The interpretive debate about the "ladder" (6.54) comes only afterwards,
clearly marked as not part of the book, with three readings side by side and no verdict.

## Files

```
index.html             the page (generated: do not edit by hand)
content/shell.html     the page without the notes: prologue, station headers, afterword
content/1.txt … 6.txt  the guide's notes for each book, keyed to remark numbers
styles.css             design tokens and layout
js/cosmos.js           the WebGL field (Three.js): layout of the tree, camera, picking
js/labs.js             the instruments and the redrawn diagrams
js/app.js              places remarks and notes, scroll logic, depth, glossary, Atlas
data/tlp.js            all 526 remarks (generated)
tools/build_text.py    regenerates data/tlp.js from the Gutenberg TeX source
tools/audit_text.py    compares data/tlp.js with the reference edition
tools/build_page.py    regenerates index.html from content/
tools/make_artifact.py writes index.html without its <html>/<head>/<body> wrapper
```

After a change to the notes, run `python3 tools/build_page.py`. The format of the notes
files is described at the top of that script.

## Limits

The explanations are one careful reading, not an authority. They were written without
checking each claim against the secondary literature. Where they simplify, the text
decides. The 519 sub-remarks have 387 blocks of commentary between them; a note often
covers the remark above it together with the few before it, so not every remark has a
note of its own.
