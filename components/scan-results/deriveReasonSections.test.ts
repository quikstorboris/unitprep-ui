import { describe, expect, it } from "vitest";

import { deriveScanResults, type ReasonSnapshot } from "./deriveReasonSections";
import type { ValidateResponse, ValidationIssue } from "@/types/api";

function baseResults(overrides: Partial<ValidateResponse> = {}): ValidateResponse {
  return {
    files_checked: 1,
    issue_count: 0,
    error_count: 0,
    warning_count: 0,
    issues: [],
    files_errored: [],
    ready: true,
    ...overrides,
  };
}

function issue(overrides: Partial<ValidationIssue> = {}): ValidationIssue {
  return {
    file_name: "units.csv",
    severity: "Warning",
    description: "Rare UnitGroup detected",
    affected_units: 1,
    affected_unit_ids: [],
    detail: "",
    correctable_fields: [],
    exemptable: true,
    affected_group_names: [],
    flagged_are_group_names: false,
    group_occurrence_counts: [],
    ...overrides,
  };
}

const emptySnapshots = new Map<string, ReasonSnapshot>();
const emptySet = new Set<string>();

describe("deriveScanResults", () => {
  it("returns the all-empty/all-false shape for null results", () => {
    const derived = deriveScanResults(null, emptySnapshots, emptySet, emptySet);

    expect(derived).toEqual({
      errors: [],
      warnings: [],
      filesErrored: [],
      everythingResolved: false,
      warningReasonGroups: [],
      totalWarningItems: 0,
      reasonSections: [],
    });
  });

  it("splits issues into errors and warnings by severity", () => {
    const results = baseResults({
      issues: [
        issue({ severity: "Error", description: "Invalid Dimensions" }),
        issue({ severity: "Warning", description: "Rare UnitGroup detected" }),
        issue({ severity: "Info", description: "Odd UnitGroup detected" }),
      ],
    });

    const derived = deriveScanResults(results, emptySnapshots, emptySet, emptySet);

    expect(derived.errors).toHaveLength(1);
    expect(derived.errors[0].description).toBe("Invalid Dimensions");
    expect(derived.warnings).toHaveLength(2);
  });

  it("passes through files_errored", () => {
    const results = baseResults({
      files_errored: [{ file_name: "bad.csv", message: "parse failed" }],
    });

    const derived = deriveScanResults(results, emptySnapshots, emptySet, emptySet);

    expect(derived.filesErrored).toEqual([
      { file_name: "bad.csv", message: "parse failed" },
    ]);
  });

  it("marks everythingResolved when issue_count and files_errored are both zero", () => {
    const results = baseResults({ issue_count: 0, files_errored: [] });

    const derived = deriveScanResults(results, emptySnapshots, emptySet, emptySet);

    expect(derived.everythingResolved).toBe(true);
  });

  it.each([
    ["nonzero issue_count", baseResults({ issue_count: 1 })],
    [
      "nonempty files_errored",
      baseResults({ files_errored: [{ file_name: "bad.csv", message: "oops" }] }),
    ],
  ])("does not mark everythingResolved with %s", (_label, results) => {
    const derived = deriveScanResults(results, emptySnapshots, emptySet, emptySet);

    expect(derived.everythingResolved).toBe(false);
  });

  it("groups warnings by description into warningReasonGroups", () => {
    const results = baseResults({
      issues: [
        issue({
          description: "Rare UnitGroup detected",
          affected_group_names: ["10x10"],
          affected_units: 3,
        }),
        issue({
          description: "Rare UnitGroup detected",
          affected_group_names: ["10x20"],
          affected_units: 2,
        }),
        issue({
          description: "Odd UnitGroup detected",
          affected_group_names: ["Weird"],
          affected_units: 1,
        }),
      ],
    });

    const derived = deriveScanResults(results, emptySnapshots, emptySet, emptySet);

    expect(derived.warningReasonGroups).toHaveLength(2);

    const rare = derived.warningReasonGroups.find(
      (g) => g.description === "Rare UnitGroup detected"
    );
    expect(rare?.groupNames).toEqual(["10x10", "10x20"]);
    expect(rare?.count).toBe(5);
  });

  it("counts a per-group check by distinct owned group names, not summed affected_units", () => {
    const results = baseResults({
      issues: [
        issue({
          description: "Odd UnitGroup detected",
          affected_group_names: ["Weird", "Weird"],
          affected_units: 9,
          flagged_are_group_names: true,
        }),
      ],
    });

    const derived = deriveScanResults(results, emptySnapshots, emptySet, emptySet);

    expect(derived.warningReasonGroups[0].count).toBe(1);
    expect(derived.warningReasonGroups[0].reviewGroupNames).toEqual(["Weird"]);
  });

  it("sums affected_units for a per-unit check", () => {
    const results = baseResults({
      issues: [
        issue({
          description: "Invalid Dimensions",
          affected_units: 4,
          flagged_are_group_names: false,
        }),
        issue({
          description: "Invalid Dimensions",
          affected_units: 6,
          flagged_are_group_names: false,
        }),
      ],
    });

    const derived = deriveScanResults(results, emptySnapshots, emptySet, emptySet);

    expect(derived.warningReasonGroups[0].count).toBe(10);
  });

  it("assigns a group flagged under two reasons only to the first reason it appears in", () => {
    const results = baseResults({
      issues: [
        issue({
          description: "Odd UnitGroup detected",
          affected_group_names: ["Shared"],
          flagged_are_group_names: true,
        }),
        issue({
          description: "Rare UnitGroup detected",
          affected_group_names: ["Shared"],
          flagged_are_group_names: true,
        }),
      ],
    });

    const derived = deriveScanResults(results, emptySnapshots, emptySet, emptySet);

    const odd = derived.warningReasonGroups.find(
      (g) => g.description === "Odd UnitGroup detected"
    );
    const rare = derived.warningReasonGroups.find(
      (g) => g.description === "Rare UnitGroup detected"
    );

    expect(odd?.reviewGroupNames).toEqual(["Shared"]);
    expect(rare?.reviewGroupNames).toEqual([]);
    expect(rare?.groupNames).toEqual(["Shared"]);
  });

  it("sums totalWarningItems across every reason group's own count", () => {
    const results = baseResults({
      issues: [
        issue({ description: "Odd UnitGroup detected", affected_units: 2 }),
        issue({ description: "Rare UnitGroup detected", affected_units: 5 }),
      ],
    });

    const derived = deriveScanResults(results, emptySnapshots, emptySet, emptySet);

    expect(derived.totalWarningItems).toBe(7);
  });

  it("keeps a fully-resolved reason's section alive via its snapshot alone", () => {
    const snapshots = new Map<string, ReasonSnapshot>([
      [
        "Rare UnitGroup detected",
        {
          groupNames: ["Gone"],
          occurrenceCounts: new Map([["Gone", 1]]),
        },
      ],
    ]);
    const excluded = new Set(["Gone"]);

    const derived = deriveScanResults(baseResults(), snapshots, excluded, emptySet);

    expect(derived.reasonSections).toHaveLength(1);
    expect(derived.reasonSections[0]).toMatchObject({
      description: "Rare UnitGroup detected",
      isLive: false,
      excludedNames: ["Gone"],
      acknowledgedNames: [],
    });
  });

  it("marks a live reason section's excludedNames/acknowledgedNames from history not currently live", () => {
    const results = baseResults({
      issues: [
        issue({
          description: "Rare UnitGroup detected",
          affected_group_names: ["StillHere"],
          flagged_are_group_names: true,
        }),
      ],
    });

    const snapshots = new Map<string, ReasonSnapshot>([
      [
        "Rare UnitGroup detected",
        {
          groupNames: ["StillHere", "Excluded", "Acked"],
          occurrenceCounts: new Map(),
        },
      ],
    ]);

    const derived = deriveScanResults(
      results,
      snapshots,
      new Set(["Excluded"]),
      new Set(["Acked"])
    );

    expect(derived.reasonSections).toHaveLength(1);
    const section = derived.reasonSections[0];
    expect(section.isLive).toBe(true);
    expect(section.excludedNames).toEqual(["Excluded"]);
    expect(section.acknowledgedNames).toEqual(["Acked"]);
  });

  it("omits a reason from reasonSections when it has no live groups and no history", () => {
    const derived = deriveScanResults(baseResults(), emptySnapshots, emptySet, emptySet);

    expect(derived.reasonSections).toEqual([]);
  });

  it("does not add a history-only section when its excluded/acknowledged names are both empty", () => {
    const snapshots = new Map<string, ReasonSnapshot>([
      [
        "Rare UnitGroup detected",
        { groupNames: ["Untouched"], occurrenceCounts: new Map() },
      ],
    ]);

    const derived = deriveScanResults(baseResults(), snapshots, emptySet, emptySet);

    expect(derived.reasonSections).toEqual([]);
  });
});
