// The player's page (z.html + luck.js + termsbox.js) in a simulated phone browser: the join screen shows the K4 boxes BEFORE any name field works,
// nothing is ticked in advance, the button stays disabled until both are ticked, and the request carries the ticks and the Terms version. Gates K4, U1, U2, U3, LR-6, LR-7.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import TEXT from "../../edge/src/consent-text.json";
const K4: Record<string, string> = (TEXT as any).K4, VER: string = (TEXT as any).version;

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));

async function openPlayerPage(search = "?e=GAME-1") {
  const w: any = new Window({ url: "https://corporate-luck-by-chance.pages.dev/z.html" + search, width: 390, height: 780 });
  w.crypto = globalThis.crypto;
  const sent: { url: string; method: string; body: any }[] = [];
  w.fetch = async (url: string, init: any = {}) => {
    const u = String(url); const body = init.body ? JSON.parse(init.body) : undefined; sent.push({ url: u, method: init.method ?? "GET", body });
    const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.includes("/api/consent/text")) return ok({ version: VER, kind: "K4", boxes: Object.entries(K4).map(([id, text]) => ({ id, text })) });
    if (u.endsWith("/info")) return ok({});
    if (u.endsWith("/join")) return ok({ pid: "1x000000000001" });
    if (u.includes("/luck/me")) return ok({ phase: "waiting", state: "open", joined: 1, serverNow: Date.now(), commit: "ab".repeat(32) });
    return ok({}, 404);
  };
  w.document.body.innerHTML = '<main id="app"></main>';
  new Function("globalThis", pub("luck-engine.js"))(w); // the built engine, exactly as shipped
  for (const f of ["termsbox.js", "luck-dice.js", "luck-run.js", "luck.js"]) new Function("window", "document", "location", "localStorage", "fetch", "history", "navigator", "setTimeout", "clearTimeout", "setInterval", "clearInterval", pub(f))(w, w.document, w.location, w.localStorage, w.fetch, w.history, w.navigator, (fn: any, ms?: number) => setTimeout(fn, ms), clearTimeout, (fn: any, ms?: number) => setInterval(fn, ms), clearInterval);
  await tick(40);
  return { w, d: w.document, sent };
}

describe("the join screen (K4, U1-U3)", () => {
  test("U1/K4: the boxes are drawn first, with the server's exact wording, unticked; the name field and the button are disabled", async () => {
    const { d } = await openPlayerPage();
    const boxes = [...d.querySelectorAll('input[type="checkbox"]')] as any[];
    expect(boxes.length).toBe(2); expect(boxes.every((b) => b.checked === false)).toBe(true);
    const labels = [...d.querySelectorAll("#tbslot label")].map((l: any) => l.textContent.trim()); expect(labels).toEqual([K4.A, K4.B]); // string for string with the agreed wording
    expect(d.getElementById("go")!.getAttribute("aria-disabled")).toBe("true");
    expect(d.getElementById("nm")!.disabled).toBe(true); expect(d.getElementById("go")!.disabled).toBe(true);
    const order = d.body.innerHTML; expect(order.indexOf("tbslot")).toBeLessThan(order.indexOf('id="nm"')); // the boxes come before the name field
  });
  test("U3/LR-6: only a name is asked (no phone field), and the invite chain is in the wording the person ticks", async () => {
    const { d } = await openPlayerPage();
    expect(d.querySelector('input[type="tel"]')).toBeNull(); expect(d.getElementById("ph")).toBeNull();
    expect(d.body.textContent).toContain("who invited me is recorded until then");
  });
  test("K4: one box is not enough; with both ticked and a name typed the button works, and the request carries both ticks and the version", async () => {
    const { d, sent } = await openPlayerPage();
    const [a, b] = [...d.querySelectorAll('input[type="checkbox"]')] as any[];
    a.checked = true; a.dispatchEvent(new (d.defaultView as any).Event("change")); await tick();
    expect(d.getElementById("nm")!.disabled).toBe(true); expect(d.getElementById("go")!.disabled).toBe(true);
    b.checked = true; b.dispatchEvent(new (d.defaultView as any).Event("change")); await tick();
    const nm = d.getElementById("nm") as any; expect(nm.disabled).toBe(false); expect(d.getElementById("go")!.disabled).toBe(true); // a name is still needed
    nm.value = "Maya"; nm.dispatchEvent(new (d.defaultView as any).Event("input")); await tick();
    const go = d.getElementById("go") as any; expect(go.disabled).toBe(false);
    go.click(); await tick(60);
    const join = sent.find((s) => s.url.endsWith("/join"))!;
    expect(join.body.name).toBe("Maya"); expect(join.body.consent).toEqual({ v: VER, boxes: ["A", "B"] }); expect(join.body.device).toMatch(/^[0-9a-f]{32}$/);
    expect(d.body.textContent).toContain("Waiting for the host to start the game");
  });
  test("the page never types the consent wording itself (it comes from the server)", () => {
    for (const f of ["luck.js", "termsbox.js"]) for (const text of Object.values(K4)) expect([f, pub(f).includes(text)]).toEqual([f, false]);
  });
});

