// How much of a CSV's start the browser reads to find its header row.
// Header-only on purpose: these folders hold card tokens/SSNs, and
// classification needs nothing but the column names.
export const CSV_SNIFF_BYTES = 64 * 1024;

/**
 * Parses just the FIRST record of CSV text -- quoted fields, escaped
 * quotes (`""`), and a newline inside a quoted header all handled --
 * and returns its trimmed cells, with trailing empty cells dropped.
 * A tab-delimited first line (more tabs than commas outside quotes) is
 * split on tabs instead.
 */
export function parseCsvHeaderRecord(text: string): string[] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = detectDelimiter(source);

  const cells: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      break;
    } else {
      field += ch;
    }
  }

  cells.push(field);

  const trimmed = cells.map((cell) => cell.trim());
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") trimmed.pop();
  return trimmed;
}

function detectDelimiter(text: string): "," | "\t" {
  let commas = 0;
  let tabs = 0;
  let inQuotes = false;

  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === "\n" || ch === "\r") break;
      if (ch === ",") commas++;
      else if (ch === "\t") tabs++;
    }
  }

  return tabs > commas ? "\t" : ",";
}

/** Reads only the first `CSV_SNIFF_BYTES` of `file` -- never the whole file. */
export async function readCsvHeaders(file: Blob): Promise<string[]> {
  const text = await file.slice(0, CSV_SNIFF_BYTES).text();
  return parseCsvHeaderRecord(text);
}
