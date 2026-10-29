// Makes brochure.pdf (one A4 page) from the brochure page, with headless Chrome or Edge.
// The page is opened over http from apps/web/public, because the brand style sheets are linked from the site root (a file:// address would print it unstyled).
// Run after editing the brochure:  node tools/make-brochure.mjs [out.pdf]   (default: apps/web/public/brochure.pdf; CHROME=/path/to/chrome if it is not in the usual places)
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join, extname } from "node:path";
const root = resolve(import.meta.dirname, "..");
const web = join(root, "apps/web/public"), pdf = resolve(process.argv[2] ?? join(web, "brochure.pdf"));
const browsers = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
const exe = browsers.find((b) => existsSync(b));
if (!exe) { console.error("No Chrome or Edge found."); process.exit(1); }
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/" || p.includes("..")) p = "/index.html";
  const f = [p, p + ".html"].map((x) => join(web, x)).find((x) => existsSync(x) && extname(x));
  if (!f) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const url = `http://127.0.0.1:${server.address().port}/brochure`;
const status = await new Promise((done) => spawn(exe, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []), "--disable-background-networking", "--virtual-time-budget=4000", `--print-to-pdf=${pdf}`, url], { stdio: "ignore" }).on("exit", done)); // not spawnSync: the page is served by this very process
server.close();
if (!existsSync(pdf)) { console.error("PDF not written", status); process.exit(1); }
const pages = (readFileSync(pdf, "latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log("wrote", pdf, readFileSync(pdf).length, "bytes,", pages, "page(s)");
if (pages !== 1) { console.error("The brochure must be exactly one page."); process.exit(1); }
