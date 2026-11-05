// The PDF way of adding people (zc.js `pdfText` + `parseList`): a real PDF made from a sheet (Name, Mobile (optional), Employee ID) is read with the bundled pdf.js
// copy under apps/web/public/vendor/pdfjs; an empty cell stays empty and does not slide into the next column.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PUB = join(import.meta.dir, "../public");
const src = readFileSync(join(PUB, "zc.js"), "utf8").replace(/\r\n/g, "\n");
const slice = (from: string, to: string) => { const i = src.indexOf(from), j = src.indexOf(to, i); if (i < 0 || j < 0) throw new Error("zc.js changed shape: " + from); return src.slice(i, j + to.length); };

test("a PDF sheet is read into name, mobile and employee ID, with empty cells kept empty", async () => {
  const pdfFn = slice("  async function pdfText(file) {", "\n  }\n").replace('"./vendor/pdfjs/pdf.min.mjs"', JSON.stringify(join(PUB, "vendor/pdfjs/pdf.min.mjs"))).replace('new URL("./vendor/pdfjs/pdf.worker.min.mjs", location.href).href', JSON.stringify("file://" + join(PUB, "vendor/pdfjs/pdf.worker.min.mjs")));
  const parseFn = slice("  const looksPhone", "\n  };\n");
  const make = new Function("location", "vmode", `${pdfFn}\n${parseFn}\nreturn { pdfText, parseList };`) as any;
  const { pdfText, parseList } = make({ href: "file:///" }, () => "id");
  const buf = readFileSync(join(import.meta.dir, "fixtures/people-sheet.pdf"));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const text = await pdfText({ size: buf.byteLength, arrayBuffer: async () => ab });
  expect(text.split("\n")[0]).toBe("Name,Mobile (optional),Employee ID");
  expect(parseList(text)).toEqual([{ name: "Asha Rao", phone: "", empId: "E101" }, { name: "Ravi Shah", phone: "98765 43211", empId: "E102" }, { name: "Meena Iyer", phone: "98765 43212", empId: "" }]);
  await expect(pdfText({ size: 9 * 1024 * 1024, arrayBuffer: async () => new ArrayBuffer(0) })).rejects.toThrow(/too big/);
});
