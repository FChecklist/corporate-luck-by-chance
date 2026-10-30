// Fix 1.4.1, the page side: the "The system will read this as ..." hint is chosen by the kind of ID only (never for an e-mail typed in an employee-ID box),
// the guide has an entry for each new thing the Worker says (the strings below are taken from the REAL Worker's answers, not typed from the guide),
// the browser mirror idclean.js has real backslashes, and the test harness loads idclean.js before zc.js.
// Deliberate-break checks for these rules: apps/edge/test/break-checks-v3.sh.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { type Page, newWorld, openPage, roundAt, T } from "./harness";
import TEXT from "../../edge/src/consent-text.json";
import { EMP_CLEAN_FROM_MS } from "../../edge/src/idclean";
import { PRIZE_HOUSES } from "../../../packages/beacon/src/config";

setDefaultTimeout(60_000);
const PUB = join(import.meta.dir, "../public");
const pub = (f: string) => readFileSync(join(PUB, f), "utf8");
const K4: Record<string, string> = (TEXT as any).K4;
const START = roundAt(T) + 1200;
const READ_AS = "The system will read this as ";
const PLAIN_EMAIL_IN_EMP_BOX = "This looks like an Email ID. This game asks for an employee ID: letters and numbers only.";
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; });

// ---------- idclean.js on its own ----------
const IDC: any = (() => { const g: any = {}; new Function("window", pub("idclean.js"))(g); return g.IDCLEAN; })();
describe("idclean.js (the browser mirror): the regexes have real backslashes", () => {
  test("\\s+ removes white space and not the letter s; [^A-Z0-9] keeps every letter and digit", () => {
    expect(IDC.emailId(" S s@s.com ")).toBe("ss@s.com"); expect(IDC.emailId("sassy@s.com")).toBe("sassy@s.com");
    expect(IDC.legacy("s s-1")).toBe("SS-1"); expect(IDC.empId("sSs-1 2")).toBe("SSS12"); expect(IDC.empId("0123456789abcxyz")).toBe("0123456789ABCXYZ");
    expect(IDC.emailHint("S S@s.com")).toBe(READ_AS + "ss@s.com");
  });
  test("hint text: Email ID game always reads; employee-ID game reads (new or old rule) except when an at sign is typed", () => {
    expect(IDC.emailHint("Rajat1＠Demo.com")).toBe(READ_AS + "rajat1@demo.com"); expect(IDC.emailHint("1B-678")).toBe(READ_AS + "1b-678"); expect(IDC.emailHint("")).toBe(""); expect(IDC.emailHint("   ")).toBe("");
    expect(IDC.empHint("1b-678", true)).toBe(READ_AS + "1B678"); expect(IDC.empHint("1b-678", false)).toBe(READ_AS + "1B-678"); expect(IDC.empHint("1b-678")).toBe(READ_AS + "1B678"); expect(IDC.empHint("", true)).toBe(""); expect(IDC.empHint("---", true)).toBe("");
    for (const v of ["rajat@demo.com", "RAJAT＠DEMO.COM", "a@b", "1B@678", " @ "]) for (const nr of [true, false, undefined]) { const h = IDC.empHint(v, nr); expect([v, nr, h]).toEqual([v, nr, PLAIN_EMAIL_IN_EMP_BOX]); expect(h).not.toContain("read this as"); }
  });
});

