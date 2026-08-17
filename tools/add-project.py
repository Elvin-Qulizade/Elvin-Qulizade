#!/usr/bin/env python3
"""
add-project — drop in an image, get back the artwork and the PROJECTS entry.

    python tools/add-project.py <image> [<image> ...] [options]

For every file it:
  1. decides whether the image is a SCREENSHOT or a LOGO (override with --as),
  2. writes the WebP derivatives the site expects — always a 640 and a 1280 wide
     version (never upscaled past the source),
  3. picks the tile `tone` and the `brand` colour by measuring the artwork,
  4. prints the ready-to-paste PROJECTS entry (and inserts it into main.js with --insert).

Input may be .png .jpg .jpeg .webp .bmp .tif — or .svg, which is copied through as-is
(vectors stay vector; only the tone/brand are measured from the file's colours).

Options
  --as logo|shot     force the kind instead of auto-detecting
  --key <slug>       asset filename stem (default: slugified filename)
  --title "..."      card heading (default: title-cased filename)
  --type "..."       category shown in the tile corner, e.g. Fintech, Commerce
  --desc "..."       one sentence, ideally under ~90 characters
  --tech A,B,C       technologies (also feed the filter chips)
  --demo <url>       public URL; omit and the card carries no "Live" link
  --tone light|dark|auto|none   override the measured tone
  --brand "#RRGGBB"  override the measured brand colour
  --insert           append the entry to the PROJECTS array in main.js
  --dry              measure and print, write nothing

Examples
  python tools/add-project.py ~/Downloads/acme-logo.svg --type Commerce --demo https://acme.az
  python tools/add-project.py shots/*.png --as shot --tech Laravel,MySQL --insert
"""

import argparse
import colorsys
import os
import re
import shutil
import sys
from collections import Counter

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  python -m pip install pillow")

# Windows consoles default to cp1252 and would choke on the box drawing / arrows below.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "assets", "img")
LOGO_DIR = os.path.join(ROOT, "assets", "logos")
MAIN_JS = os.path.join(ROOT, "main.js")

SHOT_RATIO = 16 / 10
WIDTHS = (640, 1280)
MAX_KB = {640: 45, 1280: 120}

# ── helpers ──────────────────────────────────────────────────────────────────

def slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", os.path.splitext(os.path.basename(name))[0].lower())
    return re.sub(r"(^-|-$)", "", re.sub(r"-(logo|icon|mark|screenshot|shot)$", "", s))

def titleize(s):
    return " ".join(w if w.isupper() else w.capitalize() for w in s.replace("-", " ").split())

def rel(path):
    return os.path.relpath(path, ROOT).replace("\\", "/")

def lum(r, g, b):
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

def sat(r, g, b):
    return colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[1]

# ── artwork measurement ──────────────────────────────────────────────────────

