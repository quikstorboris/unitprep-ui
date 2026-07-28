import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NetNewGroupsTable from "./NetNewGroupsTable";

describe("NetNewGroupsTable", () => {
  it("shows the all-clear message when there are no groups", () => {
    render(<NetNewGroupsTable groups={[]} />);

    expect(
      screen.getByText("No net new groups detected.")
    ).toBeInTheDocument();
    expect(screen.getByText("Net New Groups (0)")).toBeInTheDocument();
  });

  it("renders one row per group name", () => {
    render(
      <NetNewGroupsTable groups={["Building A", "Building B", "Annex"]} />
    );

    expect(screen.getByText("Net New Groups (3)")).toBeInTheDocument();
    expect(screen.getByText("Building A")).toBeInTheDocument();
    expect(screen.getByText("Building B")).toBeInTheDocument();
    expect(screen.getByText("Annex")).toBeInTheDocument();
  });

  it("renders a single group without a plural mismatch in the surrounding text", () => {
    render(<NetNewGroupsTable groups={["Solo Building"]} />);

    expect(screen.getByText("Net New Groups (1)")).toBeInTheDocument();
    expect(screen.getByText("Solo Building")).toBeInTheDocument();
  });
});
