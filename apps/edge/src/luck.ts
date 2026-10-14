// The Luck by Chance game on the server. The game itself (target, dice, scoring, ranking) is packages/luck and runs on the PHONES: every phone computes every player's score from
// the public beacon values and the frozen seat list. The server only does four small things:
//   1. keeps the sealed seed (its fingerprint is public from the first look, the secret is shown only after the game is over),
//   2. freezes the seat list when the host starts (registration closes before the first dice round),
//   3. hands out the beacon values at the moment each one is due (never earlier), and
//   4. collects the phones' result votes; a result counts only when enough different phones send the same one.
// No dice, no score and no ranking is ever computed or stored by the server. Nothing is asked of a player but a nickname.
//
// Routes (all under /api/z/{eid}/luck/):  view (public)  seats (public, after the start)  me (a player)  beacon (public, only values that are due)  start (Organizer or Host)
//                                         end (Organizer or Host: the game ends when the round now being played is over)
//                                         vote (a player)  rank (public)  reveal (public after the game)  tick (platform key / scheduled job)
// Only scheduling and checking helpers come from the game package: when a number is due (timeline), what an organizer may choose (settings), and the hash for the feed (random).
// Targets, dice, scores, rankings and prizes are NOT imported here: the phones compute them (apps/edge/test/server-computes-nothing.test.ts keeps it that way).
import { sha256Hex } from "../../../packages/luck/src/random";
import { parseSettings, TOP_LIST, type LuckSettings } from "../../../packages/luck/src/settings";
import { beaconDueMs, gameEndMs, phaseAt, roundOf, totalDiceRounds } from "../../../packages/luck/src/timeline";
import type { Env } from "./worker";

