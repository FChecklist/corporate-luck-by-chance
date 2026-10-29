// The Luck by Chance game through the real Worker routes: join, start, the seat list, the beacon values (only when due), the phones' result votes, the secret, deletion.
// Rules: docs/RULES.md (R34 and up). The game itself is tested in packages/luck/test/engine.test.ts; here the phones are played by the real engine.
import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";
import { LuckGame, beaconDueMs, gameEndMs, totalDiceRounds, windowCloseMs, type LuckSettings } from "../../../packages/luck/src/index";
import { beaconValue, commitOf, normalizeResult, quorumFor, seedOf } from "../src/luck";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200;
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let n = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (i.toString(16).padStart(4, "0")).repeat(8); // 32 hex characters
interface P { pid: string; device: string; name: string }

async function game(id: string, over: Record<string, unknown> = {}) {
  const r = await j(await call("POST", "/api/start", { email: `o${++n}@acme.com` }, { "cf-connecting-ip": `10.0.0.${n}` }));
  const h = { "x-organizer": r.token as string };
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100, ...over }, h)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h)).status).toBe(200);
  raw.run("UPDATE engagement SET pack=100 WHERE id=?", [id]); // paid, so the game never locks while a test moves the clock forward
  return h;
}
async function joinAll(id: string, count: number, from = 1): Promise<P[]> {
  const out: P[] = [];
  for (let i = from; i < from + count; i++) {
    const name = `Nick ${i}`; const r = await call("POST", `/api/z/${id}/join`, { name, device: dev(i) }); expect(r.status).toBe(200);
    out.push({ pid: (await j(r)).pid, device: dev(i), name });
  }
  return out;
}
const view = async (id: string, now = T) => j(await call("GET", `/api/z/${id}/luck/view`, undefined, {}, now));
const beacons = async (id: string, from: number, now: number) => j(await call("GET", `/api/z/${id}/luck/beacon?from=${from}`, undefined, {}, now));
const SET = { rounds: 2, windowSecs: 6, prizeMode: "both", prizes: { overall: ["Hamper", "Book"], rounds: [["Pen"], ["Mug"]] } };

/** What a phone does: fetch every beacon value that is due, play the whole game with the engine, and make its result. */
async function phoneResult(id: string, settings: LuckSettings, players: number, now: number) {
  const vals: string[] = []; for (;;) { const b = await beacons(id, vals.length, now); for (const x of b.values) vals[x.i] = x.v; if (!b.values.length) break; }
  const g = new LuckGame(id, settings, players);
  for (let k = 0; k < totalDiceRounds(settings); k++) await g.addDiceRound(k, vals[2 * k]!, vals[2 * k + 1]!);
  const line = (r: any) => ({ seat: r.seat, points: r.points, hits: r.hits, best: r.best, line: r.line });
  const rounds = []; for (let r = 1; r <= settings.rounds; r++) rounds.push((await g.roundRanking(r)).map(line));
  return { game: g, vals, result: { overall: (await g.overallRanking()).map(line), rounds } };
}
const vote = (id: string, p: P, result: unknown, now: number) => call("POST", `/api/z/${id}/luck/vote`, { pid: p.pid, device: p.device, result }, {}, now);
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env; n = 0; });

