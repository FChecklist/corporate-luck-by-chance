// Product rule: the player's own phone or laptop computes the game (targets, dice, scores, rankings, prizes). The server only stores, validates, schedules and passes on.
// This test lists the only game modules the server code (apps/edge/src) may import. If a game-logic module (engine.ts, or the index that re-exports it) is imported there, it fails.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

const SRC = new URL("../src/", import.meta.url);
// random.ts: the hash used for the beacon feed and the fingerprint. settings.ts: the checks on what an organizer sends. timeline.ts: when each number is due.
const ALLOWED = new Set(["random", "settings", "timeline"]);
// the names of the game-logic functions: none of them may be called or imported by the server
const GAME_LOGIC = ["targetOf", "diceOf", "scoreOf", "fateOf", "rankTop", "standingOf", "assignPrizes", "LuckGame", "addHit", "cmpNumeric", "emptyTally"];

describe("the server computes nothing about the game", () => {
  const files = readdirSync(SRC).filter((f) => f.endsWith(".ts"));
  test("the only packages/luck modules apps/edge/src imports are random, settings and timeline (never engine, never the index that re-exports it)", () => {
    const seen = new Set<string>();
    for (const f of files) {
      const text = readFileSync(new URL(f, SRC), "utf8");
      for (const m of text.matchAll(/from\s+["']([^"']*packages\/luck\/[^"']*)["']/g)) {
        const mod = m[1]!.split("/").pop()!; seen.add(mod);
        expect([f, m[1], ALLOWED.has(mod)]).toEqual([f, m[1], true]);
      }
    }
    expect([...seen].sort()).toEqual(["random", "settings", "timeline"]);
  });
  test("no game-logic function is named anywhere in the server code", () => {
    for (const f of files) {
      const text = readFileSync(new URL(f, SRC), "utf8");
      for (const name of GAME_LOGIC) expect([f, name, new RegExp(`\\b${name}\\b`).test(text)]).toEqual([f, name, false]);
    }
  });
  test("the browser bundle carries the engine (the pages compute the game with it)", () => {
    const bundle = readFileSync(new URL("../../web/public/luck-engine.js", import.meta.url), "utf8");
    expect(bundle.length).toBeGreaterThan(3000); expect(bundle).toContain("LuckEngine");
  });
});
