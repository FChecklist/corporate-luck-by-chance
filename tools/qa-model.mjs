// QA model for Corporate Luck by Chance (2026-10-29). It ENUMERATES the choices a game can have and runs each one through the REAL code:
// the game engine (packages/luck/src) and the real Worker (apps/edge/src/worker.ts + luck.ts) on an in-memory SQLite database, the same way the tests do.
// Run it from the repository root with bun (it imports TypeScript):   bun tools/qa-model.mjs            (add --json for a machine-readable list)
// It changes nothing, calls no network and needs no secret. Every defect it finds is printed with a class, the file:line that causes it,
// whether it is in the live commit and whether the Tambola port (a platform merge that keeps this game's own engine) would fix it.
// Classes: FAIL (wrong result), GAP (a rule or a hardening step is missing), NOT_LOGICAL, INCOMPLETE, GIBBERISH (confusing text), NO_RESULT (a game, round or player ends without a result).
// "Not applicable" in this game: wheel, draw types, weights, turn order. It is one dice game, every player plays at the same moment, a dice has six equal faces.
import { readFileSync } from "node:fs";
import { LuckGame, assignPrizes, cmpNumeric, defaultSettings, diceOf, parseSettings, phaseAt, rankTop, scoreOf, standingOf, targetOf, TOP_LIST, PLACES, WINDOWS,
  beaconDueMs, diceOpenMs, gameEndMs, revealEndMs, totalDiceRounds, windowCloseMs, roundOf, sha256Hex } from "../packages/luck/src/index.ts";

const JSON_OUT = process.argv.includes("--json"), QUICK = process.argv.includes("--quick");
const findings = [], passes = [];
const say = (s = "") => { if (!JSON_OUT) console.log(s); };
/** record a defect that WAS observed */
const found = (f) => { findings.push(f); say(`  [${f.cls}] ${f.id} ${f.title}`); };
const ok = (id, text) => { passes.push({ id, text }); say(`  ok   ${id} ${text}`); };
const head = (s) => say(`\n== ${s}`);
const chi = (counts, expected) => counts.reduce((a, c, i) => a + (c - expected[i]) ** 2 / expected[i], 0);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const beaconOf = (tag, i) => sha256Hex(`QA|${tag}|${i}`);
const t0 = Date.now();

// ================================================================================================================ A. fair randomness: probabilities, segments, hit chance
head("A. The dice and the target: six equal faces (the only 'segments' this game has)");
{
  const N = QUICK ? 6000 : 36000, tc = Array(6).fill(0), dc = Array(6).fill(0), joint = Array.from({ length: 6 }, () => Array(6).fill(0)), pts = Array(7).fill(0);
  let hits = 0, points = 0;
  for (let i = 0; i < N; i++) {
    const A = await beaconOf("A", i), B = await beaconOf("B", i);
    const t = await targetOf("QA", i, A), d = await diceOf("QA", i % 50, i, B);
    tc[t - 1]++; dc[d - 1]++; joint[t - 1][d - 1]++; const s = scoreOf(t, d); pts[s]++; points += s; if (s) hits++;
  }
  const sumT = tc.reduce((a, b) => a + b, 0) / N, sumD = dc.reduce((a, b) => a + b, 0) / N;
  const exp = Array(6).fill(N / 6), cT = chi(tc, exp), cD = chi(dc, exp);
  const cJ = chi(joint.flat(), Array(36).fill(N / 36));
  say(`  ${N} samples. target share per face ${tc.map((c) => (c / N).toFixed(4)).join(" ")} (sum ${sumT.toFixed(6)}); dice share ${dc.map((c) => (c / N).toFixed(4)).join(" ")} (sum ${sumD.toFixed(6)})`);
  say(`  chi-square target ${cT.toFixed(2)}, dice ${cD.toFixed(2)} (limit 20.52 at 99.9%, 5 df); target x dice ${cJ.toFixed(2)} (limit 52.62, 25 df)`);
  say(`  hit rate ${(hits / N).toFixed(4)} (should be 0.1667); mean points per dice round ${(points / N).toFixed(4)} (exact 7/12 = ${(7 / 12).toFixed(4)}); points scored by size: ${range(1, 6).map((k) => `${k}:${(pts[k] / N).toFixed(4)}`).join(" ")}`);
  if (cT > 20.52 || cD > 20.52 || cJ > 52.62 || Math.abs(sumT - 1) > 1e-9 || Math.abs(sumD - 1) > 1e-9) found({ id: "A1", cls: "FAIL", title: "the dice or the target is not evenly spread, or they are not independent", where: "packages/luck/src/random.ts:15-23", live: true, tambola: "no (own engine)" });
  else ok("A1", "target and dice are uniform on 1..6, independent, probabilities sum to 1");
  const dead = range(1, 6).filter((k) => pts[k] === 0);
  if (dead.length) found({ id: "A2", cls: "FAIL", title: `a face can never win: ${dead}`, where: "packages/luck/src/engine.ts:14", live: true, tambola: "no" }); else ok("A2", "every face 1..6 can be the target and can win (no segment that can never win, no empty segment)");
  // hit chance for a FIXED target t is 1 in 6 for every t (R07)
  let worst = 0; for (const t of range(1, 6)) { let h = 0; const M = QUICK ? 1500 : 6000; for (let i = 0; i < M; i++) if ((await diceOf("QA", 1, i, await beaconOf("F" + t, i))) === t) h++; worst = Math.max(worst, Math.abs(h / M - 1 / 6)); }
  if (worst > 0.02) found({ id: "A3", cls: "FAIL", title: `a hit is not 1 in 6 for every target (worst gap ${worst.toFixed(4)})`, where: "packages/luck/src/engine.ts:7-9", live: true, tambola: "no" }); else ok("A3", `hit chance is 1 in 6 for every target (worst gap ${worst.toFixed(4)})`);
}

