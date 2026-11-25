// Guard: the small mark "१३९" (owner order, approved 2026-11-25) is on every page, once, with the exact approved look.
// Pages = every static .html in apps/web/public and site/ (except the vendored console game pack in apps/web/public/pack, which is byte-for-byte
// the console's and is not served) plus the pages the Worker builds in code (back soon, invite, link not valid, trust).
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MARK139_DIV, MARK139_STYLE } from "../../edge/src/mark139";
import { trustHtml } from "../../edge/src/trust-page";

const ROOT = join(import.meta.dir, "../../..");
const DIV = '<div class="mark139" lang="hi" aria-hidden="true"><span>१३९</span></div>';
const CSS = '.mark139{position:absolute;top:0;left:0;right:0;margin:0;padding:1px 0 0;text-align:center;line-height:1;pointer-events:none;user-select:none;z-index:2147483647;font-family:"Noto Sans Devanagari","Mukta","Nirmala UI","Mangal","Kohinoor Devanagari","Devanagari Sangam MN",sans-serif;font-size:6px;font-weight:700;color:#0B2A6B}\n.mark139 span{display:inline-block;border-bottom:.5px solid #7A1010;padding-bottom:.5px}';
const count = (s: string, needle: string) => s.split(needle).length - 1;

function check(name: string, html: string) {
  expect(count(html, 'class="mark139"'), `${name}: exactly one mark element`).toBe(1);
  expect(count(html, DIV), `${name}: the approved markup`).toBe(1);
  expect(count(html, CSS), `${name}: the approved CSS, once`).toBe(1);
  const body = html.search(/<body[^>]*>/), at = html.indexOf(DIV);
  expect(body, `${name}: has a body`).toBeGreaterThan(-1);
  expect(html.slice(body).replace(/^<body[^>]*>/, "").startsWith(DIV), `${name}: first thing in <body>`).toBe(true);
  expect(at).toBeGreaterThan(body);
}

const htmlIn = (dir: string) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".html")).map((f) => `${dir}/${f}`);
const STATIC = [...htmlIn("apps/web/public"), ...htmlIn("site")];

test("there are static pages to check", () => { expect(STATIC.length).toBeGreaterThan(40); });
for (const f of STATIC) test(`${f} carries the mark once`, () => check(f, readFileSync(join(ROOT, f), "utf8")));

test("the shared constants are the approved text", () => {
  expect(MARK139_DIV).toBe(DIV);
  expect(MARK139_STYLE).toBe(`<style>${CSS}</style>`);
  for (const t of ["#0B2A6B", "#7A1010", "6px", "700", ".5px", "१३९", "pointer-events:none", "user-select:none", 'aria-hidden="true"']) expect(DIV + CSS).toContain(t);
});

test("the trust page built in code carries the mark once", () => check("trustHtml()", trustHtml()));

test("every page the Worker builds in code uses the mark, once per page", () => {
  const pages = [
    "apps/edge/src/admin.ts",
    "apps/edge/src/people.ts",
  ];
  for (const f of pages) {
    const s = readFileSync(join(ROOT, f), "utf8"), pagesIn = count(s.toLowerCase(), "<!doctype html>");
    expect(pagesIn, f).toBeGreaterThan(0);
    expect(count(s, "${MARK139_DIV}"), `${f}: one mark per page template`).toBe(pagesIn);
    expect(count(s, "${MARK139_STYLE}"), `${f}: one style per page template`).toBe(pagesIn);
  }
});
