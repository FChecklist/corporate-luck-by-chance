// The PDFs we make carry the Corporate Luck by Chance badge (owner order 29 Oct 2026: uniform branding, the new logo). It is drawn as vector shapes, so no picture is embedded and the file stays small.
import { describe, expect, test } from "bun:test";
import { layoutPeoplePart, layoutReport, type ReportData } from "../src/report-layout";
import { PdfDoc } from "../src/pdf";

const base = (): ReportData => ({
  engagementId: "BADGE-1", organizerEmail: "boss@acme.com", sentAtMs: 1_800_000_000_000, scheduledMs: 1_799_990_000_000, firstNumberMs: 1_799_990_100_000, endMs: 1_799_995_000_000, endReason: "All dice rounds were played and the phones agreed on the result.", wasHeld: false,
  rounds: 1, callSeconds: 9, ticketsPerPerson: 1, cap: 100, inviteOnly: false, numbersCalled: 90, people: [], prizes: [], lucky: [], timeline: [], breaks: [], personalDeleteAtMs: 1_800_050_000_000, fullDeleteAtMs: 1_830_000_000_000,
});
const text = (b: Uint8Array) => Buffer.from(b).toString("latin1");
const TILE = "0.42 0.17 0.85 rg"; // #6A2BD9, the violet tile of logo.svg
const WHEEL = ["1 0.79 0.24 rg", "1 0.36 0.54 rg", "0.18 0.77 0.71 rg", "0.23 0.53 1 rg", "1 0.62 0.11 rg", "0.78 0.49 1 rg", "0.02 0.84 0.63 rg", "0.95 0.36 0.71 rg"]; // the eight wedges of the wheel, in order

describe("the badge in the PDFs", () => {
  test("the game report has the violet tile, all eight wheel colours and the die, and no embedded picture", () => {
    const t = text(layoutReport(base()));
    expect(t).toContain(TILE); for (const c of WHEEL) expect(t).toContain(c);
    expect(t).toContain("0.88 0.19 0.19 rg"); // the red pip of the die (#E03131)
    expect(t).not.toContain("/Subtype /Image");
  });
  test("the wheel is drawn in the order of logo.svg: the first wedge is the marigold one, then pink, teal and blue", () => {
    const t = text(layoutReport(base())), at = WHEEL.slice(1, 4).map((c) => t.indexOf(c, t.indexOf(TILE)));
    expect(at.every((i) => i > 0) && at[0]! < at[1]! && at[1]! < at[2]!).toBe(true);
  });
  test("the extra people PDFs of a big game have it too", () => {
    const t = text(layoutPeoplePart(base(), [], 1, 1)); expect(t).toContain(TILE); expect(t).toContain(WHEEL[2]!);
  });
  test("the accent line and the brand line use the kit's marigold (#FFC93C), not the old gold", () => {
    const t = text(layoutReport(base())); expect(t).toContain("1 0.79 0.24 rg"); expect(t).not.toContain("0.79 0.64 0.29");
  });
  test("a page without the badge call has none of it (so the checks above can fail)", () => {
    const d = new PdfDoc(); d.para("plain"); expect(text(d.build())).not.toContain(TILE);
  });
});