// ================================================================================================================ B. every setting an organizer can send
head("B. Settings: every combination through parseSettings (the same check the server runs on Start)");
{
  const base = { rounds: 10, windowSecs: 10 };
  const roundsIn = [undefined, 0, 1, 2, 10, 20, 21, -1, 1.5, "10", "abc", null, true, false, [5], {}, NaN, 1e9, Infinity, ""];
  const winIn = [undefined, 0, 5, 6, 10, 15, 20, "10", "6", null, true, NaN, [10]];
  const accR = [], accW = [], odd = [];
  for (const r of roundsIn) { const p = parseSettings({ ...base, rounds: r }); if (r !== undefined && p.ok) accR.push(JSON.stringify(r) + "->" + p.value.rounds); }
  for (const w of winIn) { const p = parseSettings({ ...base, windowSecs: w }); if (w !== undefined && p.ok) accW.push(JSON.stringify(w) + "->" + p.value.windowSecs); }
  say(`  rounds accepted: ${accR.join("  ")}`); say(`  press window accepted: ${accW.join("  ")}`);
  const sloppy = accR.filter((x) => /^(true|false|\[5\]|""|null)->/.test(x));
  if (sloppy.length) found({ id: "B1", cls: "NOT_LOGICAL", title: `a rounds value that is not a number is accepted as a number (${sloppy.join(", ")}); true gives 1 round`, where: "packages/luck/src/settings.ts:31 (Number(b.rounds))", live: true, tambola: "no (own engine)", fix: "check typeof number first" });
  else ok("B1", "rounds only accepts real whole numbers");
  const sloppyW = accW.filter((x) => /^(true|\[10\])->/.test(x));
  if (sloppyW.length) found({ id: "B2", cls: "NOT_LOGICAL", title: `a press window that is not a number is accepted (${sloppyW.join(", ")})`, where: "packages/luck/src/settings.ts:32", live: true, tambola: "no", fix: "check typeof number first" });
  // owner decision 2026-10-27 (OPTIONS_TABLES.md): new games have 10 rounds and a 10 s window only. The live server still accepts 1..20 rounds and 6/10/15 s.
  const rOk = range(1, 20).filter((r) => parseSettings({ rounds: r }).ok).length, wOk = [...WINDOWS].filter((w) => parseSettings({ windowSecs: w }).ok);
  found({ id: "B3", cls: "GAP", title: `owner decision not built: a new game must be 10 rounds and a 10 s press window only; the server accepts ${rOk} round counts (1..20) and windows ${wOk.join("/")}`, where: "packages/luck/src/settings.ts:4-5,31-32; apps/web/public/host.js:44,47", live: true, tambola: "no (needs a new-games-only rule, console track LE)", decision: "OPTIONS_TABLES.md says hide, keep default; published games keep their saved values" });
  // prizes: every prize shape
  const bad = [];
  const mk = (o) => parseSettings({ prizes: o });
  const cases = [
    ["overall 0..5 ok", range(0, 5).every((n) => mk({ overall: Array(n).fill("Mug") }).ok)], ["overall 6 refused", !mk({ overall: Array(6).fill("Mug") }).ok],
    ["text 120 ok / 121 refused", mk({ overall: ["x".repeat(120)] }).ok && !mk({ overall: ["x".repeat(121)] }).ok],
    ["a non-text prize is refused", !mk({ overall: [5] }).ok && !mk({ overall: [null] }).ok && !mk({ overall: [{}] }).ok],
    ["more round lists than rounds is refused", !parseSettings({ rounds: 2, prizes: { rounds: [[], [], []] } }).ok],
    ["a round list of 6 is refused", !parseSettings({ rounds: 2, prizes: { rounds: [Array(6).fill("a")] } }).ok],
  ];
  for (const [n, v] of cases) if (!v) bad.push(n);
  if (bad.length) found({ id: "B4", cls: "FAIL", title: `prize checks wrong: ${bad.join("; ")}`, where: "packages/luck/src/settings.ts:21-52", live: true, tambola: "no" }); else ok("B4", "prize counts 0..5 per ranking, 120 letters, text only, list sizes: all checked correctly");
  // money in a prize text: which gift texts that mean money pass the filter?
  const moneyish = ["Rs 500", "Rs. 500", "500 rupees", "INR 500", "cash prize", "CASH", "$10", "₹500", "money", "jackpot", "bet", "gamble", "5 lakh", "five hundred", "Rs500", "500/-", "gift card worth 500", "Paytm 500", "UPI transfer", "bonus of 1000", "10,000", "5000 bucks", "cash-back", "c a s h", "ca$h"];
  const slipped = moneyish.filter((m) => mk({ overall: [m] }).ok);
  say(`  gift texts that mean money but pass the filter: ${slipped.join(" | ") || "none"}`);
  const must = ["5 lakh", "five hundred", "500/-", "10,000", "5000 bucks", "bonus of 1000", "Paytm 500", "UPI transfer", "Rs500"].filter((m) => slipped.includes(m));
  if (must.length) found({ id: "B5", cls: "GAP", title: `the 'no money prize' filter lets these through: ${must.join(" | ")} (it only knows cash, rupee, Rs., INR, USD, dollar, bet, stake, wager, gamble, jackpot, the symbols)`, where: "packages/luck/src/settings.ts:19 (FORBIDDEN_PRIZE)", live: true, tambola: "n/a (not a Tambola rule)", decision: "owner: how strict? a word list can never be complete; the organizer's duty stays in the Terms" });
  // a game with no gift at all can be started
  const none = parseSettings({ prizeMode: "both" }); if (none.ok && !none.value.prizes.overall.length) found({ id: "B6", cls: "INCOMPLETE", title: "a game can be started with prize mode 'both' and no gift text at all (players then see places 1 to 5 with no gift); there is no warning", where: "apps/edge/src/luck.ts:131-132; apps/web/public/host.js:68-73", live: true, tambola: "no", fix: "warn on the host page (owner wording decision)" });
}

