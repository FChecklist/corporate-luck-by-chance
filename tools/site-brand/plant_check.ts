// Proves each new site test can FAIL: breaks one thing, runs the tests, expects red, puts the file back byte for byte.
//   bun run tools/site-brand/plant_check.ts        (from the repository root; about a minute)
// One line per plant: the thing broken, how many tests failed, the first one. Exit code 1 if any plant stayed green or the restore left a failure.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", ".."), PUB = join(ROOT, "apps/web/public");
const TESTS = ["apps/web/test/brand-site.test.ts", "apps/web/test/gamesbar.test.ts", "apps/web/test/seo.test.ts"];

function run(): string[] {
  const r = Bun.spawnSync([process.execPath, "test", ...TESTS], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const out = r.stdout.toString() + r.stderr.toString();
  if (!/^ *\d+ pass/m.test(out)) throw new Error("bun did not run the tests: " + out.slice(-300));
  return [...out.matchAll(/^\(fail\) (.*?)(?: \[\d+\.\d+ms\])?$/gm)].map((m) => m[1]!);
}
const sub = (a: string, b: string) => (d: Buffer) => { const t = d.toString("utf8"); if (!t.includes(a)) throw new Error("plant text not found: " + a); return Buffer.from(t.replace(a, b), "utf8"); };

const PLANTS: [string, string, (d: Buffer) => Buffer][] = [
  ["brand kit file edited (tokens.css gets one more space)", "tokens.css", (d) => Buffer.concat([d, Buffer.from(" ")])],
  ["games bar copy edited (gamesbar.css)", "gamesbar.css", (d) => Buffer.concat([d, Buffer.from("\n/* x */")])],
  ["logo file changed (logo.svg)", "logo.svg", sub("#6A2BD9", "#6A2BD8")],
  ["a font changed (Inter)", "fonts/Inter-normal-400.woff2", (d) => { const b = Buffer.from(d); b[b.length - 1] ^= 1; return b; }],
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
];

const base = run(); console.log("baseline failing tests (must be none):", base);
if (base.length) process.exit(2);
let bad = 0;
for (const [name, f, fn] of PLANTS) {
  const path = join(PUB, f), orig = readFileSync(path);
  let fails: string[];
  try { writeFileSync(path, fn(orig)); fails = run(); } finally { writeFileSync(path, orig); }
  if (!fails.length) bad++;
  console.log(`${fails.length ? "RED (good)" : "STAYED GREEN (bad)"}`.padEnd(20), name, "->", fails.length, "failing; first:", (fails[0] ?? "-").slice(0, 110));
}
const after = run(); console.log("after restore, failing tests:", after);
process.exit(bad || after.length ? 1 : 0);
