"use client";

import { useEffect, useState } from "react";

import { addFacility, searchPsRuns } from "@/lib/clientsCompanies";
import { runIdFromUrl } from "@/lib/psRunUrl";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { PsRunMatch } from "@/types/generated/PsRunMatch";

const buttonClass =
  "whitespace-nowrap rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Company page's "Add facility": search Process Street Intake runs (by run
 * title, or by an owner/manager's name or email) and attach one to this
 * company as a facility -- for sister facilities whose Intake said "yes,
 * submitted before" and so never linked up, and for groups treated as one
 * company across several legal entities. The search reads OO's own synced
 * copy of Process Street, so it is instant but only as fresh as the last
 * sync. A pasted Process Street run link adds that run directly.
 */
export default function AddFacilityDialog({
  companyId,
  onAdded,
}: {
  companyId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // The query the shown matches answer; "searching" is derived from it.
  const [loaded, setLoaded] = useState<{
    query: string;
    matches: PsRunMatch[];
  } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounced = useDebouncedValue(query.trim(), 250);
  const pastedRunId = runIdFromUrl(query);
  const searchActive = open && !pastedRunId && debounced.length >= 2;

  const searching = searchActive && loaded?.query !== debounced;
  const shown =
    searchActive && loaded?.query === debounced ? loaded.matches : [];

  useEffect(() => {
    if (!searchActive) return;
    let cancelled = false;
    searchPsRuns(debounced).then((result) => {
      if (cancelled) return;
      if (result.kind !== "ok") {
        setError(result.message);
        return;
      }
      setError(null);
      setLoaded({ query: debounced, matches: result.data.matches });
    });
    return () => {
      cancelled = true;
    };
  }, [searchActive, debounced]);

  function openDialog() {
    setQuery("");
    setLoaded(null);
    setError(null);
    setOpen(true);
  }

  async function add(runId: string) {
    setAdding(runId);
    setError(null);
    const result = await addFacility(companyId, {
      run_id: runId,
      merchant_account_run_id: null,
    });
    setAdding(null);
    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }
    setOpen(false);
    onAdded();
  }

  return (
    <>
      <button type="button" onClick={openDialog} className={buttonClass}>
        Add facility
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-slate-100">
              Add facility
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Search Process Street Intake runs by facility name, or by an owner
              or manager&apos;s name or email, and add one to this company. You
              can also paste a Process Street run link.
            </p>

            <input
              type="text"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Facility, name, email, or run link"
              aria-label="Search Process Street runs"
              className="mt-4 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />

            <div className="mt-3 max-h-72 overflow-y-auto">
              {pastedRunId && (
                <div className="flex items-center justify-between gap-3 rounded border border-slate-800 px-3 py-2 text-sm">
                  <span className="min-w-0 break-all text-slate-300">
                    Run from pasted link:{" "}
                    <span className="font-mono">{pastedRunId}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => add(pastedRunId)}
                    disabled={adding !== null}
                    className={buttonClass}
                  >
                    {adding === pastedRunId ? "Adding…" : "Add"}
                  </button>
                </div>
              )}

              {searching && (
                <p className="text-sm text-slate-500">Searching…</p>
              )}

              {searchActive && !searching && shown.length === 0 && !error && (
                <p className="text-sm text-slate-500">No matching runs.</p>
              )}

              <ul className="flex flex-col gap-2">
                {shown.map((match) => (
                  <li
                    key={match.run_id}
                    className="flex items-center justify-between gap-3 rounded border border-slate-800 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-slate-100">
                        {match.run_name}
                      </p>
                      {match.matched_person && (
                        <p className="text-xs text-slate-500">
                          Matched person: {match.matched_person}
                        </p>
                      )}
                      {match.already_in && (
                        <p className="text-xs text-amber-400">
                          Already in OO under {match.already_in.company_name}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => add(match.run_id)}
                      disabled={match.already_in !== null || adding !== null}
                      className={buttonClass}
                    >
                      {adding === match.run_id ? "Adding…" : "Add"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={adding !== null}
                className={buttonClass}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
