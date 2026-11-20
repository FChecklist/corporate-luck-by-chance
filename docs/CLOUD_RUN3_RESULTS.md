# Cloud run 3 results

- Date: 2026-10-30
- Branch tested: `luck/rel-after-tambola-2026-10-29`
- SHA: `f2a5862c5753fe6358fc76c266719a64a9df404f`
- Bun: 1.4.4
- Runner only. Nothing fixed, deployed or judged.

## Steps

| Step | Command | Exit code |
|---|---|---|
| 2 | `bun install` | 0 |
| 3 | `bun run build:control` | 0 |
| 3 | `bun run build:report` | 0 |
| 3 | `bun run build:zgame` | 0 |
| 3 | `bun run build:luck` | 0 |
| 3 | `git checkout -- .` and removed untracked `bun.lock` | 0 |
| 4 | `bun run typecheck` | 0 |
| 5 | `bun test --isolate packages/beacon` | 0 |
| 5 | `bun test --isolate packages/billing` | 0 |
| 5 | `bun test --isolate packages/luck` | 0 |
| 5 | `bun test --isolate tools/control-worker` | 0 |
| 5 | `bun test --isolate apps/edge` | 0 |
| 5 | `bun test --isolate apps/web` | 1 |

Bun did not crash. No folder was split.

## Typecheck

- Lines containing `error TS`: 0 (`results/typecheck.log`)

## Counts (last summary lines copied from each log)

| Folder | Pass | Fail | Skip | Summary line | Log |
|---|---|---|---|---|---|
| packages/beacon | 100 | 0 | none shown | Ran 100 tests across 8 files. | results/beacon.log |
| packages/billing | 26 | 0 | none shown | Ran 26 tests across 1 file. | results/billing.log |
| packages/luck | 36 | 0 | none shown | Ran 36 tests across 1 file. | results/luck.log |
| tools/control-worker | 1 | 0 | none shown | Ran 1 test across 1 file. | results/control-worker.log |
| apps/edge | 1151 | 0 | none shown | Ran 1151 tests across 74 files. | results/edge.log |
| apps/web | 260 | 6 (plus 1 error) | none shown | Ran 266 tests across 24 files. | results/web.log |

apps/web summary lines exactly: `260 pass`, `6 fail`, `1 error`, `Ran 266 tests across 24 files. [124.53s]`.

## Failures (apps/web, copied from results/web.log)

Error lines are copied as they appear in the log (no interpretation).

### Failure 1
- File: apps/web/test/pages.test.ts
- Test name (full): `console (organizer page) > My people with employee IDs: the Employee ID box and the PDF way are there, a pasted list with IDs is added, the ID shows on the person, and the list download has the column [6270.22ms]`
- First 8 lines of its error:
```
58 |   const text = () => String(win.document.getElementById("app")?.textContent ?? "").replace(/\s+/g, " ").trim();
59 |   return {
60 |     win, errors, text, html: () => String(win.document.getElementById("app")?.innerHTML ?? ""),
61 |     $: (sel) => win.document.querySelector(sel),
62 |     click: (sel) => { tickBoxes(); const el = win.document.querySelector(sel); if (!el) throw new Error("no element " + sel); el.click(); },
63 |     waitFor: async (pred, ms = 6000) => { const t0 = Date.now(); for (;;) { tickBoxes(); const t = text(); if (pred(t)) return t; if (Date.now() - t0 > ms) throw new Error("timed out waiting; page says: " + t.slice(0, 1200) + (errors.length ? " | errors: " + errors.join("; ").slice(0, 300) : "")); await new Promise((r) => setTimeout(r, 40)); } },
                                                                                                                                                                           ^
error: timed out waiting; page says: Corporate Luck by ChanceSigned in as OrganizerPayment pending for this gameYour game · 1 Oct 2026 4:30 pmAll gamesSign outA payment is pending for this game. Just one of you needs to make it: the Organizer, a Host or a Co-host. Guests pay nothing. It is for this one game only, with no commitment and no repeat charges. Guest data will be erased on 2 Oct 2026, 6:30 pm if the game does not start.Your progress · saved1 of 10 done · 10% Jump to12345678910HelpOSigned in asOrganizerYour game at a glance1Date and time of the gameYour game, 1 Oct 2026 4:30 pm○2Number of participantsUp to 100 players○3Set Prizes3 prizes○4Your brandCorporate Luck by Chance, no logo○5Make hosts and co-hosts0 Hosts, 0 Co-hosts○6Invite and Share linksGuest link ready○7Check and publishPublished✓8PayPayment pending○9Game dayOpens when you press Start○10After the gameYour report, then erasing data○Payment: Pending0 people · game not started yetYou made this game. You can do everything.Next: Date and time of the game. Hello. Let us start with the basics.Go1Date and time of the gameYour game, 1 Oct 2026 4:30 pm○ To do▼2Number of participantsUp to 100 players○ To do▼3Set Prizes3 prizes○ To do▼4Your brandCorporate Luc | errors: IDCLEAN is not defined
```

