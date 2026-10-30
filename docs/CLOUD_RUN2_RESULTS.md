# Cloud run 2 results

- Date: 2026-10-30
- Tested: branch `luck/rel-after-tambola-2026-10-29` at `fe2aa77`
- Run 1 compared: `docs/CLOUD_RUN1_RESULTS.md` (tested `ed740fb`)
- Bun 1.4.4, TypeScript 5.9.3. Nothing was fixed, deployed or changed in code.
- Only this file is committed.

## Verdict

Almost green. Typecheck and every folder pass, except 2 tests in `apps/web`.
Both fail the same way on the parent `752ff60`, so they are pre-existing and not caused by this branch.

## Commands used

- `bun install` (ok, 17 packages)
- `bun run build:control`, `build:report`, `build:zgame`, `build:luck` (all ok, exit 0)
- `bun run typecheck` (`tsc --noEmit -p tsconfig.json`): 0 errors
- `bun test --isolate <folder>`, one folder at a time. No folder needed splitting and Bun did not crash.
- Builds rewrote `apps/web/public/{control,reportgen,zgame,luck-engine}.js`. Reverted. Untracked `bun.lock` removed.
- Skipped / todo tests: 0 in every folder.

## Counts

| Folder | Pass | Fail | Skipped | Run 1 (pass / fail) |
|---|---|---|---|---|
| typecheck | 0 errors | | | 67 errors |
| packages/beacon | 100 | 0 | 0 | 93 / 7 |
| packages/billing | 26 | 0 | 0 | 26 / 0 |
| packages/luck | 36 | 0 | 0 | 36 / 0 |
| packages/shared | no test files | | | no tests |
| apps/cron | no test files | | | no tests |
| apps/server | folder does not exist | | | |
| tools/control-worker | 1 | 0 | 0 | 1 / 0 |
| apps/edge | 1137 | 0 | 0 | 1019 / 14 |
| apps/web | 264 | 2 | 0 | 258 / 8 |

## Remaining failures (2, both pre-existing)

Both in `apps/web/test/pages.test.ts`. Both are a 6-second timeout: the page stays on step 1 and the wait for the expected text ends (`error: timed out waiting; page says: ...`).

1. "console: no refunds (credit), games that wait or did not start, 'Create a new game like this one', rescheduling > Create a new game like this one: on the game page and in the games list (not for a Co-host); the people tick box only when the old list exists; the new game opens on step 1 with the date and time empty and the read-back with Change buttons" (~6.4 s)
2. same describe > "Rescheduling: a date more than 30 days ahead is refused politely before anything is sent; the server's own message (a game that has started) is shown as it is" (~6.2 s)

- Class: PRE-EXISTING. Re-run on the parent `752ff60` (clean install, `pages.test.ts` alone): the same 2 tests fail (85 pass / 2 fail). Same as run 1.
- Not a slow-machine flake: they failed in the full run and again on the base, with the same message in both.

## Run 1 failures: fixed or remaining

Fixed (all):

- Typecheck: all 67 errors gone (header types, `draft` / `ticks` in consent test, `lazyTickReset` / `LAZY_TICK_MS`, `checkin.ts`, `GENESIS` in `control-browser.ts`).
- packages/beacon: all 7 (hedge test, 4 abort/timeout round tests, 2 press-numbering tests).
- apps/edge: all 9 named failures and the load error:
  - consent (Co-host cannot pay, K4 deletion), privacy (reuse of erased list, scheduler erase, AI-assistant erase), verify (`need-id`), clone (draft limit), releases (`sw.js`), wording (`zc.js`), `whoami-email` load error.
- apps/web, 6 new ones: `version-stamp` (z.js build), two `pages.test.ts` console tests (press window text, ten-steps write-ups), `no-internal-notes` (`luck.css`), `luck-dice` and `luck-page` R55 (`Math.random`).

Remaining:

- apps/web: the 2 pre-existing `pages.test.ts` timeouts above. Nothing else.

## New failures in run 2

None. Every test count went up or stayed the same compared with run 1 (beacon 93 to 100, edge 1019 to 1137, web 258 to 264), so tests were added by the fixes and all of them pass.
