// One uniform form for every ID anyone types or uploads (apps/edge/src/idclean.ts, mirrored in apps/web/public/idclean.js).
// (A) employee ID: NFKC, upper case, keep only A-Z and 0-9.  (B) e-mail ID: NFKC, trim, no inner spaces, lower case. Never mix the two.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import type { PayEnv } from "../src/pay";
import { empId, emailId, normEmpFor, legacyNormEmp, EMP_CLEAN_FROM_MS, EMP_MAX } from "../src/idclean";
import { empHashOf } from "../src/people";
import { normMail } from "../src/mode";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200;
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"]; let ipN = 0;
const realFetch = globalThis.fetch;
const call = (method: string, path: string, body?: unknown, key?: string, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...(key ? { "x-organizer": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), env as Env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (String(i).padStart(2, "0") + "b".repeat(32)).slice(0, 32);
const join = (body: Record<string, unknown>) => call("POST", `/api/z/PPL-1/join`, body);
const NEW_GAME = EMP_CLEAN_FROM_MS; // created_ms of a game made after the deploy instant

async function setup(newRule: boolean) {
  const st = await j(await handle(new Request("http://x/api/start", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `7.7.8.${++ipN}` }, body: JSON.stringify({ email: `o${ipN}@acme.com` }) }), env as Env, T));
  const master = st.token as string;
  await call("POST", "/api/z", { id: "PPL-1", startRound: START, callSeconds: 6, cap: 100, whoCanJoin: "list" }, master);
  await call("POST", "/api/z/PPL-1/publish", { email: "boss@acme.com", phone: "98765 43210" }, master);
  expect((await call("PATCH", "/api/z/PPL-1/settings", { verify: "id", employeesOnly: true }, master)).status).toBe(200);
  if (newRule) raw.prepare("UPDATE engagement SET created_ms=? WHERE id='PPL-1'").run(NEW_GAME);
  return master;
}
const add = (key: string, people: unknown[]) => call("POST", "/api/z/PPL-1/people", { people }, key);

beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt" }; (globalThis as any).fetch = async () => new Response("{}", { status: 404 }); });
afterEach(() => { globalThis.fetch = realFetch; });

describe("(A) employee ID cleaner", () => {
  test("the four ways of writing 1B678 are one ID", () => {
    for (const s of ["1B-678", "1b-678", "1B/678", "1B 678"]) expect(empId(s)).toBe("1B678");
  });
  test("dots, underscores, symbols, accents, other scripts, emoji and zero-width characters are dropped", () => {
    expect(empId("1B.678_x")).toBe("1B678X"); expect(empId("#1B*678!")).toBe("1B678");
    expect(empId("Éé1B678")).toBe("1B678"); // the accent is not A-Z (NFKC keeps é as one letter, which is then dropped)
    expect(empId("१B६७८日本語")).toBe("B"); // other digits and scripts go
    expect(empId("1B😀678🎉")).toBe("1B678");
    expect(empId("1B​67‍8﻿")).toBe("1B678");
  });
  test("full-width letters and digits fold to plain ones (NFKC)", () => { expect(empId("１Ｂ－６７８")).toBe("1B678"); expect(empId("ａｂ１２")).toBe("AB12"); });
  test("30-character cap is applied AFTER cleaning; only-symbols is refused", () => {
    const longTyped = "A-".repeat(30); // 60 typed characters, 30 after cleaning
    expect(normEmpFor(longTyped, NEW_GAME)).toBe("A".repeat(30));
    expect(normEmpFor("A".repeat(EMP_MAX + 1), NEW_GAME)).toBeNull();
    expect(normEmpFor("---//...", NEW_GAME)).toBeNull(); expect(normEmpFor("😀😀", NEW_GAME)).toBeNull();
    expect(normEmpFor("   ", NEW_GAME)).toBe(""); expect(normEmpFor(undefined, NEW_GAME)).toBe("");
  });
  test("a game created BEFORE EMP_CLEAN_FROM_MS keeps the old rule", () => {
    expect(EMP_CLEAN_FROM_MS).toBeGreaterThan(Date.now()); // placeholder until deploy time
    expect(normEmpFor("e-101", T)).toBe("E-101"); expect(normEmpFor("e-101", T)).toBe(legacyNormEmp("e-101"));
    expect(normEmpFor("a<b>", T)).toBeNull(); expect(normEmpFor("1B/678", T)).toBe("1B/678");
    expect(normEmpFor("1B-678", NEW_GAME - 1)).toBe("1B-678"); expect(normEmpFor("1B-678", NEW_GAME)).toBe("1B678");
    expect(normEmpFor("1B-678", undefined)).toBe("1B-678");
  });
  test("the page copy (idclean.js) agrees with the server copy on a table of inputs", () => {
    const src = readFileSync(new URL("../../web/public/idclean.js", import.meta.url), "utf8");
    const g: any = {}; new Function("window", src + "\n;")(g); const P = (g as any).IDCLEAN ?? (globalThis as any).IDCLEAN;
    const table = ["1B-678", "1b-678", "1B/678", "1B 678", "１Ｂ－６７８", "1B😀678", "1B​678", "Éé1", "---", "", "  Rajat1@Demo.com ", "ＲＡＪＡＴ１＠ＤＥＭＯ．ＣＯＭ", "a b\tc"];
    for (const s of table) { expect(P.empId(s)).toBe(empId(s)); expect(P.emailId(s)).toBe(emailId(s)); }
    expect(P.empHint("1B-678")).toBe("The system will read this as 1B678");
    expect(P.emailHint("Rajat1＠Demo.com")).toBe("The system will read this as rajat1@demo.com");
    expect(P.empHint("")).toBe("");
  });
});

