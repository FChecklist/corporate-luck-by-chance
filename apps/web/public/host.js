/* Corporate Luck by Chance, run the game (host.html). For the Organizer or a Host: see who joined, choose the number of rounds, the press window and the prizes, start the game, and watch its progress.
   The page holds the sign-in key only in this tab's session (it comes from the console: zc.html?e=...). Nothing here changes a result: the host cannot pick a target, a dice or a winner. */
(function () {
  const $app = document.getElementById("app");
  const q = new URLSearchParams(location.search);
  const BASE = (q.get("api") || "").replace(/\/$/, "");
  const EID = (q.get("e") || "").trim();
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* blocked */ } } };
  let key = ss.get("cbz-org") || "";
  { const k = q.get("k"); if (k && /^cb[a-z]_[0-9a-f]{48}$/.test(k)) { key = k; ss.set("cbz-org", k); history.replaceState(null, "", location.pathname + "?e=" + encodeURIComponent(EID)); } }
  const S = { rounds: 10, windowSecs: 10, prizeMode: "both", oneWin: false, overall: ["", "", "", "", ""], perRound: ["", "", "", "", ""], msg: "", view: null };
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", "x-organizer": key }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || "http " + r.status), { status: r.status, code: j.code });
    return j;
  };
  const chips = (name, opts, cur) => `<div class="hchips" role="group" aria-label="${name}">${opts.map((o) => `<button class="hchip" data-k="${name}" data-v="${o[0]}" aria-pressed="${String(cur) === String(o[0])}">${esc(o[1])}</button>`).join("")}</div>`;
  const links = () => { const o = location.origin; return `<p class="zsmall">Player link: <span class="mono">${esc(o)}/z.html?e=${esc(EID)}</span><br>Big screen: <a href="/big.html?e=${encodeURIComponent(EID)}" target="_blank" rel="noopener">${esc(o)}/big.html?e=${esc(EID)}</a></p>`; };
  const prizeInputs = (name, arr) => arr.map((v, i) => `<div class="hprize"><label for="${name}${i}">Place ${i + 1}</label><input id="${name}${i}" data-p="${name}" data-i="${i}" maxlength="120" value="${esc(v)}" placeholder="A gift you hand over"></div>`).join("");
  const timeOf = (ms) => (ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-");
  // progress comes from the public schedule (the same one the phones use); the host page does not play the game
  function progress(v) {
    const E = window.LuckEngine; if (!E || !v.settings || !v.startMs) return "";
    const now = (v.serverNow || Date.now()) + (Date.now() - (S.fetchedAt || Date.now())), p = E.phaseAt(v.settings, v.startMs, now);
    const where = p.kind === "before" ? "Starts at " + timeOf(v.startMs) : p.kind === "over" ? "All dice rounds are done" : p.kind === "break" ? `Standings break after round ${p.afterRound}` : `Round ${E.roundOf(v.settings, p.g)} of ${v.settings.rounds}, dice round ${E.diceNoOf(v.settings, p.g)} of ${v.settings.diceRounds}`;
    return `<p><b>${esc(where)}</b></p><p class="zsmall">Started ${esc(timeOf(v.startMs))}, due to end ${esc(timeOf(v.endMs))}.</p>`;
  }
  // End the game: the round now being played is finished and counted, then the game is over for everybody (the server gives the game fewer rounds; every phone reads that and stops)
  function endBlock(v) {
    const E = window.LuckEngine; if (v.state !== "running" || !E || !v.settings || !v.startMs) return "";
    if (v.endedAfterRound) return `<p class="zsmall">You ended the game. It stops after round ${esc(v.endedAfterRound)}.</p>`;
    const now = (v.serverNow || Date.now()) + (Date.now() - (S.fetchedAt || Date.now())), p = E.phaseAt(v.settings, v.startMs, now);
    if (p.kind === "before" || p.kind === "over") return "";
    const cur = p.kind === "break" ? p.afterRound : E.roundOf(v.settings, p.g);
    if (cur >= v.settings.rounds) return `<p class="zsmall">This is the last round. The game ends by itself.</p>`;
    return `<div class="hrow"><button class="zbtn" id="end">End the game after round ${esc(cur)}</button></div><p class="zsmall">The round being played is finished and counted first. Then the game is over for everybody. This cannot be undone.</p>`;
  }
  function paint() {
    const v = S.view; if (!v) { $app.innerHTML = `<p class="zmsg">${esc(S.msg || "Loading...")}</p>`; return; }
    let body = "";
    if (v.state === "open") {
      body = `<div class="zcard"><h2>Before the start</h2><p><b>${esc(v.joined)}</b> players have joined. Share the player link; the list closes when you press Start.</p>${links()}</div>
        <div class="zcard"><h2>Rounds</h2><p class="zsmall">Each round has 10 dice rounds.</p><label for="rounds">Number of rounds (1 to 20)</label><input id="rounds" type="number" min="1" max="20" value="${esc(S.rounds)}">
        <h2>Press window</h2>${chips("windowSecs", [[6, "6 seconds"], [10, "10 seconds"], [15, "15 seconds"]], S.windowSecs)}
        <h2>Prizes</h2><p class="zsmall">A prize is a gift you hand over. Players never pay and there are no cash prizes.</p>${chips("prizeMode", [["both", "Each round and overall"], ["overall", "Overall only"], ["rounds", "Each round only"]], S.prizeMode)}
        ${S.prizeMode !== "rounds" ? `<h3>Overall prizes</h3>${prizeInputs("overall", S.overall)}` : ""}${S.prizeMode !== "overall" ? `<h3>Prizes for each round</h3>${prizeInputs("perRound", S.perRound)}` : ""}
        <label class="tcheck" for="onewin"><input type="checkbox" id="onewin" ${S.oneWin ? "checked" : ""}> A player can win only one prize. The next player in the order gets the other prize.</label>
        <p class="zsmall">There is no tie: if players are equal, the highest single hit, then the most hits, then who reached the score first decide, and a number from the public beacon is the last step. The game starts 20 seconds after you press Start.</p>
        <button class="zbtn" id="start">Start the game</button></div>`;
    } else {
      body = `<div class="zcard"><h2>${v.state === "done" ? "Finished" : "Running"}</h2><p>${esc(v.players || v.joined)} players</p>${progress(v)}${endBlock(v)}${v.state === "done" ? `<p>${v.agreed ? "The result was agreed by the players' phones." : "The phones did not agree on a result."}</p>` : ""}${links()}</div>
        <div class="zcard"><h2>Check the draw</h2><p class="zsmall">Fingerprint (shown before anybody joined): <span class="mono">${esc((v.commit || "").slice(0, 32))}</span></p><p class="zsmall">After the game <a href="${esc(BASE)}/api/z/${esc(EID)}/luck/reveal" target="_blank" rel="noopener">show the secret and the seed</a>. Anybody can re-compute every number from it.</p></div>`;
    }
    $app.innerHTML = `<div class="zhead"><b><a class="zlogo" href="/" aria-label="Corporate Luck by Chance home"><img src="/logo-mark.svg" alt="Corporate Luck by Chance logo" width="20" height="20"></a>Corporate Luck by Chance</b><span class="zsmall">${esc(EID)}</span></div>${S.msg ? `<div class="zbanner warn" role="alert">${esc(S.msg)}</div>` : ""}${body}`;
    document.querySelectorAll(".hchip").forEach((b) => b.addEventListener("click", () => { grab(); const k = b.dataset.k, val = b.dataset.v; S[k] = k === "prizeMode" ? val : Number(val); paint(); }));
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
    on("end", async () => {
      if (!confirm("End the game for everybody after the round now being played? This cannot be undone.")) return;
      try { await call("POST", `/api/z/${EID}/luck/end`, {}); S.msg = ""; } catch (e) { S.msg = e.message; } load();
    });
    on("start", async () => {
      grab();
      const list = (a) => a.map((x) => x.trim()); const trim = (a) => { const l = list(a); while (l.length && !l[l.length - 1]) l.pop(); return l; };
      const rounds = Number(S.rounds), per = trim(S.perRound);
      const settings = { rounds, windowSecs: S.windowSecs, prizeMode: S.prizeMode, oneWinPerPlayer: S.oneWin, prizes: { overall: trim(S.overall), rounds: Array.from({ length: Math.max(0, Math.min(20, rounds)) }, () => per) } };
      if (!confirm("Start now? The list of players closes and cannot be changed.")) return;
      try { await call("POST", `/api/z/${EID}/luck/start`, { settings, delaySecs: 20 }); S.msg = ""; } catch (e) { S.msg = e.message; } load();
    });
  }
  function grab() { const r = document.getElementById("rounds"); if (r) S.rounds = r.value; const o = document.getElementById("onewin"); if (o) S.oneWin = o.checked; document.querySelectorAll("input[data-p]").forEach((el) => { S[el.dataset.p][Number(el.dataset.i)] = el.value; }); }
  async function load() { try { S.view = await (await fetch(BASE + `/api/z/${EID}/luck/view`, { cache: "no-store" })).json(); S.fetchedAt = Date.now(); } catch (e) { S.msg = "Connecting..."; } if (!document.activeElement || document.activeElement.tagName !== "INPUT") paint(); }
  if (!EID) { $app.innerHTML = `<p class="zmsg">Open this page from your console.</p>`; return; }
  if (!key) { $app.innerHTML = `<div class="zcard"><h2>Sign in first</h2><p>Open your console, then choose "Run the game".</p><a class="zbtn" href="/zc.html?e=${encodeURIComponent(EID)}">Open the console</a></div>`; return; }
  load(); setInterval(load, 4000);
})();
