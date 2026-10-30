// Fix 1.4.1 (docs/TEST_HANDOFF.md, "Fix 1.4.1"): R1 account e-mails refuse a space inside, R3 the kind of ID is locked once anyone is listed or has joined,
// R4 EMP_CLEAN_FROM_MS is a placeholder until the release session sets it, and the regexes the coder wrote really have backslashes.
// Every rule here has a deliberate-break check in apps/edge/test/break-checks-1.4.1.sh (the product is broken on purpose, the test must go red, then the product is restored).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import type { PayEnv } from "../src/pay";
import { accountEmail, emailId, empId, listEmail, LIST_EMAIL_SHAPE, legacyNormEmp, normEmpFor, EMP_CLEAN_FROM_MS } from "../src/idclean";
import { isTestLogin, TEST_LOGIN_CODE } from "../src/testlogins";
import { normMail } from "../src/mode";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200;
const ROOT = join(import.meta.dir, "../../..");
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"]; let ipN = 0;
const realFetch = globalThis.fetch;
const call = (method: string, path: string, body?: unknown, key?: string, now = T, ip = "9.9.9.9") =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(key ? { "x-organizer": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), env as Env, now);
const j = async (r: Response) => (await r.json()) as any;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const dev = (i: number) => (String(i).padStart(2, "0") + "c".repeat(32)).slice(0, 32);
const nextIp = () => `8.8.${Math.floor(++ipN / 250)}.${(ipN % 250) + 1}`;

