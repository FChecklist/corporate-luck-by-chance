/* What Corporate Luck by Chance tells the game pack's live control bar (pack/runbar.js) about itself: what the game can do, what to say, where the links are.
   The bar holds no game rules. A button exists only when the flag is true: Luck has Start and End only (no pause, resume, add time, message, board or log) until the engine can.
   window.CTLiveLuck.mount(host, { eid, key, base }) draws the bar into `host` and keeps it fresh from the game's public view (/api/z/:id/luck/view). Nothing here picks a number, a dice or a winner. */
(function () {
  function phaseOf(v) { return !v || v.state === "open" ? "waiting" : v.state === "running" ? "running" : "finished"; }
  /** One sentence: "Round N of 10" while the dice rounds run (from the public schedule, the same one the phones use). */
  function storyOf(v, now) {
    if (!v) return "Connecting...";
    if (v.state === "done") return "The game is over.";
    if (v.state !== "running") return "Waiting to start. Press Start on the game page when your participants are ready.";
    var en = window.LuckEngine || null;
    if (en && v.settings && v.startMs) {
      var p = en.phaseAt(v.settings, v.startMs, now || Date.now());
      if (p.kind === "before") return "The game starts in a moment.";
      if (p.kind === "over") return "All dice rounds are done.";
      var n = p.kind === "break" ? p.afterRound : en.roundOf(v.settings, p.g);
      return "Round " + n + " of " + v.settings.rounds + (p.kind === "break" ? ", standings break" : "");
    }
    return "The game is running.";
  }
  var CAN = { start: true, pause: false, resume: false, extend: false, end: true, announce: false, bigScreen: true, board: false, results: false, log: false, changes: false };
  function game(o) {
    var eu = encodeURIComponent(o.eid), base = (o.base || "").replace(/\/$/, "");
    return {
      can: CAN,
      do: {
        // Start needs the rounds and the prizes: they are chosen on the game page, so the button takes the organizer there (nothing is started from here)
        start: async function () { location.href = "/host.html?e=" + eu; },
        end: async function () {
          var r = await fetch(base + "/api/z/" + eu + "/luck/end", { method: "POST", headers: { "content-type": "application/json", "x-organizer": o.key || "" }, body: "{}", cache: "no-store" });
          if (!r.ok) { var j = await r.json().catch(function () { return {}; }); throw new Error(j.error || "http " + r.status); }
        },
      },
      links: { bigScreen: "/big.html?e=" + eu },
    };
  }
  async function viewOf(o) { try { var r = await fetch((o.base || "").replace(/\/$/, "") + "/api/z/" + encodeURIComponent(o.eid) + "/luck/view", { cache: "no-store" }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
  function mount(host, o) {
    var pk = window.CTPack; if (!pk || !pk.mountRunBar) return null;
    var bar = pk.mountRunBar(host, game(o));
    async function tick() { var v = await viewOf(o); bar.update({ phase: phaseOf(v), story: storyOf(v), joined: v ? Number(v.joined) || 0 : 0 }); }
    tick(); var t = setInterval(tick, 4000);
    return { bar: bar, stop: function () { clearInterval(t); } };
  }
  window.CTLiveLuck = { phaseOf: phaseOf, storyOf: storyOf, CAN: CAN, game: game, mount: mount };
})();
