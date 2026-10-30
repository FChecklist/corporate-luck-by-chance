// Nothing that is deployed (or that belongs to the Terms boxes) may carry an internal note: who asked for something, or any review or approval status.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(30_000); // it reads every deployed file; on a busy laptop that takes more than bun's 5 seconds
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PATTERN = /COUNSEL|\[●\]|legal(ly)?\s+(review|pending|sign-?off)|review\s+pending|pending\s+(legal|review|approval)|awaiting\s+(legal|counsel|lawyer|approval|review)|\blawyer\b|\badvocate\b|owner'?s?\s+(told|instruction|order|directive|decision)|\bTODO\b|\bFIXME\b|under review|not yet (reviewed|approved)/i;
const LEGAL_ONLY = /draft/i; // on the legal pages only: the bare word is fine elsewhere (a draft game)
const LEGAL_PAGES = ["terms.html", "privacy.html", "legal.html", "refund-policy.html", "about.html", "contact.html", "pricing.html", "dpa.html", "subprocessors.html", "partner-terms.html"];
const ROOT = new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SKIP_DIR = new Set(["node_modules", "vendor", ".git", "fonts", "img", ".wrangler"]);
const TEXT = /\.(html|js|css|txt|xml|json|webmanifest|md|toml|py|mjs|ts|sql)$|^_headers$|^_routes\.json$/;

// The ONE exemption: the vendored console pack names the class of its "not ready" card `todo` (CSS `.zf-ready.todo`, JS `(ok ? "ok" : "todo")`). It is not a note, and the pack is not edited here.
// Only that exact class text, only in the pack's zc-flow.css / zc-flow.js (source and built copy). Any other TODO or note, anywhere, still fails.
export const PACK_FLOW = /(^|[\\/])public[\\/]pack[\\/]zc-flow\.(css|js)$/;
export const PACK_TODO_CLASS = /\.zf-ready\.todo\b|\(\s*ok\s*\?\s*"ok"\s*:\s*"todo"\s*\)/g;
export const withoutPackClass = (file: string, text: string) => (PACK_FLOW.test(file) ? text.replace(PACK_TODO_CLASS, "") : text);
const hasNote = (f: string) => PATTERN.test(withoutPackClass(f, readFileSync(f, "utf8")));

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!SKIP_DIR.has(n)) walk(p, out); }
    else if (TEXT.test(n)) out.push(p);
  }
  return out;
}

describe("no internal notes in what is deployed", () => {
  test("every file of the deployed pages (source and built copy) is free of internal notes", () => {
    const files = [...walk(join(ROOT, "apps/web/public")), ...walk(join(ROOT, "pages"))];
    expect(files.length).toBeGreaterThan(30);
    const bad = files.filter(hasNote).map((f) => f.slice(ROOT.length));
    expect(bad).toEqual([]);
  });
  test("the legal pages do not use the word draft", () => {
    for (const f of LEGAL_PAGES) { const p = join(ROOT, "apps/web/public", f); if (existsSync(p)) expect([f, LEGAL_ONLY.test(readFileSync(p, "utf8"))]).toEqual([f, false]); }
  });
  test("the consent code, its wording and the Terms tests are free of them too", () => {
    const files = ["apps/edge/src/consent.ts", "apps/edge/src/consent-text.json", "apps/edge/src/luck.ts", "apps/edge/migrations/0022_consent.sql", "apps/edge/test/consent.test.ts", "docs/RULES.md", "docs/GATES.md", "docs/PRIVACY_AND_LIFECYCLE.md", "docs/GAME.md", "README.md"]
      .map((f) => join(ROOT, f)).filter((f) => existsSync(f));
    expect(files.length).toBeGreaterThan(4);
    const bad = files.filter((f) => PATTERN.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length));
    expect(bad).toEqual([]);
  });
  test("the pattern itself catches what it should (so the scan is not asleep)", () => {
    for (const s of ["pending legal review", "ask the lawyer", "COUNSEL to confirm", "owner's instruction", "TODO", "under review", "[●]"]) expect([s, PATTERN.test(s)]).toEqual([s, true]);
    for (const s of ["Terms and Conditions", "Grievance Officer", "unpublished game"]) expect([s, PATTERN.test(s)]).toEqual([s, false]);
  });
  test("the pack exemption is narrow: only the exact class text in the pack's two flow files; a real TODO next to it, or the class anywhere else, still fails", () => {
    const css = ".zf-ready.todo { color: red; }", js = 'class: "zf-ready " + (ok ? "ok" : "todo"), id: "x"';
    for (const f of ["/r/apps/web/public/pack/zc-flow.css", "/r/pages/public/pack/zc-flow.css"]) expect([f, PATTERN.test(withoutPackClass(f, css))]).toEqual([f, false]);
    for (const f of ["/r/apps/web/public/pack/zc-flow.js", "/r/pages/public/pack/zc-flow.js"]) expect([f, PATTERN.test(withoutPackClass(f, js))]).toEqual([f, false]);
    expect(PATTERN.test(withoutPackClass("/r/apps/web/public/pack/zc-flow.js", js + " // TODO fix"))).toBe(true);   // a real note in the same file
    expect(PATTERN.test(withoutPackClass("/r/apps/web/public/pack/zc-flow.css", css + " /* todo later */"))).toBe(true);
    expect(PATTERN.test(withoutPackClass("/r/apps/web/public/pack/other.js", js))).toBe(true);                       // another pack file
    expect(PATTERN.test(withoutPackClass("/r/apps/web/public/zc.js", js))).toBe(true);                               // our own code
    expect(PATTERN.test(withoutPackClass("/r/apps/web/public/pack/zc-flow.js", 'x = "todo"'))).toBe(true);           // the word in any other shape
  });
});
