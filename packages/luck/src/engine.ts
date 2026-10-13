// The Luck by Chance engine: target, dice, scoring, the strict ranking (no ties), prizes. Plain TypeScript, no server, no clock, no randomness of its own:
// every number is a pure function of (game id, seat, dice round, public beacon values). Any phone can re-compute any result (docs/RULES.md).
import { below, sha256Hex } from "./random";
import { TOP_LIST, PLACES, type LuckSettings } from "./settings";
import { isLastOfRound, roundOf, totalDiceRounds } from "./timeline";

/** The target of dice round g: 1 to 6, made from the game id, g and beacon value A_g (published when the dice round opens, not before). */
export const targetOf = async (gameId: string, g: number, beaconA: string): Promise<number> => 1 + (await below(`LBC-TARGET|${gameId}|${g}|${beaconA}`, "t", 6));
/** The dice of one seat in dice round g: 1 to 6, made from the game id, the seat, g and beacon value B_g (published when the press window closes, not before). */
export const diceOf = async (gameId: string, seat: number, g: number, beaconB: string): Promise<number> => 1 + (await below(`LBC-DICE|${gameId}|${seat}|${g}|${beaconB}`, "d", 6));
/** A hit scores the target; a miss scores nothing. */
export const scoreOf = (target: number, dice: number): number => (dice === target ? target : 0);
/** Fate number of a seat for one ranking (a round or the overall result). The lower hex string wins. Anyone can re-compute it. */
export const fateOf = (gameId: string, seat: number, label: string, beacon: string): Promise<string> => sha256Hex(`LBC-FATE|${gameId}|${label}|${seat}|${beacon}`);

export interface Tally { seat: number; points: number; hits: number; best: number; reachedAt: number /* dice round (from 0) of the last hit, -1 if none */ }
export const emptyTally = (seat: number): Tally => ({ seat, points: 0, hits: 0, best: 0, reachedAt: -1 });
export function addHit(t: Tally, g: number, target: number): void { t.points += target; t.hits++; if (target > t.best) t.best = target; t.reachedAt = g; }

export type Measure = "points" | "best" | "hits" | "earliest" | "fate";
export interface Ranked { place: number; seat: number; points: number; hits: number; best: number; reachedAt: number; decidedBy: Measure | null; line: string }

const MEASURE_WORDS: Record<Measure, string> = { points: "points", best: "the highest single hit", hits: "the most hits", earliest: "who reached the score first", fate: "fate (a number from the public beacon)" };

/** The numeric part of the chain: most points, highest single hit, most hits, earliest to reach the score. Returns <0 when a is ahead, 0 when equal on all four. */
export function cmpNumeric(a: Tally, b: Tally): number {
  return b.points - a.points || b.best - a.best || b.hits - a.hits || a.reachedAt - b.reachedAt;
}
/** The first measure in the chain on which two tallies differ (fate if none of the four numbers differ). */
export function measureBetween(a: Tally, b: Tally): Measure {
  return a.points !== b.points ? "points" : a.best !== b.best ? "best" : a.hits !== b.hits ? "hits" : a.reachedAt !== b.reachedAt ? "earliest" : "fate";
}

/**
 * The strict order of the first `top` places (at least the top 10 are always strictly ordered, so a prize is never shared).
 * Chain: (1) most points, (2) highest single hit, (3) most hits, (4) earliest to reach the final score, (5) fate: the lower fate number wins.
 * Fate is computed only for the groups that are still equal on the first four measures and touch the top places, so a crowd of thousands costs a handful of hashes.
 */
export async function rankTop(gameId: string, label: string, beacon: string, tallies: readonly Tally[], top = TOP_LIST): Promise<Ranked[]> {
  const sorted = [...tallies].sort((a, b) => cmpNumeric(a, b) || a.seat - b.seat);
  const n = Math.min(top, sorted.length);
  // widen to the end of the equal group that touches the cut, so the cut itself is decided by fate and not by seat order
  let end = n; while (end < sorted.length && end > 0 && cmpNumeric(sorted[end - 1]!, sorted[end]!) === 0) end++;
  const head = sorted.slice(0, end); const out: Tally[] = [];
  for (let i = 0; i < head.length;) {
    let j = i + 1; while (j < head.length && cmpNumeric(head[i]!, head[j]!) === 0) j++;
    const group = head.slice(i, j);
    if (group.length > 1) {
      const f = new Map<number, string>(); for (const t of group) f.set(t.seat, await fateOf(gameId, t.seat, label, beacon));
      group.sort((a, b) => (f.get(a.seat)! < f.get(b.seat)! ? -1 : f.get(a.seat)! > f.get(b.seat)! ? 1 : a.seat - b.seat)); // equal hashes cannot happen; the seat number only makes the order total
    }
    out.push(...group); i = j;
  }
  const ranked: Ranked[] = [];
  for (let i = 0; i < n; i++) {
    const t = out[i]!, prev = out[i - 1], next = out[i + 1];
    // how was this place decided? by the first measure that separates it from the neighbour it was tied on points with
    const tiedPrev = prev && prev.points === t.points, tiedNext = next && next.points === t.points;
    let decidedBy: Measure | null = null, line = "";
    if (tiedPrev || tiedNext) {
      const m = tiedPrev ? measureBetween(prev!, t) : measureBetween(t, next!);
      decidedBy = m; line = `Tied on ${t.points} point${t.points === 1 ? "" : "s"}; decided by ${MEASURE_WORDS[m]}.`;
    }
    ranked.push({ place: i + 1, seat: t.seat, points: t.points, hits: t.hits, best: t.best, reachedAt: t.reachedAt, decidedBy, line });
  }
  return ranked;
}

