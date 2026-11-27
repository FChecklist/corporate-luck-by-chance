// The console's Pay step, game side (apps/edge/src/console-pay.ts; contract: console repo docs/GAME_PAY_CONTRACT.md section 8):
//   payInfo for the organizer, a host, a stranger and a paid game; markPaid twice in a row (the second changes nothing); a wrong size or wrong owner is refused and nothing changes;
//   a half-done call is safe to run again; with the switch off the old Pay now link still works, with it on the old routes send the person to the console.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import type { PayEnv } from "../src/pay";
import { markPaid, payInfo, payRedirect, CONSOLE_ORIGIN, PAY_GAME } from "../src/console-pay";
import { onRequest } from "../../../pages/functions/_middleware";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 8, 10, 0, 0), H = 3_600_000;
const START = Math.floor(((T + 3 * H) / 1000 - 1692803367) / 3) + 1; // the game starts 3 hours after T
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"]; let ipN = 0;
const call = (method: string, path: string, body?: unknown, key?: string, now = T, e: PayEnv = env) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", "cf-connecting-ip": "2.2.2.2", ...(key ? { "x-organizer": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), e as Env, now);
const j = async (r: Response) => (await r.json()) as any;
const ref = (eid: string) => `GAME-${PAY_GAME}-${eid}`;

beforeEach(() => {
  const d = makeD1(); raw = d.raw;
  env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://luck.test", OWNER_EMAIL: "owner@platform.test" } as PayEnv;
});

/** Organizer boss (game CP-1 for up to 300 people: the pack it needs is 500) with a Host priya; a second organizer with their own game CP-2 (up to 100 people). */
const team = async () => {
  const start = async (email: string) => j(await handle(new Request("http://x/api/start", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `9.9.9.${++ipN}` }, body: JSON.stringify({ email }) }), env as Env, T));
  const master = (await start("boss@acme.com")).token as string;
  await call("POST", "/api/z", { id: "CP-1", startRound: START, callSeconds: 9, cap: 300, name: "Diwali party" }, master);
  await call("POST", "/api/org/host", { label: "Priya", email: "priya@acme.com", mobile: "9876500009" }, master);
  const other = (await start("other@acme.com")).token as string;
  await call("POST", "/api/z", { id: "CP-2", startRound: START, callSeconds: 9, cap: 100 }, other);
  const sub = { organizer: await sha("email|boss@acme.com"), host: await sha("email|priya@acme.com"), stranger: await sha("email|nobody@nowhere.test"), other: await sha("email|other@acme.com") };
  return { master, other, sub };
};
/** everything a payment could touch, as plain text, to prove "nothing changed" */
const snapshot = () => JSON.stringify(["engagement", "kv", "entitlement", "payment", "organizer_email"].map((t) => raw.query(`SELECT * FROM ${t} ORDER BY 1, 2`).all()));
const row = (eid: string) => raw.query("SELECT pack, start_round FROM engagement WHERE id=?").get(eid) as { pack: number; start_round: number };
const kvOf = (k: string) => (raw.query("SELECT v FROM kv WHERE k=?").get(k) as { v: string } | null)?.v ?? null;
const pay = (eid: string, sub: string, item: string, orderRef = ref(eid), nowMs = T) => markPaid(env as Env, { eid, sub, item, orderRef, nowMs });
const refusal = async (p: Promise<unknown>) => { try { await p; } catch (e: any) { return e; } throw new Error("expected a refusal"); };

describe("payInfo (read only)", () => {
  test("the organizer of the game: owner, the size, not paid; a Host, a stranger, another organizer and an unknown game: not the owner and no size", async () => {
    const { sub } = await team(); const before = snapshot();
    expect(await payInfo(env as Env, { eid: "CP-1", sub: sub.organizer })).toEqual({ owner: true, item: "500", paid: false });
    for (const who of [sub.host, sub.stranger, sub.other]) expect(await payInfo(env as Env, { eid: "CP-1", sub: who })).toEqual({ owner: false, item: null, paid: false });
    expect(await payInfo(env as Env, { eid: "NOPE-1", sub: sub.organizer })).toEqual({ owner: false, item: null, paid: false });
    expect(await payInfo(env as Env, { eid: "CP-1", sub: "" })).toEqual({ owner: false, item: null, paid: false });
    expect(snapshot()).toBe(before); // it changed nothing
  });
  test("a paid game says paid (and keeps its size); a Host of a paid game is still not the owner", async () => {
    const { sub } = await team();
    await pay("CP-1", sub.organizer, "500");
    expect(await payInfo(env as Env, { eid: "CP-1", sub: sub.organizer })).toEqual({ owner: true, item: "500", paid: true });
    expect(await payInfo(env as Env, { eid: "CP-1", sub: sub.host })).toEqual({ owner: false, item: null, paid: false });
  });
});

