# Cloud run 1 results

- Date: 2026-10-30
- Tested: branch `luck/rel-after-tambola-2026-10-29` at `ed740fb` (Tambola hardening merge)
- Compared against: parent `752ff60` (clean install in its own worktree)
- Bun 1.4.4, TypeScript 5.9.3. Nothing was fixed, deployed or changed.
- Raw logs were kept outside the repo. Only this file is committed.

## Verdict

NOT green. The merge introduced new failures in typecheck and in three test folders.
Only `packages/billing`, `packages/luck` and `tools/control-worker` are clean.

## Commands used

- `bun install` (ok, 17 packages)
- `bun run build:control`, `build:report`, `build:zgame`, `build:luck` (all ok)
  - Note: the builds rewrite tracked files in `apps/web/public/` (control.js, reportgen.js, zgame.js, luck-engine.js). I reverted them. `bun install` also creates an untracked `bun.lock`. Not committed.
- `bun run typecheck` (= `tsc --noEmit -p tsconfig.json`)
- `bun test --isolate <folder>` for each folder, one at a time
- No folder needed splitting: `apps/web` (24 files) ran in one go without a crash.
- Skipped / todo tests: 0 in every folder.

## Counts

| Folder | Pass | Fail | Skipped | Base 752ff60 (pass / fail) |
|---|---|---|---|---|
| typecheck | | 67 errors | | 0 errors |
| packages/beacon | 93 | 7 | 0 | 82 / 0 |
| packages/billing | 26 | 0 | 0 | not run |
| packages/luck | 36 | 0 | 0 | not run |
| packages/shared | no tests | | | |
| apps/cron | no tests | | | |
| tools/control-worker | 1 | 0 | 0 | not run |
| apps/edge | 1019 | 14 (9 named tests + 5 "unhandled errors between tests") | 0 | 855 / 0 |
| apps/web | 258 | 8 | 0 | 248 / 3 |

Note: the "unhandled errors" in apps/edge are not extra tests. They come from files that failed to load or from failing tests (counted once in the 5 errors line).

## Typecheck: 67 errors, all NEW (base had 0)

- `apps/edge/test/param-people.test.ts` (21), `join-gaps.test.ts` (11), `param-life.test.ts` (9), `demo-pass.test.ts` (8), `consent.test.ts` (7), `param-harness.ts` (3), `shared-read.test.ts` (2), and one each in `gamerecord-life`, `join-global`, `owner-test-free`, `whoami-email` tests.
  - Biggest group (52): headers typed `{ "x-organizer": string } | { "x-organizer"?: undefined }` passed where `Record<string,string>` is expected.
  - `consent.test.ts`: `draft` and `ticks` are not defined (also the cause of an edge test failure below).
  - `whoami-email.test.ts`, one more: `lazyTickReset` / `LAZY_TICK_MS` are not exported from `apps/edge/src/worker.ts`.
- `apps/edge/src/checkin.ts(104,70)`: TS2769, no overload matches this call.
- `packages/beacon/src/control-browser.ts(43)`: `Cannot find name 'GENESIS'`. This is real production code, not a test. It also breaks the `build:control` output at runtime.

## packages/beacon: 7 fail, all NEW

1. `beacon.test.ts` mirrors > hedged: a mirror that hangs delays the answer by the hedge time...
   - `expect(took).toBeGreaterThanOrEqual(50)`, received 24.8. The hedge delay is not applied.
2. beacon round for a press > a fetch that ignores the abort is still given up on
3. beacon round for a press > an address that answers its headers but never finishes the body is given up on too
4. beacon round for a press > our own server answers while the beacon's four servers never do: the press is signed at once...
5. beacon round for a press > when nothing answers, each wait is bounded by the given time...
   - 2 to 5 fail at `packages/beacon/src/control-browser.ts:43`: `GENESIS` is not defined.
6. numbering a press > a press right after another is numbered from the live file...
7. numbering a press > the confirm page (no token of its own) is numbered from the live file too
   - 6 and 7 throw inside `signControl` (`packages/beacon/src/control.ts:62`, the Ed25519 `sign` call, reached from `control-browser.ts:70`). The exact error text was not captured; cause not confirmed.

## apps/edge: 9 named failures + 5 load errors, all NEW (base: 0 fail)

