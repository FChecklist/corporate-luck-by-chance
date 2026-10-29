// Corporate Luck by Chance public website = the Corporate Games look (owner order 29 Oct 2026: "look and feel like housie.corporatetambola.com for all games' individual websites;
// use the logo ... keep branding uniform"). These tests enforce what a machine can check: the shared brand kit is copied unchanged (checksums), the header has exactly the six items,
// the logo files are the canonical ones, the wording rule, canonical / share tags / sitemap, version numbers on css and js, and the service worker version.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PUB = join(import.meta.dir, "../public"), ROOT = join(import.meta.dir, "../../..");
const ORIGIN = "https://luck.corporatetambola.com";
const rd = (f: string) => readFileSync(join(PUB, f), "utf8");
const sha = (f: string, text = !/\.(woff2|png|ico)$/.test(f)) => { let b = readFileSync(join(PUB, f)); if (text) b = Buffer.from(b.toString("utf8").split(String.fromCharCode(13)).join("")); return createHash("sha256").update(b).digest("hex"); };

// the pages that carry the website header (all public pages)
const SITE = ["index", "how-it-works", "about", "contact", "pricing", "legal", "terms", "privacy", "legal-position", "refund-policy", "dpa", "subprocessors", "partner-terms", "organizer-guide", "brochure", "partner", "helpdesk", "signin", "404", "trust"];
const SIX = ["How it works", "Free demo game", "Guide", "Brochure", "Refer & earn", "Log in"];
const navOf = (h: string) => /<nav class="ck-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(h)![1]!;
const labelsOf = (h: string) => [...navOf(h).replace(/<span class="ck-dots"[\s\S]*?<\/span>/, "").matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]!.replace(/&amp;/g, "&").trim());

// brand-kit.pins.json is written by tools/site-brand/sync_kit.py from the canonical folders: it says what every copied file must be, byte for byte.
const PINS: Record<string, string> = JSON.parse(readFileSync(join(import.meta.dir, "brand-kit.pins.json"), "utf8"));

