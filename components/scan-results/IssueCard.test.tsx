import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IssueCard, issueKey } from "./IssueCard";
import type { ValidationIssue } from "@/types/api";

function baseIssue(
  overrides: Partial<ValidationIssue> = {}
): ValidationIssue {
  return {
    file_name: "wave1/units.csv",
    severity: "Warning",
    description: "Invalid Dimensions",
    affected_units: 1,
    affected_unit_ids: ["101"],
    detail: "Width is missing.",
    correctable_fields: [],
    exemptable: false,
    affected_group_names: [],
    flagged_are_group_names: false,
    group_occurrence_counts: [],
    ...overrides,
  };
}

describe("issueKey", () => {
  it("combines file name, description, and affected units into a stable key", () => {
    const issue = baseIssue({
      file_name: "units.csv",
      description: "Invalid Dimensions",
      affected_unit_ids: ["101", "102"],
    });

    expect(issueKey(issue)).toBe(
      "units.csv::Invalid Dimensions::101,102"
    );
  });
});

describe("IssueCard", () => {
  it("renders the basename of the file, severity, description, and detail", () => {
    render(
      <IssueCard
        issue={baseIssue()}
        sessionId="s1"
        onCorrectionSaved={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(screen.getByText("units.csv")).toBeInTheDocument();
    expect(screen.getByText("[Warning]")).toBeInTheDocument();
    expect(
      screen.getByText("Invalid Dimensions")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Width is missing.")
    ).toBeInTheDocument();
  });

  it("shows [Error] for an error-severity issue", () => {
    render(
      <IssueCard
        issue={baseIssue({ severity: "Error" })}
        sessionId="s1"
        onCorrectionSaved={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(screen.getByText("[Error]")).toBeInTheDocument();
  });

  it("renders a Unit heading and a CorrectionField per correctable field per affected unit", () => {
    render(
      <IssueCard
        issue={baseIssue({
          affected_unit_ids: ["101", "102"],
          correctable_fields: ["Width", "Length"],
        })}
        sessionId="s1"
        onCorrectionSaved={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(screen.getByText("Unit 101")).toBeInTheDocument();
    expect(screen.getByText("Unit 102")).toBeInTheDocument();
    expect(screen.getAllByText("Width")).toHaveLength(2);
    expect(screen.getAllByText("Length")).toHaveLength(2);
  });

  it("renders an ExemptButton per affected unit when the issue is exemptable", () => {
    render(
      <IssueCard
        issue={baseIssue({
          affected_unit_ids: ["101", "102"],
          exemptable: true,
        })}
        sessionId="s1"
        onCorrectionSaved={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(
      screen.getAllByRole("button", {
        name: "Not a dimensioned unit (office, apartment, etc.)",
      })
    ).toHaveLength(2);
  });

  it("renders no correction UI when there are no correctable fields and the issue isn't exemptable", () => {
    render(
      <IssueCard
        issue={baseIssue({
          correctable_fields: [],
          exemptable: false,
        })}
        sessionId="s1"
        onCorrectionSaved={vi.fn()}
        onSessionExpired={vi.fn()}
      />
    );

    expect(screen.queryByText(/Unit 101/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button")
    ).not.toBeInTheDocument();
  });
});
