# Test handoff: one e-mail form everywhere (Task 1) and the Email ID list criterion (Task 2)

Nothing here has been run. No test file was created or edited by the coder. Nothing is committed.

## Task 1: one e-mail form

`emailId` (apps/edge/src/idclean.ts) = NFKC, trim, remove inner whitespace, lower case. Every other e-mail normalisation now calls it.

Changed call sites (hash strings unchanged, e.g. `sha("email|" + ...)`, `sha("pemail|" + ...)`, HMAC `"email|"`):
- pay.ts: `eh` hash, organizer mail, invoice recipients (`emailId(t0)`), owner set, admin `to`.
- credit.ts: recipient dedupe and `email` for the credit mail.
- partners.ts: partner e-mail on create and `validEmail`.
- helpdesk.ts: `validEmail`.
- visits.ts: the HMAC e-mail hash (`hmacHex(s, "email|" + emailId(email))`).
- worker.ts: line ~332 (`email|` hash of a team e-mail), createOrganizer hash (`emailId(email)`), Google sign-in (`emailId(g.email)`), line ~1403 `emailId(JSON.parse(c.v).email)`.
- admin.ts, hostsetup.ts, google.ts, mode.ts, testlogins.ts already used `emailId`.

Behaviours to test (new file apps/edge/test/email-hash.test.ts):
1. For ordinary ASCII mail `Rajat1@demo.com`, `RAJAT1@DEMO.COM`, `RaJat1@Demo.Com`: `sha("email|" + emailId(x))` is identical for all three AND equals `sha("email|" + x.trim().toLowerCase())` (the old expression). Same for the `pemail|` prefix and the HMAC form in visits.ts if reachable.
2. Padded `"  rajat1@demo.com "` hashes the same as the plain one (old rule also trimmed).
3. A full-width form (`ｒａｊａｔ１＠ｄｅｍｏ．ｃｏｍ`) now hashes like the ASCII one (new, deliberate).
4. Existing suites to re-run: verify, people, host-setup, roles, pay, credit, partners, helpdesk, idclean, owner-mail, whoami-email, google-signin.

## Task 2: Email ID list criterion

Design: the organizer picks ONE criterion. New stored value `verify: "email"` (packages/beacon/src/config.ts: `VERIFY_MODES` now has "email"). `verifyOf` (people.ts) maps it to `{ mode: "id", kind: "email" }`; every other game has `kind: "emp"` and runs the old code. The list identifier is kept in the same sealed field `pii.empId` (internal name; it holds the cleaned e-mail). New helpers in people.ts: `emailListHashOf` (hash prefix `emaillist`, so an e-mail can never collide with an employee ID hash), `idHashOf(env, vf, id)`, `listIdFor(vf, raw, createdMs)`, `badIdWhy`, `idWord`. New in idclean.ts: `listEmail` (emailId plus shape check, up to 254), `LIST_EMAIL_SHAPE`, `BAD_EMAIL`.
Request fields: for an Email ID game the join / who / people calls read `email` (people also accept `emailId`); `empId` is ignored. For every other game `empId` is read as before.