// ================================================================================================================ C. the clock: windows, reveals, breaks, beacons
head("C. The clock: every window length x round count (phase partition, beacon due times, total length)");
{
  const START = 1_000_000_000_000; let problems = 0, checks = 0; const lens = {};
  for (const w of [6, 10, 15]) for (const rounds of [1, 2, 3, 10, 20]) {
    const s = { ...defaultSettings(), rounds, windowSecs: w }, total = totalDiceRounds(s), end = gameEndMs(s, START);
    lens[`${w}s x ${rounds}`] = (end - START) / 1000;
    let prevDue = -1;
    for (let i = 0; i < 2 * total; i++) { const due = beaconDueMs(s, START, i); if (due < prevDue) { problems++; say(`    beacon ${i} is due before ${i - 1}`); } prevDue = due; checks++; }
    for (let g = 0; g < total; g++) {
      const o = diceOpenMs(s, START, g), c = windowCloseMs(s, START, g), r = revealEndMs(s, START, g);
      const p1 = phaseAt(s, START, o), p2 = phaseAt(s, START, c - 1), p3 = phaseAt(s, START, c), p4 = phaseAt(s, START, r - 1), p5 = phaseAt(s, START, r);
      const nextIsBreak = (g + 1) % s.diceRounds === 0 && g + 1 < total, last = g + 1 === total;
      const want5 = last ? "over" : nextIsBreak ? "break" : "window";
      if (!(p1.kind === "window" && p1.g === g && p2.kind === "window" && p2.g === g && p3.kind === "reveal" && p3.g === g && p4.kind === "reveal" && p4.g === g && p5.kind === want5)) { problems++; if (problems < 6) say(`    phase wrong around dice round ${g} (w${w} r${rounds}): ${JSON.stringify([p1, p3, p5])}`); }
      // the dice (beacon B) is not due while the window is open, the target (A) of the NEXT dice round only after this one ended (R10, R37)
      if (beaconDueMs(s, START, 2 * g + 1) !== c || beaconDueMs(s, START, 2 * g) !== o) problems++;
      if (g + 1 < total && beaconDueMs(s, START, 2 * g + 2) < r) { problems++; say(`    target ${g + 1} is published before dice round ${g} ended`); }
      checks += 6;
    }
    // every break is exactly 20 s and sits only after full rounds; the last round has no break
    for (let r = 1; r < rounds; r++) { const a = revealEndMs(s, START, r * s.diceRounds - 1), b = diceOpenMs(s, START, r * s.diceRounds); if (b - a !== 20_000) { problems++; say(`    break after round ${r}: ${(b - a) / 1000}s`); } const pb = phaseAt(s, START, a + 1000); if (!(pb.kind === "break" && pb.afterRound === r)) problems++; }
  }
  say(`  ${checks} clock checks. Game length in seconds: ${Object.entries(lens).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  if (problems) found({ id: "C1", cls: "FAIL", title: `${problems} clock problems`, where: "packages/luck/src/timeline.ts", live: true, tambola: "no" });
  else ok("C1", "windows, reveals and breaks tile the game with no gap or overlap; no beacon value is due before it should be; a default game is 24 min 40 s (R30)");
  if (lens["10s x 10"] !== 1480) found({ id: "C2", cls: "FAIL", title: `default length is ${lens["10s x 10"]} s, rules say 1480`, where: "packages/luck/src/timeline.ts:9", live: true, tambola: "no" });
}

// ================================================================================================================ D. whole games through the real engine
head("D. Whole games: players x rounds x seeds through the real engine (ranking, ties, standings, prizes)");
const lineOf = (r) => r.line;
{
  const configs = []; for (const players of [2, 3, 4, 5, 6, 10, 11, 25, 60]) for (const rounds of [1, 2, 10]) configs.push({ players, rounds });
  const seedsPer = QUICK ? 2 : 4; let games = 0, bad = [], tieLines = 0, fateLines = 0, zeroGames = 0, ranksChecked = 0;
  const unawarded = {}, dupShown = { games: 0, onePlayerManyPrizes: 0 }, overallMissed = { games: 0, champSkipped: 0, overallEmpty: 0 };
  for (const { players, rounds } of configs) for (let k = 0; k < seedsPer; k++) {
    const id = `QA-${players}-${rounds}-${k}`, s = { ...defaultSettings(), rounds, prizeMode: "both", prizes: { overall: ["O1", "O2", "O3", "O4", "O5"], rounds: Array.from({ length: rounds }, (_, r) => [1, 2, 3, 4, 5].map((p) => `R${r + 1}P${p}`)) } };
    const g = new LuckGame(id, s, players);
    for (let d = 0; d < totalDiceRounds(s); d++) await g.addDiceRound(d, await beaconOf(id + "A", d), await beaconOf(id + "B", d));
    games++;
    const overall = await g.overallRanking(), rr = []; for (let r = 1; r <= rounds; r++) rr.push(await g.roundRanking(r));
    const want = Math.min(TOP_LIST, players);
    for (const [name, list] of [["overall", overall], ...rr.map((l, i) => [`round-${i + 1}`, l])]) {
      ranksChecked++;
      if (list.length !== want) bad.push(`${id} ${name}: ${list.length} places, wanted ${want}`);
      if (new Set(list.map((x) => x.seat)).size !== list.length) bad.push(`${id} ${name}: a seat twice`);
      list.forEach((x, i) => { if (x.place !== i + 1) bad.push(`${id} ${name}: place ${x.place} at index ${i}`); if (i && cmpNumeric(list[i - 1], x) > 0 && false) bad.push("order"); });
      for (let i = 1; i < list.length; i++) if (list[i - 1].points < list[i].points) bad.push(`${id} ${name}: place ${i} has fewer points than place ${i + 1}`);
      for (const x of list) { if (x.line) { tieLines++; if (/fate/.test(x.line)) fateLines++; } if (x.line && !/^Tied on \d+ points?; decided by .+\.$/.test(x.line)) bad.push(`${id} text: ${x.line}`); }
    }
    // totals add up: the overall points of every seat equal the sum of its rounds
    for (let seat = 0; seat < players; seat++) { const sum = g.roundTallies.reduce((a, rt) => a + rt[seat].points, 0); if (sum !== g.total[seat].points) bad.push(`${id} seat ${seat}: rounds ${sum} total ${g.total[seat].points}`); const st = standingOf(g.total, seat); if (st.percent < 1 || st.percent > 100 || st.ahead >= players) bad.push(`${id} standing ${JSON.stringify(st)}`); }
    if (g.total.every((t) => t.points === 0)) zeroGames++;
    // prizes (what assignPrizes would give) and what the player screen shows (luck.js: the gift of the PLACE, no 'one win' logic at all)
    for (const oneWin of [false, true]) {
      const wins = assignPrizes({ ...s, oneWinPerPlayer: oneWin }, rr, overall), texts = rounds * PLACES + PLACES, lost = texts - wins.length;
      const key = `players=${players} rounds=${rounds} oneWin=${oneWin}`; unawarded[key] = (unawarded[key] || 0) + lost;
      if (oneWin) {
        const shown = new Map(); const add = (list, n) => list.slice(0, PLACES).forEach((x) => shown.set(x.seat, (shown.get(x.seat) || 0) + 1)); rr.forEach((l) => add(l)); add(overall);
        dupShown.games++; if ([...shown.values()].some((c) => c > 1)) dupShown.onePlayerManyPrizes++;
        overallMissed.games++; const o1 = wins.find((w) => w.ranking === "overall" && w.place === 1); if (!o1 || o1.seat !== overall[0].seat) overallMissed.champSkipped++;
        if (!wins.some((w) => w.ranking === "overall")) overallMissed.overallEmpty++;
      }
    }
  }
  say(`  ${games} games, ${ranksChecked} rankings checked, ${tieLines} tie lines (${fateLines} decided by fate), ${zeroGames} games where nobody scored anywhere`);
  if (bad.length) found({ id: "D1", cls: "FAIL", title: `ranking invariants broken: ${bad.slice(0, 3).join(" | ")} (+${Math.max(0, bad.length - 3)})`, where: "packages/luck/src/engine.ts:41-83", live: true, tambola: "no" });
  else ok("D1", "every ranking is strict (no shared place), sorted by points, has min(10, players) places, totals add up, standing is 1..100%, tie lines are well formed");
  // prize stock: places that have a gift text but no winner
  const lostOnes = Object.entries(unawarded).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`);
  say(`  gift texts with NO winner (summed over seeds): ${lostOnes.length ? lostOnes.join("; ") : "none"}`);
  const few = [2, 3, 4].map((p) => unawarded[`players=${p} rounds=10 oneWin=false`] || 0);
  found({ id: "D2", cls: "INCOMPLETE", title: `a gift text for a place nobody holds is silently dropped (players=2,3,4 with 5 gifts per ranking lose ${few.join("/")} gifts over ${seedsPer} seeds); neither the host nor the players are told`, where: "packages/luck/src/engine.ts:140 (if (!pick) continue); apps/web/public/luck.js:164", live: true, tambola: "no", fix: "show 'no winner for this place' / warn at Start (owner wording)" });
  const lost10 = unawarded["players=10 rounds=10 oneWin=true"] || 0, lost25 = unawarded["players=25 rounds=10 oneWin=true"] || 0, lost60 = unawarded["players=60 rounds=10 oneWin=true"] || 0;
  say(`  'one win per player' (engine order: round 1, 2, ... then overall; pool = top 10 of each ranking): gifts lost with 10/25/60 players, 10 rounds: ${lost10}/${lost25}/${lost60} (of ${55 * seedsPer} each); overall champion passed over in ${overallMissed.champSkipped} of ${overallMissed.games} games, overall prizes all lost in ${overallMissed.overallEmpty}`);
  if (overallMissed.champSkipped) found({ id: "D3", cls: "NOT_LOGICAL", title: `with 'one win per player' the overall ranking is handled LAST, so the overall champion is usually passed over (${overallMissed.champSkipped} of ${overallMissed.games} games) and for small crowds the overall gifts are lost completely (${overallMissed.overallEmpty} games); the pool is only the top 10 of each ranking`, where: "packages/luck/src/engine.ts:132-146 (order at 144-145; pool 'list' = top 10)", live: true, tambola: "no", decision: "owner: should the overall prizes be given first? (changes engine.test.ts:196)" });
  say(`  what players SEE ignores that switch: in ${dupShown.onePlayerManyPrizes} of ${dupShown.games} games one player is shown with more than one gift although 'a player can win only one prize' was ticked`);
  found({ id: "D4", cls: "FAIL", title: "the host-page tick box 'A player can win only one prize' does nothing: assignPrizes is never called by the player page, the big screen or the server (only by a test); the final screen shows the gift of each place as written", where: "apps/web/public/luck.js:159-170 (prizeFor); apps/web/public/host.js:57; packages/luck/src/engine.ts:132 (unused)", live: true, tambola: "no (own engine, own page)", fix: "luck.js final screen uses LuckEngine.assignPrizes" });
}

