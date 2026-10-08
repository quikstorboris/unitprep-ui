"use client";

import PreserveUnderscoresDialog from "./tagger/PreserveUnderscoresDialog";
import CandidateSection from "./tagger/CandidateSection";
import SaveToFolderControl from "./tagger/SaveToFolderControl";
import { usePreserveBlanksGate } from "./tagger/usePreserveBlanksGate";
import { useTaggerApply } from "./tagger/useTaggerApply";
import { useTaggerReport } from "./tagger/useTaggerReport";
import { useTaggerReview } from "./tagger/useTaggerReview";
import { useTaggerSaveLocation } from "./tagger/useTaggerSaveLocation";
import { useTaggerSaveToDropbox } from "./tagger/useTaggerSaveToDropbox";
import SessionExpiredPage from "./SessionExpiredPage";
import { formatElapsed } from "@/lib/useAbortableOperation";

interface TaggerResultsPageProps {
  sessionId: string;
  onHome: () => void;
}

export default function TaggerResultsPage({
  sessionId,
  onHome,
}: TaggerResultsPageProps) {
  const {
    candidates,
    loading,
    error: reportError,
    sessionExpired: reportExpired,
    cancelled: reportCancelled,
    elapsedMs: reportElapsedMs,
    cancel: cancelReport,
  } = useTaggerReport(sessionId);

  const {
    applying,
    downloadComplete,
    error: applyError,
    sessionExpired: applyExpired,
    cancelled: applyCancelled,
    elapsedMs: applyElapsedMs,
    cancelApply,
    handleApply,
  } = useTaggerApply(sessionId);

  const {
    saving,
    savedPath,
    error: saveError,
    sessionExpired: saveExpired,
    handleSave,
  } = useTaggerSaveToDropbox(sessionId);

  const { defaultFolderPath } = useTaggerSaveLocation(sessionId);

  const {
    tags,
    tagsError,
    review,
    autoTier,
    needsReviewTier,
    updateReview,
    confirmedSubstitutions,
    hasBlankCandidates,
    confirmedCount,
  } = useTaggerReview(candidates);

  const {
    showPreserveDialog,
    closePreserveDialog,
    handleApplyClick,
    handleSaveClick,
    handlePreserveChoice,
  } = usePreserveBlanksGate({
    hasBlankCandidates,
    confirmedSubstitutions,
    defaultFolderPath,
    handleApply,
    handleSave,
  });

  if (reportExpired || applyExpired || saveExpired) {
    return <SessionExpiredPage onHome={onHome} />;
  }

  if (loading) {
    return (
      <div className="space-y-3 text-slate-100">
        <div>
          Recognizing tags in this document... ({formatElapsed(reportElapsedMs)})
        </div>
        <button
          onClick={cancelReport}
          className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  // The report fetch was cancelled mid-flight (rather than failing) --
  // its own distinct state, not folded into `reportError`'s banner.
  if (reportCancelled && !candidates) {
    return (
      <div className="space-y-4">
        <div className="text-amber-400">Tag recognition cancelled.</div>
        <button onClick={onHome} className="rounded bg-slate-700 px-4 py-2 text-white">
          Home
        </button>
      </div>
    );
  }

  if (reportError) {
    return (
      <div className="space-y-4">
        <div className="text-red-400">{reportError}</div>
        <button onClick={onHome} className="rounded bg-slate-700 px-4 py-2 text-white">
          Home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl text-slate-100">
      <h1 className="mb-8 text-4xl font-bold">Template Tagger Results</h1>

      {tagsError && (
        <div className="mb-4 rounded bg-red-900 p-3 text-red-200">
          Couldn&apos;t load the QMS tag catalog: {tagsError} — tag search
          in the picker below may be unavailable until this succeeds.
        </div>
      )}

      {candidates && candidates.length === 0 && (
        <div className="rounded bg-slate-900 p-4 text-slate-400">
          No candidates found — nothing in the pattern library matched this
          document.
        </div>
      )}

      <CandidateSection
        title="Auto-Apply"
        titleClassName="text-green-400"
        candidates={autoTier}
        review={review}
        tags={tags}
        onChange={updateReview}
      />

      <CandidateSection
        title="Needs Review"
        titleClassName="text-yellow-400"
        candidates={needsReviewTier}
        review={review}
        tags={tags}
        onChange={updateReview}
      />

      {applyError && (
        <div className="mt-8 rounded bg-red-900 p-3 text-red-200">{applyError}</div>
      )}

      {applyCancelled && !applying && (
        <div className="mt-4 text-sm text-amber-400">Apply cancelled.</div>
      )}

      {saveError && (
        <div className="mt-4 rounded bg-red-900 p-3 text-red-200">{saveError}</div>
      )}

      {!downloadComplete && candidates && candidates.length > 0 && (
        <div className="mt-8 rounded border border-slate-700 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleApplyClick}
              disabled={applying || confirmedCount === 0}
              className="rounded bg-blue-600 px-5 py-3 disabled:opacity-50"
            >
              {applying
                ? "Applying..."
                : `Apply ${confirmedCount} Substitution${confirmedCount === 1 ? "" : "s"}`}
            </button>

            {applying && (
              <span className="inline-flex items-center gap-3 text-sm text-slate-400">
                {formatElapsed(applyElapsedMs)} elapsed
                <button
                  type="button"
                  onClick={cancelApply}
                  className="rounded border border-slate-600 px-3 py-1.5 text-slate-200 transition-colors hover:bg-slate-800"
                >
                  Cancel
                </button>
              </span>
            )}

            <SaveToFolderControl
              savedPath={savedPath}
              defaultFolderPath={defaultFolderPath}
              saving={saving}
              disabled={confirmedCount === 0}
              onSave={handleSaveClick}
              sizeClassName="px-5 py-3"
            />
          </div>
        </div>
      )}

      {showPreserveDialog && (
        <PreserveUnderscoresDialog
          onChoose={handlePreserveChoice}
          onCancel={closePreserveDialog}
        />
      )}

      {downloadComplete && (
        <div className="mt-8 space-y-4">
          <div className="text-xl text-green-400">Tagged Document Downloaded</div>

          <div className="flex flex-wrap items-center gap-4">
            <SaveToFolderControl
              savedPath={savedPath}
              defaultFolderPath={defaultFolderPath}
              saving={saving}
              disabled={confirmedCount === 0}
              onSave={handleSaveClick}
              sizeClassName="px-4 py-2"
            />

            <button onClick={onHome} className="rounded bg-slate-700 px-4 py-2">
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
