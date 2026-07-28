import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdvisoryIssuesTable from "./AdvisoryIssuesTable";
import type { AdvisoryIssue } from "@/types/api";

function makeIssue(overrides: Partial<AdvisoryIssue> = {}): AdvisoryIssue {
  return {
    source: "facility-a.csv",
    issue: "Group name is unusually short.",
    severity: "Warning",
    ...overrides,
  };
}

describe("AdvisoryIssuesTable", () => {
  it("shows the all-clear message when there are no issues", () => {
    render(<AdvisoryIssuesTable issues={[]} />);

    expect(
      screen.getByText("No advisory issues detected.")
    ).toBeInTheDocument();
    expect(screen.getByText("Advisory Issues (0)")).toBeInTheDocument();
  });

  it("renders a row's source, severity, and issue text", () => {
    render(
      <AdvisoryIssuesTable
        issues={[
          makeIssue({
            source: "facility-a.csv",
            severity: "Error",
            issue: "Group name collides with a reserved word.",
          }),
        ]}
      />
    );

    expect(screen.getByText("Advisory Issues (1)")).toBeInTheDocument();
    expect(screen.getByText("facility-a.csv")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(
      screen.getByText("Group name collides with a reserved word.")
    ).toBeInTheDocument();
  });

  it("renders one row per issue", () => {
    render(
      <AdvisoryIssuesTable
        issues={[
          makeIssue({ source: "a.csv", severity: "Info" }),
          makeIssue({ source: "b.csv", severity: "Warning" }),
          makeIssue({ source: "c.csv", severity: "Error" }),
        ]}
      />
    );

    expect(screen.getByText("Advisory Issues (3)")).toBeInTheDocument();
    expect(screen.getByText("a.csv")).toBeInTheDocument();
    expect(screen.getByText("b.csv")).toBeInTheDocument();
    expect(screen.getByText("c.csv")).toBeInTheDocument();
  });
});
