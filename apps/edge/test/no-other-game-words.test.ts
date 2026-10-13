// Words of another game must not reach a person: the pages, the pay screen (Razorpay description) and the AI link prompt of Corporate Luck by Chance say nothing about Bingo, Tambola or Housie.
// (The Corporate Games bar names the sister games on purpose, and two internal file names keep the old words.) Found by the Chrome simulation on the pay page and the sign-up sheets.
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WEB = join(import.meta.dir, "../../web/public"), SRC = join(import.meta.dir, "../src");
const SKIP = new Set(["gamesbar.js", "control.js", "zgame.js", "luck-engine.js"]); // the games bar lists the other games; the others are built bundles with internal names
const WORDS = /\b(bingo|tambola|housie)\b/i;

describe("no wording from another game", () => {
  for (const f of readdirSync(WEB).filter((x) => /\.(html|js)$/.test(x) && !SKIP.has(x))) {
    test("page file " + f, () => expect(readFileSync(join(WEB, f), "utf8").match(WORDS)?.[0] ?? null).toBeNull());
  }
  for (const f of ["pay.ts", "ai-link.ts", "mails.ts", "legal.ts"]) {
    test("edge source " + f, () => expect(readFileSync(join(SRC, f), "utf8").match(WORDS)?.[0] ?? null).toBeNull());
  }
});