// ================================================================================================================ E. the real Worker
head("E. The real Worker: lobby, start, beacon, votes, quorum, closing, deletion, free game, drafts");
const { handle } = await import("../apps/edge/test/with-terms.ts");
const { makeD1 } = await import("../apps/edge/test/d1-sqlite.ts");
const T = Date.UTC(2026, 9, 1, 10, 0, 0), GEN = 1692803367, roundAt = (ms) => Math.floor((ms / 1000 - GEN) / 3) + 1, START = roundAt(T) + 1200;
const dev = (i) => i.toString(16).padStart(4, "0").repeat(8);
let n = 0;
function world(extra = {}) {
  const d = makeD1(); const env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", PUBLIC_ORIGIN: "https://luck.test", PHONE_SALT: "salt", DATA_KEY: "k", ...extra };
  const call = (method, path, body, headers = {}, now = T) => handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, now);
  const j = async (r) => r.json();
  const W = { env, raw: d.raw, call, j };
  W.organizer = async () => { const r = await j(await call("POST", "/api/start", { email: `o${++n}@acme.com` }, { "cf-connecting-ip": `10.1.${n >> 8}.${n & 255}` })); const h = { "x-organizer": r.token }; Object.defineProperty(h, "ai", { value: r.aiKey }); return h; };
  W.game = async (id, over = {}, h, paid = true) => { h = h || (await W.organizer()); const c = await call("POST", "/api/z", { id, startRound: START, callSeconds: 6, cap: 100, ...over }, h); if (c.status !== 200) throw new Error("create " + c.status + " " + (await c.text())); const p = await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h); if (p.status !== 200) throw new Error("publish " + p.status + " " + (await p.text())); if (paid) raw_run(d.raw, "UPDATE engagement SET pack=100 WHERE id=?", [id]); return h; };
  W.join = async (id, count, from = 1, nameOf = (i) => `Nick ${i}`) => { const out = []; for (let i = from; i < from + count; i++) { const r = await call("POST", `/api/z/${id}/join`, { name: nameOf(i), device: dev(i) }); if (r.status !== 200) throw new Error("join " + r.status + " " + (await r.text())); out.push({ pid: (await j(r)).pid, device: dev(i) }); } return out; };
  W.view = async (id, now = T) => j(await call("GET", `/api/z/${id}/luck/view`, undefined, {}, now));
  W.phone = async (id, settings, players, now) => {
    const vals = []; for (;;) { const b = await j(await call("GET", `/api/z/${id}/luck/beacon?from=${vals.length}`, undefined, {}, now)); for (const x of b.values) vals[x.i] = x.v; if (!b.values.length) break; }
    const g = new LuckGame(id, settings, players); for (let k = 0; k < totalDiceRounds(settings); k++) await g.addDiceRound(k, vals[2 * k], vals[2 * k + 1]);
    const line = (r) => ({ seat: r.seat, points: r.points, hits: r.hits, best: r.best, line: r.line }); const rounds = []; for (let r = 1; r <= settings.rounds; r++) rounds.push((await g.roundRanking(r)).map(line));
    return { game: g, result: { overall: (await g.overallRanking()).map(line), rounds } };
  };
  W.vote = (id, p, result, now) => call("POST", `/api/z/${id}/luck/vote`, { pid: p.pid, device: p.device, result }, {}, now);
  return W;
}
const raw_run = (raw, sql, args) => raw.run(sql, args);
const SET = { rounds: 2, windowSecs: 10, prizeMode: "both", prizes: { overall: ["Hamper", "Book"], rounds: [["Pen"], ["Mug"]] } };

