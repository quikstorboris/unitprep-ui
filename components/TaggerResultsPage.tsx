"use client";

import { useEffect, useMemo, useState } from "react";

import CandidateRow from "./tagger/CandidateRow";
import PreserveUnderscoresDialog from "./tagger/PreserveUnderscoresDialog";
import { useTaggerApply } from "./tagger/useTaggerApply";
import { useTaggerReport } from "./tagger/useTaggerReport";
import SessionExpiredPage from "./SessionExpiredPage";
import { listQmsTags, type QmsTag } from "@/lib/clientOps";
import type { CandidateView, ConfirmedSubstitution } from "@/types/api";

/** Same definition `tagger-pipeline` itself uses (`is_underscore_run`):
 * a candidate whose matched text is a run of underscores rather than an
 * already-filled value -- e.g. a blank template's own "________". */
function isUnderscoreRun(text: string): boolean {
  return text.length > 0 && [...text].every((char) => char === "_");
}

interface TaggerResultsPageProps {
  sessionId: string;
  onHome: () => void;
}

/** One candidate's editable review state -- separate from the
 * server-returned CandidateView, since `checked`/`tag_key` change as
 * the reviewer works and CandidateView is otherwise immutable data from
 * the server. Keyed by candidate index in the results Map below. */
interface ReviewState {
  checked: boolean;
  tagKey: string;
}

/** Tier 1 (unambiguous) starts checked and ready to apply as-is; tier 2
 * (competing candidates for the same span) starts unchecked -- the
 * reviewer must look at it before it's included, per the design's own
 * "tier 2: ask via a picker" rule. */
