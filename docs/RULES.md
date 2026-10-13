# Corporate Luck by Chance: the rules (plain words)

Written 2026-10-13. Every rule below is one plain sentence and has at least one test. The test name starts with the rule number (for example `R15: ...`).
Game code: `packages/luck/src/` (`random.ts` the draws, `settings.ts` the organizer's choices, `timeline.ts` the clock of the game, `engine.ts` target, dice, scoring, ranking, prizes).
Game tests: `packages/luck/test/engine.test.ts` (R01 to R33). Server tests: `apps/edge/test/luck.test.ts` (R34 to R46). Run them with `bun test packages/luck` and `bun test apps/edge/test/luck.test.ts`.

Fate mode only. In Fate mode the dice is rolled for everybody when the press window closes, so a player who is away still scores. Presence mode (a player who does not press scores nothing) is not part of this product.

## A. The game
- R01 A game has 1 to 20 rounds; the default is 10.
- R02 Every round has 10 dice rounds, so a default game has 100.
- R03 Each dice round shows a target number from 1 to 6.
- R04 Players have a press window to press the dice: 6, 10 (default) or 15 seconds.
- R05 A dice that shows the target scores that many points; any other number scores nothing.
- R06 Points add up inside a round and across rounds; the best possible score is 6 per dice round.
- R07 Whatever the target is, a player's chance of a hit is exactly 1 in 6.

## B. Fair randomness
- R08 The target of a dice round is made from the game id, the number of the dice round and a public beacon value (A) that is published when the dice round opens; it is the same on every device.
- R09 A player's dice is made from the game id, the seat, the number of the dice round and a second public beacon value (B) that is published only when the press window closes, so nobody can know a dice while the window is open.
- R10 The target is fixed before the window opens, and the next target is published only after the previous dice round has ended.
- R11 Targets and dice are spread evenly over 1 to 6.
- R12 Two players in the same dice round roll independently.
- R13 The same inputs always give the same game; different beacon values give a different game.
- R14 Dice rounds are played in order; none can be skipped.

## C. Ranking: no ties
- R15 The ranking puts the player with the most points first.
- R16 If points are equal, the highest single hit wins (a 6 beats a 5).
- R17 If that is equal too, the most hits wins.
- R18 If that is equal too, the player who reached that score first wins.
- R19 If that is equal too, fate decides: a number made from the game id, the seat, the name of the ranking and the last beacon value of that ranking; the lower number wins and anybody can re-compute it.
- R20 So the order is always strict: places 1 to 10 are always ten different players and a prize is never shared.
- R21 Every round has its own ranking by the same chain; the overall ranking uses the running total.
- R22 When a place had to be decided between equal players, the result says so in one line ("Tied on 11 points; decided by who reached the score first.").
- R23 Places 1 to 5 are named and the top 10 are listed.
- R24 The golden shoot-out is NOT built. Fate decides straight away (rule R19). The organizer cannot switch a shoot-out on.
- R25 A player sees how they stand in plain words ("you are in the top 8%"), worked out on their own phone.

## D. Settings and prizes
- R26 The organizer writes a prize text for places 1 to 5 of the overall ranking and of each round. The product holds up to 5 prizes per ranking.
- R27 A prize is a gift the organizer hands over. Words for money, cash, bets and stakes are refused in the prize text.
- R28 Prizes can be for each round, for the overall result, or both (the default).
- R29 A player may win several prizes; if the organizer switches that off, the next player in the order gets the prize.

## E. Time
- R30 A dice round takes the press window plus 3 seconds of reveal; after every full round there is a 20-second standings break. A default game takes 24 minutes 40 seconds (the break after the last round is not needed).
- R31 At any moment the game is before the start, in a press window, in a reveal, in a break, or over.

## F. The same result on every phone
- R32 Two phones that receive the same beacon values show the same standings, however the work is cut into pieces.
- R33 Every hit is recorded exactly: the points, the best hit, the number of hits and the dice round of the last hit.

## G. The server (it does almost nothing)
- R34 Only the Organizer or a Host can start the game, never the AI helper; at least 2 players are needed; wrong settings are refused with a plain sentence.
- R35 The fingerprint of the sealed draw is public from the first look. The secret is shown only after the game is over, because with it anybody could compute every future number. Then anybody can check the seed.
- R36 The list of players closes when the game starts (registration closes before the first dice round). A player who was in can open the link again; a new phone is told the game is running.
- R37 A beacon value is sent only from the moment it is due. The dice value of a dice round does not exist while its press window is open.
- R38 After the start the list of nicknames is public (nicknames and seat numbers only). Before the start it is closed.
- R39 A result counts only when enough different phones send the same one (3, or 5% of the players if that is more, or all players if there are fewer than 3). One phone alone or a forged result counts for nothing.
- R40 A result with an odd shape (a seat that does not exist, a repeated seat, a wrong number of rounds, an impossible score) is refused.
- R41 Whole game: phones play with the real engine, the agreed result has a strict 1st to 5th, and the podium goes to the winners record as seat numbers.
- R42 If the phones never agree, the game is closed after ten minutes without a published result.
- R43 Nothing is ever taken from a player: there is no entry-fee field or payment code on any player route, and the game ignores any fee sent to it.
- R44 24 hours after the end every nickname and every vote is gone; the agreed result keeps only seat numbers until the retention date.
- R45 A game never reads or writes another game's rows.
- R58 The server computes nothing about the game: it imports only the timeline, the settings checks and the hash from the game package, never the engine (test: `apps/edge/test/server-computes-nothing.test.ts`). The phones compute targets, dice, scores, rankings and prizes; the server stores, validates, schedules and tallies votes.
- R46 A player sees their own seat and nickname from their own phone only.

## H. Product rules (wording and money)
- R47 Players never pay and never stake money. There are no cash prizes and no betting. Any gift is supplied by the organizer, outside this product. Adults (18+) only; a company event.
- R48 A nickname only is asked of a player; the boxes with the short privacy notice come before the nickname field (tests: `apps/edge/test/consent.test.ts`, `apps/web/test/luck-page.test.ts`).
- R49 The Terms boxes (K1 to K6) are enforced by the server and recorded in `consent_log` (tests: `apps/edge/test/consent.test.ts`).
- R50 A paid game can be moved within 365 days of the payment day; there is no refund, a cancelled game becomes credit (tests: `apps/edge/test/reschedule-window.test.ts`, `credit.test.ts`, `cancel.test.ts`).

## Known limits (stated, not hidden)
- The server draws the secret and publishes the beacon values at their due time. The server is therefore trusted to draw the secret fairly and not to look; afterwards anybody can re-check every number. A public beacon from outside (the other Corporate Games use drand) is not wired into this build; the phone reads the game's own feed.
- A modified browser cannot be made impossible; a result counts only when enough phones agree (R39).
- Clearing browser data gives a new device id; the place is on one phone only (the same rule as the other Corporate Games).
- Presence mode and the golden shoot-out are not built.
