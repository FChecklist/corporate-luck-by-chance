// The phone sends its result as soon as it has worked it out, which can be a moment before the game is over (the server then answers 409 "running").
// The phone must send the same result again later: a vote marked as sent after a "running" answer left every phone without a vote and the result was never published.
// Found by the Chrome simulation (S07-01: "timeout waiting for the phones' agreed result").
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(import.meta.dir, "../../web/public/luck-run.js"), "utf8");
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function runtime() {
  const win: any = { LuckEngine: {} };
  new Function("window", SRC)(win);
  const R = win.LuckRun.create({ base: "", eid: "G1" });
  const line = { seat: 0, points: 3, hits: 1, best: 3, line: "" };
  R.game = { finished: true }; R.rankings = { overall: [line], rounds: [[line]] };
  return R;
}
const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("a phone sends its vote again until the server takes it", () => {
  test("409 running: not marked as sent, the next look sends it again", async () => {
    const R = runtime(); const sent: number[] = [];
    const answers = [answer(409, { code: "running" }), answer(200, { ok: true })];
    globalThis.fetch = (async () => { sent.push(1); return answers.shift()!; }) as any;
    await R.vote({ pid: "p", device: "d" });
    expect(R.voted).toBe(false);
    await R.vote({ pid: "p", device: "d" });
    expect(R.voted).toBe(true);
    expect(sent.length).toBe(2);
  });
  test("a vote that was taken is not sent twice", async () => {
    const R = runtime(); let n = 0;
    globalThis.fetch = (async () => { n++; return answer(200, { ok: true }); }) as any;
    await R.vote({ pid: "p", device: "d" }); await R.vote({ pid: "p", device: "d" });
    expect(n).toBe(1);
  });
  test("409 watching (the list closed before this person joined): stop trying", async () => {
    const R = runtime(); let n = 0;
    globalThis.fetch = (async () => { n++; return answer(409, { code: "watching" }); }) as any;
    await R.vote({ pid: "p", device: "d" }); await R.vote({ pid: "p", device: "d" });
    expect(R.voted).toBe(true); expect(n).toBe(1);
  });
});
