# Changelog: Corporate Luck by Chance

Newest first. Per version: Added / Changed / Fixed, each line = what, where, PR, audit result, rollback id.

## 1.5.1 - 2026-11-20 (not deployed; PR 12 audit fix)
Fixed
- `markPaid` size race (audit High): the owner could pay for a small size and play a bigger one by raising the limit between the size check and the unlock. All four writes of `markPaid` are now guarded by `cap=?` (the limit the size was worked out from) on top of unpaid and open; if the limit moved, it refuses for certain (`definite`) and writes nothing, not even the order record. Where: `apps/edge/src/console-pay.ts`; test: `apps/edge/test/console-pay.test.ts` (race test, falsified by dropping the guard), `console-pay-static.test.ts`. PR: https://github.com/FChecklist/corporate-luck-by-chance/pull/12. Audits: 1 FAIL (this fix), fresh audits pending. Rollback id: n/a (not deployed).

## 1.5.0 - 2026-11-20 (not deployed; nothing live changes until the owner says go)
Added
- Console Pay step, game side (dark): `payInfo` / `markPaid` for the organizer's own game (repeatable, definite refusal on wrong owner or size, unlock is the last write). Where: `apps/edge/src/console-pay.ts`. PR: https://github.com/FChecklist/corporate-luck-by-chance/pull/12. Audits: pending (0 of 2). Rollback id: n/a (not deployed).
- Vendored console bridge, test kit and game pack, byte for byte, with manifests. Where: `apps/edge/src/console-bridge/`, `apps/edge/test/console-contract/`, `apps/web/public/pack/`. The bridge is not wired to a route yet (no adapter).
- Switch `PAY_VIA_CONSOLE` (off = the old Pay now link works exactly as before; "1" = old pay pages and routes answer 302 to the console). Where: `apps/edge/src/worker.ts` (handleCore), `pages/functions/_middleware.ts`.
- Descriptor `payGame`, `consoleOrigin`. Where: `apps/web/public/zc-pay-game.js`, `config/console-pay.json`.
Changed
- Page rules of the organizer page `/zc`: `frame-src` allows the payment window's address, `connect-src` allows the console, no wildcard. Where: `pages/build.mjs`, test `apps/edge/test/csp-google.test.ts` updated to match.
