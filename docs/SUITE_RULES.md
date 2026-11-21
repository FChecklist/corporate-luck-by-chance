# Suite rules version 1.1, 20 Nov 2026

`suiteRulesVersion: 1.1`

This repo: **luckbychance** (game site (play)). This is a copy of the owner's rules relevant here. Sections 1 to 5 are the owner's text; section 6 says what this repo does about each rule, from 1.5.2.

**Where the source is:** C:\ct\marketing-ledger\plans\SUITE-RULES-VERSION-2026-11-20.md (also in FChecklist marketing-ledger on GitHub, plans/, commit 3246082), with ID-INVITE-AND-ARCHITECTURE-RULES-2026-11-20.md (v1.0). If this copy and the ledger differ, the ledger wins; bump the number on every owner rule change.

## 1. Architecture (owner, decided)
- 1 login: home.corporatetambola.com (single gate for organizer, host, anyone who logs in). No game or page has its own login; if one exists it is hidden or redirected. Players joining by code/link are not "logged in".
- 1 console for ALL games: console.corporatetambola.com. Organizer/host only. One website, one set of rules.
- 1 credit and payment system: moneypenny.corporatetambola.com.
- 1 chatbot system: moneypennychat.corporatetambola.com. AI uses only the limited key cta_, never the organizer key ctk_; AI never self-confirms irreversible steps.
- All systems independent, joined by API. Console = set up, invite, pay, approve, monitor. Game = play, each with its own website and rules. Settings flow console -> game by API; a game keeps no copy of rules.
- **No own login, no own payment, no own chat in a game or the console. Pay only via Moneypenny.**

## 2. Invite by ID only
- ID = ONE alphanumeric field (employee, associate, vendor, customer ID are the same thing). No choice menu. No names, mobile or personal details.
- Organizer/host uploads or pastes IDs, one per line. A unique game link is generated. Invitee opens it and enters their ID: on the list = joins and plays; not on the list = organizer/host approves or declines.
- Family invite (optional): a listed person may invite up to 4 more with approval. Only organizer/host see the full list, the invite chain and the log.
- Normalisation: strip every non-alphanumeric character, uppercase (A-1101, A 1101, A/1101 = A1101) at upload, join, approval and matching.
- No one is admitted without approval if not on the list; hide "Anyone with the link" audiences.
- **Deletion: the list and all IDs are deleted within 24 hours after the game ends.**
- Screen text (verbatim): "Invite people with just an ID / No names or personal details are needed. / Just upload or paste the IDs of the people you want to invite: employee ID, associate ID, vendor ID or customer ID, whichever you use. / Your invitee opens the game link and enters their ID. If it is on your list, they join and play. If it is not, you get a request to approve or decline. / The list and all IDs are deleted within 24 hours after the game ends."

## 3. Payment chain and seamless rule
- Chain: home -> console -> moneypenny -> IT Services by Rajat Agarwal -> Razorpay.
- Moneypenny credits are bought through IT Services/Razorpay; Moneypenny updates credits and then THE SPECIFIC GAME, which becomes PAID. The game starts only when paid.
- Console and every game call ONLY Moneypenny, never IT Services or Razorpay directly. Moneypenny is the single gate.
- SEAMLESS: organizer, host and payee never see the backend and never leave console.corporatetambola.com. Cost, balance, Buy now, Pay, "Paid" and the payee pay link are console screens; the card/UPI window opens as an overlay on the console and returns to the same screen. Error text never names Moneypenny, IT Services or the API.
- Payee pay link: console page, no login, shows only the amount due; money goes to the ORGANIZER's Moneypenny account and is auto-applied to that game.
- Pay step is step 6, last, one shared flow for all six games: "Game only starts when you pay"; cost in credits, existing credits, "you only need to buy N credits to start the game", Buy now, Copy payment link, "You don't have to buy software or a subscription or download anything. You only pay per game. Simple and easy."
- Still for the owner to decide: when short of credits, smallest listed pack that covers it (recommended) or exact credits.
- Deploy: Cloudflare only, no Vercel. Nothing is deployed from this docs change.

