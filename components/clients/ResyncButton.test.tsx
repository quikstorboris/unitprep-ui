import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { previewResync, applyResync } = vi.hoisted(() => ({
  previewResync: vi.fn(),
  applyResync: vi.fn(),
}));

vi.mock("@/lib/clientsCompanies", () => ({
  previewResync,
  applyResync,
}));

import ResyncButton from "./ResyncButton";

describe("ResyncButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies immediately, with no confirmation needed, when the preview finds no conflicts", async () => {
    previewResync.mockResolvedValue({
      kind: "ok",
      data: { safe_update_count: 2, conflicts: [] },
    });
    applyResync.mockResolvedValue({ kind: "ok", data: { updated_count: 2 } });

    const user = userEvent.setup();
    render(<ResyncButton companyId="company-1" />);

    await user.click(screen.getByRole("button", { name: "Re-sync" }));

    expect(await screen.findByText("Updated 2 records.")).toBeInTheDocument();
    expect(applyResync).toHaveBeenCalledWith("company-1", []);
    expect(screen.queryByText(/manually corrected/i)).not.toBeInTheDocument();
  });

  it("reports when nothing needed updating", async () => {
    previewResync.mockResolvedValue({
      kind: "ok",
      data: { safe_update_count: 0, conflicts: [] },
    });
    applyResync.mockResolvedValue({ kind: "ok", data: { updated_count: 0 } });

    const user = userEvent.setup();
    render(<ResyncButton companyId="company-1" />);

    await user.click(screen.getByRole("button", { name: "Re-sync" }));

    expect(await screen.findByText("Already up to date.")).toBeInTheDocument();
  });

  // Regression test for the hybrid design Boris asked for: a field
  // that's been manually corrected in OO and now conflicts with a fresh
  // Process Street value must never be silently overwritten -- it has
  // to be shown, defaulted to "keep OO's value" (the same safe default
  // the scheduled sync applies), and require an explicit choice to
  // change.
  it("shows a conflict, defaulted to keep OO's value, and applies nothing until confirmed", async () => {
    previewResync.mockResolvedValue({
      kind: "ok",
      data: {
        safe_update_count: 1,
        conflicts: [
          {
            entity_type: "company",
            entity_id: "company-1",
            entity_label: "Prairie Enterprises LLC",
            field: "legal_name",
            current_value: "Manually Corrected LLC",
            fresh_value: "Stale PS Legal Name LLC",
          },
        ],
      },
    });

    const user = userEvent.setup();
    render(<ResyncButton companyId="company-1" />);

    await user.click(screen.getByRole("button", { name: "Re-sync" }));

    expect(await screen.findByText("Some fields have been manually corrected")).toBeInTheDocument();
    expect(screen.getByText("Manually Corrected LLC")).toBeInTheDocument();
    expect(screen.getByText("Stale PS Legal Name LLC")).toBeInTheDocument();

    const keepMine = screen.getByRole("radio", { name: /Keep OO's value/ });
    expect(keepMine).toBeChecked();

    expect(applyResync).not.toHaveBeenCalled();
  });

  it("sends use_fresh: true only for a conflict the user explicitly chose to overwrite", async () => {
    previewResync.mockResolvedValue({
      kind: "ok",
      data: {
        safe_update_count: 0,
        conflicts: [
          {
            entity_type: "company",
            entity_id: "company-1",
            entity_label: "Prairie Enterprises LLC",
            field: "legal_name",
            current_value: "Manually Corrected LLC",
            fresh_value: "Corrected By PS Now LLC",
          },
        ],
      },
    });
    applyResync.mockResolvedValue({ kind: "ok", data: { updated_count: 1 } });

    const user = userEvent.setup();
    render(<ResyncButton companyId="company-1" />);

    await user.click(screen.getByRole("button", { name: "Re-sync" }));
    await screen.findByText("Some fields have been manually corrected");

    await user.click(screen.getByRole("radio", { name: /Use Process Street's value/ }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(applyResync).toHaveBeenCalledWith("company-1", [
      {
        entity_type: "company",
        entity_id: "company-1",
        field: "legal_name",
        use_fresh: true,
      },
    ]);
    expect(await screen.findByText("Updated 1 record.")).toBeInTheDocument();
  });

  it("closes the conflict dialog without applying anything when cancelled", async () => {
    previewResync.mockResolvedValue({
      kind: "ok",
      data: {
        safe_update_count: 0,
        conflicts: [
          {
            entity_type: "facility",
            entity_id: "facility-1",
            entity_label: "Highway 20 Self Storage",
            field: "phone",
            current_value: "555-CORRECTED",
            fresh_value: "555-STALE",
          },
        ],
      },
    });

    const user = userEvent.setup();
    render(<ResyncButton companyId="company-1" />);

    await user.click(screen.getByRole("button", { name: "Re-sync" }));
    await screen.findByText("Some fields have been manually corrected");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Some fields have been manually corrected")).not.toBeInTheDocument();
    expect(applyResync).not.toHaveBeenCalled();
  });

  it("shows an error when the preview request fails", async () => {
    previewResync.mockResolvedValue({ kind: "error", message: "Process Street is unreachable" });

    const user = userEvent.setup();
    render(<ResyncButton companyId="company-1" />);

    await user.click(screen.getByRole("button", { name: "Re-sync" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Process Street is unreachable");
    expect(applyResync).not.toHaveBeenCalled();
  });
});
