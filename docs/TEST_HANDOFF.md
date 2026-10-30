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
- Request fields at join, who and people are unchanged from Task 2: an Email ID game reads `email` (people also `emailId`), every other game reads `empId`.

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
