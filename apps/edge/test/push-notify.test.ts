// "Notify me when this game begins", the server side (apps/edge/src/push-notify.ts), with a FAKE push service (a stand-in for global fetch; nothing real is ever called).
// DARK: nothing is sent and nothing is written unless BOTH PUSH_URL and PUSH_ADMIN_KEY are set. Configured: ONE POST /send when a game really starts (either way to start it), flagged on the game's row,
// and a POST /purge whenever the game's personal data is deleted. The web side (the button, the page rule, the service worker) is apps/web/test/push-optin.test.ts.
import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";
import { erasePersonal } from "../src/lifecycle";
import { gameLink, pushConfig, pushGameBegins, pushPurge, PUSH_BODY, PUSH_TITLE } from "../src/push-notify";
import { scheduledMsOf } from "../src/luck";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200;
const PUSH = "https://push.example.com";
const KEY = "pk-test-0123456789-not-a-real-key";
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let n = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (i.toString(16).padStart(4, "0")).repeat(8);

async function game(id: string) {
  const r = await j(await call("POST", "/api/start", { email: `o${++n}@acme.com` }, { "cf-connecting-ip": `10.0.0.${n}` }));
  const h = { "x-organizer": r.token as string };
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100 }, h)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h)).status).toBe(200);
  raw.run("UPDATE engagement SET pack=100 WHERE id=?", [id]); // paid
  return h;
}
async function joinAll(id: string, count: number, from = 1) {
  for (let i = from; i < from + count; i++) expect((await call("POST", `/api/z/${id}/join`, { name: `Nick ${i}`, device: dev(i) })).status).toBe(200);
}
const flag = (id: string) => (raw.query("SELECT push_sent_ms AS p FROM luck_t WHERE eid=?").get(id) as any).p as number | null;

// the fake push service: records every call to its address; the answer can be changed per test. Anything else goes to the real fetch (the tests make no other call).
interface Hit { url: string; method: string; auth: string | null; body: any }
let hits: Hit[]; let answer: () => Response | Promise<Response>; const realFetch = globalThis.fetch;
const logs: string[] = []; const realConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info };
function install() {
  hits = []; answer = () => new Response("{}", { status: 200 });
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(typeof input === "string" ? input : input?.url ?? input);
    if (!url.startsWith(PUSH)) return realFetch(input, init);
    hits.push({ url, method: init.method ?? "GET", auth: new Headers(init.headers).get("authorization"), body: init.body ? JSON.parse(init.body) : undefined });
    return answer();
  }) as typeof fetch;
}
const configure = (o: { url?: string; key?: string } = { url: PUSH, key: KEY }) => { env = { ...env, PUSH_URL: o.url, PUSH_ADMIN_KEY: o.key } as Env; }; // no argument = both settings; an object = exactly what it holds (a missing one stays missing)
beforeEach(() => {
  const d = makeD1(); raw = d.raw; n = 0; logs.length = 0; install();
  env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env;
  for (const k of ["log", "warn", "error", "info"] as const) (console as any)[k] = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
});
afterEach(() => { globalThis.fetch = realFetch; Object.assign(console, realConsole); });

describe("the settings: both, and a real https address", () => {
  test("pushConfig needs the key and an https origin with a real host name; anything else is off", () => {
    expect(pushConfig({ PUSH_URL: PUSH, PUSH_ADMIN_KEY: KEY })).toEqual({ url: PUSH, key: KEY });
    expect(pushConfig({ PUSH_URL: " https://push.example.com/ ", PUSH_ADMIN_KEY: ` ${KEY} ` })).toEqual({ url: PUSH, key: KEY });
    for (const bad of [{}, { PUSH_URL: PUSH }, { PUSH_ADMIN_KEY: KEY }, { PUSH_URL: "", PUSH_ADMIN_KEY: KEY }, { PUSH_URL: PUSH, PUSH_ADMIN_KEY: "  " },
      { PUSH_URL: "http://push.example.com", PUSH_ADMIN_KEY: KEY }, { PUSH_URL: "https://push.example.com/send", PUSH_ADMIN_KEY: KEY }, { PUSH_URL: "https://u:p@push.example.com", PUSH_ADMIN_KEY: KEY },
      { PUSH_URL: "https://localhost", PUSH_ADMIN_KEY: KEY }, { PUSH_URL: "nonsense", PUSH_ADMIN_KEY: KEY }, { PUSH_URL: "https://push.example.com?a=1", PUSH_ADMIN_KEY: KEY }]) expect([JSON.stringify(bad), pushConfig(bad)]).toEqual([JSON.stringify(bad), null]);
  });
  test("the link in the message opens this game's page on the site", () => {
    expect(gameLink(env, "LK-1")).toBe("https://luck.test/z.html?e=LK-1");
    expect(gameLink({ ...env, PUBLIC_ORIGIN: "https://luck.test/" } as Env, "A B")).toBe("https://luck.test/z.html?e=A%20B");
  });
});

