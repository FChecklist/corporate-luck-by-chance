// The legal pages that are deployed with the app say exactly what the final pages in site/ say, with the same version, and the Terms version is one constant everywhere.
// Gates K11, K12, LR-15, R4. The pages are compared by their text, so a change to one without the other fails here.
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { TERMS_VERSION } from "../../edge/src/brand";
import TEXT from "../../edge/src/consent-text.json";

const ROOT = new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const mainText = (html: string) => { const m = html.match(/<main[\s\S]*?<\/main>/); expect(m).toBeTruthy(); return m![0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); };

describe("the deployed legal pages equal the final pages", () => {
  for (const page of ["terms", "legal-position", "refund-policy", "privacy"]) {
    test(`${page}.html: the text of the app page equals the text of site/${page}.html`, () => {
      expect(mainText(read(`apps/web/public/${page}.html`))).toBe(mainText(read(`site/${page}.html`)));
    });
  }
  test("K11: the Terms page shows the version, and it is the one constant TERMS_VERSION, the version of the box wording, and the site page", () => {
    expect(TERMS_VERSION).toBe("2026-10-15"); expect((TEXT as any).version).toBe(TERMS_VERSION);
    expect(mainText(read("apps/web/public/terms.html"))).toContain(`Version ${TERMS_VERSION}`); expect(mainText(read("site/terms.html"))).toContain(`Version ${TERMS_VERSION}`);
  });
  test("the Terms say Luck by Chance only: clause 6.2 is here, the ticket clause 6.1 and every other game's name are not", () => {
    const t = mainText(read("apps/web/public/terms.html"));
    expect(t).toContain("Corporate Luck by Chance"); expect(t).not.toMatch(/Tambola|Bingo|Snakes|Tic Tac Toe/i);
  });
});

describe("no internal notes in the site pages or the docs that are committed", () => {
  const PATTERN = /COUNSEL|\[●\]|legal(ly)?\s+(review|pending|sign-?off)|review\s+pending|pending\s+(legal|review|approval)|awaiting\s+(legal|counsel|lawyer|approval|review)|\blawyer\b|\badvocate\b|owner'?s?\s+(told|instruction|order|directive|decision)|\bTODO\b|\bFIXME\b|under review|not yet (reviewed|approved)/i;
  const walk = (dir: string, out: string[] = []): string[] => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) { if (!["fonts", "node_modules"].includes(n)) walk(p, out); } else if (/\.(html|md|txt|xml|css|js|json|svg)$|^_headers$/.test(n)) out.push(p); } return out; };
  test("site/ and the docs have none (the site pages and the docs may use the word draft only for an unpublished game, never for their own status)", () => {
    const files = [...walk(join(ROOT, "site")), ...walk(join(ROOT, "docs")).filter((f) => !f.endsWith("SPEC.md"))];
    expect(files.length).toBeGreaterThan(15);
    expect(files.filter((f) => PATTERN.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length))).toEqual([]);
    for (const f of walk(join(ROOT, "site"))) if (/\.html$/.test(f)) expect([f.slice(ROOT.length), /\bdraft\b/i.test(readFileSync(f, "utf8"))]).toEqual([f.slice(ROOT.length), false]);
    expect(existsSync(join(ROOT, "site", "terms.html"))).toBe(true);
  });
});
