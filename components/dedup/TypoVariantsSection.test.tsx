import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TypoVariantsSection from "./TypoVariantsSection";
import type { TypoVariantView } from "@/types/api";

function makeCandidate(
  overrides: Partial<TypoVariantView> = {}
): TypoVariantView {
  return {
    display_name_a: "Jon Smith",
    units_a: ["1"],
    display_name_b: "John Smith",
    units_b: ["2"],
    contact_info_matches: true,
    note: "Names differ by one letter.",
    ...overrides,
  };
}

describe("TypoVariantsSection", () => {
  it("shows the all-clear message when there are no candidates", () => {
    render(<TypoVariantsSection candidates={[]} />);

    expect(
      screen.getByText("No typo/name variant candidates detected.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Possible Name/Typo Variants (0)")
    ).toBeInTheDocument();
  });

  it("renders both tenant names, their unit phrases, and the note", () => {
    render(
      <TypoVariantsSection
        candidates={[
          makeCandidate({
            display_name_a: "Jon Smith",
            units_a: ["1", "2"],
            display_name_b: "John Smith",
            units_b: ["3"],
            note: "Names differ by one letter.",
          }),
        ]}
      />
    );

    expect(
      screen.getByText("Possible Name/Typo Variants (1)")
    ).toBeInTheDocument();
    expect(screen.getByText("Jon Smith")).toBeInTheDocument();
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("units 1 and 2")).toBeInTheDocument();
    expect(screen.getByText("unit 3")).toBeInTheDocument();
    expect(screen.getByText("Names differ by one letter.")).toBeInTheDocument();
  });

  it('shows "Contact info matches" when contact_info_matches is true', () => {
    render(
      <TypoVariantsSection
        candidates={[makeCandidate({ contact_info_matches: true })]}
      />
    );

    expect(screen.getByText("Contact info matches")).toBeInTheDocument();
    expect(screen.queryByText("Contact info differs")).not.toBeInTheDocument();
  });

  it('shows "Contact info differs" when contact_info_matches is false', () => {
    render(
      <TypoVariantsSection
        candidates={[makeCandidate({ contact_info_matches: false })]}
      />
    );

    expect(screen.getByText("Contact info differs")).toBeInTheDocument();
    expect(screen.queryByText("Contact info matches")).not.toBeInTheDocument();
  });

  it("renders multiple candidates", () => {
    render(
      <TypoVariantsSection
        candidates={[
          makeCandidate({ display_name_a: "Ann", display_name_b: "Anne" }),
          makeCandidate({ display_name_a: "Kate", display_name_b: "Cate" }),
        ]}
      />
    );

    expect(
      screen.getByText("Possible Name/Typo Variants (2)")
    ).toBeInTheDocument();
    expect(screen.getByText("Ann")).toBeInTheDocument();
    expect(screen.getByText("Kate")).toBeInTheDocument();
  });
});
