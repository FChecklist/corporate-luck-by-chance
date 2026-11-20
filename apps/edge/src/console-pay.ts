// The game's side of the console's Pay step (console repo: docs/GAME_PAY_CONTRACT.md, docs/PAY_STEP.md). Two adapter functions and the switch for the old Pay now routes.
//   payInfo  - read only: is this person the ORGANIZER of this game, what size is it, is it already paid.
//   markPaid - the console says a Moneypenny order for this game is paid. This is the ONLY thing that unlocks the start through the console. It is REPEATABLE:
//              it re-checks owner and size, refuses with { definite: true } (nothing changed) when either is wrong, does nothing when the game is already paid,
//              and never extends or resets anything on a repeat. A half-done call is safe to run again (the unlock itself is the LAST write, and only while the game is unpaid).
// No price lives here: the size is the pack the game already belongs to (paylink.ts packFor); every amount comes from the console / Moneypenny.
// Dark by default: the bridge itself is not wired to a route yet, and PAY_VIA_CONSOLE is off, so nothing here runs in the live game.
import { legacyPayRedirect, type Adapter } from "./console-bridge/bridge";
import { GRACE_ROUNDS } from "../../../packages/beacon/src/config";
import CFG from "../../../config/console-pay.json";
import { LATE_PAY_LEAD_ROUNDS } from "./pay";
import { packFor } from "./paylink";
import type { Env } from "./worker";

/** the game's id as the console and Moneypenny list it, and the console's address (config/console-pay.json, the same file the page's security rules are built from) */
export const PAY_GAME: string = CFG.payGame;
export const CONSOLE_ORIGIN: string = CFG.consoleOrigin;

const GENESIS_S = 1692803367; // drand quicknet: round r is published at GENESIS_S + (r-1)*3 s (the same clock the whole game uses)
const roundMs = (r: number) => (GENESIS_S + (r - 1) * 3) * 1000;

interface Row { id: string; org: string | null; cap: number; pack: number | null; start_round: number; cancelled_ms: number | null; unplayed_ms: number | null }
const rowOf = (env: Env, eid: string) => env.DB.prepare("SELECT id, org, cap, pack, start_round, cancelled_ms, unplayed_ms FROM engagement WHERE id=?").bind(eid).first<Row>();
/** the organizer's own game only: `sub` is the hash of an e-mail that signs in as the game's ORGANIZER account (a Host, a Co-host or a stranger is never in organizer_email for this game's account) */
const isOrganizer = async (env: Env, g: Row, sub: string): Promise<boolean> => {
  if (!g.org || typeof sub !== "string" || !sub) return false;
  const who = await env.DB.prepare("SELECT org FROM organizer_email WHERE email_hash=?").bind(sub).first<{ org: string }>();
  return !!who && who.org === g.org;
};
/** the size the console is asked to pay for: the pack the game already holds, else the smallest pack that covers its limit (null = a custom arrangement, nothing to pay here) */
const sizeOf = (g: Row): string | null => (g.pack ? String(g.pack) : packFor(g.cap) ? String(packFor(g.cap)) : null);
const refuse = (m: string) => Object.assign(new Error(m), { definite: true as const });

export const payInfo: NonNullable<Adapter<Env>["payInfo"]> = async (env, o) => {
  const g = await rowOf(env, o.eid);
  if (!g || !(await isOrganizer(env, g, o.sub))) return { owner: false, item: null, paid: false };
  return { owner: true, item: sizeOf(g), paid: !!g.pack };
};

export const markPaid: NonNullable<Adapter<Env>["markPaid"]> = async (env, o) => {
  const g = await rowOf(env, o.eid);
  if (!g || !(await isOrganizer(env, g, o.sub))) throw refuse("This game does not belong to the person who paid.");
  const size = sizeOf(g);
  if (!size || size !== o.item) throw refuse("The size paid for is not the size of this game.");
  if (g.pack) return; // already paid (by this order or another route): success again, nothing is touched
  if (g.cancelled_ms || g.unplayed_ms) throw refuse("This game can no longer be paid for.");
  // a game held because it was not paid at its start time begins 2 minutes after the payment (the same rule as pay.ts fulfil); otherwise the start time stays as it is
  const late = roundMs(g.start_round) <= o.nowMs;
  const restart = late ? Math.floor((o.nowMs / 1000 - GENESIS_S) / 3) + 2 + LATE_PAY_LEAD_ROUNDS - GRACE_ROUNDS : g.start_round;
  // The size was worked out from g.cap. The owner can change the limit at any moment, so EVERY write below only happens while the game is still exactly what we checked:
  // unpaid, open, and at that same limit (cap=?). If the limit moved in between, nothing is written and the size is looked at again by the repeat of the call.
  const same = "EXISTS (SELECT 1 FROM engagement WHERE id=? AND org=? AND pack=0 AND cap=? AND cancelled_ms IS NULL AND unplayed_ms IS NULL)";
  const g4 = [o.eid, g.org, g.cap];
  const r = await env.DB.batch([
    // paying also publishes; the order is kept with the game record. These come FIRST and are harmless if the call dies here: the game is still unpaid and the console repeats the call.
    env.DB.prepare(`INSERT OR IGNORE INTO kv(k,v) SELECT ?,? WHERE ${same}`).bind(`pub/${o.eid}`, String(o.nowMs), ...g4),
    env.DB.prepare(`INSERT OR IGNORE INTO kv(k,v) SELECT ?,? WHERE ${same}`).bind(`paidby/${o.eid}`, JSON.stringify({ by: "organizer", ms: o.nowMs, via: "console" }), ...g4),
    env.DB.prepare(`INSERT INTO kv(k,v) SELECT ?,? WHERE ${same} ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(`payref/${o.eid}`, o.orderRef, ...g4),
    // the unlock: the LAST write, and only while the game is still unpaid, open and at the limit the size was worked out from
    env.DB.prepare("UPDATE engagement SET pack=?, start_round=? WHERE id=? AND org=? AND pack=0 AND cap=? AND cancelled_ms IS NULL AND unplayed_ms IS NULL").bind(Number(size), restart, o.eid, g.org, g.cap),
  ]);
  if ((r[3]?.meta?.changes ?? 0) === 1) return;
  const now = await rowOf(env, o.eid); // someone else changed the game between our look and our write: paid meanwhile is fine, anything else is a refusal
  if (now?.pack) return;
  throw refuse("This game can no longer be paid for (its size or state changed while paying).");
};

/** the game's own old payment routes that START a payment (Razorpay's notice, the buyer's return check and read-only views are NOT here: money already paid must still be recorded) */
export const LUCK_PAY_ROUTES: RegExp[] = [
  /^\/(pay|paylink|paytest)$/, // the clean addresses of the three pages (Cloudflare serves /pay.html as /pay)
  /^\/api\/(checkout|payments\/test|payments\/paytest)$/,
  /^\/api\/paylink\/[0-9a-f]{48}\/checkout$/,
  /^\/api\/z\/[^/]+\/pay-with-credit$/,
];
/** null = not this business (or the switch is off: PAY_VIA_CONSOLE must be exactly "1"); otherwise a 302 to the console */
export const payRedirect = (req: Request, env: { PAY_VIA_CONSOLE?: string }): Response | null =>
  legacyPayRedirect(req, { flag: env.PAY_VIA_CONSOLE, consoleOrigin: CONSOLE_ORIGIN, extra: LUCK_PAY_ROUTES });
