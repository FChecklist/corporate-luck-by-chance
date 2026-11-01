// Owner rule (1 Nov 2026): customer-visible text is in the third person. Never "we", "our", "us".
// The only words kept are the consent box K4 sentence, which is a hashed, versioned legal text (consent-text.json) and changes only with a new CONSENT_VERSION.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../..");
const SKIP = new Set(["luck-engine.js", "funnel.js", "zgame.js", "releases.json"]);
const files = (dir: string, ext: RegExp): string[] => readdirSync(join(ROOT, dir)).filter((f) => ext.test(f) && !SKIP.has(f)).map((f) => join(ROOT, dir, f));
const KEPT = ["We keep billing data for audit and tax reasons."]; // consent box K4
const WORD = /\b(we|We|WE|our|Our|ours|us|Us)\b/g;
const visible = (text: string, code: boolean): string[] => {
  const out: string[] = [];
  if (code) text = text.replace(/\/\*[\s\S]*?\*\//g, (c) => "\n".repeat(c.split("\n").length - 1)); // block comments, lines kept
  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return; // a code comment
    let l = line;
    if (code) l = l.replace(/\s\/\/ .*$/, "").replace(/\)\s*\/\/.*$/, ")").replace(/\/\*.*?\*\//g, ""); // a trailing comment
    for (const k of KEPT) l = l.split(k).join("");
    for (const m of l.matchAll(WORD)) out.push(`${i + 1}: ${l.slice(Math.max(0, m.index! - 40), m.index! + 40).trim()}`);
  });
  return out;
};

describe("customer-visible text never says we, our or us", () => {
  const targets = [...files("apps/web/public", /\.(html|js|txt)$/), ...files("site", /\.html$/), ...files("apps/edge/src", /\.ts$/), ...files("packages/billing/src", /\.ts$/)];
  test("pages, scripts, mails, API text, PDF text and the AI manuals", () => {
    expect(targets.length).toBeGreaterThan(50);
    const bad: string[] = [];
    for (const f of targets) for (const v of visible(readFileSync(f, "utf8"), /\.(ts|js)$/.test(f))) bad.push(f.slice(ROOT.length) + ":" + v);
    expect(bad).toEqual([]);
  });
  test("the check itself sees a first-person word and ignores the kept K4 sentence", () => {
    expect(visible("<p>We keep your data.</p>", false).length).toBe(1);
    expect(visible("<p>Write to us.</p>", false).length).toBe(1);
    expect(visible("<p>The data is kept.</p>", false)).toEqual([]);
    expect(visible("x We keep billing data for audit and tax reasons. y", false)).toEqual([]);
    expect(visible("const a = 1; // we count here", true)).toEqual([]);
  });
});
