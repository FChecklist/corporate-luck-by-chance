// The settings an organizer can choose, and the prize text per place. Plain data, checked here and again on the server.

export const MAX_ROUNDS = 20, DEFAULT_ROUNDS = 10, DICE_ROUNDS_PER_ROUND = 10, REVEAL_SECS = 3, BREAK_SECS = 20;
export const WINDOWS = [6, 10, 15] as const;
export const PLACES = 5; // prizes are named for places 1 to 5; the top 10 are listed
export const TOP_LIST = 10;

export type PrizeMode = "both" | "overall" | "rounds";
export interface PrizePlan { overall: string[]; rounds: string[][] /* index = round - 1, missing = none */ }
export interface LuckSettings {
  rounds: number; windowSecs: number; prizeMode: PrizeMode; oneWinPerPlayer: boolean; prizes: PrizePlan;
  diceRounds: number; revealSecs: number; breakSecs: number;
}

export const defaultSettings = (): LuckSettings => ({ rounds: DEFAULT_ROUNDS, windowSecs: 10, prizeMode: "both", oneWinPerPlayer: false, prizes: { overall: [], rounds: [] }, diceRounds: DICE_ROUNDS_PER_ROUND, revealSecs: REVEAL_SECS, breakSecs: BREAK_SECS });

// A prize is a gift the organizer provides. These words are refused so the product never carries money prizes, stakes or betting.
export const FORBIDDEN_PRIZE = /\b(cash|money|rupees?|rs\.?|inr|usd|dollars?|bets?|betting|stakes?|wager\w*|gambl\w*|jackpot)\b|[₹$]/i;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function checkPrizeText(s: unknown): Checked<string> {
  if (typeof s !== "string") return { ok: false, error: "A prize is written as text." };
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length > 120) return { ok: false, error: "A prize text is at most 120 characters." };
  if (FORBIDDEN_PRIZE.test(t)) return { ok: false, error: "A prize is a gift you hand over, not money. Please describe the gift." };
  return { ok: true, value: t };
}

/** Reads settings from untrusted input. Anything not given takes its default; anything out of range is refused with a plain sentence. */
export function parseSettings(input: unknown): Checked<LuckSettings> {
  const b = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const s = defaultSettings();
  if (b.rounds !== undefined) { const r = Number(b.rounds); if (!Number.isInteger(r) || r < 1 || r > MAX_ROUNDS) return { ok: false, error: `A game has 1 to ${MAX_ROUNDS} rounds.` }; s.rounds = r; }
  if (b.windowSecs !== undefined) { const w = Number(b.windowSecs); if (!(WINDOWS as readonly number[]).includes(w)) return { ok: false, error: "The press window is 6, 10 or 15 seconds." }; s.windowSecs = w; }
  if (b.prizeMode !== undefined) { if (b.prizeMode !== "both" && b.prizeMode !== "overall" && b.prizeMode !== "rounds") return { ok: false, error: "Prizes are for each round, for the overall result, or both." }; s.prizeMode = b.prizeMode; }
  if (b.oneWinPerPlayer !== undefined) s.oneWinPerPlayer = b.oneWinPerPlayer === true;
  const pz = (b.prizes ?? {}) as { overall?: unknown; rounds?: unknown };
  const list = (v: unknown, what: string): Checked<string[]> => {
    if (v === undefined) return { ok: true, value: [] };
    if (!Array.isArray(v) || v.length > PLACES) return { ok: false, error: `${what}: at most ${PLACES} places have a prize.` };
    const out: string[] = [];
    for (const x of v) { const c = checkPrizeText(x); if (!c.ok) return { ok: false, error: `${what}: ${c.error}` }; out.push(c.value); }
    return { ok: true, value: out };
  };
  const ov = list(pz.overall, "Overall prizes"); if (!ov.ok) return ov; s.prizes.overall = ov.value;
  if (pz.rounds !== undefined) {
    if (!Array.isArray(pz.rounds) || pz.rounds.length > s.rounds) return { ok: false, error: "There are more prize lists than rounds." };
    for (let i = 0; i < pz.rounds.length; i++) { const l = list(pz.rounds[i], `Round ${i + 1} prizes`); if (!l.ok) return l; s.prizes.rounds.push(l.value); }
  }
  return { ok: true, value: s };
}
