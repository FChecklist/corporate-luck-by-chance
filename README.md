# Corporate Luck by Chance

A company event game of pure luck. An organizer makes a game, shares one link, and the players open it on their phones. In each dice round a target number from 1 to 6 appears, everybody presses the dice, and a player whose dice shows the target scores that many points. Ten dice rounds make a round; a game has 10 rounds by default (1 to 20). The phones do the work: each phone computes every player's score from public random numbers, so the server does almost nothing while the game runs. The software decides everything; there is always a clear 1st to 5th and a top 10 with no ties. Players never pay and never stake money; there are no cash prizes. Adults (18+) only.

**Everything is local. Nothing is deployed.** There is no live site, no live database and no live payment. The names `corporate-luck-by-chance.pages.dev` and the Cloudflare ids in the config files are placeholders for the day the owner says go.

## Layout

| Folder | What is in it |
|---|---|
| `packages/luck` | The game: target, dice, scoring, the strict ranking, prizes, the clock of the game. Plain TypeScript, no server, no randomness of its own. |
| `apps/edge` | The Worker (Cloudflare Worker + D1 database): routes, the sealed draw, the seat list, the beacon feed, result votes, payments, e-mail, deletion of personal data. Migrations in `apps/edge/migrations`. |
| `apps/web/public` | The pages: `z.html` (player), `big.html` (big screen), `host.html` (host), `zc.html` (organizer console), the public website pages. |
| `apps/cron` | The scheduled job that closes games and runs the deletion job. |
| `site/` | The finished static website and legal pages for this product. |
| `tools/sim2` | The simulations. `luck-sim.ts` plays a full 10-round game with 1,000 phones through the real routes. |
| `docs` | The documents. Start with `docs/README.md`. |

`packages/beacon`, `packages/billing` and `packages/shared` are shared code the Worker imports (settings, money, helpers).

## Run the tests

Bun is the runtime. One heavy command at a time: the laptop has little free memory.

```
bun test packages/luck
bun test apps/edge/test/luck.test.ts
```

More in `docs/RUNNING.md`. The rules are in `docs/RULES.md`; each rule has a test whose name starts with the rule number.

## The money and the data, in one paragraph

Payments go only through the central service "IT Services by Rajat Agarwal" (Razorpay). Players' nicknames are deleted 23 hours after the game ends (the promise is 24 hours); the organizer's details and the winners record (seat numbers only) stay until 00:00 IST at the end of day 365, then everything goes. Invoices and the payment ledger are kept separately for the legal period. The data map is `docs/PRIVACY_AND_LIFECYCLE.md`.

Contact: rajatsiroffice@gmail.com, +91 96503 97480.
