# Privacy and the life of a game's data (the data map, as built, 2026-10-14)

This is the data map for gates D1, D2 and D11. It is written from the code, not from memory: `apps/edge/src/luck.ts` (tables `luck_t`, `luck_p`, `luck_v`), `apps/edge/src/worker.ts` (join, schema), `apps/edge/src/rights.ts` (a player's own requests), `apps/edge/src/lifecycle.ts` (deletion), `apps/edge/src/pii.ts` (sealing), `apps/edge/src/audit.ts` (security log), `apps/web/public/luck.js` (the player page). If you change one of those, change this page in the same step. `apps/edge/test/data-map.test.ts` reads this page.

Short version: a player gives a nickname and nothing else. (A number appears only if an organizer puts one in a people list, section 2c.) The organizer is the controller of those details; we are the processor. All players' details are deleted 20 hours after the game ends (the promise is "within 24 hours"). The winners record (place numbers only) and the organizer's details stay until 00:00 IST at the end of day 365, then everything goes. Invoices and the payment ledger are kept for the legal period, apart from the game data.

## 1. The player notice (the two boxes shown before the name is asked)

The wording is in `apps/edge/src/consent-text.json` (point K4); the page fetches it from `GET /api/consent/text?kind=K4`. Two boxes, never ticked in advance, both before any name field works:

- A: the name (and a mobile number, employee ID or e-mail address, if this game asks for them) is used for this game only and deleted within 24 hours after it ends; who invited the player is recorded until then; the final places are kept for 365 days as seat numbers, without names; billing data is kept for audit and tax reasons (that is the organizer's, not the player's); the notice is available in Hindi on request.
- B: the player is 18 or older. Nothing else: there is no "or on a parent's device" alternative (adults only, Terms clause 12).

The Join button stays disabled until both are ticked, and the server refuses a join without them. The server stores one row per acceptance in `consent_log`: the place id, the point (K4), the game id, the Terms version, the boxes, a hash of the exact wording, and the time. It holds no name, number, address or device. When the Terms version changes (it is `TERMS_VERSION` in `apps/edge/src/brand.ts`, today 2026-10-15; the wording file `consent-text.json` carries the same value), the next join asks again.

<!-- notice:start -->
asked_from_player: name
asked_if_organizer_switches_on: mobile number, e-mail
<!-- notice:end -->

The block above is read by `apps/edge/test/data-map.test.ts`: it fails when the join notice mentions a field this list does not have, when this list has a field the notice leaves out, or when the player page asks for a field that is not listed.

## 2. The data map

"Who" means who holds or processes the data. **CF** = Cloudflare (Workers, D1 database, Pages: hosting and storage). The database is one D1 database kept in Cloudflare's Asia-Pacific region; the website is served from Cloudflare's global network. We do not run a backup process of our own.

### 2a. Players

| Field | Why | Where stored | Who | How long |
|---|---|---|---|---|
| Nickname, typed by the player (2 to 40 characters, markup removed) | To show the player on the top-10 list; so the organizer knows who took part | **Sealed** (AES-256-GCM) in `participant.pii` at join | CF | Deleted 20 h after the game ends |
| The same nickname, in the clear, written when the Organizer or a Host presses Start | Every phone must show the top-10 list, and a sealed name cannot be shown to thousands of phones cheaply | `luck_p.name` (the frozen seat list) | CF | `luck_p` deleted 20 h after the end |
| Seat number and player id (`pid`: the seat number and a hash) | To tell players apart without a name; the result lists seat numbers, never names | `seat`, `participant.pid`, `luck_p`, `luck_v`, the seat list `kv seats-base/<id>` | CF | Seat, participant and the seat list deleted 20 h after the end |
| A hash of the phone's random device id (first 32 characters of `sha256("dev" + game id + device id)`) | One place per phone; a vote or a press comes only from the phone that joined | `seat.dev` | CF | 20 h after the end |
| A second hash of the same device id, used as the lookup key for "the same person again" | Same | `participant.phone_hash`, `seat.ph` | CF | 20 h after the end |
| Join time; a round number if the player joined after the game began | Report; late-join marker | `participant.joined_ms`, `seat.jr` | CF | 20 h after the end |
| How the player joined (direct, or through an invite link), who invited them, invite category, role flag (organizer, host, co-host), "removed" flag | Invite counts; the organizer can remove a person | `seat.src`, `seat.inv`, `seat.cat`, `seat.role`, `seat.blocked`, and a row in `person` (sealed, hashed key, inviter, status) | CF | 20 h after the end |
| Consent record: seat id, point, game id, Terms version, boxes, hash of the wording, time | To show the boxes were ticked | `consent_log` | CF | K4 rows: 20 h after the end. Organizer rows stay with the account |
| The phones' result votes: the player id, a hash of the result, the result (seat numbers, points, hits) | A result counts only when enough different phones send the same one | `luck_v` (no names) | CF | 20 h after the end |
| A request the player made to see, correct or delete their data, or to name another person who may use these rights for them (DPDP Act s14; kind `nomination`; the person is named by e-mail to the Grievance Officer): player id, kind, a short note, three times | To answer within the promised time (7 days) | `data_request` (no name, no number) | CF; the organizer and the owner are told by e-mail (Resend) | 20 h after the game ends |
| Game settings and the seal: the fingerprint of the sealed secret, the secret (shown after the game), the settings, the seed, start and end time, number of players | Anybody can check the draw after the game | `luck_t` (no names) | CF | Until the end of day 365 |
| The agreed result: seat numbers, points, hits, best hit, a one-line tie reason | The result screen; the phones map seat numbers to nicknames from the seat list | `luck_t.result` (no names) | CF | Until the end of day 365 |
| Winners record: the seat numbers of first to fifth place | Proof of who won, with no name | `winner` | CF | Until the end of day 365 |
| Mobile number | **Asked only if the organizer chooses it** (setting `verify`: employee ID and mobile number, or an ID only with a number as the way in for an outsider). By default the player page has no phone field and only a nickname is typed. A number also appears if an organizer puts one in a people list (2c) | `participant.pii` (sealed) if given | CF | 20 h after the end |
| Employee ID | **Asked only if the organizer chooses it** (setting `verify` is `id` or `both`). Typed on the player page to match the organizer's list; also put in a people list by the organizer. Never shown to other players | `participant.pii` (sealed), `person.pii` (sealed), `waiting.pii` (sealed); for an ID-only person `person.ph` is a salted hash of the ID | CF | 20 h after the end |
| E-mail address (the Email ID) | **Asked only if the organizer chooses "Email ID" as the ID of the game** (setting `idKind` is `email`). Typed on the player page, in a box of its own, to match the organizer's list; also put in a people list by the organizer. In every other game there is no e-mail box on the player page. Never shown to other players | `participant.pii` (sealed), `person.pii` (sealed), `waiting.pii` (sealed); for an ID-only person `person.ph` is a salted hash of the ID | CF | 20 h after the end |

### 2b. What a player's phone keeps (on the phone, not on our servers)

The full list is `apps/web/storage-registry.json`, and the same sentences are on the Privacy page (`legal.html`). `apps/web/test/storage-notice.test.ts` fails when a script uses a key that is not listed. For a player: a random device id (`luck:device`), the player id of each game (`luck:<id>:pid`) and the last game opened (`luck:last`), plus the saved page files. There is no cookie on a game page.

### 2c. Lists the organizer types or pastes (people lists, waiting room)

| Field | Why | Where stored | Who | How long |
|---|---|---|---|---|
| Name and mobile number of each invited person | To send a personal invite link | `person.pii` (sealed), `person.ph` (hash of the number), `person.tok_hash`/`tok_sealed` (the personal link), inviter, status, who approved | CF | 20 h after the end |
| Name and mobile number of a person waiting to be let in | The waiting room | `waiting.pii` (sealed), `waiting.ph` | CF | 20 h after the end |

### 2d. Security log (kept for security, disputes and the law; read only by the owner)

Every action that writes something (join, consent, claim, start, pause, console edits) adds one row to `audit_log` (`apps/edge/src/audit.ts`). Plain reads add nothing.

| Field | Why | Where stored | Who | How long |
|---|---|---|---|---|
| For a **player's** action, the personal part: full network address, browser string, browser and system name, network number, the raw device id and its hash, the time and zone the phone says it has, the fields sent (for a join: the name; passwords, codes, keys and place words are replaced by "[redacted]") | Security, disputes, fair play | `audit_pii.sealed`, sealed under a **per-game key** whose salt is in `eng_key` | CF | **Destroyed 20 h after the end** (crypto-shredding: the salt and the blobs are deleted, so the key can never be made again) |
| For a player's action, the non-personal core: event type, server time, country, status, request reference, a hash of the personal part | Counts, hash chain | `audit_log` | CF | Until the end of day 365 |
| For the **organizer, host, co-host or an AI key**: the same fields, whole, sealed with the platform key | Security, disputes | `audit_log.sealed` | CF | Until the end of day 365 |
| For an **anonymous visitor** (no game and no organizer: a refused request, a failed payment, a wrong key): the same fields, whole, sealed with the platform key, but the network address is first cut to its first part (IPv4 /24, IPv6 /48, `truncateIp` in `audit.ts`). These rows live in their own chain, `anon` | Security, disputes | `audit_log.sealed`, chain `anon` | CF | **90 days** (`sweepAudit`), not 365 |
| Owner access log: when the owner read or downloaded a log | Accountability | `audit_access` (no personal data) | CF | Kept |
| Deletion certificate and anonymous statistics (counts by event, country, AI vendor) | Proof that deletion happened | `audit_cert`, `audit_stats` (no personal data) | CF | Kept |

### 2e. Network-address hashes for limits, and public-page records

| Field | Why | Where stored | Who | How long |
|---|---|---|---|---|
| A short hash of the network address (16 characters) used as a counter key for "too many joins per minute and per day from one address" | Free-plan protection | `kv jbm/...`, `kv jlim/...` | CF | 2 days |
| Monitoring from `rum.js` on the pages: page path (no query string), referrer site name, device class, speed figures, script errors, and for a failed or slow API call the API path and the time it took. No cookie, no network address, no name. Country comes from Cloudflare | To see crashes and slowness | D1 table `telemetry` (`pages/functions/api/telemetry.ts`) | CF | 90 days |
| Visits to the **public website pages only** (home, legal, pricing, sign-in, payment entry; never a game page): visitor id, shortened network address and a keyed hash of it, source, landing page, device, country, city, sections seen, choices made. With Global Privacy Control or Do Not Track, only anonymous daily counters | To see how companies find the site | `visit_session`, `visit_event` (`apps/edge/src/visits.ts`, `v.js`) | CF | 365 days, then rolled into anonymous daily totals (`visit_agg`) |

### 2f. Organizers, hosts, co-hosts, partners

| Field | Why | Where stored | Who | How long |
|---|---|---|---|---|
| Organizer e-mail (sealed, plus a hash for sign-in), sign-in keys, terms version accepted, the lasting AI key (sealed) | Sign-in, invoices, mail | `organizer_key`, `organizer_email`, `kv orgmail/ aikey/`, `organizer_terms` | CF; Resend sends the mail; optionally Google if "Continue with Google" is switched on | While the account exists (the organizer can close it) |
| Organizer's e-mail and mobile number, confirmed at Publish | Contact for the game and the report e-mail | `kv contact/<id>` | CF | End of day 365 |
| Game settings the organizer chose: occasion name, start time, size limit, invite-only, invitation policy, time zone, brand name, accent colour and small logo (not personal) | To run the game | `engagement` (`config` column) | CF | End of day 365 (a draft nobody published: 30 days) |
| Host name, e-mail or mobile (sealed), label | A Host runs the game | `organizer_key` (`email_sealed`, `pii`, `label`) | CF, Resend | Host: while the key lives. A Co-host's name and mobile are deleted with the players' data (20 h after the end) |
| Sign-in codes and links (hash only) | Sign-in | `login_code` | CF | 10 minutes; row deleted 1 day after expiry |
| Mail outbox | A mail that failed is retried | `outbox` | CF | A sent mail keeps no body; every row goes after 3 days. `purgeOutbox` runs from the 5-minute tick every hour |
| Mail delivery events from the mail service (bounced, complained, delivered): a one-way hash of the address, the address with its middle hidden (j***@example.com), the subject line, the kind, the time | So the owner can see which mails did not arrive and tell the organizer | `mail_bounce` (no name, no full address) | CF; the mail service (Resend) sends the event | 90 days |
| AI work link: log of each call (time, key id, call, status, network address, program, country) | The organizer can see what their AI did | `ai_audit` | CF | 365 days |
| Partner (refer and earn): name, random code, hashes of phone and e-mail | Commission | `partner`, `commission` | CF | While active; commissions kept as accounting records without a link to a person |

### 2g. Money

| Field | Why | Where stored | Who | How long |
|---|---|---|---|---|
| Payer name, organisation, e-mail, mobile, country, GSTIN; amount, tax, pack, Razorpay order and payment ids | Invoice, tax, accounting | `payment`, `invoice`, `entitlement`; a copy of the organizer's invoice details and who paid in `legal_party`, written at payment and again just before the game is deleted | CF; **Razorpay** takes the payment, only through the central service "IT Services by Rajat Agarwal" (site `corporate-luck-by-chance.pages.dev`, product `corporate_luck_by_chance`, plan `luck_pack_<N>`) | For the legal period, separate from game data; never deleted by code |
| Payment ledger and webhook log (one ledger for every product) | Reconciliation | `payment_ledger` view, webhook log | CF, Razorpay | Same |
| A note to the owner on each paid order: game, plan, amount, transaction id, organizer name and e-mail | The owner sees every order | An e-mail (Resend) to the owner; the claim that it was sent is `kv ownerpaid/<payment id>` | CF, Resend | The claim row stays with the payment records |

No place or bank details are ever stored or logged. Players never pay.

## 3. Who processes data for us

| Processor | For what | Which data | Where |
|---|---|---|---|
| Cloudflare | Hosting (Pages), the Worker, the D1 database | Everything stored above | The website: Cloudflare's global network. The database: Cloudflare's Asia-Pacific region |
| Resend | Sending e-mail | Organizer and host e-mail addresses and the mail text. Never players: players give no e-mail | United States, as published by Resend |
| Razorpay (through IT Services by Rajat Agarwal) | Taking payment from the organizer | Payer details and amount | India, as published by Razorpay |
| Google (optional) | "Continue with Google" for organizers and hosts | The e-mail address the person signs in with | United States, as published by Google |
| IT Services payment service (`itservices-rajat-agarwal.pages.dev`) | Starts the Razorpay payment and records each payment for the organizer's invoice and our accounts (never players) | Payer details and amount | Cloudflare |
| GitHub | Runs the scheduled jobs (the 5-minute deletion timer) and keeps a private copy of the payment records (organizers' payments only, never players) | Payment records; no player data | United States, as published by GitHub |

**Supabase is not used by this product.** There are no third-party trackers: the only monitoring is our own (`rum.js`, `v.js`). A player's phone contacts drand (a public random beacon) and, only if the organizer adds a video break, YouTube in privacy mode.

## 3a. Where the data is, and what we do not claim

* The database is a Cloudflare D1 database in the **Asia-Pacific region** (read with `wrangler d1 info`, 2026-10-14: `running_in_region: APAC`, no jurisdiction pinned, no read replicas). That names a region, not a country.
* The website and the Worker run on Cloudflare's global network, so a request is handled in the data centre closest to the person. Data is stored only in the database above.
* We run **no backup of our own** and do not promise any backup period. Deletion is from our live database within 24 hours after the game ends. (A later step may add a backup process; this page and the legal pages will say so when it exists.)
* Resend, Razorpay and Google process what is listed in section 3 in their own countries.

## 4. The clock and ways to delete

1. The game ends when the phones' result is agreed (`luck_t.state` becomes `done`), or 10 minutes after the last dice round with no agreement (`NO_AGREEMENT_MS`: the game is closed and no result is published).
2. Minutes after the end the organizer gets one e-mail with a link to a report page. The organizer's own browser builds the report. The link works until 19 hours after the end (a reminder goes about 6 hours before it closes, if it was never opened).
3. **20 hours after the end** (`PURGE_AFTER_MS`), whether or not the report was opened, `erasePersonal` deletes: `participant`, `seat`, `person`, `waiting`, `luck_p`, `luck_v`, `data_request`, the K4 rows of `consent_log`, the seat list and the report working copies (`kv seats-base/ rpt/ rptopen/ rptremind/ rptc/ seats-blk/`), the game's Co-host details (name, mobile number, key), and the personal part of the security log (crypto-shredded). An owner-set legal hold suspends this.
4. What stays: `luck_t` (no names), `winner` (seat numbers), `life`, the organizer's details, the security log's non-personal core, payments and invoices.
5. **00:00 IST at the end of day 365** after the end (`fullDeleteAt`): `eraseEverything` deletes the rest of the game (`luck_t`, `winner`, `life`, the engagement, the Co-hosts, the security log and its keys, `data_request`). Before that, the organizer's invoice details are copied into `legal_party` (see 2g).
6. A game nobody paid for and that never started is treated the same way: its people's data is erased 20 hours after it was meant to end, and the game is closed (`unplayedPass`). A cancelled game erases 20 hours after the cancel.
7. The caller is the scheduled job: `POST /api/lifecycle/tick` every 5 minutes (Supabase `pg_cron`, and GitHub Actions in the `scheduler` repository). Any organizer request also nudges it as a safety net. The tick also forgets mail-log rows older than 3 days (every hour) and the health address `GET /api/status/health` raises `ok: false` with `overdue_purge` when a game is more than 3 hours past its 20-hour deletion and still holds players.

Earlier deletion: the organizer can press Erase in the console; an AI assistant can only ask (the organizer confirms); the organizer can reply "delete" from the registered e-mail address (needs a confirmation code). **A player can do it too**: "Leave this game" (`POST /api/z/<id>/leave`) and "What do you hold about me / delete me" (`POST /api/z/<id>/datareq`, `apps/edge/src/rights.ts`). The player proves who they are with the player id and the phone's own device id. Before the Organizer presses start, the seat and the details are deleted. After the start the seat stays on the frozen seat list (the result is worked out from that list), blocked, with the nickname replaced by "Left player" and nothing personal left; a nickname already printed in the agreed result is not in `luck_t.result` (it holds seat numbers only), so nothing else needs to change. The request is stored, the organizer and the owner are told by e-mail, the player is shown the promised answer time (`PROMISE_DAYS = 7`), and an erasure is carried out at once.

## 5. Security log and crypto-shredding (how it works)

- Rows can only be added; each row carries the hash of the one before, so a removed or edited row is detected (`GET /api/owner/audit/<id>/verify`).
- A **player's** row is split. The non-personal core stays in `audit_log` with a hash (`pdig`) of the sealed personal blob; the blob lives in `audit_pii`, sealed under HKDF(`DATA_KEY`, a random 32-byte salt kept in `eng_key`, "participant/<id>"). Deleting the salt and the blobs makes the key impossible to make again, even for someone who holds `DATA_KEY`. The hash chain still verifies afterwards.
- Only the owner (platform key) can read or download the log, and every such use is written to `audit_access`. An AI vendor never receives network addresses or device ids.
- A legal hold set by the owner stops the 20-hour shredding and the 365-day deletion until it is lifted.

## Corporate Luck by Chance: the game's own tables (migration 0021_luck.sql)

| Table | What it holds | Personal data | Deleted |
|---|---|---|---|
| `luck_t` | One row per game: the fingerprint and the sealed secret, the settings, the seed, the start and end time, the agreed result (seat numbers, points, hits, best hit, a one-line tie reason) | None. No names, no numbers, no device ids. | With the game, at the end of day 365 |
| `luck_p` | The frozen seat list: seat number, the participant id, the nickname the player typed | The nickname | 20 hours after the end of the game (the promise is 24 hours) |
| `luck_v` | One row per phone that sent a result vote: the participant id, a hash of the result, the result (seat numbers only) | The participant id only | 20 hours after the end of the game |

What the game does NOT keep: any dice, any score or any ranking computed by the server. The phones compute them from public numbers; the server only keeps the result the phones agreed on. No payment code runs on any player route.
