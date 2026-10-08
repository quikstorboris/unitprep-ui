"use client";

import type { QmsTag } from "@/lib/clientOps";
import type { CandidateView } from "@/types/api";

import CandidateRow from "./CandidateRow";
import type { ReviewState } from "./useTaggerReview";

/** One tier's heading and its candidate rows (Auto-Apply / Needs Review). */
export default function CandidateSection({
  title,
  titleClassName,
  candidates,
  review,
  tags,
  onChange,
}: {
  title: string;
  titleClassName: string;
  candidates: CandidateView[];
  review: Map<number, ReviewState>;
  tags: QmsTag[];
  onChange: (index: number, patch: Partial<ReviewState>) => void;
}) {
  if (candidates.length === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      <h2 className={`text-lg font-semibold ${titleClassName}`}>
        {title} ({candidates.length})
      </h2>
      {candidates.map((candidate) => {
        const state = review.get(candidate.index);
        if (!state) return null;
        return (
          <CandidateRow
            key={candidate.index}
            candidate={candidate}
            tags={tags}
            checked={state.checked}
            selectedTagKey={state.tagKey}
            onToggle={(checked) => onChange(candidate.index, { checked })}
            onTagChange={(tagKey) => onChange(candidate.index, { tagKey })}
          />
        );
      })}
    </div>
  );
}
