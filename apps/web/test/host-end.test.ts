// R51: the run-the-game page (host.html + host.js) offers "End the game after round N" while a game is running, asks first, sends one signed-in request, and shows that the game was ended.
// The page script runs in a DOM with a stand-in for the Worker's answers; the Worker route itself is tested in apps/edge/test/luck-end.test.ts.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const SETTINGS = { rounds: 3, windowSecs: 10, prizeMode: "both", oneWinPerPlayer: false, prizes: { overall: [], rounds: [] }, diceRounds: 10, revealSecs: 3, breakSecs: 20 };

async function hostPage(view: () => Record<string, unknown>, sure = true) {
  const w: any = new Window({ url: "https://corporate-luck-by-chance.pages.dev/host.html?e=GAME-1", width: 900, height: 800 });
  const sent: { url: string; method: string; headers: any }[] = [];
  const asked: string[] = [];
  w.fetch = async (url: string, init: any = {}) => {
    const u = String(url); sent.push({ url: u, method: init.method ?? "GET", headers: init.headers });
    const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.endsWith("/luck/view")) return ok(view());
    if (u.endsWith("/luck/end")) return ok({ ok: true, endedAfterRound: 1 });
    return ok({}, 404);
  };
  w.confirm = (m: string) => { asked.push(m); return sure; };
  w.sessionStorage.setItem("cbz-org", "cbk_" + "a".repeat(48));
  w.document.body.innerHTML = '<main id="app"></main>';
  new Function("window", "globalThis", pub("luck-engine.js"))(w, w); // the game package the pages carry (window.LuckEngine)
  new Function("window", "document", "location", "sessionStorage", "fetch", "history", "confirm", "setTimeout", "clearTimeout", "setInterval", "clearInterval", pub("host.js"))(w, w.document, w.location, w.sessionStorage, w.fetch, w.history, w.confirm, setTimeout, clearTimeout, () => 0, () => {});
  await tick(40);
  return { w, d: w.document, sent, asked };
}
const nowMs = () => Date.now();
const running = (over: Record<string, unknown> = {}) => () => ({ state: "running", serverNow: nowMs(), startMs: nowMs() - 5000, endMs: nowMs() + 600_000, players: 8, joined: 8, commit: "ab".repeat(32), settings: SETTINGS, agreed: false, endedAfterRound: null, ...over });

describe("the End control on the run page", () => {
  test("a running game shows End the game after round 1; pressing it asks first, then sends the request with the organizer's key", async () => {
    const { d, sent, asked } = await hostPage(running());
    const btn = d.getElementById("end"); expect(btn).toBeTruthy(); expect(btn!.textContent).toBe("End the game after round 1");
    expect(d.body.textContent).toMatch(/finished and counted first/);
    btn!.dispatchEvent(new (d.defaultView as any).MouseEvent("click", { bubbles: true })); await tick(40);
    expect(asked.length).toBe(1); expect(asked[0]).toMatch(/End the game for everybody after the round now being played/);
    const post = sent.find((s) => s.url.endsWith("/luck/end"))!; expect(post.method).toBe("POST"); expect(post.headers["x-organizer"]).toMatch(/^cbk_/);
  });
  test("if the organizer says no, nothing is sent", async () => {
    const { d, sent, asked } = await hostPage(running(), false);
    d.getElementById("end")!.dispatchEvent(new (d.defaultView as any).MouseEvent("click", { bubbles: true })); await tick(40);
    expect(asked.length).toBe(1); expect(sent.some((s) => s.url.endsWith("/luck/end"))).toBe(false);
  });
  test("after it was ended the page says so and has no End button; in the last round it says the game ends by itself; before the start and when over there is no End button", async () => {
    const ended = await hostPage(running({ endedAfterRound: 1, settings: { ...SETTINGS, rounds: 1 } }));
    expect(ended.d.getElementById("end")).toBeNull(); expect(ended.d.body.textContent).toMatch(/You ended the game\. It stops after round 1/);
    const last = await hostPage(running({ settings: { ...SETTINGS, rounds: 1 } }));
    expect(last.d.getElementById("end")).toBeNull(); expect(last.d.body.textContent).toMatch(/This is the last round\. The game ends by itself/);
    const before = await hostPage(running({ startMs: nowMs() + 60_000 })); expect(before.d.getElementById("end")).toBeNull();
    const over = await hostPage(running({ state: "done", startMs: nowMs() - 3_000_000, agreed: true })); expect(over.d.getElementById("end")).toBeNull();
    const open = await hostPage(() => ({ state: "open", serverNow: nowMs(), joined: 3, commit: "ab".repeat(32) })); expect(open.d.getElementById("end")).toBeNull();
  });
});
