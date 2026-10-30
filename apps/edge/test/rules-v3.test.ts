// Rule tests written for the v3 test pass (docs/TESTER_REPORT.md). Every expectation comes from the written rules, not from the product's code.
// A test named "PRODUCT DEFECT" is written with test.failing: it states the rule, it is RED against the product today (so it "passes" under .failing),
// and the day the product follows the rule it goes red and `.failing` must be removed. Nothing here bends to the product.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import type { PayEnv } from "../src/pay";
import { accountEmail, emailId, empId, listEmail, normEmpFor, EMP_CLEAN_FROM_MS, EMP_MAX } from "../src/idclean";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200;
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"]; let ipN = 0;
const realFetch = globalThis.fetch;
const call = (method: string, path: string, body?: unknown, key?: string, now = T, ip = "9.9.9.9") =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(key ? { "x-organizer": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), env as Env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (String(i).padStart(2, "0") + "e".repeat(32)).slice(0, 32);
const nextIp = () => `7.7.${Math.floor(++ipN / 250)}.${(ipN % 250) + 1}`;
beforeEach(() => { const d = makeD1({ strictHosts: true }); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", TEST_MODE: "1" } as PayEnv; (globalThis as any).fetch = async () => new Response("{}", { status: 404 }); });
afterEach(() => { globalThis.fetch = realFetch; });

const organizer = async (email = "boss@acme.com") => { const st = await j(await call("POST", "/api/start", { email }, undefined, T, nextIp())); expect(st.token).toBeTruthy(); return st.token as string; };
/** a published game; `newRule` puts it on the new employee-ID cleaner (created at/after EMP_CLEAN_FROM_MS, which is a placeholder in 2100) */
const mk = async (id: string, settings: Record<string, unknown>, newRule = true) => {
  const m = await organizer(`o${++ipN}@acme.com`);
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100, whoCanJoin: settings.employeesOnly ? "list" : "anyone" }, m)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, m)).status).toBe(200);
  expect((await call("PATCH", `/api/z/${id}/settings`, settings, m)).status).toBe(200);
  if (newRule) raw.prepare("UPDATE engagement SET created_ms=? WHERE id=?").run(EMP_CLEAN_FROM_MS, id);
  return m;
};
const EMP = { verify: "id", employeesOnly: true };
const EML = { verify: "id", idKind: "email", employeesOnly: true };
const INVISIBLE: [string, string][] = [["U+200B", "​"], ["U+200C", "‌"], ["U+200D", "‍"], ["U+2060", "⁠"], ["U+FEFF", "﻿"], ["U+0085", "\u0085"], ["U+2028", " "], ["U+2029", " "]];

