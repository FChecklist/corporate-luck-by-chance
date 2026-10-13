# The game: where to look

The rules of the game are in `docs/RULES.md` (one plain sentence per rule, R01 to R57, each with a test whose name starts with the rule number).
The product description is `docs/SPEC.md`.

## Code map

| What | File |
|---|---|
| The draws: stream of numbers from a seed, unbiased pick 0 to n-1 | `packages/luck/src/random.ts` |
| The organizer's choices (rounds, press window, prizes) and their checks | `packages/luck/src/settings.ts` |
| The clock of the game: when each dice round opens, when each beacon value is due, where the game is now | `packages/luck/src/timeline.ts` |
| Target, dice, score, the strict ranking, fate, prizes, one game played dice round by dice round | `packages/luck/src/engine.ts` |
| The engine for the pages (built into `apps/web/public/luck-engine.js`) | `packages/luck/src/browser.ts` |
| The game on the server: sealed draw, seat list, beacon feed, result votes | `apps/edge/src/luck.ts` |
| When personal data is deleted | `apps/edge/src/lifecycle.ts` |
| How a name is sealed | `apps/edge/src/pii.ts` |

## Pages (`apps/web/public/`)

| Page | For | Script |
|---|---|---|
| `z.html` | the player (phone) | `luck.js`, `luck-run.js`, `luck-engine.js` |
| `big.html` | the big screen (no sign-in) | `big.js`, `luck-run.js`, `luck-engine.js` |
| `host.html` | the host: choose rounds, press window and prizes, start | `host.js` |
| `demo.html` | try five dice rounds on one page | `demo.js` |

## Tests

- `bun test packages/luck` (the game, R01 to R33).
- `bun test apps/edge/test/luck.test.ts` (the game through the real Worker routes, R34 to R47).
- `bun test apps/web/test/luck-page.test.ts` (the join screen and the play screen in a simulated phone browser).
- `bun tools/sim2/luck-sim.ts` (1,000 phones, a full game).
- One heavy command at a time on this laptop. See `docs/RUNNING.md`.
