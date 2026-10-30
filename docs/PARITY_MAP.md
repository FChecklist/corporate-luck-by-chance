# PARITY MAP: Corporate Tambola -> Corporate Luck by Chance (head 028efee, 30 Oct 2026)

Owner decision: every console function, design and combination of Corporate Tambola is ADOPTED for Luck by Chance unless it is NOT APPLICABLE with a written reason. Luck's own needs (press window 10 s, 10 rounds for new games, per-round gifts, a claim rule per round, the wheel) are kept on top.

Sources: handover 2026-10-27 notes 300 (sections 13, 28-33), 200, 210 (section D), 191, 400; compare report data/ui/compare-2026-10-30; docs-games/ALL_GAMES_CARRY_TAMBOLA_RULES.md; Tambola code (branches wip/join-redesign, feat/tambola-1.8.5-empid: apps/edge/src, apps/web/public/pack); Luck rules docs-games/RULES_luckbychance.md and docs/RULES.md.

Evidence column: file or commit in THIS repo. "test evidence: pending tester" everywhere. Nothing here claims a test passes.

Luck facts that shape the map: the Luck engine today CANNOT pause, resume, add time or refuse a late press (engine track EN2). Luck has no claims in the Tambola sense (every player's dice is made for them when the press window closes, Fate mode). Luck players join by name only unless the organizer asks for Employee ID, mobile or Email ID. Luck's organizer console today has 4 steps (zc.js: your game, how it plays, prizes, brand moments), not Tambola's 5 steps plus Game dashboard.

## Summary (counts filled from the rows below)

| Status | Rows |
|---|---|
| ADOPTED | 39 |
| ADAPTED | 19 |
| NOT APPLICABLE | 9 |
| TODO | 25 |
| Total | 92 |

(ADOPTED means present in this repo at 028efee; it does not mean tested.)

## Rows

### A. Identity and lists

| # | Feature | Tambola reference | Luck status | Evidence in repo |
|---|---|---|---|---|
| A1 | Employee ID cleaner (NFKC, upper case, A-Z 0-9 only, 30-char cap, empty refused plainly) | apps/edge/src/empid.ts (feat/tambola-1.8.5-empid); note 300 s35 | ADOPTED | apps/edge/src/idclean.ts, apps/web/public/idclean.js; commit f2a5862; test evidence: pending tester |
| A2 | ID cleaner on every path (join, verify, type, paste, upload, add-person, hash, duplicate check, invites, exports) | note 400 A2 | ADOPTED for server paths; TODO for Host/Co-host list viewer, family, console pass-through (do not exist yet) | commit f2a5862; test evidence: pending tester |
| A3 | Email cleaner (NFKC, trim, no inner spaces, lower case); never the ID cleaner on an e-mail | note 400 A3 | ADOPTED | emailId in apps/edge/src/idclean.ts; commit 028efee; test evidence: pending tester |
| A4 | Duplicates that appear only after cleaning are flagged, never dropped | note 400 A4 | ADOPTED | people list check, commit f2a5862 and 028efee; test evidence: pending tester |
| A5 | Hint "The system will read this as ..." | note 400 A5 | ADOPTED | luck.js join form, commits f2a5862, 028efee; test evidence: pending tester |
| A6 | Old games keep old behaviour (EMP_CLEAN_FROM_MS) | note 300 s35 | ADOPTED | EMP_CLEAN_FROM_MS in idclean.ts, commit f2a5862; deploy-instant value to be set at deploy (TODO, owner/boss step); test evidence: pending tester |
| A7 | Criterion choice: Employee ID or Email ID, list decides | note 400 A7 | ADOPTED | verify: "email" in packages/beacon/src/config.ts, people.ts; commit 028efee; test evidence: pending tester |
| A8 | Test addresses demoN@demo-test.invalid, fake mobiles, tag TEST-RUN | note 400 A8 | TODO (test-data convention for the tester; check apps/edge/src/test-data.ts) | apps/edge/src/test-data.ts; test evidence: pending tester |
| A9 | People list upload / paste / PDF list, list viewer for 600+ rows | notes 300 s4; Tambola people.ts, pdf.ts | ADAPTED: upload, paste and PDF list exist; 600+ row viewer is TODO | apps/edge/src/people.ts, apps/web/public/vendor/pdfjs, apps/web/test/pdf-list.test.ts (commit 961189f); test evidence: pending tester |
| A10 | Optional list check (duplicates, bad rows) before publish | note 300 s4 | ADOPTED | people.ts check; test evidence: pending tester |
| A11 | "Employees only" / verify mode on join | Tambola verify.test.ts | ADOPTED | people.ts verifyOf, commit 961189f; test evidence: pending tester |

### B. Organizer console

| # | Feature | Tambola reference | Luck status | Evidence in repo |
|---|---|---|---|---|
| B1 | Five-step console (apps/web/public/pack/zc-flow.js) | notes 300 s2-7; 200 | TODO (Luck has a 4-step zc.js) | apps/web/public/zc.js; test evidence: pending tester |
| B2 | Step 1 date/time, occasion, time zone with players' local times, how the game starts, who runs it | note 300 s3, s22 | ADAPTED: date/time and "your game" step exist; local-times line and occasion TODO | zc.js step 1, apps/edge/src/tz.ts; test evidence: pending tester |
| B3 | Step 2 who is it for (people / families / extended), validation system/by hand, criterion, list | note 300 s4 | ADAPTED: people list and criterion exist; families / extended TODO | zc.js, people.ts; test evidence: pending tester |
| B4 | Step 3 tickets 1/2, ticket size and price | note 300 s5 | NOT APPLICABLE: Luck has no tickets; price follows player count packs | RULES_luckbychance.md; test evidence: pending tester |
| B5 | Step 3 prizes: tags, 1-5 wins, gift text, "worth up to" | note 300 s5 | ADAPTED: gift text for places 1-5, overall and per round (R26-R29); tags and worth-up-to TODO | settings.ts in packages/luck/src, zc.js step 3; test evidence: pending tester |
| B6 | Full House 1st-5th, Super Bumper 1-10, Lucky Draw 1-3, A/B per ticket | notes 300 s5, s31 | NOT APPLICABLE: these are Housie prize types. Luck's equivalent is places 1-5 per round and overall (B5) | RULES_luckbychance.md R23, R26; test evidence: pending tester |
| B7 | Step 4 Brand and Breaks (logo, public link) | note 300 s6 | ADAPTED: brand moments exist; breaks are fixed by the engine (20 s standings break) | brand.ts, zc.js step 4; test evidence: pending tester |
| B8 | Step 5 check and publish with warning and read-back, Host/Co-host emails, payment, rehearsals | note 300 s7 | TODO (no 5th step) | test evidence: pending tester |
| B9 | Game dashboard: Game ID, 11 status pills with plain banners, share card, ready check, payment (Pay now / copy link), rehearsals, waiting table, board, prizes, feed, start-time-passed in red | note 300 s8 | ADOPTED (vendored pack, opt-in ?flow=new): Game ID bar, status pill and banner, share card, payment card come from pack/zc-flow.js. ADAPTED: descriptor zc-flow-game.js hides board, claims, rehearsal, lucky, control. TODO: the pack has no Luck states waiting-for-start or running (it says live from the start time), so start time in red while not started and Start / End on the dashboard are not drawn yet (live-luck.js ready, nothing mounts it) | apps/web/public/pack/MANIFEST.json, zc-flow-game.js, live-luck.js, zc-mode.js; test evidence: pending tester |
| B10 | Game ID always visible, unique for ever | note 300 s2 | ADOPTED as game_record; on-screen display ADOPTED in the new screens (pack Game ID bar, ?flow=new) | apps/edge/src/gamerecord.ts, migration 0028_game_record.sql, pack/zc-flow.js; test evidence: pending tester |
| B11 | Previous-screens link both ways, remembered per browser | note 300 s2; 400 B7 | ADAPTED: link both ways (zc-mode.js, ?flow=new / ?flow=old, other address parts kept). NOT remembered per browser (needs a storage-list line and a Privacy sentence first) | apps/web/public/zc-mode.js, zc.html; test evidence: pending tester |
| B12 | Existing games opened in the new console (draft resumes) | note 400 B8 | TODO (after B1) | test evidence: pending tester |
| B13 | Draft-limit fix (no lost drafts, limit honest) | Tambola 1.8.x | ADOPTED | commit 961189f and later; test evidence: pending tester |
| B14 | Clone a game | Tambola clone.ts | ADOPTED | apps/edge/src/clone.ts; test evidence: pending tester |
| B15 | Organizer sign-in, Sign out in zc.js | Tambola google.ts, zc | ADOPTED | zc.js, signin.html, google.ts; test evidence: pending tester |
| B16 | Cancel game, refund, credit note | Tambola cancel.ts, credit.ts | ADOPTED | cancel.ts, credit.ts; test evidence: pending tester |
| B17 | AI helper link (AI-assisted setup) | Tambola ai-link.ts | ADOPTED | apps/edge/src/ai-link.ts, docs/AI_LINK.md; test evidence: pending tester |
| B18 | Message to everyone (announce) | Luck's own need | ADOPTED | worker.ts /api/z/<id>/announce, tests luck-announce.test.ts; test evidence: pending tester |

### C. Roles

| # | Feature | Tambola reference | Luck status | Evidence in repo |
|---|---|---|---|---|
| C1 | Host role (own link, can run the game) | note 300 s10; Tambola hostsetup.ts | ADAPTED: Host keys and Host link exist (kind host); the Tambola passcode sign-in screens are TODO | apps/edge/src/hostsetup.ts, apps/web/public/host.js, hostlink.test.ts; test evidence: pending tester |
| C2 | Host/Co-host sign-in with 6-digit passcode, same game link | note 300 s10; mock screens 01-04, 20 | TODO (note 300 s13 hid it in Tambola 1.7.0 until engine support) | test evidence: pending tester |
| C3 | Co-host role (limit set by organizer/Host, invites, admits own people, no payment) | note 300 s10 | ADAPTED: Co-host key bound to one game exists (kind cohost, 0015); own-people limit and approvals TODO | worker.ts, cancel.ts; test evidence: pending tester |
| C4 | Role chips and "you were made Co-host by ..." | note 400 C4 | TODO | test evidence: pending tester |
| C5 | Authorization (nobody approves themselves, no cross-game acts) | note 400 C5 | ADAPTED: `can` and `mayPay` checks exist; negative tests for approvals TODO | worker.ts lines near `const can`; test evidence: pending tester |
| C6 | Family Passes (1+4, host card, member needs no ID, 15-minute cutoff, plays on clicked device) | note 300 s9, s29 | TODO | test evidence: pending tester |
| C7 | Approvals by role (Host/Organizer own link; Co-host/Host/Organizer on Co-host link; first decision wins; 30-minute wait; polite decline; re-ask) | note 300 s29; Tambola approvals.ts | TODO (a waiting room exists for not-on-list people; role-based approval and 30-minute limit not built) | worker.ts waiting room (0016_people.sql); test evidence: pending tester |
| C8 | Helpdesk | Tambola helpdesk.ts | ADOPTED | helpdesk.ts, HELPDESK_SPEC.md; test evidence: pending tester |
| C9 | Partner program | Tambola partners.ts | ADOPTED | partners.ts, partner.html; test evidence: pending tester |

### D. Join and approvals (participant)

| # | Feature | Tambola reference | Luck status | Evidence in repo |
|---|---|---|---|---|
| D1 | Listed ID / Email ID: nothing else needed | note 300 s29 | ADOPTED | people.ts, luck.js; commit 028efee; test evidence: pending tester |
| D2 | Open join: Name only (Luck default) | note 300 s28 | ADAPTED: Luck asks name only unless the organizer asks for Employee ID / mobile / Email ID; Tambola's Name+Mobile+Email form is not forced | nameonly.test.ts; test evidence: pending tester |
| D3 | Referral ID captured automatically from the link ("brought by") | note 300 s28, s13 | TODO | test evidence: pending tester |
| D4 | Participant cap, duplicate returns same ticket (here: same seat) | note 300 s28 | ADOPTED (seat on same device proof) | device proof, tests join-*; test evidence: pending tester |
| D5 | Device proof (one seat per device) | Tambola device.ts | ADOPTED | apps/edge/test/device.ts; test evidence: pending tester |
| D6 | Consent (version safe, stale page gets "reload") | note 400 D4 | ADOPTED for consent; "nobody locked out mid-game" and stale-page reload TODO | consent.ts, consent-text.json; test evidence: pending tester |
| D7 | Join retry on bad network | Tambola 1.8.x | ADOPTED | apps/web/test/join-retry.test.ts; test evidence: pending tester |
| D8 | Check-in (opens ... before start) | Tambola checkin.ts | ADAPTED: checkin.ts is present; Luck's player-side "Check-in opens ..." text and screen TODO | apps/edge/src/checkin.ts; test evidence: pending tester |
| D9 | Rehearsals (3 per bought game, isolated link, rehearsal join) | Tambola rehearsal.ts, rehearsal-mail.ts; notes 10b, 10d | TODO (no rehearsal files; engine has no replay mode) | test evidence: pending tester |
| D10 | Demo link redeem (demo passes) | Tambola demo-pass | ADOPTED | DEMO_PASSES in worker.ts, demo-pass.test.ts; test evidence: pending tester |

### E. Participant screens before the game

| # | Feature | Tambola reference | Luck status | Evidence in repo |
|---|---|---|---|---|
| E1 | Landing ("You are invited ...") | notes 300 s17-s20, s27 | TODO (restyle) | luck.js; test evidence: pending tester |
| E2 | Not-listed and waiting screens | mock screens 39-40 | ADAPTED: exist in plain form; new look TODO | luck.js; test evidence: pending tester |
| E3 | Waiting screen before start, reconnect, back online, welcome back | mock screens 42-44 | ADAPTED: connection-lost bar exists; full set TODO | luck.js, commit fe2aa77; test evidence: pending tester |
| E4 | "Ticket before start" screen | mock screen 41 | NOT APPLICABLE: Luck has no ticket; the pre-start screen is the lobby with the dice | RULES_luckbychance.md; test evidence: pending tester |
| E5 | Rules row small at bottom, only inside the game | note 300 s28 | TODO | test evidence: pending tester |

### F. During the game

| # | Feature | Tambola reference | Luck status | Evidence in repo |
|---|---|---|---|---|
| F1 | Auto timer cadence (12 s calls) | note 400 F1 | ADAPTED: Luck's own clock: press window 6/10/15 s (default 10) + 3 s reveal, 20 s standings break (R04, R30) | packages/luck/src/timeline.ts; test evidence: pending tester |
| F2 | Manual play with 5 s lock, no repeats 1..90, "X of 90 called" | notes 300 s13, 400 F1 | NOT APPLICABLE: Luck has no number caller | RULES_luckbychance.md; test evidence: pending tester |
| F3 | Same result on every phone, public fairness (sealed draw, beacon) | note 160 fairness wording | ADOPTED (Luck's own R08-R13, R32, R35) | packages/luck, packages/beacon; test evidence: pending tester |
| F4 | Crossing numbers, Ticket A/B switch | note 400 F2 | NOT APPLICABLE: no numbers or tickets; replaced by dice and target per round | RULES_luckbychance.md; test evidence: pending tester |
| F5 | Gold CLAIM buttons, bogey question, claim sent, checking, correct, wrong, late, prize taken, bystander banners | notes 300 s21; Tambola claim-window.test.ts | NOT APPLICABLE: nobody claims in Luck; prizes follow the ranking (R15-R29). Luck's own "claim rule per round" (who receives each round's gift when a player may win several, R29) is a TODO screen | RULES_luckbychance.md; test evidence: pending tester |
| F6 | Simultaneous claims, auto pause and resume on claim | note 400 F3 | NOT APPLICABLE as claims; separate pause/resume for the organizer is TODO and blocked by engine track EN2 | test evidence: pending tester |
| F7 | Organizer/Host pause, resume, add time | Tambola host calls; note 300 s8 | TODO (blocked by engine track EN2) | test evidence: pending tester |
| F8 | Late press refused with "Ohooo" wording | ALL_GAMES_CARRY rule | TODO (blocked by engine track EN2: server cannot refuse a late press) | test evidence: pending tester |
| F9 | Full House 1st-5th / per-house results | note 400 F3 | ADAPTED: places 1-5 named, top 10 listed, per round and overall (R15-R23); per-round results screen in the new look is TODO test evidence: pending tester |
| F10 | Super Bumper / Super Ticket / Lucky Draw prize | note 300 s31 | NOT APPLICABLE: Tambola only (note 300 s34). Luck's wheel is Luck's own | test evidence: pending tester |
| F11 | The wheel (Luck's own) | Luck need | TODO | test evidence: pending tester |
| F12 | Per-round gifts (Luck's own) | Luck need | ADOPTED | R26-R28, settings.ts; test evidence: pending tester |
| F13 | Game ends when all prizes are claimed | note 400 F4 | ADAPTED: Luck ends after the last round (R01-R02) | test evidence: pending tester |
| F14 | Tiny-signal heartbeat / beacon relay, hedged fetch | Tambola beacon-relay | ADOPTED | apps/edge/test/beacon-relay.test.ts, commit 961189f; test evidence: pending tester |
| F15 | Away-and-return message, no redraw while finger down | ALL_GAMES_CARRY SAFETY | TODO | test evidence: pending tester |
| F16 | Retro / Modern theme switch | note 300 s36 | TODO (theme.js exists for light/dark only) | apps/web/public/theme.js; test evidence: pending tester |

### G. After the game

| # | Feature | Tambola reference | Luck status | Evidence in repo |
|---|---|---|---|---|
| G1 | Thank-you page (Share + WhatsApp, no rules), you won, Game completed page | note 300 s26 | TODO | test evidence: pending tester |
| G2 | 30-minute-after message ("link opened 30 minutes after the game") | mock screen 48 | TODO | test evidence: pending tester |
| G3 | Completed report e-mail about 3 minutes after end | Tambola report-email.ts | ADAPTED: report e-mail and report page exist; wording for Luck per round TODO | apps/web/public/report.html, report.js, apps/edge/src/mails.ts; test evidence: pending tester |
| G4 | Game record kept for ever by Game ID (game_record) | Tambola gamerecord.ts | ADOPTED | apps/edge/src/gamerecord.ts, migration 0028; test evidence: pending tester |
| G5 | Game log 365 days (ticket numbers, organizer, winners, Host, Co-host) and log viewer | Tambola gamelog.ts, pack/gamelog.html | TODO (game_record is not the 365-day log; to decide whether game_record is enough) | test evidence: pending tester |
| G6 | Winners and audit trail | Tambola winners.ts, audit.ts | ADOPTED | winners.ts, audit.ts, WINNERS_AND_AUDIT.md; test evidence: pending tester |

### H. Payment, data, operations

| # | Feature | Tambola reference | Luck status | Evidence in repo |
|---|---|---|---|---|
| H1 | Payment lease (no double fulfil) | Tambola pay.ts | ADOPTED | pay.ts, fulfil-once.test.ts; test evidence: pending tester |
| H2 | Pay-later link works 7 days | note 400 J1 | ADOPTED | paylink.ts; test evidence: pending tester |
| H3 | Payee only IT Services by Rajat Agarwal via Razorpay; TEST games take no live payment | note 400 J1 | ADOPTED | mode.ts, TEST_AND_LIVE_MODE.md; test evidence: pending tester |
| H4 | Free 10-person game (zero price) | commit 961189f | ADOPTED; wording check (use the rupee sign, not Rs) is TODO | free-launch.test.ts, demo10.test.ts; test evidence: pending tester |
| H5 | 20-hour clock for guest data erasure (24 h promise) | lifecycle.ts | ADOPTED | PURGE_AFTER_MS in lifecycle.ts; test evidence: pending tester |
| H6 | Email key and rate-limit keys erased within 24 h | note 400 J2 | ADAPTED: shred exists; email key and rate-limit key coverage to be checked | 0011_participant_shred.sql; test evidence: pending tester |
| H7 | 2,000,000 write budget | Tambola cost control | ADOPTED | commit fe2aa77 and earlier; test evidence: pending tester |
| H8 | Visits (hashed) and owner desk | Tambola visits.ts, owner-stats.ts | ADOPTED | visits.ts, owner-desk.js, commit 028efee for e-mail hash; test evidence: pending tester |
| H9 | Privacy, terms, DPA, trust pages | Tambola legal.ts, trust-page.ts | ADOPTED | legal.html, trust.html, privacy.html; test evidence: pending tester |
| H10 | Data-deletion rights (access, erase) | Tambola rights.ts | ADOPTED | rights.ts; test evidence: pending tester |

### I. Look, language, console link

| # | Feature | Tambola reference | Luck status | Evidence in repo |
|---|---|---|---|---|
| I1 | New look: Retro burgundy + gold, Modern night navy + neon, ticket-only rich element | note 300 s36 | TODO | test evidence: pending tester |
| I2 | Brand-kit header and footer, Version + release date/time IST on every page | note 400 I1 | ADAPTED: version stamp exists (apps/web/test/version-stamp.test.ts); IST time and brand-kit header/footer TODO | v.js, releases.json; test evidence: pending tester |
| I3 | Games bar with full names | Tambola gamesbar | ADOPTED | apps/web/test/gamesbar.test.ts; test evidence: pending tester |
| I4 | Plain-English language rules (note 191), guide entry for every refusal | note 191, 400 H1 | ADAPTED: guide.js and guide.test.ts exist; audit of every message TODO | apps/web/public/guide.js; test evidence: pending tester |
| I5 | Side-by-side compare against mock (gap report) | data/ui/compare-2026-10-30/gap-report.md | TODO (no Luck screens in the mock) | test evidence: pending tester |
| I6 | Master console pass-through (CONSOLE_PUBKEYS bridge) | note 300 s34 | TODO (console bridge not set; owner step) | test evidence: pending tester |
| I7 | Billing per game in master console | note 400 L4 | NOT APPLICABLE until the master console is started (order: games first) | test evidence: pending tester |

## Recommended slice order for the console flow

Order keeps each slice shippable alone and builds from what Luck already has. Slices that need the engine wait for engine track EN2.

1. Slice 1: Game dashboard shell (B9, B10, B11 minimal): Game ID, status pill, banner, share card, start-time-passed in red. Reads existing state only.
2. Slice 2: Five-step flow skeleton (B1, B2, B3, B5, B7): split the existing 4 steps into Tambola's step names; add step 5 check and publish (B8) with the read-back.
3. Slice 3: Payment and ready check inside the dashboard (B9): Pay now / copy link, uses existing pay and paylink.
4. Slice 4: Roles flow (C1, C2, C3, C4, C5): Host and Co-host sign-in with passcode, role chips, authorization negative tests.
5. Slice 5: Approvals by role (C7) and waiting table on the dashboard, 30-minute wait, polite decline.
6. Slice 6: Check-in and participant pre-start screens (D8, E1-E3, E5).
7. Slice 7: Rehearsals (D9) shown at step 5 and on the dashboard. Needs a replay design for Luck.
8. Slice 8: Family Passes (C6), only if the owner confirms families make sense for Luck.
9. Slice 9: Thank-you, You won, Game completed, 30-minute page, report wording (G1, G2, G3) and game log 365 days (G5).
10. Slice 10: New look (I1, I2, F16) across all screens, then the compare against the mock (I5).
11. Slice 11 (after EN2): pause, resume, add time, late-press refusal (F6, F7, F8) and the Luck screens for them. The wheel (F11) is separate and does not depend on EN2.
12. Slice 12: Master console pass-through (I6) last, per owner order.
