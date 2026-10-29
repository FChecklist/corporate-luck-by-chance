"""Copies the shared Corporate Games files into this site, byte for byte, and writes the checksums the site test pins.

    python -I tools/site-brand/sync_kit.py            (from the repository root)

Sources: C:\\ct\\test-sites\\corporate-brand-kit (css, js, fonts, logos, icons, share card) and C:\\ct\\test-sites\\corporate-games-bar (the games bar).
Writes apps/web/test/brand-kit.pins.json. apps/web/test/brand-site.test.ts fails when any copied file differs from its pin, so a hand edit of a copy is caught;
when the kit itself changes, run this again, then build_pages.py, and review the diff."""
import hashlib, json, os, shutil, sys

KIT = os.environ.get("BRAND_KIT", r"C:\ct\test-sites\corporate-brand-kit")
BAR = os.environ.get("GAMES_BAR", r"C:\ct\test-sites\corporate-games-bar")
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PUB = os.path.join(ROOT, "apps", "web", "public")
SLUG = "luck"

TEXT = (".css", ".js", ".svg", ".webmanifest")


def sha(path):
    data = open(path, "rb").read()
    if path.endswith(TEXT):
        data = data.replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


PLAN = [(f, f) for f in ["tokens.css", "fonts.css", "components.css", "console.css", "brandkit.js", "theme-init.js"]]
PLAN += [("fonts/Inter-normal-400.woff2", "fonts/Inter-normal-400.woff2"), ("fonts/Fraunces-normal-500-700.woff2", "fonts/Fraunces-normal-500-700.woff2")]
PLAN += [(f"logos/{SLUG}.svg", "logo.svg"), (f"logos/{SLUG}.svg", "logo-mark.svg"), (f"logos/{SLUG}.svg", "favicon.svg"),
         (f"logos/lockups/{SLUG}-lockup-light.svg", "logo-lockup.svg"), (f"logos/lockups/{SLUG}-lockup-dark.svg", "logo-lockup-dark.svg")]
L = "logos/png/" + SLUG
PNG = [(f"{L}-192.png", "icon-192.png"), (f"{L}-512.png", "icon-512.png"), (f"{L}-maskable-192.png", "icon-maskable-192.png"), (f"{L}-maskable-512.png", "icon-maskable-512.png"),
       (f"{L}-180.png", "apple-touch-icon.png"), (f"{L}-32.png", "favicon-32.png"), (f"logos/ico/{SLUG}.ico", "favicon.ico"), (f"logos/social/{SLUG}-social-1200x630.png", "og-card.png")]
BARPLAN = [("gamesbar.js", "gamesbar.js"), ("gamesbar.css", "gamesbar.css")]


def main():
    pins, missing = {}, []
    for base, plan in ((KIT, PLAN), (KIT, PNG), (BAR, BARPLAN)):
        for src, name in plan:
            s = os.path.join(base, src)
            if not os.path.exists(s):
                missing.append(src)
                continue
            d = os.path.join(PUB, name)
            os.makedirs(os.path.dirname(d), exist_ok=True)
            shutil.copyfile(s, d)
            pins[name] = sha(d)
    out = os.path.join(ROOT, "apps", "web", "test", "brand-kit.pins.json")
    with open(out, "w", encoding="utf8", newline="\n") as f:
        json.dump(pins, f, indent=1, sort_keys=True)
        f.write("\n")
    print("copied", len(pins), "files; pins written to", out)
    if missing:
        print("NOT AVAILABLE in the kit yet (the kit session has not rendered them):", ", ".join(missing))
    return 0


sys.exit(main())
