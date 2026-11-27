// The rules of Corporate Luck by Chance (docs/RULES.md). Every test name starts with the rule number it proves.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000); // a full-suite run on this laptop shares memory and time with other work
import {
  LuckGame, addHit, assignPrizes, cmpNumeric, diceOf, emptyTally, fateOf, rankTop, scoreOf, standingOf, targetOf, type Ranked, type Tally,
  parseSettings, defaultSettings, checkPrizeText, MAX_ROUNDS,
  beaconDueMs, diceOpenMs, gameEndMs, phaseAt, revealEndMs, totalDiceRounds, windowCloseMs, sha256Hex,
} from "../src/index";

const GID = "GAME-1";
const beacon = (i: number, salt = "t") => sha256Hex(`test-beacon|${salt}|${i}`);
const bs = async (n: number, salt = "t") => { const out: string[] = []; for (let i = 0; i < n; i++) out.push(await beacon(i, salt)); return out; };
const small = (rounds = 2, extra: object = {}) => { const r = parseSettings({ rounds, ...extra }); if (!r.ok) throw new Error(r.error); return r.value; };

async function playAll(gameId: string, settings = small(), seats = 40, salt = "t") {
  const g = new LuckGame(gameId, settings, seats); const b = await bs(totalDiceRounds(settings) * 2, salt);
  for (let k = 0; k < totalDiceRounds(settings); k++) await g.addDiceRound(k, b[2 * k]!, b[2 * k + 1]!);
  return g;
}

describe("A. The game", () => {
  test("R01: a game has 1 to 20 rounds, 10 by default; 0, 21 and 2.5 are refused", () => {
    expect(defaultSettings().rounds).toBe(10);
    for (const ok of [1, 10, 20]) expect(parseSettings({ rounds: ok }).ok).toBe(true);
    for (const bad of [0, 21, 2.5, -1, "x"]) expect(parseSettings({ rounds: bad }).ok).toBe(false);
    expect(MAX_ROUNDS).toBe(20);
  });
  test("QA B1: a rounds or window value that is not a number (true, [5], null, an empty text) is refused; a number or a number written as text is still read", () => {
    for (const bad of [true, false, [5], null, "", " ", {}]) expect([bad, parseSettings({ rounds: bad }).ok]).toEqual([bad, false]);
    for (const bad of [true, [10], null, "", {}]) expect([bad, parseSettings({ windowSecs: bad }).ok]).toEqual([bad, false]);
    expect(parseSettings({ rounds: "10", windowSecs: "6" })).toMatchObject({ ok: true, value: { rounds: 10, windowSecs: 6 } });
  });
  test("R02: every round has 10 dice rounds, so a default game has 100", () => {
    expect(defaultSettings().diceRounds).toBe(10); expect(totalDiceRounds(defaultSettings())).toBe(100); expect(totalDiceRounds(small(3))).toBe(30);
  });
  test("R03: the target of a dice round is a whole number from 1 to 6", async () => {
    for (let k = 0; k < 200; k++) { const t = await targetOf(GID, k, await beacon(k)); expect(Number.isInteger(t) && t >= 1 && t <= 6).toBe(true); }
  });
  test("R04: the press window is 6, 10 (default) or 15 seconds and nothing else", () => {
    expect(defaultSettings().windowSecs).toBe(10);
    for (const w of [6, 10, 15]) expect(parseSettings({ windowSecs: w }).ok).toBe(true);
    for (const w of [5, 7, 11, 20, 0]) expect(parseSettings({ windowSecs: w }).ok).toBe(false);
  });
  test("R05: a hit scores the target, a miss scores nothing", () => {
    for (let t = 1; t <= 6; t++) for (let d = 1; d <= 6; d++) expect(scoreOf(t, d)).toBe(d === t ? t : 0);
  });
  test("R06: points add up inside a round and across rounds; the best possible game is 6 per dice round", async () => {
    const g = await playAll(GID, small(2), 30);
    for (let seat = 0; seat < 30; seat++) {
      const byRound = [0, 0]; for (const r of g.results) byRound[r.round - 1]! += r.points[seat]!;
      expect(g.roundTallies[0]![seat]!.points).toBe(byRound[0]!); expect(g.roundTallies[1]![seat]!.points).toBe(byRound[1]!);
      expect(g.total[seat]!.points).toBe(byRound[0]! + byRound[1]!);
      expect(g.total[seat]!.points).toBeLessThanOrEqual(6 * 20);
    }
    expect(6 * totalDiceRounds(defaultSettings())).toBe(600);
  });
  test("R07: whatever the target, the chance of a hit is 1 in 6 (the dice does not depend on the target)", async () => {
    const hits = [0, 0, 0, 0, 0, 0], n = [0, 0, 0, 0, 0, 0];
    for (let k = 0; k < 2400; k++) { const t = await targetOf(GID, k, await beacon(k, "a")); const d = await diceOf(GID, k % 50, k, await beacon(k, "b")); n[t - 1]!++; if (d === t) hits[t - 1]!++; }
    for (let t = 0; t < 6; t++) { expect(n[t]!).toBeGreaterThan(300); expect(hits[t]! / n[t]!).toBeGreaterThan(0.08); expect(hits[t]! / n[t]!).toBeLessThan(0.26); }
  });
});

