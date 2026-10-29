// Proves each new site test can FAIL: breaks one thing, runs the tests, expects red, puts the file back byte for byte.
//   bun run tools/site-brand/plant_check.ts        (from the repository root; about a minute)
// One line per plant: the thing broken, how many tests failed, the first one. Exit code 1 if any plant stayed green or the restore left a failure.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", ".."), PUB = join(ROOT, "apps/web/public");
const TESTS = ["apps/web/test/brand-site.test.ts", "apps/web/test/gamesbar.test.ts", "apps/web/test/seo.test.ts", "apps/web/test/site-verify.test.ts", "apps/web/test/visits-dom.test.ts", "apps/web/test/legal-sync.test.ts",
  "apps/edge/test/pdf-badge.test.ts", "apps/edge/test/terms.test.ts", "apps/edge/test/no-other-game-words.test.ts", "apps/edge/test/pay.test.ts"];

function run(): string[] {
  const r = Bun.spawnSync([process.execPath, "test", "--isolate", ...TESTS], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const out = r.stdout.toString() + r.stderr.toString();
  if (!/^ *\d+ pass/m.test(out)) throw new Error("bun did not run the tests: " + out.slice(-300));
  return [...out.matchAll(/^\(fail\) (.*?)(?: \[\d+\.\d+ms\])?$/gm)].map((m) => m[1]!);
}
const sub = (a: string, b: string) => (d: Buffer) => { const t = d.toString("utf8"); if (!t.includes(a)) throw new Error("plant text not found: " + a); return Buffer.from(t.replace(a, b), "utf8"); };

// a file name starting with "@" is relative to the repository root, any other to apps/web/public
const PLANTS: [string, string, (d: Buffer) => Buffer][] = [
  ["brand kit file edited (tokens.css gets one more space)", "tokens.css", (d) => Buffer.concat([d, Buffer.from(" ")])],
  ["games bar copy edited (gamesbar.css)", "gamesbar.css", (d) => Buffer.concat([d, Buffer.from("\n/* x */")])],
  ["logo file changed (logo.svg)", "logo.svg", sub("#6A2BD9", "#6A2BD8")],
  ["a font changed (Inter)", "fonts/Inter-normal-400.woff2", (d) => { const b = Buffer.from(d); b.writeUInt8(b[b.length - 1]! ^ 1, b.length - 1); return b; }],
  ["menu: Guide renamed to Pricing on the home page", "index.html", sub(">Guide</a>", ">Pricing</a>")],
  ["menu: an AI assistant item added to the header of about.html", "about.html", sub('<a href="/#login" class="login" id="loginLink">Log in</a>', '<a href="/ai">Free AI assistant</a><a href="/#login" class="login" id="loginLink">Log in</a>')],
  ["menu: order changed on how-it-works.html (Brochure before Guide)", "how-it-works.html", sub('<a href="/organizer-guide">Guide</a><a href="/brochure">Brochure</a>', '<a href="/brochure">Brochure</a><a href="/organizer-guide">Guide</a>')],
  ["the banned word added to a legal page", "terms.html", sub("<h1>", "<h1>private ")],
  ["canonical address wrong on contact.html", "contact.html", sub('<link rel="canonical" href="https://luck.corporatetambola.com/contact.html">', '<link rel="canonical" href="https://luck.corporatetambola.com/contact">')],
  ["share image pointed at the old card", "dpa.html", sub('content="https://luck.corporatetambola.com/og-card.png"><meta property="og:image:width"', 'content="https://luck.corporatetambola.com/img/card.png"><meta property="og:image:width"')],
  ["sitemap loses How it works", "sitemap.xml", (d) => Buffer.from(d.toString("utf8").replace(/<url><loc>[^<]*how-it-works[^\n]*\n/, ""))],
  ["version number removed from a brand css link", "privacy.html", sub("/components.css?v=2", "/components.css")],
  ["service worker version put back to 6", "zsw.js", sub("luck-game-v7", "luck-game-v6")],
  ["share card replaced by a 32 px icon", "og-card.png", () => readFileSync(join(PUB, "favicon-32.png"))],
  ["footer legal link points to another game's site", "pricing.html", sub('href="/terms.html">Terms', 'href="https://housie.corporatetambola.com/terms">Terms')],
  ["the old 6 / 15 second choice back on How it works", "how-it-works.html", sub("<h2 id=\"sh\">The five steps</h2>", "<h2 id=\"sh\">The five steps (6, 10 or 15 seconds)</h2>")],
  ["current page mark removed from the Brochure page", "brochure.html", sub(' aria-current="page"', "")],
  ["the games bar loaded on the play page", "z.html", sub("</head>", '<script src="/gamesbar.js?v=3" defer></script></head>')],
  // ---- added with the whole-site verifier (tools/site-brand/verify-site.ts), the PDF badge and the repaired tests
  ["Free demo game points at the console again (/zc?demo=1) in a footer", "contact.html", sub('<li><a href="/demo.html">Free demo game</a></li>', '<li><a href="/zc?demo=1">Free demo game</a></li>')],
  ["the badge drawn in a page is not the one of logo.svg (verifier R02)", "index.html", sub('<symbol id="i-luck" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#6A2BD9"/>', '<symbol id="i-luck" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#6A2BD8"/>')],
  ["the banned word in a player script (verifier R04)", "luck.js", (d) => Buffer.concat([d, Buffer.from('\nvar note = "a private game";\n')])],
  ["a page links the old stylesheet version (two versions of luck-site.css, verifier R06)", "about.html", sub("luck-site.css?v=3", "luck-site.css?v=2")],
  ["service worker stops saving the console style sheet (verifier R07)", "zsw.js", sub('"/zc.js", "/zc.css", "/big.js"', '"/zc.js", "/big.js"')],
  ["a dead internal link in a footer (verifier R08)", "dpa.html", sub('href="/refund-policy.html">Refund policy', 'href="/refund-policyy.html">Refund policy')],
  ["a link to console.corporatetambola.com (verifier R08 and R13)", "about.html", sub("Online games for company events, for the people you invite.", 'Online games for company events, for the people you invite. <a href="https://console.corporatetambola.com/">Console</a>')],
  ["the footer stops naming Razorpay (verifier R10)", "pricing.html", sub("All payments are taken only by IT Services by Rajat Agarwal, through Razorpay.", "Payments are collected by IT Services by Rajat Agarwal.")],
  ["another payment gateway named in the pay screen (verifier R10)", "pay.js", (d) => Buffer.concat([d, Buffer.from("\n// pay with Stripe too\n")])],
  ["the privacy page names the payee by half its name (verifier R10)", "privacy.html", sub("The payment service of IT Services by Rajat Agarwal", "The IT Services payment service")],
  ["console logic touched (a comment added to zc.js; verifier R11)", "zc.js", (d) => Buffer.concat([d, Buffer.from("\n// touched\n")])],
  ["the console loses the brand shell (host.html without tokens.css; verifier R11)", "host.html", sub('<link rel="stylesheet" href="/tokens.css?v=2">', "")],
  ["the brochure loses its one-page A4 print layout (verifier R12)", "luck-site.css", sub("@page{size:A4;margin:8mm}", "@page{margin:8mm}")],
  ["brochure PDF tool goes back to a file:// address (verifier R12)", "@tools/make-brochure.mjs", sub("`http://127.0.0.1:${server.address().port}/brochure`", 'new URL("../apps/web/public/brochure.html", import.meta.url).href')],
  ["the e-mail header icon is a different version from the pages' (verifier R12)", "@apps/edge/src/brand.ts", sub("/icon-192.png?v=3", "/icon-192.png?v=2")],
  ["the report PDF loses the badge (pdf-badge test and verifier R12)", "@apps/edge/src/report-layout.ts", sub("  pdf.badge(pdf.M, pdf.H - 14, 64);", "")],
  ["the people-part PDF loses the badge", "@apps/edge/src/report-layout.ts", sub("  pdf.badge(pdf.M, pdf.H - 11, 48);", "")],
  ["the invoice PDF loses the badge (pay test)", "@apps/edge/src/pay.ts", sub("pdf.badge(pdf.M, pdf.y, 40); ", "")],
  ["the PDF accent goes back to the old gold", "@apps/edge/src/pdf.ts", sub("GOLD: Rgb = [1, 0.788, 0.235]", "GOLD: Rgb = [0.788, 0.635, 0.29]")],
  ["a stray $1 and a <details> without its <summary> on the Refer & earn page (verifier R14)", "partner.html", sub("<details><summary>Does it cost anything?</summary>", "$1</summary>")],
  ["a hard-coded white card in the Refer & earn style sheet (verifier R15: unreadable in dark mode)", "partner.css", sub(".rstep,.rbox{background:var(--paper);", ".rstep,.rbox{background:#fff;")],
  ["the table wrapper on the terms page cannot be reached by keyboard (verifier R16)", "terms.html", sub('<div class="tw" tabindex="0" role="region"', '<div class="tw" role="region"')],
  ["the home page loses its top section id (visit tracker test)", "index.html", sub('<section class="ck-hero g-luck" id="top"', '<section class="ck-hero g-luck"')],
  ["the legal position page says Corporate Tambola again (legal-sync test)", "@site/legal-position.html", sub("and Corporate Luck by Chance is software supplied as a service", "and Corporate Tambola is software supplied as a service")],
  ["a sister game's word on a page outside the kit's own parts (no-other-game-words test)", "about.html", sub("<h1>", "<h1>Bingo ")],
  ["the header of a document page has no ck-top class (terms test)", "terms.html", sub('<header class="ck-top">', '<header class="top">')],
];

const base = run(); console.log("baseline failing tests (must be none):", base);
if (base.length) process.exit(2);
let bad = 0;
for (const [name, f, fn] of PLANTS) {
  const path = f.startsWith("@") ? join(ROOT, f.slice(1)) : join(PUB, f), orig = readFileSync(path);
  let fails: string[];
  try { writeFileSync(path, fn(orig)); fails = run(); } finally { writeFileSync(path, orig); }
  if (!fails.length) bad++;
  console.log(`${fails.length ? "RED (good)" : "STAYED GREEN (bad)"}`.padEnd(20), name, "->", fails.length, "failing; first:", (fails[0] ?? "-").slice(0, 110));
}
const after = run(); console.log("after restore, failing tests:", after);
process.exit(bad || after.length ? 1 : 0);