describe("employee ID: NFKC, upper case, A-Z and 0-9 only, at most 30 after cleaning, empty refused", () => {
  test("cleaning (unit): NFKC first, then upper case, then only A-Z0-9 stay", () => {
    expect(empId("1b-678")).toBe("1B678"); expect(empId("１Ｂ－６７８")).toBe("1B678"); expect(empId(" e 101 ")).toBe("E101"); expect(empId("ﬁnance1")).toBe("FINANCE1");
    expect(empId("straße9")).toBe("STRASSE9"); expect(empId("Ⅷ-9")).toBe("VIII9"); expect(empId("१२३ABC")).toBe("ABC"); expect(empId("é1")).toBe("1"); // é stays one letter under NFKC, is upper-cased to É, which is not A-Z, so it goes
    expect(empId("")).toBe(""); expect(empId("---")).toBe(""); expect(empId(null)).toBe(""); expect(empId(undefined)).toBe("");
  });
  test("the cap is 30 AFTER cleaning: 30 clean characters are accepted, 31 refused, and 40 typed characters that clean to 30 are accepted", () => {
    expect(EMP_MAX).toBe(30);
    expect(normEmpFor("A".repeat(30), EMP_CLEAN_FROM_MS)).toBe("A".repeat(30)); expect(normEmpFor("A".repeat(31), EMP_CLEAN_FROM_MS)).toBeNull();
    expect(normEmpFor("-".repeat(10) + "A".repeat(30) + " ".repeat(10), EMP_CLEAN_FROM_MS)).toBe("A".repeat(30));
    expect(normEmpFor("A-".repeat(15), EMP_CLEAN_FROM_MS)).toBe("A".repeat(15)); expect(normEmpFor("A-".repeat(16) + "B".repeat(15), EMP_CLEAN_FROM_MS)).toBeNull(); // 16 + 15 = 31 after cleaning
  });
  test("empty (nothing typed) is '' and nothing-usable-left is refused (null), in the new rule", () => {
    expect(normEmpFor("", EMP_CLEAN_FROM_MS)).toBe(""); expect(normEmpFor("   ", EMP_CLEAN_FROM_MS)).toBe(""); expect(normEmpFor("---", EMP_CLEAN_FROM_MS)).toBeNull(); expect(normEmpFor("१२", EMP_CLEAN_FROM_MS)).toBeNull();
  });
  test("by request (people add): 1b-678 and 1B 678 are one ID, so the second is flagged a duplicate; 30 accepted, 31 refused, 40-typed-to-30 accepted, '---' refused", async () => {
    const m = await mk("V3-E1", EMP);
    const r = await j(await call("POST", "/api/z/V3-E1/people", { people: [{ name: "A", empId: "1b-678" }, { name: "B", empId: "1B 678" }, { name: "C", empId: "A".repeat(30) }, { name: "D", empId: "A".repeat(31) }, { name: "E", empId: "-".repeat(5) + "B".repeat(30) + " ".repeat(5) }, { name: "F", empId: "---" }, { name: "G", empId: "１Ｂ－６７８" }] }, m));
    expect(r.added).toBe(3); // A, C, E
    expect((raw.prepare("SELECT COUNT(*) AS c FROM person WHERE eid='V3-E1' AND status<>'removed'").get() as any).c).toBe(3);
    const why = Object.fromEntries((r.invalid as any[]).map((x) => [x.raw, String(x.why)]));
    expect(Object.keys(why).sort()).toEqual(["B", "D", "F", "G"]); // B and G are 1B678 again after cleaning; D is 31; F has nothing left
    expect(why.B).toContain("reads as 1B678, the same as another row"); expect(why.G).toContain("reads as 1B678, the same as another row");
    expect(why.D).toContain("longer than 30"); expect(why.F).toContain("no letters or numbers");
    expect((r.people as any[]).map((x) => x.empId).sort()).toEqual(["1B678", "A".repeat(30), "B".repeat(30)].sort());
  });
  test("by join: the person typing 1b-678 gets the seat listed as 1B678; a 31-character ID is refused and no seat is made", async () => {
    const m = await mk("V3-E2", EMP);
    await call("POST", "/api/z/V3-E2/people", { people: [{ name: "Asha", empId: "1B678" }] }, m);
    const ok = await call("POST", "/api/z/V3-E2/join", { empId: "1b-678", name: "Asha", device: dev(1) }); expect(ok.status).toBe(200);
    const bad = await call("POST", "/api/z/V3-E2/join", { empId: "A".repeat(31), name: "Zed", device: dev(2) }); expect(bad.status).toBe(400);
    expect((raw.prepare("SELECT COUNT(*) AS c FROM participant WHERE eid='V3-E2'").get() as any).c).toBe(1);
  });
  test("an e-mail typed in an employee-ID game gets the plain refusal, and the refusal never contains letters taken from it", async () => {
    const m = await mk("V3-E3", EMP);
    const typed = "zebra.quinn@acme.com";
    for (const path of ["join", "people"]) {
      const r = path === "join" ? await call("POST", "/api/z/V3-E3/join", { empId: typed, name: "Q", device: dev(3) }) : await call("POST", "/api/z/V3-E3/people", { people: [{ name: "Q", empId: typed }] }, m);
      const b = await j(r); const text = JSON.stringify(b);
      expect(text).toContain("This looks like an Email ID, but this game asks for an employee ID.");
      for (const piece of ["ZEBRA", "QUINN", "ACME", "COM", "zebra", "quinn", "acme"]) expect([path, piece, text.includes(piece)]).toEqual([path, piece, false]);
      expect((raw.prepare("SELECT COUNT(*) AS c FROM person WHERE eid='V3-E3'").get() as any).c).toBe(0);
    }
    expect(normEmpFor("a＠b.com", EMP_CLEAN_FROM_MS)).toBe("ABCOM"); // the unit cleaner still cleans (the refusal is the caller's job: looksLikeEmail), shown here so nobody reads it as the refusal
  });
  test.failing("PRODUCT DEFECT D1: over 30 shows 'This ID is too long. An employee ID may be up to 30 characters once cleaned.'", async () => {
    // Rule: an employee ID that is more than 30 characters once cleaned is answered with exactly this sentence. Today the server sends BAD_EMP_NEW ('That employee ID has no letters or numbers in it, or is longer than 30 characters. ...') for both "too long" and "nothing left".
    const m = await mk("V3-E4", EMP);
    const r = await j(await call("POST", "/api/z/V3-E4/people", { people: [{ name: "D", empId: "A".repeat(31) }] }, m));
    expect(JSON.stringify(r)).toContain("This ID is too long. An employee ID may be up to 30 characters once cleaned.");
  });
});

