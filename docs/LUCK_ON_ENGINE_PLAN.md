# Luck by Chance on the common engine: plan and open conflicts (branch feat/luck-on-engine-2026-10-31)

Step 1 (done): vendored game-core 0.1.0 (bdecf43) into vendor/game-core with `bun tools/vendor.ts --expect 0.1.0`. Not wired: the live game is unchanged. Wiring goes behind one flag (default off), in small commits.

## Rules in the engine that differ from live Luck (need the boss's decision before any wiring)
1. Caps: engine 2000 players, rehearsal 10. Live: up to 100,000 (packs). Lowering would change what organizers can buy.
2. Rounds and press window: module accepts 1-20 rounds and 6/10/15 s. Live new games are fixed at 10 rounds / 10 s (organizer fields hidden). 
3. Survivors (elimination) and tie re-throw: new. Live plays everybody every round, ties by the rank chain. Survivors 0 keeps live behaviour.
4. Pause/resume and Host-only control: not in live Luck (engine track EN2); needs the dice clock to freeze.
5. Late join: engine says none after round 1 unless a window is set; live closes the list at start (to confirm).
6. Start auto|manual: live starts only at the scheduled time.
7. Six-step organizer flow with Auto/Manual prizes: live has a 4-step console (new pack screens hidden: storage-key mismatch cbz-/ctz-).
8. Prizes: engine = places 1-5 by round and overall; live prizes are by position too (to confirm same list).

Nothing changed in live behaviour by this commit.
