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
