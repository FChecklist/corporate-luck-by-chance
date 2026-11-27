// The invite ID (owner rules v1.1, docs/SUITE_RULES.md section 2): ONE alphanumeric field. An employee ID, an associate ID, a vendor ID and a customer ID are the same thing here.
// No names, no mobile numbers, no other personal details are used to invite or to match a person.
// Every character that is not a letter or a digit is removed and the rest is made upper case, so A-1101, A 1101 and A/1101 are all A1101.
// The same function is used at upload, at join, at approval and at matching, so a list and a typed ID always meet in the same form.
export const ID_MAX = 40;
/** The longest text we even look at (a pasted line, not a whole file), so one huge value cannot cost anything. */
const RAW_MAX = 200;

export type CleanedId = { ok: true; id: string } | { ok: false; why: string; code?: "not-an-id" };

/** What the console and the API say when somebody sends a name, an e-mail or a mobile number where an ID is wanted. */
export const ID_ONLY_MSG = "Invite people with just an ID. Names and mobile numbers are not needed. Send the ID only.";
/** The same refusal said to a player who typed such a thing into the ID box on the game page. */
export const NOT_AN_ID_MSG = "That does not look like an ID. An ID is letters and digits only. Please do not type a name, an e-mail or a mobile number.";

/**
 * THE ID CONTENT RULE (v1.5.3). One rule for every place an ID comes in (list upload, paste, typed ID, roster, approval) and the one the sister games (Tambola and the rest) use too,
 * so the same text is an ID in every game. It looks at what was TYPED, before the spaces and dashes are stripped, and refuses (never stores) text that is a name, an e-mail or a mobile number:
 *   1. an e-mail: it has an "@";
 *   2. a mobile number: only digits (a leading +, spaces, dashes, dots and brackets allowed) and 10 to 15 digits in all, or any one word of 10 to 15 digits next to other words ("Priya 9876543210");
 *   3. a name: words of letters with a space between them and no digit anywhere ("Priya Sharma");
 *   4. anything with a character an ID never has (an ID is A to Z, 0 to 9 and the separators space - _ / . # only).
 * An ID such as A-1101, A 1101, A/1101, EMP 1101 or V-0042 passes. Only letters and digits are kept afterwards (normalizeId).
 */
export function idContentProblem(typed: string): boolean {
  const t = typed.trim();
  if (/@/.test(t)) return true;
  if (/[^A-Za-z0-9\s\-_/.#\\+()]/.test(t)) return true; // a letter with an accent, a comma, a colon, an emoji: not an ID
  const flat = t.replace(/[\s+\-._()/#\\]/g, "");
  if (/^\d{10,15}$/.test(flat)) return true; // a mobile number, however it was spaced or dashed
  if (/^[+(]/.test(t) && /^\d+$/.test(flat)) return true; // +91 ...: a leading + is a phone, never an ID
  if (t.split(/\s+/).some((w) => /^\+?\d{10,15}$/.test(w)) && t.split(/\s+/).length > 1) return true; // a number next to other words
  if (!/\d/.test(t) && t.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length >= 2) return true; // "Priya Sharma": two words of letters, no digit
  return false;
}

/** Strips every character that is not a letter or a digit (A to Z, 0 to 9) and upper-cases the rest. */
export const normalizeId = (raw: unknown): string => String(raw ?? "").slice(0, RAW_MAX).replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Cleans one typed or pasted ID. The answer is the normalised ID, or a plain sentence saying what to fix. */
export function cleanInviteId(raw: unknown): CleanedId {
  if (raw !== undefined && raw !== null && typeof raw !== "string" && typeof raw !== "number") return { ok: false, why: "An ID is letters and digits.", code: "not-an-id" };
  const typed = String(raw ?? "");
  if (typed.length > RAW_MAX) return { ok: false, why: `That ID is too long. Use at most ${ID_MAX} letters and digits.` };
  if (idContentProblem(typed)) return { ok: false, why: ID_ONLY_MSG, code: "not-an-id" };
  const id = normalizeId(typed);
  if (!id) return { ok: false, why: "Please type an ID with at least one letter or digit." };
  if (id.length > ID_MAX) return { ok: false, why: `That ID is too long. Use at most ${ID_MAX} letters and digits.` };
  return { ok: true, id };
}

const encoder = new TextEncoder();
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");
/** The salted hash that matches a person to a list (the `ph` column). It cannot be mistaken for the hash of a mobile number: the text that is hashed starts with "id|". */
export const idHashOf = (env: { PHONE_SALT?: string; ORGANIZER_SECRET?: string }, id: string): Promise<string> => sha(`${env.PHONE_SALT ?? env.ORGANIZER_SECRET ?? "unset"}|id|${id}`);

/** True when a list entry carries a name or a mobile number (anything but the ID). Those are refused, never stored. */
export const carriesPersonalDetails = (x: any): boolean => !!x && typeof x === "object" && ["name", "phone", "mobile", "email"].some((k) => x[k] !== undefined && x[k] !== null && String(x[k]).trim() !== "");
