# Cloud run 4 results (raw)

- Date: 2026-10-30
- Branch tested: luck/rel-after-tambola-2026-10-29
- Full SHA: 6dddb52bcd8989ab2b84695eac803b963519c32c
- Bun version: 1.4.4 (38afee6c8)

## Steps

| Step | Command | Exit code |
|---|---|---|
| 2 | bun install | 0 |
| 3 | bun run build:control | 0 |
| 3 | bun run build:report | 0 |
| 3 | bun run build:zgame | 0 |
| 3 | bun run build:luck | 0 |
| 4 | bun run typecheck | 0 |
| 5 | bun test --isolate packages/beacon | 0 |
| 5 | bun test --isolate packages/billing | 0 |
| 5 | bun test --isolate packages/luck | 0 |
| 5 | bun test --isolate tools/control-worker | 0 |
| 5 | bun test --isolate apps/edge | 1 |
| 5 | bun test --isolate apps/web | 1 |

After the builds, the 4 rewritten tracked files (apps/web/public/control.js, luck-engine.js, reportgen.js, zgame.js) were restored with `git checkout -- .` and untracked bun.lock was deleted. Bun did not crash on any folder; no folder was split.

## Typecheck

- Lines containing `error TS`: 0 (results/typecheck.log). First 20 error lines: none.

## Counts (last summary lines copied from each log)

| Folder | Pass | Fail | Skip | Summary line | Log |
|---|---|---|---|---|---|
| packages/beacon | 100 | 0 | none shown | Ran 100 tests across 8 files. [7.22s] | results/beacon.log |
| packages/billing | 26 | 0 | none shown | Ran 26 tests across 1 file. [152.00ms] | results/billing.log |
| packages/luck | 36 | 0 | none shown | Ran 36 tests across 1 file. [4.07s] | results/luck.log |
| tools/control-worker | 1 | 0 | none shown | Ran 1 test across 1 file. [69.00ms] | results/control-worker.log |
| apps/edge | 1153 | 1 | none shown | Ran 1154 tests across 74 files. [47.23s] | results/edge.log |
| apps/web | 257 | 9 (plus 1 error) | none shown | Ran 266 tests across 24 files. [123.85s] | results/web.log |

apps/web summary lines exactly: `257 pass`, `9 fail`, `1 error`, `Ran 266 tests across 24 files. [123.85s]`.

## Failures (copied from the logs; no interpretation)

Failure 5 shows a ReferenceError (`IDCLEAN is not defined`) in harness.ts. The log also has a "# Unhandled error between tests" block (pages.test.ts:725, "timed out waiting; page says: ") that is not attached to a named test; it is the 1 error.

### Failure 1 (results/edge.log)
- File: apps/edge/test/data-map.test.ts
- Test name (full): `D2: the notice and the data map agree > the player page asks for exactly the fields the data map lists (a mobile number field exists only if it is listed) [1.48ms]`
- First 8 lines of its error:
```
56 |   test("the player page asks for exactly the fields the data map lists (a mobile number field exists only if it is listed)", () => {
57 |     const code = PLAYER_SCRIPTS.map(pub).join("\n");
58 |     const asksNumber = /id="ph"|type="tel"|name="phone"|id="phone"/.test(code);
59 |     expect(asksNumber).toBe(always.includes("mobile number") || sometimes.includes("mobile number"));
60 |     expect(/id="nm"|id="name"|name="name"/.test(code)).toBe(always.includes("name"));
61 |     expect(/type="email"|id="email"|name="email"/.test(code)).toBe(false);
                                                                   ^
error: expect(received).toBe(expected)
```

