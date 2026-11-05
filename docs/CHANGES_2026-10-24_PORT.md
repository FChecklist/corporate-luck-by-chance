# Changes of 2026-10-24: platform changes brought over from Corporate Tambola

What a person gives to get in
- The organizer chooses per game: `verify` = `mobile` (default) | `id` | `both`, and `employeesOnly` (only people on the list play, nobody invites; forces "only people on a list" and switches guest invites off). Set in step 2 of the console, or `PATCH /api/z/{id}/settings`.
- The employee ID is kept sealed with the name (`pii.ts`), never shown to other players, erased with the rest of the guest data. A person known by ID alone has a salted hash of the ID as their identity (`people.ts` `empHashOf`).
- Join (`worker.ts`): codes `need-id` and `bad-id`; an ID that is not on the list waits in the waiting room; in `both` mode the number and the ID must belong to the same listed person; an outsider (no ID) can still give a mobile number unless the game is employees only.
- The people list takes an Employee ID column (type, paste, CSV, and PDF with a preview before anyone is added). The PDF is read on the organizer's own device with the bundled pdf.js (`apps/web/public/vendor/pdfjs`). The list download has the Employee ID column only when IDs are asked for.

Games for up to 10 people cost Rs 0
- A game for 10 people or fewer publishes without payment and is a real game in every way; nothing on any screen marks it. It is the first size in the console and on the home page.

Console
- Each step is tinted in its own colour; a small hint sits under every group of boxes; options that depend on a box stay hidden until it is ticked; the AI work-link strip and prompt box are not shown to the organizer or the host.

Other
- Three test sign-ins: `demo1@xyz.in`, `demo2@xyz.in`, `demo3@xyz.in` with code `123456` (no e-mail is sent). `TEST_LOGINS` in `worker.ts`; empty the list to switch them off.
- The beacon asks the next mirror after 1.2 s (or at once on a failure) and takes the first valid answer; the clock uses the newest of the last five answers.
- `apps/web/public/zgame.js` (the console's bundle of the beacon code) is not rebuilt here: this machine's bun names functions `ss`/`ls`, which the storage-notice scan (R9) reads as device storage. Rebuild with `bun run build:zgame` where the usual bun is installed; the source changes are in `packages/beacon/src`.
