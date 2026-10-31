# Luck by Chance: engine port (owner rules 31 Oct), status

Spec: game-core docs/LUCK_RULES_BOOK.md (branch feat/luck-owner-rules-2026-10-31). Survivors / re-throw / late-join are dropped.

Site adapter (behind `newFlow: true`; flag absent = live behaviour unchanged):
- settings: newFlow forces 10 rounds x 1 dice round, 10 s window, 3 s reveal + 7 s break (a 10 s gap with the reveal inside), prizes overall (top five). Only startMode (auto|manual) and prize text are the organizer's.
- engine: new-flow scoring exact 10 / 1 away 5 / 2 away 3 / 3+ away 1; ranking total, exact hits, 5-point hits, reached first, fate. Create refuses cap > 2000 for newFlow.
- Rebuild needed: the phone bundles (luck-engine.js, zgame.js) must be rebuilt from packages/luck before the flag is used.

Still to do:
1. "No press in time = 0": the live engine derives a dice for every seat; a press record per round is needed so a player who did not press scores 0.
2. Reaction pack hooks on the pages (ids in game-core LUCK_REACTIONS: exact boom, near nice, miss oops, round_start, countdown, final ta_da).
3. Host-registered pause key; persist newFlow on the game; six-step prizes via planPrizes; "You won" screen check.

## Status after core 0.9.8 (vendored, f27e267)
Done behind `newFlow`: press record (POST luck/press, GET luck/presses, table luck_press; no press in time = 0; engine takes the pressed set; luck-run.js fetches it before each dice round; the phone posts the press), "You won" line on the results screen for the top five, reaction hooks (window.ctzReact, guarded; ids boom / nice / oops / ta_da).
Not done: the 120 s waiting room; wording sweep (no "erase", no "we/our", calm text): zc.js has about 80 hits, plus the legal and info pages, and tests pin some of that text, so it needs its own pass with the tests; phone bundles (luck-engine.js, zgame.js) must be rebuilt from packages/luck, and window.ctzReact must be supplied by the shared reaction script once it is added to z.html; the new reaction ids must exist in the core reaction list.

## Step 8 (waiting room, wording, DOM test)
- 120 s waiting room: for newFlow games the start route uses a fixed 120 s delay; the people who joined before the press are the players (a join during the 120 s is not yet possible: the list is read at the press). Making the list close at the start needs the roster read moved to the start time.
- Wording: the "erase" family is now "delete" in zc.js and clone.ts messages (tests updated). NOT done: "we / our" in zc.js (about 30 lines), the legal and info pages, and the sentence "A game can be played with only an employee ID or an e-mail".
- apps/web/test/dom-ids.test.ts: every literal id looked up by a page's scripts exists (4 pages). Known guarded gaps listed exactly: zc.js #gbtn, #bmcount.
- Guide entries added for the press and cap messages.
- Known test-side: guide.test.ts reads "Enter your ${W}." unexpanded (the real-string entries from 1.4.1b match the expanded text); the pack files fail no-internal-notes (vendored pack, decided earlier).
