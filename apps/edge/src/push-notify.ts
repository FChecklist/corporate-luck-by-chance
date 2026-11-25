// "Yes, notify me when this game begins" on the server side (corporate-push, FChecklist/corporate-push). DARK: nothing here does anything, and no request leaves, until BOTH settings are set on the site:
// PUSH_URL (the push service's https address) and PUSH_ADMIN_KEY (its admin key, a secret). Two small jobs, both best effort: neither can stop a game from starting or its data from being deleted.
//   1. When a game really starts (luck.ts beginGame, the one step both ways to start go through), ONE message of kind "game_begins" goes to the people who tapped "notify me" for that game:
//      POST {PUSH_URL}/send, scope "game:<id>", the game's link. A flag on the game's own row (luck_t.push_sent_ms), claimed with one conditional write, keeps it to one send per game
//      even if two starts race; a second start never reaches this step at all (beginGame refuses it first).
//   2. When a game's personal data is deleted (lifecycle.ts erasePersonal: the scheduled job at 23 hours, an organizer's delete, a deletion request, a test clean-up),
//      POST {PUSH_URL}/purge, scope "game:<id>", removes the saved browser addresses of that game at once. The push service also deletes them itself within 24 hours of the tap, so a purge that could not be made is only early, not missing.
// The admin key goes in one header. It is never written to the database, to a log or to an answer, and nothing here logs at all.
import { BRAND } from "./brand";
import type { Env } from "./worker";

export const PUSH_SCHEMA: string[] = [
  // set once, when "the game has begun" was handed to the push service for this game (0027_push_notify.sql)
  `ALTER TABLE luck_t ADD COLUMN push_sent_ms INTEGER`,
];

/** What a person reads on the lock screen. Plain and kind; the link opens the game. */
export const PUSH_TITLE = "The game is starting";
export const PUSH_BODY = "Tap to open the game and join in.";
const TIMEOUT_MS = 3000;

/** The push service's address (an https origin: a real host name, no path, no query) and its admin key, or null when either is missing or the address is not real. */
export function pushConfig(env: { PUSH_URL?: string; PUSH_ADMIN_KEY?: string }): { url: string; key: string } | null {
  const raw = String(env.PUSH_URL ?? "").trim(), key = String(env.PUSH_ADMIN_KEY ?? "").trim();
  if (!raw || !key) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || (u.pathname !== "/" && u.pathname !== "")) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(u.hostname)) return null;
  return { url: u.origin, key };
}

const validId = (eid: string) => /^[A-Za-z0-9_-]{1,128}$/.test(eid);

/** The link a person opens from the notification: this game's page on the site. */
export const gameLink = (env: Env, eid: string): string => `${String((env as { PUBLIC_ORIGIN?: string }).PUBLIC_ORIGIN || BRAND.defaultOrigin).replace(/\/+$/, "")}/z.html?e=${encodeURIComponent(eid)}`;

/** One POST to the push service with the admin key. True only when it answered with a success; any failure (no answer, a refusal, a slow answer) is false and is never thrown. */
async function post(cfg: { url: string; key: string }, path: string, body: unknown): Promise<boolean> {
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const r = await globalThis.fetch(cfg.url + path, { method: "POST", headers: { authorization: "Bearer " + cfg.key, "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined });
    return r.ok;
  } catch { return false; } finally { if (timer) clearTimeout(timer); }
}

/**
 * The game has really started: tell the people who asked, once.
 * "off" = a setting is missing (nothing was written, nothing was sent), "already" = this game's one send was already claimed, "sent" / "failed" = the push service did / did not accept it.
 */
export async function pushGameBegins(env: Env, eid: string, now: number): Promise<"off" | "already" | "sent" | "failed"> {
  const cfg = pushConfig(env);
  if (!cfg || !validId(eid)) return "off";
  const claim = await env.DB.prepare("UPDATE luck_t SET push_sent_ms=? WHERE eid=? AND push_sent_ms IS NULL").bind(now, eid).run();
  if ((claim.meta?.changes ?? 0) !== 1) return "already"; // the claim and the check are one write, so two starts at the same moment cannot both send
  return (await post(cfg, "/send", { scope: "game:" + eid, kind: "game_begins", title: PUSH_TITLE, body: PUSH_BODY, url: gameLink(env, eid) })) ? "sent" : "failed";
}

/** The game's data is deleted: have the push service delete the browser addresses it saved for this game. Does nothing without both settings. Never throws. */
export async function pushPurge(env: Env, eid: string): Promise<"off" | "done" | "failed"> {
  const cfg = pushConfig(env);
  if (!cfg || !validId(eid)) return "off";
  return (await post(cfg, "/purge", { scope: "game:" + eid })) ? "done" : "failed";
}