/** How many players are strictly ahead of this seat on the four numbers (fate is not needed for "you are in the top x%"). */
export function standingOf(tallies: readonly Tally[], seat: number): { ahead: number; of: number; percent: number } {
  const me = tallies[seat]; if (!me) return { ahead: 0, of: tallies.length, percent: 100 };
  let ahead = 0; for (const t of tallies) if (t !== me && cmpNumeric(t, me) < 0) ahead++;
  return { ahead, of: tallies.length, percent: Math.max(1, Math.ceil(((ahead + 1) / Math.max(1, tallies.length)) * 100)) };
}

export interface DiceRoundResult { g: number; round: number; target: number; dice: Uint8Array /* index = seat */; points: Uint8Array }

/** One game, built up one dice round at a time (a phone does exactly this as the beacon values arrive; the server and the simulation do the same). */
export class LuckGame {
  readonly roundTallies: Tally[][] = []; readonly total: Tally[]; readonly results: DiceRoundResult[] = [];
  readonly lastBeacon: string[] = []; // B of the last dice round of each finished round: it makes that round's fate numbers
  private next = 0; private latestB = ""; // B of the latest dice round played: it makes the fate numbers of the overall standings
  constructor(readonly gameId: string, readonly settings: LuckSettings, readonly seats: number) {
    this.total = Array.from({ length: seats }, (_, i) => emptyTally(i));
    for (let r = 0; r < settings.rounds; r++) this.roundTallies.push(Array.from({ length: seats }, (_, i) => emptyTally(i)));
  }
  get done(): number { return this.next; }
  get finished(): boolean { return this.next >= totalDiceRounds(this.settings); }

  /** Plays dice round g. They must come in order: dice round g needs both A_g and B_g, and B_g only exists after the press window closed. */
  async addDiceRound(g: number, beaconA: string, beaconB: string): Promise<DiceRoundResult> {
    if (g !== this.next) throw new Error(`dice round ${g} is out of order (expected ${this.next})`);
    if (!beaconA || !beaconB) throw new Error("both beacon values are needed");
    const s = this.settings, r = roundOf(s, g);
    const target = await targetOf(this.gameId, g, beaconA);
    const dice = new Uint8Array(this.seats), points = new Uint8Array(this.seats);
    const rt = this.roundTallies[r - 1]!;
    for (let seat = 0; seat < this.seats; seat++) {
      const d = await diceOf(this.gameId, seat, g, beaconB); dice[seat] = d;
      if (d === target) { points[seat] = target; addHit(this.total[seat]!, g, target); addHit(rt[seat]!, g, target); }
    }
    if (isLastOfRound(s, g)) this.lastBeacon[r - 1] = beaconB;
    this.next++; this.latestB = beaconB;
    const res: DiceRoundResult = { g, round: r, target, dice, points }; this.results.push(res); return res;
  }
  async roundRanking(round: number, top = TOP_LIST): Promise<Ranked[]> {
    const b = this.lastBeacon[round - 1]; if (b === undefined) throw new Error(`round ${round} is not finished`);
    return rankTop(this.gameId, `round-${round}`, b, this.roundTallies[round - 1]!, top);
  }
  /** The standings after the dice rounds played so far (the final result once the game has finished). */
  async overallRanking(top = TOP_LIST): Promise<Ranked[]> {
    if (this.next === 0) throw new Error("nothing has been played");
    return rankTop(this.gameId, "overall", this.latestB, this.total, top);
  }
}

export interface PrizeWin { ranking: string /* "overall" or "round-N" */; place: number; seat: number; prize: string }

/**
 * Who gets which prize. The organizer wrote a text per place for each ranking. If a player may win only once, a place that would go to somebody who already
 * won something goes to the next player in that ranking's order (so the top-10 list is the pool). Rankings are handled round 1, 2 ..., then overall.
 */
export function assignPrizes(settings: LuckSettings, rounds: readonly Ranked[][], overall: readonly Ranked[]): PrizeWin[] {
  const wins: PrizeWin[] = []; const won = new Set<number>();
  const one = (name: string, list: readonly Ranked[], texts: readonly string[]) => {
    let at = 0;
    for (let place = 1; place <= Math.min(PLACES, texts.length); place++) {
      const text = texts[place - 1]!; if (!text) { at++; continue; }
      let pick: Ranked | undefined;
      if (settings.oneWinPerPlayer) { while (at < list.length && won.has(list[at]!.seat)) at++; pick = list[at]; at++; } else { pick = list[place - 1]; at = place; }
      if (!pick) continue;
      won.add(pick.seat); wins.push({ ranking: name, place, seat: pick.seat, prize: text });
    }
  };
  if (settings.prizeMode !== "overall") rounds.forEach((r, i) => one(`round-${i + 1}`, r, settings.prizes.rounds[i] ?? []));
  if (settings.prizeMode !== "rounds") one("overall", overall, settings.prizes.overall);
  return wins;
}
