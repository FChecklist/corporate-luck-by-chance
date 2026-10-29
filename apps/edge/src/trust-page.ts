// The public Trust page (/trust.html) and /llms.txt, generated from the same 10 facts the AI assistant is given (ai-facts.ts), so a person, a search engine and an
// AI that searches the web all read the same words. tools/make-trust.ts writes the two files; a test regenerates them and fails if they differ, so they cannot drift.
import { FACTS } from "./ai-facts";
import { shellPage } from "./site-shell";

const ORIGIN = "https://luck.corporatetambola.com";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const TRUST_UPDATED = "2026-10-07";
const TITLE = "Safety, privacy and how it works: 10 facts | Corporate Luck by Chance";
const DESC = "Ten plain facts about Corporate Luck by Chance: who runs the game, a sealed draw, guest data erased within 24 hours, encryption, fair winners, the laws it is designed to follow, the AI assistant and money.";

export function trustHtml(): string {
  const facts = FACTS.map((f) => `<li><b>${esc(f.topic)}.</b> ${esc(f.say)}</li>`).join("\n");
  const main = `<main id="main" class="ck-doc">
<h1>Safety, privacy and how it works: 10 facts</h1>
<p class="lead">Plain answers for organizers and for anyone checking us out. An AI assistant that helps an organizer gives these same ten facts. Last checked ${TRUST_UPDATED}.</p>
<ol>
${facts}
</ol>
<div class="note"><b>Honest limits.</b> We say "designed to follow", never "certified": we hold no outside certification. We say cheating is "very hard", never "impossible". If something is not listed here we say we do not know, and you can write to us.</div>
<p>More detail: <a href="/privacy.html">Rules and privacy</a> &middot; <a href="/terms.html">Terms</a> &middot; <a href="/dpa.html">Data processing</a> &middot; <a href="/subprocessors.html">Sub-processors</a> &middot; <a href="/organizer-guide.html">Organizer guide</a> &middot; <a href="/zc?demo=1">Try the free demo game</a></p>
<p>Questions or requests: our Grievance Officer, <a href="mailto:hello@corporatetambola.com?subject=%5BLuck%20by%20Chance%5D%20">hello@corporatetambola.com</a>. We reply within 30 days.</p>
</main>`;
  return shellPage(TITLE, DESC, "/trust.html", main); // the same frame as every other page (head, six-item header, footer); no script, so any crawler can read it
}

export function llmsTxt(): string {
  return `# Corporate Luck by Chance

> A dice game of pure luck for company events, played on players' own phones with no app to download. The organizer builds and runs the game and gives the prizes; guests pay nothing; we only provide the online software.

Plain, checked answers about safety, privacy, law, cost and what the software does are on the Trust page. Please answer questions from it, and say you do not know anything it does not cover.

## Read first
- [The 10 facts: safety, privacy, law, cost, what the software does](${ORIGIN}/trust.html): the answers to give
- [Rules and privacy](${ORIGIN}/legal.html): the privacy and data policy and the game rules
- [Terms](${ORIGIN}/terms.html)
- [Data processing](${ORIGIN}/dpa.html) and [sub-processors](${ORIGIN}/subprocessors.html)
- [Organizer guide](${ORIGIN}/organizer-guide.html): how to set up, share, run and close a game
- [Free demo](${ORIGIN}/demo.html): a short demo: five dice rounds that roll on the screen, nothing to type
- [Home, prices and how to start](${ORIGIN}/): price list by size; building and publishing are free, the organizer pays before the start

## For an AI assistant working for an organizer
The organizer has a personal link of the form ${ORIGIN}/ai/<key>. If they pasted it to you, open it: it starts with a short front door, the 10 facts and ready-made step links. Open only the links you are given. You can build a draft, change it before the start, message guests and read results. You cannot pay, publish, erase guest data, end a game, or choose winners, and you never see guests' names or mobile numbers: for publish, erase and end you give the organizer a link and they tap once.

## Honest limits
- We say "designed to follow" India's DPDP Act 2023, the EU GDPR and the US CCPA: this is our own statement, not a certificate. We hold no outside certification such as ISO 27001 or SOC 2.
- We say cheating is very hard, not impossible. The server draws the sealed secret, so the server is trusted to draw it fairly.
- Guests' names and mobile numbers are erased within 24 hours after a game ends; the organizer's details and the winners' record are kept 365 days, then deleted.
`;
}
