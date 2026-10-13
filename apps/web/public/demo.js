/* Corporate Luck by Chance, try it (demo.html): five dice rounds on this page only. Nothing is sent anywhere and nothing is stored.
   It uses the real engine (luck-engine.js) with numbers drawn on this phone. In a real game the numbers come from a public beacon, one value when each dice round opens and one when its press window closes. */
(function () {
  const $app = document.getElementById("app");
  const LE = window.LuckEngine;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const GAME = "demo-" + hex().slice(0, 8), ROUNDS = 5;
  let g = 0, target = null, rolled = null, points = 0, log = [], busy = false;
  async function open() { target = await LE.targetOf(GAME, g, hex()); rolled = null; paint(); }
  async function press() {
    if (busy || rolled !== null) return; busy = true;
    rolled = await LE.diceOf(GAME, 0, g, hex()); const gain = LE.scoreOf(target, rolled); points += gain;
    log.push(`Dice round ${g + 1}: target ${target}, you rolled ${rolled}: ${gain ? "+" + gain + " points" : "0 points"}`);
    busy = false; paint();
  }
  function paint() {
    const over = g >= ROUNDS || (g === ROUNDS - 1 && rolled !== null);
    $app.innerHTML = `<div class="zhead"><b>Corporate Luck by Chance</b></div><div class="zcard lt-play"><h2>Try it</h2>
      <p class="lt-info">Dice round ${Math.min(g + 1, ROUNDS)} of ${ROUNDS}</p><p class="lt-label">Target</p><div class="lt-target ${rolled !== null ? (rolled === target ? "hit" : "miss") : ""}" role="status">${target === null ? "..." : target}</div>
      ${rolled !== null ? `<p class="lt-result">You rolled ${rolled}: ${rolled === target ? "+" + target + " points" : "0 points"}</p>` : `<button class="lt-dice" id="press">Press the dice</button>`}
      <p class="lt-totals">Points so far <b>${points}</b></p>
      ${rolled !== null ? (over ? `<button class="zbtn" id="again">Play again</button>` : `<button class="zbtn" id="next">Next dice round</button>`) : ""}
      ${log.length ? `<ul class="zlist">${log.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
      <p class="zsmall">If your dice shows the target you score that many points. Otherwise nothing. Pure luck. Nobody pays to play. <a href="/">Back to the home page</a></p></div>`;
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
    on("press", press); on("next", () => { g++; open(); }); on("again", () => { g = 0; points = 0; log = []; open(); });
  }
  open();
})();
