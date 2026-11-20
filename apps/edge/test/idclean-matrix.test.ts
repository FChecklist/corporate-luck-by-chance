// A streamed cleaning matrix: more than 1,000,000 DISTINCT typed IDs / e-mails go through the product's cleaners (apps/edge/src/idclean.ts) and through the browser mirror
// (apps/web/public/idclean.js), and every answer is compared with an ORACLE written here from the rules in docs/TEST_HANDOFF.md, not from the product's code.
// The oracle uses no regular expression, no .trim() and no .replace(): it walks the characters and tests code points against written-out lists.
// The only things shared with the product are the platform's own String.normalize("NFKC"), toUpperCase and toLowerCase, which the rules name.
// Distinctness: part 1 is EVERY string of 0 to 4 characters over a fixed alphabet of 34 different single characters (distinct by construction: different character
// lists are different strings), part 2 and 3 (structured and seeded random) are kept in a Set and anything that part 1 already holds is skipped. The count is asserted exactly.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { accountEmail, emailId, empId, legacyNormEmp, listEmail, looksLikeEmail, normEmpFor, EMP_CLEAN_FROM_MS, EMP_MAX } from "../src/idclean";

setDefaultTimeout(600_000);

// ---- the browser mirror, loaded the way a page loads it ----
const mirror: any = (() => { const g: any = {}; new Function("window", readFileSync(join(import.meta.dir, "../../web/public/idclean.js"), "utf8"))(g); return g.IDCLEAN; })();

// ---- the oracle ----
// White space exactly as JavaScript means it for \s and trim (WhiteSpace + LineTerminator): tab, line feed, vertical tab, form feed, carriage return, space, no-break space,
// ogham space, en quad to hair space, line and paragraph separators, narrow no-break space, medium mathematical space, ideographic space, byte order mark.
const WS = new Set<number>([9, 10, 11, 12, 13, 32, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff]); for (let c = 0x2000; c <= 0x200a; c++) WS.add(c);
const nfkc = (s: string) => s.normalize("NFKC");
const cpsOf = (s: string): number[] => { const out: number[] = []; for (let i = 0; i < s.length; i++) { const c = s.codePointAt(i)!; out.push(c); if (c > 0xffff) i++; } return out; };
const fromCps = (a: number[]) => { let s = ""; for (const c of a) s += String.fromCodePoint(c); return s; };
const dropWs = (s: string) => fromCps(cpsOf(s).filter((c) => !WS.has(c)));
const edgeTrim = (a: number[]) => { let i = 0, k = a.length; while (i < k && WS.has(a[i]!)) i++; while (k > i && WS.has(a[k - 1]!)) k--; return a.slice(i, k); };
const isAZ09 = (c: number) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90);
const oEmp = (s: string) => fromCps(cpsOf(nfkc(s).toUpperCase()).filter(isAZ09));
const oEmailId = (s: string) => dropWs(nfkc(s)).toLowerCase();
const oAccount = (s: string) => { const t = edgeTrim(cpsOf(nfkc(s))); return t.some((c) => WS.has(c)) ? "" : fromCps(t).toLowerCase(); };
const oLooksEmail = (s: string) => cpsOf(nfkc(s)).includes(64);
const oLegacyRaw = (s: string) => dropWs(s).toUpperCase(); // the old rule's cleaning: no NFKC
const oLegacy = (s: string): string | null => { const t = cpsOf(oLegacyRaw(s)); if (!t.length) return ""; if (t.length > 30 || !isAZ09(t[0]!)) return null; const ok = t.every((c) => isAZ09(c) || c === 46 || c === 95 || c === 45 || c === 47); return ok ? fromCps(t) : null; }; // UTF-16 length is the count the product limits: all kept characters are ASCII
const oNew = (s: string): string | null => { if (!edgeTrim(cpsOf(s)).length) return ""; const e = oEmp(s); return e.length > 0 && e.length <= EMP_MAX ? e : null; };
const oShape = (e: string): boolean => { // something@something.tld without white space or a second at sign, counted in UTF-16 units like the quantifiers of the product's pattern
  const at = e.indexOf("@"); if (at < 0 || e.indexOf("@", at + 1) >= 0) return false;
  const local = e.slice(0, at), host = e.slice(at + 1); if (local.length < 1 || local.length > 64) return false;
  for (let i = 1; i < host.length; i++) if (host.charCodeAt(i) === 46 && i <= 255 && host.length - i - 1 >= 2) return true; return false;
};
const oList = (s: string): string | null => { const e = oEmailId(s); if (!e) return ""; return e.length <= 254 && oShape(e) ? e : null; };
const oEmpHint = (v: string, newRule?: boolean) => { if (oLooksEmail(v)) return "This looks like an Email ID. This game asks for an employee ID: letters and numbers only."; const c = newRule === false ? oLegacyRaw(v) : oEmp(v); return c ? "The system will read this as " + c : ""; };
const oEmailHint = (v: string) => { const c = oEmailId(v); return c ? "The system will read this as " + c : ""; };

