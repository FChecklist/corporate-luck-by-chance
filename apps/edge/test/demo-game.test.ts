// The free DEMO game (src/demo.ts; owner order 1 Nov 2026): flag, label, limits (3 a day per account and per address), no paid pack and no payment row, data deleted the normal way.
import { beforeEach, describe, expect, test } from "bun:test";
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { lifecycleTick } from "../src/lifecycle";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0), GEN = 1692803367, DAY = 86_400_000;
const START = Math.floor((T / 1000 - GEN) / 3) + 1 + 1200; // 1 hour 
const startMs = (GEN + (START - 1) * 3) * 1000;
let env: Env & { DEMO_GAME?: string }; let raw: ReturnType<typeof makeD1>["raw"]; let n = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const boot = (flag?: string) => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k", ...(flag ? { DEMO_GAME: flag } : {}) } as any; };
const account = async (ip = "10.0.0.9") => ({ "x-organizer": (await j(await call("POST", "/api/start", { email: `demo${++n}@acme.com` }, { "cf-connecting-ip": ip }))).token as string });
const make = (h: Record<string, string>, id: string, ip = "10.0.0.9", cap = 10, now = T) => call("POST", "/api/z", { id, startRound: START + Math.floor((now - T) / 3000), callSeconds: 9, cap }, { ...h, "cf-connecting-ip": ip }, now);
const info = async (id: string, h: Record<string, string> = {}) => j(await call("GET", `/api/z/${id}/info`, undefined, h));

describe("flag off (the default): games behave as before", () => {
  beforeEach(() => boot());
  test("no label, no limit, the home page is told the demo is off", async () => {
    expect(await j(await call("GET", "/api/demo/status"))).toEqual({ on: false });
    const h = await account();
    for (let i = 1; i <= 5; i++) expect((await make(h, `OFF-${i}`)).status).toBe(200);
    expect((await info("OFF-1", h)).demo).toBeUndefined();
  });
});

describe("flag on", () => {
  beforeEach(() => boot("on"));
  test("a game for up to 10 people is a demo, labelled on the player's info and the organizer's; a bigger game is not", async () => {
    expect(await j(await call("GET", "/api/demo/status"))).toEqual({ on: true });
    const h = await account();
    expect((await make(h, "DEMO-A")).status).toBe(200);
    expect((await info("DEMO-A", h)).demo).toBe(true);
    await call("POST", "/api/z/DEMO-A/publish", { email: "boss@acme.com", phone: "98765 43210" }, h);
    expect((await info("DEMO-A")).demo).toBe(true); // what a player's page reads, once the game is open
    expect((await make(h, "BIG-A", "10.0.0.9", 300)).status).toBe(200);
    expect((await info("BIG-A", h)).demo).toBeUndefined();
  });
  test("at most 3 a day per account: the 4th is refused politely, the next day it works; the owner is not limited", async () => {
    const h = await account();
    for (let i = 1; i <= 3; i++) expect((await make(h, `ACC-${i}`, `10.1.0.${i}`)).status).toBe(200);
    const no = await make(h, "ACC-4", "10.1.0.4"); expect(no.status).toBe(429); expect(await j(no)).toMatchObject({ code: "demo-limit", error: expect.stringMatching(/3 free demo games today/) });
    expect(raw.query("SELECT COUNT(*) c FROM engagement WHERE id='ACC-4'").get()).toEqual({ c: 0 });
    expect((await make(h, "ACC-5", "10.1.0.5", 10, T + DAY + 3600_000)).status).toBe(200);
    for (let i = 1; i <= 5; i++) expect((await make({ "x-organizer": "plat" }, `OWN-${i}`, "10.1.0.9")).status).toBe(200);
  });
  test("at most 3 a day per network address, whichever accounts are used", async () => {
    for (let i = 1; i <= 3; i++) expect((await make(await account("10.2.0.1"), `IP-${i}`, "10.2.0.1")).status).toBe(200);
    const no = await make(await account("10.2.0.1"), "IP-4", "10.2.0.1"); expect(no.status).toBe(429);
    expect((await make(await account("10.2.0.2"), "IP-5", "10.2.0.2")).status).toBe(200); // another address is fine
  });
  test("published free: no paid pack, no entitlement, no payment row, no ledger row; the game is full at 10", async () => {
    const h = await account(); await make(h, "FREE-1");
    const pub = await j(await call("POST", "/api/z/FREE-1/publish", { email: "boss@acme.com", phone: "98765 43210" }, h));
    expect(pub.published).toBe(true);
    expect(raw.query("SELECT COUNT(*) c FROM payment").get()).toEqual({ c: 0 });
    expect(raw.query("SELECT COUNT(*) c FROM entitlement WHERE eid='FREE-1'").get()).toEqual({ c: 0 });
    expect(raw.query("SELECT pack, cap FROM engagement WHERE id='FREE-1'").get()).toEqual({ pack: 10, cap: 10 });
    expect((await info("FREE-1", h)).demo).toBe(true);
  });
  test("the guests' data goes the normal way: deleted by the lifecycle pass after the game", async () => {
    const h = await account(); await make(h, "DEL-1");
    await call("POST", "/api/z/DEL-1/publish", { email: "boss@acme.com", phone: "98765 43210" }, h);
    expect((await call("POST", "/api/z/DEL-1/join", { name: "Asha", device: "a1".repeat(16) }, { "cf-connecting-ip": "10.3.0.1" })).status).toBe(200);
    expect(raw.query("SELECT COUNT(*) c FROM participant WHERE eid='DEL-1'").get()).toEqual({ c: 1 });
    await lifecycleTick(env as any, startMs + 60_000);
    await lifecycleTick(env as any, startMs + 30 * 3_600_000);
    await lifecycleTick(env as any, startMs + 60 * 3_600_000);
    expect(raw.query("SELECT COUNT(*) c FROM participant WHERE eid='DEL-1'").get()).toEqual({ c: 0 });
  });
  test("the daily counters (an account id and an address hash) are swept after two days", async () => {
    const h = await account(); await make(h, "SW-1");
    expect((raw.query("SELECT COUNT(*) c FROM kv WHERE k LIKE 'demo/o/%' OR k LIKE 'demo/i/%'").get() as any).c).toBe(2);
    await lifecycleTick(env as any, T + 3 * DAY);
    expect((raw.query("SELECT COUNT(*) c FROM kv WHERE k LIKE 'demo/o/%' OR k LIKE 'demo/i/%'").get() as any).c).toBe(0);
    expect(raw.query("SELECT COUNT(*) c FROM kv WHERE k='demo/g/SW-1'").get()).toEqual({ c: 1 }); // the game's own marker stays with the game
  });
});
