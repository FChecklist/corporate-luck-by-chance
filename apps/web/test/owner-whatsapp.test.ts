import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const dir = join(import.meta.dir, "..", "public")
const LINK = 'href="https://wa.me/919650397480?text=Hi%2C%20I%20am%20interested%20in%20corporate%20games"'

describe("owner number opens WhatsApp", () => {
  test("every page that shows the number links it to wa.me", () => {
    const pages = readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => [f, readFileSync(join(dir, f), "utf8")] as const).filter(([, h]) => h.includes("96503 97480"))
    expect(pages.length).toBeGreaterThan(0)
    for (const [f, h] of pages) {
      if (/<a [^>]*>\(\+91\) 96503 97480<\/a>/.test(h) || h.includes("tel:")) expect(h.includes(LINK) && !h.includes("tel:+919650397480")).toBe(true)
      else if (f !== "contact.html" && f !== "terms.html") throw new Error(f + " shows the number without a link")
    }
  })
})
