// "Yes, notify me when this game begins" on the player's game page (z.html + luck.js), from the corporate-push repo (FChecklist/corporate-push, pinned at f1e93f59f45444711edbb66e632fe1333bf8f9cb).
// DARK today: config/push.json holds no address, so the page shows nothing, loads nothing and makes no request to any push service. These tests keep it that way, and they show that with a real https
// address the block is built for THIS game with the push service's own, unchanged script, that its Stop button is there, that the browser's question and every request wait for a tap, and that the
// page rule and the service worker are what the push service's own guide asks for. The server side is apps/edge/test/push-notify.test.ts.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
// @ts-ignore (plain .mjs next to the build script)
import { pushOrigin, withPushApi, withPushConnect } from "../../../pages/push-config.mjs";

const ROOT = join(import.meta.dir, "../../..");
const PUB = join(ROOT, "apps/web/public");
const pub = (f: string) => readFileSync(join(PUB, f), "utf8");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf8");
const sha = (f: string) => createHash("sha256").update(readFileSync(join(PUB, f))).digest("hex");
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));
const until = async (pred: () => boolean, ms = 4000) => { const t0 = Date.now(); while (!pred()) { if (Date.now() - t0 > ms) throw new Error("timed out"); await tick(20); } };
const PUSH = "https://push.example.com";
const GAME = "GAME-1";

describe("the push service's three files are copied unchanged", () => {
  // SHA-256 of the files at corporate-push f1e93f59f45444711edbb66e632fe1333bf8f9cb (client/push-optin.js, client/push-optin.css, client/sw-push-snippet.js). A change here must be a new copy from that repo, not an edit.
  const PINNED: Record<string, string> = {
    "push-optin.js": "10daba00f8f6d7a7605f1af1875cfe683bc17c9670fed5be5893ddcd3afc132c",
    "push-optin.css": "60ee847249cd5af714e269d67b3188225062ff24352864236e3df252d6537e41",
    "sw-push-snippet.js": "ff004604f481bf2ca665441862fc3ebee0ab0f33f7cc610ac2bf3546a5c9ff0b",
  };
  for (const [f, h] of Object.entries(PINNED)) test(f + " is byte for byte the pinned copy", () => expect(sha(f)).toBe(h));
  test("the build ships all three", () => {
    const build = rd("pages/build.mjs");
    for (const f of Object.keys(PINNED)) expect([f, build.includes(`"${f}"`)]).toEqual([f, true]);
  });
});

describe("dark by default: ONE setting, empty today", () => {
  test("config/push.json holds the one value and it is empty", () => {
    const c = JSON.parse(rd("config/push.json"));
    expect(Object.keys(c).filter((k) => !k.startsWith("_"))).toEqual(["pushApi"]);
    expect(c.pushApi).toBe("");
  });
  test("only a real https address counts: nothing else (empty, http, a path, a user name, no dot in the host, not a web address) becomes a push address", () => {
    for (const bad of ["", "   ", "http://push.example.com", "https://push.example.com/send", "https://push.example.com?x=1", "https://push.example.com#a", "https://user:pw@push.example.com", "https://localhost", "ftp://push.example.com", "push.example.com", "not a web address", "javascript:alert(1)"]) expect([bad, pushOrigin(bad)]).toEqual([bad, ""]);
    expect(pushOrigin("https://push.example.com")).toBe(PUSH);
    expect(pushOrigin("  https://push.example.com/  ")).toBe(PUSH);
    expect(pushOrigin(undefined)).toBe("");
  });
  test("the game page ships with an empty data-push-api and no opt-in block, no push script and no push style", () => {
    const z = pub("z.html");
    expect(z).toContain('<div id="pushslot" data-push-api=""></div>');
    expect(z).not.toMatch(/data-push-optin|push-optin\.(js|css)/);
    expect(withPushApi(z, "")).toBe(z); // empty stays empty
    expect(withPushApi(z, PUSH)).toContain(`<div id="pushslot" data-push-api="${PUSH}"></div>`);
  });
});

