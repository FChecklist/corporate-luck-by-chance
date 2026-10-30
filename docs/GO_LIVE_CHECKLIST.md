# GO-LIVE CHECKLIST: Corporate Luck by Chance (copy of master 400, 30 Oct 2026; repo head 028efee)

Nothing goes live until EVERY row is ticked WITH EVIDENCE (test name, commit, screenshot path, deployment id). A row may be marked N/A only with a written reason from Luck's own rules. A coder's own "tests pass" never counts: the boss ticks a row only when tester evidence exists.

ALL ROWS START UNTICKED. Status values: UNTICKED, then TICKED by the boss. The Evidence column is filled later by the boss. The N/A column is blank unless a row is truly (or in part) not applicable; partial notes say which parts apply and which stay open.

Companion: docs/PARITY_MAP.md (feature-by-feature status against Corporate Tambola).

## Known facts at 028efee

Facts only; none of these ticks a row. All are "built, test evidence: pending tester" unless a baseline is quoted.

| Item | Commit | Notes |
|---|---|---|
| Luck by Chance 1.3.0 merge (Tambola 1.3.3 hardening merged onto the first port); not tested at the time | ed740fb | Base of everything below |
| Fixes after cloud run 1: GENESIS, stored-key signing, lazy tick, need-id, K6 recorded once, erase tests after game end, Math.random and inline styles out of luck.js, build.mjs z.js, test header types | fe2aa77 | Cloud-run-1 fixes |
| Uniform Employee ID and Email ID cleaners on every path (idclean.ts and idclean.js), EMP_CLEAN_FROM_MS for old games, hints, bad-id refusal, flagged duplicates after cleaning, tests | f2a5862 | Rows A1, A2, A4, A5, A6 |
| One e-mail form everywhere (payment, credit, partner, helpdesk, visits hashes) and the Email ID list criterion; docs/TEST_HANDOFF.md for the test author | 028efee | Rows A3, A7. The tests listed in docs/TEST_HANDOFF.md are for the test author and are not yet written |
| Also present: game_record, payment lease, 20 h erase clock, device proof, 2,000,000 write budget, free 10-person game, draft-limit fix, join retry, demo-link redeem, connection-lost bar, Sign out in zc.js | between 961189f and fe2aa77 (see git log) | Exact commit per item not re-verified for this file |

Cloud run 2 baseline (reported by the boss; taken before 028efee, so the two newest commits may not be covered):

| Suite | Result |
|---|---|
| Typecheck | 0 errors |
| Beacon package | 100 pass / 0 fail |
| Edge | 1137 pass / 0 fail |
| Web | 264 pass / 2 fail (the 2 failures were already failing before this work; named by the tester, not here) |

Not yet built (see parity map): five-step console flow and Game dashboard, Host/Co-host passcode flow, Family Passes, approvals by role, rehearsals, game log 365 days, thank-you and Game completed pages, previous-screens link, new look, claims/results screens per round, and Luck's own pause / resume / add time / late-press refusal (engine track EN2).

## Checklist

### A. Identity and lists

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| A1 | Employee ID cleaner: NFKC, uppercase, keep only A-Z 0-9 (1B-678, 1b-678, 1B/678, 1B 678 -> 1B678); 30-char cap after cleaning; empty refused with plain words. | UNTICKED | | |
| A2 | Used on EVERY path: participant join/verify, organizer type, paste, upload, add-person, hash, duplicate check, invites, family, Host/Co-host, list viewer, exports, reports, console pass-through. | UNTICKED | | Not N/A. Family, list viewer and console pass-through do not exist in Luck yet (parity map C6, A9, I6); those parts stay open until built. |
| A3 | Email cleaner: NFKC, trim, remove inner spaces, lowercase (RAJAT1@DEMO.COM = Rajat1@Demo.com); never applies the ID cleaner to an email; typed email in an ID-criterion game is refused plainly. | UNTICKED | | |
| A4 | Duplicates that appear only after cleaning are flagged in the list check ("same person after cleaning"), never silently dropped. | UNTICKED | | |
| A5 | Hint text on screen: "The system will read this as ...". | UNTICKED | | |
| A6 | Games created before the deploy instant keep old behaviour (EMP_CLEAN_FROM_MS / APPROVAL_RULES_FROM_MS set to the exact deploy instant). Luck: EMP_CLEAN_FROM_MS now; APPROVAL_RULES_FROM_MS only when approvals by role exist. | UNTICKED | | |
| A7 | Criterion choice: Employee ID or Email ID (one criterion), list decides; Email ID criterion exists in every game. | UNTICKED | | |
| A8 | Test addresses only demoN@demo-test.invalid; fake mobiles; tags TEST-RUN. | UNTICKED | | |

