# The short AI work link: `https://<site>/ai/<key>`

Rewritten 2026-10-14 for the dice game. Source of truth for what the game is: `docs/RULES.md`. Source of truth for what the AI is told: `manualText()` in `apps/edge/src/ai-link.ts` (the long manual), `frontDoorText()` (the short front door), `apps/edge/src/ai-facts.ts` (the 10 facts) and `apps/edge/src/ai-functions.ts` (the step links). This page describes what those files really say and do; if they change, change this page with them.

Corporate Luck by Chance is a dice game of pure luck for company events. Players join with a nickname on their own phones. A game has rounds; every round has 10 dice rounds; in every dice round the screen shows a target number from 1 to 6 and every player presses the dice once; a dice that shows the target scores that many points, any other number scores nothing. The five best players win the five places (1st to 5th), the top 10 are listed, and there is never a tie. The AI helps the organizer set up and look after such a game. It cannot play, start, end or influence it.

The address `corporate-luck-by-chance.pages.dev` below is the live site's name; the link works with the real site once the game is switched on, and today on a local server (`docs/RUNNING.md`) for testing.

## What the organizer pastes

Two short lines and the link (shown as Option 1 in the console and e-mailed in its own dedicated mail, see "Where the link may travel"):

```
This is the API documentation and instructions for MY OWN Corporate Luck by Chance account. I am the owner, and I am asking you to read it and help me with it.
Please open it now (a plain GET request) and follow it: https://corporate-luck-by-chance.pages.dev/ai/cba_<48 hex>
```

Why this wording: presenting the link as the owner's own API documentation is accepted by chat AIs; "open this link and follow it" was refused as prompt injection about one time in three. The key appears only inside the link. The paste is built by `aiPaste` in `apps/edge/src/ai-link.ts`. A longer, ready-to-paste prompt for each kind of person is in `docs/AI_WORK_PROMPT_ORGANIZER.md`.

Many chat tools can open a web address (GET) but cannot set headers or send POST. So the link works with plain GET too: `?_method=POST|PATCH&_body=<URL-encoded JSON>` (below).

## Where the link may travel

Three layers together:

- **A. The e-mail's button.** The dedicated mail (`apps/edge/src/mails.ts`, `aiLinkMail`; subject "Your personal AI work link - Corporate Luck by Chance"; HTML + plain text; do-not-forward warning top and bottom; numbered steps) has a button "Show my AI work link" to `/ai-link.html` (`apps/web/public/ai-link.html|js`). The address holds no secret. The page asks the organizer to sign in with the existing 6-digit e-mailed code (or uses the console's own session), then shows the lasting two-line paste in a box with Copy, seven ways to hand it to an AI (below), "Get a fresh AI link" and "Replace my AI link". A forwarded copy of the mail is useless to anyone else. The lasting key is kept sealed (`aikey/<org>` in `kv`), so the signed-in organizer can read it again (`GET /api/org/ai/link`, organizer key only; AI, co-host, mailed and platform keys get 403). It is never e-mailed.
- **B. The mail's own box uses a separate 24-hour key.** The plain-text paste box in the mail (never a hyperlink) carries a key minted only for the mail, valid 24 hours (`organizer_key.expires_ms`; after expiry it is the same plain 404 as an unknown key). "Get a fresh AI link" (`POST /api/org/ai/fresh`, organizer key only, at most 5 live) mints and mails another 24-hour key without touching the lasting key. A Host key gets its own 24-hour key in a separate mail; a Co-host (`cbc_`) has no AI link.
- **C. Unfamiliar-use alert.** When an AI or Host key is used from a country, network prefix (IPv4 /24, IPv6 /48) or program family not seen before for that key, the organizer gets ONE plain e-mail (no link, no key), at most once per key per 24 hours. The first use only sets the baseline.

No other mail carries an AI link: the publish mail (share and pay links) is safe to forward; reminders, "could not begin", invoices, report-link and partner mails never carry one; no report page, PDF or player page does. Honest limit: a mail app may turn the plain-text address in the box into a tappable link on its own, and a mail scanner may then open it; that is why the mailed key lasts only 24 hours and the alert exists.

