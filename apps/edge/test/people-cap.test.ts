// The people cap (owner decision 1 Nov 2026): every new game takes at most 2,000 people; 2,001 is refused politely.
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
const boot = (flag?: string) => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k", ...(flag ? { DEMO_GAME: flag } : {}) } as any; };
const account = async (ip = "10.0.0.9") => ({ "x-organizer": (await j(await call("POST", "/api/start", { email: `demo${++n}@acme.com` }, { "cf-connecting-ip": ip }))).token as string });
const make = (h: Record<string, string>, id: string, ip = "10.0.0.9", cap = 10, now = T) => call("POST", "/api/z", { id, startRound: START + Math.floor((now - T) / 3000), callSeconds: 9, cap }, { ...h, "cf-connecting-ip": ip }, now);

describe("people cap 2,000", () => {
  beforeEach(() => boot());
  test("2,000 is accepted, 2,001 is refused politely on create and on a later change", async () => {
    const h = await account();
    expect((await make(h, "CAP-A", "10.0.0.9", 2000)).status).toBe(200);
    const r = await make(h, "CAP-B", "10.0.0.9", 2001);
    expect(r.status).toBe(400);
    const b = await j(r);
    expect(b.error).toBe("A game takes up to 2,000 people. Please choose 2,000 or fewer.");
    expect(b.code).toBe("new-flow-cap");
    const p = await call("PATCH", "/api/z/CAP-A/settings", { cap: 2001 }, h);
    expect(p.status).toBe(400);
    expect((await j(p)).code).toBe("new-flow-cap");
  });
});
