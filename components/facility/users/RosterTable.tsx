"use client";

import { formatPhone } from "@/lib/format";
import type { FacilityPerson } from "@/lib/clientsDetail";
import { ROLE_LABELS, SOURCE_LABELS, type PersonFormState } from "./personRoster";

interface RosterTableProps {
  roster: FacilityPerson[];
  pendingKey: string | null;
  editingKey: string | null;
  editForm: PersonFormState;
  editProtect: boolean;
  editSaving: boolean;
  editError: string | null;
  onStartEdit: (person: FacilityPerson) => void;
  onCancelEdit: () => void;
  onEditFormChange: (form: PersonFormState) => void;
  onEditProtectChange: (protect: boolean) => void;
  onSaveEdit: (person: FacilityPerson) => void;
  onRemove: (person: FacilityPerson) => void;
}

/**
 * UsersTab's own roster table -- every linked person, with an inline
 * Edit row (name/email/phone/role, plus a Process-Street-only "protect
 * from sync" checkbox) and a direct Remove action. Extracted verbatim
 * out of UsersTab, which still owns all of this state (edit form,
 * pending/saving/error) since editing and removal both need to trigger
 * a roster reload afterwards.
 */
export function RosterTable({
  roster,
  pendingKey,
  editingKey,
  editForm,
  editProtect,
  editSaving,
  editError,
  onStartEdit,
  onCancelEdit,
  onEditFormChange,
  onEditProtectChange,
  onSaveEdit,
  onRemove,
}: RosterTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400">
          <tr>
            <th className="pr-4 pb-2 font-medium">Name</th>
            <th className="w-56 pr-4 pb-2 font-medium">Email</th>
            <th className="w-40 pr-4 pb-2 font-medium">Phone</th>
            <th className="pr-4 pb-2 font-medium">Role</th>
            <th className="pr-4 pb-2 font-medium">Source</th>
            <th className="pb-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {roster.map((person) => {
            const key = `${person.person_id}-${person.role}`;
            const isEditing = editingKey === key;

            if (isEditing) {
              return (
                <tr key={key} className="border-t border-slate-800">
                  <td colSpan={6} className="py-3">
                    <div className="flex flex-col gap-2 rounded border border-slate-800 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={editForm.full_name}
                          onChange={(e) => onEditFormChange({ ...editForm, full_name: e.target.value })}
                          placeholder="Name"
                          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                        />
                        <input
                          type="text"
                          value={editForm.email}
                          onChange={(e) => onEditFormChange({ ...editForm, email: e.target.value })}
                          placeholder="Email"
                          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                        />
                        <input
                          type="text"
                          value={editForm.phone}
                          onChange={(e) => onEditFormChange({ ...editForm, phone: e.target.value })}
                          placeholder="Phone"
                          className="w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                        />
                        <select
                          value={editForm.role}
                          onChange={(e) => onEditFormChange({ ...editForm, role: e.target.value })}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                        >
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {person.source === "process_street" && (
                        <label className="flex items-center gap-2 text-xs text-amber-300">
                          <input
                            type="checkbox"
                            checked={editProtect}
                            onChange={(e) => onEditProtectChange(e.target.checked)}
                          />
                          This person came from Process Street -- without protecting, a future sync could
                          silently revert this edit. Protect it from that.
                        </label>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSaveEdit(person)}
                          disabled={editSaving}
                          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {editSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          disabled={editSaving}
                          className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                      {editError && (
                        <p role="alert" className="text-sm text-red-400">
                          {editError}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={key} className="border-t border-slate-800">
                <td className="py-2 pr-4">{person.full_name}</td>
                <td className="py-2 pr-4 text-slate-400">{person.email ?? "—"}</td>
                <td className="py-2 pr-4 text-slate-400">{person.phone ? formatPhone(person.phone) : "—"}</td>
                <td className="py-2 pr-4">
                  <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-slate-400">
                    {ROLE_LABELS[person.role] ?? person.role}
                  </span>
                </td>
                <td className="py-2 pr-4 text-slate-400">{SOURCE_LABELS[person.source] ?? person.source}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onStartEdit(person)}
                      className="rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(person)}
                      disabled={pendingKey === `${person.person_id}:${person.role}`}
                      className="rounded border border-red-900 px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
