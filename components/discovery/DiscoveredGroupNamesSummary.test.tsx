import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiscoveredGroupNamesSummary } from "./DiscoveredGroupNamesSummary";
import type { DiscoverResponse } from "@/types/api";

function baseDiscovery(
  overrides: Partial<DiscoverResponse> = {}
): DiscoverResponse {
  return {
    unit_files_found: 1,
    group_files_found: 1,
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

describe("DiscoveredGroupNamesSummary", () => {
  it("uses singular wording for exactly one discovered group name", () => {
    render(
      <DiscoveredGroupNamesSummary
        discovery={baseDiscovery({
          discovered_group_names: ["10x10"],
          uncommon_group_names: [],
        })}
      />
    );

    expect(
      screen.getByText(/1 distinct group name found across/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 distinct group found — click to review/)
    ).toBeInTheDocument();
  });

  it("uses plural wording and lists every name when none are uncommon", () => {
    render(
      <DiscoveredGroupNamesSummary
        discovery={baseDiscovery({
          discovered_group_names: ["10x10", "10x20", "10x15"],
          uncommon_group_names: [],
        })}
      />
    );

    expect(
      screen.getByText(/3 distinct group names found across/)
    ).toBeInTheDocument();
    expect(screen.queryByText("Uncommon Group Names")).not.toBeInTheDocument();
    expect(screen.getByText("10x10")).toBeInTheDocument();
    expect(screen.getByText("10x20")).toBeInTheDocument();
    expect(screen.getByText("10x15")).toBeInTheDocument();
  });

  it("splits uncommon names into their own section and excludes them from the main list", () => {
    render(
      <DiscoveredGroupNamesSummary
        discovery={baseDiscovery({
          discovered_group_names: ["10x10", "10x20", "GARBAGE"],
          uncommon_group_names: ["GARBAGE"],
        })}
      />
    );

    expect(screen.getByText("Uncommon Group Names")).toBeInTheDocument();

    const mainList = screen.getByText("10x10").closest("ul");
    expect(mainList).not.toBeNull();
    expect(mainList).not.toHaveTextContent("GARBAGE");

    const uncommonHeading = screen.getByText("Uncommon Group Names");
    const uncommonList = uncommonHeading.parentElement?.querySelector("ul");
    expect(uncommonList).toHaveTextContent("GARBAGE");
  });
});
