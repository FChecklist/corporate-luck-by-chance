// The whole-site check of the owner's list (29 Oct 2026), one test: tools/site-brand/verify-site.ts builds pages/public as the deploy would and checks every page.
// Run it alone for the per-rule report:  bun run tools/site-brand/verify-site.ts
import { expect, test } from "bun:test";
import { verifySite } from "../../../tools/site-brand/verify-site";

test("every rule of tools/site-brand/verify-site.ts holds on every page of the site", () => {
  const r = verifySite();
  expect(r.rules.length).toBeGreaterThanOrEqual(16);
  expect(r.problems.map((p) => `${p.rule} ${p.page}: ${p.detail}`)).toEqual([]);
});
