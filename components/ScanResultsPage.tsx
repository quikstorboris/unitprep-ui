"use client";
import { useSessionPost } from "@/lib/useSessionPost";
import { useRef, useState } from "react";
import SessionExpiredPage from "@/components/SessionExpiredPage";
import { ErrorsSection } from "@/components/scan-results/ErrorsSection";
import { FileErrorsSection } from "@/components/scan-results/FileErrorsSection";
import { ScanResultsStatTiles } from "@/components/scan-results/ScanResultsStatTiles";
import { ValidationStatusBanner } from "@/components/scan-results/ValidationStatusBanner";
import { WarningsSection } from "@/components/scan-results/WarningsSection";
import { useScanResultsDerivedState } from "@/components/scan-results/useScanResultsDerivedState";
import { formatElapsed } from "@/lib/useAbortableOperation";
import type { ValidateResponse } from "@/types/api";

interface ScanResultsPageProps {
  sessionId: string;
  onBack: () => void;
  onExport: () => void;
  onSessionExpired: () => void;
}

export default function ScanResultsPage({
  sessionId,
  onBack,
  onExport,
  onSessionExpired,
}: ScanResultsPageProps) {
  const {
    data: fetchedResults,
    loading,
    error,
    sessionExpired: fetchSessionExpired,
    cancelled,
    elapsedMs,
    cancel,
  } = useSessionPost<ValidateResponse>(
    sessionId,
    "/validate"
  );

  // `null` until an action (correct/exclude/exempt/...) returns a fresh
  // `ValidateResponse` -- once set, this wins over `fetchedResults` for
  // the rest of this component's lifetime, so `results` always reflects
  // the latest known state without needing an effect to copy hook data
  // into local state on every change.
  const [resultsOverride, setResultsOverride] =
    useState<ValidateResponse | null>(
      null
    );

  const results =
    resultsOverride ?? fetchedResults;

  // Set by a later action's own 404, not by the initial /validate fetch
  // (see `fetchSessionExpired` above) -- combined below into the single
  // `sessionExpired` flag the rest of this component reads.
  const [
    actionSessionExpired,
    setActionSessionExpired,
  ] = useState(false);

  const sessionExpired =
    fetchSessionExpired ||
    actionSessionExpired;

  // One scroll target per warning reason (the bottom of its own "Groups
  // Needing Review" list), keyed by description -- lets a long list's
  // "Skip to the End" button jump straight there instead of the user
  // scrolling past dozens of cards by hand.
  const reviewListEndRefs = useRef<
    Map<string, HTMLDivElement>
  >(new Map());

  const handleResultsUpdated = (
    updated: ValidateResponse
  ) => {
    setResultsOverride(updated);
  };

  const handleSessionExpired = () =>
    setActionSessionExpired(true);

  // Every warning/error/reason breakdown below, plus the "Validation
  // Details" accordion's open state and the frozen warning-total tile
  // -- see the hook's own doc comment for why this cross-render
  // bookkeeping is split out from the rest of this component.
  const {
    errors,
    filesErrored,
    everythingResolved,
    totalWarningItems,
    reasonSections,
    displayedWarningTotal,
    warningsAllResolved,
    validationDetailsOpen,
    setValidationDetailsOpen,
    handleGroupsExcluded,
    handleGroupsIncluded,
    handleGroupsAcknowledged,
    handleGroupsUnacknowledged,
  } = useScanResultsDerivedState(results);

  if (sessionExpired) {
    return (
      <SessionExpiredPage
        onHome={onSessionExpired}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 text-slate-100">
        <div>
          Loading validation results... ({formatElapsed(elapsedMs)})
        </div>
        <button
          onClick={cancel}
          className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
        >
          Cancel
        </button>
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

  // The validation fetch was cancelled mid-flight (rather than failing)
  // -- its own distinct state, not folded into the generic "No
  // validation results available" message below.
  if (cancelled && !results) {
    return (
      <div className="space-y-4">
        <div className="text-amber-400">Validation cancelled.</div>
        <button onClick={onBack} className="rounded bg-slate-700 px-4 py-2">
          ← Back
        </button>
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

      <ScanResultsStatTiles
        results={results}
        filesErrored={filesErrored}
        totalWarningItems={
          totalWarningItems
        }
        displayedWarningTotal={
          displayedWarningTotal
        }
        warningsAllResolved={
          warningsAllResolved
        }
      />

      <ValidationStatusBanner
        results={results}
        filesErrored={filesErrored}
      />

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
              <ErrorsSection
                sessionId={sessionId}
                errors={errors}
                onCorrectionSaved={
                  handleResultsUpdated
                }
                onSessionExpired={
                  handleSessionExpired
                }
              />

              <FileErrorsSection
                filesErrored={
                  filesErrored
                }
              />

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
          onClick={onExport}
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
