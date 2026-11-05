# Free demo game and the Rs 1 payment test (1 Nov 2026)

## Demo game (flag `DEMO_GAME`, OFF by default)
- Only the exact value `on` switches it on. Off (unset or any other value): games behave exactly as before (the existing Rs 0 game for up to 10 people still works, with no label and no daily limit) and the home page shows no demo link.
- On: a game an organizer makes for up to 10 people (`DEMO_CAP`) is a demo. `info` (player page and console) carries `demo: true`; the player header and the console bar show a "Demo" label. The home page shows "Try a free demo" (it asks `GET /api/demo/status`).
- Same rules and engine as a real game. Published through the free path: no paid pack, no entitlement, no payment row, no ledger row. Data is deleted the normal way (23 hours after the game, lifecycle pass).
- Limit: 3 demo games per organizer account and 3 per network address per day (429, code `demo-limit`, plain message). The address is kept only as a hash of the day and the address; the daily counters are swept after two days. The owner key is not limited.
- Code: `apps/edge/src/demo.ts`; tests `apps/edge/test/demo-game.test.ts`, `apps/web/test/demo-pages.test.ts`.
- Not done: the report page does not show the label; the master console does not yet count demos.

## Rs 1 payment test (`/paytest`)
- Owner only: `POST /api/payments/paytest` and `GET /api/payments/paytest/:id` answer 404 without the platform key (header `x-organizer`), and 404 through an AI work link. The page asks for the key (a password box, kept in memory, never in the address).
- Same central path as a game payment: ledger C row (`payment_test`), central ledger B (`product_type payment_test`, `txn_id` SITECODE-...), Razorpay A. Covered by `ledgerc.test.ts` and `pay.test.ts`. The owner pays with his own card; nothing here enters card details.
