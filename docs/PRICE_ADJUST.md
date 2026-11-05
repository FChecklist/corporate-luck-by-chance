# Private price for one game ID (reference build: Corporate Luck by Chance)

**This feature is a secret between the owner and the boss.** Organizers and players must never learn it exists. It is used for the owner's own testing (including the Rs 1 live payment test) and for someone who asks for a special price by phone.

The owner can change the price of ONE unpaid game by its game ID. The list (pack) price never changes. The organizer's checkout simply shows the amount payable for that game, one total.

## How the secrecy is kept (and tested: `apps/edge/test/price-adjust-secret.test.ts`)

1. **No public wording.** No word "coupon", "discount code", "promo code" in any page, script, FAQ, guide, text file, manifest, API answer or error a visitor or organizer can see. The code and routes use the neutral word "price"/"adjust".
2. **No box, no line at checkout.** There is no field to enter anything. The pay page, pay link and proforma show one total (the net); no list price, no struck-through price, no extra field. The server sends the pay page one neutral field, `payable: {currency, amount}`; the pay link just returns the net as its price.
3. **Invoice/receipt/e-mails**: one line, `... up to N participants (one game), price as agreed`, with the amount actually charged. No list price, no adjustment, no reason.
4. **The owner's form is not in any public script.** `owner-desk.js` (public file) only has a generic "More" button that draws a *panel sent as data* by `GET /api/owner/panel`. All the form's strings ("Price of one game", "Reduce", "Save price", "Make it Rs 1 (payment test)") and the route `/api/owner/price` exist only in the server code and are sent only after the owner key is accepted. Without the key, with a wrong or organizer key, or through an AI work link (`x-cb-link: 1`), `/api/owner/panel` and `/api/owner/price` do not exist: the answer is byte-for-byte the plain 404 of any unknown address (denied tries are written to the access log).
5. **Tests**: every public file (`apps/web/public`, built `pages/public`) is scanned for the secret words and routes; `owner-desk.js` is checked for the form strings; public API answers (`/api/payments/status`, AI manifest, mode, notices) are scanned; organizer-facing responses, invoice and mails are asserted free of them; the 404 for strangers equals the unknown-address 404.
6. **Internal records stay complete** (owner only): `price_adjust` (the current price change with the owner's note), `price_adjust_audit` (who, when, old, new, net, list, note), the payment's `meta.priceAdjust` (list, adjustment, net), the Razorpay order notes (list_minor, adjust_minor, net_minor, adjust_code), and the owner's "paid order" mail ("owner set price: list Rs X, adjustment minus Rs Y").

## Rules (all enforced on the server)

* Owner key only. Only while the game is unpaid (`engagement.pack = 0`), not cancelled, not closed, and no payment being confirmed. Once paid it is locked (409): no set, change or remove.
* Net payable = list price + signed adjustment. **Never below 1 (Rs 1 / US$ 1) and never above 2 x the list price** (`MIN_NET_MINOR`, `MAX_NET_FACTOR` in `price-adjust.ts`; the cap only stops a typing slip).
* Adjustment cannot be zero; a short note (3 to 200 characters) is required. The note is for the owner only: not on the invoice, not sent to Razorpay or central.
* One adjustment per game, in one currency (INR or USD); applied only to a checkout in that currency. A bare pack purchase (no game ID) is never touched.

## Owner dashboard

`owner-visits.html` (the existing owner page, same platform key), button **More**. It asks for a Game ID, then shows name, players (pack), list price (INR / US$), status (draft / published, not paid / paid / cancelled / closed), the current price change and what the organizer pays. While unpaid: currency, Reduce or Add, amount, note, **Save price**, **Remove**, and **Make it Rs 1 / US$ 1 (payment test)** which fills the form. Paid games show "Its price is locked." The last 10 audit rows are listed.

API (owner only): `GET /api/owner/panel[?q=ID]`, `GET /api/owner/price?eid=ID`, `POST /api/owner/price {eid, currency, direction: "down"|"up", amount, reason}` (or a signed `amount` without `direction`), `POST /api/owner/price {eid, remove: true}`.

## Central ledger mapping (A = Razorpay, B = central `itservices-payments`, C = game)

Order notes, only for a game with a price change (put FIRST so the central service, which keeps only the first few extra notes, never drops them):

```
list_minor   = list price in paise/cents          e.g. 239900
adjust_minor = signed adjustment                  e.g. -239800
net_minor    = amount of the Razorpay order       e.g. 100   (= payment.amount x 100)
adjust_code  = owner_adjust                       (fixed code; the owner's free text is never sent)
```

plus the usual `plan = luck_pack_<N>` (pack N = participants), so payment -> product -> plan -> adjustment maps from A, and the same numbers are in the game's payment row meta for C. `site_payment_ref` stays the payment id (`pay_...`).

**Central needs no change to keep working** (`functions/api/pay/order.js` already passes `extra_notes` to Razorpay; it enforces only `amount_minor >= 100`). Optional, NOT applied by this work, if the owner wants the figures as columns in B (`pay_order`):

```sql
ALTER TABLE pay_order ADD COLUMN list_minor INTEGER;
ALTER TABLE pay_order ADD COLUMN adjust_minor INTEGER;
ALTER TABLE pay_order ADD COLUMN adjust_code TEXT;
```

and in `order.js` add the three to the INSERT from `extra.list_minor`, `extra.adjust_minor`, `extra.adjust_code` (null when absent).

## Deploy order (this game)

1. Apply `apps/edge/migrations/0030_price_adjust.sql` to the D1 database (the code also copes with a missing table: no price change, nothing breaks).
2. Deploy the Worker and pages.

## Porting to the other games

Copy `apps/edge/src/price-adjust.ts` (imports only `PACKS`, `price` and the `D1` type; adjust the import paths, and if the game names its engagement table or its `pub/` flag differently, the two queries in `lookupGame`). Then, per game:

1. **Schema**: `...ADJUST_SCHEMA` in the game's SCHEMA list, a migration `0030_price_adjust.sql` with the same three statements, and the game's migrations test.
2. **Owner routes**: in the Worker, before the other `/api/owner/*` routes: `const r = await adjustRoute(req, env.DB, now, <owner key and not an AI link>, deny); if (r) return r;`
3. **pay.ts**: in checkout once the pack, currency and bound game id are known: `const cpn = await adjustFor(db, boundEid, pack, cur)`; charge `cpn.netMinor / 100`; put `...adjustNotes(cpn)` FIRST in the order notes; spread `...adjustMeta(cpn)` into the payment meta. In fulfil: one invoice line `..., ${PRICE_LINE}` when `meta.priceAdjust` matches the amount, and the owner "paid order" text. In the pay-link GET and the proforma: replace the price by the net (no other field).
4. **Pay page data**: add `payable: payablePublic(await adjustAnyCur(db, eid, pack))` where the game info / credit fields are returned.
5. **Front end**: `pay.js` (the `due` lines), `owner-desk.js` (the "More" panel renderer) and the "More" button + `#deskPanelOut` in `owner-visits.html`. If a game's pay link page shows the total from the server's price (as here), it needs no change.
6. **Tests**: copy `price-adjust.test.ts`, `price-adjust-secret.test.ts` (rename the stand-in game and prices, keep the word list) and the "More" test in `owner-desk.test.ts`.

Per game: Tambola/Housie, Bingo, Snakes and Ladders, Tic Tac Toe, Lucky Draw each need steps 1 to 6. The console (`console.corporatetambola.com`) holds no payments; it needs, at most, a way to open the owner page of a chosen game site. Games that sell by something other than "pack = participants" must make `lookupGame`/`packOf` return their own plan and use `listMinor(...)` from their own price table.

## Risks

* Money: the order amount is the net stored in the payment row; verify and webhook both compare Razorpay's amount to that row. A price changed or removed **after** an organizer opened a Razorpay window does not change that open order. Set/remove is refused while a payment is being confirmed.
* Credit and a private price together: credit comes off the net; the invoice then uses the credit-note wording rather than the "price as agreed" line (the figures are in the order notes and meta).
* GST is off today. If it is switched on, the invoice line is the tax-inclusive net and must be reviewed.
* A price set in USD does not apply to a rupee checkout and vice versa.
* The organizer can still see that their price differs from the public pack price if they compare; the feature does not announce itself, but it cannot hide the amount.
* Order notes in the Razorpay dashboard/central ledger name list, adjustment and net (owner-only places).
