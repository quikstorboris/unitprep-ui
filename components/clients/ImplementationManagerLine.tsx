"use client";

import { useState } from "react";

import { listStaff, setImplementationManager } from "@/lib/clientsCompanies";
import type { StaffRef } from "@/types/generated/StaffRef";

/**
 * "Implementation manager: John Doe" under the company page's title row.
 * Sync fills it from the Process Street Intake's conductor email; "Change"
 * lets a person assign (or clear) it by hand, which sync then leaves alone.
 */
export default function ImplementationManagerLine({
  companyId,
  manager,
  onChanged,
}: {
  companyId: string;
  manager: StaffRef | null;
  onChanged: () => void;
}) {
  const [staff, setStaff] = useState<StaffRef[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startEditing() {
    setError(null);
    setSelected(manager?.id ?? "");
    setEditing(true);
    if (staff === null) {
      const result = await listStaff();
      if (result.kind !== "ok") {
        setError(result.message);
        setEditing(false);
        return;
      }
      setStaff(result.data.staff);
    }
  }

  async function save() {
    setPending(true);
    setError(null);
    const result = await setImplementationManager(
      companyId,
      selected === "" ? null : selected,
    );
    setPending(false);
    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }
    setEditing(false);
    onChanged();
  }

  return (
    <div className="-mt-3 flex flex-col gap-1">
      <p className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
        <span className="text-slate-500">Implementation manager:</span>
        {editing ? (
          <>
            <select
              aria-label="Implementation manager"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={staff === null || pending}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            >
              <option value="">Not assigned</option>
              {(staff ?? []).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={save}
              disabled={staff === null || pending}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {manager ? (
              manager.name
            ) : (
              <span className="text-slate-500">Not assigned</span>
            )}
            <button
              type="button"
              onClick={startEditing}
              className="text-xs text-blue-400 hover:underline"
            >
              Change
            </button>
          </>
        )}
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
