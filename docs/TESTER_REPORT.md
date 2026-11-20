# Tester report v3: Corporate Luck by Chance 1.4.1

- Product branch tested: `fix/luck-1.4.1-2026-10-30`, head `cdc5949` (1.4.1c).
- Test branch: `tests/luck-1.4.1-v3-2026-10-31` = that head + the test files of `tests/luck-1.4.1-2026-10-30` (46b64c4) + the changes below.
- No product code was changed. `git diff origin/fix/luck-1.4.1-2026-10-30 -- . ':(exclude,glob)**/test/**' ':!docs/TESTER_REPORT.md'` is empty (checked after the break runs).
- The merge had no conflicts: the old test branch only touched `apps/edge/test`, `apps/web/test`, `bun.lock` and a root `TESTER_REPORT.md`. I took the test files only. I did not take `bun.lock` (not a test file) and this report replaces the old root one.

## 1. Results (one folder at a time, `bun test --isolate <folder>`)

| Folder | pass | fail | notes |
|---|---|---|---|
| packages/shared | no tests | | bun finds no test file here |
| packages/beacon | 100 | 0 | 8 files |
| packages/billing | 26 | 0 | 1 file |
| apps/edge | 1198 | 0 | 77 files, includes 3 `test.failing` (product defects, section 4) |
| apps/web | 288 | 0 | 26 files, includes 2 `test.failing` (product defects, section 4) |
| tools/control-worker | 1 | 0 | |
| `bun run typecheck` | 0 errors | | |

`test.failing` passes while the defect is there and turns red the day the product follows the rule. Remove `.failing` then.
Also run, not in the list given to me: packages/luck 36 pass, 0 fail. Nothing was run in a real browser or on a deployed Worker (happy-dom and the in-memory Worker only).

## 2. First run on the product head: 5 failures, all test-side

| Test | Why it failed | Decision |
|---|---|---|
| `idclean-matrix` (edge) | The oracle kept zero-width characters (the 1.4.1 rule). The product (1.4.1b) now removes U+200B-U+200D, U+2060, U+FEFF, U+0085, U+2028, U+2029 from a participant Email ID and refuses them inside an account e-mail. | Test encoded OLD behaviour. Oracle rewritten from the rules. |
| `fix141-web` "the id-kind lock, ..." | Expected the old guide titles. The guide entry at `guide.js:35` was fixed in 1.4.1b ("Please type your ID to go in"). | Test encoded old behaviour. Expectation updated. |
| `fix141-web` "PRODUCT NOTE" (`test.failing`) | It passed as "failing", which means the dead guide entry was fixed. | Now an ordinary test. |
| `guide.test.ts` "each one is either guided..." | The Worker now has `Enter your ${W}.` at `worker.ts:1589` and `:1647`. The test read the template literally. | Test fixed: `${W}` is expanded to both real words ("employee ID", "Email ID"), and both must be matched. (Before, the dead guide entry hid this.) |
| `legal-sync` "no internal notes in the site pages or the docs" | `docs/TEST_HANDOFF.md:202` quotes the two forbidden marker words while describing the rule about shipped files (the sentence starts "No 'Boss', ..."). | Test-side, narrow: only that exact sentence (`HANDOFF_RULE` in the test) is exempt. A real note anywhere (also in that file) still fails. If the product owner wants no such words in any doc, reword line 202 and the exemption can go. |

## 3. New tests

- `apps/edge/test/rules-v3.test.ts` (18 tests, 3 of them `test.failing`)
  - Employee ID: NFKC, upper case, A-Z0-9 only; cap 30 after cleaning (30 ok, 31 refused, 40 typed that clean to 30 ok); empty vs nothing-left; people-add flags the second row of "1b-678" / "1B 678" / "１Ｂ－６７８" as a duplicate after cleaning; a 31-character join makes no seat; an e-mail typed in an employee-ID game is refused with the plain sentence and none of its letters appear in the answer (people-add and join).
  - Participant Email ID: each of the 8 invisible characters removed at start, inside and end; two people typing the same visible ID (one with a hidden character) are one person.
  - Account e-mails: each of the 8 characters and a space inside is refused (`accountEmail` returns ""), on `/api/start` and Host add, and nothing is created.
  - ID-kind lock: 409 `id-kind-locked` for a kind change (exact "different kind of ID" sentence), and with a joined participant.
  - endedAtMs: see D3.
