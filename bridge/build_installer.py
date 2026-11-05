#!/usr/bin/env python3
"""Builds the one-file Studio installer: installer_head.sh + a base64 tar.gz of bridge.py and office.html.

usage: build_installer.py <office.html> <out.command> [--label LABEL]
"""
import base64
import hashlib
import io
import re
import sys
import tarfile
import runpy
from pathlib import Path

HERE = Path(__file__).resolve().parent
# Out-of-fleet namespace, like com.igorbeyder.matrix-keepalive: the monitor matches "beyderco" in labels and
# plist filenames, so this agent never enters the 18-job fleet census.
DEFAULT_LABEL = "com.igorbeyder.agent-office"


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    office = Path(argv[0])
    out = Path(argv[1])
    label = DEFAULT_LABEL
    if "--label" in argv:
        label = argv[argv.index("--label") + 1]
    if not re.fullmatch(r"[A-Za-z0-9.\-]+", label) or "beyderco" in label.lower():
        raise ValueError("invalid office label; fleet namespace forbidden")
    bridge = (HERE / "bridge.py").read_bytes()
    page = office.read_bytes()
    src = HERE.parent / "src"
    scale = runpy.run_path(str(HERE.parent / "build.py"))["scale_css"]
    current = hashlib.sha256((scale((src / "head.html").read_text()) + (src / "body.html").read_text() + "\n".join(p.read_text() for p in sorted((src / "js").glob("*.js")))).encode()).hexdigest()[:20]
    marker = re.search(rb'window.BCO_BUILD="([a-f0-9]+)"',page)
    if not page.startswith(b"<!doctype html>") or b"window.BCO_ARTIFACT=true" in page or not marker or marker.group(1).decode() != current:
        raise ValueError("Build the current Studio page before packaging; TEST artifacts are forbidden")
    version = re.search(rb'VERSION = "([^"]+)"', bridge).group(1).decode()
    page_version = re.search(rb'PAGE_VERSION = "([^\"]+)"', bridge).group(1).decode()
    files = {"bridge.py": bridge, "office.html": page}
    for asset in sorted((HERE.parent / "src/vendor").rglob("*")):
        if asset.is_symlink():
            raise ValueError("Symlinked vendor assets are not permitted in the installer")
        if asset.is_file(): files[str(asset.relative_to(HERE.parent / "src"))] = asset.read_bytes()
    manifest = "".join(hashlib.sha256(data).hexdigest() + "  " + name + "\n" for name,data in sorted(files.items()))
    sha = hashlib.sha256(manifest.encode()).hexdigest()
    files["MANIFEST.sha256"] = manifest.encode()
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz", compresslevel=9) as tar:
        for name, data in sorted(files.items()):
            info = tarfile.TarInfo(name)
            info.size = len(data)
            info.mode = 0o644
            info.mtime = 0
            tar.addfile(info, io.BytesIO(data))
    b64 = base64.b64encode(buf.getvalue()).decode()
    lines = "\n".join(b64[i:i + 76] for i in range(0, len(b64), 76))
    head = (HERE / "installer_head.sh").read_text()
    head = head.replace("__LABEL__", label).replace("__VERSION__", version).replace("__PAYLOAD_SHA__", sha).replace("__BUILD_ID__", current).replace("__PAGE_VERSION__", page_version)
    if not head.rstrip().endswith("__PAYLOAD_BELOW__"):
        raise ValueError("Installer template payload marker is missing")
    out.write_text(head.rstrip() + "\n" + lines + "\n")
    out.chmod(0o755)
    print(f"{out}  ({out.stat().st_size // 1024} KB, label {label}, bridge {version}, sha {sha[:12]})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
