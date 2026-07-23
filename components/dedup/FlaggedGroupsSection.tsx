import Tooltip from "@/components/Tooltip";
import { formatUnits } from "@/lib/format";
import type { FlaggedGroupView } from "@/types/api";

interface FlaggedGroupsSectionProps {
  groups: FlaggedGroupView[];
}

const COMPANY_MISMATCH_TOOLTIP =
  "This tenant has more than one company name on file. Since they'll manage all their units " +
  "through one tenant-portal login, you'll need to decide how this account should be organized — " +
  "usually by picking one company name and updating the other unit(s) to match.";

export default function FlaggedGroupsSection({
  groups,
}: FlaggedGroupsSectionProps) {
  return (
    <details
      open
      className="rounded border border-slate-700 p-4"
    >
      <summary className="cursor-pointer text-xl font-semibold">
        Flagged Groups ({groups.length})
      </summary>

      <div className="mt-4 space-y-4">
        {groups.length === 0 ? (
          <div className="text-green-400">
            No duplicate tenants flagged.
          </div>
        ) : (
          groups.map((group, index) => (
            <div
              key={`${group.key}-${index}`}
              className="rounded border border-slate-800 p-4"
            >
              <div className="mb-1 font-semibold">
                {group.display_name}
                {" — "}
                {formatUnits(group.units)}
              </div>

              <div className="mb-3 text-sm text-slate-400">
                Mismatches:{" "}
                {group.categories.join(", ")}
              </div>

              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                {group.bullets.map((bullet) => (
                  <li key={bullet.field}>
                    {bullet.sentence}
                    {bullet.cell_refs.length > 0 && (
                      <span className="ml-1 text-slate-500">
                        ({bullet.cell_refs.join(", ")})
                      </span>
                    )}
                    {bullet.field === "CompanyName" && (
                      <Tooltip text={COMPANY_MISMATCH_TOOLTIP} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
