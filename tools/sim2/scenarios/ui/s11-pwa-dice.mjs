// Group 11: the dice rounds on a phone, and the app that holds them (PWA), in real Chrome.
//   S11-01  the installable app: manifest, icons, head tags, Chrome's own installability check, a registered service worker, the saved copy, the offline page, the demo working with no connection.
//   S11-02  the demo at 360x640, 320x568 and 430x932 with motion on: the dice element, the rolling state that lasts, landing on pips equal to the number beside it, the score, no sideways scroll, big buttons.
//   S11-03  forced outcomes (a match, a miss, a 1 and a 6): the points, the colours, the history chips, the progress; axe (WCAG A/AA incl. contrast) on every state in the light page and in the three theme settings.
//   S11-04  the real player page in a real game: the target first, the dice rolls when pressed, lands when the window closes (also for a phone that never pressed), same numbers everywhere, the screen reader hears it.
//   S11-05  every phone size, upright and on its side: no sideways scroll, touch targets, text size, the play area in view; reduce-motion gives a short fade instead of tumbling.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { H, guestJoinUi, nextPhone, guestText } from "./kit.mjs";

const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const SECS = 1000;

async function axeRun(page) {
  await page.evaluate(AXE);
  return page.evaluate(async (tags) => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return res.violations.map((v) => `${v.id} x${v.nodes.length} [${v.nodes.slice(0, 3).map((n) => n.target.join(" ").slice(0, 70)).join(" | ")}] ${String(v.nodes[0]?.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 160)}`);
  }, TAGS);
}
/** installed before the page loads: notes every change of the dice's state with the page clock, so a test can say "it rolled for N ms, then slowed down for M ms" */
function recorder() {
  window.__ds = [];
  const start = () => {
    const note = () => { const d = document.getElementById("die"); if (!d) return; const s = d.getAttribute("data-state"), last = window.__ds[window.__ds.length - 1]; if (!last || last.s !== s) window.__ds.push({ s, t: performance.now(), v: d.getAttribute("data-value") }); };
    new MutationObserver(note).observe(document, { subtree: true, attributes: true, childList: true, attributeFilter: ["data-state", "data-value"] }); note();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
}
/** installed before the page loads (game phones): notes EVERY landing in window.__rows, 420 ms after the dice stopped (the score has counted up, the chip is in), whatever the test is doing at the time */
function rowRecorder() {
  window.__rows = []; window.__seen = {};
  const q = (s) => (document.querySelector(s) || {}).textContent || "";
  const start = () => new MutationObserver(() => {
    const d = document.getElementById("die"); if (!d || d.getAttribute("data-state") !== "landed") return;
    const round = q(".lt-progt").trim(), no = q(".lt-tk").trim(), key = round + "|" + no; if (window.__seen[key]) return; window.__seen[key] = 1;
    const target = Number(q(".lt-tn b")), value = Number(d.getAttribute("data-value"));
    // the face, the number and the score line are read the moment the dice has stopped; the score badge and the chips 420 ms later, when they have settled (if the next dice round has not opened by then)
    if (d.getBoundingClientRect().top < 0 || d.getBoundingClientRect().bottom > innerHeight) d.scrollIntoView({ block: "center" }); // look at the dice where it is
    const r = d.getBoundingClientRect(), el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2), face = el && el.closest(".ld-face");
    const verdict = q("#lt-verdict").replace(/\s+/g, " ").trim(), m = /^\+(\d+) point/.exec(verdict);
    const row = { round, no, target, dice: value, pts: m ? Number(m[1]) : 0, verdict, face: face ? Number(face.dataset.n) : null, pips: face ? face.querySelectorAll(".ld-pip").length : null, num: q("#lt-num").trim(), total: null, chips: null, same: false };
    window.__rows.push(row);
    setTimeout(() => { if (q(".lt-tk").trim() === no && q(".lt-progt").trim() === round) { row.same = true; row.total = Number(q("#lt-total")); row.chips = document.querySelectorAll(".lt-chip").length; row.sr = q("#lt-sr"); row.top = !!document.querySelector("#lt-top10:not([hidden]) .lt-list li"); } }, 420);
  }).observe(document, { subtree: true, attributes: true, childList: true, attributeFilter: ["data-state", "data-value"] });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
}
/** what the dice shows right now: its state, the face really turned to the player (found by looking at what is under the middle of the dice), its dots, and the number beside it */
const readDie = (page) => page.evaluate(() => {
  const d = document.getElementById("die"); if (!d) return null;
  let r0 = d.getBoundingClientRect(); if (r0.top < 0 || r0.bottom > innerHeight) { d.scrollIntoView({ block: "center" }); } // a short screen on its side scrolls: look at the dice where it is now
  const r = d.getBoundingClientRect(), el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2), face = el && el.closest(".ld-face");
  const q = (s) => (document.querySelector(s) || {}).textContent || "";
  return { state: d.dataset.state, value: d.dataset.value ? Number(d.dataset.value) : null, face: face ? Number(face.dataset.n) : null, pips: face ? face.querySelectorAll(".ld-pip").length : null, faces: d.querySelectorAll(".ld-face").length, num: q("#lt-num").trim(), target: Number(q(".lt-tn b")), verdict: q("#lt-verdict").replace(/\s+/g, " ").trim(), total: Number(q("#lt-total")), chips: document.querySelectorAll(".lt-chip").length, res: (document.getElementById("lt-stage") || { dataset: {} }).dataset.res || "", w: Math.round(r.width) };
});
const layoutOf = (page) => page.evaluate(() => {
  const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }; };
  return { iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, target: q(".lt-targetp"), die: q("#die"), press: q("#press, #next, #again"), score: q(".lt-score") };
});
const inView = (b, iw, ih) => !!b && b.top >= -1 && b.left >= -1 && b.bottom <= ih + 1 && b.right <= iw + 1;
const fitsScreen = (l) => inView(l.target, l.iw, l.ih) && inView(l.die, l.iw, l.ih) && inView(l.press, l.iw, l.ih) && inView(l.score, l.iw, l.ih);
const phoneAt = (t, w, h, o = {}) => t.open({ device: "mobile", w, h, ...o });
const settle = (page, ms) => page.waitForTimeout(ms);
/** polls the page until fn(...) is truthy */
const until = (t, fn, what, timeout = 9000) => t.until(fn, { timeout, step: 80, what });