// ---------------------------------------------------------------------------------------------------------------- the play screen
import { diceOf, parseSettings, phaseAt, sha256Hex, targetOf, windowCloseMs, type LuckSettings } from "../../../packages/luck/src/index";

async function openGame(clock: { now: number }, seatNo = 0, reduce = true) {
  const w: any = new Window({ url: "https://corporate-luck-by-chance.pages.dev/z.html?e=GAME-9", width: 390, height: 780 });
  w.crypto = globalThis.crypto;
  w.matchMedia = (q: string) => ({ matches: reduce && /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); // the phone's "reduce motion" setting
  const parsed = parseSettings({ rounds: 1, windowSecs: 10 }); if (!parsed.ok) throw new Error(parsed.error);
  const settings: LuckSettings = parsed.value, startMs = 1_000_000;
  const feed = async (i: number) => sha256Hex("page-test|" + i);
  w.localStorage.setItem("luck:device", "ab".repeat(16)); w.localStorage.setItem("luck:GAME-9:pid", "1x000000000001");
  const sent: string[] = [];
  w.fetch = async (url: string, init: any = {}) => {
    const u = String(url); sent.push((init.method ?? "GET") + " " + u);
    const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.endsWith("/info")) return ok({});
    if (u.includes("/luck/me") || u.includes("/luck/view")) return ok({ serverNow: clock.now, state: "running", phase: "playing", commit: "ab".repeat(32), joined: 3, startMs, endMs: startMs + 200_000, players: 3, settings, agreed: false, you: { seat: seatNo, name: "Maya" } });
    if (u.endsWith("/luck/seats")) return ok({ players: 3, seats: [[0, "Maya"], [1, "Raj"], [2, "Neha"]] });
    if (u.includes("/luck/beacon")) {
      const from = Number(new URL(u, "https://x").searchParams.get("from") ?? 0); const values: { i: number; v: string }[] = [];
      for (let i = from; i < 2 * settings.rounds * settings.diceRounds; i++) { const due = i % 2 === 0 ? startMs + (i / 2) * 13_000 : windowCloseMs(settings, startMs, (i - 1) / 2); if (due > clock.now) break; values.push({ i, v: await feed(i) }); }
      return ok({ serverNow: clock.now, from, values, next: from + values.length, total: 20 });
    }
    return ok({}, 404);
  };
  w.document.body.innerHTML = '<main id="app"></main>';
  new Function("globalThis", pub("luck-engine.js"))(w);
  for (const f of ["termsbox.js", "luck-dice.js", "luck-run.js", "luck.js"]) new Function("window", "document", "location", "localStorage", "fetch", "history", "navigator", "setTimeout", "clearTimeout", "setInterval", "clearInterval", pub(f))(w, w.document, w.location, w.localStorage, w.fetch, w.history, w.navigator, (fn: any, ms?: number) => setTimeout(fn, ms), clearTimeout, (fn: any, ms?: number) => setInterval(fn, ms), clearInterval);
  return { w, d: w.document, settings, startMs, feed, sent };
}