// ---------- the player page (luck.js) ----------
async function playerPage(info: Record<string, unknown>) {
  const w: any = new Window({ url: "https://luck.corporatetambola.com/z.html?e=GAME-1", width: 390, height: 780 });
  w.crypto = globalThis.crypto;
  w.fetch = async (url: string) => { const u = String(url); const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.includes("/api/consent/text")) return ok({ version: (TEXT as any).version, kind: "K4", boxes: Object.entries(K4).map(([id, text]) => ({ id, text })) });
    if (u.endsWith("/info")) return ok(info); if (u.includes("/luck/me")) return ok({ phase: "waiting", state: "open", joined: 1, serverNow: Date.now(), commit: "ab".repeat(32), ann: null }); return ok({}, 404); };
  w.document.body.innerHTML = '<main id="app"></main>';
  new Function("globalThis", pub("luck-engine.js"))(w);
  for (const f of ["idclean.js", "termsbox.js", "luck-dice.js", "luck-run.js", "luck.js"]) new Function("window", "document", "location", "localStorage", "fetch", "history", "navigator", "IDCLEAN", "setTimeout", "clearTimeout", "setInterval", "clearInterval", pub(f))(w, w.document, w.location, w.localStorage, w.fetch, w.history, w.navigator, w.IDCLEAN, // a real page reaches IDCLEAN as a global; here it is handed in
     (fn: any, ms?: number) => setTimeout(fn, ms), clearTimeout, (fn: any, ms?: number) => setInterval(fn, ms), clearInterval);
  for (let i = 0; i < 100 && !w.document.getElementById("emp"); i++) await new Promise((r) => setTimeout(r, 20));
  const emp = w.document.getElementById("emp");
  const type = async (v: string) => { emp.value = v; emp.dispatchEvent(new w.Event("input")); await new Promise((r) => setTimeout(r, 5)); return String(w.document.getElementById("emphint").textContent); };
  return { w, emp, type };
}
describe("the player page hint (luck.js:45) follows the kind of ID", () => {
  test("Email ID game: the box is an e-mail box and the hint reads the address (full-width at sign, capitals, spaces)", async () => {
    const { emp, type, w } = await playerPage({ verify: "id", idKind: "email" });
    expect(emp.getAttribute("type")).toBe("email"); expect(await type("  Rajat1＠Demo.COM ")).toBe(READ_AS + "rajat1@demo.com"); expect(await type("Raj at1@demo.com")).toBe(READ_AS + "rajat1@demo.com"); expect(await type("")).toBe("");
    w.close();
  });
  test("employee-ID game, NEW rule (empClean): reads 1B-678 as 1B678; an e-mail typed gets the plain line and never a read-as text", async () => {
    const { type, w } = await playerPage({ verify: "id", idKind: "emp", empClean: true });
    expect(await type("1b-678")).toBe(READ_AS + "1B678");
    for (const v of ["rajat1@demo.com", "RAJAT1＠DEMO.COM", "a@b"]) { const h = await type(v); expect([v, h]).toEqual([v, PLAIN_EMAIL_IN_EMP_BOX]); }
    w.close();
  });
  test("employee-ID game, OLD rule (no empClean): reads 1b-678 as 1B-678 (the old rule only upper-cases and drops spaces); an e-mail still gets the plain line", async () => {
    const { type, w } = await playerPage({ verify: "id", idKind: "emp" });
    expect(await type("1b-678")).toBe(READ_AS + "1B-678"); expect(await type("1b 678")).toBe(READ_AS + "1B678");
    expect(await type("rajat1@demo.com")).toBe(PLAIN_EMAIL_IN_EMP_BOX);
    w.close();
  });
  test("the same typed text gives a different hint only because of the kind of ID: 'a@b.com' is read in an Email ID game and refused-in-plain-words in an employee-ID game", async () => {
    const a = await playerPage({ verify: "id", idKind: "email" }); const b = await playerPage({ verify: "id", idKind: "emp", empClean: true });
    const ha = await a.type("a@b.com"), hb = await b.type("a@b.com");
    expect([ha, hb]).toEqual([READ_AS + "a@b.com", PLAIN_EMAIL_IN_EMP_BOX]); a.w.close(); b.w.close();
  });
});

