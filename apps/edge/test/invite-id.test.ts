// Owner rules v1.1 (docs/SUITE_RULES.md section 2): invite by ID only. ONE alphanumeric field; no names, no mobile numbers, no choice menu.
// Rules R76 to R80 in docs/RULES.md.
import { beforeEach, describe, expect, test } from "bun:test";
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";
import { lifecycleTick } from "../src/lifecycle";
import { openPii } from "../src/pii";
import { cleanInviteId, idHashOf, normalizeId } from "../src/invite-id";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200;
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let n = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (i.toString(16).padStart(4, "0")).repeat(8);

/** A game the way the console makes it: the guest asks for the ID (join: id) and only people on the list come straight in (whoCanJoin: list). */
async function game(id: string) {
  const r = await j(await call("POST", "/api/start", { email: `o${++n}@acme.com` }, { "cf-connecting-ip": `10.0.0.${n}` }));
  const h = { "x-organizer": r.token as string };
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100, whoCanJoin: "list", join: "id" }, h)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h)).status).toBe(200);
  raw.run("UPDATE engagement SET pack=100 WHERE id=?", [id]);
  return h;
}
const list = (h: Record<string, string>, id: string, ids: unknown[]) => call("POST", `/api/z/${id}/people`, { ids }, h);
const joinWith = (id: string, body: Record<string, unknown>, now = T) => call("POST", `/api/z/${id}/join`, { device: dev(1), name: "Maya", ...body }, {}, now);
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env; n = 0; });

describe("R76: one ID, in one form, everywhere", () => {
  test("A-1101, A 1101, a/1101 and A.1101 are the same ID; it is cleaned the same way at upload, at join and at matching", async () => {
    for (const x of ["A-1101", "A 1101", "a/1101", "A.1101"]) expect(normalizeId(x)).toBe("A1101");
    expect(await idHashOf(env, "A1101")).toBe(await idHashOf(env, normalizeId("a-1101")));
    expect(cleanInviteId("   ").ok).toBe(false); expect(cleanInviteId("A".repeat(41)).ok).toBe(false);
    const h = await game("ID-1"); await list(h, "ID-1", ["A 1101"]);
    const r = await joinWith("ID-1", { id: "a-1101" }); expect(r.status).toBe(200); // typed with a dash and a small letter: found on the list
    expect(raw.query("SELECT status FROM person").get()).toEqual({ status: "joined" });
    expect(raw.query("SELECT COUNT(*) c FROM waiting").get()).toEqual({ c: 0 });
  });
  test("what is stored is the ID and the nickname, sealed: no mobile number, no name", async () => {
    const h = await game("ID-2"); await list(h, "ID-2", ["EMP-77"]);
    await joinWith("ID-2", { id: "emp 77", name: "Maya" });
    const who = await openPii(env as any, (raw.query("SELECT pii FROM participant").get() as any).pii);
    expect(who).toEqual({ phone: "", name: "Maya", id: "EMP77" });
    expect(JSON.stringify([raw.query("SELECT * FROM person").all(), raw.query("SELECT * FROM participant").all(), raw.query("SELECT * FROM seat").all()])).not.toContain("EMP77"); // sealed at rest
  });
});

describe("R77: on the list = in; not on the list = the organizer decides", () => {
  test("an ID that is not on the list waits (it takes no place), the organizer sees the ID and the nickname, and the answer is final", async () => {
    const h = await game("ID-3"); await list(h, "ID-3", ["A1101"]);
    const w = await joinWith("ID-3", { id: "Z-9999", name: "Zed" }); expect(w.status).toBe(403); const wb = await j(w); expect(wb.waiting).toBe(true);
    expect(raw.query("SELECT COUNT(*) c FROM participant").get()).toEqual({ c: 0 });
    const asked = (await j(await call("GET", "/api/z/ID-3/waiting", undefined, h))).waiting;
    expect(asked).toHaveLength(1); expect(asked[0]).toMatchObject({ listId: "Z9999", nickname: "Zed" });
    expect((await call("POST", `/api/z/ID-3/waiting/${asked[0].id}`, { decision: "decline" }, h)).status).toBe(200);
    expect((await joinWith("ID-3", { id: "z 9999", name: "Zed" })).status).toBe(403); // declined stays declined, in any spelling
  });
  test("approving lets the same person in the next time they open the link", async () => {
    const h = await game("ID-4");
    const w = await j(await joinWith("ID-4", { id: "V-20", name: "Vik" }));
    const asked = (await j(await call("GET", "/api/z/ID-4/waiting", undefined, h))).waiting;
    expect((await call("POST", `/api/z/ID-4/waiting/${asked[0].id}`, { decision: "admit" }, h)).status).toBe(200);
    expect((await joinWith("ID-4", { id: "V20", name: "Vik" })).status).toBe(200);
    expect(w.wid).toBe(asked[0].id);
  });
});

