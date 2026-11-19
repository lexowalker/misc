#!/usr/bin/env python3
"""Write a copy of index.html without the document wrapper.

Some hosts (for example Claude artifacts) add their own <html>, <head> and <body>.
This script keeps everything else, so the same page can be published there next to
styles.css, js/ and data/.

Usage: python3 tools/make_artifact.py OUTPUT.html
"""
import re
import sys
from pathlib import Path

src = (Path(__file__).resolve().parent.parent / "index.html").read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", src, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", src, re.S).group(1)
head = re.sub(r'\s*<meta charset="utf-8">|\s*<meta name="viewport"[^>]*>', "", head)
Path(sys.argv[1]).write_text(head.strip() + "\n" + body.strip() + "\n", encoding="utf-8")
print("wrote", sys.argv[1])
