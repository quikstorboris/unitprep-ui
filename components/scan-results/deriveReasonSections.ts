import type {
  FileValidationError,
  ValidateResponse,
  ValidationIssue,
} from "@/types/api";

export interface ReasonSnapshot {
  groupNames: string[];
  occurrenceCounts: Map<string, number>;
}

export interface WarningReasonGroup {
  description: string;
  issues: ValidationIssue[];
  count: number;
  groupNames: string[];
  reviewGroupNames: string[];
  occurrenceCounts: Map<string, number>;
}

// Merges each currently-live reason (from `warningReasonGroups`) with any
// reason `reasonSnapshots` remembers that now has excluded names -- a
// reason can be live with some of its own history excluded (e.g. Rare
// still has 5 groups left after 17 were bulk-excluded), or fully
// resolved and absent from `results.issues` entirely (every one of its
// groups excluded), in which case it only exists here via its snapshot.
// Either way the section keeps rendering instead of disappearing
// outright.
export type ReasonSection = {
  description: string;
  isLive: boolean;
  count: number;
  issues: ValidationIssue[];
  groupNames: string[];
  reviewGroupNames: string[];
  occurrenceCounts: Map<string, number>;
  excludedNames: string[];
  acknowledgedNames: string[];
};

export interface DerivedScanResults {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  filesErrored: FileValidationError[];
  everythingResolved: boolean;
  warningReasonGroups: WarningReasonGroup[];
  totalWarningItems: number;
  reasonSections: ReasonSection[];
}

/**
 * All of ScanResultsPage's derived-from-`results` data in one place,
 * independent of render/state -- extracted so the group-ownership
 * model (a shared group name belongs to exactly one warning section,
 * everywhere) is testable without rendering a component. Safe to call
 * with `results: null` (returns the all-empty/all-false shape), since
 * the caller's hooks must run unconditionally before any early return.
 */