describe("the lobby and the start", () => {
  test("R34: start is refused with fewer than two players, for a stranger and for the AI helper; wrong settings are refused with a plain sentence", async () => {
    const h = await game("LK-1"); await joinAll("LK-1", 1);
    expect((await view("LK-1")).joined).toBe(1);
    const few = await call("POST", "/api/z/LK-1/luck/start", {}, h); expect(few.status).toBe(409); expect((await j(few)).code).toBe("too-few");
    await joinAll("LK-1", 1, 2);
    expect((await call("POST", "/api/z/LK-1/luck/start", {})).status).toBe(403);
    const aiKey = await j(await call("POST", "/api/org/ai", {}, h));
    if (aiKey.token) expect((await call("POST", "/api/z/LK-1/luck/start", {}, { "x-organizer": aiKey.token })).status).toBe(403);
    for (const bad of [{ rounds: 21 }, { rounds: 0 }, { windowSecs: 7 }, { prizes: { overall: ["win cash"] } }, { prizeMode: "x" }, { prizes: { overall: ["a", "b", "c", "d", "e", "f"] } }]) {
      const r = await call("POST", "/api/z/LK-1/luck/start", { settings: bad }, h); expect([JSON.stringify(bad), r.status]).toEqual([JSON.stringify(bad), 400]); expect((await j(r)).error.length).toBeGreaterThan(5);
    }
    expect((await call("POST", "/api/z/LK-1/luck/start", { delaySecs: 2 }, h)).status).toBe(400);
  });
  test("QA C2: a long prize list is read in full; settings that cannot be read stop the Start with a plain 400 and start nothing (they used to become a default game with no error)", async () => {
    const h = await game("LK-BIG"); await joinAll("LK-BIG", 3);
    const gifts = (r: number) => Array.from({ length: 5 }, (_, i) => `Gift ${r}-${i + 1} ${"x".repeat(34)}`);
    const big = { rounds: 20, windowSecs: 15, prizeMode: "both", prizes: { overall: gifts(0), rounds: Array.from({ length: 20 }, (_, r) => gifts(r + 1)) } };
    expect(JSON.stringify({ settings: big, delaySecs: 20 }).length).toBeGreaterThan(4096); // the old limit
    const raw2 = (body: string) => handle(new Request("http://x/api/z/LK-BIG/luck/start", { method: "POST", headers: { "content-type": "application/json", ...h }, body }), env, T);
    for (const bad of ["{not json", JSON.stringify({ settings: { pad: "x".repeat(40_000) } })]) { const r = await raw2(bad); expect([bad.slice(0, 12), r.status]).toEqual([bad.slice(0, 12), 400]); expect((await j(r)).error).toMatch(/too long or damaged/); expect((await view("LK-BIG")).state).toBe("open"); }
    expect((await raw2(JSON.stringify({ settings: big, delaySecs: 20 }))).status).toBe(200);
    const s = (await view("LK-BIG", T + 1000)).settings; expect(s.rounds).toBe(20); expect(s.windowSecs).toBe(15); expect(s.prizes.overall.length).toBe(5); expect(s.prizes.rounds.length).toBe(20); expect(s.prizes.rounds[19][4]).toBe(gifts(20)[4]);
  });
  test("QA C2: Start with no body at all still starts a default game", async () => {
    const h = await game("LK-NOB"); await joinAll("LK-NOB", 2);
    const r = await handle(new Request("http://x/api/z/LK-NOB/luck/start", { method: "POST", headers: { ...h } }), env, T); expect(r.status).toBe(200);
    expect((await view("LK-NOB", T + 1000)).settings.rounds).toBe(10);
  });
  test("QA E12: Start is refused with 402 not-paid while nobody has paid for the game, and works once it is paid (an unpaid game could be played for free before)", async () => {
    const r = await j(await call("POST", "/api/start", { email: `o${++n}@acme.com` }, { "cf-connecting-ip": `10.0.0.${n}` })); const h = { "x-organizer": r.token as string };
    expect((await call("POST", "/api/z", { id: "LK-UNP", startRound: START, callSeconds: 6, cap: 100 }, h)).status).toBe(200);
    expect((await call("POST", "/api/z/LK-UNP/publish", { email: "boss@acme.com", phone: "98765 43210" }, h)).status).toBe(200); // published, not paid: pack stays 0
    await joinAll("LK-UNP", 3);
    const no = await call("POST", "/api/z/LK-UNP/luck/start", { settings: SET }, h); expect(no.status).toBe(402); const b = await j(no); expect(b.code).toBe("not-paid"); expect(b.error).toMatch(/not paid for yet/);
    expect((await view("LK-UNP")).state).toBe("open"); // nothing started, the list is still open
    raw.run("UPDATE engagement SET pack=100 WHERE id=?", ["LK-UNP"]);
    expect((await call("POST", "/api/z/LK-UNP/luck/start", { settings: SET }, h)).status).toBe(200);
  });
  test("R35: the fingerprint is public from the first look; the secret is shown only after the game is over, and then anybody can check the seed", async () => {
    const h = await game("LK-2"); const ps = await joinAll("LK-2", 4);
    const v0 = await view("LK-2"); expect(v0.commit).toMatch(/^[0-9a-f]{64}$/); expect(v0.state).toBe("open");
    expect((await j(await call("GET", "/api/z/LK-2/luck/reveal"))).revealed).toBe(false);
    const st = await j(await call("POST", "/api/z/LK-2/luck/start", { settings: SET }, h)); expect(st.ok).toBe(true);
    expect((await j(await call("GET", "/api/z/LK-2/luck/reveal", undefined, {}, st.startMs + 1000))).revealed).toBe(false); // the secret would let anybody compute every future number: not while it runs
    const settings = (await view("LK-2", T + 30_000)).settings as LuckSettings;
    const { result } = await phoneResult("LK-2", settings, 4, st.endMs + 1);
    for (const p of ps) await vote("LK-2", p, result, st.endMs + 2);
    const rv = await j(await call("GET", "/api/z/LK-2/luck/reveal", undefined, {}, st.endMs + 3));
    expect(rv.revealed).toBe(true); expect(await commitOf(rv.secret)).toBe(v0.commit); expect(rv.seed).toBe(await seedOf(rv.secret, "LK-2", ps.map((p) => p.pid)));
  });
  test("R36: the list closes at the start (registration closes before the first dice round): a new phone is refused, a player who was in can open the link again", async () => {
    const h = await game("LK-3"); const ps = await joinAll("LK-3", 4);
    await call("POST", "/api/z/LK-3/luck/start", {}, h);
    const late = await call("POST", "/api/z/LK-3/join", { name: "Late Lata", device: dev(99) }); expect(late.status).toBe(409); expect((await j(late)).code).toBe("closed");
    const again = await j(await call("POST", "/api/z/LK-3/join", { name: ps[0]!.name, device: ps[0]!.device })); expect(again.pid).toBe(ps[0]!.pid);
    expect((await call("POST", "/api/z/LK-3/luck/start", {}, h)).status).toBe(409); // not twice
  });
});

