/* Corporate Luck by Chance, the runtime shared by the player page (luck.js) and the big screen (big.js).
   It reads the public view of the game, the frozen list of nicknames and the beacon values as each one falls due, and plays the game with the engine (luck-engine.js, packages/luck).
   Nothing is computed by the server: every phone gets the same standings from the same public numbers (docs/RULES.md). */
(function () {
  const E = window.LuckEngine;
  function create(o) {
    const base = (o.base || "").replace(/\/$/, ""), eid = o.eid;
    const R = { view: null, names: [], seatsLoaded: false, beacons: [], game: null, skew: 0, error: "", targets: {}, voted: false, rankings: null, busy: false };
    const j = async (path) => { const r = await fetch(base + path, { cache: "no-store" }); const b = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(b.error || "http " + r.status), { status: r.status, code: b.code, body: b }); return b; };
    R.now = () => Date.now() + R.skew;
    // the organizer's "message to everyone": one bright strip at the very top of the page (outside #app, so no screen repaint touches it); a new message is announced to a screen reader
    R.showAnn = (ann) => {
      if (typeof document === "undefined") return; // a test or tool that runs the runtime with no page
      let el = document.getElementById("annbar");
      if (!ann || !ann.text) { if (el) { el.hidden = true; el.dataset.id = ""; } return; }
      if (!el) { el = document.createElement("div"); el.id = "annbar"; el.className = "lt-annbar"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.insertBefore(el, document.body.firstChild); }
      if (el.dataset.id !== ann.id) { el.dataset.id = ann.id; el.textContent = ann.text; }
      el.hidden = false;
    };
    R.settings = () => R.view && R.view.settings;
    R.phase = () => (R.view && R.view.startMs && R.settings() ? E.phaseAt(R.settings(), R.view.startMs, R.now()) : { kind: "before" });
    R.nameOf = (seat) => R.names[seat] || "Player " + (seat + 1);
    R.fetchView = async (me) => {
      const path = me ? `/api/z/${eid}/luck/me?pid=${encodeURIComponent(me.pid)}&device=${encodeURIComponent(me.device)}` : `/api/z/${eid}/luck/view`;
      const v = await j(path); R.view = v; R.skew = (v.serverNow || Date.now()) - Date.now(); R.error = ""; R.showAnn(v.ann);
      if (v.state !== "open" && !R.seatsLoaded) { const s = await j(`/api/z/${eid}/luck/seats`); R.names = []; for (const [seat, name] of s.seats) R.names[seat] = name; R.seatsLoaded = true; }
      if (v.state !== "open" && !R.game) R.game = new E.LuckGame(eid, v.settings, v.players);
      // the organizer ended the game after a round: the settings now carry fewer rounds, and this phone stops after that round with everybody else
      if (R.game && v.settings && v.settings.rounds < R.game.settings.rounds) R.game.endAfterRound(v.settings.rounds);
      return v;
    };
    // pull every beacon value that is due, then play every dice round for which both values have arrived (one slice of work per call keeps the screen alive)
    R.advance = async () => {
      if (!R.game || R.busy) return; R.busy = true;
      try {
        const s = R.settings(), total = 2 * E.totalDiceRounds(s);
        while (R.beacons.length < total) {
          const b = await j(`/api/z/${eid}/luck/beacon?from=${R.beacons.length}`);
          for (const x of b.values) R.beacons[x.i] = x.v;
          if (!b.values.length) break;
        }
        let guard = 0;
        while (!R.game.finished && R.beacons[2 * R.game.done] && R.beacons[2 * R.game.done + 1] && guard++ < 6) await R.game.addDiceRound(R.game.done, R.beacons[2 * R.game.done], R.beacons[2 * R.game.done + 1]);
        // the target of the dice round that is open now exists as soon as beacon value A is out, before the dice (B) does
        const g = R.game.done; if (R.beacons[2 * g] && R.targets[g] === undefined && g < E.totalDiceRounds(s)) R.targets[g] = await E.targetOf(eid, g, R.beacons[2 * g]);
      } catch (e) { R.error = e.message || "Connecting..."; }
      R.busy = false;
    };
    R.top = async () => (R.game && R.game.done ? R.game.overallRanking(10) : []);
    R.roundTop = async (r) => R.game.roundRanking(r, 10);
    R.line = (r) => ({ seat: r.seat, points: r.points, hits: r.hits, best: r.best, line: r.line });
    // when the game is over every phone sends its result; the server publishes it once enough different phones sent the same one
    R.finalResult = async () => {
      if (!R.game || !R.game.finished) return null;
      if (R.rankings) return R.rankings;
      const s = R.settings(), rounds = []; for (let r = 1; r <= s.rounds; r++) rounds.push(await R.game.roundRanking(r, 10));
      R.rankings = { overall: await R.game.overallRanking(10), rounds }; return R.rankings;
    };
    R.vote = async (me) => {
      if (R.voted || !me) return; const fr = await R.finalResult(); if (!fr) return;
      const body = { pid: me.pid, device: me.device, result: { overall: fr.overall.map(R.line), rounds: fr.rounds.map((l) => l.map(R.line)) } };
      const r = await fetch(base + `/api/z/${eid}/luck/vote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      // a result sent a moment before the game is over is answered 409 "running": the phone must send it again (marking it as sent would leave this phone without a vote and the result unpublished)
      if (r.ok) R.voted = true;
      else if (r.status === 409) { const b = await r.json().catch(() => ({})); if (b && b.code === "watching") R.voted = true; }
    };
    return R;
  }
  window.LuckRun = { create };
})();