Cases to test (new files in apps/edge/test; use the setup pattern of idclean.test.ts / verify.test.ts, config `verify: "email"` on create):
1. Add-person (POST /api/z/:id/people) with `{name, email: "Rajat1@Demo.com"}`; then join (POST /api/z/:id/join) with the K4 consent and a device, body `{name, email: X}` for each X in: `rajat1@demo.com`, `RAJAT1@DEMO.COM`, `RaJat1@Demo.Com`, `  rajat1@demo.com  `, `rajat1 @demo.com`, `rajat1@ demo.com`, full-width `ｒａｊａｔ１＠ｄｅｍｏ．ｃｏｍ`. Expected: each reaches the listed person (200, a pid), status becomes joined; a second device with the same e-mail gets 423 `id-used`.
2. Wrong e-mail (`someone.else@demo.com`) on a list-only game: not admitted, goes to the waiting room (403 `waiting`); an invented non-address (`rajat1`) is refused 400 `bad-id` with the BAD_EMAIL text. Many wrong tries give 429 `too-many-tries` with the Email ID wording.
3. `/api/z/:id/join` with `{name}` only on an Email ID game: 400 `need-id`, "Enter your Email ID." (when employeesOnly or mode id).
4. `/api/z/:id/who`: with the right e-mail and K4 consent returns `{known:true, name:"Rajat S."}`-style; wrong one `{known:false}`.
5. List with duplicates: rows `Rajat1@demo.com` and `rajat1@DEMO.com` -> the second is in `invalid` with "reads as rajat1@demo.com, the same as another row", never silently dropped; two identical rows `rajat1@demo.com` twice -> counted in `duplicates`. A row with a bad address -> `invalid` with the BAD_EMAIL text. CSV, paste and PDF rows in the console go through `cleanBatch` in zc.js (header `Email ID` / `Email` is recognised as the ID column), the same outcomes.
6. Old game unchanged: games without the criterion (and `verify: "id"` games, both pre- and post-EMP_CLEAN_FROM_MS) behave exactly as before: employee IDs cleaned by `normEmpFor`, hash `empHashOf`, field `empId`. An `email` field sent to such a game is ignored.
7. Criterion "email" never uses the employee cleaner: `1B-678`-style cleaning is never applied; `a.b_c-d@x.co` keeps its dots, underscore, dash and `@`. An `empId` field sent to an Email ID game is ignored (does not match the listed person). The stored hash differs from `empHashOf` of the same text.
8. Exports: the people CSV of an Email ID game has the column "Email ID" with the cleaned address; other games keep "Employee ID".
9. Config: `validateCfg({verify:"email"})` is ok and stored as `verify:"email"`; `GET /api/z/:id` info shows `verify:"email"`; gamerecord shows `verify:"email"`. An unknown value is refused with the updated sentence.
10. guide.test (apps/web/test): the new messages must each have a guide entry: "Enter your Email ID.", "That Email ID does not look like an email address...", "This Email ID already has a ticket on another phone...", "Too many tries with an Email ID that is not on the list..." (added to apps/web/public/guide.js).
11. Page (luck.js): with `INFO.verify === "email"` the join form shows the label "Your Email ID", an `input type=email`, and the hint "The system will read this as rajat1@demo.com" under the box for input `Rajat1@Demo.com`; Join sends `email`, not `empId`. Console (zc.js): the "What must a person give?" group has "Email ID only"; creating sends `verify:"email"`.

## Files touched
apps/edge/src/: idclean.ts, people.ts, worker.ts, pay.ts, credit.ts, partners.ts, helpdesk.ts, visits.ts, gamerecord.ts. packages/beacon/src/config.ts. apps/web/public/: zc.js, luck.js, guide.js. docs/TEST_HANDOFF.md.

## Not done / decisions to confirm
- The criterion is not gated by EMP_CLEAN_FROM_MS: it exists only when the organizer picks it, so no old game has it.
- "Mobile number or Email ID" and "Email ID and mobile number" are not offered (one criterion only, as decided).
- The stored field is still named `pii.empId` for the e-mail (reuse of the plumbing).
- tsc was not run; the Pages build copies of the web files were not rebuilt.
- pages.test / console texts that match the old "What must a person give?" group may need the new option.

## How to start the app locally
`bun run dev` (runs apps/edge/src/local.ts).

## One deliberate break per rule (to prove the test catches it)
- One e-mail form: change `emailId` in pay.ts `sha("email|" + emailId(p.email))` back to `p.email` and test 1 (UPPERCASE case) must fail.
- Hash unchanged for ASCII: add a salt or change the `"email|"` prefix in `emailId`-hashing and the equality with the old expression must fail.
- Email cleaner only: in `listIdFor` call `normEmpFor` for kind "email" and the dot/at-sign and full-width cases must fail.
- Case/whitespace: drop `.toLowerCase()` or the whitespace removal in `emailId` and the join variants must fail.
- Wrong e-mail refused: make `idHashOf` return the `empHashOf` hash for kind "email" and the hash-differs test must fail.
- Duplicate by case flagged: remove the `vf.kind === "email" ||` part in `flagCleanDup` and the case-duplicate row is silently counted, so the flagged-invalid test must fail.
- Old game unchanged: make `verifyOf` return kind "email" for `verify: "id"` and the old employee-ID tests must fail.
- No empId on an Email ID game: read `b?.empId` in the join for kind "email" and test 7 must fail.

