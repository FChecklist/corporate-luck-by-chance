// K3 (27 Nov 2026): SITE_HIDDEN = "1" shows "coming soon" on the public marketing pages only. FALSIFIED BY: flag-off-changes-a-page, flag-on-leaves-a-landing-page, join-link-blocked, host-page-blocked, api-blocked, sitemap-still-served, llms-still-served, coming-soon-has-schema-or-og, coming-soon-has-no-noindex, coming-soon-names-lucifertech
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { siteHidden, HOME_URL } from "../src/site-hidden";
import { onRequest } from "../../../pages/functions/_middleware";
import { BRAND } from "../src/brand";

const ORIGIN = "https://luck.corporatetambola.com";
const req = (p: string, method = "GET") => new Request(ORIGIN + p, { method });
const MARKETING = ["/", "/index.html", "/index", "/about", "/about.html", "/brochure", "/how-it-plays", "/pricing", "/pricing.html", "/trust", "/organizer-guide", "/ABOUT", "/about/"].map((p) => p);
const REACHABLE = ["/j/abcdef", "/z", "/z.html?e=GAME-1", "/zc", "/zc.html", "/host", "/host.html", "/signin", "/demo", "/pay", "/pay.html", "/paylink", "/terms", "/privacy", "/legal", "/refund-policy", "/helpdesk", "/partner", "/contact", "/guide", "/report", "/api/z/GAME-1/info", "/api/payments/webhook", "/version.json", "/robots.txt", "/app.css", "/luck.js"];

describe("SITE_HIDDEN off: exactly today's behaviour", () => {
  for (const flag of [undefined, "", "0", "true", "yes", " 1"]) test(`flag ${JSON.stringify(flag)} touches nothing`, () => {
    for (const p of [...MARKETING, ...REACHABLE, "/llms.txt", "/sitemap.xml"]) expect(siteHidden(req(p), { SITE_HIDDEN: flag }, BRAND.name)).toBeNull();
    expect(siteHidden(req("/"), undefined, BRAND.name)).toBeNull();
  });
  test("the middleware hands every request on (next is called)", async () => {
    for (const p of ["/", "/about", "/llms.txt", "/z.html", "/j/abc"]) {
      const r = await onRequest({ request: req(p), env: {}, next: async () => new Response("NEXT") });
      expect(await r.text()).toBe("NEXT");
    }
  });
});

describe("SITE_HIDDEN on: public pages are 'coming soon', everything people use still works", () => {
  const env = { SITE_HIDDEN: "1" };
  test("every marketing page answers 200 with the friendly page, noindex meta and header, no cache", async () => {
    for (const p of MARKETING) {
      const r = siteHidden(req(p), env, BRAND.name)!;
      expect(r, p).not.toBeNull();
      expect(r.status).toBe(200);
      expect(r.headers.get("x-robots-tag")).toContain("noindex");
      expect(r.headers.get("cache-control")).toBe("no-store");
      const h = await r.text();
      expect(h).toContain("This game is coming soon");
      expect(h).toContain('<meta name="robots" content="noindex, nofollow">');
      expect(h).toContain(`href="${HOME_URL}"`);
      expect(HOME_URL).toBe("https://home.corporatetambola.com/");
      expect(h).toContain(BRAND.name);
    }
  });
  test("no schema, no Open Graph, no Twitter card, no canonical, no script, no agree button, no lucifertech.com", async () => {
    const h = await siteHidden(req("/"), env, BRAND.name)!.text();
    for (const bad of ["ld+json", "schema.org", "og:", "twitter:", "canonical", "<script", "<button", "<form", "<input", "lucifertech", "I agree", "Accept"]) expect(h.toLowerCase(), bad).not.toContain(bad.toLowerCase());
  });
  test("HEAD works and has no body; POST is left alone", async () => {
    const r = siteHidden(req("/", "HEAD"), env, BRAND.name)!;
    expect(r.status).toBe(200); expect(await r.text()).toBe("");
    expect(siteHidden(req("/", "POST"), env, BRAND.name)).toBeNull();
  });
  test("/sitemap.xml and /llms.txt are gone (404, noindex)", () => {
    for (const p of ["/sitemap.xml", "/llms.txt", "/LLMS.txt"]) { const r = siteHidden(req(p), env, BRAND.name)!; expect(r.status).toBe(404); expect(r.headers.get("x-robots-tag")).toContain("noindex"); }
  });
  test("join links, player page, host pages, sign-in, payment return, legal pages, API and assets are NOT touched", () => {
    for (const p of REACHABLE) expect(siteHidden(req(p), env, BRAND.name), p).toBeNull();
  });
  test("through the real middleware: marketing is replaced, a join link goes on to next()", async () => {
    const a = await onRequest({ request: req("/"), env, next: async () => new Response("NEXT") });
    expect(await a.text()).toContain("coming soon");
    for (const p of ["/j/abcdef", "/z.html?e=GAME-1", "/zc", "/host", "/api/z/GAME-1/info"]) {
      const b = await onRequest({ request: req(p), env, next: async () => new Response("NEXT") });
      expect(await b.text(), p).toBe("NEXT");
    }
  });
});

describe("build wiring", () => {
  test("/llms.txt and /sitemap.xml are in the list of addresses the function runs for (so the switch can answer them)", () => {
    const b = readFileSync(new URL("../../../pages/build.mjs", import.meta.url), "utf8");
    expect(b).toContain('include: ["/api/*", "/ai/*", "/j/*", "/llms.txt", "/sitemap.xml"');
  });
});

