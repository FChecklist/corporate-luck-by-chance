/* Which organizer screens open at /zc. The NEW screens (pack/zc-flow.js: five steps and the Game dashboard) are OPT-IN (DEFAULT_NEW = false): /zc.html opens the previous console unless ?flow=new is in the address.
   ?flow=old opens the previous console again. Nothing is stored on the device (a stored choice needs a line in the storage list and on the Privacy page first), so the choice lives in the address only.
   Links only the previous console understands (demo game, pass, quick start, new game, cap, do = a hand-over link from the AI helper, k = a Host / AI key link, api) always open the previous console.
   A game that is about to start or is live now also opens the previous console (the new screens have no Start or End control yet; the game page has).
   It runs first and only puts flow=new or flow=old into the address, so zc.js (previous console) and pack/zc-flow.js (new screens) read it. */
(function () {
  var DEFAULT_NEW = false;
  try {
    var q = new URLSearchParams(location.search), f = q.get("flow");
    if (f !== "new" && f !== "old") {
      var OLD = ["demo", "pass", "quick", "quickform", "new", "cap", "do", "k", "api"], forced = false;
      for (var i = 0; i < OLD.length; i++) if (q.has(OLD[i])) forced = true;
      var gid = q.get("e");
      if (!forced && gid && /^[A-Za-z0-9_-]{4,40}$/.test(gid)) {
        try {
          var x = new XMLHttpRequest(); x.open("GET", "/api/z/" + encodeURIComponent(gid) + "/info", false); x.send(null);
          if (x.status === 200) {
            var j = JSON.parse(x.responseText), now = Date.now();
            if (typeof j.startMs === "number" && now >= j.startMs - 15 * 60000 && now <= j.startMs + 4 * 3600000) forced = true;
          }
        } catch (e) { /* no answer: the default */ }
      }
      window.CT_ZCFORCED = forced;
      f = forced ? "old" : DEFAULT_NEW ? "new" : "old";
      if (DEFAULT_NEW) { q.set("flow", f); try { history.replaceState(null, "", location.pathname + "?" + q.toString() + location.hash); } catch (e) { /* the address stays */ } }
    }
    window.CT_ZCFLOW = f;
    // the way there and back: one link above the page that swaps flow=new and flow=old and keeps every other part of the address
    var app = document.getElementById("app");
    if (app && !window.CT_ZCFORCED) {
      var p = document.createElement("p"), a = document.createElement("a"), q2 = new URLSearchParams(location.search);
      p.className = "zcmodetop"; p.id = "zcmodetop"; a.id = "trynewtop";
      q2.set("flow", f === "new" ? "old" : "new");
      a.href = location.pathname + "?" + q2.toString() + location.hash;
      a.textContent = f === "new" ? "Use the previous screens" : "Try the new screens";
      p.append(a); app.parentNode.insertBefore(p, app);
    }
  } catch (e) { /* the page then opens as before */ }
})();