### Failure 2 (results/web.log)
- File: apps/web/test/legal-sync.test.ts
- Test name (full): `no internal notes in the site pages or the docs that are committed > site/ and the docs have none (the site pages and the docs may use the word draft only for an unpublished game, never for their own status) [103.65ms]`
- First 8 lines of its error:
```
30 |   const PATTERN = /COUNSEL|\[●\]|legal(ly)?\s+(review|pending|sign-?off)|review\s+pending|pending\s+(legal|review|approval)|awaiting\s+(legal|counsel|lawyer|approval|review)|\blawyer\b|\badvocate\b|owner'?s?\s+(told|instruction|order|directive|decision)|\bTODO\b|\bFIXME\b|under review|not yet (reviewed|approved)/i;
31 |   const walk = (dir: string, out: string[] = []): string[] => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) { if (!["fonts", "node_modules"].includes(n)) walk(p, out); } else if (/\.(html|md|txt|xml|css|js|json|svg)$|^_headers$/.test(n)) out.push(p); } return out; };
32 |   test("site/ and the docs have none (the site pages and the docs may use the word draft only for an unpublished game, never for their own status)", () => {
33 |     const files = [...walk(join(ROOT, "site")), ...walk(join(ROOT, "docs")).filter((f) => !f.endsWith("SPEC.md"))];
34 |     expect(files.length).toBeGreaterThan(15);
35 |     expect(files.filter((f) => PATTERN.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length))).toEqual([]);
                                                                                                             ^
error: expect(received).toEqual(expected)
```

### Failure 3 (results/web.log)
- File: apps/web/test/pages.test.ts
- Test name (full): `console (organizer page) > My people with employee IDs: the Employee ID box and the PDF way are there, a pasted list with IDs is added, the ID shows on the person, and the list download has the column [6250.36ms]`
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

### Failure 4 (results/web.log)
- File: apps/web/test/pages.test.ts
- Test name (full): `console phase 2: wording fixes, My people, waiting room, remove, play now (real Worker) > My people: paste cleans the list ('2 good, 1 duplicate removed, 1 looks wrong'), lists the wrong one to fix, and the fixed number is added; a CSV with a header row works too [6250.71ms]`
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

### Failure 5 (results/web.log)
- File: apps/web/test/pages.test.ts
- Test name (full): `console phase 2: wording fixes, My people, waiting room, remove, play now (real Worker) > My people: a big paste goes up 200 at a time; a Co-host's over-limit answer from the server is shown calmly; the Organizer's Co-host limit chips are saved [20268.83ms]`
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

### Failure 6 (results/web.log)
- File: apps/web/test/pages.test.ts
- Test name (full): `console phase 2: wording fixes, My people, waiting room, remove, play now (real Worker) > My people: 'From my contacts' appears only where the browser has a contact picker, and what is picked is added [287.87ms]`
- First 8 lines of its error:
```
ReferenceError: IDCLEAN is not defined
      at cleanBatch (file:///home/user/corporate-luck-by-chance/apps/web/test/harness.ts:485:149)
      at addPeople (file:///home/user/corporate-luck-by-chance/apps/web/test/harness.ts:551:45)
      at <anonymous> (file:///home/user/corporate-luck-by-chance/apps/web/test/harness.ts:1521:161)
```

### Failure 7 (results/web.log)
- File: apps/web/test/pages.test.ts
- Test name (full): `console: no refunds (credit), games that wait or did not start, 'Create a new game like this one', rescheduling > Create a new game like this one: on the game page and in the games list (not for a Co-host); the people tick box only when the old list exists; the new game opens on step 1 with the date and time empty and the read-back with Change buttons [6347.13ms]`
- First 8 lines of its error:
```
58 |   const text = () => String(win.document.getElementById("app")?.textContent ?? "").replace(/\s+/g, " ").trim();
59 |   return {
60 |     win, errors, text, html: () => String(win.document.getElementById("app")?.innerHTML ?? ""),
61 |     $: (sel) => win.document.querySelector(sel),
62 |     click: (sel) => { tickBoxes(); const el = win.document.querySelector(sel); if (!el) throw new Error("no element " + sel); el.click(); },
63 |     waitFor: async (pred, ms = 6000) => { const t0 = Date.now(); for (;;) { tickBoxes(); const t = text(); if (pred(t)) return t; if (Date.now() - t0 > ms) throw new Error("timed out waiting; page says: " + t.slice(0, 1200) + (errors.length ? " | errors: " + errors.join("; ").slice(0, 300) : "")); await new Promise((r) => setTimeout(r, 40)); } },
                                                                                                                                                                           ^
error: timed out waiting; page says: 
```

