import { basename } from "@/lib/api";
import type { DiscoverResponse } from "@/types/api";

/**
 * Says plainly which unit file(s) the analysis will read, so the choice
 * made during discovery is visible next to the format being confirmed.
 * Renders nothing until discovery has settled on at least one file.
 */
export function UnitFileUsedNote({ discovery }: { discovery: DiscoverResponse }) {
  const names = discovery.selected_unit_file_names;

  if (names.length === 0) {
    return null;
  }

  return (
    <p className="mb-3 text-sm text-slate-300">
      {names.length === 1 ? "Unit file that will be used: " : "Unit files that will be used: "}
      <strong>{names.map(basename).join(", ")}</strong>
    </p>
  );
}
