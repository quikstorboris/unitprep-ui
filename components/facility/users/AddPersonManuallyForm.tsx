"use client";

import { ROLE_LABELS, type PersonFormState } from "./personRoster";

interface AddPersonManuallyFormProps {
  form: PersonFormState;
  saving: boolean;
  error: string | null;
  onFormChange: (form: PersonFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * UsersTab's own "+ Add Person Manually" form -- a manually-added
 * person is permanently exempt from the Process Street self-heal pass
 * (see UsersTab's own doc comment). Rendered by the parent only while
 * `addingManually` is true.
 */
export function AddPersonManuallyForm({
  form,
  saving,
  error,
  onFormChange,
  onSubmit,
  onCancel,
}: AddPersonManuallyFormProps) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded border border-slate-800 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={form.full_name}
          onChange={(e) => onFormChange({ ...form, full_name: e.target.value })}
          placeholder="Name"
          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
        />
        <input
          type="text"
          value={form.email}
          onChange={(e) => onFormChange({ ...form, email: e.target.value })}
          placeholder="Email"
          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
        />
        <input
          type="text"
          value={form.phone}
          onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
          placeholder="Phone"
          className="w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
        />
        <select
          value={form.role}
          onChange={(e) => onFormChange({ ...form, role: e.target.value })}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <span className="text-xs text-slate-500">Never overwritten by a Process Street sync.</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