### Failure 8 (results/web.log)
- File: apps/web/test/pages.test.ts
- Test name (full): `console: no refunds (credit), games that wait or did not start, 'Create a new game like this one', rescheduling > Rescheduling: a date more than 30 days ahead is refused politely before anything is sent; the server's own message (a game that has started) is shown as it is [6225.20ms]`
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

### Failure 9 (results/web.log)
- File: apps/web/test/guide.test.ts
- Test name (full): `every message the server can send has a guide > each one is either guided (matched by a catalog entry) or on the list of messages no person ever sees [212.93ms]`
- First 8 lines of its error:
```
35 |     const missing: string[] = [];
36 |     for (const m of serverMessages()) {
37 |       if (CTG.apiOnly(m.msg)) continue;
38 |       if (!CTG.find({ status: m.status, message: m.msg }).matched) missing.push(`${m.file}:${m.line} [${m.status}] ${m.msg.slice(0, 90)}`);
39 |     }
40 |     expect(missing).toEqual([]); // a message listed here needs a catalog entry in guide.js (what happened, what to do, where to go)
                         ^
error: expect(received).toEqual(expected)
```

### Failure 10 (results/web.log)
- File: apps/web/test/no-internal-notes.test.ts
- Test name (full): `no internal notes in what is deployed > every file of the deployed pages (source and built copy) is free of internal notes [22.74ms]`
- First 8 lines of its error:
```
24 | describe("no internal notes in what is deployed", () => {
25 |   test("every file of the deployed pages (source and built copy) is free of internal notes", () => {
26 |     const files = [...walk(join(ROOT, "apps/web/public")), ...walk(join(ROOT, "pages"))];
27 |     expect(files.length).toBeGreaterThan(30);
28 |     const bad = files.filter((f) => PATTERN.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length));
29 |     expect(bad).toEqual([]);
                     ^
error: expect(received).toEqual(expected)
```

## Rerun of each failing file alone (180 s timeout) vs first run

| File | Alone: exit, summary | Same/different vs full run |
|---|---|---|
| apps/edge/test/data-map.test.ts | exit 1; 7 pass, 1 fail, Ran 8 tests across 1 file | same |
| apps/web/test/legal-sync.test.ts | exit 1; 6 pass, 1 fail, Ran 7 tests across 1 file | same |
| apps/web/test/pages.test.ts | exit 1; 86 pass, 6 fail, 1 error, Ran 92 tests across 1 file | same (same 6 tests) |
| apps/web/test/guide.test.ts | exit 1; 12 pass, 1 fail, Ran 13 tests across 1 file | same |
| apps/web/test/no-internal-notes.test.ts | exit 1; 3 pass, 1 fail, Ran 4 tests across 1 file | same |

Logs: results/rerun-*.log, results/rerun.txt.

## Base comparison (commit 752ff60, separate worktree ../base, bun install exit 0)

| File | Base result |
|---|---|
| apps/edge/test/data-map.test.ts | pass (8 pass, 0 fail) |
| apps/web/test/legal-sync.test.ts | fail (6 pass, 1 fail) |
| apps/web/test/pages.test.ts | fail (85 pass, 2 fail, Ran 87 tests): only the 2 tests "Create a new game like this one" and "Rescheduling: a date more than 30 days ahead..." fail; the 4 My people tests (IDs, paste cleans, big paste, contacts) pass |
| apps/web/test/guide.test.ts | pass (13 pass, 0 fail) |
| apps/web/test/no-internal-notes.test.ts | pass (4 pass, 0 fail) |

Logs: results/base-*.log.

## Compare with run 3 (cloud/luck-run3-results-2026-10-30: edge 1151/0, web 260/6+1 error)

- edge: run 3 had 0 fail; run 4 has 1 fail (data-map.test.ts, "the player page asks for exactly the fields the data map lists"). New. Pass 1151 -> 1153.
- web: run 3 had 6 fail + 1 error, all in pages.test.ts. Run 4 has the same 6 pages.test.ts tests (names matched by the first words of the test names) + 1 error still failing. Gone: none. New: legal-sync.test.ts, guide.test.ts, no-internal-notes.test.ts (one test each). Pass 260 -> 257, fail 6 -> 9.

## Not run

- None. Every folder printed summary lines.
