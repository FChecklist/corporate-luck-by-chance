# Breach runbook (internal)

For Corporate Luck by Chance. A breach is any loss, leak or unauthorised use of personal data, or of a key that opens it. Personal data here is: players' nicknames (and their security-log rows), organizer, host and co-host details (name, e-mail, mobile), people lists an organizer typed in, payer details, partner details. Keep it short. Act first, write after.

## 1. Spot it (who, what)
- Signs: an unfamiliar-use alert mail to an organizer; a spike in `ai_audit` rows; 403 or 503 bursts; `GET /api/status/health` showing `ok: false` or a high `errors_last_hour`; a vendor notice (Cloudflare, Resend, Razorpay, GitHub); a report from a player or organizer; a leaked key.
- Owner of this runbook: Rajat Agarwal, the Grievance Officer. Contact: `rajatsiroffice@gmail.com` (phone +91 96503 97480).

## 2. Contain (first hour)
1. Write down the time and what you saw. Do not delete evidence.
2. A leaked platform key or other secret: replace it in Cloudflare (`wrangler pages secret bulk` for the site, `wrangler secret put` for the Worker) and redeploy. Do NOT replace `DATA_KEY` while a game still holds players: sealed rows would become unreadable. Treat a `DATA_KEY` leak as the highest case below.
3. One organizer's key leaked: in the console press "Replace my AI link"; retire other keys in the Keys card. An organizer's lasting key is stored sealed, so a database copy alone does not reveal it.
4. Stop the bleeding if needed: switch the site off with `POST /api/owner/site {"off": true}` (every page answers a plain "Back soon"), or set `STRICT_KEYS=1` and remove one required secret so the Worker answers 503 to everything. Restore after the fix.
5. A vendor breach: follow the vendor's steps, then continue at 3.

## 3. Assess (same day)
- What data, how many people, which games (`SELECT ... FROM engagement`), over what period.
- Players' nicknames in `participant.pii` are sealed (AES-256-GCM): a copy of the database without `DATA_KEY` does not show them. **But once a game has started its nicknames are also stored in the clear** (`luck_p.name`, so every phone can show the top-10 list), so a copy of the database DOES show the nicknames of every game whose players have not yet been deleted. Treat a database copy as a leak of those nicknames.
- Players' nicknames are deleted 20 hours after a game ends, so a leak of an old copy covers only games that were live or ended less than a day before. The result and the winners record carry seat numbers only.
- The security log's personal part for players (network address, browser, device id) is sealed under a per-game key and destroyed at 20 hours; the rest is sealed with `DATA_KEY`. An anonymous visitor's rows hold the first part of the network address only and are removed after 90 days.
- Was `DATA_KEY` exposed? If yes, assume every sealed row of live games is exposed: players' sealed nicknames, people lists, organizer and host e-mails, the security log.
- Decide: is there a likely risk to people? Write the decision and the reason.

## 4. Tell people (do not wait for a perfect picture)
- **Organizers affected:** by e-mail from the Grievance Officer address, without undue delay. Say what happened, what data, what you did, what they should do. Our data processing terms (`apps/web/public/dpa.html`) promise this. The organizer is the controller of the players' data.
- **Players:** through their organizer. We hold no way to reach players directly, by design: they give a nickname, not an e-mail address or a number.
- **Regulators (decided the same day):** India, the Data Protection Board and each affected person (DPDP Act section 8(6) and Rule 7: tell the Board without delay and send the detailed report within 72 hours). CERT-In has its own reporting window of 6 hours for some incidents. EU or UK supervisory authority within 72 hours if GDPR applies. US state rules vary. Keep the contact of your adviser here: ________.
- **Vendors:** Cloudflare, Resend, Razorpay and GitHub each have their own incident contact; tell them if their service was the path.

## 5. Fix and learn (within a week)
- Fix the cause. Add a test that would have caught it. Update `docs/RETENTION.md`, `docs/PRIVACY_AND_LIFECYCLE.md` and this file if something changed.
- Write a short record: date, cause, data, people told, regulator notices, fix. Keep it 3 years.

## What we cannot do alone
- Decide whether a regulator must be told, and the exact wording of notices: the Grievance Officer with an adviser.
- Vendor-side logs and investigation: the vendor's dashboard and support.