describe("dark: without both settings nothing is sent, nothing is written", () => {
  for (const [what, url, key] of [["neither is set", undefined, undefined], ["only the address is set", PUSH, undefined], ["only the key is set", undefined, KEY], ["the address is not https", "http://push.example.com", KEY]] as const) {
    test(what + ": a started game makes no request and leaves its flag empty; a deletion makes no request", async () => {
      configure({ url, key });
      const h = await game("PN-D"); await joinAll("PN-D", 2);
      expect((await call("POST", "/api/z/PN-D/luck/start", {}, h)).status).toBe(200);
      expect(await pushGameBegins(env, "PN-D", T)).toBe("off"); expect(await pushPurge(env, "PN-D")).toBe("off");
      await erasePersonal(env, "PN-D", T + 1000, "organizer");
      expect(hits).toEqual([]); expect(flag("PN-D")).toBeNull();
    });
  }
});

describe("configured: one message when the game really starts", () => {
  test("a manual start sends exactly one /send with the key, the game's scope and link; the flag is set on the game's row", async () => {
    configure(); const h = await game("PN-1"); await joinAll("PN-1", 2);
    expect(flag("PN-1")).toBeNull(); expect(hits).toEqual([]); // nothing on creating, publishing or joining
    const st = await call("POST", "/api/z/PN-1/luck/start", {}, h); expect(st.status).toBe(200);
    expect(hits.length).toBe(1);
    expect(hits[0]).toEqual({ url: PUSH + "/send", method: "POST", auth: "Bearer " + KEY, body: { scope: "game:PN-1", kind: "game_begins", title: PUSH_TITLE, body: PUSH_BODY, url: "https://luck.test/z.html?e=PN-1" } });
    expect(flag("PN-1")).toBe(T);
  });
  test("the words are plain and kind", () => {
    expect(PUSH_TITLE).toBe("The game is starting"); expect(PUSH_BODY).toBe("Tap to open the game and join in.");
    for (const w of [PUSH_TITLE, PUSH_BODY]) expect(w).not.toMatch(/\b(my|mine|your|yours|host|nickname|agree)\b/i);
  });
  test("a second press of Start is refused and sends nothing more; the game's flag stays as it was", async () => {
    configure(); const h = await game("PN-2"); await joinAll("PN-2", 2);
    expect((await call("POST", "/api/z/PN-2/luck/start", {}, h, T)).status).toBe(200);
    const again = await call("POST", "/api/z/PN-2/luck/start", {}, h, T + 5000); expect(again.status).toBe(409);
    expect(hits.length).toBe(1); expect(flag("PN-2")).toBe(T);
  });
  test("a game that starts by itself at its time sends exactly one message, however many phones look", async () => {
    configure(); await game("PN-3"); await joinAll("PN-3", 2);
    raw.run(`UPDATE engagement SET config='{"start":"auto"}' WHERE id='PN-3'`);
    const at = scheduledMsOf({ start_round: START });
    await call("GET", "/api/z/PN-3/luck/view", undefined, {}, at - 5000); expect(hits).toEqual([]); // before the time: nothing
    const looks = await Promise.all([1, 2, 3, 4].map(() => call("GET", "/api/z/PN-3/luck/view", undefined, {}, at + 1000)));
    for (const r of looks) expect(r.status).toBe(200);
    await call("POST", "/api/lifecycle/tick", {}, { "x-organizer": "plat" }, at + 2000);
    expect((raw.query("SELECT state FROM luck_t WHERE eid='PN-3'").get() as any).state).not.toBe("open");
    expect(hits.filter((x) => x.url.endsWith("/send")).length).toBe(1); expect(hits[0]!.body.scope).toBe("game:PN-3"); expect(flag("PN-3")).not.toBeNull();
  });
  test("two games send once each, to their own scope", async () => {
    configure(); const a = await game("PN-4"), b = await game("PN-5"); await joinAll("PN-4", 2); await joinAll("PN-5", 2, 10);
    await call("POST", "/api/z/PN-4/luck/start", {}, a); await call("POST", "/api/z/PN-5/luck/start", {}, b);
    expect(hits.map((x) => x.body.scope).sort()).toEqual(["game:PN-4", "game:PN-5"]);
  });
  test("many calls at the same moment still send once (the claim is one conditional write)", async () => {
    configure(); await game("PN-6"); await joinAll("PN-6", 2);
    const out = await Promise.all([1, 2, 3, 4, 5].map(() => pushGameBegins(env, "PN-6", T)));
    expect(out.filter((x) => x === "sent").length).toBe(1); expect(out.filter((x) => x === "already").length).toBe(4);
    expect(hits.length).toBe(1);
  });
  test("a push service that is down, slow to refuse or throws never stops the game from starting", async () => {
    configure(); const h = await game("PN-7"); await joinAll("PN-7", 2);
    answer = () => { throw new Error("network down"); };
    expect((await call("POST", "/api/z/PN-7/luck/start", {}, h)).status).toBe(200);
    expect((raw.query("SELECT state FROM luck_t WHERE eid='PN-7'").get() as any).state).toBe("running");
    const h2 = await game("PN-8"); await joinAll("PN-8", 2, 10); answer = () => new Response("no", { status: 500 });
    expect((await call("POST", "/api/z/PN-8/luck/start", {}, h2)).status).toBe(200);
    expect(await pushGameBegins(env, "PN-8", T)).toBe("already");
  });
  test("what comes back is reported plainly: sent, or failed", async () => {
    configure(); await game("PN-9"); await game("PN-10"); await joinAll("PN-9", 1); await joinAll("PN-10", 1, 5);
    expect(await pushGameBegins(env, "PN-9", T)).toBe("sent");
    answer = () => new Response("no", { status: 502 }); expect(await pushGameBegins(env, "PN-10", T)).toBe("failed");
  });
});

