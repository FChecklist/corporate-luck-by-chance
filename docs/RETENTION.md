# What we keep, and for how long

Corporate Luck by Chance, as built on 2026-10-14. Everything is kept in one Cloudflare D1 database (table `kv` holds small keyed records). Two things enforce this schedule: the lifecycle job (`apps/edge/src/lifecycle.ts`, `lifecycleTick`) and the sweep (`purgeOld` in `apps/edge/src/worker.ts`). Both run from the scheduled tick, `POST /api/lifecycle/tick`, called every 5 minutes (Supabase `pg_cron` job `game-ticks`, and GitHub Actions in the `scheduler` repository as a second trigger). The sweep and the mail-log clean-up also run from `scheduled()` and from the first organizer request of each UTC day, as a safety net. The data map with every field is `docs/PRIVACY_AND_LIFECYCLE.md`. Tests: `apps/edge/test/retention.test.ts`, `privacy.test.ts`, `shred.test.ts`, `luck.test.ts`, `luck-end.test.ts`.

"End" means the moment the phones agree on the result, or 10 minutes after the last dice round if they never agree, or the scheduled end if neither happened. The promise to players is "within 24 hours"; the job deletes at **23 hours** (`PURGE_AFTER_MS`). The health address `GET /api/status/health` raises an alarm (`ok: false`, `overdue_purge`) when a game is more than 30 minutes past that and its players' data is still stored, and the scheduler's uptime check fails on it.

