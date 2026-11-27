// Owner rules v1.1 (docs/CONSOLE_VOICE.md): the run-the-game page offers exactly TWO ways to start, in the owner's words, and shows which one this game uses (R72 to R75).
// The page script runs in a DOM with a stand-in for the Worker's answers; the Worker routes are tested in apps/edge/test/start-options.test.ts.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const PLAN = { rounds: 4, windowSecs: 6, prizeMode: "overall", oneWinPerPlayer: true, prizes: { overall: ["Hamper", "Book"], rounds: [] } };

async function hostPage(view: Record<string, unknown>, plan: unknown = PLAN) {
  const w: any = new Window({ url: "https://luck.corporatetambola.com/host.html?e=GAME-1", width: 900, height: 900 });
  const sent: { url: string; method: string; body: any }[] = [];
  w.fetch = async (url: string, init: any = {}) => {
    const u = String(url); sent.push({ url: u, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined });
    const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.endsWith("/luck/view")) return ok({ state: "open", serverNow: Date.now(), joined: 5, commit: "ab".repeat(32), scheduledMs: Date.now() + 3_600_000, ...view });
    if (u.endsWith("/luck/plan")) return ok(init.method === "POST" ? { ok: true } : { startMode: "auto", plan });
    if (u.endsWith("/luck/start")) return ok({ ok: true });
    return ok({}, 404);
  };
  w.confirm = () => true;
  w.sessionStorage.setItem("cbz-org", "cbk_" + "a".repeat(48));
  w.document.body.innerHTML = '<main id="app"></main>';
  new Function("window", "globalThis", pub("luck-engine.js"))(w, w);
  new Function("window", "document", "location", "sessionStorage", "fetch", "history", "confirm", "setTimeout", "clearTimeout", "setInterval", "clearInterval", pub("host.js"))(w, w.document, w.location, w.sessionStorage, w.fetch, w.history, w.confirm, w.setTimeout, w.clearTimeout, w.setInterval, w.clearInterval);
  await tick(60);
  return { w, d: w.document, sent };
}
const click = (d: any, id: string) => d.getElementById(id)!.dispatchEvent(new (d.defaultView as any).MouseEvent("click", { bubbles: true }));

describe("R72: 'You start the game'", () => {
  test("the default: the page says the game waits for you, and the one big button is the start", async () => {
    const { d, sent } = await hostPage({ startMode: "manual" });
    expect(d.body.textContent).toContain("You start the game"); expect(d.body.textContent).toContain("The game waits for you. Press Start when you are ready.");
    expect(d.getElementById("start")!.textContent).toBe("You start the game"); expect(d.getElementById("saveplan")).toBeNull();
    expect(d.body.textContent).toMatch(/The game starts 20 seconds after you press Start/); expect(sent.some((s) => s.url.endsWith("/luck/plan"))).toBe(false);
    click(d, "start"); await tick(60);
    const post = sent.find((s) => s.url.endsWith("/luck/start"))!; expect(post.method).toBe("POST"); expect(post.body.delaySecs).toBe(20);
  });
  test("a game with no start mode at all (an older server answer) is read as 'You start the game'", async () => {
    const { d } = await hostPage({});
    expect(d.getElementById("start")).toBeTruthy();
  });
});

describe("R73/R74: 'The game starts by itself'", () => {
  test("the page says when it starts, shows the saved plan, and has a Save button instead of Start", async () => {
    const { d, sent } = await hostPage({ startMode: "auto" });
    expect(d.body.textContent).toContain("The game starts by itself"); expect(d.body.textContent).toContain("You do nothing."); expect(d.body.textContent).toContain("at least 2 players");
    expect(d.getElementById("start")).toBeNull(); expect(d.getElementById("saveplan")!.textContent).toBe("Save your choices");
    expect(sent.some((s) => s.url.endsWith("/luck/plan") && s.method === "GET")).toBe(true);
    expect((d.getElementById("rounds") as any).value).toBe("4"); expect((d.getElementById("overall0") as any).value).toBe("Hamper");
    expect(d.body.textContent).not.toMatch(/The game starts 20 seconds after you press Start/);
  });
  test("Save sends the choices to the plan route, with the organizer's key, and says it is saved; nothing starts the game", async () => {
    const { d, sent } = await hostPage({ startMode: "auto" });
    (d.getElementById("rounds") as any).value = "2"; click(d, "saveplan"); await tick(60);
    const post = sent.find((s) => s.url.endsWith("/luck/plan") && s.method === "POST")!;
    expect(post.body.settings).toMatchObject({ rounds: 2, windowSecs: 6, prizeMode: "overall" }); expect(post.body.settings.prizes.overall).toEqual(["Hamper", "Book"]);
    expect(d.body.textContent).toContain("Saved. The game starts by itself at the time you set."); expect(sent.some((s) => s.url.endsWith("/luck/start"))).toBe(false);
  });
});
