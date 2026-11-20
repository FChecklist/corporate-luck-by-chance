// Developer tool: real-browser screenshots and checks of the Luck by Chance public site at 360, 390, 768, 1280 and 1920 px, light and dark, plus a keyboard Tab walk through the header.
// Take the single heavy lock first (mkdir C:/ct/heavy.lock; rmdir it when done) and only when free RAM is above 1 GB.
//   node tools/site-brand/shots.mjs [pageNames] [widths]      e.g.  node tools/site-brand/shots.mjs index,privacy 390,1280
// Output: C:/ct/test-sites/data/ui/site-luck/<page>-<width>-<scheme>.png and results.json (one object per shot with the problems found).
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUB = join(ROOT, "apps/web/public");
const OUT = "C:/ct/test-sites/data/ui/site-luck";
mkdirSync(OUT, { recursive: true });
const { launchChrome } = await import(pathToFileURL("C:/ct/test-sites/corporate-brand-kit/tools/browser.mjs").href);

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain", ".xml": "application/xml" };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'";
// like Cloudflare Pages: /name answers name.html; /api/* is not there (the pages must cope)
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let p = decodeURIComponent(u.pathname);
  const send = (f, code = 200) => { res.writeHead(code, { "Content-Type": MIME[extname(f)] || "application/octet-stream", "Cache-Control": "no-store", "Content-Security-Policy": CSP }); res.end(readFileSync(f)); };
  if (p.startsWith("/api/")) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end('{"error":"not available in this check"}'); }
  if (p.endsWith("/")) p += "index.html";
  for (const f of [join(PUB, p), join(PUB, p + ".html")]) if (f.startsWith(PUB) && existsSync(f) && statSync(f).isFile()) return send(f);
  send(join(PUB, "404.html"), 404);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const BASE = "http://127.0.0.1:" + server.address().port;

const ALL = { index: "/", "how-it-works": "/how-it-works", guide: "/organizer-guide", brochure: "/brochure", refer: "/partner", privacy: "/privacy.html", signin: "/signin", notfound: "/no-such-page", console: "/zc", demo: "/demo", pricing: "/pricing.html" };
const PAGES = (process.argv[2] || Object.keys(ALL).join(",")).split(",");
const WIDTHS = (process.argv[3] || "360,390,768,1280,1920").split(",").map(Number);
const heightFor = (w) => (w < 700 ? 800 : w < 1100 ? 900 : 1000);
const SIX = ["How it works", "Free demo game", "Guide", "Brochure", "Refer & earn", "Log in"];

const chrome = await launchChrome();
const results = [];
try {
  for (const name of PAGES) for (const w of WIDTHS) for (const scheme of ["light", "dark"]) {
    const ctx = await chrome.browser.newContext({ viewport: { width: w, height: heightFor(w) }, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const problems = [], external = [];
    page.on("console", (m) => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) problems.push("console: " + m.text().slice(0, 150)); });
    page.on("pageerror", (e) => problems.push("pageerror: " + e.message.slice(0, 150)));
    page.on("request", (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) external.push(r.url().slice(0, 100)); });
    await page.goto(BASE + ALL[name], { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(([w, six]) => {
      const q = (s) => document.querySelector(s), vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
      const nav = q(".ck-nav"), menu = q("#ck-menu"), links = nav ? [...nav.querySelectorAll(":scope>a")] : [];
      const over = []; for (const el of document.querySelectorAll("body *")) { const r = el.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1 && getComputedStyle(el).position !== "fixed") { over.push(el.tagName.toLowerCase() + "." + String(el.className).slice(0, 30)); if (over.length > 3) break; } }
      return { pageX: document.documentElement.scrollWidth > innerWidth + 1, over, fonts: document.fonts.check("700 20px Fraunces") && document.fonts.check("16px Inter"), labels: links.map((a) => a.textContent.trim()), oneRow: new Set(links.filter(vis).map((a) => Math.round(a.getBoundingClientRect().top))).size === 1, menuShown: menu ? vis(menu) : null, navShown: nav ? vis(nav) : null, dots: document.querySelectorAll(".ck-dots button").length, hasBar: !!q(".cgb"), h1: (q("h1") || {}).textContent || "", bg: getComputedStyle(document.body).backgroundColor };
    }, [w, SIX]);
    const bad = [];
    if (m.pageX) bad.push("page scrolls sideways: " + m.over.join(","));
    if (!m.fonts) bad.push("self-hosted fonts did not load");
    if (name !== "console" && name !== "demo") {
      if (JSON.stringify(m.labels) !== JSON.stringify(SIX)) bad.push("header labels: " + JSON.stringify(m.labels));
      if (w >= 1024 && !m.oneRow) bad.push("header menu is not one row");
      if (w >= 1024 && m.menuShown) bad.push("Menu button shown on a laptop");
      if (w < 1024 && (!m.menuShown || m.navShown)) bad.push("phone menu is not collapsed");
      if (m.dots !== 3) bad.push("colour dots: " + m.dots);
      if (!m.hasBar) bad.push("games bar missing");
    }
    bad.push(...problems); if (external.length) bad.push("outside request: " + external.join(" "));
    await page.screenshot({ path: `${OUT}/${name}-${w}-${scheme}.png`, fullPage: name === "index" && (w === 390 || w === 1280) });
    // the phone menu opened (one shot per phone width, light)
    if (w < 1024 && scheme === "light" && name === "index") { await page.click("#ck-menu"); await page.screenshot({ path: `${OUT}/${name}-${w}-menu-open.png` }); }
    // keyboard: Tab through the top of the page, record what gets focus
    if (name === "index" && w === 1280 && scheme === "light") {
      const seq = []; for (let i = 0; i < 24; i++) { await page.keyboard.press("Tab"); seq.push(await page.evaluate(() => { const e = document.activeElement; return (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().replace(/\s+/g, " ").slice(0, 40); })); }
      await page.screenshot({ path: `${OUT}/index-1280-tab-walk.png` });
      writeFileSync(`${OUT}/tab-order-1280.json`, JSON.stringify(seq, null, 1));
      const at = SIX.map((l) => seq.findIndex((s) => s === l)); if (at.some((i) => i < 0) || at.some((v, i) => i && v <= at[i - 1])) bad.push("Tab does not reach the six menu items in order: " + JSON.stringify(at));
    }
    results.push({ page: name, w, scheme, ok: bad.length === 0, bad, h1: m.h1.slice(0, 80) });
    await ctx.close();
  }
} finally { await chrome.close(); server.close(); }
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
const badOnes = results.filter((r) => !r.ok);
console.log(results.length, "shots;", badOnes.length, "with problems");
for (const r of badOnes.slice(0, 40)) console.log(r.page, r.w, r.scheme, "->", r.bad.join(" | ").slice(0, 200));
process.exit(badOnes.length ? 1 : 0);
