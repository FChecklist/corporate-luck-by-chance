# Changelog: Corporate Luck by Chance

Newest first. Per version: Added / Changed / Fixed, each line = what, where, PR, audit result, rollback id.

## 1.5.0 - 2026-11-20 (not deployed; nothing live changes until the owner says go)
Added
- Console Pay step, game side (dark): `payInfo` / `markPaid` for the organizer's own game (repeatable, definite refusal on wrong owner or size, unlock is the last write). Where: `apps/edge/src/console-pay.ts`. PR: TBD. Audits: pending (0 of 2). Rollback id: n/a (not deployed).
- Vendored console bridge, test kit and game pack, byte for byte, with manifests. Where: `apps/edge/src/console-bridge/`, `apps/edge/test/console-contract/`, `apps/web/public/pack/`. The bridge is not wired to a route yet (no adapter).
- Switch `PAY_VIA_CONSOLE` (off = the old Pay now link works exactly as before; "1" = old pay pages and routes answer 302 to the console). Where: `apps/edge/src/worker.ts` (handleCore), `pages/functions/_middleware.ts`.
- Descriptor `payGame`, `consoleOrigin`. Where: `apps/web/public/zc-pay-game.js`, `config/console-pay.json`.
Changed
- Page rules of the organizer page `/zc`: `frame-src` allows the payment window's address, `connect-src` allows the console, no wildcard. Where: `pages/build.mjs`, test `apps/edge/test/csp-google.test.ts` updated to match.
