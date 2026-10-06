"use client";

import { useEffect, useState } from "react";

import {
  getTaskRoles,
  normalizeTaskNames,
  updateTaskRole,
  type TaskRole,
} from "@/lib/processStreetTaskRoles";
import { useSaveStatus } from "@/lib/useSaveStatus";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * "Task mapping" section of the Process Street settings page: for each
 * role, the PS task names it resolves through, as removable chips plus an
 * add field. Saves per role (its own endpoint), independent of the sync
 * settings form above it. The coverage line is how a future template
 * rename shows up -- matches dropping below the linked-facility count.
 */
export function TaskMappingSection() {
  const [roles, setRoles] = useState<TaskRole[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await getTaskRoles();
      if (result.kind !== "ok") {
        setLoadError(result.message);
        return;
      }
      setLoadError(null);
      setRoles(result.data.roles);
    });
  }, []);

  function replaceRole(updated: TaskRole) {
    setRoles((current) =>
      current ? current.map((role) => (role.role === updated.role ? updated : role)) : current
    );
  }

  return (
    <section className="mt-6 max-w-lg rounded border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-100">Task mapping</h2>
      <p className="mb-3 text-sm text-slate-400">
        Which Process Street checklist tasks count for each status below. List every name a task
        has had (older runs keep the old name); matching ignores case. Tasks Process Street hides
        on a run are never matched.
      </p>

      {loadError && (
        <p role="alert" className="text-sm text-red-400">
          {loadError}
        </p>
      )}
      {roles === null && !loadError && <p className="text-sm text-slate-400">Loading…</p>}
      {roles?.map((role) => (
        <TaskRoleEditor key={role.role} role={role} onSaved={replaceRole} />
      ))}
    </section>
  );
}

function TaskRoleEditor({ role, onSaved }: { role: TaskRole; onSaved: (role: TaskRole) => void }) {
  const [names, setNames] = useState<string[]>(role.task_names);
  const [draft, setDraft] = useState("");
  const { saving, saved, saveError, runSave, clearSaved } = useSaveStatus<TaskRole>();

  const dirty = JSON.stringify(names) !== JSON.stringify(role.task_names);

  function addDraft() {
    const next = normalizeTaskNames([...names, draft]);
    setDraft("");
    if (next.length === names.length) return;
    clearSaved();
    setNames(next);
  }

  async function handleSave() {
    const result = await runSave(() => updateTaskRole(role.role, names));
    if (!result) return;
    setNames(result.task_names);
    onSaved(result);
  }

  return (
    <div className="border-t border-slate-800 pt-3">
      <h3 className="text-sm font-medium text-slate-200">{role.label}</h3>
      <p className="mb-2 text-xs text-slate-500">{role.description}</p>

      <ul className="mb-2 flex flex-wrap gap-2" aria-label={`${role.label} task names`}>
        {names.map((name) => (
          <li
            key={name}
            className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 py-0.5 pl-3 pr-1 text-sm text-slate-200"
          >
            {name}
            <button
              type="button"
              aria-label={`Remove ${name}`}
              disabled={names.length === 1}
              onClick={() => {
                clearSaved();
                setNames(names.filter((existing) => existing !== name));
              }}
              className="rounded-full px-1.5 text-slate-400 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          placeholder="Add a task name"
          aria-label={`Add a ${role.label} task name`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addDraft();
            }
          }}
          className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={draft.trim().length === 0}
          className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Matched in {role.facilities_matched} of {role.facilities_total} facilities with a synced
        Merchant Account run.
      </p>

      {saveError && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {saveError}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={saving || !dirty || names.length === 0}
          onClick={handleSave}
          className={primaryButtonClass}
        >
          {saving ? "Saving…" : "Save mapping"}
        </button>
        {saved && !dirty && <span className="text-sm text-green-400">Saved.</span>}
      </div>
    </div>
  );
}