export function deriveScanResults(
  results: ValidateResponse | null,
  reasonSnapshots: Map<
    string,
    ReasonSnapshot
  >,
  excludedGroupNames: Set<string>,
  acknowledgedGroupNames: Set<string>
): DerivedScanResults {
  const errors =
    results?.issues.filter(
      (i) => i.severity === "Error"
    ) ?? [];

  const warnings =
    results?.issues.filter(
      (i) => i.severity !== "Error"
    ) ?? [];

  const filesErrored =
    results?.files_errored ?? [];

  // Gates the bottom Continue button: every error *and* every warning
  // must be fixed or excluded first, not just errors — unlike `ready`
  // (which only reflects export-blocking errors).
  const everythingResolved =
    !!results &&
    results.issue_count === 0 &&
    filesErrored.length === 0;

  // Groups warnings by description (e.g. "Rare UnitGroup detected") so
  // the Warnings section can show one collapsible row per reason with
  // its own total count — and, nested inside each, its own "Groups
  // Needing Review" list scoped to just that reason's groups, rather
  // than one big list mixing every reason together.
  const warningsByReason = new Map<
    string,
    ValidationIssue[]
  >();

  for (const warning of warnings) {
    const existing =
      warningsByReason.get(
        warning.description
      ) ?? [];

    existing.push(warning);
    warningsByReason.set(
      warning.description,
      existing
    );
  }

  // A group flagged under more than one reason (e.g. odd-named *and*
  // rare) would otherwise get its own editable "Groups Needing Review"
  // card repeated in every one of those sections -- redundant, since
  // saving or excluding a group from any one card already resolves it
  // everywhere (both endpoints act on the group as a whole, not a
  // per-reason slice of it). Reasons are processed in the same order
  // they're rendered (first-encountered order from `warnings` above),
  // so whichever section a group's name appears in *first* keeps the
  // actual review card; every later section it's also flagged under
  // still lists it in its own bullet-point summary (that part stays
  // accurate/informational) but skips the duplicate card, noting where
  // the real one lives instead.
  const claimedGroupCards = new Map<
    string,
    string
  >();

  // Pre-seed ownership from history *before* looking at what's live this
  // pass, in `reasonSnapshots`' own insertion order (stable: a
  // description's snapshot is first created the first time it's ever
  // live, so this order never changes once established). Without this,
  // a reason that fully resolves (e.g. every one of its groups gets
  // acknowledged or excluded) drops out of `warningsByReason` entirely,
  // and any group it used to own that's *also* flagged under a
  // still-open reason would get re-claimed by that other reason on the
  // very next pass -- silently losing track of which check actually
  // acknowledged/excluded it, and with it, the ability to undo that
  // specific action. Pre-seeding keeps ownership stable across a
  // reason's whole live-then-resolved lifetime.
  for (const [
    description,
    snapshot,
  ] of reasonSnapshots.entries()) {
    for (const name of snapshot.groupNames) {
      if (!claimedGroupCards.has(name)) {
        claimedGroupCards.set(
          name,
          description
        );
      }
    }
  }

  const warningReasonGroups: WarningReasonGroup[] =
    Array.from(
      warningsByReason.entries()
    ).map(([description, issues]) => {
      const groupNames = new Set<string>();
      const occurrenceCounts = new Map<
        string,
        number
      >();

      for (const issue of issues) {
        for (const groupName of issue.affected_group_names) {
          groupNames.add(groupName);
        }

        for (const [
          groupName,
          count,
        ] of issue.group_occurrence_counts) {
          occurrenceCounts.set(
            groupName,
            count
          );
        }
      }

      // For a per-group check (Odd/Rare UnitGroup), `flagged_are_group_names`
      // is true on every issue sharing this description -- the same group
      // name can recur across several files, so summing each issue's own
      // `affected_units` would double-count it and disagree with "Groups
      // Needing Review" below, which is deduplicated by name. A per-unit
      // check (e.g. Invalid Dimensions) has no such dedup step, so it keeps
      // summing affected units.
      const flaggedAreGroupNames =
        issues[0]
          ?.flagged_are_group_names ??
        false;

      const sortedGroupNames = Array.from(
        groupNames
      ).sort();

      // Cards actually rendered: whichever of this reason's group names
      // are either unclaimed so far or already claimed *by this same
      // reason* (via the historical pre-seeding above -- a name this
      // reason owned before still belongs to it now, not to nobody).
      // Claim any newly-unclaimed ones immediately afterward, in the
      // same pass, so a later reason sharing a name sees it as already
      // spoken for. A name claimed by a *different* reason is dropped
      // from this reason's view entirely (bullets included, not just
      // the card) -- it belongs there and only there, full stop, not
      // repeated here even as a cross-reference.
      const reviewGroupNames =
        sortedGroupNames.filter(
          (name) => {
            const owner =
              claimedGroupCards.get(
                name
              );
            return (
              owner === undefined ||
              owner === description
            );
          }
        );

      for (const name of reviewGroupNames) {
        claimedGroupCards.set(
          name,
          description
        );
      }

      return {
        description,
        issues,
        // For a per-group check, count only the names this reason
        // actually owns (matches `reviewGroupNames.length` exactly)
        // rather than every name it flags -- a name claimed by another
        // reason isn't shown anywhere in this section anymore, so it
        // shouldn't be counted here either.
        count: flaggedAreGroupNames
          ? reviewGroupNames.length
          : issues.reduce(
              (sum, issue) =>
                sum +
                issue.affected_units,
              0
            ),
        groupNames: sortedGroupNames,
        reviewGroupNames,
        occurrenceCounts,
      };
    });

  // The top "Warnings" stat tile used to show `results.warning_count`,
  // which counts warning *issues* (one per file per check type) -- a
  // completely different unit than the per-reason "(N)" counts below it
  // (distinct groups, or distinct units), so the two numbers could look
  // wildly inconsistent (e.g. "18" at the top next to "87" in a single
  // section underneath) even though nothing was wrong. Summing the same
  // per-reason counts shown below makes the top number always equal to
  // what's visibly enumerated underneath it.
  const totalWarningItems =
    warningReasonGroups.reduce(
      (sum, group) => sum + group.count,
      0
    );

  const reasonSectionsByDescription =
    new Map<string, ReasonSection>();

  for (const g of warningReasonGroups) {
    reasonSectionsByDescription.set(
      g.description,
      {
        description: g.description,
        isLive: true,
        count: g.count,
        issues: g.issues,
        groupNames: g.groupNames,
        reviewGroupNames:
          g.reviewGroupNames,
        occurrenceCounts:
          g.occurrenceCounts,
        excludedNames: [],
        acknowledgedNames: [],
      }
    );
  }

  for (const [
    description,
    snapshot,
  ] of reasonSnapshots.entries()) {
    const existing =
      reasonSectionsByDescription.get(
        description
      );

    const liveGroupNames =
      existing?.groupNames ?? [];

    // Extends the same first-claim ownership used above for live review
    // cards to historical (excluded/acknowledged) names too -- otherwise
    // a group flagged under two reasons (e.g. both odd and rare) would
    // show its "Excluded Groups"/"Imported As Is" entry in *both*
    // sections, the same duplication problem the live cards already had
    // fixed. Reasons are visited here in the order their snapshot was
    // first created, which (since `issues::build` always raises Odd
    // before Rare for a given file) matches the page's own top-to-bottom
    // order, so whichever section owns a name's live card also owns its
    // history entries.
    for (const name of snapshot.groupNames) {
      if (!claimedGroupCards.has(name)) {
        claimedGroupCards.set(
          name,
          description
        );
      }
    }

    const ownedHistoricalNames =
      snapshot.groupNames.filter(
        (name) =>
          !liveGroupNames.includes(
            name
          ) &&
          claimedGroupCards.get(
            name
          ) === description
      );

    const excludedNames =
      ownedHistoricalNames.filter(
        (name) =>
          excludedGroupNames.has(name)
      );

    const acknowledgedNames =
      ownedHistoricalNames.filter(
        (name) =>
          acknowledgedGroupNames.has(
            name
          )
      );

    if (
      excludedNames.length === 0 &&
      acknowledgedNames.length === 0
    ) {
      continue;
    }

    if (existing) {
      existing.excludedNames =
        excludedNames;
      existing.acknowledgedNames =
        acknowledgedNames;
    } else {
      reasonSectionsByDescription.set(
        description,
        {
          description,
          isLive: false,
          count: 0,
          issues: [],
          groupNames: [],
          reviewGroupNames: [],
          occurrenceCounts:
            snapshot.occurrenceCounts,
          excludedNames,
          acknowledgedNames,
        }
      );
    }
  }

  const reasonSections = Array.from(
    reasonSectionsByDescription.values()
  );

  return {
    errors,
    warnings,
    filesErrored,
    everythingResolved,
    warningReasonGroups,
    totalWarningItems,
    reasonSections,
  };
}
