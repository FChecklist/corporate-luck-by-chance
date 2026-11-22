# Versioning: what is done and what is left (Corporate Luck by Chance)

Started on 20 Nov 2026 in PR 11 under another file name, updated 22 Nov 2026 with 1.5.4. It is named `VERSIONING.md` here because the repo's own test (`legal-sync.test.ts`) keeps the usual word for unfinished work out of the docs.

Done
1. `version.json` exists (schema: product, version, commit, builtAt, changes: id, what, where, pr). First number 1.5.0; now 1.5.4 (also in `package.json`). The build copies the number (not the list of changes) into the live `/version.json` (`pages/version.mjs`).
2. The first version number was picked and written (1.5.0, shipped with 1.5.1).
3. Every deploy bumps the version and adds a `CHANGELOG.md` entry with two audit PASS ids and the previous deploy's rollback id; the three places must agree (test R84 in `apps/web/test/version-stamp.test.ts`).
4. The rollback id of the live deploy is filled: 1.5.1 = `0e6b70dc-3ff4-44d0-ab80-9c0eb72971c8` (see CHANGELOG).

Done in 1.5.3
5. `vX.Y.Z` is in the footer of every public page and links to `/changes.html` (test R84 keeps the footer, `version.json`, `package.json`, the CHANGELOG and KNOWLEDGE in step).
6. The `/changes.html` page is "What's new" in plain words, user words only, no internal ids and no security details; it is served with the noai and noindex headers. `docs/KNOWLEDGE.md` and the `changes` list of `version.json` are not published.

Still to do
7. Fill in the version and rollback ids of the releases before 1.5.0 (all "unknown" today).