// ---------- the organizer console (zc.js:1511) ----------
async function consoleHint(over: { idKind?: "email"; created?: number }) {
  const w = newWorld(); const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
  await w.api("POST", "/api/z", { id: "UI-HINT", startRound: START, callSeconds: 9, cap: 100 }, s.aiKey);
  await w.api("POST", "/api/z/UI-HINT/publish", { email: "boss@acme.com", phone: "98765 43210" }, s.token);
  expect((await w.api("PATCH", "/api/z/UI-HINT/settings", { verify: "id", employeesOnly: true, ...(over.idKind ? { idKind: over.idKind } : {}) }, s.token)).status).toBe(200);
  if (over.created !== undefined) w.world.raw.prepare("UPDATE engagement SET created_ms=? WHERE id='UI-HINT'").run(over.created);
  const p = await openPage(w.world, { url: "http://localhost/zc?e=UI-HINT", html: "zc.html", scripts: ["zgame.js", "control.js", "termsbox.js", "zc.js"], session: { "cbz-org": s.token, "cbz-aimsg": s.aiMessage, "cbz-email": "boss@acme.com" },
    afterLoad: (win: any, f: string) => { if (f === "zgame.js" && win.ZG && !win.ZG.PRIZE_HOUSES) win.ZG.PRIZE_HOUSES = PRIZE_HOUSES; } });
  open.push(p);
  await p.waitFor((x) => /Last step|Your game/i.test(x)); p.click('.zc-dot[data-open="6"]'); await p.waitFor((x) => /My people/.test(x) && /Paste from Excel/.test(x));
  p.click('[data-mode="type"]'); const g = p.$("#gemp") as any; expect(g).toBeTruthy();
  const type = async (v: string) => { g.value = v; g.dispatchEvent(new p.win.Event("input", { bubbles: true })); return String(p.$("#gemphint")?.textContent ?? ""); };
  return { p, type };
}
describe("the console hint under the ID box of My people (zc.js:1511) follows the kind of ID and the old/new rule", () => {
  test("harness: IDCLEAN is there when zc.js runs (idclean.js is loaded before zc.js)", async () => {
    const { p } = await consoleHint({}); expect(typeof p.win.IDCLEAN?.empHint).toBe("function"); expect(p.errors.filter((e) => /IDCLEAN/.test(e))).toEqual([]);
  });
  test("Email ID game: reads the address", async () => {
    const { type } = await consoleHint({ idKind: "email" });
    expect(await type(" Asha＠Demo.com ")).toBe(READ_AS + "asha@demo.com"); expect(await type("As ha@demo.com")).toBe(READ_AS + "asha@demo.com");
  });
  test("employee-ID game, NEW rule: reads the ID; an e-mail gets the plain line", async () => {
    const { type } = await consoleHint({ created: EMP_CLEAN_FROM_MS });
    expect(await type("e-101")).toBe(READ_AS + "E101"); expect(await type("asha@demo.com")).toBe(PLAIN_EMAIL_IN_EMP_BOX);
  });
  test("employee-ID game, OLD rule (a game made now): reads with the old rule; an e-mail gets the plain line", async () => {
    const { type } = await consoleHint({});
    expect(await type("e-101")).toBe(READ_AS + "E-101"); expect(await type("asha@demo.com")).toBe(PLAIN_EMAIL_IN_EMP_BOX);
  });
});