// ---- the inputs ----
const ALPHABET: string[] = [
  "A", "b", "1", "9", "-", " ", "@", ".", "_", "\t", // plain ASCII: letters, digits, dash, space, at, dot, underscore, tab
  "Ａ", "１", "＠", "－", // full-width A, 1, at sign, hyphen-minus
  "ß", // sharp s (upper-cases to SS)
  "–", "—", "−", // en dash, em dash, minus sign
  "१", // Devanagari digit one
  "ℂ", "ﬁ", "Ⅷ", // compatibility letters: double-struck C, fi ligature, Roman numeral eight
  " ", "　", // no-break space, ideographic space
  "​", "‍", "﻿", // zero-width space, zero-width joiner, byte order mark
  "\u{1f600}", // emoji (outside the Basic Multilingual Plane)
  "É", "İ", "K", "ſ", "́", "/", // E acute, dotted capital I, Kelvin sign, long s, combining acute, slash
];
const N = ALPHABET.length; // 34
const ALPHA_SET = new Set(ALPHABET);
const exhaustiveCount = (() => { let t = 0, p = 1; for (let L = 0; L <= 4; L++) { t += p; p *= N; } return t; })();
function* exhaustive(): Generator<string> {
  for (let L = 0; L <= 4; L++) {
    const total = N ** L;
    for (let i = 0; i < total; i++) { let s = "", x = i; for (let k = 0; k < L; k++) { s += ALPHABET[x % N]; x = Math.floor(x / N); } yield s; }
  }
}
const inExhaustive = (s: string) => { let n = 0; for (const ch of s) { if (!ALPHA_SET.has(ch)) return false; if (++n > 4) return false; } return true; };

const BODIES = ["1B678", "e101", "AB-12", "ab_12", "EMP/007", "１Ｂ－６７８", "१२३ABC", "straße9", "ﬁnance1", "Ⅷ-9", "x".repeat(30), "x".repeat(31), "\u{1f600}\u{1f600}", "---", "", "   ", "rajat1@demo.com", "RAJAT1＠DEMO.COM", "a.b_c-d@x.co", "sss@sss.ss", "a@b", "ñ", "ÁB", "i̇İ", "K1"];
const PREFIX = ["", " ", "\t", " ", "　", "​", "﻿", "\u{1f600}", "-", "#", "００", "　 "];
const SEPS = [" ", "  ", "\t", "\n", " ", "　", "​", "‍", "-", "–", "—", "−", "_", "/", ".", "\u{1f600}"];
function* structured(): Generator<string> {
  for (const b of BODIES) { const cp = Array.from(b);
    for (const pre of PREFIX) for (const suf of PREFIX) {
      yield pre + b + suf;
      for (let i = 1; i <= cp.length; i++) for (const sep of SEPS) yield pre + cp.slice(0, i).join("") + sep + cp.slice(i).join("") + suf;
    }
  }
  for (const n of [29, 30, 31, 32, 60, 253, 254, 255, 256, 1000, 10000, 100000]) { // very long
    yield "A".repeat(n); yield "1-".repeat(n); yield "ab @".repeat(n); yield "\u{1f600}".repeat(n); yield " ".repeat(n); yield "​".repeat(n); yield "a".repeat(n) + "@" + "b".repeat(n) + ".com"; yield "Ａ１".repeat(n); yield "x".repeat(n) + " ";
  }
}
function* seeded(count: number): Generator<string> { // xorshift32, seed fixed
  let x = 0x9e3779b9 >>> 0; const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
  for (let n = 0; n < count; n++) {
    const len = 5 + (rnd() % 20); let s = "";
    for (let k = 0; k < len; k++) { const r = rnd(); if (r % 3 === 0) s += String.fromCodePoint(0x20 + (rnd() % 0x2fe0)); else if (r % 3 === 1) s += String.fromCodePoint(0x1f300 + (rnd() % 0x300)); else s += ALPHABET[rnd() % N]; }
    yield s;
  }
}