## 4. Voice and wording
- Console voice: "you", polite, simple English, never "I", not threatening; audience = organizer/host (cautious HR people). In the game the audience is the players.
- Privacy line: "designed to follow US privacy laws, EU GDPR and India's DPDP"; all participant information including IDs deleted within 24 hours after the game. Billing: the only sentence is "We keep billing data for audit and tax reasons." Never "forever".
- Prizes: "You (the company) give the prizes directly to the winners." Never "we never hold or pay prize money".
- Fairness: "No one knows the next number: not the organizer, not the host, not even the software."
- Prices use the rupee sign.
- Tagline: "Every ticket on the player's own phone, nothing to install. Each ticket is unique."

## 5. What not to claim
- Do not state "100% secure", "most secure gateway", "played by major companies" (no proof), or "PDF of all details by e-mail" until built and checked. Ask the owner before adding.
- Do not send the marketing PDF to a prospect until ID-invite/approval/family and 365-day deletion lines are live or softened.

## 6. What this repo does about each rule (version 1.5.2, 21 Nov 2026)
Each line is checked by a test; the rule numbers (R71 and up) are in `docs/RULES.md`.

| Owner rule | In this repo | Test |
|---|---|---|
| Invite by ID only, ONE alphanumeric field, no names or mobile numbers | Done. The list takes IDs only (`ids` or `people:[{id}]`); an entry with a name, a mobile number or an e-mail is refused and never stored. The player page has one ID box and a nickname box; a mobile number is not a way to join. | `apps/edge/test/invite-id.test.ts`, `people.test.ts`, `apps/web/test/luck-page.test.ts`, `pages.test.ts` |
| Strip every non-alphanumeric, upper case, at upload, join, approval and matching | Done, by one function (`apps/edge/src/invite-id.ts`) used everywhere. | `invite-id.test.ts` (R76) |
| Not on the list: the organizer or host approves or declines; no admission without approval | Done for the console, which always sets "only people on your list". The console no longer offers "Anyone with the link". The server still accepts the older setting for a game made through the API alone; the owner has to say (section 7). | `invite-id.test.ts` (R77) |
| Family invite, optional, up to 4 more, with approval | As before: a listed guest can bring up to 1 to 10 people (default 4) through their own link; a person not on any list waits for approval by the organizer, a host or the person who invited them. | `people.test.ts` |
| Only the organizer or host sees the list, the chain and the log | As before: a Co-host or a guest sees only their own list. | `people.test.ts` |
| The list and all IDs are deleted within 24 hours after the game ends | Done at 23 hours (the job runs at 23 hours, inside the 24). | `invite-id.test.ts` (R80), `honest-wording.test.ts` (R83) |
| Console voice: "you", polite, simple English, never "I" | Done for the console, the run-the-game page and the AI-link page. | `apps/web/test/console-voice.test.ts` (R71) |
| Two start options | Done: "The game starts by itself" and "You start the game". | `start-options.test.ts` (R72 to R75), `host-start.test.ts`, `pages.test.ts` |
| Fairness line: "No one knows the next number: not the organizer, not the host, not even the software" | **Not used. It is not true in this build**: the server draws the secret and holds it until the game is over, and publishes each number at its moment (docs/RULES.md, Known limits). The pages say instead what is true: no player, organizer or host can see a number early, and anyone can re-check every number afterwards. | `honest-wording.test.ts` (R81) |
| Prices with the rupee sign | Not done in this change. | |
| One login, one console, Moneypenny for credit and payment, one chatbot | Not part of this change. The Pay step of the console is in 1.5.0 and 1.5.1 and stays off (`PAY_VIA_CONSOLE` unset). | `apps/edge/test/console-pay.test.ts` |

## 7. Open for the owner
- "Anyone with the link": the console no longer offers it, but a game made through the API alone can still use it (older tests and the AI route rely on it). Say if the server should refuse it for every game.
- The tick box on the invite list (Terms box K6) still reads "I am allowed to use these names and numbers for this game. The people have been told." It is fixed legal wording tied to the Terms version, so it was not changed here. It needs the new text and a new Terms version.
- The legal position page in `site/` names "Corporate Tambola" in one sentence where the app page names this game (`apps/web/test/legal-sync.test.ts` fails on it, and did before 1.5.2).
- "Rules timing": the rules say the game takes 24 minutes 40 seconds (R30) and personal data goes at 23 hours (R44, R67). Older pages gave a longer figure and R44 said 24 hours. They now agree with the code. If "rules timing" meant something else (for example when the rules card is shown to players), say so.