## M3 additions (idKind)

Nothing here has been run; no test file was created or edited by the coder. This section SUPERSEDES the "verify: email" parts of Task 2 above (cases 9 and 11, and the stored value): the console now reads and writes ONE field, `idKind`, the same name and values as Corporate Bingo (commit 8d1609a).

### How idKind and verify are linked
- `idKind` = `"emp"` (default) or `"email"`. It is the source of truth the console reads and writes (PATCH, /info, organizer summary).
- Stored config: `idKind:"email"` is stored only when `verify` is `"id"` ("Email ID only"); `"emp"` is never stored (absent = emp). `validateCfg` (packages/beacon/src/config.ts) is the ONE place that keeps the two in step. `verifyOf` (people.ts) derives `{mode:"id", kind:"email"}` from it with the same rule.
- Offer only "Email ID only": email with `verify` `either`, `both` or `mobile` sent in the same call is refused 400 "An Email ID is asked on its own: choose Email ID only, not a mobile number with it."
- Old spelling `verify:"email"` (built in 028efee, may exist in stored configs or old requests) is still READ and means `verify:"id"` + `idKind:"email"`; it is never written again. `"email"` is no longer in `VERIFY_MODES`.
- Request field (changed after M3b, decision): join, who and people ALWAYS read the ID value from `empId` in every game; `idKind` says what it is. `email` (people also `emailId`) is accepted only as an ALIAS for old callers, read when `empId` (and `employeeId`) is absent; it is never written or sent. luck.js now sends `empId` for an Email ID game too.

### Behaviours to test (expected result)
1. Default: a new game, an old game and a game whose stored config has no idKind: `GET /api/z/:id` (info) has `idKind:"emp"`, the organizer summary has `idKind:"emp"`; stored `config` JSON has no `idKind` key.
2. PATCH `/api/z/:id/settings {verify:"id", idKind:"email"}` -> 200; then info and summary read back `idKind:"email"`, `verify:"id"`; stored config has `idKind:"email"`, `verify:"id"` (not `"email"`).
3. PATCH `{idKind:"email"}` alone on a mobile game -> 200, reads back `idKind:"email"` and `verify:"id"` (choosing the Email ID turns the ID question on). PATCH `{idKind:"emp"}` afterwards -> `idKind:"emp"`, `verify` stays `"id"`.
4. PATCH `{verify:"both", idKind:"email"}`, `{verify:"mobile", idKind:"email"}`, `{verify:"either", idKind:"email"}` -> 400 with the sentence above. PATCH `{idKind:"x"}` -> 400 "What the ID is: an employee ID or an Email ID." PATCH `{idKind:"email"}` on a stored `verify:"both"` game -> 400.
5. PATCH `{verify:"both"}` (no idKind) on an Email ID game -> `idKind` back to `"emp"` (the Email ID is dropped when "Email ID only" is left). Same for `{verify:"mobile"}`.
6. Create (POST create) with `{verify:"id", idKind:"email"}` stores and reads back the same; create with `verify:"email"` (old spelling) reads back `verify:"id"`, `idKind:"email"`.
7. Join and list upload clean per kind: Email ID game: `RAJAT1@DEMO.COM`, `  RaJat1@Demo.Com `, full-width `rajat1＠demo.com` all match the list entry `rajat1@demo.com` (cleaner `emailId`, kept in sealed `pii.empId`, hash `emaillist|`); employee-ID game: `1b-678`, `1B/678`, `1B 678` clean to `1B678` as before (A-Z0-9 cleaner). An email list row in an employee game is never cleaned to letters.
8. Typed email in an employee-ID game (`rajat1@demo.com` or full-width `＠`, in `empId` at join, who, and in a list row): join refused 400 `bad-id` with "This looks like an Email ID, but this game asks for an employee ID. Type it again in the Employee ID box using the letters and numbers on your ID card."; list row goes to `invalid` with the same text; nothing is stored. Applies to games before and after EMP_CLEAN_FROM_MS. A normal ID without "@" is unaffected.
9. Half address in an Email ID game (`rajat1@`, `rajat1`, `@demo.com`, `rajat1@demo`): join refused 400 `bad-id` with the BAD_EMAIL text ("That Email ID does not look like an email address..."); list row to `invalid` with the same text.
10. Console (zc.js step 2): when "People give their employee ID to get in" is ticked a "Which ID?" group shows "Employee ID" (default) and "Email ID". Choosing Email ID hides the "What must a person give?" group (only Email ID only exists) and Save sends `{verify:"id", idKind:"email"}`; Employee ID sends `{verify:"id"|"both", idKind:"emp"}`; chip unticked sends `{verify:"mobile", idKind:"emp"}`. Re-opening a saved Email ID game shows Email ID selected (read from summary/info `idKind`). Client list upload (`cleanBatch`) of an email in an employee game puts the row in the "wrong" list with the looks-like-an-Email-ID text; in an Email ID game the emailId cleaner and shape check apply.
11. Join page (luck.js): `INFO.idKind==="email"` and `verify==="id"`: label "Your Email ID", `input type=email`, hint "The system will read this as rajat1@demo.com" for `Rajat1@Demo.com`, Join sends `email`. Employee game: label "Your employee ID", hint reads the A-Z0-9 form; typing `a@b.co` shows "This looks like an Email ID. This game asks for an employee ID: letters and numbers only." and Join sends `empId` (server refuses, case 8).
12. guide.js: the new message "This looks like an Email ID, but this game asks for an employee ID" has a guide entry (field `#emp`, label "the Employee ID box"); guide.test must cover it like the Email ID entries.
13. Mail hashes (Task 1) unchanged by this work: ordinary ASCII mail `Rajat1@demo.com`, `RAJAT1@DEMO.COM`, `rajat1@demo.com` all give `sha("email|" + emailId(x))`, equal to the old `sha("email|" + x.trim().toLowerCase())`.
14. Unaffected: mobile-only, `either` and `both` games (no idKind in info beyond `"emp"`, same join and upload behaviour); `gamerecord` verify is only `mobile|id|either|both`.

