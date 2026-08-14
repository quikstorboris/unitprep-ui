"use client";
import type { RefObject } from "react";

import type { ValidateResponse } from "@/types/api";

import { WarningReasonCard } from "./WarningReasonCard";
import type { ReasonSection } from "./deriveReasonSections";

interface WarningsSectionProps {
  sessionId: string;
  reasonSections: ReasonSection[];
  displayedWarningTotal: number;
  warningsAllResolved: boolean;
  /** One scroll target per warning reason (the bottom of its own
   * "Groups Needing Review" list), keyed by description -- lets a long
   * list's "Skip to the End" button jump straight there instead of the
   * user scrolling past dozens of cards by hand. Owned by the parent
   * page (not this component) since it's a DOM ref, not derived data. */
  reviewListEndRefs: RefObject<Map<string, HTMLDivElement>>;
  onUpdated: (result: ValidateResponse) => void;
  onExcluded: (groupNames: string[]) => void;
  onIncluded: (groupNames: string[]) => void;
  onAcknowledged: (groupNames: string[]) => void;
  onUnacknowledged: (groupNames: string[]) => void;
  onSessionExpired: () => void;
}

export function WarningsSection({
  sessionId,
  reasonSections,
  displayedWarningTotal,
  warningsAllResolved,
  reviewListEndRefs,
  onUpdated,
  onExcluded,
  onIncluded,
  onAcknowledged,
  onUnacknowledged,
  onSessionExpired,
}: WarningsSectionProps) {
  return (
    <details className="rounded border border-slate-700 p-4">
      <summary
        className={
          warningsAllResolved
            ? "cursor-pointer font-semibold text-slate-500"
            : "cursor-pointer font-semibold text-yellow-400"
        }
      >
        Warnings ({displayedWarningTotal})
      </summary>

      {reasonSections.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No warnings.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {reasonSections.map((group) => (
            <WarningReasonCard
              key={group.description}
              sessionId={sessionId}
              group={group}
              reviewListEndRefs={reviewListEndRefs}
              onUpdated={onUpdated}
              onExcluded={onExcluded}
              onIncluded={onIncluded}
              onAcknowledged={onAcknowledged}
              onUnacknowledged={onUnacknowledged}
              onSessionExpired={onSessionExpired}
            />
          ))}
        </div>
      )}
    </details>
  );
}
