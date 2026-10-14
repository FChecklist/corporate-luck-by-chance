# Gates for Corporate Luck by Chance

Format: ID | true/false | proof | note. A gate is true only with a passing test or a direct file check. OWNER means only the owner can do it. Written 2026-10-13. Everything here was checked locally; nothing is deployed.

Game tests: `packages/luck/test/engine.test.ts` (R01-R33). Server tests: `apps/edge/test/luck.test.ts` (R34-R47). Page tests: `apps/web/test/luck-page.test.ts` (R51-R57). Simulation: `tools/sim2/luck-sim.ts`. Rules: `docs/RULES.md`.

ID | status | proof | note
---|---|---|---
G1 | true | apps/edge/test/luck.test.ts R34 (start with settings), apps/web/public/host.js | Organizer creates the game (POST /api/z); the Host chooses rounds, press window and prizes and starts. host.js is not driven in a real browser.
G2 | true | apps/edge/test/luck.test.ts R37 (the view returns the settings that were chosen) | Settings are read back from the server.
G3 | true | apps/edge/test/people.test.ts (common link and personal links) | Join link is z.html?e=ID.
G4 | true | apps/web/test/luck-page.test.ts (390 px window, no account) | Simulated phone browser, not a real phone.
G5 | true | apps/edge/test/luck.test.ts R34 (view.joined); apps/web/test/luck-page.test.ts (waiting screen) | 
G6 | true | apps/edge/test/luck.test.ts R34: refused with fewer than 2 players, only Organizer or Host, not the AI helper, wrong settings refused | 
G7 | true | packages/luck/test/engine.test.ts R01-R33; apps/edge/test/luck.test.ts R34-R47 (rules in docs/RULES.md, one test each) | R24: the golden shoot-out is NOT built (fate decides at once). Presence mode is out of scope.
G8 | true | engine.test.ts R08-R10 (beacon values are due at the opening of the dice round and at the close of the window); luck.test.ts R37, R39 | The browser sends nothing about a dice or a score. Honest limit: the server draws the sealed secret and publishes the numbers at their due time (RULES.md, known limits).
G9 | true | luck.test.ts R39, R40 | There is no claim step in this game. The equivalent: a forged or lone result vote counts for nothing, and a result with an odd shape is refused.
G10 | false |  | Pause and resume are not built. The game runs on a fixed schedule from the start time.
G11 | true | apps/web/test/luck-page.test.ts R52, R57 (a page opened late catches up from the public numbers); luck.test.ts R36 (the player opens the link again and keeps their place) | 
G12 | true | luck-page.test.ts R57 (final ceremony: 1st to 5th, tie reasons, top 10); luck.test.ts R41 | Simulated phone browser.
G13 | false |  | A new game from the same settings is the existing 'clone' feature (clone.test.ts); the Luck by Chance settings (rounds, press window, prizes) are chosen at the start, so a clone asks for them again. Not exercised for a finished game.
G14 | false |  | A lucky draw (SPEC section 10) is not built in this build.
G15 | false |  | The organizer's name and colour show on the player screen; scheduled brand breaks between rounds are NOT built.
G16 | true | luck.test.ts R41 (12 players, two independent phones, quorum, winners record); tools/sim2/luck-sim.ts | 
G17 | true | tools/sim2/luck-sim.ts (1,000 phones, 10 rounds, through the real routes) | Only 1,000 phones were run. 5,000 and 10,000 (the larger plans) were not run. Lines below.
G18 | true | luck.test.ts R44; consent.test.ts (K4 rows) | Deletion verified by running the scheduled tick 25 hours later. The scheduled job itself is not deployed (D5).
P1 | true | apps/web/public/index.html, site/index.html | Short plain sentences; not read by the owner yet.
P2 | true | apps/edge/test/pay.test.ts (price table), apps/web/public/pricing.html | Price table is copied from Corporate Tic Tac Toe (same as Bingo): OWNER to confirm.
P3 | true | apps/edge/test/free-launch.test.ts | 
P4 | false |  | Phone, tablet and laptop widths not checked in a real browser (only a 390 px simulated window).
P5 | true | apps/web/test/pwa.test.ts | Service worker and manifest present; the offline screen was not tried on a device.
P6 | true | sim S10-01 and S10-02 (axe-core colour-contrast and basic WCAG 2 A/AA rules on home, pricing, host sign-in, player page, big screen) | Found and fixed: heading colour --accd (3.73:1) darkened to #8A5A00; two links whose spoken name did not contain the visible text. run on 2026-10-14
P7 | true | apps/web/test/seo.test.ts | 
P8 | true | apps/edge/test/visits.test.ts; apps/web/test/visits-dom.test.ts | First-party only.
P9 | false |  | OWNER confirms the contact details.
P10 | false | apps/web/test/gamesbar.test.ts (links listed) | Links not resolved (local only).
P11 | true | apps/web/public/404.html, site/404.html | 
P12 | true | apps/web/test/version-stamp.test.ts; pages/version.mjs; docs/DEPLOYS.md | pages/build.mjs writes pages/public/version.json {commit, dirty, builtAt, game} (served uncached at /version.json); docs/DEPLOYS.md lists the last deploys read from Cloudflare Pages (node tools/list-deploys.mjs refreshes it). README no longer says nothing is deployed.
O1 | true | apps/edge/test/account.test.ts, ai-signin.test.ts | E-mail code, no password.
O2 | true | apps/edge/test/pay.test.ts | 
O3 | true | apps/edge/test/pay.test.ts (order, verify, fulfil) | Mock Razorpay stand-in.
O4 | false | apps/edge/test/pay.test.ts (invoice and mail queued) | Mail is queued in a local outbox; inbox delivery not tested.
O5 | false | apps/edge/test/branding.test.ts | Name, colour and logo on the player screen yes; logo upload not re-tested for this product.
O6 | true | apps/edge/test/roles.test.ts, consent.test.ts (K5) | 
O7 | false | apps/edge/test/people.test.ts (see and remove) | Remove works; 'end a game' is not built.
O8 | true | apps/edge/test/no-other-game-words.test.ts | The organizer report now shows the game: when it started and ended, the rounds, the press window, the players, who scored most and the final places. Still plain: no table of every dice round.
O9 | true | apps/edge/test/cancel.test.ts, reopen.test.ts, reschedule-window.test.ts, credit.test.ts | No refund; credit and 365-day move window.
O10 | true | apps/edge/test/privacy.test.ts (erase), luck.test.ts R44 | 
O11 | false | apps/web/public/contact.html | Contact page works (mail link); no auto-reply.
U1 | true | apps/web/test/luck-page.test.ts | Boxes come before the nickname field.
U2 | true | apps/edge/test/consent.test.ts (K4) | Version, wording hash and time are stored.
U3 | true | apps/edge/test/nameonly.test.ts; apps/web/test/luck-page.test.ts | Nickname only.
U4 | true | luck.test.ts R46 | There is no private card in this game; a player sees their own seat and nickname from their own phone only. The rest is public numbers.
U5 | true | apps/edge/test/rights.test.ts ("U5: a player can leave at any time": before the start, after the start, only the player's own phone, a cancelled game); apps/web/test/rights-pages.test.ts ("Leave: asks first, then removes the seat and the name"); sim S04-15 (real Chrome) | Leave button and POST /api/z/{id}/leave, proved by the card id AND the phone's own device id. Before the start the seat and details are deleted; once the game has begun the seat stays as an anonymous id (every phone must work out identical results) and loses everything personal. The page says so in plain words. run on 2026-10-14
U6 | true | apps/edge/test/rights.test.ts ("U6 / D7: what do you hold about me, correct it, delete me": access shows what is held, correction, erasure, same request twice, TEST mode); apps/web/test/rights-pages.test.ts ("What do you hold about me"); sim S04-16 | Link on the player page 'What do you hold about me / delete me'. The page shows the promised answer time before sending; the answer comes back on the page (what is held) and the organizer and the owner (raajat.agarwal@gmail.com) are told by e-mail. PROMISE_DAYS = 7 is one constant (apps/edge/src/rights.ts). The 'answer' to an access request is immediate; the 7 days cover anything further. run on 2026-10-14
U7 | true | apps/web/public/terms.html (Grievance Officer clause) | 
U8 | true | apps/edge/test/consent.test.ts (K4 box B); terms clause 12 | 
A1 | true | apps/edge/test/pay.test.ts, legal.test.ts (ledger) | Plan ids luck_pack_N, product corporate_luck_by_chance.
A2 | false | apps/edge/test/pay.test.ts (webhook) | Webhook handling tested with a stand-in; not the live log.
A3 | false |  | Not built for this product.
A4 | n/a |  | There are no refunds.
A5 | false |  | Only the TEST/LIVE switch exists.
A6 | false |  | Not verified.
A7 | false |  | Not built.
A8 | false |  | Not done.
A9 | false |  | Not written.
E1 | false | apps/edge/test/account.test.ts | Queued in the local outbox; not received in a real inbox.
E2 | false | apps/edge/test/pay.test.ts | Same.
E3 | false | apps/edge/test/people.test.ts | Same.
E4 | false |  | No reminder mail for the game.
E5 | false |  | No separate results mail; the report mail at the end of the game carries the game report.
E6 | n/a |  | No refunds; a credit mail exists (credit.test.ts).
E7 | false | apps/edge/test/unplayed.test.ts | Same outbox limit.
E8 | false |  | No auto-reply.
E9 | true | apps/edge/test/owner-mail.test.ts ("E9: the owner is told of each paid order": once per payment whichever of the webhook and the verify call comes first, three at the same instant, TEST mode) | Mail to raajat.agarwal@gmail.com: game, plan, amount, transaction id, organizer name and e-mail. The once-only claim is one kv row per payment. Not tested against a real inbox.
E10 | false |  | No DNS lookup (local only).
E11 | n/a |  | No marketing mail.
E12 | false |  | Not built.
E13 | false |  | Links not resolved.
D1 | true | docs/PRIVACY_AND_LIFECYCLE.md (sections 2 and 3); apps/edge/test/data-map.test.ts ("D1: the data map": every row has field, why, where stored, who) | Field, why, where stored, who processes, how long. Section 3a says where the data is and that no backup of our own exists.
D2 | true | apps/edge/test/data-map.test.ts ("D2: the notice and the data map agree": notice fields = data map fields = fields the player page asks for) | Join box A: the nickname only; the notice, the data map and the player page (luck.js: no phone field) all agree.
D3 | true | apps/edge/test/consent.test.ts | 
D4 | true | apps/edge/test/nameonly.test.ts | 
D5 | false | apps/edge/test/luck.test.ts R44 | Deletion code works; the scheduled job is NOT deployed.
D6 | true | apps/edge/test/legal.test.ts | 
D7 | true | apps/edge/test/rights.test.ts ("a request cannot be made for another player", "the request rows do not outlive the game", "asking the same thing twice ..."); sim S04-16; migration 0023 (data_request) | Access / correction / erasure request, end to end: stored (kind, note, received, answer-by), mailed to organizer and owner, closed at once for erasure. Request rows are deleted with the game's other participant data (23 h) and again with the game (365 days). Closing an open access / correction request is done by the organizer by hand; there is no console button for it (the row ages out with the game).
D8 | true | apps/web/public/terms.html | 
D9 | true | docs/BREACH_RUNBOOK.md | 
D10 | true | apps/web/public/subprocessors.html | 
D11 | true | apps/edge/test/data-map.test.ts ("D11: where the data is, and no backup claim"); apps/web/public/subprocessors.html, legal.html; docs/PRIVACY_AND_LIFECYCLE.md section 3a | Read with wrangler d1 info on 2026-10-14: the D1 database runs in Cloudflare's Asia-Pacific region (APAC), no jurisdiction pinned, no read replicas. The pages say: website on Cloudflare's global network, database in its Asia-Pacific region. The '7 days backup roll-off' claim is gone everywhere (no backup process exists).
D12 | true | apps/edge/test/audit.test.ts | 
D13 | true | luck.test.ts R45 | 
R1 | true | apps/web/public/terms.html; docs/RULES.md R27, R47; luck.test.ts R34, R43; consent.test.ts (no payment code on player routes) | Prize text with money words is refused. Home page and Terms checked; other pages not audited one by one.
R2 | false |  | OWNER. The position on a game of pure luck with gifts (no entry fee, no stake, organizer-supplied non-cash gifts) is not confirmed. Protection built: R27, R43, K1, K4, K6.
R3 | true | apps/web/public/terms.html clause 1; apps/web/test/legal-sync.test.ts | 
R4 | true | apps/edge/test/terms.test.ts (footer links) | Link from the Razorpay window not tested.
R5 | false |  | Pricing page wording vs Terms clause 4.2 not compared.
R6 | false | apps/edge/test/legal.test.ts | Invoice fields not re-checked for this product.
R7 | false |  | Not audited.
R8 | n/a |  | No coaching offer here.
R9 | true | apps/web/test/storage-notice.test.ts (every key a script keeps on a device is in apps/web/storage-registry.json; listed keys are still used; the cookies are exactly the ones listed; the Privacy page carries every sentence; a planted new key / cookie / computed key is noticed) | The only cookie is the first-party visitor cookie on the public pages. Page: legal.html section 'What your device keeps' (written by node tools/make-storage-notice.mjs from the registry).
R10 | true | sim S10-01..S10-04 (tools/sim2/scenarios/ui/s10-accessibility.mjs); legal.html section 'Accessibility' | Accessibility statement (short, plain) with a way to report a problem. axe-core 4.14 (dev dependency of the simulation only) finds no WCAG 2 A/AA violation on the five main pages at phone and laptop width. run on 2026-10-14
R11 | true | apps/edge/test/reschedule-window.test.ts, cancel.test.ts, credit.test.ts; apps/web/public/refund-policy.html | Pay per game, no refund, move within 365 days of payment, credit on cancel (day 364 ok, day 366 refused).
R12 | false |  | OWNER.
Y1 | false |  | OWNER / central service.
Y2 | true | apps/edge/test/pay.test.ts | Price is computed on the server.
Y3 | false |  | Needs the live host.
Y4 | false |  | OWNER.
Y5 | true | apps/edge/test/pay.test.ts | Signature check, ledger row.
Y6 | false |  | OWNER.
Y7 | true | apps/edge/test/pay.test.ts | 
Y8 | true | apps/edge/test/pay.test.ts | 
Y9 | n/a |  | No refunds.
Y10 | false |  | OWNER.
K1 | true | apps/edge/test/consent.test.ts | Publish: boxes A and B. Server refuses without them.
K1s/K1v/K1r/K1n | true | apps/edge/test/consent.test.ts | Button disabled until ticked; server refuses without ticks; the row is re-read from consent_log; a version bump asks again.
K2 | true | apps/edge/test/consent.test.ts | Sign-up and sign-in.
K3 | true | apps/edge/test/consent.test.ts | Before paying (screen and pay link).
K4 | true | apps/edge/test/consent.test.ts; apps/web/test/luck-page.test.ts | Join: boxes A and B before the nickname.
K5 | true | apps/edge/test/consent.test.ts | Host setup and Co-host.
K6 | true | apps/edge/test/consent.test.ts | Invite list and people entry (the eligible names list).
K9 | n/a |  | This product has no contact, grievance or data-request form (mail links only).
K11 | true | apps/web/test/legal-sync.test.ts | Every box links to the product's own page; the Terms page shows Version 2026-10-13 = TERMS_VERSION (apps/edge/src/brand.ts) = the box wording version.
K12 | true | apps/edge/test/consent.test.ts (box wording string compare) | 
K13 | true | sim S10-03 (Tab reaches every control of the five main pages, in page order, with a visible focus ring); apps/edge/test/consent.test.ts (every box has a label) | Keyboard proved in real Chrome. A screen reader itself was not run; axe checks names, labels and roles.
LR-1 | true | apps/edge/test/consent.test.ts (nothing is ever taken from a player); luck.test.ts R43 | No payment code on player routes, no fee setting, payment table stays empty.
LR-2 | true | luck.test.ts R43 (a fee, entryFee, price or stake sent to the game is ignored and never stored); consent.test.ts (fee fields refused in settings) | No entry-fee field or endpoint exists.
LR-3 | false |  | Prize hand-over receipt is not built.
LR-4 | true | luck.test.ts R44 | The agreed result holds seat numbers only; names are deleted at 24 h.
LR-5 | false | apps/edge/test/visits.test.ts | Not re-checked for this product.
LR-6 | true | apps/edge/test/consent.test.ts (K4 notice and 24-hour erasure) | Invite chain is in the box A wording and is erased with the person.
LR-10 | n/a |  | The ticket wording applies to Tambola only.
LR-11 | false |  | OWNER gives the name.
LR-15 | true | apps/web/test/legal-sync.test.ts (app page text = site page text, same version) | Terms, Legal Position, Refund and Privacy.
CN-1 | true | apps/web/test/no-internal-notes.test.ts; apps/web/test/legal-sync.test.ts | No internal notes in anything deployed, in site/, or in docs/ (case-insensitive pattern from the contract; the word draft is allowed outside the legal pages because an unpublished game is called a draft).
L1 | true | packages/luck/test/engine.test.ts | Engine: target, dice, scoring, rankings with the full no-ties chain, prizes.
L2 | true | luck.test.ts R34, R38; consent.test.ts K6 | Names are loaded with the K6 box; gifts are non-cash (R27).
L3 | true | apps/edge/test/migrations.test.ts, whole edge suite | Platform shell copied from Corporate Tic Tac Toe and renamed.
L5 | true | engine.test.ts R11 (10,000 targets and 10,000 dice, evenly spread), R13 (same inputs, same game) | Over 10,000 draws, not 10,000 whole games.
X5 | true | tools/sim2/luck-sim.ts | 1,000 phones, 10 rounds. Lines below.

## Simulation (tools/sim2/luck-sim.ts, run 2026-10-13 on this laptop)

```
join: 1000 phones joined through the routes in 7158 ms
start: 1000 players, 100 dice rounds, the game lasts 24.7 minutes of game time (simulated; the clock is moved, nothing waits)
beacon: 200 values in 4 requests per phone (26 ms)
engine: one phone plays 100 dice rounds for 1000 players (100000 dice) in 9383 ms; a second phone with a different slicing took 7907 ms
agreement: two independent phones produced the identical result (overall and every round)
votes: result agreed after the quorum of phones voted (135 ms); agreed=true
result: 1st Nick 333 (110 points), 2nd Nick 177, 3rd Nick 18, 4th Nick 903, 5th Nick 105; top 10 is ten different players, in order
ties: 5 of the overall top-10 places and 79 of 100 round places needed a tie-break; all were settled by the chain (every one has a one-line reason), none left open
PASS: 1000 phones, 10 rounds, clear 1st to 5th, strict top 10 in every round and overall
```

The engine is deterministic, so one engine run stands for what each phone computes; a second run with a different slicing proved two phones agree; all 1,000 phones then sent their vote through the routes (the vote of the first 3 phones was enough: quorum). The engine time is for one phone on this laptop; a low-end phone was not measured.

## Not built, stated plainly
- Presence mode (out of scope); the golden shoot-out (fate decides at once); pause and resume; lucky draw; scheduled brand breaks; organizer report layout for this game; player request button; a public beacon from outside (the phone reads the game's own feed, see RULES.md known limits).
- Prize lists per round are supported by the engine and the server; the host page offers one list used for every round.
X-7 | true | apps/edge/test/data-map.test.ts ("D2"); apps/edge/src/consent-text.json; apps/web/test/consent-pages.test.ts | Box A said name and mobile number although the game asks for a nickname only. Now: the name only. Terms version 2026-10-14. The privacy page no longer says a number is asked if the organizer wants it (the page cannot).
