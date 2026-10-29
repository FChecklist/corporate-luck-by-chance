"""Writes the public pages of Corporate Luck by Chance in the Corporate Games look (the brand kit; the same look as housie.corporatetambola.com).

    python -I tools/site-brand/build_pages.py            (from the repository root; writes apps/web/public/*.html)

Safe to run again: it reads the words of the pages that already exist (title, description, the <main> block) and only changes the frame around them
(head, header, footer, scripts). The landing page, How it works, Brochure and 404 are written whole from content.py.
It never touches the organizer console logic (zc.js, host.js ...), only the frame (head styles) of the console pages."""
import html as H, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import shell
import content as C
from shell import ORIGIN, SITE, V, esc, head, header, footer, sprite

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PUB = os.path.join(ROOT, "apps", "web", "public")
TODAY = "2026-10-29"

PACKS = [(100, 2399, 34), (250, 3499, 51), (500, 4699, 67), (750, 5899, 84), (1000, 7099, 101), (2500, 11799, 169), (5000, 17699, 253), (10000, 29499, 421)]  # packages/shared/src/pricing.ts


def rd(name):
    with open(os.path.join(PUB, name), encoding="utf8", newline="") as f:
        return f.read().replace("\r\n", "\n")


def wr(name, text):
    with open(os.path.join(PUB, name), "w", encoding="utf8", newline="\n") as f:
        f.write(text)
    print("wrote", name, len(text))


def plain(s):
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def parse(name):
    h = rd(name)
    hd = h[: h.find("<body")]
    title = H.unescape(re.search(r"<title>(.*?)</title>", hd, re.S).group(1))
    m = re.search(r'<meta name="description" content="([^"]*)"', hd)
    desc = H.unescape(m.group(1)) if m else ""
    m = re.search(r'<meta name="robots" content="([^"]*)"', hd)
    robots = m.group(1) if m else None
    scripts = [s for s in re.findall(r'<script src="([^"]+)"', hd) if not re.match(r"/(theme|gamesbar|brandkit|theme-init)\.js", s)]
    body = h[h.find("<body"):]
    body = body[body.find(">") + 1:]
    return dict(h=h, title=title, desc=desc, robots=robots, scripts=scripts, body=body)


def main_block(body):
    m = re.search(r"<main\b([^>]*)>(.*?)</main>", body, re.S)
    return m.group(1), m.group(2), body[m.end():]


def tail_scripts(after_main):
    return "".join(re.findall(r'<script src="[^"]+"[^>]*></script>', after_main))


def doc_page(name, cur="", extra_main_class=""):
    """An information page: the page's own <main> words inside the new frame."""
    p = parse(name)
    attrs, inner, after = main_block(p["body"])
    cls = re.search(r'class="([^"]*)"', attrs)
    classes = "ck-doc" + ((" " + cls.group(1)) if cls else "") + extra_main_class
    path = "/" + name
    out = head(p["title"], p["desc"], path, robots=p["robots"], scripts=p["scripts"])
    out += sprite() + header(cur) + f'<main id="main" class="{classes}">{inner}</main>\n' + footer() + tail_scripts(after) + "\n</body></html>\n"
    wr(name, out)


def app_wrap(name, cur="", extra=("/z.css?v=2", "/zc.css?v=2", "/partner.css?v=2")):
    """A page that draws itself with the older app styles (Refer & earn, Help Desk): the website header and footer around it."""
    p = parse(name)
    attrs, minner, post = main_block(p["body"])
    post = re.sub(r'<p class="rfoot">.*?</p>', "", post, flags=re.S)  # the old footer line is replaced by the website footer
    sticky = re.search(r'<div class="rsticky mk">.*?</div>', post, re.S)
    path = "/" + name
    # the app styles come first, then the kit, so the kit wins where both speak
    hd = head(p["title"], p["desc"], path, robots=p["robots"], scripts=p["scripts"])
    hd = hd.replace('<link rel="stylesheet" href="/luck-legacy.css', "".join(f'<link rel="stylesheet" href="{e}">' for e in extra) + '<link rel="stylesheet" href="/luck-legacy.css')
    NL = chr(10)
    if "id=" in attrs:  # the page script draws into its own element (signin: #app); the skip link lands on a wrapper
        out = hd + sprite() + header(cur) + f'<div id="main">' + f"<main{attrs}>{minner}</main>" + "</div>" + NL
    else:
        out = hd + sprite() + header(cur) + f'<main{attrs} id="main">{minner}</main>' + NL
    if sticky:
        out += sticky.group(0) + NL
    out += footer() + tail_scripts(post) + NL + "</body></html>" + NL
    wr(name, out)


