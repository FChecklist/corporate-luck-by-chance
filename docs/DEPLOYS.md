# Deploys

What is live, and how to know.

* Open `/version.json` on the site. It holds `commit` (the git commit the pages were built from), `dirty` (true if files differed from that commit), `builtAt` (UTC) and `game`. It holds nothing else.
* A deploy is made with `bun run pages:deploy`: it builds `pages/public` (which writes `version.json`), then uploads it to the Cloudflare Pages project `corporate-luck-by-chance`. The Worker's database changes are the numbered files in `apps/edge/migrations`.
* TEST or LIVE mode (whether real payments are taken) is separate from a deploy: `GET /api/mode`.

## Last deploys of `corporate-luck-by-chance`

Read from Cloudflare Pages on 2026-10-14 01:14 UTC. Refresh this table with `node tools/list-deploys.mjs` (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment).

| Time (UTC) | Environment | Branch | Commit | Result | Deployment |
|---|---|---|---|---|---|
| 2026-10-13 22:30 | production | main | 67e1a74 | ok | https://9cf8d4a6.corporate-luck-by-chance.pages.dev |
| 2026-10-13 19:39 | production | main | d533229 | ok | https://391c5790.corporate-luck-by-chance.pages.dev |
| 2026-10-13 13:46 | production | main | 2033596 | ok | https://fb4aa020.corporate-luck-by-chance.pages.dev |
| 2026-10-13 11:13 | production | main | b9f684c | ok | https://e4ae5afb.corporate-luck-by-chance.pages.dev |
| 2026-10-13 11:02 | production | main | b09d856 | ok | https://0ca68248.corporate-luck-by-chance.pages.dev |
