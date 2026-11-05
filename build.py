#!/usr/bin/env python3
"""Inline src/ into one HTML file: a standalone document (for the Studio) and an
artifact fragment (no doctype/html/head/body; the host adds the skeleton)."""
import pathlib, re, sys, hashlib, shutil

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
THREE = '<script src="/vendor/three/build/three.min.js"></script>'


def scale_css(head: str) -> str:
    """Rewrites every px length in the stylesheet as calc(N * var(--u)), except
    hairlines (1px), zeros, and media-query conditions, so the whole interface
    scales with one custom property set by the page for large screens."""
    a, b = head.index("<style>"), head.index("</style>")
    css = head[a:b]
    out = []
    for line in css.split("\n"):
        if "@media" in line or "--u:" in line:
            out.append(line)
            continue
        def sub(m):
            sign, num = m.group(1), m.group(2)
            v = float(num)
            if v == 0 or (v == 1 and not sign):
                return m.group(0)
            return f"calc({'-' if sign else ''}{num} * var(--u))"
        out.append(re.sub(r"(?<![\w.])(-?)(\d+(?:\.\d+)?)px\b", sub, line))
    return head[:a] + "\n".join(out) + head[b:]


def build(name: str, public: bool = False):
    head = scale_css((SRC / "head.html").read_text())
    body = (SRC / "body.html").read_text()
    js = "\n".join(p.read_text() for p in sorted((SRC / "js").glob("*.js")))
    build_id = hashlib.sha256((head + body + js).encode()).hexdigest()[:20]
    artifact_three = "<script>" + (SRC / "vendor/three/build/three.min.js").read_text() + "</script>"
    fragment = f"<script>window.BCO_ARTIFACT=true;window.BCO_BUILD='{build_id}';</script>{head}\n{body}\n{artifact_three}\n<script>\n{js}\n</script>\n"
    public_marker = "window.BCO_PUBLIC_DEMO=true;" if public else ""
    standalone = (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        f'<script>window.BCO_BUILD="{build_id}";{public_marker}</script>\n{head}\n</head>\n<body>\n{body}\n{THREE}\n<script>\n{js}\n</script>\n</body>\n</html>\n'
    )
    out = ROOT / "dist"
    out.mkdir(exist_ok=True)
    (out / f"{name}.html").write_text(standalone)
    (out / f"{name}.artifact.html").write_text(fragment)
    if public:
        target = out / "public"
        if target.exists(): shutil.rmtree(target)
        target.mkdir()
        (target / "index.html").write_text(standalone)
        (target / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
        shutil.copytree(SRC / "vendor", target / "vendor")
    print(f"built dist/{name}.html ({len(standalone)//1024} KB)")


if __name__ == "__main__":
    public = "--public" in sys.argv
    args = [v for v in sys.argv[1:] if v != "--public"]
    build(args[0] if args else "office", public=public)
