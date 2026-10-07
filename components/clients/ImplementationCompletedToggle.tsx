"use client";

import { useState } from "react";

import { setImplementationCompleted } from "@/lib/clientsCompanies";

/**
 * "Implementation Completed" switch for the company page's header row.
 * Turning it on moves the company out of "Implementations in Flight" and
 * into the Clients page's collapsed "Completed Implementations" section;
 * turning it off puts it back. Optimistic only in the sense that the
 * switch disables while the request runs -- the real state comes back
 * through `onChanged` (the company-detail refetch), so a failed request
 * leaves the switch where it was and shows the error beneath it.
 */
export default function ImplementationCompletedToggle({
  companyId,
  completed,
  onChanged,
}: {
  companyId: string;
  completed: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);

    const result = await setImplementationCompleted(companyId, !completed);

    setPending(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    onChanged();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={completed}
        disabled={pending}
        onClick={toggle}
        className="flex items-center gap-2 whitespace-nowrap rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={`relative inline-block h-4 w-7 rounded-full transition-colors ${
            completed ? "bg-emerald-500" : "bg-slate-600"
          }`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
              completed ? "left-3.5" : "left-0.5"
            }`}
          />
        </span>
        Implementation Completed
      </button>

      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
