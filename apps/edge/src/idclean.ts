// ONE place where an ID typed or uploaded by anyone is cleaned into one uniform form.
// Browser pages carry a plain-JS mirror (apps/web/public/idclean.js); test/idclean.test.ts keeps the two copies in step on a table of inputs.

/** Games created at or after this instant (ms since 1970) use the new employee-ID cleaner; older games keep the old rule.
 *  PLACEHOLDER far in the future (2100-01-01): it is set to the real deploy instant at deploy time. */
export const EMP_CLEAN_FROM_MS = 4102444800000;
/** The longest employee ID, counted AFTER cleaning. */
export const EMP_MAX = 30;

/** (A) EMPLOYEE ID: NFKC, upper case, then everything that is not A-Z or 0-9 is dropped. 1B-678, 1b-678, 1B/678 and 1B 678 are all 1B678. "" when nothing is left. */
export const empId = (s: unknown): string => String(s ?? "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** White space AND invisible characters: zero-width space/joiner (U+200B-U+200D), word joiner (U+2060), BOM (U+FEFF), NEL (U+0085), line and paragraph separators (U+2028, U+2029). A participant's Email ID loses them all; an account e-mail with one inside is refused. */
const BLANKS = "\\s\\u200B-\\u200D\\u2060\\uFEFF\\u0085\\u2028\\u2029";
const BLANKS_G = new RegExp("[" + BLANKS + "]+", "g");
const BLANK_ONE = new RegExp("[" + BLANKS + "]");

/** (B) EMAIL ID (a PARTICIPANT's ID in an Email ID game only): NFKC (folds a full-width ＠), trim, inner whitespace removed, lower case. Never run empId on an email. */
export const emailId = (s: unknown): string => String(s ?? "").normalize("NFKC").replace(BLANKS_G, "").toLowerCase();

/** (C) ACCOUNT E-MAIL (organizer sign-in, Host, Co-host, invites, partner, help desk, payment and credit contact, Google sign-in, test logins): NFKC, trim, lower case. An address with a space inside is NOT repaired: the result is "" (not an address), so the caller refuses it. For an ordinary address it gives the same text as before. */
export const accountEmail = (s: unknown): string => { const v = String(s ?? "").normalize("NFKC").trim().toLowerCase(); return BLANK_ONE.test(v) ? "" : v; };

/** The old rule, kept for games created before EMP_CLEAN_FROM_MS. "" = nothing typed, null = not a usable ID. */
export const legacyNormEmp = (raw: unknown): string | null => { const s = String(raw ?? "").replace(/\s+/g, "").toUpperCase(); if (!s) return ""; return /^[A-Z0-9][A-Z0-9._\-/]{0,29}$/.test(s) ? s : null; };

/** The cleaner a game uses: new for games made at/after `from`, old before. "" = nothing typed, null = refused (nothing usable left after cleaning, or longer than 30). */
export const normEmpFor = (raw: unknown, createdMs: number | null | undefined, from: number = EMP_CLEAN_FROM_MS): string | null => {
  if (!(Number(createdMs) >= from)) return legacyNormEmp(raw);
  if (!String(raw ?? "").trim()) return "";
  const s = empId(raw);
  return s && s.length <= EMP_MAX ? s : null;
};
/** Plain refusal for an ID that cleaned to nothing or is too long: what happened, where, how to fix. */
export const BAD_EMP_NEW = "That employee ID has no letters or numbers in it, or is longer than 30 characters. Type it again in the Employee ID box using the letters and numbers on your ID card.";
export const badEmpWhy = (createdMs: number | null | undefined) => (Number(createdMs) >= EMP_CLEAN_FROM_MS ? BAD_EMP_NEW : "An employee ID has letters and numbers only (up to 30).");

/** The shape every list e-mail must have after emailId: something@something.tld, no spaces. */
export const LIST_EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
/** The list value of an Email ID game: emailId, then it must look like an address. "" = nothing typed, null = not an address. NEVER the employee-ID cleaner. */
export const listEmail = (raw: unknown): string | null => { const s = emailId(raw); if (!s) return ""; return s.length <= 254 && LIST_EMAIL_SHAPE.test(s) ? s : null; };
/** Plain refusal for an Email ID that does not look like an address: what happened, where, how to fix. */
export const BAD_EMAIL = "That Email ID does not look like an email address. Type it again in the Email ID box, for example rajat1@demo.com.";

/** Does the text look like an e-mail address (an "@" after NFKC, which also folds the full-width at sign)? An employee-ID box never turns one into letters and digits: it refuses it. */
export const looksLikeEmail = (raw: unknown): boolean => String(raw ?? "").normalize("NFKC").includes("@");
/** Plain refusal for an Email ID typed where an employee ID is asked: what happened, where, how to fix. */
export const EMP_LOOKS_LIKE_EMAIL = "This looks like an Email ID, but this game asks for an employee ID. Type it again in the Employee ID box using the letters and numbers on your ID card.";
