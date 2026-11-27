// Owner rules v1.1 (docs/SUITE_RULES.md section 4): fairness and timing wording is used ONLY where the code makes it true. Rules R81 to R83 in docs/RULES.md.
//  - The owner's line "No one knows the next number: not the organizer, not the host, not even the software" is NOT true in this build: the server draws and holds the secret
//    (luck_t.secret) and publishes each number at its moment; it is trusted not to look (docs/RULES.md, Known limits). So that line is not used, and no page says "not even us".
//  - The default game takes exactly what packages/luck/src/timeline.ts says, and every page that states it says the same.
//  - Players' data is deleted 23 hours after the end, which is inside the "within 24 hours" every page promises.
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";
import { PURGE_AFTER_MS } from "../src/lifecycle";
import { defaultSettings } from "../../../packages/luck/src/settings";
import { gameEndMs } from "../../../packages/luck/src/timeline";

const ROOT = join(import.meta.dir, "../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const pages = () => [
  ...readdirSync(join(ROOT, "apps/web/public")).filter((f) => /\.(html|js)$/.test(f) && !/^(luck-engine|control|zgame|reportgen|blackbox)\.js$/.test(f)).map((f) => "apps/web/public/" + f),
  ...readdirSync(join(ROOT, "site")).filter((f) => f.endsWith(".html")).map((f) => "site/" + f),
];

describe("R81: no page says the software, or we, cannot know a number", () => {
  test("the owner's line and its cousins are on no page, and no page says a number cannot be known 'even by us' or 'even by the software'", () => {
    const bad: string[] = [];
    for (const f of pages()) {
      const t = read(f).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      for (const re of [/not even the software/i, /not even us\b/i, /not even we\b/i, /nobody can predict/i, /No one knows the next number/i, /does not exist until its moment/i]) { const m = t.match(re); if (m) bad.push(`${f}: ${m[0]}`); }
    }
    expect(bad).toEqual([]);
  });
  test("the reason: the server of this build really does hold the secret from which every number follows", async () => {
    const d = makeD1(); const env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env;
    const T = Date.UTC(2026, 9, 1, 10, 0, 0), START = Math.floor((T / 1000 - 1692803367) / 3) + 1 + 1200;
    const call = (m: string, p: string, b?: unknown, h: Record<string, string> = {}) => handle(new Request("http://x" + p, { method: m, headers: { "content-type": "application/json", ...h }, body: b === undefined ? undefined : JSON.stringify(b) }), env, T);
    const st = (await (await call("POST", "/api/start", { email: "o@acme.com" }, { "cf-connecting-ip": "10.0.0.1" })).json()) as any;
    const h = { "x-organizer": st.token };
    await call("POST", "/api/z", { id: "HW-1", startRound: START, callSeconds: 6, cap: 10 }, h);
    await call("POST", "/api/z/HW-1/publish", { email: "boss@acme.com", phone: "98765 43210" }, h);
    expect((await call("POST", "/api/z/HW-1/join", { name: "Maya", device: "ab".repeat(16) })).status).toBe(200);
    const row = d.raw.query("SELECT secret, commit_hash FROM luck_t WHERE eid='HW-1'").get() as any;
    expect(row.secret).toMatch(/^[0-9a-f]{64}$/); // stored in the clear on the server until the game is over: the server is trusted, and the pages must not say otherwise
    expect(read("docs/RULES.md")).toMatch(/The server is therefore trusted to draw the secret fairly and not to look/);
  });
});

describe("R82: the length of a game is what the timeline says", () => {
  const D = defaultSettings(), ms = gameEndMs(D, 0), min = Math.floor(ms / 60_000), sec = Math.round((ms % 60_000) / 1000);
  test("a default game takes 24 minutes 40 seconds (the break after the last round is not needed)", () => { expect([min, sec]).toEqual([24, 40]); });
  test("every page and doc that gives the length of a default game gives that one, and none says 26 minutes", () => {
    for (const f of pages().concat(["docs/RULES.md", "docs/SPEC.md", "docs/GAME.md", "docs/AI_WORK_PROMPT_ORGANIZER.md"])) { const t = read(f).replace(/<[^>]+>/g, " "); expect([f, /\b26 minutes\b/.test(t)]).toEqual([f, false]); }
    expect(read("site/index.html")).toContain("about 25 minutes (24 minutes 40 seconds)"); expect(read("site/how-it-plays.html")).toContain("About 25 minutes in all (24 minutes 40 seconds)");
    expect(read("docs/RULES.md")).toContain("24 minutes 40 seconds"); expect(read("docs/SPEC.md")).toContain("24 minutes 40 seconds");
  });
});

describe("R83: personal data goes at 23 hours, inside the 24 hours every page promises", () => {
  test("the job deletes at 23 hours and the rules say so, in both places they speak of it", () => {
    expect(PURGE_AFTER_MS).toBe(23 * 3_600_000); expect(PURGE_AFTER_MS).toBeLessThanOrEqual(24 * 3_600_000);
    const rules = read("docs/RULES.md"); expect(rules).toMatch(/R44 23 hours after the end/); expect(rules).toMatch(/R67[^\n]*23 hours after the end/);
    expect(rules).not.toMatch(/R44 24 hours after the end/);
  });
});