### Failure 2
- File: apps/web/test/pages.test.ts
- Test name (full): `console phase 2: wording fixes, My people, waiting room, remove, play now (real Worker) > My people: paste cleans the list ('2 good, 1 duplicate removed, 1 looks wrong'), lists the wrong one to fix, and the fixed number is added; a CSV with a header row works too [6265.33ms]`
- First 8 lines of its error:
```
58 |   const text = () => String(win.document.getElementById("app")?.textContent ?? "").replace(/\s+/g, " ").trim();
59 |   return {
60 |     win, errors, text, html: () => String(win.document.getElementById("app")?.innerHTML ?? ""),
61 |     $: (sel) => win.document.querySelector(sel),
62 |     click: (sel) => { tickBoxes(); const el = win.document.querySelector(sel); if (!el) throw new Error("no element " + sel); el.click(); },
63 |     waitFor: async (pred, ms = 6000) => { const t0 = Date.now(); for (;;) { tickBoxes(); const t = text(); if (pred(t)) return t; if (Date.now() - t0 > ms) throw new Error("timed out waiting; page says: " + t.slice(0, 1200) + (errors.length ? " | errors: " + errors.join("; ").slice(0, 300) : "")); await new Promise((r) => setTimeout(r, 40)); } },
                                                                                                                                                                           ^
error: timed out waiting; page says: Corporate Luck by ChanceSigned in as OrganizerPayment pending for this gameYour game · 1 Oct 2026 4:30 pmAll gamesSign outA payment is pending for this game. Just one of you needs to make it: the Organizer, a Host or a Co-host. Guests pay nothing. It is for this one game only, with no commitment and no repeat charges. Guest data will be erased on 2 Oct 2026, 6:30 pm if the game does not start.Your progress · saved1 of 10 done · 10% Jump to12345678910HelpOSigned in asOrganizerYour game at a glance1Date and time of the gameYour game, 1 Oct 2026 4:30 pm○2Number of participantsUp to 100 players○3Set Prizes3 prizes○4Your brandCorporate Luck by Chance, no logo○5Make hosts and co-hosts0 Hosts, 0 Co-hosts○6Invite and Share linksGuest link ready○7Check and publishPublished✓8PayPayment pending○9Game dayOpens when you press Start○10After the gameYour report, then erasing data○Payment: Pending0 people · game not started yetYou made this game. You can do everything.Next: Date and time of the game. Hello. Let us start with the basics.Go1Date and time of the gameYour game, 1 Oct 2026 4:30 pm○ To do▼2Number of participantsUp to 100 players○ To do▼3Set Prizes3 prizes○ To do▼4Your brandCorporate Luc | errors: IDCLEAN is not defined
```

