// When things happen. Dice round g (counted from 0 across the whole game) opens at a fixed time after the start; a pause between rounds comes after every full round.
// Beacon value 2g is the target's value (A_g): it is published when dice round g opens, i.e. after the previous dice round ended. Beacon value 2g+1 (B_g) is published when
// the press window of dice round g closes, so nobody can know a dice value while the window is open.
import type { LuckSettings } from "./settings";

export const totalDiceRounds = (s: LuckSettings): number => s.rounds * s.diceRounds;
export const roundOf = (s: LuckSettings, g: number): number => Math.floor(g / s.diceRounds) + 1; // 1-based round of dice round g
export const diceNoOf = (s: LuckSettings, g: number): number => (g % s.diceRounds) + 1; // 1-based number inside its round
export const isLastOfRound = (s: LuckSettings, g: number): boolean => g % s.diceRounds === s.diceRounds - 1;

export const diceOpenMs = (s: LuckSettings, startMs: number, g: number): number => startMs + g * (s.windowSecs + s.revealSecs) * 1000 + Math.floor(g / s.diceRounds) * s.breakSecs * 1000;
export const windowCloseMs = (s: LuckSettings, startMs: number, g: number): number => diceOpenMs(s, startMs, g) + s.windowSecs * 1000;
export const revealEndMs = (s: LuckSettings, startMs: number, g: number): number => windowCloseMs(s, startMs, g) + s.revealSecs * 1000;
export const gameEndMs = (s: LuckSettings, startMs: number): number => revealEndMs(s, startMs, totalDiceRounds(s) - 1);

/** The time from which beacon value i exists: even values open a dice round (the target), odd values close its press window (the dice). */
export const beaconDueMs = (s: LuckSettings, startMs: number, i: number): number => (i % 2 === 0 ? diceOpenMs(s, startMs, i / 2) : windowCloseMs(s, startMs, (i - 1) / 2));

/** Where the game is at time `now`: before the start, in the press window of dice round g, in its reveal, in the break after a round, or over. */
export type Phase =
  | { kind: "before" }
  | { kind: "window"; g: number; closesMs: number }
  | { kind: "reveal"; g: number; endsMs: number }
  | { kind: "break"; afterRound: number; endsMs: number }
  | { kind: "over" };

export function phaseAt(s: LuckSettings, startMs: number, now: number): Phase {
  if (now < startMs) return { kind: "before" };
  if (now >= gameEndMs(s, startMs)) return { kind: "over" };
  const slot = (s.windowSecs + s.revealSecs) * 1000;
  const roundMs = s.diceRounds * slot + s.breakSecs * 1000;
  const r = Math.min(s.rounds - 1, Math.floor((now - startMs) / roundMs));
  const inRound = now - startMs - r * roundMs;
  if (inRound >= s.diceRounds * slot) return { kind: "break", afterRound: r + 1, endsMs: startMs + (r + 1) * roundMs };
  const d = Math.floor(inRound / slot), g = r * s.diceRounds + d;
  return inRound - d * slot < s.windowSecs * 1000 ? { kind: "window", g, closesMs: windowCloseMs(s, startMs, g) } : { kind: "reveal", g, endsMs: revealEndMs(s, startMs, g) };
}
