// Owner rules v1.1 (docs/CONSOLE_VOICE.md): TWO ways to start, nothing else.
//   "You start the game"        (start: manual, the default and what every game did before 1.5.2): the Organizer or a Host presses Start.
//   "The game starts by itself" (start: auto): at the start time the server begins the game with the plan the organizer saved.
// Rules R72 to R75 in docs/RULES.md.
import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";
import { AUTO_LEAD_SECS, luckTick } from "../src/luck";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const roundMs = (r: number) => (GEN + (r - 1) * 3) * 1000;
const START = roundAt(T) + 1200; // one hour after T
const AT = roundMs(START); // the scheduled start time
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let n = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (i.toString(16).padStart(4, "0")).repeat(8);
const PLAN = { rounds: 3, windowSecs: 6, prizeMode: "overall", prizes: { overall: ["Hamper", "Book"] } };

async function game(id: string, over: Record<string, unknown> = {}, paid = true) {
  const r = await j(await call("POST", "/api/start", { email: `o${++n}@acme.com` }, { "cf-connecting-ip": `10.0.0.${n}` }));
  const h = { "x-organizer": r.token as string };
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100, ...over }, h)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h)).status).toBe(200);
  if (paid) raw.run("UPDATE engagement SET pack=100 WHERE id=?", [id]);
  return h;
}
const join = async (id: string, count: number, from = 1) => { for (let i = from; i < from + count; i++) expect((await call("POST", `/api/z/${id}/join`, { name: `Nick ${i}`, device: dev(i) })).status).toBe(200); };
const view = async (id: string, now = T) => j(await call("GET", `/api/z/${id}/luck/view`, undefined, {}, now));
const setStart = (h: Record<string, string>, id: string, start: unknown) => call("PATCH", `/api/z/${id}/settings`, { start }, h);
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env; n = 0; });

describe("R72: two ways to start, and the first one is the default", () => {
  test("a game is 'you start the game' until the organizer chooses 'the game starts by itself'; nothing else is accepted", async () => {
    const h = await game("ST-1");
    expect((await j(await call("GET", "/api/z/ST-1/info"))).startMode).toBe("manual");
    const a = await setStart(h, "ST-1", "auto"); expect(a.status).toBe(200); expect((await j(a)).startMode).toBe("auto");
    expect((await j(await call("GET", "/api/z/ST-1/info"))).startMode).toBe("auto");
    expect((await view("ST-1")).startMode).toBe("auto");
    const m = await setStart(h, "ST-1", "manual"); expect(m.status).toBe(200); expect((await j(m)).startMode).toBe("manual");
    for (const bad of ["tap", "sometimes", true, 1, ""]) expect((await setStart(h, "ST-1", bad)).status).toBe(400);
    expect((await j(await call("GET", "/api/z/ST-1/info"))).startMode).toBe("manual");
  });
  test("the choice is kept when other settings change", async () => {
    const h = await game("ST-2"); await setStart(h, "ST-2", "auto");
    expect((await call("PATCH", "/api/z/ST-2/settings", { name: "Friday game" }, h)).status).toBe(200);
    expect((await j(await call("GET", "/api/z/ST-2/info"))).startMode).toBe("auto");
  });
});

describe("R73: the plan a game that starts by itself plays with", () => {
  test("only the Organizer or a Host saves it; the same checks as Start; a stranger and a guest cannot", async () => {
    const h = await game("ST-3");
    expect((await call("POST", "/api/z/ST-3/luck/plan", PLAN)).status).toBe(403);
    expect((await call("GET", "/api/z/ST-3/luck/plan")).status).toBe(403);
    expect((await call("POST", "/api/z/ST-3/luck/plan", { rounds: 99 }, h)).status).toBe(400);
    expect((await call("POST", "/api/z/ST-3/luck/plan", { prizes: { overall: ["Cash prize"] } }, h)).status).toBe(400); // a prize is a gift, never money
    expect((await call("POST", "/api/z/ST-3/luck/plan", PLAN, h)).status).toBe(200);
    const got = await j(await call("GET", "/api/z/ST-3/luck/plan", undefined, h));
    expect(got.plan).toMatchObject({ rounds: 3, windowSecs: 6, prizeMode: "overall", prizes: { overall: ["Hamper", "Book"] } });
  });
  test("with no plan saved, the game plays with the defaults: 10 rounds, a 10 second window", async () => {
    const h = await game("ST-4");
    const got = await j(await call("GET", "/api/z/ST-4/luck/plan", undefined, h));
    expect(got.plan).toMatchObject({ rounds: 10, windowSecs: 10 }); expect(got.startMode).toBe("manual");
  });
  test("the plan cannot be changed once the game has started", async () => {
    const h = await game("ST-5"); await join("ST-5", 2);
    expect((await call("POST", "/api/z/ST-5/luck/start", { settings: { rounds: 1 } }, h)).status).toBe(200);
    expect((await call("POST", "/api/z/ST-5/luck/plan", PLAN, h)).status).toBe(409);
  });
});