describe("participant Email ID: NFKC, trim, inner spaces and invisible characters removed, lower case", () => {
  test("every one of the 8 named invisible characters is removed, anywhere (start, inside, end); so are ordinary and Unicode spaces", () => {
    for (const [name, ch] of INVISIBLE) {
      expect([name, emailId(ch + "Ab@Cd.com")]).toEqual([name, "ab@cd.com"]); expect([name, emailId("Ab" + ch + "@Cd.com")]).toEqual([name, "ab@cd.com"]); expect([name, emailId("Ab@Cd.com" + ch)]).toEqual([name, "ab@cd.com"]);
      expect([name, listEmail("a" + ch + "b@c" + ch + "d.com")]).toEqual([name, "ab@cd.com"]);
    }
    expect(emailId(" A b\t@C d.com\n")).toBe("ab@cd.com"); expect(emailId("a　b＠c.com")).toBe("ab@c.com"); expect(emailId("ＡＢ＠Ｃ.COM")).toBe("ab@c.com");
  });
  test("two people who type the same visible Email ID (one with an invisible character pasted in) are one person (hash and join)", async () => {
    const m = await mk("V3-M1", EML);
    const r = await j(await call("POST", "/api/z/V3-M1/people", { people: [{ name: "A", empId: "asha@acme.com" }, { name: "B", empId: "asha​@acme.com" }, { name: "C", empId: " ASHA@ACME.com " }] }, m));
    expect(r.added).toBe(1);
    const jn = await call("POST", "/api/z/V3-M1/join", { empId: "as⁠ha@acme.com", name: "Asha", device: dev(4) }); expect(jn.status).toBe(200);
  });
  test("the cleaning never uppercases or strips the symbols of an Email ID (never the employee-ID cleaner)", () => {
    expect(emailId("Rajat.1_x-y+z@Demo.COM")).toBe("rajat.1_x-y+z@demo.com"); expect(listEmail("not an address")).toBeNull(); expect(listEmail("a@b")).toBeNull();
  });
});

describe("account e-mails (sign-in, Host, payment) refuse inner spaces and invisible characters; they are never repaired", () => {
  test("accountEmail: each of the 8 invisible characters and a space inside is refused (''), outside edge spaces are trimmed, an ordinary address is lower-cased", () => {
    for (const [name, ch] of INVISIBLE) { expect([name + " inside", accountEmail("bo" + ch + "ss@acme.com")]).toEqual([name + " inside", ""]); expect([name + " in domain", accountEmail("boss@ac" + ch + "me.com")]).toEqual([name + " in domain", ""]); }
    expect(accountEmail("bo ss@acme.com")).toBe(""); expect(accountEmail("  Boss@Acme.com\t")).toBe("boss@acme.com"); expect(accountEmail("ＢＯＳＳ＠acme.com")).toBe("boss@acme.com");
  });
  test("by request: sign-in start and Host add refuse an invisible character inside, create nothing, and the plain address still works", async () => {
    for (const [name, ch] of INVISIBLE) {
      const s = await call("POST", "/api/start", { email: "bo" + ch + "ss@acme.com" }, undefined, T, nextIp()); expect([name, s.status]).toEqual([name, 400]);
    }
    expect((raw.prepare("SELECT COUNT(*) AS c FROM organizer_email").get() as any).c).toBe(0);
    const m = await organizer();
    for (const [name, ch] of INVISIBLE) { const h = await call("POST", "/api/org/host", { label: "P", email: "pri" + ch + "ya@acme.com" }, m); expect([name, h.status]).toEqual([name, 400]); }
    expect((raw.prepare("SELECT COUNT(*) AS c FROM organizer_key WHERE kind='host'").get() as any).c).toBe(0);
    expect((await call("POST", "/api/org/host", { label: "P", email: "priya@acme.com" }, m)).status).toBe(200);
  });
});