describe("the play screen (phone first)", () => {
  test("R51: in a press window the screen shows the target first (a dice face and plain words), a dice, a big Press button and the round; pressing starts the dice rolling and says it lands when the timer ends", async () => {
    const clock = { now: 1_000_000 + 2000 };
    const { d, feed } = await openGame(clock); await tick(300);
    const target = await targetOf("GAME-9", 0, await feed(0));
    expect(d.querySelector(".lt-tn b")!.textContent).toBe(String(target)); // "Target number 4"
    expect(d.querySelector(".lt-tn")!.textContent).toContain("Target number");
    expect(d.querySelector(".lt-ts")!.textContent).toBe(`Roll a ${target} and you score ${target} ${target === 1 ? "point" : "points"}. Any other number scores 0.`);
    expect(d.querySelector(".lt-tk")!.textContent).toBe("Dice round 1 of 10");
    expect(d.querySelector(".lt-progt")!.textContent).toBe("Round 1 of 1");
    expect(d.querySelectorAll("#lt-segs li").length).toBe(10); expect(d.querySelector("#lt-segs li")!.className).toBe("now");
    expect(d.querySelectorAll(".lt-tface .ld-pip").length).toBe(target); // the target is drawn as a dice face with that many dots
    expect(d.querySelector(".lt-tface .ld-mini")!.getAttribute("aria-label")).toBe(`Target dice face ${target}`);
    expect(d.querySelectorAll("#die .ld-face").length).toBe(6); expect(d.getElementById("die")!.getAttribute("data-state")).toBe("idle");
    expect(d.getElementById("lt-total")!.textContent).toBe("0");
    const btn = d.getElementById("press") as any; expect(btn.disabled).toBe(false); expect(btn.textContent).toContain("Press the dice");
    expect(d.getElementById("cd")!.textContent).toBe("8"); // seconds left in the window
    btn.click(); await tick(50);
    const after = d.getElementById("press") as any; expect(after.disabled).toBe(true); expect(after.textContent).toBe("Rolling...");
    expect(d.getElementById("die")!.getAttribute("data-state")).toBe("rolling");
    expect(d.getElementById("lt-verdict")!.textContent).toContain("lands when the timer ends");
    expect(d.body.textContent).not.toMatch(/You rolled \d/); // nothing about the number while the window is open
    expect(d.getElementById("lt-num")!.textContent).toBe("?");
    await tick(120); expect(d.getElementById("lt-sr")!.textContent).toContain("Rolling"); // said aloud for screen readers
  });
  test("R52: after the window closes the dice lands on the number the engine worked out, the number shows beside it, the score line and the running score follow, and the screen reader hears the result", async () => {
    const clock = { now: 1_000_000 + 10_500 };
    const { d, feed, w } = await openGame(clock); await tick(1100);
    const target = await targetOf("GAME-9", 0, await feed(0)), dice = await diceOf("GAME-9", 0, 0, await feed(1));
    const hit = dice === target;
    const die = d.getElementById("die")!; expect(die.getAttribute("data-state")).toBe("landed"); expect(die.getAttribute("data-value")).toBe(String(dice));
    expect(die.getAttribute("aria-label")).toBe(`Dice showing ${dice}`);
    const m = /rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\) rotateZ\((-?[\d.]+)deg\)/.exec((die.querySelector(".ld-cube") as any).style.transform)!;
    expect(w.LuckDice.frontFaceOf(Number(m[1]), Number(m[2]), Number(m[3]))).toBe(dice); // the face turned to the player is the number
    expect(d.getElementById("lt-num")!.textContent).toBe(String(dice)); expect(d.getElementById("lt-k")!.textContent).toBe("You rolled");
    const verdict = d.getElementById("lt-verdict")!; expect(verdict.className).toContain(hit ? "hit" : "miss");
    expect(verdict.textContent).toContain(hit ? `+${target} ${target === 1 ? "point" : "points"}` : "Not this time, 0 points");
    expect(verdict.textContent).toContain(`You rolled ${dice}`);
    expect(d.getElementById("lt-total")!.textContent).toBe(String(hit ? target : 0));
    expect(d.getElementById("lt-stage")!.getAttribute("data-res")).toBe(hit ? "hit" : "miss");
    expect(d.getElementById("lt-segs")!.children[0]!.className).toBe(hit ? "hit" : "miss");
    const chips = [...d.querySelectorAll(".lt-chip")] as any[]; expect(chips.length).toBe(1);
    expect(chips[0].getAttribute("aria-label")).toBe(`Dice round 1: target ${target}, you rolled ${dice}, ${hit ? target : 0} ${hit && target === 1 ? "point" : "points"}`);
    expect(chips[0].querySelectorAll(".ld-mini").length).toBe(2); expect(chips[0].textContent).toContain(hit ? `+${target}` : "0");
    expect(d.getElementById("lt-sr")!.textContent).toContain(`You rolled ${dice}`); expect(d.getElementById("lt-sr")!.getAttribute("aria-live")).toBe("polite");
    expect(d.getElementById("lt-sr")!.textContent).toContain(hit ? `You score ${target}` : "You score 0 points");
  });
  test("R52b: with motion on, the number, the score and the history wait until the dice has stopped (no spoiler), then appear", async () => {
    const clock = { now: 1_000_000 + 10_200 };
    const { d, feed, w } = await openGame(clock, 0, false); await tick(500);
    const target = await targetOf("GAME-9", 0, await feed(0)), dice = await diceOf("GAME-9", 0, 0, await feed(1));
    const die = d.getElementById("die")!; expect(die.getAttribute("data-state")).toBe("landing"); expect(die.getAttribute("data-value")).toBeNull();
    expect(d.getElementById("lt-num")!.textContent).toBe("?"); expect(d.getElementById("lt-total")!.textContent).toBe("0");
    expect(d.getElementById("lt-verdict")!.textContent).toContain("Slowing down");
    expect(d.querySelectorAll(".lt-chip").length).toBe(0); expect((d.getElementById("lt-top10") as any).hidden).toBe(true); expect(d.body.textContent).not.toContain(`You rolled ${dice}`);
    const mid = /rotateX\((-?[\d.]+)deg\)/.exec((die.querySelector(".ld-cube") as any).style.transform); expect(mid).toBeTruthy(); // it is turning
    await tick(2700);
    expect(d.getElementById("die")!.getAttribute("data-state")).toBe("landed"); expect(d.getElementById("die")!.getAttribute("data-value")).toBe(String(dice));
    expect(d.getElementById("lt-num")!.textContent).toBe(String(dice)); expect(d.getElementById("lt-total")!.textContent).toBe(String(dice === target ? target : 0));
    expect(d.querySelectorAll(".lt-chip").length).toBe(1); expect((d.getElementById("lt-top10") as any).hidden).toBe(false);
    void w;
  });
  test("R53: the screen has the countdown and the standings in plain words, and the top-10 list uses nicknames", async () => {
    const clock = { now: 1_000_000 + 10_500 };
    const { d } = await openGame(clock); await tick(1100);
    expect(d.getElementById("cd")!.textContent).toMatch(/^\d+$/); expect(d.querySelector(".lt-clock")!.textContent).toMatch(/Next in \d+ s/);
    expect(d.querySelector(".lt-list")).toBeTruthy(); const names = [...d.querySelectorAll(".lt-list li b")].map((b: any) => b.textContent); for (const nm of names) expect(["Maya", "Raj", "Neha"]).toContain(nm);
    expect(d.body.textContent).toMatch(/top \d+%|You are \d+(st|nd|rd|th) of \d+ players/);
  });
  test("R54: the page sends nothing about the dice or the score during play; only the beacon is read, and one result vote is sent at the end", async () => {
    const clock = { now: 1_000_000 + 10_500 };
    const { sent } = await openGame(clock); await tick(900);
    expect(sent.filter((s) => s.startsWith("POST")).length).toBe(0);
    expect(sent.every((s) => /\/(info|luck\/me|luck\/seats|luck\/beacon)/.test(s))).toBe(true);
  });
  test("R57: when the game is over the screen shows the final result: places 1 to 5 by nickname with a reason for every decided tie, and the top 10", async () => {
    const clock = { now: 1_000_000 + 400_000 };
    const { d } = await openGame(clock, 1); await tick(1500);
    expect(d.body.textContent).toContain("The game is over");
    const final = [...d.querySelectorAll(".lt-final li")].map((li: any) => li.textContent as string);
    expect(final.length).toBe(3); expect(final[0]).toMatch(/^1st: /); expect(final[2]).toMatch(/^3rd: /);
    for (const li of final) expect(li).toMatch(/\d+ pts/);
    expect(d.body.textContent).toMatch(/You scored \d+ points/);
  });
  test("R55: the player page and the big screen use only the engine to draw a number (no Math.random anywhere in the play code)", () => {
    for (const f of ["luck.js", "luck-run.js", "big.js"]) expect([f, /Math\.random/.test(pub(f))]).toEqual([f, false]);
  });
  test("R56: the shipped engine bundle is the engine in packages/luck (the page runs the tested code)", async () => {
    const w: any = new Window(); new Function("globalThis", pub("luck-engine.js"))(w);
    expect(await w.LuckEngine.targetOf("G", 3, "b")).toBe(await targetOf("G", 3, "b")); expect(await w.LuckEngine.diceOf("G", 4, 3, "b")).toBe(await diceOf("G", 4, 3, "b"));
    void phaseAt;
  });
});
