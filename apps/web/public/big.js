/* Corporate Luck by Chance, the big screen (big.html). No sign-in. It reads only the public numbers of the game (nicknames, beacon values as they fall due) and plays the game with the same engine
   the phones use: the target number, the countdown, the top-10 list and the final ceremony. It never joins the game and never shows a seed before the end. */
(function () {
  const $app = document.getElementById("app");
  const q = new URLSearchParams(location.search);
  const EID = (q.get("e") || "").trim();
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BASE = (q.get("api") || "").replace(/\/$/, "");
  const RUN = window.LuckRun.create({ base: BASE, eid: EID });
  const LE = window.LuckEngine, LD = window.LuckDice;
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"));
  const secsTo = (ms) => Math.max(0, Math.ceil((ms - RUN.now()) / 1000));
  let lastKey = "", err = "", INFO = null;
  // the organizer's company name and logo (public settings of the game); without them the page says Corporate Luck by Chance
  const logoOf = (b) => (b && typeof b.logo === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(b.logo) ? b.logo : "");
  const brandHtml = () => (INFO && INFO.brand && (INFO.brand.name || logoOf(INFO.brand)) ? `<span class="brand">${logoOf(INFO.brand) ? `<img class="zblogo" alt="" src="${esc(logoOf(INFO.brand))}">` : ""}${INFO.brand.name ? esc(INFO.brand.name) : "Corporate Luck by Chance"}</span>` : `<span class="brand">Corporate Luck by Chance</span>`);
  if (EID) fetch(BASE + `/api/z/${encodeURIComponent(EID)}/info`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { INFO = j; lastKey = ""; }).catch(() => {});
  const tgtFace = (t, hit) => (t ? `<div class="lb-tface">${LD.miniHtml(t, "Target dice face " + t)}<div class="num${hit ? " hit" : ""}">${t}</div></div><p class="lb-say">Roll a ${t} and you score ${LD.pts(t)}. Any other number scores 0.</p>` : `<div class="lb-tface"><div class="num">...</div></div>`);
  const rows = (list, podium) => (list.length ? `<ol class="${podium ? "lb-podium" : ""}">${list.map((x) => `<li><b>${esc(RUN.nameOf(x.seat))}</b><span>${x.points} pts</span>${x.line ? `<small>${esc(x.line)}</small>` : ""}</li>`).join("")}</ol>` : "");
  const shell = (status, body, commit) => `<header class="top">${brandHtml()}<span class="meta">${esc(status)}</span></header><main class="main1">${body}</main>
    <footer class="meta">Nicknames only. Nothing else about you is shown. <a href="/privacy.html">Privacy</a>${commit ? ` &middot; Game fingerprint <span class="mono">${esc(commit.slice(0, 12))}</span>` : ""}</footer>`;

  async function paint() {
    const v = RUN.view;
    if (!v) { $app.innerHTML = `<p class="msg">${esc(err || "Loading...")}</p>`; return; }
    if (v.state === "open") { const k = "open" + v.joined; if (k === lastKey) return; lastKey = k; $app.innerHTML = shell("Not started", `<div class="big1"><div class="num">${esc(v.joined)}</div><p>players have joined</p><p class="meta">Waiting for the host to start. Each target number is published only when its dice round opens.</p></div>`, v.commit); return; }
    const s = RUN.settings(), g = RUN.game, p = RUN.phase(), gi = p.g !== undefined ? p.g : -1;
    const key = [p.kind, gi, p.afterRound || 0, g.done, RUN.targets[gi] || 0, v.agreed ? 1 : 0].join("|");
    if (key === lastKey) return; lastKey = key;
    const info = gi >= 0 ? `Round ${LE.roundOf(s, gi)} of ${s.rounds} &middot; dice round ${LE.diceNoOf(s, gi)} of ${s.diceRounds}` : "";
    let body = "", status = "Live";
    if (p.kind === "before") body = `<div class="big1"><p class="meta">The game starts in</p><div class="num"><span id="cd" data-until="${v.startMs}">${secsTo(v.startMs)}</span></div><p class="meta">${esc(v.players)} players &middot; ${s.rounds} rounds</p></div>`;
    else if (p.kind === "window") body = `<div class="lb-stage"><div class="lb-target"><p class="meta">${info}</p><div class="lab">Target</div>${tgtFace(RUN.targets[gi])}<div class="cd"><span id="cd" data-until="${p.closesMs}">${secsTo(p.closesMs)}</span> s to press</div></div><div class="lb-top"><h2>Top 10</h2>${rows(await RUN.top())}</div></div>`;
    else if (p.kind === "reveal") { const r = g.results[gi]; const hits = r ? r.dice.reduce((a, d) => a + (d === r.target ? 1 : 0), 0) : 0; body = `<div class="lb-stage"><div class="lb-target"><p class="meta">${info}</p><div class="lab">${r ? "Target" : "Rolling"}</div>${r ? tgtFace(r.target, true) : "<div class=\"lb-tface\"><div class=\"num\">?</div></div>"}${r ? `<div class="cd">${hits} of ${v.players} players hit it</div>` : ""}</div><div class="lb-top"><h2>Top 10</h2>${rows(await RUN.top())}</div></div>`; }
    else if (p.kind === "break") body = `<div class="lb-stage"><div class="lb-top"><h2>Round ${p.afterRound} top 10</h2>${rows(await RUN.roundTop(p.afterRound))}</div><div class="lb-top"><h2>Overall top 10</h2>${rows(await RUN.top())}<p class="meta">Next round in <span id="cd" data-until="${p.endsMs}">${secsTo(p.endsMs)}</span> s</p></div></div>`;
    else {
      status = "Finished"; const fr = g.finished ? await RUN.finalResult() : null;
      if (!fr) body = `<div class="big1"><p class="meta">Adding up the final result...</p></div>`;
      else {
        const prize = (place) => { const t = s.prizeMode !== "rounds" ? s.prizes.overall[place - 1] : ""; return t ? `<span class="lb-prize">${esc(t)}</span>` : ""; };
        body = `<h2>Final result</h2><div class="lb-top"><ol class="lb-podium">${fr.overall.map((x) => `<li><b>${ord(x.place)}: ${esc(RUN.nameOf(x.seat))}</b><span>${x.points} pts</span>${x.place <= 5 ? prize(x.place) : ""}${x.line ? `<small>How this was decided: ${esc(x.line)}</small>` : ""}</li>`).join("")}</ol></div>`;
      }
    }
    $app.innerHTML = shell(status, body, v.commit);
  }
  async function tick() {
    try { await RUN.fetchView(null); err = ""; if (RUN.game) await RUN.advance(); }
    catch (e) { err = e.code === "cancelled" ? "This game was cancelled by the organizer." : e.code === "did-not-start" ? "This game did not start." : e.code === "payment-due" ? "Waiting for the Organizer or Host to start the game." : e.status === 403 ? "This game is not open yet." : e.status === 404 ? "That game was not found." : "Connecting..."; lastKey = ""; }
    try { await paint(); } catch (e) { err = "Connecting..."; }
    setTimeout(tick, RUN.view && RUN.view.state === "running" ? 900 : 4000);
  }
  setInterval(() => document.querySelectorAll("#cd[data-until]").forEach((el) => { el.textContent = secsTo(Number(el.dataset.until)); }), 250);
  if (!EID) { $app.innerHTML = `<p class="msg">Open the link your organizer gave you.</p>`; return; }
  tick();
})();
