// Owner rule: customer-visible text never says erase / erasing / erased / erasure. A timer says "auto-deleted", a person's action says "deleted".
// Code names (the /erase route, the action "erase", erasePersonal, erasureMs, JSON keys) are not customer text and stay.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../..");
const SKIP = new Set(["luck-engine.js"]); // minified build
const files = (dir: string, ext: RegExp): string[] => readdirSync(join(ROOT, dir)).filter((f) => ext.test(f) && !SKIP.has(f)).map((f) => join(ROOT, dir, f));
// a word that is code: route/action names, identifiers, JSON keys, element ids
const CODE = /erasePersonal|eraseEverything|eraseCohosts|erasureMs|erasureOf|erasurestrip|erasureline|mailErasureHeadsUp|personal_data_erased|erase_request|"erase"|'erase'|\/erase|action: erase|action: 'erase'|do=erase|\{action: end\|erase|erase:|\.erased|erased:|erased \?|erased\)|erasure"|erasure:|\\berase\\b|\|erase\||\(publish\|erase\||participants\|erase\||r\.erased|id="erase"|"erase"\]|erase\b[ ]*=|const erase\b|String\(erase\)|erase - |< erase|>= erase|e, erase,|ACT === |erase: 10|erase: "|Press \\"Delete/;
const visible = (text: string, code: boolean): string[] => {
  const out: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return; // a comment
    if (code) line = line.replace(/\s\/\/ .*$/, "").replace(/\)\s*\/\/.*$/, ")"); // a trailing comment
    for (const m of line.matchAll(/.{0,40}\b[Ee]ras(e|es|ed|ing|ure)\b.{0,30}/g)) { if (!CODE.test(m[0])) out.push(`${i + 1}: ${m[0].trim()}`); }
  });
  return out;
};

describe("customer-visible text never says erase", () => {
  const targets = [...files("apps/web/public", /\.(html|js|txt)$/), ...files("site", /\.html$/), ...files("apps/edge/src", /\.ts$/)];
  test("pages, scripts, mails, API text and the AI manuals", () => {
    expect(targets.length).toBeGreaterThan(50);
    const bad: string[] = [];
    for (const f of targets) for (const v of visible(readFileSync(f, "utf8"), /\.(ts|js)$/.test(f))) bad.push(f.slice(ROOT.length) + ":" + v);
    expect(bad).toEqual([]);
  });
});
