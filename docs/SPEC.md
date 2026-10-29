# Corporate Luck by Chance: product and build specification (version 1, 2026-10-12)

Owner brief (2026-10-12): a pure-luck dice game for thousands of players at once, from their own phones or laptops. The screen shows a target number; everyone presses the dice; players whose dice shows the target number score that many points; everyone else scores zero. Each round has 10 dice rounds; points add up; prizes can be per round or for the total. Take the clue from Corporate Tambola. Status: SPEC ONLY, nothing is built.

Binding owner rules (all our games):
- **Separate product:** own repository, own website (`corporate-luck-by-chance.pages.dev`), own Cloudflare project, database and secrets. Nothing shared with Tambola, Bingo, Tic Tac Toe or Snakes and Ladders. The only meeting point is the IT Services by Rajat Agarwal payment service and ledger.
- **The game itself uses no server.** Phones and laptops do the work with their own memory. The server only registers people, takes payment and keeps the smallest possible collector.
- **100% random: no one can predict a result, not even the software.** All randomness comes from the public random beacon, published after the moment it is needed.
- **NO TIES. Clear winners.** Every game always produces a clear 1st, 2nd, 3rd, 4th, 5th and a top-10 list (section 6).

---------------------------------------------------------------------------------------------------

## 1. How it plays
1. A game has **10 rounds** (DECIDED by the owner 2026-10-12; the organizer may still choose 1 to 20). Each round has **10 dice rounds**, so a full game is 100 dice rounds.
2. At the start of a dice round the screen shows a **target number**, 1 to 6, very large.
3. Every player gets a window of a few seconds (default 10) to **press the dice**.
4. The window closes; the dice shows for everyone. A player whose number equals the target scores **that many points** (target 1: 1 point, target 6: 6 points). A player whose number is different scores **0**.
5. After 10 dice rounds the round ends; points add up; the round's winners and the overall standings are shown. The game goes on to the next round. Points keep adding up across rounds.
6. After the last round the overall winners are announced.

## 2. Randomness (nobody can predict, not even the software)
- **Target number** of dice round `k` = 1 + (hash(game id, k, beacon value A_k) mod 6), where A_k is the first beacon value published after the previous dice round ended. It does not exist before then.
- **A player's dice** in dice round `k` = 1 + (hash(game id, seat, beacon value B_k) mod 6), where B_k is the first beacon value published AFTER the press window of that dice round closes. So the roll cannot be known while the window is open, nobody can wait to see it, and the target is already fixed when the player presses.
- Targets and dice are independent. Everything can be re-computed by any phone from the public beacon values; no human and no server chooses anything.
- A player's chance of a hit in any dice round is exactly 1 in 6, whatever the target.

## 3. Two ways to run it (decision needed; the same choice as in Snakes and Ladders)
| | **Fate mode** | **Presence mode** |
|---|---|---|
| Pressing the dice | The roll happens automatically when the window closes; the press is the drama (dice animation, sound, vibration). A player who is away still scores. | A player who does not press inside the window gets no dice that time and scores 0. (This matches "participants press the dice".) |
| Server during play | None. Every phone computes every player's score itself from the public data and the seat list. The top-10 list is exact on every phone. | One small timestamped request per press (a "ping") |
| Size | Thousands at no extra cost | About 1,000 to 1,500 players on the free plan (an estimate, to be measured) |
| Cheating | Nothing to cheat | A false claim of a press is refused because the server timestamps the press |
Why Presence mode needs a server timestamp: after a window closes the dice results are public. A phone that only claimed "I pressed" could claim every missed press afterwards and score. Nothing a phone does alone can prove it pressed in time. Recommendation: build both; Fate mode for the big crowds.

## 4. What the numbers look like (my calculation and simulation, 2026-10-12)
- One dice round: expected points = (1/6) x average target = 3.5 / 6 = **0.58**; standard deviation about 1.5.
- One round of 10 dice rounds: expected **5.8 points**, standard deviation about **4.7**.
- Ten rounds (100 dice rounds): expected about **58 points**, standard deviation about **14**; the best of 5,000 players ended near 120 in a simulation. (Five rounds: about 29 points, standard deviation about 10, best near 70 to 72.)
- **Ties are certain.** In a simulation of 20 games with 1,000 to 5,000 players, there was a tie inside the top 10 in 19 to 20 games out of 20, a tie inside the top 5 in 10 to 16 games out of 20 (also 10 of 20 with 10 rounds), and a tie for first place in 0 to 3 games out of 20. This is why the no-tie rule (section 6) is not optional.

