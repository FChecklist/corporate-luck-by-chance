// A browser runs <script src> as a classic script: a file with top-level import/export throws "Unexpected token export" there and must be loaded type="module".
// Reads every script tag of every page, and the file behind it, as the browser would.
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PUB = join(import.meta.dir, "../public");
const pages = readdirSync(PUB).filter((f) => f.endsWith(".html"));
const tags = (html: string) => [...html.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]!);
const attr = (a: string, n: string) => new RegExp(`\\b${n}\\s*=\\s*"([^"]*)"`, "i").exec(a)?.[1] ?? null;
/** top-level module syntax: a line that starts (no indent) with import ... from / import "x" / export */
const isModule = (js: string) => /^(export\s|import\s+[\w{*"']|import\s*\{)/m.test(js.replace(/\/\*[\s\S]*?\*\//g, ""));

describe("every script tag loads its file the way the file needs", () => {
  test("there are pages and script tags to read", () => {
    expect(pages.length).toBeGreaterThan(20);
    expect(pages.flatMap((p) => tags(readFileSync(join(PUB, p), "utf8"))).length).toBeGreaterThan(50);
  });
  for (const p of pages) {
    test(p, () => {
      const bad: string[] = [];
      for (const a of tags(readFileSync(join(PUB, p), "utf8"))) {
        const src = attr(a, "src"); if (!src || /^https?:|^\/\//.test(src)) continue;
        const f = join(PUB, src.split("?")[0]!.replace(/^\//, ""));
        if (!existsSync(f)) { bad.push(`${src}: file missing`); continue; }
        const mod = (attr(a, "type") ?? "").toLowerCase() === "module";
        if (isModule(readFileSync(f, "utf8")) && !mod) bad.push(`${src}: has top-level import/export, load it with type="module"`);
      }
      expect(bad).toEqual([]);
    });
  }
  test("the check itself sees a module and a classic file", () => {
    expect(isModule("// c\nexport const A = 1;")).toBe(true);
    expect(isModule("import { a } from \"./a.js\";")).toBe(true);
    expect(isModule("(function () { var x = 'export'; })();")).toBe(false);
  });
});
