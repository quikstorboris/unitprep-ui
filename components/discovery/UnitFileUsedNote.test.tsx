import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormatConfirmedSummary } from "./FormatConfirmedSummary";
import { UnitFileUsedNote } from "./UnitFileUsedNote";
import type { DiscoverResponse } from "@/types/api";

function discoveryWith(selected: string[]): DiscoverResponse {
  return {
    unit_files_found: selected.length,
    group_files_found: 0,
    group_file_names: [],
    selected_group_file_name: null,
    group_file_format_valid: null,
    group_file_confirmed: false,
    ready: false,
    discovered_group_names: [],
    uncommon_group_names: [],
    unit_file_candidates: [],
    selected_unit_file_names: selected,
    requires_unit_file_selection: false,
    requires_format_resolution: false,
    current_unit_file_name: null,
    pending_unit_file_names: [],
    mismatched_header_files: [],
    detected_vendor_name: "SiteLink Custom Unit Report",
    confirmed_vendor_name: "SiteLink Custom Unit Report",
    source_headers: [],
    suggested_mapping: [],
    canonical_target_fields: [],
    required_target_fields: [],
  };
}

describe("UnitFileUsedNote", () => {
  it("names the one unit file that will be used, without its folder", () => {
    render(<UnitFileUsedNote discovery={discoveryWith(["Folder/Sub/Custom Unit Report.xlsx"])} />);

    expect(screen.getByText(/Unit file that will be used:/)).toBeInTheDocument();
    expect(screen.getByText("Custom Unit Report.xlsx")).toBeInTheDocument();
  });

  it("lists several files in the plural form", () => {
    render(<UnitFileUsedNote discovery={discoveryWith(["a.csv", "b.csv"])} />);

    expect(screen.getByText(/Unit files that will be used:/)).toBeInTheDocument();
    expect(screen.getByText("a.csv, b.csv")).toBeInTheDocument();
  });

  it("renders nothing before any file is selected", () => {
    const { container } = render(<UnitFileUsedNote discovery={discoveryWith([])} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows up in the confirmed-format summary", () => {
    render(
      <FormatConfirmedSummary
        discovery={discoveryWith(["units.csv"])}
        forceShowFormatConfirmation={false}
        resolving={false}
        resolveError={null}
        onAcknowledged={() => {}}
        onChangeVendor={() => {}}
        onReturnToSelection={() => {}}
      />
    );

    expect(screen.getByText("units.csv")).toBeInTheDocument();
  });
});
