# Luck by Chance: engine port, next release (not in the 22:00 ship)

Shipped now: survivors 0 (live behaviour), new flow opt-in (?flow=new), all flags off. Items for the next release:
1. Survivors cut and re-throw: a re-throw is an extra dice round, so the schedule shared by phones and server must grow; needs a design (who computes the tie, how phones learn the extra round, how pause freezes it).
2. Late-join window: enforce lateJoinSecs on join after round 1 (the setting is stored in the start options but not yet read by join).
3. Host pause key: the Organizer registers a Host key for pause/resume; never share the organizer key; log each pause/resume by role.
4. "You won" auto-claim: check every prize screen says "You won" and has no Claim button.
5. Six-step prizes through planPrizes (Auto/Manual) in the new flow.
6. Persist newFlow on the game (today it is checked at create and in the start options only), so the cap 2000 and the new fields follow the game.