## 5. What each player sees
- **The target first**, in plain words and colour: "Dice round 4 of 10. Target number 4. Roll a 4 and you score 4 points. Any other number scores 0.", with the target drawn as a small dice face (its dots, in the colour of that number). Above it: "Round 2 of 5", a row of ten marks (one per dice round: match, miss, or still to come) and the score badge.
- **A real drawn dice** (CSS only, no images, no libraries): a realistic ivory cube (cream rounded faces, black dots 1 to 6 with opposite faces adding up to 7, a soft shadow on a green table, the 6 on top at rest). Pressing the big "Press the dice" button makes it tumble on the screen. In a real game the number does not exist until the window closes, so the dice keeps tumbling and, when the window closes, slows down over about a second and a half and stops on the number the phone worked out. (On the free demo the number is known at once, so it tumbles for about 0.7 seconds, then slows down for 1.5 seconds.) The number never depends on the animation: the animation only shows it.
- **Beside the dice** the number comes in big type ("You rolled 4"). The number, the points and the score badge appear only after the dice has stopped.
- **A match** gets a colour burst and the words "+4 points"; **a miss** gets calm colours and "Not this time, 0 points".
- **Reduce motion:** with the phone's "reduce motion" setting there is no tumbling: the dice shows its number after a short fade.
- **Screen readers** hear the target when a dice round opens and the result after the dice has stopped (one polite status region).
- **Every phone:** 320 to 430 px wide, upright and on its side, no sideways scroll, the target, the dice, the button and the score in view on a 360 x 640 screen, a Press button of at least 68 px, text of at least 12 px, notch and home-bar safe. It installs like an app (home screen, full screen) and the game is saved on the phone. An offline page shows when there is no connection, and the free demo plays with no connection.
- After the reveal: the history is a row of small chips, one per dice round: the target face, the face you rolled, a tick or a cross, and the points.
- Their points this round and in total, and their standing in plain words ("you are in the top 8%"), computed on their own phone.
- **The top-10 list** after every round, in this order: place, nickname, points. Players choose a nickname when they join; the organizer sees real names only for prize hand-over (decision in section 14: nickname or masked number).
- The final ceremony: 1st to 5th with a short "how this was decided" line, then the top-10 list.

## 6. NO TIES: always a clear 1st to 5th and a top 10 (applies to every game we make)
**Rule:** every game produces a complete strict order of its players for at least the top 10 places. A prize is never shared and never left undecided. If players are equal on a measure, the next measure in the chain decides, and the last measure is fate, so the order always exists and everyone can re-check it.

**The chain for this game** (the same chain is used for each round and for the overall result; it is printed on the rules card before the game starts):
1. Most points.
2. The highest single hit (a 6 beats a 5).
3. The most hits.
4. Earliest to reach that final score (who got there first, by dice round).
5. **Fate:** a number from the beacon for every player (hash of game id, seat and the label of that ranking); the lowest number wins. Anyone can re-compute it.

**Optional "golden shoot-out" for the top five places** (recommended as a show, organizer can turn it off): if players are still equal after step 1 for any of places 1 to 5, extra "golden" dice rounds are played among only those players, each with a fresh target and a fresh press, until they separate. Fate (step 5) is the last resort if they are still equal after 5 golden rounds. This makes the finish dramatic instead of settled by a hidden number.

