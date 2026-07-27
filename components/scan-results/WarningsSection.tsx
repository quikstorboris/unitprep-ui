"use client";
import type { RefObject } from "react";

import { basename } from "@/lib/api";
import type { ValidateResponse } from "@/types/api";

import { EditGroupsButton } from "./EditGroupsButton";
import { ExcludeAllButton } from "./ExcludeAllButton";
import { GroupCorrectionCard } from "./GroupCorrectionCard";
import { ImportAsIsButton } from "./ImportAsIsButton";
import { issueKey } from "./IssueCard";
import { UndoImportAsIsButton } from "./UndoImportAsIsButton";
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
  reviewListEndRefs: RefObject<
    Map<string, HTMLDivElement>
  >;
  onUpdated: (
    result: ValidateResponse
  ) => void;
  onExcluded: (
    groupNames: string[]
  ) => void;
  onIncluded: (
    groupNames: string[]
  ) => void;
  onAcknowledged: (
    groupNames: string[]
  ) => void;
  onUnacknowledged: (
    groupNames: string[]
  ) => void;
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
        Warnings (
        {displayedWarningTotal})
      </summary>

      {reasonSections.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No warnings.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {reasonSections.map(
            (group) => (
              <details
                key={
                  group.description
                }
                className="rounded bg-slate-800 p-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-slate-200">
                  {group.description}{" "}
                  (
                  {group.isLive
                    ? group.count
                    : 0}
                  {group.excludedNames
                    .length > 0 &&
                    `, ${group.excludedNames.length} excluded`}
                  {group
                    .acknowledgedNames
                    .length > 0 &&
                    `, ${group.acknowledgedNames.length} imported as is`}
                  )
                </summary>

                {group.isLive && (
                  <ul className="mt-2 space-y-2 text-sm text-slate-300">
                    {group.issues.map(
                      (issue) => {
                        const rawItems =
                          issue.flagged_are_group_names
                            ? issue.affected_group_names
                            : issue.affected_unit_ids;

                        // A group-based issue's own names are filtered
                        // to this reason's owned set
                        // (`reviewGroupNames`) -- a name claimed by
                        // another reason belongs there and only there,
                        // not repeated here even informationally.
                        // Per-unit issues have no such ownership
                        // concept, so their items pass through
                        // untouched.
                        const items =
                          issue.flagged_are_group_names
                            ? rawItems.filter(
                                (
                                  item
                                ) =>
                                  group.reviewGroupNames.includes(
                                    item
                                  )
                              )
                            : rawItems;

                        if (
                          items.length ===
                          0
                        ) {
                          return null;
                        }

                        return (
                          <li
                            key={issueKey(
                              issue
                            )}
                          >
                            <strong>
                              {basename(
                                issue.file_name
                              )}
                            </strong>

                            <ul className="ml-4 list-disc space-y-0.5">
                              {items.map(
                                (
                                  item
                                ) => {
                                  const occurrenceCount =
                                    group.occurrenceCounts.get(
                                      item
                                    );

                                  return (
                                    <li
                                      key={
                                        item
                                      }
                                    >
                                      {
                                        item
                                      }
                                      {occurrenceCount !==
                                        undefined && (
                                        <span className="text-slate-400">
                                          {" "}
                                          (
                                          {
                                            occurrenceCount
                                          }

                                          )
                                        </span>
                                      )}
                                    </li>
                                  );
                                }
                              )}
                            </ul>
                          </li>
                        );
                      }
                    )}
                  </ul>
                )}

                {group.isLive &&
                  group
                    .reviewGroupNames
                    .length > 0 && (
                    <div className="mt-3 rounded border border-slate-700 p-3">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <div className="text-sm font-medium text-slate-200">
                          Groups Needing
                          Review
                        </div>

                        {group
                          .reviewGroupNames
                          .length >
                          15 && (
                          <button
                            onClick={() =>
                              reviewListEndRefs.current
                                ?.get(
                                  group.description
                                )
                                ?.scrollIntoView(
                                  {
                                    behavior:
                                      "smooth",
                                    block:
                                      "start",
                                  }
                                )
                            }
                            className="shrink-0 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
                          >
                            Skip to the
                            End ↓
                          </button>
                        )}
                      </div>

                      {group
                        .reviewGroupNames
                        .length > 0 && (
                        <div className="space-y-3">
                          {group.reviewGroupNames.map(
                            (
                              groupName
                            ) => (
                              <GroupCorrectionCard
                                key={
                                  groupName
                                }
                                sessionId={
                                  sessionId
                                }
                                groupName={
                                  groupName
                                }
                                count={group.occurrenceCounts.get(
                                  groupName
                                )}
                                onUpdated={
                                  onUpdated
                                }
                                onExcluded={
                                  onExcluded
                                }
                                onSessionExpired={
                                  onSessionExpired
                                }
                              />
                            )
                          )}
                        </div>
                      )}

                      <div
                        ref={(el) => {
                          if (el) {
                            reviewListEndRefs.current?.set(
                              group.description,
                              el
                            );
                          }
                        }}
                        className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-700 pt-3"
                      >
                        <ExcludeAllButton
                          sessionId={
                            sessionId
                          }
                          groupNames={
                            group.reviewGroupNames
                          }
                          onUpdated={
                            onUpdated
                          }
                          onExcluded={
                            onExcluded
                          }
                          onSessionExpired={
                            onSessionExpired
                          }
                        />

                        <ImportAsIsButton
                          sessionId={
                            sessionId
                          }
                          check={
                            group.description
                          }
                          groupNames={
                            group.groupNames
                          }
                          onUpdated={
                            onUpdated
                          }
                          onAcknowledged={
                            onAcknowledged
                          }
                          onSessionExpired={
                            onSessionExpired
                          }
                        />
                      </div>
                    </div>
                  )}

                {group.excludedNames
                  .length > 0 && (
                  <div className="mt-3 rounded border border-slate-700 bg-slate-900/40 p-3">
                    <div className="mb-2 text-sm font-medium text-slate-400">
                      Excluded Groups (
                      {
                        group
                          .excludedNames
                          .length
                      }

                      )
                    </div>

                    <ul className="mb-3 ml-4 list-disc space-y-0.5 text-sm text-slate-400">
                      {group.excludedNames.map(
                        (name) => {
                          const occurrenceCount =
                            group.occurrenceCounts.get(
                              name
                            );

                          return (
                            <li
                              key={
                                name
                              }
                            >
                              {name}
                              {occurrenceCount !==
                                undefined && (
                                <span>
                                  {" "}
                                  (
                                  {
                                    occurrenceCount
                                  }

                                  )
                                </span>
                              )}
                            </li>
                          );
                        }
                      )}
                    </ul>

                    <EditGroupsButton
                      sessionId={
                        sessionId
                      }
                      groupNames={
                        group.excludedNames
                      }
                      onUpdated={
                        onUpdated
                      }
                      onIncluded={
                        onIncluded
                      }
                      onSessionExpired={
                        onSessionExpired
                      }
                    />
                  </div>
                )}

                {group
                  .acknowledgedNames
                  .length > 0 && (
                  <div className="mt-3 rounded border border-slate-700 bg-slate-900/40 p-3">
                    <div className="mb-2 text-sm font-medium text-slate-400">
                      Imported As Is (
                      {
                        group
                          .acknowledgedNames
                          .length
                      }

                      )
                    </div>

                    <ul className="mb-3 ml-4 list-disc space-y-0.5 text-sm text-slate-400">
                      {group.acknowledgedNames.map(
                        (name) => {
                          const occurrenceCount =
                            group.occurrenceCounts.get(
                              name
                            );

                          return (
                            <li
                              key={
                                name
                              }
                            >
                              {name}
                              {occurrenceCount !==
                                undefined && (
                                <span>
                                  {" "}
                                  (
                                  {
                                    occurrenceCount
                                  }

                                  )
                                </span>
                              )}
                            </li>
                          );
                        }
                      )}
                    </ul>

                    <UndoImportAsIsButton
                      sessionId={
                        sessionId
                      }
                      check={
                        group.description
                      }
                      groupNames={
                        group.acknowledgedNames
                      }
                      onUpdated={
                        onUpdated
                      }
                      onUnacknowledged={
                        onUnacknowledged
                      }
                      onSessionExpired={
                        onSessionExpired
                      }
                    />
                  </div>
                )}
              </details>
            )
          )}
        </div>
      )}
    </details>
  );
}
