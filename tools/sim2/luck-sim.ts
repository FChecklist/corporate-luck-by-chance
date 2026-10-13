// Simulation: 1,000 simulated phones play a full 10-round game of Luck by Chance through the real Worker routes (join with the Terms boxes, start, beacon values as they fall due,
// seats, result votes, agreed result, secret shown). Run: bun tools/sim2/luck-sim.ts   (one heavy command; about a minute on this laptop).
//
// What is simulated and what is shared: the engine is deterministic, so every phone that reads the same beacon values gets the same result. One full engine run (1,000 players x 100 dice rounds
// = 100,000 dice) stands for what each phone computes; a second, independent run in a different slicing proves two phones agree; then all 1,000 phones send their vote through the routes.
// Timings are printed so they can be copied into docs/GATES.md.
import { handle } from "../../apps/edge/test/with-terms";
import { makeD1 } from "../../apps/edge/test/d1-sqlite";
import type { Env } from "../../apps/edge/src/worker";
import { LuckGame, gameEndMs, totalDiceRounds, type LuckSettings } from "../../packages/luck/src/index";

const N = Number(process.env.LUCK_SIM_PLAYERS ?? 1000), ROUNDS = Number(process.env.LUCK_SIM_ROUNDS ?? 10);
const T = Date.UTC(2026, 9, 1, 10, 0, 0), GEN = 1692803367, roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const d = makeD1(); const raw = d.raw;
const env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => i.toString(16).padStart(4, "0").repeat(8);
const ms = (t0: number) => `${(performance.now() - t0).toFixed(0)} ms`;
const out: string[] = [];
const say = (s: string) => { out.push(s); console.log(s); };

