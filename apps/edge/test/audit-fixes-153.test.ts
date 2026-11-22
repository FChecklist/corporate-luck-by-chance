// Version 1.5.3: the fixes for the two audits of 1.5.2 (PR 14). Each test below FAILS when its fix is taken out (checked with a throwaway change, listed in docs/KNOWLEDGE.md).
// Rules R85 to R90 in docs/RULES.md. Fixtures use @example.com addresses only.
import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { readFileSync } from "node:fs";
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";
import { beginGame, ensureL, luckTick, maybeAutoStart, AUTO_LEAD_SECS } from "../src/luck";
import { erasePersonal } from "../src/lifecycle";
import { sealPii, openPii } from "../src/pii";
import { cleanInviteId, idContentProblem, idHashOf } from "../src/invite-id";
import { defaultSettings } from "../../../packages/luck/src/settings";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const roundMs = (r: number) => (GEN + (r - 1) * 3) * 1000;
const START = roundAt(T) + 1200; // one hour after T
const AT = roundMs(START);
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let n = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (i.toString(16).padStart(4, "0")).repeat(8);

/** A game the way the console makes it: the guest asks for the ID (join: id) and only people on the list come straight in. */
async function game(id: string, over: Record<string, unknown> = {}, paid = true) {
  const r = await j(await call("POST", "/api/start", { email: `o${++n}@example.com` }, { "cf-connecting-ip": `10.0.0.${n}` }));
  const h = { "x-organizer": r.token as string };
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100, whoCanJoin: "list", join: "id", ...over }, h)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@example.com", phone: "98765 43210" }, h)).status).toBe(200);
  if (paid) raw.run("UPDATE engagement SET pack=100 WHERE id=?", [id]);
  return h;
}
const list = (h: Record<string, string>, id: string, ids: unknown[]) => call("POST", `/api/z/${id}/people`, { ids }, h);
const joinWith = (id: string, body: Record<string, unknown>, ip = "1.1.1.1", now = T) => call("POST", `/api/z/${id}/join`, { device: dev(1), name: "Maya", ...body }, { "cf-connecting-ip": ip }, now);
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env; n = 0; });

const NOT_IDS = ["priya@acme.com", "Priya.Sharma@example.com", "9876543210", "98765 43210", "+91 98765 43210", "098765-43210", "(98765) 43210", "+919876543210", "Priya Sharma", "dr priya sharma", "Priya 9876543210", "=HYPERLINK(1)", "A1101, B2202", "Zoë 7", "Ravi;Kumar"];
const IDS = ["A-1101", "A 1101", "a/1101", "EMP 77", "V-0042", "1101", "12345", "A1101234567", "E9876543210", "CUST_0007", "ALPHA", "#4521", "emp.77"];

