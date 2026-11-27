#!/usr/bin/env python3
"""Build Twelve Strangers into one self-contained page.

  python3 build.py                 -> index.html (the published page) and dev/preview.html (same page in a local skeleton)
  python3 build.py --harness NAME  -> dev/harness-NAME.html: one widget alone, for testing

index.html is written without <!doctype>/<html>/<head>/<body>: the Artifact host adds that skeleton when it publishes.
dev/*.html wrap the page in an equivalent skeleton so it renders the same way in a local browser.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
DEV = ROOT / "dev"

SKELETON = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}}body{{margin:0;font:14px system-ui,sans-serif}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head><body>
{page}
</body></html>
"""

HARNESS_BODY = """<main class="wrap">
<section class="chapter" id="ch-harness" data-tick="Harness" data-num="H" data-date="Test bench">
  <header class="ch-head col"><p class="ch-kicker"><span class="ch-num">H</span><span class="ch-date">Test bench</span></p>
  <h2 class="ch-title">{name}</h2></header>
  <figure class="exhibit col-wide">
    <span class="exhibit-sticker">Exhibit</span>
    <div class="exhibit-head"><h3 class="exhibit-title">Widget: {name}</h3><p class="exhibit-hint">Harness page for one widget.</p></div>
    <div class="exhibit-body" data-widget="{name}"></div>
  </figure>
</section>
</main>"""


def read(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


def assemble(body: str, only: str | None = None) -> str:
    css_parts = [read(SRC / "base.css")]
    js_parts = [read(SRC / "core.js")]
    for css in sorted((SRC / "widgets").glob("*.css")):
        if only is None or css.stem == only:
            css_parts.append(f"/* ===== widget: {css.stem} ===== */\n" + read(css))
    for js in sorted((SRC / "widgets").glob("*.js")):
        if only is None or js.stem == only:
            js_parts.append(f"/* ===== widget: {js.stem} ===== */\n" + read(js))
    js_parts.append("TS.init();")
    css = "\n".join(css_parts)
    js = "\n".join(js_parts)
    if "</script" in js.lower() or "</style" in css.lower():
        raise SystemExit("A source file contains a closing </script> or </style> tag; escape it.")
    return f"{read(SRC / 'head.html').strip()}\n<style>\n{css}\n</style>\n{body.strip()}\n<script>\n{js}\n</script>\n"


def main() -> None:
    DEV.mkdir(exist_ok=True)
    if len(sys.argv) >= 3 and sys.argv[1] == "--harness":
        name = sys.argv[2]
        page = assemble(HARNESS_BODY.format(name=name), only=name)
        out = DEV / f"harness-{name}.html"
        out.write_text(SKELETON.format(page=page), encoding="utf-8")
        print(f"wrote {out.relative_to(ROOT)}")
        return
    page = assemble(read(SRC / "body.html"))
    (ROOT / "index.html").write_text(page, encoding="utf-8")
    (DEV / "preview.html").write_text(SKELETON.format(page=page), encoding="utf-8")
    print(f"wrote index.html ({len(page.encode('utf-8')) // 1024} KB) and dev/preview.html")


if __name__ == "__main__":
    main()
