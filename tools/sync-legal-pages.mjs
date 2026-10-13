// Copies the text of the final legal pages in site/ into the matching pages of the app (apps/web/public), keeping the app's own header, footer and scripts.
// Run: node tools/sync-legal-pages.mjs   (apps/web/test/legal-sync.test.ts fails if the two ever differ)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "..");
const main = (s) => { const m = s.match(/<main[\s\S]*?<\/main>/); if (!m) throw new Error("no <main>"); return m; };
for (const page of ["terms", "legal-position", "refund-policy", "privacy"]) {
  const pub = join(root, "apps/web/public", page + ".html"), site = readFileSync(join(root, "site", page + ".html"), "utf8");
  const cur = readFileSync(pub, "utf8"), m = main(cur);
  writeFileSync(pub, cur.slice(0, m.index) + main(site)[0] + cur.slice(m.index + m[0].length));
}
console.log("legal pages synced");