describe("the page rule (pages/build.mjs): script-src stays 'self'; the push address appears in connect-src only when configured", () => {
  const build = rd("pages/build.mjs");
  const line = (n: string) => build.split(/\r?\n/).find((l) => l.startsWith(`const ${n} = `)) ?? "";
  const GAMECSP = new Function(`${line("CSP")}\n${line("GAMECSP")}\nreturn GAMECSP;`)() as string; // the real definitions
  const dirs = (c: string) => Object.fromEntries(c.split(";").map((d) => d.trim()).filter(Boolean).map((d) => [d.split(/\s+/)[0], d.split(/\s+/).slice(1)]));
  test("dark: the rule is exactly the game rule, with no push address", () => {
    expect(withPushConnect(GAMECSP, "")).toBe(GAMECSP);
    expect(build).toContain("const ZGAMECSP = withPushConnect(GAMECSP, PUSHAPI);");
    expect(build).toContain('["/z", ZGAMECSP, true]');
    expect(build).toContain("const PUSHAPI = pushOrigin(");
    expect(GAMECSP).not.toContain("push");
  });
  test("configured: connect-src gains that one address; script-src and every other rule are untouched, and nothing becomes 'unsafe-inline' or a wildcard", () => {
    const z = withPushConnect(GAMECSP, PUSH), a = dirs(GAMECSP) as Record<string, string[]>, b = dirs(z) as Record<string, string[]>;
    expect(b["connect-src"]).toEqual([...a["connect-src"]!.slice(0, 1), PUSH, ...a["connect-src"]!.slice(1)]);
    for (const k of Object.keys(a)) if (k !== "connect-src") expect([k, b[k]]).toEqual([k, a[k]]);
    expect(b["script-src"]).toEqual(a["script-src"]); expect(b["script-src"]).toContain("'self'"); expect(b["script-src"]!.join(" ")).not.toContain(PUSH);
    expect(z).not.toMatch(/\*|unsafe-eval/); expect(b["script-src"]!.join(" ")).not.toContain("unsafe-inline");
  });
  test("only the player's page (/z) takes the push rule; the preview and the demo keep the plain game rule", () => {
    expect(build).toContain('["/preview", GAMECSP, true]'); expect(build).toContain('["/demo", GAMECSP, true]');
    expect([...build.matchAll(/\["(\/[a-z0-9-]*)", ZGAMECSP, (true|false)\]/g)].map((m) => m[1])).toEqual(["/z"]);
  });
  test("the real build (dark): the player's page rule names no push service, the page carries the empty setting, and the three files are shipped", () => {
    const r = Bun.spawnSync([process.execPath, "pages/build.mjs"], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
    expect(r.exitCode).toBe(0);
    const OUT = join(ROOT, "pages/public"), headers = readFileSync(join(OUT, "_headers"), "utf8");
    for (const p of ["/z", "/z.html"]) {
      const rule = new RegExp(`^${p.replace(".", "\\.")}\\n\\s+Content-Security-Policy: ([^\\n]+)`, "m").exec(headers);
      expect([p, rule === null]).toEqual([p, false]);
      expect([p, /push/i.test(rule![1]!)]).toEqual([p, false]); expect(rule![1]).toContain("script-src 'self' https://static.cloudflareinsights.com;");
    }
    expect(readFileSync(join(OUT, "z.html"), "utf8")).toContain('<div id="pushslot" data-push-api=""></div>');
    for (const f of ["push-optin.js", "push-optin.css", "sw-push-snippet.js"]) expect([f, existsSync(join(OUT, f))]).toEqual([f, true]);
  });
});

describe("the service worker (zsw.js) answers a push message, and has exactly one notificationclick handler", () => {
  type Ev = { type: string; fn: (e: any) => void };
  function load() {
    const handlers: Ev[] = [], shown: { title: string; options: any }[] = [], opened: string[] = [];
    const self: any = {
      addEventListener: (type: string, fn: (e: any) => void) => handlers.push({ type, fn }),
      location: { origin: "https://luck.corporatetambola.com" },
      registration: { showNotification: async (title: string, options: any) => { shown.push({ title, options }); } },
      clients: { matchAll: async () => [], openWindow: async (u: string) => { opened.push(u); } },
    };
    const imported: string[] = [];
    const importScripts = (u: string) => { imported.push(u); if (u !== "/sw-push-snippet.js") throw new Error("unexpected import " + u); new Function("self", pub("sw-push-snippet.js"))(self); };
    new Function("self", "importScripts", "location", "caches", pub("zsw.js"))(self, importScripts, self.location, {});
    const fire = async (type: string, ev: any) => { const waits: Promise<unknown>[] = []; for (const h of handlers.filter((x) => x.type === type)) h.fn({ ...ev, waitUntil: (p: Promise<unknown>) => waits.push(p) }); await Promise.all(waits); };
    return { handlers, shown, opened, imported, fire };
  }
  test("it imports the push snippet first and keeps its own handlers (install, activate, message, periodicsync, fetch)", () => {
    const sw = pub("zsw.js");
    expect(sw.indexOf('importScripts("/sw-push-snippet.js")')).toBeGreaterThan(-1); expect(sw.indexOf('importScripts("/sw-push-snippet.js")')).toBeLessThan(sw.indexOf("const CACHE"));
    const { handlers, imported } = load();
    expect(imported).toEqual(["/sw-push-snippet.js"]);
    const types = handlers.map((h) => h.type);
    for (const t of ["install", "activate", "message", "periodicsync", "fetch", "push", "notificationclick"]) expect([t, types.includes(t)]).toEqual([t, true]);
    expect(types.filter((t) => t === "notificationclick").length).toBe(1); // two would open two windows for one tap
    expect(types.filter((t) => t === "push").length).toBe(1);
  });
  test("a failed load of the snippet does not stop the worker from starting", () => {
    const self: any = { addEventListener: () => {}, location: { origin: "https://x.test" } };
    const importScripts = () => { throw new Error("NetworkError"); };
    expect(() => new Function("self", "importScripts", "location", "caches", pub("zsw.js"))(self, importScripts, self.location, {})).not.toThrow();
  });
  test("a push message shows a notification (a fallback text when it carries none), and a tap opens this site's link or the home page, never another site", async () => {
    const w = load();
    await w.fire("push", { data: { json: () => ({ title: "The game is starting", body: "Tap to open the game and join in.", url: "/z.html?e=GAME-1", tag: "game:GAME-1" }) } });
    expect(w.shown[0]).toEqual({ title: "The game is starting", options: { body: "Tap to open the game and join in.", tag: "game:GAME-1", data: { url: "/z.html?e=GAME-1" } } });
    await w.fire("push", { data: null });
    expect(w.shown[1]!.title.length).toBeGreaterThan(0); // a browser requires a notification for every push
    const close = () => ({ close() {}, data: { url: "" } });
    await w.fire("notificationclick", { notification: { ...close(), data: { url: "https://luck.corporatetambola.com/z.html?e=GAME-1" } } });
    await w.fire("notificationclick", { notification: { ...close(), data: { url: "/z.html?e=GAME-1" } } });
    await w.fire("notificationclick", { notification: { ...close(), data: { url: "https://evil.example.com/phish" } } });
    await w.fire("notificationclick", { notification: { ...close(), data: { url: "javascript:alert(1)" } } });
    expect(w.opened).toEqual(["https://luck.corporatetambola.com/z.html?e=GAME-1", "https://luck.corporatetambola.com/z.html?e=GAME-1", "https://luck.corporatetambola.com/", "https://luck.corporatetambola.com/"]);
  });
});

const S = (rounds: number) => ({ rounds, windowSecs: 6, prizeMode: "both", oneWinPerPlayer: false, prizes: { overall: ["Hamper"], rounds: [["Pen"], ["Mug"], ["Cap"]] }, diceRounds: 10, revealSecs: 3, breakSecs: 20 });
const hex = (i: number) => (i * 2654435761 >>> 0).toString(16).padStart(8, "0").repeat(8);

/** The player's page (the real z.html slot, luck.js and its helpers) in a simulated phone browser. `api` is what the build would have written into data-push-api; `mode` "over" plays a game that has already ended. */
async function openGamePage(o: { api?: string; mode?: "open" | "over" } = {}) {
  const w: any = new Window({ url: `https://luck.corporatetambola.com/z.html?e=${GAME}`, width: 390, height: 780, settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  w.crypto = globalThis.crypto;
  const sent: { url: string; method: string }[] = [];
  const start = Date.now() - 600_000;
  w.fetch = async (url: string, init: any = {}) => {
    const u = String(url); sent.push({ url: u, method: init.method ?? "GET" });
    const ok = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
    if (u.endsWith("/info")) return ok({});
    if (u.includes("/luck/me") || u.includes("/luck/view")) return ok(o.mode === "over" ? { serverNow: Date.now(), state: "running", startMs: start, endMs: start + 100_000, players: 3, joined: 3, settings: S(1), agreed: false, you: { seat: 0 } } : { phase: "waiting", state: "open", joined: 1, serverNow: Date.now(), commit: "ab".repeat(32), ann: null });
    if (u.includes("/luck/seats")) return ok({ players: 3, seats: [[0, "Asha"], [1, "Ben"], [2, "Chen"]] });
    if (u.includes("/luck/beacon")) { const from = Number(new URL(u, "https://x").searchParams.get("from") ?? 0); return ok({ serverNow: Date.now(), from, values: Array.from({ length: 20 - from }, (_, k) => ({ i: from + k, v: hex(from + k) })), next: 20, total: 20 }); }
    return ok({}, 404);
  };
  const slot = /<div id="pushslot"[^>]*><\/div>/.exec(pub("z.html"))![0].replace('data-push-api=""', `data-push-api="${o.api ?? ""}"`); // the real slot of z.html, with the value the build would write
  w.document.body.innerHTML = `<main id="app"></main>${slot}`;
  w.localStorage.setItem(`luck:${GAME}:pid`, "1x000000000001"); // already in the game: straight to the waiting room or the game
  new Function("globalThis", pub("luck-engine.js"))(w);
  for (const f of ["termsbox.js", "luck-dice.js", "luck-run.js", "luck.js"]) new Function("window", "document", "location", "localStorage", "fetch", "history", "navigator", "setTimeout", "clearTimeout", "setInterval", "clearInterval", pub(f))(w, w.document, w.location, w.localStorage, w.fetch, w.history, w.navigator, (fn: any, ms?: number) => setTimeout(fn, ms), clearTimeout, (fn: any, ms?: number) => setInterval(fn, ms), clearInterval);
  await tick(60);
  return { w, d: w.document, sent };
}

/** The push service's own opt-in script, run on the block luck.js built, with a fake browser (notifications, service worker, push manager) and a fake push service. */
function runOptIn(w: any, permission = "default") {
  const rec = { requested: 0, subscribes: 0, http: [] as { url: string; method: string; body: any; credentials: string }[] };
  const sub = { endpoint: "https://fcm.example.com/send/abc", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "p256dh-test", auth: "auth-test" } }; }, unsubscribe: async () => true };
  const reg = { pushManager: { getSubscription: async () => null as any, subscribe: async () => { rec.subscribes++; return sub; } } };
  const nav: any = { userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5, serviceWorker: { getRegistration: async () => reg, ready: Promise.resolve(reg), register: async () => reg } };
  const Notif: any = { permission, requestPermission: () => { rec.requested++; Notif.permission = "granted"; return Promise.resolve("granted"); } };
  w.PushManager = function PushManager() {}; w.Notification = Notif;
  const key = Buffer.from(new Uint8Array(65).fill(4)).toString("base64url");
  const pushFetch = async (url: string, init: any = {}) => { rec.http.push({ url: String(url), method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined, credentials: init.credentials }); return new Response(JSON.stringify(String(url).endsWith("/vapid-public") ? { key } : {}), { status: 200 }); };
  new Function("window", "document", "navigator", "fetch", "Notification", pub("push-optin.js"))(w, w.document, nav, pushFetch, Notif);
  return rec;
}

