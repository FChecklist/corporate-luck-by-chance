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
  const head = () => `<div class="zhead"><b><a class="zlogo" href="/" aria-label="Corporate Luck by Chance home"><img src="/logo-mark.svg" alt="Corporate Luck by Chance logo" width="20" height="20"></a>Corporate Luck by Chance</b></div>`;
  const logoOf = (b) => (b && typeof b.logo === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(b.logo) ? b.logo : "");
  const brand = () => (INFO && INFO.brand && (INFO.brand.name || logoOf(INFO.brand)) ? `<div class="zbrand" data-bg="${esc(INFO.brand.color || "#0B5D5B")}" data-fg="#ffffff">${logoOf(INFO.brand) ? `<img class="zblogo" alt="" src="${esc(logoOf(INFO.brand))}">` : ""}${INFO.brand.name ? `<b>${esc(INFO.brand.name)}</b>` : ""}</div>` : "");
  const paintBrand = () => document.querySelectorAll(".zbrand").forEach((el) => { el.style.background = el.dataset.bg; el.style.color = el.dataset.fg; });
  const set = (html) => { $app.innerHTML = html; paintBrand(); };
  
  // ---------- joining: the boxes (K4, wording from the server) come BEFORE the name is asked; nothing is ticked in advance; the server refuses a join without both ticks ----------
  let tb = null, NICK = "", EMP = "", PHONE = ""; // NICK: the nickname typed on the join form, sent again when the organizer lets a waiting person in
  const joinView = () => {
    const isEmail = !!(INFO && INFO.verify === "email"), vm = isEmail ? "id" : (INFO && INFO.verify) || "mobile", needId = vm !== "mobile", needPhone = vm === "both" || vm === "id" || !!(INFO && INFO.joinPhone); // the organizer chose what a person gives to get in
    set(`${brand()}${head()}<div class="zcard zform"><h2>Join the game</h2>
      <p class="zsmall">Playing is free. No money is staked and there are no cash prizes. We ask a nickname only. Other players see it on the top-10 list. Your organizer sees the name you give.</p>
      <p class="spriv"><a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a> &middot; <a href="/terms.html" target="_blank" rel="noopener">Terms</a></p>
      <div id="tbslot"></div>
      <label for="nm">Your nickname</label><input id="nm" autocomplete="nickname" maxlength="40" disabled>
      ${needId ? `${isEmail ? `<label for="emp">Your Email ID</label><input id="emp" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="254" disabled>` : `<label for="emp">Your employee ID</label><input id="emp" autocomplete="off" autocapitalize="characters" maxlength="60" disabled>`}<div id="emphint" class="zsmall" aria-live="polite"></div>` : ""}
      ${needPhone ? `<label for="ph">${needId && vm === "id" ? (isEmail ? "Your mobile number (only if you have no Email ID)" : "Your mobile number (only if you have no employee ID)") : "Your mobile number"}</label><input id="ph" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" disabled>` : ""}
      ${joinMsg ? `<div class="zbanner bad" role="alert">${esc(joinMsg)}</div>` : ""}
      <button class="zbtn" id="go" disabled>Join</button>
      <p class="zsmall"><a href="#" id="watch">I only want to watch</a></p></div>`);
    const nm = document.getElementById("nm"), go = document.getElementById("go");
    const emp = document.getElementById("emp"), ph = document.getElementById("ph");
    const hintEmp = () => { const h = document.getElementById("emphint"); if (h && emp && window.IDCLEAN) h.textContent = isEmail ? IDCLEAN.emailHint(emp.value) : IDCLEAN.empHint(emp.value, !!(INFO && INFO.empClean)); }; if (emp) emp.addEventListener("input", hintEmp);
    if (emp) emp.value = EMP; hintEmp(); if (emp) emp.value = EMP; if (ph) ph.value = PHONE;
    const sync = () => { const ok = !!(tb && tb.ok()); nm.disabled = !ok; if (emp) emp.disabled = !ok; if (ph) ph.disabled = !ok; const idOk = !emp || vm === "id" ? true : emp.value.trim().length > 0, phOk = !ph || (vm === "id" ? true : vm === "both" || !!(INFO && INFO.joinPhone) ? ph.value.replace(/\D/g, "").length >= 10 : true), anyOk = vm !== "id" || (emp.value.trim() || ph.value.trim()); go.disabled = !ok || nm.value.trim().length < 2 || !idOk || !phOk || !anyOk; go.setAttribute("aria-disabled", String(go.disabled)); };
    window.TermsBox.mount(document.getElementById("tbslot"), "K4", { base: BASE, onChange: sync }).then((t) => { tb = t; sync(); });
    nm.addEventListener("input", sync); if (emp) emp.addEventListener("input", sync); if (ph) ph.addEventListener("input", sync);
    document.getElementById("watch").addEventListener("click", (e) => { e.preventDefault(); location.href = "/big.html?e=" + encodeURIComponent(EID); });
    go.addEventListener("click", () => { go.disabled = true; joinMsg = ""; NICK = nm.value.trim(); EMP = emp ? emp.value.trim() : ""; PHONE = ph ? ph.value.trim() : ""; busyTries = 0; doJoin(); });
  };
  // A join that gets no answer at all (a lost connection, a call that timed out) or a busy answer (a whole office joins from one address) is asked again by itself:
  // joining is safe to repeat, the same device gets the same seat. The person sees one calm screen instead of an error, and can stop it and try by hand.
  const BUSY_TRIES = 15;
  let busyTries = 0, busyTimer = 0;
  const busyView = () => {
    set(`${brand()}${head()}<div class="zcard zwait" role="status"><h2>Many people are joining right now</h2><p class="zwait-p">Your request is safe. We are trying again for you every few seconds. Keep this page open.</p><p class="zsmall zwait-n">Try ${busyTries} of ${BUSY_TRIES}.</p></div><div class="zagain"><button class="zbtn s alt" id="again" type="button">Stop and try myself</button></div>`);
    const a = document.getElementById("again"); if (a) a.addEventListener("click", () => { clearTimeout(busyTimer); busyTries = 0; tb = null; joinView(); });
  };
  async function doJoin() {
    try {
      const r = await api("POST", `/api/z/${EID}/join`, { name: NICK, device, consent: tb ? tb.terms() : undefined, ...(EMP ? { [INFO && INFO.verify === "email" ? "email" : "empId"]: EMP } : {}), ...(PHONE ? { phone: PHONE } : {}), ...(TOKEN ? { token: TOKEN } : {}), ...(FROM ? { from: FROM, ...(CAT ? { cat: CAT } : {}) } : {}) });
      clearTimeout(busyTimer); busyTries = 0;
      pid = r.pid; ls.set(pidKey(), pid);
      start();
    } catch (e) {
      if (e.code === "waiting" && e.body && e.body.wid) { clearTimeout(busyTimer); busyTries = 0; waitFor(e.body.wid, e.message); return; }
      if (e.code === "closed") { location.href = "/big.html?e=" + encodeURIComponent(EID); return; }
      if ((e.code === "busy" || !e.status) && busyTries < BUSY_TRIES) { // no answer at all (no status) or a busy answer: ask again by itself, a little later each time
        busyTries++; busyView(); clearTimeout(busyTimer);
        busyTimer = setTimeout(doJoin, Math.round((4 + Math.min(26, busyTries * 2)) * 1000 * (0.7 + (((busyTries * 37) + (parseInt(String(device).slice(-2), 16) || 0)) % 61) / 100)));
        return;
      }
      busyTries = 0; joinMsg = e.message || "Could not join. Please try again."; joinView();
    }
  }

  // ---------- the waiting room: a game by invitation lets a person in once the host approves; the page asks again by itself ----------
  const waitFor = (wid, note) => {
    set(`${brand()}${head()}<div class="zcard" role="status"><h2>Please wait a moment</h2><p>${esc(note || "The host has to let you in.")}</p><p class="zsmall">Keep this page open. It moves on by itself.</p></div>`);
    const again = async () => {
      try {
        const r = await api("GET", `/api/z/${EID}/me?wid=${encodeURIComponent(wid)}`);
        if (r.state === "admitted") { try { const j = await api("POST", `/api/z/${EID}/join`, { name: NICK, device, consent: tb ? tb.terms() : undefined, ...(EMP ? { [INFO && INFO.verify === "email" ? "email" : "empId"]: EMP } : {}), ...(PHONE ? { phone: PHONE } : {}) }); pid = j.pid; ls.set(pidKey(), pid); start(); return; } catch (e) { joinMsg = e.message; joinView(); return; } }
        if (r.state === "declined" || r.state === "lapsed" || r.state === "removed") { set(`${head()}<div class="zcard" role="status"><h2>${r.state === "declined" ? "Your request was not accepted" : "This request is over"}</h2><p class="zsmall">Please ask whoever invited you.</p></div>`); return; }
      } catch (e) { /* the next look tries again */ }
      setTimeout(again, 5000);
    };
    setTimeout(again, 5000);
  };


  // ---------- the game: this phone plays it from the public numbers ----------
  // The numbers (target, dice, points) come from the engine, exactly as before. This part only SHOWS them: the target first, a dice that tumbles while the window is open
  // and slows down onto the number when the window closes, then what it scored (luck-dice.js).
  const RUN = window.LuckRun.create({ base: BASE, eid: EID });
  const LE = window.LuckEngine, LD = window.LuckDice;
  const pressed = {};
  let lastKey = "", stateNow = "", cdTimer = null, lastV = null, usedKeys = false, toldTarget = "", shownGi = -2;
  const secsTo = (ms) => Math.max(0, Math.ceil((ms - RUN.now()) / 1000));
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"));
  const listHtml = (rows, mine) => (rows && rows.length ? `<ol class="trank lt-list">${rows.map((x) => `<li${x.seat === mine ? ' class="me"' : ""}><b>${esc(RUN.nameOf(x.seat))}</b> <span class="lt-pts">${x.points} pts</span>${x.line ? `<small>${esc(x.line)}</small>` : ""}</li>`).join("")}</ol>` : "");
  const prizeFor = (settings, which, place) => { const t = which === "overall" ? settings.prizes.overall : settings.prizes.rounds[which - 1]; return (t && t[place - 1]) || ""; };
  document.addEventListener("keydown", (e) => { if (e.key === "Tab" || e.key === "Enter" || e.key === " ") usedKeys = true; });
  document.addEventListener("pointerdown", () => { usedKeys = false; });
  const keyOf = (v) => { const p = RUN.phase(), gi = p.g !== undefined ? p.g : -1; return [p.kind, gi, p.afterRound || 0, gi >= 0 && pressed[gi] ? 1 : 0, RUN.game ? RUN.game.done : 0, RUN.game ? RUN.game.finished : 0, RUN.targets[gi] || 0, RUN.error ? 1 : 0, v.agreed ? 1 : 0].join("|"); };
  // the dice rounds of the round that dice round gi belongs to, as small chips; only those BEFORE index `upTo` (the one that is landing now is added when it has landed)
  const chipsOf = (g, s, seat, gi, upTo) => { const first = (LE.roundOf(s, gi) - 1) * s.diceRounds, out = []; for (let i = first; i < upTo; i++) { const r = g.results[i]; if (!r) continue; const d = r.dice[seat]; out.push({ no: LE.diceNoOf(s, i), t: r.target, d, hit: d === r.target, pts: r.points[seat] || 0 }); } return out; };
  const segsOf = (g, s, seat, gi, upTo) => { const first = (LE.roundOf(s, gi) - 1) * s.diceRounds, out = []; for (let k = 0; k < s.diceRounds; k++) { const i = first + k, r = i < upTo ? g.results[i] : null; out.push(r ? (r.dice[seat] === r.target ? "hit" : "miss") : i === gi ? "now" : "later"); } return out; };

  async function paint(v) {
    lastV = v;
    const g = RUN.game, s = RUN.settings(), p = RUN.phase(), seat = v.you ? v.you.seat : -1;
    if (window.ctzView) window.ctzView({ phase: p.kind === "over" ? "ended" : String(p.kind || "") }); // the flight recorder (blackbox.js) learns the stage
    const gi = p.g !== undefined ? p.g : -1;
    const key = keyOf(v);
    if (key === lastKey) return; lastKey = key;
    const me = seat >= 0 ? g.total[seat] : null;
    const roundTotal = me && gi >= 0 ? g.roundTallies[LE.roundOf(s, gi) - 1][seat].points : 0;
    const totals = me ? `<p class="lt-totals">This round <b>${roundTotal}</b> &middot; Total <b>${me.points}</b>${g.done ? ` &middot; ${standing(seat)}` : ""}</p>` : "";
    const noise = RUN.error ? `<p class="zsmall tcen" role="status">Connecting again...</p>` : "";
    let body = "", after = null;
    if (p.kind === "before") body = `<div class="zcard lt-play" role="status"><div class="lt-hero">${LD.dieHtml("")}</div><div class="lt-count"><span>The game starts in</span><b id="cd" data-until="${v.startMs}">${secsTo(v.startMs)}</b><span>s</span></div><p>${s.rounds} ${s.rounds === 1 ? "round" : "rounds"} of ${s.diceRounds} dice rounds. Each dice round shows a target number. Press the dice. Roll the target and you score that many points. Any other number scores 0. Pure luck: nobody can know a result in advance.</p><p class="zsmall">Keep this page open.</p></div>`;
    else if (p.kind === "window" || p.kind === "reveal") {
      const inWindow = p.kind === "window", t = RUN.targets[gi] || 0, r = inWindow ? null : g.results[gi], dv = r && seat >= 0 ? r.dice[seat] : 0;
      const dieKey = "g" + gi, pk = LD.peek(dieKey), landedAlready = !!(pk && pk.landed);
      const gain = r && seat >= 0 ? r.points[seat] || 0 : 0;
      const showTotal = me ? me.points - (r && !landedAlready ? gain : 0) : 0; // the running score does not jump before the dice has landed
      const pr = !!pressed[gi];
      const status = inWindow ? (pr ? "Pressed. Your dice lands when the timer ends." : t ? "Press the dice to roll it." : "Waiting for the target...") : r ? "Slowing down..." : "Rolling...";
      const btn = inWindow ? { text: pr ? "Rolling..." : "Press the dice", disabled: pr || !t } : { text: pr || r ? "Rolling..." : "Window closed", disabled: true };
      body = LD.playHtml({
        roundText: `Round ${LE.roundOf(s, gi)} of ${s.rounds}`, segs: segsOf(g, s, seat, gi, gi), kicker: `Dice round ${LE.diceNoOf(s, gi)} of ${s.diceRounds}`, target: t, total: showTotal, status,
        clock: inWindow ? `<span id="cd" data-until="${p.closesMs}">${secsTo(p.closesMs)}</span> s left to press` : `Next in <span id="cd" data-until="${p.endsMs}">${secsTo(p.endsMs)}</span> s`,
        button: btn, hint: "Every dice lands at the same moment, when the timer ends.", chips: chipsOf(g, s, seat, gi, gi), enter: gi !== shownGi,
      }) + (r ? `<div class="zcard" id="lt-top10" hidden><h2>Top 10</h2>${listHtml(await RUN.top(), seat)}${me ? `<p class="zsmall">${standing(seat)}</p>` : ""}</div>` : "") + noise;
      after = () => {
        const dieEl = document.getElementById("die"); if (!dieEl) return;
        const ctl = LD.attach(dieEl, dieKey), pb = document.getElementById("press");
        if (inWindow) {
          if (pr) ctl.roll();
          if (t && toldTarget !== "t" + gi) { toldTarget = "t" + gi; LD.announce(`Round ${LE.roundOf(s, gi)} of ${s.rounds}. Dice round ${LE.diceNoOf(s, gi)} of ${s.diceRounds}. Target number ${t}. ${LD.targetWords(t)}`); }
          if (pb && !pb.disabled) {
            if (usedKeys) { try { pb.focus({ preventScroll: true }); } catch (e) { pb.focus(); } }
            pb.addEventListener("click", () => {
              if (pressed[gi]) return; pressed[gi] = true; LD.vibrate(40);
              pb.disabled = true; pb.textContent = "Rolling..."; pb.classList.add("tap");
              ctl.roll();
              const vd = document.getElementById("lt-verdict"); if (vd) vd.textContent = "Pressed. Your dice lands when the timer ends.";
              const st = document.getElementById("lt-stage"); if (st && usedKeys) st.focus({ preventScroll: true }); // the button is now off: keep the keyboard place on the dice
              LD.announce("Rolling. Your dice lands when the timer ends.");
              lastKey = keyOf(lastV || v);
            });
          }
        } else if (!r || dv < 1) { ctl.roll(); }
        else {
          const chip = { no: LE.diceNoOf(s, gi), t: r.target, d: dv, hit: dv === r.target, pts: gain };
          const fill = (fresh) => { if (RUN.phase().g !== gi) return; LD.showResult({ target: r.target, dice: dv, total: me ? me.points : 0, seg: LE.diceNoOf(s, gi) - 1, chip, fresh }); const pb2 = document.getElementById("press"); if (pb2) pb2.textContent = "Next dice round soon"; const t10 = document.getElementById("lt-top10"); if (t10) t10.hidden = false; };
          if (landedAlready) { ctl.show(dv); fill(false); }
          else {
            const sinceReveal = RUN.now() - (p.endsMs - s.revealSecs * 1000);
            if (ctl.state() === "idle" && sinceReveal > 1500) { ctl.show(dv); fill(false); } // opened late: no use in rolling a dice for something that is over
            else { ctl.land(dv, Math.max(700, Math.min(LD.LAND_MS, p.endsMs - RUN.now() - 700))); ctl.whenLanded(() => fill(true)); }
          }
        }
      };
    } else if (p.kind === "break") {
      const r = p.afterRound;
      body = `<div class="zcard lt-wait" role="status"><div class="lt-hero">${LD.dieHtml("")}</div><h2>Round ${r} is over</h2><div class="lt-count"><span>Next round starts in</span><b id="cd" data-until="${p.endsMs}">${secsTo(p.endsMs)}</b><span>s</span></div>${totals}</div>
        <div class="zcard"><h2>Round ${r} top 10</h2>${listHtml(await RUN.roundTop(r), seat)}</div><div class="zcard"><h2>Overall top 10</h2>${listHtml(await RUN.top(), seat)}</div>`;
    } else {
      const fr = g.finished ? await RUN.finalResult() : null;
      if (!fr) body = `<div class="zcard" role="status"><h2>Adding up</h2><p>Working out the final result on your phone...</p>${noise}</div>`;
      else {
        const top5 = fr.overall.slice(0, 5).map((x) => { const pz = s.prizeMode !== "rounds" ? prizeFor(s, "overall", x.place) : ""; return `<li${x.seat === seat ? ' class="me"' : ""}><b>${ord(x.place)}: ${esc(RUN.nameOf(x.seat))}</b> <span class="lt-pts">${x.points} pts</span>${pz ? `<span class="lt-prize">${esc(pz)}</span>` : ""}${x.line ? `<small>How this was decided: ${esc(x.line)}</small>` : ""}</li>`; }).join("");
        const rest = fr.overall.slice(5);
        const rounds = s.prizeMode !== "overall" ? fr.rounds.map((l, i) => `<details><summary>Round ${i + 1} winners</summary>${l.slice(0, 5).map((x) => `<p class="zsmall"><b>${ord(x.place)}</b> ${esc(RUN.nameOf(x.seat))} (${x.points} pts)${prizeFor(s, i + 1, x.place) ? " - " + esc(prizeFor(s, i + 1, x.place)) : ""}${x.line ? "<br>" + esc(x.line) : ""}</p>`).join("")}</details>`).join("") : "";
        body = `<div class="zcard" role="status"><h2>The game is over</h2>${me ? `<p class="lt-fin">You scored <b>${me.points}</b> points. ${standing(seat)}</p>` : ""}<ol class="trank lt-list lt-final">${top5}</ol>${rest.length ? `<h3>Places 6 to 10</h3>${listHtml(rest, seat)}` : ""}</div>${rounds ? `<div class="zcard">${rounds}</div>` : ""}
          <p class="zsmall tcen">Every phone worked this out from the same public numbers. The result is published when enough phones agree.</p>`;
      }
    }
    set(`${brand()}${head()}${body}`);
    shownGi = p.kind === "window" || p.kind === "reveal" ? gi : -2;
    if (after) after();
  }
  function standing(seat) { const st = LE.standingOf(RUN.game.total, seat); return st.of > 1 ? (st.percent <= 50 ? `You are in the top ${st.percent}% of ${st.of} players.` : `You are ${ord(st.ahead + 1)} of ${st.of} players.`) : ""; } // "top 100%" confused people: in the lower half the place is said as a place
  const tickCd = () => document.querySelectorAll("#cd[data-until]").forEach((el) => { el.textContent = secsTo(Number(el.dataset.until)); });

  const tick = async () => {
    clearTimeout(timer);
    try {
      const v = await RUN.fetchView({ pid, device });
      stateNow = v.state;
      if (v.state === "open") {
        set(`${brand()}${head()}<div class="zcard lt-wait" role="status"><div class="lt-hero">${LD.dieHtml("")}</div><h2>You are in</h2><p>Waiting for the host to start the game.</p>${v.joined ? `<p><span class="lt-pill">${esc(v.joined)} joined so far</span></p>` : ""}<p class="zsmall">Nobody can know the targets or the dice in advance: each target is published only when its dice round opens. The fingerprint of this game: <span class="mono">${esc((v.commit || "").slice(0, 16))}</span>.</p></div>`);
      } else if (v.phase === "watching") {
        set(`${head()}<div class="zcard" role="status"><h2>${esc(v.message)}</h2><p><a href="/big.html?e=${encodeURIComponent(EID)}">Open the big screen view</a></p></div>`);
      } else {
        await RUN.advance(); await paint(v);
        if (RUN.game && RUN.game.finished) { try { await RUN.vote({ pid, device }); } catch (e) { /* tried again at the next look */ } }
      }
    } catch (e) {
      if (e.code === "removed") { set(`${head()}<div class="zcard" role="status"><h2>You were removed from this game</h2><p class="zsmall">The organizer removed you from this game. If you think this is a mistake, please ask the organizer.</p></div>`); return; }
      if (e.status === 403 && !e.code && (stateNow === "running" || stateNow === "done")) { set(`${head()}<div class="zcard" role="status"><h2>You are no longer in this game</h2><p class="zsmall">Your place was removed by the organizer. If you think this is a mistake, please ask the organizer.</p></div>`); return; }
      if (e.status === 403 || e.status === 400) { ls.del(pidKey()); pid = ""; joinMsg = e.code === "other-phone" ? "This place is on another phone." : ""; joinView(); return; }
      if (e.code === "cancelled" || e.code === "did-not-start") { set(`${head()}<div class="zcard" role="status"><h2>${e.code === "cancelled" ? "This game was cancelled by the organizer" : "This game did not start"}</h2><p class="zsmall">There is nothing to do on this page.</p></div>`); return; }
      if (e.code === "payment-due") { set(`${head()}<div class="zcard" role="status"><h2>Waiting for the Organizer or Host to start the game.</h2><p class="zsmall">This page moves on by itself.</p></div>`); lastKey = ""; timer = setTimeout(tick, 4000); return; }
      set(`${head()}<div class="zcard" role="status"><h2>No connection</h2><p class="zsmall">Trying again in a moment.</p></div>`); lastKey = "";
    }
    timer = setTimeout(tick, stateNow === "open" ? 3000 : 900);
  };
  cdTimer = setInterval(tickCd, 250);
  const start = () => { if (!pid) joinView(); else tick(); };
  if (!EID) { set(`${head()}<div class="zcard"><h2>Open your game link</h2><p class="zsmall">Ask your organizer for the link to this game.</p></div>`); return; }
  api("GET", `/api/z/${EID}/info`).then((i) => { INFO = i; if (i.cancelled) { set(`${head()}<div class="zcard" role="status"><h2>This game was cancelled by the organizer</h2></div>`); return; } start(); }).catch((e) => { if (e.status === 404) set(`${head()}<div class="zcard" role="status"><h2>We could not find this game</h2><p class="zsmall">Please check the link your organizer sent you.</p></div>`); else if (e.status === 403) set(`${head()}<div class="zcard" role="status"><h2>This game is not open yet</h2><p class="zsmall">Please try again later.</p></div>`); else start(); });
  void cdTimer;
})();
