"use client";

import { useState } from "react";

import { setClickUpParent, type ClickUpParentChange, type FacilitySummary } from "@/lib/clientsDetail";

/**
 * Which facility's ClickUp list is this company's **parent** -- the
 * source ClickUp Copy copies comments from. Only facilities that already
 * have a list linked can be chosen (a parent without a list has nothing
 * to copy). The list behind each name is the facility's own link, never
 * shown or typed here.
 *
 * Designations are rare, so every change is kept: the history below is
 * scrollable and oldest-first, ending with the current parent.
 */
export default function ClickUpParentPicker({
  companyId,
  facilities,
  parentFacilityId,
  history,
  canEdit,
  onChanged,
}: {
  companyId: string;
  facilities: FacilitySummary[];
  parentFacilityId: string | null;
  history: ClickUpParentChange[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = facilities.filter((facility) => facility.clickup_list_id);
  const parent = facilities.find((facility) => facility.id === parentFacilityId);
  const parentLostItsList = parent !== undefined && !parent.clickup_list_id;

  async function handleChange(value: string) {
    setError(null);
    setSaving(true);
    const result = await setClickUpParent(companyId, value === "" ? null : value);
    setSaving(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }
    onChanged();
  }

  return (
    <div className="mt-5 border-t border-slate-800 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="clickup-parent" className="text-sm font-medium text-slate-300">
          Parent facility
        </label>
        <select
          id="clickup-parent"
          value={parentFacilityId ?? ""}
          disabled={!canEdit || saving}
          onChange={(event) => void handleChange(event.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">None designated</option>
          {candidates.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Comments are copied from this facility&apos;s ClickUp list.
        </span>
      </div>

      {parentLostItsList && (
        <p role="alert" className="mt-2 text-sm text-amber-400">
          {parent?.name} no longer has a ClickUp list linked. Link it again, or choose another parent.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Parent history
          </h3>
          <ul className="max-h-32 overflow-y-auto rounded border border-slate-800 px-3 py-2 text-xs text-slate-400">
            {history.map((change) => (
              <li key={`${change.changed_at}-${change.to_facility_id ?? "none"}`} className="py-0.5">
                {new Date(change.changed_at).toLocaleString()} —{" "}
                {change.to_facility_name ?? "none"}
                {change.from_facility_name ? ` (was ${change.from_facility_name})` : ""}
                {change.changed_by_name ? ` · ${change.changed_by_name}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
