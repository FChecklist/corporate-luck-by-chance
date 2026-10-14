/* Corporate Luck by Chance, the dice you see: a realistic ivory dice (a CSS cube: cream rounded faces, black dots, a soft shadow on the table, seen a little from above with the 6 on top), the way it rolls and lands, the words about the score, and the announcement for screen readers.
   Used by the player's page (luck.js), the demo (demo.js) and the preview. It is PRESENTATION ONLY: it is handed the number the game already worked out from the public randomness and shows it.
   It never draws or changes a number (no random numbers here at all: the faces that flash by while it spins follow the clock, nothing else). No images, no libraries, no network. */
(function () {
  "use strict";
  const W = window, D = document;

  // ---------- the faces: dots on a 3 x 3 grid, cells numbered 0..8 left to right, top to bottom ----------
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const pipsOf = (n) => (PIPS[n] || []).slice();
  const pipHtml = (n) => pipsOf(n).map((c) => `<i class="ld-pip p${c}"></i>`).join("");
  /** a flat dice face (the target, the chips). `label` is what a screen reader says. */
  const miniHtml = (n, label, cls, hidden) => `<span class="ld-mini ld-f${n}${cls ? " " + cls : ""}" data-n="${n}" ${hidden ? 'aria-hidden="true"' : `role="img" aria-label="${label || "Dice face " + n}"`}>${pipHtml(n)}</span>`;
  const faceHtml = (n) => `<span class="ld-face ld-f${n}" data-n="${n}">${pipHtml(n)}</span>`;
  /** the rolling dice: a cube of six faces. 3 front, 4 back, 2 right, 5 left, 6 top, 1 bottom (opposite faces add up to 7, like a real dice; at rest the 6 is on top). */
  const dieHtml = (id) => `<div class="ld-die" ${id ? `id="${id}" ` : ""}data-state="idle" role="img" aria-label="Dice, not rolled yet"><div class="ld-hop"><div class="ld-cube">${[1, 2, 3, 4, 5, 6].map(faceHtml).join("")}</div></div><div class="ld-shadow"></div></div>`;
  const burstHtml = () => `<div class="lt-burst" aria-hidden="true">${"<i class=\"lt-conf\"></i>".repeat(14)}</div>`;

  // ---------- the turns of the cube (CSS rotateX(x) rotateY(y) rotateZ(z)) ----------
  const TURN = { 3: [0, 0], 2: [0, -90], 6: [-90, 0], 1: [90, 0], 5: [0, 90], 4: [0, 180] }; // the turn that brings face n to the front
  const IDLE = [-28, -32, 0]; // resting: seen a little from above and from the right, three faces show (the 6 on top, the 3 in front, the 2 at the side)
  const NORMALS = { 3: [0, 0, 1], 4: [0, 0, -1], 2: [1, 0, 0], 5: [-1, 0, 0], 6: [0, -1, 0], 1: [0, 1, 0] };
  const rad = (d) => (d * Math.PI) / 180;
  /** Which face looks at the player after the turn rotateX(ax) rotateY(ay) rotateZ(az)? (the same maths the browser does; used by the tests and to check the landing) */
  function frontFaceOf(ax, ay, az) {
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(rad(ax)), Math.sin(rad(ax)), Math.cos(rad(ay)), Math.sin(rad(ay)), Math.cos(rad(az || 0)), Math.sin(rad(az || 0))];
    const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    const M = mul(mul([[1, 0, 0], [0, cx, -sx], [0, sx, cx]], [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]), [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]);
    let best = 1, bz = -2;
    for (const k of Object.keys(NORMALS)) { const n = NORMALS[k], z = M[2][0] * n[0] + M[2][1] * n[1] + M[2][2] * n[2]; if (z > bz) { bz = z; best = Number(k); } }
    return best;
  }

  // ---------- the words ----------
  const pts = (n) => `${n} ${n === 1 ? "point" : "points"}`;
  /** What the player is told when the dice has landed. `dice` and `target` are the numbers the game worked out; this only words them. */
  function scoreLine(target, dice) {
    const hit = dice === target, points = hit ? target : 0;
    return {
      hit, points,
      head: hit ? `+${pts(points)}` : "Not this time, 0 points",
      small: hit ? `Target ${target}. You rolled ${dice}.` : `Target was ${target}. You rolled ${dice}.`,
      sr: hit ? `You rolled ${dice}. That is the target. You score ${pts(points)}.` : `You rolled ${dice}. Target was ${target}. Not this time. You score 0 points.`,
    };
  }
  const targetWords = (t) => `Roll a ${t} and you score ${pts(t)}. Any other number scores 0.`;

  // ---------- the announcement for screen readers (one quiet live region for the whole page) ----------
  function announce(text) {
    let el = D.getElementById("lt-sr");
    if (!el) { el = D.createElement("div"); el.id = "lt-sr"; el.className = "ld-sr"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); el.setAttribute("aria-atomic", "true"); D.body.appendChild(el); }
    el.textContent = "";
    setTimeout(() => { el.textContent = text; }, 40);
  }

  // ---------- the motion ----------
  let forced = null; // tests can force reduced motion on or off
  const reduced = () => (forced !== null ? forced : !!(W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches));
  const now = () => (W.performance && W.performance.now ? W.performance.now() : Date.now());
  const frame = (fn) => (W.requestAnimationFrame ? W.requestAnimationFrame(fn) : setTimeout(fn, 16));
  const SPIN = [620, 840, 260]; // degrees per second while it tumbles
  const LAND_MS = 1500;
  const clamp01 = (u) => Math.max(0, Math.min(1, u));
  const ease = (u) => 1 - Math.pow(1 - u, 3); // fast first, then slower and slower

  const STATES = {}; // one per dice round (key), so a screen that is drawn again carries on where the dice is
  let cur = null, raf = 0;

  function anglesOf(st, t) {
    if (st.mode === "roll") { if (reduced()) return IDLE.slice(); const s = (t - st.t0) / 1000; return [st.from[0] + SPIN[0] * s, st.from[1] + SPIN[1] * s, st.from[2] + SPIN[2] * s]; }
    if (st.mode === "land") { const p = ease(clamp01((t - st.t0) / st.ms)); return [0, 1, 2].map((i) => st.from[i] + (st.to[i] - st.from[i]) * p); }
    if (st.mode === "show") return [TURN[st.value][0], TURN[st.value][1], 0];
    return IDLE.slice();
  }
  function liftOf(st, t) { // how high it hops (0..1 of its own size): bouncing while it tumbles, smaller and smaller bounces while it settles
    if (st.mode === "roll") return reduced() ? 0 : Math.abs(Math.sin(((t - st.t0) / 1000) * 8.5)) * 0.12;
    if (st.mode === "land") { const u = clamp01((t - st.t0) / st.ms); return Math.pow(1 - u, 2) * Math.abs(Math.sin(u * Math.PI * 3.5)) * 0.14; }
    return 0;
  }
  const SMALL = 0.62; // while it tumbles it is drawn smaller, so a turning cube stays inside its box; it grows to full size as it lands
  function scaleOf(st, t) {
    if (st.mode === "show") return 1;
    if (st.mode === "land") return SMALL + (1 - SMALL) * ease(clamp01((t - st.t0) / st.ms));
    return SMALL + 0.02;
  }
  function render(st, t) {
    if (!cur || cur.key !== st.key) return;
    const a = anglesOf(st, t), lift = liftOf(st, t), sc = scaleOf(st, t);
    cur.cube.style.transform = `rotateX(${a[0].toFixed(2)}deg) rotateY(${a[1].toFixed(2)}deg) rotateZ(${a[2].toFixed(2)}deg)`;
    cur.hop.style.transform = `translateY(${(-lift * cur.size).toFixed(1)}px) scale(${sc.toFixed(3)})`;
    cur.shadow.style.transform = `scale(${((1 - lift * 1.6) * (0.55 + 0.45 * ((sc - SMALL) / (1 - SMALL)))).toFixed(3)})`;
    cur.shadow.style.opacity = String((1 - lift * 2.2).toFixed(2));
  }
  function mark(st) { // the state the page and the tests can read
    if (!cur || cur.key !== st.key) return;
    const el = cur.el, name = st.landed ? "landed" : st.mode === "roll" ? "rolling" : st.mode === "land" ? "landing" : "idle";
    el.setAttribute("data-state", name);
    if (st.landed) { el.setAttribute("data-value", String(st.value)); el.setAttribute("aria-label", `Dice showing ${st.value}`); }
    else { el.removeAttribute("data-value"); el.setAttribute("aria-label", name === "idle" ? "Dice, not rolled yet" : "Dice rolling"); }
  }
  function finish(st) {
    if (st.landed || st.mode === "idle") return;
    st.mode = "show"; st.landed = true; render(st, now()); mark(st);
    const cb = st.onLanded; st.onLanded = null; if (cb) cb(st.value);
  }
  function loop() {
    if (raf) return;
    const step = () => {
      raf = 0;
      const st = cur && STATES[cur.key]; if (!st) return;
      const t = now();
      if (st.mode === "land" && t - st.t0 >= st.ms) finish(st);
      render(st, t);
      if (st.mode === "roll" || st.mode === "land") raf = frame(step);
    };
    raf = frame(step);
  }

  /** Puts the dice controller on a dice element made by dieHtml(). `key` names the dice round: draw the screen again with the same key and the dice carries on. */
  function attach(el, key) {
    if (cur && cur.key !== key && STATES[cur.key]) STATES[cur.key].onLanded = null; // the screen moved on to another dice round: the old one has nobody to tell
    const st = STATES[key] || (STATES[key] = { key, mode: "idle", from: IDLE.slice(), value: 0, landed: false, onLanded: null, t0: 0, ms: 0, to: [0, 0, 0] });
    cur = { el, key, cube: el.querySelector(".ld-cube"), hop: el.querySelector(".ld-hop"), shadow: el.querySelector(".ld-shadow"), size: el.offsetWidth || 112 };
    render(st, now()); mark(st);
    if ((st.mode === "roll" || st.mode === "land") && !reduced()) loop();
    const ctl = {
      key,
      state: () => (st.landed ? "landed" : st.mode === "roll" ? "rolling" : st.mode === "land" ? "landing" : "idle"),
      landed: () => st.landed,
      value: () => (st.landed ? st.value : 0),
      /** start tumbling: it keeps going until land() */
      roll() {
        if (st.landed || st.mode === "roll" || st.mode === "land") return ctl;
        st.mode = "roll"; st.t0 = now(); st.from = anglesOf({ mode: "idle" }, st.t0); mark(st);
        if (!reduced()) loop();
        return ctl;
      },
      /** slow down and stop on `value` (1 to 6). `ms` is how long the slowing down takes. */
      land(value, ms) {
        if (st.landed || st.mode === "land" || !TURN[value]) return ctl;
        st.value = value;
        if (reduced()) { // no tumbling: the face is simply there, with a short fade
          st.mode = "land"; st.ms = 1; st.t0 = now(); st.from = IDLE.slice(); st.to = [TURN[value][0], TURN[value][1], 0];
          mark(st); render({ ...st, mode: "show" }, now());
          setTimeout(() => { if (cur && cur.key === key) finish(st); else { st.mode = "show"; st.landed = true; const cb = st.onLanded; st.onLanded = null; if (cb) cb(value); } }, 190);
          return ctl;
        }
        const t = now(), from = st.mode === "roll" ? anglesOf(st, t) : IDLE.slice(), dur = Math.max(600, Math.min(2600, ms || LAND_MS));
        const turn = (f, goal, per) => goal + 360 * Math.ceil((f + (per * dur) / 3000 - goal) / 360); // the nearest stop after at least a third of the spin speed over the landing
        st.from = from; st.to = [turn(from[0], TURN[value][0], SPIN[0]), turn(from[1], TURN[value][1], SPIN[1]), turn(from[2], 0, SPIN[2])];
        st.mode = "land"; st.t0 = t; st.ms = dur; mark(st); loop();
        setTimeout(() => { if (st.mode === "land") { finish(st); } }, dur + 300); // a hidden tab pauses the animation: the dice still lands
        return ctl;
      },
      /** show the dice already landed on `value`, no animation (a page opened late, or drawn again after landing) */
      show(value) {
        if (!TURN[value]) return ctl;
        st.value = value; st.mode = "show"; st.landed = true; render(st, now()); mark(st); return ctl;
      },
      /** run `fn(value)` when the dice has landed (at once if it has) */
      whenLanded(fn) { if (st.landed) fn(st.value); else st.onLanded = fn; return ctl; },
    };
    return ctl;
  }


  // ---------- the play screen, shared by the player's page and the demo so they look and read the same ----------
  const TICK = '<svg class="lt-ic" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CROSS = '<svg class="lt-ic" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  /** one small chip of the history: the target face, the face you rolled, a tick or a cross, the points. x = { no, t, d, hit, pts } */
  const chipHtml = (x, fresh) => `<li class="lt-chip ${x.hit ? "hit" : "miss"}${fresh ? " fresh" : ""}" data-no="${x.no}" aria-label="Dice round ${x.no}: target ${x.t}, you rolled ${x.d}, ${pts(x.pts)}">${miniHtml(x.t, "", "", true)}<span class="lt-ar" aria-hidden="true">&rarr;</span>${miniHtml(x.d, "", "", true)}${x.hit ? TICK : CROSS}<span aria-hidden="true">${x.hit ? "+" + x.pts : "0"}</span></li>`;
  const chipsHtml = (chips, title) => `<div class="lt-chipsw"><p class="lt-chipsh">${title || "This round so far"}</p><ol class="lt-chips" id="lt-chips">${(chips || []).map((x) => chipHtml(x, false)).join("")}</ol></div>`;
  /**
   * The whole play area as HTML. o = { roundText, segs: ["hit"|"miss"|"now"|"later"...], kicker, target (0 = not known yet), total, enter (true = a new dice round: the screen slides in), status (words under the dice), clock (html), button: { text, disabled }, hint (html), chips, chipsTitle }.
   * Ids used by the page: die, lt-stage, lt-k, lt-num, lt-verdict, lt-total, lt-segs, lt-chips, press.
   */
  function playHtml(o) {
    const t = o.target;
    return `<div class="lt-game${o.enter ? " enter" : ""}" aria-live="off">
      <div class="lt-top"><div class="lt-prog"><p class="lt-progt">${o.roundText}</p><ol class="lt-segs" id="lt-segs" aria-hidden="true">${o.segs.map((c) => `<li class="${c}"></li>`).join("")}</ol></div><div class="lt-score"><span class="lt-score-k">Score</span><b id="lt-total">${o.total}</b></div></div>
      <div class="lt-targetp" role="group" aria-label="Target">${t ? `<span class="lt-tface">${miniHtml(t, "Target dice face " + t)}</span>` : `<span class="lt-tface lt-tnone" aria-hidden="true">?</span>`}<div class="lt-ttext"><p class="lt-tk">${o.kicker}</p>${t ? `<p class="lt-tn">Target number <b class="lt-c${t}">${t}</b></p><p class="lt-ts">${targetWords(t)}</p>` : `<p class="lt-tn">Target coming</p><p class="lt-ts">It shows when this dice round opens.</p>`}</div></div>
      <div class="lt-stage" id="lt-stage" tabindex="-1" role="group" aria-label="Your dice"><div class="lt-diebox">${dieHtml("die")}${burstHtml()}</div><div class="lt-said"><p class="lt-said-k" id="lt-k">Your number</p><p class="lt-said-n" id="lt-num" aria-hidden="true">?</p></div></div>
      <p class="lt-verdict wait" id="lt-verdict">${o.status}</p>
      <p class="lt-clock">${o.clock}</p>
      <button class="lt-press" id="press" type="button"${o.button.disabled ? " disabled" : ""}>${o.button.text}</button>
      <p class="lt-hint">${o.hint}</p></div>${chipsHtml(o.chips, o.chipsTitle)}`;
  }
  const vibrate = (p) => { try { if (W.navigator && W.navigator.vibrate) W.navigator.vibrate(p); } catch (e) { /* no vibration on this phone */ } };
  /**
   * The dice has landed: tell the player. Fills the play area in place. o = { target, dice, total, seg (which segment), chip ({no,t,d,hit,pts}), fresh }.
   * `fresh` = it landed in front of the player now (colour burst, announcement, buzz); false = the screen was drawn again after the landing.
   */
  function showResult(o) {
    const $ = (id) => D.getElementById(id), sc = scoreLine(o.target, o.dice);
    const stage = $("lt-stage"), num = $("lt-num"), verdict = $("lt-verdict"), k = $("lt-k"), tot = $("lt-total"), segs = $("lt-segs"), list = $("lt-chips");
    if (stage) { stage.setAttribute("data-res", sc.hit ? "hit" : "miss"); if (o.fresh) stage.setAttribute("data-fresh", "1"); else stage.removeAttribute("data-fresh"); }
    if (num) { num.textContent = String(o.dice); num.className = "lt-said-n"; num.removeAttribute("aria-hidden"); }
    if (k) k.textContent = "You rolled";
    if (verdict) { verdict.className = "lt-verdict " + (sc.hit ? "hit" : "miss"); verdict.innerHTML = `${sc.head}<small>${sc.small}</small>`; }
    if (tot) { if (o.fresh) { countTo(tot, o.total); tot.classList.remove("bump"); void tot.offsetWidth; tot.classList.add("bump"); } else tot.textContent = String(o.total); }
    if (segs && segs.children[o.seg]) segs.children[o.seg].className = sc.hit ? "hit" : "miss";
    if (list && o.chip && !list.querySelector(`[data-no="${o.chip.no}"]`)) { list.insertAdjacentHTML("beforeend", chipHtml(o.chip, !!o.fresh)); }
    if (o.fresh) { announce(`${sc.sr} Your score is ${o.total}.`); vibrate(sc.hit ? [70, 50, 70] : 30); }
    return sc;
  }
  /** a number that counts up to its new value in a moment (no long animation: 380 ms; at once with reduce-motion) */
  function countTo(el, to, ms) {
    const from = Number(el.textContent) || 0;
    if (reduced() || from === to) { el.textContent = String(to); return; }
    const t0 = now(), total = ms || 380;
    const step = () => { const u = clamp01((now() - t0) / total); el.textContent = String(Math.round(from + (to - from) * ease(u))); if (u < 1) frame(step); else el.textContent = String(to); };
    frame(step); setTimeout(() => { el.textContent = String(to); }, total + 120); // the number is right even if the screen was hidden meanwhile
  }
  /** what the dice of a dice round is doing now (null = never drawn): lets a screen that is drawn again carry on */
  const peek = (key) => { const st = STATES[key]; return st ? { state: st.landed ? "landed" : st.mode === "roll" ? "rolling" : st.mode === "land" ? "landing" : "idle", landed: st.landed, value: st.landed ? st.value : 0 } : null; };

  W.LuckDice = { PIPS, TURN, IDLE, SPIN, LAND_MS, pipsOf, miniHtml, faceHtml, dieHtml, burstHtml, frontFaceOf, scoreLine, targetWords, pts, announce, attach, peek, playHtml, chipHtml, chipsHtml, showResult, vibrate, TICK, CROSS, forceReducedMotion: (v) => { forced = v; }, forget: (key) => { delete STATES[key]; } };
})();
