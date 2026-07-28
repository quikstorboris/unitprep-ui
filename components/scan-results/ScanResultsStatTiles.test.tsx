import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScanResultsStatTiles } from "./ScanResultsStatTiles";
import type { ValidateResponse } from "@/types/api";

function baseResults(overrides: Partial<ValidateResponse> = {}): ValidateResponse {
  return {
    files_checked: 4,
    issue_count: 0,
    error_count: 0,
    warning_count: 0,
    issues: [],
    files_errored: [],
    ready: true,
    ...overrides,
  };
}

describe("ScanResultsStatTiles", () => {
  it("renders the counts it's given", () => {
    render(
      <ScanResultsStatTiles
        results={baseResults({ files_checked: 7, error_count: 2 })}
        filesErrored={[]}
        totalWarningItems={0}
        displayedWarningTotal={3}
        warningsAllResolved={false}
      />
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it('shows "Blocked" when the result is not ready to export', () => {
    render(
      <ScanResultsStatTiles
        results={baseResults({ ready: false })}
        filesErrored={[]}
        totalWarningItems={0}
        displayedWarningTotal={0}
        warningsAllResolved={true}
      />
    );

    expect(screen.getByText(/Blocked/)).toBeInTheDocument();
  });

  it('shows "Resolve Warnings" when ready but unresolved warnings remain', () => {
    render(
      <ScanResultsStatTiles
        results={baseResults({ ready: true })}
        filesErrored={[]}
        totalWarningItems={2}
        displayedWarningTotal={2}
        warningsAllResolved={false}
      />
    );

    expect(screen.getByText(/Resolve Warnings/)).toBeInTheDocument();
  });

  it('shows "Allowed" when ready and no outstanding warnings remain', () => {
    render(
      <ScanResultsStatTiles
        results={baseResults({ ready: true })}
        filesErrored={[]}
        totalWarningItems={0}
        displayedWarningTotal={0}
        warningsAllResolved={true}
      />
    );

    expect(screen.getByText(/Allowed/)).toBeInTheDocument();
  });

  it("reflects a nonzero files-errored count", () => {
    render(
      <ScanResultsStatTiles
        results={baseResults()}
        filesErrored={[{ file_name: "bad.csv", message: "parse failed" }]}
        totalWarningItems={0}
        displayedWarningTotal={0}
        warningsAllResolved={true}
      />
    );

    expect(screen.getByText("Files Errored").nextSibling).toHaveTextContent(
      "1"
    );
  });
});