- `apps/web/test/rules-v3-web.test.ts` (9 tests, 2 `test.failing`): exact hint texts ("The system will read this as ...", the plain e-mail line, invisible characters in the Email ID hint), where the hint is chosen, guide texts.
- `idclean-matrix.test.ts` (extended): the 5 invisible characters that the 34-character alphabet did not hold (U+200C, U+2060, U+0085, U+2028, U+2029) are now in the structured part, as separators and as prefixes/suffixes.
- Employee-ID game on the NEW rule: `EMP_CLEAN_FROM_MS` is still the 2100 placeholder, so the tests set `engagement.created_ms` to it to put one game on the new cleaner. A game created today keeps the old rule (covered by `fix141.test.ts`).

## 4. Streamed matrix

`apps/edge/test/idclean-matrix.test.ts`, test "more than 1,000,000 distinct inputs".

- **2,662,772 distinct inputs**, asserted exactly. (Part 1: 1,376,831 = every string of 0-4 characters over 34 characters, distinct by construction. Part 2: 1,135,941 structured. Part 3: 150,000 seeded random.)
- **Skipped repeats: 12,364** = 1,399 that part 1 already holds + 10,965 repeated inside parts 2 and 3 (kept in a Set; each input is checked once).
- Every input goes through: `empId`, `emailId`, `accountEmail`, `looksLikeEmail`, `listEmail`, `legacyNormEmp`, `normEmpFor` (new and old rule), the browser mirror (`empId`, `emailId`, `looksLikeEmail`, `legacy`) and all three hints. 0 differences from the oracle.
- The oracle uses no regex, no `.trim()`, no `.replace()`. It walks code points against written-out lists. Shared with the product: only the platform's `normalize("NFKC")`, `toUpperCase`, `toLowerCase`. A hand-worked test guards the oracle itself.
- Coverage (every class above 1,000): empty after cleaning 326,458; over 30 533,144; account refused 1,499,062; account kept 1,163,710; list e-mail ok 315,258; has inner blank 1,496,684; astral characters 488,592; looks like e-mail 662,978.
- Run time about 75 s.

## 5. PRODUCT DEFECTS (the product is wrong against the rules; the tests were not bent)

**D1. Over 30: the required sentence is never shown.**
- Where: `apps/edge/src/idclean.ts:34-35` (`BAD_EMP_NEW`), `apps/edge/src/people.ts:64` (`badIdWhy`).
- Input: a game on the new rule, `POST /api/z/:id/people` (or `/join`) with `empId` = 31 × "A".
- Expected: "This ID is too long. An employee ID may be up to 30 characters once cleaned."
- Actual: "That employee ID has no letters or numbers in it, or is longer than 30 characters. Type it again in the Employee ID box using the letters and numbers on your ID card." (the same text for "nothing left" and "too long").
- Test: `rules-v3.test.ts` "PRODUCT DEFECT D1" (`test.failing`).
- **D1b (page side).** `apps/web/public/idclean.js` `empHint`: for 31 cleaned characters the hint reads "The system will read this as AAAA...A" (31 letters) instead of the too-long sentence. The sentence is in no shipped file. Test: `rules-v3-web.test.ts` "PRODUCT DEFECT D1b" (`test.failing`).

**D2. A change of the way in (verify) gets the wrong sentence.**
- Where: `apps/edge/src/worker.ts:2010`.
- Input: a game with `verify: "id"` and one person listed; `PATCH /api/z/:id/settings {"verify":"mobile"}` (kind untouched).
- Expected: 409 `id-kind-locked`, "You already have people listed. Start a new game to use a different way of asking for IDs."
- Actual: 409 `id-kind-locked` with "...to use a different kind of ID." (one sentence for every change). The lock itself works, for listed people and for joined participants.
- Test: `rules-v3.test.ts` "PRODUCT DEFECT D2" (`test.failing`).
- **D2b.** `guide.js` has an entry for the "kind of ID" sentence only (`guide.js:115`). Once D2 is fixed, the "way of asking" sentence has no guide entry. Test: `rules-v3-web.test.ts` "PRODUCT DEFECT D2b" (`test.failing`).