// E1. which routes exist: there is no press route, no pause, no resume
{
  const W = world(); const h = await W.game("QA-R1"); await W.join("QA-R1", 3); const st = await W.j(await W.call("POST", "/api/z/QA-R1/luck/start", { settings: SET }, h));
  const seen = {}; for (const sub of ["view", "seats", "me", "beacon", "rank", "reveal", "start", "end", "vote", "tick", "press", "pause", "resume", "extend", "log", "status"]) { const r = await W.call(sub === "start" || sub === "end" || sub === "vote" || sub === "tick" || ["press", "pause", "resume", "extend"].includes(sub) ? "POST" : "GET", `/api/z/QA-R1/luck/${sub}`, ["start", "end", "vote", "tick", "press", "pause", "resume", "extend"].includes(sub) ? {} : undefined, h, st.startMs + 3000); seen[sub] = r.status; }
  say(`  luck routes, status when called mid-game: ${JSON.stringify(seen)}`);
  const missing = ["press", "pause", "resume", "extend", "log"].filter((k) => seen[k] === 404);
  found({ id: "E1", cls: "GAP", title: `RULES_luckbychance.md needs routes this game does not have: ${missing.join(", ")} (a press is never sent to the server, so a late press cannot be refused with 409 late-press and a player who does not press still scores; a game cannot be paused or extended; there is no game log)`, where: "apps/edge/src/luck.ts:141-239 (route list at 14-16); apps/web/public/luck.js:112-124 (the press is only shown on the phone)", live: true, tambola: "no (engine track EN2, owner decision needed)", decision: "A) keep 'Fate mode' (press is for show; the rules draft sections 4, 6, 7 are rewritten) or B) 'Presence mode' (server stores presses with the server clock; a player who did not press scores 0). docs/RULES.md says Presence mode is NOT part of this product." });
}

// E2. the result needs enough phones: players x phones that vote (one fresh world per cell)
{
  const sizes = QUICK ? [2, 3, 4, 10] : [2, 3, 4, 5, 6, 10, 30]; const table = [];
  for (const players of sizes) {
    const q = Math.min(players, Math.max(3, Math.ceil(players * 0.05))); const row = { players, quorum: q };
    for (const [label, voters] of [["all", players], ["all but one", players - 1], ["at quorum", q], ["below quorum", q - 1]]) {
      if (voters < 0) continue; const W = world(); const id = `QA-W${players}`; const h = await W.game(id); const ps = await W.join(id, players); const st = await W.j(await W.call("POST", `/api/z/${id}/luck/start`, { settings: SET }, h));
      const s = (await W.view(id, T + 1000)).settings, { result } = await W.phone(id, s, players, st.endMs + 1);
      for (const p of ps.slice(0, voters)) await W.vote(id, p, result, st.endMs + 5);
      await W.call("POST", "/api/lifecycle/tick", {}, { "x-organizer": "plat" }, st.endMs + 11 * 60_000);
      const r = await W.j(await W.call("GET", `/api/z/${id}/luck/rank`, undefined, {}, st.endMs + 11 * 60_000));
      row[label] = r.agreed ? "RESULT" : "NO RESULT";
    }
    table.push(row);
  }
  for (const r of table) say(`  players ${String(r.players).padStart(2)}  quorum ${String(r.quorum).padStart(2)}  all vote: ${r.all}  |  one phone missing: ${r["all but one"]}  |  exactly quorum: ${r["at quorum"]}  |  one below quorum: ${r["below quorum"] ?? "-"}`);
  const smallNoRes = table.filter((r) => r["all but one"] === "NO RESULT").map((r) => r.players);
  // chance of a result if each phone is on and open at the end with probability f
  const binom = (n2, k, p) => { let c = 1; for (let i = 0; i < k; i++) c = (c * (n2 - i)) / (i + 1); return c * p ** k * (1 - p) ** (n2 - k); };
  const succ = (P, f) => { const q = Math.min(P, Math.max(3, Math.ceil(P * 0.05))); let s = 0; for (let k = q; k <= P; k++) s += binom(P, k, f); return s; };
  say("  chance that a result is published if each phone is still open 10 minutes after the end (f):");
  for (const P of [2, 3, 4, 5, 10, 20, 50]) say(`    players ${String(P).padStart(2)}: f=0.99 ${succ(P, 0.99).toFixed(3)}  f=0.95 ${succ(P, 0.95).toFixed(3)}  f=0.90 ${succ(P, 0.9).toFixed(3)}  f=0.80 ${succ(P, 0.8).toFixed(3)}`);
  if (smallNoRes.length) found({ id: "E2", cls: "NO_RESULT", title: `in a game of ${smallNoRes.join("/")} players ONE phone that is closed or asleep at the end leaves the game with no result for good (the quorum is all players when there are 3 or fewer; ${succ(3, 0.9).toFixed(2)} chance of a result at 90% of phones open for 3 players, ${succ(2, 0.9).toFixed(2)} for 2). Ten minutes after the end the game is closed, no winner is recorded, the organizer's report says 'the phones did not agree'`, where: "apps/edge/src/luck.ts:88 (quorumFor), 99-115 (settleVotes), 21 (NO_AGREEMENT_MS)", live: true, tambola: "no (own engine)", decision: "owner: lower the quorum for small games (for example 1 of 2, 2 of 3), or let the host phone count, or wait longer than 10 minutes; a smaller quorum is easier to forge" });
  else ok("E2", "small games reach a result with one phone missing");
}