describe("R85: the ID content rule: a name, an e-mail or a mobile number is never an ID", () => {
  test("the rule itself: every one of these is refused, every real ID passes", () => {
    for (const x of NOT_IDS) expect([x, idContentProblem(x), cleanInviteId(x).ok]).toEqual([x, true, false]);
    for (const x of IDS) expect([x, idContentProblem(x), cleanInviteId(x).ok]).toEqual([x, false, true]);
  });
  test("a bare string in the list, the paste and the roster is refused and never stored (not only objects with a name or phone key)", async () => {
    const h = await game("R85-1");
    const r = await j(await list(h, "R85-1", ["priya@acme.com", "9876543210", "Priya Sharma", "A-1101"]));
    expect(r.added).toBe(1); expect(r.invalid).toHaveLength(3);
    const ro = await j(await call("POST", "/api/z/R85-1/roster", { people: ["rahul@acme.com", "98 7654 3211", "Rahul Verma", "B-2202"] }, h));
    expect(ro.added).toBe(1); expect(ro.invalid).toBe(3);
    const who = [] as string[]; for (const row of raw.query("SELECT pii FROM person").all() as any[]) who.push((await openPii(env as any, row.pii))!.id!); for (const row of raw.query("SELECT pii FROM participant").all() as any[]) who.push((await openPii(env as any, row.pii))!.id!);
    expect(who.sort()).toEqual(["A1101", "B2202"]);
  });
  test("a typed ID that is a name, an e-mail or a number is refused on the join page with a plain sentence, and nothing is stored", async () => {
    const h = await game("R85-2"); await list(h, "R85-2", ["A-1101"]);
    for (const bad of ["priya@acme.com", "9876543210", "Priya Sharma"]) { const r = await joinWith("R85-2", { id: bad }); const b = await j(r); expect([bad, r.status, b.code]).toEqual([bad, 400, "bad-id"]); expect(b.error).toMatch(/does not look like an ID/); }
    expect(raw.query("SELECT COUNT(*) c FROM waiting").get()).toEqual({ c: 0 }); expect(raw.query("SELECT COUNT(*) c FROM participant").get()).toEqual({ c: 0 });
  });
  test("the console's own copy of the rule gives the same answer as the server's, on every example above", () => {
    const src = readFileSync(new URL("../../web/public/zc.js", import.meta.url), "utf8");
    const line = src.split("\n").find((l) => l.startsWith("  const idLooksWrong = "))!; expect(line).toBeTruthy();
    const f = new Function(line.replace("  const idLooksWrong = ", "return ").replace(/;\s*$/, ""))() as (s: string) => boolean;
    for (const x of [...NOT_IDS, ...IDS, "", "   ", "A", "+1101", "1 2 3 4 5 6 7 8 9 0 1"]) expect([x, f(x)]).toEqual([x, idContentProblem(x)]);
  });
});

