# Tractatus Expedition

A guided, interactive reading of Ludwig Wittgenstein's *Tractatus Logico-Philosophicus*
for a curious reader without training in philosophy or logic.

The complete 1922 text (C. K. Ogden's English and the German original) stays at the
centre. Around it are plain explanations, a glossary, eight small interactive models,
and a WebGL map in which each of the 526 remarks is one star.

## Run it

It is a static site. No build step.

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
| **The route** | Seven stations, one for each main proposition, plus a prologue and an afterword. Scroll to travel. |
| **The field** | The numbering of the book is a tree: 2.01 comments on 2, 2.012 on 2.01. The scene draws that tree. Each star is a remark, each line is "comments on". Lines appear as you read a station, so the structure becomes visible step by step. The remark you are reading is marked on the map. |
| **Instruments** | Logical space of three atomic facts; picture and reality; one sign, three symbols; a proposition as a selection of truth-table rows; what follows from what (with Wittgenstein's probability measure); building all 16 truth-functions with the operation N; the general form `[p̄, ξ̄, N(ξ̄)]` part by part; the net of 6.341. |
| **Atlas** | The whole book. Select any star, type a number, or step with the arrow keys (← → in book order, ↑ parent, ↓ first comment). |
| **Deutsch** | Shows the German original under every quotation. |

## Design decisions

**The metaphor is the book's own.** Wittgenstein calls the totality of possibilities
*logical space* (1.13). So the dark field stands for logical space, and a lit point for
something that is the case. The same convention runs through the instruments: a lit
disc means "exists" or "true", a ring means "does not exist" or "false".

**Three voices, three typefaces.** Wittgenstein's text is set in a Garamond, as a 1922
book would be. The guide speaks in a plain technical sans. Numbers and labels are
monospaced. A reader always knows who is speaking. Interpretation (things scholars
disagree about) and translation notes are labelled as such and never mixed into the
explanation of what the text says.

**Quotations cannot drift.** No remark is typed into the page. Every quotation is
filled in at load time from `data/tlp.js`, which is generated from the Project
Gutenberg edition. Excerpts are marked with `[…]`.

**Plain language.** The guide's prose follows the spirit of ASD-STE100 Simplified
Technical English: short sentences, one idea per sentence, active voice, one word for
one concept. It does not follow the rulebook to the letter.

**Translation is treated as part of the difficulty.** Ogden's wording differs from
later translations in ways that matter. The clearest case: he writes "senseless" for
*unsinnig* (nonsensical) and "without sense" for *sinnlos*, a distinction the argument
depends on. The guide points this out wherever it occurs.

**Progressive disclosure.** Each station has a main path and optional "Go deeper"
sections for the harder arguments (simple objects, formal concepts, generality,
identity, belief sentences, the colour-exclusion problem).

**The end is taken seriously.** At proposition 7 the interface, the map and the guide
all go quiet. The interpretive debate about the "ladder" (6.54) comes only afterwards,
clearly marked as not part of the book, with three readings side by side and no verdict.

## Files

```
index.html          the route: all explanatory text and structure
styles.css          design tokens and layout
js/cosmos.js        the WebGL field (Three.js): layout of the tree, camera, picking
js/labs.js          the instruments and the redrawn diagrams
js/app.js           quotations, scroll logic, glossary, Atlas
data/tlp.js         all 526 remarks in English and German (generated)
tools/build_text.py     regenerates data/tlp.js from the Gutenberg TeX source
tools/make_artifact.py  writes index.html without its <html>/<head>/<body> wrapper
```

To rebuild the text data (downloads the TeX source if no path is given):

```sh
python3 tools/build_text.py
```

## Sources and limits

- Text: *Tractatus Logico-Philosophicus*, Kegan Paul, London 1922. English translation
  credited to C. K. Ogden (largely by F. P. Ramsey); German text of 1921. Public domain.
  Transcription: Project Gutenberg eBook #5740.
- All eight diagrams of the original are redrawn as SVG: 5.5423, 5.6331, 6.36111 and
  the five bracket diagrams of 6.1203. The last of those is a tidied version of a
  hand-drawn figure; it keeps every connection but not the exact shapes.
- The explanations are one careful reading, not an authority. Where they simplify, the
  text decides.
