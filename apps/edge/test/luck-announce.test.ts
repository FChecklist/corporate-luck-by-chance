// "Message to everyone": the Organizer (or a Host, or their AI) sends one short message; every phone and the big screen read it with the public game view they already ask for
// (GET /api/z/<id>/luck/view, and /luck/me for a player). It is cleared by an empty message, kept out of a draft, and never carries anything but the text the organizer wrote.
import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200;
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let n = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (i.toString(16).padStart(4, "0")).repeat(8);

async function game(id: string, publish = true) {
  const r = await j(await call("POST", "/api/start", { email: `o${++n}@acme.com` }, { "cf-connecting-ip": `10.0.0.${n}` }));
  const h = { "x-organizer": r.token as string };
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100 }, h)).status).toBe(200);
  if (publish) {
    expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h)).status).toBe(200);
    raw.run("UPDATE engagement SET pack=100 WHERE id=?", [id]);
  }
  return { h };
}
const view = async (id: string) => j(await call("GET", `/api/z/${id}/luck/view`));
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env; n = 0; });

describe("message to everyone reaches the public game view", () => {
  test("no message: the view says ann is null; a sent message appears in the view for everyone, with an id and the text only", async () => {
    const { h } = await game("ANN-1");
    expect((await view("ANN-1")).ann).toBeNull();
    const sent = await call("POST", "/api/z/ANN-1/announce", { text: "Dinner is served" }, h);
    expect(sent.status).toBe(200); const sb = await j(sent); expect(sb.ok).toBe(true); expect(sb.reachesPhonesWithin).toBe("a few seconds");
    const v = await view("ANN-1");
    expect(v.ann.text).toBe("Dinner is served"); expect(typeof v.ann.id).toBe("string"); expect(Object.keys(v.ann).sort()).toEqual(["id", "text"]);
  });

  test("a player's own view (/luck/me) carries it too", async () => {
    const { h } = await game("ANN-2");
    const joined = await j(await call("POST", "/api/z/ANN-2/join", { name: "Nick 1", device: dev(1) })); expect(joined.pid).toBeTruthy();
    await call("POST", "/api/z/ANN-2/announce", { text: "Please take your seats" }, h);
    const me = await j(await call("GET", `/api/z/ANN-2/luck/me?pid=${joined.pid}&device=${dev(1)}`));
    expect(me.ann.text).toBe("Please take your seats"); expect(me.phase).toBe("waiting");
  });

  test("a new message gets a new id; an empty message clears it; a message too long is refused, not cut", async () => {
    const { h } = await game("ANN-3");
    await call("POST", "/api/z/ANN-3/announce", { text: "First" }, h); const a = (await view("ANN-3")).ann;
    await call("POST", "/api/z/ANN-3/announce", { text: "Second" }, h, T + 6_000); // the server asks for a few seconds between messages
    const b = (await view("ANN-3")).ann; expect(b.text).toBe("Second"); expect(b.id).not.toBe(a.id);
    const clr = await call("POST", "/api/z/ANN-3/announce", { text: "" }, h, T + 12_000); expect((await j(clr)).cleared).toBe(true);
    expect((await view("ANN-3")).ann).toBeNull();
    const long = await call("POST", "/api/z/ANN-3/announce", { text: "x".repeat(161) }, h, T + 18_000); expect(long.status).toBe(400); expect((await j(long)).code).toBe("too-long");
  });

  test("markup in a message is stripped; a stranger cannot send one; a draft cannot send one", async () => {
    const { h } = await game("ANN-4");
    await call("POST", "/api/z/ANN-4/announce", { text: "<b>Hi</b> `all`" }, h);
    expect((await view("ANN-4")).ann.text).toBe("bHi/b all");
    expect((await call("POST", "/api/z/ANN-4/announce", { text: "hello" })).status).toBeGreaterThanOrEqual(401);
    const d = await game("ANN-D", false);
    const r = await call("POST", "/api/z/ANN-D/announce", { text: "hi" }, d.h); expect(r.status).toBe(400); expect((await j(r)).error).toMatch(/Publish the game first/);
  });
});
