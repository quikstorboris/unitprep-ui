import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WarningsSection } from "./WarningsSection";
import type { ReasonSection } from "./deriveReasonSections";
import type { ValidationIssue } from "@/types/api";

function baseIssue(
  overrides: Partial<ValidationIssue> = {}
): ValidationIssue {
  return {
    file_name: "units.csv",
    severity: "Warning",
    description: "Rare UnitGroup detected",
    affected_units: 1,
    affected_unit_ids: [],
    detail: "",
    correctable_fields: [],
    exemptable: false,
    affected_group_names: ["10x10 Climate"],
    flagged_are_group_names: true,
    group_occurrence_counts: [["10x10 Climate", 2]],
    ...overrides,
  };
}

function baseSection(
  overrides: Partial<ReasonSection> = {}
): ReasonSection {
  return {
    description: "Rare UnitGroup detected",
    isLive: true,
    count: 1,
    issues: [baseIssue()],
    groupNames: ["10x10 Climate"],
    reviewGroupNames: ["10x10 Climate"],
    occurrenceCounts: new Map([["10x10 Climate", 2]]),
    excludedNames: [],
    acknowledgedNames: [],
    ...overrides,
  };
}

function renderSection(
  props: Partial<
    Parameters<typeof WarningsSection>[0]
  > = {}
) {
  const reviewListEndRefs = {
    current: new Map<string, HTMLDivElement>(),
  };

  return render(
    <WarningsSection
      sessionId="s1"
      reasonSections={[baseSection()]}
      displayedWarningTotal={1}
      warningsAllResolved={false}
      reviewListEndRefs={reviewListEndRefs}
      onUpdated={vi.fn()}
      onExcluded={vi.fn()}
      onIncluded={vi.fn()}
      onAcknowledged={vi.fn()}
      onUnacknowledged={vi.fn()}
      onSessionExpired={vi.fn()}
      {...props}
    />
  );
}

describe("WarningsSection", () => {
  it("shows the displayed warning total in its summary", () => {
    renderSection({ displayedWarningTotal: 7 });

    expect(screen.getByText("Warnings (7)")).toBeInTheDocument();
  });

  it("says there are no warnings when reasonSections is empty", () => {
    renderSection({ reasonSections: [] });

    expect(screen.getByText("No warnings.")).toBeInTheDocument();
  });

  it("renders each reason's description and count", () => {
    renderSection({
      reasonSections: [
        baseSection({
          description: "Rare UnitGroup detected",
          count: 3,
        }),
        baseSection({
          description: "Odd UnitGroup detected",
          count: 2,
          issues: [
            baseIssue({ description: "Odd UnitGroup detected" }),
          ],
          groupNames: ["Hertz Office"],
          reviewGroupNames: ["Hertz Office"],
        }),
      ],
    });

    expect(
      screen.getByText("Rare UnitGroup detected (3)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Odd UnitGroup detected (2)")
    ).toBeInTheDocument();
  });

  it("renders a GroupCorrectionCard for each name needing review", () => {
    renderSection();

    expect(screen.getAllByText("10x10 Climate").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Save" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Exclude this group" })
    ).toBeInTheDocument();
  });

  it("renders ExcludeAllButton and ImportAsIsButton scoped to this section's groups", () => {
    renderSection();

    expect(
      screen.getByRole("button", { name: "Exclude All (1)" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Import as is (1)" })
    ).toBeInTheDocument();
  });

  it("does not render a review list for a section with nothing left to review", () => {
    renderSection({
      reasonSections: [
        baseSection({
          reviewGroupNames: [],
        }),
      ],
    });

    expect(
      screen.queryByText("Groups Needing Review")
    ).not.toBeInTheDocument();
  });

  it("shows a Skip to the End button once a section has more than 15 groups to review", () => {
    const manyNames = Array.from(
      { length: 16 },
      (_, i) => `Group ${i}`
    );

    renderSection({
      reasonSections: [
        baseSection({
          groupNames: manyNames,
          reviewGroupNames: manyNames,
        }),
      ],
    });

    expect(
      screen.getByRole("button", { name: "Skip to the End ↓" })
    ).toBeInTheDocument();
  });

  it("lists excluded groups and offers an EditGroupsButton to restore them", () => {
    renderSection({
      reasonSections: [
        baseSection({
          reviewGroupNames: [],
          excludedNames: ["Old Group"],
        }),
      ],
    });

    expect(screen.getByText("Excluded Groups (1)")).toBeInTheDocument();
    expect(screen.getByText("Old Group")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit Groups (1)" })
    ).toBeInTheDocument();
  });

  it("lists imported-as-is groups and offers an UndoImportAsIsButton to restore them", () => {
    renderSection({
      reasonSections: [
        baseSection({
          reviewGroupNames: [],
          acknowledgedNames: ["Imported Group"],
        }),
      ],
    });

    expect(screen.getByText("Imported As Is (1)")).toBeInTheDocument();
    expect(screen.getByText("Imported Group")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Undo Import As Is (1)" })
    ).toBeInTheDocument();
  });

  it("does not render the live issue/review UI for a resolved (non-live) section", () => {
    renderSection({
      reasonSections: [
        baseSection({
          isLive: false,
          issues: [],
          groupNames: [],
          reviewGroupNames: [],
          excludedNames: ["Old Group"],
        }),
      ],
    });

    expect(
      screen.queryByRole("button", { name: "Exclude All (0)" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Excluded Groups (1)")).toBeInTheDocument();
  });

  it("does not throw when Skip to the End is clicked", async () => {
    const user = userEvent.setup();
    const manyNames = Array.from(
      { length: 16 },
      (_, i) => `Group ${i}`
    );

    renderSection({
      reasonSections: [
        baseSection({
          groupNames: manyNames,
          reviewGroupNames: manyNames,
        }),
      ],
    });

    Element.prototype.scrollIntoView = vi.fn();

    await user.click(
      screen.getByRole("button", { name: "Skip to the End ↓" })
    );

    expect(
      screen.getByRole("button", { name: "Skip to the End ↓" })
    ).toBeInTheDocument();
  });
});