| Data | Where | Kept | Then |
|---|---|---|---|
| Player nickname (sealed copy), seat, device hashes, consent record (Terms version, boxes, hash of the wording, time), invite record, people lists, waiting requests, report working copies | `participant`, `seat`, `person`, `waiting`, `consent_log` (K4 rows), `kv seats-base/ rpt* seats-blk/` | 23 hours after the end | Deleted (`erasePersonal`) |
| The nickname in the clear, written when the game starts so every phone can show the top-10 list; the phones' result votes | `luck_p`, `luck_v` | 23 hours after the end | Deleted (`erasePersonal`) |
| The personal part of players' security-log rows (network address, browser string, device id, fields sent, network number) | `audit_pii`, key salt in `eng_key` | 23 hours after the end | Crypto-shredded: salt and blobs destroyed, the hash chain still verifies |
| A player's request to see, correct or delete their data, or to name another person (card id, kind, short note, times: no name, no number) | `data_request` | 23 hours after the end, with the participants | Deleted (`erasePersonal`); again with the game at 365 days |
| Game settings, sealed seed and secret, counts, start and end times; the agreed result as seat numbers (no names) | `luck_t` | Until 00:00 IST at the end of day 365 | Deleted with the game (`eraseEverything`) |
| Winners record: the seat numbers of first to fifth place | `winner` | Until the end of day 365 | Deleted |
| The game, its settings and prize texts, the end-of-game clock, organizer contact | `engagement`, `life`, `cbl_request`, `kv control/ contact/ pub/ ann/` | Until 00:00 IST at the end of day 365 after the end. An unpublished draft: 30 days | Deleted (`eraseEverything`) |
| Security log: the non-personal core of players' rows; whole rows of organizers, hosts, co-hosts and AI keys | `audit_log` | 365 days (deleted with the game) | Deleted; an anonymous count (`audit_stats`) and a deletion certificate (`audit_cert`) stay |
| Security log of an anonymous visitor (no game and no organizer: a refused request, a failed payment, a wrong key). The network address is cut to its first part (IPv4 /24, IPv6 /48) before it is sealed | `audit_log`, chain `anon` | **90 days** | Deleted from the front of the chain by `sweepAudit` |
| Organizer account: sign-in keys, e-mail hash, sealed e-mail for our mails, sealed lasting AI key, terms version accepted | `organizer_key`, `organizer_email`, `kv orgmail/ aikey/`, `organizer_terms` | While the account exists | Deleted by "Close my organizer account" in the console (with every game and the AI audit trail) |
| Host name, e-mail or mobile (sealed) | `organizer_key` | While the Host key exists | Retired Host keys: 90 days, then deleted by the sweep |
| Co-host name and mobile (sealed), key bound to one game | `organizer_key` | Until the game's personal data is erased (23 hours after the end) or it is cancelled | Deleted |
| E-mailed 24-hour AI keys | `organizer_key` (`expires_ms`) | Expire after 24 hours; row deleted 7 days later | Deleted by the sweep |
| Retired (revoked) keys | `organizer_key` | 90 days | Deleted by the sweep |
| Sign-in codes and one-click sign-in tokens (hash only) | `login_code` | 10 minutes; row deleted 1 day after it expires | Deleted by the sweep |
| Partner sign-up codes and e-mail deletion confirmation codes (hash only) | `kv penr/ delreq/` | 10 minutes (deletion codes 30 minutes); row deleted after 1 day | Deleted by the sweep |
| Report-link salt | `kv rptsalt/` | Until the game is deleted | Deleted with it |
| Network-address hashes for daily limits (sign-up count, bad sign-in tries, partner limits, join limits) | `kv start/ linkfail/ plim/ jlim/ jbm/` | 2 days | Deleted by the sweep |
| "New place" records for AI keys (country, network prefix, program family) and the alert clock | `kv seen/ alert/` | While their key is live | Deleted by the sweep when the key is retired or expired |
| AI audit trail (time, key id, call, status, network address, program, country) | `ai_audit` | 365 days | Deleted |
| Mail log: the address a mail went to and its subject | `outbox` | **3 days.** A sent mail keeps no body. An unsent mail with a body gets one more try a day while it is under 3 days old | Deleted by `purgeOutbox`, called from the tick every hour (and daily from the first organizer request) |
| Monitoring from `rum.js` (page path without query, referrer site, device class, speed, script errors, failed or slow API calls with their path, country) | `telemetry` (`pages/functions/api/telemetry.ts`) | 90 days | Deleted by the clean-up that runs on about 1 write in 100 |
| Visits to the public website pages (source, landing page, device, language, country and city, sections seen, choices made, visitor id, shortened network address, keyed hash of the address; never names, numbers or e-mail addresses; never the game pages) | `visit_session`, `visit_event` | 365 days after the visit began | Rolled into anonymous per-day totals (`visit_agg`, kept), then deleted. With Global Privacy Control or Do Not Track only the anonymous totals are made |
| Daily write counters | `usage` | 90 days | Deleted by the sweep |
| Payments, invoices, entitlements, the payment ledger | `payment`, `invoice`, `entitlement`, `payment_ledger` | We keep billing data for audit and tax reasons | Not deleted by code (TEST-mode clean-up only removes test payments) |
| Organizer's invoice details and who paid | `legal_party` (a copy per paid game, written at payment and again just before the game is deleted), and the payment and invoice rows | Same | Not deleted by code |
| Partner account (name, random code, hashes of phone and e-mail, key hash) and commissions | `partner`, `commission` | While the partner is active; commissions as accounting records | Partner row deleted by "Close my partner account"; commission rows stay without any link to a person |
| Ideas from organizers' AI assistants (no names or numbers) | `suggestion`, `suggestion_vote` | Until we remove them | Not deleted by code |

## Tables this game never fills

The shared Worker still has the tables `claim`, `rvote`, `rcand`, `overvote` and `prize`. A game of Luck by Chance does not write to them (the podium goes to `winner` as seat numbers), so they hold nothing about players. `erasePersonal` still clears them, which does no harm.

## Not decided in code

- Partner commission records are kept as accounting records.
- Whether the one-year log rule in DPDP Rule 6(1)(e) reaches players' security-log rows, which are destroyed at 23 hours.
- Whether the short player notice must name that security log. Today it says what is kept and for how long in the box and on the Privacy page.
