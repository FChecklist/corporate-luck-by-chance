// Found by the 100-million smoke test (rule C-08, 2026-11-04, luck seeds 544 / 5866 / 10853 / 11658): a pause that had already ended before the first call was due still pushed every call
// later by the pause's whole length. A pause delays only the time it covers after the first call is due.
// FALSIFIED BY: pause-before-start-delays-calls (callRound / callRoundR: a += i.end - i.start for every pause at or before the call)
import { expect, test } from "bun:test";
import { callRound, type ControlState } from "../src/control";
import { callRoundR } from "../src/game";

const st = (start: number, end: number): ControlState => ({ intervals: [{ start, end }], stopRound: null, ignored: [], applied: 1 });

test("a pause that ended before the first call does not delay any call", () => {
  const s = st(10168, 10180);
  for (let k = 0; k < 4; k++) { expect(callRound(s, 10201, 2, k)).toBe(10201 + 2 * k); expect(callRoundR(s, 10201, 2, [], 1, k)).toBe(10201 + 2 * k); }
});
test("a pause that began before the first call delays it only by what is left of the pause", () => {
  const s = st(10168, 10180);
  expect(callRound(s, 10170, 2, 0)).toBe(10180); expect(callRoundR(s, 10170, 2, [], 1, 0)).toBe(10180);
  expect(callRound(s, 10170, 2, 3)).toBe(10186);
});
test("a pause after the first call still pushes later calls by its whole length (unchanged)", () => {
  const s = st(10168, 10180);
  expect(callRound(s, 10100, 40, 0)).toBe(10100); expect(callRound(s, 10100, 40, 2)).toBe(10192); expect(callRoundR(s, 10100, 40, [], 1, 2)).toBe(10192);
});
