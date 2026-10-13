# Running Corporate Luck by Chance on this laptop

Bun is not always on the PATH on the build machine: use the full path of `bun.exe` (or `bun` if installed). **Everything is local. Nothing is deployed.** Never run `bun run pages:deploy`, `wrangler deploy` or `wrangler secret` from here.

RAM rule on the shared laptop: one heavy command at a time (take `C:/ct/heavy.lock`). A test run, a build and a browser together can use more memory than is free.

## Tests

```
bun install
bun test packages/luck                             # the game (R01 to R33)
bun test apps/edge/test/luck.test.ts               # the game through the real Worker routes (R34 to R47)
bun test apps/web/test/luck-page.test.ts           # the join and play screens in a simulated phone browser
bun run build:luck                                  # rebuild apps/web/public/luck-engine.js from packages/luck
bun run typecheck                                  # tsc --noEmit
bun test packages apps tools/control-worker        # everything (heavy)
```

The first two are the ones that matter for the game. The whole suite also covers the parts shared with the sister product (payments, roles, deletion, e-mail).

## Local server

```
bun run zlocal           # website + API on http://localhost:8788, SQLite in memory unless DB_FILE is set
```

- Player: `http://localhost:8788/z.html?e=<game id>`. Big screen: `/big.html?e=<id>`. Host: `/host.html?e=<id>` (opened from the organizer console, `/zc.html`).
- `TEST_MODE=1` gives test payments and shows sign-in codes in the answer. Never set payment keys locally.
- `PORT`, `ORGANIZER_SECRET` and `DB_FILE` are read by `apps/edge/src/local.ts`.

## Simulation

```
bun run sim:luck         # bun tools/sim2/luck-sim.ts: a full 10-round game with 1,000 phones through the real routes (about a minute)
```

`tools/sim2/smoke.mjs`, `sim:life`, `sim:matrix` and `sim:ui` were written for the sister product (Corporate Bingo). They have not been checked against Luck by Chance; do not trust a result from them yet.

## Build steps

```
bun run build:control    # apps/web/public/control.js (organizer console)
bun run build:report     # apps/web/public/reportgen.js (organizer report page)
bun run pages:build      # copy the files a deploy would use into pages/public (does not deploy)
```

`build:zgame` belongs to the sister product's phone page and is not used by Luck by Chance.
