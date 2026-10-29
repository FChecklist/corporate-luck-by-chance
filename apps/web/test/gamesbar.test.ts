// The Corporate Games bar is ONE shared component (C:\ct\test-sites\corporate-games-bar): this site's copy must equal the canonical files byte for byte
// (SHA-256 below, printed by that folder's src/build.py). If this fails, copy the canonical files again; never edit the copy here.
// Every PUBLIC page loads it (not the play, console, pay or report pages, and not the script-free Trust page).
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const sha = (f: string) => createHash("sha256").update(pub(f).split(String.fromCharCode(13)).join("")).digest("hex"); // line endings do not count (git may check files out with CRLF)
const PUBLIC = ["index", "how-it-works", "about", "contact", "legal", "terms", "privacy", "legal-position", "refund-policy", "dpa", "subprocessors", "partner", "helpdesk", "partner-terms", "organizer-guide", "pricing", "brochure", "404", "signin"];
const NO_BAR = ["z", "zc", "big", "host", "pay", "paylink", "paytest", "report", "demo", "owner-visits", "ai-link", "preview", "trust"];

describe("the shared Corporate Games bar", () => {
  test("gamesbar.js and gamesbar.css are identical to the canonical copy", () => {
    expect(sha("gamesbar.js")).toBe("16f02208af3c84cef63d81cdfcbc788f1baf23957ed71e912d44cafd4f881b98");
    expect(sha("gamesbar.css")).toBe("6b0311de98525de646e637a28102163dfecf9fde35b8befe0344a5e16fff8b5b");
  });
  test("every public page loads it with a version number, no play / console / pay page does, and the build ships it", () => {
    for (const p of PUBLIC) expect([p, /<script src="\/gamesbar\.js\?v=\d+" defer><\/script>/.test(pub(p + ".html"))]).toEqual([p, true]);
    for (const p of NO_BAR) expect([p, pub(p + ".html").includes("gamesbar")]).toEqual([p, false]);
    const b = readFileSync(new URL("../../../pages/build.mjs", import.meta.url), "utf8"); expect(b).toContain('"gamesbar.js"'); expect(b).toContain('"gamesbar.css"');
  });
  test("on luck.corporatetambola.com the bar marks Luck by Chance as the current game, once, and loading it twice adds nothing", () => {
    const w = new Window({ url: "https://luck.corporatetambola.com/" }); const d = w.document;
    for (const n of ["String", "Array", "Object", "Math", "JSON", "Number", "Date", "Boolean", "RegExp", "Error", "Set", "Map", "parseInt", "isNaN"]) if (!(w as any)[n]) (w as any)[n] = (globalThis as any)[n];
    d.body.innerHTML = '<a href="#main">Skip to the content</a><main id="main">page</main>'; d.head.innerHTML = "";
    const run = () => new Function("window", "document", "with (window) {" + pub("gamesbar.js") + "}").call(w, w, w.document);
    run(); const bar = d.querySelector(".cg-bar, .cgb, [class*='gamesbar']") ?? d.body.children[1]!; expect(bar).toBeTruthy();
    const cur = [...d.querySelectorAll('[aria-current]')]; expect(cur.length).toBeGreaterThanOrEqual(1); expect(cur.some((c: any) => /Luck by Chance/.test(c.textContent))).toBe(true);
    expect((d.body.textContent ?? "").replace(/\s+/g, " ")).toContain("Corporate Luck by Chance"); expect(d.body.innerHTML).not.toMatch(/games\.corporatetambola\.com/);
    const n = d.body.innerHTML.length; run(); expect(d.body.innerHTML.length).toBe(n);
  });
});
