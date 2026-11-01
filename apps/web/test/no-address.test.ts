// Owner rule (1 Nov 2026): no street, city, state or pin code anywhere in what is shipped. Only "India".
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../..");
const WORDS = /ghaziabad|uttar\s*pradesh|indirapuram|shipra|krishna\s+vista|B-1105|\b201014\b|,\s*\d{6}\s*,\s*India/i;
const DIRS = ["apps/web/public", "site", "apps/edge/src", "apps/edge/migrations", "apps/edge", "pages", "packages", "config", "docs"];
const SKIP_DIR = new Set(["node_modules", "test", ".wrangler", "public-build"]);
const SKIP_FILE = /luck-engine\.js$|\.(png|jpg|jpeg|webp|woff2?|ico|pdf|lock|lockb)$/i;
const walk = (dir: string, out: string[] = [], top = false): string[] => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n); const st = statSync(p);
    if (st.isDirectory()) { if (!SKIP_DIR.has(n) && !(top && n === "public" && dir.endsWith("pages"))) walk(p, out); } else if (!SKIP_FILE.test(n)) out.push(p);
  }
  return out;
};

describe("no city, state, street or pin code in shipped files", () => {
  test("pages, scripts, mails, PDFs, invoices, company data, docs", () => {
    const files = [...new Set(DIRS.flatMap((d) => { try { return walk(join(ROOT, d), [], true); } catch { return []; } }))];
    expect(files.length).toBeGreaterThan(100);
    const bad = files.filter((f) => WORDS.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length));
    expect(bad).toEqual([]);
  }, 60_000);
  test("the check itself sees an address and lets plain India through", () => {
    expect(WORDS.test("B-1105, Shipra Krishna Vista, Indirapuram, Ghaziabad, Uttar Pradesh, 201014, India.")).toBe(true);
    expect(WORDS.test("the courts at Ghaziabad")).toBe(true);
    expect(WORDS.test("a sole proprietorship in India. The courts in India have jurisdiction.")).toBe(false);
  });
});