### B. Organizer (5 steps + dashboard)

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| B1 | Step 1 date/time, occasion, time zone with players' local times, how the game starts, who calls the numbers. Luck: who runs the game (no numbers are called). | UNTICKED | | Only "who calls the numbers" is N/A (no number caller in Luck); the rest applies. |
| B2 | Step 2 who is it for (people / families / extended), validation (system / by hand), criterion, list upload/paste/viewer for 600+ rows, optional list check. | UNTICKED | | |
| B3 | Step 3 tickets 1/2, size drop-down with price, prizes (tags, 1-5 wins, gift, worth up to), Full House 1st-5th, Super Bumper 1-10, Lucky Draw 1-3, A/B per ticket (where the game has it). Luck: places 1-5 overall and per round, gift text, 10 rounds, press window 10 s, the wheel. | UNTICKED | | Tickets, Full House, Super Bumper, Lucky Draw and A/B do not exist in Luck (parity map B4, B6, F10). Price, prizes and gifts apply and must be ticked. |
| B4 | Step 4 Brand and Breaks (logo, up to 3/5 breaks, public link). Luck: logo, brand moments and public link; breaks are fixed by the engine (20 s standings break). | UNTICKED | | Organizer-chosen breaks N/A (engine fixes the standings break). |
| B5 | Step 5 check and publish with warning and read-back, Host/Co-host emails, payment, rehearsals at the end. | UNTICKED | | |
| B6 | Game dashboard: Game ID always, 11 status pills with plain banners, share card, ready check, payment (Pay now / copy link), rehearsals, waiting table, board, prizes, feed, start-time-passed in red. Luck: "board" is the standings. | UNTICKED | | |
| B7 | Previous-screens link both ways, remembered per browser; old-console-only links open the old console. | UNTICKED | | |
| B8 | Existing games opened in the new console behave (draft resumes, manual/host-called/live games keep old console). | UNTICKED | | |

### C. Roles

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| C1 | Host: sign-in screens, same game link, limit 5, can change like organizer. | UNTICKED | | |
| C2 | Co-host: sign-in, limit set by organizer/Host, invites, admits only own people, no payment. | UNTICKED | | |
| C3 | Family Passes: 1+4, host card (5 passes), member needs no ID/passcode, approval, 15-minute cutoff, plays on the device clicked from. | UNTICKED | | Open owner question: note 300 s34 lists family approvals as Tambola only. Until the owner confirms N/A for Luck, this row stays a OPEN and is not N/A. |
| C4 | Every role screen says who approves whom; role chips; "you were made Co-host by ...". | UNTICKED | | |
| C5 | Authorization: nobody approves themselves; approver cannot act on another game; negative tests. | UNTICKED | | |

### D. Join and approvals

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| D1 | Listed ID / email: no extra info (name optional). | UNTICKED | | |
| D2 | Open join: Name, Mobile, Email, automatic referral ID, cap, duplicate returns same ticket. Luck: Name only unless the organizer asks for ID / mobile / Email ID; referral ID; cap; duplicate returns the same seat. | UNTICKED | | Mobile and Email are asked only when the organizer chooses them (RULES_luckbychance.md). |
| D3 | Not on list: approval by Host/Organizer (own link) or Co-host/Host/Organizer (Co-host link); first decision wins; 30-minute wait limit; polite decline; re-ask works. | UNTICKED | | |
| D4 | Consent (version safe, nobody locked out mid-game, stale page gets "reload"), check-in, rehearsal join. | UNTICKED | | |

### E. Before the game (participant)

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| E1 | Landing ("You are invited ..."), not-listed, waiting, ticket before start (Luck: lobby), family waiting/approved, rehearsal, reconnect/back online, "Check-in opens ..." text. | UNTICKED | | Ticket before start is N/A (no ticket; the lobby replaces it). Family rows depend on C3. |

### F. During the game

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| F1 | Timer cadence (auto 12 s; manual with 5 s lock), no repeats 1..90, same numbers on every phone, last numbers, "X of 90 called". Luck: press window 6/10/15 s (default 10) + 3 s reveal + 20 s standings break; same target and standings on every phone. | UNTICKED | | The 12 s caller, manual 5 s lock, repeats 1..90 and "X of 90" are N/A (no number caller). Cadence and same-on-every-phone apply. |
| F2 | Crossing numbers, cross mark, Ticket A/B switch (greyed other), Retro and Modern, phone/tablet/laptop. Luck: dice and target, Retro and Modern, phone/tablet/laptop. | UNTICKED | | Crossing numbers and Ticket A/B are N/A. Retro/Modern and devices apply. |
| F3 | Claims: gold CLAIM, bogey question, claim sent, checking, correct, wrong, late, prize taken, bystander banners, simultaneous claims, auto pause and resume, Full House 1st-5th, per-house results. Luck: per-round and overall results, places 1-5, claim rule per round (who receives a gift when a player may win several); late-press refusal and pause/resume after engine track EN2. | UNTICKED | | Luck has no claims in the Tambola sense (Fate mode, RULES_luckbychance.md). Gold CLAIM, bogey, checking, bystander and simultaneous-claim parts are N/A. Results, places, per-round rule apply. Pause/resume and late-press refusal wait for EN2 and are NOT N/A. |
| F4 | Super Bumper and Super Ticket (6 lines, X of 30 crossed), Lucky Draw, game ends when all prizes are claimed. Luck: game ends after the last round; the wheel. | UNTICKED | | Super Bumper, Super Ticket and Lucky Draw prize are Tambola only (note 300 s34). End-of-game and the wheel apply. |

