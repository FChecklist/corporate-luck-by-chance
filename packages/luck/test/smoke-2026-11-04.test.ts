// Found by the 100-million smoke test (2026-11-04, luck generator): rules G-05/G-06/G-10 (new flow: a seat that did not press moved its "reached the score" round although it scored nothing)
// and G-10/G-11 (the last listed place did not say what separated it from the first player below the list).
// FALSIFIED BY: nf-reached-moves-on-zero-points (addNf: reachedAt = g without pts > 0), last-place-no-neighbour-below (rankTop: next = out[i + 1] only)
import { expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { LuckGame, parseSettings, rankTop, emptyTally, type Tally } from "../src/index";

test("G-05 new flow: a seat that did not press in a dice round has not 'reached' anything in it", async () => {
  const s = parseSettings({ newFlow: true }); if (!s.ok) throw new Error("settings");
  const g = new LuckGame("GSMOKE01", s.value, 3);
  await g.addDiceRound(0, "aa", "bb"); // everybody pressed: every seat scored, so reachedAt is 0
  await g.addDiceRound(1, "cc", "dd", new Set([0, 1])); // seat 2 did not press in dice round 1: it scores 0 and its reachedAt stays at 0
  expect(g.total[0]!.reachedAt).toBe(1);
  expect(g.total[1]!.reachedAt).toBe(1);
  expect(g.results[1]!.points[2]).toBe(0);
  expect(g.total[2]!.reachedAt).toBe(0);
});

test("G-11 the last listed place says what separated it from the first player below the list", async () => {
  const mk = (seat: number, points: number, hits: number): Tally => ({ ...emptyTally(seat, true), points, hits, reachedAt: 5 });
  // 12 players: places 1-9 are alone, places 10 and 11 share 17 points, the player for place 10 has more exact hits
  const t: Tally[] = [100, 90, 80, 70, 60, 50, 40, 30, 20].map((p, i) => mk(i, p, 3)); t.push(mk(9, 17, 2), mk(10, 17, 1), mk(11, 1, 0));
  const r = await rankTop("GSMOKE02", "overall", "beacon", t, 10);
  expect(r.length).toBe(10);
  expect(r[9]!.seat).toBe(9);
  expect(r[9]!.decidedBy).toBe("exact");
  expect(r[9]!.line).toBe("Tied on 17 points; decided by the most exact hits.");
  expect(r[8]!.decidedBy).toBeNull();
});
