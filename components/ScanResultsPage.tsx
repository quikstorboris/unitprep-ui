"use client";
import { API_URL, basename, errorMessageFrom } from "@/lib/api";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import SessionExpiredPage from "@/components/SessionExpiredPage";
import { IssueCard, issueKey } from "@/components/scan-results/IssueCard";
import { WarningsSection } from "@/components/scan-results/WarningsSection";
import {
  deriveScanResults,
  type ReasonSnapshot,
} from "@/components/scan-results/deriveReasonSections";
import type { ValidateResponse } from "@/types/api";

interface ScanResultsPageProps {
  sessionId: string;
  onBack: () => void;
  onExport: (acknowledged: boolean) => void;
  onSessionExpired: () => void;
}

export default function ScanResultsPage({
  sessionId,
  onBack,
  onExport,
  onSessionExpired,
}: ScanResultsPageProps) {
  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [results, setResults] =
    useState<ValidateResponse | null>(
      null
    );

  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);

  // One scroll target per warning reason (the bottom of its own "Groups
  // Needing Review" list), keyed by description -- lets a long list's
  // "Skip to the End" button jump straight there instead of the user
  // scrolling past dozens of cards by hand.
  const reviewListEndRefs = useRef<
    Map<string, HTMLDivElement>
  >(new Map());

  // The latest full picture seen for each warning reason while it still
  // had live issues -- kept even after every one of its groups gets
  // excluded and the reason itself drops out of `results.issues`
  // entirely, so its list stays visible (with an undo) instead of
  // simply vanishing the moment it's resolved.
  const [reasonSnapshots, setReasonSnapshots] =
    useState<
      Map<string, ReasonSnapshot>
    >(new Map());

  // Every group name excluded so far this session, across every reason
  // and every exclude action (single-card or bulk) -- combined with
  // `reasonSnapshots` above, lets a reason that's fully or partially
  // excluded keep showing those names with an "Edit Groups" undo,
  // rather than just disappearing once the backend stops reporting
  // them as live issues.
  const [
    excludedGroupNames,
    setExcludedGroupNames,
  ] = useState<Set<string>>(new Set());

  // Every group name accepted "as is" so far this session, across every
  // reason and every "Import as is" action -- same role as
  // `excludedGroupNames` above, just for acknowledgments instead of
  // exclusions (the data stays; only the flag on it goes away).
  const [
    acknowledgedGroupNames,
    setAcknowledgedGroupNames,
  ] = useState<Set<string>>(new Set());

  // Freezes the top "Warnings" tile at its last non-zero value instead
  // of dropping to 0 the moment everything's excluded -- excluding
  // isn't the same as "there was never anything to review," so the
  // number stays as a record, just recolored to signal it's resolved
  // (see the tile's render below).
  const [
    lastKnownWarningTotal,
    setLastKnownWarningTotal,
  ] = useState(0);

  // Controlled so the outer "Validation Details" accordion can
  // auto-collapse the moment everything resolves (see the effect
  // below), while still opening/closing normally on a manual click the
  // rest of the time.
  const [
    validationDetailsOpen,
    setValidationDetailsOpen,
  ] = useState(false);

  const [
    wasFullyResolved,
    setWasFullyResolved,
  ] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    // Guards against a slow, stale /validate response from a previous
    // sessionId overwriting state if this component is ever reused
    // across a genuine sessionId change without remounting.
    let ignore = false;

    const runValidation = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_URL}/validate`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          }
        );

        if (ignore) return;

        if (response.status === 404) {
          setSessionExpired(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            await errorMessageFrom(response)
          );
        }

        const data: ValidateResponse =
          await response.json();

        if (!ignore) setResults(data);
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Unknown error"
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    runValidation();

    return () => {
      ignore = true;
    };
  }, [sessionId]);

  const handleResultsUpdated = (
    updated: ValidateResponse
  ) => {
    setResults(updated);
  };

  const handleGroupsExcluded = (
    groupNames: string[]
  ) => {
    setExcludedGroupNames((prev) => {
      const next = new Set(prev);
      for (const name of groupNames) {
        next.add(name);
      }
      return next;
    });
  };

  const handleGroupsIncluded = (
    groupNames: string[]
  ) => {
    setExcludedGroupNames((prev) => {
      const next = new Set(prev);
      for (const name of groupNames) {
        next.delete(name);
      }
      return next;
    });
  };

  const handleGroupsAcknowledged = (
    groupNames: string[]
  ) => {
    setAcknowledgedGroupNames(
      (prev) => {
        const next = new Set(prev);
        for (const name of groupNames) {
          next.add(name);
        }
        return next;
      }
    );
  };

  const handleGroupsUnacknowledged = (
    groupNames: string[]
  ) => {
    setAcknowledgedGroupNames(
      (prev) => {
        const next = new Set(prev);
        for (const name of groupNames) {
          next.delete(name);
        }
        return next;
      }
    );
  };

  const handleSessionExpired = () =>
    setSessionExpired(true);

  // Every derived value below is computed defensively (safe when
  // `results` is still null) so the effects further down -- which must
  // be called unconditionally, before any early return -- have
  // something real to close over regardless of loading/error state. See
  // deriveScanResults for the group-ownership model itself.
  const {
    errors,
    filesErrored,
    everythingResolved,
    warningReasonGroups,
    totalWarningItems,
    reasonSections,
  } = deriveScanResults(
    results,
    reasonSnapshots,
    excludedGroupNames,
    acknowledgedGroupNames
  );

  // The three blocks below adjust state *during* render rather than in
  // a `useEffect` -- React's documented pattern for "remember something
  // from a previous render and update state in response," which avoids
  // the extra effect-triggered render pass a `useEffect` would cost
  // here. Each is guarded by a content comparison (not just "did the
  // render happen") specifically so it converges instead of looping:
  // once the state matches what the guard checks for, the condition is
  // false and no further update happens.
  if (results) {
    let nextReasonSnapshots =
      reasonSnapshots;
    let snapshotsChanged = false;

    for (const g of warningReasonGroups) {
      const existing =
        reasonSnapshots.get(
          g.description
        );

      const existingNames = new Set(
        existing?.groupNames ?? []
      );

      // Only ever *grows* a reason's remembered name list -- a name
      // dropping out of the current live list means it was excluded,
      // not that it was never really part of this reason. Overwriting
      // the snapshot with the shrunken live list here would erase the
      // very history "Excluded Groups" depends on, the moment the
      // first group in a reason gets excluded.
      const hasNewNames =
        g.groupNames.some(
          (name) =>
            !existingNames.has(name)
        );

      if (!existing || hasNewNames) {
        if (!snapshotsChanged) {
          nextReasonSnapshots = new Map(
            reasonSnapshots
          );
          snapshotsChanged = true;
        }

        const mergedNames = existing
          ? Array.from(
              new Set([
                ...existing.groupNames,
                ...g.groupNames,
              ])
            ).sort()
          : g.groupNames;

        const mergedCounts = new Map(
          existing?.occurrenceCounts ??
            []
        );

        for (const [
          name,
          count,
        ] of g.occurrenceCounts.entries()) {
          mergedCounts.set(
            name,
            count
          );
        }

        nextReasonSnapshots.set(
          g.description,
          {
            groupNames: mergedNames,
            occurrenceCounts:
              mergedCounts,
          }
        );
      }
    }

    if (snapshotsChanged) {
      setReasonSnapshots(
        nextReasonSnapshots
      );
    }
  }

  if (
    totalWarningItems > 0 &&
    totalWarningItems !==
      lastKnownWarningTotal
  ) {
    setLastKnownWarningTotal(
      totalWarningItems
    );
  }

  if (
    !wasFullyResolved &&
    everythingResolved &&
    validationDetailsOpen
  ) {
    setValidationDetailsOpen(false);
  }

  if (
    wasFullyResolved !==
    everythingResolved
  ) {
    setWasFullyResolved(
      everythingResolved
    );
  }

  if (sessionExpired) {
    return (
      <SessionExpiredPage
        onHome={onSessionExpired}
      />
    );
  }

  if (loading) {
    return (
      <div className="text-slate-100">
        Loading validation results...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400">
        Error: {error}
      </div>
    );
  }

  if (!results) {
    return (
      <div className="text-red-400">
        No validation results available.
      </div>
    );
  }

  const displayedWarningTotal =
    totalWarningItems > 0
      ? totalWarningItems
      : lastKnownWarningTotal;

  const warningsAllResolved =
    totalWarningItems === 0 &&
    lastKnownWarningTotal > 0;

  return (
    <div className="mx-auto max-w-5xl text-slate-100">
      <div className="mb-6 flex gap-4">
        <button
          onClick={onBack}
          className="rounded bg-slate-700 px-4 py-2"
        >
          ← Back
        </button>
      </div>

      <h1 className="mb-8 text-3xl font-bold">
        Validation Results
      </h1>

      <div className="grid grid-cols-5 gap-4">
        <div className="rounded border border-slate-700 p-4">
          <div className="text-sm text-slate-400">
            Files Checked
          </div>

          <div className="text-2xl font-bold">
            {results.files_checked}
          </div>
        </div>

        <div className="rounded border border-slate-700 p-4">
          <div className="text-sm text-slate-400">
            Errors
          </div>

          <div className="text-2xl font-bold text-red-400">
            {results.error_count}
          </div>
        </div>

        <div className="rounded border border-slate-700 p-4">
          <div className="text-sm text-slate-400">
            Warnings
          </div>

          <div
            className={
              warningsAllResolved
                ? "text-2xl font-bold text-slate-500"
                : "text-2xl font-bold text-yellow-400"
            }
          >
            {displayedWarningTotal}
          </div>
        </div>

        <div className="rounded border border-slate-700 p-4">
          <div className="text-sm text-slate-400">
            Files Errored
          </div>

          <div
            className={
              filesErrored.length > 0
                ? "text-2xl font-bold text-red-400"
                : "text-2xl font-bold"
            }
          >
            {filesErrored.length}
          </div>
        </div>

        <div className="rounded border border-slate-700 p-4">
          <div className="text-sm text-slate-400">
            Export Status
          </div>

          <div
            className={
              !results.ready
                ? "text-left text-2xl font-bold text-red-400"
                : totalWarningItems >
                  0
                ? "text-left text-2xl font-bold text-yellow-400"
                : "text-left text-2xl font-bold"
            }
          >
            {!results.ready
              ? "❌ Blocked"
              : totalWarningItems > 0
              ? "⚠️ Resolve Warnings"
              : "✅ Allowed"}
          </div>
        </div>
      </div>

      {results.issue_count === 0 &&
      filesErrored.length === 0 ? (
        <div className="mt-6 rounded bg-green-900 p-4">
          ✅ Validation completed
          successfully.
        </div>
      ) : results.error_count > 0 ||
        filesErrored.length > 0 ? (
        <div className="mt-6 rounded bg-red-900 p-4">
          ❌{" "}
          {results.error_count > 0 && (
            <>
              {results.error_count}{" "}
              error
              {results.error_count === 1
                ? ""
                : "s"}
            </>
          )}
          {results.error_count > 0 &&
            filesErrored.length > 0 &&
            " and "}
          {filesErrored.length > 0 && (
            <>
              {filesErrored.length} file
              {filesErrored.length === 1
                ? ""
                : "s"} that could not
              be validated
            </>
          )}{" "}
          must be resolved before
          export.
        </div>
      ) : results.issue_count > 0 ? (
        <div className="mt-6 rounded bg-yellow-900 p-4">
          ⚠ Advisory findings
          detected. Review
          recommended.
        </div>
      ) : null}

      <details
        className="mt-8"
        open={validationDetailsOpen}
        onToggle={(e) =>
          setValidationDetailsOpen(
            e.currentTarget.open
          )
        }
      >
        <summary className="cursor-pointer font-semibold">
          Validation Details
        </summary>

        <div className="mt-4 space-y-4">
          {errors.length === 0 &&
          filesErrored.length === 0 &&
          reasonSections.length === 0 ? (
            <p>No issues found.</p>
          ) : (
            <>
              <details className="rounded border border-slate-700 p-4">
                <summary className="cursor-pointer font-semibold text-red-400">
                  Errors ({errors.length})
                </summary>

                {errors.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">
                    No errors.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {errors.map(
                      (issue) => (
                        <IssueCard
                          key={issueKey(issue)}
                          issue={issue}
                          sessionId={
                            sessionId
                          }
                          onCorrectionSaved={
                            handleResultsUpdated
                          }
                          onSessionExpired={
                            handleSessionExpired
                          }
                        />
                      )
                    )}
                  </ul>
                )}
              </details>

              <details className="rounded border border-slate-700 p-4">
                <summary className="cursor-pointer font-semibold text-red-400">
                  File Errors (
                  {filesErrored.length})
                </summary>

                {filesErrored.length ===
                0 ? (
                  <p className="mt-3 text-sm text-slate-400">
                    No file errors.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1">
                    {filesErrored.map(
                      (
                        fileError,
                        index
                      ) => (
                        <li
                          key={`${fileError.file_name}-${index}`}
                          className="text-sm text-red-200"
                        >
                          <strong>
                            {basename(
                              fileError.file_name
                            )}
                          </strong>{" "}
                          —{" "}
                          {
                            fileError.message
                          }
                        </li>
                      )
                    )}
                  </ul>
                )}
              </details>

              <WarningsSection
                sessionId={sessionId}
                reasonSections={
                  reasonSections
                }
                displayedWarningTotal={
                  displayedWarningTotal
                }
                warningsAllResolved={
                  warningsAllResolved
                }
                reviewListEndRefs={
                  reviewListEndRefs
                }
                onUpdated={
                  handleResultsUpdated
                }
                onExcluded={
                  handleGroupsExcluded
                }
                onIncluded={
                  handleGroupsIncluded
                }
                onAcknowledged={
                  handleGroupsAcknowledged
                }
                onUnacknowledged={
                  handleGroupsUnacknowledged
                }
                onSessionExpired={
                  handleSessionExpired
                }
              />
            </>
          )}
        </div>
      </details>

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-700 pt-6">
        <button
          onClick={() => onExport(false)}
          disabled={!everythingResolved}
          className="rounded bg-green-600 px-4 py-2 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Continue
        </button>

        {!everythingResolved && (
          <span className="text-sm text-slate-400">
            Fix, exclude, or import as is
            every warning above to continue.
          </span>
        )}
      </div>
    </div>
  );
}
