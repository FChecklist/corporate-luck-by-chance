/* Corporate Luck by Chance, try it (demo.html): five dice rounds on this page only. Nothing is sent anywhere and nothing is stored.
   It uses the real engine (luck-engine.js) with numbers drawn on this phone. In a real game the numbers come from a public beacon, one value when each dice round opens and one when its press window closes.
   The dice is drawn and rolled by luck-dice.js, the same as on the player's page. The number is worked out first by the engine; the rolling only shows it. */
(function () {
  const $app = document.getElementById("app");
  const LE = window.LuckEngine, LD = window.LuckDice;
  const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const GAME = "demo-" + hex().slice(0, 8), ROUNDS = 5, TUMBLE_MS = 700, LAND_MS = 1500; // about two seconds in all
  let g = 0, target = null, rolled = null, points = 0, shown = 0, chips = [], busy = false, landed = false, runNo = 0, usedKeys = false;
  document.addEventListener("keydown", (e) => { if (e.key === "Tab" || e.key === "Enter" || e.key === " ") usedKeys = true; });
  document.addEventListener("pointerdown", () => { usedKeys = false; });
  async function open() { target = await LE.targetOf(GAME, g, hex()); rolled = null; landed = false; runNo++; paint(); }
  const segs = () => Array.from({ length: ROUNDS }, (_, i) => (i < chips.length ? (chips[i].hit ? "hit" : "miss") : i === g ? "now" : "later"));
  function paint() {
    const over = g >= ROUNDS - 1;
    $app.innerHTML = `<div class="zhead"><b><a class="zlogo" href="/" aria-label="Corporate Luck by Chance home"><img src="/logo-mark.svg" alt="Corporate Luck by Chance logo" width="20" height="20"></a>Corporate Luck by Chance</b></div><div class="zcard lt-play"><h2>Try it</h2>` + LD.playHtml({
      roundText: "Free demo", segs: segs(), kicker: `Dice round ${Math.min(g + 1, ROUNDS)} of ${ROUNDS}`, target, total: shown, status: "Press the dice to roll it.",
      clock: "", button: { text: "Press the dice", disabled: !target }, hint: "You roll a number from 1 to 6. If it is the target, you score that many points. Otherwise 0. Pure luck.",
      chips, chipsTitle: "Your dice rounds", enter: true,
    }) + `<p class="zsmall tcen">Nobody pays to play. <a href="/">Back to the home page</a></p></div>`;
    const die = document.getElementById("die"), pb = document.getElementById("press"); if (!die || !pb) return;
    const ctl = LD.attach(die, "demo" + runNo);
    pb.addEventListener("click", press);
    if (rolled !== null) { pb.disabled = true; if (landed) { ctl.show(rolled); done(false); } else ctl.roll(); }
  }
  function done(fresh) {
    const gain = LE.scoreOf(target, rolled);
    if (!chips.some((c) => c.no === g + 1)) chips.push({ no: g + 1, t: target, d: rolled, hit: gain > 0, pts: gain });
    shown = points;
    LD.showResult({ target, dice: rolled, total: shown, seg: g, chip: chips[chips.length - 1], fresh });
    const pb = document.getElementById("press"); if (!pb) return;
    const clone = pb.cloneNode(true); pb.replaceWith(clone); // a fresh button without the old click handler
    clone.disabled = false; clone.classList.add("next");
    if (usedKeys) { try { clone.focus({ preventScroll: true }); } catch (e) { clone.focus(); } } // a keyboard player carries on from the button that took the place of Press
    if (g >= ROUNDS - 1) { clone.id = "again"; clone.textContent = "Play again"; clone.addEventListener("click", () => { g = 0; points = 0; shown = 0; chips = []; landed = false; open(); }); }
    else { clone.id = "next"; clone.textContent = "Next dice round"; clone.addEventListener("click", () => { g++; open(); }); }
    if (g >= ROUNDS - 1) { const vd = document.getElementById("lt-verdict"); if (vd) vd.insertAdjacentHTML("beforeend", `<small>That was the last one. You scored ${points} in ${ROUNDS} dice rounds.</small>`); }
  }
  async function press() {
    if (busy || rolled !== null) return; busy = true;
    rolled = await LE.diceOf(GAME, 0, g, hex()); points += LE.scoreOf(target, rolled); // the number is decided here, before anything moves
    const pb = document.getElementById("press"); if (pb) { pb.disabled = true; pb.textContent = "Rolling..."; pb.classList.add("tap"); }
    const vd = document.getElementById("lt-verdict"); if (vd) vd.textContent = "Here it comes...";
    const stage = document.getElementById("lt-stage"); if (stage && usedKeys) stage.focus({ preventScroll: true }); // the button is off now: keep the keyboard place on the dice
    LD.vibrate(40); LD.announce("Rolling.");
    const ctl = LD.attach(document.getElementById("die"), "demo" + runNo); ctl.roll();
    setTimeout(() => { ctl.land(rolled, LAND_MS); ctl.whenLanded(() => { landed = true; busy = false; done(true); }); }, TUMBLE_MS);
  }
  open();
})();
