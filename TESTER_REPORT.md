# Tester report: Luck 1.4.1 (branch `tests/luck-1.4.1-2026-10-30`, cut from `fix/luck-1.4.1-2026-10-30` f3928f2)

No product code was changed. Only test files, the test harness and this report. (The break script edits product files for a few seconds each and puts them back; see section 4.)

## 1. Counts (last summary line of each run)

| Folder | pass | fail | note |
|---|---|---|---|
| packages/beacon | 100 | 0 | 8 files |
| packages/billing | 26 | 0 | 1 file |
| packages/shared | no tests | | `bun test` finds no test file in this folder |
| apps/edge | 1180 | 0 | 76 files, 120 s |
| apps/web | 279 | 0 | 25 files, 83 s |
| tools/control-worker | 1 | 0 | |
| `bun run typecheck` | exit 0, no errors | | |

"pass" includes one `test.failing` (the PRODUCT NOTE in section 5, which passes because the defect is still there).
Starting point on f3928f2 before my changes: apps/edge 1153 pass / 1 fail, apps/web 257 pass / 9 fail.

## 2. Test-side items from the handoff

- **(a) IDCLEAN is not defined (4 My people tests):** `apps/web/test/harness.ts` now loads `idclean.js` immediately before `zc.js`. Tests: B18 (break red, restore green) and the "harness: IDCLEAN is there" test in fix141-web.test.ts.
- **(b) data-map line 61:** the e-mail field is now expected exactly when the data map lists "e-mail". The failing test was actually a different one, at line 47: the new consent wording says "e-mail address", and the test's postal-address pattern `\baddress\b` matched it. The pattern is now `(?<!e-?mail )\baddress\b`, with a test that a real "home address" still matches. Break B19 red/green.
- **(c) notes scan:** `no-internal-notes.test.ts` exempts ONLY the exact class text `.zf-ready.todo` (CSS) and `(ok ? "ok" : "todo")` (JS), and only in `public/pack/zc-flow.css` and `zc-flow.js` (source and built copy). Proof of narrowness: B20 puts a real `TODO` in `pack/zc-flow.js` itself and B21 puts one in `zc.js`; both go red. A unit test also checks the bare word, other pack files and our own code. `legal-sync` needed no exemption: it scans `site/` and `docs/` only, and it passes with the reworded docs.
- **(d) "Create a new game like this one" and "Rescheduling > 30 days":** run alone 3 times each BEFORE the change: 6 of 6 failed, so these are deterministic, not flaky. Cause (test side, not the vendored pack): the tests built "3 days ahead" and "5 days ahead" from the machine's real `Date.now()` (30 Oct 2026), while the page runs on the harness clock (1 Oct 2026). 4 Nov is 34 days from the page's clock, over its 30-day limit, so the page refused the date and sent no PATCH. They passed until about 26 Oct and would fail on every later day. Fix: dates now come from the page clock (`p.win.Date.now()`). After the fix: 3 of 3 pass.
  - A second, real race showed up in the full-folder run: the test clicked `[data-hist="1"]` right after the text "Start a new game" appeared, before the button existed. It now waits for the button. `pages.test.ts` then passed 3 of 3 full-file runs plus the final folder run. No fixed sleeps were added.
  - Not changed, but the same weakness: `pages.test.ts:574` also uses the machine's `Date.now()` (5 days). It passes today only because that path does not apply the 30-day limit.
  - Nothing here is a vendored-pack problem.

## 3. New tests

- `apps/edge/test/fix141.test.ts` (22 tests): account e-mails refuse inner spaces on start, sign-in, Host add (400 "That e-mail address does not look right. Please check it."; a spaced address with a mobile number is NOT added by mobile alone), Host setup, partner enrol and sign-in; hashes of "A@B.com" and " a@b.com " equal `sha256("email|a@b.com")`; `isTestLogin("demo 1＠xyz.in")` is false and cannot sign in with 123456; the id-kind lock: 409, `code: "id-kind-locked"`, exact sentence, PATCH and POST, with a person LISTED and with a PARTICIPANT joined (the lock also holds for every change of way in); unchanged requests still work; a removed person does not hold the lock; `EMP_CLEAN_FROM_MS` is exactly 4102444800000 (1 Jan 2100), a game made now uses the old rule and has no `empClean` flag in `/info` and `/summary`, and the constant is defined once in shipped code; backslash checks by behaviour (the letter s is kept, a space is refused) for `accountEmail`, `emailId`, `LIST_EMAIL_SHAPE`, `legacyNormEmp`, `empId` and the Worker's own address check.
  - To test the participant row alone I delete the person row after the join, because a normal join also lists the person.