describe("the game page, dark (today's real setting): nothing is drawn, nothing is loaded, no request to anyone", () => {
  for (const [what, api] of [["empty (today)", ""], ["an http address", "http://push.example.com"], ["an address with a path", "https://push.example.com/send"], ["not a web address", "nonsense"]] as const) {
    test("data-push-api is " + what, async () => {
      const { d, sent } = await openGamePage({ api });
      expect(d.querySelector("[data-push-optin]")).toBeNull(); expect(d.getElementById("pushslot")!.children.length).toBe(0);
      expect(d.querySelectorAll('script[src], link[href]').length).toBe(0); // no push script and no push style are added
      expect(sent.length).toBeGreaterThan(0); expect(sent.every((r) => r.url.startsWith("/api/z/" + GAME))).toBe(true); // the page only talks to its own game
      expect(d.body.textContent).not.toMatch(/notify me|Stop notifications/i);
    });
  }
});

describe("the game page with a real https push address", () => {
  test("the block is built for THIS game from the push service's own settings, and its own script and style are loaded from our files; no request to the push service yet", async () => {
    const { d, sent } = await openGamePage({ api: PUSH });
    const box = d.querySelector("[data-push-optin]")!; expect(box).not.toBeNull(); expect(d.getElementById("pushslot")!.contains(box)).toBe(true);
    expect(Object.fromEntries([...box.attributes].map((a: any) => [a.name, a.value]))).toEqual({
      "data-push-optin": "", "data-push-api": PUSH, "data-push-site": "game", "data-push-game-id": GAME, "data-push-privacy": "/privacy.html", "data-push-sw": "/zsw.js", "data-push-ended": "false",
    });
    expect(d.head.querySelector('script[src="/push-optin.js"]')).not.toBeNull(); expect(d.head.querySelector('link[rel="stylesheet"][href="/push-optin.css"]')).not.toBeNull();
    expect(sent.some((r) => r.url.startsWith(PUSH))).toBe(false);
  });
  test("with the push service's own script on it: the button, the explanation with the Privacy link and Stop notifications are all there; the browser asks nothing and no request goes out on load", async () => {
    const { w, d } = await openGamePage({ api: PUSH });
    const rec = runOptIn(w); await tick(40);
    const box = d.querySelector(".cp-optin")!; expect(box).not.toBeNull();
    expect(box.querySelector(".cp-optin__btn")!.textContent).toBe("Yes, notify me when this game begins");
    const stop = box.querySelector(".cp-optin__stop") as any; expect(stop.textContent).toBe("Stop notifications"); expect(stop.hidden).toBe(false);
    const priv = box.querySelector(".cp-optin__privacy")!; expect(priv.textContent).toContain("a browser address, not your name, e-mail or phone"); expect(priv.querySelector('a[href="/privacy.html"]')).not.toBeNull();
    expect(rec.requested).toBe(0); expect(rec.http).toEqual([]); expect(rec.subscribes).toBe(0);
  });
  test("a tap asks the browser once, then saves only the browser address and keys for this game (no cookies, no name)", async () => {
    const { w, d } = await openGamePage({ api: PUSH });
    const rec = runOptIn(w); await tick(20);
    (d.querySelector(".cp-optin__btn") as any).click(); await until(() => rec.http.some((x) => x.url.endsWith("/subscribe")));
    expect(rec.requested).toBe(1); expect(rec.subscribes).toBe(1);
    const post = rec.http.find((x) => x.url.endsWith("/subscribe"))!;
    expect(post.url).toBe(PUSH + "/subscribe"); expect(post.method).toBe("POST"); expect(post.credentials).toBe("omit");
    expect(post.body).toEqual({ subscription: { endpoint: "https://fcm.example.com/send/abc", keys: { p256dh: "p256dh-test", auth: "auth-test" } }, scope: "game:" + GAME });
  });
  test("once the game has begun the button for when it begins is put away (Stop stays), and when it is over the block is told so the person can keep notifications for new games", async () => {
    const { d } = await openGamePage({ api: PUSH, mode: "over" });
    await until(() => d.querySelector("[data-push-optin]")?.getAttribute("data-push-ended") === "true");
    expect(d.getElementById("pushslot")!.getAttribute("data-game")).toBe("begun");
    const js = pub("luck.js"); expect(js).toContain('"corporatepush:game-ended"'); // the push script's own event name
    expect(pub("luck.css")).toContain('#pushslot[data-game="begun"] .cp-optin[data-state="idle"] .cp-optin__btn:not(.cp-optin__keep) { display: none; }');
  });
  test("a game that has not begun is not marked as begun", async () => {
    const { d } = await openGamePage({ api: PUSH });
    expect(d.getElementById("pushslot")!.getAttribute("data-game")).toBeNull(); expect(d.querySelector("[data-push-optin]")!.getAttribute("data-push-ended")).toBe("false");
  });
});

describe("what the pages say", () => {
  const mainText = (html: string) => html.slice(html.indexOf("<main"), html.indexOf("</main>")).replace(/<[^>]+>/g, " ").replace(/&ldquo;|&rdquo;/g, '"').replace(/\s+/g, " ").trim();
  for (const page of ["apps/web/public/privacy.html", "site/privacy.html"]) {
    test(page + ": a browser address, not a name, e-mail or phone; deleted with the game within 24 hours; never 'not personal data'", () => {
      const t = mainText(rd(page));
      expect(t).toContain("a browser address, not your name, e-mail or phone");
      expect(t).toContain("It is deleted with the game, within 24 hours.");
      expect(t).toContain("Google, Apple, Mozilla or Microsoft carry the message to the browser");
      expect(t).not.toMatch(/not personal data/i);
    });
  }
  test("the game page's own storage (a yes or no note, and a retry address) is on the list of what a device keeps", () => {
    const reg = JSON.parse(rd("apps/web/storage-registry.json")) as { items: { id: string; keys: string[] }[] };
    expect(reg.items.find((i) => i.id === "push-optin")!.keys).toEqual(["corporatePush.v1.*", "corporatePush.v1pending"]);
  });
});