describe("R86: guessing typed IDs is slowed down (per network address and per game), counted atomically, and a right ID is never stopped", () => {
  const joinNew = (id: string, who: string, i: number, ip: string, now = T) => call("POST", `/api/z/${id}/join`, { id: who, name: "N" + i, device: dev(200 + i) }, { "cf-connecting-ip": ip }, now);
  test("15 wrong tries from one address are answered normally; the 16th and every wrong try after it get the friendly wait message; another address is not affected; the next window starts clean", async () => {
    const h = await game("R86-1"); await list(h, "R86-1", ["A-1101", "A-1102"]);
    for (let i = 0; i < 15; i++) expect([i, (await joinWith("R86-1", { id: "Z-" + (9000 + i) })).status]).toEqual([i, 403]);
    const stop = await joinWith("R86-1", { id: "Z-9999" }); const sb = await j(stop);
    expect(stop.status).toBe(429); expect(sb.code).toBe("too-many-tries"); expect(sb.error).toMatch(/wait 10 minutes/i); expect(sb.error).toMatch(/personal link/i); expect(sb.error).not.toMatch(/IP|rate|limit/i);
    expect((await joinWith("R86-1", { id: "Z-9998" })).status).toBe(429);
    expect((await joinWith("R86-1", { id: "Z-7778" }, "2.2.2.2")).status).toBe(403); // somebody else on another address is not affected
    expect((await joinWith("R86-1", { id: "Z-7777", device: dev(77) }, "1.1.1.1", T + 11 * 60_000)).status).toBe(403); // the next 10-minute window starts clean
  });
  test("probing IDs that already joined (the 423 answer) counts too: it used to be unlimited", async () => {
    const h = await game("R86-2"); await list(h, "R86-2", ["A-1101"]);
    expect((await joinWith("R86-2", { id: "A-1101" }, "3.3.3.3")).status).toBe(200); // the real owner, device 1
    const codes: number[] = []; for (let i = 0; i < 17; i++) codes.push((await call("POST", "/api/z/R86-2/join", { id: "a 1101", name: "Evil", device: dev(50 + i) }, { "cf-connecting-ip": "4.4.4.4" })).status);
    expect(codes.slice(0, 15).every((c) => c === 423)).toBe(true); expect(codes.slice(15)).toEqual([429, 429]);
  });
  test("right tries are not counted: 40 listed people joining from one office address are all let in", async () => {
    const h = await game("R86-3"); await list(h, "R86-3", Array.from({ length: 40 }, (_, i) => "E-" + (1000 + i)));
    for (let i = 0; i < 40; i++) expect([i, (await joinNew("R86-3", "E-" + (1000 + i), i, "5.5.5.5")).status]).toEqual([i, 200]);
  });
  test("a person on their own personal link is not counted as a guesser", async () => {
    const h = await game("R86-5"); const added = (await j(await list(h, "R86-5", ["A-1101"]))).people[0];
    const tok = added.link.split("/j/")[1];
    for (let i = 0; i < 20; i++) expect((await call("POST", "/api/z/R86-5/join", { token: tok, name: "Maya", device: dev(1) }, { "cf-connecting-ip": "6.6.6.6" })).status).toBe(200);
  });
  // M1 (audit): the count must be one atomic write. These fail on the 1.5.3 code (read, then count after the answer): every request in a burst read "0 misses" and all were answered 403.
  test("M1: 70 wrong tries sent AT THE SAME TIME from one address: exactly 15 are answered normally, the other 55 get the wait message, and the counter reads 70 (nothing lost)", async () => {
    const h = await game("R86-6"); await list(h, "R86-6", ["A-1101"]);
    const rs = await Promise.all(Array.from({ length: 70 }, (_, i) => joinNew("R86-6", "Z-" + (3000 + i), i, "7.7.7.7")));
    const codes = rs.map((r) => r.status);
    expect(codes.filter((c) => c === 403)).toHaveLength(15); expect(codes.filter((c) => c === 429)).toHaveLength(55);
    expect(raw.query("SELECT COUNT(*) c FROM waiting").get()).toEqual({ c: 15 }); // nothing is added to the waiting room once the limit is passed
    expect((raw.query("SELECT v FROM kv WHERE k LIKE 'idm/%'").get() as any).v).toBe("70");
  });
  test("M1: 100 parallel probes of an ID that already joined: 15 get 423, the rest 429 (the 423 path is not unlimited in a burst)", async () => {
    const h = await game("R86-7"); await list(h, "R86-7", ["A-1101"]);
    expect((await joinWith("R86-7", { id: "A-1101" }, "3.3.3.3")).status).toBe(200);
    const rs = await Promise.all(Array.from({ length: 100 }, (_, i) => call("POST", "/api/z/R86-7/join", { id: "A 1101", name: "Evil", device: dev(300 + i) }, { "cf-connecting-ip": "4.4.4.4" })));
    const codes = rs.map((r) => r.status); expect(codes.filter((c) => c === 423)).toHaveLength(15); expect(codes.filter((c) => c === 429)).toHaveLength(85);
  });
  test("M1: the count is one statement that returns the new value (no separate read of the counter)", () => {
    const src = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
    expect(src).toMatch(/INSERT INTO kv\(k,v\) VALUES\(\?, '1'\) ON CONFLICT\(k\) DO UPDATE SET v=CAST\(CAST\(v AS INTEGER\)\+1 AS TEXT\) RETURNING/);
    expect(src).not.toContain("idGuessBlocked");
  });
  // M2 (audit): one burst from one address must not lock every typed-ID join of the game.
  test("M2: one address sends 120 wrong IDs at once on a 100-player game: the game is NOT locked: a listed person from another address joins, and another unlisted person still gets the normal answer", async () => {
    const h = await game("R86-8", { cap: 100 }); await list(h, "R86-8", ["A-1101", "A-1102"]);
    await Promise.all(Array.from({ length: 120 }, (_, i) => joinNew("R86-8", "Z-" + (4000 + i), i, "8.8.8.8")));
    expect((raw.query("SELECT v FROM kv WHERE k LIKE 'idg/%'").get() as any).v).toBe("15"); // one address adds at most its own limit to the game's count
    expect((await joinNew("R86-8", "A-1101", 500, "9.9.9.9")).status).toBe(200);
    expect((await joinNew("R86-8", "Z-5000", 501, "9.9.9.10")).status).toBe(403);
  });
  test("M2: even when many addresses push the game over its limit (60 wrong tries), a listed ID still joins; only further wrong tries are told to wait, and the waiting room is not filled past that", async () => {
    const h = await game("R86-4", { cap: 20 }); await list(h, "R86-4", ["A-1101"]);
    for (let i = 0; i < 60; i++) expect((await joinNew("R86-4", "Z-" + (5000 + i), i, `9.9.${Math.floor(i / 200)}.${i + 1}`)).status).toBe(403);
    const wrong = await joinNew("R86-4", "Z-6000", 700, "8.8.4.4"); const wb = await j(wrong);
    expect(wrong.status).toBe(429); expect(wb.code).toBe("too-many-tries"); expect(wb.error).toMatch(/this game/i);
    expect(raw.query("SELECT COUNT(*) c FROM waiting").get()).toEqual({ c: 60 });
    expect((await joinNew("R86-4", "A-1101", 701, "8.8.8.8")).status).toBe(200); // a right ID is never stopped
    expect((await joinNew("R86-4", "Z-6001", 702, "8.8.4.4", T + 11 * 60_000)).status).toBe(403); // the next window starts clean
  });
  // M3 (audit): an office behind one address must not be locked out by its own typos.
  test("M3: 20 colleagues behind one address type an ID that is not on the list (over the address limit); the next colleague, whose ID IS listed, still joins (200); so does the one after", async () => {
    const h = await game("R86-9"); await list(h, "R86-9", ["E-2001", "E-2002"]);
    for (let i = 0; i < 20; i++) await joinNew("R86-9", "TYPO-" + i, i, "5.6.7.8");
    expect((await joinNew("R86-9", "TYPO-99", 90, "5.6.7.8")).status).toBe(429); // the wrong tries are slowed down
    expect((await joinNew("R86-9", "E-2001", 91, "5.6.7.8")).status).toBe(200); // a right ID is not
    expect((await joinNew("R86-9", "E-2002", 92, "5.6.7.8")).status).toBe(200);
  });
  test("M3: 50 listed players behind one address, 25 of them mistyping once first: all 50 get in", async () => {
    const h = await game("R86-10"); await list(h, "R86-10", Array.from({ length: 50 }, (_, i) => "E-" + (3000 + i)));
    for (let i = 0; i < 25; i++) await joinNew("R86-10", "E-" + (3000 + i) + "X", i, "5.5.0.1");
    for (let i = 0; i < 50; i++) expect([i, (await joinNew("R86-10", "E-" + (3000 + i), 100 + i, "5.5.0.1")).status]).toEqual([i, 200]);
  });
});