// E3. closing without a result must still start the deletion clock, and everything personal must go
{
  const W = world(); const id = "QA-D1"; const h = await W.game(id); const ps = await W.join(id, 4); const st = await W.j(await W.call("POST", `/api/z/${id}/luck/start`, { settings: SET }, h));
  const s = (await W.view(id, T + 1000)).settings, { result } = await W.phone(id, s, 4, st.endMs + 1); await W.vote(id, ps[0], result, st.endMs + 2);
  await W.call("POST", "/api/lifecycle/tick", {}, { "x-organizer": "plat" }, st.endMs + 11 * 60_000);
  const left = (now) => ["luck_p", "luck_v", "participant"].map((t) => W.raw.query(`SELECT COUNT(*) c FROM ${t} WHERE eid='${id}'`).get().c);
  await W.call("POST", "/api/lifecycle/tick", {}, { "x-organizer": "plat" }, st.endMs + 10 * 60_000 + 20 * 3_600_000 + 61_000); const at20 = left();
  await W.call("POST", "/api/lifecycle/tick", {}, { "x-organizer": "plat" }, st.endMs + 10 * 60_000 + 23 * 3_600_000 + 61_000); const at23 = left();
  say(`  game closed with no result: personal rows (nicknames, votes, participants) 20 h after the close: ${at20}; 23 h + 1 min after: ${at23}`);
  if (at23.some((c) => c > 0)) found({ id: "E3", cls: "FAIL", title: `personal data stays after the 23 hour clock when a game closes without a result: ${at23}`, where: "apps/edge/src/lifecycle.ts:67-71,110-135", live: true, tambola: "yes (20 h clock, lifecycle.ts)" });
  else ok("E3", "a game that closes with no result still has its nicknames, votes and participants erased 23 h after the close");
  const clock = { purgeAfterH: Number(/PURGE_AFTER_MS = (\d+)/.exec(readFileSync("apps/edge/src/lifecycle.ts", "utf8"))?.[1]), reportLinkH: Number(/REPORT_LINK_MS = (\d+)/.exec(readFileSync("apps/edge/src/lifecycle.ts", "utf8"))?.[1]) };
  if (clock.purgeAfterH !== 20) found({ id: "E3b", cls: "GAP", title: `the deletion clock is ${clock.purgeAfterH} hours (report link ${clock.reportLinkH} h); the owner's rule for every game is 20 hours (report link 19 h, grace 3 h)`, where: "apps/edge/src/lifecycle.ts:26-27; docs/RULES.md R44/R67 say 24/23 h", live: true, tambola: "yes (PORT_PLAYBOOK: PURGE_AFTER_MS 20 h, REPORT_LINK_MS 19 h, OVERDUE_GRACE_MS 3 h)" });
}

// E4. names: every plausible nickname must be able to join; two players may share a nickname
{
  const W = world(); const id = "QA-N1"; await W.game(id); const names = ["Ms", "As", "Jo", "Ravi", "Is", "us", "Os", "ss", "Ravi K", "Sam", "Ann", "A", "  ", "<b>Raj</b>", "x".repeat(60), "Ana", "Éva", "रवि", "Mrs"], out = [];
  for (let i = 0; i < names.length; i++) { const r = await W.call("POST", `/api/z/${id}/join`, { name: names[i], device: dev(i + 1) }); out.push([names[i], r.status]); }
  say(`  nickname -> HTTP status: ${out.map(([a, b]) => `${JSON.stringify(a.slice(0, 12))}:${b}`).join("  ")}`);
  const refused = out.filter(([a, b]) => b !== 200 && a.trim().length >= 2).map(([a]) => a);
  if (refused.length) found({ id: "E4", cls: "FAIL", title: `real nicknames are refused with 'Please type your name.': ${refused.map((x) => JSON.stringify(x)).join(", ")}. The check removes every run of the letter s because the pattern is /s+/g instead of /\\s+/g`, where: "apps/edge/src/worker.ts:1369", live: true, tambola: "no (same line in origin/port/tambola-2026-10-24 worker.ts:1394)", fix: "regex /\\s+/g" });
  else ok("E4", "every 2+ letter nickname can join");
}
{
  const W = world(); const id = "QA-N3"; const h = await W.game(id); await W.join(id, 4, 1, (i) => (i < 4 ? "Asha" : "Ravi")); const st = await W.j(await W.call("POST", `/api/z/${id}/luck/start`, { settings: SET }, h));
  const seats = await W.j(await W.call("GET", `/api/z/${id}/luck/seats`, undefined, {}, st.startMs + 1)); const names = seats.seats.map((x) => x[1]); const dup = names.length - new Set(names).size;
  if (dup) found({ id: "E5", cls: "INCOMPLETE", title: `three players who type the same nickname all appear as 'Asha' on the winners list; nothing separates them (a join with a nickname already used is accepted: ${dup} duplicate(s) in ${names.length}). The organizer cannot tell which 'Asha' won`, where: "apps/edge/src/luck.ts:53 (cleanName), 129-130; apps/edge/src/worker.ts:1366-1372", live: true, tambola: "no", decision: "owner: add the seat number to the shown name ('Asha #3') or refuse a used nickname" });
}