describe("R78: the join form has ONE ID field", () => {
  test("the game tells the page to ask for the ID", async () => {
    await game("ID-5");
    const info = await j(await call("GET", "/api/z/ID-5/info"));
    expect(info.joinId).toBe(true); expect(info.joinPhone).toBeUndefined();
  });
  test("an ID and a nickname are both needed; a mobile number sent by an old page is not an ID", async () => {
    const h = await game("ID-6"); await list(h, "ID-6", ["A1"]);
    const noId = await joinWith("ID-6", {}); expect(noId.status).toBe(400); expect((await j(noId)).code).toBe("need-id");
    const noNick = await joinWith("ID-6", { id: "A1", name: "" }); expect(noNick.status).toBe(400); expect((await j(noNick)).code).toBe("need-nickname");
    const old = await joinWith("ID-6", { phone: "9876543210" }); expect(old.status).toBe(400); expect((await j(old)).error).toMatch(/type your ID/i);
    const bad = await joinWith("ID-6", { id: "---" }); expect(bad.status).toBe(400); expect((await j(bad)).code).toBe("bad-id");
    expect(raw.query("SELECT COUNT(*) c FROM participant").get()).toEqual({ c: 0 });
  });
});

describe("R79: no names or mobile numbers on the list, at all", () => {
  test("an entry that carries a name or a number is refused and nothing of it is kept", async () => {
    const h = await game("ID-7");
    const r = await j(await call("POST", "/api/z/ID-7/people", { people: [{ id: "A1", name: "Asha" }, { id: "A2", phone: "9876543210" }, { id: "A3", email: "a@b.com" }, { id: "A4" }] }, h));
    expect(r.added).toBe(1); expect(r.invalid).toHaveLength(3);
    expect(r.invalid.every((x: any) => /just an ID/i.test(x.why))).toBe(true);
    expect((await call("POST", "/api/z/ID-7/roster", { people: [{ id: "R1", name: "Rani" }, { id: "R2" }] }, h)).status).toBe(200);
    expect(raw.query("SELECT COUNT(*) c FROM participant").get()).toEqual({ c: 1 }); // only R2
  });
  test("the list a Host or the Organizer downloads has IDs, links and states: no name, no mobile, no WhatsApp column", async () => {
    const h = await game("ID-8"); await list(h, "ID-8", ["A1", "B2"]);
    const csv = await (await call("GET", "/api/z/ID-8/people/export", undefined, h)).text();
    expect(csv.split("\r\n")[0]).toBe("ID,Personal link,Status"); expect(csv).not.toMatch(/Name|Mobile|WhatsApp|wa\.me/);
  });
});

describe("R80: IDs are deleted with everything else, within 24 hours after the game", () => {
  test("23 hours after the end no ID is left: not on the list, not waiting, not on a seat", async () => {
    const h = await game("ID-9"); await list(h, "ID-9", ["A1101"]); await joinWith("ID-9", { id: "A1101" }); await joinWith("ID-9", { id: "Q77", name: "Quin", }, T + 1000);
    expect((raw.query("SELECT COUNT(*) c FROM person").get() as any).c).toBeGreaterThan(0);
    const end = (START - 1) * 3 * 1000 + GEN * 1000 + 6 * 3_600_000; // well after the start
    await lifecycleTick(env as any, end + 24 * 3_600_000 + 60_000);
    for (const t of ["person", "waiting", "participant", "seat"]) expect((raw.query(`SELECT COUNT(*) c FROM ${t}`).get() as any).c).toBe(0);
  });
});
