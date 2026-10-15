// The old free address (corporate-luck-by-chance.pages.dev) sends every PAGE request to the same path on the new address with a 301.
// What must keep working on the old address is not redirected: /api/* (the central payment service forwards Razorpay webhooks there, and a 301 would break a POST),
// /__*, /version.json and /.well-known/*. Only GET and HEAD are redirected.
export const OLD_HOST = "corporate-luck-by-chance.pages.dev";
export const NEW_ORIGIN = "https://luck.corporatetambola.com";

/** The address to send the browser to, or null when the request must be answered here. */
export function redirectTarget(url: URL, method: string): string | null {
  if (url.hostname !== OLD_HOST) return null;
  if (method !== "GET" && method !== "HEAD") return null;
  const p = url.pathname;
  if (p.startsWith("/api/") || p === "/api" || p.startsWith("/__") || p === "/version.json" || p.startsWith("/.well-known/")) return null;
  return NEW_ORIGIN + p + url.search;
}