# ------------------------------------------------------------------------------------------------------------------ landing page
def faq_html():
    rows = []
    for i, (q, a, _) in enumerate(C.FAQ):
        if i == 0:
            rows.append(f'<details open><summary>{q}</summary><div class="ck-opts"><div><h4>Option 1: the free AI assistant</h4><p>Your own AI assistant builds a draft for you from a personal work link. You check it, then publish and pay.</p></div>'
                        f'<div><h4>Option 2: set it up yourself</h4><p>Work in the organizer console. Pick the day, the time, the size and the gifts.</p></div></div></details>')
        else:
            rows.append(f'<details><summary>{q}</summary><p>{a}</p></details>')
    return "\n".join(rows)


def ld_json():
    org = {"@context": "https://schema.org", "@type": "Organization", "name": SITE, "url": ORIGIN + "/", "logo": ORIGIN + "/og-card.png"}
    web = {"@context": "https://schema.org", "@type": "WebSite", "name": SITE, "url": ORIGIN + "/"}
    app = {"@context": "https://schema.org", "@type": "SoftwareApplication", "name": SITE, "applicationCategory": "BusinessApplication", "operatingSystem": "Web", "description": C.DESC,
           "url": ORIGIN + "/", "publisher": {"@type": "Organization", "name": "IT Services by Rajat Agarwal"},
           "offers": {"@type": "AggregateOffer", "priceCurrency": "INR", "lowPrice": str(min(p[1] for p in PACKS)), "highPrice": str(max(p[1] for p in PACKS)), "offerCount": str(len(PACKS))}}
    faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": (plain(a) if i else C.FAQ[0][2])}} for i, (q, a, _) in enumerate(C.FAQ[:6])]}
    return json.dumps([org, web, app, faq], ensure_ascii=False, separators=(",", ":"))


GAMES = [("g-tambola", "i-tambola", "https://housie.corporatetambola.com/", "Open Corporate Tambola (Housie)", "Tambola"),
         ("g-bingo", "i-bingo", "https://bingo.corporatetambola.com/", "Open Corporate Bingo", "Bingo"),
         ("g-ttt", "i-ttt", "https://tictactoe.corporatetambola.com/", "Open Corporate Tic Tac Toe", "Tic Tac Toe"),
         ("g-snakes", "i-snakes", "https://snakes.corporatetambola.com/", "Open Corporate Snakes and Ladders", "Snakes and Ladders"),
         ("g-luck", "i-luck", "https://luck.corporatetambola.com/", "Open Corporate Luck by Chance", "Luck by Chance"),
         ("g-draw", "i-draw", "https://home.corporatetambola.com/contact", "Corporate Lucky Draw: tell us you want it", "Lucky Draw")]


def choose():
    li = "".join(f'<li><a class="{c}" href="{u}" aria-label="{esc(al)}"><svg class="ck-badge" aria-hidden="true" focusable="false"><use href="#{i}"/></svg><span class="ck-name"><i>Corporate</i><b>{n}</b></span></a></li>' for c, i, u, al, n in GAMES)
    return f'<div class="ck-choose"><p>Choose a game for your close group:</p><ul>{li}</ul><a class="ck-allgames" href="https://home.corporatetambola.com/">All games &rarr;</a></div>'


