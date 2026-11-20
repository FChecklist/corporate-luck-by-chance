# The console's Pay step: what this game does (dark, nothing deployed)

Contract: the console repo's `docs/GAME_PAY_CONTRACT.md`. The console shows the Pay step and talks to Moneypenny; this game never talks to Moneypenny, IT Services or Razorpay for it and shows no payment page of its own for it.

## What is here
- **Vendored copies, byte for byte** (never edit here; re-copy with the console's `tools/vendor-bridge.mjs` / `tools/vendor-pack.mjs --game <this folder>`; each folder has a `MANIFEST.json` and a test checks it):
  `apps/edge/src/console-bridge/`, `apps/edge/test/console-contract/`, `apps/web/public/pack/`.
- **`apps/edge/src/console-pay.ts`**: `payInfo` (read only: organizer? size? already paid?) and `markPaid` (repeatable; the only thing that unlocks the start through the console; refuses with `{ definite: true }` and changes nothing on a wrong owner, wrong size or a cancelled / closed game; does nothing when already paid; the order is kept in `kv` as `payref/<eid>`; the unlock is the last write of the call, so a half-done call is safe to run again). The size is the pack the game belongs to (`packFor`), so no price is in the new code.
- **Switch `PAY_VIA_CONSOLE`** (off unless exactly `"1"`): while off, the old Pay now link, pay page, pay link, credit routes work exactly as before. When on, those routes (Worker: `handleCore`; pages: `pages/functions/_middleware.ts`) answer 302 to the console. Razorpay's own notice (`/api/payments/webhook`), the buyer's return check and read-only views are never redirected, so money already paid is still recorded.
- **Descriptor** `apps/web/public/zc-pay-game.js` (`payGame: "luckbychance"`, `consoleOrigin`), values from `config/console-pay.json`.
- **Page rules (CSP)**: the organizer page `/zc` gets `frame-src` for the payment window's address and `connect-src` for the console, both from `config/console-pay.json` (copy of the console's `payframeOrigins`); no wildcard, no other page changed.

## What is NOT here (for the owner / the next slice)
- The bridge is vendored but **not wired to a route**: this game has no `console-adapter.ts` yet (the other games have one), so `/api/console/payable` and `/api/console/paid` do not exist here and nothing calls `payInfo` / `markPaid` until the adapter is written and `CONSOLE_PUBKEYS` is set. `payInfo` and `markPaid` are written to drop into that adapter as they are.
- The organizer page does not load `pack/zc-flow.js` or `zc-pay-game.js` yet (the new flow is a separate slice); the build does not copy them. Nothing in the live pages changed except the `/zc` header.
- A game paid through the console has no `payment` / `entitlement` / invoice row here (the money lives in Moneypenny), so cancelling such a game gives no automatic credit from this game's own tables. Needs the owner's rule before the switch goes on.
- Nothing is deployed and no switch is set.
