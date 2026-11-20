// Owner rule 2026-10-28: the games are ONLINE and CLOSE GROUP. The word "private" is never used where a person can read it (site, pages, e-mails, reports, messages).
// Say "close group" for the kind of game, and "personal", "protected" or "internal" where the point is a link or a record that must not be shared.
// Code comments and the TypeScript keyword `private` are not text a person reads, so they are skipped. The built bundles are skipped (they are made from the sources that are scanned).
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../../", import.meta.url).pathname;
const BUNDLES = new Set(["control.js", "zgame.js", "reportgen.js", "luck-engine.js"]);
const walk = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n); if (n === "node_modules" || n === "vendor" || n === "fonts") continue;
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(html|js|mjs|ts|json|webmanifest|txt|xml)$/.test(n) && !BUNDLES.has(n) && !/\.test\.ts$/.test(n)) out.push(p);
  }
  return out;
};
/** Is this occurrence in a code comment, or the TypeScript keyword? (Checked line by line, so a stray quote can never hide a real sentence.) */
const notText = (file: string, line: string, at: number): boolean => {
  if (!/\.(js|mjs|ts)$/.test(file)) return false;
  const before = line.slice(0, at);
  if (/\.ts$/.test(file) && /^\s*private\s+(?:readonly\s+|static\s+|async\s+)*[A-Za-z_$]/.test(line)) return true; // a class member (pdf.ts)
  return /^\s*(\*|\/\*|\/\/)/.test(line) || /(^|\s)\/\/\s/.test(before) || before.lastIndexOf("/*") > before.lastIndexOf("*/");
};
const blank = (m: string) => m.replace(/[^\n]/g, " "); // keep the line numbers

describe('the word "private" is not used in any text a person can read', () => {
  test("site, pages, server messages, mails, reports and scripts", () => {
    const files = [...walk(join(ROOT, "apps/web/public")), ...walk(join(ROOT, "site")), ...walk(join(ROOT, "apps/edge/src")), ...walk(join(ROOT, "packages")), ...walk(join(ROOT, "pages/functions"))];
    expect(files.length).toBeGreaterThan(100);
    const hits: string[] = [];
    for (const f of files) {
      const src = /\.html$/.test(f) ? readFileSync(f, "utf8").replace(/<!--[\s\S]*?-->/g, blank) : readFileSync(f, "utf8");
      src.split("\n").forEach((l, i) => { const re = /\bprivate(ly)?\b/gi; let m: RegExpExecArray | null; while ((m = re.exec(l))) if (!notText(f, l, m.index)) hits.push(`${f.slice(ROOT.length)}:${i + 1}: ${l.slice(Math.max(0, m.index - 40), m.index + 50).trim()}`); });
    }
    expect(hits).toEqual([]);
  });
});
