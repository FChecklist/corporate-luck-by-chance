// A join that gets no answer at all (a lost connection, a call that timed out) or a busy answer is asked again by the page itself, like Tambola's player page (PORT_PLAYBOOK section 3, point 1).
// Joining is safe to repeat (the same device gets the same seat), so one phone in a crowd that loses its call still gets in. A plain refusal (a full game, a wrong detail) is shown and NOT repeated.
// The real player page (z.html + luck.js + termsbox.js) runs in a DOM; the Worker's answers are stood in for. Waits longer than a second are shortened so the test is quick.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import TEXT from "../../edge/src/consent-text.json";
const K4: Record<string, string> = (TEXT as any).K4, VER: string = (TEXT as any).version;

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));

type Answer = "drop" | "busy429" | "busy503" | "full" | "ok";
/** `answers` are used one per join call (the last one repeats). `slow` keeps every long wait from firing, so the waiting screen can be looked at. */
async function openPlayer(answers: Answer[], slow = false) {
  const w: any = new Window({ url: "https://luck.corporatetambola.com/z.html?e=GAME-RT", width: 390, height: 780 });
  w.crypto = globalThis.crypto;
  const joins: { body: any; screen: string }[] = [];
  w.fetch = async (url: string, init: any = {}) => {
    const u = String(url); const body = init.body ? JSON.parse(init.body) : undefined;
    const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.includes("/api/consent/text")) return ok({ version: VER, kind: "K4", boxes: Object.entries(K4).map(([id, text]) => ({ id, text })) });
    if (u.endsWith("/info")) return ok({});
    if (u.endsWith("/join")) {
      joins.push({ body, screen: w.document.body.textContent });
      const a = answers[Math.min(joins.length - 1, answers.length - 1)];
      if (a === "drop") throw new TypeError("fetch failed"); // no answer at all
      if (a === "busy429") return ok({ error: "It is busy right now. Please try again in a few minutes.", code: "busy" }, 429);
      if (a === "busy503") return ok({ error: "It is very busy right now. Please try again in a few minutes.", code: "busy" }, 503);
      if (a === "full") return ok({ error: "This engagement is full.", code: "full" }, 409);
      return ok({ pid: "1x000000000001" });
    }
    if (u.includes("/luck/me")) return ok({ phase: "waiting", state: "open", joined: 1, serverNow: Date.now(), commit: "ab".repeat(32), ann: null });
    return ok({}, 404);
  };
  w.document.body.innerHTML = '<main id="app"></main>';
  new Function("globalThis", pub("luck-engine.js"))(w);
  const st = (fn: any, ms?: number) => (ms && ms > 1000 ? (slow ? 0 : setTimeout(fn, 5)) : setTimeout(fn, ms)); // a long wait is shortened (or never fires when `slow`)
  for (const f of ["termsbox.js", "luck-dice.js", "luck-run.js", "luck.js"]) new Function("window", "document", "location", "localStorage", "fetch", "history", "navigator", "setTimeout", "clearTimeout", "setInterval", "clearInterval", pub(f))(w, w.document, w.location, w.localStorage, w.fetch, w.history, w.navigator, st, clearTimeout, (fn: any, ms?: number) => setInterval(fn, ms), clearInterval);
  await tick(40);
  return { w, d: w.document, joins };
}
/** ticks both boxes, types a name and presses Join */
async function join(p: Awaited<ReturnType<typeof openPlayer>>, name = "Maya") {
  const d = p.d; const Ev = (d.defaultView as any).Event;
  for (const b of [...d.querySelectorAll('input[type="checkbox"]')] as any[]) { b.checked = true; b.dispatchEvent(new Ev("change")); await tick(); }
  const nm = d.getElementById("nm") as any; nm.value = name; nm.dispatchEvent(new Ev("input")); await tick();
  (d.getElementById("go") as any).click();
}

describe("a join that gets no answer, or a busy answer, is asked again by itself", () => {
  test("the first join call gets no answer at all; the page asks again on its own and the person gets in", async () => {
    const p = await openPlayer(["drop", "ok"]);
    await join(p); await tick(300);
    expect(p.joins.length).toBe(2); // the second call is the page's own retry
    expect(p.joins[1].body.name).toBe("Maya"); expect(p.joins[1].body.device).toBe(p.joins[0].body.device); expect(p.joins[1].body.consent).toEqual(p.joins[0].body.consent); // the same person, the same device, the same ticks
    expect(p.d.body.textContent).toContain("Waiting for the host to start the game");
    expect(p.d.body.textContent).not.toMatch(/Many people are joining/);
  });
  test("a busy answer (429 or 503 with the busy code) is asked again too, and the person sees one calm screen, not an error", async () => {
    const p = await openPlayer(["busy429", "busy503", "ok"]);
    await join(p); await tick(400);
    expect(p.joins.length).toBe(3);
    expect(p.joins[1].screen).toMatch(/Many people are joining right now/); expect(p.joins[1].screen).toMatch(/Your request is safe/); expect(p.joins[1].screen).toMatch(/Try 1 of 15/);
    expect(p.joins[2].screen).toMatch(/Try 2 of 15/);
    expect(p.joins.map((j) => j.screen).join("|")).not.toMatch(/It is busy right now|It is very busy right now/); // the raw server wording is never shown while the page is trying
    expect(p.d.body.textContent).toContain("Waiting for the host to start the game");
  });
  test("a plain refusal (the game is full) is shown and NOT repeated", async () => {
    const p = await openPlayer(["full", "ok"]);
    await join(p); await tick(300);
    expect(p.joins.length).toBe(1);
    expect(p.d.body.textContent).toContain("This engagement is full."); expect(p.d.getElementById("nm")).toBeTruthy(); // back on the join form with the message
  });
  test("it does not try for ever: after 15 tries the person is told, on the join form", async () => {
    const p = await openPlayer(["drop"]);
    await join(p); await tick(1500);
    expect(p.joins.length).toBe(16); // the first call and 15 retries
    expect(p.d.body.textContent).not.toMatch(/Many people are joining/); expect(p.d.getElementById("go")).toBeTruthy(); expect(p.d.querySelector('[role="alert"]')).toBeTruthy();
  });
  test("'Stop and try myself' stops the retries and brings back the join form", async () => {
    const p = await openPlayer(["drop", "ok"], true); // the long wait never fires on its own
    await join(p); await tick(100);
    expect(p.d.body.textContent).toMatch(/Many people are joining right now/);
    const again = p.d.getElementById("again") as any; expect(again).toBeTruthy(); again.click(); await tick(60);
    expect(p.d.body.textContent).not.toMatch(/Many people are joining/); expect(p.d.getElementById("nm")).toBeTruthy(); expect(p.joins.length).toBe(1); // nothing was sent again by itself
  });
  test("the page script has the retry (the test above fails without it): busy code, no-answer test and the 15-try limit", () => {
    const js = pub("luck.js");
    expect(js).toMatch(/BUSY_TRIES = 15/); expect(js).toMatch(/e\.code === "busy" \|\| !e\.status/); expect(js).toMatch(/Many people are joining right now/);
  });
});
