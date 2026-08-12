"use client";

import { useEffect, useMemo, useState } from "react";

import CandidateRow from "./tagger/CandidateRow";
import { useTaggerApply } from "./tagger/useTaggerApply";
import { useTaggerReport } from "./tagger/useTaggerReport";
import SessionExpiredPage from "./SessionExpiredPage";
import { listQmsTags, type QmsTag } from "@/lib/clientOps";
import type { CandidateView, ConfirmedSubstitution } from "@/types/api";

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
  const [review, setReview] = useState<Map<number, ReviewState>>(new Map());
  // OM-facing style choice, applied to the whole apply call -- default
  // off (replace outright) matches the original, no-underscores-left
  // behavior; some OMs may prefer keeping the visual blank instead
  // (e.g. a signature-line convention already seen in the corpus:
  // /s/{{e.name}}______________).
  const [preserveBlanks, setPreserveBlanks] = useState(false);

  // The full catalog to search over in each row's TagPicker -- fetched
  // once, independent of the candidate list itself.
  useEffect(() => {
    listQmsTags().then((result) => {
      if (result.kind === "ok") setTags(result.data.tags);
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
          <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={preserveBlanks}
              onChange={(event) => setPreserveBlanks(event.target.checked)}
            />
            Preserve underscores (insert the tag before the blank instead of replacing it)
          </label>

          <button
            onClick={() => handleApply(confirmedSubstitutions(), preserveBlanks)}
            disabled={applying || confirmedCount === 0}
            className="rounded bg-blue-600 px-5 py-3 disabled:opacity-50"
          >
            {applying
              ? "Applying..."
              : `Apply ${confirmedCount} Substitution${confirmedCount === 1 ? "" : "s"}`}
          </button>
        </div>
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
