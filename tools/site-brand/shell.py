"""The shared parts of every Corporate Luck by Chance public page: <head>, games-bar-ready body start, the six-item header, the footer.
Everything comes from the Corporate Games brand kit snippets (C:\\ct\\test-sites\\corporate-brand-kit\\snippets), with this game's own links.
Used by build_pages.py (which writes the pages) and by write_edge_shell.py (which writes apps/edge/src/site-shell.ts for the generated Trust page)."""
import html, os, re

KIT = os.environ.get("BRAND_KIT", r"C:\ct\test-sites\corporate-brand-kit")
ORIGIN = "https://luck.corporatetambola.com"
SITE = "Corporate Luck by Chance"
CARD = ORIGIN + "/og-card.png"
V = {"fonts": 2, "tokens": 2, "components": 2, "legacy": 1, "shell": 1, "site": 1, "kit": 2, "theme": 2, "bar": 3, "icon": 3}

MENU = [  # (key, label, link, extra class)
    ("how", "How it works", "/how-it-works", ""),
    ("demo", "Free demo game", "/zc?demo=1", "demo"),
    ("guide", "Guide", "/organizer-guide", ""),
    ("brochure", "Brochure", "/brochure", ""),
    ("refer", "Refer &amp; earn", "/partner", ""),
    ("login", "Log in", "/#login", "login"),
]


def kit(name):
    with open(os.path.join(KIT, "snippets", name), encoding="utf8", newline="") as f:
        return f.read().replace("\r\n", "\n")


def esc(s):
    return html.escape(s, quote=True)


def header(cur=""):
    """The kit header: badge + CORPORATE / Luck by Chance, the six items, the three colour dots."""
    links = []
    for key, label, href, cls in MENU:
        attrs = ""
        if cls:
            attrs += f' class="{cls}"'
        if key == "login":
            attrs += ' id="loginLink"'
        if key == cur:
            attrs += ' aria-current="page"'
        links.append(f'<a href="{href}"{attrs}>{label}</a>')
    dots = ('<span class="ck-dots" role="group" aria-label="Colour theme"><button type="button" data-t="blue" aria-pressed="true" aria-label="Studio blue theme" title="Studio blue"></button>'
            '<button type="button" data-t="maroon" aria-pressed="false" aria-label="Maroon theme" title="Maroon"></button>'
            '<button type="button" data-t="emerald" aria-pressed="false" aria-label="Emerald theme" title="Emerald"></button></span>')
    return ('<a class="ck-skip" href="#main">Skip to the content</a>\n<header class="ck-top"><div class="ck-top-in">\n'
            '<a class="ck-brand" href="/" aria-label="Corporate Luck by Chance, home"><svg class="ck-badge" aria-hidden="true" focusable="false"><use href="#i-luck"/></svg>'
            '<span class="ck-name"><i>Corporate</i><b>Luck by Chance</b></span></a>\n'
            '<button class="ck-menu" type="button" id="ck-menu" aria-expanded="false" aria-controls="ck-nav">Menu</button>\n'
            '<nav class="ck-nav" id="ck-nav" aria-label="Main">' + "".join(links) + dots + '</nav>\n</div></header>\n')


def footer():
    f = kit("footer-luck.html")
    # the legal column points at THIS game's own pages (the kit snippet points at the Tambola site)
    legal = ('<div><h2>Legal and help</h2><ul><li><a href="/terms.html">Terms</a></li><li><a href="/privacy.html">Privacy notice</a></li><li><a href="/subprocessors.html">Sub-processors</a></li>'
             '<li><a href="/dpa.html">Data processing terms</a></li><li><a href="/refund-policy.html">Refund policy</a></li><li><a href="/pricing.html">Pricing</a></li>'
             '<li><a href="/about.html">About</a></li><li><a href="/contact.html">Contact</a></li></ul></div>')
    f = re.sub(r'<div><h2>Legal, on corporatetambola\.com</h2>.*?</ul></div>', lambda m: legal, f, flags=re.S)
    f = f.replace('<a href="/how-it-works">How it works</a>', '<a href="/how-it-works">How it works</a>')
    f = f.replace('href="/zc"', 'href="/#login"').replace('<li><a href="/zc?demo=1">Free demo game</a></li>', '<li><a href="/zc?demo=1">Free demo game</a></li>')
    f = f.replace('<li><a href="/guide">Guide</a></li>', '<li><a href="/organizer-guide">Guide</a></li>').replace('<li><a href="/refer">Refer &amp; earn</a></li>', '<li><a href="/partner">Refer &amp; earn</a></li>')
    assert 'href="/terms.html"' in f and "housie.corporatetambola.com/terms" not in f, "footer legal column was not replaced"
    return f