beforeEach(() => { const d = makeD1({ strictHosts: true }); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", TEST_MODE: "1" } as PayEnv; (globalThis as any).fetch = async () => new Response("{}", { status: 404 }); });
afterEach(() => { globalThis.fetch = realFetch; });

const start = async (email: string) => call("POST", "/api/start", { email }, undefined, T, nextIp());
const organizer = async (email = "boss@acme.com") => { const st = await j(await start(email)); expect(st.token).toBeTruthy(); return st.token as string; };

describe("R1: the regexes the coder wrote have real backslashes (checked by behaviour, not by reading the source)", () => {
  // If a backslash were lost, \s would turn into the letter s: "sss@sss.ss" would be damaged or refused and "a b" would pass.
  test("accountEmail: the letter s is an ordinary letter, a space is not", () => {
    expect(accountEmail("sss@sss.ss")).toBe("sss@sss.ss"); expect(accountEmail("Susan.S@Sales.com")).toBe("susan.s@sales.com");
    for (const bad of ["a b@c.com", "ab@c .com", "a\tb@c.com", "a\nb@c.com", "a b@c.com", "a　b@c.com", "a b@c.com", "a b @c.com", "ab@ c.com"]) expect([bad, accountEmail(bad)]).toEqual([bad, ""]);
  });
  test("emailId (a participant's Email ID): spaces are removed, the letter s is not", () => {
    expect(emailId("s s@s.com")).toBe("ss@s.com"); expect(emailId("sassy@s.com")).toBe("sassy@s.com"); expect(emailId(" Sa ss y@S.com\t")).toBe("sassy@s.com");
    expect(emailId("a b@c.com")).toBe("ab@c.com"); expect(emailId("a　b@c.com")).toBe("ab@c.com");
  });
  test("LIST_EMAIL_SHAPE: [^\\s@] excludes spaces and at signs, and nothing else (the letter s passes)", () => {
    expect(LIST_EMAIL_SHAPE.test("sss@sss.ss")).toBe(true); expect(LIST_EMAIL_SHAPE.test("a@b.co")).toBe(true);
    for (const bad of ["a b@c.com", "a@b c.com", "a@@b.com", "a@b@c.com", "@b.com", "a@b.c", "a@b", " a@b.com"]) expect([bad, LIST_EMAIL_SHAPE.test(bad)]).toEqual([bad, false]);
    expect(listEmail("S S@SSS.COM")).toBe("ss@sss.com"); expect(listEmail("sss@sss")).toBeNull(); expect(listEmail("")).toBe(""); expect(listEmail("   ")).toBe("");
  });
  test("legacyNormEmp: \\s+ removes spaces only; the escaped hyphen in the class is a hyphen, not a range", () => {
    expect(legacyNormEmp("s s-1")).toBe("SS-1"); expect(legacyNormEmp("a-b/c.d_e")).toBe("A-B/C.D_E"); expect(legacyNormEmp("a$b")).toBeNull(); expect(legacyNormEmp("-a")).toBeNull(); expect(legacyNormEmp("  ")).toBe("");
    expect(legacyNormEmp("A".repeat(30))).toBe("A".repeat(30)); expect(legacyNormEmp("A".repeat(31))).toBeNull();
  });
  test("empId: [^A-Z0-9] drops symbols and keeps every letter and digit (no letter is lost with the symbols)", () => {
    expect(empId("sSs-1.2_x")).toBe("SSS12X"); expect(empId("0123456789abcxyz")).toBe("0123456789ABCXYZ");
  });
  test("the Worker's own address check (Host add): an address with the letter s is accepted, one with a space is refused", async () => {
    const m = await organizer();
    expect((await call("POST", "/api/org/host", { label: "S", email: "sss@sss.ss" }, m)).status).toBe(200);
    expect((await call("POST", "/api/org/host", { label: "S2", email: "sam@sales.com" }, m)).status).toBe(200);
  });
});

describe("R1: account e-mails refuse a space inside; they are never repaired", () => {
  const SPACED = ["boss @acme.com", "bo ss@acme.com", "boss@ acme.com", "boss@acme .com", "boss@acme.c om", "boss @acme.com", "boss　@acme.com", "boss\t@acme.com", "bo ss@acme.com"];
  test("sign-in / start: a space inside is 400 'Please enter a valid e-mail address.' and no account is made; a space at the ends is trimmed", async () => {
    for (const s of SPACED) { const r = await start(s); expect([s, r.status]).toEqual([s, 400]); expect((await j(r)).error).toBe("Please enter a valid e-mail address."); }
    expect((raw.prepare("SELECT COUNT(*) AS c FROM organizer_email").get() as any).c).toBe(0);
    const ok = await start("  Boss@Acme.com\t"); expect(ok.status).toBe(200); expect((raw.prepare("SELECT COUNT(*) AS c FROM organizer_email").get() as any).c).toBe(1);
  });
  test("sign in again (/api/auth/email): the same refusal", async () => {
    await organizer();
    for (const s of SPACED) { const r = await call("POST", "/api/auth/email", { email: s }, undefined, T, nextIp()); expect([s, r.status]).toEqual([s, 400]); expect((await j(r)).error).toBe("Please enter a valid e-mail address."); }
    expect((await call("POST", "/api/auth/email", { email: " BOSS@acme.com " }, undefined, T, nextIp())).status).toBe(200);
  });
  test("the hash of an ordinary address is the same as before: 'A@B.com', ' a@b.com ' and 'a@b.com' are one account, hashed as sha256('email|a@b.com')", async () => {
    await start("A@B.com");
    expect(raw.prepare("SELECT email_hash AS h FROM organizer_email").all()).toEqual([{ h: sha256("email|a@b.com") }]);
    const again = await j(await start(" a@b.com ")); expect(again.exists).toBe(true);
    expect((raw.prepare("SELECT COUNT(*) AS c FROM organizer_email").get() as any).c).toBe(1);
    expect(accountEmail("A@B.com")).toBe(accountEmail(" a@b.com ")); expect(normMail("A@B.com")).toBe(normMail(" a@b.com "));
    expect(normMail("a b@c.com")).toBe(""); // a Host / Co-host role key of a spaced address is nothing, never a repaired address
  });
  test("full-width at sign and full-width letters still fold (NFKC), so an ordinary address typed on a phone keyboard works", () => {
    expect(accountEmail("ＢＯＳＳ＠Acme.com")).toBe("boss@acme.com");
  });
  test("a Host with a spaced address AND a mobile number is refused (400 'That e-mail address does not look right.'), not added by mobile alone", async () => {
    const m = await organizer();
    const r = await call("POST", "/api/org/host", { label: "Priya", email: "pri ya@acme.com", mobile: "9876500002" }, m);
    expect(r.status).toBe(400); expect((await j(r)).error).toBe("That e-mail address does not look right. Please check it.");
    expect((await call("POST", "/api/org/host", { label: "Priya", email: "pri ya@acme.com" }, m)).status).toBe(400);
    expect((raw.prepare("SELECT COUNT(*) AS c FROM organizer_key WHERE kind='host'").get() as any).c).toBe(0);
    const ok = await call("POST", "/api/org/host", { label: "Priya", email: " Priya@Acme.com ", mobile: "9876500002" }, m); expect(ok.status).toBe(200);
    expect((await j(ok)).email).toBe("priya@acme.com");
  });
  test("a Host's own e-mail step (Finish setup) refuses a spaced address", async () => {
    const m = await organizer(); await call("POST", "/api/z", { id: "HOST-1", startRound: START, callSeconds: 9, cap: 100 }, m);
    const h = await j(await call("POST", "/api/org/host", { label: "Priya", mobile: "9876500002", e: "HOST-1" }, m)); expect(h.hostKey).toBeTruthy();
    const r = await call("POST", "/api/host/setup/email", { email: "pri ya@acme.com" }, h.hostKey); expect(r.status).toBe(400); expect((await j(r)).error).toBe("Please enter a valid e-mail address.");
  });
  test("partner enrolment and partner sign-in refuse a spaced address", async () => {
    const r = await call("POST", "/api/partner/enroll", { phone: "9811122233", email: "asha @partner.example", name: "Asha", consent: true }, undefined, T, nextIp());
    expect(r.status).toBe(400); expect((await j(r)).error).toBe("Enter a valid e-mail address. We send you a code.");
    const s = await call("POST", "/api/partner/signin", { email: "asha @partner.example" }, undefined, T, nextIp());
    expect(s.status).toBe(400); expect((await j(s)).error).toBe("Please enter a valid e-mail address.");
    expect((raw.prepare("SELECT COUNT(*) AS c FROM partner").get() as any).c).toBe(0);
  });
  test("isTestLogin: 'demo 1＠xyz.in' is NOT the demo account; the real ones (any case, edge spaces, full-width at sign) still are", () => {
    expect(isTestLogin("demo 1＠xyz.in")).toBe(false); expect(isTestLogin("demo 1@xyz.in")).toBe(false); expect(isTestLogin("demo1 @xyz.in")).toBe(false); expect(isTestLogin("de mo1@xyz.in")).toBe(false);
    expect(isTestLogin("demo1@xyz.in")).toBe(true); expect(isTestLogin(" DEMO1@xyz.in ")).toBe(true); expect(isTestLogin("demo2＠xyz.in")).toBe(true); expect(isTestLogin("demo3@xyz.in\t")).toBe(true);
  });
  test("a spaced look-alike of a test login cannot sign in with the fixed code 123456", async () => {
    const r = await call("POST", "/api/start", { email: "demo 1＠xyz.in" }, undefined, T, nextIp()); expect(r.status).toBe(400);
    const v = await call("POST", "/api/auth/verify", { email: "demo 1＠xyz.in", code: TEST_LOGIN_CODE }, undefined, T, nextIp()); expect(v.status).not.toBe(200);
    expect((raw.prepare("SELECT COUNT(*) AS c FROM organizer_email").get() as any).c).toBe(0);
  });
});

describe("R3: the kind of ID (and the way in) is locked once anyone is listed or has joined", () => {
  const SENTENCE = "You already have people listed. Start a new game to use a different kind of ID.";
  const mk = async (id: string, settings: Record<string, unknown> = { verify: "id", employeesOnly: true }) => {
    const m = await organizer(`o${++ipN}@acme.com`);
    expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100, whoCanJoin: settings.employeesOnly ? "list" : "anyone" }, m)).status).toBe(200);
    expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, m)).status).toBe(200);
    expect((await call("PATCH", `/api/z/${id}/settings`, settings, m)).status).toBe(200);
    return m;
  };
  const counts = (id: string) => ({ person: (raw.prepare("SELECT COUNT(*) AS c FROM person WHERE eid=? AND status<>'removed'").get(id) as any).c as number, participant: (raw.prepare("SELECT COUNT(*) AS c FROM participant WHERE eid=?").get(id) as any).c as number });
  const CHANGES: [string, Record<string, unknown>][] = [["to Email ID", { verify: "id", idKind: "email" }], ["to a mobile number", { verify: "mobile" }], ["to an ID or mobile", { verify: "either" }], ["to both", { verify: "both" }]];

  test("with a person LISTED (nobody joined): every change of kind or way in is 409 id-kind-locked with the sentence; PATCH and POST both", async () => {
    const m = await mk("LCK-1");
    const add = await j(await call("POST", "/api/z/LCK-1/people", { people: [{ name: "Asha", empId: "E101" }] }, m)); expect(add.added).toBe(1);
    expect(counts("LCK-1")).toEqual({ person: 1, participant: 0 });
    for (const method of ["PATCH", "POST"]) for (const [what, body] of CHANGES) {
      const r = await call(method, "/api/z/LCK-1/settings", body, m); const b = await j(r);
      expect([method, what, r.status, b.code, b.error]).toEqual([method, what, 409, "id-kind-locked", SENTENCE]);
    }
    expect(JSON.parse(raw.prepare("SELECT config FROM engagement WHERE id='LCK-1'").get()!["config"] as string)).toMatchObject({ verify: "id" }); // nothing changed
  });
  test("with a participant JOINED (nobody listed, a mobile-number game): the same lock, whatever it is changed to", async () => {
    const m = await mk("LCK-2", { whoCanJoin: "anyone" });
    const jn = await call("POST", "/api/z/LCK-2/join", { phone: "98765 00001", name: "Ravi", device: dev(1) }); expect([jn.status, ((await jn.clone().json()) as any).error]).toEqual([200, undefined]);
    expect(counts("LCK-2").participant).toBe(1);
    raw.prepare("DELETE FROM person WHERE eid='LCK-2'").run(); // a join also lists the person; remove that row so ONLY the participant row can hold the lock
    expect(counts("LCK-2")).toEqual({ person: 0, participant: 1 });
    for (const method of ["PATCH", "POST"]) for (const [what, body] of [["to employee ID", { verify: "id" }], ["to Email ID", { verify: "id", idKind: "email" }], ["to an ID or mobile", { verify: "either" }], ["to both", { verify: "both" }]] as [string, Record<string, unknown>][]) {
      const r = await call(method, "/api/z/LCK-2/settings", body, m); const b = await j(r);
      expect([method, what, r.status, b.code, b.error]).toEqual([method, what, 409, "id-kind-locked", SENTENCE]);
    }
    expect((await call("PATCH", "/api/z/LCK-2/settings", { verify: "mobile", name: "Same way in" }, m)).status).toBe(200); // unchanged still works
  });
  test("a request that leaves the kind and the way in unchanged still works (the lock is not a freeze); other fields can change", async () => {
    const m = await mk("LCK-3"); await call("POST", "/api/z/LCK-3/people", { people: [{ name: "Asha", empId: "E101" }] }, m);
    const same = await call("PATCH", "/api/z/LCK-3/settings", { verify: "id", employeesOnly: true, name: "Renamed" }, m); expect(same.status).toBe(200);
    expect((await call("PATCH", "/api/z/LCK-3/settings", { name: "Renamed again" }, m)).status).toBe(200);
    expect((await call("PATCH", "/api/z/LCK-3/settings", { verify: "id" }, m)).status).toBe(200);
  });
  test("before anyone is listed or has joined, the kind can still be changed (and a removed person does not hold the lock)", async () => {
    const m = await mk("LCK-4");
    expect((await call("PATCH", "/api/z/LCK-4/settings", { verify: "id", idKind: "email", employeesOnly: true }, m)).status).toBe(200);
    expect(JSON.parse(raw.prepare("SELECT config FROM engagement WHERE id='LCK-4'").get()!["config"] as string).idKind).toBe("email");
    const a = await j(await call("POST", "/api/z/LCK-4/people", { people: [{ name: "Asha", empId: "asha@acme.com" }] }, m)); expect(a.added).toBe(1);
    expect((await call("PATCH", "/api/z/LCK-4/settings", { verify: "id", idKind: "emp" }, m)).status).toBe(409);
    raw.prepare("UPDATE person SET status='removed' WHERE eid='LCK-4'").run();
    expect((await call("PATCH", "/api/z/LCK-4/settings", { verify: "id", idKind: "emp", employeesOnly: true }, m)).status).toBe(200);
  });
});

