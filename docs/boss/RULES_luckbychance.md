# Corporate Luck by Chance: the rules (plain words, draft 1, 2026-10-27, for the owner to read before anything is built)

Model: the Corporate Tambola rules. Shown to a player under "Rules" on the game screen and to the organizer and Hosts in their console. Sections 1 to 9 are the text, 10 the table of messages, 11 is for the builder.

## 1. How to play
1. The game has 10 rounds. Each round has 10 dice rounds, so 100 in all.
2. In every dice round the screen shows a target number from 1 to 6.
3. When the press window opens, press the dice button. Your dice is thrown.
4. If your dice shows the target, you score that many points. Any other number scores nothing.
5. Points add up across all dice rounds. The most points at the end wins.

## 2. How you win
1. The player with the most points is first. If points are equal, the highest single hit wins (a 6 beats a 5), then the most hits, then whoever reached the score first, then fate. Fate is a number anybody can re-check. The order is never tied.
2. The organizer writes a gift for the places 1 to 5 of the overall ranking and, if wanted, of each round. A gift is never money.
3. The result tells you in one line when a tie was decided ("Tied on 11 points; decided by who reached the score first.").
4. During the game you see how you stand in plain words, for example "You are in the top 8%".

## 3. The timer
1. Every press window is 10 seconds. After it there are 3 seconds to show the result. After every full round there is a 20-second break to show the standings.
2. The timer on your phone is small and quiet, for example "Press in 10... 9... 8...". The server's clock is the real timer.
3. The screen always shows how far we are: "4 of 10 rounds played · 6 left".

## 3b. Manual play has no fixed time
**Fixed time only when the software runs the game.** The 10-second press window and the round times exist because the software runs the game. If a host moves the rounds on by hand, there is no fixed time between rounds, no countdown is shown (the screen says "Waiting for the host"), and no total length is promised. A press still counts only before the next round is announced, decided by the server's clock.

## 4. Pressing on time (the strict rule)
1. You may press only inside the 10-second window, decided by the server's clock, not your phone's clock.
2. If you press after the window closed, the press is not counted and nothing is recorded. You see: "Ohooo! 😊 Sorry, you pressed after the press window closed. This press cannot be counted."
3. If you do not press at all, that dice round scores nothing for you. There is no penalty.
4. There are no claims in this game. Your score is worked out for you.

## 5. Pause
1. The organizer or a Host can pause the game. While it is paused no window opens.
2. When play restarts, the next press window opens in full (10 seconds). Every pause and restart is in the game log.

## 6. If you go away or lose the connection
1. Open the same link again. You see the standings and the current dice round.
2. Dice rounds that closed while you were away scored nothing for you. The page says how many.
3. Tip: switch on Do Not Disturb on your phone so calls and chats do not interrupt your game.

## 7. Fairness
1. The target of a dice round is made from public random data before the window opens. Your dice is made from public random data that is published only after the window closes, so nobody, not even us, can know a dice while the window is open.
2. Whatever the target is, your chance of a hit is exactly 1 in 6, the same for everybody.
3. Every phone shows the same standings. Anybody can re-check them.

## 8. What the organizer and a Host can and cannot do
Can: start, pause, restart, extend with a confirmation, end the game, see the live standings by seat number, the count of players and the log.
Cannot: change a target or a dice, press for a player, change the standings, see names or mobile numbers on the live board (only seat numbers).

## 9. Money and privacy
1. Players never pay and never stake money. No cash prize, no betting. Gifts come from the organizer outside this product.
2. Adults (18+) only. We ask your name only, unless your organizer asked for an employee ID or mobile number.
3. Personal details are deleted within 20 hours after the game ends. The game log (seat numbers only) is kept for 365 days.

## 10. Every message in one table
| When | Text |
|---|---|
| Window open | Press now. The dice are about to roll. |
| Quiet timer | Press in 10... 9... 8... |
| Press counted | Pressed. Good luck! |
| Press too late | Ohooo! 😊 Sorry, you pressed after the press window closed. This press cannot be counted. |
| Hit | Your dice shows {n}, the target. You score {n}! |
| No hit | Your dice shows {n}. The target was {t}. |
| Not pressed | You did not press this time, so no score. |
| Standing | You are in the top {p}%. |
| Paused | Game paused by the host at {time}. It restarts soon. Your score is safe. |
| Away note | Welcome back. You missed {k} dice rounds while away. |
| Do Not Disturb | Tip: switch on Do Not Disturb so calls and chats do not interrupt your game. |

## 11. For the builder
1. Rule 4 is decided by the server clock. Dice round k opens at start + k x (10 + 3) s plus the standings breaks (fixed schedule, no drift); a press stamped after the window is refused with HTTP 409 `late-press` and stores nothing.
2. Tests (falsified): a press at the last millisecond counts; at the close it is refused; no press scores nothing; pause then restart gives a full window.
3. Press window 10 s only (OPTIONS_TABLES.md); published games with 6 or 15 keep their window.
4. Today's technical rules stay in `docs/RULES.md` R01 to R33; the golden shoot-out stays out.