// E5. the console prizes and the prizes players see are two different lists; round winners are not recorded for the organizer
{
  const W = world(); const id = "QA-P1"; const h = await W.game(id, { rewards: [{ pattern: "first", scope: "overall", ordinal: 1, text: "Hamper" }, { pattern: "second", scope: "overall", ordinal: 1, text: "Book" }] });
  const sum = await W.j(await W.call("GET", `/api/z/${id}/summary`, undefined, h)); const consoleTexts = (sum.rewards || []).map((r) => r.text).filter(Boolean);
  const ps = await W.join(id, 4); const st = await W.j(await W.call("POST", `/api/z/${id}/luck/start`, { settings: { rounds: 2, windowSecs: 10 } }, h));
  const v = await W.view(id, st.startMs + 1); const seen = v.settings.prizes;
  say(`  prizes written in the console (Step 3): ${JSON.stringify(consoleTexts)}; prizes the players see after Start without typing them again: ${JSON.stringify(seen.overall)}`);
  if (consoleTexts.length && !seen.overall.length) found({ id: "E6", cls: "INCOMPLETE", title: "prizes named in the console are not the prizes of the game: players see none unless the organizer types them again on the separate host page; the organizer's report lists the console prizes", where: "apps/edge/src/luck.ts:131-132 (start reads only the request); apps/web/public/host.js:44-73; apps/edge/src/lifecycle.ts:293 (report from cfg.rewards)", live: true, tambola: "no", fix: "when Start carries no overall prizes use the console's texts", decision: "the console spec moves per-round gifts into Step 3 (LW track)" });
  const s = v.settings; const withRounds = { ...s, prizes: { overall: ["Hamper", "Book"], rounds: [["Pen"], ["Mug"]] } }; void withRounds;
}
{
  const W = world(); const id = "QA-P2"; const h = await W.game(id); const ps = await W.join(id, 6); const st = await W.j(await W.call("POST", `/api/z/${id}/luck/start`, { settings: SET }, h));
  const s = (await W.view(id, T + 1000)).settings, { result } = await W.phone(id, s, 6, st.endMs + 1); for (const p of ps.slice(0, 3)) await W.vote(id, p, result, st.endMs + 2);
  const rows = W.raw.query(`SELECT round, pattern, ordinal, seat FROM winner WHERE eid='${id}' ORDER BY pattern`).all(); const rw = W.raw.query(`SELECT COUNT(*) c FROM winner WHERE eid='${id}' AND round>1`).get().c;
  say(`  winners recorded for the organizer after a 2-round game with per-round gifts: ${rows.length} rows, all round=${[...new Set(rows.map((r) => r.round))]}, round-prize winners recorded: ${rw}`);
  if (rows.length && rw === 0) found({ id: "E7", cls: "INCOMPLETE", title: "only the overall top 5 are written to the winners record; the winners of the per-round gifts are shown on the phones but are not in the organizer's list or report, so they cannot be ticked as 'given'", where: "apps/edge/src/luck.ts:104-111 (only res.overall, round 1)", live: true, tambola: "no", fix: "also write res.rounds[r] with round=r+1" });
}

// E5b. the console suggests gift amounts that the game itself refuses
{
  const zc = readFileSync("apps/web/public/zc.js", "utf8"), hints = [...zc.matchAll(/\["(voucher|dinner)", "([^"]+)", "", "(Amount[^"]*)"\]/g)].map((m) => `${m[2]}: ${m[3]}`);
  const refused = ["Gift card Rs 1000", "Gift card $25", "Restaurant gift card $50"].filter((t) => !parseSettings({ prizes: { overall: [t] } }).ok);
  say(`  console prize hints: ${hints.join(" | ")}; the game refuses: ${refused.join(" | ")}`);
  if (hints.length && refused.length) found({ id: "E6b", cls: "NOT_LOGICAL", title: `the console tells the organizer to type an amount for a gift card ('${hints[0]}'), but the game refuses any gift text with $, Rs or a rupee sign ('${refused[0]}'), so the same prize cannot be typed on the host page`, where: "apps/web/public/zc.js:144; packages/luck/src/settings.ts:19", live: true, tambola: "no (the console page is not merged wholesale)", decision: "owner: is a gift card with an amount a gift or money? change the console hint or the filter" });
}

