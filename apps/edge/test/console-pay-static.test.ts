// What the console's Pay step needs from the game that is not a request/response: the vendored copies are untouched, the page's security rules (CSP) allow exactly the
// payment window and the console, the descriptor matches the config, and no price or own payment/sign-in/chat appears in the new code.
// (docs/GAME_PAY_CONTRACT.md in the console repo, sections 1, 3, 5, 6.)
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const cfg = JSON.parse(read("config/console-pay.json"));
const build = read("pages/build.mjs");

// ---- 1. the vendored bridge, test kit and game pack are byte for byte what the console wrote (hashes ignore Windows/Unix line ends only)
const hash = (t: string) => createHash("sha256").update(t.replace(/\r\n/g, "\n")).digest("hex");
for (const dir of ["apps/edge/src/console-bridge", "apps/edge/test/console-contract", "apps/web/public/pack"]) {
  test(`${dir}: every file matches its MANIFEST.json and nothing else is in the folder`, () => {
    const files = JSON.parse(read(dir + "/MANIFEST.json")).files as Record<string, string>;
    expect(Object.keys(files).length).toBeGreaterThan(3);
    for (const [f, h] of Object.entries(files)) expect([f, hash(read(dir + "/" + f))]).toEqual([f, h]);
    expect(readdirSync(join(ROOT, dir)).filter((f) => f !== "MANIFEST.json").sort()).toEqual(Object.keys(files).sort());
  });
}
test("the vendored files carry the Pay step: the bridge has payInfo/markPaid/legacyPayRedirect, the pack has the step 6 Pay screen", () => {
  const b = read("apps/edge/src/console-bridge/bridge.ts"), z = read("apps/web/public/pack/zc-flow.js");
  for (const w of ["payInfo?(", "markPaid?(", "export function legacyPayRedirect", "/api/console/payable", "/api/console/paid"]) expect(b).toContain(w);
  for (const w of ["payGame", "consoleOrigin", "id: \"pay\""]) expect(z).toContain(w);
});

// ---- 5. the page's security rules: evaluate the real definitions in pages/build.mjs
const csp = (() => {
  const line = (n: string) => build.split(/\r?\n/).find((l) => l.startsWith(`const ${n} = `)) ?? "";
  const code = ["CSP", "PLAINCSP", "GOOGLECSP", "PAYCFG", "ZCCSP", "GAMECSP", "PAYCSP"].map(line).join("\n").replace('join(import.meta.dir, "../config/console-pay.json")', JSON.stringify(join(ROOT, "config/console-pay.json")));
  return new Function("readFileSync", "join", code + "\nreturn { CSP, PLAINCSP, GOOGLECSP, ZCCSP, GAMECSP, PAYCSP };")(readFileSync, join) as Record<"CSP" | "PLAINCSP" | "GOOGLECSP" | "ZCCSP" | "GAMECSP" | "PAYCSP", string>;
})();
const directive = (c: string, name: string) => (c.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " ")) ?? "").split(/\s+/).slice(1);
const origins = (c: string) => new Set(c.match(/https?:\/\/[^\s;]+/g) ?? []);

