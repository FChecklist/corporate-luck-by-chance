// Plain-JS mirror of apps/edge/src/idclean.ts (empId, emailId). test/idclean.test.ts checks both copies on one table.
(function (g) {
  var empId = function (s) { return String(s == null ? "" : s).normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, ""); };
  var emailId = function (s) { return String(s == null ? "" : s).normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase(); };
  /** Hint text under an ID box: the live "The system will read this as ..." line ("" when nothing is typed). */
  var legacy = function (s) { return String(s == null ? "" : s).replace(/\s+/g, "").toUpperCase(); };
  var empHint = function (v, newRule) { var c = newRule === false ? legacy(v) : empId(v); return c ? "The system will read this as " + c : ""; };
  var emailHint = function (v) { var c = emailId(v); return c ? "The system will read this as " + c : ""; };
  g.IDCLEAN = { empId: empId, emailId: emailId, legacy: legacy, empHint: empHint, emailHint: emailHint };
})(typeof window !== "undefined" ? window : globalThis);
