"use client";

import { useState } from "react";

import {
  applyResync,
  previewResync,
  type ConflictResolution,
  type ResyncConflict,
} from "@/lib/clientsCompanies";

const buttonClass =
  "rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

type Choice = "keep_oo" | "use_ps";

/**
 * Scoped manual "Re-sync" for one company's own detail page -- lets a
 * manager re-pull this company's and its facilities' data from Process
 * Street right now, without waiting for the next scheduled interval
 * (see the integration settings page). Two-phase, matching
 * `api::clients_resync`'s own backend split: preview first; if nothing
 * conflicts with a manual correction, applies immediately; if something
 * does, shows it and lets the manager choose, per field, before
 * anything is written.
 */
export default function ResyncButton({ companyId }: { companyId: string }) {
  const [checking, setChecking] = useState(false);
  const [conflicts, setConflicts] = useState<ResyncConflict[] | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function conflictKey(conflict: ResyncConflict): string {
    return `${conflict.entity_type}:${conflict.entity_id}:${conflict.field}`;
  }

  async function handleResyncClick() {
    setError(null);
    setResult(null);
    setChecking(true);

    const preview = await previewResync(companyId);
    setChecking(false);

    if (preview.kind !== "ok") {
      setError(preview.message);
      return;
    }

    if (preview.data.conflicts.length === 0) {
      setApplying(true);
      const applied = await applyResync(companyId, []);
      setApplying(false);

      if (applied.kind !== "ok") {
        setError(applied.message);
        return;
      }
      setResult(
        applied.data.updated_count === 0
          ? "Already up to date."
          : `Updated ${applied.data.updated_count} record${applied.data.updated_count === 1 ? "" : "s"}.`
      );
      return;
    }

    // Default every conflict to "keep mine" -- the same safe default the
    // scheduled sync always applies, so an admin who closes this dialog
    // without deciding anything gets that same behavior, not a silent
    // overwrite.
    setChoices(
      Object.fromEntries(preview.data.conflicts.map((conflict) => [conflictKey(conflict), "keep_oo" as Choice]))
    );
    setConflicts(preview.data.conflicts);
  }

  async function handleConfirmResolutions() {
    if (!conflicts) return;

    const resolutions: ConflictResolution[] = conflicts.map((conflict) => ({
      entity_type: conflict.entity_type,
      entity_id: conflict.entity_id,
      field: conflict.field,
      use_fresh: choices[conflictKey(conflict)] === "use_ps",
    }));

    setApplying(true);
    setError(null);
    const applied = await applyResync(companyId, resolutions);
    setApplying(false);

    if (applied.kind !== "ok") {
      setError(applied.message);
      return;
    }

    setConflicts(null);
    setResult(
      applied.data.updated_count === 0
        ? "Already up to date."
        : `Updated ${applied.data.updated_count} record${applied.data.updated_count === 1 ? "" : "s"}.`
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleResyncClick} disabled={checking || applying} className={buttonClass}>
          {checking ? "Checking Process Street…" : "Re-sync"}
        </button>
        {result && <span className="text-sm text-green-400">{result}</span>}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {conflicts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-slate-100">Some fields have been manually corrected</h2>
            <p className="mt-1 text-sm text-slate-400">
              These fields were set by hand in OO and now differ from what Process Street currently
              has. Choose which value to keep for each -- everything else will update automatically.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              {conflicts.map((conflict) => {
                const key = conflictKey(conflict);
                return (
                  <div key={key} className="rounded border border-slate-800 p-3">
                    <div className="mb-2 text-sm font-medium text-slate-200">
                      {conflict.entity_label} — {conflict.field}
                    </div>
                    <div className="flex flex-col gap-2 text-sm">
                      <label className="flex items-start gap-2">
                        <input
                          type="radio"
                          name={key}
                          checked={choices[key] === "keep_oo"}
                          onChange={() => setChoices((prev) => ({ ...prev, [key]: "keep_oo" }))}
                          className="mt-0.5"
                        />
                        <span>
                          Keep OO&apos;s value:{" "}
                          <span className="text-slate-300">{conflict.current_value ?? "—"}</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2">
                        <input
                          type="radio"
                          name={key}
                          checked={choices[key] === "use_ps"}
                          onChange={() => setChoices((prev) => ({ ...prev, [key]: "use_ps" }))}
                          className="mt-0.5"
                        />
                        <span>
                          Use Process Street&apos;s value:{" "}
                          <span className="text-slate-300">{conflict.fresh_value ?? "—"}</span>
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConflicts(null)} disabled={applying} className={buttonClass}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResolutions}
                disabled={applying}
                className={primaryButtonClass}
              >
                {applying ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
