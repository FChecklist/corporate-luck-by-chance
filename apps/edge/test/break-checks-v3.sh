#!/usr/bin/env bash
# Deliberate-break checks for the Luck 1.4.1 tests (v3). For each rule: break the product (or the page script) on purpose, run the tests that guard it (they must go RED),
# put the file back byte for byte, run them again (they must be GREEN). The product is never left changed: every file is copied first and copied back, even on Ctrl-C.
# Usage (from the repository root):  bash apps/edge/test/break-checks-v3.sh [only-this-id]      Output: one line per break: id, red/green, number of failing tests.
set -u
cd "$(dirname "$0")/../../.."
ONLY="${1:-}"
WORK="$(mktemp -d)"
declare -A SAVED
restore() { for f in "${!SAVED[@]}"; do cp "${SAVED[$f]}" "$f"; done; SAVED=(); }
trap 'restore; rm -rf "$WORK"' EXIT

edit() { # file old new  (old must occur exactly once)
  python3 - "$1" "$2" "$3" <<'PY'
import sys
p, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding="utf8").read()
assert s.count(old) == 1, f"{p}: the text to break occurs {s.count(old)} times: {old[:70]}"
open(p, "w", encoding="utf8").write(s.replace(old, new))
PY
}
fails() { # test files... -> number of failing tests (last summary line of each folder run)
  local total=0 n
  for t in "$@"; do n="$(bun test --isolate "$t" 2>&1 | grep -E '^ *[0-9]+ fail' | tail -1 | awk '{print $1}')"; total=$((total + ${n:-999})); done
  echo "$total"
}
check() { # id file old new tests...
  local id="$1" file="$2" old="$3" new="$4"; shift 4
  [ -n "$ONLY" ] && [ "$ONLY" != "$id" ] && return 0
  local before after
  SAVED["$file"]="$WORK/$(echo "$file" | tr '/' '_')"; cp "$file" "${SAVED[$file]}"
  edit "$file" "$old" "$new" || { echo "$id: COULD NOT APPLY THE BREAK"; restore; return 0; }
  before="$(fails "$@")"
  restore
  after="$(fails "$@")"
  local verdict="OK"; { [ "$before" -gt 0 ] && [ "$after" -eq 0 ]; } || verdict="PROBLEM"
  printf '%-6s %-8s broken: %s failing   restored: %s failing   (%s)\n' "$id" "$verdict" "$before" "$after" "$file"
}

E=apps/edge/src; W=apps/web/public; ET=apps/edge/test; WT=apps/web/test
RV3=$ET/rules-v3.test.ts; RW3=$WT/rules-v3-web.test.ts; FIX=$ET/fix141.test.ts; MAT=$ET/idclean-matrix.test.ts; WEB=$WT/fix141-web.test.ts

