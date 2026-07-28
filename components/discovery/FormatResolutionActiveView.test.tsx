import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FormatResolutionActiveView } from "./FormatResolutionActiveView";
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
    selected_unit_file_names: ["units.csv"],
    requires_unit_file_selection: false,
    requires_format_resolution: true,
    current_unit_file_name: "units.csv",
    pending_unit_file_names: ["units.csv"],
    mismatched_header_files: [],
    detected_vendor_name: "QSX",
    confirmed_vendor_name: null,
    source_headers: ["Unit", "Tenant", "Balance"],
    suggested_mapping: [],
    canonical_target_fields: ["unit_number", "tenant_name"],
    required_target_fields: ["unit_number"],
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<
    React.ComponentProps<typeof FormatResolutionActiveView>
  > = {}
) {
  return {
    discovery: baseDiscovery(),
    resolving: false,
    resolveError: null,
    showManualMapping: false,
    mapping: {},
    missingRequiredFields: [],
    onReturnToSelection: vi.fn(),
    onConfirmVendor: vi.fn(),
    onOpenManualMapping: vi.fn(),
    onCloseManualMapping: vi.fn(),
    onMappingChange: vi.fn(),
    onSubmitMapping: vi.fn(),
    ...overrides,
  };
}

describe("FormatResolutionActiveView", () => {
  it("shows the detected vendor and a Confirm button when a vendor was detected", async () => {
    const user = userEvent.setup();
    const onConfirmVendor = vi.fn();

    render(
      <FormatResolutionActiveView
        {...baseProps({ onConfirmVendor })}
      />
    );

    expect(screen.getByText(/Detected format:/)).toBeInTheDocument();
    expect(screen.getByText("QSX")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm QSX" }));
    expect(onConfirmVendor).toHaveBeenCalledTimes(1);
  });

  it("shows the unrecognized-format message and no Confirm button when nothing was detected", () => {
    render(
      <FormatResolutionActiveView
        {...baseProps({
          discovery: baseDiscovery({ detected_vendor_name: null }),
        })}
      />
    );

    expect(screen.getByText(/format wasn.t recognized/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Confirm/ })
    ).not.toBeInTheDocument();
  });

  it("mentions applying to every selected file when more than one file is selected", () => {
    render(
      <FormatResolutionActiveView
        {...baseProps({
          discovery: baseDiscovery({
            selected_unit_file_names: ["a.csv", "b.csv", "c.csv"],
          }),
        })}
      />
    );

    expect(screen.getByText(/every selected file/)).toBeInTheDocument();
    expect(screen.getByText(/3.*total/)).toBeInTheDocument();
  });

  it("lists mismatched header files by basename, not their full uploaded path", () => {
    render(
      <FormatResolutionActiveView
        {...baseProps({
          discovery: baseDiscovery({
            mismatched_header_files: ["Wave 1/oddball.csv"],
          }),
        })}
      />
    );

    expect(screen.getByText("oddball.csv")).toBeInTheDocument();
    expect(screen.queryByText(/Wave 1\//)).not.toBeInTheDocument();
    expect(
      screen.getByText(/don.t all share the same columns/)
    ).toBeInTheDocument();
  });

  it("calls onOpenManualMapping when Map Fields Manually is clicked", async () => {
    const user = userEvent.setup();
    const onOpenManualMapping = vi.fn();

    render(
      <FormatResolutionActiveView
        {...baseProps({ onOpenManualMapping })}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Map Fields Manually" })
    );
    expect(onOpenManualMapping).toHaveBeenCalledTimes(1);
  });

  it("renders the manual mapping table with target fields and required markers", () => {
    render(
      <FormatResolutionActiveView
        {...baseProps({ showManualMapping: true })}
      />
    );

    expect(screen.getByText("unit_number")).toBeInTheDocument();
    expect(screen.getByText("tenant_name")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("calls onMappingChange with the target and chosen source column", async () => {
    const user = userEvent.setup();
    const onMappingChange = vi.fn();

    render(
      <FormatResolutionActiveView
        {...baseProps({ showManualMapping: true, onMappingChange })}
      />
    );

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "Unit");

    expect(onMappingChange).toHaveBeenCalledWith("unit_number", "Unit");
  });

  it("disables Save Mapping while required fields are missing and shows which ones", () => {
    render(
      <FormatResolutionActiveView
        {...baseProps({
          showManualMapping: true,
          missingRequiredFields: ["unit_number"],
        })}
      />
    );

    expect(
      screen.getByRole("button", { name: "Save Mapping" })
    ).toBeDisabled();
    const missingFieldsMessage = screen.getByText(
      /Still need a source column for:/
    );
    expect(missingFieldsMessage).toBeInTheDocument();
    expect(missingFieldsMessage.closest("div")).toHaveTextContent(
      "unit_number"
    );
  });

  it("enables Save Mapping and calls onSubmitMapping once every required field is mapped", async () => {
    const user = userEvent.setup();
    const onSubmitMapping = vi.fn();

    render(
      <FormatResolutionActiveView
        {...baseProps({
          showManualMapping: true,
          missingRequiredFields: [],
          onSubmitMapping,
        })}
      />
    );

    const saveButton = screen.getByRole("button", { name: "Save Mapping" });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    expect(onSubmitMapping).toHaveBeenCalledTimes(1);
  });

  it("calls onCloseManualMapping and onReturnToSelection from their respective buttons", async () => {
    const user = userEvent.setup();
    const onCloseManualMapping = vi.fn();
    const onReturnToSelection = vi.fn();

    render(
      <FormatResolutionActiveView
        {...baseProps({
          showManualMapping: true,
          onCloseManualMapping,
          onReturnToSelection,
        })}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Return to Unit Files Selection" })
    );
    await user.click(
      screen.getAllByRole("button", { name: "Cancel Mapping" })[0]
    );

    expect(onReturnToSelection).toHaveBeenCalledTimes(1);
    expect(onCloseManualMapping).toHaveBeenCalledTimes(1);
  });

  it("shows a resolve error when one is present", () => {
    render(
      <FormatResolutionActiveView
        {...baseProps({ resolveError: "Resolve failed" })}
      />
    );

    expect(screen.getByText("Resolve failed")).toBeInTheDocument();
  });
});
