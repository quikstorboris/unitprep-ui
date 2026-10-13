"use client";

import type { FacilityRef } from "@/lib/clickupBulkCopy";
import FacilityMultiSelect, { type FacilityOption } from "./FacilityMultiSelect";

/**
 * Where the comments go: the facilities, chosen once for every chosen
 * task, from a dropdown of checkboxes -- none is chosen until the person
 * ticks it. Which task each comment lands on in each facility is set on
 * the task's own card.
 */
export default function BulkDestinations({
  destinations,
  ticked,
  blocked,
  unlinked,
  onToggle,
  onSetAll,
}: {
  destinations: FacilityRef[];
  ticked: Record<string, boolean>;
  /** Facilities whose ClickUp list could not be read, with why. */
  blocked: Record<string, string>;
  unlinked: FacilityRef[];
  onToggle: (facilityId: string) => void;
  onSetAll: (checked: boolean) => void;
}) {
  if (destinations.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        This client has no other facility with a ClickUp list linked, so there is nowhere to copy to.
      </p>
    );
  }

  const picker: FacilityOption[] = destinations.map((destination) => ({
    id: destination.facility_id,
    name: destination.facility_name,
    checked: Boolean(ticked[destination.facility_id]),
    disabledReason: blocked[destination.facility_id],
    hint: blocked[destination.facility_id] ? "Its ClickUp list could not be read" : undefined,
  }));

  const chosen = destinations.filter((destination) => ticked[destination.facility_id]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-200">Copy to</h3>
        <FacilityMultiSelect options={picker} onToggle={onToggle} onSetAll={onSetAll} />
      </div>

      {chosen.length === 0 && <p className="text-sm text-slate-500">No facilities selected yet.</p>}

      {unlinked.length > 0 && (
        <p className="text-xs text-slate-500">
          Not offered, no ClickUp list linked yet: {unlinked.map((facility) => facility.facility_name).join(", ")}.
        </p>
      )}
    </div>
  );
}