def sprite():
    return kit("sprite.html")


def head(title, desc, path, *, robots=None, ld=None, scripts=(), og_alt=SITE, extra_css=(), plain=False):
    """path is the canonical path, for example /privacy.html or / ."""
    url = ORIGIN + path
    t, d = esc(title), esc(desc)
    out = ['<!doctype html>', '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
           f'<title>{t}</title>', f'<meta name="description" content="{d}">', f'<link rel="canonical" href="{url}">']
    if robots:
        out.append(f'<meta name="robots" content="{robots}">')
    else:
        out.append('<meta name="robots" content="index, follow, max-image-preview:large">')
    out.append('<meta name="theme-color" content="#0B3D91">')
    out.append(f'<meta property="og:type" content="website"><meta property="og:site_name" content="{SITE}"><meta property="og:title" content="{t}"><meta property="og:description" content="{d}">'
               f'<meta property="og:url" content="{url}"><meta property="og:image" content="{CARD}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
               f'<meta property="og:image:alt" content="{esc(og_alt)}"><meta property="og:locale" content="en_IN">')
    out.append(f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{t}"><meta name="twitter:description" content="{d}"><meta name="twitter:image" content="{CARD}">')
    if ld:
        out.append(f'<script type="application/ld+json">{ld}</script>')
    out.append(icons())
    out.append(preload())
    out.append(styles(extra_css))
    if not plain:  # plain = no script at all (the Trust page must be readable by any crawler without JavaScript)
        out.append(f'<script src="/theme-init.js?v={V["theme"]}"></script>')
        for s in scripts:
            out.append(f'<script src="{s}" defer></script>')
        out.append(f'<script src="/brandkit.js?v={V["kit"]}" defer></script><script src="/gamesbar.js?v={V["bar"]}" defer></script>')
    out.append('</head><body class="ck">')
    return "\n".join(out) + "\n"


def icons():
    i = V["icon"]
    return (f'<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png?v={i}" type="image/png" sizes="32x32"><link rel="icon" href="/icon-192.png?v={i}" type="image/png" sizes="192x192">'
            f'<link rel="apple-touch-icon" href="/apple-touch-icon.png?v={i}"><link rel="manifest" href="/manifest.webmanifest">')


def preload():
    return ('<link rel="preload" href="/fonts/Inter-normal-400.woff2" as="font" type="font/woff2" crossorigin>'
            '<link rel="preload" href="/fonts/Fraunces-normal-500-700.woff2" as="font" type="font/woff2" crossorigin>')


def styles(extra=()):
    s = (f'<link rel="stylesheet" href="/fonts.css?v={V["fonts"]}"><link rel="stylesheet" href="/fonts-app.css?v=1"><link rel="stylesheet" href="/tokens.css?v={V["tokens"]}">'
         f'<link rel="stylesheet" href="/components.css?v={V["components"]}"><link rel="stylesheet" href="/luck-legacy.css?v={V["legacy"]}"><link rel="stylesheet" href="/luck-shell.css?v={V["shell"]}">'
         f'<link rel="stylesheet" href="/luck-site.css?v={V["site"]}">')
    for e in extra:
        s += f'<link rel="stylesheet" href="{e}">'
    return s