describe("SITE_HIDDEN on: odd spellings of an address are tidied before the lookup (K5)", () => {
  const env = { SITE_HIDDEN: "1" };
  test("//about, /%61bout and mixed forms still show coming soon", async () => {
    for (const p of ["//about", "/%61bout", "///about", "/%41BOUT", "//about//", "/about%2F", "/%61bout.html", "/%2fabout", "//"]) {
      const r = siteHidden(req(p), env, BRAND.name);
      expect(r, p).not.toBeNull();
      expect(await r!.text(), p).toContain("coming soon");
    }
  });
  test("//sitemap.xml, //llms.txt and /%73itemap.xml answer 404", () => {
    for (const p of ["//sitemap.xml", "//llms.txt", "/%73itemap.xml", "/%6Clms.txt"]) { const r = siteHidden(req(p), env, BRAND.name); expect(r, p).not.toBeNull(); expect(r!.status).toBe(404); }
  });
  test("odd spellings of link-holder and API addresses are still not touched", () => {
    for (const p of ["//j/abcdef", "/%6a/abcdef", "//api/mode", "/%61pi/mode", "//host", "/z//x"]) expect(siteHidden(req(p), env, BRAND.name), p).toBeNull();
  });
  test("a broken % escape does not throw and is not a hidden page", () => {
    expect(siteHidden(req("/%E0%A4%A"), env, BRAND.name)).toBeNull();
    expect(siteHidden(req("/%zz"), env, BRAND.name)).toBeNull();
  });
  test("flag off stays untouched for the odd spellings too", () => {
    for (const p of ["//about", "/%61bout", "//sitemap.xml"]) { expect(siteHidden(req(p), {}, BRAND.name)).toBeNull(); expect(siteHidden(req(p), { SITE_HIDDEN: "true" }, BRAND.name)).toBeNull(); }
  });
});

describe("Luck only (M4): with the switch on, every other page is noindex too; link holders are untouched", () => {
  const on = { SITE_HIDDEN: "1" };
  const html = (body = "<html><head><title>t</title></head><body>x</body></html>") => () => Promise.resolve(new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "content-length": String(body.length) } }));
  test("/demo, /terms, /contact, /privacy, /signin, /pay get X-Robots-Tag and a noindex meta (an old 'index, follow' meta is replaced)", async () => {
    for (const p of ["/demo", "/terms", "/contact", "/privacy", "/signin", "/pay", "/refund-policy", "//terms", "/%74erms"]) {
      const r = await onRequest({ request: req(p), env: on, next: html('<html><head><meta name="robots" content="index, follow, max-image-preview:large"></head><body>x</body></html>') });
      expect(r.headers.get("x-robots-tag"), p).toContain("noindex");
      const t = await r.text();
      expect(t, p).toContain('<meta name="robots" content="noindex, nofollow">');
      expect(t, p).not.toContain("index, follow");
      expect(r.headers.get("content-length"), p).toBeNull();
    }
  });
  test("a page with no robots meta gets one before </head>", async () => {
    const r = await onRequest({ request: req("/terms"), env: on, next: html() });
    expect(await r.text()).toContain('<meta name="robots" content="noindex, nofollow"></head>');
  });
  test("link-holder routes and the API are returned exactly as they came", async () => {
    for (const p of ["/j/abcdef", "//j/abcdef", "/z", "/z.html?e=GAME-1", "/zc", "/zc.html", "/host", "/host.html", "/api/z/GAME-1/info", "/ai/x"]) {
      const orig = new Response("<html><head></head><body>ORIG</body></html>", { headers: { "content-type": "text/html" } });
      const r = await onRequest({ request: req(p), env: on, next: async () => orig });
      expect(r, p).toBe(orig);
      expect(r.headers.get("x-robots-tag"), p).toBeNull();
    }
  });
  test("non-HTML files (scripts, styles, robots.txt, version.json) and POST are untouched", async () => {
    for (const [p, type] of [["/luck.js", "text/javascript"], ["/app.css", "text/css"], ["/robots.txt", "text/plain"], ["/version.json", "application/json"]]) {
      const orig = new Response("x", { headers: { "content-type": type } });
      const r = await onRequest({ request: req(p), env: on, next: async () => orig });
      expect(r, p).toBe(orig);
    }
    const o2 = new Response("<html><head></head></html>", { headers: { "content-type": "text/html" } });
    expect(await onRequest({ request: req("/terms", "POST"), env: on, next: async () => o2 })).toBe(o2);
  });
  test("HEAD gets the header", async () => {
    const r = await onRequest({ request: req("/terms", "HEAD"), env: on, next: async () => new Response(null, { headers: { "content-type": "text/html" } }) });
    expect(r.headers.get("x-robots-tag")).toContain("noindex");
  });
  test("switch off (or not exactly 1): the very same response object comes back, nothing added", async () => {
    for (const flag of [undefined, "", "0", "true", " 1"]) {
      const orig = new Response("<html><head><meta name=\"robots\" content=\"index, follow\"></head></html>", { headers: { "content-type": "text/html" } });
      const r = await onRequest({ request: req("/terms"), env: { SITE_HIDDEN: flag }, next: async () => orig });
      expect(r).toBe(orig);
      expect(r.headers.get("x-robots-tag")).toBeNull();
    }
  });
  test("robots.txt is not changed by this code", () => {
    const src = readFileSync(new URL("../src/site-hidden.ts", import.meta.url), "utf8");
    expect(src).not.toContain("Disallow");
  });
});