describe("(A) on the real paths", () => {
  test("a new game: join with 'ab-12' matches the list row 'AB12'; the list shows ID 'AB12'", async () => {
    const m = await setup(true);
    const r = await j(await add(m, [{ name: "Asha", empId: "AB12" }]));
    expect(r.added).toBe(1); expect(r.people[0].empId).toBe("AB12");
    const ok = await join({ empId: "ab-12", name: "Asha", device: dev(1) }); expect(ok.status).toBe(200);
    const who = await call("POST", "/api/z/PPL-1/who", { empId: "A b/1 2" }); expect(who.status).not.toBe(500);
    expect(raw.prepare("SELECT ph FROM person").all().map((x: any) => x.ph)).toContain(await empHashOf(env, "AB12"));
    const info = await j(await call("GET", "/api/z/PPL-1/info")); expect(info.empClean).toBe(true);
  });
  test("a new game: an ID that cleans to nothing is refused with plain words, on join and on the list", async () => {
    const m = await setup(true);
    const r = await j(await add(m, [{ name: "Bad", empId: "---" }, { name: "Good", empId: "G1" }]));
    expect(r.added).toBe(1); expect(r.invalid.length).toBe(1); expect(r.invalid[0].why).toContain("no letters or numbers");
    const bad = await join({ empId: "//", name: "X", device: dev(2) }); expect(bad.status).toBe(400); const b = await j(bad); expect(b.code).toBe("bad-id"); expect(b.error).toContain("Employee ID box");
  });
  test("a new game: rows that are the same only after cleaning are FLAGGED to the organizer, not silently dropped", async () => {
    const m = await setup(true);
    const r = await j(await add(m, [{ name: "A", empId: "1B-678" }, { name: "B", empId: "1b/678" }, { name: "C", empId: "1B678" }]));
    expect(r.added).toBe(1); expect(r.invalid.length).toBe(2); expect(r.invalid[0].why).toContain("1B678");
  });
  test("an OLD game (created before the deploy instant) is unchanged: 1B-678 and 1B678 are different people, symbols are refused", async () => {
    const m = await setup(false);
    const r = await j(await add(m, [{ name: "A", empId: "1B-678" }, { name: "B", empId: "1B678" }, { name: "C", empId: "a<b>" }]));
    expect(r.added).toBe(2); expect(r.invalid.length).toBe(1); expect(r.duplicates).toBe(0);
    const info = await j(await call("GET", "/api/z/PPL-1/info")); expect(info.empClean).toBeUndefined();
  });
});

describe("(B) e-mail ID cleaner", () => {
  const variants = (() => { const base = "rajat1@demo.com", out: string[] = []; for (let m = 0; m < 16; m++) { const a = base.split(""); [0, 1, 2, 3].forEach((k, bit) => { if (m & (1 << bit)) a[k] = a[k]!.toUpperCase(); }); out.push(a.join("")); } return out; })();
  test("all 16 upper/lower variants, with spaces and the full-width @, are one e-mail", () => {
    expect(new Set(variants).size).toBe(16);
    for (const v of variants) { expect(emailId(v)).toBe("rajat1@demo.com"); expect(emailId("  " + v.replace("@", "＠") + "\t")).toBe("rajat1@demo.com"); expect(emailId(v.replace("@", " @ "))).toBe("rajat1@demo.com"); }
    expect(new Set(variants.map((v) => normMail(v))).size).toBe(1); // Host / Co-host role keys use the same cleaner
  });
  test("duplicates by case are detected as one address", () => {
    const seen = new Set<string>(); let dup = 0; for (const v of ["Rajat1@demo.com", "rajat1@DEMO.com", "RAJAT1@demo.com"]) { const k = emailId(v); if (seen.has(k)) dup++; seen.add(k); }
    expect(dup).toBe(2);
  });
  test("the employee-ID cleaner is never applied to an e-mail (symbols and case survive in the right way)", () => {
    expect(emailId("a.b_c-d@x.co")).toBe("a.b_c-d@x.co"); expect(empId("a.b_c-d@x.co")).not.toBe(emailId("a.b_c-d@x.co"));
  });
});
