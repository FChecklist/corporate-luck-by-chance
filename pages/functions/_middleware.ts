// Runs before the static pages (see _routes.json, which lists the page addresses): the old pages.dev address answers 301 to the new address; every other request goes on unchanged.
import { redirectTarget } from "../../apps/edge/src/pages-redirect";
import { siteHidden, noindexRest } from "../../apps/edge/src/site-hidden";
import { BRAND } from "../../apps/edge/src/brand";
import { payRedirect } from "../../apps/edge/src/console-pay";

export const onRequest = (ctx: { request: Request; env?: { PAY_VIA_CONSOLE?: string; SITE_HIDDEN?: string }; next: () => Promise<Response> }) => {
  const to = redirectTarget(new URL(ctx.request.url), ctx.request.method);
  if (to) return Response.redirect(to, 301);
  const toConsole = payRedirect(ctx.request, ctx.env ?? {}); // PAY_VIA_CONSOLE="1": the old pay pages (/pay, /paylink, /paytest) send the person to the console; off = null, the page is served as before
  const hidden = toConsole ?? siteHidden(ctx.request, ctx.env, BRAND.name); // SITE_HIDDEN = "1": the public marketing pages say "coming soon" (off: nothing changes)
  if (hidden) return hidden;
  if (ctx.env?.SITE_HIDDEN !== "1") return ctx.next(); // flag off: exactly as before
  return ctx.next().then((res) => noindexRest(ctx.request, ctx.env, res)); // flag on: every other page also says noindex (link-holder routes and /api untouched)
};
