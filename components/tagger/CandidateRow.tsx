"use client";

import type { QmsTag } from "@/lib/clientOps";
import type { CandidateView } from "@/types/api";
import TagPicker from "./TagPicker";

interface CandidateRowProps {
  candidate: CandidateView;
  tags: QmsTag[];
  checked: boolean;
  selectedTagKey: string;
  onToggle: (checked: boolean) => void;
  onTagChange: (tagKey: string) => void;
}

/** "Body" or "Table cell 3" -- 0-indexed internally, shown 1-indexed
 * since nobody thinks of the first cell as "cell 0". */
function regionLabel(region: CandidateView["region"]): string {
  if (region === "body") return "Body";
  return `Table cell ${region.table_cell.index + 1}`;
}

/** Bolds `matched_text`'s first occurrence within `snippet` -- both
 * strings the same candidate produced, so a match is expected, but a
 * miss (e.g. an ellipsis boundary landing mid-match, which can't
 * actually happen given SNIPPET_CONTEXT_CHARS always covers the whole
 * match, but nothing enforces that at the type level) just renders the
 * plain snippet rather than crashing. */
function highlightedSnippet(snippet: string, matchedText: string) {
  if (!matchedText) return snippet;

  const index = snippet.indexOf(matchedText);
  if (index === -1) return snippet;

  return (
    <>
      {snippet.slice(0, index)}
      <strong className="text-slate-100">
        {snippet.slice(index, index + matchedText.length)}
      </strong>
      {snippet.slice(index + matchedText.length)}
    </>
  );
}

export default function CandidateRow({
  candidate,
  tags,
  checked,
  selectedTagKey,
  onToggle,
  onTagChange,
}: CandidateRowProps) {
  return (
    <div
      data-testid={`candidate-row-${candidate.index}`}
      className="flex items-start gap-3 rounded border border-slate-800 p-3"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(event.target.checked)}
        className="mt-1"
        aria-label={`Apply this substitution for ${candidate.tag_key}`}
      />

      <div className="flex-1 space-y-2">
        <div className="text-sm text-slate-300">
          {highlightedSnippet(candidate.snippet, candidate.matched_text)}
        </div>

        <div className="flex items-center gap-3">
          <TagPicker
            tags={tags}
            value={selectedTagKey}
            onChange={onTagChange}
          />
          <span className="text-xs text-slate-500">
            {regionLabel(candidate.region)}
          </span>
        </div>
      </div>
    </div>
  );
}
