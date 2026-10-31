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

## Boss decisions (31 Oct), apply only to games made through the new flow behind the flag; flag-off live path unchanged
Cap 2000; 1-20 rounds, 6/10/15 s window (default 10 / 10); survivors + re-throw (0 = live); pause/resume by Organizer and Host only (Host key registered by the organizer, never the organizer key); no late join after round 1 unless a window is set; manual start; key bridge file.

## Steps
- Step 2 (done): zc-flow-bridge.js (maps ctz-org/ctz-email to cbz-org/cbz-email; pack untouched). zc-mode.js: new screens are OPT-IN only (?flow=new), default stays the previous console; games that are live (15 min before start to 4 h after) or opened by key/demo/pass/cap links always open the previous console. zsw cache luck-game-v9.
- Next: new-game fields (rounds, window, survivors, late window, start mode, cap 2000) validated server-side only when the new flag is on; luckRules in the dice runner; pause/resume with Host key; six-step prizes via planPrizes.
