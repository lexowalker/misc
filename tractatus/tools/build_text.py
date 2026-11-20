#!/usr/bin/env python3
"""Build data/tlp.js from the Project Gutenberg TeX edition of the Tractatus.

Source: Project Gutenberg eBook #5740 (the 1922 English translation by F. P. Ramsey,
edited by C. K. Ogden), with the corrected readings of the Ludwig Wittgenstein
Project's edition applied (see CORRECTIONS). The text is in the public domain.

Usage:
    python3 tools/build_text.py [path/to/5740-t.tex]

Without an argument the script downloads the TeX file from the GITenberg
mirror. Output: data/tlp.js, which sets window.TLP.
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

SRC_URL = ("https://raw.githubusercontent.com/GITenberg/"
           "Tractatus-Logico-Philosophicus_5740/master/5740-t/5740-t.tex")
ROOT = Path(__file__).resolve().parent.parent

SYMBOLS = {
    "lor": " ∨ ", "Implies": " ⊃ ", "DotOp": " . ", "BarOp": " | ",
    "equiv": " ≡ ", "times": " × ", "exists": "∃", "vdash": "⊢",
    "xi": "<i>ξ</i>", "eta": "<i>η</i>", "phi": "<i>φ</i>", "psi": "<i>ψ</i>",
    "nu": "<i>ν</i>", "mu": "<i>μ</i>", "kappa": "<i>κ</i>", "Omega": "Ω",
    "aleph": "ℵ", "sharp": "♯", "flat": "♭", "sum": "∑", "limits": "",
    "fourdots": " . . . .", "fivedots": " . . . . .", "ldots": " . . .",
    "dots": " . . .", "cdots": " · · ·", "quad": " ", "Strut": "",
    "Wahr": "W", "False": "F",
}
TEXT_SYMBOLS = {
    "idEst": "<i>i.e.</i>", "IdEst": "<i>I.e.</i>",
    "exempliGratia": "<i>e.g.</i>", "ExempliGratia": "<i>E.g.</i>",
    "dasHeiszt": "d.\u202fh.", "zumBeispiel": "z.\u202fB.",
    "ZumBeispiel": "Z.\u202fB.", "undAndere": "u.\u202fa.",
    "UndSoWeiter": "U.\u202fs.\u202fw.", "undSoFort": "u.\u202fs.\u202ff.",
    "glqq": "„", "grqq": "“", "quotedblbase": "„", "glq": "‚", "grq": "‘",
    "DittoInWords": "<span class=\"ditto\">〃</span>",
    "DittoInWorten": "<span class=\"ditto\">〃</span>",
    "ldots": "…", "dots": "…", "Wahr": "W", "False": "F",
    "stretchyspace": "", "verystretchyspace": "", "AllowBreak": "",
    "Strut": "", "hline": "", "noindent": "", "centering": "",
    "footnotesize": "", "par": "",
}
DROP_WITH_ARG = {"enlargethispage", "hspace", "vspace", "phantom"}
KEEP_ARG = {"mbox", "text", "mathfrak", "smash"}


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class P:
    """A small recursive-descent converter for the TeX subset the book uses."""

    def __init__(self, s):
        self.s = s
        self.i = 0
        self.notes = []

    # --- low-level readers -------------------------------------------------
    def peek(self, n=1):
        return self.s[self.i:self.i + n]

    def skip_ws(self):
        while self.i < len(self.s) and self.s[self.i] in " \t\n":
            self.i += 1

    def group(self):
        """Read a balanced {...} group (or a single token) and return its raw text."""
        self.skip_ws()
        if self.peek() != "{":
            if self.peek() == "\\":
                m = re.match(r"\\([A-Za-z]+|.)", self.s[self.i:])
                self.i += m.end()
                return m.group(0)
            c = self.peek()
            self.i += 1
            return c
        depth, j = 0, self.i
        while j < len(self.s):
            c = self.s[j]
            if c == "\\":
                j += 2
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    raw = self.s[self.i + 1:j]
                    self.i = j + 1
                    return raw
            j += 1
        raise ValueError("unbalanced group near: " + self.s[self.i:self.i + 60])

    def optional(self):
        if self.peek() == "[":
            j = self.s.index("]", self.i)
            raw = self.s[self.i + 1:j]
            self.i = j + 1
            return raw
        return None

    def command(self):
        m = re.match(r"\\([A-Za-z]+\*?)", self.s[self.i:])
        if m:
            self.i += m.end()
            # TeX swallows spaces after a control word
            while self.peek() == " ":
                self.i += 1
            return m.group(1)
        c = self.s[self.i + 1]
        self.i += 2
        return c

    def until(self, marker):
        j = self.s.index(marker, self.i)
        raw = self.s[self.i:j]
        self.i = j + len(marker)
        return raw

    def sub(self, raw, mode):
        q = P(raw)
        out = q.math() if mode == "math" else q.text()
        self.notes += q.notes
        return out

    # --- math mode -----------------------------------------------------------
    def math(self, tight=False):
        out = []
        s = self.s
        while self.i < len(s):
            c = s[self.i]
            if c in " \t\n":
                self.i += 1
            elif c == "\\":
                if self.peek(2) == "\\\\":
                    self.i += 2
                    out.append("<br>")
                    continue
                cmd = self.command()
                if cmd == "Not":
                    out.append("∼" + self.sub(self.group(), "math"))
                elif cmd == "overline":
                    out.append('<span class="ol">' + self.sub(self.group(), "math") + "</span>")
                elif cmd in ("text", "mbox"):
                    raw = self.group()
                    inner = self.sub(raw, "text_inline")
                    inner = (" " if raw[:1] == " " else "") + inner + (" " if raw[-1:] == " " else "")
                    out.append('<span class="mt">' + inner + "</span>")
                elif cmd == "frac":
                    a, b = self.sub(self.group(), "math"), self.sub(self.group(), "math")
                    out.append(f'<span class="frac"><sup>{a}</sup>⁄<sub>{b}</sub></span>')
                elif cmd == "binom":
                    a, b = self.sub(self.group(), "math"), self.sub(self.group(), "math")
                    out.append(f'<span class="binom"><span>{a}</span><span>{b}</span></span>')
                elif cmd in ("begin", "end"):
                    env = self.group()
                    if cmd == "begin" and env == "array":
                        self.group()
                elif cmd == "DPtypo":
                    self.group()
                    out.append(self.sub(self.group(), "math"))
                elif cmd in KEEP_ARG:
                    out.append(self.sub(self.group(), "math"))
                elif cmd in SYMBOLS:
                    out.append(SYMBOLS[cmd])
                elif cmd in (" ", ";", ",", "!"):
                    out.append(" " if cmd != "!" else "")
                else:
                    raise ValueError("math command: " + cmd)
            elif c in "^_":
                self.i += 1
                tag = "sup" if c == "^" else "sub"
                q = P(self.group())
                out.append(f"<{tag}>{q.math(tight=True)}</{tag}>")
            elif c == "{":
                out.append(self.sub(self.group(), "math"))
            elif c == "`" and self.peek(2) == "``":
                self.i += 2
                out.append("“")
            elif c == "'" and self.peek(2) == "''":
                self.i += 2
                out.append("”")
            elif c == "'":
                self.i += 1
                out.append("′")
            elif c == "~":
                self.i += 1
                out.append("\u00a0")
            elif c.isalpha():
                j = self.i
                while j < len(s) and s[j].isalpha():
                    j += 1
                out.append("<i>" + s[self.i:j] + "</i>")
                self.i = j
            elif c in "=+:":
                self.i += 1
                out.append(c if tight else f" {c} ")
            elif c == ",":
                self.i += 1
                out.append(", ")
            else:
                self.i += 1
                out.append(esc(c))
        res = "".join(out)
        if tight:
            res = res.replace(" ", "")
        res = re.sub(r" {2,}", " ", res).strip()
        return re.sub(r"^(<br>)+", "", res)

    # --- text mode -------------------------------------------------------------
    def table(self):
        self.optional()
        self.group()  # column spec
        raw = self.until("\\end{tabular}")
        rows = []
        for line in re.split(r"\\\\", raw):
            line = line.replace("\\hline", "").replace("\\Strut", "").strip()
            if not line:
                continue
            cells = [self.sub(c.strip(), "text_inline") for c in line.split("&")]
            rows.append(cells)
        width = max(len(r) for r in rows)
        html = ['<table class="tt">']
        for k, r in enumerate(rows):
            r = r + [""] * (width - len(r))
            tag = "th" if (k == 0 and width <= 3 and len(rows) < 10) else "td"
            html.append("<tr>" + "".join(f"<{tag}>{c}</{tag}>" for c in r) + "</tr>")
        html.append("</table>")
        return "".join(html)

    def text(self, inline=False):
        out = []
        s = self.s
        BR = "\x00"
        while self.i < len(s):
            c = s[self.i]
            if c == "\n":
                m = re.match(r"\n[ \t]*\n\s*", s[self.i:])
                if m and not inline:
                    out.append(BR)
                    self.i += m.end()
                else:
                    out.append(" ")
                    self.i += 1
            elif c == "$":
                self.i += 1
                out.append('<span class="m">' + self.sub(self.until("$"), "math") + "</span>")
            elif c == "\\":
                two = self.peek(2)
                if two == "\\[":
                    self.i += 2
                    out.append(BR + '<div class="md">' + self.sub(self.until("\\]"), "math") + "</div>" + BR)
                    continue
                if two == "\\\\":
                    self.i += 2
                    out.append(" ")
                    continue
                cmd = self.command()
                if cmd in ("emph", "Emph", "EmphPart", "textit", "BookTitle"):
                    out.append("<em>" + self.sub(self.group(), "text_inline") + "</em>")
                elif cmd == "textsc":
                    out.append(self.sub(self.group(), "text_inline"))
                elif cmd == "DPtypo":
                    self.group()
                    out.append(self.sub(self.group(), "text_inline"))
                elif cmd == "footnote":
                    self.notes.append(self.sub(self.group(), "text_inline"))
                    out.append('<sup class="fnm">*</sup>')
                elif cmd in ("PropERef", "PropGRef"):
                    n = self.group()
                    out.append(f'<a class="ref" data-n="{n}">{n}</a>')
                elif cmd == "Illustration":
                    self.optional()
                    name = self.group().replace("-en", "").replace("-de", "")
                    out.append(BR + f'<figure class="fig" data-fig="{name}"></figure>' + BR)
                elif cmd == "raisebox":
                    self.group()
                    out.append(self.sub(self.group(), "text_inline"))
                elif cmd == "smash":
                    self.optional()
                    out.append(self.sub(self.group(), "text_inline"))
                elif cmd in DROP_WITH_ARG:
                    self.group()
                elif cmd == "discretionary":
                    self.group()
                    self.group()
                    out.append(self.sub(self.group(), "text_inline"))
                elif cmd in KEEP_ARG:
                    out.append(self.sub(self.group(), "text_inline"))
                elif cmd == "begin":
                    env = self.group()
                    if env == "tabular":
                        out.append(BR + self.table() + BR)
                    elif env in ("gather*",):
                        raw = self.until("\\end{gather*}")
                        out.append(BR + '<div class="md">' + self.sub(raw, "math") + "</div>" + BR)
                    elif env == "table*":
                        self.optional()
                    elif env in ("center",):
                        pass
                    else:
                        raise ValueError("environment: " + env)
                elif cmd == "end":
                    self.group()
                elif cmd in TEXT_SYMBOLS:
                    out.append(TEXT_SYMBOLS[cmd])
                    if self.peek(2) == "{}":
                        self.i += 2
                elif cmd in (" ", ";", ",", "\n"):
                    out.append("\u202f" if cmd in ";," else " ")
                elif cmd == "-":
                    pass
                elif cmd in ("%", "&", "#", "_"):
                    out.append(esc(cmd))
                else:
                    raise ValueError("text command: " + repr(cmd) + repr(self.s[max(0,self.i-80):self.i+20]))
            elif c == "{":
                out.append(self.sub(self.group(), "text_inline"))
            elif c == "}":
                self.i += 1  # stray closer from a split proposition body
            elif c == "~":
                self.i += 1
                out.append("\u00a0")
            elif c == "`":
                n = 2 if self.peek(2) == "``" else 1
                self.i += n
                out.append("“" if n == 2 else "‘")
            elif c == "'":
                n = 2 if self.peek(2) == "''" else 1
                self.i += n
                out.append("”" if n == 2 else "’")
            elif c == "-":
                m = re.match(r"-+", s[self.i:])
                n = m.end()
                self.i += n
                out.append({1: "-", 2: "–", 3: "—"}.get(n, "—"))
            else:
                self.i += 1
                out.append(esc(c))
        res = "".join(out)
        res = re.sub(r"[ \t]+", " ", res)
        if inline:
            return res.replace(BR, " ").strip()
        blocks = [b.strip() for b in res.split(BR) if b.strip()]
        # Tables that belong to one figure (4.31) sit side by side.
        merged = []
        for b in blocks:
            if b.startswith("<table") and merged and merged[-1].startswith('<div class="tts">'):
                merged[-1] = merged[-1][:-6] + b + "</div>"
            elif b.startswith("<table"):
                merged.append('<div class="tts">' + b + "</div>")
            else:
                merged.append(b)
        html = []
        for b in merged:
            b = re.sub(r"^([”“])(is a|ist ein)", r"\1 \2", b)
            if b.startswith(("<div", "<figure")):
                html.append(b)
            else:
                html.append("<p>" + b + "</p>")
        return "".join(html)


# P.sub dispatches on these names
def _dispatch(self, raw, mode):
    q = P(raw)
    if mode == "math":
        out = q.math()
    elif mode == "text_inline":
        out = q.text(inline=True)
    else:
        out = q.text()
    self.notes += q.notes
    return out


P.sub = _dispatch


# Readings of the Ludwig Wittgenstein Project's English edition where it differs from
# the 1922 first printing that Project Gutenberg transcribed. They are corrections made
# in later printings of the same translation. tools/audit_text.py checks the result.
CORRECTIONS = [
    ("2.0131", "is a place for an argument.)", "is an argument place.)"),
    ("2.03", "like the members of a chain", "like the links of a chain"),
    ("3.05", "We could only know", "Only if we could know"),
    ("3.313", "the variables become constants,", "the variable becomes constant,"),
    ("3.331", "he has to speak of the meaning of the signs.", "he has to speak about the things his signs mean."),
    ("4.023", "<p>It must therefore be", "<p>Reality must therefore be"),
    ("4.122", "which present the atomic facts and", "which present the facts and"),
    ("4.1241", "this property but the other that", "this property, the other that"),
    ("4.1251", "Here the disputed question", "Now this settles the disputed question"),
    ("4.1251", "external” disappears.", "external”."),
    ("4.1252", "<i>aRx</i> . <i>aRy</i> . <i>yRb</i>", "<i>aRx</i> . <i>xRy</i> . <i>yRb</i>"),
    ("4.126", "But it shows itself in the sign of this object itself.", "But it is shown in the symbol for the object itself."),
    ("4.4611", "not senseless;", "not nonsensical;"),
    ("5.152", "Independent propositions (<i>e.g.</i> any two elementary propositions) give", "Two elementary propositions give"),
    ("5.4541", "must be simple for", "must be neat for"),
    ("5.4541", "the standard of simplicity.", "the standard of neatness."),
    ("5.513", "Thus even in Russell’s notation it is evident", "Thus in Russell’s notation also it appears evident"),
    ("5.5351", "” and of that kind. And indeed this takes place when one would like to speak", "”. As, for instance, when one would speak"),
    ("5.551", "decided without further trouble.", "decided off-hand."),
    ("5.5541", "It should be possible to decide", "How could we decide"),
    ("5.5541", "27-termed relation.", "27-termed relation?"),
    ("5.5542", "what must <em>be</em> in order that something can", "what must there <em>be</em> in order that anything can"),
    ("5.5562", "who understands the propositions", "who understands propositions"),
    ("5.5563", "That most simple thing", "That simple thing"),
    ("5.5563", "not a simile of truth", "not a model of the truth"),
    ("5.557", "What lies in the application", "What lies in its application"),
    ("5.557", "may not collide with", "may not conflict with"),
    ("5.62", "which only I understand", "which I understand"),
    ("6.1222", "be empirically established than", "be empirically confirmed than"),
    ("6.1222", "being established by", "being confirmed by"),
    ("6.124", "much is arbitrary, much not.", "something is arbitrary, something not."),
    ("6.125", "even in the old logic,", "also with the old conception of logic,"),
    ("6.126", "can be determined by determining", "can be calculated by calculating"),
    ("6.342", "in which it is described, as is indeed the case.", "in which as a matter of fact it is described."),
    ("6.3431", "Through the whole apparatus of logic the", "Through their whole logical apparatus the"),
    ("6.35", "the network described.", "the network describes."),
    ("6.372", "one clear conclusion, whereas in the modern system it should appear", "one clear terminus, whereas the modern system makes it appear"),
    ("6.421", "Ethics are transcendental.", "Ethics is transcendental."),
    ("6.421", "æsthetics", "aesthetics"),
    ("6.423", "as the bearer of the ethical", "as the subject of the ethical"),
    ("6.4312", "of the soul of man,", "of the human soul,"),
    ("6.4312", "eternal survival also after death", "eternal survival after death"),
]


def strip_comments(tex):
    tex = re.sub(r"(?m)^[ \t]*%.*\n", "", tex)
    return re.sub(r"(?<!\\)%.*", "", tex)


def propositions(tex, macro):
    marks = list(re.finditer(r"\\" + macro + r"\{([0-9.]+)\}", tex))
    out = []
    for k, m in enumerate(marks):
        end = marks[k + 1].start() if k + 1 < len(marks) else tex.index("\\end{propositions}", m.end())
        raw = tex[m.end():end].strip()
        # The body is one {...} group; a few bodies continue after the group closes.
        p = P(raw)
        inner = p.group()
        rest = raw[p.i:]
        q = P(inner + "\n\n" + rest)
        html = q.text()
        out.append((m.group(1), html, q.notes))
    return out


def parent_of(n, known):
    if "." not in n:
        return None
    cand = n[:-1]
    while cand:
        if cand.endswith("."):
            cand = cand[:-1]
            continue
        if cand in known:
            return cand
        cand = cand[:-1]
    return None


def main():
    if len(sys.argv) > 1:
        data = Path(sys.argv[1]).read_bytes()
    else:
        data = urllib.request.urlopen(SRC_URL).read()
    tex = strip_comments(data.decode("latin-1").replace("\r\n", "\n"))
    en = propositions(tex, "PropositionE")
    known = {n for n, *_ in en}
    props = []
    for n, e, en_notes in en:
        item = {"n": n, "p": parent_of(n, known), "en": e}
        if en_notes:
            item["enNote"] = en_notes
        props.append(item)
    by_n = {item["n"]: item for item in props}
    for n, old, new in CORRECTIONS:
        assert old in by_n[n]["en"], (n, old)
        by_n[n]["en"] = by_n[n]["en"].replace(old, new)
    for item in props:
        assert "\\" not in item["en"], (item["n"], item["en"])
    out = ROOT / "data" / "tlp.js"
    out.parent.mkdir(exist_ok=True)
    body = json.dumps(props, ensure_ascii=False, separators=(",", ":"))
    body = body.replace("},{", "},\n{")
    out.write_text(
        "/* Tractatus Logico-Philosophicus. English translation by F. P. Ramsey, edited by C. K. Ogden.\n"
        "   Generated by tools/build_text.py from Project Gutenberg eBook #5740, with the corrected\n"
        "   readings of the Ludwig Wittgenstein Project edition. Public domain. */\n"
        "window.TLP = " + body + ";\n", encoding="utf-8")
    print(f"{len(props)} propositions -> {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
