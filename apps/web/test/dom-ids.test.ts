// Every element id a page's own scripts look up by a literal name must exist: in the page's HTML, or in text one of the page's scripts builds. (A renamed or missing id breaks a screen without any error; Snakes was rolled back for exactly this.)
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const pub = (f: string) => readFileSync(join(import.meta.dir, "../public", f), "utf8");
const BUNDLES = new Set(["luck-engine.js", "zgame.js", "control.js", "reportgen.js"]); // minified builds are not read
// Guarded lookups whose element is rendered nowhere would be listed here, exactly. Empty today.
const GUARDED_UNRENDERED: string[] = [];
const PAGES = ["z.html", "host.html", "big.html", "zc.html"];
const scriptsOf = (html: string): string[] => [...html.matchAll(/<script[^>]*\ssrc="\/([^"?]+\.js)(?:\?[^"]*)?"/g)].map((m) => m[1]!).filter((f) => !BUNDLES.has(f));
const looked = (js: string): string[] => {
  const out = new Set<string>();
  for (const m of js.matchAll(/getElementById\(\s*["'`]([A-Za-z][\w-]*)["'`]\s*\)/g)) out.add(m[1]!);
  for (const m of js.matchAll(/(?:querySelector|querySelectorAll|\$|\$\$)\(\s*["'`]#([A-Za-z][\w-]*)["'`]\s*\)/g)) out.add(m[1]!);
  return [...out];
};
const defined = (text: string): Set<string> => {
  const out = new Set<string>();
  for (const m of text.matchAll(/\sid=\\?["']([A-Za-z][\w-]*)\\?["']/g)) out.add(m[1]!);
  for (const m of text.matchAll(/dieHtml\(\s*["']([A-Za-z][\w-]*)["']\s*\)/g)) out.add(m[1]!);
  for (const m of text.matchAll(/\.id\s*=\s*["']([A-Za-z][\w-]*)["']/g)) out.add(m[1]!);
  for (const m of text.matchAll(/setAttribute\(\s*["']id["']\s*,\s*["']([A-Za-z][\w-]*)["']/g)) out.add(m[1]!);
  return out;
};
describe("every id a page script looks up exists in that page", () => {
  for (const page of PAGES) {
    test(page, () => {
      const html = pub(page), files = scriptsOf(html), have = defined(html + files.map((f) => pub(f)).join("\n"));
      expect(files.length).toBeGreaterThan(0);
      const missing: string[] = [];
      for (const f of files) for (const id of looked(pub(f))) if (!have.has(id)) missing.push(`${f}: #${id}`);
      expect(missing.filter((x) => !GUARDED_UNRENDERED.includes(x))).toEqual([]);
      expect([...missing].sort()).toEqual(page === "zc.html" ? GUARDED_UNRENDERED : []);
    });
  }
});