- `apps/web/test/fix141-web.test.ts` (12 tests): the "The system will read this as" hint follows the kind of ID in `luck.js:45` and `zc.js:1511` (Email ID game: always read; employee-ID game: read, but an e-mail typed there gets the plain line and never a read-as text, under both the new and old rule); `idclean.js` backslashes; guide matching using the strings of REAL Worker answers (lock, need-ID, ticket on another phone for both kinds, "asked on its own", "looks like an Email ID", bad Email ID).
- `apps/edge/test/idclean-matrix.test.ts` (3 tests), the cleaning matrix: **1,957,127 distinct inputs**, asserted exactly.
  - Part 1: all 1,376,831 strings of 0 to 4 characters over 34 different characters. They are distinct by construction. The 34 characters: ASCII letters, digits, dash, space, tab, at, dot, underscore, slash; full-width A, 1, at and hyphen; sharp s; en dash, em dash, minus sign; Devanagari digit; compatibility letters (ℂ, ﬁ, Ⅷ); no-break and ideographic space; zero-width space, joiner and BOM; an emoji; É, İ, Kelvin sign, long s, a combining accent.
  - Part 2: 430,296 structured inputs (25 ID/e-mail bodies × 12 prefixes × 12 suffixes × a separator at every position), plus very long inputs up to 100,000 characters. Part 3: 150,000 seeded random. Parts 2 and 3 are deduplicated with a Set and anything Part 1 already holds is skipped.
  - Each input goes through `empId`, `emailId`, `accountEmail`, `looksLikeEmail`, `listEmail`, `legacyNormEmp`, `normEmpFor` (new and old) and the browser mirror's `empId`, `emailId`, `looksLikeEmail`, `legacy` and all three hints. 0 differences from the oracle.
  - The oracle uses no regex, no `.trim()` and no `.replace()`: it walks code points against a written-out white-space list (the JavaScript one). The only shared pieces are the platform's `normalize("NFKC")`, `toUpperCase` and `toLowerCase`, which the rules name. Coverage counts show every class occurred more than 1,000 times, and a hand-worked oracle test guards the oracle itself. Run time about 60 s.

## 4. Deliberate-break checks (`bash apps/edge/test/break-checks-1.4.1.sh [id]`)

Each row: the product is broken on purpose, the guarding tests must go red, the file is restored and the tests must be green. All 21 are red then green ("failing" = failing tests).

| Id | Break | red | green |
|---|---|---|---|
| B01 | accountEmail repairs spaces instead of refusing | 9 | 0 |
| B02 | accountEmail loses its backslash (`/s/`) | 9 | 0 |
| B03 | isTestLogin repairs inner spaces | 1 | 0 |
| B04 | Host add: spaced address + mobile goes through | 1 | 0 |
| B05 | emailId stops removing inner spaces | 3 | 0 |
| B06 | LIST_EMAIL_SHAPE loses its backslash | 2 | 0 |
| B07 | lock ignores LISTED people | 2 | 0 |
| B08 | lock ignores JOINED participants | 1 | 0 |
| B09 | lock code renamed | 2 | 0 |
| B10 | EMP_CLEAN_FROM_MS set to 1 | 2 | 0 |
| B11 | luck.js hint switches by "@" instead of idKind | 3 | 0 |
| B12 | zc.js hint switches by "@" instead of idKind | 2 | 0 |
| B13 | idclean.js empHint loses the email guard | 6 | 0 |
| B14 | guide lock entry reworded | 1 | 0 |
| B15 | guide "asked on its own" entry reworded | 1 | 0 |
| B16 | empId keeps underscore (matrix) | 1 | 0 |
| B17 | browser emailId stops lower-casing (matrix) | 1 | 0 |
| B18 | harness stops loading idclean.js | 4 | 0 |
| B19 | data map drops "e-mail" | 2 | 0 |
| B20 | real TODO in the pack file itself | 1 | 0 |
| B21 | real TODO in zc.js | 1 | 0 |

B19 first showed a problem (1 test still failing after restore): that was the postal-address pattern in (b). After the fix I re-ran B19 alone: red 2, green 0. The whole table was produced before the final edit to `pages.test.ts`/`fix141.test.ts` (typecheck and race fixes); those edits touch no tested rule.

## 5. Things that look like PRODUCT problems (not fixed here)

1. **`guide.js:209` is a dead entry.** Its match text is `Enter your ${W}.` with the placeholder still in it. The Worker sends "Enter your employee ID." / "Enter your Email ID.", so the entry can never match. People are still guided, by the older entries at `guide.js:35` ("Your employee ID is needed") and `:108` ("Your Email ID is needed"), so the new title "Please type your ID to go in" is never shown. The existing `guide.test.ts` passes only because it reads the Worker's source text, not its answers. Pinned as `test.failing` ("PRODUCT NOTE") in fix141-web.test.ts; when fixed, remove `.failing`.
2. **Zero-width and NEL characters are not treated as white space.** `accountEmail("bo​ss@acme.com")` returns `"bo​ss@acme.com"` (not `"boss@acme.com"`) and passes the address check. The same goes for a participant `emailId` and `listEmail`. Two people who type the same visible Email ID, one with an invisible character from a copy and paste, will not match, and the account hash differs. U+0085 behaves the same. This follows from using JavaScript `\s`, and the handoff says "inner space", so I did not assert it either way. The matrix pins today's behaviour, so changing it will show up there. Decision for the product owner.
3. Known and unchanged, from the handoff: the vendored pack text promising a 5-minute change window, refunds and pause (`pack/zc-flow.js:210, 278, 266, 269, 234, 267`). Not touched.

## 6. Limits of this work

- Account e-mail refusal is tested on start, sign-in, Host add, Host setup, partner enrol and partner sign-in. NOT tested by a request: Help Desk join and invite, invoice e-mail, payment and credit contact, Google sign-in (they share `accountEmail`, covered by the unit tests and the matrix, but not driven end to end).
- `packages/shared` has no tests.
- Nothing was run against a real browser or a deployed Worker; all page tests use happy-dom and the in-memory Worker.
