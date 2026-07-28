import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RelatedTenantsSection from "./RelatedTenantsSection";
import type { RelatedTenantView } from "@/types/api";

function makeCandidate(
  overrides: Partial<RelatedTenantView> = {}
): RelatedTenantView {
  return {
    members: [
      { display_name: "Alice Adams", units: ["1"] },
      { display_name: "Bob Baker", units: ["2"] },
    ],
    signal: "SharedPhone",
    shared_value: "555-1234",
    note: "Same phone number across two accounts.",
    ...overrides,
  };
}

describe("RelatedTenantsSection", () => {
  it("shows the all-clear message when there are no candidates", () => {
    render(<RelatedTenantsSection candidates={[]} />);

    expect(
      screen.getByText("No related-tenant candidates detected.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Possible Related Tenants (0)")
    ).toBeInTheDocument();
  });

  it("renders a candidate's signal label, shared value, members, and note", () => {
    render(
      <RelatedTenantsSection
        candidates={[
          makeCandidate({
            signal: "SharedEmail",
            shared_value: "same@example.com",
            note: "Both accounts list this email.",
          }),
        ]}
      />
    );

    expect(
      screen.getByText("Possible Related Tenants (1)")
    ).toBeInTheDocument();
    expect(screen.getByText("Shared email address")).toBeInTheDocument();
    expect(screen.getByText("same@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("Alice Adams (unit 1), Bob Baker (unit 2)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Both accounts list this email.")
    ).toBeInTheDocument();
  });

  it("maps every relatedness signal to its human-readable label", () => {
    render(
      <RelatedTenantsSection
        candidates={[
          makeCandidate({ signal: "SharedPhone" }),
          makeCandidate({ signal: "SharedAlternateContact" }),
          makeCandidate({ signal: "SharedHomeAddress" }),
        ]}
      />
    );

    expect(screen.getByText("Shared phone number")).toBeInTheDocument();
    expect(screen.getByText("Shared alternate contact")).toBeInTheDocument();
    expect(screen.getByText("Shared home address")).toBeInTheDocument();
  });

  it("formats a member with multiple units using the Oxford-comma phrase", () => {
    render(
      <RelatedTenantsSection
        candidates={[
          makeCandidate({
            members: [
              { display_name: "Carol Chen", units: ["3", "4", "5"] },
            ],
          }),
        ]}
      />
    );

    expect(
      screen.getByText("Carol Chen (units 3, 4, and 5)")
    ).toBeInTheDocument();
  });
});
