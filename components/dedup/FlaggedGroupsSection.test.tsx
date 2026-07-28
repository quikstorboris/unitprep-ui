import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FlaggedGroupsSection from "./FlaggedGroupsSection";
import type { FlaggedGroupView } from "@/types/api";

function makeGroup(overrides: Partial<FlaggedGroupView> = {}): FlaggedGroupView {
  return {
    key: "smith",
    display_name: "John Smith",
    units: ["12"],
    categories: ["Phone"],
    bullets: [
      {
        field: "PhoneNumber",
        label: "Phone Number",
        sentence: "Phone numbers differ across units.",
        cell_refs: [],
      },
    ],
    ...overrides,
  };
}

describe("FlaggedGroupsSection", () => {
  it("shows the all-clear message when there are no flagged groups", () => {
    render(<FlaggedGroupsSection groups={[]} />);

    expect(
      screen.getByText("No duplicate tenants flagged.")
    ).toBeInTheDocument();
    expect(screen.getByText("Flagged Groups (0)")).toBeInTheDocument();
  });

  it("renders a group's name, unit phrase, mismatches, and bullets", () => {
    render(
      <FlaggedGroupsSection
        groups={[
          makeGroup({
            display_name: "John Smith",
            units: ["12", "14"],
            categories: ["Phone", "Email"],
          }),
        ]}
      />
    );

    expect(screen.getByText("Flagged Groups (1)")).toBeInTheDocument();
    expect(screen.getByText(/units 12 and 14/)).toBeInTheDocument();
    expect(screen.getByText(/Mismatches:\s*Phone, Email/)).toBeInTheDocument();
    expect(
      screen.getByText("Phone numbers differ across units.")
    ).toBeInTheDocument();
  });

  it("renders cell references when present, and omits them when absent", () => {
    render(
      <FlaggedGroupsSection
        groups={[
          makeGroup({
            bullets: [
              {
                field: "PhoneNumber",
                label: "Phone Number",
                sentence: "Phone numbers differ.",
                cell_refs: ["N22", "N23"],
              },
              {
                field: "Email",
                label: "Email",
                sentence: "Emails differ.",
                cell_refs: [],
              },
            ],
          }),
        ]}
      />
    );

    expect(screen.getByText("(N22, N23)")).toBeInTheDocument();
    expect(screen.getByText("Emails differ.")).toBeInTheDocument();
  });

  it("shows the company-mismatch tooltip only for CompanyName bullets", () => {
    render(
      <FlaggedGroupsSection
        groups={[
          makeGroup({
            bullets: [
              {
                field: "CompanyName",
                label: "Company Name",
                sentence: "Company names differ.",
                cell_refs: [],
              },
              {
                field: "PhoneNumber",
                label: "Phone Number",
                sentence: "Phone numbers differ.",
                cell_refs: [],
              },
            ],
          }),
        ]}
      />
    );

    expect(
      screen.getByRole("button", { name: "Why does this matter?" })
    ).toBeInTheDocument();
  });

  it("renders multiple groups", () => {
    render(
      <FlaggedGroupsSection
        groups={[
          makeGroup({ key: "a", display_name: "Group A" }),
          makeGroup({ key: "b", display_name: "Group B" }),
        ]}
      />
    );

    expect(screen.getByText("Flagged Groups (2)")).toBeInTheDocument();
    expect(screen.getByText(/Group A/)).toBeInTheDocument();
    expect(screen.getByText(/Group B/)).toBeInTheDocument();
  });
});
