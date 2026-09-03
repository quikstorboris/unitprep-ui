import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FieldReferenceHelp from "./FieldReferenceHelp";

describe("FieldReferenceHelp", () => {
  it("is closed by default and opens the table on click", () => {
    render(<FieldReferenceHelp />);

    expect(screen.queryByText("Field Reference")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search fields…")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Field Reference" }));

    expect(screen.getByPlaceholderText("Search fields…")).toBeInTheDocument();
    // A real mapped field and a real not-yet-mapped one should both be visible.
    expect(screen.getAllByText("Legal Name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("QMS Credentials (encrypted, not yet shown)").length).toBeGreaterThan(0);
  });

  it("filters rows by search query across OO field, PS field, and PS key", () => {
    render(<FieldReferenceHelp />);
    fireEvent.click(screen.getByRole("button", { name: "Field Reference" }));

    fireEvent.change(screen.getByPlaceholderText("Search fields…"), { target: { value: "EIN" } });

    expect(screen.getAllByText("EIN").length).toBeGreaterThan(0);
    expect(screen.queryByText("Total Annual Business Revenue")).not.toBeInTheDocument();
  });

  it("filters rows by mapping status", () => {
    render(<FieldReferenceHelp />);
    fireEvent.click(screen.getByRole("button", { name: "Field Reference" }));

    fireEvent.change(screen.getByDisplayValue("All statuses"), { target: { value: "not_yet_mapped" } });

    expect(screen.queryByText("Original Go Live Date")).not.toBeInTheDocument();
    // Total Annual Business Revenue is now mapped (2026-09-03) -- QMS
    // Credentials is a field that genuinely stays not_yet_mapped.
    expect(screen.getAllByText("QMS Credentials (encrypted, not yet shown)").length).toBeGreaterThan(0);
  });

  it("closes on Close click", () => {
    render(<FieldReferenceHelp />);
    fireEvent.click(screen.getByRole("button", { name: "Field Reference" }));
    expect(screen.getByPlaceholderText("Search fields…")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByPlaceholderText("Search fields…")).not.toBeInTheDocument();
  });
});
