// O7: the Organizer or a Host can End a running game. Nothing is computed on the server: the game simply gets fewer rounds (the round being played is finished and counted),
// so the beacon feed stops there, every phone that reads the settings stops after that round, and the phones' own result is the final one.
// Also: the console cannot save what no player will ever see (opening / closing messages, messages between rounds, lucky draws). Rules: docs/RULES.md R51, R52.
import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";
import { LuckGame, gameEndMs, totalDiceRounds, type LuckSettings } from "../../../packages/luck/src/index";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200;
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let n = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (i.toString(16).padStart(4, "0")).repeat(8);
interface P { pid: string; device: string; name: string }
const sql = (q: string, ...a: unknown[]) => raw.query(q).all(...(a as any[])) as any[];

async function game(id: string, over: Record<string, unknown> = {}) {
  const r = await j(await call("POST", "/api/start", { email: `o${++n}@acme.com` }, { "cf-connecting-ip": `10.0.0.${n}` }));
  const h = { "x-organizer": r.token as string };
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100, ...over }, h)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h)).status).toBe(200);
  raw.run("UPDATE engagement SET pack=100 WHERE id=?", [id]);
  return { h, ai: r.aiKey as string };
}
async function joinAll(id: string, count: number): Promise<P[]> {
  const out: P[] = [];
  for (let i = 1; i <= count; i++) { const name = `Nick ${i}`; const r = await call("POST", `/api/z/${id}/join`, { name, device: dev(i) }); expect(r.status).toBe(200); out.push({ pid: (await j(r)).pid, device: dev(i), name }); }
  return out;
}
const view = async (id: string, now: number) => j(await call("GET", `/api/z/${id}/luck/view`, undefined, {}, now));
const beacons = async (id: string, from: number, now: number) => j(await call("GET", `/api/z/${id}/luck/beacon?from=${from}`, undefined, {}, now));
const SET = { rounds: 3, windowSecs: 6, prizeMode: "both", prizes: { overall: ["Hamper", "Book"], rounds: [["Pen"], ["Mug"], ["Cap"]] } };
const line = (r: any) => ({ seat: r.seat, points: r.points, hits: r.hits, best: r.best, line: r.line });
/** What a phone does: read the settings the server shows NOW, take every beacon value that is due, play, and make its result. */
async function phoneResult(id: string, players: number, now: number) {
  const settings = (await view(id, now)).settings as LuckSettings;
  const vals: string[] = []; for (;;) { const b = await beacons(id, vals.length, now); for (const x of b.values) vals[x.i] = x.v; if (!b.values.length) break; }
  const g = new LuckGame(id, settings, players);
  for (let k = 0; k < totalDiceRounds(settings); k++) await g.addDiceRound(k, vals[2 * k]!, vals[2 * k + 1]!);
  const rounds = []; for (let r = 1; r <= settings.rounds; r++) rounds.push((await g.roundRanking(r)).map(line));
  return { settings, vals, result: { overall: (await g.overallRanking()).map(line), rounds } };
}
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env; n = 0; });