def day_section():
    kitday = shell.kit("gameday.html")
    arts = re.findall(r'(<svg class="ck-art".*?</svg>)', kitday, re.S)
    assert len(arts) == 3, len(arts)
    items = "".join(f"<li>{arts[i]}<h3>{t}</h3><p>{d}</p></li>" for i, (t, d) in enumerate(C.DAY))
    return ('<section class="ck-wash-rose ck-sec" id="game-day" aria-labelledby="gdh"><div class="ck-wrap"><div class="ck-sec-head"><span class="ck-kicker">How a game day feels</span>'
            f'<h2 id="gdh">Easy for you. Fun for your people.</h2></div>\n<ol class="ck-moments">{items}</ol>'
            '<div class="ck-day-actions"><div class="ck-btn-row"><a class="ck-btn main" href="/demo.html">Try a free demo game</a></div><a href="/how-it-works">More about how it works</a></div></div></section>\n')


def trust_section():
    li = "".join(f"<li><b>{t}</b></li>" for t in C.TRUST)
    return f'<section class="ck-trust" id="trust" aria-labelledby="trh"><div class="ck-wrap"><h2 id="trh">What you can count on</h2>\n<ul class="ck-facts">{li}</ul></div></section>\n'


def old_sprite():
    """The small icon set the pricing script and the sign-in pop-ups use (#i-chev, #i-arrow, #i-x, #i-alert ...), taken from the existing page."""
    h = rd("index.html")
    m = re.search(r'<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>.*?</defs></svg>', h, re.S)
    if not m:
        m = re.search(r'<svg class="ck-old-sprite".*?</svg>', h, re.S)
    return m.group(0).replace('<svg width="0" height="0" style="position:absolute" aria-hidden="true">', '<svg class="ck-old-sprite" width="0" height="0" aria-hidden="true" focusable="false">')