describe("R87: no game starts before its pay step is done", () => {
  async function twoPlayers(id: string, paid: boolean) {
    const h = await game(id, { whoCanJoin: "anyone", join: "phone" }, paid);
    for (let i = 1; i <= 2; i++) expect((await call("POST", `/api/z/${id}/join`, { id: "P-" + i, name: "Nick " + i, device: dev(i) })).status).toBe(200);
    return h;
  }
  test("the Organizer pressing Start on a published but unpaid game is refused in plain words and nothing starts; once the pay step is done it starts", async () => {
    const h = await twoPlayers("R87-1", false);
    const r = await call("POST", "/api/z/R87-1/luck/start", {}, h, AT + 1000); const b = await j(r);
    expect(r.status).toBe(402); expect(b.code).toBe("unpaid"); expect(b.error).toMatch(/pay step/i);
    expect(raw.query("SELECT state FROM luck_t WHERE eid='R87-1'").get()).toEqual({ state: "open" });
    raw.run("UPDATE engagement SET pack=100 WHERE id='R87-1'");
    expect((await call("POST", "/api/z/R87-1/luck/start", {}, h, AT + 2000)).status).toBe(200);
  });
  test("a Host is held to the same rule, and the owner's test or free-launch size (which sets the same size) lets it start", async () => {
    const h = await twoPlayers("R87-2", false);
    const host = (await j(await call("POST", "/api/org/host", { label: "Priya", email: "priya@example.com", mobile: "9876500001" }, h))).hostKey as string;
    expect((await call("POST", "/api/z/R87-2/luck/start", {}, { "x-organizer": host }, AT + 1000)).status).toBe(402);
    raw.run("UPDATE engagement SET pack=? WHERE id='R87-2'", [20]); // any size above 0: what a paid order, a credit, the owner's test price or the free launch sets
    expect((await call("POST", "/api/z/R87-2/luck/start", {}, { "x-organizer": host }, AT + 2000)).status).toBe(200);
  });
});