### Files touched (this change)
packages/beacon/src/config.ts (EngagementCfg.idKind, VerifyMode without "email", validateCfg); apps/edge/src/: worker.ts (cfgOf, cfgJson, pub, summary, create and PATCH pass idKind, join/who read, endpoint docs text), people.ts (verifyOf, listIdFor, badIdWhy), idclean.ts (looksLikeEmail, EMP_LOOKS_LIKE_EMAIL), lifecycle.ts (cfgOfRow), gamerecord.ts; apps/web/public/: zc.js (Which ID? group, save, cleanBatch), luck.js (join label/key by idKind), guide.js, idclean.js (looksLikeEmail mirror, empHint); docs/TEST_HANDOFF.md.

### One deliberate break per rule
- idKind default emp: make `pub` return `idKind:"email"` when absent; cases 1 fails.
- PATCH sets kind: drop `idKind: b.idKind` from the PATCH `validateCfg` call; case 2 fails.
- Email implies ID mode: remove `cfg.verify = "id"` in the email branch of validateCfg; case 3 fails.
- Email ID only offered: remove the two "asked on its own" checks; case 4 fails.
- Dropped when leaving: remove the `delete cfg.idKind` after the verify check; case 5 fails.
- Old spelling: drop `legacyEmail`; case 6 (old spelling) fails.
- Per-kind cleaning: make `listIdFor` use `normEmpFor` for email, or `listEmail` for emp; case 7 fails.
- Email in emp game refused: remove the `looksLikeEmail(raw) ? null :` in `listIdFor`; case 8 fails (for games after EMP_CLEAN_FROM_MS the email becomes letters).
- Half address: loosen `LIST_EMAIL_SHAPE`; case 9 fails.
- Console: send `idKind` always `"emp"` from zc.js save; case 10 fails. Join page: read `INFO.verify==="email"` again; case 11 fails.
- Guide: delete the new guide.js entry; case 12 fails.
- Hash: change `emailId` to not lower-case; case 13 fails.

## Bundles to rebuild (the coder did not run any build)
- `bun run build:zgame` : packages/beacon/src/config.ts is imported by phone-runtime and zgame-browser (apps/web/public/zgame.js).
- `bun run build:control` : only if control-browser.ts pulls in config.ts (it was not edited); rebuild to be safe.
- `bun run pages:build` : apps/web/public (zc.js, luck.js, guide.js, idclean.js, zgame.js) is copied into pages/public.