def index_page(old_sprite_svg):
    scripts = ["/pwa.js", "/guide.js", "/blackbox.js", "/rum.js", "/v.js"]
    out = head(C.TITLE, C.DESC, "/", ld=ld_json(), scripts=scripts)
    out += sprite() + old_sprite_svg + "\n" + header("")
    out += '<main id="main">\n'
    out += ('<select id="pack" hidden aria-hidden="true" tabindex="-1"></select><button id="payBtn" type="button" hidden tabindex="-1" aria-hidden="true">Create your game</button>\n')  # the pricing script needs both; the price card below is what people see
    out += ('<section class="ck-hero g-luck" id="top" aria-labelledby="h1"><div class="ck-wrap ck-hero-in"><div>\n<span class="ck-kicker">For HR teams and managers</span>\n'
            '<h1 id="h1">This week, which teams will you engage with a <span class="ck-hl">close group game of Luck by Chance?</span></h1>\n'
            '<p class="ck-lead">A dice game of pure luck. Everyone presses the dice on their own phone, every round has a clock, and the software names the winners.</p>\n'
            '<div class="ck-btn-row"><a class="ck-btn main" href="/demo.html">Try a free demo game</a></div>\n'
            + choose() +
            '\n<p class="ck-hero-contact">No software to buy: you pay per game. Talk to a person: <a href="mailto:hello@corporatetambola.com">hello@corporatetambola.com</a> or <a href="tel:+919650397480">(+91) 96503 97480</a>.</p>\n</div>\n'
            '<div class="ck-panel"><svg class="ck-badge" aria-hidden="true" focusable="false"><use href="#i-luck"/></svg><p class="ck-name"><i>Corporate</i><b>Luck by Chance</b></p>'
            '<ul><li>A dice game of pure luck</li><li>Every round has a clock</li><li>A top 10 list is shown</li></ul></div>\n</div></section>\n')
    out += trust_section() + day_section()
    out += ('<section class="ck-sec" id="players" aria-labelledby="pvh"><div class="ck-wrap ck-split"><div><span class="ck-kicker">What your players see</span><h2 id="pvh">A big target. A big dice. A clear answer.</h2>'
            '<p class="ck-lead">The target number is shown in words and as a dice face. Players press once. The dice rolls on the screen, and the result is worked out by the software, not by a person.</p>'
            '<div class="ck-btn-row"><a class="ck-btn" href="/demo">Try five dice rounds</a></div></div>'
            '<figure class="ck-shot"><img src="/img/dice.svg" width="700" height="440" decoding="async" fetchpriority="high" alt="Corporate Luck by Chance on a phone: the target number 4 in words and as a dice face, a coloured dice that rolls on the screen, and a Press the dice button">'
            '<figcaption>The player&rsquo;s phone</figcaption></figure></div></section>\n')
    cards = "".join(f"<li><h3>{t}</h3><p>{d}</p></li>" for t, d in C.BENEFITS)
    out += (f'<section class="ck-alt ck-sec" id="benefits" aria-labelledby="bh"><div class="ck-wrap"><div class="ck-sec-head"><span class="ck-kicker">Why teams like it</span><h2 id="bh">A game everyone can join in under a minute.</h2></div>'
            f'<ul class="ck-benef">{cards}</ul></div></section>\n')
    occ = "".join(f"<li>{o}</li>" for o in C.OCCASIONS)
    out += (f'<section class="ck-sec" id="uses" aria-labelledby="uh"><div class="ck-wrap"><span class="ck-kicker">Made for</span><h2 id="uh">Seven ways teams use it.</h2><ul class="ck-occasions">{occ}</ul></div></section>\n')
    out += (f'<section class="ck-wash-teal ck-sec" id="faq" aria-labelledby="fh"><div class="ck-wrap ck-faq"><span class="ck-kicker">Questions</span><h2 id="fh">Good to know</h2>\n{faq_html()}</div></section>\n')
    steps = "".join(f"<li><h3>{t}</h3><p>{d}</p></li>" for t, d in C.HOW_STEPS)
    out += (f'<section class="ck-sec" id="how" aria-labelledby="hh"><div class="ck-wrap"><div class="ck-sec-head"><span class="ck-kicker">How it works</span><h2 id="hh">From setup to winners, in five steps.</h2>'
            f'<p class="ck-lead">One organizer sets it up in a few minutes. Players need only a phone and a link.</p></div><ol class="ck-steps">{steps}</ol>'
            '<div class="ck-btn-row"><a class="ck-btn" href="/how-it-works">Read more about how it works</a></div></div></section>\n')
    out += ('<section class="ck-band ck-sec" id="ai-host" aria-labelledby="aih"><div class="ck-wrap"><span class="ck-kicker">Included with every game</span><h2 id="aih">An AI assistant for the organizer. Free.</h2>'
            '<p>You get a personal work link for your own AI assistant. It can build a draft, change it before the start, message guests and read the results. '
            'It cannot pay, publish, cancel, erase, end the game or choose winners. Those stay with you.</p></div></section>\n')
    out += ('<section class="ck-sec" id="pricing" aria-labelledby="ph"><div class="ck-wrap">'
            '<span class="ck-kicker">Pricing</span><div class="ck-price-head"><h2 id="ph">Simple pricing, per game, no commitment.</h2><span class="cur" role="group" aria-label="Currency" data-cur></span></div>\n'
            '<p class="ck-price-lead">Try a free game with 10 people first. After that, packs are sold as &ldquo;Up to N players&rdquo;, per game. No yearly plan, no tax added. We do not give refunds. '
            'If you cancel a paid game before it starts, your payment stays as credit for your next game for 365 days. Unused credit lapses at the end of day 365. See the <a href="/pricing.html">full price list</a>.</p>\n'
            '<p class="offer"><b>Festive offer: 50% off</b> on every pack</p>\n<div class="packs" id="packs" aria-live="polite"></div>\n<p class="pricenote" id="priceNote"></p>\n</div></section>\n')
    out += ('<section class="ck-cta ck-sec"><div class="ck-wrap"><h2>Ready for your game day?</h2><p>Try a free demo game. It takes about a minute.</p>'
            '<div class="ck-btn-row"><a class="ck-btn main" href="/demo.html">Try a free demo game</a></div></div></section>\n</main>\n')
    out += footer() + '\n<script src="/common.js"></script><script src="/google.js"></script><script src="/termsbox.js"></script><script src="/site.js"></script>\n</body></html>\n'
    wr("index.html", out)


