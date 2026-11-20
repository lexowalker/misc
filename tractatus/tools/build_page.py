#!/usr/bin/env python3
"""Build index.html from content/shell.html and the guide's notes in content/1.txt … 6.txt.

The notes files hold only the guide's commentary. The text of the book is never typed
there: the page takes every remark from data/tlp.js when it loads.

Format of a notes file. A block starts with a line that begins with "@":

    @ 2.01              a note placed after remark 2.01
    @< 2.01             a note placed before remark 2.01
    @r 2.0212           an interpretation (things scholars disagree about)
    @tn 2.01            a note on the translation
    @h 2.1 Pictures     a section heading, placed before remark 2.1
    @lab 2.141 picture  an instrument (see js/labs.js)
    @deep 2.0212 Title  a longer explanation that the reader can open;
                        a paragraph that starts with "r: " is marked as interpretation
    @html 4.4611        raw HTML

"r", "tn" and "html" also take "<" for "before". Paragraphs are separated by blank lines.
Inline: [[term-key|words]] is a glossary term, {4.0312} a link to a remark,
$p$ a variable, *words* emphasis.

Usage: python3 tools/build_page.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "data" / "tlp.js").read_text(encoding="utf-8")
REMARKS = [p["n"] for p in json.loads(src[src.index("window.TLP = ") + 13:].rstrip().rstrip(";"))]
KNOWN = set(REMARKS)


def inline(text):
    text = re.sub(r"\[\[([a-z-]+)\|([^\]]+)\]\]", r'<span class="t" data-t="\1">\2</span>', text)

    def ref(m):
        assert m.group(1) in KNOWN, "link to unknown remark " + m.group(1)
        return f'<a class="ref" data-n="{m.group(1)}">{m.group(1)}</a>'
    text = re.sub(r"\{([0-9.]+)\}", ref, text)
    text = re.sub(r"\$([^$]+)\$", r'<i class="v">\1</i>', text)
    text = re.sub(r"\*([^*\n]+)\*", r"<em>\1</em>", text)
    return text


def paragraphs(body, allow_reading=False):
    out = []
    for para in re.split(r"\n\s*\n", body.strip()):
        para = " ".join(line.strip() for line in para.strip().splitlines())
        if not para:
            continue
        if allow_reading and para.startswith("r: "):
            out.append('<aside class="r"><p>' + inline(para[3:]) + "</p></aside>")
        else:
            out.append("<p>" + inline(para) + "</p>")
    return "".join(out)


def book(k):
    text = (ROOT / "content" / f"{k}.txt").read_text(encoding="utf-8")
    html, anchored = [], set()
    for chunk in re.split(r"(?m)^@", text)[1:]:
        head, _, body = chunk.partition("\n")
        m = re.match(r"(r|tn|h|lab|deep|html)?(<)?\s+([0-9.]+)\s*(.*)$", head)
        assert m, f"book {k}: cannot read the line @{head}"
        kind, before, n, arg = m.group(1) or "note", m.group(2), m.group(3), m.group(4).strip()
        assert n in KNOWN and n[0] == str(k), f"book {k}: no remark {n}"
        anchored.add(n)
        at = f'data-b="{n}"' if before or kind == "h" else f'data-a="{n}"'
        if kind == "h":
            html.append(f"<h3 {at}>{inline(arg)}</h3>")
        elif kind == "lab":
            html.append(f'<div class="lab" data-lab="{arg}" {at}></div>')
        elif kind == "deep":
            html.append(f'<details class="deeper" {at}><summary>{inline(arg)}</summary>{paragraphs(body, True)}</details>')
        elif kind == "html":
            html.append(f'<div class="note" {at}>{inline(body.strip())}</div>')
        elif kind in ("r", "tn"):
            html.append(f'<aside class="{kind}" {at}>{paragraphs(body)}</aside>')
        else:
            html.append(f'<div class="note" {at}>{paragraphs(body)}</div>')
    mine = [n for n in REMARKS if n[0] == str(k)]
    print(f"book {k}: {len(mine)} remarks, {len(html)} blocks of commentary at {len(anchored)} remarks")
    return "\n    ".join(html)


def main():
    shell = (ROOT / "content" / "shell.html").read_text(encoding="utf-8")
    for k in range(1, 7):
        marker = f"<!--BOOK:{k}-->"
        assert marker in shell, marker
        shell = shell.replace(marker, book(k))
    for n in re.findall(r'class="ref" data-n="([0-9.]+)"', shell):
        assert n in KNOWN, "link to unknown remark " + n
    (ROOT / "index.html").write_text(shell, encoding="utf-8")
    print("wrote index.html")


if __name__ == "__main__":
    sys.exit(main())
