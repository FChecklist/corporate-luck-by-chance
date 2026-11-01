// The page side of the free demo game and of the owner-only Rs 1 payment test: the real pages in a DOM against the real Worker.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newWorld, openPage, type Page } from "./harness";

setDefaultTimeout(30_000);
const PUB = join(import.meta.dir, "../public");
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; });
const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const scriptsOf = (html: string): string[] => [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!.split("?")[0]!.replace(/^\//, "")).filter((f) => !/^https?:/.test(f) && f.endsWith(".js") && f !== "funnel.js");
const load = async (w: ReturnType<typeof newWorld>, file: string) => { const p = await openPage(w.world, { url: "http://localhost/" + file, html: file, scripts: scriptsOf(readFileSync(join(PUB, file), "utf8")) }); open.push(p); await wait(); return p; };
const src = (f: string) => readFileSync(join(PUB, f), "utf8");

describe("Try a free demo on the home page", () => {
  test("hidden while DEMO_GAME is off", async () => {
    const p = await load(newWorld({ DATA_KEY: "k" }), "index.html");
    expect(p.$("#demoRow").hidden).toBe(true);
  });
  test("shown while DEMO_GAME is on, and says it is a demo for up to 10 players with no payment", async () => {
    const p = await load(newWorld({ DATA_KEY: "k", DEMO_GAME: "on" }), "index.html");
    expect(p.$("#demoRow").hidden).toBe(false);
    expect(p.$("#demoRow").textContent).toMatch(/Try a free demo/); expect(p.$("#demoRow").textContent).toMatch(/Demo: up to 10 players, no payment/);
  });
});
describe("Demo label on every screen", () => {
  test("the organizer's console bar and the player's header both show Demo when the server says the game is a demo", () => {
    expect(src("zc.js")).toMatch(/S\.info && S\.info\.demo \? `<span class="zc-pill zc-pill-demo" id="demopill"[^`]*>Demo<\/span>`/);
    expect(src("luck.js")).toMatch(/INFO && INFO\.demo \? `<span class="zdemo">Demo<\/span>`/);
    expect(src("zc.css")).toContain(".zc-pill-demo{"); expect(src("z.css")).toContain(".zdemo{");
  });
});
describe("Rs 1 payment test page", () => {
  test("asks for the owner key (a password box kept in memory) and sends it as the platform key, never in the address", async () => {
    const p = await load(newWorld({ DATA_KEY: "k" }), "paytest.html");
    const k = p.$("#okey"); expect(k.type).toBe("password"); expect(k.getAttribute("autocomplete")).toBe("off");
    const js = src("paytest.js"); expect(js).toContain("{ key: (S.key || \"\").trim() }"); expect(js).not.toMatch(/localStorage|sessionStorage|\?key=/);
    expect(src("common.js")).toContain('headers["x-organizer"] = opt.key');
  });
});
