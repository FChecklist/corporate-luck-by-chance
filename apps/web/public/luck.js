/* Corporate Luck by Chance, the player's page (z.html). Phone first. Joins with a nickname only, then shows the waiting room, the target, the dice, the result and the top-10 list.
   Nothing is decided on the server: this phone plays the whole game from the public beacon values with the engine (luck-engine.js), exactly like every other phone (docs/RULES.md). */
(function () {
  const $app = document.getElementById("app");
  const q = new URLSearchParams(location.search);
  const BASE = (q.get("api") || "").replace(/\/$/, "");
  let EID = q.get("e") || "";
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode: the page still works until it is closed */ } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* nothing to remove */ } } };
  if (!EID) EID = ls.get("luck:last") || ""; else ls.set("luck:last", EID);
  const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
  let device = ls.get("luck:device"); if (!/^[0-9a-f]{32}$/.test(device || "")) { device = hex(16); ls.set("luck:device", device); }
  const pidKey = () => "luck:" + EID + ":pid";
  let pid = ls.get(pidKey()) || "";
  const TOKEN = (q.get("t") || "").trim().slice(0, 80), FROM = Number(q.get("from")) || 0, CAT = (q.get("c") || "").slice(0, 20);
  let skew = 0, timer = null, last = null, joinMsg = "", INFO = null;
  const api = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || "http " + r.status), { status: r.status, code: j.code, body: j });
    return j;
  };
  const head = () => `<div class="zhead"><b>Corporate Luck by Chance</b></div>`;
  const brand = () => (INFO && INFO.brand && INFO.brand.name ? `<div class="zbrand" data-bg="${esc(INFO.brand.color)}" data-fg="#ffffff"><b>${esc(INFO.brand.name)}</b></div>` : "");
  const paintBrand = () => document.querySelectorAll(".zbrand").forEach((el) => { el.style.background = el.dataset.bg; el.style.color = el.dataset.fg; });
  const set = (html) => { $app.innerHTML = html; paintBrand(); };
  
  // ---------- joining: the boxes (K4, wording from the server) come BEFORE the name is asked; nothing is ticked in advance; the server refuses a join without both ticks ----------
  let tb = null;
  const joinView = () => {
    set(`${brand()}${head()}<div class="zcard zform"><h2>Join the game</h2>
      <p class="zsmall">Playing is free. No money is staked and there are no cash prizes. We ask a nickname only. Other players see it on the top-10 list. Your organizer sees the name you give.</p>
      <p class="spriv"><a href="/legal.html#privacy" target="_blank" rel="noopener">Privacy Policy</a> &middot; <a href="/terms.html" target="_blank" rel="noopener">Terms</a></p>
      <div id="tbslot"></div>
      <label for="nm">Your nickname</label><input id="nm" autocomplete="nickname" maxlength="40" disabled>
      ${joinMsg ? `<div class="zbanner bad" role="alert">${esc(joinMsg)}</div>` : ""}
      <button class="zbtn" id="go" disabled>Join</button>
      <p class="zsmall"><a href="#" id="watch">I only want to watch</a></p></div>`);
    const nm = document.getElementById("nm"), go = document.getElementById("go");
    const sync = () => { const ok = !!(tb && tb.ok()); nm.disabled = !ok; go.disabled = !ok || nm.value.trim().length < 2; go.setAttribute("aria-disabled", String(go.disabled)); };
    window.TermsBox.mount(document.getElementById("tbslot"), "K4", { base: BASE, onChange: sync }).then((t) => { tb = t; sync(); });
    nm.addEventListener("input", sync);
    document.getElementById("watch").addEventListener("click", (e) => { e.preventDefault(); location.href = "/big.html?e=" + encodeURIComponent(EID); });
    go.addEventListener("click", async () => {
      go.disabled = true; joinMsg = "";
      try {
        const r = await api("POST", `/api/z/${EID}/join`, { name: nm.value.trim(), device, consent: tb.terms(), ...(TOKEN ? { token: TOKEN } : {}), ...(FROM ? { from: FROM, ...(CAT ? { cat: CAT } : {}) } : {}) });
        pid = r.pid; ls.set(pidKey(), pid);
        start();
      } catch (e) {
        if (e.code === "waiting" && e.body && e.body.wid) { waitFor(e.body.wid, e.message); return; }
        if (e.code === "closed") { location.href = "/big.html?e=" + encodeURIComponent(EID); return; }
        joinMsg = e.message || "Could not join. Please try again."; joinView();
      }
    });
  };

  // ---------- the waiting room: a game by invitation lets a person in once the host approves; the page asks again by itself ----------
  const waitFor = (wid, note) => {
    set(`${brand()}${head()}<div class="zcard" role="status"><h2>Please wait a moment</h2><p>${esc(note || "The host has to let you in.")}</p><p class="zsmall">Keep this page open. It moves on by itself.</p></div>`);
    const again = async () => {
      try {
        const r = await api("GET", `/api/z/${EID}/me?wid=${encodeURIComponent(wid)}`);
        if (r.state === "admitted") { try { const j = await api("POST", `/api/z/${EID}/join`, { name: "", device, consent: tb ? tb.terms() : undefined }); pid = j.pid; ls.set(pidKey(), pid); start(); return; } catch (e) { joinMsg = e.message; joinView(); return; } }
        if (r.state === "declined" || r.state === "lapsed" || r.state === "removed") { set(`${head()}<div class="zcard" role="status"><h2>${r.state === "declined" ? "Your request was not accepted" : "This request is over"}</h2><p class="zsmall">Please ask whoever invited you.</p></div>`); return; }
      } catch (e) { /* the next look tries again */ }
      setTimeout(again, 5000);
    };
    setTimeout(again, 5000);
  };


  // ---------- the game: this phone plays it from the public numbers ----------
  const RUN = window.LuckRun.create({ base: BASE, eid: EID });
  const LE = window.LuckEngine;
  const pressed = {};
  let lastKey = "", stateNow = "", cdTimer = null;
  const secsTo = (ms) => Math.max(0, Math.ceil((ms - RUN.now()) / 1000));
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"));
  const listHtml = (rows, mine) => (rows && rows.length ? `<ol class="trank lt-list">${rows.map((x) => `<li${x.seat === mine ? ' class="me"' : ""}><b>${esc(RUN.nameOf(x.seat))}</b> <span class="lt-pts">${x.points} pts</span>${x.line ? `<small>${esc(x.line)}</small>` : ""}</li>`).join("")}</ol>` : "");
  const prizeFor = (settings, which, place) => { const t = which === "overall" ? settings.prizes.overall : settings.prizes.rounds[which - 1]; return (t && t[place - 1]) || ""; };

  async function paint(v) {
    const g = RUN.game, s = RUN.settings(), p = RUN.phase(), seat = v.you ? v.you.seat : -1;
    const gi = p.g !== undefined ? p.g : -1;
    const key = [p.kind, gi, p.afterRound || 0, gi >= 0 && pressed[gi] ? 1 : 0, g.done, RUN.targets[gi] || 0, RUN.error ? 1 : 0, v.agreed ? 1 : 0].join("|");
    if (key === lastKey) return; lastKey = key;
    const info = gi >= 0 ? `Dice round ${LE.diceNoOf(s, gi)} of ${s.diceRounds}, round ${LE.roundOf(s, gi)} of ${s.rounds}` : "";
    const me = seat >= 0 ? g.total[seat] : null;
    const roundTotal = me && gi >= 0 ? g.roundTallies[LE.roundOf(s, gi) - 1][seat].points : 0;
    const totals = me ? `<p class="lt-totals">This round <b>${roundTotal}</b> &middot; Total <b>${me.points}</b>${g.done ? ` &middot; ${standing(seat)}` : ""}</p>` : "";
    const noise = RUN.error ? `<p class="zsmall tcen" role="status">Connecting again...</p>` : "";
    let body = "";
    if (p.kind === "before") body = `<div class="zcard" role="status"><h2>The game starts in <span id="cd" data-until="${v.startMs}">${secsTo(v.startMs)}</span> s</h2><p>${s.rounds} rounds of ${s.diceRounds} dice rounds. In each one a target number appears. Press the dice. If your dice shows the target you score that many points, otherwise nothing. Pure luck: nobody can know a result in advance.</p><p class="zsmall">Keep this page open.</p></div>`;
    else if (p.kind === "window") {
      const t = RUN.targets[gi];
      body = `<div class="zcard lt-play"><p class="lt-info">${esc(info)}</p><p class="lt-label">Target</p><div class="lt-target" role="status" aria-label="Target number ${t || "loading"}">${t || "..."}</div>
        <p class="lt-clock"><span id="cd" data-until="${p.closesMs}">${secsTo(p.closesMs)}</span> s left to press</p>
        <button class="lt-dice ${pressed[gi] ? "pressed" : ""}" id="press" ${pressed[gi] || !t ? "disabled" : ""}>${pressed[gi] ? "Rolling..." : "Press the dice"}</button>
        <p class="zsmall tcen">${pressed[gi] ? "Pressed. The dice shows when the window closes." : "The dice is rolled for everyone when the window closes. Pressing is your moment."}</p>${totals}</div>`;
    } else if (p.kind === "reveal") {
      const r = g.results[gi];
      if (!r) body = `<div class="zcard lt-play" role="status"><p class="lt-info">${esc(info)}</p><p class="lt-label">Rolling...</p><div class="lt-target">?</div>${noise}</div>`;
      else {
        const d = r.dice[seat], hit = d === r.target;
        body = `<div class="zcard lt-play" role="status"><p class="lt-info">${esc(info)}</p><p class="lt-label">You rolled</p><div class="lt-target ${hit ? "hit" : "miss"}">${d}</div>
          <p class="lt-result">${hit ? `Target was ${r.target}: +${r.target} points` : `Target was ${r.target}: 0 points`}</p>${totals}</div>${listHtml(await RUN.top(), seat)}`;
      }
    } else if (p.kind === "break") {
      const r = p.afterRound;
      body = `<div class="zcard" role="status"><h2>Round ${r} is over</h2><p>Next round starts in <span id="cd" data-until="${p.endsMs}">${secsTo(p.endsMs)}</span> s.</p>${totals}</div>
        <div class="zcard"><h2>Round ${r} top 10</h2>${listHtml(await RUN.roundTop(r), seat)}</div><div class="zcard"><h2>Overall top 10</h2>${listHtml(await RUN.top(), seat)}</div>`;
    } else {
      const fr = g.finished ? await RUN.finalResult() : null;
      if (!fr) body = `<div class="zcard" role="status"><h2>Adding up</h2><p>Working out the final result on your phone...</p>${noise}</div>`;
      else {
        const top5 = fr.overall.slice(0, 5).map((x) => { const pz = s.prizeMode !== "rounds" ? prizeFor(s, "overall", x.place) : ""; return `<li${x.seat === seat ? ' class="me"' : ""}><b>${ord(x.place)}: ${esc(RUN.nameOf(x.seat))}</b> <span class="lt-pts">${x.points} pts</span>${pz ? `<span class="lt-prize">${esc(pz)}</span>` : ""}${x.line ? `<small>How this was decided: ${esc(x.line)}</small>` : ""}</li>`; }).join("");
        const rest = fr.overall.slice(5);
        const rounds = s.prizeMode !== "overall" ? fr.rounds.map((l, i) => `<details><summary>Round ${i + 1} winners</summary>${l.slice(0, 5).map((x) => `<p class="zsmall"><b>${ord(x.place)}</b> ${esc(RUN.nameOf(x.seat))} (${x.points} pts)${prizeFor(s, i + 1, x.place) ? " - " + esc(prizeFor(s, i + 1, x.place)) : ""}${x.line ? "<br>" + esc(x.line) : ""}</p>`).join("")}</details>`).join("") : "";
        body = `<div class="zcard" role="status"><h2>The game is over</h2>${me ? `<p>You scored <b>${me.points}</b> points. ${standing(seat)}</p>` : ""}<ol class="trank lt-list lt-final">${top5}</ol>${rest.length ? `<h3>Places 6 to 10</h3>${listHtml(rest, seat)}` : ""}</div>${rounds ? `<div class="zcard">${rounds}</div>` : ""}
          <p class="zsmall tcen">Every phone worked this out from the same public numbers. The result is published when enough phones agree.</p>`;
      }
    }
    set(`${brand()}${head()}${body}`);
    const pb = document.getElementById("press");
    if (pb) pb.addEventListener("click", () => { pressed[gi] = true; try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) { /* no vibration on this phone */ } lastKey = ""; paint(v); });
  }
  function standing(seat) { const st = LE.standingOf(RUN.game.total, seat); return st.of > 1 ? `You are in the top ${st.percent}% of ${st.of} players.` : ""; }
  const tickCd = () => document.querySelectorAll("#cd[data-until]").forEach((el) => { el.textContent = secsTo(Number(el.dataset.until)); });

  const tick = async () => {
    clearTimeout(timer);
    try {
      const v = await RUN.fetchView({ pid, device });
      stateNow = v.state;
      if (v.state === "open") {
        set(`${brand()}${head()}<div class="zcard" role="status"><h2>You are in</h2><p>Waiting for the host to start the game. ${v.joined ? esc(v.joined) + " joined so far." : ""}</p><p class="zsmall">Nobody can know the numbers in advance: the first number is published only when each dice round opens. The fingerprint of this game: <span class="mono">${esc((v.commit || "").slice(0, 16))}</span>.</p></div>`);
      } else if (v.phase === "watching") {
        set(`${head()}<div class="zcard" role="status"><h2>${esc(v.message)}</h2><p><a href="/big.html?e=${encodeURIComponent(EID)}">Open the big screen view</a></p></div>`);
      } else {
        await RUN.advance(); await paint(v);
        if (RUN.game && RUN.game.finished) { try { await RUN.vote({ pid, device }); } catch (e) { /* tried again at the next look */ } }
      }
    } catch (e) {
      if (e.status === 403 || e.status === 400) { ls.del(pidKey()); pid = ""; joinMsg = e.code === "other-phone" ? "This place is on another phone." : ""; joinView(); return; }
      if (e.code === "cancelled" || e.code === "did-not-start") { set(`${head()}<div class="zcard" role="status"><h2>${e.code === "cancelled" ? "This game was cancelled" : "This game did not start"}</h2><p class="zsmall">There is nothing to do on this page.</p></div>`); return; }
      set(`${head()}<div class="zcard" role="status"><h2>No connection</h2><p class="zsmall">Trying again in a moment.</p></div>`); lastKey = "";
    }
    timer = setTimeout(tick, stateNow === "open" ? 3000 : 900);
  };
  cdTimer = setInterval(tickCd, 250);
  const start = () => { if (!pid) joinView(); else tick(); };
  if (!EID) { set(`${head()}<div class="zcard"><h2>Open your game link</h2><p class="zsmall">Ask your organizer for the link to this game.</p></div>`); return; }
  api("GET", `/api/z/${EID}/info`).then((i) => { INFO = i; if (i.cancelled) { set(`${head()}<div class="zcard" role="status"><h2>This game was cancelled</h2></div>`); return; } start(); }).catch((e) => { if (e.status === 403 || e.status === 404) set(`${head()}<div class="zcard" role="status"><h2>This game is not open yet</h2><p class="zsmall">Please try again later.</p></div>`); else start(); });
  void cdTimer;
})();