### Failure 3
- File: apps/web/test/pages.test.ts
- Test name (full): `console phase 2: wording fixes, My people, waiting room, remove, play now (real Worker) > My people: a big paste goes up 200 at a time; a Co-host's over-limit answer from the server is shown calmly; the Organizer's Co-host limit chips are saved [20193.12ms]`
- First 8 lines of its error:
```
58 |   const text = () => String(win.document.getElementById("app")?.textContent ?? "").replace(/\s+/g, " ").trim();
59 |   return {
60 |     win, errors, text, html: () => String(win.document.getElementById("app")?.innerHTML ?? ""),
61 |     $: (sel) => win.document.querySelector(sel),
62 |     click: (sel) => { tickBoxes(); const el = win.document.querySelector(sel); if (!el) throw new Error("no element " + sel); el.click(); },
63 |     waitFor: async (pred, ms = 6000) => { const t0 = Date.now(); for (;;) { tickBoxes(); const t = text(); if (pred(t)) return t; if (Date.now() - t0 > ms) throw new Error("timed out waiting; page says: " + t.slice(0, 1200) + (errors.length ? " | errors: " + errors.join("; ").slice(0, 300) : "")); await new Promise((r) => setTimeout(r, 40)); } },
                                                                                                                                                                           ^
error: timed out waiting; page says: Corporate Luck by ChanceSigned in as OrganizerPayment pending for this gameYour game · 1 Oct 2026 4:30 pmAll gamesSign outA payment is pending for this game. Just one of you needs to make it: the Organizer, a Host or a Co-host. Guests pay nothing. It is for this one game only, with no commitment and no repeat charges. Guest data will be erased on 2 Oct 2026, 6:30 pm if the game does not start.Your progress · saved1 of 10 done · 10% Jump to12345678910HelpOSigned in asOrganizerYour game at a glance1Date and time of the gameYour game, 1 Oct 2026 4:30 pm○2Number of participantsUp to 250 players○3Set Prizes3 prizes○4Your brandCorporate Luck by Chance, no logo○5Make hosts and co-hosts0 Hosts, 0 Co-hosts○6Invite and Share linksGuest link ready○7Check and publishPublished✓8PayPayment pending○9Game dayOpens when you press Start○10After the gameYour report, then erasing data○Payment: Pending0 people · game not started yetYou made this game. You can do everything.Next: Date and time of the game. Hello. Let us start with the basics.Go1Date and time of the gameYour game, 1 Oct 2026 4:30 pm○ To do▼2Number of participantsUp to 250 players○ To do▼3Set Prizes3 prizes○ To do▼4Your brandCorporate Luc | errors: IDCLEAN is not defined
```

### Failure 4
- File: apps/web/test/pages.test.ts
- Test name (full): `console phase 2: wording fixes, My people, waiting room, remove, play now (real Worker) > My people: 'From my contacts' appears only where the browser has a contact picker, and what is picked is added [264.48ms]`
- First 8 lines of its error:
```
ReferenceError: IDCLEAN is not defined
      at cleanBatch (file:///home/user/corporate-luck-by-chance/apps/web/test/harness.ts:479:149)
      at addPeople (file:///home/user/corporate-luck-by-chance/apps/web/test/harness.ts:544:45)
      at <anonymous> (file:///home/user/corporate-luck-by-chance/apps/web/test/harness.ts:1514:161)
```

### Failure 5
- File: apps/web/test/pages.test.ts
- Test name (full): `console: no refunds (credit), games that wait or did not start, 'Create a new game like this one', rescheduling > Create a new game like this one: on the game page and in the games list (not for a Co-host); the people tick box only when the old list exists; the new game opens on step 1 with the date and time empty and the read-back with Change buttons [6299.92ms]`
- First 8 lines of its error:
```
# Unhandled error between tests
-------------------------------
58 |   const text = () => String(win.document.getElementById("app")?.textContent ?? "").replace(/\s+/g, " ").trim();
59 |   return {
60 |     win, errors, text, html: () => String(win.document.getElementById("app")?.innerHTML ?? ""),
61 |     $: (sel) => win.document.querySelector(sel),
62 |     click: (sel) => { tickBoxes(); const el = win.document.querySelector(sel); if (!el) throw new Error("no element " + sel); el.click(); },
63 |     waitFor: async (pred, ms = 6000) => { const t0 = Date.now(); for (;;) { tickBoxes(); const t = text(); if (pred(t)) return t; if (Date.now() - t0 > ms) throw new Error("timed out waiting; page says: " + t.slice(0, 1200) + (errors.length ? " | errors: " + errors.join("; ").slice(0, 300) : "")); await new Promise((r) => setTimeout(r, 40)); } },
```