function initialReviewState(candidate: CandidateView): ReviewState {
  return {
    checked: candidate.tier === "auto",
    tagKey: candidate.tag_key,
  };
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
  } = useTaggerReport(sessionId);

  const {
    applying,
    downloadComplete,
    error: applyError,
    sessionExpired: applyExpired,
    handleApply,
  } = useTaggerApply(sessionId);

  const [tags, setTags] = useState<QmsTag[]>([]);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [review, setReview] = useState<Map<number, ReviewState>>(new Map());
  // Whether Apply should ask "preserve underscores or not" first --
  // only a real question when the document actually has a blank to
  // preserve. A document with none (already-filled documents, or one
  // where every candidate came from a known-value match) never shows
  // the dialog and just applies outright, same as it always has.
  const [showPreserveDialog, setShowPreserveDialog] = useState(false);

  // The full catalog to search over in each row's TagPicker -- fetched
  // once, independent of the candidate list itself. A failure here used
  // to be silently swallowed (the catch-all `if (result.kind === "ok")`
  // left every TagPicker with an empty, unexplained catalog) -- surfaced
  // now as the same inline error banner reportError/applyError already
  // use below, since the rest of the page still works fine without it.
  useEffect(() => {
    listQmsTags().then((result) => {
      if (result.kind === "ok") {
        setTags(result.data.tags);
        setTagsError(null);
      } else {
        setTagsError(result.message);
      }
    });
  }, []);

  // Seed each candidate's review state once, the moment the candidate
  // list first arrives -- deliberately NOT a useEffect calling setState:
  // that pattern causes an extra, avoidable cascading render for a
  // change already known at this point in the render itself. This is
  // React's own documented "adjust state during render" pattern instead
  // -- calling setState conditionally, during render, based on a value
  // that just changed since the last render. Tracking `candidates`
  // itself (not a boolean) means a later session with a fresh
  // candidate list (a new object each fetch) reseeds correctly too, not
  // just the very first arrival.
  const [seededFor, setSeededFor] = useState<
    typeof candidates | undefined
  >(undefined);
  if (candidates && candidates !== seededFor) {
    setSeededFor(candidates);
    setReview(
      new Map(
        candidates.map((candidate) => [
          candidate.index,
          initialReviewState(candidate),
        ])
      )
    );
  }

  const { autoTier, needsReviewTier } = useMemo(() => {
    const auto: CandidateView[] = [];
    const needsReview: CandidateView[] = [];
    for (const candidate of candidates ?? []) {
      (candidate.tier === "auto" ? auto : needsReview).push(candidate);
    }
    return { autoTier: auto, needsReviewTier: needsReview };
  }, [candidates]);

  function updateReview(index: number, patch: Partial<ReviewState>) {
    setReview((current) => {
      const next = new Map(current);
      const existing = next.get(index);
      if (existing) next.set(index, { ...existing, ...patch });
      return next;
    });
  }

  function confirmedSubstitutions(): ConfirmedSubstitution[] {
    return Array.from(review.entries())
      .filter(([, state]) => state.checked)
      .map(([index, state]) => ({
        candidate_index: index,
        tag_key: state.tagKey,
      }));
  }

  // Document-level, not selection-level -- the dialog is about whether
  // this document has a blank worth asking about at all, independent of
  // which candidates end up checked.
  const hasBlankCandidates = (candidates ?? []).some((candidate) =>
    isUnderscoreRun(candidate.matched_text)
  );

  function handleApplyClick() {
    if (hasBlankCandidates) {
      setShowPreserveDialog(true);
      return;
    }
    handleApply(confirmedSubstitutions(), false);
  }

  function handlePreserveChoice(preserve: boolean) {
    setShowPreserveDialog(false);
    handleApply(confirmedSubstitutions(), preserve);
  }

  if (reportExpired || applyExpired) {
    return <SessionExpiredPage onHome={onHome} />;
  }

  if (loading) {
    return <div className="text-slate-100">Recognizing tags in this document...</div>;
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

  const confirmedCount = Array.from(review.values()).filter((s) => s.checked).length;

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

      {autoTier.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold text-green-400">
            Auto-Apply ({autoTier.length})
          </h2>
          {autoTier.map((candidate) => {
            const state = review.get(candidate.index);
            if (!state) return null;
            return (
              <CandidateRow
                key={candidate.index}
                candidate={candidate}
                tags={tags}
                checked={state.checked}
                selectedTagKey={state.tagKey}
                onToggle={(checked) => updateReview(candidate.index, { checked })}
                onTagChange={(tagKey) => updateReview(candidate.index, { tagKey })}
              />
            );
          })}
        </div>
      )}

      {needsReviewTier.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-lg font-semibold text-yellow-400">
            Needs Review ({needsReviewTier.length})
          </h2>
          {needsReviewTier.map((candidate) => {
            const state = review.get(candidate.index);
            if (!state) return null;
            return (
              <CandidateRow
                key={candidate.index}
                candidate={candidate}
                tags={tags}
                checked={state.checked}
                selectedTagKey={state.tagKey}
                onToggle={(checked) => updateReview(candidate.index, { checked })}
                onTagChange={(tagKey) => updateReview(candidate.index, { tagKey })}
              />
            );
          })}
        </div>
      )}

      {applyError && (
        <div className="mt-8 rounded bg-red-900 p-3 text-red-200">{applyError}</div>
      )}

      {!downloadComplete && candidates && candidates.length > 0 && (
        <div className="mt-8 rounded border border-slate-700 p-4">
          <button
            onClick={handleApplyClick}
            disabled={applying || confirmedCount === 0}
            className="rounded bg-blue-600 px-5 py-3 disabled:opacity-50"
          >
            {applying
              ? "Applying..."
              : `Apply ${confirmedCount} Substitution${confirmedCount === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {showPreserveDialog && (
        <PreserveUnderscoresDialog
          onChoose={handlePreserveChoice}
          onCancel={() => setShowPreserveDialog(false)}
        />
      )}

      {downloadComplete && (
        <div className="mt-8 space-y-4">
          <div className="text-xl text-green-400">Tagged Document Downloaded</div>
          <button onClick={onHome} className="rounded bg-slate-700 px-4 py-2">
            Home
          </button>
        </div>
      )}
    </div>
  );
}
