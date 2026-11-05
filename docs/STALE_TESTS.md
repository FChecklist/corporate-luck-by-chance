# Tests that do not pass, and why

None. No test has been weakened or removed for Luck. The two pages.test.ts tests that failed on the base commit (the "Create a new game like this one" and "Rescheduling" ones) used the real clock for dates while the console page runs on the test world's frozen clock (T, 1 Oct 2026); they now compute their dates from T, so they no longer depend on the day they run.

- packages/beacon/test/config.test.ts "nothing set gives ... default places": expected three places; the owner rule is that the top five win, so a new game now starts with five prize lines (1st to 5th). Test updated.

- apps/edge/test/pay.test.ts "too big for any pack": a 100,000-person draft can no longer be created (owner cap of 2,000, 1 Nov); the test now checks the refusal at creation.

- privacy, gamerecord-life, param-life, owner-test-free tests: games of 5000 people changed to 2000 (the owner cap, 1 Nov); same checks, size only.