# R1 account e-mails
check B01 $E/idclean.ts 'return BLANK_ONE.test(v) ? "" : v; };' 'return v.replace(BLANKS_G, ""); };' $FIX $RV3
check B02 $E/idclean.ts 'return BLANK_ONE.test(v) ? "" : v; };' 'return /s/.test(v) ? "" : v; };' $FIX
check B03 $E/testlogins.ts 'TEST_LOGINS.has(accountEmail(email))' 'TEST_LOGINS.has(String(email).normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase())' $FIX
check B04 $E/worker.ts '(hEmail && !EMAIL_RE.test(hEmail)) || (!hEmail && typeof hb?.email === "string" && hb.email.trim())' '(hEmail && !EMAIL_RE.test(hEmail))' $FIX
check B05 $E/idclean.ts 'export const emailId = (s: unknown): string => String(s ?? "").normalize("NFKC").replace(BLANKS_G, "").toLowerCase();' 'export const emailId = (s: unknown): string => String(s ?? "").normalize("NFKC").trim().toLowerCase();' $FIX $MAT $RV3
check B06 $E/idclean.ts 'export const LIST_EMAIL_SHAPE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;' 'export const LIST_EMAIL_SHAPE = /^[^s@]{1,64}@[^s@]{1,255}\.[^s@]{2,}$/;' $FIX
# R3 the lock
check B07 $E/worker.ts '|| (listed?.c ?? 0) > 0)) return json({ error: "You already have people listed.' ')) return json({ error: "You already have people listed.' $FIX
check B08 $E/worker.ts '&& ((have?.c ?? 0) > 0 || (listed?.c ?? 0) > 0)) return json({ error: "You already have people listed.' '&& ((listed?.c ?? 0) > 0)) return json({ error: "You already have people listed.' $FIX
check B09 $E/worker.ts 'code: "id-kind-locked" }, 409)' 'code: "id-kind-changed" }, 409)' $FIX
# R4
check B10 $E/idclean.ts 'export const EMP_CLEAN_FROM_MS = 4102444800000;' 'export const EMP_CLEAN_FROM_MS = 1;' $FIX
# R2 the hint, browser side
check B11 $W/luck.js 'h.textContent = isEmail ? IDCLEAN.emailHint(emp.value)' 'h.textContent = (isEmail || emp.value.indexOf("@") >= 0) ? IDCLEAN.emailHint(emp.value)' $WEB
check B12 $W/zc.js 'h.textContent = emKind() ? IDCLEAN.emailHint($("gemp").value)' 'h.textContent = (emKind() || $("gemp").value.indexOf("@") >= 0) ? IDCLEAN.emailHint($("gemp").value)' $WEB
check B13 $W/idclean.js 'var empHint = function (v, newRule) { if (looksLikeEmail(v)) return "This looks like an Email ID. This game asks for an employee ID: letters and numbers only.";' 'var empHint = function (v, newRule) {' $WEB
# guide
check B14 $W/guide.js 'You already have people listed. Start a new game to use a different kind of ID' 'You have people listed. Start a new game to use another kind of ID' $WEB
check B15 $W/guide.js 'An Email ID is asked on its own' 'An Email ID is asked alone' $WEB
# the cleaning matrix (whole matrix: product and browser mirror)
check B16 $E/idclean.ts 'replace(/[^A-Z0-9]/g, "")' 'replace(/[^A-Z0-9_]/g, "")' $MAT
check B17 $W/idclean.js 'var emailId = function (s) { return String(s == null ? "" : s).normalize("NFKC").replace(BLANKS_G, "").toLowerCase(); };' 'var emailId = function (s) { return String(s == null ? "" : s).normalize("NFKC").replace(BLANKS_G, ""); };' $MAT
# test-side items: the harness, the data map, the notes scan
check B18 $WT/harness.ts 'withKeep.flatMap((f) => (f === "zc.js" ? ["idclean.js", f] : [f]))' 'withKeep' $WEB
check B19 docs/PRIVACY_AND_LIFECYCLE.md 'asked_if_organizer_switches_on: mobile number, e-mail' 'asked_if_organizer_switches_on: mobile number' $ET/data-map.test.ts
check B20 $W/pack/zc-flow.js '"zf-ready " + (ok ? "ok" : "todo")' '"zf-ready " + (ok ? "ok" : "todo") + " /* TODO fix */"' $WT/no-internal-notes.test.ts
check B21 $W/zc.js 'const empNew = () =>' '// TODO: tidy this
  const empNew = () =>' $WT/no-internal-notes.test.ts
# v3 additions: the rules as written
check V01 $E/idclean.ts 'const BLANKS = "\\s\\u200B-\\u200D\\u2060\\uFEFF\\u0085\\u2028\\u2029";' 'const BLANKS = "\\s";' $RV3 $MAT
check V02 $E/idclean.ts 'export const EMP_MAX = 30;' 'export const EMP_MAX = 31;' $RV3 $MAT
check V03 $E/idclean.ts 'String(s ?? "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "")' 'String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")' $RV3 $MAT
check V04 $W/idclean.js 'var BLANKS_G = new RegExp("[\\s\\u200B-\\u200D\\u2060\\uFEFF\\u0085\\u2028\\u2029]+", "g");' 'var BLANKS_G = new RegExp("[\\s]+", "g");' $RW3
# the guarantee that nothing is left changed
PRODUCT="$(git diff --name-only origin/fix/luck-1.4.1-2026-10-30 -- . ':(exclude,glob)**/test/**' ':!docs/TESTER_REPORT.md')"
[ -z "$PRODUCT" ] && echo "ALL FILES RESTORED (product-code git diff against the product branch is empty)" || { echo "WARNING: product files differ from the product branch:"; echo "$PRODUCT"; }
