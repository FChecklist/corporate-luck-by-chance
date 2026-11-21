# Changelog: Corporate Luck by Chance

Newest first. Per version: Added / Changed / Fixed, each line = what, where, PR, audit result, rollback id. The standard is the marketing-ledger file plans/VERSION-AND-KNOWLEDGE-STANDARD-2026-11-20.md, section 2.2. Every change that goes live bumps the version here, in `version.json` and in `docs/KNOWLEDGE.md` in the same pull request.

## 1.5.2 - 2026-11-21 (not deployed; nothing live changes until the owner says go)
The owner's rules of 20 Nov 2026 (version 1.1), put into this game. In plain words:

Changed
- **Invite by ID only.** You invite people with just an ID (employee, associate, vendor or customer ID: one box, one kind of ID). No names and no mobile numbers are asked, kept or shown for guests. A-1101, A 1101 and A/1101 are the same ID. A person who is not on your list waits for your yes or no, and you see the ID and the nickname they typed. The list and all IDs are deleted with the rest of the guests' data, 23 hours after the game ends (inside the 24 hours promised). The player's page has one ID box and a nickname box. A mobile number is no longer a way to join. Where: `apps/edge/src/invite-id.ts` (new), `people.ts`, `worker.ts`, `pii.ts`, `rights.ts`, `report-layout.ts`, `apps/web/public/zc.js`, `luck.js`, `guide.js`. Tests: `invite-id.test.ts`, `people.test.ts` and the other edge tests moved to IDs, `luck-page.test.ts`, `pages.test.ts`. PR: https://github.com/FChecklist/corporate-luck-by-chance/pull/PRNUM.
- **Two ways to start.** "You start the game" (as before, the default) or "The game starts by itself": at the start time the game begins by itself with the choices you saved on the run-the-game page (10 rounds and a 10 second window if you saved nothing). It waits until at least 2 players have joined and never starts a game that is not paid. Where: `apps/edge/src/luck.ts`, `packages/beacon/src/config.ts`, `worker.ts`, `zc.js`, `host.js`. Tests: `start-options.test.ts`, `host-start.test.ts`. PR: https://github.com/FChecklist/corporate-luck-by-chance/pull/PRNUM.
- **The console speaks to you.** "Your people", "Add to your list", "Publish your game" and the rest: no "I", "my" or "me" on the organizer's screens. "Anyone with the link" is no longer offered in the console. Where: `zc.js`, `host.js`, `ai-link.js`. Test: `apps/web/test/console-voice.test.ts`. PR: https://github.com/FChecklist/corporate-luck-by-chance/pull/PRNUM.
- **Wording that was not true is corrected.** The pages no longer say that "not even us" can know a number (the server holds the secret until the game is over, as `docs/RULES.md` says); the owner's line "not even the software" is not used for the same reason. A default game takes 24 minutes 40 seconds, not the older, longer figure. Where: `apps/web/public/index.html`, `legal.html`, `trust.html` (made from `ai-facts.ts`), `site/index.html`, `site/how-it-plays.html`, `docs/RULES.md`, `docs/SPEC.md`. Test: `honest-wording.test.ts`. PR: https://github.com/FChecklist/corporate-luck-by-chance/pull/PRNUM.
- **The version is readable from the live site.** `/version.json` now carries the version number next to the commit. Where: `pages/version.mjs`, `pages/build.mjs`, `docs/DEPLOYS.md`. Test: `apps/web/test/version-stamp.test.ts`. PR: https://github.com/FChecklist/corporate-luck-by-chance/pull/PRNUM.
- The owner's rules are in the repo: `docs/SUITE_RULES.md` (with what this game does about each rule), `docs/CONSOLE_VOICE.md`, `docs/KNOWLEDGE.md`, `README.md`; new rules R71 to R83 in `docs/RULES.md`.
Audits: pending (0 of 2). Rollback id: 7fb0c286 (the 1.5.1 deployment; only its short id is recorded).
Not changed on purpose: the audited pay contract (`apps/edge/src/console-pay.ts`, `console-bridge/`, `pack/`), the money switches (`PAY_VIA_CONSOLE` stays unset), the legal pages and the Terms box wording.

## 1.5.1 - 2026-11-20 (deployed to Cloudflare Pages 2026-11-20 18:52 UTC, dark: PAY_VIA_CONSOLE unset)
Fixed
- `markPaid` size race (audit High): the owner could pay for a small size and play a bigger one by raising the limit between the size check and the unlock. All four writes of `markPaid` are now guarded by `cap=?` (the limit the size was worked out from) on top of unpaid and open; if the limit moved, it refuses for certain (`definite`) and writes nothing, not even the order record. Where: `apps/edge/src/console-pay.ts`; test: `apps/edge/test/console-pay.test.ts` (race test, falsified by dropping the guard), `console-pay-static.test.ts`. PR: https://github.com/FChecklist/corporate-luck-by-chance/pull/12. Audits: 1 FAIL (this fix), then 2 independent PASS on 446ba21. Deployment 7fb0c286. Rollback id: 0e6b70dc-3ff4-44d0-ab80-9c0eb72971c8 (previous production deployment, commit ebda7644).

## 1.5.0 - 2026-11-20 (shipped together with 1.5.1; dark: nothing changes for players until the owner sets PAY_VIA_CONSOLE)
Added
- Console Pay step, game side (dark): `payInfo` / `markPaid` for the organizer's own game (repeatable, definite refusal on wrong owner or size, unlock is the last write). Where: `apps/edge/src/console-pay.ts`. PR: https://github.com/FChecklist/corporate-luck-by-chance/pull/12. Audits: the same two PASS as 1.5.1. Rollback id: as 1.5.1.
- Vendored console bridge, test kit and game pack, byte for byte, with manifests. Where: `apps/edge/src/console-bridge/`, `apps/edge/test/console-contract/`, `apps/web/public/pack/`. The bridge is not wired to a route yet (no adapter).
- Switch `PAY_VIA_CONSOLE` (off = the old Pay now link works exactly as before; "1" = old pay pages and routes answer 302 to the console). Where: `apps/edge/src/worker.ts` (handleCore), `pages/functions/_middleware.ts`.
- Descriptor `payGame`, `consoleOrigin`. Where: `apps/web/public/zc-pay-game.js`, `config/console-pay.json`.
Changed
- Page rules of the organizer page `/zc`: `frame-src` allows the payment window's address, `connect-src` allows the console, no wildcard. Where: `pages/build.mjs`, test `apps/edge/test/csp-google.test.ts` updated to match.

## Before 1.5.0 (reconstructed on 20 Nov 2026 from git history and tags; PR 11)
There was no changelog and no version number before this file. Dates are from tags and commits; audit ids and rollback ids are unknown. Newest first.
- 2026-11-14: knowledge map added (docs only).
- 2026-11-05: runner build `ebda7644b98d`: the draw's last step can be resumed and "e-mail owed" is recorded in the same all-or-nothing step as publishing (live before 1.5.1).
- Release tags (date, commit): luck-private-2026-11-01 (2026-11-01, 9d4d17c); luck-funnel-2026-11-01 (2026-11-01, c86e050); luck-2026-11-01b (2026-11-01, 732e640); luck-2026-11-01 (2026-11-01, f4d3a34).
- 2026-10-31 and 2026-11-01: the first live releases (funnel statistics, cache rule, private-site headers). Details: `git log` and `docs/DEPLOYS.md`.
