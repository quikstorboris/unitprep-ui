import { strFromU8, unzipSync } from "fflate";

// A minimal, tolerant .xlsx reader that returns ONLY row 1 of the FIRST
// sheet (workbook order) -- what the server's own header read does too.
// An .xlsx is a zip: the workbook part names the first sheet, the
// workbook's rels part maps that to a file, and the sheet's cells point
// into the shared-strings part. Only the parts needed are inflated, and
// the sheet XML is scanned with regexes up to the end of its first row
// instead of building a DOM of a possibly huge sheet.

const ATTR_CACHE = new Map<string, RegExp>();

function attr(tag: string, name: string): string | null {
  let re = ATTR_CACHE.get(name);
  if (!re) {
    re = new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
    ATTR_CACHE.set(name, re);
  }
  const m = re.exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? "") : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    // OOXML escapes control chars in text as _xHHHH_.
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** Concatenated text of every `<t>` run (rich-text aware), skipping phonetic runs. */
function textRuns(xml: string): string {
  const cleaned = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, "");
  let out = "";
  for (const m of cleaned.matchAll(/<(?:\w+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g)) {
    out += decodeEntities(m[1] ?? "");
  }
  return out;
}

function unzipParts(bytes: Uint8Array, names: string[]): Record<string, string> {
  const wanted = new Set(names);
  const parts = unzipSync(bytes, { filter: (f) => wanted.has(f.name) });
  const out: Record<string, string> = {};
  for (const [name, data] of Object.entries(parts)) out[name] = strFromU8(data);
  return out;
}

function resolveTarget(target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const segments = ["xl", ...target.split("/")];
  const stack: string[] = [];
  for (const seg of segments) {
    if (seg === "..") stack.pop();
    else if (seg && seg !== ".") stack.push(seg);
  }
  return stack.join("/");
}

function relationshipTargets(relsXml: string): Map<string, { target: string; type: string }> {
  const map = new Map<string, { target: string; type: string }>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) map.set(id, { target, type: attr(m[0], "Type") ?? "" });
  }
  return map;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Za-z]+/.exec(ref)?.[0].toUpperCase() ?? "";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function sharedStringAt(sstXml: string, wanted: Set<number>): Map<number, string> {
  const found = new Map<number, string>();
  const last = Math.max(...wanted);
  let index = 0;
  for (const m of sstXml.matchAll(/<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g)) {
    if (wanted.has(index)) found.set(index, textRuns(m[1] ?? ""));
    if (++index > last) break;
  }
  return found;
}

/** Row 1 of the first sheet of an .xlsx, as trimmed header strings. */
export function readXlsxHeadersFromBytes(bytes: Uint8Array): string[] {
  const head = unzipParts(bytes, ["xl/workbook.xml", "xl/_rels/workbook.xml.rels"]);
  const workbook = head["xl/workbook.xml"];
  const rels = head["xl/_rels/workbook.xml.rels"];
  if (!workbook || !rels) throw new Error("Not a valid .xlsx workbook");

  const sheetTag = /<(?:\w+:)?sheet\b[^>]*>/.exec(workbook)?.[0];
  const relId = sheetTag ? attr(sheetTag, "id") : null;
  const relMap = relationshipTargets(rels);
  const sheetRel = relId ? relMap.get(relId) : undefined;
  if (!sheetRel) throw new Error("Workbook has no readable first sheet");

  const sheetPath = resolveTarget(sheetRel.target);
  const sstPath =
    [...relMap.values()]
      .filter((r) => /\/sharedStrings$/.test(r.type))
      .map((r) => resolveTarget(r.target))[0] ?? "xl/sharedStrings.xml";

  const sheetXml = unzipParts(bytes, [sheetPath])[sheetPath];
  if (sheetXml === undefined) throw new Error("First sheet part is missing");

  const rowMatch = /<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/.exec(sheetXml);
  const rowRef = rowMatch ? attr(rowMatch[1], "r") : null;
  // The first row element isn't row 1 -> row 1 is empty.
  if (!rowMatch || (rowRef !== null && rowRef !== "1")) return [];

  type Cell = { col: number; type: string | null; value: string };
  const cells: Cell[] = [];
  let next = 0;

  for (const m of (rowMatch[2] ?? "").matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
    const ref = attr(m[1], "r");
    const col = ref ? columnIndex(ref) : next;
    next = col + 1;
    const type = attr(m[1], "t");
    const inner = m[2] ?? "";
    let value = "";
    if (type === "inlineStr") {
      value = textRuns(inner);
    } else {
      const v = /<(?:\w+:)?v\b[^>]*?>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner);
      value = v ? decodeEntities(v[1]) : "";
    }
    cells.push({ col, type, value });
  }

  const sharedIdx = new Set<number>();
  for (const c of cells) if (c.type === "s" && /^\d+$/.test(c.value.trim())) sharedIdx.add(Number(c.value));
  const shared =
    sharedIdx.size > 0
      ? sharedStringAt(unzipParts(bytes, [sstPath])[sstPath] ?? "", sharedIdx)
      : new Map<number, string>();

  const headers: string[] = [];
  for (const c of cells) {
    const text = c.type === "s" ? (shared.get(Number(c.value)) ?? "") : c.value;
    while (headers.length < c.col) headers.push("");
    headers[c.col] = text.trim();
  }
  while (headers.length > 0 && headers[headers.length - 1] === "") headers.pop();
  return headers;
}

export async function readXlsxHeaders(file: Blob): Promise<string[]> {
  return readXlsxHeadersFromBytes(new Uint8Array(await file.arrayBuffer()));
}
