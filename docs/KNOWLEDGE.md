# Knowledge: Corporate Luck by Chance (corporate-luck-by-chance)

Written 20 Nov 2026 (PR 11) and brought up to date on 21 Nov 2026 (version 1.5.2) for a future AI session that has never seen this repo (standard: marketing-ledger plans/VERSION-AND-KNOWLEDGE-STANDARD-2026-11-20.md). It describes the CURRENT state only, from the code and existing docs. Anything not found is marked "unknown". Do not publish this file on the website.

## 1. What this is
Pure-luck dice game for company events: ten rounds of ten dice rounds, a target number from 1 to 6, a strict top 10 with no ties. The game runs on the players' phones; the server keeps the sealed secret, the list of players and the votes.
- Live site: https://luck.corporatetambola.com (Cloudflare Pages project `corporate-luck-by-chance`).
- Live now: **1.5.1**, deployed 2026-11-20 18:52 UTC (Pages deployment `7fb0c286`), built from the default branch head `1736b9a` (the merge of PR 12). It is dark: `PAY_VIA_CONSOLE` is unset, so the old Pay now flow works exactly as before and no real payment flag was switched. The live `/version.json` has `commit` and `builtAt` but no version number; the number appears there from 1.5.2 on.
- Version in the repository: **1.5.2** (the owner rules v1.1 change, PR in this repo; not deployed). Nothing live changes until the owner says go.
- Where the history is: `CHANGELOG.md` (plain-language, newest first), `version.json` (the number and the last changes), `docs/DEPLOYS.md`. PR 11 (first knowledge notes) and PR 13 (the 1.5.1 deploy record) are folded into these files by the 1.5.2 pull request: close them when it merges; do not merge them as well.
- Other repos and what they are for: `KNOWLEDGE-MAP.md` in the repo root.

## 2. How it connects
Players and organizers reach the suite like this: home.corporatetambola.com (login gate) -> console.corporatetambola.com (set up, invite, pay) -> moneypenny.corporatetambola.com (credits; the single payment gate) -> IT Services by Rajat Agarwal -> Razorpay. Each game is its own website and takes settings from the console by API; a game calls ONLY Moneypenny for payment, never IT Services or Razorpay. The console-to-game contract is `docs/CONTRACT_V1.md` and `contract/` in corporate-console; the pay contract is `GAME_PAY_CONTRACT.md` (console repo). This game's side of the Pay step is `apps/edge/src/console-pay.ts`, `apps/edge/src/console-bridge/` and `apps/web/public/pack/` (vendored byte for byte, with manifests) and is described in `docs/CONSOLE_PAY.md`. It was audited and must not be changed without a new audit. Moneypenny chat: moneypennychat.corporatetambola.com.

## 3. Map of folders and the files that matter
apps/edge (the Worker: `worker.ts` routes and join, `luck.ts` the game on the server and the two ways to start, `people.ts` the lists, `invite-id.ts` the one ID field, `winners.ts`, `pay.ts`, `console-pay.ts`, `lifecycle.ts` deletion, `trust-page.ts`, `ai-facts.ts`, migrations up to 0026_helpdesk.sql), apps/web/public (the pages: `zc.js` console, `host.js` run the game, `luck.js` player page, `guide.js` the plain explanations of every server message), apps/cron, packages/luck (the game itself), packages/beacon (settings, `config.ts`), packages/billing, packages/shared, pages/ (build, `version.mjs`), site/ (static marketing copy), tools/, docs/.
Files that matter first: `docs/RULES.md` (R01 to R83, each with a test), `apps/edge/src/luck.ts`, `apps/edge/src/people.ts`, `apps/edge/src/invite-id.ts`, `apps/edge/src/worker.ts`, `apps/web/public/zc.js`, `pages/version.mjs`.