describe("the streamed cleaning matrix", () => {
  test("the alphabet is 34 different single characters, and one index is one string (so part 1 is distinct by construction)", () => {
    expect(N).toBe(34); expect(new Set(ALPHABET).size).toBe(N); for (const ch of ALPHABET) expect([ch, Array.from(ch).length]).toEqual([ch, 1]);
    const seen = new Set<string>(); let c = 0; for (const s of exhaustive()) { if (s.length <= 2 || c % 997 === 0) seen.add(s); c++; if (c > 40_000) break; }
    expect(seen.size).toBeGreaterThan(1000);
  });

  test("the oracle itself: a few answers worked out by hand (so a wrong oracle does not agree with a wrong product by accident)", () => {
    expect(oEmp("1B-678")).toBe("1B678"); expect(oEmp("straße")).toBe("STRASSE"); expect(oEmp("१२")).toBe(""); expect(oEmp("Ⅷ")).toBe("VIII"); expect(oEmp("１Ｂ")).toBe("1B");
    expect(oEmailId(" A b　@C.com ")).toBe("ab@c.com"); expect(oEmailId("​a@b.co")).toBe("​a@b.co"); // a zero-width character is not white space
    expect(oAccount(" A@B.com ")).toBe("a@b.com"); expect(oAccount("a b@c.com")).toBe(""); expect(oAccount("a　b@c.com")).toBe(""); expect(oAccount("ａ＠ｂ.com")).toBe("a@b.com");
    expect(oList("rajat1@demo.com")).toBe("rajat1@demo.com"); expect(oList("a@b")).toBeNull(); expect(oList("a@@b.co")).toBeNull(); expect(oList("  ")).toBe("");
    expect(oLegacy("a-b")).toBe("A-B"); expect(oLegacy("-a")).toBeNull(); expect(oNew("---")).toBeNull(); expect(oNew("  ")).toBe("");
  });

  test("more than 1,000,000 distinct inputs: product (idclean.ts) = browser mirror (idclean.js) = oracle, for every cleaner and every hint", () => {
    const mismatches: string[] = []; const seenLater = new Set<string>();
    const cover = { empEmpty: 0, empLong: 0, accountRefused: 0, accountKept: 0, listNull: 0, listOk: 0, emailHasInnerWs: 0, astral: 0, looksEmail: 0, legacyNull: 0, legacyOk: 0 };
    let total = 0, p1 = 0, p2 = 0, p3 = 0;
    const show = (s: string) => JSON.stringify(s.length > 60 ? s.slice(0, 60) + "...(" + s.length + ")" : s);
    const check = (s: string) => {
      total++;
      const newFrom = EMP_CLEAN_FROM_MS; // a game made at/after the deploy instant: the new rule
      const got = {
        emp: empId(s), em: emailId(s), acc: accountEmail(s), look: looksLikeEmail(s), list: listEmail(s), leg: legacyNormEmp(s), nw: normEmpFor(s, newFrom), old: normEmpFor(s, 0, newFrom + 1),
        mEmp: mirror.empId(s), mEm: mirror.emailId(s), mLook: mirror.looksLikeEmail(s), mLegacy: mirror.legacy(s), hN: mirror.empHint(s, true), hO: mirror.empHint(s, false), hE: mirror.emailHint(s),
      };
      const want = { emp: oEmp(s), em: oEmailId(s), acc: oAccount(s), look: oLooksEmail(s), list: oList(s), leg: oLegacy(s), nw: oNew(s), old: oLegacy(s), mEmp: oEmp(s), mEm: oEmailId(s), mLook: oLooksEmail(s), mLegacy: oLegacyRaw(s), hN: oEmpHint(s, true), hO: oEmpHint(s, false), hE: oEmailHint(s) };
      for (const k of Object.keys(want) as (keyof typeof want)[]) if (got[k] !== want[k] && mismatches.length < 25) mismatches.push(`${k} for ${show(s)}: product/mirror ${show(String(got[k]))} but oracle ${show(String(want[k]))}`);
      if (want.emp === "") cover.empEmpty++; if (want.nw === null) cover.empLong++; if (want.acc === "") cover.accountRefused++; else cover.accountKept++;
      if (want.list === null) cover.listNull++; else if (want.list) cover.listOk++; if (edgeTrim(cpsOf(nfkc(s))).some((c) => WS.has(c))) cover.emailHasInnerWs++; if (cpsOf(s).some((c) => c > 0xffff)) cover.astral++; if (want.look) cover.looksEmail++;
      if (want.leg === null) cover.legacyNull++; else if (want.leg) cover.legacyOk++;
    };
    for (const s of exhaustive()) { check(s); p1++; }
    for (const s of structured()) { if (inExhaustive(s) || seenLater.has(s)) continue; seenLater.add(s); check(s); p2++; }
    for (const s of seeded(150_000)) { if (inExhaustive(s) || seenLater.has(s)) continue; seenLater.add(s); check(s); p3++; }
    console.log(`MATRIX distinct inputs: ${total} (part 1 all strings of 0-4 characters over 34 characters: ${p1}; part 2 structured: ${p2}; part 3 seeded random: ${p3})`);
    console.log("MATRIX coverage " + JSON.stringify(cover));
    expect(mismatches).toEqual([]);
    expect(p1).toBe(exhaustiveCount); expect(p1 + p2 + p3).toBe(total); expect(seenLater.size).toBe(p2 + p3);
    expect(total).toBeGreaterThanOrEqual(1_000_000);
    expect(total).toBe(EXPECTED_DISTINCT); // the exact count, written down so it cannot drift
    // every class of input the matrix was asked to hold really occurred many times
    for (const [k, v] of Object.entries(cover)) expect([k, v > 1000]).toEqual([k, true]);
  });
});

const EXPECTED_DISTINCT = 1_957_127; // 1,376,831 (all strings of 0-4 characters over 34) + 430,296 structured + 150,000 seeded random
