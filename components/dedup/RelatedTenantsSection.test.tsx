import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RelatedTenantsSection from "./RelatedTenantsSection";
import type { RelatedTenantMemberView, RelatedTenantView } from "@/types/api";

const DEFAULT_MEMBERS: RelatedTenantMemberView[] = [
  { display_name: "Alice Adams", units: ["1"] },
  { display_name: "Bob Baker", units: ["2"] },
];

function makeCandidate(
  overrides: Partial<RelatedTenantView> = {}
): RelatedTenantView {
  const members = overrides.members ?? DEFAULT_MEMBERS;
  return {
    members,
    evidence: [
      {
        signal: "SharedPhone",
        shared_value: "555-1234",
        members,
      },
    ],
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
            evidence: [
              {
                signal: "SharedEmail",
                shared_value: "same@example.com",
                members: DEFAULT_MEMBERS,
              },
            ],
            note: "Both accounts list this email.",
          }),
        ]}
      />
    );

    expect(
      screen.getByText("Possible Related Tenants (1)")
    ).toBeInTheDocument();
    expect(screen.getByText("Shared email address:")).toBeInTheDocument();
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
          makeCandidate({
            evidence: [
              {
                signal: "SharedPhone",
                shared_value: "555-1234",
                members: DEFAULT_MEMBERS,
              },
            ],
          }),
          makeCandidate({
            evidence: [
              {
                signal: "SharedAlternateContact",
                shared_value: "carl reed",
                members: DEFAULT_MEMBERS,
              },
            ],
          }),
          makeCandidate({
            evidence: [
              {
                signal: "SharedHomeAddress",
                shared_value: "123 main st",
                members: DEFAULT_MEMBERS,
              },
            ],
          }),
        ]}
      />
    );

    expect(screen.getByText("Shared phone number:")).toBeInTheDocument();
    expect(
      screen.getByText("Shared alternate contact:")
    ).toBeInTheDocument();
    expect(screen.getByText("Shared home address:")).toBeInTheDocument();
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

  it("names only the specific members a piece of evidence applies to, when smaller than the household", () => {
    const alice = { display_name: "Alice Adams", units: ["1"] };
    const bob = { display_name: "Bob Baker", units: ["2"] };
    const carol = { display_name: "Carol Chen", units: ["3"] };

    render(
      <RelatedTenantsSection
        candidates={[
          {
            members: [alice, bob, carol],
            evidence: [
              {
                signal: "SharedPhone",
                shared_value: "555-1234",
                members: [alice, bob],
              },
              {
                signal: "SharedEmail",
                shared_value: "shared@example.com",
                members: [bob, carol],
              },
            ],
            note: "Household note.",
          },
        ]}
      />
    );

    // The household column names all three.
    expect(
      screen.getByText("Alice Adams (unit 1), Bob Baker (unit 2), Carol Chen (unit 3)")
    ).toBeInTheDocument();
    // Each evidence item, being a strict subset, is annotated with
    // just the members it applies to.
    expect(
      screen.getByText("(Alice Adams (unit 1), Bob Baker (unit 2))")
    ).toBeInTheDocument();
    expect(
      screen.getByText("(Bob Baker (unit 2), Carol Chen (unit 3))")
    ).toBeInTheDocument();
  });
});
