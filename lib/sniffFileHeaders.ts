import { readCsvHeaders } from "@/lib/sniffCsvHeaders";
import { readXlsxHeaders } from "@/lib/sniffXlsxHeaders";

// Extensions the backend can actually parse -- a real client-side
// capability check (see unit-groups' own copy), not vendor data.
export const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

export function isSupportedFile(file: { name: string }): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * The header row of a local file, read entirely in the browser (only the
 * first 64 KB of a CSV; the zip's needed parts of an .xlsx). `null` means
 * "can't be read here" -- legacy binary .xls, or a file that fails to
 * parse -- which the server reports back as "unreadable". File contents
 * beyond the header row are never sent anywhere.
 */
export async function sniffFileHeaders(file: File): Promise<string[] | null> {
  const name = file.name.toLowerCase();

  try {
    if (name.endsWith(".csv")) return await readCsvHeaders(file);
    if (name.endsWith(".xlsx")) return await readXlsxHeaders(file);
  } catch {
    return null;
  }

  return null;
}
