"use client";

import type { FacilityPolicies } from "@/lib/clientsDetail";

/**
 * Shared header for every split Facility Policies tab -- the first
 * editable data anywhere in this app (2026-09-04). Read mode shows an
 * "Edit" button; edit mode swaps it for Cancel/Save, matching the
 * global edit convention the original Phase 4 plan called for but never
 * built until now.
 */
export function PolicySectionHeader({
  title,
  editing,
  saving,
  onEdit,
  onCancel,
  onSave,
}: {
  title: string;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {editing ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          Edit
        </button>
      )}
    </div>
  );
}

/** Shown on an empty category for a QSX-legacy facility -- Process
 * Street has no equivalent step for these categories under QSX, so
 * "empty" here means "genuinely nothing to sync," not "hasn't answered
 * yet." */
export function QsxEmptyBanner({ category }: { category: string }) {
  return (
    <p className="mb-4 rounded border border-amber-900 bg-amber-950/10 p-3 text-sm text-amber-300">
      This is a QSX client -- Process Street has no {category} data for it. Click Edit to enter it manually.
    </p>
  );
}

/** Shown once a category has been flagged exempt -- see the backend's
 * `clients::policy_exemption` module doc for why this is permanent. */
export function ManuallyMaintainedNote() {
  return (
    <p className="mb-4 text-xs text-slate-500">
      Manually maintained for this QSX client -- a Process Street sync will never overwrite it.
    </p>
  );
}

export interface PolicyTabProps {
  companyId: string;
  facilityId: string;
  policies: FacilityPolicies;
  onSaved: () => Promise<void>;
}