describe("the shared Corporate Games brand kit is copied unchanged", () => {
  test("css and js are identical to the canonical files (C:\ct\test-sites\corporate-brand-kit), and the games bar to C:\ct\test-sites\corporate-games-bar", () => {
    for (const f of ["tokens.css", "fonts.css", "components.css", "console.css", "brandkit.js", "theme-init.js", "gamesbar.js", "gamesbar.css"]) expect([f, sha(f)]).toEqual([f, PINS[f]]);
  });
  test("the two fonts are identical and self-hosted", () => {
    for (const f of ["fonts/Inter-normal-400.woff2", "fonts/Fraunces-normal-500-700.woff2"]) expect([f, sha(f, false)]).toEqual([f, PINS[f]]);
    expect(rd("fonts.css")).not.toMatch(/https?:\/\//);
  });
});

describe("the logo", () => {
  test("logo.svg, logo-mark.svg and favicon.svg are the canonical Luck by Chance badge, the lockups are the canonical lockups", () => {
    for (const f of ["logo.svg", "logo-mark.svg", "favicon.svg", "logo-lockup.svg", "logo-lockup-dark.svg"]) expect([f, sha(f)]).toEqual([f, PINS[f]]);
    expect(PINS["logo.svg"]).toBe(PINS["favicon.svg"]); expect(rd("logo.svg")).toContain('fill="#6A2BD9"'); // the violet dice-wheel badge
  });
  test("the PWA icons, the home-screen icon and the share card are the canonical PNG files, of the right size, and the manifest uses the brand colours", () => {
    const dims = (f: string) => { const b = readFileSync(join(PUB, f)); expect(b.subarray(1, 4).toString()).toBe("PNG"); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    expect(dims("icon-192.png")).toEqual([192, 192]); expect(dims("icon-512.png")).toEqual([512, 512]); expect(dims("icon-maskable-192.png")).toEqual([192, 192]); expect(dims("icon-maskable-512.png")).toEqual([512, 512]);
    expect(dims("apple-touch-icon.png")).toEqual([180, 180]); expect(dims("favicon-32.png")).toEqual([32, 32]); expect(dims("og-card.png")).toEqual([1200, 630]);
    for (const f of ["icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png", "og-card.png"]) expect([f, sha(f, false)]).toEqual([f, PINS[f]]);
    const m = JSON.parse(rd("manifest.webmanifest")); expect(m.theme_color).toBe("#0B3D91"); expect(m.background_color).toBe("#FFFAF2"); expect(m.name).toBe("Corporate Luck by Chance");
  });
  test("the header shows the badge and CORPORATE (small) above Luck by Chance on every page, with a skip link first", () => {
    for (const p of SITE) {
      const h = rd(p + ".html");
      expect([p, h.includes('<a class="ck-brand" href="/" aria-label="Corporate Luck by Chance, home"><svg class="ck-badge" aria-hidden="true" focusable="false"><use href="#i-luck"/></svg><span class="ck-name"><i>Corporate</i><b>Luck by Chance</b></span></a>')]).toEqual([p, true]);
      expect([p, /<body class="ck">\s*(<svg[\s\S]*?<\/svg>\s*)*<a class="ck-skip" href="#main">Skip to the content<\/a>/.test(h)]).toEqual([p, true]);
      expect([p, h.includes('id="main"')]).toEqual([p, true]);
      expect([p, /<symbol id="i-luck"/.test(h)]).toEqual([p, true]); // the badge is drawn in the page
    }
  });
});

describe("the header menu", () => {
  test("exactly six items, in the owner's order, on every public page", () => {
    for (const p of SITE) expect([p, labelsOf(rd(p + ".html"))]).toEqual([p, SIX]);
  });
  test("no Free AI assistant, Video, Pricing or WhatsApp item in the header, and the colour dots are there", () => {
    for (const p of SITE) { const n = navOf(rd(p + ".html")); expect([p, /AI assistant|Video|Pricing|WhatsApp/i.test(n.replace(/<span class="ck-dots"[\s\S]*?<\/span>/, ""))]).toEqual([p, false]); expect(n).toContain('aria-label="Colour theme"'); }
  });
  test("the links go where the words say: the demo game opens the free 10-person game, Log in opens the sign-in box, the other four are pages of this site that exist", () => {
    const n = navOf(rd("index.html")); const hrefs = [...n.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/how-it-works", "/zc?demo=1", "/organizer-guide", "/brochure", "/partner", "/#login"]);
    for (const f of ["how-it-works", "organizer-guide", "brochure", "partner"]) expect(existsSync(join(PUB, f + ".html"))).toBe(true);
    expect(rd("index.html")).toContain('id="loginLink"'); // the pricing script opens the sign-in box from it
    expect(rd("index.html")).toContain('href="/zc?demo=1">Try a free game with 10 people</a>');
  });
  test("a page marks its own menu item as the current one", () => {
    for (const [p, label] of [["how-it-works", "How it works"], ["organizer-guide", "Guide"], ["brochure", "Brochure"], ["partner", "Refer &amp; earn"]] as const) {
      const cur = [...navOf(rd(p + ".html")).matchAll(/<a [^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]); expect([p, cur]).toEqual([p, [label]]);
    }
  });
  test("the footer sends the legal links to this game's own pages, not to another game's site", () => {
    for (const p of SITE) { const h = rd(p + ".html"); const f = /<footer class="ck-foot">[\s\S]*?<\/footer>/.exec(h)![0]; expect([p, f.includes('href="/terms.html"') && f.includes('href="/privacy.html"') && f.includes('href="/subprocessors.html"')]).toEqual([p, true]); expect(f).not.toMatch(/housie\.corporatetambola\.com\/(terms|privacy|subprocessors|dpa|refund)/); expect(f).not.toContain("games.corporatetambola.com"); }
  });
});

describe("wording and language", () => {
  const FILES = (() => { const out: string[] = []; for (const n of readdirSync(PUB)) if (/\.(html|txt|xml|webmanifest)$/.test(n)) out.push(join(PUB, n)); for (const n of readdirSync(join(ROOT, "site"))) if (/\.html$/.test(n)) out.push(join(ROOT, "site", n)); out.push(join(PUB, "site.js")); return out; })();
  test("the word the owner banned (a close group game, never the other word) is in no public page, no legal page and not in the sign-in and checkout text", () => {
    const bad = FILES.filter((f) => /\bprivate\b/i.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length));
    expect(bad).toEqual([]);
  });
  test("English only: no other script appears on a public page", () => {
    for (const p of SITE) expect([p, /[\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF\u0400-\u04FF]/.test(rd(p + ".html"))]).toEqual([p, false]);
  });
  test("How it works tells this game's true numbers: 10 rounds, 10 dice rounds in each, a 10 second press window; the old 6 / 15 second choice and 1 to 20 rounds are gone", () => {
    const t = rd("how-it-works.html").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(t).toContain("10 seconds"); expect(t).toMatch(/Rounds in a game\s*10/); expect(t).toMatch(/Dice rounds in each round\s*10/);
    for (const p of ["index", "how-it-works", "brochure"]) expect([p, /6, 10 or 15|1 to 20 rounds|6, 10, or 15/.test(rd(p + ".html"))]).toEqual([p, false]);
  });
});

describe("search and share tags, the build and caching", () => {
  test("every website page has one canonical address equal to its own file name, matching share tags, and the share card file exists", () => {
    for (const p of SITE.filter((x) => x !== "404")) {
      const h = rd(p + ".html"), url = ORIGIN + (p === "index" ? "/" : "/" + p + ".html");
      expect([p, (h.match(/<link rel="canonical" href="([^"]+)"/) ?? [])[1]]).toEqual([p, url]);
      expect([p, (h.match(/<meta property="og:url" content="([^"]+)"/) ?? [])[1]]).toEqual([p, url]);
      expect([p, (h.match(/<meta property="og:image" content="([^"]+)"/) ?? [])[1]]).toEqual([p, ORIGIN + "/og-card.png"]);
      expect([p, (h.match(/<meta name="twitter:image" content="([^"]+)"/) ?? [])[1]]).toEqual([p, ORIGIN + "/og-card.png"]);
      expect([p, h.includes('<meta name="theme-color" content="#0B3D91">')]).toEqual([p, true]);
    }
    expect(existsSync(join(PUB, "og-card.png"))).toBe(true);
  });
  test("the sitemap lists How it works, robots.txt lets it be read, and the build ships every new file", () => {
    expect(rd("sitemap.xml")).toContain(ORIGIN + "/how-it-works.html"); expect(rd("robots.txt")).toContain("Allow: /how-it-works.html");
    const b = readFileSync(join(ROOT, "pages/build.mjs"), "utf8");
    for (const f of ["how-it-works.html", "tokens.css", "components.css", "brandkit.js", "theme-init.js", "luck-site.css", "luck-shell.css", "luck-legacy.css", "fonts-app.css", "favicon.svg", "og-card.png", "logo-lockup.svg"]) expect([f, b.includes(`"${f}"`)]).toEqual([f, true]);
    expect(b).toContain('["/how-it-works", PLAINCSP, false]');
    expect(b).toMatch(/\/\*\.css\\n  Cache-Control: no-cache/); expect(b).toMatch(/\/\*\.js\\n  Cache-Control: no-cache/); // Pages would otherwise keep css and js for 4 hours
  });
  test("every local css and js link of a website page carries a ?v= number, and every file it names exists", () => {
    for (const p of SITE) {
      const h = rd(p + ".html");
      for (const m of h.matchAll(/(?:<link rel="stylesheet" href|<script src)="(\/[^"?]+\.(?:css|js))(\?v=\d+)?"/g)) {
        const f = m[1]!.slice(1); expect([p, f, existsSync(join(PUB, f))]).toEqual([p, f, true]);
        if (/^(tokens|components|luck-site|luck-shell|luck-legacy|fonts|fonts-app|theme-init|brandkit|gamesbar)\./.test(f)) expect([p, f, !!m[2]]).toEqual([p, f, true]);
      }
    }
  });
  test("the service worker version was raised for the new look, and it saves the brand files the game pages now load", () => {
    const sw = rd("zsw.js"); expect(Number(/CACHE = "luck-game-v(\d+)"/.exec(sw)![1])).toBeGreaterThanOrEqual(7);
    for (const f of ["/tokens.css", "/luck-shell.css", "/fonts-app.css"]) expect(sw).toContain(`"${f}"`);
  });
  test("the console and game pages keep their own markup and only take the brand's head: tokens, shell, icons, light mode", () => {
    for (const p of ["z", "zc", "host", "big", "pay", "report", "demo"]) { const h = rd(p + ".html"); expect([p, /<link rel="stylesheet" href="\/tokens\.css\?v=\d+"><link rel="stylesheet" href="\/luck-shell\.css\?v=\d+">/.test(h)]).toEqual([p, true]); expect(h).toContain('data-mode="light"'); expect(h).toContain('<meta name="theme-color" content="#0B3D91">'); }
  });
});