test("the organizer page (zc): frame-src allows the payment window's address from config, connect-src allows the console; google sign-in rules stay", () => {
  expect(cfg.payframeOrigins.length).toBeGreaterThan(0); expect(cfg.consoleOrigin).toBe("https://console.corporatetambola.com");
  for (const o of cfg.payframeOrigins) expect(directive(csp.ZCCSP, "frame-src")).toContain(o);
  expect(directive(csp.ZCCSP, "frame-src")).toContain("https://accounts.google.com/gsi/");
  expect(directive(csp.ZCCSP, "connect-src")).toContain(cfg.consoleOrigin);
  expect(directive(csp.ZCCSP, "script-src")).toContain("https://accounts.google.com/gsi/client");
});
test("no wildcard, and no other new address: the organizer page differs from the Google rules by exactly the console and the payment window", () => {
  expect(csp.ZCCSP).not.toMatch(/\*|https:\s*[;]|\bhttps:(?=\s|$)/);
  for (const d of ["frame-src", "connect-src"]) for (const o of directive(csp.ZCCSP, d)) expect(o).not.toContain("*");
  const added = [...origins(csp.ZCCSP)].filter((o) => !origins(csp.GOOGLECSP).has(o)).sort();
  expect(added).toEqual([cfg.consoleOrigin, ...cfg.payframeOrigins].sort());
  // every other directive is the same as before
  for (const d of ["default-src", "script-src", "style-src", "img-src", "font-src", "frame-ancestors", "base-uri", "form-action"]) expect(directive(csp.ZCCSP, d)).toEqual(directive(csp.GOOGLECSP, d));
});
test("only the organizer page (zc) gets it: the console address is in no other page's rules", () => {
  for (const n of ["CSP", "PLAINCSP", "GOOGLECSP", "GAMECSP", "PAYCSP"] as const) expect([n, csp[n].includes(cfg.consoleOrigin)]).toEqual([n, false]);
  expect(build).toContain('["/zc", ZCCSP, true]'); expect(build).not.toMatch(/\["\/(?!zc")[a-z-]+", ZCCSP/);
});
test("the payment window address is the one the console lists (read from the console repo when it is next to this one)", () => {
  const p = process.env.CONSOLE_GAMES_JSON ?? "C:/ct/test-sites/console/.claude/worktrees/master-console-complete-882589/config/games.json";
  if (!existsSync(p)) return; // not available here (CI): the config file above is the record
  const g = JSON.parse(readFileSync(p, "utf8"));
  expect([...cfg.payframeOrigins].sort()).toEqual([...g.payframeOrigins.live].sort());
  expect(cfg.consoleOrigin).toBe(g.consoleOrigin.live);
  expect(g.games.find((x: any) => x.id === cfg.payGame)?.live).toBe("https://luck.corporatetambola.com");
});

// ---- 3. the descriptor
test("the descriptor (zc-pay-game.js) says payGame and consoleOrigin, the same as config, adds to what a page already set, and carries nothing else", () => {
  const src = read("apps/web/public/zc-pay-game.js"), win: any = { ZFLOW_GAME: { brand: "Corporate Luck by Chance" } };
  new Function("window", src)(win);
  expect(win.ZFLOW_GAME).toEqual({ brand: "Corporate Luck by Chance", payGame: cfg.payGame, consoleOrigin: cfg.consoleOrigin });
  const bare: any = {}; new Function("window", src)(bare);
  expect(bare.ZFLOW_GAME).toEqual({ payGame: cfg.payGame, consoleOrigin: cfg.consoleOrigin });
  expect(cfg.payGame).toBe("luckbychance");
});

// ---- 6. must not exist in the new code: a price, its own sign-in, payment page or chat
test("the new game-side code holds no price and starts no sign-in, payment page or chat", () => {
  for (const f of ["apps/edge/src/console-pay.ts", "apps/web/public/zc-pay-game.js"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join("\n"); // comments are not code
    expect([f, /pricing|\bprice\(|PACKS|\bINR\b|\bUSD\b|rupee|₹|\bRs\b|amount/i.test(code)]).toEqual([f, false]);
    expect([f, /razorpay|signin|sign-in|chat|login|fetch\(/i.test(code)]).toEqual([f, false]);
  }
});
test("the config file holds only the four things it is for (no number of any kind)", () => {
  expect(Object.keys(cfg).sort()).toEqual(["_about", "consoleOrigin", "payGame", "payframeOrigins"]);
  expect(JSON.stringify({ ...cfg, _about: "" })).not.toMatch(/d{3,}|[0-9]+.[0-9]+(?!.)/);
});
test("the unlock is one write, the last one of markPaid, and it is only while the game is unpaid and open", () => {
  const src = read("apps/edge/src/console-pay.ts"), at = src.indexOf("UPDATE engagement SET pack=");
  expect(at).toBeGreaterThan(0); expect(src.indexOf("UPDATE engagement SET pack=", at + 1)).toBe(-1);
  expect(src.slice(at, at + 220)).toContain("pack=0 AND cancelled_ms IS NULL AND unplayed_ms IS NULL");
  expect(src.indexOf("payref/")).toBeLessThan(at); expect(src.indexOf("pub/")).toBeLessThan(at);
});