describe("R4: EMP_CLEAN_FROM_MS is a far-future placeholder until the release session sets it (both sides)", () => {
  test("it is exactly 4102444800000 = 1 Jan 2100 00:00 UTC", () => { expect(EMP_CLEAN_FROM_MS).toBe(4102444800000); expect(EMP_CLEAN_FROM_MS).toBe(Date.UTC(2100, 0, 1)); });
  test("server side: a game made now uses the OLD rule (1B-678 and 1B678 stay different, no empClean flag); a game made at the placeholder instant uses the new rule", async () => {
    expect(normEmpFor("1b-678", T)).toBe("1B-678"); expect(normEmpFor("1b-678", EMP_CLEAN_FROM_MS - 1)).toBe("1B-678");
    expect(normEmpFor("1b-678", EMP_CLEAN_FROM_MS)).toBe("1B678"); expect(normEmpFor("1b-678", null)).toBe("1B-678"); expect(normEmpFor("1b-678", undefined)).toBe("1B-678");
    const m = await organizer(); await call("POST", "/api/z", { id: "R4-1", startRound: START, callSeconds: 6, cap: 100 }, m); await call("POST", "/api/z/R4-1/publish", { email: "boss@acme.com", phone: "98765 43210" }, m);
    await call("PATCH", "/api/z/R4-1/settings", { verify: "id", employeesOnly: true }, m);
    const info = await j(await call("GET", "/api/z/R4-1/info")); expect(info.empClean).toBeUndefined();
    const sum = await j(await call("GET", "/api/z/R4-1/summary", undefined, m)); expect(sum.empClean).toBeUndefined();
    const r = await j(await call("POST", "/api/z/R4-1/people", { people: [{ name: "A", empId: "1B-678" }, { name: "B", empId: "1B678" }] }, m)); expect([r.added, r.invalid.length]).toEqual([2, 0]); // two different people
    raw.prepare("UPDATE engagement SET created_ms=? WHERE id='R4-1'").run(EMP_CLEAN_FROM_MS);
    expect((await j(await call("GET", "/api/z/R4-1/info"))).empClean).toBe(true); expect((await j(await call("GET", "/api/z/R4-1/summary", undefined, m))).empClean).toBe(true);
  });
  test("the page side has no second copy: the console and the join page learn the rule from the empClean flag the Worker sends; the constant is defined exactly once, with this value, in all shipped code", () => {
    const hits: string[] = [];
    const walk = (dir: string) => { for (const n of readdirSync(dir)) { if (["node_modules", ".git", "vendor", "test", "pack"].includes(n)) continue; const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|js|mjs|json)$/.test(n)) { const t = readFileSync(p, "utf8"); if (/EMP_CLEAN_FROM_MS\s*=|4102444800000/.test(t)) hits.push(p.slice(ROOT.length + 1)); } } };
    for (const d of ["apps", "packages", "tools", "pages/functions"]) walk(join(ROOT, d));
    expect(hits.filter((h) => !/\.(sh)$/.test(h))).toEqual(["apps/edge/src/idclean.ts"]);
    for (const f of ["zc.js", "luck.js", "idclean.js"]) expect([f, /EMP_CLEAN_FROM_MS|4102444800000/.test(readFileSync(join(ROOT, "apps/web/public", f), "utf8"))]).toEqual([f, false]);
    for (const f of ["zc.js", "luck.js"]) expect([f, /empClean/.test(readFileSync(join(ROOT, "apps/web/public", f), "utf8"))]).toEqual([f, true]);
  });
});
