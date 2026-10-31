# Tests that do not pass, and why

No test has been weakened or removed for Luck so far. Two pages.test.ts tests fail on the base commit 752ff60 as well (before any Luck-by-Chance work); they are not stale, their cause is still open:

1. "Create a new game like this one: on the game page and in the games list ..." (times out waiting for the new game to open on step 1).
2. "Rescheduling: a date more than 30 days ahead is refused politely ..." (the first refusal shows, the second save with a near date never shows the server's own message).

Both time out at the 6 s wait of the test page; the console behaves correctly by hand. See docs/TEST_HANDOFF.md, known items.
