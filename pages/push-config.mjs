// The push service address (config/push.json "pushApi"), checked and used by pages/build.mjs. Plain functions so a test can run them (apps/web/test/push-optin.test.ts).
// Dark by default: an empty or unreal value gives "" and then nothing about the push service reaches the page or the page rules.

/** The push service's origin (https only, a real host name with a dot, no user, no path, no query), or "" when the value is empty or not that. */
export function pushOrigin(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  let u;
  try { u = new URL(v); } catch { return ""; }
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash) return "";
  if (u.pathname !== "/" && u.pathname !== "") return "";
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(u.hostname)) return "";
  return u.origin;
}

/** Adds the push service's origin to the connect-src of a page rule, only when there is one. script-src is never touched: the opt-in script is our own file ('self'). */
export function withPushConnect(csp, origin) {
  if (!origin) return csp;
  return csp.replace("connect-src 'self'", "connect-src 'self' " + origin);
}

/** The game page with the push address written into its one data-push-api value (the empty value stays empty while dark). */
export function withPushApi(html, origin) {
  if (!origin) return html;
  return html.replace('data-push-api=""', 'data-push-api="' + origin + '"');
}