describe("markPaid", () => {
  test("unlocks the game; the game's own page then says paid, and the order is kept with the game", async () => {
    const { master, sub } = await team();
    expect((await j(await call("GET", "/api/z/CP-1/summary", undefined, master))).paid).toBe(false);
    await pay("CP-1", sub.organizer, "500");
    const info = await j(await call("GET", "/api/z/CP-1/summary", undefined, master));
    expect(info.paid).toBe(true); expect(info.status).toBe("published and paid");
    expect(row("CP-1").pack).toBe(500); expect(kvOf("payref/CP-1")).toBe(ref("CP-1")); expect(kvOf("pub/CP-1")).not.toBeNull();
    expect(JSON.parse(kvOf("paidby/CP-1")!)).toMatchObject({ by: "organizer", via: "console" });
    expect(row("CP-2").pack).toBe(0); // no other game moved
  });
  test("twice in a row: the second call succeeds and changes nothing (same order, and even another order for the same paid game)", async () => {
    const { sub } = await team();
    await pay("CP-1", sub.organizer, "500", ref("CP-1"), T);
    const after1 = snapshot();
    await pay("CP-1", sub.organizer, "500", ref("CP-1"), T + 60_000);
    expect(snapshot()).toBe(after1);
    await pay("CP-1", sub.organizer, "500", "GAME-luckbychance-CP-1-again", T + 120_000);
    expect(snapshot()).toBe(after1); expect(kvOf("payref/CP-1")).toBe(ref("CP-1")); // the order that unlocked stays on record
  });
  test("a wrong size is refused for certain (definite) and nothing changes", async () => {
    const { sub } = await team(); const before = snapshot();
    for (const item of ["250", "100", "1000", "300", "", "abc"]) { const e = await refusal(pay("CP-1", sub.organizer, item)); expect(e.definite).toBe(true); }
    expect(snapshot()).toBe(before); expect(row("CP-1").pack).toBe(0);
  });
  test("a wrong owner is refused for certain (definite) and nothing changes: a Host, a stranger, another organizer, an unknown game", async () => {
    const { sub } = await team(); const before = snapshot();
    for (const who of [sub.host, sub.stranger, sub.other, ""]) { const e = await refusal(pay("CP-1", who, "500")); expect(e.definite).toBe(true); }
    expect((await refusal(pay("NOPE-1", sub.organizer, "500"))).definite).toBe(true);
    expect(snapshot()).toBe(before); expect(row("CP-1").pack).toBe(0);
  });
  test("a cancelled game is refused for certain and nothing changes", async () => {
    const { sub } = await team();
    raw.run("UPDATE engagement SET cancelled_ms=? WHERE id='CP-1'", [T]); const before = snapshot();
    expect((await refusal(pay("CP-1", sub.organizer, "500"))).definite).toBe(true);
    expect(snapshot()).toBe(before);
  });
  test("a game whose start time has passed begins 2 minutes after the payment, and a repeat does not move it again", async () => {
    const { sub } = await team();
    const late = T + 5 * H; // 2 hours after the start
    await pay("CP-1", sub.organizer, "500", ref("CP-1"), late);
    const r1 = row("CP-1"); expect(r1.pack).toBe(500);
    const roundAtPay = Math.floor((late / 1000 - 1692803367) / 3) + 1;
    const startMs = (1692803367 + (r1.start_round - 1) * 3) * 1000; // the new start (after the setup window) is about 2 minutes after the payment
    expect(startMs).toBeGreaterThan(late); expect(startMs - late).toBeLessThanOrEqual(2 * 60_000 + 6_000); expect(r1.start_round).toBeGreaterThan(roundAtPay);
    await pay("CP-1", sub.organizer, "500", ref("CP-1"), late + 3_600_000);
    expect(row("CP-1")).toEqual(r1);
  });
  test("the limit is raised right after the size was checked (a race): the old size is NOT unlocked and nothing is written", async () => {
    const { master, sub } = await team(); // CP-1: limit 300, so the size is 500
    const real = env.DB; let raced = 0;
    // the owner changes the limit in the gap between markPaid's look at the game and its write (the batch is where the writes start)
    const racing: any = { prepare: (s: string) => real.prepare(s), batch: async (xs: any[]) => { raced++; raw.run("UPDATE engagement SET cap=5000 WHERE id='CP-1'"); return real.batch(xs); } };
    const before = snapshot();
    const e = await refusal(markPaid({ ...env, DB: racing } as Env, { eid: "CP-1", sub: sub.organizer, item: "500", orderRef: ref("CP-1"), nowMs: T }));
    expect(raced).toBe(1); expect(e.definite).toBe(true);
    expect(row("CP-1").pack).toBe(0); // a 5000-person game is not unlocked by a 500 payment
    expect(kvOf("payref/CP-1")).toBeNull(); expect(kvOf("pub/CP-1")).toBeNull(); expect(kvOf("paidby/CP-1")).toBeNull(); // and no half-record is left behind
    expect(snapshot()).not.toBe(before); // (only the owner's own limit change differs)
    expect(raw.query("SELECT cap FROM engagement WHERE id='CP-1'").get()).toEqual({ cap: 5000 });
    expect(await payInfo(env as Env, { eid: "CP-1", sub: sub.organizer })).toMatchObject({ owner: true, paid: false });
    expect((await refusal(pay("CP-1", sub.organizer, "500"))).definite).toBe(true); // the repeat sees the new limit: 500 is no longer the size
    void master;
  });
  test("a half-done call (it dies before the unlock) leaves the game unpaid, and the same call run again finishes it", async () => {
    const { sub } = await team();
    const real = env.DB; let died = 0;
    const flaky: any = { prepare: (s: string) => real.prepare(s), batch: async (xs: any[]) => { died++; for (const x of xs.slice(0, -1)) await x.run(); throw new Error("the connection dropped"); } };
    const e = await refusal(markPaid({ ...env, DB: flaky } as Env, { eid: "CP-1", sub: sub.organizer, item: "500", orderRef: ref("CP-1"), nowMs: T }));
    expect(died).toBe(1); expect(e.definite).toBeUndefined(); // an unclear failure, never a "definite" refusal: the console repeats the call
    expect(row("CP-1").pack).toBe(0); // not unlocked: the unlock is the last write
    await pay("CP-1", sub.organizer, "500");
    expect(row("CP-1").pack).toBe(500); expect(kvOf("payref/CP-1")).toBe(ref("CP-1"));
    const after = snapshot(); await pay("CP-1", sub.organizer, "500"); expect(snapshot()).toBe(after);
  });
});

