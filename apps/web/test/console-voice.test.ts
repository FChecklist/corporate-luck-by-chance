// Owner rule v1.1 (docs/CONSOLE_VOICE.md): the console speaks TO the organizer as "you". Never "I", "my", "me" or "myself" in what the organizer reads.
// The organizer's screens are zc.js (the console), host.js (run the game) and ai-link.js (the AI work link page). The text of every string they hold is read here.
// The player's page (luck.js) and the legal pages are not console voice; a sentence the person ticks (the Terms boxes, from the server) is legal wording and is not read here.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const FIRST_PERSON = /(?<![\w.$-])(I|I'm|I'll|I've|I'd|my|My|me|Me|myself|Myself|mine)(?![\w-])/;

/** The text of every string and template literal in a script (the `${...}` parts are skipped), with its line number. */
function literals(src: string, baseLine = 1): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []; let i = 0; const n = src.length; const lineOf = (k: number) => baseLine - 1 + src.slice(0, k).split("\n").length;
  while (i < n) {
    const c = src[i]!;
    if (c === "/" && src[i + 1] === "/") { const j = src.indexOf("\n", i); i = j < 0 ? n : j; continue; }
    if (c === "/" && src[i + 1] === "*") { const j = src.indexOf("*/", i + 2); i = j < 0 ? n : j + 2; continue; }
    if (c === '"' || c === "'") { let j = i + 1, buf = ""; while (j < n && src[j] !== c && src[j] !== "\n") { if (src[j] === "\\") { buf += src.slice(j, j + 2); j += 2; continue; } buf += src[j]; j++; } out.push({ line: lineOf(i), text: buf }); i = j + 1; continue; }
    if (c === "`") {
      let j = i + 1, buf = "";
      while (j < n) {
        if (src[j] === "\\") { buf += src.slice(j, j + 2); j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "{") { let d = 1; const from = j + 2; j += 2; while (j < n && d > 0) { if (src[j] === "{") d++; else if (src[j] === "}") d--; j++; } for (const inner of literals(src.slice(from, j - 1), lineOf(from))) out.push(inner); /* v1.5.3: the sentences INSIDE a ${...} are read too (a button label inside a ternary used to be skipped) */ buf += " "; continue; }
        if (src[j] === "`") break; buf += src[j]; j++;
      }
      out.push({ line: lineOf(i), text: buf }); i = j + 1; continue;
    }
    i++;
  }
  return out;
}
/** What a person can read in a literal: tags and attribute values are not text. Paths, links and code-like strings are skipped. */
// A link, a path or a file name inside a sentence is taken OUT of the text; the sentence around it is still read (v1.5.3: a big template that holds one URL used to be skipped whole, and so never read).
const readable = (t: string) => t.replace(/<[^>]+>/g, " ").replace(/https?:\/\/\S+|wa\.me\/\S*|\/api\/[\w\/.-]*|[\w\/.-]+\.(?:js|css|html|png|svg)\b/g, " ").trim();
const isCode = (t: string) => /^[\w./#:?=&%${}\[\]()*+,;<>!|^~@-]*$/.test(t.trim());

describe("R71: the organizer's screens say 'you', never 'I', 'my' or 'me'", () => {
  for (const f of ["zc.js", "host.js", "ai-link.js"]) {
    test(`${f}: no first-person word in any sentence the organizer reads`, () => {
      const bad = literals(pub(f)).filter((l) => { const t = readable(l.text); return /[A-Za-z]{3,}/.test(t) && !isCode(t) && FIRST_PERSON.test(t); }).map((l) => `${f}:${l.line}: ${readable(l.text).slice(0, 110)}`);
      expect(bad).toEqual([]);
    });
  }
  test("the approved wording is on the screens word for word: the two ways to start, and the ID-invite text", () => {
    const zc = pub("zc.js"), host = pub("host.js");
    for (const t of ["The game starts by itself", "You start the game", "The game begins at the time you set. You do nothing.", "The game waits for you. Press Start when you are ready."]) expect([t, zc.includes(t)]).toEqual([t, true]);
    for (const t of ["The game starts by itself", "You start the game", "The game waits for you. Press Start when you are ready."]) expect([t, host.includes(t)]).toEqual([t, true]);
    for (const t of ["Invite people with just an ID", "No names or personal details are needed.", "Just upload or paste the IDs of the people you want to invite: employee ID, associate ID, vendor ID or customer ID, whichever you use.", "Your invitee opens the game link and enters their ID. If it is on your list, they join and play. If it is not, you get a request to approve or decline.", "The list and all IDs are deleted within 24 hours after the game ends."]) expect([t, zc.includes(t)]).toEqual([t, true]);
  });
  test("the ten before-and-after examples of docs/CONSOLE_VOICE.md: the 'before' words are gone, the 'after' words are there", () => {
    const all = pub("zc.js") + pub("host.js") + pub("ai-link.js");
    for (const before of ["Add to my list", "My total budget for this game's prizes is", "I start it", "I call the numbers", "Each person I invite can bring family or friends", "on my list", "I press Start", "The game starts by itself at the time I set", "Manual: I'll set each prize myself", "A new number comes every 12 seconds, by itself"]) expect([before, all.includes(before)]).toEqual([before, false]);
    for (const after of ["Add to your list", "on your list", "You start the game"]) expect([after, all.includes(after)]).toEqual([after, true]);
  });
  test("this game has no numbers to call, so the 'numbers come by themselves' / 'you call the numbers' wording (Tambola and Bingo only) is not on its screens", () => {
    const all = pub("zc.js") + pub("host.js");
    expect(all).not.toMatch(/You call the numbers|Numbers come by themselves|Press Next whenever/);
  });
});
