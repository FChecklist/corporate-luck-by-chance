// Found by the 100-million smoke test (rule R-16, 2026-11-04, luck seeds 1573 / 1724 / 2120): cleanName trimmed BEFORE cutting to 24 characters, so a seat's shown name could end in a blank
// ("abcdefghijklmnopqrstuvw ") or half an emoji. The shown names are tidy: no blank at either end, at most 24 characters, "Player" if empty.
// FALSIFIED BY: luck-clean-name-cut-before-trim (cleanName: .trim().slice(0, 24) with nothing after the cut)
import { expect, test } from "bun:test";
import { cleanName } from "../src/luck";

test("a name cut to 24 characters never ends in a blank or half an emoji", () => {
  expect(cleanName("abcdefghijklmnopqrstuvw xyz")).toBe("abcdefghijklmnopqrstuvw");
  const e = cleanName("abcdefghijklmnopqrstuvw\u{1F600}tail");
  expect(e).toBe("abcdefghijklmnopqrstuvw");
  expect(cleanName(e)).toBe(e);
  expect(cleanName("  <b>Priya</b>   Kumar ")).toBe("bPriya/b Kumar"); // markup characters are dropped, blanks collapse
  expect(cleanName("   ")).toBe("Player");
  expect(cleanName(null)).toBe("Player");
});