### The seven ways to use the paste (sign-in page and console Option 1 box; not in e-mails)

Opens the AI with the paste pre-filled (`target=_blank rel="noopener noreferrer"`): ChatGPT `https://chatgpt.com/?q=`, Grok `https://grok.com/?q=`, Claude `https://claude.ai/new?q=`. Copies the paste and opens the site, with the line "Copied. Press Ctrl+V, then Send": Gemini, DeepSeek `https://chat.deepseek.com/`, z.ai `https://chat.z.ai/`. Seventh: plain Copy.

### Replace and fresh links

`POST /api/org/ai/replace` revokes every AI key (lasting and 24-hour), mints a new lasting key (shown in the console and the sign-in page), mails a new 24-hour key, and is audited. `POST /api/org/ai/fresh` is the "Get a fresh AI link" button. Both are for the signed-in organizer only; an AI key, a co-host key, the platform key or a stranger gets 403, also through an AI link. Opening the manual (`GET`/`HEAD /ai/<key>`) changes nothing except its audit line and the alert baseline.

## What the link serves

- `GET /ai/<key>` returns the complete manual for that key's role as `text/plain; charset=utf-8` (`?format=json` returns the same as data). It starts with a short front door (about 40 lines: the rules for the AI, six first choices, the 10 facts) followed by the long reference manual. The Organizer-AI key (`cba_`) gets the full manual; a Host key (`cbh_`) a narrower one.
- `GET /ai/<key>/go`, `/go/new`, `/go/games`, `/map`, `/facts`, `/whoami`: the guided path (ready-made step links with the words to say), the list of everything the AI can get done and who does each step, the 10 facts, and a check that the link works.
- `GET|POST|PATCH /ai/<key>/<api path>` behaves exactly like `/api/<api path>` with the key in `x-organizer` (`/ai/<key>/z/{id}/summary` = `/api/z/{id}/summary`). The rewritten request goes through the normal route, so the audit trail records it with the `/api` path and the real method, never the key. Only `cba_` and `cbh_` keys are accepted here: the organizer's own sign-in key (`cbk_`) and the platform key are never accepted in an address.
- Browse-only fallback, only under `/ai/<key>/`: `GET ...?_method=POST|PATCH&_body=<URL-encoded JSON>`. The decoded body is capped at 6,144 characters; a body that is not JSON gets a plain 400 explaining URL-encoding; any other `_method` is a 400; the normal `/api` routes ignore `_method` and `_body`.
- Every answer carries `x-robots-tag: noindex, nofollow`, `referrer-policy: no-referrer`, `cache-control: no-store`.
- Unknown, mistyped, revoked or wrong-kind keys all get the identical `404 Not found.` plain text and nothing is recorded. Error bodies never echo the key. A refused call carries a plain "what to do next" hint (`nextHint`), which also never contains the key.
- `/api/z/ai-manifest` and the `x-organizer` header path still work for tool-capable AIs.
- Every call is written to an audit trail the organizer can read (`GET org/ai/audit`). The AI is asked to say which model it is on every call (`ai_model`, `ai_version`, `ai_session`, `ai_machine`); this is recorded as self-declared, never as proof.