/** starts the game on "Run the game" (as in group 7) */
async function startFromHostPage(t, org, g, { rounds = 1, windowSecs = 6 } = {}) {
  const h = await t.open({ device: "laptop", token: org.token });
  h.page.on("dialog", (d) => d.accept().catch(() => {}));
  await h.page.goto(`${H.SIM}/host.html?e=${g.id}`);
  await h.page.waitForSelector("#start", { timeout: 15000 });
  await h.page.fill("#rounds", String(rounds));
  await h.page.click(`[data-k="windowSecs"][data-v="${windowSecs}"]`);
  await h.page.fill("#overall0", "A hamper");
  await h.page.click("#start");
  await t.until(async () => (await H.call("GET", `/api/z/${g.id}/luck/view`)).body.state === "running", { what: "the game to be running", timeout: 12000 });
  return h;
}

export default [
  {
    id: "S11-01", name: "Installable app: manifest, icons, head tags, Chrome's installability check, service worker, saved copy, offline page, the demo plays with no connection",
    async run(t) {
      const x = await t.open({ device: "mobile", clock: false });
      await x.page.goto(H.SIM + "/demo.html", { waitUntil: "load" });
      const mf = await x.page.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]'); const r = await fetch(l.href); return { href: l.getAttribute("href"), ct: r.headers.get("content-type"), json: await r.json() }; });
      const m = mf.json;
      t.check("the page links the web manifest", mf.href === "/manifest.webmanifest", mf.href);
      t.check("manifest: name, short name, start url, scope, standalone", m.name === "Corporate Luck by Chance" && m.short_name === m.name && m.start_url === "/z.html" && m.scope === "/" && m.display === "standalone", JSON.stringify([m.name, m.short_name, m.start_url, m.scope, m.display]));
      t.check("manifest: theme and background colours, id, language, not locked to upright", /^#[0-9a-f]{6}$/i.test(m.theme_color) && /^#[0-9a-f]{6}$/i.test(m.background_color) && !!m.id && m.lang === "en" && m.orientation === "any", JSON.stringify([m.theme_color, m.background_color, m.id, m.lang, m.orientation]));
      const has = (sz, purpose) => m.icons.some((i) => i.sizes === sz && i.purpose === purpose && i.type === "image/png");
      t.check("manifest: icons 192 and 512, plain and maskable", has("192x192", "any") && has("512x512", "any") && has("192x192", "maskable") && has("512x512", "maskable"), JSON.stringify(m.icons.map((i) => i.sizes + i.purpose)));
      const dims = await x.page.evaluate(async (icons) => Promise.all(icons.map(async (i) => { const r = await fetch(i.src); const b = await createImageBitmap(await r.blob()); return [i.src, r.status, r.headers.get("content-type"), b.width + "x" + b.height, i.sizes]; })), m.icons);
      t.check("every icon is served as a PNG of the size the manifest says", dims.every((d) => d[1] === 200 && d[2] === "image/png" && d[3] === d[4]), JSON.stringify(dims));
      const head = await x.page.evaluate(async () => { const a = document.querySelector('link[rel="apple-touch-icon"]'); const b = a ? await createImageBitmap(await (await fetch(a.href)).blob()) : null; return { apple: a ? a.getAttribute("href") : null, size: b ? b.width + "x" + b.height : null, vp: (document.querySelector('meta[name="viewport"]') || {}).content || "", theme: (document.querySelector('meta[name="theme-color"]') || {}).content || "", lang: document.documentElement.lang }; });
      t.check("head: apple-touch-icon 180x180, viewport-fit=cover, theme colour equal to the manifest", /^\/apple-touch-icon\.png(\?v=\d+)?$/.test(head.apple || "") && head.size === "180x180" && /viewport-fit=cover/.test(head.vp) && /width=device-width/.test(head.vp) && head.theme.toLowerCase() === m.theme_color.toLowerCase() && head.lang === "en", JSON.stringify(head));
      const cdp = await x.ctx.newCDPSession(x.page);
      const inst = await cdp.send("Page.getInstallabilityErrors").catch((e) => ({ installabilityErrors: [{ errorId: "cdp-failed", errorArguments: [{ value: String(e.message).slice(0, 80) }] }] }));
      const instErr = (inst.installabilityErrors ?? []).filter((e) => e.errorId !== "in-incognito"); // the test browser window is a private one; that is the only thing Chrome may still say
      t.check("Chrome's own installability check finds nothing missing (manifest, icons, start page, service worker)", instErr.length === 0, JSON.stringify(instErr).slice(0, 300));
      t.note("Chrome installability errors seen: " + JSON.stringify((inst.installabilityErrors ?? []).map((e) => e.errorId)));
      // the service worker
      const files = await x.page.evaluate(async () => { const t = await (await fetch("/zsw.js")).text(); return JSON.parse(/const FILES = (\[[\s\S]*?\]);/.exec(t)[1]); });
      const reg = await x.page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, active: !!r.active, script: r.active ? r.active.scriptURL : "" }; });
      t.check("a service worker is registered for the whole site and is active", reg.active && reg.scope === H.SIM + "/" && /\/zsw\.js$/.test(reg.script), JSON.stringify(reg));
      const saved = await t.until(async () => { const n = await x.page.evaluate(async () => { const nm = /const CACHE = "([^"]+)"/.exec(await (await fetch("/zsw.js")).text())[1]; const c = await caches.open(nm); return (await c.keys()).length; }); return n >= files.length ? n : 0; }, { timeout: 15000, step: 300, what: "the saved copy" }).catch(() => 0);
      t.check("the whole game is saved on the phone: every listed file is in the saved copy", saved >= files.length, `${saved} of ${files.length}`);
      t.check("the saved copy holds the offline page and the demo", await x.page.evaluate(async () => { const nm = /const CACHE = "([^"]+)"/.exec(await (await fetch("/zsw.js")).text())[1]; const c = await caches.open(nm); return !!(await c.match("/offline.html")) && !!(await c.match("/demo.html")) && !!(await c.match("/luck-dice.js")); }));
      await x.page.reload({ waitUntil: "load" }); // now the worker controls the page
      t.check("after a reload the service worker controls the page", await x.page.evaluate(() => !!navigator.serviceWorker.controller));
      // offline
      await x.ctx.setOffline(true);
      const off = await x.page.goto(H.SIM + "/demo.html", { waitUntil: "load" }).catch((e) => ({ err: e.message }));
      t.check("offline: the demo opens from the saved copy (served by the service worker)", !off.err && off.fromServiceWorker() && (await x.page.$("#press")) !== null, off.err ?? `fromServiceWorker=${off.fromServiceWorker?.()}`);
      await x.page.emulateMedia({ reducedMotion: "reduce" });
      await x.page.click("#press"); await until(t, async () => (await readDie(x.page))?.state === "landed", "the demo dice to land offline", 6000).catch(() => {});
      const d1 = await readDie(x.page);
      t.check("offline: a whole demo dice round works with no connection (the dice lands on its number)", d1?.state === "landed" && d1.value === d1.face && d1.value === d1.pips, JSON.stringify(d1));
      await t.shot(x.page, "offline-demo");
      const game = await x.page.goto(H.SIM + "/z.html?e=none", { waitUntil: "load" }).catch((e) => ({ err: e.message }));
      t.check("offline: the player page opens from the saved copy", !game.err && game.fromServiceWorker() && /Corporate Luck by Chance/.test(await guestText(x.page)), game.err ?? (await guestText(x.page)).slice(0, 120));
      const other = await x.page.goto(H.SIM + "/pricing.html", { waitUntil: "load" }).catch((e) => ({ err: e.message }));
      const otherText = await guestText(x.page);
      t.check("offline: a page that is not saved shows our plain offline page, not the browser's error", !other.err && /You are offline/.test(otherText) && (await x.page.$('a[href="/z.html"]')) !== null, other.err ?? otherText.slice(0, 160));
      await t.shot(x.page, "offline-page");
      const m2 = await H.measure(x.page); t.check("the offline page has no sideways scroll", !m2.overflowX);
      await x.ctx.setOffline(false);
      const back = await x.page.goto(H.SIM + "/pricing.html", { waitUntil: "load" });
      t.check("back online the same page opens normally", back.ok() && !/You are offline/.test(await guestText(x.page)));
    },
  },
  {
    id: "S11-02", name: "The demo at 360x640, 320x568 and 430x932 with motion: a dice that rolls for a while and lands on pips equal to the number beside it; score, no sideways scroll, big button",
    async run(t) {
      for (const [label, w, h] of [["360x640", 360, 640], ["320x568", 320, 568], ["430x932", 430, 932]]) {
        const x = await phoneAt(t, w, h, { clock: false });
        await x.page.emulateMedia({ reducedMotion: "no-preference" });
        await x.page.addInitScript(recorder);
        await x.page.goto(H.SIM + "/demo.html", { waitUntil: "load" }); await x.page.waitForSelector("#press:not([disabled])");
        await settle(x.page, 500);
        const rounds = w === 360 ? 5 : 2; let total = 0;
        const l0 = await layoutOf(x.page), d0 = await readDie(x.page);
        t.check(`${label}: the dice is drawn: six faces, resting, big enough to read (${d0.w} px)`, d0.faces === 6 && d0.state === "idle" && d0.w >= 70, JSON.stringify(d0));
        t.check(`${label}: target, dice, button and score are all in view without scrolling`, fitsScreen(l0), JSON.stringify([l0.target, l0.die, l0.press, l0.score].map((b) => b && [Math.round(b.top), Math.round(b.bottom)])) + ` of ${l0.ih}`);
        t.check(`${label}: no sideways scroll`, l0.sw <= l0.iw, `${l0.sw} > ${l0.iw}`);
        t.check(`${label}: the Press button is at least 44 px high and wide`, l0.press.h >= 44 && l0.press.w >= 44, JSON.stringify([l0.press.w, l0.press.h]));
        const small = await H.measure(x.page, { minPx: 12 }); t.check(`${label}: no text under 12 px`, small.smallText.length === 0, JSON.stringify(small.smallText));
        await t.shot(x.page, `demo-${label}-idle`);
        for (let r = 1; r <= rounds; r++) {
          const before = await readDie(x.page);
          t.check(`${label} round ${r}: the target panel says it in words and the first line is the round`, new RegExp(`^Roll a ${before.target} and you score ${before.target} points?\\. Any other number scores 0\\.$`).test(await x.page.innerText(".lt-ts")) && (await x.page.innerText(".lt-tk")).toLowerCase() === `dice round ${r} of 5`, before.target + " " + (await x.page.innerText(".lt-ts")));
          t.check(`${label} round ${r}: the target is drawn as a dice face with that many dots`, (await x.page.locator(".lt-tface .ld-pip").count()) === before.target);
          await x.page.click("#press"); const t0 = Date.now();
          await settle(x.page, 450); if (r === 1) await t.shot(x.page, `demo-${label}-rolling`);
          const mid = await readDie(x.page);
          t.check(`${label} round ${r}: while it rolls the number is not shown yet, and the score has not moved`, (mid.state === "rolling" || mid.state === "landing") && mid.num === "?" && mid.total === total && mid.value === null, JSON.stringify(mid));
          await settle(x.page, 750); if (r === 1) await t.shot(x.page, `demo-${label}-slowing`);
          await until(t, async () => (await readDie(x.page))?.state === "landed", "the dice to land", 6000);
          await settle(x.page, 480); // the score counts up in 380 ms
          const ms = Date.now() - t0 - 480, d = await readDie(x.page);
          const gain = d.value === d.target ? d.target : 0; total += gain;
          t.check(`${label} round ${r}: it landed after about two seconds (${ms} ms)`, ms >= 1700 && ms <= 3600, `${ms} ms`);
          t.check(`${label} round ${r}: the face turned to the player has as many dots as the number beside it (${d.value})`, d.value >= 1 && d.value <= 6 && d.face === d.value && d.pips === d.value && Number(d.num) === d.value, JSON.stringify(d));
          t.check(`${label} round ${r}: ${gain ? "a match scores the target" : "a miss scores 0"} and the score shows it`, d.total === total && (gain ? /^\+\d+ points?/.test(d.verdict) : /^Not this time, 0 points/.test(d.verdict)) && d.res === (gain ? "hit" : "miss"), JSON.stringify(d));
          t.check(`${label} round ${r}: one chip for every dice round so far`, d.chips === r, `${d.chips}`);
          const states = await x.page.evaluate(() => window.__ds.map((e) => e.s));
          const rec = await x.page.evaluate(() => window.__ds.slice(-4));
          const rolled = rec.find((e) => e.s === "rolling"), slowed = rec.find((e) => e.s === "landing"), landed = rec.find((e) => e.s === "landed");
          t.check(`${label} round ${r}: it rolled (${Math.round(slowed.t - rolled.t)} ms), slowed down (${Math.round(landed.t - slowed.t)} ms), then stopped`, !!rolled && !!slowed && !!landed && slowed.t - rolled.t >= 500 && landed.t - slowed.t >= 1000, JSON.stringify(rec));
          void states;
          if (r === 1) await t.shot(x.page, `demo-${label}-${gain ? "match" : "miss"}`);
          if (r < rounds) { await x.page.click("#next"); await settle(x.page, 250); }
        }
        const dEnd = await readDie(x.page);
        t.check(`${label}: the score badge is the sum of the dice rounds (${total})`, dEnd.total === total && Number(await x.page.innerText("#lt-total")) === total);
        const after = await layoutOf(x.page); t.check(`${label}: still no sideways scroll after the rounds`, after.sw <= after.iw);
        if (rounds === 5) {
          t.check("after the fifth round the button says Play again and the line says what was scored", (await x.page.innerText("#again")) === "Play again" && new RegExp(`You scored ${total} in 5 dice rounds`).test(await x.page.innerText("#lt-verdict")));
          await x.page.click("#again"); await settle(x.page, 300);
          const fresh = await readDie(x.page); t.check("Play again starts from zero", fresh.total === 0 && fresh.chips === 0 && fresh.state === "idle");
        }
        await x.close();
      }
    },
  },
  {
    id: "S11-03", name: "Forced outcomes on the demo (match 4, miss, match 6, match 1, miss): exact points, colours, chips; axe (WCAG A/AA, contrast) on every state in the light page and in the three theme settings",
    async run(t) {
      const x = await phoneAt(t, 360, 640, { clock: false });
      await x.ctx.addInitScript(() => { // the harness fixes the numbers; the page's own code and the dice drawing run as shipped
        let eng; Object.defineProperty(window, "LuckEngine", { configurable: true, get() { return eng; }, set(v) { eng = { ...v }; let ti = 0, di = 0; const T = [4, 1, 6, 1, 2], D = [4, 5, 6, 1, 1]; eng.targetOf = async () => T[ti++ % 5]; eng.diceOf = async () => D[di++ % 5]; } });
      });
      await x.page.emulateMedia({ reducedMotion: "no-preference" });
      await x.page.goto(H.SIM + "/demo.html", { waitUntil: "load" }); await x.page.waitForSelector("#press:not([disabled])"); await settle(x.page, 400);
      const want = [[4, 4, 4, "hit"], [1, 5, 0, "miss"], [6, 6, 6, "hit"], [1, 1, 1, "hit"], [2, 1, 0, "miss"]]; let total = 0;
      const bad = [], themes = [null, "maroon", "blue", "emerald"];
      let axeNow = async (what) => { bad.push(...(await axeRun(x.page)).map((v) => `${what}: ${v}`)); };
      await axeNow("idle");
      for (let i = 0; i < 5; i++) {
        const [tg, dc, pts, res] = want[i]; total += pts;
        const b = await readDie(x.page); t.check(`round ${i + 1}: the target is ${tg}`, b.target === tg, JSON.stringify(b));
        if (i === 0) { // the first round with the keyboard only: Tab to the button, Enter to press
          const active = () => x.page.evaluate(() => (document.activeElement && document.activeElement.id) || "");
          for (let k = 0; k < 8 && (await active()) !== "press"; k++) await x.page.keyboard.press("Tab");
          t.check("keyboard: Tab reaches the Press button and it is marked (visible focus ring)", (await active()) === "press" && (await x.page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 3; })));
          await x.page.keyboard.press("Enter");
          await settle(x.page, 150); t.check("keyboard: Enter rolled the dice", (await readDie(x.page))?.state === "rolling");
        } else await x.page.click("#press");
        await until(t, async () => (await readDie(x.page))?.state === "landed", "landing", 6000); await settle(x.page, 500);
        if (i === 0) t.check("keyboard: after the landing the focus is on the Next button, not lost", (await x.page.evaluate(() => document.activeElement && document.activeElement.id)) === "next");
        const d = await readDie(x.page);
        t.check(`round ${i + 1}: rolled ${dc}: the face and the number are ${dc}`, d.value === dc && d.face === dc && d.pips === dc && Number(d.num) === dc, JSON.stringify(d));
        t.check(`round ${i + 1}: ${res === "hit" ? "+" + pts + " points, match colours" : "Not this time, 0 points, calm colours"}`, d.res === res && d.total === total && (res === "hit" ? d.verdict.startsWith(`+${pts} point`) : d.verdict.startsWith("Not this time, 0 points")), JSON.stringify(d));
        const colours = await x.page.evaluate(() => { const c = (s) => getComputedStyle(document.querySelector(s)); return { verdict: c("#lt-verdict").backgroundColor, stage: c("#lt-stage").borderTopColor, num: c("#lt-num").color }; });
        t.check(`round ${i + 1}: the ${res} look is on (${colours.verdict})`, res === "hit" ? colours.verdict === "rgb(255, 213, 79)" : colours.verdict === "rgb(220, 230, 245)", JSON.stringify(colours));
        if (i === 0 || i === 1 || i === 2) await t.shot(x.page, `forced-${res}-${tg}-${dc}`);
        await axeNow(`${res} ${tg}/${dc}`);
        if (i === 2) { for (const th of themes.slice(1)) { await x.page.evaluate((v) => document.documentElement.setAttribute("data-theme", v), th); await axeNow(`${res} in theme ${th}`); } await x.page.evaluate(() => document.documentElement.removeAttribute("data-theme")); }
        if (i < 4) { if (i === 0) await x.page.keyboard.press("Space"); else await x.page.click("#next"); await settle(x.page, 250); }
      }
      t.check("axe found no WCAG A/AA violation (contrast included) in the idle, match and miss states, in the light page and in the three theme settings", bad.length === 0, bad.slice(0, 3).join(" ;; ").slice(0, 380));
      const chips = await x.page.$$eval(".lt-chip", (els) => els.map((e) => [e.classList.contains("hit") ? "hit" : "miss", e.getAttribute("aria-label"), e.querySelectorAll(".ld-mini").length, e.querySelectorAll(".ld-pip").length]));
      t.check("five chips: each with a target face, a rolled face (their dots), tick or cross, and a label that says it in words", chips.length === 5 && chips.map((c) => c[0]).join() === "hit,miss,hit,hit,miss" && chips.every((c) => c[2] === 2 && /^Dice round \d: target \d, you rolled \d, \d points?$/.test(c[1])), JSON.stringify(chips));
      const segs = await x.page.$$eval("#lt-segs li", (els) => els.map((e) => e.className));
      t.check("the progress row shows each dice round as match or miss", segs.join() === "hit,miss,hit,hit,miss", segs.join());
      t.check("the final score is 11 (4 + 0 + 6 + 1 + 0)", total === 11 && Number(await x.page.innerText("#lt-total")) === 11);
      await t.shot(x.page, "forced-end-chips");
      await x.page.keyboard.press("Tab"); await settle(x.page, 100);
      t.check("the keyboard: Tab reaches the button of the demo and it is marked", await x.page.evaluate(() => { const e = document.activeElement; if (!e) return false; const cs = getComputedStyle(e); return (e.id === "again" || e.tagName === "A" || e.tagName === "BUTTON") && (cs.outlineStyle !== "none" || cs.boxShadow !== "none"); }));
    },
  },
  {
    id: "S11-04", name: "The real player page in a real game: target first, the dice rolls when pressed and lands when the window closes (a phone that never pressed too), same numbers on both phones, the screen reader hears the result",
    async run(t) {
      const org = await t.org("o"); const g = await t.game(org, { lead: 30 * H.MIN, settings: { whoCanJoin: "anyone" }, pay: true });
      const open = async (name) => { const p = await phoneAt(t, 360, 640); await p.page.emulateMedia({ reducedMotion: "no-preference" }); await p.page.addInitScript(recorder); await p.page.addInitScript(rowRecorder); await guestJoinUi(p.page, g.id, nextPhone(), name); await p.page.waitForFunction(() => /You are in/i.test(document.body.innerText), null, { timeout: 15000 }); return p; };
      const A = await open("Asha"), B = await open("Bala");
      const host = await startFromHostPage(t, org, g, { rounds: 1, windowSecs: 6 });
      const step = async (ms = SECS) => { await H.clock.advance(ms); t.shared.track.bump(ms); for (const o of [A, B, host]) await o.ctx.clock.runFor(ms); await new Promise((r) => setTimeout(r, 120)); };
      for (let i = 0; i < 40 && !(await A.page.$("#press:not([disabled])")); i++) await step();
      const wA = await readDie(A.page), lA = await layoutOf(A.page);
      t.check("the first thing on the screen is the target: its number and a dice face with that many dots", wA && wA.target >= 1 && wA.target <= 6 && (await A.page.locator(".lt-tface .ld-pip").count()) === wA.target, JSON.stringify(wA));
      t.check("the target is said in plain words", new RegExp(`^Roll a ${wA.target} and you score ${wA.target} points?\\. Any other number scores 0\\.$`).test(await A.page.innerText(".lt-ts")), await A.page.innerText(".lt-ts"));
      t.check("the round is shown: 'Round 1 of 1', 'Dice round n of 10', a progress row of ten", /^Round 1 of 1$/.test(await A.page.innerText(".lt-progt")) && /^Dice round \d+ of 10$/i.test(await A.page.innerText(".lt-tk")) && (await A.page.locator("#lt-segs li").count()) === 10);
      t.check("the dice rests until it is pressed; the button says Press the dice", wA.state === "idle" && (await A.page.innerText("#press")) === "Press the dice");
      t.check("target, dice, button and score are all in view on a 360x640 phone", fitsScreen(lA), JSON.stringify([lA.target, lA.die, lA.press, lA.score].map((b) => b && [Math.round(b.top), Math.round(b.bottom)])) + ` of ${lA.ih}`);
      t.check("the Press button is at least 44 px; no sideways scroll", lA.press.h >= 44 && lA.sw <= lA.iw, `${lA.press.h} ${lA.sw}/${lA.iw}`);
      const wB = await readDie(B.page); t.check("both phones show the same target", wB.target === wA.target, `${wA.target} vs ${wB.target}`);
      await t.shot(A.page, "player-window-idle");
      const axe1 = await axeRun(A.page); t.check("axe: the window screen has no WCAG A/AA violation (contrast included)", axe1.length === 0, axe1.join(" ;; ").slice(0, 300));
      const activeId = () => A.page.evaluate(() => (document.activeElement && document.activeElement.id) || "");
      for (let k = 0; k < 8 && (await activeId()) !== "press"; k++) await A.page.keyboard.press("Tab");
      t.check("keyboard: Tab reaches the Press button on the real page", (await activeId()) === "press");
      await A.page.keyboard.press("Enter"); // phone A plays with the keyboard only
      t.check("keyboard: after Enter the focus is kept on the dice area (the button turned off), not lost", (await activeId()) === "lt-stage", await activeId());
      await step(); const rolling = await readDie(A.page);
      t.check("pressing starts the dice rolling: rolling state, the button is off, the words say it lands when the timer ends", rolling.state === "rolling" && (await A.page.isDisabled("#press")) && /lands when the timer ends/.test(rolling.verdict), JSON.stringify(rolling));
      t.check("while the window is open the number stays hidden and the score stays put", rolling.num === "?" && rolling.total === 0 && rolling.value === null, JSON.stringify(rolling));
      await t.shot(A.page, "player-window-rolling");
      t.check("the screen reader is told it is rolling (one polite status region)", (await A.page.textContent("#lt-sr")).includes("Rolling") && (await A.page.getAttribute("#lt-sr", "aria-live")) === "polite" && (await A.page.getAttribute("#lt-sr", "role")) === "status");
      for (let i = 0; i < 16 && !(await A.page.evaluate(() => window.__rows.length)); i++) { await step(500); if (i === 3) await t.shot(A.page, "player-landing"); }
      await step(450); // the score counts up in 380 ms
      await t.shot(A.page, "player-landed"); await t.shot(B.page, "player-landed-B");
      const axe2 = await axeRun(A.page); t.check("axe: the landed screen has no WCAG A/AA violation (contrast included)", axe2.length === 0, axe2.join(" ;; ").slice(0, 300));
      const lL = await layoutOf(A.page); t.check("landed screen: no sideways scroll, text at least 12 px", lL.sw <= lL.iw && (await H.measure(A.page, { minPx: 12 })).smallText.length === 0);
      const rA = (await A.page.evaluate(() => window.__rows))[0], rB = (await B.page.evaluate(() => window.__rows))[0];
      const recA = await A.page.evaluate(() => window.__ds.map((e) => e.s)), recB = await B.page.evaluate(() => window.__ds.map((e) => e.s));
      t.check("phone A (pressed): rolled, then slowed down, then stopped", recA.join(">").includes("rolling>landing>landed"), recA.join(">"));
      t.check("phone B (never pressed): its dice also slows down and lands when the window closes", recB.join(">").includes("landing>landed") && !recB.includes("rolling"), recB.join(">"));
      t.check("both phones noted the landing of dice round 1", !!rA && !!rB && /Dice round 1 of 10/.test(rA.no) && /Dice round 1 of 10/.test(rB.no), JSON.stringify([rA?.no, rB?.no]));
      for (const [who, d] of [["A", rA], ["B", rB]]) {
        const gain = d.dice === d.target ? d.target : 0;
        t.check(`phone ${who}: the face turned to the player, its dots and the number beside it are the same (${d.dice})`, d.dice >= 1 && d.dice <= 6 && d.face === d.dice && d.pips === d.dice && Number(d.num) === d.dice, JSON.stringify(d));
        t.check(`phone ${who}: ${gain ? "a match scores the target (" + gain + ")" : "a miss scores 0"}, in the score line, the badge and the chip`, d.pts === gain && (gain ? d.verdict.startsWith(`+${gain} point`) : d.verdict.startsWith("Not this time, 0 points")) && d.same && d.total === gain && d.chips === 1, JSON.stringify(d));
      }
      t.check("both phones had the same target", rA.target === rB.target);
      t.check("the screen reader hears the result: number, target and points", rA.same && rA.sr.includes(`You rolled ${rA.dice}`) && /You score \d+ points?\.|You score 0 points/.test(rA.sr) && /Your score is \d+/.test(rA.sr), rA.sr);
      t.check("the top 10 list appears after the landing, with nicknames", rA.same && rA.top === true);
      // the same screen again after the next dice round opened: new target, the history keeps the chip
      for (let i = 0; i < 8 && !(await A.page.$("#press:not([disabled])")); i++) await step(500);
      const n = await readDie(A.page); t.check("the next dice round opens with a resting dice, a target, and the chip of the first one kept", n.state === "idle" && n.chips === 1 && /^Dice round 2 of 10$/i.test(await A.page.innerText(".lt-tk")) && n.total === rA.total, JSON.stringify(n));
      const errs = [...A.mon.pageErrors, ...B.mon.pageErrors]; t.check("no JavaScript errors on either phone", errs.length === 0, errs.join(" | ").slice(0, 200));
    },
  },
  {
    id: "S11-05", name: "Every phone size upright (320, 360, 375, 390, 412, 430) and on its side: no sideways scroll, big button, text 12 px or more, play area in view; reduce-motion: a short fade, no tumbling",
    async run(t) {
      const sizes = [[320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [430, 932], [640, 360], [740, 360], [568, 320]];
      const x = await phoneAt(t, 360, 640, { clock: false });
      for (const [w, h] of sizes) {
        await x.page.setViewportSize({ width: w, height: h });
        await x.page.emulateMedia({ reducedMotion: "reduce" });
        await x.page.goto(H.SIM + "/demo.html", { waitUntil: "load" }); await x.page.waitForSelector("#press:not([disabled])"); await settle(x.page, 350);
        const l = await layoutOf(x.page), m = await H.measure(x.page, { minPx: 12 });
        const upright = h > w;
        t.check(`${w}x${h}: no sideways scroll`, l.sw <= l.iw, `${l.sw}>${l.iw}`);
        t.check(`${w}x${h}: the Press button is at least 44 px (${Math.round(l.press.h)} high)`, l.press.h >= 44 && l.press.w >= 44);
        t.check(`${w}x${h}: no text under 12 px`, m.smallText.length === 0, JSON.stringify(m.smallText));
        if (upright) t.check(`${w}x${h}: target, dice, button and score are in view without scrolling`, fitsScreen(l), JSON.stringify([l.target, l.die, l.press, l.score].map((b) => b && [Math.round(b.top), Math.round(b.bottom)])) + ` of ${l.ih}`);
        else t.check(`${w}x${h}: on its side the dice and the button are on the page's first screen`, inView(l.die, l.iw, l.ih) && l.press.top < l.ih, JSON.stringify([l.die, l.press].map((b) => b && [Math.round(b.top), Math.round(b.bottom)])) + ` of ${l.ih}`);
        await t.shot(x.page, `size-${w}x${h}-idle`);
        await x.page.click("#press");
        const t0 = Date.now(); await until(t, async () => (await readDie(x.page))?.state === "landed", "landing (reduce-motion)", 5000);
        const d = await readDie(x.page);
        t.check(`${w}x${h} reduce-motion: it does not tumble, it lands on its number after a short fade`, d.state === "landed" && d.face === d.value && d.pips === d.value && Number(d.num) === d.value, JSON.stringify(d));
        const l2 = await layoutOf(x.page); t.check(`${w}x${h}: still no sideways scroll after the round`, l2.sw <= l2.iw);
        if (w === 360 && h === 640) await t.shot(x.page, `size-${w}x${h}-landed-reduced`);
        void t0;
      }
      const css = await x.page.evaluate(() => { const d = document.getElementById("die"); return d ? getComputedStyle(d).animationName : "none"; });
      t.check("reduce-motion: the resting dice does not bob (no animation running)", css === "none" || css === "", css);
    },
  },
  {
    id: "S11-06", name: "A person plays a whole game on a phone (3 players, 2 rounds of 10 dice rounds): join, wait, count down, every dice round, the break, the final; every number and every score is checked",
    async run(t) {
      const org = await t.org("o"); const g = await t.game(org, { lead: 30 * H.MIN, settings: { whoCanJoin: "anyone" }, pay: true });
      const mk = async (name, { shots = false } = {}) => {
        const p = await phoneAt(t, 360, 640); await p.page.emulateMedia({ reducedMotion: "no-preference" }); await p.page.addInitScript(rowRecorder);
        await p.page.goto(`${H.SIM}/z?e=${g.id}`); await p.page.waitForSelector("#tbslot input[data-box]", { timeout: 15000 });
        if (shots) await t.shot(p.page, "01-join-form");
        await guestJoinUi(p.page, g.id, nextPhone(), name);
        await p.page.waitForFunction(() => /You are in/i.test(document.body.innerText), null, { timeout: 15000 });
        if (shots) await t.shot(p.page, "02-you-are-in");
        p.name = name; p.rows = []; p.seen = new Set(); return p;
      };
      const A = await mk("Asha", { shots: true }), B = await mk("Bala"), C = await mk("Charu");
      const host = await startFromHostPage(t, org, g, { rounds: 2, windowSecs: 6 });
      const all = [A, B, C];
      const step = async (ms = SECS) => { await H.clock.advance(ms); t.shared.track.bump(ms); for (const o of [...all, host]) await o.ctx.clock.runFor(ms); await new Promise((r) => setTimeout(r, 90)); };
      const snap = (page) => page.evaluate(() => {
        const q = (s) => (document.querySelector(s) || {}).textContent || "", d = document.getElementById("die");
        const body = document.body.innerText.replace(/\s+/g, " ");
        return { kind: d && document.querySelector(".lt-game") ? "dice" : /game is over/i.test(body) ? "final" : /Round \d+ is over/i.test(body) ? "break" : /starts in/i.test(body) ? "before" : /You are in/i.test(body) ? "wait" : "other", state: d ? d.dataset.state : "", value: d && d.dataset.value ? Number(d.dataset.value) : null, round: q(".lt-progt").trim(), no: q(".lt-tk").trim(), target: Number(q(".lt-tn b")), total: Number(q("#lt-total")), verdict: q("#lt-verdict").replace(/\s+/g, " ").trim(), chips: document.querySelectorAll(".lt-chip").length, pressOn: !!document.querySelector("#press:not([disabled])") };
      });
      const shotted = new Set(); const once = async (key, page) => { if (!shotted.has(key)) { shotted.add(key); await t.shot(page, key); } };
      let steps = 0, lastRows = 0;
      for (; steps < 900; steps++) {
        await step(500);
        for (const p of all) {
          const s = await snap(p.page);
          if (p === A && s.kind === "before") await once("03-countdown", p.page);
          if (s.kind === "dice" && s.pressOn && p !== B) { if (p === A) await once("04-window-idle", p.page); await p.page.click("#press").catch(() => {}); if (p === A) { await step(300); await once("05-window-rolling", p.page); } }
          if (p === A && s.kind === "break") { await p.page.evaluate(() => window.scrollTo(0, 0)); await once("07-break", p.page); }
        }
        // a picture only of a finished landing: the dice has stopped, the number is shown (not "?"), the score has counted up and the screen is not fading in
        const n = await A.page.evaluate(() => window.__rows.length);
        if (n > lastRows) {
          lastRows = n; await step(450); // the score counts up in 380 ms
          const fin = await readDie(A.page), row = await A.page.evaluate(() => ({ ...window.__rows[window.__rows.length - 1], now: (document.querySelector(".lt-tk") || {}).textContent }));
          if (fin && fin.state === "landed" && row.now === row.no && fin.num !== "?" && Number(fin.num) === fin.value && fin.total === (row.total ?? fin.total)) await once(row.pts ? "06-landed-match" : "06-landed-miss", A.page);
        }
        if (steps > 20 && (await Promise.all(all.map((p) => snap(p.page)))).every((x) => x.kind === "final")) break;
      }
      for (let i = 0; i < 10; i++) await step(1000);
      for (const p of all) p.rows = await p.page.evaluate(() => window.__rows);
      for (const p of all) await p.page.evaluate(() => window.scrollTo(0, 0));
      await once("08-final", A.page); await t.shot(B.page, "08-final-B");
      t.check("the game reached its end on all three phones", (await Promise.all(all.map((p) => snap(p.page)))).every((x) => x.kind === "final"), `${steps} steps`);
      for (const p of all) {
        const r = p.rows;
        t.check(`${p.name}: exactly 20 dice rounds were played (2 rounds of 10)`, r.length === 20, `${r.length}`);
        t.check(`${p.name}: the round header counted 'Round 1 of 2' for ten and 'Round 2 of 2' for ten, and the dice round went 1 to 10 twice`, r.filter((x) => /^Round 1 of 2$/.test(x.round)).length === 10 && r.filter((x) => /^Round 2 of 2$/.test(x.round)).length === 10 && r.every((x, i) => x.no === `Dice round ${(i % 10) + 1} of 10`), r.map((x) => x.round.slice(6, 7) + "/" + x.no.slice(11, 13).trim()).join(" "));
        t.check(`${p.name}: every target and every dice is 1 to 6, the points are the target for a match and 0 for a miss`, r.every((x) => x.target >= 1 && x.target <= 6 && x.dice >= 1 && x.dice <= 6 && x.pts === (x.dice === x.target ? x.target : 0)), JSON.stringify(r.filter((x) => x.pts !== (x.dice === x.target ? x.target : 0)).slice(0, 2)));
        t.check(`${p.name}: on every landing the face turned to the player, its dots and the number beside it were the dice`, r.every((x) => x.face === x.dice && x.pips === x.dice && (x.num === null || Number(x.num) === x.dice)), JSON.stringify(r.filter((x) => x.face !== x.dice || (x.num !== null && Number(x.num) !== x.dice)).slice(0, 2)));
        let run = 0; const okTotals = r.every((x) => { run += x.pts; return x.total === null || x.total === run; });
        t.check(`${p.name}: the score badge was the running sum after every landing (ends at ${run})`, okTotals, JSON.stringify(r.filter((x, i) => x.total !== null && x.total !== r.slice(0, i + 1).reduce((a, y) => a + y.pts, 0)).slice(0, 2)));
        t.check(`${p.name}: the history chips grew 1 to 10 in each round`, r.every((x, i) => x.chips === null || x.chips === (i % 10) + 1), r.map((x) => x.chips).join(","));
        p.sum = run;
      }
      t.check("the three phones saw the same target in every dice round (it is public)", A.rows.length === 20 && A.rows.every((x, i) => x.target === B.rows[i]?.target && x.target === C.rows[i]?.target), A.rows.map((x) => x.target).join("") + " / " + B.rows.map((x) => x.target).join(""));
      t.check("the phones did not all get the same dice (each player's dice is their own)", A.rows.some((x, i) => x.dice !== B.rows[i]?.dice), "");
      const finals = [];
      for (const p of all) finals.push(await p.page.$$eval(".lt-final li", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim())));
      t.check("the final list has places 1st, 2nd and 3rd, the same on all phones", finals[0].length === 3 && /^1st/.test(finals[0][0]) && /^2nd/.test(finals[0][1]) && /^3rd/.test(finals[0][2]) && finals.every((f) => f.join("|") === finals[0].join("|")), finals[0].join(" | "));
      for (const p of all) { const line = finals[0].find((x) => x.includes(p.name)); const pts = line ? Number(/(\d+) pts/.exec(line)?.[1]) : -1; t.check(`${p.name}'s points in the final list (${pts}) are the sum of the ${p.rows.length} dice rounds the phone showed (${p.sum})`, pts === p.sum, line ?? "missing"); }
      const pts = finals[0].map((x) => Number(/(\d+) pts/.exec(x)?.[1])); t.check("the final list is in order: most points first", pts.every((v, i) => i === 0 || pts[i - 1] >= v), pts.join(","));
      for (const p of all) { const txt = await guestText(p.page); const m = /You scored (\d+) points/.exec(txt); t.check(`${p.name}: the end screen says 'You scored ${p.sum} points'`, !!m && Number(m[1]) === p.sum, m?.[0] ?? txt.slice(0, 100)); }
      t.check("round 1's break screen was shown (Round 1 is over, with top 10 lists)", shotted.has("07-break"));
      const errs = all.flatMap((p) => p.mon.pageErrors); t.check("no JavaScript errors on any phone", errs.length === 0, errs.join(" | ").slice(0, 200));
    },
  },
];