describe("configured: the push service's saved browser addresses are purged whenever the game's data is deleted", () => {
  const purges = () => hits.filter((x) => x.url.endsWith("/purge"));
  test("a direct deletion", async () => {
    configure(); await game("PN-P1");
    await erasePersonal(env, "PN-P1", T + 1000, "organizer");
    expect(purges().length).toBe(1);
    expect(purges()[0]).toEqual({ url: PUSH + "/purge", method: "POST", auth: "Bearer " + KEY, body: { scope: "game:PN-P1" } });
  });
  test("the organizer's delete button (right to erasure)", async () => {
    configure(); const h = await game("PN-P2"); await joinAll("PN-P2", 2);
    const r = await call("POST", "/api/z/PN-P2/erase", {}, h); expect(r.status).toBe(200);
    expect(purges().map((x) => x.body)).toEqual([{ scope: "game:PN-P2" }]);
    expect((raw.query("SELECT COUNT(*) c FROM participant WHERE eid='PN-P2'").get() as any).c).toBe(0);
  });
  test("a stranger cannot trigger it", async () => {
    configure(); await game("PN-P3");
    expect((await call("POST", "/api/z/PN-P3/erase", {})).status).toBe(403); expect(hits).toEqual([]);
  });
  test("the scheduled job, 23 hours after the game, for a game that was played", async () => {
    configure(); const h = await game("PN-P4"); await joinAll("PN-P4", 2);
    const st = await j(await call("POST", "/api/z/PN-P4/luck/start", {}, h)); expect(hits.filter((x) => x.url.endsWith("/send")).length).toBe(1);
    expect(purges()).toEqual([]); // not before the deletion
    await call("POST", "/api/lifecycle/tick", {}, { "x-organizer": "plat" }, st.endMs + 25 * 3_600_000);
    expect(purges().map((x) => x.body)).toEqual([{ scope: "game:PN-P4" }]);
  });
  test("the scheduled job, for a paid game nobody ever started", async () => {
    configure(); await game("PN-P5"); await joinAll("PN-P5", 1);
    const late = scheduledMsOf({ start_round: START }) + 6 * 3_600_000 + 23 * 3_600_000 + 31 * 60_000;
    await call("POST", "/api/lifecycle/tick", {}, { "x-organizer": "plat" }, late);
    expect(purges().map((x) => x.body)).toEqual([{ scope: "game:PN-P5" }]);
  });
  test("a purge that cannot be made never stops the deletion", async () => {
    configure(); const h = await game("PN-P6"); await joinAll("PN-P6", 2);
    answer = () => { throw new Error("network down"); };
    expect((await call("POST", "/api/z/PN-P6/erase", {}, h)).status).toBe(200);
    expect((raw.query("SELECT COUNT(*) c FROM participant WHERE eid='PN-P6'").get() as any).c).toBe(0);
    answer = () => new Response("no", { status: 500 }); await game("PN-P7");
    await erasePersonal(env, "PN-P7", T + 1000, "organizer"); expect(await pushPurge(env, "PN-P7")).toBe("failed");
  });
});