# ------------------------------------------------------------------------------------------------------------------ how it works
def how_page():
    title, desc = "How it works | Corporate Luck by Chance", "How a Corporate Luck by Chance game runs: share one link, players press the dice on their own phone, the software names the winners. 10 rounds, 10 seconds to press."
    out = head(title, desc, "/how-it-works.html", scripts=["/pwa.js", "/guide.js", "/blackbox.js", "/rum.js", "/v.js"]) + sprite() + header("how")
    steps = "".join(f"<li><h3>{t}</h3><p>{d}</p></li>" for t, d in C.HOW_STEPS)
    facts = "".join(f"<tr><th scope=\"row\">{a}</th><td>{b}</td></tr>" for a, b in C.GAME_FACTS)
    out += ('<main id="main">\n<section class="ck-hero g-luck" aria-labelledby="h1"><div class="ck-wrap ck-hero-in"><div><span class="ck-kicker">How it works</span>'
            '<h1 id="h1">From one link to the winners, <span class="ck-hl">in five steps.</span></h1>'
            '<p class="ck-lead">One organizer sets it up in a few minutes. Players need only a phone and a link. Nobody pays, nobody installs anything.</p>'
            '<div class="ck-btn-row"><a class="ck-btn main" href="/demo.html">Try a free demo game</a></div></div>'
            '<div class="ck-panel"><svg class="ck-badge" aria-hidden="true" focusable="false"><use href="#i-luck"/></svg><p class="ck-name"><i>Corporate</i><b>Luck by Chance</b></p>'
            '<ul><li>Share one link</li><li>Press the dice</li><li>The software names the winners</li></ul></div></div></section>\n')
    out += f'<section class="ck-sec" aria-labelledby="sh"><div class="ck-wrap"><div class="ck-sec-head"><h2 id="sh">The five steps</h2></div><ol class="ck-steps">{steps}</ol></div></section>\n'
    out += (f'<section class="ck-wash-gold ck-alt ck-sec" aria-labelledby="gh"><div class="ck-wrap"><div class="ck-sec-head"><span class="ck-kicker">A game in numbers</span><h2 id="gh">What a game looks like</h2></div>'
            f'<table class="ck-table ck-facts-table"><tbody>{facts}</tbody></table>'
            '<p class="ck-small">If a Host moves the rounds on by hand, there is no fixed time between rounds and no countdown is shown.</p></div></section>\n')
    out += ('<section class="ck-sec" aria-labelledby="fh2"><div class="ck-wrap"><div class="ck-sec-head"><span class="ck-kicker">Fair for everyone</span><h2 id="fh2">Nobody can know a result in advance</h2></div>'
            '<ul class="ck-benef"><li><h3>The target</h3><p>Each target is made from public random data before the press window opens.</p></li>'
            '<li><h3>Your dice</h3><p>Your dice is made from public random data that is published only after the window closes. Not even we can know it while the window is open.</p></li>'
            '<li><h3>The same chance for all</h3><p>Whatever the target is, your chance of a hit is exactly 1 in 6, the same for everybody. Anyone can re-check the standings.</p></li>'
            '<li><h3>Press on time</h3><p>You may press only inside the 10 second window, decided by the server&rsquo;s clock. A late press is not counted and nothing is recorded.</p></li></ul></div></section>\n')
    out += ('<section class="ck-cta ck-sec"><div class="ck-wrap"><h2>See it for yourself</h2><p>Play five dice rounds on your own phone.</p>'
            '<div class="ck-btn-row"><a class="ck-btn main" href="/demo.html">Try a free demo game</a></div></div></section>\n</main>\n')
    out += footer() + "\n</body></html>\n"
    wr("how-it-works.html", out)


