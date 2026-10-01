import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DedupRequirementsPanel } from "./DedupRequirementsPanel";
import { requirementsResponse } from "./dedupTestData";

function panel(detectedPms: string | null = null, loading = false, error: string | null = null) {
  return (
    <DedupRequirementsPanel
      requirements={loading || error ? null : requirementsResponse()}
      loading={loading}
      error={error}
      detectedPms={detectedPms}
    />
  );
}

describe("DedupRequirementsPanel", () => {
  it("is a labelled region and defaults to the first vendor with nothing scanned", () => {
    render(panel());

    const region = screen.getByRole("region", { name: "Files required for deduplication" });
    expect(within(region).getByRole("combobox")).toHaveValue("QSX");
    expect(within(region).getByText("End Users")).toBeInTheDocument();
  });

  it("defaults to the detected PMS and lists its formats, role badges and guidance", () => {
    render(panel("SiteLink"));

    expect(screen.getByRole("combobox")).toHaveValue("SiteLink");
    expect(screen.getByText("Directory")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Supporting")).toBeInTheDocument();
    expect(screen.getByText(/Step one\./)).toHaveClass("whitespace-pre-line");
  });

  it("switches vendor from the dropdown", () => {
    render(panel("SiteLink"));

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "QSX" } });

    expect(screen.getByText("Export End Users from QSX.")).toBeInTheDocument();
    expect(screen.queryByText("Ledger guidance.")).not.toBeInTheDocument();
  });

  it("falls back to the first vendor when the detected PMS is unknown", () => {
    render(panel("Mystery"));
    expect(screen.getByRole("combobox")).toHaveValue("QSX");
  });

  it("shows loading and error states without crashing", () => {
    const { rerender } = render(panel(null, true));
    expect(screen.getByText("Loading requirements…")).toBeInTheDocument();

    rerender(panel(null, false, "boom"));
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
