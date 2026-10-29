// Checks every page of the website against the owner's list of 29 Oct 2026 and prints one line per rule.
//   bun run tools/site-brand/verify-site.ts        (from the repository root; builds pages/public first, as the deploy would, and reads that)
// Exit code 1 when any rule fails. apps/web/test/site-verify.test.ts runs the same checks, and tools/site-brand/plant_check.ts breaks each rule on purpose to prove it can fail.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { headerHtml } from "../../apps/edge/src/brand";
import { layoutPeoplePart, layoutReport } from "../../apps/edge/src/report-layout";

const ROOT = join(import.meta.dir, "..", ".."), PUB = join(ROOT, "apps/web/public"), OUT = join(ROOT, "pages/public");
const ORIGIN = "https://luck.corporatetambola.com";
const SIX = ["How it works", "Free demo game", "Guide", "Brochure", "Refer & earn", "Log in"];
const SIX_HREFS = ["/how-it-works", "/demo.html", "/organizer-guide", "/brochure", "/partner", "/#login"];
const WEBSITE = ["index", "how-it-works", "about", "contact", "pricing", "legal", "terms", "privacy", "legal-position", "refund-policy", "dpa", "subprocessors", "partner-terms", "organizer-guide", "brochure", "partner", "helpdesk", "signin", "404", "trust"];
const GAME_PAGES = ["z", "zc", "host", "big", "demo", "offline"]; // saved on the phone by the service worker
const APP_PAGES = ["z", "zc", "host", "big", "pay", "paylink", "paytest", "report", "preview", "demo", "ai-link", "helpdesk-accept", "helpdesk-approve", "offline", "owner-visits"];
const BUNDLES = new Set(["luck-engine.js", "control.js", "zgame.js", "reportgen.js"]); // built files: not read for wording
const EXTERNAL_OK = /^(([a-z]+\.)?corporatetambola\.com|itservices-rajat-agarwal\.pages\.dev|checkout\.razorpay\.com|accounts\.google\.com|www\.youtube-nocookie\.com|wa\.me|schema\.org|www\.sitemaps\.org|www\.w3\.org|chatgpt\.com|claude\.ai|gemini\.google\.com|grok\.com|chat\.deepseek\.com|chat\.z\.ai)$/;
const CONSOLE_FILES = ["zc.js", "host.js", "z.js", "big.js", "control.js", "zgame.js", "pay.js", "paylink.js", "luck.js", "luck-run.js", "common.js"]; // console and game logic: the site work must not touch them

export type Problem = { rule: string; page: string; detail: string };
const rd = (dir: string, f: string) => readFileSync(join(dir, f), "utf8");
const sha = (dir: string, f: string, text = !/\.(woff2|png|ico)$/.test(f)) => { let b = readFileSync(join(dir, f)); if (text) b = Buffer.from(b.toString("utf8").split("\r").join("")); return createHash("sha256").update(b).digest("hex"); };
const htmlFiles = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".html"));
const navOf = (h: string) => /<nav class="ck-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(h)?.[1] ?? "";
const NODOTS = (n: string) => n.replace(/<span class="ck-dots"[\s\S]*?<\/span>/, "");
const refs = (h: string) => [...h.matchAll(/<(?:a|link|script|img|source)\b[^>]*?\b(?:href|src)="([^"]*)"/g)].map((m) => m[1]!);
const unq = (s: string) => s.replace(/&amp;/g, "&");

function build() { const r = Bun.spawnSync([process.execPath, join(ROOT, "pages/build.mjs")], { cwd: ROOT, stdout: "pipe", stderr: "pipe" }); if (r.exitCode !== 0) throw new Error("pages build failed: " + r.stderr.toString().slice(-300)); }

/** Where a link ends up on Cloudflare Pages: the file, the file with .html, or the folder's index. */
const landing = (path: string): string | null => { const p = path === "/" ? "/index.html" : path; for (const c of [p, p + ".html", p.replace(/\/$/, "") + "/index.html"]) if (existsSync(join(OUT, c)) && !c.endsWith("/")) return c; return null; };