describe("R88: the starts never mix up", () => {
  test("a start that lost the race to another start says so (409) and does not report its own clock", async () => {
    const h = await game("R88-1", { whoCanJoin: "anyone", join: "phone", start: "auto" });
    for (let i = 1; i <= 2; i++) await call("POST", "/api/z/R88-1/join", { id: "P-" + i, name: "Nick " + i, device: dev(i) });
    const stale = await ensureL(env, "R88-1"); // what a slow second starter read: still open
    const e = raw.query("SELECT * FROM engagement WHERE id='R88-1'").get() as any;
    const won = await maybeAutoStart(env, e, stale, AT + 1000); expect(won.state).toBe("running");
    const before = raw.query("SELECT start_ms, end_ms FROM luck_t WHERE eid='R88-1'").get();
    const lost = await beginGame(env, stale, defaultSettings(), 20, AT + 3000, async () => true);
    expect(lost).toMatchObject({ ok: false, status: 409, code: "started" });
    expect(raw.query("SELECT start_ms, end_ms FROM luck_t WHERE eid='R88-1'").get()).toEqual(before); // the winner's clock stands
    expect((before as any).start_ms).toBe(AT + 1000 + AUTO_LEAD_SECS * 1000);
  });
  test("the scheduled tick is not starved: 55 paid auto games that never reach 2 players do not stop a ready game from starting", async () => {
    await game("R88-T", { whoCanJoin: "anyone", join: "phone", start: "auto" }); // the template the stuck games are copied from
    const cols = (raw.query("PRAGMA table_info(engagement)").all() as any[]).map((c) => c.name as string).filter((c) => c !== "id");
    for (let i = 0; i < 55; i++) { // earlier start rounds than the ready game, and only one player each
      const id = "STUCK-" + i; raw.run(`INSERT INTO engagement(id, ${cols.join(",")}) SELECT ?, ${cols.join(",")} FROM engagement WHERE id='R88-T'`, [id]);
      raw.run("UPDATE engagement SET start_round=start_round-100 WHERE id=?", [id]);
      await ensureL(env, id); raw.run("INSERT INTO participant(eid,pid,phone_hash,joined_ms) VALUES(?,?,?,?)", [id, "1x" + i, "h" + i, T]);
    }
    await game("R88-2", { whoCanJoin: "anyone", join: "phone", start: "auto" }); // made LAST: its rows are the newest, the way a busy platform has it
    for (let i = 1; i <= 2; i++) await call("POST", "/api/z/R88-2/join", { id: "P-" + i, name: "Nick " + i, device: dev(i) });
    const closed = await luckTick(env, AT + 1000);
    expect(closed).toBeGreaterThanOrEqual(1);
    expect(raw.query("SELECT state FROM luck_t WHERE eid='R88-2'").get()).toEqual({ state: "running" });
  });
});

