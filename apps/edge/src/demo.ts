// The free DEMO game (owner order 1 Nov 2026): a game for up to 10 people (DEMO_CAP), no payment, labelled "Demo" on every screen, same rules and engine as the real game.
// FLAG: DEMO_GAME must be exactly "on". OFF by default: with no value (or any other value) games behave as before and nothing here counts or labels anything.
// Abuse limit: at most 3 demo games per organizer account and per network address per day. The address is kept only as a one-way hash of the day and the address, for two days.
// A demo never uses a paid pack and never makes a payment row: it is published through the free path (no entitlement, no payment). Its data goes the same 23-hour way as any game (lifecycle.ts).
import { DEMO_CAP } from "../../../packages/beacon/src/config";
import type { D1, Env } from "./worker";

export const DEMO_PER_DAY = 3;
export const DEMO_LIMIT_MSG = "You have started 3 free demo games today. Please try again tomorrow, or publish a full game.";
export const demoOn = (env: { DEMO_GAME?: string }): boolean => env.DEMO_GAME === "on";
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
async function hash(s: string): Promise<string> { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].slice(0, 10).map((x) => x.toString(16).padStart(2, "0")).join(""); }
const count = async (db: D1, prefix: string): Promise<number> => (await db.prepare("SELECT COUNT(*) AS c FROM kv WHERE k LIKE ?").bind(prefix + "%").first<{ c: number }>())?.c ?? 0;

/** A game made now for at most 10 people by an organizer (not by us) is a demo while the flag is on. */
export const isDemoCap = (cap: number): boolean => cap <= DEMO_CAP;

/** The limit, checked before the game is made. `ok:false` carries the plain message. */
export async function demoAllowed(env: { DB: D1; DEMO_GAME?: string }, org: string, ip: string, now: number): Promise<boolean> {
  const d = day(now);
  return (await count(env.DB, `demo/o/${d}/${org}/`)) < DEMO_PER_DAY && (await count(env.DB, `demo/i/${d}/${await hash(d + "|" + ip)}/`)) < DEMO_PER_DAY;
}
/** Remember a demo game: the game marker, and one count against the account and one against the address for today. */
export async function demoNote(env: { DB: D1 }, eid: string, org: string, ip: string, now: number): Promise<void> {
  const d = day(now), put = (k: string) => env.DB.prepare("INSERT OR IGNORE INTO kv(k,v) VALUES(?,?)").bind(k, String(now));
  await env.DB.batch([put(`demo/g/${eid}`), put(`demo/o/${d}/${org}/${eid}`), put(`demo/i/${d}/${await hash(d + "|" + ip)}/${eid}`)]);
}
/** Is this game a demo (flag on, made as a demo, still no bigger than 10)? Shown as "Demo" on every screen. */
export async function isDemoGame(env: { DB: D1; DEMO_GAME?: string }, e: { id: string; cap: number }): Promise<boolean> {
  if (!demoOn(env) || !isDemoCap(e.cap)) return false;
  return !!(await env.DB.prepare("SELECT 1 AS x FROM kv WHERE k=?").bind(`demo/g/${e.id}`).first());
}
/** The daily counters older than yesterday go (they hold only a hash and an account id). Called from the lifecycle pass. */
export async function demoSweep(env: { DB: D1 }, now: number): Promise<void> {
  const keep = day(now - 86_400_000);
  for (const t of ["o", "i"]) await env.DB.prepare("DELETE FROM kv WHERE k LIKE ? AND k < ?").bind(`demo/${t}/%`, `demo/${t}/${keep}/`).run();
}
