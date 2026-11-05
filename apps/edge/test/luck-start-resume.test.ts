// R3 (5 Nov 2026 audit): starting a game of more than 89 players writes in several steps. A passing database hiccup between the steps must never leave a running game with missing players:
// the players are written first, the game is switched to "running" last, so a failed press leaves the game open and the next press does it all again.
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
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env; n = 0; });

const OVERLOAD = "D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window";
/** Plays the overload once, on the batch that follows the first full 90-statement step (the second step of a big start). Returns whether it fired. */
function failBatch() { const real = env.DB as any; let big = false, fired = false; env = { ...env, DB: new Proxy(real, { get(t, p) { if (p === "batch") return async (xs: any[]) => { if (big && !fired) { fired = true; throw new Error(OVERLOAD); } if (xs.length === 90) big = true; return t.batch(xs); }; const v = t[p]; return typeof v === "function" ? v.bind(t) : v; } }) } as Env; return () => fired; }

describe("R3: starting a big game (more than 89 players) is resumable", () => {
  test("a hiccup after the first step: the game stays open, nobody is half-seated as running, the next press finishes it with every player", async () => {
    const o = await game("LS-1"); await joinAll("LS-1", 95);
    const before = env;
    const count = failBatch();
    const r1 = await call("POST", "/api/z/LS-1/luck/start", { settings: SET }, o.h);
    expect(count()).toBe(true);
    expect(r1.status).toBe(503); expect((await j(r1)).code).toBe("busy");
    expect(sql("SELECT state FROM luck_t WHERE eid='LS-1'")[0].state).toBe("open"); // still waiting: not "running" with a part of the players
    env = before;
    const r2 = await j(await call("POST", "/api/z/LS-1/luck/start", { settings: SET }, o.h)); expect(r2.ok).toBe(true); expect(r2.players).toBe(95);
    expect(sql("SELECT state, players FROM luck_t WHERE eid='LS-1'")[0]).toEqual({ state: "running", players: 95 });
    expect(sql("SELECT COUNT(*) c FROM luck_p WHERE eid='LS-1'")[0].c).toBe(95);
    expect(sql("SELECT COUNT(DISTINCT seat) c FROM luck_p WHERE eid='LS-1'")[0].c).toBe(95);
  });
  test("an ordinary big start (no hiccup) seats everyone once", async () => {
    const o = await game("LS-2"); await joinAll("LS-2", 95);
    const r = await j(await call("POST", "/api/z/LS-2/luck/start", { settings: SET }, o.h)); expect(r.ok).toBe(true);
    expect(sql("SELECT COUNT(*) c FROM luck_p WHERE eid='LS-2'")[0].c).toBe(95);
  });
});