describe("R89: a listed person with a seat from the roster, or an old 1.5.1 link, is handled", () => {
  test("a seat made by the roster still needs a nickname the first time its player opens the game (no 'Player' on the top-10 list)", async () => {
    const h = await game("R89-1");
    await call("POST", "/api/z/R89-1/roster", { people: ["A-1"] }, h);
    const noNick = await joinWith("R89-1", { id: "a-1", name: "" }); const nb = await j(noNick);
    expect([noNick.status, nb.code]).toEqual([400, "need-nickname"]);
    expect((await joinWith("R89-1", { id: "a-1", name: "Maya" })).status).toBe(200);
    const again = await call("POST", "/api/z/R89-1/join", { id: "a-1", name: "", device: dev(1) }); expect(again.status).toBe(200); // coming back needs no second nickname
  });
  test("a personal link made by 1.5.1 (it holds a number and no ID) still opens", async () => {
    const h = await game("R89-2"); const added = (await j(await list(h, "R89-2", ["A-1101"]))).people[0];
    const tok = added.link.split("/j/")[1];
    raw.run("UPDATE person SET pii=? WHERE eid='R89-2'", [await sealPii(env as any, { phone: "9876543210", name: "Old" })]);
    const r = await call("POST", "/api/z/R89-2/join", { token: tok, name: "Maya", device: dev(1) }); expect(r.status).toBe(200);
    const again = await call("POST", "/api/z/R89-2/join", { token: tok, name: "Maya", device: dev(1) }); expect(again.status).toBe(200); // re-opening is not blocked either
  });
  test("a personal link already opened on another phone says what to do, and does not offer an ID box that the page does not have", async () => {
    const h = await game("R89-3"); const added = (await j(await list(h, "R89-3", ["A-1101"]))).people[0]; const tok = added.link.split("/j/")[1];
    await call("POST", "/api/z/R89-3/join", { token: tok, name: "Maya", device: dev(1) });
    const r = await call("POST", "/api/z/R89-3/join", { token: tok, name: "Maya", device: dev(2) }); const b = await j(r);
    expect([r.status, b.code]).toEqual([423, "link-used"]); expect(b.error).toMatch(/send the link again/i); expect(b.error).not.toMatch(/type your own ID/i); expect(b.needId).toBeUndefined();
  });
});

describe("R90: what is deleted is deleted", () => {
  test("a winner's prize record keeps no ID, name or number once the guests' data goes at 23 hours", async () => {
    const h = await game("R90-1"); await list(h, "R90-1", ["A-1101"]); await joinWith("R90-1", { id: "A-1101" });
    const pii = await sealPii(env as any, { phone: "", name: "Maya", id: "A1101" });
    raw.run("INSERT INTO prize(eid,round,pattern,ordinal,seat,pii,orig,trail) VALUES('R90-1',1,'first',1,1,?,?,?)", [pii, pii, "sealed-trail"]);
    await erasePersonal(env, "R90-1", T + 30 * 3_600_000, "auto");
    expect(raw.query("SELECT pii, orig, trail FROM prize WHERE eid='R90-1'").get()).toEqual({ pii: null, orig: null, trail: null });
  });
  test("deleting one person on request also removes their sealed ID from the list, and their nickname from the frozen seat list", async () => {
    const h = await game("R90-2"); await list(h, "R90-2", ["A-1101", "A-1102"]); await joinWith("R90-2", { id: "A-1101" }); await joinWith("R90-2", { id: "A-1102", name: "Ben" }, "1.1.1.1");
    expect(raw.query("SELECT COUNT(*) c FROM person").get()).toEqual({ c: 2 });
    const r = await call("POST", "/api/z/R90-2/forget", { id: "A-1101" }, h); expect(r.status).toBe(200);
    expect(raw.query("SELECT ph FROM person").all()).toEqual([{ ph: await idHashOf(env, "A1102") }]);
  });
  test("the 'changed from' line in the report names the ID a guest joined with, not a question mark", () => {
    const src = readFileSync(new URL("../src/lifecycle.ts", import.meta.url), "utf8");
    expect(src).toContain("orig?.id || orig?.phone");
  });
});

describe("R91: wording that was wrong is right", () => {
  const pub = (f: string) => readFileSync(new URL("../../web/public/" + f, import.meta.url), "utf8");
  test("the waiting card of a game that starts by itself says so, and the console says an ID is matched, not proven", () => {
    expect(pub("luck.js")).toContain('v.startMode === "auto" ? "The game starts by itself at the start time."');
    expect(pub("zc.js")).toMatch(/An ID is matched to your list, it is not a password/);
  });
  test("the buttons and hints on the console, the AI-link page and the help texts say 'you', not 'me' or 'my'", () => {
    for (const f of ["zc.js", "ai-link.js", "guide.js", "pay.js"]) for (const old of ["Send me a code", "Send me a new code", "E-mail me a code", "Go to my games", "Replace my AI link", "Use my credit"]) expect([f, pub(f).includes(old)]).toEqual([f, false]);
  });
});