### Failure 6
- File: apps/web/test/pages.test.ts
- Test name (full): `console: no refunds (credit), games that wait or did not start, 'Create a new game like this one', rescheduling > Rescheduling: a date more than 30 days ahead is refused politely before anything is sent; the server's own message (a game that has started) is shown as it is [6216.26ms]`
- First 8 lines of its error:
```
58 |   const text = () => String(win.document.getElementById("app")?.textContent ?? "").replace(/\s+/g, " ").trim();
59 |   return {
60 |     win, errors, text, html: () => String(win.document.getElementById("app")?.innerHTML ?? ""),
61 |     $: (sel) => win.document.querySelector(sel),
62 |     click: (sel) => { tickBoxes(); const el = win.document.querySelector(sel); if (!el) throw new Error("no element " + sel); el.click(); },
63 |     waitFor: async (pred, ms = 6000) => { const t0 = Date.now(); for (;;) { tickBoxes(); const t = text(); if (pred(t)) return t; if (Date.now() - t0 > ms) throw new Error("timed out waiting; page says: " + t.slice(0, 1200) + (errors.length ? " | errors: " + errors.join("; ").slice(0, 300) : "")); await new Promise((r) => setTimeout(r, 40)); } },
                                                                                                                                                                           ^
error: timed out waiting; page says: Corporate Luck by ChanceSigned in as OrganizerDraft · not published yetYour game · 1 Oct 2026 4:30 pmAll gamesSign outYour progress · saved0 of 10 done · 0% Jump to12345678910HelpOSigned in asOrganizerYour game at a glance1Date and time of the gameYour game, 1 Oct 2026 4:30 pm○2Number of participantsUp to 100 players○3Set Prizes3 prizes○4Your brandCorporate Luck by Chance, no logo○5Make hosts and co-hosts0 Hosts, 0 Co-hosts○6Invite and Share linksGuest link ready after publishing○7Check and publishNot published yet○8PayPublish first○9Game dayOpens when you press Start○10After the gameYour report, then erasing data○Payment: PendingYou made this game. You can do everything.Next: Date and time of the game. Hello. Let us start with the basics.Go1Date and time of the gamePick the occasion, day and time.○ To do▲Hello. Let us start with the basics.About this stepThis is the basics. Pick the occasion, the day and the time.Times are in your own time zone, as your device shows it.Players can join before the start. You press Start on the game page when everybody is in.You can change all this until the game starts.A game can start at most 30 days from today. Please pick a closer date.What is t
```

### Unhandled error between tests (logged under `# Unhandled error between tests`, no `(fail)` line)

- File: apps/web/test/pages.test.ts
- First 8 lines after the header:
```
-------------------------------
58 |   const text = () => String(win.document.getElementById("app")?.textContent ?? "").replace(/\s+/g, " ").trim();
59 |   return {
60 |     win, errors, text, html: () => String(win.document.getElementById("app")?.innerHTML ?? ""),
61 |     $: (sel) => win.document.querySelector(sel),
62 |     click: (sel) => { tickBoxes(); const el = win.document.querySelector(sel); if (!el) throw new Error("no element " + sel); el.click(); },
63 |     waitFor: async (pred, ms = 6000) => { const t0 = Date.now(); for (;;) { tickBoxes(); const t = text(); if (pred(t)) return t; if (Date.now() - t0 > ms) throw new Error("timed out waiting; page says: " + t.slice(0, 1200) + (errors.length ? " | errors: " + errors.join("; ").slice(0, 300) : "")); await new Promise((r) => setTimeout(r, 40)); } },
                                                                                                                                                                           ^
```

## Rerun of failing file alone (180 s timeout)

- `bun test --isolate apps/web/test/pages.test.ts` (`results/web-pages-rerun.log`): 86 pass, 6 fail, 1 error, Ran 92 tests across 1 file.
- Same 6 tests fail and same 1 error: **same** as the full folder run.

## Base comparison (commit 752ff60, separate worktree `../base`, `bun install` exit 0)

- `bun test --isolate apps/web/test/pages.test.ts` (`results/web-pages-base.log`): 85 pass, 2 fail, Ran 87 tests across 1 file.
- Fail on base (2):
  - the "Create a new game like this one" test (FAIL)
  - the "Rescheduling: a date more than 30 days ahead..." test (FAIL)
- The other 4 failing tests (3 "My people" tests and "My people with employee IDs" test): the base log shows them as not failing (pass).
- The unhandled error: not present in the base log.

## Comparison with run 2 (docs/CLOUD_RUN2_RESULTS.md on `cloud/luck-run2-results-2026-10-30`)

Run 2: typecheck 0, edge 1137/0, web 264/2, beacon 100/0, billing 26/0, luck 36/0, control-worker 1/0.

- Gone: none. The 2 run 2 failures (Create a new game like this one; Rescheduling) are still failing.
- New in run 3:
  - `console (organizer page) > My people with employee IDs: ...`
  - `console phase 2 ... > My people: paste cleans the list ...`
  - `console phase 2 ... > My people: a big paste goes up 200 at a time ...`
  - `console phase 2 ... > My people: 'From my contacts' appears only where the browser has a contact picker ...` (log shows `ReferenceError: IDCLEAN is not defined`, at harness.ts:479)
  - the unhandled error between tests (pages.test.ts:725)
- Counts changed vs run 2: edge 1137 -> 1151 pass; web 264 pass / 2 fail -> 260 pass / 6 fail / 1 error (266 tests).

## Not run

- None of the six listed folders were left without summary lines.
- Not part of this task's list: packages/shared, apps/cron.
