// The simpler game page (owner order 2026-10-27: hide, never disable, the rarely used choices). A game has 10 rounds and a 10-second press window.
// The two choices (rounds, press window) are only HIDDEN on the run page (host.html + host.js): they stay in the page, and the start request still carries them, so nothing about a saved or older game is lost.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

async function hostPage() {
  const w: any = new Window({ url: "https://luck.corporatetambola.com/host.html?e=GAME-1", width: 900, height: 800 });
  const sent: { url: string; method: string; body: any }[] = [];
  w.fetch = async (url: string, init: any = {}) => {
    const u = String(url); sent.push({ url: u, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined });
    const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.endsWith("/luck/view")) return ok({ state: "open", serverNow: Date.now(), joined: 4, players: 4, commit: "ab".repeat(32) });
    if (u.endsWith("/luck/start")) return ok({ ok: true });
    return ok({}, 404);
  };
  w.confirm = () => true;
  w.sessionStorage.setItem("cbz-org", "cbk_" + "a".repeat(48));
  w.document.body.innerHTML = '<main id="app"></main>';
  new Function("window", "globalThis", pub("luck-engine.js"))(w, w);
  new Function("window", "document", "location", "sessionStorage", "fetch", "history", "confirm", "setTimeout", "clearTimeout", "setInterval", "clearInterval", pub("host.js"))(w, w.document, w.location, w.sessionStorage, w.fetch, w.history, w.confirm, setTimeout, clearTimeout, () => 0, () => {});
  await tick(40);
  return { w, d: w.document, sent };
}

describe("the run page hides the rounds and the press window", () => {
  test("both choices are inside one hidden block (still in the page), and the visible part of the card shows the prizes", async () => {
    const { d } = await hostPage();
    const hidden = d.querySelector(".zc-hide[data-hidden='1']") as any; expect(hidden).not.toBeNull();
    expect(hidden.textContent).toMatch(/Number of rounds/); expect(hidden.textContent).toMatch(/Press window/); expect(hidden.querySelector("#rounds")).not.toBeNull();
    const visible = (d.body.textContent as string).replace(hidden.textContent, "");
    expect(visible).not.toMatch(/Number of rounds|Press window/); expect(visible).toMatch(/Prizes/); expect(visible).toMatch(/Start the game/);
  });
  test("the style that hides it is in the page's own style sheet (display:none), so the block is hidden, never disabled", () => {
    expect(pub("luck.css")).toMatch(/\.zc-hide\{display:none !important\}/);
    expect(pub("host.html")).toMatch(/luck\.css/);
  });
  test("pressing Start still sends 10 rounds and a 10-second press window", async () => {
    const { d, sent } = await hostPage();
    (d.getElementById("start") as any).dispatchEvent(new (d.defaultView as any).MouseEvent("click", { bubbles: true })); await tick(60);
    const post = sent.find((s) => s.url.endsWith("/luck/start"))!; expect(post).toBeTruthy();
    expect(post.body.settings.rounds).toBe(10); expect(post.body.settings.windowSecs).toBe(10);
  });
});