**Round prizes and overall prizes:** each round has its own ranking (1st to 5th and a top 10 from that round's 10 dice rounds). The overall ranking uses the running total. Both use the chain above. The organizer sets the prize text for each place of each ranking.

**The results screen, big screen, report and prize hand-over** always show: 1st, 2nd, 3rd, 4th, 5th, then places 6 to 10, each with one line saying how it was decided when a tie had to be broken ("tied on 41 points; decided by the highest single hit").

## 7. Timing
- A dice round: press window 10 seconds, reveal 3 seconds: about **13 seconds**. (A setting: window 6 / 10 / 15 seconds.)
- A round of 10 dice rounds: about 2 minutes 10 seconds, plus a 20-second standings break: about 2.5 minutes.
- **Ten rounds: about 26 minutes** (the default), plus any golden shoot-out. Five rounds would be about 13 minutes.

## 8. Prizes
- **Per round:** 1st to 5th of each round (organizer sets text or a gift for each place), and the top-10 list.
- **Overall:** 1st to 5th of the total, and the top-10 list.
- **Both** at once is the default; the organizer may use per-round only or overall only.
- A player may win several prizes (the organizer may switch this off, giving the next player in the order the prize).
- Prizes are decided by software only: each phone computes the ranking and a result counts when enough different phones agree (the vote and quorum rule used by Tambola); the organizer's console only watches. Players never pay to play and the product never holds or pays prize money.

## 9. Scale and cost
- **Fate mode:** each phone computes every player's score. 5,000 players x 100 dice rounds = 500,000 small hash calculations (an estimate; to be measured on a low-end phone; they can be done in slices as each dice round arrives, so the phone never does it all at once). No request leaves the phone during play; the signed result votes are collected once at the end of each round (a few requests per phone per round).
- **Presence mode:** one ping per press: players x dice rounds (1,000 players x 100 = 100,000 requests for a 10-round game, which is the whole free daily allowance, so a full 10-round Presence game is realistic only for a few hundred players on the free plan; this is an estimate to be measured). The free plan allows roughly 100,000 requests a day for everything, so this limits Presence mode to about 1,000 to 1,500 players. A larger size needs a paid plan; **no paid add-on is switched on without the owner's yes.**
- Boards, dice and results are never stored on the server. Only press timestamps (Presence mode) and the winners' votes.

## 10. Everything around the game (copied once from Corporate Tambola, then independent)
Roles (Organizer, Host up to 5, Co-host, AI work link), the nine-step console, the big screen (target number, countdown, top-10 list, final ceremony), waiting room, announcements, brand breaks, lucky draw, invites and people lists, clone, reschedule, cancel; pay before start with credit instead of refunds; report e-mailed as a link about 3 minutes after the end (valid 19 hours); personal data deleted 20 hours after the end; winners kept 365 days; no e-mail ever to a guest. **Registration closes before the first dice round** so the seat list is frozen; a guest who arrives later sees that the game is already running.

## 11. Sizes, price, ledger
- **Sizes:** the same ladder as Corporate Tambola (up to 100, 250, 500, 750, 1,000, 2,500, 5,000, 10,000 players). Presence mode is limited to the smaller sizes.
- **Price (decision):** the same price ladder as Corporate Tambola, INR and US$, no GST while the seller is not GST registered, kept in this product's own pricing file.
- **Ledger:** orders go through the central payment service as `razorpay / IT Services / Corporate Luck by Chance / sales / luck_pack_<N>` (plus `payment_test`); refer and earn, sales-team commission and salary use the same template. New site key and plan rows; no new code in the central service.

## 12. Build plan (each with an exit test)
| Phase | Work | Exit test |
|---|---|---|
| L0 | Decisions in section 14; the Razorpay prerequisites (webhook secret, international cards) | Owner answers |
| L1 | Pure engine: target, dice, scoring, rounds, the tie chain, fate, golden shoot-out | Unit and property tests green |
| L2 | Phone screen and big screen; Fate mode end to end | A 30-phone simulated game and a 2-phone real-browser game agree exactly |
| L3 | Presence mode with the collector and pings | 1,000 simulated phones inside the request budget; false-press claim refused |
| L4 | Console, settings, AI manifest, report, lifecycle, payments through the central service, partner features | Life-cycle and matrix scenarios green |
| L5 | Own website (all pages), accessibility, legal pages | Page checks green |
| L6 | 5,000 simulated phones in Fate mode; soft launch | First paid game end to end |

## 13. Tests required
- **Randomness:** a target and a dice value are uniform 1 to 6 over many seeds; the same on every device; the dice function needs the beacon value that does not exist while the window is open.
- **Scoring:** a hit scores the target; a miss scores 0; round and total sums; the maximum possible score.
- **Ranking:** over 100,000 simulated games with thousands of players, **a strict order of at least the top 10 is always produced**; the chain is applied in order; fate is the last step; the same order on every device; the golden shoot-out separates tied players and ends.
- **Presence:** a phone that claims a press it did not make is refused; pings stay inside the budget.
- **Scale:** 5,000 simulated phones in virtual time; the 30-phone and 2-phone real-browser games; the life-cycle, matrix and UI scenarios copied from Tambola and adapted.

## 14. Decisions the owner must make
1. ~~How many rounds~~ DECIDED 2026-10-12: 10 rounds (the organizer may set 1 to 20).
2. ~~Mode~~ DECIDED 2026-10-12: build BOTH Fate mode and Presence mode; the organizer picks one when creating the game.
3. **Press window:** 10 seconds (default) or another.
4. **Prizes:** per round, overall, or both (default both).
5. **Golden shoot-out for the top five:** on (recommended) or off.
6. ~~Names on the top-10 list~~ DECIDED 2026-10-12: **nicknames** chosen by players when they join (the organizer sees real names only for prize hand-over; offensive nicknames are blocked by a simple list and the organizer can rename).
7. **Price:** the Tambola ladder (default) or its own.

## 15. Honest limits
- It is a game of pure luck, and we say so; there is no skill. Players never pay to play and nobody wins money from us.
- In Presence mode the press timestamps need a server and so limit the size on the free plan.
- A modified browser cannot be made impossible; a result counts only when enough phones agree.
- Clearing browser data gives a new device id.
- The beacon must be reachable from the player's network (mirrors and the organizer's signed fallback file, as in Tambola).

## 16. Acceptance criteria
- LC-01 Every dice round has a target that no one (software included) could know before it was published.
- LC-02 A player's dice cannot be computed while the press window is open.
- LC-03 A hit scores exactly the target number; a miss scores zero.
- LC-04 In Fate mode every phone shows the same standings and the same top-10 list without any server call during play.
- LC-05 In Presence mode a player who does not press in the window scores zero for that dice round, and a false claim of a press is refused.
- LC-06 **Every round and the overall result always give a strict 1st to 5th and a top 10 with no ties;** each tie-break used is shown in one line.
- LC-07 The golden shoot-out ends within 5 golden rounds, or fate decides.
- LC-08 Orders appear in the central ledger as `Corporate Luck by Chance / sales / luck_pack_<N>`.
- LC-09 Report, deletion and e-mail rules equal Tambola's; no guest is ever e-mailed.
- LC-10 Separation: no import, path or link to any other game's repository; it builds and tests alone.
