import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { readXlsxHeaders, readXlsxHeadersFromBytes } from "./sniffXlsxHeaders";

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

interface Fixture {
  sheetXml: string;
  sharedStrings?: string;
  /** Workbook sheet order; defaults to one sheet pointing at sheet1.xml. */
  sheets?: { name: string; rid: string }[];
  rels?: string;
  extraParts?: Record<string, string>;
}

function buildXlsx(f: Fixture): Uint8Array {
  const sheets = f.sheets ?? [{ name: "Sheet1", rid: "rId1" }];
  const parts: Record<string, Uint8Array> = {
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
        .map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="${s.rid}"/>`)
        .join("")}</sheets></workbook>`
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      f.rels ??
        `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0"?><worksheet ${NS}><sheetData>${f.sheetXml}</sheetData></worksheet>`
    ),
  };
  if (f.sharedStrings !== undefined) {
    parts["xl/sharedStrings.xml"] = strToU8(`<?xml version="1.0"?><sst ${NS}>${f.sharedStrings}</sst>`);
  }
  for (const [name, text] of Object.entries(f.extraParts ?? {})) parts[name] = strToU8(text);
  return zipSync(parts);
}

describe("readXlsxHeadersFromBytes", async () => {
  it("reads shared strings, inline strings and plain values from row 1 only", async () => {
    const bytes = buildXlsx({
      sharedStrings: "<si><t>Tenant Name</t></si><si><t>Unit</t></si><si><t>Row2 Only</t></si>",
      sheetXml:
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Email</t></is></c><c r="C1"><v>2024</v></c><c r="D1" t="str"><v>Formula Result</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>2</v></c></row>',
    });

    expect(await readXlsxHeadersFromBytes(bytes)).toEqual(["Tenant Name", "Email", "2024", "Formula Result"]);
  });

  it("concatenates rich-text runs, ignores phonetic runs, decodes entities and trims", async () => {
    const bytes = buildXlsx({
      sharedStrings:
        '<si><r><t xml:space="preserve">Phone </t></r><r><rPr><b/></rPr><t>Number</t></r><rPh sb="0"><t>ignored</t></rPh></si><si><t>Rent &amp; Fees </t></si>',
      sheetXml: '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>',
    });

    expect(await readXlsxHeadersFromBytes(bytes)).toEqual(["Phone Number", "Rent & Fees"]);
  });

  it("keeps gap columns positional and drops empty trailing cells", async () => {
    const bytes = buildXlsx({
      sharedStrings: "<si><t>A</t></si><si><t>D</t></si>",
      sheetXml:
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="D1" t="s"><v>1</v></c><c r="E1"/><c r="F1" t="inlineStr"><is><t> </t></is></c></row>',
    });

    expect(await readXlsxHeadersFromBytes(bytes)).toEqual(["A", "", "", "D"]);
  });

  it("honors two-letter column references", async () => {
    const bytes = buildXlsx({
      sheetXml: '<row r="1"><c r="Z1" t="inlineStr"><is><t>Z</t></is></c><c r="AA1" t="inlineStr"><is><t>AA</t></is></c></row>',
    });

    const headers = await readXlsxHeadersFromBytes(bytes);
    expect(headers).toHaveLength(27);
    expect(headers[25]).toBe("Z");
    expect(headers[26]).toBe("AA");
  });

  it("uses the FIRST sheet in workbook order, resolved through the rels", async () => {
    const bytes = buildXlsx({
      sheets: [
        { name: "Second On Disk", rid: "rId9" },
        { name: "Other", rid: "rId1" },
      ],
      rels: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId9" Type="x/worksheet" Target="/xl/worksheets/sheet7.xml"/></Relationships>`,
      sheetXml: '<row r="1"><c r="A1" t="inlineStr"><is><t>Wrong Sheet</t></is></c></row>',
      extraParts: {
        "xl/worksheets/sheet7.xml": `<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Right Sheet</t></is></c></row></sheetData></worksheet>`,
      },
    });

    expect(await readXlsxHeadersFromBytes(bytes)).toEqual(["Right Sheet"]);
  });

  it("returns no headers for an empty sheet", async () => {
    expect(await readXlsxHeadersFromBytes(buildXlsx({ sheetXml: "" }))).toEqual([]);
  });

  it("throws on a file that is not a zip", async () => {
    await expect(readXlsxHeadersFromBytes(strToU8("not a zip"))).rejects.toThrow();
  });
});

describe("readXlsxHeaders", () => {
  it("reads from a File", async () => {
    const bytes = buildXlsx({
      sheetXml: '<row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c></row>',
    });
    const file = new File([bytes.buffer as ArrayBuffer], "x.xlsx");

    expect(await readXlsxHeaders(file)).toEqual(["Name"]);
  });
});
