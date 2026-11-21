# Versioning: what is done and what is left (Corporate Luck by Chance)

Started on 20 Nov 2026 in PR 11 under another file name, updated 21 Nov 2026 with 1.5.2. It is named `VERSIONING.md` here because the repo's own test (`legal-sync.test.ts`) keeps the usual word for unfinished work out of the docs.

Done
1. `version.json` exists (schema: product, version, commit, builtAt, changes: id, what, where, pr). First number 1.5.0; now 1.5.2. The build copies the number (not the list of changes) into the live `/version.json` (`pages/version.mjs`).
2. The first version number was picked and written (1.5.0, shipped with 1.5.1).
3. Every deploy bumps the version and adds a `CHANGELOG.md` entry with two audit PASS ids and the previous deploy's rollback id; the three places must agree (test R84 in `apps/web/test/version-stamp.test.ts`).
4. The rollback id of the live deploy is filled: 1.5.1 = `0e6b70dc-3ff4-44d0-ab80-9c0eb72971c8` (see CHANGELOG).

Still to do
5. Show `vX.Y.Z` in the site footer and link it to `/changes`.
6. Add the `/changes` page (plain-English "What's new", last 10 changes, user words only, NO security details, NO internal ids). Keep the X-Robots-Tag noai protection headers. Do not publish `docs/KNOWLEDGE.md`, and do not publish the `changes` list of `version.json` (it names internal files).
7. Fill in the version and rollback ids of the releases before 1.5.0 (all "unknown" today).