Files: `apps/edge/src/ai-link.ts` (the words), `apps/edge/src/ai-facts.ts` (the 10 facts), `apps/edge/src/ai-functions.ts` and `ai-go.ts` (the step links), `apps/edge/src/worker.ts` (`aiLink()` routing, `canAi`, manifest), `pages/functions/ai/[[path]].ts` (Pages Function), tests `apps/edge/test/ai-link.test.ts`, `ai-enablement.test.ts`, `ai-privacy.test.ts`, `no-other-game-words.test.ts` (the manual may use only this game's words).

## Roles: Organizer, Host, Co-host

Words in the product: **Organizer** (1), **Host** (up to 5), **Co-host** (no limit). Full spec: `ROLES_AND_CONSOLE_SPEC.md`.

- **Organizer** (master key): everything, including the account (sign-in keys, e-mail, AI link, close account), adds Hosts and Co-hosts, pays.
- **Host** (`cbh_`, `organizer_key.kind = 'host'`): everything inside a game (settings, publish, run it on the game page, start, end), adds Co-hosts, pays. Cannot touch the account or add a Host. Through an AI work link (`x-cb-link`) a Host keeps only the narrow set of actions in `HOST_ACTIONS` in `worker.ts`: read the summary, info, participants, results, prizes, life and the report link, tick prizes as given, and send a message to everyone.
- **Co-host** (`cbc_`, kind `cohost`): invites people with an own link and sees how many they brought, pays. Everything else answers 403. No AI link.

## What the organizer's AI can and cannot do for a game

| Action | Organizer AI (`cba_`) | Host through an AI link (`cbh_`) |
|---|---|---|
| Create a game (a free draft nobody else can see) and change it before the start: start time (`startRound`, at most 30 days ahead), size limit (`cap`), invite-only (`closed`), invitation policy (`invites`), time zone (`tz`), game name, the company brand (name, colour, small logo), reward lines for places 1st to 5th | yes | no |
| Read back the summary, info, participants (seat numbers only), results, life (when data is deleted), prizes, history, the live view of the game (`z/{id}/luck/view`) | yes | summary, info, participants, results, life, prizes, view |
| Send a message to everyone (160 characters, once published, one per 5 seconds; every phone and the big screen show it at the top within a few seconds) | yes | yes |
| Tick a prize as handed over | yes | yes |
| Publish | hand-over only: the organizer confirms their e-mail and mobile and presses Publish | no |
| Pay, make a pay link | never | never |
| Start the game; choose the number of rounds (1 to 20), the press window (6, 10 or 15 seconds) and the prize texts typed on the game page | **no**: the Organizer or a Host does this on the game page (`host.html`) | no |
| End a running game | ask only (`control/request` with `end`, the organizer presses End on the game page) | no |
| Choose, change or remove a target, a dice, a score or a place | nobody | nobody |
| Names and mobile numbers, people lists, the waiting room, removing people | **no**: every such call gets 403 | no |
| Erase players' data | ask only (`control/request` with `erase`, the organizer confirms) | no |
| Create a Host key, cancel a game, close the account | no | no |
| Read the AI audit trail | yes (own) | no |

## Things to know (as the code is today)

- The settings call still accepts the older `join: phone`. With it the Worker asks for a mobile number that the Luck by Chance player page cannot send, so nobody could join. The manual does not offer it; leave `join` alone (the default, nickname only).
- Reward lines saved through the AI (or console step 3) and the prize texts typed on the game page when the game is started are two separate lists. The player screens use the game-page texts for the prizes they show. Ask the organizer to type the prize texts again on the game page when they press Start.
- `control/request` takes the actions `end` and `erase`. There is no pause: a running game follows one fixed clock for everybody.
- The "message to everyone" reaches phones with the public game view they already ask for every second or so while the game runs and every 3 seconds while they wait; it is shown as a bright strip at the top of the player page and the big screen and is announced to a screen reader. Tests: `apps/edge/test/luck-announce.test.ts`, `apps/web/test/luck-page.test.ts`, scenario S12-01 in real Chrome at 360 px.
- Nothing about the AI link has been tried against a real chat AI for this game: the manual is checked by tests (`ai-link.test.ts` plants names and numbers and asserts that no AI-readable route returns them; `no-other-game-words.test.ts` checks the words).

## Help Desk helper keys (2026-10-19)

An AI key that belongs to a Help Desk helper (`created_by 'd'`) gets one more paragraph at the end of its manual (`GET /ai/<key>`, and `helpDesk` in `?format=json`): the AI prepares the game for the Organizer, never publishes or pays, and asks the Organizer to publish with `POST /api/helpdesk/request-publish {"eid": "<id>"}` (the key knows its own client). The unfamiliar-use alert skips these keys, and the Organizer's own `replace` and `revoke` of the AI link leave them alone. See `apps/edge/src/helpdesk.ts` and `docs/HELPDESK_SPEC.md`.