describe("R74: the game starts by itself at the start time", () => {
  test("before the start time nothing happens; at the start time the first look of any phone begins the game with the saved plan, and the list closes", async () => {
    const h = await game("ST-6"); await setStart(h, "ST-6", "auto"); await call("POST", "/api/z/ST-6/luck/plan", PLAN, h); await join("ST-6", 3);
    expect((await view("ST-6", AT - 1000)).state).toBe("open");
    expect((await call("GET", `/api/z/ST-6/luck/me?pid=x&device=${dev(1)}`, undefined, {}, AT - 1000)).status).toBeGreaterThan(0);
    const v = await view("ST-6", AT + 2000);
    expect(v.state).toBe("running"); expect(v.players).toBe(3);
    expect(v.startMs).toBe(AT + 2000 + AUTO_LEAD_SECS * 1000); // the first dice round opens a few seconds later, so every phone has time to read the list
    expect(v.settings).toMatchObject({ rounds: 3, windowSecs: 6, prizeMode: "overall", prizes: { overall: ["Hamper", "Book"] } });
    const late = await call("POST", "/api/z/ST-6/join", { name: "Latecomer", device: dev(9) }, {}, AT + 3000);
    expect(late.status).toBe(409); expect((await j(late)).code).toBe("closed"); // the list closed when the game began
  });
  test("a player's own look after the start time begins it too, and the waiting message says the game starts by itself", async () => {
    const h = await game("ST-7"); await setStart(h, "ST-7", "auto");
    const r = await j(await call("POST", "/api/z/ST-7/join", { name: "Nick 1", device: dev(1) })); await join("ST-7", 1, 2);
    const waiting = await j(await call("GET", `/api/z/ST-7/luck/me?pid=${r.pid}&device=${dev(1)}`, undefined, {}, AT - 5000));
    expect(waiting.phase).toBe("waiting"); expect(waiting.message).toMatch(/starts by itself/i); expect(waiting.message).not.toMatch(/waiting for the host/i);
    const after = await j(await call("GET", `/api/z/ST-7/luck/me?pid=${r.pid}&device=${dev(1)}`, undefined, {}, AT + 1000));
    expect(after.state).toBe("running"); expect(after.phase).toBe("playing");
  });
  test("the scheduled job (tick) starts it too, once, and a second tick changes nothing", async () => {
    const h = await game("ST-8"); await setStart(h, "ST-8", "auto"); await join("ST-8", 2);
    expect(await luckTick(env, AT - 1000)).toBe(0);
    expect(await luckTick(env, AT + 30_000)).toBe(1);
    const row = raw.query("SELECT state, start_ms, players FROM luck_t WHERE eid='ST-8'").get() as any;
    expect(row).toMatchObject({ state: "running", start_ms: AT + 30_000 + AUTO_LEAD_SECS * 1000, players: 2 });
    expect(await luckTick(env, AT + 90_000)).toBe(0);
    expect((raw.query("SELECT start_ms FROM luck_t WHERE eid='ST-8'").get() as any).start_ms).toBe(row.start_ms);
  });
});

describe("R75: it never starts a game it should not", () => {
  test("'you start the game' never starts by itself, however late", async () => {
    await game("ST-9"); await join("ST-9", 3);
    expect((await view("ST-9", AT + 600_000)).state).toBe("open"); expect(await luckTick(env, AT + 600_000)).toBe(0);
  });
  test("with fewer than 2 players it waits, and starts as soon as the second one is in", async () => {
    const h = await game("ST-10"); await setStart(h, "ST-10", "auto"); await join("ST-10", 1);
    expect((await view("ST-10", AT + 5000)).state).toBe("open");
    await call("POST", "/api/z/ST-10/join", { name: "Nick 2", device: dev(2) }, {}, AT + 6000);
    expect((await view("ST-10", AT + 8000)).state).toBe("running");
  });
  test("an unpaid game does not start, and nor does a cancelled one", async () => {
    const h = await game("ST-11", {}, false); await setStart(h, "ST-11", "auto"); await join("ST-11", 2);
    expect(await luckTick(env, AT + 5000)).toBe(0);
    expect((raw.query("SELECT state FROM luck_t WHERE eid='ST-11'").get() as any).state).toBe("open");
    const h2 = await game("ST-12"); await setStart(h2, "ST-12", "auto"); await join("ST-12", 2);
    raw.run("UPDATE engagement SET cancelled_ms=? WHERE id=?", [T, "ST-12"]);
    expect(await luckTick(env, AT + 5000)).toBe(0);
    expect((raw.query("SELECT state FROM luck_t WHERE eid='ST-12'").get() as any).state).toBe("open");
  });
  test("pressing Start by hand still works in a game that starts by itself (before the time), and it is not started twice", async () => {
    const h = await game("ST-13"); await setStart(h, "ST-13", "auto"); await join("ST-13", 2);
    expect((await call("POST", "/api/z/ST-13/luck/start", { settings: { rounds: 1 } }, h)).status).toBe(200);
    const first = (raw.query("SELECT start_ms FROM luck_t WHERE eid='ST-13'").get() as any).start_ms;
    await luckTick(env, AT + 5000); // (it may close the finished game; it must not start it again)
    const after = raw.query("SELECT start_ms, state FROM luck_t WHERE eid='ST-13'").get() as any;
    expect(after.start_ms).toBe(first); expect(first).toBe(T + 20_000);
  });
});