// ---------- the guide matches what the Worker really sends ----------
describe("guide.js has an entry for each new thing the Worker says (strings taken from the real Worker)", () => {
  async function world() {
    const w = newWorld({ DATA_KEY: "k" });
    const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
    const mk = async (id: string, settings: Record<string, unknown>) => { await w.api("POST", "/api/z", { id, startRound: START, callSeconds: 9, cap: 100 }, s.aiKey); await w.api("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, s.token); const r = await w.api("PATCH", `/api/z/${id}/settings`, settings, s.token); expect(r.status).toBe(200); };
    return { w, s, mk };
  }
  const dev = (i: number) => (String(i).padStart(2, "0") + "d".repeat(32)).slice(0, 32);
  const answer = async (r: Response) => ({ status: r.status, message: String(((await r.json()) as any).error) });

  test("the id-kind lock, 'Enter your employee ID.' / 'Enter your Email ID.', both 'already has a ticket on another phone', 'An Email ID is asked on its own', 'looks like an Email ID' and 'does not look like an email address'", async () => {
    const { w, s, mk } = await world();
    const got: Record<string, { status: number; message: string }> = {};
    await mk("GD-EMP", { verify: "id", employeesOnly: true }); await mk("GD-EML", { verify: "id", idKind: "email", employeesOnly: true });
    await w.api("POST", "/api/z/GD-EMP/people", { people: [{ name: "Asha", empId: "E1" }] }, s.token); await w.api("POST", "/api/z/GD-EML/people", { people: [{ name: "Asha", empId: "asha@acme.com" }] }, s.token);
    got.lock = await answer(await w.api("PATCH", "/api/z/GD-EMP/settings", { verify: "mobile" }, s.token));
    got.needEmp = await answer(await w.api("POST", "/api/z/GD-EMP/join", { name: "Nobody", device: dev(1) }));
    got.needEml = await answer(await w.api("POST", "/api/z/GD-EML/join", { name: "Nobody", device: dev(2) }));
    expect((await w.api("POST", "/api/z/GD-EMP/join", { empId: "E1", name: "Asha", device: dev(3) })).status).toBe(200); got.usedEmp = await answer(await w.api("POST", "/api/z/GD-EMP/join", { empId: "E1", name: "Other", device: dev(4) }));
    expect((await w.api("POST", "/api/z/GD-EML/join", { empId: "asha@acme.com", name: "Asha", device: dev(5) })).status).toBe(200); got.usedEml = await answer(await w.api("POST", "/api/z/GD-EML/join", { empId: "asha@acme.com", name: "Other", device: dev(6) }));
    await mk("GD-NEW", { verify: "mobile" });
    got.alone = await answer(await w.api("PATCH", "/api/z/GD-NEW/settings", { verify: "either", idKind: "email" }, s.token));
    got.looksEmail = await answer(await w.api("POST", "/api/z/GD-EMP/join", { empId: "asha@acme.com", name: "Asha", device: dev(7) }));
    got.badEmail = await answer(await w.api("POST", "/api/z/GD-EML/join", { empId: "not-an-address", name: "Asha", device: dev(8) }));

    const p = await openPage(w.world, { url: "http://localhost/pricing.html", html: "pricing.html", scripts: ["guide.js"] }); open.push(p); const CTG = p.win.CTG;
    expect(got.lock).toEqual({ status: 409, message: "You already have people listed. Start a new game to use a different kind of ID." });
    expect(got.needEmp.message).toBe("Enter your employee ID."); expect(got.needEml.message).toBe("Enter your Email ID.");
    expect(got.usedEmp.message).toMatch(/^This employee ID already has a ticket on another phone/); expect(got.usedEml.message).toMatch(/^This Email ID already has a ticket on another phone/);
    expect(got.alone.message).toMatch(/^An Email ID is asked on its own/); expect(got.looksEmail.message).toMatch(/^This looks like an Email ID, but this game asks for an employee ID/); expect(got.badEmail.message).toMatch(/^That Email ID does not look like an email address/);
    const TITLE: Record<string, string> = { lock: "The kind of ID cannot change now", needEmp: "Please type your ID to go in", needEml: "Please type your ID to go in", // guide.js:35 (fixed in 1.4.1b: the match texts are the real strings)
       usedEmp: "This employee ID already has a ticket", usedEml: "This Email ID already has a ticket", alone: "Choose Email ID on its own", looksEmail: "This game asks for an employee ID, not an Email ID", badEmail: "" };
    for (const [k, a] of Object.entries(got)) { const f = CTG.find({ status: a.status, message: a.message }); expect([k, a.message, f.matched]).toEqual([k, a.message, true]); if (TITLE[k]) expect([k, f.entry.t]).toEqual([k, TITLE[k]]); }
    // the guide's own entry strings are the strings the Worker sends: every `m` of the new entries is a piece of text that occurs in the Worker or the config source
    const src = ["apps/edge/src/worker.ts", "packages/beacon/src/config.ts", "apps/edge/src/idclean.ts"].map((f) => readFileSync(join(import.meta.dir, "../../..", f), "utf8")).join("\n");
    for (const m of ["You already have people listed. Start a new game to use a different kind of ID", "An Email ID is asked on its own", "This looks like an Email ID, but this game asks for an employee ID"]) { expect([m, src.includes(m)]).toEqual([m, true]); expect([m, pub("guide.js").includes(m)]).toEqual([m, true]); }
    expect(pub("guide.js")).toContain("This Email ID already has a ticket on another phone"); expect(src).toContain("This ${W} already has a ticket on another phone"); // the Worker builds both from one template; the guide carries both spellings
  });
  // Was a PRODUCT NOTE on 1.4.1 (guide.js matched the text `Enter your ${W}.` with the placeholder still in it). Fixed in 1.4.1b; now an ordinary test.
  test("every match text in guide.js is real text a person can be sent (no unexpanded ${...} placeholder)", () => {
    const dead = [...pub("guide.js").matchAll(/m:\s*\[([^\]]*)\]/g)].map((m) => m[1]!).filter((m) => m.includes("${"));
    expect(dead).toEqual([]);
  });
});