describe("the kind of ID / the way in is locked with 409 id-kind-locked once anyone holding an ID hash is listed or joined; two sentences", () => {
  const KIND = "You already have people listed. Start a new game to use a different kind of ID.";
  const WAY = "You already have people listed. Start a new game to use a different way of asking for IDs.";
  test("an ID kind change (employee ID to Email ID) is refused with the 'kind of ID' sentence", async () => {
    const m = await mk("V3-L1", EMP); await call("POST", "/api/z/V3-L1/people", { people: [{ name: "Asha", empId: "E101" }] }, m);
    const r = await call("PATCH", "/api/z/V3-L1/settings", { verify: "id", idKind: "email" }, m); const b = await j(r);
    expect([r.status, b.code, b.error]).toEqual([409, "id-kind-locked", KIND]);
  });
  test.failing("PRODUCT DEFECT D2: a change of the way in only (verify id to mobile, kind untouched) is refused with the '...different way of asking for IDs.' sentence", async () => {
    const m = await mk("V3-L2", EMP); await call("POST", "/api/z/V3-L2/people", { people: [{ name: "Asha", empId: "E101" }] }, m);
    const r = await call("PATCH", "/api/z/V3-L2/settings", { verify: "mobile" }, m); const b = await j(r);
    expect([r.status, b.code]).toEqual([409, "id-kind-locked"]); // the lock itself works
    expect(b.error).toBe(WAY); // today the server sends the 'kind of ID' sentence for this change too
  });
  test("the lock holds with a JOINED participant too, and no person listed", async () => {
    const m = await mk("V3-L3", EMP); await call("POST", "/api/z/V3-L3/people", { people: [{ name: "Asha", empId: "E101" }] }, m);
    expect((await call("POST", "/api/z/V3-L3/join", { empId: "e101", name: "Asha", device: dev(5) })).status).toBe(200);
    raw.prepare("DELETE FROM person WHERE eid='V3-L3'").run();
    const r = await call("PATCH", "/api/z/V3-L3/settings", { verify: "id", idKind: "email" }, m); expect([r.status, (await j(r)).code]).toEqual([409, "id-kind-locked"]);
  });
});

describe("endedAtMs: the real end of the game, never moves once returned", () => {
  // The rules: phones-confirmed or organizer end -> returned whatever the clock; scheduled end -> recomputed at read time (+60 s) and returned only once now >= bound;
  // absent while the game can be live; never moves once returned; purge/erase is not an end; cancel is not an end.
  // FINDING: the string "endedAtMs" does not exist anywhere in the product (apps, packages, tools, docs). No endpoint returns it.
  test.failing("PRODUCT DEFECT D3: GET /api/z/:id/info and /summary carry endedAtMs once the game has ended (phones confirmed), whatever the clock", async () => {
    const m = await mk("V3-D1", EMP, false);
    const end = T + 3_600_000;
    raw.prepare("INSERT INTO life(eid,end_ms,end_src) VALUES('V3-D1',?,'phones')").run(end);
    const earlyClock = T; // before the end: a phones-confirmed end is still returned
    const info = await j(await call("GET", "/api/z/V3-D1/info", undefined, undefined, earlyClock)); const sum = await j(await call("GET", "/api/z/V3-D1/summary", undefined, m, earlyClock));
    expect([info.endedAtMs, sum.endedAtMs]).toEqual([end, end]);
  });
  test("endedAtMs is absent while the game can still be live (nothing ended, scheduled end not reached)", async () => {
    await mk("V3-D2", EMP, false);
    const info = await j(await call("GET", "/api/z/V3-D2/info"));
    expect("endedAtMs" in info).toBe(false); // passes today for the wrong reason (the field does not exist at all); the companion test above is the one that is red
  });
  test("what exists today is the stored end, not a public field: info has no end-of-game time at all", async () => {
    await mk("V3-D3", EMP, false);
    const info = await j(await call("GET", "/api/z/V3-D3/info"));
    expect(Object.keys(info).filter((k) => /ended|endAt|end_ms|endMs/i.test(k))).toEqual([]);
  });
});