def measure_pixels(px_iter):
    """px_iter yields (r,g,b) of 'ink'. Returns tone/brand decision inputs."""
    px = list(px_iter)
    if not px:
        return None
    dark = sum(1 for p in px if lum(*p) < 0.28) / len(px)
    light = sum(1 for p in px if lum(*p) > 0.82) / len(px)
    mean_l = sum(lum(*p) for p in px) / len(px)
    mean_s = sum(sat(*p) for p in px) / len(px)
    # brand = most common strongly saturated colour, else the most common non-neutral one
    buckets = Counter((r // 24 * 24 + 12, g // 24 * 24 + 12, b // 24 * 24 + 12)
                      for r, g, b in px if sat(r, g, b) > 0.35 and 0.12 < lum(r, g, b) < 0.92)
    if not buckets:
        buckets = Counter((r // 24 * 24 + 12, g // 24 * 24 + 12, b // 24 * 24 + 12)
                          for r, g, b in px if 0.1 < lum(r, g, b) < 0.9)
    brand = "#%02X%02X%02X" % buckets.most_common(1)[0][0] if buckets else "#6E737E"
    return {"dark": dark, "light": light, "mean_l": mean_l, "mean_s": mean_s, "brand": brand}

def decide_tone(m):
    """Which tile ground keeps this mark readable in BOTH themes?"""
    if m is None:
        return None, "no measurable ink"
    if m["light"] > 0.12:
        return "dark", f"{m['light']:.0%} of the mark is near-white — it would vanish on paper"
    if m["dark"] > 0.30:
        return "light", f"{m['dark']:.0%} of the mark is dark ink — it would vanish on graphite"
    return None, f"mid-tone and colourful (L≈{m['mean_l']:.2f}, S≈{m['mean_s']:.2f}) — reads on either ground"

def measure_raster(im):
    im = im.convert("RGBA")
    small = im.copy()
    small.thumbnail((280, 280))
    buf = small.tobytes()                                    # RGBA, 4 bytes per pixel
    ink = ((buf[i], buf[i + 1], buf[i + 2]) for i in range(0, len(buf), 4) if buf[i + 3] > 128)
    return measure_pixels(ink)

def measure_svg(path):
    txt = open(path, encoding="utf-8", errors="ignore").read()
    hexes = re.findall(r'#([0-9a-fA-F]{6})\b', txt)
    px = []
    for h in hexes:
        px.append((int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)))
    return measure_pixels(iter(px))


# ── SVG canvas trimming ──────────────────────────────────────────────────────
# An SVG exported with margins draws its mark inside a much larger viewBox, so the CSS
# (which sizes the *box*) makes the visible ink look small. We tighten the viewBox to the
# real bounding box, measured by a headless browser — the only thing that can lay out text
# and strokes correctly. If no browser is found we just report the risk and move on.

CHROME_CANDIDATES = [
    os.environ.get("CHROME"), os.environ.get("CHROME_PATH"),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome", "chromium", "chromium-browser",
]

def find_browser():
    for c in CHROME_CANDIDATES:
        if not c:
            continue
        if os.path.isabs(c) and os.path.exists(c):
            return c
        w = shutil.which(c)
        if w:
            return w
    return None

def svg_ink_box(svg_path, browser):
    """→ (x, y, w, h, coverage_percent) of the drawn content, or None."""
    import json, subprocess, tempfile
    svg = open(svg_path, encoding="utf-8", errors="ignore").read()
    html = ("<body style='margin:0'>" + svg +
            "<script>window.addEventListener('load',function(){"
            "var s=document.querySelector('svg'),v=s.viewBox.baseVal,b=s.getBBox();"
            "var d=document.createElement('i');d.id='bb';"
            "d.textContent=JSON.stringify([b.x,b.y,b.width,b.height,v.width,v.height]);"
            "document.body.appendChild(d);});</script></body>")
    tmp = tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8")
    tmp.write(html); tmp.close()
    try:
        out = subprocess.run(
            [browser, "--headless=new", "--disable-gpu", "--no-sandbox",
             "--virtual-time-budget=4000", "--dump-dom", "file:///" + tmp.name.replace(os.sep, "/")],
            capture_output=True, text=True, timeout=60).stdout
        m = re.search(r'<i id="bb">(\[[^<]+\])</i>', out)
        if not m:
            return None
        x, y, w, h, vw, vh = json.loads(m.group(1))
        if w <= 0 or h <= 0 or vw <= 0:
            return None
        return x, y, w, h, w * h / (vw * vh) * 100
    except Exception:
        return None
    finally:
        try: os.unlink(tmp.name)
        except OSError: pass

X_ATTRS = ("x", "cx", "x1", "x2", "width")
Y_ATTRS = ("y", "cy", "y1", "y2", "height")
UNSAFE_PCT = ("r", "rx", "ry", "stroke-width", "font-size")

def strip_root_percent_size(txt):
    """Drop width/height="…%" from the <svg> element itself — that is layout, not artwork, and a
    percentage there leaves the file with no intrinsic size for the card CSS to reason about."""
    m = re.search(r"<svg\b[^>]*?>", txt)
    if not m:
        return txt
    tag = re.sub(r'\s(?:width|height)="[\d.]+%"', "", m.group(0))
    return txt[:m.start()] + tag + txt[m.end():]

def absolutise_percents(txt, vb_w, vb_h):
    """
    Percentage geometry resolves against the viewport, so it silently moves when the viewBox
    changes — <text x="50%"> in a 500-wide box lands at 250, but at 82 once the box is 165 wide.
    Rewrite those to absolute user units first (only where the mapping is unambiguous).
    """
    if re.search(r'\b(' + "|".join(UNSAFE_PCT) + r')="\s*[\d.]+%"', txt):
        return None                                       # can't resolve these against one axis
    def sub(m):
        attr, val = m.group(1), float(m.group(2))
        base = vb_w if attr in X_ATTRS else vb_h
        return f'{attr}="{val / 100 * base:.2f}"'
    return re.sub(r'\b(' + "|".join(X_ATTRS + Y_ATTRS) + r')="\s*([\d.]+)%"', sub, txt)

def tighten_svg(path, dry):
    """Trim the viewBox to the ink and give the file an intrinsic size. Returns notes."""
    original = open(path, encoding="utf-8", errors="ignore").read()
    notes = []
    if "<text" in original:
        notes.append("contains <text>: web fonts do NOT load inside <img>, so it falls back to a "
                     "system face — convert the text to outlines for identical rendering everywhere")
    br = find_browser()
    if not br:
        notes.append("no Chrome/Edge found, so the canvas could not be trimmed — export the SVG "
                     "tight to the artwork (Illustrator: 'Use Artboards' off / Figma: crop the frame)")
        return notes
    box = svg_ink_box(path, br)
    if not box:
        notes.append("could not measure the artwork box; leaving the viewBox as it is")
        return notes
    x, y, w, h, cover = box
    if cover > 82:
        notes.append(f"canvas already tight ({cover:.0f}% ink)")
        return notes
    if dry:
        notes.append(f"artwork covers only {cover:.0f}% of the canvas → the viewBox would be "
                     f"tightened to the ink ({w / h:.2f}:1)")
        return notes

    vb = re.search(r'viewBox="\s*([\d.eE+-]+)[,\s]+([\d.eE+-]+)[,\s]+([\d.eE+-]+)[,\s]+([\d.eE+-]+)\s*"', original)
    txt = strip_root_percent_size(original)               # do this first: the root's own 100% is not geometry
    if vb:
        prepared = absolutise_percents(txt, float(vb.group(3)), float(vb.group(4)))
        if prepared is None:
            notes.append(f"artwork covers only {cover:.0f}% of the canvas, but it uses percentage "
                         "radii/sizes that cannot be re-anchored — left as it is; re-export it tight")
            return notes
        txt = prepared
    pad = max(w, h) * 0.04                                # a little air, and slack for font fallbacks
    box_str = f"{x - pad:.2f} {y - pad:.2f} {w + pad * 2:.2f} {h + pad * 2:.2f}"
    txt = (re.sub(r'viewBox="[^"]*"', f'viewBox="{box_str}"', txt, count=1) if "viewBox=" in txt
           else txt.replace("<svg", f'<svg viewBox="{box_str}"', 1))
    txt = re.sub(r'(<svg\b[^>]*?)\s(?:width|height)="[\d.]+%"', r"\1", txt)   # % on the root → no intrinsic size
    if not re.search(r'<svg\b[^>]*\swidth="[\d.]', txt):
        txt = txt.replace("<svg", f'<svg width="{w + pad * 2:.0f}" height="{h + pad * 2:.0f}"', 1)
    open(path, "w", encoding="utf-8").write(txt)

    verify = svg_ink_box(path, br)                        # trust nothing: measure the result
    if not verify or verify[4] < 60:
        open(path, "w", encoding="utf-8").write(original)
        got = f"{verify[4]:.0f}%" if verify else "nothing"
        notes.append(f"tightening the viewBox would have left {got} of the artwork visible "
                     "(the file's coordinates depend on its canvas) — reverted, file untouched")
        return notes
    notes.append(f"artwork covered only {cover:.0f}% of the canvas → viewBox tightened to the ink "
                 f"({verify[4]:.0f}% now, {(w + pad * 2) / (h + pad * 2):.2f}:1)")
    return notes

# ── image ops ────────────────────────────────────────────────────────────────

def knockout(im, tol=30):
    """Flood-fill a solid background away from the four corners into transparency."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    corners = [px[0, 0][:3], px[w - 1, 0][:3], px[0, h - 1][:3], px[w - 1, h - 1][:3]]
    if max(abs(a - b) for c in corners for a, b in zip(c, corners[0])) > tol:
        return im, False  # corners disagree → probably not a flat background
    bg = corners[0]
    seen = set()
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
            continue
        r, g, b, a = px[x, y]
        if a == 0:
            seen.add((x, y)); continue
        if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol * 3:
            continue
        seen.add((x, y))
        px[x, y] = (r, g, b, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im, True

def transparent_ratio(im):
    if "A" not in im.getbands():
        return 0.0
    a = im.getchannel("A")
    a.thumbnail((160, 160))
    data = a.tobytes()
    return sum(1 for v in data if v < 16) / max(1, len(data))

def detect_kind(im, path):
    if path.lower().endswith(".svg"):
        return "logo", "vector file"
    w, h = im.size
    tr = transparent_ratio(im)
    if tr > 0.05:
        return "logo", f"{tr:.0%} transparent pixels"
    if w >= 900 and 1.3 <= w / h <= 2.6:
        return "shot", f"{w}×{h}, page-like ratio, opaque"
    if max(w, h) < 700:
        return "logo", f"small source ({w}×{h})"
    return "shot", f"{w}×{h}, opaque"

def crop_16_10(im):
    w, h = im.size
    if w / h > SHOT_RATIO:                      # too wide → crop the sides
        nw = int(h * SHOT_RATIO)
        left = (w - nw) // 2
        return im.crop((left, 0, left + nw, h))
    nh = int(w / SHOT_RATIO)                     # too tall → keep the top
    return im.crop((0, 0, w, nh))

def save_webp(im, path, quality=82, lossless=False):
    im.save(path, "WEBP", lossless=lossless, exact=lossless, quality=quality, method=6)
    return os.path.getsize(path) / 1024

def write_derivatives(im, stem, out_dir, kind, dry):
    """
    Screenshots always get exactly 640 and 1280 wide files, because the srcset
    descriptors in main.js say so. Logos are never upscaled — a 160px mark gains
    nothing from a 1280px file — so they only get the widths their source can fill;
    below 640 they get a single native-size file and no srcset.
    """
    made = []
    src_w = im.size[0]
    targets = list(WIDTHS) if kind == "shot" else [w for w in WIDTHS if src_w >= w]
    if not targets:                                          # small logo → one native file
        path = os.path.join(out_dir, f"{stem}.webp")
        if dry:
            return [(rel(path), im.size, None)]
        kb = save_webp(im, path, lossless=True)
        if kb > MAX_KB[640]:
            kb = save_webp(im, path, quality=90)
        return [(rel(path), im.size, kb)]
    for want in targets:
        path = os.path.join(out_dir, f"{stem}-{want}.webp")
        scale = want / im.size[0]
        out = im.resize((want, max(1, round(im.size[1] * scale))), Image.LANCZOS) if scale != 1 else im
        if dry:
            made.append((rel(path), out.size, None)); continue
        lossless = kind == "logo" and out.size[0] * out.size[1] < 300_000
        kb = save_webp(out, path, quality=82, lossless=lossless)
        if kb > MAX_KB[want]:                                # too heavy → lossy pass
            kb = save_webp(out, path, quality=78 if kind == "shot" else 90)
        made.append((rel(path), out.size, kb))
    return made

# ── the PROJECTS entry ───────────────────────────────────────────────────────

def build_entry(a):
    q = lambda s: s.replace("'", "\\'")
    lines = [f"  {{ key: '{a['key']}', title: '{q(a['title'])}', type: '{q(a['type'])}',"]
    if a.get("logo"):
        art = f"logo: '{a['logo']}'"
        if a.get("logo2x"):
            art += f", logo2x: '{a['logo2x']}'"
        if a.get("tone"):
            art += f", tone: '{a['tone']}'"
        if a.get("brand"):
            art += f", brand: '{a['brand']}'"
        lines.append(f"    {art},")
    lines.append(f"    desc: '{q(a['desc'])}',")
    tech = ", ".join(f"'{t}'" for t in a["tech"])
    tail = f"    tech: [{tech}]"
    tail += f", demo: '{a['demo']}' }}," if a.get("demo") else " },"
    lines.append(tail)
    return "\n".join(lines)

def insert_entry(entry):
    src = open(MAIN_JS, encoding="utf-8").read()
    start = src.index("const PROJECTS = [")
    depth, i = 0, src.index("[", start)
    while i < len(src):
        if src[i] == "[":
            depth += 1
        elif src[i] == "]":
            depth -= 1
            if depth == 0:
                break
        i += 1
    out = src[:i] + entry + "\n" + src[i:]
    open(MAIN_JS, "w", encoding="utf-8").write(out)

# ── main ─────────────────────────────────────────────────────────────────────

def process(path, args):
    if not os.path.exists(path):
        print(f"!  {path} not found"); return None
    is_svg = path.lower().endswith(".svg")
    key = args.key or slug(path)
    title = args.title or titleize(key)

    if is_svg:
        kind, why = "logo", "vector file"
        m = measure_svg(path)
        dest = os.path.join(LOGO_DIR, key + ".svg")
        made = [(rel(dest), None, os.path.getsize(path) / 1024)]
        if not args.dry:
            os.makedirs(LOGO_DIR, exist_ok=True)
            if os.path.abspath(path) != os.path.abspath(dest):   # re-running on an installed file is fine
                shutil.copyfile(path, dest)
            txt = open(dest, encoding="utf-8", errors="ignore").read()
            if "viewBox" not in txt:                          # needed so CSS can scale it
                wh = re.search(r'width="(\d+(?:\.\d+)?)"\s+height="(\d+(?:\.\d+)?)"', txt)
                if wh:
                    txt = txt.replace("<svg", f'<svg viewBox="0 0 {wh.group(1)} {wh.group(2)}"', 1)
                    open(dest, "w", encoding="utf-8").write(txt)
                    print("   · added a viewBox so the logo scales")
        for note in tighten_svg(dest if not args.dry else path, args.dry):
            print("   · " + note)
        art = {"logo": rel(dest)}
    else:
        im = Image.open(path)
        kind, why = detect_kind(im, path)
        if args.as_kind:
            kind, why = args.as_kind, "forced with --as"
        if kind == "logo":
            im, knocked = knockout(im)
            if knocked:
                print("   · knocked out the flat background")
            bbox = im.getbbox()
            if bbox:
                im = im.crop(bbox)                            # trim: padding comes from CSS, not the file
            m = measure_raster(im)
            os.makedirs(LOGO_DIR, exist_ok=True)
            made = write_derivatives(im, key, LOGO_DIR, "logo", args.dry)
            art = {"logo": made[0][0]}
            if len(made) > 1:
                art["logo2x"] = made[1][0]
        else:
            im = crop_16_10(im.convert("RGB"))
            m = None
            os.makedirs(IMG_DIR, exist_ok=True)
            made = write_derivatives(im, key, IMG_DIR, "shot", args.dry)
            art = {}

    tone, tone_why = (None, "screenshots use no tone")
    if kind == "logo":
        tone, tone_why = decide_tone(m)
        if args.tone in ("light", "dark"):
            tone, tone_why = args.tone, "forced with --tone"
        elif args.tone == "none":
            tone, tone_why = None, "forced with --tone"
        art["tone"] = tone
        art["brand"] = args.brand or (m["brand"] if m else None)

    print(f"\n{os.path.basename(path)}  →  {kind.upper()}   ({why})")
    for p, size, kb in made:
        dim = f"{size[0]}×{size[1]}" if size else "vector"
        print(f"   {p}   {dim}" + (f"   {kb:.1f} KB" if kb else "   (dry run)"))
    if kind == "logo":
        print(f"   tone: {tone or 'none (graphite)'} — {tone_why}")
        print(f"   brand: {art.get('brand')}")

    entry = build_entry({
        "key": key, "title": title,
        "type": args.type or "TODO type",
        "desc": args.desc or "TODO one sentence, under ~90 characters.",
        "tech": args.tech.split(",") if args.tech else ["TODO tech"],
        "demo": args.demo,
        **{k: v for k, v in art.items() if v},
    })
    return entry

def main():
    p = argparse.ArgumentParser(add_help=False)
    p.add_argument("images", nargs="*")
    p.add_argument("--as", dest="as_kind", choices=["logo", "shot"])
    p.add_argument("--key"); p.add_argument("--title"); p.add_argument("--type")
    p.add_argument("--desc"); p.add_argument("--tech"); p.add_argument("--demo")
    p.add_argument("--tone", choices=["light", "dark", "auto", "none"], default="auto")
    p.add_argument("--brand")
    p.add_argument("--insert", action="store_true")
    p.add_argument("--dry", action="store_true")
    p.add_argument("-h", "--help", action="store_true")
    args = p.parse_args()
    if args.help or not args.images:
        print(__doc__); return
    if len(args.images) > 1 and (args.key or args.title):
        sys.exit("--key/--title only make sense with a single image")

    entries = [e for e in (process(i, args) for i in args.images) if e]
    if not entries:
        return
    print("\n" + "─" * 78)
    print("Paste into the PROJECTS array in main.js:\n")
    print("\n".join(entries))
    print("─" * 78)
    if args.insert and not args.dry:
        for e in entries:
            insert_entry(e)
        print(f"✓ appended {len(entries)} entr{'y' if len(entries) == 1 else 'ies'} to main.js — fill in the TODOs")

if __name__ == "__main__":
    main()