describe("the switch PAY_VIA_CONSOLE", () => {
  test("off (unset, empty, 0, anything but 1): the old Pay now link still works exactly as before", async () => {
    const { master } = await team();
    for (const flag of [undefined, "", "0", "true"]) {
      const e = { ...env, ...(flag === undefined ? {} : { PAY_VIA_CONSOLE: flag }) } as PayEnv;
      const r = await call("POST", "/api/z/CP-1/paylink", {}, master, T, e);
      expect(r.status).toBe(200); expect((await j(r)).url).toMatch(/^https:\/\/luck\.test\/paylink\.html\?t=[0-9a-f]{48}$/);
      expect(payRedirect(new Request("http://x/pay.html"), { PAY_VIA_CONSOLE: flag })).toBeNull();
    }
  });
  test("on: the old pay routes of the API answer 410 with the console's address; Razorpay's notice, the return check and read-only views are not touched", async () => {
    const { master } = await team();
    const on = { ...env, PAY_VIA_CONSOLE: "1" } as PayEnv;
    for (const [m, p] of [["POST", "/api/z/CP-1/paylink"], ["POST", "/api/checkout"], ["POST", "/api/payments/test"], ["POST", "/api/payments/paytest"], ["POST", `/api/paylink/${"a".repeat(48)}/checkout`], ["POST", "/api/z/CP-1/pay-with-credit"], ["GET", "/pay.html"], ["GET", "/pay"], ["GET", "/paylink"], ["GET", "/paytest.html"]] as const) {
      const r = await call(m, p, m === "POST" ? {} : undefined, master, T, on);
      expect(p.startsWith("/api/") ? [p, r.status, (await j(r)).console] : [p, r.status, r.headers.get("location")]).toEqual(p.startsWith("/api/") ? [p, 410, CONSOLE_ORIGIN + "/"] : [p, 302, CONSOLE_ORIGIN + "/"]); // 1.5.6: a program gets 410 (gone) and the console address; a page still gets the 302
    }
    for (const [m, p] of [["POST", "/api/payments/webhook"], ["GET", "/api/payments/status"], ["GET", `/api/paylink/${"a".repeat(48)}`], ["GET", "/api/z/CP-1/summary"]] as const) {
      const r = await call(m, p, m === "POST" ? {} : undefined, master, T, on);
      expect([p, r.status === 302]).toEqual([p, false]);
    }
  });
  test("the page-level hook (pages/functions/_middleware.ts) does the same for the three pay pages, and only when the switch is exactly 1", async () => {
    const go = async (url: string, flag?: string) => { let nexted = false; const r = await onRequest({ request: new Request(url), env: flag === undefined ? {} : { PAY_VIA_CONSOLE: flag }, next: async () => { nexted = true; return new Response("page"); } }); return { status: r.status, loc: r.headers.get("location"), nexted }; };
    for (const p of ["/pay.html", "/pay", "/paylink.html", "/paylink", "/paytest.html", "/paytest"]) {
      expect(await go("https://luck.corporatetambola.com" + p, "1")).toEqual({ status: 302, loc: CONSOLE_ORIGIN + "/", nexted: false });
      expect((await go("https://luck.corporatetambola.com" + p)).nexted).toBe(true);
      expect((await go("https://luck.corporatetambola.com" + p, "0")).nexted).toBe(true);
    }
    expect((await go("https://luck.corporatetambola.com/zc.html", "1")).nexted).toBe(true);
    expect((await go("https://luck.corporatetambola.com/", "1")).nexted).toBe(true);
  });
});

afterEach(() => { /* each test builds its own in-memory database */ });
