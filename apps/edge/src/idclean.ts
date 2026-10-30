// ONE place where an ID typed or uploaded by anyone is cleaned into one uniform form.
// Browser pages carry a plain-JS mirror (apps/web/public/idclean.js); test/idclean.test.ts keeps the two copies in step on a table of inputs.

/** Games created at or after this instant (ms since 1970) use the new employee-ID cleaner; older games keep the old rule.
 *  PLACEHOLDER far in the future (2100-01-01): it is set to the real deploy instant at deploy time. */
export const EMP_CLEAN_FROM_MS = 4102444800000;
/** The longest employee ID, counted AFTER cleaning. */
export const EMP_MAX = 30;

/** (A) EMPLOYEE ID: NFKC, upper case, then everything that is not A-Z or 0-9 is dropped. 1B-678, 1b-678, 1B/678 and 1B 678 are all 1B678. "" when nothing is left. */
export const empId = (s: unknown): string => String(s ?? "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** (B) EMAIL ID: NFKC (folds a full-width ＠), trim, inner whitespace removed, lower case. Never run empId on an email. */
export const emailId = (s: unknown): string => String(s ?? "").normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();

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