1. `consent.test.ts` > "a Co-host who has not accepted the role cannot pay..."
   - `ReferenceError: draft is not defined` (line 236). Test file bug, same as the typecheck error.
2. `consent.test.ts` > "tests 1-4 at every point > K4: ... 24 hours after the game that row, the seat and the invitation record are gone"
   - line 152: Expected 1, Received 2 (a consent row not deleted).
3. `privacy.test.ts` > "names and numbers are sealed > reuse copies the earlier list..."
   - line 83: Expected 410, Received 200 (reuse of an erased list still works).
4. `privacy.test.ts` > "exact deletion dates > the scheduler's own door ... Erase deletes personal data at once"
   - line 262: Expected 2, Received undefined (`erased` missing in reply).
5. `privacy.test.ts` > "asking for deletion > an AI assistant can only ASK for a deletion..."
   - line 281: Expected 200, Received 409 on the organizer's own erase.
6. `verify.test.ts` > "this game's own points > a nickname alone is no way in when the organizer asked for an ID..."
   - line 210: Expected 400 (`need-id`), Received 200. The ID check is not enforced.
7. `clone.test.ts` > "what the new game is > the 10-draft limit applies"
   - line 128: Expected 409 (`draft-limit`), Received 200.
8. `releases.test.ts` > "release history (owner only) > the route is owner only..."
   - `ENOENT ... apps/web/public/sw.js` (line 20). The test reads `sw.js`; this repo ships `zsw.js` instead. Test needs adjusting, or the file is missing in the port.
9. `wording` test > "no wording from another game > page file zc.js"
   - Expected null, Received "Tambola". `apps/web/public/zc.js` still contains the word Tambola.
- Load error: `whoami-email.test.ts`: `Export named 'lazyTickReset' not found in module apps/edge/src/worker.ts`.
- Tests 3 to 7 look like real behaviour gaps (the port is not complete), not only test bugs. This is an inference from the errors, not confirmed.

## apps/web: 8 fail. 6 NEW, 2 pre-existing

NEW:
1. `version-stamp.test.ts` > P12: the real build writes version.json...
   - `pages/build.mjs` exits 1: `error: missing z.js`. `apps/web/public/z.js` is not present but is listed in `pages/build.mjs` FILES. Running `bun pages/build.mjs` by hand gives the same error.
2. `pages.test.ts` > console (organizer page) > "How it plays: ..."
   - line 337: page text lacks `press window (6, 10 or 15 seconds)`.
3. `pages.test.ts` > console: About this step write-ups > "each of the ten steps shows its box..."
   - line 827: lines/first-line check fails for at least one step (Expected 1 / Received 1 diff in the array).
4. `no-internal-notes.test.ts` > "every file of the deployed pages is free of internal notes"
   - Offender: `apps/web/public/luck.css` (when run alone).
5. `luck-dice.test.ts` > "no random numbers and no inline styles in the code that draws the dice"
   - `luck.js` contains `Math.random` (line 71, the busy-retry delay jitter).
6. `luck-page.test.ts` > R55 "...use only the engine to draw a number (no Math.random anywhere in the play code)"
   - same cause: `luck.js:71`.

PRE-EXISTING (also fail on 752ff60, same tests):
7. `pages.test.ts` > "Create a new game like this one: ..." (timed out waiting, page stuck on the first step)
8. `pages.test.ts` > "Rescheduling: a date more than 30 days ahead is refused politely..." (same timeout)
- On base there was a third failure that is gone now: "the deployed legal pages equal the final pages > legal-position.html". It passes on the merge.
- Caution: 7 and 8 are timeout style failures (6 s waits). They could also be slow-machine flakes. Not re-run a second time.

## Suggested order for luck-port

1. Fix `GENESIS` in `packages/beacon/src/control-browser.ts` (explains beacon failures 2 to 5 and the typecheck error; the hedge test and failures 6 and 7 need their own look).
2. Add `z.js` to `apps/web/public` or remove it from `pages/build.mjs` FILES.
3. Port `lazyTickReset` / `LAZY_TICK_MS` exports to `worker.ts`, and `draft` / `ticks` helpers to `consent.test.ts`.
4. Check the real behaviour gaps: erase and reuse (privacy), ID verify, draft limit, K4 deletion.
5. Remove `Math.random` from `luck.js:71`, the word Tambola from `zc.js`, the internal note in `luck.css`.
