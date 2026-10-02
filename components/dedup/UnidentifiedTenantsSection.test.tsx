import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UnidentifiedTenantsSection from "./UnidentifiedTenantsSection";
import type { UnidentifiedView } from "@/types/api";

function makeSection(overrides: Partial<UnidentifiedView> = {}): UnidentifiedView {
  return {
    mode: "pending",
    tenants: [
      { display_name: "Ann Lee", units: ["00101"], same_name_as: [] },
      { display_name: "Bo Ray", units: ["00102", "00103"], same_name_as: [] },
    ],
    flagged_groups: [],
    typo_variant_candidates: [],
    related_tenant_candidates: [],
    ...overrides,
  };
}

describe("UnidentifiedTenantsSection", () => {
  it("renders nothing when nothing was held out", () => {
    const { container } = render(<UnidentifiedTenantsSection section={null} />);
    expect(container).toBeEmptyDOMElement();

    const { container: empty } = render(
      <UnidentifiedTenantsSection section={makeSection({ tenants: [] })} />
    );
    expect(empty).toBeEmptyDOMElement();
  });

  it("asks the user to choose and lists the tenants while undecided", () => {
    const onChoose = vi.fn();
    render(<UnidentifiedTenantsSection section={makeSection()} onChoose={onChoose} />);

    expect(screen.getByText("Tenants without a customer ID (2)")).toBeInTheDocument();
    expect(screen.getByText(/left out of the checks above/)).toBeInTheDocument();
    expect(screen.getByText("Ann Lee")).toBeInTheDocument();
    expect(screen.getByText("Bo Ray")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Match by name" }));
    expect(onChoose).toHaveBeenCalledWith("matched_by_name");

    fireEvent.click(screen.getByRole("button", { name: "Ignore" }));
    expect(onChoose).toHaveBeenCalledWith("ignored");
  });

  it("is read-only without a choose handler", () => {
    render(<UnidentifiedTenantsSection section={makeSection()} />);

    expect(screen.queryByRole("button", { name: "Match by name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ignore" })).not.toBeInTheDocument();
  });

  it("shows the customer ids already holding the same name once matched", () => {
    const section = makeSection({
      mode: "matched_by_name",
      tenants: [
        {
          display_name: "Ann Lee",
          units: ["00101"],
          same_name_as: [{ tenant_id: "55", display_name: "Ann Lee", units: ["00001", "00002"] }],
        },
        { display_name: "Bo Ray", units: ["00102"], same_name_as: [] },
      ],
    });
    render(<UnidentifiedTenantsSection section={section} onChoose={() => {}} />);

    expect(screen.getByText(/Matched by name/)).toBeInTheDocument();
    expect(screen.getByText(/customer ID 55 \(units 00001/)).toBeInTheDocument();
    expect(screen.getByText("No other tenant has this name")).toBeInTheDocument();

    // From here the user can still go back to ignoring them.
    expect(screen.queryByRole("button", { name: "Match by name" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ignore these instead" })).toBeInTheDocument();
  });

  it("explains an ignored choice and offers to match instead", () => {
    const onChoose = vi.fn();
    render(
      <UnidentifiedTenantsSection section={makeSection({ mode: "ignored" })} onChoose={onChoose} />
    );

    expect(screen.getByText(/not checked against the others/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Match by name" }));
    expect(onChoose).toHaveBeenCalledWith("matched_by_name");
  });

  it("disables the buttons while a choice is applied and shows a failure", () => {
    render(
      <UnidentifiedTenantsSection
        section={makeSection()}
        onChoose={() => {}}
        busy
        error="Could not re-check this run"
      />
    );

    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ignore" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not re-check this run");
  });
});
