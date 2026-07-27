import type { DiscoverResponse } from "@/types/api";

interface DiscoveredGroupNamesSummaryProps {
  discovery: DiscoverResponse;
}

/**
 * Right after Unit Files Selected, ahead of Confirm Unit File Format --
 * group names still aren't populated until format resolution finishes
 * (they read the resolved UnitGroup column, not raw headers), so the
 * parent panel renders this only once `discovery.discovered_group_names`
 * is non-empty.
 */
export function DiscoveredGroupNamesSummary({
  discovery,
}: DiscoveredGroupNamesSummaryProps) {
  return (
    <div className="mt-4 rounded border border-slate-700 p-4">
      <div className="mb-2 flex items-start gap-2 text-sm text-yellow-300">
        <span aria-hidden="true">
          ⚠️
        </span>

        <span>
          {
            discovery
              .discovered_group_names
              .length
          }{" "}
          distinct group name
          {discovery
            .discovered_group_names
            .length === 1
            ? ""
            : "s"}{" "}
          found across the
          confirmed unit files —
          review below,
          especially anything
          listed under Uncommon
          Group Names.
        </span>
      </div>

      <details>
        <summary className="cursor-pointer text-sm font-medium text-slate-300">
          {
            discovery
              .discovered_group_names
              .length
          }{" "}
          distinct group
          {discovery
            .discovered_group_names
            .length === 1
            ? ""
            : "s"}{" "}
          found — click to
          review
        </summary>

        {discovery
          .uncommon_group_names
          .length > 0 && (
          <div className="mt-2">
            <div className="text-sm font-semibold text-red-400">
              Uncommon Group
              Names
            </div>

            <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-red-300">
              {discovery.uncommon_group_names.map(
                (name) => (
                  <li key={name}>
                    {name}
                  </li>
                )
              )}
            </ul>
          </div>
        )}

        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-200">
          {discovery.discovered_group_names
            .filter(
              (name) =>
                !discovery.uncommon_group_names.includes(
                  name
                )
            )
            .map((name) => (
              <li key={name}>
                {name}
              </li>
            ))}
        </ul>
      </details>
    </div>
  );
}
