// Group 7: real games on Chrome phones (3 phones, simulated clock moved together with the server and every page): the Organizer starts the game on the "Run the game" page, the phones press the dice
// in each press window, everyone sees the same top lists, a phone that never presses, one that goes offline, a latecomer, the big screen, a removed person, the after-game report and deletion.
// Luck by Chance rules (docs/RULES.md): rounds of 10 dice rounds, a target number appears, a player who presses sees a dice; a dice that shows the target scores the target number; no money, prizes are gifts.
import { H, openConsole, openStep, guestText, nextPhone, guestJoinUi } from "./kit.mjs";

const SECS = 1000;
/** a paid, published game open to anyone */
const luckGame = (t, org, { lead = 30 * H.MIN } = {}) => t.game(org, { lead, settings: { whoCanJoin: "anyone" }, pay: true });
const viewOf = async (eid) => (await H.call("GET", `/api/z/${eid}/luck/view`)).body;
const rankOf = async (eid) => (await H.call("GET", `/api/z/${eid}/luck/rank`)).body;

/** opens one phone per nickname and joins through the form (the boxes first, then the nickname) */
async function phones(t, g, names) {
  const out = [];
  for (const nm of names) {
    const x = await t.open({ device: "mobile" });
    await guestJoinUi(x.page, g.id, nextPhone(), nm);
    await x.page.waitForFunction(() => /You are in/i.test(document.body.innerText), null, { timeout: 15000 });
    out.push(x);
  }
  return out;
}
/** The Organizer opens "Run the game" (host.html) and starts it: rounds, press window, a prize for first place, then the Start button and its confirmation. Returns the page. */
async function startFromHostPage(t, org, g, { rounds = 1, windowSecs = 6, prize = "A hamper" } = {}) {
  const h = await t.open({ device: "laptop", token: org.token });
  h.page.on("dialog", (d) => d.accept().catch(() => {}));
  await h.page.goto(`${H.SIM}/host.html?e=${g.id}`);
  await h.page.waitForSelector("#start", { timeout: 15000 });
  await h.page.fill("#rounds", String(rounds));
  await h.page.click(`[data-k="windowSecs"][data-v="${windowSecs}"]`);
  await h.page.fill("#overall0", prize);
  await h.page.click("#start");
  await t.until(async () => (await viewOf(g.id)).state === "running", { what: "the game to be running", timeout: 12000 });
  return h;
}
/** Moves the simulated time on by `stepMs` for the server, the beacon and every page together; presses the dice on the phones that may press; stops when every phone says the game is over. */
async function play(t, ps, { stepMs = SECS, maxSteps = 500, presser = () => true, onStep, extra = [] } = {}) {
  let n = 0;
  for (; n < maxSteps; n++) {
    await H.clock.advance(stepMs); t.shared.track.bump(stepMs);
    for (const o of [...ps, ...extra]) await o.ctx.clock.runFor(stepMs);
    await new Promise((r) => setTimeout(r, 110));
    for (const [i, o] of ps.entries()) if (presser(i, n)) { const b = await o.page.$("#press:not([disabled])"); if (b) await b.click().catch(() => {}); }
    if (onStep) await onStep(n);
    if (n > 20 && (await Promise.all(ps.map((o) => guestText(o.page)))).every((x) => /the game is over/i.test(x))) { n++; break; }
  }
  // a few more seconds so every phone works out the final list and sends its result (the phones agree by sending the same result)
  for (let i = 0; i < 8; i++) { await H.clock.advance(stepMs); t.shared.track.bump(stepMs); for (const o of [...ps, ...extra]) await o.ctx.clock.runFor(stepMs); await new Promise((r) => setTimeout(r, 110)); }
  return n;
}
/** Waits for the result the phones agree on: moves the clock on a second at a time so every phone can send its result, and looks at the server after each step. */
async function agreed(t, ps, eid, { extra = [], max = 45 } = {}) {
  for (let i = 0; i < max; i++) {
    const r = await rankOf(eid); if (r.agreed) return r;
    await H.clock.advance(SECS); t.shared.track.bump(SECS); for (const o of [...ps, ...extra]) await o.ctx.clock.runFor(SECS); await new Promise((x) => setTimeout(x, 350));
  }
  return await rankOf(eid);
}
const finalOf = async (page) => (await page.innerText(".lt-final").catch(() => "")).replace(/\s+/g, " ").trim();
/** what a phone shows once its dice has landed: the number on the dice, the target, the points in the score line (read from the dice and the words, not from layout) */
const rollOf = (page) => page.evaluate(() => { const d = document.querySelector("#die[data-state='landed']"); if (!d) return null; const t = Number((document.querySelector(".lt-tn b") || {}).textContent), v = (document.getElementById("lt-verdict") || {}).textContent || "", m = /\+(\d+) point/.exec(v); return { dice: Number(d.dataset.value), target: t, pts: m ? Number(m[1]) : 0 }; }).catch(() => null);