describe("R51: the organizer ends a running game", () => {
  test("ending in round 1 of 3: the game has 1 round from now on, the feed stops there, and the phones' result is the final one", async () => {
    const o = await game("LE-1"); const ps = await joinAll("LE-1", 4);
    const st = await j(await call("POST", "/api/z/LE-1/luck/start", { settings: SET }, o.h)); expect(st.ok).toBe(true);
    const before = await view("LE-1", st.startMs + 1000); expect(before.settings.rounds).toBe(3); expect(before.endedAfterRound).toBeNull();
    const at = st.startMs + 5000; // inside the press window of the first dice round
    const r = await call("POST", "/api/z/LE-1/luck/end", {}, o.h, at); expect(r.status).toBe(200);
    const e = await j(r); expect(e).toMatchObject({ ok: true, endedAfterRound: 1, rounds: 1 }); expect(e.endsMs).toBe(gameEndMs({ ...SET, rounds: 1, diceRounds: 10, revealSecs: 3, breakSecs: 20 } as LuckSettings, st.startMs));
    const v = await view("LE-1", at + 1000); expect(v.settings.rounds).toBe(1); expect(v.endedAfterRound).toBe(1); expect(v.endMs).toBe(e.endsMs); expect(v.state).toBe("running");
    const b = await beacons("LE-1", 0, e.endsMs + 5000); expect(b.total).toBe(2 * 10); // 10 dice rounds in the one round; later values are never published
    // the phones read the new settings, play 10 dice rounds and send the same result: it is accepted and the game is closed with a podium
    const { result, settings } = await phoneResult("LE-1", 4, e.endsMs + 1); expect(settings.rounds).toBe(1); expect(result.rounds.length).toBe(1);
    for (const p of ps.slice(0, 3)) { const x = await call("POST", "/api/z/LE-1/luck/vote", { pid: p.pid, device: p.device, result }, {}, e.endsMs + 2000); expect(x.status).toBe(200); }
    const fin = await view("LE-1", e.endsMs + 3000); expect(fin.state).toBe("done"); expect(fin.agreed).toBe(true);
    const rank = await j(await call("GET", "/api/z/LE-1/luck/rank", undefined, {}, e.endsMs + 3000)); expect(rank.agreed).toBe(true); expect(rank.rounds.length).toBe(1); expect(rank.overall.length).toBe(4);
    expect(sql("SELECT COUNT(*) c FROM winner WHERE eid='LE-1'")[0].c).toBeGreaterThan(0);
  });
  test("a result with 3 rounds is refused after the end (the game has 1), and nobody gets points for dice rounds that were never published", async () => {
    const o = await game("LE-2"); const ps = await joinAll("LE-2", 4);
    const st = await j(await call("POST", "/api/z/LE-2/luck/start", { settings: SET }, o.h));
    const e = await j(await call("POST", "/api/z/LE-2/luck/end", {}, o.h, st.startMs + 2000));
    const wrong = { overall: [{ seat: 0, points: 1, hits: 1, best: 1, line: "" }], rounds: [[{ seat: 0, points: 1, hits: 1, best: 1, line: "" }], [{ seat: 0, points: 0, hits: 0, best: 0, line: "" }], [{ seat: 0, points: 0, hits: 0, best: 0, line: "" }]] };
    const x = await call("POST", "/api/z/LE-2/luck/vote", { pid: ps[0]!.pid, device: ps[0]!.device, result: wrong }, {}, e.endsMs + 1000); expect(x.status).toBe(400);
    const b = await beacons("LE-2", 0, st.startMs + 100 * 60_000); expect(b.values.length).toBe(20);
  });
  test("ending in the break after round 1: the game is over at once; ending in the last round changes nothing; ending twice changes nothing", async () => {
    const o = await game("LE-3"); await joinAll("LE-3", 4);
    const st = await j(await call("POST", "/api/z/LE-3/luck/start", { settings: SET }, o.h));
    const s1 = { ...SET, rounds: 1, diceRounds: 10, revealSecs: 3, breakSecs: 20 } as LuckSettings;
    const breakAt = gameEndMs(s1, st.startMs) + 5000; // 5 s into the 20 s break after round 1
    const r = await j(await call("POST", "/api/z/LE-3/luck/end", {}, o.h, breakAt)); expect(r).toMatchObject({ ok: true, endedAfterRound: 1 });
    expect(r.endsMs).toBeLessThan(breakAt); // the last dice round of round 1 is already past: over now
    expect(await j(await call("POST", "/api/z/LE-3/luck/end", {}, o.h, breakAt + 1000))).toMatchObject({ ok: true, again: true, endedAfterRound: 1 });
    const o2 = await game("LE-4"); await joinAll("LE-4", 4);
    const st2 = await j(await call("POST", "/api/z/LE-4/luck/start", { settings: { rounds: 1, windowSecs: 6, prizeMode: "overall", prizes: { overall: ["Hamper"], rounds: [] } } }, o2.h)); expect(st2.ok).toBe(true);
    const last = await j(await call("POST", "/api/z/LE-4/luck/end", {}, o2.h, st2.startMs + 3000)); expect(last).toMatchObject({ ok: true, last: true, endedAfterRound: 1 });
    expect((await view("LE-4", st2.startMs + 4000)).endedAfterRound).toBeNull();
  });
  test("it cannot be ended before it starts, before the first dice round, or after it is over", async () => {
    const o = await game("LE-5"); await joinAll("LE-5", 4);
    const early = await call("POST", "/api/z/LE-5/luck/end", {}, o.h); expect(early.status).toBe(409); expect((await j(early)).code).toBe("not-started");
    const st = await j(await call("POST", "/api/z/LE-5/luck/start", { settings: SET }, o.h));
    const notYet = await call("POST", "/api/z/LE-5/luck/end", {}, o.h, st.startMs - 5000); expect(notYet.status).toBe(409); expect((await j(notYet)).code).toBe("not-yet");
    const over = await call("POST", "/api/z/LE-5/luck/end", {}, o.h, st.endMs + 1000); expect(over.status).toBe(409); expect((await j(over)).code).toBe("over");
    expect((await view("LE-5", st.startMs + 100)).settings.rounds).toBe(3);
  });
  test("only the Organizer or a Host can end it: a stranger, a player, the AI key and a wrong key are refused and the game goes on", async () => {
    const o = await game("LE-6"); const ps = await joinAll("LE-6", 4);
    const st = await j(await call("POST", "/api/z/LE-6/luck/start", { settings: SET }, o.h)); const at = st.startMs + 4000;
    for (const hdr of [{}, { "x-organizer": o.ai }, { "x-organizer": "wrong" }] as Record<string, string>[]) { const r = await call("POST", "/api/z/LE-6/luck/end", {}, hdr, at); expect([hdr, r.status]).toEqual([hdr, 403]); }
    expect((await call("POST", "/api/z/LE-6/luck/end", { pid: ps[0]!.pid, device: ps[0]!.device }, {}, at)).status).toBe(403);
    expect((await view("LE-6", at)).settings.rounds).toBe(3); expect((await view("LE-6", at)).endedAfterRound).toBeNull();
  });
  test("the AI can only ASK: the request is stored for the organizer, who presses End on the game page; pause, resume and stop are not offered", async () => {
    const o = await game("LE-7");
    const ask = await j(await call("POST", "/api/z/LE-7/control/request", { action: "end", note: "the CEO left" }, { "x-organizer": o.ai })); expect(ask.ok).toBe(true); expect(ask.message).toMatch(/must approve/);
    for (const a of ["pause", "resume", "stop"]) { const r = await call("POST", "/api/z/LE-7/control/request", { action: a }, { "x-organizer": o.ai }); expect([a, r.status]).toEqual([a, 400]); }
    const q = await j(await call("GET", "/api/z/LE-7/control/request", undefined, o.h)); expect(q.requests.map((x: any) => x.action)).toEqual(["end"]);
  });
});

