// v3 test pass, the page side: hint and guide texts against the written rules. "PRODUCT DEFECT" tests use test.failing (see docs/TESTER_REPORT.md): they state the rule,
// are red against the product today, and go red the other way (remove .failing) the day the product follows the rule.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pub = (f: string) => readFileSync(join(import.meta.dir, "../public", f), "utf8");
const IDC: any = (() => { const g: any = {}; new Function("window", pub("idclean.js"))(g); return g.IDCLEAN; })();
const READ_AS = "The system will read this as ";
const TOO_LONG = "This ID is too long. An employee ID may be up to 30 characters once cleaned.";

describe("hint texts", () => {
  test("employee-ID box (new rule): 'The system will read this as ...' shows the cleaned ID; empty shows nothing", () => {
    expect(IDC.empHint("1b-678", true)).toBe(READ_AS + "1B678"); expect(IDC.empHint("１Ｂ 678", true)).toBe(READ_AS + "1B678"); expect(IDC.empHint("", true)).toBe(""); expect(IDC.empHint("  ", true)).toBe(""); expect(IDC.empHint("---", true)).toBe("");
  });
  test("employee-ID box: an e-mail gets the plain line, never a 'read this as' text and never letters taken from it", () => {
    for (const v of ["rajat1@demo.com", "RAJAT1＠DEMO.COM", "a@b"]) { const h = IDC.empHint(v, true); expect(h).toBe("This looks like an Email ID. This game asks for an employee ID: letters and numbers only."); expect(h.includes(READ_AS)).toBe(false); expect(/RAJAT|DEMO/i.test(h)).toBe(false); }
  });
  test("Email ID box: shows the cleaned Email ID, with spaces and each invisible character gone and lower case", () => {
    expect(IDC.emailHint(" Rajat1@Demo.COM ")).toBe(READ_AS + "rajat1@demo.com");
    for (const ch of ["​", "‌", "‍", "⁠", "﻿", "\u0085", " ", " "]) expect([ch.charCodeAt(0), IDC.emailHint("Ra" + ch + "jat1@Demo.com")]).toEqual([ch.charCodeAt(0), READ_AS + "rajat1@demo.com"]);
    expect(IDC.emailHint("")).toBe("");
  });
  test("the hint is shown only where the server cleans: both pages choose it by the kind of ID and the rule flag, from IDCLEAN", () => {
    for (const f of ["zc.js", "luck.js"]) { const t = pub(f); expect([f, /IDCLEAN\.emailHint/.test(t), /IDCLEAN\.empHint/.test(t)]).toEqual([f, true, true]); }
  });
  test.failing("PRODUCT DEFECT D1b: an employee ID that is over 30 characters once cleaned shows 'This ID is too long. An employee ID may be up to 30 characters once cleaned.' under the box", () => {
    expect(IDC.empHint("A".repeat(30), true)).toBe(READ_AS + "A".repeat(30)); // 30 is fine
    expect(IDC.empHint("A".repeat(31), true)).toBe(TOO_LONG); // today the hint reads the 31 characters back as if they were fine
    expect(IDC.empHint("A-".repeat(16) + "B".repeat(15), true)).toBe(TOO_LONG);
  });
  test("the too-long sentence is written in no shipped page at all (this is why D1 and D1b exist)", () => {
    for (const f of ["zc.js", "luck.js", "idclean.js", "guide.js", "zc-flow-game.js", "zc-mode.js"]) expect([f, pub(f).includes(TOO_LONG)]).toEqual([f, false]);
  });
});

describe("guide texts", () => {
  const LOCK_KIND = "You already have people listed. Start a new game to use a different kind of ID";
  const LOCK_WAY = "You already have people listed. Start a new game to use a different way of asking for IDs";
  test("the guide knows the 'kind of ID' lock sentence", () => { expect(pub("guide.js")).toContain(LOCK_KIND); });
  test.failing("PRODUCT DEFECT D2b: the guide knows the 'different way of asking for IDs' lock sentence", () => { expect(pub("guide.js")).toContain(LOCK_WAY); });
  test("the Worker's 'Enter your employee ID.' / 'Enter your Email ID.' are matched by a real (placeholder-free) guide entry", () => {
    const g = pub("guide.js"); expect(g).toContain('"Enter your employee ID."'); expect(g).toContain('"Enter your Email ID."'); expect(g.includes("Enter your ${W}")).toBe(false);
  });
});
