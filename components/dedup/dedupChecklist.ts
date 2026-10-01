import type { DedupClassifyResponse, DedupFileClassification } from "@/types/api";

/** Why a file can't be run, or `null` when it can. */
export function blockReasonFor(file: DedupFileClassification): string | null {
  if (file.status === "unreadable") return "could not be read";
  if (file.status !== "recognized") return "is not a dedup file";
  if (file.role === "supporting") return "is a supporting file that is not used yet";
  return null;
}

/** The files the user has ticked, in checklist order. */
export function checkedFilesOf(
  files: DedupFileClassification[],
  checked: ReadonlySet<string>
): DedupFileClassification[] {
  return files.filter((f) => checked.has(f.file_name));
}

/**
 * Run is allowed only with at least one ticked file and every ticked file
 * runnable. `blocked` names the ticked files that stop it, for a clear
 * message instead of a silently disabled button.
 */
export function runGate(
  files: DedupFileClassification[],
  checked: ReadonlySet<string>
): { canRun: boolean; blocked: { file: DedupFileClassification; reason: string }[] } {
  const ticked = checkedFilesOf(files, checked);
  const blocked = ticked.flatMap((file) => {
    const reason = blockReasonFor(file);
    return reason ? [{ file, reason }] : [];
  });

  return { canRun: ticked.length > 0 && blocked.length === 0, blocked };
}

/** Distinct detected format names of the ticked files, for the confirm gate. */
export function checkedFormatNames(
  files: DedupFileClassification[],
  checked: ReadonlySet<string>
): string[] {
  const names = checkedFilesOf(files, checked).flatMap((f) => (f.format_name ? [f.format_name] : []));
  return [...new Set(names)];
}

/** The initial ticked set: the server's `suggested.selected`, limited to files it returned. */
export function initialChecked(response: DedupClassifyResponse): Set<string> {
  const known = new Set(response.files.map((f) => f.file_name));
  return new Set(response.suggested.selected.filter((name) => known.has(name)));
}
