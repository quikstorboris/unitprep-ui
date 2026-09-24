"use client";

import { useMemo, useState } from "react";

import { deriveScanResults, type ReasonSnapshot } from "./deriveReasonSections";
import type { ValidateResponse } from "@/types/api";

/**
 * Everything ScanResultsPage derives from the latest `ValidateResponse`
 * -- extracted out as its own hook since none of it is JSX, it's pure
 * cross-render bookkeeping: which warning reasons/groups have ever been
 * seen (so a fully-resolved reason's list stays visible with an undo
 * instead of vanishing), the frozen "last known" warning total (so the
 * top tile doesn't drop to 0 the moment everything's excluded), and the
 * "Validation Details" accordion's own auto-collapse-on-resolve.
 */
export function useScanResultsDerivedState(results: ValidateResponse | null) {
  // The latest full picture seen for each warning reason while it still
  // had live issues -- kept even after every one of its groups gets
  // excluded and the reason itself drops out of `results.issues`
  // entirely, so its list stays visible (with an undo) instead of
  // simply vanishing the moment it's resolved.
  const [reasonSnapshots, setReasonSnapshots] = useState<Map<string, ReasonSnapshot>>(new Map());

  // Every group name excluded so far this session, across every reason
  // and every exclude action (single-card or bulk) -- combined with
  // `reasonSnapshots` above, lets a reason that's fully or partially
  // excluded keep showing those names with an "Edit Groups" undo,
  // rather than just disappearing once the backend stops reporting
  // them as live issues.
  const [excludedGroupNames, setExcludedGroupNames] = useState<Set<string>>(new Set());

  // Every group name accepted "as is" so far this session, across every
  // reason and every "Import as is" action -- same role as
  // `excludedGroupNames` above, just for acknowledgments instead of
  // exclusions (the data stays; only the flag on it goes away).
  const [acknowledgedGroupNames, setAcknowledgedGroupNames] = useState<Set<string>>(new Set());

  // Freezes the top "Warnings" tile at its last non-zero value instead
  // of dropping to 0 the moment everything's excluded -- excluding
  // isn't the same as "there was never anything to review," so the
  // number stays as a record, just recolored to signal it's resolved
  // (see the tile's render below).
  const [lastKnownWarningTotal, setLastKnownWarningTotal] = useState(0);

  // Controlled so the outer "Validation Details" accordion can
  // auto-collapse the moment everything resolves (see the effect
  // below), while still opening/closing normally on a manual click the
  // rest of the time.
  const [validationDetailsOpen, setValidationDetailsOpen] = useState(false);

  const [wasFullyResolved, setWasFullyResolved] = useState(false);

  const handleGroupsExcluded = (groupNames: string[]) => {
    setExcludedGroupNames((prev) => {
      const next = new Set(prev);
      for (const name of groupNames) {
        next.add(name);
      }
      return next;
    });
  };

  const handleGroupsIncluded = (groupNames: string[]) => {
    setExcludedGroupNames((prev) => {
      const next = new Set(prev);
      for (const name of groupNames) {
        next.delete(name);
      }
      return next;
    });
  };

  const handleGroupsAcknowledged = (groupNames: string[]) => {
    setAcknowledgedGroupNames((prev) => {
      const next = new Set(prev);
      for (const name of groupNames) {
        next.add(name);
      }
      return next;
    });
  };

  const handleGroupsUnacknowledged = (groupNames: string[]) => {
    setAcknowledgedGroupNames((prev) => {
      const next = new Set(prev);
      for (const name of groupNames) {
        next.delete(name);
      }
      return next;
    });
  };

  // Every derived value below is computed defensively (safe when
  // `results` is still null) so the effects further down -- which must
  // be called unconditionally, before any early return -- have
  // something real to close over regardless of loading/error state. See
  // deriveScanResults for the group-ownership model itself.
  const { errors, filesErrored, everythingResolved, warningReasonGroups, totalWarningItems, reasonSections } =
    useMemo(
      () => deriveScanResults(results, reasonSnapshots, excludedGroupNames, acknowledgedGroupNames),
      [results, reasonSnapshots, excludedGroupNames, acknowledgedGroupNames]
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
    let nextReasonSnapshots = reasonSnapshots;
    let snapshotsChanged = false;

    for (const g of warningReasonGroups) {
      const existing = reasonSnapshots.get(g.description);

      const existingNames = new Set(existing?.groupNames ?? []);

      // Only ever *grows* a reason's remembered name list -- a name
      // dropping out of the current live list means it was excluded,
      // not that it was never really part of this reason. Overwriting
      // the snapshot with the shrunken live list here would erase the
      // very history "Excluded Groups" depends on, the moment the
      // first group in a reason gets excluded.
      const hasNewNames = g.groupNames.some((name) => !existingNames.has(name));

      if (!existing || hasNewNames) {
        if (!snapshotsChanged) {
          nextReasonSnapshots = new Map(reasonSnapshots);
          snapshotsChanged = true;
        }

        const mergedNames = existing
          ? Array.from(new Set([...existing.groupNames, ...g.groupNames])).sort()
          : g.groupNames;

        const mergedCounts = new Map(existing?.occurrenceCounts ?? []);

        for (const [name, count] of g.occurrenceCounts.entries()) {
          mergedCounts.set(name, count);
        }

        nextReasonSnapshots.set(g.description, {
          groupNames: mergedNames,
          occurrenceCounts: mergedCounts,
        });
      }
    }

    if (snapshotsChanged) {
      setReasonSnapshots(nextReasonSnapshots);
    }
  }

  if (totalWarningItems > 0 && totalWarningItems !== lastKnownWarningTotal) {
    setLastKnownWarningTotal(totalWarningItems);
  }

  if (!wasFullyResolved && everythingResolved && validationDetailsOpen) {
    setValidationDetailsOpen(false);
  }

  if (wasFullyResolved !== everythingResolved) {
    setWasFullyResolved(everythingResolved);
  }

  const displayedWarningTotal = totalWarningItems > 0 ? totalWarningItems : lastKnownWarningTotal;

  const warningsAllResolved = totalWarningItems === 0 && lastKnownWarningTotal > 0;

  return {
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
  };
}
