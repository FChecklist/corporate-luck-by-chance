// Plain-JS mirror of apps/edge/src/idclean.ts (empId, emailId, looksLikeEmail). emailId is for a PARTICIPANT's Email ID only; account e-mails (sign-in, Host, payment, invites) are never cleaned in the browser and the server refuses a space inside them (accountEmail in idclean.ts). test/idclean.test.ts checks both copies on one table.
(function (g) {
  var empId = function (s) { return String(s == null ? "" : s).normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, ""); };
  // White space and invisible characters (zero-width U+200B-U+200D, U+2060, BOM U+FEFF, NEL U+0085, U+2028, U+2029): same set as BLANKS in idclean.ts.
  var BLANKS_G = new RegExp("[\\s\\u200B-\\u200D\\u2060\\uFEFF\\u0085\\u2028\\u2029]+", "g");
  var emailId = function (s) { return String(s == null ? "" : s).normalize("NFKC").replace(BLANKS_G, "").toLowerCase(); };
  /** An at sign after NFKC (also folds the full-width one): an Email ID typed where an employee ID is asked. Mirror of looksLikeEmail in idclean.ts. */
  var looksLikeEmail = function (s) { return String(s == null ? "" : s).normalize("NFKC").indexOf("@") >= 0; };
  /** Hint text under an ID box: the live "The system will read this as ..." line ("" when nothing is typed). */
  var legacy = function (s) { return String(s == null ? "" : s).replace(/\s+/g, "").toUpperCase(); };
  var empHint = function (v, newRule) { if (looksLikeEmail(v)) return "This looks like an Email ID. This game asks for an employee ID: letters and numbers only."; var c = newRule === false ? legacy(v) : empId(v); return c ? "The system will read this as " + c : ""; };
  var emailHint = function (v) { var c = emailId(v); return c ? "The system will read this as " + c : ""; };
  g.IDCLEAN = { looksLikeEmail: looksLikeEmail, empId: empId, emailId: emailId, legacy: legacy, empHint: empHint, emailHint: emailHint };
})(typeof window !== "undefined" ? window : globalThis);
