import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useScanResultsDerivedState } from "./useScanResultsDerivedState";
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

function warningIssue(overrides: Partial<ValidationIssue> = {}): ValidationIssue {
  return {
    file_name: "units.csv",
    severity: "Warning",
    description: "Rare UnitGroup detected",
    affected_units: 1,
    affected_unit_ids: [],
    detail: "",
    correctable_fields: [],
    exemptable: true,
    affected_group_names: ["Building A"],
    flagged_are_group_names: true,
    group_occurrence_counts: [["Building A", 1]],
    ...overrides,
  };
}

describe("useScanResultsDerivedState", () => {
  it("returns the all-empty shape while results is null", () => {
    const { result } = renderHook(() => useScanResultsDerivedState(null));

    expect(result.current.errors).toEqual([]);
    expect(result.current.totalWarningItems).toBe(0);
    expect(result.current.displayedWarningTotal).toBe(0);
    expect(result.current.warningsAllResolved).toBe(false);
  });

  it("freezes the warning total at its last non-zero value once everything is excluded", () => {
    const withWarning = baseResults({
      issue_count: 1,
      warning_count: 1,
      issues: [warningIssue()],
    });

    const { result, rerender } = renderHook(({ results }) => useScanResultsDerivedState(results), {
      initialProps: { results: withWarning as ValidateResponse | null },
    });

    expect(result.current.totalWarningItems).toBe(1);
    expect(result.current.displayedWarningTotal).toBe(1);
    expect(result.current.warningsAllResolved).toBe(false);

    // Simulate the group getting excluded -- the backend response no
    // longer reports it, but the reason snapshot already captured it.
    act(() => {
      result.current.handleGroupsExcluded(["Building A"]);
    });

    const resolved = baseResults({ issue_count: 0, warning_count: 0, issues: [] });
    rerender({ results: resolved });

    expect(result.current.totalWarningItems).toBe(0);
    expect(result.current.displayedWarningTotal).toBe(1);
    expect(result.current.warningsAllResolved).toBe(true);
  });

  it("auto-collapses the details accordion once everything resolves while it was open", () => {
    const withWarning = baseResults({
      issue_count: 1,
      warning_count: 1,
      issues: [warningIssue()],
    });

    const { result, rerender } = renderHook(({ results }) => useScanResultsDerivedState(results), {
      initialProps: { results: withWarning as ValidateResponse | null },
    });

    act(() => {
      result.current.setValidationDetailsOpen(true);
    });
    expect(result.current.validationDetailsOpen).toBe(true);

    act(() => {
      result.current.handleGroupsAcknowledged(["Building A"]);
    });

    const resolved = baseResults({ issue_count: 0, warning_count: 0, issues: [] });
    rerender({ results: resolved });

    expect(result.current.everythingResolved).toBe(true);
    expect(result.current.validationDetailsOpen).toBe(false);
  });

  it("un-excluding a group name moves it back out of the excluded set", () => {
    const withWarning = baseResults({
      issue_count: 1,
      warning_count: 1,
      issues: [warningIssue()],
    });

    const { result } = renderHook(() => useScanResultsDerivedState(withWarning));

    act(() => {
      result.current.handleGroupsExcluded(["Building A"]);
    });
    act(() => {
      result.current.handleGroupsIncluded(["Building A"]);
    });

    // Back in the (still-live) results, so it still counts as a real warning.
    expect(result.current.totalWarningItems).toBe(1);
  });
});