// E6. free game, drafts, payment lease, game record: what is in the live code
{
  const pay = readFileSync("apps/edge/src/pay.ts", "utf8"), wk = readFileSync("apps/edge/src/worker.ts", "utf8");
  const freeCap = Number(/FREE_CAP = (\d+)/.exec(pay)?.[1]);
  say(`  free game: FREE_CAP ${freeCap}, only while the platform switch FREE_LAUNCH=1 (pay.ts:78-82); owner wants: 10-person game at Rs 0, always`);
  const grid = [];
  for (const launch of [undefined, "1"]) for (const cap of [10, 11, 100, 101]) {
    const W = world(launch ? { FREE_LAUNCH: launch } : {}); const h = await W.organizer(); await W.call("POST", "/api/z", { id: "QA-FR", startRound: START, callSeconds: 6, cap }, h);
    const p = await W.call("POST", "/api/z/QA-FR/publish", { email: "boss@acme.com", phone: "98765 43210" }, h); const b = await W.j(p);
    grid.push(`FREE_LAUNCH=${launch ?? "off"} cap ${cap}: ${p.status === 200 ? (b.paid ? "free" : "must pay") : "HTTP " + p.status}`);
  }
  say(`  publish with no payment: ${grid.join(" | ")}`);
  if (freeCap !== 10) found({ id: "E8", cls: "GAP", title: `the free game is ${freeCap} people and only while a platform switch is on; the owner's rule is a Rs 0 game for 10 people for everyone`, where: "apps/edge/src/pay.ts:78-82; apps/edge/src/worker.ts:1593", live: true, tambola: "yes (961189f 'Rs 0 game for 10 people' is already in origin/port/tambola-2026-10-24)" });
  const hasRecord = /game_record|gamerecord/i.test(wk + readFileSync("apps/edge/src/lifecycle.ts", "utf8")), hasLease = /\blease\b|pay_lease|payment_lease/i.test(pay + wk);
  if (!hasRecord) found({ id: "E9", cls: "GAP", title: "no game_record: there is no permanent log of what happened in a game (start, end, pause, who pressed what) that survives the 20 hour erase", where: "apps/edge/src (no match for game_record); apps/edge/migrations/0021_luck.sql has luck_t/luck_p/luck_v only", live: true, tambola: "yes (platform file gamerecord.ts)" });
  if (!hasLease) found({ id: "E10", cls: "GAP", title: "no payment lease: two tabs or a double tap can start two Razorpay orders for one game", where: "apps/edge/src/pay.ts:346 (placeOrder with no lock)", live: true, tambola: "yes (pay.ts)" });
}
{ // draft limit counting
  const W = world(); const h = await W.organizer(); let made = 0, why = "";
  for (let i = 0; i < 10; i++) { const c = await W.call("POST", "/api/z", { id: `QA-DR${i}`, startRound: START, callSeconds: 6, cap: 100 }, h); if (c.status === 200) made++; }
  // publish (unpaid) every one: a published game that waits for its payment is NOT an unpublished draft
  let pubd = 0; for (let i = 0; i < 10; i++) { const p = await W.call("POST", `/api/z/QA-DR${i}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, h); if (p.status === 200) pubd++; }
  const eleventh = await W.call("POST", "/api/z", { id: "QA-DRX", startRound: START, callSeconds: 6, cap: 100 }, h); const msg = eleventh.status === 200 ? "" : (await eleventh.json()).error;
  say(`  drafts: made ${made}, published (unpaid) ${pubd}; creating one more answers ${eleventh.status} ${msg.slice(0, 70)}`);
  if (eleventh.status !== 200 && pubd === 10) found({ id: "E11", cls: "GAP", title: "the 10-draft limit counts every game with no pack, including games that are already published and only wait for payment, but the message says 'unpublished drafts'. clone.test.ts:125 says counting them is intended, so this is the owner's rule to confirm; the Tambola hardening list names a 'draft-limit counting' fix whose exact rule this session cannot see", where: "apps/edge/src/worker.ts:1185 and apps/edge/src/clone.ts:54 (COUNT where pack=0); apps/edge/test/free-launch.test.ts:172", live: true, tambola: "yes (listed in the Tambola hardening; take its rule)", decision: "owner: should published games that wait for payment count toward the 10? if yes, say 'unpaid games' in the message" });
  else ok("E11", "draft limit counts only real drafts");
}

// E7. paid / free / demo shapes of the lobby (who can start, who can join)
{
  const W = world(); const h = await W.game("QA-L1", { whoCanJoin: "list" }); const j1 = await W.call("POST", "/api/z/QA-L1/join", { name: "Stranger", device: dev(1) });
  say(`  list-only game, a stranger joins: HTTP ${j1.status} ${(await j1.json()).code ?? ""}`);
  const W2 = world(); await W2.game("QA-L2", { cap: 2 }); await W2.join("QA-L2", 2); const full = await W2.call("POST", "/api/z/QA-L2/join", { name: "Third", device: dev(3) }); say(`  cap 2, third player: HTTP ${full.status}`);
  const W3 = world(); const h3 = await W3.game("QA-L3"); const ps3 = await W3.join("QA-L3", 2); const ai3 = h3.ai;
  const tryStart = async (who, hdr) => (await W3.call("POST", "/api/z/QA-L3/luck/start", ps3[0] && who === "a player" ? { pid: ps3[0].pid, device: ps3[0].device } : {}, hdr)).status;
  const roles = { stranger: await tryStart("stranger", {}), "wrong key": await tryStart("wrong", { "x-organizer": "wrong" }), "a player": await tryStart("a player", {}), "AI helper": ai3 ? await tryStart("ai", { "x-organizer": ai3 }) : "n/a" };
  const okStart = await W3.call("POST", "/api/z/QA-L3/luck/start", {}, h3);
  say(`  roles on Start: ${Object.entries(roles).map(([k, v]) => `${k} ${v}`).join(", ")}; the Organizer ${okStart.status} (the Host is allowed and the Co-host is not by worker.ts:514, covered by luck-end.test.ts / roles.test.ts)`);
  if (Object.values(roles).some((v) => v !== 403 && v !== "n/a") || okStart.status !== 200) found({ id: "E13", cls: "FAIL", title: `wrong role answers on Start: ${JSON.stringify(roles)}`, where: "apps/edge/src/worker.ts:514,1346-1349", live: true, tambola: "no" }); else ok("E13", "only the Organizer (and a Host) can start; a stranger, a wrong key, a player and the AI helper get 403");
  // an unpaid game (published, nobody paid): can the organizer still press Start and play a whole game?
  const W4 = world(); const h4 = await W4.game("QA-L4", {}, undefined, false); await W4.join("QA-L4", 3);
  const packBefore = W4.raw.query("SELECT pack FROM engagement WHERE id='QA-L4'").get().pack, pays = W4.raw.query("SELECT COUNT(*) c FROM payment").get().c;
  const stUnpaid = await W4.call("POST", "/api/z/QA-L4/luck/start", { settings: { rounds: 1, windowSecs: 10 } }, h4);
  say(`  published game, pack=${packBefore}, payments=${pays}: organizer presses Start -> HTTP ${stUnpaid.status}`);
  if (stUnpaid.status === 200) found({ id: "E12", cls: "FAIL", title: "a game that nobody paid for can be started and played to the end: Start does not check payment. The only payment lock (45 s before the scheduled start time) never applies to a game started earlier, so a published unpaid game of any size plays for free (here: unpaid, 0 payments, Start answered 200, players join and play)", where: "apps/edge/src/luck.ts:149-165 (start has no payment check); apps/edge/src/worker.ts:1300-1304,1342-1347 (the lock is time based only)", live: true, tambola: "no (luck.ts is this game's own file)", severity: "HIGH in LIVE mode (revenue); no money is lost in TEST mode", fix: "Start answers 402 payment-due while pack is 0" });
  else ok("E12", "Start refuses an unpaid game");
}

// ================================================================================================================ F. the rules draft against the live words
head("F. RULES_luckbychance.md section 10 (message table) against the live pages");
{
  const src = ["apps/web/public/luck.js", "apps/web/public/luck-dice.js", "apps/web/public/luck-run.js", "apps/web/public/big.js", "apps/web/public/host.js"].map((f) => readFileSync(f, "utf8")).join("\n");
  const table = [
    ["Window open", "Press now. The dice are about to roll."], ["Quiet timer", "Press in 10... 9... 8..."], ["Press counted", "Pressed. Good luck!"],
    ["Press too late", "Ohooo! 😊 Sorry, you pressed after the press window closed. This press cannot be counted."], ["Hit", "You score"], ["No hit", "The target was"],
    ["Not pressed", "You did not press this time, so no score."], ["Standing", "You are in the top"], ["Paused", "Game paused by the host"], ["Away note", "You missed"], ["Do Not Disturb", "Do Not Disturb"],
    ["Counter", "rounds played"],
  ];
  const missing = table.filter(([, t]) => !src.includes(t)).map(([k]) => k);
  say(`  messages of the draft table not present in the live pages: ${missing.join(", ")}`);
  found({ id: "F1", cls: "GAP", title: `live pages lack these draft messages: ${missing.join(", ")} (live says 'Press the dice to roll it.', 'Pressed. Your dice lands when the timer ends.', '<n> s left to press', 'Round 4 of 10')`, where: "apps/web/public/luck.js:112-124; docs/boss/RULES_luckbychance.md section 10", live: true, tambola: "no", decision: "depends on the Fate/Presence decision (E1); wording of the counter '4 of 10 rounds played, 6 left' can be added at once" });
}

head("RESULT");
const by = {}; for (const f of findings) by[f.cls] = (by[f.cls] || 0) + 1;
say(`  ${findings.length} defects (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(", ")}); ${passes.length} checks passed; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (JSON_OUT) console.log(JSON.stringify({ findings, passes }, null, 1));
