// Nickname at join: a good one is shown, a bad one is refused, a blank one keeps the default, markup is removed.
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
const dev = (i: number) => (i.toString(16).padStart(4, "0")).repeat(8); // 32 hex characters
async function game(id: string) {
  const r = await j(await call("POST", "/api/start", { email: `o${++n}@acme.com` }, { "cf-connecting-ip": `10.0.0.${n}` }));
  const h = { "x-organizer": r.token as string };
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100 }, h)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h)).status).toBe(200);
  raw.run("UPDATE engagement SET pack=100 WHERE id=?", [id]);
  return h;
}
const join = (id: string, i: number, name?: unknown) => call("POST", `/api/z/${id}/join`, { name, device: dev(i) });
/** Joins the given names, starts the game, and returns the public list of names by seat. */
async function namesAfter(id: string, names: unknown[]) {
  const h = await game(id);
  for (let i = 0; i < names.length; i++) { const r = await join(id, i + 1, names[i]); expect(r.status).toBe(200); }
  expect((await call("POST", `/api/z/${id}/luck/start`, {}, h)).status).toBe(200);
  return ((await j(await call("GET", `/api/z/${id}/luck/seats`))).seats as [number, string][]).map((x) => x[1]);
}
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env; n = 0; });

describe("nickname at join", () => {
  test("a valid nickname is what the board shows", async () => {
    expect(await namesAfter("NK-1", ["Sam Lee 7", "Priya"])).toEqual(["Sam Lee 7", "Priya"]);
  });
  test("an invalid nickname is refused with a plain message", async () => {
    await game("NK-2");
    for (const [i, bad] of ["A", "x".repeat(21), "Sam!!", "<b></b>", "<i>a</i>"].entries()) {
      const r = await join("NK-2", i + 1, bad); expect([bad, r.status]).toEqual([bad, 400]);
      expect((await j(r)).error).toBe("Please use 2 to 20 letters, numbers or spaces for your nickname.");
    }
  });
  test("a blank nickname keeps today's behaviour", async () => {
    const h = await game("NK-3");
    expect((await call("POST", "/api/z/NK-3/join", { name: "  ", phone: "98765 11111", device: dev(1) })).status).toBe(200);
    expect((await call("POST", "/api/z/NK-3/join", { phone: "98765 22222", device: dev(2) })).status).toBe(200);
    expect((await call("POST", "/api/z/NK-3/luck/start", {}, h)).status).toBe(200);
    expect(((await j(await call("GET", "/api/z/NK-3/luck/seats"))).seats as [number, string][]).map((x) => x[1])).toEqual(["Player", "Player"]);
    expect((await join("NK-3", 9, "")).status).toBe(400); // name-only join still needs a name, as before
  });
  test("markup is removed from the nickname", async () => {
    expect(await namesAfter("NK-4", ["<b>Sam</b>", "<script>x</script>Ann"])).toEqual(["Sam", "xAnn"]);
  });
});
