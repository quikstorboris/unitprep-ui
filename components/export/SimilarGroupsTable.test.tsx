import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SimilarGroupsTable from "./SimilarGroupsTable";
import type { SimilarityMatch } from "@/types/api";

function makeMatch(overrides: Partial<SimilarityMatch> = {}): SimilarityMatch {
  return {
    facility_group: "Building A",
    reference_group: "Building A1",
    similarity: 0.876,
    difference: "trailing digit",
    ...overrides,
  };
}

describe("SimilarGroupsTable", () => {
  it("shows the all-clear message when there are no matches", () => {
    render(<SimilarGroupsTable matches={[]} />);

    expect(screen.getByText("No similar groups detected.")).toBeInTheDocument();
    expect(screen.getByText("Similar Groups (0)")).toBeInTheDocument();
  });

  it("renders a row's group names, difference, and similarity as a percentage", () => {
    render(
      <SimilarGroupsTable
        matches={[
          makeMatch({
            facility_group: "Building A",
            reference_group: "Building A1",
            similarity: 0.876,
            difference: "trailing digit",
          }),
        ]}
      />
    );

    expect(screen.getByText("Similar Groups (1)")).toBeInTheDocument();
    expect(screen.getByText("Building A")).toBeInTheDocument();
    expect(screen.getByText("Building A1")).toBeInTheDocument();
    expect(screen.getByText("87.6%")).toBeInTheDocument();
    expect(screen.getByText("trailing digit")).toBeInTheDocument();
  });

  it("rounds the similarity percentage to one decimal place", () => {
    render(
      <SimilarGroupsTable matches={[makeMatch({ similarity: 1 })]} />
    );

    expect(screen.getByText("100.0%")).toBeInTheDocument();
  });

  it("renders one row per match", () => {
    render(
      <SimilarGroupsTable
        matches={[
          makeMatch({ facility_group: "A", reference_group: "A1" }),
          makeMatch({ facility_group: "B", reference_group: "B1" }),
        ]}
      />
    );

    expect(screen.getByText("Similar Groups (2)")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });
});
