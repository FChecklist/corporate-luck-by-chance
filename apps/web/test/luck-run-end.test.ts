// R51 on the phone: when the organizer ends the game, the public view carries fewer rounds. The phone's runtime (luck-run.js) reads that, stops after that round, and works out the same final result
// as a game that only ever had that many rounds. Real page scripts (luck-engine.js, luck-run.js) in a DOM with a stand-in for the Worker's answers.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const S = (rounds: number) => ({ rounds, windowSecs: 6, prizeMode: "both", oneWinPerPlayer: false, prizes: { overall: ["Hamper"], rounds: [["Pen"], ["Mug"], ["Cap"]] }, diceRounds: 10, revealSecs: 3, breakSecs: 20 });
const hex = (i: number) => (i * 2654435761 >>> 0).toString(16).padStart(8, "0").repeat(8);

async function phone(rounds: () => number) {
  const w: any = new Window({ url: "https://corporate-luck-by-chance.pages.dev/z.html?e=GAME-1" });
  w.crypto = globalThis.crypto;
  const start = Date.now() - 60_000;
  w.fetch = async (url: string) => {
    const u = String(url), ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.includes("/luck/view")) return ok({ serverNow: Date.now(), state: "running", startMs: start, endMs: start + 100_000, players: 3, joined: 3, settings: S(rounds()), agreed: false });
    if (u.includes("/luck/seats")) return ok({ players: 3, seats: [[0, "Asha"], [1, "Ben"], [2, "Chen"]] });
    if (u.includes("/luck/beacon")) { const from = Number(new URL(u, "https://x").searchParams.get("from") ?? 0); return ok({ serverNow: Date.now(), from, values: Array.from({ length: 20 - from }, (_, k) => ({ i: from + k, v: hex(from + k) })), next: 20, total: 20 }); }
    return ok({}, 404);
  };
  new Function("window", "globalThis", pub("luck-engine.js"))(w, w);
  new Function("window", "fetch", pub("luck-run.js"))(w, w.fetch);
  const R = w.LuckRun.create({ base: "", eid: "GAME-1" });
  return { R, w };
}

describe("R51: the phone stops after the round the organizer ended", () => {
  test("with 3 rounds the game is not finished after round 1; once the view carries 1 round it is, and the final result has exactly 1 round", async () => {
    let rounds = 3;
    const { R } = await phone(() => rounds);
    await R.fetchView(null); expect(R.game.settings.rounds).toBe(3);
    await R.advance(); await R.advance(); await R.advance();
    expect(R.game.done).toBe(10); expect(R.game.finished).toBe(false);
    rounds = 1; await R.fetchView(null);
    expect(R.game.settings.rounds).toBe(1); expect(R.game.finished).toBe(true);
    const fr = await R.finalResult(); expect(fr.rounds.length).toBe(1); expect(fr.overall.length).toBe(3);
    expect(fr.overall.map((r: any) => r.place)).toEqual([1, 2, 3]);
  });
  test("a phone that opens the game after it was ended builds a 1-round game from the start and reaches the same standings", async () => {
    let rounds = 3;
    const a = await phone(() => rounds); await a.R.fetchView(null); for (let i = 0; i < 3; i++) await a.R.advance(); rounds = 1; await a.R.fetchView(null);
    const late = await phone(() => 1); await late.R.fetchView(null); expect(late.R.game.settings.rounds).toBe(1); for (let i = 0; i < 3; i++) await late.R.advance();
    expect(late.R.game.finished).toBe(true);
    const x = await a.R.finalResult(), y = await late.R.finalResult();
    expect(x.overall.map((r: any) => [r.seat, r.points])).toEqual(y.overall.map((r: any) => [r.seat, r.points]));
    expect(x.rounds[0].map((r: any) => r.seat)).toEqual(y.rounds[0].map((r: any) => r.seat));
  });
  test("a view that carries MORE rounds than the game has (or the same) changes nothing", async () => {
    let rounds = 2;
    const { R } = await phone(() => rounds); await R.fetchView(null); rounds = 5; await R.fetchView(null); expect(R.game.settings.rounds).toBe(2);
  });
});
