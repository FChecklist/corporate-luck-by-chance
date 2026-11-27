// Version 1.5.5: the fixes for the audit of 1.5.4 (PR 14). Rules R92 to R95 in docs/RULES.md.
// Each test below FAILS when its fix is taken out (checked with a throwaway change, listed in docs/KNOWLEDGE.md).
import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(60_000);
import { readFileSync, readdirSync } from "node:fs";
import { type Env, guessNet } from "../src/worker";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200;
let env: Env; let n = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (i.toString(16).padStart(4, "0")).repeat(8);
const read = (p: string) => readFileSync(new URL("../../../" + p, import.meta.url), "utf8");

async function game(id: string, over: Record<string, unknown> = {}) {
  const r = await j(await call("POST", "/api/start", { email: `o${++n}@example.com` }, { "cf-connecting-ip": `10.0.0.${n}` }));
  const h = { "x-organizer": r.token as string };
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100, whoCanJoin: "list", join: "id", ...over }, h)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@example.com", phone: "98765 43210" }, h)).status).toBe(200);
  return h;
}
const list = (h: Record<string, string>, id: string, ids: unknown[]) => call("POST", `/api/z/${id}/people`, { ids }, h);
const joinWith = (id: string, body: Record<string, unknown>, ip: string, now = T) => call("POST", `/api/z/${id}/join`, { device: dev(1), name: "Maya", ...body }, { "cf-connecting-ip": ip }, now);
beforeEach(() => { const d = makeD1(); env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k" } as Env; n = 0; });

describe("R92: the guess limit counts an IPv6 address by its /64, an IPv4 address as it is", () => {
  test("guessNet: same /64 gives the same key (short or long spelling), another /64 or an IPv4 address gives another, IPv4-mapped is the IPv4 address", () => {
    expect(guessNet("203.0.113.7")).toBe("203.0.113.7"); expect(guessNet("203.0.113.8")).toBe("203.0.113.8");
    expect(guessNet("2001:db8:abcd:12::1")).toBe(guessNet("2001:db8:abcd:12:ffff:ffff:ffff:ffff"));
    expect(guessNet("2001:db8:abcd:12::1")).toBe(guessNet("2001:0DB8:abcd:0012:0:0:0:99"));
    expect(guessNet("2001:db8:abcd:12::1")).not.toBe(guessNet("2001:db8:abcd:13::1"));
    expect(guessNet("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(guessNet("2001:db8::")).toBe("2001:0db8:0000:0000::/64");
    expect(guessNet(null)).toBe("local"); expect(guessNet("not-an-ip:zz")).toBe("not-an-ip:zz");
  });
  test("100 wrong tries from 100 different addresses in one /64 hit the limit (audit M1): 15 normal answers, the rest 429", async () => {
    const h = await game("R92-1", { cap: 400 }); await list(h, "R92-1", Array.from({ length: 50 }, (_, i) => "E-" + (1000 + i)));
    const codes: number[] = [];
    for (let i = 0; i < 100; i++) codes.push((await joinWith("R92-1", { id: "Z-" + (5000 + i), device: dev(100 + i) }, `2001:db8:abcd:12::${(i + 1).toString(16)}`)).status);
    expect(codes.filter((c) => c === 403)).toHaveLength(15); expect(codes.filter((c) => c === 429)).toHaveLength(85);
    expect(codes.indexOf(429)).toBe(15);
  });
  test("the same 100 tries from 100 different /64s are separate networks (each is under its own limit), and a listed ID from the blocked /64 still joins", async () => {
    const h = await game("R92-2", { cap: 400 }); await list(h, "R92-2", ["E-1000"]);
    for (let i = 0; i < 20; i++) expect((await joinWith("R92-2", { id: "Z-" + (6000 + i), device: dev(100 + i) }, `2001:db8:${i.toString(16)}::1`)).status).toBe(403);
    for (let i = 0; i < 20; i++) await joinWith("R92-2", { id: "Y-" + (6000 + i), device: dev(200 + i) }, `2001:db8:ffff:1::${(i + 1).toString(16)}`);
    expect((await joinWith("R92-2", { id: "Z-9999", device: dev(300) }, "2001:db8:ffff:1::abc")).status).toBe(429);
    expect((await joinWith("R92-2", { id: "E-1000", device: dev(301) }, "2001:db8:ffff:1::abd")).status).toBe(200); // a right ID is never stopped
  });
  test("IPv4 still counts per address: another IPv4 address is not affected", async () => {
    const h = await game("R92-3"); await list(h, "R92-3", ["E-1000"]);
    for (let i = 0; i < 16; i++) await joinWith("R92-3", { id: "Z-" + (7000 + i), device: dev(100 + i) }, "198.51.100.1");
    expect((await joinWith("R92-3", { id: "Z-7100", device: dev(150) }, "198.51.100.1")).status).toBe(429);
    expect((await joinWith("R92-3", { id: "Z-7101", device: dev(151) }, "198.51.100.2")).status).toBe(403);
  });
});

describe("R93: the help text and the docs say plainly that an ID is matched, not proven (audit H1, owner decision)", () => {
  const SAYS_IMPOSSIBLE = /nobody can guess|no one can guess|cannot be guessed|impossible to guess|guess their way/i;
  test("no public page, script or site page says that guessing is impossible", () => {
    const pub = (d: string) => readdirSync(new URL("../../../" + d, import.meta.url)).filter((f) => /\.(js|html|txt)$/.test(f)).map((f) => [d + "/" + f, read(d + "/" + f)] as const);
    for (const [f, s] of [...pub("apps/web/public"), ...pub("site")]) expect([f, SAYS_IMPOSSIBLE.test(s)]).toEqual([f, false]);
  });
  test("the wait message help says: matched against the list, not proven, the organizer can see who joined and remove a seat", () => {
    const g = read("apps/web/public/guide.js"); const line = g.split("\n").find((l) => l.includes("Too many tries with an ID"))!; expect(line).toBeTruthy();
    expect(line).toMatch(/matched against the organizer's list/); expect(line).toMatch(/not proven/); expect(line).toMatch(/see who joined and remove a seat/);
    expect(read("apps/web/public/zc.js")).toMatch(/press Remove on that ID/);
  });
  test("docs/KNOWLEDGE.md and CHANGELOG.md have the section 'Known limit, owner decision' and quote the SUITE_RULES line", () => {
    const rule = read("docs/SUITE_RULES.md").split("\n").find((l) => l.includes("An ID is matched, not proven."))!.replace(/\*\*/g, ""); expect(rule).toBeTruthy();
    const quote = "An ID is matched, not proven. Anyone who has the game link and knows (or guesses) a listed ID can type it and take that seat.";
    expect(rule).toContain(quote);
    for (const f of ["docs/KNOWLEDGE.md", "CHANGELOG.md"]) { const s = read(f); expect([f, s.includes("Known limit, owner decision")]).toEqual([f, true]); expect([f, s.includes(quote)]).toEqual([f, true]); expect([f, /docs\/SUITE_RULES\.md/.test(s)]).toEqual([f, true]); }
  });
});

describe("R94: the organizer can see who joined, remove a seat and let the right person in (the way out of a taken seat)", () => {
  test("a stranger takes a listed ID; the organizer sees it as joined, removes it, adds the ID again, and the real person joins", async () => {
    const h = await game("R94-1"); await list(h, "R94-1", ["E-1000", "E-1001"]);
    expect((await joinWith("R94-1", { id: "E-1000", name: "Stranger", device: dev(9) }, "198.51.100.9")).status).toBe(200);
    expect((await joinWith("R94-1", { id: "E-1000", name: "Real", device: dev(1) }, "198.51.100.10")).status).toBe(423); // the real person is told the ID is on another phone
    const seen = (await j(await call("GET", "/api/z/R94-1/people", undefined, h))).people.find((p: any) => p.listId === "E1000");
    expect(seen).toMatchObject({ status: "joined" }); // the organizer can see who joined
    const rm = await j(await call("POST", `/api/z/R94-1/people/${seen.id}/remove`, {}, h)); expect(rm).toMatchObject({ ok: true, removed: 1 });
    expect((await j(await call("GET", "/api/z/R94-1/people", undefined, h))).people.find((p: any) => p.listId === "E1000").status).toBe("removed");
    expect((await joinWith("R94-1", { id: "E-1000", name: "Real", device: dev(1) }, "198.51.100.10")).status).toBe(403); // a removed ID is refused until it is added again
    expect((await list(h, "R94-1", ["E-1000"])).status).toBe(200); // the organizer adds the ID again
    const real = await joinWith("R94-1", { id: "E-1000", name: "Real", device: dev(1) }, "198.51.100.10"); expect(real.status).toBe(200);
    expect((await joinWith("R94-1", { id: "E-1000", name: "Stranger", device: dev(9) }, "198.51.100.9")).status).toBe(423); // the stranger's phone cannot take the seat back: it is bound to the real person's phone now
    expect((await joinWith("R94-1", { id: "E-1000", name: "Real", device: dev(1) }, "198.51.100.10")).status).toBe(200); // the real person's phone still opens its own seat
  });
  test("the console shows a Remove button for a joined ID and its help says what Remove does (before and after the start)", () => {
    const z = read("apps/web/public/zc.js"); expect(z).toMatch(/data-rmask=/); expect(z).toMatch(/Before the game starts, add the ID again and the right person can join\. After the game starts, Remove stops that phone for good\./);
  });
});

describe("R95: the version and the What's new link are on every public page (audit L4)", () => {
  test("every public page that has no full footer carries the version line, and it matches version.json", () => {
    const v = JSON.parse(read("version.json")).version;
    for (const f of ["trust", "brochure", "partner", "demo", "signin", "pay", "paylink", "helpdesk", "helpdesk-accept", "helpdesk-approve", "404"]) {
      const s = read(`apps/web/public/${f}.html`); expect([f, s.includes(`<p class="ufv"`) && s.includes(`Version ${v} &middot; <a href="/changes.html">`)]).toEqual([f, true]);
    }
  });
});