describe("the numbers: seats, beacon values, votes", () => {
  test("R37: a beacon value is sent only from the moment it is due; the dice value of a dice round only after its press window closed", async () => {
    const h = await game("LK-4"); await joinAll("LK-4", 3);
    const st = await j(await call("POST", "/api/z/LK-4/luck/start", { settings: { ...SET, rounds: 5 } }, h));
    const s = (await view("LK-4", T + 1000)).settings as LuckSettings, start = st.startMs;
    expect((await beacons("LK-4", 0, start - 1)).values.length).toBe(0); // before the start nothing exists
    expect((await beacons("LK-4", 0, start)).values.map((x: any) => x.i)).toEqual([0]); // target 0 opens with the dice round
    expect((await beacons("LK-4", 0, windowCloseMs(s, start, 0) - 1)).values.map((x: any) => x.i)).toEqual([0]); // the dice value 1 does not exist while the window is open
    expect((await beacons("LK-4", 0, windowCloseMs(s, start, 0))).values.map((x: any) => x.i)).toEqual([0, 1]);
    const all = await beacons("LK-4", 0, gameEndMs(s, start) + 1); expect(all.values.length).toBe(60); expect(all.next).toBe(60); // a batch
    const rest = await beacons("LK-4", 60, gameEndMs(s, start) + 1); expect(rest.values.map((x: any) => x.i)).toEqual(Array.from({ length: 2 * totalDiceRounds(s) - 60 }, (_, i) => 60 + i));
    for (const x of [...all.values, ...rest.values]) expect(beaconDueMs(s, start, x.i)).toBeLessThanOrEqual(gameEndMs(s, start));
    expect((await call("GET", "/api/z/LK-4/luck/beacon", undefined, {}, T)).status).toBe(200);
    const open = await game("LK-4b"); void open;
    expect((await call("GET", "/api/z/LK-4b/luck/beacon", undefined, {}, T)).status).toBe(409); // not started
  });
  test("R38: after the start the list of nicknames is public (nicknames and seat numbers only, no device, no phone, no pid); before it, it is closed", async () => {
    const h = await game("LK-5"); const ps = await joinAll("LK-5", 5);
    expect((await call("GET", "/api/z/LK-5/luck/seats")).status).toBe(409);
    await call("POST", "/api/z/LK-5/luck/start", {}, h);
    const r = await j(await call("GET", "/api/z/LK-5/luck/seats")); expect(r.seats.length).toBe(5); expect(r.seats.map((x: any) => x[0])).toEqual([0, 1, 2, 3, 4]);
    const txt = JSON.stringify(r); for (const p of ps) { expect(txt).not.toContain(p.device); expect(txt).not.toContain(p.pid); } expect(txt).toContain("Nick 1");
  });
  test("R39: a result counts only when enough different phones send the same one; one phone alone, a forged result or a vote before the end counts for nothing", async () => {
    const h = await game("LK-6"); const ps = await joinAll("LK-6", 6);
    const st = await j(await call("POST", "/api/z/LK-6/luck/start", { settings: SET }, h)); const after = st.endMs + 5;
    const s = (await view("LK-6", T + 1000)).settings as LuckSettings;
    const { result } = await phoneResult("LK-6", s, 6, after);
    expect((await vote("LK-6", ps[0]!, result, st.endMs - 5000)).status).toBe(409); // the game is not over yet
    expect(quorumFor(6)).toBe(3); expect(quorumFor(2)).toBe(2); expect(quorumFor(1000)).toBe(50);
    expect((await j(await vote("LK-6", ps[0]!, result, after))).agreed).toBe(false);
    const forged = JSON.parse(JSON.stringify(result)); forged.overall[0].seat = forged.overall[3].seat; forged.overall[3].seat = result.overall[0]!.seat; // a modified phone puts its own pick first
    expect((await vote("LK-6", ps[1]!, forged, after)).status).toBe(200);
    expect((await j(await call("GET", "/api/z/LK-6/luck/rank", undefined, {}, after))).agreed).toBe(false); // 1 against 1: no result
    expect((await j(await vote("LK-6", ps[2]!, result, after))).agreed).toBe(false);
    expect((await j(await vote("LK-6", ps[3]!, result, after))).agreed).toBe(true); // 3 honest phones against 1
    const rank = await j(await call("GET", "/api/z/LK-6/luck/rank", undefined, {}, after));
    expect(rank.agreed).toBe(true); expect(rank.overall.length).toBe(6); expect(rank.overall.map((x: any) => x.place)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rank.overall[0].name).toBe(`Nick ${result.overall[0]!.seat + 1}`);
    expect((await vote("LK-6", { pid: "zz", device: dev(50), name: "" }, result, after)).status).toBe(403); // not a player
    expect((await call("POST", "/api/z/LK-6/luck/vote", { pid: ps[4]!.pid, device: dev(77), result }, {}, after)).status).toBe(403); // wrong phone
  });
  test("R40: a result with an odd shape (a seat that does not exist, a repeated seat, a wrong number of rounds, an impossible score) is refused", async () => {
    const good = { overall: [{ seat: 0, points: 5, hits: 1, best: 5, line: "" }, { seat: 1, points: 3, hits: 1, best: 3, line: "" }], rounds: [[{ seat: 0, points: 5, hits: 1, best: 5, line: "" }], [{ seat: 1, points: 3, hits: 1, best: 3, line: "" }]] };
    expect(normalizeResult(good, 2, 2)).not.toBeNull();
    expect(normalizeResult({ ...good, overall: [{ seat: 7, points: 5, hits: 1, best: 5 }] }, 2, 2)).toBeNull();
    expect(normalizeResult({ ...good, overall: [good.overall[0], good.overall[0]] }, 2, 2)).toBeNull();
    expect(normalizeResult(good, 2, 3)).toBeNull();
    expect(normalizeResult({ ...good, overall: [{ seat: 0, points: 99999, hits: 1, best: 5 }] }, 2, 2)).toBeNull();
    expect(normalizeResult({ ...good, overall: [{ seat: 0, points: 5, hits: 1, best: 9 }] }, 2, 2)).toBeNull();
  });
  test("R41: the whole game through the routes: phones play with the real engine, the agreed result has a strict 1st to 5th and the podium goes to the winners record as seat numbers", async () => {
    const h = await game("LK-7"); const ps = await joinAll("LK-7", 12);
    const st = await j(await call("POST", "/api/z/LK-7/luck/start", { settings: SET }, h)); const after = st.endMs + 5;
    const s = (await view("LK-7", T + 1000)).settings as LuckSettings;
    const a = await phoneResult("LK-7", s, 12, after), b = await phoneResult("LK-7", s, 12, after + 99);
    expect(JSON.stringify(a.result)).toBe(JSON.stringify(b.result)); // two phones, the same result
    for (const p of ps.slice(0, 4)) await vote("LK-7", p, a.result, after);
    const rank = await j(await call("GET", "/api/z/LK-7/luck/rank", undefined, {}, after));
    expect(rank.overall.length).toBe(10); expect(new Set(rank.overall.map((x: any) => x.name)).size).toBe(10); expect(rank.rounds.length).toBe(2);
    const settled = raw.query("SELECT pattern FROM settled WHERE eid='LK-7' ORDER BY pattern").all().map((r: any) => r.pattern); expect(settled.sort()).toEqual(["fifth", "first", "fourth", "second", "third"]);
    expect((await view("LK-7", after)).state).toBe("done");
    const rv = await j(await call("GET", "/api/z/LK-7/luck/reveal", undefined, {}, after));
    for (let i = 0; i < a.vals.length; i++) expect(await beaconValue(rv.seed, i)).toBe(a.vals[i]!); // anybody can re-check every beacon value afterwards
  });
  test("R42: if the phones never agree, the game is closed without a published result", async () => {
    const h = await game("LK-8"); const ps = await joinAll("LK-8", 4);
    const st = await j(await call("POST", "/api/z/LK-8/luck/start", { settings: SET }, h));
    const s = (await view("LK-8", T + 1000)).settings as LuckSettings;
    const { result } = await phoneResult("LK-8", s, 4, st.endMs + 1); await vote("LK-8", ps[0]!, result, st.endMs + 1);
    await call("POST", "/api/lifecycle/tick", {}, { "x-organizer": "plat" }, st.endMs + 11 * 60_000);
    const r = await j(await call("GET", "/api/z/LK-8/luck/rank", undefined, {}, st.endMs + 11 * 60_000)); expect(r.agreed).toBe(false); expect(r.done).toBe(true);
  });
  test("R47: a full 20-round game's result (the biggest one) fits in a vote and is accepted", async () => {
    const h = await game("LK-14"); const ps = await joinAll("LK-14", 12);
    const st = await j(await call("POST", "/api/z/LK-14/luck/start", { settings: { rounds: 20, windowSecs: 6 } }, h));
    const s = (await view("LK-14", T + 1000)).settings as LuckSettings; expect(s.rounds).toBe(20);
    const { result } = await phoneResult("LK-14", s, 12, st.endMs + 1); expect(JSON.stringify(result).length).toBeGreaterThan(15000);
    for (const p of ps.slice(0, 3)) expect((await vote("LK-14", p, result, st.endMs + 2)).status).toBe(200);
    expect((await j(await call("GET", "/api/z/LK-14/luck/rank", undefined, {}, st.endMs + 3))).rounds.length).toBe(20);
  });
});