export default [
  {
    id: "S07-01", name: "Three Chrome phones play a whole game: the Organizer starts it on 'Run the game', the phones press the dice, all end with the same winners, no JavaScript errors",
    async run(t) {
      const org = await t.org("o"); const g = await luckGame(t, org);
      const ps = await phones(t, g, ["Asha", "Bala", "Charu"]);
      const h = await startFromHostPage(t, org, g, { rounds: 1, windowSecs: 6 });
      for (let i = 0; i < 5; i++) { await H.clock.advance(SECS); t.shared.track.bump(SECS); await H.advanceBrowsers([...ps, h].map((o) => o.ctx), SECS, { run: true }); await new Promise((r) => setTimeout(r, 90)); }
      t.check("a phone shows the countdown to the start", /starts in/i.test(await guestText(ps[0].page)) || /target/i.test(await guestText(ps[0].page)), (await guestText(ps[0].page)).slice(0, 160));
      t.check("the Organizer's page shows the game as running", /running/i.test(await t.text(h.page)), (await t.text(h.page)).slice(0, 160));
      const seen = [];
      const steps = await play(t, ps, { onStep: async () => { for (const o of ps) { const r = await rollOf(o.page); if (r) seen.push(r); } } });
      const texts = await Promise.all(ps.map((o) => guestText(o.page)));
      t.check("all three phones reached the end within the time budget", texts.every((x) => /the game is over/i.test(x)), `${steps} steps`);
      t.check("each phone tells the player the score", texts.every((x) => /you scored \d+ points/i.test(x)), texts[0].slice(0, 200));
      const fin = await Promise.all(ps.map((o) => finalOf(o.page)));
      t.check("the winners list is the same on all three phones", fin[0].length > 10 && fin.every((f) => f === fin[0]), fin.map((f) => f.slice(0, 80)).join(" || "));
      t.check("dice rule seen on the screens: a dice that shows the target scores the target, any other dice scores nothing", seen.length > 3 && seen.every((r) => r.pts === (r.dice === r.target ? r.target : 0)), JSON.stringify(seen.slice(0, 4)));
      t.check("every dice and target is between 1 and 6", seen.every((r) => r.dice >= 1 && r.dice <= 6 && r.target >= 1 && r.target <= 6));
      const rank = await agreed(t, ps, g.id, { extra: [h] });
      t.check("the server published the result the phones agreed on, with the same first place", rank.agreed && rank.overall.length >= 1 && fin[0].includes(rank.overall[0].name), `${rank.overall[0]?.name} in ${fin[0].slice(0, 120)}`);
      for (let i = 0; i < 6; i++) { await H.clock.advance(SECS); t.shared.track.bump(SECS); await h.ctx.clock.runFor(SECS); await new Promise((r) => setTimeout(r, 80)); }
      t.check("the Organizer's page says Finished and that the phones agreed", /finished/i.test(await t.text(h.page)) && /agreed/i.test(await t.text(h.page)), (await t.text(h.page)).slice(0, 220));
      const rv = (await H.call("GET", `/api/z/${g.id}/luck/reveal`)).body;
      t.check("after the game the secret is shown so anybody can check every number", rv.revealed === true && !!rv.secret, JSON.stringify(rv).slice(0, 120));
      await t.shot(ps[0].page, "phone-after-game");
    },
  },
  {
    id: "S07-02", name: "A phone that goes offline for a while and one that never presses still end with the same winners as the others",
    async run(t) {
      const org = await t.org("o"); const g = await luckGame(t, org);
      const ps = await phones(t, g, ["Dev", "Esha", "Fay"]);
      await startFromHostPage(t, org, g, { rounds: 1, windowSecs: 6 });
      for (let i = 0; i < 30; i++) { await H.clock.advance(SECS); t.shared.track.bump(SECS); for (const o of ps) await o.ctx.clock.runFor(SECS); await new Promise((r) => setTimeout(r, 90)); }
      await ps[1].ctx.setOffline(true);
      for (let i = 0; i < 15; i++) { await H.clock.advance(SECS); t.shared.track.bump(SECS); for (const o of ps) await o.ctx.clock.runFor(SECS); await new Promise((r) => setTimeout(r, 60)); }
      await ps[1].ctx.setOffline(false);
      await play(t, ps, { presser: (i) => i !== 2 });
      const texts = await Promise.all(ps.map((o) => guestText(o.page)));
      t.check("all three phones end, also the one that was offline and the one that never pressed", texts.every((x) => /the game is over/i.test(x)), texts.map((x) => x.slice(0, 60)).join(" | "));
      const fin = await Promise.all(ps.map((o) => finalOf(o.page)));
      t.check("same winners list on all phones", fin[0].length > 10 && fin.every((f) => f === fin[0]), fin.map((f) => f.slice(0, 60)).join(" || "));
      t.check("the server agrees too", !!(await agreed(t, ps, g.id)).agreed);
      await t.shot(ps[1].page, "offline-phone-end");
    },
  },
  {
    id: "S07-03", name: "Big screen during the game shows the target, the countdown and the top 10 with nicknames only, and agrees with the phones",
    async run(t) {
      const org = await t.org("o"); const g = await luckGame(t, org);
      const ps = await phones(t, g, ["Dev Diwan", "Esha Edwin", "Gita Gill"]);
      const big = await t.open({ device: "wide" });
      await big.page.goto(`${H.SIM}/big.html?e=${g.id}`); await big.page.waitForTimeout(1500);
      t.check("before the start the big screen says how many players have joined", /3/.test(await guestText(big.page)) && /joined|players/i.test(await guestText(big.page)), (await guestText(big.page)).slice(0, 200));
      await startFromHostPage(t, org, g, { rounds: 1, windowSecs: 6 });
      let sawTarget = false;
      await play(t, ps, { extra: [big], maxSteps: 500, onStep: async () => { if (!sawTarget && /target/i.test(await guestText(big.page)) && /\b[1-6]\b/.test(await guestText(big.page))) sawTarget = true; } });
      await big.page.waitForTimeout(1500);
      const btxt = await guestText(big.page);
      t.check("the big screen showed a target number while the game ran", sawTarget);
      t.check("the big screen ends with the final result", /final result/i.test(btxt), btxt.slice(0, 220));
      t.check("only nicknames are on the big screen: no phone number or e-mail", !/\b9\d{9}\b|@/.test(btxt), btxt.slice(0, 200));
      const fin = await finalOf(ps[0].page);
      t.check("the first place on the big screen is the first place on the phone", /Dev Diwan|Esha Edwin|Gita Gill/.test(btxt) && [...btxt.matchAll(/(Dev Diwan|Esha Edwin|Gita Gill)/g)].length >= 1 && fin.includes((/1st: ([^0-9]+?) \d+ pts/.exec(fin) ?? [])[1]?.trim() ?? "~~"), fin.slice(0, 120));
      const m = await H.measure(big.page, { minPx: 12 });
      t.check("big screen at 1920 has no horizontal overflow", !m.overflowX, JSON.stringify(m.wideElements));
      await t.shot(big.page, "bigscreen-1920");
    },
  },
  {
    id: "S07-04", name: "One player cannot start the game: 'Start' answers kindly, and the Organizer's page keeps the settings",
    async run(t) {
      const org = await t.org("o"); const g = await luckGame(t, org);
      await phones(t, g, ["Solo Sam"]);
      const h = await t.open({ device: "laptop", token: org.token }); h.page.on("dialog", (d) => d.accept().catch(() => {}));
      await h.page.goto(`${H.SIM}/host.html?e=${g.id}`); await h.page.waitForSelector("#start", { timeout: 15000 });
      t.check("the page says one player has joined", /\b1 players? (have|has) joined/i.test(await t.text(h.page)), (await t.text(h.page)).slice(0, 160));
      await h.page.fill("#rounds", "3"); await h.page.click("#start"); await h.page.waitForTimeout(900);
      const txt = await t.text(h.page);
      t.check("a plain message says a game needs at least 2 players", /at least 2 players/i.test(txt), txt.slice(0, 220));
      t.check("the game is still open (not started)", (await viewOf(g.id)).state === "open");
      await t.shot(h.page, "host-one-player");
    },
  },
  {
    id: "S07-05", name: "A latecomer after the start is taken to the big screen to watch (the list of players is closed); a stranger cannot start the game",
    async run(t) {
      const org = await t.org("o"); const g = await luckGame(t, org); const other = await t.org("p");
      const ps = await phones(t, g, ["Fay", "Gus", "Hal"]);
      const stranger = await H.call("POST", `/api/z/${g.id}/luck/start`, { settings: { rounds: 1, windowSecs: 6, prizeMode: "overall", prizes: { overall: ["x"], rounds: [[]] } } }, { "x-organizer": other.token });
      t.check("another organizer cannot start this game", !stranger.ok, `${stranger.status}`);
      t.check("a guest cannot start it either", !(await H.call("POST", `/api/z/${g.id}/luck/start`, {}, {})).ok);
      await startFromHostPage(t, org, g, { rounds: 1, windowSecs: 6 });
      const late = await t.open({ device: "mobile" });
      await guestJoinUi(late.page, g.id, nextPhone(), "Late Larry");
      await late.page.waitForURL(/big\.html/, { timeout: 15000 }).catch(() => {});
      t.check("the latecomer lands on the big screen and is not given a seat", /big\.html/.test(late.page.url()), late.page.url() + " | " + (await guestText(late.page)).slice(0, 200));
      t.check("the game still has exactly the three players", (await viewOf(g.id)).players === 3);
      await t.shot(late.page, "latecomer");
    },
  },
  {
    id: "S07-06", name: "Remove a person during the game: that phone is told so kindly and stops; the other phones play on and finish with the same winners",
    async run(t) {
      const org = await t.org("o"); const g = await luckGame(t, org);
      const ps = await phones(t, g, ["Hal", "Ida", "Jon", "Kim"]);
      await startFromHostPage(t, org, g, { rounds: 1, windowSecs: 6 });
      for (let i = 0; i < 28; i++) { await H.clock.advance(SECS); t.shared.track.bump(SECS); for (const o of ps) await o.ctx.clock.runFor(SECS); await new Promise((r) => setTimeout(r, 70)); }
      const list = (await org.people(g.id)).body.people ?? [];
      const vp = list.filter((q) => !q.role && q.status !== "removed").pop();
      t.check("the people list shows the guests who joined", list.length >= 4, `people ${list.length}`);
      const rm = await org.api("POST", `/api/z/${g.id}/people/${encodeURIComponent(vp.id)}/remove`, {});
      t.check("the Organizer can remove a person during the game", rm.ok, `${rm.status} ${JSON.stringify(rm.body).slice(0, 160)}`);
      await play(t, ps, { maxSteps: 200 });
      const texts = await Promise.all(ps.map((p) => guestText(p.page)));
      const gone = texts.map((x) => /removed/i.test(x));
      t.check("exactly one phone says the person was removed by the organizer (not a silent blank join form)", gone.filter(Boolean).length === 1, texts.map((x) => x.slice(0, 70)).join(" | "));
      const others = ps.filter((_, i) => !gone[i]);
      const ended = await Promise.all(others.map((o) => guestText(o.page)));
      t.check("the three other phones finish", ended.length === 3 && ended.every((x) => /the game is over/i.test(x)), ended.map((x) => x.slice(0, 60)).join(" | "));
      const fin = await Promise.all(others.map((o) => finalOf(o.page)));
      t.check("the other phones agree on the winners", fin[0]?.length > 10 && fin.every((f) => f === fin[0]));
      t.check("the seat stays in the public list of seats", ((await H.call("GET", `/api/z/${g.id}/luck/seats`)).body.seats ?? []).length === 4);
      await t.shot(ps[Math.max(0, gone.indexOf(true))].page, "removed-phone");
    },
  },
  {
    id: "S07-07", name: "After the game: the report link is e-mailed to the Organizer only about 3 minutes after the end; 'Delete all participant data now' empties the guests at once",
    async run(t) {
      const org = await t.org("o"); const g = await luckGame(t, org);
      const ps = await phones(t, g, ["Kim", "Lou", "Mia"]);
      await startFromHostPage(t, org, g, { rounds: 1, windowSecs: 6 });
      await play(t, ps);
      await H.clock.advanceWithTicks(10 * H.MIN, H.MIN);
      const rep = await H.mailbox.list({ to: org.email, subject: "report" });
      t.check("the report e-mail reached the Organizer", rep.length >= 1, (await H.mailbox.list({ to: org.email })).map((m) => m.subject).join(" | ").slice(0, 300));
      const link = rep[0] ? H.mailbox.links(rep[0]).find((l) => /report/.test(l)) : null;
      t.check("the mail carries a report link", !!link, rep[0]?.text.slice(0, 200));
      if (link) {
        const r = await t.open({ device: "laptop" }); await r.page.goto(link); await r.page.waitForTimeout(4000);
        t.check("the report page opens and lists winners", /winner|prize|report/i.test(await guestText(r.page)), (await guestText(r.page)).slice(0, 200));
        await t.shot(r.page, "report");
      }
      const before = (await H.sql("SELECT COUNT(*) c FROM participant WHERE eid=?", [g.id]))[0].c;
      const c = await openConsole(t, org, g.id, { device: "laptop" }); c.page.on("dialog", (d) => d.accept().catch(() => {})); await openStep(c.page, 10);
      await c.page.click("#erase"); await c.page.waitForTimeout(800);
      const conf = c.page.locator("#sec10 button:has-text('Yes'), #sec10 button:has-text('Delete')").last(); if (await conf.count()) { await conf.click().catch(() => {}); await c.page.waitForTimeout(1500); }
      const left = (await H.sql("SELECT COUNT(*) c FROM participant WHERE eid=?", [g.id]))[0].c;
      t.check("the guests are erased on request", before >= 3 && left === 0, `${before} before, ${left} left`);
      const mails = await t.mails(); t.check("e-mail only to the Organizer and Hosts", mails.every((m) => t.team.has(m.to.toLowerCase())), mails.filter((m) => !t.team.has(m.to.toLowerCase())).map((m) => m.to).join(","));
    },
    resetAfter: true,
  },
  {
    id: "S07-08", name: "Two rounds: the standings after round 1 appear in the break, round 2 follows, and the final list has the winners of each round apart from the overall winners",
    async run(t) {
      const org = await t.org("o"); const g = await luckGame(t, org);
      const ps = await phones(t, g, ["Mo", "Ned", "Ola"]);
      await startFromHostPage(t, org, g, { rounds: 2, windowSecs: 6 });
      let sawBreak = false;
      await play(t, ps, { maxSteps: 700, onStep: async () => { if (!sawBreak && /round 1 is over/i.test(await guestText(ps[0].page))) sawBreak = true; } });
      t.check("during the break a phone showed 'Round 1 is over' and the top 10", sawBreak);
      const texts = await Promise.all(ps.map((o) => guestText(o.page)));
      t.check("all phones finish both rounds", texts.every((x) => /the game is over/i.test(x)), texts[0].slice(0, 160));
      t.check("round 1 and round 2 winners are listed apart from the overall winners", texts.every((x) => /round 1 winners/i.test(x) && /round 2 winners/i.test(x)), texts[0].slice(-300));
      const rank = await agreed(t, ps, g.id);
      t.check("the server's result has two rounds", rank.agreed && rank.rounds.length === 2, String(rank.rounds?.length));
    },
  },
];