export function verifySite(opts: { skipBuild?: boolean } = {}): { problems: Problem[]; notes: string[]; rules: string[] } {
  if (!opts.skipBuild) build();
  const problems: Problem[] = [], notes: string[] = [], rules: string[] = [];
  const bad = (rule: string, page: string, detail: string) => problems.push({ rule, page, detail });
  const rule = (id: string, text: string, fn: () => void) => { rules.push(`${id} ${text}`); fn(); };
  const pages = htmlFiles(PUB).map((f) => f.slice(0, -5));
  const pins: Record<string, string> = JSON.parse(readFileSync(join(ROOT, "apps/web/test/brand-kit.pins.json"), "utf8"));
  const ownText = (dir: string) => readdirSync(dir).filter((f) => /\.(html|js|css|txt|xml|webmanifest|svg)$/.test(f) && !BUNDLES.has(f));

  rule("R01", "header menu is exactly six items in the owner's order, with the right links, on every website page", () => {
    for (const p of WEBSITE) {
      const h = rd(PUB, p + ".html"), n = NODOTS(navOf(h));
      const labels = [...n.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((m) => unq(m[1]!).trim()), hrefs = [...n.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]!);
      if (JSON.stringify(labels) !== JSON.stringify(SIX)) bad("R01", p, "labels: " + labels.join(" | "));
      else if (JSON.stringify(hrefs) !== JSON.stringify(SIX_HREFS)) bad("R01", p, "links: " + hrefs.join(" "));
      if ((h.match(/class="ck-top"/g) ?? []).length !== 1) bad("R01", p, "needs exactly one header");
    }
    for (const p of pages) if (!WEBSITE.includes(p) && /class="ck-top"/.test(rd(PUB, p + ".html"))) bad("R01", p, "has the website header but is not in the website page list of tools/site-brand/verify-site.ts");
  });

  rule("R02", "CORPORATE line above the name 'Luck by Chance', the badge drawn in the page equals logo.svg, skip link and main landmark", () => {
    const logoInner = rd(PUB, "logo.svg").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<title>[^<]*<\/title>/, "").replace(/<\/svg>\s*$/, "").trim();
    for (const p of WEBSITE) {
      const h = rd(PUB, p + ".html");
      if (!h.includes('<span class="ck-name"><i>Corporate</i><b>Luck by Chance</b></span>')) bad("R02", p, "brand block differs");
      const sym = /<symbol id="i-luck"[^>]*>([\s\S]*?)<\/symbol>/.exec(h)?.[1]?.trim();
      if (sym !== logoInner) bad("R02", p, "the i-luck badge in the page is not the one in logo.svg");
      if (!h.includes('<a class="ck-skip" href="#main">') || !h.includes('id="main"')) bad("R02", p, "skip link or main landmark missing");
    }
  });

  rule("R03", "logo, icon, font, css and games-bar files are byte-identical to the pinned brand kit (and the pins agree with each other)", () => {
    for (const [f, want] of Object.entries(pins)) { if (!existsSync(join(PUB, f))) bad("R03", f, "missing"); else if (sha(PUB, f) !== want) bad("R03", f, "differs from its pin"); }
    if (pins["logo.svg"] !== pins["favicon.svg"] || pins["logo.svg"] !== pins["logo-mark.svg"]) bad("R03", "logo.svg", "logo, logo-mark and favicon must be the same file");
    for (const f of ["logo.svg", "logo-mark.svg", "favicon.svg", "icon-192.png", "icon-512.png", "og-card.png", "tokens.css", "components.css", "fonts/Inter-normal-400.woff2"]) if (!existsSync(join(OUT, f)) || sha(OUT, f) !== pins[f]) bad("R03", f, "the built site (pages/public) does not carry it unchanged");
    for (const p of WEBSITE) if (/<img[^>]+logo-512|<img[^>]+old-logo/i.test(rd(PUB, p + ".html"))) bad("R03", p, "uses a logo image that is not in the kit");
  });

  rule("R04", "no 'private' in any public page, player script, text, legal copy or the consent text (comments excluded); English only (no other script)", () => {
    const ORGANIZER_JS = new Set(["zc.js", "host.js", "ai-link.js", "owner-desk.js", "owner-visits.js", "report.js"]); // organizer and owner screens: not player-facing, and the console may not change
    const code = (f: string, t: string) => (f.endsWith(".js") || f.endsWith(".css") ? t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[\s;{}])\/\/[^\n]*/g, "$1") : t);
    for (const f of [...ownText(PUB).filter((x) => !ORGANIZER_JS.has(x)).map((x) => join(PUB, x)), ...readdirSync(join(ROOT, "site")).filter((x) => x.endsWith(".html")).map((x) => join(ROOT, "site", x)), join(ROOT, "apps/edge/src/consent-text.json"), join(ROOT, "apps/edge/src/trust-page.ts"), join(ROOT, "apps/edge/src/site-shell.ts")]) {
      const raw = readFileSync(f, "utf8"), t = code(f, raw), short = f.slice(ROOT.length + 1);
      if (/\bprivate\b/i.test(t)) bad("R04", short, "contains the word private");
      if (/[ऀ-ॿ؀-ۿ一-鿿Ѐ-ӿঀ-৿஀-௿]/.test(t)) bad("R04", short, "contains letters of another script");
    }
    const mails = readFileSync(join(ROOT, "apps/edge/src/mails.ts"), "utf8");
    if (/\bprivate\b/i.test(mails)) notes.push("note: apps/edge/src/mails.ts says 'Keep it private' in the Host link mails (sent to Hosts, never to players): not changed");
    const org = [...ORGANIZER_JS].filter((f) => /\bprivate\b/i.test(code(f, rd(PUB, f))));
    if (org.length) notes.push(`note: the organizer console (${org.join(", ")}) says 'private link' in its own help lines: organizer-facing, and the owner's order forbids changing the console, so not changed`);
  });

  rule("R05", "canonical, og and twitter tags equal the page's own address; share card exists; theme colour; robots meta; sitemap lists exactly the indexable pages; robots.txt names the sitemap", () => {
    const sitemap = rd(PUB, "sitemap.xml"), listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    const robots = rd(PUB, "robots.txt"), everyone = robots.split(/\n\s*\n/)[0]!; // the group for every crawler
    if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) bad("R05", "robots.txt", "no Sitemap line");
    for (const p of WEBSITE) {
      const h = rd(PUB, p + ".html"), url = ORIGIN + (p === "index" ? "/" : "/" + p + ".html"), idx = !/<meta name="robots" content="[^"]*noindex/.test(h) && p !== "404";
      if (p !== "404") for (const [what, re] of [["canonical", /<link rel="canonical" href="([^"]+)"/], ["og:url", /<meta property="og:url" content="([^"]+)"/]] as const) if ((re.exec(h) ?? [])[1] !== url) bad("R05", p, `${what} is not ${url}`);
      for (const [what, re] of [["og:image", /<meta property="og:image" content="([^"]+)"/], ["twitter:image", /<meta name="twitter:image" content="([^"]+)"/]] as const) if ((re.exec(h) ?? [])[1] !== ORIGIN + "/og-card.png") bad("R05", p, `${what} is not the share card`);
      if (!h.includes('<meta name="theme-color" content="#0B3D91">')) bad("R05", p, "theme colour");
      if (!/<meta name="robots" content="/.test(h) && p !== "404") bad("R05", p, "no robots meta");
      if (idx && !listed.includes(url)) bad("R05", p, "indexable but not in sitemap.xml");
      if (!idx && listed.includes(url)) bad("R05", p, "not indexable but listed in sitemap.xml");
      if (idx && !/<meta name="description" content="[^"]{20,}"/.test(h)) bad("R05", p, "no description");
      if (idx && new RegExp(`^Disallow: /${p === "index" ? "index\\.html" : p + "\\.html"}$`, "m").test(everyone)) bad("R05", p, "robots.txt disallows an indexable page");
    }
    for (const u of listed) if (!u.startsWith(ORIGIN) || !landing(u.slice(ORIGIN.length))) bad("R05", "sitemap.xml", "lists " + u + " which does not exist");
  });

  rule("R06", "every brand css/js link of every page carries ?v=, and no file has two version numbers across the site; css and js are no-cache in the built _headers", () => {
    const seen: Record<string, Set<string>> = {}, plain: Set<string> = new Set();
    for (const p of pages) for (const m of rd(PUB, p + ".html").matchAll(/(?:<link rel="stylesheet" href|<script src)="(\/[^"?]+\.(?:css|js))(\?v=\d+)?"/g)) {
      (seen[m[1]!] ??= new Set()).add(m[2] ?? "");
      if (!m[2]) plain.add(m[1]!);
      if (!m[2] && /^\/(tokens|components|console|luck-site|luck-shell|luck-legacy|fonts|fonts-app|theme-init|brandkit|gamesbar)\.(css|js)$/.test(m[1]!)) bad("R06", p, m[1] + " has no ?v=");
    }
    for (const [f, v] of Object.entries(seen)) if ([...v].filter(Boolean).length > 1) bad("R06", f, "two version numbers in use: " + [...v].join(", "));
    notes.push(`note: ${plain.size} older app files (${[...plain].slice(0, 6).join(" ")}${plain.size > 6 ? " ..." : ""}) are linked without ?v=; the built _headers make every css and js no-cache, so a changed file is fetched again`);
    const hd = rd(OUT, "_headers");
    for (const k of ["css", "js"]) if (!new RegExp(`^/\\*\\.${k}\\n  Cache-Control: no-cache$`, "m").test(hd)) bad("R06", "_headers", `/*.${k} is not no-cache`);
    if (!/^\/version\.json\n  Cache-Control: no-store/m.test(hd)) bad("R06", "_headers", "version.json is not no-store");
    for (const p of WEBSITE.filter((x) => x !== "404")) { const c = p === "index" ? "/" : "/" + p; if (!hd.includes(`\n${c}\n`) && !hd.includes(`${c}.html\n`) && c !== "/") bad("R06", p, "no header rule in the built _headers for " + c); }
  });

  rule("R07", "service worker: version raised, every file it saves exists, and it saves the css the game pages need offline", () => {
    const sw = rd(PUB, "zsw.js"), v = Number(/CACHE = "luck-game-v(\d+)"/.exec(sw)?.[1] ?? 0);
    if (v < 7) bad("R07", "zsw.js", "cache version is " + v + ", must be 7 or more after the new look");
    const files = [...(/const FILES = \[([\s\S]*?)\];/.exec(sw)?.[1] ?? "").matchAll(/"(\/[^"]+)"/g)].map((m) => m[1]!);
    for (const f of files) if (!landing(f)) bad("R07", "zsw.js", "saves " + f + " which the site does not ship");
    for (const p of GAME_PAGES) for (const m of rd(PUB, p + ".html").matchAll(/<link rel="stylesheet" href="(\/[^"?]+\.css)/g)) if (!files.includes(m[1]!)) bad("R07", p, m[1] + " is not saved by the service worker, so the page loses its look offline");
    if (!/<link rel="manifest" href="\/manifest\.webmanifest">/.test(rd(PUB, "z.html"))) bad("R07", "z.html", "no manifest link");
    const m = JSON.parse(rd(PUB, "manifest.webmanifest"));
    for (const i of m.icons) if (!landing(i.src.split("?")[0])) bad("R07", "manifest", i.src + " missing");
    if (m.theme_color !== "#0B3D91" || m.name !== "Corporate Luck by Chance") bad("R07", "manifest", "name or theme colour");
  });

  rule("R08", "every internal link, script, style, image, font and fragment resolves in the built site; no link to console.corporatetambola.com; only known outside hosts", () => {
    const hosts = new Set<string>();
    for (const f of htmlFiles(OUT)) {
      const p = f.slice(0, -5), h = rd(OUT, f);
      for (const raw of refs(h)) {
        const r = unq(raw);
        if (!r || r.startsWith("mailto:") || r.startsWith("tel:") || r.startsWith("javascript:") || r.startsWith("data:")) continue;
        if (/^https?:\/\//.test(r)) { const host = new URL(r).host; hosts.add(host); if (/^console\.corporatetambola\.com$/.test(host)) bad("R08", p, "links to console.corporatetambola.com, which does not exist yet"); if (!EXTERNAL_OK.test(host)) bad("R08", p, "outside host not on the list: " + host); const own = host === "luck.corporatetambola.com" ? new URL(r).pathname : ""; if (own && !landing(own)) bad("R08", p, "own address does not resolve: " + r); continue; }
        if (r.startsWith("#")) { if (r !== "#" && r !== "#login" && !new RegExp(`id="${r.slice(1)}"`).test(h)) bad("R08", p, "no element for " + r); continue; }
        const u = new URL(r, "https://x/" + (p === "index" ? "" : p)), path = u.pathname;
        if (/^\/(api|ai|j)\//.test(path)) continue; // answered by the Worker
        const t = landing(path);
        if (!t) bad("R08", p, "dead link " + r);
        else if (u.hash && u.hash !== "#login" && t.endsWith(".html") && !new RegExp(`id="${u.hash.slice(1)}"`).test(rd(OUT, t.slice(1)))) bad("R08", p, `no ${u.hash} in ${t}`);
      }
      for (const m of h.matchAll(/<use href="#([^"]+)"/g)) if (!h.includes(`id="${m[1]}"`)) bad("R08", p, "icon #" + m[1] + " is used but not drawn in the page");
    }
    for (const f of readdirSync(OUT).filter((x) => x.endsWith(".css"))) for (const m of rd(OUT, f).matchAll(/url\(["']?(\/[^)"'?#]+)/g)) if (!landing(m[1]!)) bad("R08", f, "css url " + m[1] + " does not resolve");
    notes.push("note: outside hosts linked: " + [...hosts].sort().join(", "));
  });

  rule("R09", "'Free demo game' opens a page that works on this code (the one-person try-it page), not the console, which has no demo mode", () => {
    for (const p of WEBSITE) if (/demo=1/.test(rd(PUB, p + ".html"))) bad("R09", p, "links to ?demo=1");
    if (/[?&]demo=|get\("demo"\)/.test(rd(PUB, "zc.js"))) notes.push("note: zc.js now reads ?demo=; the header may point at the real 10-person game");
    const d = rd(PUB, "demo.html"), j = rd(PUB, "demo.js");
    if (!d.includes('<script src="/demo.js"') || !d.includes('/luck-engine.js') || !j.includes("LuckEngine") || !landing("/demo.html")) bad("R09", "demo.html", "the try-it page is not wired to the dice engine");
    if (!existsSync(join(ROOT, "apps/edge/migrations")) || !/\b10\b[^\n]{0,40}\b0\b/.test(readFileSync(join(ROOT, "packages/shared/src/pricing.ts"), "utf8").split("\n").find((l) => l.includes("PACKS:")) ?? "")) notes.push("note: no Rs 0 pack for 10 people exists in packages/shared/src/pricing.ts; the home page, the trust list and the brochure still promise 'a free demo game for 10 people'");
  });

  rule("R10", "payments: every page, e-mail, receipt and PDF that names the payee says IT Services by Rajat Agarwal and Razorpay; no other payee, no other gateway", () => {
    const FOOT = "All payments are taken only by IT Services by Rajat Agarwal, through Razorpay.";
    for (const p of WEBSITE) if (!rd(PUB, p + ".html").includes(FOOT)) bad("R10", p, "footer does not say: " + FOOT);
    if (!rd(PUB, "pay.js").includes("Payment to <a") || !/Payment to[^<]*<a[^>]*>IT Services by Rajat Agarwal<\/a>/.test(rd(PUB, "pay.js"))) bad("R10", "pay.js", "the pay screen does not name IT Services by Rajat Agarwal");
    if (!/Payment to[^<]*<a[^>]*>IT Services by Rajat Agarwal<\/a>/.test(rd(PUB, "paylink.js"))) bad("R10", "paylink.js", "the pay-link screen does not name IT Services by Rajat Agarwal");
    const bill = readFileSync(join(ROOT, "packages/billing/src/index.ts"), "utf8");
    if (!/This invoice is issued by IT Services by Rajat Agarwal[^"]*Online payments are processed by Razorpay/.test(bill) || !bill.includes('legalName: "IT Services by Rajat Agarwal"')) bad("R10", "packages/billing", "invoice terms or legal name");
    if (!/owned and made by IT Services by Rajat Agarwal/.test(readFileSync(join(ROOT, "apps/edge/src/pay.ts"), "utf8"))) bad("R10", "pay.ts", "checkout description");
    const files = [...ownText(PUB).map((x) => join(PUB, x)), ...["pay.ts", "mails.ts", "owner-mail.ts", "credit.ts", "cancel.ts", "report-layout.ts", "legal.ts", "trust-page.ts", "site-shell.ts", "ai-facts.ts"].map((x) => join(ROOT, "apps/edge/src", x)), join(ROOT, "packages/billing/src/index.ts")];
    for (const f of files) {
      const t = readFileSync(f, "utf8"), short = f.slice(ROOT.length + 1);
      const gw = t.match(/\b(stripe|paypal|paytm|phonepe|cashfree|payu|instamojo|ccavenue|billdesk|braintree|adyen|2checkout)\b/i);
      if (gw) bad("R10", short, "names another payment gateway: " + gw[0]);
      if (/IT Services/.test(t) && !/IT Services by Rajat Agarwal/i.test(t.replace(/<[^>]+>/g, ""))) bad("R10", short, "says 'IT Services' but never the full name 'IT Services by Rajat Agarwal'"); // the legal pages define the short form after the full name
      for (const m of t.matchAll(/IT Services (?!by Rajat Agarwal)(?:payment service|Payment service)/g)) bad("R10", short, "payee name cut short near: " + t.slice(Math.max(0, m.index! - 25), m.index! + 40).replace(/\s+/g, " "));
      for (const m of t.matchAll(/(?:payments? (?:is|are) (?:taken|collected|received|made) (?:only )?by|paid to|payable to|payment to|pay to)\s+(?:<[^>]+>)?([A-Z][A-Za-z.&' ]+)/g)) if (!/^IT Services by Rajat Agarwal/.test(m[1]!.trim())) bad("R10", short, "payee other than IT Services by Rajat Agarwal: " + m[0].slice(0, 70));
    }
  });

  rule("R11", "console and game pages keep their own markup: only the shell (tokens, shell css, fonts, icons, light mode, theme colour) in the head; their logic files are unchanged since master", () => {
    for (const p of APP_PAGES) {
      const h = rd(PUB, p + ".html");
      if (!/<link rel="stylesheet" href="\/tokens\.css\?v=\d+">/.test(h) || !/<link rel="stylesheet" href="\/luck-shell\.css\?v=\d+">/.test(h)) bad("R11", p, "tokens.css or luck-shell.css missing");
      if (!h.includes('<meta name="theme-color" content="#0B3D91">')) bad("R11", p, "theme colour");
      if (!/rel="icon"/.test(h) && !/rel="apple-touch-icon"/.test(h)) bad("R11", p, "no icon");
      if (!/<link rel="stylesheet" href="\/fonts\.css/.test(h) && p !== "owner-visits") bad("R11", p, "fonts.css missing"); // the owner's visits page is plain system type on purpose
    }
    const git = (...a: string[]) => Bun.spawnSync(["git", ...a], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
    const mb = git("merge-base", "origin/master", "HEAD"), base = mb.stdout.toString().trim(); // what this branch changed since it left master (master's own later changes are not ours)
    const g = mb.exitCode === 0 && base ? git("diff", "--name-only", base, "--", ...CONSOLE_FILES.map((f) => "apps/web/public/" + f)) : null;
    if (g && g.exitCode === 0) for (const f of g.stdout.toString().split("\n").filter(Boolean)) bad("R11", f, "console or game logic changed since master");
    else notes.push("note: git could not compare the console logic files with master here");
  });

  rule("R12", "the brochure prints on one A4 page, and the e-mail header and the report PDFs carry the new brand (badge, CORPORATE line, kit colours)", () => {
    if (!/<main id="main" class="ck-brochure">/.test(rd(PUB, "brochure.html"))) bad("R12", "brochure.html", "main is not marked ck-brochure");
    if (!/@page\{size:A4;/.test(rd(PUB, "luck-site.css")) || !/@media print\{[\s\S]*\.ck-brochure/.test(rd(PUB, "luck-site.css"))) bad("R12", "luck-site.css", "no one-page A4 print layout for the brochure");
    const gen = readFileSync(join(ROOT, "tools/make-brochure.mjs"), "utf8");
    if (!gen.includes("`http://127.0.0.1:${") || !gen.includes("/brochure`")) bad("R12", "make-brochure.mjs", "must print the page over http: its style sheets are linked from the site root");
    const mail = headerHtml("https://luck.corporatetambola.com"), icon = /icon-192\.png\?v=(\d+)/.exec(mail)?.[1], pageIcon = /icon-192\.png\?v=(\d+)/.exec(rd(PUB, "index.html"))?.[1];
    if (!icon || icon !== pageIcon) bad("R12", "brand.ts", `the e-mail header icon version (${icon}) is not the pages' (${pageIcon})`);
    if (!mail.includes(">Corporate</span>Luck by Chance") || !mail.includes("#0B3D91")) bad("R12", "brand.ts", "e-mail header lacks the CORPORATE line or the brand blue");
    const data: any = { engagementId: "V-1", organizerEmail: "a@b.in", sentAtMs: 1_800_000_000_000, scheduledMs: 1_799_990_000_000, firstNumberMs: 1_799_990_100_000, endMs: 1_799_995_000_000, endReason: "x", wasHeld: false, rounds: 1, callSeconds: 9, ticketsPerPerson: 1, cap: 100, inviteOnly: false, numbersCalled: 90, people: [], prizes: [], lucky: [], timeline: [], breaks: [], personalDeleteAtMs: 1_800_050_000_000, fullDeleteAtMs: 1_830_000_000_000 };
    for (const [what, bytes] of [["report", layoutReport(data)], ["people part", layoutPeoplePart(data, [], 1, 1)]] as const) { const t = Buffer.from(bytes).toString("latin1"); if (!t.includes("0.42 0.17 0.85 rg") || !t.includes("1 0.79 0.24 rg")) bad("R12", what + " PDF", "no badge or kit marigold"); if (!t.startsWith("%PDF-") || !/\/Type \/Pages[^\n]*\/Count [1-9]/.test(t)) bad("R12", what + " PDF", "not a readable PDF"); }
  });

  rule("R13", "no file of the repository mentions console.corporatetambola.com (that address does not exist yet)", () => {
    const g = Bun.spawnSync(["git", "grep", "-l", "console\\.corporatetambola\\.com", "--", "apps", "site", "pages/build.mjs", "packages", "config", "tools", ":!tools/site-brand/verify-site.ts", ":!tools/site-brand/plant_check.ts", ":!apps/web/test"], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
    for (const f of g.stdout.toString().split("\n").filter(Boolean)) bad("R13", f, "mentions console.corporatetambola.com");
  });

  rule("R14", "no leftovers of a bad text replacement ($1, undefined, NaN, [object Object]) and every <details> has its <summary>", () => {
    for (const p of pages) {
      const h = rd(PUB, p + ".html").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
      const m = /\$[1-9&]|\bundefined\b|\bNaN\b|\[object Object\]/.exec(h.replace(/<[^>]+>/g, " "));
      if (m) bad("R14", p, "leftover text: " + m[0]);
      if ((h.match(/<details\b/g) ?? []).length !== (h.match(/<summary\b/g) ?? []).length) bad("R14", p, "a <details> without a <summary>, or the other way round");
    }
  });

  rule("R15", "the style sheets of the website pages set no fixed light surface (white or cream backgrounds would be unreadable in dark mode); colours come from tokens.css", () => {
    for (const f of ["partner.css", "luck-site.css", "luck-shell.css"]) {
      const css = rd(PUB, f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media print\{[\s\S]*$/, ""); // paper has its own colours
      for (const m of css.matchAll(/background(?:-color)?:\s*(#fff(?:fff)?|#fffdf9|#f6f2e8|rgba\(255,\s*25\d,\s*2\d\d,\s*(?:1|\.[89]\d*)\))/gi)) bad("R15", f, "fixed light surface: " + m[0]);
    }
  });

  rule("R16", "a table wide enough to scroll sideways can be reached with the keyboard (tabindex on the scrolling wrapper)", () => {
    for (const p of WEBSITE) for (const m of rd(PUB, p + ".html").matchAll(/<div class="tw"([^>]*)>/g)) if (!/tabindex="0"/.test(m[1]!)) bad("R16", p, "scrolling table wrapper without tabindex");
  });

  return { problems, notes, rules };
}

if (import.meta.main) {
  const r = verifySite();
  for (const rule of r.rules) { const id = rule.slice(0, 3), n = r.problems.filter((p) => p.rule === id).length; console.log(`${n ? "FAIL" : "ok  "} ${rule}${n ? `  (${n} problem${n > 1 ? "s" : ""})` : ""}`); }
  for (const p of r.problems) console.log(`  ${p.rule} ${p.page}: ${p.detail}`);
  for (const n of r.notes) console.log(n);
  console.log(r.problems.length ? `${r.problems.length} problem(s)` : `all ${r.rules.length} rules pass`);
  process.exit(r.problems.length ? 1 : 0);
}