export const LUCK_SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS luck_t (eid TEXT PRIMARY KEY, commit_hash TEXT NOT NULL, secret TEXT, state TEXT NOT NULL DEFAULT 'open', opts TEXT, seed TEXT, players INTEGER, start_ms INTEGER, end_ms INTEGER, result TEXT, ended_ms INTEGER)`,
  `CREATE TABLE IF NOT EXISTS luck_p (eid TEXT NOT NULL, pid TEXT NOT NULL, seat INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY (eid, pid))`,
  `CREATE INDEX IF NOT EXISTS luck_p_seat ON luck_p (eid, seat)`,
  `CREATE TABLE IF NOT EXISTS luck_v (eid TEXT NOT NULL, pid TEXT NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL, at_ms INTEGER NOT NULL, PRIMARY KEY (eid, pid))`,
];

const MAX_MS = 6 * 3_600_000; // a game that has not ended this long after its scheduled start is closed for the data-deletion clock (lifecycle.ts)
const NO_AGREEMENT_MS = 10 * 60_000; // ten minutes after the last dice round with no result agreed: the game is closed without a published result
const BEACON_BATCH = 60;
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const sha = (s: string) => sha256Hex(s);

interface TRow { eid: string; commit_hash: string; secret: string | null; state: "open" | "running" | "done"; opts: string | null; seed: string | null; players: number | null; start_ms: number | null; end_ms: number | null; result: string | null; ended_ms: number | null }
const settingsOf = (t: TRow): LuckSettings => JSON.parse(t.opts ?? "{}");

export const newSecret = (): string => Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, "0")).join("");
export const commitOf = (secret: string): Promise<string> => sha(`LBC-COMMIT|${secret}`);
export const rosterHash = (pids: readonly string[]): Promise<string> => sha(`LBC-ROSTER|${[...pids].sort().join(",")}`);
export const seedOf = async (secret: string, eid: string, pids: readonly string[]): Promise<string> => sha(`LBC-SEED|${secret}|${eid}|${await rosterHash(pids)}`);
/** The fallback beacon: value i of this game. Phones may use any public beacon they can reach; this feed is the one the organizer's server publishes, one value at its due time. */
export const beaconValue = (seed: string, i: number): Promise<string> => sha(`LBC-BEACON|${seed}|${i}`);

export async function ensureL(env: Env, eid: string): Promise<TRow> {
  const have = await env.DB.prepare("SELECT * FROM luck_t WHERE eid=?").bind(eid).first<TRow>();
  if (have) return have;
  const secret = newSecret(), commit = await commitOf(secret);
  await env.DB.prepare("INSERT OR IGNORE INTO luck_t(eid,commit_hash,secret) VALUES(?,?,?)").bind(eid, commit, secret).run();
  return (await env.DB.prepare("SELECT * FROM luck_t WHERE eid=?").bind(eid).first<TRow>())!;
}
/** True once the host has started the game: from then on the list of players is closed. */
export const gameStarted = async (env: Env, eid: string): Promise<boolean> => !!(await env.DB.prepare("SELECT 1 AS x FROM luck_t WHERE eid=? AND state<>'open'").bind(eid).first());
export function endBoundLuck(startMs: number, t: { end_ms: number | null; ended_ms: number | null } | null): number { return t?.ended_ms ? t.ended_ms + 60_000 : t?.end_ms ? t.end_ms + NO_AGREEMENT_MS + 60_000 : startMs + MAX_MS; }

const cleanName = (n: unknown) => String(n ?? "").replace(/[<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, 24) || "Player";

// ---------------------------------------------------------------------------------------------------------------- results (votes of the phones)
export interface ResultLine { seat: number; points: number; hits: number; best: number; line: string }
export interface LuckResult { overall: ResultLine[]; rounds: ResultLine[][] }

/** Reads a result sent by a phone into one fixed shape (so identical results have identical text). Anything odd is refused. */
export function normalizeResult(x: any, players: number, rounds: number): LuckResult | null {
  const lines = (a: any): ResultLine[] | null => {
    if (!Array.isArray(a) || a.length < 1 || a.length > TOP_LIST) return null;
    const out: ResultLine[] = [];
    for (const r of a) {
      if (!r || !Number.isInteger(r.seat) || r.seat < 0 || r.seat >= players || !Number.isInteger(r.points) || r.points < 0 || r.points > 6 * 400 || !Number.isInteger(r.hits) || r.hits < 0 || !Number.isInteger(r.best) || r.best < 0 || r.best > 6) return null;
      out.push({ seat: r.seat, points: r.points, hits: r.hits, best: r.best, line: typeof r.line === "string" ? r.line.slice(0, 120) : "" });
    }
    return new Set(out.map((o) => o.seat)).size === out.length ? out : null;
  };
  const overall = lines(x?.overall); if (!overall) return null;
  if (!Array.isArray(x?.rounds) || x.rounds.length !== rounds) return null;
  const rs: ResultLine[][] = []; for (const r of x.rounds) { const l = lines(r); if (!l) return null; rs.push(l); }
  return { overall, rounds: rs };
}
/** How many different phones must send the same result before it counts. */
export const quorumFor = (players: number): number => Math.min(players, Math.max(3, Math.ceil(players * 0.05)));

const PODIUM = ["first", "second", "third", "fourth", "fifth"] as const;

async function settleVotes(env: Env, t: TRow, now: number): Promise<TRow> {
  if (t.state !== "running") return t;
  const players = t.players ?? 0, q = quorumFor(players);
  const g = await env.DB.prepare("SELECT digest, COUNT(*) AS n FROM luck_v WHERE eid=? GROUP BY digest ORDER BY n DESC LIMIT 2").bind(t.eid).all<{ digest: string; n: number }>();
  const [top, second] = g.results ?? [];
  if (top && top.n >= q && top.n > (second?.n ?? 0)) {
    const row = await env.DB.prepare("SELECT payload FROM luck_v WHERE eid=? AND digest=? LIMIT 1").bind(t.eid, top.digest).first<{ payload: string }>();
    const res: LuckResult = JSON.parse(row!.payload);
    const endMs = Math.max(t.end_ms ?? 0, now);
    const stmts: any[] = [env.DB.prepare("UPDATE luck_t SET state='done', result=?, ended_ms=? WHERE eid=? AND state='running'").bind(row!.payload, endMs, t.eid)];
    for (let i = 0; i < PODIUM.length; i++) {
      const w = res.overall[i]; if (!w) continue;
      const who = await env.DB.prepare("SELECT pid FROM luck_p WHERE eid=? AND seat=?").bind(t.eid, w.seat).first<{ pid: string }>(); if (!who) continue;
      stmts.push(env.DB.prepare("INSERT OR REPLACE INTO settled(eid,pattern,ordinal,round,idx,pids) VALUES(?,?,?,?,?,?)").bind(t.eid, PODIUM[i], 1, 1, 0, JSON.stringify([who.pid])));
      const shellSeat = parseInt(who.pid, 10);
      if (Number.isFinite(shellSeat)) stmts.push(env.DB.prepare("INSERT OR REPLACE INTO winner(eid,round,pattern,ordinal,seat,idx,at_ms,src) VALUES(?,?,?,?,?,?,?,?)").bind(t.eid, 1, PODIUM[i], 1, shellSeat, 0, endMs, "phones"));
    }
    stmts.push(env.DB.prepare("INSERT INTO life(eid,end_ms,end_src) VALUES(?,?,'phones') ON CONFLICT(eid) DO UPDATE SET end_ms=excluded.end_ms, end_src='phones' WHERE life.purged_ms IS NULL").bind(t.eid, endMs));
    await env.DB.batch(stmts);
    return (await env.DB.prepare("SELECT * FROM luck_t WHERE eid=?").bind(t.eid).first<TRow>())!;
  }
  if (t.end_ms && now > t.end_ms + NO_AGREEMENT_MS) { // nobody agreed: close it, no result is published
    await env.DB.prepare("UPDATE luck_t SET state='done', ended_ms=? WHERE eid=? AND state='running'").bind(t.end_ms + NO_AGREEMENT_MS, t.eid).run();
    return (await env.DB.prepare("SELECT * FROM luck_t WHERE eid=?").bind(t.eid).first<TRow>())!;
  }
  return t;
}

/** Scheduled job: closes games whose result never reached agreement. Bounded work. */
export async function luckTick(env: Env, now: number): Promise<number> {
  let n = 0;
  const ts = await env.DB.prepare("SELECT * FROM luck_t WHERE state='running' AND end_ms IS NOT NULL AND end_ms<? LIMIT 200").bind(now).all<TRow>();
  for (const t of ts.results ?? []) { const after = await settleVotes(env, t, now); if (after.state === "done") n++; }
  return n;
}

// ---------------------------------------------------------------------------------------------------------------- routes
export interface LuckCtx {
  env: Env; req: Request; now: number; eid: string; e: any; sub: string; url: URL;
  body: (req: Request, max?: number) => Promise<any | null>; spend: (env: Env, now: number, n?: number) => Promise<boolean>;
  allowed: boolean; /** Organizer or Host (not the AI) */ openName: (pii: string | null) => Promise<string | null>; gate: Response | null; BUSY: () => Response;
}

async function playerOf(c: LuckCtx, pid: unknown, device: unknown): Promise<{ pid: string } | Response> {
  if (typeof pid !== "string" || typeof device !== "string" || !/^[0-9a-f]{16,64}$/.test(device)) return json({ error: "Open the game link on your own phone." }, 400);
  const seat = await c.env.DB.prepare("SELECT s.dev AS dev, s.blocked AS blocked FROM seat s WHERE s.eid=? AND s.pid=?").bind(c.eid, pid).first<{ dev: string | null; blocked: number | null }>();
  if (!seat) return json({ error: "You are not in this game." }, 403);
  if (seat.blocked) return json({ error: "You were removed from this game by the organizer.", code: "removed" }, 403);
  if (!seat.dev || seat.dev !== (await sha(`dev|${c.eid}|${device}`)).slice(0, 32)) return json({ error: "This place is on another phone.", code: "other-phone" }, 403);
  return { pid };
}

export async function luckRoute(c: LuckCtx): Promise<Response> {
  const { env, req, now, eid, sub } = c;
  if (c.gate) return c.gate; // cancelled, did not start, draft, locked: the same answers as every other route
  const method = req.method;
  let t = await ensureL(env, eid);
  t = await settleVotes(env, t, now);

  if (sub === "tick" && method === "POST") { if (!c.allowed) return json({ error: "Not allowed." }, 403); return json({ ok: true, closed: await luckTick(env, now) }); }

  if (sub === "start" && method === "POST") {
    if (!c.allowed) return json({ error: "Only the Organizer or a Host can start the game." }, 403);
    if (t.state !== "open") return json({ error: "The game has already started.", code: "started" }, 409);
    const b = (await c.body(req, 4096)) ?? {};
    const parsed = parseSettings(b.settings ?? b); if (!parsed.ok) return json({ error: parsed.error }, 400);
    const delay = b.delaySecs === undefined ? 20 : Number(b.delaySecs);
    if (!Number.isInteger(delay) || delay < 5 || delay > 3600) return json({ error: "The game starts 5 seconds to 1 hour after you press start." }, 400);
    const rows = await env.DB.prepare("SELECT p.pid AS pid, p.pii AS pii, s.blocked AS blocked FROM participant p LEFT JOIN seat s ON s.eid=p.eid AND s.pid=p.pid WHERE p.eid=? ORDER BY p.pid").bind(eid).all<{ pid: string; pii: string | null; blocked: number | null }>();
    const players: { pid: string; name: string }[] = [];
    for (const r of rows.results ?? []) { if (r.blocked) continue; players.push({ pid: r.pid, name: cleanName(await c.openName(r.pii)) }); }
    if (players.length < 2) return json({ error: `A game needs at least 2 players. ${players.length} joined.`, code: "too-few", joined: players.length }, 409);
    if (!(await c.spend(env, now, players.length * 2 + 8))) return c.BUSY();
    const s = parsed.value, startMs = now + delay * 1000, endMs = gameEndMs(s, startMs);
    const seed = await seedOf(t.secret!, eid, players.map((p) => p.pid));
    const stmts: any[] = [env.DB.prepare("UPDATE luck_t SET state='running', opts=?, seed=?, players=?, start_ms=?, end_ms=? WHERE eid=? AND state='open'").bind(JSON.stringify(s), seed, players.length, startMs, endMs, eid)];
    players.forEach((p, i) => stmts.push(env.DB.prepare("INSERT OR REPLACE INTO luck_p(eid,pid,seat,name) VALUES(?,?,?,?)").bind(eid, p.pid, i, p.name)));
    for (let i = 0; i < stmts.length; i += 90) await env.DB.batch(stmts.slice(i, i + 90));
    return json({ ok: true, players: players.length, startMs, endMs, diceRounds: totalDiceRounds(s), commit: t.commit_hash, secretShownAt: "reveal" });
  }

  if (sub === "end" && method === "POST") { // O7: End the game. Nothing is computed here: the game just gets fewer rounds, so every phone (which reads the settings) stops after that round and the beacon feed stops with it.
    if (!c.allowed) return json({ error: "Only the Organizer or a Host can end the game." }, 403);
    if (t.state === "open") return json({ error: "The game has not started yet.", code: "not-started" }, 409);
    const s = settingsOf(t), ph = phaseAt(s, t.start_ms!, now);
    const was = (JSON.parse(t.opts ?? "{}") as { endedAfterRound?: number }).endedAfterRound;
    if (was) return json({ ok: true, again: true, endedAfterRound: was, endsMs: t.end_ms }); // pressed twice: the same answer
    if (t.state === "done" || ph.kind === "over") return json({ error: "The game is over.", code: "over" }, 409);
    if (ph.kind === "before") return json({ error: "The first dice round has not begun yet. Nothing has been played.", code: "not-yet" }, 409);
    const cur = ph.kind === "break" ? ph.afterRound : roundOf(s, ph.g);
    if (cur >= s.rounds) return json({ ok: true, last: true, endedAfterRound: s.rounds, endsMs: t.end_ms, message: "This is the last round. The game ends by itself when it is over." });
    const s2 = { ...s, rounds: cur }, endMs = gameEndMs(s2, t.start_ms!);
    if (!(await c.spend(env, now, 2))) return c.BUSY();
    await env.DB.prepare("UPDATE luck_t SET opts=?, end_ms=? WHERE eid=? AND state='running'").bind(JSON.stringify({ ...s2, endedAfterRound: cur }), endMs, eid).run();
    return json({ ok: true, endedAfterRound: cur, rounds: cur, endsMs: endMs });
  }

  if (sub === "reveal" && method === "GET") {
    if (t.state !== "done") return json({ commit: t.commit_hash, revealed: false, note: "The secret is shown when the game is over. This fingerprint cannot be changed after that." });
    return json({ commit: t.commit_hash, revealed: true, secret: t.secret, seed: t.seed, eid, how: "commit = sha256('LBC-COMMIT|' + secret); seed = sha256('LBC-SEED|' + secret + '|' + eid + '|' + sha256('LBC-ROSTER|' + sorted player ids joined by comma)); beacon value i = sha256('LBC-BEACON|' + seed + '|' + i). The game id used in every draw is the eid. The code is packages/luck/src." });
  }

  if (sub === "beacon" && method === "GET") {
    if (t.state === "open") return json({ error: "The game has not started.", code: "open" }, 409);
    const s = settingsOf(t), from = Math.max(0, Math.floor(Number(c.url.searchParams.get("from") ?? 0)) || 0), max = 2 * totalDiceRounds(s);
    const values: { i: number; v: string }[] = [];
    for (let i = from; i < max && values.length < BEACON_BATCH; i++) { if (beaconDueMs(s, t.start_ms!, i) > now) break; values.push({ i, v: await beaconValue(t.seed!, i) }); } // a value that is not yet due is never sent
    return json({ serverNow: now, from, values, next: from + values.length, total: max });
  }

  if (sub === "seats" && method === "GET") {
    if (t.state === "open") return json({ error: "The list of players is not closed yet.", code: "open" }, 409);
    const r = await env.DB.prepare("SELECT seat, name FROM luck_p WHERE eid=? ORDER BY seat").bind(eid).all<{ seat: number; name: string }>();
    return json({ players: t.players, seats: (r.results ?? []).map((x) => [x.seat, x.name]) });
  }

  if (sub === "vote" && method === "POST") {
    const b = await c.body(req, 49152); if (!b) return json({ error: "Bad result." }, 400);
    const who = await playerOf(c, b.pid, b.device); if (who instanceof Response) return who;
    if (t.state === "open") return json({ error: "The game has not started.", code: "open" }, 409);
    if (t.state === "done") return json({ ok: true, already: true });
    const s = settingsOf(t);
    if (now < gameEndMs(s, t.start_ms!)) return json({ error: "The game is not over yet.", code: "running" }, 409);
    const inGame = await env.DB.prepare("SELECT 1 AS x FROM luck_p WHERE eid=? AND pid=?").bind(eid, who.pid).first();
    if (!inGame) return json({ error: "The list closed before you joined. You can watch.", code: "watching" }, 409);
    const res = normalizeResult(b.result, t.players ?? 0, s.rounds); if (!res) return json({ error: "That result is not valid.", code: "bad-result" }, 400);
    const payload = JSON.stringify(res), digest = await sha(payload);
    await env.DB.prepare("INSERT INTO luck_v(eid,pid,digest,payload,at_ms) VALUES(?,?,?,?,?) ON CONFLICT(eid,pid) DO UPDATE SET digest=excluded.digest, payload=excluded.payload, at_ms=excluded.at_ms").bind(eid, who.pid, digest, payload, now).run();
    t = await settleVotes(env, t, now);
    return json({ ok: true, agreed: t.state === "done" && !!t.result });
  }

  if (sub === "rank" && method === "GET") {
    const votes = (await env.DB.prepare("SELECT COUNT(*) AS n FROM luck_v WHERE eid=?").bind(eid).first<{ n: number }>())?.n ?? 0;
    if (!t.result) return json({ done: t.state === "done", agreed: false, votes, quorum: quorumFor(t.players ?? 0) });
    const res: LuckResult = JSON.parse(t.result);
    const seats = new Set<number>([...res.overall.map((x) => x.seat), ...res.rounds.flat().map((x) => x.seat)]);
    const names = new Map<number, string>(); const want = [...seats];
    for (let i = 0; i < want.length; i += 80) {
      const part = want.slice(i, i + 80);
      const r = await env.DB.prepare(`SELECT seat, name FROM luck_p WHERE eid=? AND seat IN (${part.map(() => "?").join(",")})`).bind(eid, ...part).all<{ seat: number; name: string }>();
      for (const x of r.results ?? []) names.set(x.seat, x.name);
    }
    const withName = (l: ResultLine[]) => l.map((x, i) => ({ place: i + 1, name: names.get(x.seat) ?? "-", points: x.points, hits: x.hits, best: x.best, line: x.line }));
    return json({ done: true, agreed: true, votes, overall: withName(res.overall), rounds: res.rounds.map(withName) });
  }

  if ((sub === "view" || sub === "me") && method === "GET") {
    const joined = (await env.DB.prepare("SELECT COUNT(*) AS c FROM participant WHERE eid=?").bind(eid).first<{ c: number }>())?.c ?? 0;
    // the organizer's latest "message to everyone" (kv ann/<id>, written by POST /api/z/<id>/announce) rides along with the public view every phone and the big screen already read
    let ann: { id: string; text: string } | null = null;
    { const a = await env.DB.prepare("SELECT v FROM kv WHERE k=?").bind(`ann/${eid}`).first<{ v: string }>(); if (a) { try { const x = JSON.parse(a.v); if (typeof x?.id === "string" && typeof x?.text === "string" && x.text) ann = { id: x.id, text: x.text }; } catch { /* a damaged row shows no message */ } } }
    const head: Record<string, unknown> = { serverNow: now, ann, state: t.state, commit: t.commit_hash, joined, startMs: t.start_ms, endMs: t.end_ms, players: t.players, ...(t.state !== "open" ? { settings: settingsOf(t) } : {}), agreed: !!t.result, endedAfterRound: (JSON.parse(t.opts ?? "{}") as { endedAfterRound?: number }).endedAfterRound ?? null };
    if (sub === "view") return json(head);
    const q = c.url.searchParams, who = await playerOf(c, q.get("pid"), q.get("device")); if (who instanceof Response) return who;
    if (t.state === "open") return json({ ...head, phase: "waiting", message: "You are in. Waiting for the host to start." });
    const me = await env.DB.prepare("SELECT seat, name FROM luck_p WHERE eid=? AND pid=?").bind(eid, who.pid).first<{ seat: number; name: string }>();
    if (!me) return json({ ...head, phase: "watching", message: "The list closed before you joined. You can watch." });
    return json({ ...head, phase: "playing", you: { seat: me.seat, name: me.name } });
  }
  return json({ error: "Not found" }, 404);
}