### G. After the game

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| G1 | Thank-you (Share + WhatsApp, no rules), you won, Game completed (Game ID), 30-minute message, completed report email, copy, delete. | UNTICKED | | |

### H. Messages and language

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| H1 | Plain English, "the system" not "we", "close group" never "private", Corporate <Game> full names (Corporate Luck by Chance), 24 h promise wording, fairness wording true for Luck (public sealed draw and beacon), guide entry for every refusal, no raw error codes. | UNTICKED | | |

### I. Look and feel

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| I1 | Same look as approved mock (Retro burgundy+gold, Modern night navy+neon), minimal, one rich element (Luck: the dice), brand-kit header/footer, version + release date/time IST on every page, Rules row only inside the game. | UNTICKED | | |
| I2 | Side-by-side compare against the mock for every screen, gap report all SAME or justified. Luck needs its own mock screens first (the approved mock is Tambola's). | UNTICKED | | |

### J. Payment and data

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| J1 | Payee only IT Services by Rajat Agarwal via Razorpay; TEST games take no live payment; pay later link works 7 days. | UNTICKED | | |
| J2 | Personal data gone within 24 h (incl. email key, rate-limit keys), game log 365 days (seat numbers instead of ticket numbers, organizer, winners, Host, Co-host), consent text/version consistent in every page, privacy/terms/DPA/trust pages truthful. | UNTICKED | | Ticket numbers N/A (Luck has seats). |

### K. Tests (every release)

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| K1 | Unit, logic, wire, smoke tests. | UNTICKED | | |
| K2 | Regression of all earlier features. | UNTICKED | | |
| K3 | Streamed scenario matrix >= 1,000,000 REAL distinct scenarios. | UNTICKED | | |
| K4 | One deliberate break per new rule (red then green), on a scratch copy. | UNTICKED | | |
| K5 | Full suites per folder on the CLOUD (results branch read). | UNTICKED | | |
| K6 | Typecheck 0 errors. | UNTICKED | | |
| K7 | One-Chrome browser check 360/768/1280 light+dark. | UNTICKED | | |
| K8 | Skeptic audit with no open confirmed problem. | UNTICKED | | |
| K9 | Live-game gate = 0 and no campaign window. | UNTICKED | | |
| K10 | Deploy with rollback id noted. | UNTICKED | | |
| K11 | Live smoke on the real site. | UNTICKED | | |
| K12 | version.json = commit. | UNTICKED | | |
| K13 | Register 150 + checklist updated. | UNTICKED | | |

### L. Master console

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| L1 | Same look as games; games bar with full names; each game row Game ID, status pill, banner, role line; features per game from config/games.json (never shown if undeclared). | UNTICKED | | Console product row, tracked in the console's own checklist. Luck side: declare Luck's features in config/games.json when the console slice starts. |
| L2 | Sign-in: code valid 30 min, stays signed in until Sign out (5-year sliding limit), case-insensitive email, ID cleaning on pass-through; real release stamp/commit, not "dev". | UNTICKED | | Console product row. Luck side: ID and Email ID cleaning on pass-through (see A2). |
| L3 | "100% data deletion" claim true per game or softened; Lucky Draw says "coming soon" until built. | UNTICKED | | Console product row. Luck side: the deletion claim for Luck must be true (see J2). |
| L4 | Billing per game; bridge to games only after CONSOLE_PUBKEYS set (owner step); console.corporatetambola.com address later. | UNTICKED | | Console product row; decision is games first, console second. CONSOLE_PUBKEYS is not set on Luck (owner step). |

### M. Campaign (Tambola, then each game)

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| M1 | Layer A: 1000 games x 10 players for Luck by Chance (Tambola: done 1000/1000 after runner fix). | UNTICKED | | |
| M2 | Layer B: 100 use cases in real Chromium, local, for Luck. | UNTICKED | | |
| M3 | Layer C: 25 cases on the real site with the 25,000-request meter, then cleanup of TEST-RUN games. | UNTICKED | | |

### N. Lucky Draw

| # | Check | Status | Evidence (test name / commit / screenshot path) | N/A reason |
|---|---|---|---|---|
| N1 | Lucky Draw (own site, rules, lifecycle, payment, roles, claims, prizes, console row, all of A-K). | UNTICKED | | Corporate Lucky Draw is a separate, unbuilt product (note 300 s34); no Luck row. |
