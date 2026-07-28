import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FormatConfirmedSummary } from "./FormatConfirmedSummary";
import type { DiscoverResponse } from "@/types/api";

function baseDiscovery(
  overrides: Partial<DiscoverResponse> = {}
): DiscoverResponse {
  return {
    unit_files_found: 1,
    group_files_found: 0,
    group_file_names: [],
    selected_group_file_name: null,
    group_file_format_valid: null,
    group_file_confirmed: false,
    ready: false,
    discovered_group_names: [],
    uncommon_group_names: [],
    unit_file_candidates: [],
    selected_unit_file_names: [],
    requires_unit_file_selection: false,
    requires_format_resolution: false,
    current_unit_file_name: null,
    pending_unit_file_names: [],
    mismatched_header_files: [],
    detected_vendor_name: null,
    confirmed_vendor_name: null,
    source_headers: [],
    suggested_mapping: [],
    canonical_target_fields: [],
    required_target_fields: [],
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<
    React.ComponentProps<typeof FormatConfirmedSummary>
  > = {}
) {
  return {
    discovery: baseDiscovery(),
    forceShowFormatConfirmation: false,
    resolving: false,
    resolveError: null,
    onAcknowledged: vi.fn(),
    onChangeVendor: vi.fn(),
    onReturnToSelection: vi.fn(),
    ...overrides,
  };
}

describe("FormatConfirmedSummary", () => {
  it("shows the confirmed vendor name when one is set", () => {
    render(
      <FormatConfirmedSummary
        {...baseProps({
          discovery: baseDiscovery({ confirmed_vendor_name: "QSX" }),
        })}
      />
    );

    expect(screen.getByText(/Unit File Format Confirmed/)).toBeInTheDocument();
    expect(screen.getByText(/QSX/)).toBeInTheDocument();
  });

  it("omits the vendor name dash when none is confirmed", () => {
    render(
      <FormatConfirmedSummary
        {...baseProps({
          discovery: baseDiscovery({ confirmed_vendor_name: null }),
        })}
      />
    );

    expect(screen.getByText(/Unit File Format Confirmed/)).toBeInTheDocument();
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it("only shows the Continue button when forceShowFormatConfirmation is set, and it calls onAcknowledged", async () => {
    const user = userEvent.setup();
    const onAcknowledged = vi.fn();

    render(
      <FormatConfirmedSummary
        {...baseProps({
          forceShowFormatConfirmation: true,
          onAcknowledged,
        })}
      />
    );

    const continueButton = screen.getByRole("button", { name: "Continue" });
    await user.click(continueButton);

    expect(onAcknowledged).toHaveBeenCalledTimes(1);
  });

  it("hides the Continue button when forceShowFormatConfirmation is false", () => {
    render(
      <FormatConfirmedSummary
        {...baseProps({ forceShowFormatConfirmation: false })}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Continue" })
    ).not.toBeInTheDocument();
  });

  it("shows a reopening label and disables Change Vendor while resolving", () => {
    render(<FormatConfirmedSummary {...baseProps({ resolving: true })} />);

    const changeVendorButton = screen.getByRole("button", {
      name: "Reopening...",
    });
    expect(changeVendorButton).toBeDisabled();
  });

  it("calls onChangeVendor and onReturnToSelection when their buttons are clicked", async () => {
    const user = userEvent.setup();
    const onChangeVendor = vi.fn();
    const onReturnToSelection = vi.fn();

    render(
      <FormatConfirmedSummary
        {...baseProps({ onChangeVendor, onReturnToSelection })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Change Vendor" }));
    await user.click(
      screen.getByRole("button", { name: "Return to Unit Files Selection" })
    );

    expect(onChangeVendor).toHaveBeenCalledTimes(1);
    expect(onReturnToSelection).toHaveBeenCalledTimes(1);
  });

  it("shows a resolve error when one is present", () => {
    render(
      <FormatConfirmedSummary
        {...baseProps({ resolveError: "Something went wrong" })}
      />
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