describe("money, deletion, isolation", () => {
  test("R43: nothing is ever taken from a player: no fee field is accepted by the game, and the game's server code has no payment code", async () => {
    const h = await game("LK-9"); await joinAll("LK-9", 2);
    const st = await j(await call("POST", "/api/z/LK-9/luck/start", { settings: { ...SET, fee: 50, entryFee: 10, price: 5, stake: 1 }, fee: 5 }, h)); expect(st.ok).toBe(true);
    const row = raw.query("SELECT opts FROM luck_t WHERE eid='LK-9'").get() as any; for (const f of ["fee", "entryFee", "price", "stake"]) expect(row.opts.includes(f)).toBe(false);
    expect(raw.query("SELECT COUNT(*) c FROM payment").get()).toEqual({ c: 0 });
    const src = await Bun.file(new URL("../src/luck.ts", import.meta.url)).text(); expect(/checkout|razorpay|payment|amount|price\(/i.test(src)).toBe(false);
  });
  test("R44/D5: 24 hours after the end every nickname and every vote is gone; the agreed result keeps only seat numbers", async () => {
    const h = await game("LK-10"); const ps = await joinAll("LK-10", 4);
    const st = await j(await call("POST", "/api/z/LK-10/luck/start", { settings: SET }, h));
    const s = (await view("LK-10", T + 1000)).settings as LuckSettings;
    const { result } = await phoneResult("LK-10", s, 4, st.endMs + 1); for (const p of ps) await vote("LK-10", p, result, st.endMs + 2);
    expect((raw.query("SELECT COUNT(*) c FROM luck_p WHERE eid='LK-10'").get() as any).c).toBe(4);
    expect(JSON.stringify(raw.query("SELECT result FROM luck_t WHERE eid='LK-10'").get())).not.toContain("Nick");
    await call("POST", "/api/lifecycle/tick", {}, { "x-organizer": "plat" }, st.endMs + 25 * 3_600_000);
    for (const t of ["luck_p", "luck_v", "participant"]) expect([t, (raw.query(`SELECT COUNT(*) c FROM ${t} WHERE eid='LK-10'`).get() as any).c]).toEqual([t, 0]);
    expect((raw.query("SELECT result FROM luck_t WHERE eid='LK-10'").get() as any).result).not.toBeNull(); // seat numbers only, until the retention date
  });
  test("R45: a game never reads or writes another game's rows", async () => {
    const h1 = await game("LK-11"), h2 = await game("LK-12"); const a = await joinAll("LK-11", 2), b = await joinAll("LK-12", 2, 10);
    await call("POST", "/api/z/LK-11/luck/start", {}, h1); await call("POST", "/api/z/LK-12/luck/start", {}, h2);
    expect((await call("POST", "/api/z/LK-12/luck/start", {}, h1)).status).toBe(403);
    expect((await call("GET", `/api/z/LK-12/luck/me?pid=${a[0]!.pid}&device=${a[0]!.device}`, undefined, {}, T + 10)).status).toBe(403);
    expect((raw.query("SELECT COUNT(*) c FROM luck_p WHERE eid='LK-11'").get() as any).c).toBe(2);
    const seats = await j(await call("GET", "/api/z/LK-11/luck/seats")); expect(JSON.stringify(seats)).not.toContain(b[0]!.name);
  });
  test("R46: a player sees their own seat and nickname on the me route, from their own phone only", async () => {
    const h = await game("LK-13"); const ps = await joinAll("LK-13", 3); await call("POST", "/api/z/LK-13/luck/start", {}, h);
    const m = await j(await call("GET", `/api/z/LK-13/luck/me?pid=${ps[1]!.pid}&device=${ps[1]!.device}`, undefined, {}, T + 10)); expect(m.phase).toBe("playing"); expect(m.you.name).toBe("Nick 2"); expect(m.you.seat).toBe(1);
    expect((await call("GET", `/api/z/LK-13/luck/me?pid=${ps[1]!.pid}&device=${dev(55)}`, undefined, {}, T + 10)).status).toBe(403);
  });
});
