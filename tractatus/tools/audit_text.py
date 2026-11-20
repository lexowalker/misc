#!/usr/bin/env python3
"""Audit data/tlp.js against the Ludwig Wittgenstein Project's English edition.

Usage:
    python3 tools/audit_text.py PAGE.html

PAGE.html is a saved copy of
https://www.wittgensteinproject.org/w/index.php/Tractatus_Logico-Philosophicus_(English)

The script checks that both editions have the same remarks in the same order, and
compares the wording of every remark. Notation is typeset differently in the two
editions, so wording is compared on words only (letters, case-folded).
"""
import difflib
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


# Tokens that come only from the way formulas are encoded in one edition or the other.
NOTATION = set("math displaystyle bar xi eta nu mu kappa omega prime text binom sum vdash times "
               "tpf tqf trf def and".split())
# Places where the reference has an evident misprint and this edition keeps the 1922 reading.
REFERENCE_MISPRINTS = {
    "3.323": "“a proper name as the last an adjective” for “and the last”",
    "4.024": "“understands it constituent parts” for “its”",
    "4.04": "“as many thing distinguishable” for “things”",
    "5.234": "“truth-functions of elementary proposition,” for “propositions,”",
}


def words(markup):
    markup = re.sub(r"<sup[^>]*class=\"(reference|fnm)\".*?</sup>", " ", markup, flags=re.S)
    markup = re.sub(r"<(style|script|annotation)[^>]*>.*?</\1>", " ", markup, flags=re.S)
    markup = re.sub(r'<img[^>]*alt="([^"]*)"[^>]*>', r" \1 ", markup)
    text = html.unescape(re.sub(r"<[^>]+>", " ", markup))
    text = text.replace("æ", "ae").replace("’", "'")
    return [w for w in re.findall(r"[a-z]{2,}", text.lower()) if w not in NOTATION]


def reference(path):
    page = Path(path).read_text(encoding="utf-8")
    marks = list(re.finditer(r'<span class="tlp-aside-par" id="([0-9.]+)">.*?</span></b>', page, re.S))
    end = page.index("</div>", page.rindex('class="tlp-aside-par"'))
    stop = re.search(r'<(h2|div class="mw-references-wrap|ol class="references)', page[marks[-1].end():])
    last = marks[-1].end() + stop.start() if stop else end
    out = []
    for k, m in enumerate(marks):
        z = marks[k + 1].start() if k + 1 < len(marks) else last
        out.append((m.group(1), page[m.end():z]))
    return out


def main():
    ref = reference(sys.argv[1])
    src = (ROOT / "data" / "tlp.js").read_text(encoding="utf-8")
    ours = json.loads(src[src.index("window.TLP = ") + 13:].rstrip().rstrip(";"))
    a, b = [n for n, _ in ref], [p["n"] for p in ours]
    print(f"reference: {len(a)} remarks   ours: {len(b)} remarks")
    print("same numbers in the same order:", a == b)
    if a != b:
        print("  only in reference:", sorted(set(a) - set(b)))
        print("  only in ours:", sorted(set(b) - set(a)))
    refmap = dict(ref)
    exact, close, diff, known = 0, [], [], []
    for p in ours:
        if p["n"] not in refmap:
            continue
        x, y = words(refmap[p["n"]]), words(p["en"])
        if x == y:
            exact += 1
            continue
        if p["n"] in REFERENCE_MISPRINTS:
            known.append(p["n"])
            continue
        r = difflib.SequenceMatcher(None, x, y).ratio()
        (close if r > 0.97 else diff).append((p["n"], r, x, y))
    print(f"wording identical: {exact}   reference misprints not followed: {len(known)}   other differences: {len(close) + len(diff)}")
    for n in known:
        print(f"  {n}  reference has {REFERENCE_MISPRINTS[n]}")
    for n, r, x, y in close + diff:
        sm = difflib.SequenceMatcher(None, x, y)
        ops = [(" ".join(x[i1:i2]), " ".join(y[j1:j2])) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != "equal"]
        print(f"  {n}  ({r:.3f})  " + "; ".join(f"ref[{u}] ours[{v}]" for u, v in ops[:6]))


if __name__ == "__main__":
    main()
