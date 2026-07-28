import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DedupSummaryStats from "./DedupSummaryStats";
import type { DedupReportView } from "@/types/api";

function baseReport(overrides: Partial<DedupReportView> = {}): DedupReportView {
  return {
    total_rows: 0,
    unique_tenants: 0,
    multi_unit_tenants: 0,
    flagged_groups: [],
    typo_variant_candidates: [],
    related_tenant_candidates: [],
    ...overrides,
  };
}

describe("DedupSummaryStats", () => {
  it("renders the counts it's given", () => {
    render(
      <DedupSummaryStats
        report={baseReport({
          total_rows: 120,
          unique_tenants: 80,
          multi_unit_tenants: 15,
        })}
      />
    );

    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("derives its counts from array lengths rather than raw totals", () => {
    render(
      <DedupSummaryStats
        report={baseReport({
          flagged_groups: [
            {
              key: "a",
              display_name: "A",
              units: ["1"],
              categories: [],
              bullets: [],
            },
            {
              key: "b",
              display_name: "B",
              units: ["2"],
              categories: [],
              bullets: [],
            },
          ],
          typo_variant_candidates: [
            {
              display_name_a: "A",
              units_a: ["1"],
              display_name_b: "B",
              units_b: ["2"],
              contact_info_matches: true,
              note: "note",
            },
          ],
        })}
      />
    );

    expect(screen.getByText("Flagged Groups").nextSibling).toHaveTextContent(
      "2"
    );
    expect(screen.getByText("Typo Variants").nextSibling).toHaveTextContent(
      "1"
    );
    expect(screen.getByText("Related Tenants").nextSibling).toHaveTextContent(
      "0"
    );
  });

  it("shows zero for every stat on an empty report", () => {
    render(<DedupSummaryStats report={baseReport()} />);

    expect(screen.getAllByText("0")).toHaveLength(6);
  });
});