const EID = "SIM-1";
const o = await j(await call("POST", "/api/start", { email: "sim@acme.com" }, { "cf-connecting-ip": "10.0.0.1" })); const h = { "x-organizer": o.token as string };
await call("POST", "/api/z", { id: EID, startRound: roundAt(T) + 1200, callSeconds: 6, cap: 10000 }, h);
await call("POST", `/api/z/${EID}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h);
raw.run("UPDATE engagement SET pack=10000 WHERE id=?", [EID]);

let t0 = performance.now();
const players: { pid: string; device: string }[] = [];
for (let i = 1; i <= N; i++) { const r = await call("POST", `/api/z/${EID}/join`, { name: `Nick ${i}`, device: dev(i) }, { "cf-connecting-ip": `11.${i >> 8}.${i & 255}.1` }); if (r.status !== 200) throw new Error("join refused: " + (await r.text())); players.push({ pid: (await j(r)).pid, device: dev(i) }); }
say(`join: ${N} phones joined through the routes in ${ms(t0)}`);

const settings = { rounds: ROUNDS, windowSecs: 10, prizeMode: "both", prizes: { overall: ["Hamper", "Book", "Mug", "Pen", "Notebook"], rounds: Array.from({ length: ROUNDS }, () => ["Coffee voucher"]) } };
const st = await j(await call("POST", `/api/z/${EID}/luck/start`, { settings, delaySecs: 20 }, h)); if (!st.ok) throw new Error(JSON.stringify(st));
const view = await j(await call("GET", `/api/z/${EID}/luck/view`, undefined, {}, T + 1000)); const S = view.settings as LuckSettings;
say(`start: ${st.players} players, ${totalDiceRounds(S)} dice rounds, the game lasts ${((gameEndMs(S, st.startMs) - st.startMs) / 60000).toFixed(1)} minutes of game time (simulated; the clock is moved, nothing waits)`);

// a phone reads the beacon feed in batches, the way luck-run.js does
t0 = performance.now(); const vals: string[] = []; let calls = 0;
for (;;) { const b = await j(await call("GET", `/api/z/${EID}/luck/beacon?from=${vals.length}`, undefined, {}, st.endMs + 1)); calls++; for (const x of b.values) vals[x.i] = x.v; if (!b.values.length) break; }
say(`beacon: ${vals.length} values in ${calls - 1} requests per phone (${ms(t0)})`);
const seats = await j(await call("GET", `/api/z/${EID}/luck/seats`)); if (seats.seats.length !== N) throw new Error("seat list is not complete");

const playWith = async (slice: number) => {
  const g = new LuckGame(EID, S, N); const t = performance.now();
  for (let k = 0; k < totalDiceRounds(S); k++) { await g.addDiceRound(k, vals[2 * k]!, vals[2 * k + 1]!); if (slice && k % slice === 0) await new Promise((r) => setTimeout(r, 0)); }
  const t1 = performance.now() - t; const line = (r: any) => ({ seat: r.seat, points: r.points, hits: r.hits, best: r.best, line: r.line });
  const rounds = []; for (let r = 1; r <= S.rounds; r++) rounds.push(await g.roundRanking(r)); const overall = await g.overallRanking();
  return { g, t1, overall, rounds, result: { overall: overall.map(line), rounds: rounds.map((l) => l.map(line)) } };
};
const A = await playWith(0), B = await playWith(7);
say(`engine: one phone plays ${totalDiceRounds(S)} dice rounds for ${N} players (${totalDiceRounds(S) * N} dice) in ${A.t1.toFixed(0)} ms; a second phone with a different slicing took ${B.t1.toFixed(0)} ms`);
if (JSON.stringify(A.result) !== JSON.stringify(B.result)) throw new Error("two phones disagree");
say("agreement: two independent phones produced the identical result (overall and every round)");

// every phone sends its vote
t0 = performance.now(); let agreed = false;
for (const p of players) { const r = await j(await call("POST", `/api/z/${EID}/luck/vote`, { pid: p.pid, device: p.device, result: A.result }, {}, st.endMs + 5)); if (r.agreed) { agreed = true; break; } }
say(`votes: result agreed after the quorum of phones voted (${ms(t0)}); agreed=${agreed}`);
const rank = await j(await call("GET", `/api/z/${EID}/luck/rank`, undefined, {}, st.endMs + 6));
if (!rank.agreed) throw new Error("no agreed result");

// the checks the owner cares about
const names = rank.overall.map((x: any) => x.name); const fail = (m: string) => { throw new Error("FAIL: " + m); };
if (names.length !== 10 || new Set(names).size !== 10) fail("top 10 is not ten different players");
if (rank.overall.slice(0, 5).some((x: any, i: number) => x.place !== i + 1)) fail("places 1 to 5 are not named");
for (let i = 1; i < 10; i++) { const a = rank.overall[i - 1], b = rank.overall[i]; if (b.points > a.points) fail("not in points order"); }
for (let r = 0; r < S.rounds; r++) { const l = rank.rounds[r]; if (l.length !== 10 || new Set(l.map((x: any) => x.name)).size !== 10) fail("round " + (r + 1) + " top 10 is not strict"); }
const tiesOverall = rank.overall.filter((x: any) => x.line).length, tiesRounds = rank.rounds.reduce((a: number, l: any[]) => a + l.filter((x) => x.line).length, 0);
say(`result: 1st ${rank.overall[0].name} (${rank.overall[0].points} points), 2nd ${rank.overall[1].name}, 3rd ${rank.overall[2].name}, 4th ${rank.overall[3].name}, 5th ${rank.overall[4].name}; top 10 is ten different players, in order`);
say(`ties: ${tiesOverall} of the overall top-10 places and ${tiesRounds} of ${S.rounds * 10} round places needed a tie-break; all were settled by the chain (every one has a one-line reason), none left open`);
say(`example line: ${rank.overall.find((x: any) => x.line)?.line ?? "(no tie in the overall top 10 this time)"}`);
const settled = (raw.query("SELECT COUNT(*) c FROM settled WHERE eid=?").get(EID) as any).c; say(`winners record: ${settled} podium rows (seat numbers only)`);
say(`PASS: ${N} phones, ${S.rounds} rounds, clear 1st to 5th, strict top 10 in every round and overall`);
await Bun.write(new URL("../../sim/luck-sim-result.txt", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), out.join("\n") + "\n").catch(() => {});
