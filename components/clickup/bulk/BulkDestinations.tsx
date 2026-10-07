"use client";

import type { BulkPairs, DestinationPairs, FacilityRef } from "@/lib/clickupBulkCopy";
import type { CopyTaskInfo } from "@/lib/clickupCopy";
import FacilityMultiSelect, { type FacilityOption } from "./FacilityMultiSelect";
import type { DestinationState } from "./useBulkCopy";

function taskLabel(task: CopyTaskInfo): string {
  return task.parent_name ? `${task.name} — ${task.parent_name}` : task.name;
}

/** The suggestion and near misses first, then everything else. */
function options(destination: DestinationPairs): CopyTaskInfo[] {
  const preferred = [destination.target, ...destination.alternatives].filter((task) => task !== null);
  const ids = new Set(preferred.map((task) => task.task_id));
  return [...preferred, ...destination.tasks.filter((task) => !ids.has(task.task_id))];
}

/**
 * Where the comment goes. The facilities are chosen from a dropdown of
 * checkboxes -- none is chosen until the person ticks it -- and each one
 * chosen gets a row with the task the comment will be posted on (a
 * suggestion the person can change). A chosen facility with no
 * counterpart must have a task picked, or be unticked, before the copy
 * can be confirmed.
 */
export default function BulkDestinations({
  pairs,
  destinations,
  unlinked,
  onToggle,
  onSetAll,
  onChooseTarget,
}: {
  pairs: BulkPairs;
  destinations: Record<string, DestinationState>;
  unlinked: FacilityRef[];
  onToggle: (facilityId: string) => void;
  onSetAll: (checked: boolean) => void;
  onChooseTarget: (facilityId: string, targetTaskId: string | null) => void;
}) {
  if (pairs.destinations.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        This client has no other facility with a ClickUp list linked, so there is nowhere to copy to.
      </p>
    );
  }

  const picker: FacilityOption[] = pairs.destinations.map((destination) => {
    const state = destinations[destination.facility_id];
    return {
      id: destination.facility_id,
      name: destination.facility_name,
      checked: Boolean(state?.checked),
      disabledReason: destination.error ?? undefined,
      hint: destination.error
        ? "Its ClickUp list could not be read"
        : destination.target === null
          ? "No matching task found — you will choose one"
          : undefined,
    };
  });

  const chosen = pairs.destinations.filter((destination) => destinations[destination.facility_id]?.checked);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-200">Copy to</h3>
        <FacilityMultiSelect options={picker} onToggle={onToggle} onSetAll={onSetAll} />
      </div>

      {chosen.length === 0 ? (
        <p className="text-sm text-slate-500">No facilities selected yet.</p>
      ) : (
        <ul className="divide-y divide-slate-800 rounded border border-slate-800">
          {chosen.map((destination) => {
            const state = destinations[destination.facility_id];

            return (
              <li
                key={destination.facility_id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-3 p-3"
              >
                <span className="min-w-0 break-words text-sm text-slate-200">{destination.facility_name}</span>

                <div className="min-w-0">
                  <select
                    aria-label={`Task in ${destination.facility_name}`}
                    value={state.targetTaskId ?? ""}
                    onChange={(event) =>
                      onChooseTarget(
                        destination.facility_id,
                        event.target.value === "" ? null : event.target.value
                      )
                    }
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                  >
                    <option value="">Choose a task…</option>
                    {options(destination).map((task) => (
                      <option key={task.task_id} value={task.task_id}>
                        {taskLabel(task)}
                      </option>
                    ))}
                  </select>
                  {state.targetTaskId === null && (
                    <p role="alert" className="mt-1 text-xs text-amber-300">
                      Choose the task for this facility, or untick it above.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {unlinked.length > 0 && (
        <p className="text-xs text-slate-500">
          Not offered, no ClickUp list linked yet: {unlinked.map((facility) => facility.facility_name).join(", ")}.
        </p>
      )}
    </div>
  );
}