## M3 addition: empId is the one request field (Part A)
Not run. Join (`POST /api/z/:id/join`), verify (`/who`) and people upload read `empId ?? employeeId ?? email ?? emailId` in that order for BOTH kinds; the cleaner chosen by `idKind` is unchanged. Test: Email ID game, join with `{empId:"Rajat1@Demo.com"}` -> admitted, same stored person as before; join with only `{email:"rajat1@demo.com"}` (old caller) -> same result; both given -> `empId` wins; employee game with `{empId:"rajat1@demo.com"}` -> 400 bad-id as in case 8; luck.js Email ID game: the join request body has `empId` and no `email` key. Files: apps/edge/src/worker.ts (join, who), apps/edge/src/people.ts, apps/web/public/luck.js.
Break: make join read `b?.email` only for kind email; the empId-only Email ID join fails.

## Slice 1 dashboard (Game dashboard shell, B9 B10 B11 minimal)
Nothing here was run or built by the coder; no test file was created or edited.

### What was done (it is the shared pack, not new Luck code)
The console repo pack (branch master-console-complete-882589, head 66f2ff8) is vendored byte for byte into apps/web/public/pack/ with the hash list apps/web/public/pack/MANIFEST.json (done with `node tools/vendor-pack.mjs --game <this worktree>`; `--check` printed "in step"). Files: confirm.js, employee-id.js, gamelog.html, gamelog.js, pack.css, polish.js, runbar.js, zc-flow.css, zc-flow.js. Do not edit them here.
Luck's own small files: apps/web/public/zc-flow-game.js (descriptor for the five steps and the Game dashboard: one entry per player, idKind:true so the pack's "Which ID?" reads and writes the setting idKind emp|email; board, claims, hand-over, rehearsal, lucky, control, feed, presence all off), apps/web/public/live-luck.js (descriptor for the live control bar: Start and End only; story "Round N of 10"; joined count; Big screen link; Start goes to the game page /host.html because rounds and prizes are chosen there; End posts the existing /luck/end), apps/web/public/zc-mode.js (which screens open, see below).
Other files touched: zc.html (loads the pack css, zc-mode.js, descriptors, pack scripts), zc.js (first line after ZG: returns when `?flow=new`), zc.css (.zcmodetop), pages/build.mjs (FILES + pack folder), apps/web/public/zsw.js (FILES, cache name luck-game-v8).

### How to start
`bun run dev`, open `/zc.html?e=<game id>` (signed in). The previous console opens as before. `/zc.html?flow=new` opens the new screens. The link above the page ("Try the new screens" / "Use the previous screens") swaps `flow=new` and `flow=old` and keeps every other part of the address. Nothing is stored on the device; `DEFAULT_NEW = false` in zc-mode.js (one change makes the new screens the default; page tests that open the console would then need updating).

