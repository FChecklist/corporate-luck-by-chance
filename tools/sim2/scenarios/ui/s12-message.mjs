// Group 12: "Message to everyone" on a phone, in real Chrome.
//   S12-01  the Organizer on a 360 px phone: step 9 shows the box (title, quick messages, text field, Send and Clear) inside the screen with no sideways scroll; a quick message fills the field;
//           Send puts it on the game; a joined player's phone and the big screen then show the strip at the top; Clear takes it away again.
import { H, openConsole, openStep, guestJoinUi, nextPhone } from "./kit.mjs";

export default [
  {
    id: "S12-01", name: "Message to everyone on a 360 px phone: the box is shown in step 9 and fits the screen; a message sent there appears on a player's phone and on the big screen, and Clear removes it",
    async run(t) {
      const org = await t.org("m"); const g = await t.game(org, { lead: 30 * H.MIN, settings: { whoCanJoin: "anyone" }, pay: true });
      // a player on a 360 px phone, waiting in the room
      const P = await t.open({ device: "mobile", w: 360, h: 740 });
      await guestJoinUi(P.page, g.id, nextPhone(), "Asha");
      await P.page.waitForFunction(() => /You are in/i.test(document.body.innerText), null, { timeout: 15000 });
      t.check("before any message the player's page has no message strip", (await P.page.$("#annbar:not([hidden])")) === null);
      // the Organizer on a 360 px phone
      const x = await openConsole(t, org, g.id, { device: "mobile", w: 360, h: 740 });
      await openStep(x.page, 9);
      await x.page.waitForSelector("#annblock", { timeout: 8000 }).catch(() => {});
      const box = await x.page.evaluate(() => {
        const b = document.getElementById("annblock"); if (!b) return null; b.scrollIntoView({ block: "center" });
        const r = b.getBoundingClientRect(), vis = (id) => { const e = document.getElementById(id); if (!e) return false; const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none" && q.left >= 0 && q.right <= innerWidth + 0.5; };
        return { left: r.left, right: r.right, iw: innerWidth, sw: document.documentElement.scrollWidth, text: vis("annText"), send: vis("annSend"), clear: vis("annClear"), sendDisabled: document.getElementById("annSend").disabled, h3: b.querySelector("h3").textContent, chips: b.querySelectorAll("[data-chip]").length };
      });
      t.check("step 9 shows the 'Message to everyone' box on a 360 px phone", !!box && box.h3 === "Message to everyone", JSON.stringify(box));
      t.check("the box, its text field and both buttons are inside the screen and the page does not scroll sideways", !!box && box.left >= 0 && box.right <= box.iw + 0.5 && box.sw <= box.iw && box.text && box.send && box.clear, JSON.stringify(box));
      t.check("quick messages are offered and the Send button is switched on for a published game", !!box && box.chips >= 4 && box.sendDisabled === false, JSON.stringify(box));
      await t.shot(x.page, "message-box-360");
      // tap a quick message, then Send
      await x.page.click('#annblock [data-chip="Dinner is served"]');
      t.check("a quick message fills the text field", (await x.page.inputValue("#annText")) === "Dinner is served");
      await x.page.click("#annSend");
      await x.page.waitForFunction(() => /Sent\./.test((document.getElementById("annblock") || {}).innerText || ""), null, { timeout: 8000 }).catch(() => {});
      t.check("the console says it was sent", /Sent\./.test(await t.text(x.page, "#annblock")), await t.text(x.page, "#annblock"));
      const v1 = (await H.call("GET", `/api/z/${g.id}/luck/view`)).body;
      t.check("the game's public view now carries the message", v1?.ann?.text === "Dinner is served", JSON.stringify(v1?.ann));
      // the player's phone shows the strip (the page asks every 3 seconds while waiting)
      await P.page.waitForSelector("#annbar:not([hidden])", { timeout: 15000 }).catch(() => {});
      const pbar = await P.page.evaluate(() => { const e = document.getElementById("annbar"); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.textContent, hidden: e.hidden, top: r.top, left: r.left, right: r.right, iw: innerWidth, sw: document.documentElement.scrollWidth, role: e.getAttribute("role"), color: getComputedStyle(e).backgroundColor }; });
      t.check("the player's phone shows the message in a strip at the very top", !!pbar && pbar.text === "Dinner is served" && pbar.hidden === false && pbar.top <= 1 && pbar.role === "status", JSON.stringify(pbar));
      t.check("the strip fits a 360 px screen, no sideways scroll", !!pbar && pbar.left >= 0 && pbar.right <= pbar.iw + 0.5 && pbar.sw <= pbar.iw, JSON.stringify(pbar));
      await t.shot(P.page, "player-with-message-360");
      // the big screen shows it too
      const B = await t.open({ device: "laptop" });
      await B.page.goto(`${H.SIM}/big?e=${g.id}`); await B.page.waitForSelector("#annbar:not([hidden])", { timeout: 15000 }).catch(() => {});
      t.check("the big screen shows the same message", (await B.page.evaluate(() => (document.getElementById("annbar") || {}).textContent || "")) === "Dinner is served");
      await t.shot(B.page, "big-with-message");
      // Clear (the server asks for a few seconds between two messages, so the game's clock moves on first)
      await H.clock.advance(7000); t.shared.track.bump(7000);
      await x.page.click("#annClear");
      await x.page.waitForFunction(() => /Message cleared/.test((document.getElementById("annblock") || {}).innerText || ""), null, { timeout: 8000 }).catch(() => {});
      await P.page.waitForSelector("#annbar[hidden]", { state: "attached", timeout: 15000 }).catch(() => {});
      t.check("after Clear the player's phone hides the strip", await P.page.evaluate(() => { const e = document.getElementById("annbar"); return !e || e.hidden; }));
    },
  },
];