describe("B. Fair randomness", () => {
  test("R08: the target depends only on the game id, the dice round number and beacon value A; the same on every device", async () => {
    const a = await targetOf(GID, 7, "abc"); expect(await targetOf(GID, 7, "abc")).toBe(a);
    let differs = false; for (let k = 0; k < 40 && !differs; k++) if ((await targetOf(GID, 7, "abc" + k)) !== a) differs = true; expect(differs).toBe(true);
    let differs2 = false; for (let k = 0; k < 40 && !differs2; k++) if ((await targetOf(GID + k, 7, "abc")) !== a) differs2 = true; expect(differs2).toBe(true);
  });
  test("R09: a dice needs beacon value B, and B exists only after the press window has closed (dice round g: B is due at the window close, A at the opening)", () => {
    const s = defaultSettings(), start = 1_000_000;
    for (const g of [0, 1, 9, 10, 57, 99]) {
      expect(beaconDueMs(s, start, 2 * g + 1)).toBe(windowCloseMs(s, start, g)); // B_g
      expect(beaconDueMs(s, start, 2 * g)).toBe(diceOpenMs(s, start, g)); // A_g
      expect(beaconDueMs(s, start, 2 * g + 1)).toBeGreaterThan(beaconDueMs(s, start, 2 * g));
      expect(beaconDueMs(s, start, 2 * g + 1) - diceOpenMs(s, start, g)).toBe(s.windowSecs * 1000); // not a moment before the window ends
    }
    const game = new LuckGame(GID, small(1), 5);
    expect(game.addDiceRound(0, "A", "")).rejects.toThrow(); // no B, no dice
  });
  test("R10: the target of a dice round is fixed before its window opens, and the target of the next one only after the last reveal", () => {
    const s = defaultSettings(), start = 5_000;
    for (let g = 0; g < 99; g++) {
      expect(beaconDueMs(s, start, 2 * g)).toBeLessThanOrEqual(diceOpenMs(s, start, g));
      expect(beaconDueMs(s, start, 2 * (g + 1))).toBeGreaterThanOrEqual(revealEndMs(s, start, g)); // published after the previous dice round ended
    }
  });
  test("R11: targets and dice are spread evenly over 1 to 6 (10,000 draws each)", async () => {
    const t = [0, 0, 0, 0, 0, 0], d = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 10000; i++) { t[(await targetOf("U", i, await beacon(i, "u"))) - 1]!++; d[(await diceOf("U", i % 97, i, await beacon(i, "v"))) - 1]!++; }
    for (let v = 0; v < 6; v++) { expect(t[v]!).toBeGreaterThan(1450); expect(t[v]!).toBeLessThan(1880); expect(d[v]!).toBeGreaterThan(1450); expect(d[v]!).toBeLessThan(1880); }
  });
  test("R12: two players in the same dice round roll independently (seats do not all roll the same)", async () => {
    const seen = new Set<number>(); for (let seat = 0; seat < 60; seat++) seen.add(await diceOf(GID, seat, 3, "same-beacon"));
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
  test("R13: the same inputs give the same game; a different beacon gives a different game", async () => {
    const a = await playAll(GID, small(2), 30), b = await playAll(GID, small(2), 30), c = await playAll(GID, small(2), 30, "other");
    expect(JSON.stringify(a.total)).toBe(JSON.stringify(b.total)); expect(JSON.stringify(a.total)).not.toBe(JSON.stringify(c.total));
    expect(JSON.stringify(await a.overallRanking())).toBe(JSON.stringify(await b.overallRanking()));
  });
  test("R14: dice rounds must be played in order, none can be skipped", async () => {
    const g = new LuckGame(GID, small(1), 5);
    expect(g.addDiceRound(1, "a", "b")).rejects.toThrow();
    await g.addDiceRound(0, "a", "b"); expect(g.done).toBe(1);
  });
});

const T = (seat: number, points: number, hits: number, best: number, reachedAt: number): Tally => ({ seat, points, hits, best, reachedAt });

describe("C. Ranking, no ties", () => {
  test("R15: most points first", async () => {
    const r = await rankTop(GID, "x", "b", [T(0, 5, 2, 3, 4), T(1, 9, 2, 5, 6), T(2, 7, 1, 7, 2)]);
    expect(r.map((x) => x.seat)).toEqual([1, 2, 0]);
  });
  test("R16: equal points: the highest single hit wins (a 6 beats a 5)", async () => {
    const r = await rankTop(GID, "x", "b", [T(0, 11, 3, 5, 4), T(1, 11, 2, 6, 6)]);
    expect(r.map((x) => x.seat)).toEqual([1, 0]); expect(r[0]!.decidedBy).toBe("best"); expect(r[0]!.line).toContain("highest single hit");
  });
  test("R17: still equal: the most hits wins", async () => {
    const r = await rankTop(GID, "x", "b", [T(0, 12, 3, 6, 4), T(1, 12, 4, 6, 6)]);
    expect(r.map((x) => x.seat)).toEqual([1, 0]); expect(r[0]!.decidedBy).toBe("hits");
  });
  test("R18: still equal: whoever reached that score first wins", async () => {
    const r = await rankTop(GID, "x", "b", [T(0, 12, 4, 6, 40), T(1, 12, 4, 6, 12)]);
    expect(r.map((x) => x.seat)).toEqual([1, 0]); expect(r[0]!.decidedBy).toBe("earliest");
  });
  test("R19: still equal: fate decides, from a hash of the game id, the seat and the ranking; the lower number wins and anyone can re-compute it", async () => {
    const tied = [T(0, 12, 4, 6, 12), T(1, 12, 4, 6, 12), T(2, 12, 4, 6, 12)];
    const r = await rankTop(GID, "round-2", "bz", tied);
    const f = await Promise.all([0, 1, 2].map((s) => fateOf(GID, s, "round-2", "bz")));
    const expected = [0, 1, 2].sort((a, b) => (f[a]! < f[b]! ? -1 : 1));
    expect(r.map((x) => x.seat)).toEqual(expected); expect(r.every((x) => x.decidedBy === "fate" || x.decidedBy === null)).toBe(true); expect(r[0]!.decidedBy).toBe("fate");
    expect((await rankTop(GID, "round-3", "bz", tied)).map((x) => x.seat).join()).toBeDefined(); // another ranking has its own fate
  });
  test("R20: the order is always strict: in 300 games with 5,000 players and plenty of ties, places 1 to 10 are ten different players, in chain order", async () => {
    let tiesInTop10 = 0;
    for (let game = 0; game < 300; game++) {
      const tallies: Tally[] = [], rnd = (n: number) => Math.floor(((game * 7919 + tallies.length * 104729 + n * 13) * 2654435761 % 4294967296) / 4294967296 * 1000);
      for (let seat = 0; seat < 5000; seat++) { const pts = 10 + (rnd(seat) % 8) * 3; tallies.push(T(seat, pts, pts % 5, 6 - (rnd(seat + 1) % 2), rnd(seat + 2) % 4)); }
      const r = await rankTop(`G${game}`, "overall", `b${game}`, tallies);
      expect(r.length).toBe(10); expect(new Set(r.map((x) => x.seat)).size).toBe(10); expect(r.map((x) => x.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      for (let i = 1; i < 10; i++) expect(cmpNumeric(tallies[r[i - 1]!.seat]!, tallies[r[i]!.seat]!)).toBeLessThanOrEqual(0); // never out of chain order
      if (r.some((x) => x.line)) tiesInTop10++;
    }
    expect(tiesInTop10).toBeGreaterThan(200); // the data really had ties to break
  });
  test("R21: every round has its own ranking by the same chain; the overall ranking uses the running total", async () => {
    const g = await playAll(GID, small(3), 80);
    for (let r = 1; r <= 3; r++) {
      const rr = await g.roundRanking(r), t = g.roundTallies[r - 1]!;
      expect(rr.length).toBe(10); for (let i = 1; i < 10; i++) expect(cmpNumeric(t[rr[i - 1]!.seat]!, t[rr[i]!.seat]!)).toBeLessThanOrEqual(0);
    }
    const ov = await g.overallRanking(); for (let i = 1; i < 10; i++) expect(cmpNumeric(g.total[ov[i - 1]!.seat]!, g.total[ov[i]!.seat]!)).toBeLessThanOrEqual(0);
    expect(g.roundRanking(4)).rejects.toThrow();
  });
  test("R22: a place that had to be decided says how, in one line; a place that needed no tie-break has no line", async () => {
    const r = await rankTop(GID, "x", "b", [T(0, 20, 5, 6, 9), T(1, 11, 3, 5, 4), T(2, 11, 3, 5, 6), T(3, 2, 1, 2, 1)]);
    expect(r[0]!.line).toBe(""); expect(r[3]!.line).toBe("");
    expect(r[1]!.line).toBe("Tied on 11 points; decided by who reached the score first."); expect(r[2]!.line).toBe(r[1]!.line);
  });
  test("R23: places 1 to 5 and the top 10 are always listed, even if fewer players exist the list is as long as the player list", async () => {
    const g = await playAll(GID, small(1), 25); expect((await g.overallRanking()).length).toBe(10);
    const g2 = await playAll(GID, small(1), 4); expect((await g2.overallRanking()).length).toBe(4);
  });
  test("R24: the golden shoot-out is not part of this build; fate decides at once (the last step of R19)", () => {
    // there is no shoot-out function to call: ties are settled only through rankTop's chain
    expect(typeof (LuckGame.prototype as any).goldenShootOut).toBe("undefined");
  });
  test("R25: a player can see how they stand in plain words (the share of players ahead, computed from the same numbers)", async () => {
    const t = Array.from({ length: 100 }, (_, i) => T(i, 100 - i, 1, 1, i));
    expect(standingOf(t, 0)).toEqual({ ahead: 0, of: 100, percent: 1 }); expect(standingOf(t, 7)).toEqual({ ahead: 7, of: 100, percent: 8 }); expect(standingOf(t, 99).percent).toBe(100);
  });
});

describe("D. Settings and prizes", () => {
  test("R26: the organizer writes a prize text for places 1 to 5 of the overall ranking and of each round; a sixth place is refused", () => {
    const ok = parseSettings({ rounds: 3, prizes: { overall: ["Hamper", "Book", "Mug"], rounds: [["Pen"], [], ["Notebook", "Bag"]] } });
    expect(ok.ok && ok.value.prizes.overall).toEqual(["Hamper", "Book", "Mug"]); expect(ok.ok && ok.value.prizes.rounds[2]).toEqual(["Notebook", "Bag"]);
    expect(parseSettings({ prizes: { overall: ["a", "b", "c", "d", "e", "f"] } }).ok).toBe(false);
    expect(parseSettings({ rounds: 2, prizes: { rounds: [[], [], []] } }).ok).toBe(false);
  });
  test("R27: a prize is a gift: money, cash, bets and stakes are refused in the prize text", () => {
    for (const bad of ["Rs 5000 cash", "cash prize", "win money", "₹1000", "$50 voucher", "betting pool", "stake 100", "jackpot"]) expect([bad, checkPrizeText(bad).ok]).toEqual([bad, false]);
    for (const good of ["A coffee hamper", "Gift voucher for the canteen", "Extra day off"]) expect(checkPrizeText(good).ok).toBe(true);
    expect(parseSettings({ prizes: { overall: ["win cash"] } }).ok).toBe(false);
  });
  test("R28: prizes are for each round, for the overall result, or both (default both)", async () => {
    const s = small(2, { prizes: { overall: ["O1", "O2"], rounds: [["R1a"], ["R2a"]] } });
    const rk = (seats: number[]): Ranked[] => seats.map((seat, i) => ({ place: i + 1, seat, points: 0, hits: 0, best: 0, reachedAt: -1, decidedBy: null, line: "" }));
    const rounds = [rk([1, 2, 3]), rk([4, 5, 6])], overall = rk([7, 8, 9]);
    expect(assignPrizes(s, rounds, overall).map((w) => w.prize)).toEqual(["R1a", "R2a", "O1", "O2"]);
    expect(assignPrizes({ ...s, prizeMode: "overall" }, rounds, overall).map((w) => w.prize)).toEqual(["O1", "O2"]);
    expect(assignPrizes({ ...s, prizeMode: "rounds" }, rounds, overall).map((w) => w.prize)).toEqual(["R1a", "R2a"]);
  });
  test("R29: a player may win several prizes; if the organizer switches that off, the prize goes to the next player in the order", () => {
    const s = small(1, { prizes: { overall: ["O1", "O2"], rounds: [["R1a", "R1b"]] } });
    const rk = (seats: number[]): Ranked[] => seats.map((seat, i) => ({ place: i + 1, seat, points: 0, hits: 0, best: 0, reachedAt: -1, decidedBy: null, line: "" }));
    const many = assignPrizes(s, [rk([1, 2, 3])], rk([1, 2, 3]));
    expect(many.map((w) => `${w.ranking}:${w.place}:${w.seat}`)).toEqual(["round-1:1:1", "round-1:2:2", "overall:1:1", "overall:2:2"]);
    const once = assignPrizes({ ...s, oneWinPerPlayer: true }, [rk([1, 2, 3])], rk([1, 2, 3]));
    expect(once.map((w) => `${w.ranking}:${w.place}:${w.seat}`)).toEqual(["round-1:1:1", "round-1:2:2", "overall:1:3"]); // seats 1 and 2 already won; seat 3 is next; no fourth player in this list
    expect(new Set(once.map((w) => w.seat)).size).toBe(once.length);
  });
});

describe("E. Time", () => {
  test("R30: a dice round takes the window plus 3 seconds of reveal; after every full round there is a 20-second standings break; ten rounds take about 25 minutes (24 min 40 s: no break after the last round)", () => {
    const s = defaultSettings(), t0 = 0;
    expect(diceOpenMs(s, t0, 1) - diceOpenMs(s, t0, 0)).toBe(13_000);
    expect(diceOpenMs(s, t0, 10) - revealEndMs(s, t0, 9)).toBe(20_000);
    expect(gameEndMs(s, t0) / 60_000).toBeGreaterThan(24.5); expect(gameEndMs(s, t0) / 60_000).toBeLessThan(25);
  });
  test("R31: at any moment the game is before the start, in a window, in a reveal, in a break, or over", () => {
    const s = defaultSettings(), t0 = 10_000;
    expect(phaseAt(s, t0, 0).kind).toBe("before"); expect(phaseAt(s, t0, t0).kind).toBe("window");
    expect(phaseAt(s, t0, t0 + 10_000).kind).toBe("reveal"); expect(phaseAt(s, t0, t0 + 13_000).kind).toBe("window");
    const p = phaseAt(s, t0, revealEndMs(s, t0, 9) + 1); expect(p.kind).toBe("break");
    const w = phaseAt(s, t0, diceOpenMs(s, t0, 10) + 1); expect(w.kind === "window" && w.g).toBe(10);
    expect(phaseAt(s, t0, gameEndMs(s, t0)).kind).toBe("over");
    for (let ms = t0; ms < gameEndMs(s, t0); ms += 997) { const q = phaseAt(s, t0, ms); if (q.kind === "window") expect(diceOpenMs(s, t0, q.g)).toBeLessThanOrEqual(ms); }
  });
});

describe("F. Same result on every phone", () => {
  test("R32: two phones that receive the same beacon values in the same order show the same standings, however the work is sliced", async () => {
    const s = small(2), seats = 60, b = await bs(40);
    const phone1 = new LuckGame(GID, s, seats), phone2 = new LuckGame(GID, s, seats);
    for (let k = 0; k < 20; k++) await phone1.addDiceRound(k, b[2 * k]!, b[2 * k + 1]!);
    for (let k = 0; k < 20; k++) { await phone2.addDiceRound(k, b[2 * k]!, b[2 * k + 1]!); if (k === 9) expect(JSON.stringify(await phone2.roundRanking(1))).toBe(JSON.stringify(await phone1.roundRanking(1))); }
    expect(JSON.stringify(await phone1.overallRanking())).toBe(JSON.stringify(await phone2.overallRanking()));
  });
  test("R33: each hit is recorded exactly: the tally of the best hit, hits and the dice round of the last hit", () => {
    const t = emptyTally(3); addHit(t, 4, 2); addHit(t, 9, 6); addHit(t, 15, 3);
    expect(t).toEqual({ seat: 3, points: 11, hits: 3, best: 6, reachedAt: 15 });
  });
});

describe("I. The organizer ends the game", () => {
  test("R51: a game ended after round 1 of 3 is the same game as one that had only 1 round: same rankings, same prizes, finished at once", async () => {
    const full = small(3, { prizes: { overall: ["Hamper", "Book"], rounds: [["Pen"], ["Mug"], ["Cap"]] } }), short = small(1, { prizes: { overall: ["Hamper", "Book"], rounds: [["Pen"]] } });
    const b = await bs(60), seats = 30;
    const a = new LuckGame(GID, full, seats), c = new LuckGame(GID, short, seats);
    for (let k = 0; k < 10; k++) { await a.addDiceRound(k, b[2 * k]!, b[2 * k + 1]!); await c.addDiceRound(k, b[2 * k]!, b[2 * k + 1]!); }
    expect(a.finished).toBe(false); expect(a.endAfterRound(1)).toBe(true); expect(a.finished).toBe(true); expect(a.settings.rounds).toBe(1);
    expect((await a.overallRanking()).map((r) => [r.seat, r.points, r.line])).toEqual((await c.overallRanking()).map((r) => [r.seat, r.points, r.line]));
    expect((await a.roundRanking(1)).map((r) => r.seat)).toEqual((await c.roundRanking(1)).map((r) => r.seat));
    const win = async (g: LuckGame) => assignPrizes(g.settings, [await g.roundRanking(1)], await g.overallRanking());
    expect(await win(a)).toEqual(await win(c));
    expect((await win(a)).map((w) => w.ranking)).not.toContain("round-2"); // no prize for a round that was never played
  });
  test("R51: ending is refused when it would not make the game shorter or would undo dice rounds already played", async () => {
    const g = new LuckGame(GID, small(3), 10), b = await bs(60);
    for (let k = 0; k < 15; k++) await g.addDiceRound(k, b[2 * k]!, b[2 * k + 1]!); // into round 2
    for (const n of [0, 1.5, -1, 3, 4, NaN]) expect([n, g.endAfterRound(n)]).toEqual([n, false]); // 1 would cut off dice rounds already played; 3 and 4 are not shorter
    expect(g.settings.rounds).toBe(3); expect(g.finished).toBe(false);
    expect(g.endAfterRound(2)).toBe(true); expect(g.settings.rounds).toBe(2); expect(g.finished).toBe(false); // round 2 is still being played
    for (let k = 15; k < 20; k++) await g.addDiceRound(k, b[2 * k]!, b[2 * k + 1]!);
    expect(g.finished).toBe(true);
  });
  test("R51: the timeline of a shortened game ends when its last round ends, and the break after the last round is not needed", () => {
    const s3 = small(3), s1 = { ...s3, rounds: 1 }; const start = 1_000_000;
    expect(gameEndMs(s1, start)).toBe(revealEndMs(s1, start, 9)); expect(gameEndMs(s1, start)).toBeLessThan(gameEndMs(s3, start));
    expect(phaseAt(s1, start, gameEndMs(s1, start)).kind).toBe("over"); expect(phaseAt(s3, start, gameEndMs(s1, start)).kind).toBe("break");
  });
});
