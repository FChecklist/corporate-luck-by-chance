// Joining with a nickname only (the older way, still read for a game that does not ask for an ID): a guest is known by the nickname, their phone by its own random id.
// When the game asks for the ID (join: "id", the console always sets it), the guest also types the ONE invite ID; a mobile number is never a way to join.
import { beforeEach, describe, expect, test } from "bun:test";
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { openPii } from "../src/pii";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200;
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let n = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => String(i).padStart(2, "0").repeat(16); // 32 hex characters
async function game(id: string, over: Record<string, unknown> = {}) {
  const r = await j(await call("POST", "/api/start", { email: `o${++n}@acme.com` }, { "cf-connecting-ip": `10.0.0.${n}` }));
  const h = { "x-organizer": r.token as string };
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100, ...over }, h)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h)).status).toBe(200);
  return h;
}
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://bingo.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env; n = 0; });

describe("joining with a name only", () => {
  test("QA E4: a short real name such as Ms, As or Os can join; a name of spaces or one letter is still refused (the check once removed every letter s)", async () => {
    await game("NAME-S");
    let i = 0;
    for (const name of ["Ms", "As", "Is", "Os", "us", "ss", "Jo"]) { const r = await call("POST", "/api/z/NAME-S/join", { name, device: dev(++i) }); expect([name, r.status]).toEqual([name, 200]); }
    for (const name of ["A", "  ", " x "]) { const r = await call("POST", "/api/z/NAME-S/join", { name, device: dev(++i) }); expect([name, r.status]).toEqual([name, 400]); }
  });
  test("a name and the phone's own id are enough: a seat, a card id, no number stored", async () => {
    await game("NAME-1");
    const info = await j(await call("GET", "/api/z/NAME-1/info"));
    expect(info.joinId).toBe(false);
    const r = await call("POST", "/api/z/NAME-1/join", { name: "Maya Lopez", device: dev(1) }); expect(r.status).toBe(200);
    const a = await j(r); expect(a.pid).toMatch(/^1x[0-9a-f]{12}$/);
    const row = raw.query("SELECT pii FROM participant WHERE pid=?").get(a.pid) as any;
    const who = await openPii(env as any, row.pii); expect(who).toEqual({ phone: "", name: "Maya Lopez" });
    expect((raw.query("SELECT COUNT(*) c FROM seat").get() as any).c).toBe(1);
  });
  test("the same phone again is the same guest; another phone is another seat with another card", async () => {
    await game("NAME-2");
    const a = await j(await call("POST", "/api/z/NAME-2/join", { name: "Maya", device: dev(1) }));
    const again = await j(await call("POST", "/api/z/NAME-2/join", { name: "Maya", device: dev(1) })); expect(again.pid).toBe(a.pid); expect(again.again).toBe(true);
    const b = await j(await call("POST", "/api/z/NAME-2/join", { name: "Maya", device: dev(2) })); expect(b.pid).not.toBe(a.pid); // same name, different phone: a different guest
    expect(b.pid).toMatch(/^2x/);
  });
  test("a name is needed, and a phone id; both are refused kindly", async () => {
    await game("NAME-3");
    for (const body of [{ device: dev(1) }, { name: "", device: dev(1) }, { name: "A", device: dev(1) }]) { const r = await call("POST", "/api/z/NAME-3/join", body); expect(r.status).toBe(400); expect((await j(r)).error).toMatch(/your name/i); }
    const r = await call("POST", "/api/z/NAME-3/join", { name: "Maya" }); expect(r.status).toBe(400); expect((await j(r)).error).toMatch(/refresh/i);
    expect((raw.query("SELECT COUNT(*) c FROM seat").get() as any).c).toBe(0);
  });
  test("the cap and the one-card-per-phone rule still hold", async () => {
    await game("NAME-4", { cap: 2 });
    expect((await call("POST", "/api/z/NAME-4/join", { name: "One", device: dev(1) })).status).toBe(200);
    expect((await call("POST", "/api/z/NAME-4/join", { name: "Two", device: dev(2) })).status).toBe(200);
    const full = await call("POST", "/api/z/NAME-4/join", { name: "Three", device: dev(3) }); expect(full.status).toBe(409);
  });
  test("when the game asks for the ID, a nickname alone is refused and a typed ID (in any spelling) works; a mobile number is not an ID field", async () => {
    const h = await game("NAME-5");
    expect((await call("PATCH", "/api/z/NAME-5/settings", { join: "id" }, h)).status).toBe(200);
    expect((await j(await call("GET", "/api/z/NAME-5/info"))).joinId).toBe(true);
    const r = await call("POST", "/api/z/NAME-5/join", { name: "Maya", device: dev(1) }); expect(r.status).toBe(400); expect((await j(r)).code).toBe("need-id");
    const old = await call("POST", "/api/z/NAME-5/join", { name: "Maya", phone: "+1 415 555 0132", device: dev(1) }); expect(old.status).toBe(400); expect((await j(old)).error).toMatch(/ID/); // an old page that still sends a number is told to type an ID
    const noNick = await call("POST", "/api/z/NAME-5/join", { id: "emp-7", device: dev(1) }); expect(noNick.status).toBe(400); expect((await j(noNick)).code).toBe("need-nickname");
    const ok = await call("POST", "/api/z/NAME-5/join", { id: "emp-7", name: "Maya", device: dev(1) }); expect(ok.status).toBe(200);
    expect(await openPii(env as any, (raw.query("SELECT pii FROM participant").get() as any).pii)).toEqual({ phone: "", name: "Maya", id: "EMP7" });
    expect((await j(await call("POST", "/api/z/NAME-5/join", { id: "EMP 7", name: "Maya", device: dev(1) }))).again).toBe(true); // another spelling of the same ID is the same person
    expect((await call("PATCH", "/api/z/NAME-5/settings", { join: "phone" }, h)).status).toBe(200); // the old word is still read, and means "id"
    expect((await j(await call("GET", "/api/z/NAME-5/info"))).joinId).toBe(true);
    expect((await call("PATCH", "/api/z/NAME-5/settings", { join: "everyone" }, h)).status).toBe(400);
  });
  test("an invite-only game puts a name-only guest in the waiting room; the organizer sees only the name", async () => {
    const h = await game("NAME-6", { whoCanJoin: "list" });
    const w = await call("POST", "/api/z/NAME-6/join", { name: "Maya", device: dev(1) }); expect(w.status).toBe(403);
    const b = await j(w); expect(b.waiting).toBe(true);
    const list = await j(await call("GET", "/api/z/NAME-6/waiting", undefined, h)); expect(JSON.stringify(list)).toContain("Maya");
  });
  test("a winner may leave the mobile number empty when confirming prize details", async () => {
    await game("NAME-7", { rewards: [{ pattern: "first", ordinal: 1, text: "Mug" }] });
    const a = await j(await call("POST", "/api/z/NAME-7/join", { name: "Maya", device: dev(1) }));
    raw.prepare("INSERT INTO prize(eid,round,pattern,ordinal,seat,pii,orig,trail,confirmed_ms) VALUES('NAME-7',1,'line',1,1,(SELECT pii FROM participant WHERE pid=?),(SELECT pii FROM participant WHERE pid=?),NULL,NULL)").run(a.pid, a.pid);
    const ok = await call("POST", "/api/z/NAME-7/confirm", { pid: a.pid, device: dev(1), name: "Maya Lopez" }); expect(ok.status).toBe(200);
    const bad = await call("POST", "/api/z/NAME-7/confirm", { pid: a.pid, device: dev(1), name: "Maya Lopez", phone: "12" }); expect(bad.status).toBe(400);
  });
});