### Behaviours to test (expected result)
1. `/zc.html?e=ID` with no flow: previous console, identical to before; link "Try the new screens" shown above it.
2. `?flow=new`: zc.js draws nothing; the pack draws five steps and the Game dashboard; the link reads "Use the previous screens"; pressing it gives `flow=old` and the previous console.
3. Links `do=`, `k=`, `demo=`, `pass=`, `quick=`, `new=`, `cap=`, `api=` without flow: previous console, no mode link. A game whose start time is within 15 minutes before to 4 hours after now: previous console unless `flow=new` is explicit.
4. After a game exists, new screens: Game ID bar (Copy), status pill, banner, share card with the player link, in the pack's words: Draft; Published, payment pending; Published and paid; Payment pending, start time passed (red); Live now; Completed; Cancelled; Data deleted.
5. Step 2 "Which ID?": Employee ID default; choosing Email ID saves `{idKind:"email"}` (PATCH settings); re-opening shows Email ID selected; /info shows the same.
6. Hidden, never disabled: no ticket count, sample ticket, number board, claims table, rehearsal, lucky draw, pause, resume or add-time button anywhere in the new screens. The page text has no "coming soon".
7. Previous console still has all ten steps and every previous button (Open the game page, Start on host.html, End).
8. Player-facing text never says "private" (the words are "close group").
9. Build: `bun run pages:build` ships /pack/*, zc-mode.js, zc-flow-game.js, live-luck.js; every name in FILES exists; MANIFEST.json shipped; source files hash as in MANIFEST.json (before minifying).
10. CSP: no inline script or style on zc.html (the mode link is made by zc-mode.js).

### Known gaps, test them as OPEN, not as bugs
- The pack decides "Live now" from the start time. Luck starts only when the Host presses Start, so between the start time and Start the pill says Live now (wrong for Luck), and the start time is not shown in red for "not started yet". Needs a Luck status adapter (read /luck/view state open, running, done) in a Luck-side file, because the pack must not be edited here.
- Start and End on the new dashboard: live-luck.js is ready but nothing in the vendored pack mounts the control bar (this pack version has no mount point). Until then Start and End are on the game page (host.html) and in step 9 of the previous console.
- Prize step: the pack lists prizes from window.ZG.PRIZE_HOUSES (Housie names). Luck prizes are gift text for places 1 to 5; the new step 3 is not adapted. Do not test prize saving in the new screens yet.
- The pack banner for a paid game says it can be postponed or changed up to 5 minutes before it begins. Not verified for Luck.
- Slices 2 and 3 (five-step skeleton for Luck, payment inside the dashboard) are not done. No setting remembers the chosen screens per browser (needs a storage-list line and a Privacy sentence first).

### Break ideas
- Change one byte of apps/web/public/pack/zc-flow.js: the console repo drift check (`node tools/vendor-pack.mjs --game <this worktree> --check`) must say DRIFT.
- Remove the early return in zc.js: with `?flow=new` both screens draw.
- Set `idKind:false` in zc-flow-game.js: "Which ID?" disappears.
- Open `?flow=new` while signed out: the pack must show a sign-in message, not a blank page.

## Cloud run 4

For the test author. These are test-side changes; the product side is already changed.

1. apps/edge/test/data-map.test.ts line 61 expects "no e-mail field on the player page". That is no longer true: when the organizer picks "Email ID" as the ID of the game, luck.js draws an e-mail box. Change the line to: an e-mail field exists on the player page only if the data map lists "e-mail" (`expect(/type="email"|id="email"|name="email"/.test(code)).toBe(always.includes("e-mail") || sometimes.includes("e-mail"))`). Why: the data map (docs/PRIVACY_AND_LIFECYCLE.md, block `asked_if_organizer_switches_on: mobile number, e-mail`) and the join notice (consent-text.json K4, "mobile number, employee ID or e-mail address, if this game asks for them") now say so truthfully. Note the player box for the Email ID is `id="emp"` with `type="email"`.
2. apps/web/test/harness.ts must load apps/web/public/idclean.js before zc.js, in the same order as zc.html (idclean.js, zgame.js, control.js, termsbox.js, zc.js). Without it zc.js stops with "IDCLEAN is not defined", which causes the four My people timeouts in pages.test.ts (My people with employee IDs, paste cleans the list, big paste, From my contacts). z.html already loads idclean.js before luck.js.
3. Known on the base commit 752ff60 too (not caused by Luck by Chance work): the two pages.test.ts tests "Create a new game like this one" and "Rescheduling: a date more than 30 days ahead", and the unhandled "timed out waiting; page says: " (pages.test.ts:725, empty page). Treat as known.
4. Status words in docs: OPEN is the status word, so legal-sync.test.ts and no-internal-notes.test.ts can pass. Do not use the words in their PATTERN in new docs.

## Fix 1.4.1

For the test author. Nothing here has been run by the coder. Product changes first, then test-side changes.

### Product rules and where they are (file:line)
- R1 Account e-mails refuse a space inside (they are not repaired). `accountEmail` (NFKC, trim, lower case, "" if any whitespace is left) is at apps/edge/src/idclean.ts:17. It is used for organizer sign-in and start, Host and Co-host, invites, partner, help desk, payment and credit contact, Google sign-in, test logins and every e-mail hash (admin.ts, credit.ts, google.ts, helpdesk.ts, hostsetup.ts, mode.ts, partners.ts, pay.ts, testlogins.ts, visits.ts, worker.ts). Only a PARTICIPANT's Email ID (`emailId`, idclean.ts:14, used by `listEmail` for the Email ID list criterion and join) removes inner spaces. Hash values for ordinary ASCII mail are unchanged (same NFKC, trim, lower case). `isTestLogin("demo 1＠xyz.in")` is false (testlogins.ts:8). A Host added with a spaced address and a mobile number is refused, not added by mobile alone (worker.ts:1093).
- R2 An e-mail typed in an employee-ID game gets the plain refusal "This looks like an Email ID ..." and no "The system will read this as ..." line: server people.ts:62-64 (every employee-ID game, old or new), browser idclean.js `empHint` (plain line, no read-as text), luck.js:45 and zc.js:1511 choose the hint from idKind and from the old/new rule (`empClean`). The read-as line is shown only where the server cleans (Email ID game, new employee-ID rule, old rule for old games).
- R3 Changing the kind of ID or the way in (`verify`, `idKind`) is refused once anyone is listed or has joined: 409 "You already have people listed. Start a new game to use a different kind of ID." with `code:"id-kind-locked"` at apps/edge/src/worker.ts:2010 (settings PATCH or POST). A request that leaves both unchanged still works. Guide entry: apps/web/public/guide.js:114-115. The vendored console shows the server's message as it is under "Save and continue" (pack/zc-flow.js:487, not edited).
- R4 `EMP_CLEAN_FROM_MS = 4102444800000` (1 Jan 2100) at apps/edge/src/idclean.ts:6 is a far-future placeholder. Until the release session sets the deploy instant, every game uses the old employee-ID rule, so tests of the new rule must pass a `from` argument or create the game with `created_ms` after a value the test sets. `APPROVAL_RULES_FROM_MS` does not exist in Luck and was not invented.
- R5 See "Screens that promise more than Luck does" below.

### Test-side items (the coder did not touch tests)
1. "IDCLEAN is not defined" (pages.test.ts My people tests, four timeouts): apps/web/test/harness.ts does not load apps/web/public/idclean.js. Load it before zc.js, in the order of zc.html.
2. apps/edge/test/data-map.test.ts line 61 must change: an e-mail field on the player page exists only when the organizer chose Email ID, and the data map now lists it (docs/PRIVACY_AND_LIFECYCLE.md block `asked_if_organizer_switches_on: mobile number, e-mail`; consent-text.json K4 and terms.html now say "mobile number, employee ID or e-mail address"). Expect `type="email"` on the player page exactly when the data map lists "e-mail".
3. guide.test.ts: the three missing messages (worker.ts "Enter your ${W}." twice, "This ${W} already has a ticket on another phone") now have entries in apps/web/public/guide.js:209-210. New guide entries also cover the id-kind lock and "An Email ID is asked on its own".
4. legal-sync.test.ts: the three docs files are reworded (status words are now OPEN, and the phrases about who ordered what are plain). Run it again.
5. no-internal-notes.test.ts: still fails on VENDORED files only: apps/web/public/pack/zc-flow.css (the class name of the not-ready card, last word of `.zf-ready`) and pack/zc-flow.js (the same class name in the code), and their built copies in pages/public/pack/. They must not be edited here. Either exclude `pack/` in the test or have the pack owner rename the class.
6. Known on the base commit too, not caused by this work: "Create a new game like this one" and "Rescheduling: a date more than 30 days ahead" in pages.test.ts, and the unhandled timeout at pages.test.ts:725.
7. New behaviour to test: account e-mail with a space inside is refused on sign-in/start ("Please enter a valid e-mail address."), Host add (400 "That e-mail address does not look right."), partner and help desk forms; the hash of "A@B.com" and " a@b.com " is the same as before.

### Screens that promise more than Luck does (vendored pack, cannot be edited here)
- pack/zc-flow.js:210 and :278: "It will begin at <time>. You can postpone or change it up to 5 minutes before the game begins." Luck begins when the Host presses Start, not at the clock time, and the code lets the organizer change the game until the start time (not 5 minutes before). No descriptor flag hides this line. Needs a pack change or a Luck copy override in the pack.
- pack/zc-flow.js:269 "cancelled and a refund was requested" and :266 "paused": Luck has no refunds (credit) and no pause. They show only if a Luck fact sets them; Luck sets neither.
- pack/zc-flow.js:234 and :267 report text ("download within 24 hours", "report was also sent to your email"): true only if the Luck report is sent as described; not changed.