**D3. `endedAtMs` does not exist.**
- Where: nowhere. The string `endedAtMs` is in no file under apps, packages, tools, docs, pages or site. `/api/z/:id/info` and `/summary` return no end-of-game time at all (checked by `rules-v3.test.ts` "what exists today...").
- Input: a game with a phones-confirmed end (`life.end_src='phones'`), `GET /api/z/:id/info` and `/summary`, with the clock before the end.
- Expected: `endedAtMs` = the stored end, whatever the clock. Same for an organizer end. For a scheduled end: recomputed at read time (+60 s), returned only once now >= bound. Absent while the game can be live. Never moves once returned. Purge/erase is not an end. Cancel is not an end.
- Actual: no field. So the rules for the scheduled end, "never moves", purge and cancel could NOT be tested; there is nothing to read. Only two things are tested: the phones-confirmed case (`test.failing`) and that the field is absent for a live game (passes today only because the field is missing).
- Warning for whoever builds it: the data a coder will reach for is the `life` table (`end_ms`, `end_src`), and it already holds rows that are NOT ends. `erasePersonal` (`lifecycle.ts:143`) writes `end_src='organizer'` with `end_ms=now` for a purge/erase, and the cancel path (`lifecycle.ts:387`) writes `end_src='cancel'` with the cancel time. The tick also writes a `schedule` row (`lifecycle.ts:394`) that is re-read each pass. Reading `life.end_ms` as `endedAtMs` would break the "erase is not an end" and "cancel is not an end" rules. Tell me where the field should be returned (which routes) and I will write the full set.

## 6. Deliberate-break checks (`bash apps/edge/test/break-checks-v3.sh [id]`)

The product file is broken on purpose, the guarding tests must go RED, the file is put back byte for byte, the tests must be GREEN. All 25 ran: red every time, 0 failing after restoring. After the run the product diff against the product branch was empty (section top).

Rules broken, the four added in v3 (rule, failing tests when broken):

| Id | Break | Failing when broken | After restore |
|---|---|---|---|
| V01 | `BLANKS` loses the 7 invisible characters (idclean.ts) | 5 | 0 |
| V02 | `EMP_MAX` 30 to 31 | 3 | 0 |
| V03 | `empId` stops doing NFKC | 3 | 0 |
| V04 | browser `BLANKS_G` loses the invisible characters (idclean.js) | 1 | 0 |

Carried over and re-run on this head (all red then green):

| Id | Break | Failing when broken |
|---|---|---|
| B01 | `accountEmail` repairs a space instead of refusing | 11 |
| B02 | `accountEmail` loses its backslash | 9 |
| B03 | `isTestLogin` repairs spaces | 1 |
| B04 | Host add: spaced address + mobile goes through | 1 |
| B05 | `emailId` stops removing invisible characters | 5 |
| B06 | `LIST_EMAIL_SHAPE` loses its backslash | 2 |
| B07 | lock ignores LISTED people | 2 |
| B08 | lock ignores JOINED participants | 1 |
| B09 | lock code renamed | 2 |
| B10 | `EMP_CLEAN_FROM_MS` set to 1 | 2 |
| B11 | luck.js hint switches by "@" instead of the kind of ID | 3 |
| B12 | zc.js hint switches by "@" | 2 |
| B13 | idclean.js `empHint` loses the e-mail guard | 6 |
| B14 | guide lock entry reworded | 1 |
| B15 | guide "asked on its own" entry reworded | 1 |
| B16 | `empId` keeps underscore | 1 |
| B17 | browser `emailId` stops lower-casing | 1 |
| B18 | harness stops loading idclean.js | 4 |
| B19 | data map drops "e-mail" | 2 |
| B20 | real marker word in the pack file | 1 |
| B21 | real marker word in zc.js | 1 |

B01, B05 and B17 were re-written for the new `idclean.ts` / `idclean.js` lines; the old ones no longer matched the 1.4.1b code.

## 7. Limits

- Account e-mail refusal is driven by request on start, Host add, Host setup, partner enrol and partner sign-in (spaces) and on start and Host add (the 8 invisible characters). Help Desk, invoice, payment/credit contact and Google sign-in share `accountEmail` and are covered by the unit tests and the matrix, not driven end to end.
- The "hint only where the server cleans" rule is tested by where the page picks the hint (kind of ID and rule flag) plus the exact texts. I did not find a game state where the page shows a hint and the server does not clean.
- `pages.test.ts` near line 574 still builds a 5-day date from the machine clock (unchanged; noted in the earlier report).
- Vendored pack text about a 5-minute change window, refunds and pause (`pack/zc-flow.js`) is unchanged and out of scope.
- `bun.lock` was created by `bun install` and is left uncommitted.