# ------------------------------------------------------------------------------------------------------------------ brochure
def brochure_page():
    title, desc = "Brochure | Corporate Luck by Chance", "The Corporate Luck by Chance brochure: what the game is, why organizers choose it, how it works and what it costs. Print it or save it as a PDF."
    out = head(title, desc, "/brochure.html", scripts=[]) + sprite() + header("brochure")
    why = "".join(f"<li><h3>{t}</h3><p>{d}</p></li>" for t, d in C.BROCHURE_WHY)
    rows = "".join(f"<tr><td>Up to {n:,}</td><td>US$ {u}</td><td>&#8377;{r:,}</td></tr>" for n, r, u in PACKS)
    inc = "".join(f"<li>{x}</li>" for x in C.BROCHURE_INCLUDES)
    steps3 = [("Build your game", "Pick the size and the gifts. It is a free draft until you publish."), ("Invite your people", "Share one link. Show the big screen in the room or on a video call."), ("Pay once, then play", "Pay once for the game, before it begins. The game plays itself on phones.")]
    s3 = "".join(f"<li><h3>{t}</h3><p>{d}</p></li>" for t, d in steps3)
    out += ('<main id="main">\n<section class="ck-hero g-luck" aria-labelledby="h1"><div class="ck-wrap ck-hero-in"><div><span class="ck-kicker">Brochure</span>'
            '<h1 id="h1">A game of luck for your whole <span class="ck-hl">close group.</span></h1>'
            '<p class="ck-lead">Turn your company event into ten rounds of pure luck, on everyone&rsquo;s own phone. Share one link. No app to download. Easy for you to set up, fun for every player.</p>'
            '<div class="ck-btn-row"><a class="ck-btn main" href="/demo.html">Try a free demo game</a></div></div>'
            '<div class="ck-panel"><svg class="ck-badge" aria-hidden="true" focusable="false"><use href="#i-luck"/></svg><p class="ck-name"><i>Corporate</i><b>Luck by Chance</b></p>'
            '<ul><li>A dice game of pure luck</li><li>Every round has a clock</li><li>A top 10 list is shown</li></ul></div></div></section>\n')
    out += f'<section class="ck-sec" aria-labelledby="wh"><div class="ck-wrap"><div class="ck-sec-head"><h2 id="wh">Why organizers choose it</h2></div><ul class="ck-benef">{why}</ul></div></section>\n'
    out += f'<section class="ck-alt ck-sec" aria-labelledby="hh"><div class="ck-wrap"><div class="ck-sec-head"><h2 id="hh">How it works</h2></div><ol class="ck-steps">{s3}</ol></div></section>\n'
    out += (f'<section class="ck-sec" aria-labelledby="ph"><div class="ck-wrap"><div class="ck-sec-head"><h2 id="ph">Simple pricing, one game at a time</h2></div>'
            f'<table class="ck-table"><thead><tr><th>Players</th><th>US dollars</th><th>Indian rupees</th></tr></thead><tbody>{rows}</tbody></table>'
            '<p class="ck-small">No tax added. One payment is for one game only. No commitment, no repeat charges. A game that is not paid for simply does not begin and nothing is charged. We do not give refunds. '
            'If you cancel a paid game before it starts, your payment stays as credit for your next game for 365 days. Unused credit lapses at the end of day 365.</p>'
            f'<h3>What a game includes</h3><ul class="ck-ticks">{inc}</ul></div></section>\n')
    out += ('<section class="ck-cta ck-sec"><div class="ck-wrap"><h2>See it in about a minute. It is free.</h2><p>Play five dice rounds on your own phone.</p>'
            '<div class="ck-btn-row"><a class="ck-btn main" href="/demo.html">Try a free demo game</a></div></div></section>\n</main>\n')
    out += footer() + "\n</body></html>\n"
    wr("brochure.html", out)