describe("R52: what no player sees cannot be saved", () => {
  test("opening and closing messages, messages between rounds and lucky draws are refused with a plain sentence, when a game is made and when it is changed; brand and an empty list are fine", async () => {
    const r = await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "10.9.9.9" })); const h = { "x-organizer": r.token as string };
    const base = { id: "NM-1", startRound: START, callSeconds: 6, cap: 100 };
    for (const extra of [{ opening: [{ kind: "text", title: "Welcome" }] }, { closing: [{ kind: "text", title: "Bye" }] }, { breaks: [{ kind: "lucky", title: "Hamper", winners: 3 }] }, { breaks: [{ kind: "text", title: "A word from our sponsor" }] }]) {
      const x = await call("POST", "/api/z", { ...base, ...extra }, h); expect([Object.keys(extra)[0], x.status]).toEqual([Object.keys(extra)[0], 400]);
      const b = await j(x); expect(b.code).toBe("no-moments"); expect(b.error).toMatch(/no opening or closing messages/); expect(b.error).not.toMatch(/legal pending|owner told|review pending/i);
    }
    expect(sql("SELECT COUNT(*) c FROM engagement WHERE id='NM-1'")[0].c).toBe(0);
    const ok = await call("POST", "/api/z", { ...base, opening: [], closing: [], breaks: [], brand: { name: "Acme", color: "#0B3D91" } }, h); expect(ok.status).toBe(200);
    const upd = (extra: Record<string, unknown>) => call("PATCH", "/api/z/NM-1/settings", { cap: 100, ...extra }, h);
    for (const extra of [{ opening: [{ kind: "text", title: "x" }] }, { closing: [{ kind: "text", title: "x" }] }, { breaks: [{ kind: "lucky", title: "x", winners: 3 }] }]) { const x = await upd(extra); expect([Object.keys(extra)[0], x.status]).toEqual([Object.keys(extra)[0], 400]); expect((await j(x)).code).toBe("no-moments"); }
    expect((await upd({ brand: { name: "Acme Ltd", color: "#1B7F5C" }, breaks: [], opening: [], closing: [] })).status).toBe(200);
    const saved = JSON.parse(sql("SELECT config FROM engagement WHERE id='NM-1'")[0].config); expect(saved.brand.name).toBe("Acme Ltd"); // the brand is kept
    expect((saved.opening ?? []).length + (saved.breaks ?? []).length + (saved.closing ?? []).length).toBe(0); // nothing that no player sees
  });
});
