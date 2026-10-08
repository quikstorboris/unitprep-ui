"use client";

import { useEffect, useMemo, useState } from "react";

import { listQmsTags, type QmsTag } from "@/lib/clientOps";
import type { CandidateView, ConfirmedSubstitution } from "@/types/api";

/** Same definition `tagger-pipeline` itself uses (`is_underscore_run`):
 * a candidate whose matched text is a run of underscores rather than an
 * already-filled value -- e.g. a blank template's own "________". */
function isUnderscoreRun(text: string): boolean {
  return text.length > 0 && [...text].every((char) => char === "_");
}

/** One candidate's editable review state -- separate from the
 * server-returned CandidateView, since `checked`/`tag_key` change as
 * the reviewer works and CandidateView is otherwise immutable data from
 * the server. Keyed by candidate index in the review Map. */
export interface ReviewState {
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

/**
 * The reviewer's working state for a candidate list: the QMS tag
 * catalog, each candidate's checked/tag choice, the two tiers, and the
 * substitutions that would be applied.
 */
export function useTaggerReview(candidates: CandidateView[] | null | undefined) {
  const [tags, setTags] = useState<QmsTag[]>([]);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [review, setReview] = useState<Map<number, ReviewState>>(new Map());

  // The full catalog to search over in each row's TagPicker -- fetched
  // once, independent of the candidate list itself. A failure here used
  // to be silently swallowed (the catch-all `if (result.kind === "ok")`
  // left every TagPicker with an empty, unexplained catalog) -- surfaced
  // now as the same inline error banner reportError/applyError already
  // use, since the rest of the page still works fine without it.
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
  const [seededFor, setSeededFor] = useState<typeof candidates | undefined>(
    undefined
  );
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

  // Document-level, not selection-level -- the preserve-blanks question
  // is about whether this document has a blank worth asking about at
  // all, independent of which candidates end up checked.
  const hasBlankCandidates = (candidates ?? []).some((candidate) =>
    isUnderscoreRun(candidate.matched_text)
  );

  const confirmedCount = Array.from(review.values()).filter(
    (s) => s.checked
  ).length;

  return {
    tags,
    tagsError,
    review,
    autoTier,
    needsReviewTier,
    updateReview,
    confirmedSubstitutions,
    hasBlankCandidates,
    confirmedCount,
  };
}