# ------------------------------------------------------------------------------------------------------------------ 404
def notfound_page():
    out = head("Page not found | Corporate Luck by Chance", "That page could not be found. Go to the Corporate Luck by Chance home page.", "/404.html", robots="noindex") + sprite() + header("")
    out += ('<main id="main" class="ck-doc"><section><h1>We could not find that page</h1><p>The link may be mistyped, or a game may have ended and been deleted. Please check the link you were given.</p>'
            '<div class="ck-btn-row"><a class="ck-btn main" href="/">Go to Corporate Luck by Chance</a><a class="ck-btn" href="/how-it-works">How it works</a></div></section></main>\n')
    out += footer() + "\n</body></html>\n"
    wr("404.html", out)


# ------------------------------------------------------------------------------------------------------------------ console and game pages (frame only)
def shell_only(name, light=True):
    """The console, the player page and the other app pages keep their own markup and scripts. Only the head changes: the brand's fonts, tokens, header colours and icons."""
    h = rd(name)
    hd, bd = h[: h.find("<body")], h[h.find("<body"):]
    hd = hd.replace('<html lang="en">', '<html lang="en" data-mode="light">') if light and 'data-mode=' not in hd else hd
    hd = re.sub(r'<meta name="theme-color" content="[^"]*">', '<meta name="theme-color" content="#0B3D91">', hd)
    # fonts: kit fonts.css plus the extra faces the console uses
    hd = re.sub(r'<link rel="stylesheet" href="/fonts\.css[^"]*">(<link rel="stylesheet" href="/fonts-app\.css[^"]*">)?', f'<link rel="stylesheet" href="/fonts.css?v={V["fonts"]}"><link rel="stylesheet" href="/fonts-app.css?v=1">', hd)
    # app styles keep their place; the kit tokens and the brand shell come after them so the brand wins
    css = f'<link rel="stylesheet" href="/tokens.css?v={V["tokens"]}"><link rel="stylesheet" href="/luck-shell.css?v={V["shell"]}">'
    if "/luck-shell.css" not in hd:
        links = [m for m in re.finditer(r'<link rel="stylesheet" href="[^"]+">', hd)]
        if links:
            hd = hd[: links[-1].end()] + css + hd[links[-1].end():]
        else:
            hd = hd.replace("</head>", css + "</head>")
    else:
        hd = re.sub(r'<link rel="stylesheet" href="/tokens\.css[^"]*"><link rel="stylesheet" href="/luck-shell\.css[^"]*">', css, hd)
    # icons: the new logo files keep their old names; raise the cache number
    hd = re.sub(r'(/(?:favicon-32|icon-192|apple-touch-icon)\.png)\?v=\d+', rf'\1?v={V["icon"]}', hd)
    hd = re.sub(r'(/apple-touch-icon\.png)(")', rf'\1?v={V["icon"]}\2', hd)
    if "/favicon.svg" not in hd:
        hd = hd.replace("</head>", '<link rel="icon" href="/favicon.svg" type="image/svg+xml"></head>') if "</head>" in hd else hd
    wr(name, hd + bd)


DOCS = {"about.html": "", "contact.html": "", "pricing.html": "", "legal.html": "", "terms.html": "", "privacy.html": "", "legal-position.html": "", "dpa.html": "",
        "subprocessors.html": "", "refund-policy.html": "", "partner-terms.html": "", "organizer-guide.html": "guide"}
SHELL_ONLY = ["z.html", "zc.html", "host.html", "big.html", "preview.html", "demo.html", "offline.html", "pay.html", "paytest.html", "paylink.html", "report.html", "owner-visits.html", "ai-link.html",
              "helpdesk-accept.html", "helpdesk-approve.html"]

if __name__ == "__main__":
    osp = old_sprite()
    index_page(osp)
    how_page()
    brochure_page()
    notfound_page()
    for n, cur in DOCS.items():
        doc_page(n, cur)
    app_wrap("partner.html", "refer")
    app_wrap("helpdesk.html", "")
    app_wrap("signin.html", "", extra=("/z.css?v=2",))
    for n in SHELL_ONLY:
        shell_only(n)