## 4. Rules in force
- Suite rules version 1.1 (20 Nov 2026): `docs/SUITE_RULES.md` (the owner's text, then section 6 says what this repo does about each rule, section 7 what is open for the owner); console voice: `docs/CONSOLE_VOICE.md`; source in the ledger `plans/SUITE-RULES-VERSION-2026-11-20.md`.
- Invite by ID only: ONE alphanumeric ID, no names or personal details; every non-alphanumeric character is removed and the rest upper-cased (A-1101 = A 1101 = A/1101) at upload, join, approval and matching; a person not on the list waits for the organizer's or host's yes or no. The list and all IDs are deleted 23 hours after the game ends (inside the "within 24 hours" promise). Rules R76 to R80.
- Two ways to start: "You start the game" (default) and "The game starts by itself". Rules R72 to R75.
- Console voice = "you", polite, simple English, never "I". Rule R71, test `apps/web/test/console-voice.test.ts`.
- Fairness wording must be true in code. The owner's line "No one knows the next number: not the organizer, not the host, not even the software" is NOT used: the server draws the secret and holds it until the game is over (`docs/RULES.md`, Known limits). No page may say "not even us". Rule R81.
- A default game takes 24 minutes 40 seconds (R30, R82). Personal data goes at 23 hours (R44, R67, R83).
- One login (home), one console, one credit and payment system (Moneypenny), one chatbot system; no game or console has its own login, payment or chat; pay only via Moneypenny. Billing line only "We keep billing data for audit and tax reasons."
- Do not claim "100% secure", "most secure gateway", "played by major companies". Prizes: "You (the company) give the prizes directly to the winners."

## 5. How to run the tests
`bun install` once (the folder starts without its packages), then `bun test packages apps tools/control-worker` (about 2 minutes) and `bun run typecheck` (`tsc --noEmit -p tsconfig.json`).
At 1.5.2 three tests fail that also failed at 1.5.1, for reasons outside this change: `legal-sync.test.ts` (the legal position page in `site/` says "Corporate Tambola" in one sentence where the app page says this game), and two console tests in `pages.test.ts` ("Create a new game like this one" and "Rescheduling ...") that use dates in October 2026 and fail once the clock has passed them. Everything else passes.
RAM on the owner's laptop is tight: no full builds or browsers without the heavy lock (C:/ct/HEAVY_JOB_PROTOCOL.md).

## 6. Deploy and roll back
Cloudflare Pages project `corporate-luck-by-chance` (Cloudflare only, no Vercel): `bun run pages:deploy`. Rollback in the Cloudflare dashboard. Previous deploy ids: for 1.5.1 the rollback id is `0e6b70dc-3ff4-44d0-ab80-9c0eb72971c8` (commit ebda7644); for 1.5.2 it is `7fb0c286` (the 1.5.1 deployment; only the short id is recorded).
Nothing is deployed from a docs-only change. Every deploy needs a version bump, a CHANGELOG entry (with two audit PASS ids and the previous deploy's rollback id) and the same number in `version.json` and in this file (test R84 in `apps/web/test/version-stamp.test.ts` fails when they differ). Money flags stay OFF until the owner says otherwise; no real payment is made in any test.

## 7. Known issues and open failures
- The three tests named in section 5.
- The invite-list tick box (Terms box K6) still says "names and numbers": fixed legal wording tied to the Terms version; the owner must approve new text and a new Terms version.
- A game made through the API alone can still be "anyone with the link"; the console no longer offers it. The owner has to say (SUITE_RULES.md, section 7).
- Guests who win confirm their name and mobile number to collect a prize (`winners.ts`); that is separate from the invite list and was not changed.
- Hosts and Co-hosts still have a name and a mobile number (their own contact, not an invite).
- Rupee sign in prices (owner rule): not done in 1.5.2.
- The footer `vX.Y.Z` and a "What's new" page are not built (`docs/VERSIONING.md`).

## 8. Owner-only steps still open
Secrets and keys are the owner's (names only in config/SECRETS_NAMES.md where present). Deploy, domain, payment live mode and the Rs 1 payment test are for the owner to decide, through BOSS. Versioning work still to do in this repo: `docs/VERSIONING.md`.