describe("the key", () => {
  test("it goes only in the Authorization header: never in a body, a log line, an answer or any table", async () => {
    configure(); const h = await game("PN-K1"); await joinAll("PN-K1", 2);
    const answers: string[] = [];
    answers.push(await (await call("POST", "/api/z/PN-K1/luck/start", {}, h)).text());
    answers.push(await (await call("GET", "/api/z/PN-K1/luck/view", undefined, {}, T + 1000)).text());
    answers.push(await (await call("POST", "/api/z/PN-K1/erase", {}, h)).text());
    expect(hits.length).toBeGreaterThanOrEqual(2);
    for (const x of hits) { expect(x.auth).toBe("Bearer " + KEY); expect(JSON.stringify(x.body)).not.toContain(KEY); expect(x.url).not.toContain(KEY); }
    expect(logs.join("\n")).not.toContain(KEY); for (const a of answers) expect(a).not.toContain(KEY);
    const tables = (raw.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name);
    for (const t of tables) expect([t, JSON.stringify(raw.query(`SELECT * FROM "${t}"`).all()).includes(KEY)]).toEqual([t, false]);
  });
  test("both settings are on the list of names kept off the repository, and neither has a value written in the code", async () => {
    const list = await Bun.file(new URL("../../../config/SECRETS_NAMES.md", import.meta.url)).text();
    expect(list).toMatch(/PUSH_URL/); expect(list).toMatch(/PUSH_ADMIN_KEY/);
    const src = await Bun.file(new URL("../src/push-notify.ts", import.meta.url)).text();
    expect(src).not.toMatch(/console\./); // nothing in this file logs at all
    expect(src).not.toMatch(/ADMIN_KEY\s*[:=]\s*["'][^"']+["']/); // no key written in the code
    expect(JSON.parse(await Bun.file(new URL("../../../config/push.json", import.meta.url)).text()).pushApi).toBe(""); // and no address in the web setting either: dark
  });
});

describe("the column", () => {
  test("the migration file adds exactly the one column the code expects, and a database made before it gets the column too", async () => {
    const sql = await Bun.file(new URL("../migrations/0027_push_notify.sql", import.meta.url)).text();
    expect(sql).toContain("ALTER TABLE luck_t ADD COLUMN push_sent_ms INTEGER;");
    expect((raw.query("PRAGMA table_info(luck_t)").all() as { name: string }[]).some((c) => c.name === "push_sent_ms")).toBe(true);
  });
});
