import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SummaryStats from "./SummaryStats";
import type { AnalyzeResponse } from "@/types/api";

function baseAnalysis(overrides: Partial<AnalyzeResponse> = {}): AnalyzeResponse {
  return {
    facilities: 0,
    global_groups: 0,
    net_new_groups: 0,
    similar_groups: 0,
    advisory_issues: 0,
    net_new_group_details: [],
    similar_group_details: [],
    advisory_issue_details: [],
    ...overrides,
  };
}

describe("SummaryStats", () => {
  it("renders the counts it's given", () => {
    render(
      <SummaryStats
        analysis={baseAnalysis({
          facilities: 3,
          global_groups: 42,
          net_new_groups: 5,
          similar_groups: 2,
          advisory_issues: 1,
        })}
      />
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("labels each stat correctly", () => {
    render(
      <SummaryStats
        analysis={baseAnalysis({
          facilities: 3,
          global_groups: 42,
          net_new_groups: 5,
          similar_groups: 2,
          advisory_issues: 1,
        })}
      />
    );

    expect(screen.getByText("Facilities").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("Global Groups").nextSibling).toHaveTextContent(
      "42"
    );
    expect(screen.getByText("Net New").nextSibling).toHaveTextContent("5");
    expect(screen.getByText("Similar").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Advisory").nextSibling).toHaveTextContent("1");
  });

  it("shows zero for every stat on an empty analysis", () => {
    render(<SummaryStats analysis={baseAnalysis()} />);

    expect(screen.getAllByText("0")).toHaveLength(5);
  });
});
